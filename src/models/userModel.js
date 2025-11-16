const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'users';

/**
 * User Model - Handles all user data operations
 */
class UserModel {
  /**
   * Create or update user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created/updated user
   */
  static async createOrUpdate(userData) {
    try {
      const db = getFirestore();
      const userId = userData.userId.toString();
      const userRef = db.collection(COLLECTION).doc(userId);

      const timestamp = new Date();
      const data = {
        ...userData,
        updatedAt: timestamp,
      };

      const doc = await userRef.get();
      if (!doc.exists) {
        // New user - set default values
        data.createdAt = timestamp;
        data.lastActive = timestamp;
        data.subscriptionStatus = 'free';
        data.language = userData.language || 'en';

        // Onboarding defaults
        data.onboardingComplete = false;

        // Age verification defaults
        data.ageVerified = false;
        data.ageVerifiedAt = null;
        data.ageVerificationExpiresAt = null;
        data.ageVerificationIntervalHours = 168; // 7 days

        // Legal compliance defaults
        data.termsAccepted = false;
        data.privacyAccepted = false;

        // Membership defaults
        data.tier = 'Free';
        data.membershipExpiresAt = null;

        // Email defaults
        data.email = null;
        data.emailVerified = false;

        // Profile defaults
        data.bio = null;
        data.location = null;
        data.photoUrl = null;
      }

      await userRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User created/updated', { userId });
      return data;
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (with optimized caching)
   * @param {number|string} userId - Telegram user ID
   * @returns {Promise<Object|null>} User data or null
   */
  static async getById(userId) {
    try {
      const cacheKey = `user:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(userId.toString()).get();

          if (!doc.exists) {
            return null;
          }

          const userData = { id: doc.id, ...doc.data() };
          logger.debug(`Fetched user from database: ${userId}`);
          return userData;
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   * @param {number|string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateProfile(userId, updates) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        ...updates,
        updatedAt: new Date(),
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User profile updated', { userId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Update user subscription
   * @param {number|string} userId - User ID
   * @param {Object} subscription - Subscription data
   * @returns {Promise<boolean>} Success status
   */
  static async updateSubscription(userId, subscription) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        subscriptionStatus: subscription.status,
        planId: subscription.planId,
        planExpiry: subscription.expiry,
        updatedAt: new Date(),
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);
      await cache.delPattern('nearby:*'); // Invalidate nearby queries

      logger.info('User subscription updated', { userId, subscription });
      return true;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      return false;
    }
  }

  /**
   * Get nearby users (with optimized caching)
   * @param {Object} location - { lat, lng }
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Promise<Array>} Nearby users
   */
  static async getNearby(location, radiusKm = 10) {
    try {
      // Round coordinates to reduce cache fragmentation
      const lat = Math.round(location.lat * 100) / 100;
      const lng = Math.round(location.lng * 100) / 100;
      const cacheKey = `nearby:${lat},${lng}:${radiusKm}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          // Simple approach: Get all users with location and filter by distance
          // In production, use Geohash or Google Maps API for better performance
          const snapshot = await db.collection(COLLECTION)
            .where('location', '!=', null)
            .where('subscriptionStatus', 'in', ['active', 'free'])
            .limit(100)
            .get();

          const users = [];
          snapshot.forEach((doc) => {
            const userData = { id: doc.id, ...doc.data() };
            if (userData.location) {
              const distance = this.calculateDistance(
                location.lat,
                location.lng,
                userData.location.lat,
                userData.location.lng,
              );
              if (distance <= radiusKm) {
                users.push({ ...userData, distance });
              }
            }
          });

          // Sort by distance
          users.sort((a, b) => a.distance - b.distance);

          logger.info(`Found ${users.length} nearby users within ${radiusKm}km`);
          return users;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get expired subscriptions
   * @returns {Promise<Array>} Users with expired subscriptions
   */
  static async getExpiredSubscriptions() {
    try {
      const db = getFirestore();
      const now = new Date();

      const snapshot = await db.collection(COLLECTION)
        .where('subscriptionStatus', '==', 'active')
        .where('planExpiry', '<=', now)
        .get();

      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      return users;
    } catch (error) {
      logger.error('Error getting expired subscriptions:', error);
      return [];
    }
  }

  /**
   * Get all users (with pagination)
   * @param {number} limit - Results per page
   * @param {string} startAfter - Last document ID
   * @returns {Promise<Object>} { users, lastDoc }
   */
  static async getAll(limit = 50, startAfter = null) {
    try {
      const db = getFirestore();
      let query = db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit);

      if (startAfter) {
        const lastDoc = await db.collection(COLLECTION).doc(startAfter).get();
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      const users = [];
      let lastDoc = null;

      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
        lastDoc = doc.id;
      });

      return { users, lastDoc };
    } catch (error) {
      logger.error('Error getting all users:', error);
      return { users: [], lastDoc: null };
    }
  }

  /**
   * Get users by subscription status
   * @param {string} status - Subscription status
   * @returns {Promise<Array>} Users
   */
  static async getBySubscriptionStatus(status) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('subscriptionStatus', '==', status)
        .get();

      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      return users;
    } catch (error) {
      logger.error('Error getting users by subscription status:', error);
      return [];
    }
  }

  /**
   * Delete user
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(userId) {
    try {
      const db = getFirestore();
      await db.collection(COLLECTION).doc(userId.toString()).delete();

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User deleted', { userId });
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get statistics for dashboard
   * @returns {Promise<Object>} User statistics
   */
  static async getStatistics() {
    try {
      const cacheKey = 'stats:users';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          // Get total users
          const totalSnapshot = await db.collection(COLLECTION).count().get();
          const total = totalSnapshot.data().count;

          // Get premium users
          const premiumSnapshot = await db.collection(COLLECTION)
            .where('subscriptionStatus', '==', 'active')
            .count()
            .get();
          const premium = premiumSnapshot.data().count;

          const free = total - premium;
          const conversionRate = total > 0 ? (premium / total) * 100 : 0;

          const stats = {
            total,
            premium,
            free,
            conversionRate: Math.round(conversionRate * 100) / 100,
            timestamp: new Date().toISOString(),
          };

          logger.info('User statistics calculated', stats);
          return stats;
        },
        60, // Cache for 1 minute (stats change frequently)
      );
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      return {
        total: 0, premium: 0, free: 0, conversionRate: 0,
      };
    }
  }

  /**
   * Invalidate user cache
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateCache(userId) {
    try {
      await cache.del(`user:${userId}`);
      await cache.delPattern('nearby:*');
      await cache.del('stats:users');
      logger.info('User cache invalidated', { userId });
      return true;
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
      return false;
    }
  }
}

module.exports = UserModel;
