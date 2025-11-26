const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'subscribers';

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
      const db = getFirestore();
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

      // Use email as document ID for easier lookups
      const subscriberRef = db.collection(COLLECTION).doc(email);
      await subscriberRef.set(data);

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
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(email).get();

          if (!doc.exists) {
            return null;
          }

          return { id: doc.id, ...doc.data() };
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
          const db = getFirestore();
          const snapshot = await db.collection(COLLECTION)
            .where('telegramId', '==', telegramId.toString())
            .limit(1)
            .get();

          if (snapshot.empty) {
            return null;
          }

          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() };
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
      const db = getFirestore();
      const subscriberRef = db.collection(COLLECTION).doc(email);

      const updateData = {
        status,
        updatedAt: new Date(),
        ...additionalData,
      };

      await subscriberRef.update(updateData);

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
      const db = getFirestore();
      const subscriberRef = db.collection(COLLECTION).doc(email);

      await subscriberRef.update({
        lastPaymentAt: new Date(),
        updatedAt: new Date(),
      });

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
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('status', '==', 'active')
        .get();

      const subscribers = [];
      snapshot.forEach((doc) => {
        subscribers.push({ id: doc.id, ...doc.data() });
      });

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
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('plan', '==', planId)
        .get();

      const subscribers = [];
      snapshot.forEach((doc) => {
        subscribers.push({ id: doc.id, ...doc.data() });
      });

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
      const db = getFirestore();
      const subscriber = await this.getByEmail(email);

      await db.collection(COLLECTION).doc(email).delete();

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
          const db = getFirestore();

          // Get total subscribers
          const totalSnapshot = await db.collection(COLLECTION).count().get();
          const total = totalSnapshot.data().count;

          // Get active subscribers
          const activeSnapshot = await db.collection(COLLECTION)
            .where('status', '==', 'active')
            .count()
            .get();
          const active = activeSnapshot.data().count;

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
