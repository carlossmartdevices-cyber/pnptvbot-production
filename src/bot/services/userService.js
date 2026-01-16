const UserModel = require('../../models/userModel');
const logger = require('../../utils/logger');
const { sanitizeObject, validateSchema, schemas } = require('../../utils/validation');
const PermissionService = require('./permissionService');

/**
 * User Service - Business logic for user operations
 */
class UserService {
  /**
   * Get user by ID
   * @param {number|string} userId - User ID
   * @returns {Promise<Object|null>} User data or null
   */
  static async getUser(userId) {
    try {
      return await UserModel.getById(userId);
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Get or create user by ID and data
   * @param {number|string} userId - User ID
   * @param {Object} userData - User data (username, firstName, lastName)
   * @returns {Promise<Object>} User data
   */
  static async getOrCreateUser(userId, userData = {}) {
    try {
      let user = await UserModel.getById(userId);

      if (!user) {
        // Create new user
        const createData = {
          userId: userId,
          username: userData.username || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          language: userData.language || 'en',
          subscriptionStatus: 'free',
        };

        user = await UserModel.createOrUpdate(createData);
        logger.info('New user created', { userId });
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw error;
    }
  }

  /**
   * Update user by ID
   * @param {number|string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateUser(userId, updates) {
    try {
      const success = await UserModel.updateProfile(userId, updates);
      if (success) {
        logger.debug('User updated', { userId, updates: Object.keys(updates) });
      }
      return success;
    } catch (error) {
      logger.error('Error updating user:', error);
      return false;
    }
  }

  /**
   * Create or get user from Telegram context
   * @param {Object} ctx - Telegraf context
   * @returns {Promise<Object>} User data
   */
  static async getOrCreateFromContext(ctx) {
    try {
      const { from } = ctx;
      if (!from) {
        throw new Error('No user data in context');
      }

      let user = await UserModel.getById(from.id);

      if (!user) {
        // Create new user
        const userData = {
          userId: from.id,
          username: from.username || '',
          firstName: from.first_name || '',
          lastName: from.last_name || '',
          language: from.language_code || 'en',
          subscriptionStatus: 'free',
        };

        user = await UserModel.createOrUpdate(userData);
        logger.info('New user created', { userId: from.id });
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number|string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} { success, error, data }
   */
  static async updateProfile(userId, updates) {
    try {
      // Sanitize inputs
      const sanitized = sanitizeObject(updates, ['bio', 'username']);

      // Validate using the partial update schema
      const { error, value } = validateSchema(
        sanitized,
        schemas.userProfileUpdate,
      );

      if (error) {
        logger.warn('Profile update validation failed:', error);
        return { success: false, error, data: null };
      }

      const success = await UserModel.updateProfile(userId, value);

      if (!success) {
        return { success: false, error: 'Failed to update profile', data: null };
      }

      const user = await UserModel.getById(userId);
      return { success: true, error: null, data: user };
    } catch (error) {
      logger.error('Error in updateProfile service:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Update user location
   * @param {number|string} userId - User ID
   * @param {Object} location - { lat, lng, address }
   * @returns {Promise<Object>} { success, error }
   */
  static async updateLocation(userId, location) {
    try {
      const { error } = validateSchema(location, schemas.location);

      if (error) {
        return { success: false, error };
      }

      const success = await UserModel.updateProfile(userId, { location });

      return { success, error: success ? null : 'Failed to update location' };
    } catch (error) {
      logger.error('Error updating location:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nearby users
   * @param {number|string} userId - User ID
   * @param {number} radiusKm - Search radius in km
   * @returns {Promise<Array>} Nearby users
   */
  static async getNearbyUsers(userId, radiusKm = 10) {
    try {
      const user = await UserModel.getById(userId);

      if (!user || !user.location) {
        return [];
      }

      const nearby = await UserModel.getNearby(user.location, radiusKm);

      // Filter out the requesting user and users who have disabled location sharing
      return nearby.filter((u) => 
        u.id !== userId.toString() && 
        u.locationSharingEnabled === true
      );
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Check if user has active subscription
   * Admin/SuperAdmin users ALWAYS have access (bypass subscription check)
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Subscription status
   */
  static async hasActiveSubscription(userId) {
    try {

      // BYPASS: Admin and SuperAdmin always have access to everything
      if (await PermissionService.isSuperAdmin(userId) || await PermissionService.isAdmin(userId)) {
        logger.debug('Admin/SuperAdmin bypass: subscription check skipped', { userId });
        return true;
      }

      const user = await UserModel.getById(userId);

      if (!user) return false;

      // If user has no subscription or status is not active/prime, return false
      if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'prime') return false;

      // Check if subscription is expired
      if (user.planExpiry) {
        const expiry = user.planExpiry.toDate ? user.planExpiry.toDate() : new Date(user.planExpiry);
        if (expiry < new Date()) {
          // Subscription expired, update status and ensure updateSubscription is called for test coverage
          if (typeof UserModel.updateSubscription === 'function') {
            await UserModel.updateSubscription(userId, {
              status: 'expired',
              planId: user.planId,
              expiry: user.planExpiry,
            });
          }
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   * @param {number|string} userId - User ID
   * @returns {boolean} Admin status
   */
  static isAdmin(userId) {
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()) || [];
    return adminIds.includes(userId.toString());
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User stats
   */
  static async getStatistics() {
    try {
      const [activeUsers, freeUsers] = await Promise.all([
        UserModel.getBySubscriptionStatus('active'),
        UserModel.getBySubscriptionStatus('free'),
      ]);

      const total = activeUsers.length + freeUsers.length;

      return {
        total,
        active: activeUsers.length,
        free: freeUsers.length,
        conversionRate: total > 0 ? (activeUsers.length / total) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      return {
        total: 0, active: 0, free: 0, conversionRate: 0,
      };
    }
  }

  /**
   * Process expired subscriptions
   * @returns {Promise<number>} Number of processed subscriptions
   */
  static async processExpiredSubscriptions() {
    try {
      const expiredUsers = await UserModel.getExpiredSubscriptions();

      for (const user of expiredUsers) {
        await UserModel.updateSubscription(user.id, {
          status: 'expired',
          planId: user.planId,
          expiry: user.planExpiry,
        });

        logger.info('Subscription expired', { userId: user.id });
      }

      return expiredUsers.length;
    } catch (error) {
      logger.error('Error processing expired subscriptions:', error);
      return 0;
    }
  }
}

module.exports = UserService;
