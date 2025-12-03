const { optimismUSDC } = require('@daimo/pay-common');
const { getAddress } = require('viem');
const crypto = require('crypto');
const logger = require('../../utils/logger');

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
   * Generate payment link for Daimo Pay using the API
   * @param {Object} options - Payment options
   * @param {string} options.userId - Telegram user ID
   * @param {string} options.chatId - Telegram chat ID
   * @param {string} options.planId - Plan ID
   * @param {number} options.amount - Amount in USD (will be converted to USDC)
   * @param {string} options.paymentId - Payment record ID
   * @returns {Promise<string>} Payment link
   */
  async generatePaymentLink({ userId, chatId, planId, amount, paymentId }) {
    try {
      if (!this.treasuryAddress || !this.refundAddress) {
        logger.error('Daimo addresses not configured');
        throw new Error('Daimo payment system not configured');
      }

      if (!this.apiKey) {
        logger.error('Daimo API key not configured');
        throw new Error('Daimo API key not configured');
      }

      // Convert amount to USDC units string with decimals (e.g., "24.99" for $24.99)
      const amountUnits = parseFloat(amount).toFixed(2);

      // Create payment via Daimo Pay API
      // Note: paymentOptions goes in display object per API docs
      const requestBody = {
        display: {
          intent: 'Pay PNPtv Subscription',
          paymentOptions: this.supportedPaymentApps, // ['Venmo', 'CashApp', 'Zelle', 'Revolut', 'Wise']
        },
        destination: {
          destinationAddress: this.treasuryAddress,
          chainId: this.chain.id,
          tokenAddress: this.chain.token,
          amountUnits: amountUnits,
        },
        refundAddress: this.refundAddress,
        metadata: {
          userId: String(userId),
          chatId: String(chatId),
          planId: String(planId),
          paymentId: String(paymentId),
          timestamp: String(Date.now()),
        },
      };

      logger.info('Creating Daimo payment via API', {
        paymentId,
        userId,
        amount,
        amountUnits,
        chain: this.chain.name,
      });

      const response = await fetch('https://pay.daimo.com/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Daimo API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Daimo API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.url) {
        logger.error('Daimo API response missing URL', { data });
        throw new Error('Daimo API response missing payment URL');
      }

      logger.info('Daimo payment created successfully', {
        paymentId,
        daimoPaymentId: data.id,
        url: data.url,
      });

      return data.url;
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
}

// Export singleton instance
module.exports = new DaimoService();
