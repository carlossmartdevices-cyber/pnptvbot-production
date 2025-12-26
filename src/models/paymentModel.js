const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Payment Model - Handles payment transactions (PostgreSQL)
 */
class PaymentModel {
  /**
   * Create payment record
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment
   */
  static async create(paymentData) {
    try {
      const paymentId = paymentData.paymentId || uuidv4();
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
   * Format payment row from DB to expected format
   */
  static _formatPayment(row) {
    if (!row) return null;
    return {
      id: row.id,
      paymentId: row.payment_id,
      userId: row.user_id,
      planId: row.plan_id,
      planName: row.plan_name,
      amount: parseFloat(row.amount) || 0,
      currency: row.currency,
      provider: row.provider,
      paymentMethod: row.payment_method,
      status: row.status,
      reference: row.reference,
      destinationAddress: row.destination_address,
      paymentUrl: row.payment_url,
      daimoLink: row.daimo_link,
      chain: row.chain,
      chainId: row.chain_id,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      manualCompletion: row.manual_completion,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object|null>} Payment data
   */
  static async getById(paymentId) {
    try {
      // Check if paymentId is a valid UUID format
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);

      let result;
      if (isUuid) {
        // Query by UUID id (cast to uuid)
        result = await query(
          'SELECT * FROM payments WHERE id = $1::uuid',
          [paymentId]
        );
        // If not found by id, try payment_id
        if (!result.rows[0]) {
          result = await query(
            'SELECT * FROM payments WHERE payment_id = $1',
            [paymentId]
          );
        }
      } else {
        // Query only by payment_id (non-UUID string)
        result = await query(
          'SELECT * FROM payments WHERE payment_id = $1',
          [paymentId]
        );
      }
      return this._formatPayment(result.rows[0]);
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
      const updates = ['status = $1', 'updated_at = $2'];
      const values = [status, new Date()];
      let paramIndex = 3;

      if (metadata.completedAt) {
        updates.push(`completed_at = $${paramIndex++}`);
        values.push(metadata.completedAt);
      }
      if (metadata.completedBy) {
        updates.push(`completed_by = $${paramIndex++}`);
        values.push(metadata.completedBy);
      }
      if (metadata.manualCompletion !== undefined) {
        updates.push(`manual_completion = $${paramIndex++}`);
        values.push(metadata.manualCompletion);
      }
      if (metadata.reference) {
        updates.push(`reference = $${paramIndex++}`);
        values.push(metadata.reference);
      }
      if (metadata.paymentUrl) {
        updates.push(`payment_url = $${paramIndex++}`);
        values.push(metadata.paymentUrl);
      }
      if (metadata.daimoLink) {
        updates.push(`daimo_link = $${paramIndex++}`);
        values.push(metadata.daimoLink);
      }
      if (metadata.provider) {
        updates.push(`provider = $${paramIndex++}`);
        values.push(metadata.provider);
      }

      values.push(paymentId);

      // Check if paymentId is a valid UUID format
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);

      let queryStr;
      if (isUuid) {
        // Only query by UUID id (cast to uuid)
        queryStr = `UPDATE payments SET ${updates.join(', ')} WHERE id = $${paramIndex}::uuid`;
      } else {
        queryStr = `UPDATE payments SET ${updates.join(', ')} WHERE payment_id = $${paramIndex}`;
      }

      await query(queryStr, values);

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
      return result.rows.map(row => this._formatPayment(row));
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
      return result.rows.map(row => this._formatPayment(row));
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
        'SELECT * FROM payments WHERE reference = $1 AND provider = $2 LIMIT 1',
        [transactionId, provider]
      );
      return this._formatPayment(result.rows[0]);
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
      // Get total and count
      const statsResult = await query(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
        FROM payments
        WHERE status = 'success'
          AND created_at >= $1
          AND created_at <= $2
      `, [startDate, endDate]);

      const { total, count } = statsResult.rows[0];

      // Get by plan
      const byPlanResult = await query(`
        SELECT plan_id, COUNT(*) as count
        FROM payments
        WHERE status = 'success'
          AND created_at >= $1
          AND created_at <= $2
          AND plan_id IS NOT NULL
        GROUP BY plan_id
      `, [startDate, endDate]);

      const byPlan = {};
      byPlanResult.rows.forEach(row => {
        byPlan[row.plan_id] = parseInt(row.count);
      });

      // Get by provider
      const byProviderResult = await query(`
        SELECT provider, COUNT(*) as count
        FROM payments
        WHERE status = 'success'
          AND created_at >= $1
          AND created_at <= $2
          AND provider IS NOT NULL
        GROUP BY provider
      `, [startDate, endDate]);

      const byProvider = {};
      byProviderResult.rows.forEach(row => {
        byProvider[row.provider] = parseInt(row.count);
      });

      const totalNum = parseFloat(total) || 0;
      const countNum = parseInt(count) || 0;

      return {
        total: totalNum,
        count: countNum,
        average: countNum > 0 ? totalNum / countNum : 0,
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
      const values = [];
      let paramIndex = 1;

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters.provider) {
        conditions.push(`provider = $${paramIndex++}`);
        values.push(filters.provider);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 1000;
      values.push(limit);

      const result = await query(
        `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex}`,
        values
      );

      return result.rows.map(row => this._formatPayment(row));
    } catch (error) {
      logger.error('Error getting all payments:', error);
      return [];
    }
  }
}

module.exports = PaymentModel;
