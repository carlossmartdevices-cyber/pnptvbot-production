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

      // Insert with plan_id and provider
      await query(
        `INSERT INTO payments (id, user_id, plan_id, provider, amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          paymentId,
          data.userId,
          data.planId || null,
          data.provider || 'epayco',
          data.amount,
          data.status,
          data.createdAt,
          data.updatedAt
        ]
      );

      logger.info('Payment created', {
        paymentId,
        userId: paymentData.userId,
        planId: data.planId,
        provider: data.provider
      });

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
      // Map camelCase to snake_case for database columns
      const fieldMap = {
        transactionId: 'payment_id',
        completedAt: 'completed_at',
        completedBy: 'completed_by',
        manualCompletion: 'manual_completion',
        expiresAt: 'expires_at'
      };

      const fields = Object.keys(metadata).map(key => fieldMap[key] || key);
      const values = Object.values(metadata);
      let setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      setClause = `status = $1${setClause ? ', ' + setClause : ''}, updated_at = $${fields.length + 2}`;
      await query(`UPDATE payments SET ${setClause} WHERE id = $${fields.length + 3}`, [status, ...values, new Date(), paymentId]);
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
      const result = await query(
        'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId.toString(), limit]
      );
      return result.rows;
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
      const result = await query(
        'SELECT * FROM payments WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
        [status, limit]
      );
      return result.rows;
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
      const result = await query(
        'SELECT * FROM payments WHERE payment_id = $1 AND provider = $2 LIMIT 1',
        [transactionId, provider]
      );
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
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
      const result = await query(
        'SELECT * FROM payments WHERE status = $1 AND created_at >= $2 AND created_at <= $3',
        ['success', startDate, endDate]
      );

      let total = 0;
      let count = 0;
      const byPlan = {};
      const byProvider = {};

      result.rows.forEach((payment) => {
        total += parseFloat(payment.amount) || 0;
        count += 1;

        // Count by plan
        if (payment.plan_id) {
          byPlan[payment.plan_id] = (byPlan[payment.plan_id] || 0) + 1;
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

  /**
   * Get all payments with optional filters
   * @param {Object} filters - { startDate, endDate, provider, status, limit }
   * @returns {Promise<Array>} Payments
   */
  static async getAll(filters = {}) {
    try {
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.provider) {
        conditions.push(`provider = $${paramIndex++}`);
        params.push(filters.provider);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 1000;

      const sql = `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT ${limit}`;
      const result = await query(sql, params);

      return result.rows;
    } catch (error) {
      logger.error('Error getting all payments:', error);
      return [];
    }
  }
}

module.exports = PaymentModel;
