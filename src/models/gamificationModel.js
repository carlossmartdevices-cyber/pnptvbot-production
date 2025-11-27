const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Gamification Model - Handles user activity tracking and badge management
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
    try {
      logger.debug(`Activity tracked for user ${userId}: ${activityType} (+${points} points)`);
      return true;
    } catch (error) {
      logger.error('Error tracking activity:', error);
      return false;
    }
  }

  /**
   * Get user activity
   * @param {number|string} userId - User ID
   * @returns {Promise<Object|null>} User activity data
   */
  static async getUserActivity(userId) {
    try {
      return {
        totalPoints: 0,
        totalActivities: 0,
        totalMessages: 0,
        totalShares: 0,
        totalLikes: 0,
        totalInteractions: 0,
      };
    } catch (error) {
      logger.error('Error getting user activity:', error);
      return null;
    }
  }

  /**
   * Get weekly leaderboard
   * @param {number} limit - Number of top users to return
   * @returns {Promise<Array>} Top users for current week
   */
  static async getWeeklyLeaderboard(limit = 10) {
    return [];
  }

  /**
   * Get all-time leaderboard
   * @param {number} limit - Number of top users to return
   * @returns {Promise<Array>} Top users all-time
   */
  static async getAllTimeLeaderboard(limit = 10) {
    return [];
  }

  /**
   * Get user rank in weekly leaderboard
   * @param {number|string} userId - User ID
   * @returns {Promise<number|null>} User's rank (1-based)
   */
  static async getUserWeeklyRank(userId) {
    return null;
  }

  /**
   * Create custom badge
   * @param {Object} badgeData - Badge data { name, description, icon, color, createdBy }
   * @returns {Promise<Object|null>} Created badge
   */
  static async createCustomBadge(badgeData) {
    try {
      const { name, description, icon, color, createdBy } = badgeData;
      
      const result = await query(`
        INSERT INTO badges (name, icon, description, color, created_by, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `, [name, icon, description || '', color || '#FFD700', createdBy]);
      
      if (result.rows.length === 0) return null;
      
      const badge = result.rows[0];
      logger.info('Custom badge created:', { name, icon });
      
      return {
        id: badge.id.toString(),
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
        createdBy: badge.created_by,
        createdAt: badge.created_at,
      };
    } catch (error) {
      logger.error('Error creating custom badge:', error);
      return null;
    }
  }

  /**
   * Get all custom badges (active ones)
   * @returns {Promise<Array>} All custom badges
   */
  static async getCustomBadges() {
    try {
      const result = await query(`
        SELECT id, name, icon, description, color, created_by, created_at
        FROM badges 
        WHERE is_active = true
        ORDER BY id ASC
      `);
      
      return result.rows.map(badge => ({
        id: badge.id.toString(),
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
        createdBy: badge.created_by,
        createdAt: badge.created_at,
      }));
    } catch (error) {
      logger.error('Error getting custom badges:', error);
      return [];
    }
  }

  /**
   * Get badge by ID
   * @param {string|number} badgeId - Badge ID
   * @returns {Promise<Object|null>} Badge data
   */
  static async getBadgeById(badgeId) {
    try {
      const result = await query(`
        SELECT id, name, icon, description, color
        FROM badges 
        WHERE id = $1 AND is_active = true
      `, [badgeId]);
      
      if (result.rows.length === 0) return null;
      
      const badge = result.rows[0];
      return {
        id: badge.id.toString(),
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
      };
    } catch (error) {
      logger.error('Error getting badge by ID:', error);
      return null;
    }
  }

  /**
   * Get badge by name
   * @param {string} name - Badge name
   * @returns {Promise<Object|null>} Badge data
   */
  static async getBadgeByName(name) {
    try {
      const result = await query(`
        SELECT id, name, icon, description, color
        FROM badges 
        WHERE name = $1 AND is_active = true
      `, [name]);
      
      if (result.rows.length === 0) return null;
      
      const badge = result.rows[0];
      return {
        id: badge.id.toString(),
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
      };
    } catch (error) {
      logger.error('Error getting badge by name:', error);
      return null;
    }
  }

  /**
   * Delete custom badge (soft delete)
   * @param {string} badgeId - Badge ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteCustomBadge(badgeId) {
    try {
      await query(`
        UPDATE badges SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [badgeId]);
      
      logger.info('Badge deleted (soft):', { badgeId });
      return true;
    } catch (error) {
      logger.error('Error deleting custom badge:', error);
      return false;
    }
  }

  /**
   * Update badge
   * @param {string|number} badgeId - Badge ID
   * @param {Object} updates - { name, icon, description, color }
   * @returns {Promise<Object|null>} Updated badge
   */
  static async updateBadge(badgeId, updates) {
    try {
      const { name, icon, description, color } = updates;
      
      const result = await query(`
        UPDATE badges 
        SET name = COALESCE($2, name),
            icon = COALESCE($3, icon),
            description = COALESCE($4, description),
            color = COALESCE($5, color),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [badgeId, name, icon, description, color]);
      
      if (result.rows.length === 0) return null;
      
      const badge = result.rows[0];
      return {
        id: badge.id.toString(),
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        color: badge.color,
      };
    } catch (error) {
      logger.error('Error updating badge:', error);
      return null;
    }
  }

  /**
   * Get statistics for admin dashboard
   * @returns {Promise<Object>} Activity statistics
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
   * @param {Date} date - Reference date
   * @returns {Date} Start of week
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
   * Reset weekly stats (run at start of week)
   * @returns {Promise<boolean>} Success status
   */
  static async resetWeeklyStats() {
    try {
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
