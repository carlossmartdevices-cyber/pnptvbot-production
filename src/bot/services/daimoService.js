const { optimismUSDC } = require('@daimo/pay-common');
const { getAddress } = require('viem');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const FarcasterAuthService = require('./farcasterAuthService');

/**
 * Daimo Pay Service
 * Handles payment generation and processing with Daimo Pay
 * - Network: Optimism (low fees, fast finality)
 * - Token: USDC (stablecoin 1:1 with USD)
 * - Payment Apps: Zelle, CashApp, Venmo, Revolut, Wise
 */
class DaimoService {
  constructor() {
    // Configuration
    this.treasuryAddress = process.env.DAIMO_TREASURY_ADDRESS;
    this.refundAddress = process.env.DAIMO_REFUND_ADDRESS;
    this.webhookSecret = process.env.DAIMO_WEBHOOK_SECRET;
    this.apiKey = process.env.DAIMO_API_KEY;

    // Supported payment apps (prioritized in UI)
    this.supportedPaymentApps = ['Venmo', 'CashApp', 'Zelle', 'Revolut', 'Wise'];

    // Optimism USDC configuration
    this.chain = {
      id: optimismUSDC.chainId, // 10 = Optimism
      name: 'Optimism',
      token: getAddress(optimismUSDC.token),
      tokenSymbol: 'USDC',
    };

    logger.info('Daimo Service initialized', {
      chain: this.chain.name,
      chainId: this.chain.id,
      token: this.chain.tokenSymbol,
      supportedApps: this.supportedPaymentApps,
    });
  }

  /**
   * Generate payment link for Daimo Pay
   * @param {Object} options - Payment options
   * @param {string} options.userId - Telegram user ID
   * @param {string} options.chatId - Telegram chat ID
   * @param {string} options.planId - Plan ID
   * @param {number} options.amount - Amount in USD (will be converted to USDC)
   * @param {string} options.paymentId - Payment record ID
   * @returns {string} Payment link
   */
  generatePaymentLink({ userId, chatId, planId, amount, paymentId }) {
    try {
      if (!this.treasuryAddress || !this.refundAddress) {
        logger.error('Daimo addresses not configured');
        throw new Error('Daimo payment system not configured');
      }

      // Convert amount to USDC units (6 decimals for USDC)
      const amountInUSDC = (parseFloat(amount) * 1000000).toString(); // e.g., 10.00 USD = 10000000 USDC units

      // Create payment intent
      const paymentIntent = {
        toAddress: this.treasuryAddress,
        toChain: this.chain.id,
        toToken: this.chain.token,
        toUnits: amountInUSDC,
        intent: 'Pay PNPtv Subscription',
        refundAddress: this.refundAddress,
        metadata: {
          userId,
          chatId,
          planId,
          paymentId,
          timestamp: Date.now(),
        },
        paymentOptions: this.supportedPaymentApps,
      };

      // Generate payment URL
      const encodedIntent = encodeURIComponent(JSON.stringify(paymentIntent));
      const paymentUrl = `https://pay.daimo.com/pay?intent=${encodedIntent}`;

      logger.info('Daimo payment link generated', {
        paymentId,
        userId,
        amount,
        amountInUSDC,
        chain: this.chain.name,
      });

      return paymentUrl;
    } catch (error) {
      logger.error('Error generating Daimo payment link:', {
        error: error.message,
        userId,
        amount,
      });
      throw error;
    }
  }

  /**
   * Verify webhook signature from Daimo
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Signature from x-daimo-signature header
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.webhookSecret) {
        logger.warn('Daimo webhook secret not configured, skipping signature verification');
        return true; // Allow in development, but log warning
      }

      if (!signature) {
        logger.error('Missing Daimo webhook signature');
        return false;
      }

      // Create HMAC SHA-256 signature
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.error('Invalid Daimo webhook signature', {
          received: signature.substring(0, 10) + '...',
          expected: expectedSignature.substring(0, 10) + '...',
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying Daimo webhook signature:', error);
      return false;
    }
  }

  /**
   * Parse and validate Daimo webhook event
   * @param {Object} event - Webhook event data
   * @returns {Object} Parsed event data
   */
  parseWebhookEvent(event) {
    try {
      const {
        id,
        status,
        source,
        destination,
        metadata,
      } = event;

      // Validate required fields
      if (!id || !status) {
        throw new Error('Invalid webhook event: missing id or status');
      }

      // Parse source (payment details)
      const paymentDetails = {
        eventId: id,
        status,
        payerAddress: source?.payerAddress,
        txHash: source?.txHash,
        chainId: source?.chainId,
        amountUnits: source?.amountUnits,
        tokenSymbol: source?.tokenSymbol,
      };

      // Parse destination
      const destinationDetails = {
        toAddress: destination?.toAddress,
        toChain: destination?.toChain,
        toToken: destination?.toToken,
      };

      // Parse metadata (our custom data)
      const customMetadata = {
        userId: metadata?.userId,
        chatId: metadata?.chatId,
        planId: metadata?.planId,
        paymentId: metadata?.paymentId,
      };

      logger.info('Daimo webhook event parsed', {
        eventId: id,
        status,
        paymentId: customMetadata.paymentId,
      });

      return {
        ...paymentDetails,
        ...destinationDetails,
        metadata: customMetadata,
      };
    } catch (error) {
      logger.error('Error parsing Daimo webhook event:', {
        error: error.message,
        event,
      });
      throw error;
    }
  }

  /**
   * Convert USDC units to USD amount
   * @param {string} usdcUnits - USDC units (6 decimals)
   * @returns {number} USD amount
   */
  convertUSDCToUSD(usdcUnits) {
    try {
      const units = parseFloat(usdcUnits);
      return units / 1000000; // USDC has 6 decimals
    } catch (error) {
      logger.error('Error converting USDC to USD:', error);
      return 0;
    }
  }

  /**
   * Get payment status description
   * @param {string} status - Daimo payment status
   * @returns {string} Human-readable status
   */
  getStatusDescription(status) {
    const statusMap = {
      payment_unpaid: 'Pendiente',
      payment_started: 'Iniciado',
      payment_completed: 'Completado',
      payment_bounced: 'Rechazado/Devuelto',
    };

    return statusMap[status] || status;
  }

  /**
   * Check if Daimo is properly configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    const isConfigured = !!(
      this.treasuryAddress &&
      this.refundAddress &&
      this.apiKey
    );

    if (!isConfigured) {
      logger.warn('Daimo not fully configured', {
        hasTreasury: !!this.treasuryAddress,
        hasRefund: !!this.refundAddress,
        hasApiKey: !!this.apiKey,
      });
    }

    return isConfigured;
  }

  /**
   * Generate payment link with Farcaster authentication
   * @param {Object} options - Payment options
   * @param {string} options.userId - Telegram user ID
   * @param {string} options.chatId - Telegram chat ID
   * @param {string} options.planId - Plan ID
   * @param {number} options.amount - Amount in USD
   * @param {string} options.paymentId - Payment record ID
   * @param {string} options.farcasterFid - Farcaster FID (optional)
   * @returns {string} Payment link
   */
  generatePaymentLinkWithFarcaster({ userId, chatId, planId, amount, paymentId, farcasterFid }) {
    try {
      if (!this.treasuryAddress || !this.refundAddress) {
        logger.error('Daimo addresses not configured');
        throw new Error('Daimo payment system not configured');
      }

      // Convert amount to USDC units (6 decimals for USDC)
      const amountInUSDC = (parseFloat(amount) * 1000000).toString();

      // Create payment intent with Farcaster FID
      const paymentIntent = {
        toAddress: this.treasuryAddress,
        toChain: this.chain.id,
        toToken: this.chain.token,
        toUnits: amountInUSDC,
        intent: 'Pay PNPtv Subscription',
        refundAddress: this.refundAddress,
        metadata: {
          userId,
          chatId,
          planId,
          paymentId,
          farcasterFid: farcasterFid || null,
          timestamp: Date.now(),
        },
        paymentOptions: this.supportedPaymentApps,
      };

      // Generate payment URL
      const encodedIntent = encodeURIComponent(JSON.stringify(paymentIntent));
      const paymentUrl = `https://pay.daimo.com/pay?intent=${encodedIntent}`;

      logger.info('Daimo payment link generated with Farcaster', {
        paymentId,
        userId,
        farcasterFid,
        amount,
        amountInUSDC,
        chain: this.chain.name,
      });

      return paymentUrl;
    } catch (error) {
      logger.error('Error generating Daimo payment link with Farcaster:', {
        error: error.message,
        userId,
        farcasterFid,
        amount,
      });
      throw error;
    }
  }

  /**
   * Verify Farcaster authentication token
   * @param {string} token - Quick Auth JWT token
   * @returns {Promise<Object>} Verification result with FID
   */
  async verifyFarcasterAuth(token) {
    try {
      const result = await FarcasterAuthService.verifyToken(token);

      if (!result.valid) {
        logger.warn('Farcaster auth verification failed', {
          error: result.error,
        });
        return result;
      }

      logger.info('Farcaster auth verified for Daimo payment', {
        fid: result.fid,
      });

      return result;
    } catch (error) {
      logger.error('Error verifying Farcaster auth:', {
        error: error.message,
      });
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Process payment with Farcaster verification
   * @param {Object} options - Payment options
   * @param {string} options.token - Farcaster Quick Auth token
   * @param {string} options.userId - Telegram user ID
   * @param {string} options.planId - Plan ID
   * @param {number} options.amount - Amount in USD
   * @returns {Promise<Object>} Payment result with URL
   */
  async createPaymentWithFarcaster({ token, userId, planId, amount, chatId, paymentId }) {
    try {
      // Verify Farcaster authentication
      const authResult = await this.verifyFarcasterAuth(token);

      if (!authResult.valid) {
        return {
          success: false,
          error: 'Farcaster authentication failed',
          details: authResult.error,
        };
      }

      const fid = authResult.fid;

      // Link Farcaster FID to Telegram user
      await FarcasterAuthService.linkFarcasterToTelegram(userId, fid);

      // Generate payment link with FID
      const paymentUrl = this.generatePaymentLinkWithFarcaster({
        userId,
        chatId,
        planId,
        amount,
        paymentId,
        farcasterFid: fid,
      });

      logger.info('Payment created with Farcaster verification', {
        userId,
        fid,
        planId,
        amount,
      });

      return {
        success: true,
        paymentUrl,
        farcasterFid: fid,
      };
    } catch (error) {
      logger.error('Error creating payment with Farcaster:', {
        error: error.message,
        userId,
        planId,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if Farcaster authentication is configured
   * @returns {boolean} True if configured
   */
  isFarcasterConfigured() {
    return FarcasterAuthService.isConfigured();
  }
}

// Export singleton instance
module.exports = new DaimoService();
