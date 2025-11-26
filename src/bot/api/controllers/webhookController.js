const PaymentService = require('../../services/paymentService');
const logger = require('../../../utils/logger');
const DaimoConfig = require('../../../config/daimo');

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
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateDaimoPayload = (payload) =>
  // Use the validation from DaimoConfig
  DaimoConfig.validateWebhookPayload(payload)
;

/**
 * Handle ePayco webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleEpaycoWebhook = async (req, res) => {
  try {
    logger.info('ePayco webhook received', {
      transactionId: req.body.x_ref_payco,
      state: req.body.x_transaction_state,
    });

    // Validate payload structure
    const validation = validateEpaycoPayload(req.body);
    if (!validation || !validation.valid) {
      const errorMsg = validation?.error || 'Invalid webhook payload';
      logger.warn('Invalid ePayco webhook payload', { error: errorMsg });
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const result = await PaymentService.processEpaycoWebhook(req.body);

    if (result.success) {
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    logger.error('Error handling ePayco webhook:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handle Daimo webhook
 * Receives payment events from Daimo Pay (Zelle, CashApp, Venmo, Revolut, Wise)
 * Webhook URL: easybots.store/api/daimo -> /api/webhooks/daimo
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const handleDaimoWebhook = async (req, res) => {
  const DaimoService = require('../../services/daimoService');

  try {
    const {
      id, status, source, metadata,
    } = req.body;

    logger.info('Daimo Pay webhook received', {
      eventId: id,
      status,
      txHash: source?.txHash,
      userId: metadata?.userId,
      planId: metadata?.planId,
      chain: 'Optimism',
      token: source?.tokenSymbol || 'USDC',
    });

    // Verify webhook signature
    const signature = req.headers['x-daimo-signature'];
    const isValidSignature = DaimoService.verifyWebhookSignature(req.body, signature);

    if (!isValidSignature) {
      logger.error('Invalid Daimo webhook signature', {
        eventId: id,
        hasSignature: !!signature,
      });
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Validate payload structure
    const validation = validateDaimoPayload(req.body);
    if (!validation || !validation.valid) {
      const errorMsg = validation?.error || 'Invalid webhook payload';
      logger.warn('Invalid Daimo webhook payload', {
        error: errorMsg,
        receivedFields: Object.keys(req.body),
      });
      return res.status(400).json({ success: false, error: errorMsg });
    }

    // Process webhook
    const result = await PaymentService.processDaimoWebhook(req.body);

    if (result.success) {
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
