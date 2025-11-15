const { DataTypes, Model, Op } = require('sequelize');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Payment Model - PostgreSQL/Sequelize implementation
 */
class Payment extends Model {
  /**
   * Create payment record
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment
   */
  static async create(paymentData) {
    try {
      const payment = await super.create({
        id: paymentData.paymentId || uuidv4(),
        userId: paymentData.userId.toString(),
        planId: paymentData.planId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        provider: paymentData.provider,
        status: 'pending',
      });

      logger.info('Payment created', { paymentId: payment.id, userId: paymentData.userId });
      return payment.toJSON();
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
      const payment = await this.findByPk(paymentId);
      return payment ? payment.toJSON() : null;
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
      const updateData = {
        status,
        ...metadata,
      };

      if (status === 'success') {
        updateData.completedAt = new Date();
      } else if (status === 'failed') {
        updateData.failedAt = new Date();
      }

      await this.update(updateData, {
        where: { id: paymentId },
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
      const payments = await this.findAll({
        where: { userId: userId.toString() },
        order: [['createdAt', 'DESC']],
        limit,
      });

      return payments.map((payment) => payment.toJSON());
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
      const payments = await this.findAll({
        where: { status },
        order: [['createdAt', 'DESC']],
        limit,
      });

      return payments.map((payment) => payment.toJSON());
    } catch (error) {
      logger.error('Error getting payments by status:', error);
      return [];
    }
  }

  /**
   * Get payment by transaction ID
   * @param {string} transactionId - Transaction ID from provider
   * @param {string} provider - Payment provider
   * @returns {Promise<Object|null>} Payment data
   */
  static async getByTransactionId(transactionId, provider) {
    try {
      const payment = await this.findOne({
        where: {
          transactionId,
          provider,
        },
      });

      return payment ? payment.toJSON() : null;
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
      const { sequelize } = this;
      
      const stats = await this.findAll({
        where: {
          status: 'success',
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('amount')), 'average'],
          'planId',
          'provider',
        ],
        group: ['planId', 'provider'],
        raw: true,
      });

      let total = 0;
      let count = 0;
      const byPlan = {};
      const byProvider = {};

      stats.forEach((stat) => {
        const amount = parseFloat(stat.total || 0);
        const cnt = parseInt(stat.count || 0, 10);
        
        total += amount;
        count += cnt;
        
        if (stat.planId) {
          byPlan[stat.planId] = (byPlan[stat.planId] || 0) + cnt;
        }
        
        if (stat.provider) {
          byProvider[stat.provider] = (byProvider[stat.provider] || 0) + cnt;
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

/**
 * Initialize Payment model
 * @param {Sequelize} sequelize - Sequelize instance
 * @returns {Payment} Payment model
 */
const initPaymentModel = (sequelize) => {
  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      planId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'plan_id',
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      provider: {
        type: DataTypes.ENUM('epayco', 'daimo'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      transactionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'transaction_id',
      },
      paymentUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'payment_url',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
      },
      failedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'failed_at',
      },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      timestamps: true,
      underscored: true,
    },
  );

  return Payment;
};

// Auto-initialize if database is available
try {
  const sequelize = getDatabase();
  initPaymentModel(sequelize);
} catch (error) {
  logger.warn('Payment model not initialized yet');
}

module.exports = Payment;
module.exports.initPaymentModel = initPaymentModel;
