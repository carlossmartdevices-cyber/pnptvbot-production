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

  // Validate critical configuration
  if (!treasuryAddress) {
    logger.error('DAIMO_TREASURY_ADDRESS not configured');
    throw new Error('DAIMO_TREASURY_ADDRESS is required for Daimo Pay');
  }

  if (!refundAddress) {
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
 * Generate Daimo Pay link
 * @param {Object} paymentIntent - Payment intent object
 * @returns {string} Payment URL
 */
const generatePaymentLink = (paymentIntent) => {
  const baseUrl = 'https://pay.daimo.com/pay';
  const params = new URLSearchParams({
    intent: JSON.stringify(paymentIntent),
  });

  return `${baseUrl}?${params.toString()}`;
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
  validateWebhookPayload,
  mapDaimoStatus,
  formatAmountFromUnits,
  SUPPORTED_PAYMENT_APPS,
  OPTIMISM_USDC_ADDRESS,
  OPTIMISM_CHAIN_ID,
};
