/**
 * Daimo Pay Configuration
 * Official integration for receiving payments via Zelle, CashApp, Venmo, Revolut, Wise
 * Using USDC on Optimism network
 */

const { getAddress } = require('viem');
const logger = require('../utils/logger');

// Default configuration (Optimism + USDC)
// These can be overridden via environment variables
const DEFAULT_CHAIN_ID = 10; // Optimism
const DEFAULT_CHAIN_NAME = 'Optimism';
const DEFAULT_TOKEN_ADDRESS = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'; // USDC on Optimism
const DEFAULT_TOKEN_SYMBOL = 'USDC';
const DEFAULT_TOKEN_DECIMALS = 6;

// Supported payment apps (prioritized in this order)
const SUPPORTED_PAYMENT_APPS = [
  'Zelle',
  'CashApp',
  'Venmo',
  'Revolut',
  'Wise',
];

/**
 * Get Daimo Pay configuration
 * @returns {Object} Daimo configuration
 */
const getDaimoConfig = () => {
  const treasuryAddress = process.env.DAIMO_TREASURY_ADDRESS;
  const refundAddress = process.env.DAIMO_REFUND_ADDRESS;
  const webhookUrl = process.env.BOT_WEBHOOK_DOMAIN
    ? `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/daimo`
    : null;

  // Get chain configuration (with defaults)
  const chainId = process.env.DAIMO_CHAIN_ID
    ? parseInt(process.env.DAIMO_CHAIN_ID, 10)
    : DEFAULT_CHAIN_ID;
  const tokenAddress = process.env.DAIMO_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;
  const tokenSymbol = process.env.DAIMO_TOKEN_SYMBOL || DEFAULT_TOKEN_SYMBOL;
  const tokenDecimals = process.env.DAIMO_TOKEN_DECIMALS
    ? parseInt(process.env.DAIMO_TOKEN_DECIMALS, 10)
    : DEFAULT_TOKEN_DECIMALS;

  // Validate critical configuration
  if (!treasuryAddress) {
    // Nunca loggear el valor de la dirección
    logger.error('DAIMO_TREASURY_ADDRESS not configured');
    throw new Error('DAIMO_TREASURY_ADDRESS is required for Daimo Pay');
  }

  if (!refundAddress) {
    // Nunca loggear el valor de la dirección
    logger.warn('DAIMO_REFUND_ADDRESS not configured, using treasury address as fallback');
  }

  return {
    // Network configuration (configurable via env vars)
    chainId,
    chainName: DEFAULT_CHAIN_NAME, // Could be made configurable if needed

    // Token configuration (configurable via env vars)
    token: getAddress(tokenAddress),
    tokenSymbol,
    tokenDecimals,

    // Addresses
    treasuryAddress: getAddress(treasuryAddress),
    refundAddress: getAddress(refundAddress || treasuryAddress),

    // Payment apps configuration
    supportedPaymentApps: SUPPORTED_PAYMENT_APPS,

    // API configuration
    apiKey: process.env.DAIMO_API_KEY, // Optional: only needed for API calls
    appId: process.env.DAIMO_APP_ID,   // Optional: only needed for SDK integration

    // Webhook configuration
    webhookUrl,
    webhookSecret: process.env.DAIMO_WEBHOOK_SECRET,

    // App metadata
    appName: 'PNPtv Bot',
    appDescription: 'Premium subscriptions and content access',
    appIcon: process.env.BOT_WEBHOOK_DOMAIN
      ? `${process.env.BOT_WEBHOOK_DOMAIN}/logo.png`
      : null,
  };
};

/**
 * Create payment intent for Daimo Pay
 * @param {Object} params - { amount, userId, planId, chatId, paymentId, description }
 * @returns {Object} Payment intent object
 */
const createPaymentIntent = ({
  amount, userId, planId, chatId, paymentId, description,
}) => {
  const config = getDaimoConfig();

  // Convert amount to token units (USDC has 6 decimals)
  // Example: 10.00 USD -> 10000000 units
  const amountInUnits = (parseFloat(amount) * 1e6).toString();

  return {
    // Destination
    toAddress: config.treasuryAddress,
    toChain: config.chainId,
    toToken: config.token,
    toUnits: amountInUnits,

    // Payment description
    intent: description || `PNPtv ${planId} Subscription`,

    // Refund address (if payment fails)
    refundAddress: config.refundAddress,

    // Metadata (will be returned in webhook)
    metadata: {
      userId: userId.toString(),
      chatId: chatId?.toString(),
      planId,
      amount: amount.toString(),
      paymentId: paymentId?.toString(), // Include payment ID for webhook processing
      timestamp: new Date().toISOString(),
    },

    // Payment options (prioritize these apps)
    paymentOptions: config.supportedPaymentApps,
  };
};

/**
 * Generate Daimo Pay link (DEPRECATED - use createDaimoPayment instead)
 * @param {Object} paymentIntent - Payment intent object
 * @returns {string} Payment URL
 * @deprecated Use createDaimoPayment for the official API
 */
const generatePaymentLink = (paymentIntent) => {
  const baseUrl = 'https://pay.daimo.com/pay';
  const params = new URLSearchParams({
    intent: JSON.stringify(paymentIntent),
  });

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Create a payment using Daimo Pay API (Official method)
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} { success, paymentUrl, daimoPaymentId, error }
 */
const createDaimoPayment = async ({
  amount, userId, planId, chatId, paymentId, description,
}) => {
  const config = getDaimoConfig();
  
  if (!config.apiKey) {
    logger.error('DAIMO_API_KEY not configured');
    return { success: false, error: 'Daimo API key not configured' };
  }

  try {
    // Format amount as string with 2 decimals (e.g., "14.99")
    const amountUnits = parseFloat(amount).toFixed(2);
    
    const requestBody = {
      display: {
        intent: description || `PNPtv ${planId} Subscription`,
        paymentOptions: ['AllWallets', 'AllExchanges', 'AllPaymentApps'],
        preferredChains: [config.chainId],
      },
      destination: {
        destinationAddress: config.treasuryAddress,
        chainId: config.chainId,
        tokenAddress: config.token,
        amountUnits: amountUnits,
      },
      refundAddress: config.refundAddress,
      metadata: {
        userId: userId.toString(),
        chatId: chatId?.toString() || '',
        planId: planId,
        paymentId: paymentId,
        source: 'pnptv-bot',
      },
    };

    logger.info('Creating Daimo payment via API', {
      paymentId,
      planId,
      amountUnits,
    });

    const response = await fetch('https://pay.daimo.com/api/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Daimo API error', {
        status: response.status,
        error: errorText,
        paymentId,
      });
      return { 
        success: false, 
        error: `Daimo API error: ${response.status}`,
      };
    }

    const data = await response.json();

    logger.info('Daimo payment created successfully', {
      paymentId,
      daimoPaymentId: data.id,
      url: data.url,
    });

    return {
      success: true,
      paymentUrl: data.url,
      daimoPaymentId: data.id,
      payment: data.payment,
    };

  } catch (error) {
    logger.error('Error creating Daimo payment', {
      error: error.message,
      paymentId,
    });
    return { 
      success: false, 
      error: error.message,
    };
  }
};

/**
 * Validate Daimo webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateWebhookPayload = (payload) => {
  // Support both legacy format (transaction_id, status) and new format (id, status)
  const webhookId = payload.id || payload.transaction_id;
  const webhookStatus = payload.status;
  const webhookMetadata = payload.metadata;

  // Check for minimal required fields that identify a Daimo webhook
  if (!webhookId || !webhookStatus) {
    return {
      valid: false,
      error: 'Missing required fields: id/transaction_id and status',
    };
  }

  // Check for metadata with required user context
  if (!webhookMetadata) {
    return {
      valid: false,
      error: 'Invalid metadata structure',
    };
  }

  // Validate metadata has required fields
  if (!webhookMetadata.userId || !webhookMetadata.planId || !webhookMetadata.paymentId) {
    return {
      valid: false,
      error: 'Invalid metadata structure',
    };
  }

  // If it's the new format, validate source and destination (optional for backward compatibility)
  if (payload.source || payload.destination) {
    // New format validation
    if (!payload.source?.payerAddress || !payload.source?.txHash) {
      return {
        valid: false,
        error: 'Invalid metadata structure',
      };
    }

    if (!payload.destination?.toAddress || !payload.destination?.toToken) {
      return {
        valid: false,
        error: 'Invalid metadata structure',
      };
    }
  }

  return { valid: true };
};

/**
 * Get payment status from Daimo status
 * @param {string} daimoStatus - Daimo payment status
 * @returns {string} Internal payment status
 */
const mapDaimoStatus = (daimoStatus) => {
  const statusMap = {
    payment_unpaid: 'pending',
    payment_started: 'pending',
    payment_completed: 'success',
    payment_bounced: 'failed',
  };

  return statusMap[daimoStatus] || 'pending';
};

/**
 * Format amount from USDC units to display value
 * @param {string} units - Amount in token units
 * @returns {number} Amount in display value (e.g., 10.50)
 */
const formatAmountFromUnits = (units) => parseFloat(units) / 1e6;

module.exports = {
  getDaimoConfig,
  createPaymentIntent,
  generatePaymentLink,
  createDaimoPayment,
  validateWebhookPayload,
  mapDaimoStatus,
  formatAmountFromUnits,
  SUPPORTED_PAYMENT_APPS,
  // Export defaults for backward compatibility
  OPTIMISM_USDC_ADDRESS: DEFAULT_TOKEN_ADDRESS,
  OPTIMISM_CHAIN_ID: DEFAULT_CHAIN_ID,
  // Export new default constants
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN_ADDRESS,
  DEFAULT_TOKEN_SYMBOL,
  DEFAULT_TOKEN_DECIMALS,
};
