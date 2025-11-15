const axios = require('axios');
const { getFirestore, Collections } = require('../config/firebase');
const { config } = require('../config/botConfig');
const logger = require('../../utils/logger');
const userService = require('./userService');

class PaymentService {
  constructor() {
    this.db = getFirestore();
    this.paymentsCollection = this.db.collection(Collections.PAYMENTS);
  }

  /**
   * Create ePayco payment link
   */
  async createEPaycoLink(userId, planId, planData) {
    try {
      const { publicKey, privateKey, testMode } = config.payments.epayco;

      const paymentData = {
        name: planData.name,
        description: `PNPtv ${planData.name} Subscription`,
        invoice: `PNPTV-${userId}-${Date.now()}`,
        currency: 'USD',
        amount: planData.price,
        tax_base: '0',
        tax: '0',
        country: 'CO',
        lang: 'en',
        external: 'false',
        extra1: userId.toString(),
        extra2: planId,
        extra3: 'subscription',
        confirmation: `${process.env.WEBHOOK_URL || 'https://your-domain.com'}/webhook/epayco`,
        response: `${process.env.BOT_URL || 'https://t.me/' + config.botUsername}`,
        test: testMode ? 'true' : 'false',
      };

      const response = await axios.post(
        'https://secure.epayco.co/checkout/create',
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${privateKey}`,
          },
        }
      );

      // Log payment intent
      await this.paymentsCollection.add({
        userId,
        planId,
        amount: planData.price,
        currency: 'USD',
        provider: 'epayco',
        status: 'pending',
        paymentUrl: response.data.url,
        createdAt: new Date(),
      });

      logger.info(`ePayco payment link created for user ${userId}`);
      return response.data.url;
    } catch (error) {
      logger.error('Error creating ePayco payment link:', error);
      throw new Error('Failed to create payment link. Please try again.');
    }
  }

  /**
   * Create Daimo Pay payment link
   */
  async createDaimoPayLink(userId, planId, planData) {
    try {
      const { apiKey } = config.payments.daimoPay;

      if (!apiKey) {
        throw new Error('Daimo Pay not configured');
      }

      // This is a placeholder - adjust according to Daimo Pay's actual API
      const paymentData = {
        amount: planData.price,
        currency: 'USDC',
        description: `PNPtv ${planData.name} Subscription`,
        metadata: {
          userId: userId.toString(),
          planId,
          type: 'subscription',
        },
        webhook_url: `${process.env.WEBHOOK_URL || 'https://your-domain.com'}/webhook/daimo`,
      };

      const response = await axios.post(
        'https://api.daimo.com/v1/payment_links',
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      // Log payment intent
      await this.paymentsCollection.add({
        userId,
        planId,
        amount: planData.price,
        currency: 'USDC',
        provider: 'daimo',
        status: 'pending',
        paymentUrl: response.data.payment_url,
        createdAt: new Date(),
      });

      logger.info(`Daimo Pay payment link created for user ${userId}`);
      return response.data.payment_url;
    } catch (error) {
      logger.error('Error creating Daimo Pay payment link:', error);
      throw new Error('Failed to create crypto payment link. Please try again.');
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(userId, planId, provider, transactionId) {
    try {
      // Get plan details
      const planDoc = await this.db.collection(Collections.PLANS).doc(planId).get();
      if (!planDoc.exists) {
        throw new Error('Plan not found');
      }

      const plan = planDoc.data();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (plan.durationDays || 30));

      // Update user subscription
      await userService.updateSubscription(userId, planId, expiryDate);

      // Update payment record
      const paymentQuery = await this.paymentsCollection
        .where('userId', '==', userId)
        .where('planId', '==', planId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!paymentQuery.empty) {
        await paymentQuery.docs[0].ref.update({
          status: 'completed',
          transactionId,
          completedAt: new Date(),
        });
      }

      logger.info(`Payment successful for user ${userId}, plan ${planId}`);
      return true;
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Get payment history for user
   */
  async getUserPayments(userId) {
    try {
      const snapshot = await this.paymentsCollection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error(`Error getting payments for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats() {
    try {
      const payments = await this.paymentsCollection
        .where('status', '==', 'completed')
        .get();

      const stats = {
        totalRevenue: 0,
        paymentsByProvider: {},
        paymentsByPlan: {},
        totalTransactions: payments.size,
      };

      payments.docs.forEach(doc => {
        const payment = doc.data();
        stats.totalRevenue += payment.amount || 0;

        const provider = payment.provider || 'unknown';
        stats.paymentsByProvider[provider] =
          (stats.paymentsByProvider[provider] || 0) + (payment.amount || 0);

        const planId = payment.planId || 'unknown';
        stats.paymentsByPlan[planId] =
          (stats.paymentsByPlan[planId] || 0) + (payment.amount || 0);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting revenue stats:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
