const logger = require('../utils/logger');
const UserModel = require('../models/userModel');

/**
 * Helper to check if user is admin/superadmin from env vars
 * @param {string|number} userId - User ID
 * @returns {boolean}
 */
function isEnvAdminOrSuperAdmin(userId) {
  const superAdminId = process.env.ADMIN_ID?.trim();
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(id => id);
  const userIdStr = String(userId);
  return (superAdminId && userIdStr === superAdminId) || adminIds.includes(userIdStr);
}

/**
 * User Service - Handles user-related operations
 */
class UserService {
  /**
   * Get user profile
   * @param {string|number} userId - Telegram user ID
   * @returns {Promise<Object|null>}
   */
  static async getUserProfile(userId) {
    try {
      return await UserModel.findByTelegramId(userId);
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   * @param {string|number} userId - Telegram user ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>}
   */
  static async updateUserProfile(userId, updates) {
    try {
      const user = await UserModel.updateByTelegramId(userId, updates);
      logger.info('User profile updated', { userId });
      return user;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return null;
    }
  }

  /**
   * Check if user is premium
   * Admin/SuperAdmin users ALWAYS have access (bypass premium check)
   * @param {string|number} userId - Telegram user ID
   * @returns {Promise<boolean>}
   */
  static async isPremium(userId) {
    try {
      // BYPASS: Admin and SuperAdmin always have premium access
      if (isEnvAdminOrSuperAdmin(userId)) {
        logger.debug('Admin/SuperAdmin bypass: premium check skipped', { userId });
        return true;
      }
      
      const user = await UserModel.findByTelegramId(userId);
      return user && user.subscriptionStatus === 'active';
    } catch (error) {
      logger.error('Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   * @param {string|number} userId - Telegram user ID
   * @returns {Promise<boolean>}
   */
  static async isAdmin(userId) {
    try {
      const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
      return adminIds.includes(String(userId));
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Get user subscription
   * @param {string|number} userId - Telegram user ID
   * @returns {Promise<Object|null>}
   */
  static async getUserSubscription(userId) {
    try {
      const user = await UserModel.findByTelegramId(userId);
      if (!user) return null;

      return {
        status: user.subscriptionStatus,
        planId: user.planId,
        expiryDate: user.subscriptionExpiry,
        autoRenew: user.autoRenew,
      };
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      return null;
    }
  }

  /**
   * Record user activity
   * @param {string|number} userId - Telegram user ID
   * @param {string} action - Action name
   * @param {Object} metadata - Additional data
   * @returns {Promise<boolean>}
   */
  static async recordActivity(userId, action, metadata = {}) {
    try {
      logger.info('User activity recorded', {
        userId,
        action,
        metadata,
      });
      return true;
    } catch (error) {
      logger.error('Error recording activity:', error);
      return false;
    }
  }
}

module.exports = UserService;
