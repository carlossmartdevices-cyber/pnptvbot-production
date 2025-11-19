const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Subscriber Model - Handles subscriber data operations with ePayco integration
 */
class SubscriberModel {
  /**
   * Create a new subscriber
   * @param {Object} subscriberData - Subscriber information
   * @returns {Promise<Object>} Created subscriber
   */
  static async create(subscriberData) {
    try {
      const {
        email, name, telegramId, plan, subscriptionId, provider,
      } = subscriberData;

      const timestamp = new Date();
      const data = {
        email,
        name,
        telegramId: telegramId?.toString(),
        plan,
        subscriptionId,
        provider: provider || 'epayco',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastPaymentAt: timestamp,
      };

      // Use email as unique identifier (UNIQUE constraint)
      await query(
        `INSERT INTO subscribers (telegram_id, email, name, plan, subscription_id, provider,
         status, created_at, updated_at, last_payment_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          data.telegramId,
          data.email,
          data.name,
          data.plan,
          data.subscriptionId,
          data.provider,
          data.status,
          data.createdAt,
          data.updatedAt,
          data.lastPaymentAt,
        ]
      );

      // Invalidate cache
      await cache.del(`subscriber:${email}`);
      if (telegramId) {
        await cache.del(`subscriber:telegram:${telegramId}`);
      }

      logger.info('Subscriber created', {
        email,
        telegramId,
        plan,
        subscriptionId,
      });

      return { id: email, ...data };
    } catch (error) {
      logger.error('Error creating subscriber:', error);
      throw error;
    }
  }

  /**
   * Get subscriber by email
   * @param {string} email - Subscriber email
   * @returns {Promise<Object|null>} Subscriber data or null
   */
  static async getByEmail(email) {
    try {
      const cacheKey = `subscriber:${email}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            'SELECT * FROM subscribers WHERE email = $1',
            [email]
          );

          if (result.rows.length === 0) {
            return null;
          }

          const row = result.rows[0];
          return {
            id: row.email,
            email: row.email,
            name: row.name,
            telegramId: row.telegram_id,
            plan: row.plan,
            subscriptionId: row.subscription_id,
            provider: row.provider,
            status: row.status,
            lastPaymentAt: row.last_payment_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting subscriber by email:', error);
      return null;
    }
  }

  /**
   * Get subscriber by Telegram ID
   * @param {string|number} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} Subscriber data or null
   */
  static async getByTelegramId(telegramId) {
    try {
      const cacheKey = `subscriber:telegram:${telegramId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            'SELECT * FROM subscribers WHERE telegram_id = $1 LIMIT 1',
            [telegramId.toString()]
          );

          if (result.rows.length === 0) {
            return null;
          }

          const row = result.rows[0];
          return {
            id: row.email,
            email: row.email,
            name: row.name,
            telegramId: row.telegram_id,
            plan: row.plan,
            subscriptionId: row.subscription_id,
            provider: row.provider,
            status: row.status,
            lastPaymentAt: row.last_payment_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting subscriber by Telegram ID:', error);
      return null;
    }
  }

  /**
   * Update subscriber status
   * @param {string} email - Subscriber email
   * @param {string} status - New status (active, inactive, cancelled)
   * @param {Object} additionalData - Additional fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateStatus(email, status, additionalData = {}) {
    try {
      const fields = ['status'];
      const values = [status];
      let paramIndex = 2;

      Object.keys(additionalData).forEach((key) => {
        fields.push(key);
        values.push(additionalData[key]);
        paramIndex++;
      });

      fields.push('updated_at');
      values.push(new Date());
      paramIndex++;

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(email);

      await query(
        `UPDATE subscribers SET ${setClause} WHERE email = $${paramIndex}`,
        values
      );

      // Invalidate cache
      const subscriber = await this.getByEmail(email);
      await cache.del(`subscriber:${email}`);
      if (subscriber?.telegramId) {
        await cache.del(`subscriber:telegram:${subscriber.telegramId}`);
      }

      logger.info('Subscriber status updated', { email, status });
      return true;
    } catch (error) {
      logger.error('Error updating subscriber status:', error);
      return false;
    }
  }

  /**
   * Update last payment date
   * @param {string} email - Subscriber email
   * @returns {Promise<boolean>} Success status
   */
  static async updateLastPayment(email) {
    try {
      await query(
        'UPDATE subscribers SET last_payment_at = $1, updated_at = $2 WHERE email = $3',
        [new Date(), new Date(), email]
      );

      // Invalidate cache
      const subscriber = await this.getByEmail(email);
      await cache.del(`subscriber:${email}`);
      if (subscriber?.telegramId) {
        await cache.del(`subscriber:telegram:${subscriber.telegramId}`);
      }

      logger.info('Subscriber payment updated', { email });
      return true;
    } catch (error) {
      logger.error('Error updating subscriber payment:', error);
      return false;
    }
  }

  /**
   * Get all active subscribers
   * @returns {Promise<Array>} Active subscribers
   */
  static async getActiveSubscribers() {
    try {
      const result = await query(
        'SELECT * FROM subscribers WHERE status = $1',
        ['active']
      );

      const subscribers = result.rows.map(row => ({
        id: row.email,
        email: row.email,
        name: row.name,
        telegramId: row.telegram_id,
        plan: row.plan,
        subscriptionId: row.subscription_id,
        provider: row.provider,
        status: row.status,
        lastPaymentAt: row.last_payment_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      logger.info(`Found ${subscribers.length} active subscribers`);
      return subscribers;
    } catch (error) {
      logger.error('Error getting active subscribers:', error);
      return [];
    }
  }

  /**
   * Get subscribers by plan
   * @param {string} planId - Plan ID
   * @returns {Promise<Array>} Subscribers
   */
  static async getByPlan(planId) {
    try {
      const result = await query(
        'SELECT * FROM subscribers WHERE plan = $1',
        [planId]
      );

      const subscribers = result.rows.map(row => ({
        id: row.email,
        email: row.email,
        name: row.name,
        telegramId: row.telegram_id,
        plan: row.plan,
        subscriptionId: row.subscription_id,
        provider: row.provider,
        status: row.status,
        lastPaymentAt: row.last_payment_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      logger.info(`Found ${subscribers.length} subscribers for plan ${planId}`);
      return subscribers;
    } catch (error) {
      logger.error('Error getting subscribers by plan:', error);
      return [];
    }
  }

  /**
   * Delete subscriber
   * @param {string} email - Subscriber email
   * @returns {Promise<boolean>} Success status
   */
  static async delete(email) {
    try {
      const subscriber = await this.getByEmail(email);

      await query('DELETE FROM subscribers WHERE email = $1', [email]);

      // Invalidate cache
      await cache.del(`subscriber:${email}`);
      if (subscriber?.telegramId) {
        await cache.del(`subscriber:telegram:${subscriber.telegramId}`);
      }

      logger.info('Subscriber deleted', { email });
      return true;
    } catch (error) {
      logger.error('Error deleting subscriber:', error);
      return false;
    }
  }

  /**
   * Get subscription statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics() {
    try {
      const cacheKey = 'stats:subscribers';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          // Get total subscribers
          const totalResult = await query('SELECT COUNT(*) as total FROM subscribers', []);
          const total = parseInt(totalResult.rows[0].total);

          // Get active subscribers
          const activeResult = await query(
            'SELECT COUNT(*) as total FROM subscribers WHERE status = $1',
            ['active']
          );
          const active = parseInt(activeResult.rows[0].total);

          const inactive = total - active;

          const stats = {
            total,
            active,
            inactive,
            timestamp: new Date().toISOString(),
          };

          logger.info('Subscriber statistics calculated', stats);
          return stats;
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting subscriber statistics:', error);
      return {
        total: 0, active: 0, inactive: 0,
      };
    }
  }
}

module.exports = SubscriberModel;
