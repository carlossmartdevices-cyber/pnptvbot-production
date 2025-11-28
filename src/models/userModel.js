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
        data.createdAt = timestamp;
        data.subscriptionStatus = 'free';
        data.language = userData.language || 'en';
        // Default role for new users
        data.role = userData.role || 'user';
        // Default privacy settings
        data.privacy = {
          showLocation: true,
          showInterests: true,
          showBio: true,
          allowMessages: true,
          showOnline: true,
        };
        // Initialize counters
        data.profileViews = 0;
        data.favorites = [];
        data.blocked = [];
        data.badges = [];
      }

      await userRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User created/updated', { userId, role: data.role });
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

      // Support cache implementations that provide getOrSet or a simple get/set API (tests mock get)
      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
        // Some test mocks auto-mock this function and return undefined by default.
        // Call it, but if it returns undefined, fall back to fetching directly.
        const maybeCached = await cache.getOrSet(
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

        if (maybeCached !== undefined) return maybeCached;
        // otherwise fallthrough to the explicit fetch below
      }

      // Fallback for tests that mock cache.get / cache.set
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(userId.toString()).get();

      if (!doc.exists) return null;

      const userData = { id: doc.id, ...doc.data() };
      // set in cache if available
      if (cache.set) await cache.set(cacheKey, userData, 600);
      return userData;
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

      // Support cache implementations that provide getOrSet or simple get/set API
      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
        const maybeCached = await cache.getOrSet(
          cacheKey,
          async () => {
            const db = getFirestore();

            // Simple approach: Get all users with location and filter by distance
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

        // Some mocked cache.getOrSet implementations return undefined by default
        if (maybeCached !== undefined) return maybeCached;
      }

      // Fallback for tests that mock cache.get
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const db = getFirestore();
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

      users.sort((a, b) => a.distance - b.distance);
      if (cache.set) await cache.set(cacheKey, users, 300);
      return users;
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
   * Update user role
   * @param {number|string} userId - User ID
   * @param {string} role - New role (superadmin, admin, moderator, user)
   * @param {number|string} assignedBy - Admin userId who assigned the role
   * @returns {Promise<boolean>} Success status
   */
  static async updateRole(userId, role, assignedBy) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        role,
        assignedBy: assignedBy ? assignedBy.toString() : null,
        roleAssignedAt: new Date(),
        updatedAt: new Date(),
      });

      // Invalidate cache
      await cache.del(`user:${userId}`);

      logger.info('User role updated', { userId, role, assignedBy });
      return true;
    } catch (error) {
      logger.error('Error updating user role:', error);
      return false;
    }
  }

  /**
   * Get users by role
   * @param {string} role - Role name
   * @returns {Promise<Array>} Users with specified role
   */
  static async getByRole(role) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('role', '==', role)
        .get();

      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      logger.info(`Found ${users.length} users with role: ${role}`);
      return users;
    } catch (error) {
      logger.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Get all admin users (superadmin, admin, moderator)
   * @returns {Promise<Array>} Admin users
   */
  static async getAllAdmins() {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTION)
        .where('role', 'in', ['superadmin', 'admin', 'moderator'])
        .get();

      const admins = [];
      snapshot.forEach((doc) => {
        admins.push({ id: doc.id, ...doc.data() });
      });

      logger.info(`Found ${admins.length} admin users`);
      return admins;
    } catch (error) {
      logger.error('Error getting admin users:', error);
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

      if (cache.getOrSet && typeof cache.getOrSet === 'function') {
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
      }

      // Fallback when cache.getOrSet not available (tests may mock simple cache)
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const db = getFirestore();
      const totalSnapshot = await db.collection(COLLECTION).count().get();
      const total = totalSnapshot.data().count;
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
      if (cache.set) await cache.set(cacheKey, stats, 60);
      return stats;
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

  /**
   * Update user privacy settings
   * @param {number|string} userId - User ID
   * @param {Object} privacy - Privacy settings
   * @returns {Promise<boolean>} Success status
   */
  static async updatePrivacy(userId, privacy) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      await userRef.update({
        privacy,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);

      logger.info('User privacy updated', { userId, privacy });
      return true;
    } catch (error) {
      logger.error('Error updating user privacy:', error);
      return false;
    }
  }

  /**
   * Increment profile views
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async incrementProfileViews(userId) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const currentViews = doc.data().profileViews || 0;
      await userRef.update({
        profileViews: currentViews + 1,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);

      logger.info('Profile views incremented', { userId, views: currentViews + 1 });
      return true;
    } catch (error) {
      logger.error('Error incrementing profile views:', error);
      return false;
    }
  }

  /**
   * Add user to favorites
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to favorite
   * @returns {Promise<boolean>} Success status
   */
  static async addToFavorites(userId, targetUserId) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const favorites = doc.data().favorites || [];
      if (!favorites.includes(targetUserId.toString())) {
        favorites.push(targetUserId.toString());
        await userRef.update({
          favorites,
          updatedAt: new Date(),
        });

        await cache.del(`user:${userId}`);
        logger.info('User added to favorites', { userId, targetUserId });
      }

      return true;
    } catch (error) {
      logger.error('Error adding to favorites:', error);
      return false;
    }
  }

  /**
   * Remove user from favorites
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to remove from favorites
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromFavorites(userId, targetUserId) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const favorites = doc.data().favorites || [];
      const updatedFavorites = favorites.filter((id) => id !== targetUserId.toString());

      await userRef.update({
        favorites: updatedFavorites,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);
      logger.info('User removed from favorites', { userId, targetUserId });

      return true;
    } catch (error) {
      logger.error('Error removing from favorites:', error);
      return false;
    }
  }

  /**
   * Block user
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to block
   * @returns {Promise<boolean>} Success status
   */
  static async blockUser(userId, targetUserId) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const blocked = doc.data().blocked || [];
      if (!blocked.includes(targetUserId.toString())) {
        blocked.push(targetUserId.toString());

        // Remove from favorites if present
        const favorites = doc.data().favorites || [];
        const updatedFavorites = favorites.filter((id) => id !== targetUserId.toString());

        await userRef.update({
          blocked,
          favorites: updatedFavorites,
          updatedAt: new Date(),
        });

        await cache.del(`user:${userId}`);
        logger.info('User blocked', { userId, targetUserId });
      }

      return true;
    } catch (error) {
      logger.error('Error blocking user:', error);
      return false;
    }
  }

  /**
   * Unblock user
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  static async unblockUser(userId, targetUserId) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const blocked = doc.data().blocked || [];
      const updatedBlocked = blocked.filter((id) => id !== targetUserId.toString());

      await userRef.update({
        blocked: updatedBlocked,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);
      logger.info('User unblocked', { userId, targetUserId });

      return true;
    } catch (error) {
      logger.error('Error unblocking user:', error);
      return false;
    }
  }

  /**
   * Check if user is blocked
   * @param {number|string} userId - User ID
   * @param {number|string} targetUserId - Target user ID to check
   * @returns {Promise<boolean>} Blocked status
   */
  static async isBlocked(userId, targetUserId) {
    try {
      const user = await this.getById(userId);
      if (!user) return false;

      const blocked = user.blocked || [];
      return blocked.includes(targetUserId.toString());
    } catch (error) {
      logger.error('Error checking blocked status:', error);
      return false;
    }
  }

  /**
   * Get user favorites
   * @param {number|string} userId - User ID
   * @returns {Promise<Array>} Favorite users
   */
  static async getFavorites(userId) {
    try {
      const user = await this.getById(userId);
      if (!user || !user.favorites || user.favorites.length === 0) {
        return [];
      }

      const db = getFirestore();
      const favorites = [];

      for (const favoriteId of user.favorites) {
        const doc = await db.collection(COLLECTION).doc(favoriteId).get();
        if (doc.exists) {
          favorites.push({ id: doc.id, ...doc.data() });
        }
      }

      logger.info(`Retrieved ${favorites.length} favorites for user ${userId}`);
      return favorites;
    } catch (error) {
      logger.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Add badge to user
   * @param {number|string} userId - User ID
   * @param {string} badge - Badge name (verified, premium, vip, moderator, etc.)
   * @returns {Promise<boolean>} Success status
   */
  static async addBadge(userId, badge) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const badges = doc.data().badges || [];
      if (!badges.includes(badge)) {
        badges.push(badge);
        await userRef.update({
          badges,
          updatedAt: new Date(),
        });

        await cache.del(`user:${userId}`);
        logger.info('Badge added to user', { userId, badge });
      }

      return true;
    } catch (error) {
      logger.error('Error adding badge:', error);
      return false;
    }
  }

  /**
   * Remove badge from user
   * @param {number|string} userId - User ID
   * @param {string} badge - Badge name to remove
   * @returns {Promise<boolean>} Success status
   */
  static async removeBadge(userId, badge) {
    try {
      const db = getFirestore();
      const userRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userRef.get();
      if (!doc.exists) return false;

      const badges = doc.data().badges || [];
      const updatedBadges = badges.filter((b) => b !== badge);

      await userRef.update({
        badges: updatedBadges,
        updatedAt: new Date(),
      });

      await cache.del(`user:${userId}`);
      logger.info('Badge removed from user', { userId, badge });

      return true;
    } catch (error) {
      logger.error('Error removing badge:', error);
      return false;
    }
  }

  /**
   * Get churned users (users who had premium but now are free)
   * Churned users are those with subscriptionStatus = 'free' who have payment history
   * @returns {Promise<Array>} Churned users
   */
  static async getChurnedUsers() {
    try {
      const db = getFirestore();

      // Get all free users
      const freeUsersSnapshot = await db.collection(COLLECTION)
        .where('subscriptionStatus', '==', 'free')
        .get();

      const churnedUsers = [];

      // Check which free users have payment history
      for (const doc of freeUsersSnapshot.docs) {
        const userId = doc.id;

        // Check if user has any successful payments
        const paymentsSnapshot = await db.collection('payments')
          .where('userId', '==', userId)
          .where('status', '==', 'success')
          .limit(1)
          .get();

        // If user has payment history, they are churned
        if (!paymentsSnapshot.empty) {
          churnedUsers.push({ id: doc.id, ...doc.data() });
        }
      }

      logger.info(`Found ${churnedUsers.length} churned users`);
      return churnedUsers;
    } catch (error) {
      logger.error('Error getting churned users:', error);
      return [];
    }
  }
}

module.exports = UserModel;
