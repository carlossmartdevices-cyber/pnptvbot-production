const axios = require('axios');
const crypto = require('crypto');
const PaymentModel = require('../../models/paymentModel');
const UserModel = require('../../models/userModel');
const PlanModel = require('../../models/planModel');
const logger = require('../../utils/logger');
const { validateSchema, schemas } = require('../../utils/validation');

/**
 * Payment Service - Business logic for payment operations
 */
class PaymentService {
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
        return { success: false, error: 'Plan not found' };
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
        return { success: false, error };
      }

      // Create payment record
      const payment = await PaymentModel.create({
        userId: paymentData.userId.toString(),
        planId: paymentData.planId,
        amount: plan.price,
        currency: plan.currency,
        provider: paymentData.provider,
      });

      // Generate payment URL based on provider
      let paymentUrl;
      if (paymentData.provider === 'epayco') {
        paymentUrl = await this.createEpaycoPayment(payment, plan);
      } else if (paymentData.provider === 'daimo') {
        paymentUrl = await this.createDaimoPayment(payment, plan);
      } else {
        return { success: false, error: 'Invalid payment provider' };
      }

      return {
        success: true,
        error: null,
        paymentUrl,
        paymentId: payment.id,
      };
    } catch (error) {
      logger.error('Error creating payment:', error);
      return { success: false, error: error.message };
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
      // Daimo Pay API integration
      const response = await axios.post('https://api.daimo.com/v1/payments', {
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
      });

      const { payment_url, transaction_id } = response.data;

      // Update payment with transaction details
      await PaymentModel.updateStatus(payment.id, 'pending', {
        paymentUrl: payment_url,
        transactionId: transaction_id,
        provider: 'daimo',
      });

      return payment_url;
    } catch (error) {
      logger.error('Error creating Daimo payment:', error);
      throw error;
    }
  }

  /**
   * Process ePayco webhook
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} { success, error }
   */
  static async processEpaycoWebhook(webhookData) {
    try {
      const {
        x_ref_payco, x_transaction_state, x_extra1, x_extra2, x_extra3,
      } = webhookData;

      const paymentId = x_extra1;
      const userId = x_extra2;
      const planId = x_extra3;

      // Get payment record
      const payment = await PaymentModel.getById(paymentId);
      if (!payment) {
        logger.warn('Payment not found for ePayco webhook', { paymentId });
        return { success: false, error: 'Payment not found' };
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
    } catch (error) {
      logger.error('Error processing ePayco webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Daimo webhook
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} { success, error }
   */
  static async processDaimoWebhook(webhookData) {
    try {
      // Verify webhook signature
      const isValid = this.verifyDaimoSignature(webhookData);
      if (!isValid) {
        logger.warn('Invalid Daimo webhook signature');
        return { success: false, error: 'Invalid signature' };
      }

      const {
        transaction_id, status, metadata,
      } = webhookData;

      const { paymentId, userId, planId } = metadata;

      // Get payment record
      const payment = await PaymentModel.getById(paymentId);
      if (!payment) {
        logger.warn('Payment not found for Daimo webhook', { paymentId });
        return { success: false, error: 'Payment not found' };
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

      const payload = JSON.stringify(data);
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying Daimo signature:', error);
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
