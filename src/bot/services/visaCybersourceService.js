const axios = require('axios');
const crypto = require('crypto');
const PaymentModel = require('../../models/paymentModel');
const SubscriberModel = require('../../models/subscriberModel');
const PlanModel = require('../../models/planModel');
const UserModel = require('../../models/userModel');
const config = require('../../config/payment.config');
const logger = require('../../utils/logger');

/**
 * Visa Cybersource Service - Handles recurring payment processing
 * for monthly Crystal and Diamond subscription plans
 */
class VisaCybersourceService {
  /**
   * Create a recurring payment subscription
   * @param {Object} params - Subscription parameters
   * @param {string} params.userId - Telegram user ID
   * @param {string} params.planId - Plan ID (monthly_crystal or monthly_diamond)
   * @param {Object} params.paymentMethod - Payment method details
   * @param {string} params.email - Customer email
   * @returns {Promise<Object>} Subscription result
   */
  static async createRecurringSubscription({ userId, planId, paymentMethod, email }) {
    try {
      // Validate plan is supported
      const configData = config.visaCybersource;
      if (!configData.supportedPlans.includes(planId)) {
        throw new Error(`Plan ${planId} is not supported for recurring payments via Visa Cybersource`);
      }

      // Get plan details
      const plan = await PlanModel.getById(planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Get user details
      const user = await UserModel.getById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Prepare subscription data for Visa Cybersource API
      const subscriptionData = {
        merchantId: configData.merchantId,
        planId,
        userId,
        email: email || user.email,
        amount: plan.price,
        currency: 'USD',
        paymentMethod,
        billingCycle: 'monthly',
        startDate: new Date(),
        status: 'active',
      };

      // Call Visa Cybersource API to create subscription
      const apiResponse = await this._callCybersourceApi('createSubscription', subscriptionData);

      if (apiResponse.success) {
        // Create payment record
        const payment = await PaymentModel.create({
          userId,
          planId,
          provider: 'visa_cybersource',
          amount: plan.price,
          currency: 'USD',
          status: 'active',
          reference: apiResponse.subscriptionId,
          paymentMethod: 'credit_card',
        });

        // Create/update subscriber record
        const subscriber = await SubscriberModel.createOrUpdate({
          telegramId: userId,
          email: subscriptionData.email,
          name: user.firstName || 'Customer',
          plan: planId,
          subscriptionId: apiResponse.subscriptionId,
          provider: 'visa_cybersource',
          status: 'active',
        });

        logger.info('Visa Cybersource recurring subscription created', {
          userId,
          planId,
          subscriptionId: apiResponse.subscriptionId,
          amount: plan.price,
        });

        return {
          success: true,
          subscriptionId: apiResponse.subscriptionId,
          paymentId: payment.id,
          subscriberId: subscriber.id,
          message: 'Recurring subscription created successfully',
        };
      } else {
        throw new Error(apiResponse.error || 'Failed to create recurring subscription');
      }
    } catch (error) {
      logger.error('Error creating Visa Cybersource subscription:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create recurring subscription',
      };
    }
  }

  /**
   * Process recurring payment (called by webhook or scheduled job)
   * @param {Object} params - Payment parameters
   * @param {string} params.subscriptionId - Visa Cybersource subscription ID
   * @param {number} params.amount - Payment amount
   * @returns {Promise<Object>} Payment result
   */
  static async processRecurringPayment({ subscriptionId, amount }) {
    try {
      // Get subscription details from database
      const subscriber = await SubscriberModel.getBySubscriptionId(subscriptionId);
      if (!subscriber) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Call Visa Cybersource API to process payment
      const apiResponse = await this._callCybersourceApi('processPayment', {
        subscriptionId,
        amount,
        currency: 'USD',
      });

      if (apiResponse.success) {
        // Update payment status
        const payment = await PaymentModel.updateStatus(subscriptionId, {
          status: 'completed',
          completedAt: new Date(),
          transactionId: apiResponse.transactionId,
        });

        // Update subscriber's last payment date
        await SubscriberModel.updateLastPayment(subscriber.id, new Date());

        // Extend user's subscription
        const plan = await PlanModel.getById(subscriber.plan);
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Add 1 month

        await UserModel.updateSubscription(subscriber.telegramId, {
          status: 'active',
          planId: subscriber.plan,
          expiry: expiryDate,
        });

        logger.info('Visa Cybersource recurring payment processed', {
          subscriptionId,
          userId: subscriber.telegramId,
          amount,
          transactionId: apiResponse.transactionId,
        });

        return {
          success: true,
          transactionId: apiResponse.transactionId,
          paymentId: payment.id,
          message: 'Recurring payment processed successfully',
        };
      } else {
        throw new Error(apiResponse.error || 'Failed to process recurring payment');
      }
    } catch (error) {
      logger.error('Error processing Visa Cybersource recurring payment:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process recurring payment',
      };
    }
  }

  /**
   * Cancel a recurring subscription
   * @param {string} subscriptionId - Visa Cybersource subscription ID
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelRecurringSubscription(subscriptionId) {
    try {
      // Call Visa Cybersource API to cancel subscription
      const apiResponse = await this._callCybersourceApi('cancelSubscription', {
        subscriptionId,
      });

      if (apiResponse.success) {
        // Update subscriber status
        const subscriber = await SubscriberModel.getBySubscriptionId(subscriptionId);
        if (subscriber) {
          await SubscriberModel.updateStatus(subscriber.id, 'cancelled');
        }

        // Update payment status
        await PaymentModel.updateStatus(subscriptionId, {
          status: 'cancelled',
          cancelledAt: new Date(),
        });

        logger.info('Visa Cybersource recurring subscription cancelled', {
          subscriptionId,
        });

        return {
          success: true,
          message: 'Recurring subscription cancelled successfully',
        };
      } else {
        throw new Error(apiResponse.error || 'Failed to cancel recurring subscription');
      }
    } catch (error) {
      logger.error('Error cancelling Visa Cybersource subscription:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to cancel recurring subscription',
      };
    }
  }

  /**
   * Handle Visa Cybersource webhook notifications
   * @param {Object} webhookData - Webhook payload
   * @param {string} signature - Webhook signature for verification
   * @returns {Promise<Object>} Webhook processing result
   */
  static async handleWebhook(webhookData, signature) {
    try {
      // Verify webhook signature
      const isValid = this._verifyWebhookSignature(webhookData, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Process different webhook event types
      const eventType = webhookData.eventType;
      const data = webhookData.data;

      switch (eventType) {
        case 'payment.success':
          return await this._handlePaymentSuccess(data);
        case 'payment.failed':
          return await this._handlePaymentFailed(data);
        case 'subscription.created':
          return await this._handleSubscriptionCreated(data);
        case 'subscription.cancelled':
          return await this._handleSubscriptionCancelled(data);
        case 'subscription.updated':
          return await this._handleSubscriptionUpdated(data);
        default:
          logger.warn('Unhandled Visa Cybersource webhook event:', { eventType });
          return { success: true, message: 'Event type not handled' };
      }
    } catch (error) {
      logger.error('Error processing Visa Cybersource webhook:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process webhook',
      };
    }
  }

  /**
   * Call Visa Cybersource API
   * @private
   */
  static async _callCybersourceApi(endpoint, data) {
    const configData = config.visaCybersource;
    
    try {
      const response = await axios.post(
        `${configData.endpoint}/${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${configData.apiKey}`,
            'x-merchant-id': configData.merchantId,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Visa Cybersource API error:', {
        endpoint,
        error: error.message,
        response: error.response?.data,
      });
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Verify webhook signature
   * @private
   */
  static _verifyWebhookSignature(data, signature) {
    const configData = config.visaCybersource;
    const hmac = crypto.createHmac('sha256', configData.webhookSecret);
    const computedSignature = hmac.update(JSON.stringify(data)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature));
  }

  /**
   * Webhook event handlers
   * @private
   */
  static async _handlePaymentSuccess(data) {
    // Implement payment success logic
    return { success: true, message: 'Payment success handled' };
  }

  static async _handlePaymentFailed(data) {
    // Implement payment failure logic
    return { success: true, message: 'Payment failure handled' };
  }

  static async _handleSubscriptionCreated(data) {
    // Implement subscription created logic
    return { success: true, message: 'Subscription created handled' };
  }

  static async _handleSubscriptionCancelled(data) {
    // Implement subscription cancelled logic
    return { success: true, message: 'Subscription cancelled handled' };
  }

  static async _handleSubscriptionUpdated(data) {
    // Implement subscription updated logic
    return { success: true, message: 'Subscription updated handled' };
  }
}

module.exports = VisaCybersourceService;