const PaymentService = require('../../services/paymentService');
const logger = require('../../../utils/logger');
const DaimoConfig = require('../../../config/daimo');

// In-memory cache for webhook idempotency (prevents duplicate processing within 5 minutes)
// In production, use Redis for this
const webhookCache = new Map();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup interval to prevent memory leaks - runs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of webhookCache.entries()) {
    if (now - timestamp >= IDEMPOTENCY_TTL) {
      webhookCache.delete(key);
    }
  }
  logger.debug(`Webhook cache cleanup: ${webhookCache.size} entries remaining`);
}, 10 * 60 * 1000); // Run every 10 minutes

/**
 * Check if webhook was already processed using idempotency key
 * @param {string} idempotencyKey - Unique key for this webhook
 * @returns {boolean} True if already processed
 */
const isWebhookProcessed = (idempotencyKey) => {
  if (webhookCache.has(idempotencyKey)) {
    const timestamp = webhookCache.get(idempotencyKey);
    if (Date.now() - timestamp < IDEMPOTENCY_TTL) {
      return true;
    }
    // Expired, remove from cache
    webhookCache.delete(idempotencyKey);
  }
  return false;
};

/**
 * Mark webhook as processed
 * @param {string} idempotencyKey - Unique key for this webhook
 */
const markWebhookProcessed = (idempotencyKey) => {
  webhookCache.set(idempotencyKey, Date.now());
};

/**
 * Send a normalized error response
 * @param {Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
const sendError = (res, status, code, message) => res.status(status).json({
  success: false,
  code,
  message,
});

/**
 * Sanitize bot username for safe HTML insertion
 * @param {string} username - Raw username
 * @returns {string} Sanitized username
 */
const sanitizeBotUsername = (username) => {
  if (!username) return 'pnptv_bot';
  // Remove any HTML/script characters, keep only alphanumeric and underscore
  return username.replace(/[^a-zA-Z0-9_]/g, '') || 'pnptv_bot';
};

/**
 * Validate ePayco webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateEpaycoPayload = (payload) => {
  const requiredFields = ['x_ref_payco', 'x_transaction_state', 'x_extra1', 'x_extra2', 'x_extra3'];
  const missingFields = requiredFields.filter((field) => !payload[field]);

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  return { valid: true };
};

/**
 * Validate Daimo webhook payload
 * Uses the official Daimo Pay webhook structure
 * @param {Object} payload - Webhook payload
 * @returns {Object} { valid: boolean, error?: string, isTestEvent?: boolean }
 */
const validateDaimoPayload = (payload) => {
  // Handle test events from Daimo's /api/webhook/test endpoint
  // Test events have structure: { type, isTestEvent, paymentId, chainId, txHash, payment }
  if (payload && payload.isTestEvent === true) {
    logger.info('Daimo test event received', { type: payload.type, paymentId: payload.paymentId });
    return { valid: true, isTestEvent: true };
  }

  // Support two payload shapes:
  // 1) Official Daimo webhook structure (id, status, source, destination, metadata)
  // 2) Simplified test-friendly shape (transaction_id, status, metadata)
  if (payload && payload.transaction_id && payload.status && payload.metadata) {
    // Metadata must be an object
    if (typeof payload.metadata !== 'object' || payload.metadata === null) {
      return { valid: false, error: 'Invalid metadata structure' };
    }
    // Check for required metadata fields
    const { paymentId, userId, planId } = payload.metadata;
    if (!paymentId || !userId || !planId) {
      return { valid: false, error: 'Invalid metadata structure' };
    }
    return { valid: true };
  }
  // Fallback to official validator
  try {
    const result = DaimoConfig.validateWebhookPayload(payload);
    if (result && typeof result === 'object') {
      // If missing paymentId, userId, planId, normalize error
      if (result.error && result.error.toLowerCase().includes('missing required fields')) {
        return { valid: false, error: 'Missing required fields' };
      }
      const errorMsg = result.error ? result.error.toLowerCase() : '';
      const metadataErrors = ['metadata', 'source', 'destination'];
      const isMetadataError = metadataErrors.some((term) => errorMsg.includes(term));
      if (result.error && isMetadataError) {
        return { valid: false, error: 'Invalid metadata structure' };
      }
      return result;
    }
    return { valid: false, error: 'Invalid metadata structure' };
  } catch (err) {
    if (err && err.message && err.message.toLowerCase().includes('missing required fields')) {
      return { valid: false, error: 'Missing required fields' };
    }
    if (err && err.message) {
      const errMsg = err.message.toLowerCase();
      const metadataErrors = ['metadata', 'source', 'destination'];
      const isMetadataError = metadataErrors.some((term) => errMsg.includes(term));
      if (isMetadataError) {
      return { valid: false, error: 'Invalid metadata structure' };
    }
    }
    return { valid: false, error: 'Invalid metadata structure' };
  }
};

/**
 * Handle ePayco webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleEpaycoWebhook = async (req, res) => {
  try {
    // Ensure transaction ID is present to build a stable idempotency key
    if (!req.body.x_transaction_id) {
      logger.warn('ePayco webhook missing transaction ID', {
        transactionId: req.body.x_ref_payco,
        signaturePresent: Boolean(req.body.x_signature),
        provider: 'epayco',
      });
      return sendError(res, 400, 'MISSING_TRANSACTION_ID', 'x_transaction_id is required');
    }

    // Use transaction ID as idempotency key
    const idempotencyKey = `epayco_${req.body.x_transaction_id}`;

    // Verify webhook signature before any processing
    const signatureCheck = verifyEpaycoSignature(req);
    if (!signatureCheck.valid) {
      const status = signatureCheck.reason === 'missing_signature' ? 400 : 401;
      return sendError(res, status, 'INVALID_SIGNATURE', signatureCheck.error);
    }

    // Check if this webhook was already processed
    if (isWebhookProcessed(idempotencyKey)) {
      logger.info('Duplicate ePayco webhook detected (already processed)', {
        transactionId: req.body.x_ref_payco,
        txId: req.body.x_transaction_id,
        idempotencyKey,
        provider: 'epayco',
        signaturePresent: Boolean(req.body.x_signature),
      });
      return res.status(200).json({ success: true, duplicate: true });
    }

    logger.info('ePayco webhook received', {
      transactionId: req.body.x_ref_payco,
      state: req.body.x_transaction_state,
      idempotencyKey,
      provider: 'epayco',
      signaturePresent: Boolean(req.body.x_signature),
    });

    // Validate payload structure
    const validation = validateEpaycoPayload(req.body);
    if (!validation || !validation.valid) {
      const errorMsg = validation?.error || 'Invalid webhook payload';
      logger.warn('Invalid ePayco webhook payload', { error: errorMsg });
      return sendError(res, 400, 'INVALID_PAYLOAD', errorMsg);
    }

    const result = await PaymentService.processEpaycoWebhook(req.body);

    if (result.success) {
      markWebhookProcessed(idempotencyKey);
      return res.status(200).json({ success: true });
    }

    logger.warn('ePayco webhook rejected during processing', {
      transactionId: req.body.x_ref_payco,
      error: result.error,
      idempotencyKey,
      provider: 'epayco',
      signaturePresent: Boolean(req.body.x_signature),
    });
    return sendError(res, 400, 'EPAYCO_REJECTED', result.error || 'Webhook processing failed');
  } catch (error) {
    logger.error('Error handling ePayco webhook:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

/**
 * Validate and verify ePayco webhook signature before processing
 * @param {Request} req
 * @returns {boolean} True when signature is valid
 */
function verifyEpaycoSignature(req) {
  const hasSignature = Boolean(req.body?.x_signature);
  const signatureResult = PaymentService.verifyEpaycoSignature(req.body);
  const isValid = typeof signatureResult === 'object' && signatureResult !== null
    ? signatureResult.valid !== false
    : Boolean(signatureResult);

  if (!isValid) {
    logger.error('Invalid ePayco webhook signature', {
      hasSignature,
      transactionId: req.body?.x_ref_payco,
    });
    const reason = hasSignature ? 'invalid_signature' : 'missing_signature';
    const error = hasSignature ? 'Invalid signature' : 'Missing signature';
    return { valid: false, reason, error };
  }

  if (!hasSignature) {
    logger.warn('ePayco webhook missing signature', {
      transactionId: req.body?.x_ref_payco,
    });
  }

  return { valid: true };
}

/**
 * Handle Daimo webhook
 * Receives payment events from Daimo Pay (Zelle, CashApp, Venmo, Revolut, Wise)
 * Webhook URL: pnptv.app/api/daimo -> /api/webhooks/daimo
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleDaimoWebhook = async (req, res) => {
  const DaimoService = require('../../services/daimoService');

  try {
    const {
      id, status, source, metadata,
    } = req.body;

    // Use event ID as idempotency key
    const idempotencyKey = `daimo_${id}`;

    // Check if this webhook was already processed
    if (isWebhookProcessed(idempotencyKey)) {
      logger.info('Duplicate Daimo webhook detected (already processed)', {
        eventId: id,
        status,
      });
      return res.status(200).json({ success: true, duplicate: true });
    }

    logger.info('Daimo Pay webhook received', {
      eventId: id,
      status,
      txHash: source?.txHash,
      userId: metadata?.userId,
      planId: metadata?.planId,
      chain: 'Optimism',
      token: source?.tokenSymbol || 'USDC',
    });

    // Verify webhook authorization
    // Daimo uses Authorization: Basic <token> header for webhook verification
    const authHeader = req.headers['authorization'] || req.headers['x-daimo-signature'];
    const isValidSignature = DaimoService.verifyWebhookSignature(req.body, authHeader);

    if (!isValidSignature) {
      logger.error('Invalid Daimo webhook authorization', {
        eventId: id,
        hasAuthHeader: !!authHeader,
      });
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Validate payload structure
    const validation = validateDaimoPayload(req.body);
    if (!validation || !validation.valid) {
        const errorMsg = validation?.error || 'Invalid metadata structure';
        logger.warn('Invalid Daimo webhook payload', {
          error: errorMsg,
          receivedFields: Object.keys(req.body),
        });
        return res.status(400).json({ success: false, error: 'Invalid metadata structure' });
    }

    // Handle test events - acknowledge without processing
    if (validation.isTestEvent) {
      markWebhookProcessed(idempotencyKey);
      logger.info('Daimo test event acknowledged', { eventId: id });
      return res.status(200).json({ success: true, testEvent: true });
    }

    // Process webhook with auth header
    const result = await PaymentService.processDaimoWebhook(req.body, authHeader);

    if (result.success) {
      markWebhookProcessed(idempotencyKey);
      logger.info('Daimo webhook processed successfully', {
        eventId: id,
        status,
        alreadyProcessed: result.alreadyProcessed || false,
      });
      return res.status(200).json({ success: true });
    }

    logger.warn('Daimo webhook processing failed', {
      eventId: id,
      error: result.error,
    });
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    logger.error('Error handling Daimo webhook:', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handle payment response page
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handlePaymentResponse = async (req, res) => {
  try {
    const { status } = req.query;

    if (status === 'success' || status === 'approved') {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .success-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h1 {
              color: #667eea;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              transition: background 0.3s;
            }
            .button:hover {
              background: #764ba2;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your PRIME subscription has been activated. Return to the Telegram bot to enjoy premium features!</p>
            <a href="https://t.me/${sanitizeBotUsername(process.env.BOT_USERNAME)}" class="button">Open Telegram Bot</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Failed</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h1 {
              color: #f5576c;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #f5576c;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              transition: background 0.3s;
              margin: 5px;
            }
            .button:hover {
              background: #f093fb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Payment Failed</h1>
            <p>Your payment could not be processed. Please try again or contact support.</p>
            <a href="https://t.me/${sanitizeBotUsername(process.env.BOT_USERNAME)}" class="button">Return to Bot</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    logger.error('Error handling payment response:', error);
    res.status(500).send('Error processing payment response');
  }
};

module.exports = {
  handleEpaycoWebhook,
  handleDaimoWebhook,
  handlePaymentResponse,
};
