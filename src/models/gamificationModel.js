const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Note: Gamification features are disabled as the user_activity table doesn't exist in PostgreSQL
// These are stub implementations that return sensible defaults without crashing

/**
 * Gamification Model - Handles user activity tracking and gamification
 * Currently disabled - returns defaults without database operations
 */
class GamificationModel {
  /**
   * Track user activity (stub - does nothing)
   */
  static async trackActivity(userId, activityType, points = 1) {
    // Gamification tracking is disabled - no user_activity table in PostgreSQL
    logger.debug(`Activity tracking skipped (disabled): ${userId}, ${activityType}, +${points}`);
    return true;
  }

  /**
   * Get user activity (stub - returns null)
   */
  static async getUserActivity(userId) {
    return null;
  }

  /**
   * Get weekly leaderboard (stub - returns empty array)
   */
  static async getWeeklyLeaderboard(limit = 10) {
    return [];
  }

  /**
   * Get all-time leaderboard (stub - returns empty array)
   */
  static async getAllTimeLeaderboard(limit = 10) {
    return [];
  }

  /**
   * Get user rank in weekly leaderboard (stub - returns null)
   */
  static async getUserWeeklyRank(userId) {
    return null;
  }

  /**
   * Create custom badge (stub - disabled)
   */
  static async createCustomBadge(badgeData) {
    logger.warn('Custom badge creation is disabled (no PostgreSQL table)');
    return null;
  }

  /**
   * Get all custom badges (stub - returns empty array)
   */
  static async getCustomBadges() {
    return [];
  }

  /**
   * Delete custom badge (stub - disabled)
   */
  static async deleteCustomBadge(badgeId) {
    logger.warn('Custom badge deletion is disabled (no PostgreSQL table)');
    return false;
  }

  /**
   * Get statistics (stub - returns zeros)
   */
  static async getStatistics() {
    return {
      activeUsersThisWeek: 0,
      totalWeeklyPoints: 0,
      totalWeeklyMessages: 0,
      totalWeeklyShares: 0,
      weekStart: this.getWeekStart(new Date()).toISOString(),
    };
  }

  /**
   * Get week start date (Monday)
   */
  static getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Reset weekly stats (stub)
   */
  static async resetWeeklyStats() {
    await cache.del('leaderboard:weekly');
    return true;
  }

  /**
   * Get activity breakdown (stub - returns zeros)
   */
  static async getActivityBreakdown(period = 'week') {
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
