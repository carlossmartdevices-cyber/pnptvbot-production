const axios = require('axios');
const crypto = require('crypto');
const PaymentModel = require('../../models/paymentModel');
const UserModel = require('../../models/userModel');
const PlanModel = require('../../models/planModel');
const logger = require('../../utils/logger');
const { validateSchema, schemas } = require('../../utils/validation');
const { cache } = require('../../config/redis');
const {
  PaymentError,
  PaymentProviderError,
  PaymentNotFoundError,
  DuplicatePaymentError,
  InvalidSignatureError,
  NotFoundError,
  ConfigurationError,
} = require('../../utils/errors');

/**
 * Payment Service - Business logic for payment operations
 */
class PaymentService {
  /**
   * Retry an async operation with exponential backoff
   * @param {Function} operation - Async function to retry
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @param {string} operationName - Name for logging
   * @returns {Promise<any>} Result of the operation
   */
  static async retryWithBackoff(operation, maxRetries = 3, operationName = 'operation') {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * (2 ** attempt), 10000); // Cap at 10 seconds
          logger.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, {
            error: error.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    logger.error(`${operationName} failed after ${maxRetries + 1} attempts`, {
      error: lastError.message,
    });
    throw lastError;
  }
  /**
   * Create payment for subscription
   * @param {Object} paymentData - { userId, planId, provider }
   * @returns {Promise<Object>} { success, error, paymentUrl, paymentId }
   */
  static async createPayment(paymentData) {
    try {
      // Get plan details
      const plan = await PlanModel.getById(paymentData.planId);
      if (!plan) {
        throw new NotFoundError('Plan');
      }

      // Validate payment data
      const { error } = validateSchema({
        userId: paymentData.userId,
        amount: plan.price,
        currency: plan.currency,
        planId: paymentData.planId,
        provider: paymentData.provider,
      }, schemas.payment);

      if (error) {
        throw new PaymentError(error);
      }

      // Create payment record
      const payment = await PaymentModel.create({
        userId: paymentData.userId.toString(),
        planId: paymentData.planId,
        amount: plan.price,
        currency: plan.currency,
        provider: paymentData.provider,
      });

      logger.info('Payment record created', {
        paymentId: payment.id,
        userId: paymentData.userId,
        planId: paymentData.planId,
        provider: paymentData.provider,
      });

      // Generate payment URL based on provider
      let paymentUrl;
      if (paymentData.provider === 'epayco') {
        paymentUrl = await this.createEpaycoPayment(payment, plan);
      } else if (paymentData.provider === 'daimo') {
        paymentUrl = await this.createDaimoPayment(payment, plan);
      } else {
        throw new PaymentError('Invalid payment provider');
      }

      return {
        success: true,
        error: null,
        paymentUrl,
        paymentId: payment.id,
      };
    } catch (error) {
      logger.error('Error creating payment:', {
        userId: paymentData?.userId,
        planId: paymentData?.planId,
        provider: paymentData?.provider,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create ePayco payment
   * @param {Object} payment - Payment record
   * @param {Object} plan - Plan details
   * @returns {Promise<string>} Payment URL
   */
  static async createEpaycoPayment(payment, plan) {
    try {
      if (!process.env.EPAYCO_PUBLIC_KEY) {
        throw new Error('ePayco is not configured. Please contact support.');
      }

      const epaycoData = {
        public_key: process.env.EPAYCO_PUBLIC_KEY,
        currency: 'USD',
        amount: plan.price,
        tax_base: '0',
        tax: '0',
        country: 'US',
        lang: 'en',
        external: 'false',
        extra1: payment.id,
        extra2: payment.userId,
        extra3: payment.planId,
        confirmation: `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/epayco`,
        response: `${process.env.BOT_WEBHOOK_DOMAIN}/api/payment-response`,
        name_billing: plan.name,
        description: `${plan.name} Plan - ${plan.duration} days`,
        test: process.env.EPAYCO_TEST_MODE === 'true' ? 'true' : 'false',
      };

      // ePayco uses GET parameters for payment link
      const params = new URLSearchParams(epaycoData);
      const paymentUrl = `https://checkout.epayco.co/checkout.php?${params.toString()}`;

      // Update payment with transaction details
      await PaymentModel.updateStatus(payment.id, 'pending', {
        paymentUrl,
        provider: 'epayco',
      });

      return paymentUrl;
    } catch (error) {
      logger.error('Error creating ePayco payment:', error);
      throw error;
    }
  }

  /**
   * Create Daimo payment
   * @param {Object} payment - Payment record
   * @param {Object} plan - Plan details
   * @returns {Promise<string>} Payment URL
   */
  static async createDaimoPayment(payment, plan) {
    try {
      if (!process.env.DAIMO_API_KEY) {
        throw new ConfigurationError('Daimo payment is not configured. Please contact support.');
      }

      // Daimo Pay API integration with retry logic
      const response = await this.retryWithBackoff(
        async () => axios.post('https://api.daimo.com/v1/payments', {
          amount: plan.price,
          currency: 'USDC',
          description: `${plan.name} Plan - PNPtv`,
          metadata: {
            paymentId: payment.id,
            userId: payment.userId,
            planId: payment.planId,
          },
          callback_url: `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/daimo`,
        }, {
          headers: {
            Authorization: `Bearer ${process.env.DAIMO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }),
        3,
        'Daimo payment creation',
      );

      const { payment_url, transaction_id } = response.data;

      if (!payment_url || !transaction_id) {
        throw new PaymentProviderError('daimo', 'Invalid response from Daimo API');
      }

      logger.info('Daimo payment created', {
        paymentId: payment.id,
        transactionId: transaction_id,
        amount: plan.price,
      });

      // Update payment with transaction details
      await PaymentModel.updateStatus(payment.id, 'pending', {
        paymentUrl: payment_url,
        transactionId: transaction_id,
        provider: 'daimo',
      });

      return payment_url;
    } catch (error) {
      logger.error('Error creating Daimo payment:', {
        paymentId: payment.id,
        error: error.message,
        stack: error.stack,
      });
      throw new PaymentProviderError('daimo', error.message);
    }
  }

  /**
   * Process ePayco webhook with idempotency
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} { success, error }
   */
  static async processEpaycoWebhook(webhookData) {
    try {
      const {
        x_ref_payco, x_transaction_state, x_extra1, x_extra2, x_extra3, x_signature,
      } = webhookData;

      const paymentId = x_extra1;
      const userId = x_extra2;
      const planId = x_extra3;

      // Verify webhook signature for ePayco (always required)
      const isValid = this.verifyEpaycoSignature(webhookData);
      if (!isValid) {
        logger.warn('Invalid ePayco webhook signature', { paymentId, transactionId: x_ref_payco });
        throw new InvalidSignatureError('epayco');
      }

      // Idempotency check: Use transaction ID as unique key
      const idempotencyKey = `webhook:epayco:${x_ref_payco}`;
      const lockAcquired = await cache.acquireLock(idempotencyKey, 120); // 2 min lock

      if (!lockAcquired) {
        logger.info('Webhook already processing (idempotency)', { paymentId, transactionId: x_ref_payco });
        throw new DuplicatePaymentError(paymentId);
      }

      try {
        // Get payment record
        const payment = await PaymentModel.getById(paymentId);
        if (!payment) {
          logger.warn('Payment not found for ePayco webhook', { paymentId });
          throw new PaymentNotFoundError(paymentId);
        }

        // Check if already processed
        if (payment.status === 'success' || payment.status === 'failed') {
          logger.info('Payment already processed', { paymentId, status: payment.status });
          return { success: true, alreadyProcessed: true };
        }

        // Check transaction state
        if (x_transaction_state === 'Aceptada' || x_transaction_state === 'Approved') {
          // Payment successful
          await this.activateSubscription(userId, planId, payment);

          await PaymentModel.updateStatus(paymentId, 'success', {
            transactionId: x_ref_payco,
            completedAt: new Date(),
          });

          logger.info('ePayco payment successful', { paymentId, userId });
          return { success: true };
        }

        if (x_transaction_state === 'Rechazada' || x_transaction_state === 'Declined') {
          // Payment failed
          await PaymentModel.updateStatus(paymentId, 'failed', {
            transactionId: x_ref_payco,
            failedAt: new Date(),
          });

          logger.warn('ePayco payment failed', { paymentId, userId });
          return { success: false, error: 'Payment declined' };
        }

        // Pending state
        await PaymentModel.updateStatus(paymentId, 'pending', {
          transactionId: x_ref_payco,
        });

        return { success: true };
      } finally {
        // Always release lock
        await cache.releaseLock(idempotencyKey);
      }
    } catch (error) {
      logger.error('Error processing ePayco webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Daimo webhook with idempotency
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} { success, error }
   */
  static async processDaimoWebhook(webhookData) {
    try {
      // Verify webhook signature
      const isValid = this.verifyDaimoSignature(webhookData);
      if (!isValid) {
        logger.warn('Invalid Daimo webhook signature');
        throw new InvalidSignatureError('daimo');
      }

      const {
        transaction_id, status, metadata,
      } = webhookData;

      const { paymentId, userId, planId } = metadata;

      // Idempotency check: Use transaction ID as unique key
      const idempotencyKey = `webhook:daimo:${transaction_id}`;
      const lockAcquired = await cache.acquireLock(idempotencyKey, 120); // 2 min lock

      if (!lockAcquired) {
        logger.info('Webhook already processing (idempotency)', { paymentId, transactionId: transaction_id });
        throw new DuplicatePaymentError(paymentId);
      }

      try {
        // Get payment record
        const payment = await PaymentModel.getById(paymentId);
        if (!payment) {
          logger.warn('Payment not found for Daimo webhook', { paymentId });
          throw new PaymentNotFoundError(paymentId);
        }

        // Check if already processed
        if (payment.status === 'success' || payment.status === 'failed') {
          logger.info('Payment already processed', { paymentId, status: payment.status });
          return { success: true, alreadyProcessed: true };
        }

        if (status === 'completed') {
          // Payment successful
          await this.activateSubscription(userId, planId, payment);

          await PaymentModel.updateStatus(paymentId, 'success', {
            transactionId: transaction_id,
            completedAt: new Date(),
          });

          logger.info('Daimo payment successful', { paymentId, userId });
          return { success: true };
        }

        if (status === 'failed') {
          await PaymentModel.updateStatus(paymentId, 'failed', {
            transactionId: transaction_id,
            failedAt: new Date(),
          });

          logger.warn('Daimo payment failed', { paymentId, userId });
          return { success: false, error: 'Payment failed' };
        }

        return { success: true };
      } finally {
        // Always release lock
        await cache.releaseLock(idempotencyKey);
      }
    } catch (error) {
      logger.error('Error processing Daimo webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Activate user subscription after successful payment
   * @param {string} userId - User ID
   * @param {string} planId - Plan ID
   * @param {Object} payment - Payment record
   * @returns {Promise<boolean>} Success status
   */
  static async activateSubscription(userId, planId, payment) {
    try {
      const plan = await PlanModel.getById(planId);
      if (!plan) {
        logger.error('Plan not found for activation', { planId });
        return false;
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (plan.duration || 30));

      // Update user subscription
      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId,
        expiry: expiryDate,
      });

      logger.info('Subscription activated', { userId, planId, expiryDate });
      return true;
    } catch (error) {
      logger.error('Error activating subscription:', error);
      return false;
    }
  }

  /**
   * Verify Daimo webhook signature
   * @param {Object} webhookData - Webhook payload
   * @returns {boolean} Verification result
   */
  static verifyDaimoSignature(webhookData) {
    try {
      const { signature, ...data } = webhookData;
      const secret = process.env.DAIMO_WEBHOOK_SECRET;

      if (!secret) {
        logger.error('CRITICAL: DAIMO_WEBHOOK_SECRET not configured - webhook signature verification failed');
        // Only allow missing secret in local development
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
          throw new ConfigurationError('DAIMO_WEBHOOK_SECRET must be configured in production and staging');
        }
        logger.warn('Development mode: allowing webhook without verification (INSECURE - only for local development)');
        return true;
      }

      if (!signature) {
        logger.error('Daimo webhook signature missing');
        return false;
      }

      const payload = JSON.stringify(data);
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      // Re-throw configuration errors - these should not be caught
      if (error.name === 'ConfigurationError' || error.message.includes('must be configured')) {
        throw error;
      }
      logger.error('Error verifying Daimo signature:', error);
      return false;
    }
  }

  /**
   * Verify ePayco webhook signature
   * @param {Object} webhookData - Webhook payload
   * @returns {boolean} Verification result
   */
  static verifyEpaycoSignature(webhookData) {
    try {
      const { x_signature, ...data } = webhookData;
      const secret = process.env.EPAYCO_PRIVATE_KEY;

      if (!secret) {
        logger.error('CRITICAL: EPAYCO_PRIVATE_KEY not configured - webhook signature verification failed');
        // Only allow missing secret in local development
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
          throw new ConfigurationError('EPAYCO_PRIVATE_KEY must be configured in production and staging');
        }
        logger.warn('Development mode: allowing webhook without verification (INSECURE - only for local development)');
        return true;
      }

      if (!x_signature) {
        logger.error('ePayco webhook signature missing');
        return false;
      }

      // ePayco signature format: concatenate specific fields and hash
      const {
        x_cust_id_cliente, x_ref_payco, x_transaction_id, x_amount,
      } = data;

      const signatureString = `${x_cust_id_cliente}^${secret}^${x_ref_payco}^${x_transaction_id}^${x_amount}`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(signatureString);
      const expectedSignature = hmac.digest('hex');

      return x_signature === expectedSignature;
    } catch (error) {
      // Re-throw configuration errors - these should not be caught
      if (error.name === 'ConfigurationError' || error.message.includes('must be configured')) {
        throw error;
      }
      logger.error('Error verifying ePayco signature:', error);
      return false;
    }
  }

  /**
   * Get user payment history
   * @param {number|string} userId - User ID
   * @returns {Promise<Array>} Payment history
   */
  static async getPaymentHistory(userId) {
    try {
      return await PaymentModel.getByUser(userId);
    } catch (error) {
      logger.error('Error getting payment history:', error);
      return [];
    }
  }
}

module.exports = PaymentService;
