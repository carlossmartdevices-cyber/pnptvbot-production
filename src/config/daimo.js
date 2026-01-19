/**
 * Daimo Pay Configuration
 * Official integration for receiving payments via Zelle, CashApp, Venmo, Revolut, Wise
 * Using USDC on Optimism network
 */

const { getAddress } = require('viem');
const logger = require('../utils/logger');

// Optimism USDC Token Address (official)
const OPTIMISM_USDC_ADDRESS = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const OPTIMISM_CHAIN_ID = 10;

// Supported payment options (Daimo Pay API format)
// AllWallets: Shows all crypto wallets (MetaMask, Rainbow, etc.)
// AllExchanges: Shows all exchanges (Coinbase, Binance, etc.)
// AllPaymentApps: Desktop only - shows payment apps
// Individual apps: Venmo, CashApp, Zelle, Wise, Revolut, MercadoPago, Coinbase, Binance, Lemon
const SUPPORTED_PAYMENT_APPS = [
  // Crypto wallets and exchanges
  'AllWallets',
  'AllExchanges',
  'Coinbase',
  'Binance',
  // Payment apps (explicitly listed for mobile compatibility)
  'CashApp',
  'Venmo',
  'Zelle',
  'Wise',
  'Revolut',
  'MercadoPago',
  // Desktop fallback for any other payment apps
  'AllPaymentApps',
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
    // Network configuration
    chainId: OPTIMISM_CHAIN_ID,
    chainName: 'Optimism',

    // Token configuration (USDC on Optimism)
    token: getAddress(OPTIMISM_USDC_ADDRESS),
    tokenSymbol: 'USDC',
    tokenDecimals: 6,

    // Addresses
    treasuryAddress: getAddress(treasuryAddress),
    refundAddress: getAddress(refundAddress || treasuryAddress),

    // Payment apps configuration
    supportedPaymentApps: SUPPORTED_PAYMENT_APPS,

    // Webhook configuration
    webhookUrl,
    webhookSecret: process.env.DAIMO_WEBHOOK_SECRET,

    // API configuration
    apiKey: process.env.DAIMO_API_KEY,

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
 * @param {Object} params - { amount, userId, planId, chatId }
 * @returns {Object} Payment intent object
 */
const createPaymentIntent = ({
  amount, userId, planId, chatId, description,
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
        // Explicitly list payment apps for mobile compatibility (AllPaymentApps is desktop-only)
        paymentOptions: [
          'AllWallets',
          'AllExchanges',
          'Coinbase',
          'Binance',
          'CashApp',
          'Venmo',
          'Zelle',
          'Wise',
          'Revolut',
          'MercadoPago',
          'AllPaymentApps',
        ],
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
  // Daimo Pay webhook structure (based on official docs)
  const requiredFields = ['id', 'status', 'source', 'destination', 'metadata'];
  const missingFields = requiredFields.filter((field) => !payload[field]);

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  // Validate source structure
  if (!payload.source?.payerAddress || !payload.source?.txHash) {
    return {
      valid: false,
      error: 'Invalid source structure: payerAddress and txHash are required',
    };
  }

  // Validate destination structure
  if (!payload.destination?.toAddress || !payload.destination?.toToken) {
    return {
      valid: false,
      error: 'Invalid destination structure: toAddress and toToken are required',
    };
  }

  // Validate metadata
  if (!payload.metadata?.userId || !payload.metadata?.planId) {
    return {
      valid: false,
      error: 'Invalid metadata: userId and planId are required',
    };
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
  OPTIMISM_USDC_ADDRESS,
  OPTIMISM_CHAIN_ID,
};
