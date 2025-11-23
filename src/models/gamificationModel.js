// Removed Firebase/Firestore dependency
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTION = 'user_activity';
const BADGES_COLLECTION = 'custom_badges';

/**
 * Gamification Model - Handles user activity tracking and gamification
 */
class GamificationModel {
  /**
   * Track user activity
   * @param {number|string} userId - User ID
   * @param {string} activityType - Type of activity (message, share, like, etc.)
   * @param {number} points - Points to award
   * @returns {Promise<boolean>} Success status
   */
  static async trackActivity(userId, activityType, points = 1) {
    // Stub: No-op, always returns true
    logger.debug(`Activity tracked for user ${userId}: ${activityType} (+${points} points) [stub]`);
    return true;
  }

  /**
   * Get user activity
   * @param {number|string} userId - User ID
   * @returns {Promise<Object|null>} User activity data
   */
  static async getUserActivity(userId) {
    // Stub: Returns null
    return null;
  }

  /**
   * Get weekly leaderboard
   * @param {number} limit - Number of top users to return
   * @returns {Promise<Array>} Top users for current week
   */
  static async getWeeklyLeaderboard(limit = 10) {
    // Stub: Returns empty array
    return [];
  }

  /**
   * Get all-time leaderboard
   * @param {number} limit - Number of top users to return
   * @returns {Promise<Array>} Top users all-time
   */
  static async getAllTimeLeaderboard(limit = 10) {
    // Stub: Returns empty array
    return [];
  }

  /**
   * Get user rank in weekly leaderboard
   * @param {number|string} userId - User ID
   * @returns {Promise<number>} User's rank (1-based)
   */
  static async getUserWeeklyRank(userId) {
    // Stub: Returns null
    return null;
  }

  /**
   * Create custom badge
   * @param {Object} badgeData - Badge data { name, description, icon, color, createdBy }
   * @returns {Promise<Object|null>} Created badge
   */
  static async createCustomBadge(badgeData) {
    // Stub: Returns null
    return null;
  }

  /**
   * Get all custom badges
   * @returns {Promise<Array>} All custom badges
   */
  static async getCustomBadges() {
    // Stub: Returns empty array
    return [];
  }

  /**
   * Delete custom badge
   * @param {string} badgeId - Badge ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteCustomBadge(badgeId) {
    // Stub: Returns true
    return true;
  }

  /**
   * Get statistics for admin dashboard
   * @returns {Promise<Object>} Activity statistics
   */
  static async getStatistics() {
    // Stub: Returns default stats
    return {
      activeUsersThisWeek: 0,
      totalWeeklyPoints: 0,
      totalWeeklyMessages: 0,
      totalWeeklyShares: 0,
      weekStart: new Date().toISOString(),
    };
  }

  /**
   * Get week start date (Monday)
   * @param {Date} date - Reference date
   * @returns {Date} Start of week
   */
  static getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Reset weekly stats (run at start of week)
   * This doesn't delete data, just marks a new week
   * @returns {Promise<boolean>} Success status
   */
  static async resetWeeklyStats() {
    try {
      // Invalidate cache to force fresh data
      await cache.del('leaderboard:weekly');
      logger.info('Weekly stats cache cleared for new week');
      return true;
    } catch (error) {
      logger.error('Error resetting weekly stats:', error);
      return false;
    }
  }

  /**
   * Get activity breakdown by type
   * @param {string} period - 'week' or 'alltime'
   * @returns {Promise<Object>} Activity breakdown
   */
  static async getActivityBreakdown(period = 'week') {
    // Stub: Returns default breakdown
    return {
      totalMessages: 0,
      totalShares: 0,
      totalLikes: 0,
      totalInteractions: 0,
      totalPoints: 0,
    };
  }
}

module.exports = GamificationModel;
