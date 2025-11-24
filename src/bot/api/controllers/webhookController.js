const PaymentService = require('../../services/paymentService');
const logger = require('../../../utils/logger');
const DaimoConfig = require('../../../config/daimo');
const FarcasterAuthService = require('../../services/farcasterAuthService');

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
  // ePayco minimum required fields according to documentation
  // x_ref_payco: ePayco transaction reference
  // x_transaction_id: Transaction ID
  // x_transaction_state: Transaction state (Aceptada, Rechazada, Pendiente)
  const requiredFields = ['x_ref_payco', 'x_transaction_state'];
  const missingFields = requiredFields.filter((field) => !payload[field]);

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  // Check for 3DS fields (x_three_d_s, x_eci, x_cavv)
  // These are important security fields that should be present in approved transactions
  const has3DSFields = payload.x_three_d_s || payload.x_eci || payload.x_cavv;
  if (!has3DSFields) {
    logger.warn('⚠️  ePayco transaction missing 3DS fields', {
      refPayco: payload.x_ref_payco,
      state: payload.x_transaction_state,
    });
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
    // ePayco sends data as query parameters in the URL
    // Merge both req.query and req.body to support both methods
    const webhookData = { ...req.query, ...req.body };

    logger.info('ePayco webhook received', {
      transactionId: webhookData.x_ref_payco,
      state: webhookData.x_transaction_state,
      source: Object.keys(req.query).length > 0 ? 'query' : 'body',
    });

    // Validate payload structure
    const validation = validateEpaycoPayload(webhookData);
    if (!validation || !validation.valid) {
      const errorMsg = validation?.error || 'Invalid webhook payload';
      logger.warn('Invalid ePayco webhook payload', { error: errorMsg });
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const result = await PaymentService.processEpaycoWebhook(webhookData);

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

/**
 * Verify Farcaster Quick Auth token
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const verifyFarcasterAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: 'Authorization header with Bearer token required',
      });
    }

    const result = await FarcasterAuthService.verifyAuthHeader(authHeader);

    if (!result.valid) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid token',
      });
    }

    logger.info('Farcaster token verified', { fid: result.fid });

    return res.status(200).json({
      success: true,
      fid: result.fid,
    });
  } catch (error) {
    logger.error('Error verifying Farcaster auth:', {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Create Daimo payment with Farcaster authentication
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const createFarcasterPayment = async (req, res) => {
  const DaimoService = require('../../services/daimoService');

  try {
    const authHeader = req.headers.authorization;
    const { userId, planId, chatId } = req.body;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: 'Authorization header with Bearer token required',
      });
    }

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        error: 'userId and planId are required',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Get plan details
    const PlanModel = require('../../../models/planModel');
    const plan = await PlanModel.getById(planId);

    if (!plan || !plan.active) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive plan',
      });
    }

    // Create payment record first
    const PaymentModel = require('../../../models/paymentModel');
    const payment = await PaymentModel.create({
      userId,
      planId,
      provider: 'daimo',
      amount: plan.price,
      status: 'pending',
    });

    // Create payment with Farcaster verification
    const result = await DaimoService.createPaymentWithFarcaster({
      token,
      userId,
      planId,
      amount: plan.price,
      chatId,
      paymentId: payment.id,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }

    logger.info('Farcaster payment created', {
      userId,
      planId,
      fid: result.farcasterFid,
      paymentId: payment.id,
    });

    return res.status(200).json({
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: payment.id,
      farcasterFid: result.farcasterFid,
    });
  } catch (error) {
    logger.error('Error creating Farcaster payment:', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Link Farcaster account to Telegram user
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const linkFarcasterAccount = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { telegramUserId } = req.body;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: 'Authorization header with Bearer token required',
      });
    }

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        error: 'telegramUserId is required',
      });
    }

    // Verify token first
    const verifyResult = await FarcasterAuthService.verifyAuthHeader(authHeader);

    if (!verifyResult.valid) {
      return res.status(401).json({
        success: false,
        error: verifyResult.error || 'Invalid token',
      });
    }

    // Link accounts
    const linkResult = await FarcasterAuthService.linkFarcasterToTelegram(
      telegramUserId,
      verifyResult.fid
    );

    if (!linkResult.success) {
      return res.status(400).json({
        success: false,
        error: linkResult.error,
      });
    }

    logger.info('Farcaster account linked', {
      telegramUserId,
      fid: verifyResult.fid,
    });

    return res.status(200).json({
      success: true,
      telegramUserId,
      farcasterFid: verifyResult.fid,
    });
  } catch (error) {
    logger.error('Error linking Farcaster account:', {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Get Farcaster user profile
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
const getFarcasterProfile = async (req, res) => {
  try {
    const { fid } = req.params;

    if (!fid) {
      return res.status(400).json({
        success: false,
        error: 'FID is required',
      });
    }

    const result = await FarcasterAuthService.getFarcasterProfile(fid);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      profile: result.profile,
    });
  } catch (error) {
    logger.error('Error getting Farcaster profile:', {
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = {
  handleEpaycoWebhook,
  handleDaimoWebhook,
  handlePaymentResponse,
  verifyFarcasterAuth,
  createFarcasterPayment,
  linkFarcasterAccount,
  getFarcasterProfile,
};
