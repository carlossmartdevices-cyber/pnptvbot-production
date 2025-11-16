const { v4: uuidv4 } = require('uuid');
const { getFirestore } = require('../config/firebase');
const logger = require('../utils/logger');

const COLLECTION = 'payments';

/**
 * Payment Model - Handles payment transactions
 */
class PaymentModel {
  /**
   * Create payment record
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment
   */
  static async create(paymentData) {
    try {
      const db = getFirestore();
      const paymentId = paymentData.paymentId || uuidv4();
      const paymentRef = db.collection(COLLECTION).doc(paymentId);

      const data = {
        ...paymentData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await paymentRef.set(data);

      logger.info('Payment created', { paymentId, userId: paymentData.userId });
      return { id: paymentId, ...data };
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object|null>} Payment data
   */
  static async getById(paymentId) {
    try {
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(paymentId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting payment:', error);
      return null;
    }
  }

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {string} status - Payment status
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success status
   */
  static async updateStatus(paymentId, status, metadata = {}) {
    try {
      const db = getFirestore();
      const paymentRef = db.collection(COLLECTION).doc(paymentId);

      await paymentRef.update({
        status,
        ...metadata,
        updatedAt: new Date(),
      });

      logger.info('Payment status updated', { paymentId, status });
      return true;
    } catch (error) {
      logger.error('Error updating payment status:', error);
      return false;
    }
  }

  /**
   * Get user payments
   * @param {number|string} userId - User ID
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} User payments
   */
  static async getByUser(userId, limit = 20) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('userId', '==', userId.toString())
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const payments = [];
      snapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() });
      });

      return payments;
    } catch (error) {
      logger.error('Error getting user payments:', error);
      return [];
    }
  }

  /**
   * Get payments by status
   * @param {string} status - Payment status
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} Payments
   */
  static async getByStatus(status, limit = 100) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const payments = [];
      snapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() });
      });

      return payments;
    } catch (error) {
      logger.error('Error getting payments by status:', error);
      return [];
    }
  }

  /**
   * Get payment by transaction ID (from payment provider)
   * @param {string} transactionId - Transaction ID from provider
   * @param {string} provider - Payment provider (epayco, daimo)
   * @returns {Promise<Object|null>} Payment data
   */
  static async getByTransactionId(transactionId, provider) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('transactionId', '==', transactionId)
        .where('provider', '==', provider)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting payment by transaction ID:', error);
      return null;
    }
  }

  /**
   * Get revenue statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Revenue stats
   */
  static async getRevenue(startDate, endDate) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('status', '==', 'success')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      let total = 0;
      let count = 0;
      const byPlan = {};
      const byProvider = {};

      snapshot.forEach((doc) => {
        const payment = doc.data();
        total += payment.amount || 0;
        count += 1;

        // Count by plan
        if (payment.planId) {
          byPlan[payment.planId] = (byPlan[payment.planId] || 0) + 1;
        }

        // Count by provider
        if (payment.provider) {
          byProvider[payment.provider] = (byProvider[payment.provider] || 0) + 1;
        }
      });

      return {
        total,
        count,
        average: count > 0 ? total / count : 0,
        byPlan,
        byProvider,
      };
    } catch (error) {
      logger.error('Error getting revenue stats:', error);
      return {
        total: 0, count: 0, average: 0, byPlan: {}, byProvider: {},
      };
    }
  }
}

module.exports = PaymentModel;
