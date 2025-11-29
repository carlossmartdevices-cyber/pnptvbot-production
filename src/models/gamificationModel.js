const { getFirestore } = require('../config/firebase');
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
    try {
      const db = getFirestore();
      const userActivityRef = db.collection(COLLECTION).doc(userId.toString());

      const doc = await userActivityRef.get();
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekKey = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format

      let data;
      if (!doc.exists) {
        // Create new activity record
        data = {
          userId: userId.toString(),
          totalPoints: points,
          totalMessages: activityType === 'message' ? 1 : 0,
          totalShares: activityType === 'share' ? 1 : 0,
          totalLikes: activityType === 'like' ? 1 : 0,
          totalInteractions: 1,
          lastActive: now,
          createdAt: now,
          weekly: {
            [weekKey]: {
              points,
              messages: activityType === 'message' ? 1 : 0,
              shares: activityType === 'share' ? 1 : 0,
              likes: activityType === 'like' ? 1 : 0,
              interactions: 1,
            },
          },
        };
      } else {
        // Update existing record
        const currentData = doc.data();
        const weekly = currentData.weekly || {};
        const currentWeek = weekly[weekKey] || {
          points: 0, messages: 0, shares: 0, likes: 0, interactions: 0,
        };

        data = {
          totalPoints: (currentData.totalPoints || 0) + points,
          totalMessages: (currentData.totalMessages || 0) + (activityType === 'message' ? 1 : 0),
          totalShares: (currentData.totalShares || 0) + (activityType === 'share' ? 1 : 0),
          totalLikes: (currentData.totalLikes || 0) + (activityType === 'like' ? 1 : 0),
          totalInteractions: (currentData.totalInteractions || 0) + 1,
          lastActive: now,
          weekly: {
            ...weekly,
            [weekKey]: {
              points: currentWeek.points + points,
              messages: currentWeek.messages + (activityType === 'message' ? 1 : 0),
              shares: currentWeek.shares + (activityType === 'share' ? 1 : 0),
              likes: currentWeek.likes + (activityType === 'like' ? 1 : 0),
              interactions: currentWeek.interactions + 1,
            },
          },
        };
      }

      await userActivityRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del(`activity:${userId}`);
      await cache.del('leaderboard:weekly');
      await cache.del('leaderboard:alltime');

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
      const cacheKey = `activity:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(COLLECTION).doc(userId.toString()).get();

          if (!doc.exists) {
            return null;
          }

          return { id: doc.id, ...doc.data() };
        },
        300, // Cache for 5 minutes
      );
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
    try {
      const cacheKey = 'leaderboard:weekly';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const weekStart = this.getWeekStart(new Date());
          const weekKey = weekStart.toISOString().split('T')[0];

          const snapshot = await db.collection(COLLECTION)
            .orderBy(`weekly.${weekKey}.points`, 'desc')
            .limit(limit)
            .get();

          const leaderboard = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const weekData = data.weekly?.[weekKey] || {};

            if (weekData.points > 0) {
              leaderboard.push({
                userId: doc.id,
                points: weekData.points || 0,
                messages: weekData.messages || 0,
                shares: weekData.shares || 0,
                likes: weekData.likes || 0,
                interactions: weekData.interactions || 0,
              });
            }
          });

          logger.info(`Weekly leaderboard retrieved: ${leaderboard.length} users`);
          return leaderboard;
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting weekly leaderboard:', error);
      return [];
    }
  }

  /**
   * Get all-time leaderboard
   * @param {number} limit - Number of top users to return
   * @returns {Promise<Array>} Top users all-time
   */
  static async getAllTimeLeaderboard(limit = 10) {
    try {
      const cacheKey = 'leaderboard:alltime';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          const snapshot = await db.collection(COLLECTION)
            .orderBy('totalPoints', 'desc')
            .limit(limit)
            .get();

          const leaderboard = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            leaderboard.push({
              userId: doc.id,
              totalPoints: data.totalPoints || 0,
              totalMessages: data.totalMessages || 0,
              totalShares: data.totalShares || 0,
              totalLikes: data.totalLikes || 0,
              totalInteractions: data.totalInteractions || 0,
            });
          });

          logger.info(`All-time leaderboard retrieved: ${leaderboard.length} users`);
          return leaderboard;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting all-time leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user rank in weekly leaderboard
   * @param {number|string} userId - User ID
   * @returns {Promise<number>} User's rank (1-based)
   */
  static async getUserWeeklyRank(userId) {
    try {
      const leaderboard = await this.getWeeklyLeaderboard(100); // Get top 100
      const rank = leaderboard.findIndex((u) => u.userId === userId.toString());
      return rank === -1 ? null : rank + 1;
    } catch (error) {
      logger.error('Error getting user weekly rank:', error);
      return null;
    }
  }

  /**
   * Create custom badge
   * @param {Object} badgeData - Badge data { name, description, icon, color, createdBy }
   * @returns {Promise<Object|null>} Created badge
   */
  static async createCustomBadge(badgeData) {
    try {
      const db = getFirestore();
      const badgeRef = db.collection(BADGES_COLLECTION).doc();

      const data = {
        ...badgeData,
        id: badgeRef.id,
        createdAt: new Date(),
        isCustom: true,
      };

      await badgeRef.set(data);

      // Invalidate cache
      await cache.del('badges:custom');

      logger.info('Custom badge created', { badgeId: badgeRef.id, name: badgeData.name });
      return data;
    } catch (error) {
      logger.error('Error creating custom badge:', error);
      return null;
    }
  }

  /**
   * Get all custom badges
   * @returns {Promise<Array>} All custom badges
   */
  static async getCustomBadges() {
    try {
      const cacheKey = 'badges:custom';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(BADGES_COLLECTION)
            .orderBy('createdAt', 'desc')
            .get();

          const badges = [];
          snapshot.forEach((doc) => {
            badges.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${badges.length} custom badges`);
          return badges;
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting custom badges:', error);
      return [];
    }
  }

  /**
   * Delete custom badge
   * @param {string} badgeId - Badge ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteCustomBadge(badgeId) {
    try {
      const db = getFirestore();
      await db.collection(BADGES_COLLECTION).doc(badgeId).delete();

      // Invalidate cache
      await cache.del('badges:custom');

      logger.info('Custom badge deleted', { badgeId });
      return true;
    } catch (error) {
      logger.error('Error deleting custom badge:', error);
      return false;
    }
  }

  /**
   * Get statistics for admin dashboard
   * @returns {Promise<Object>} Activity statistics
   */
  static async getStatistics() {
    try {
      const db = getFirestore();
      const weekStart = this.getWeekStart(new Date());
      const weekKey = weekStart.toISOString().split('T')[0];

      // Get total active users this week
      const snapshot = await db.collection(COLLECTION)
        .where(`weekly.${weekKey}.interactions`, '>', 0)
        .get();

      let totalWeeklyPoints = 0;
      let totalWeeklyMessages = 0;
      let totalWeeklyShares = 0;
      let activeUsersThisWeek = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const weekData = data.weekly?.[weekKey] || {};

        if (weekData.interactions > 0) {
          activeUsersThisWeek += 1;
          totalWeeklyPoints += weekData.points || 0;
          totalWeeklyMessages += weekData.messages || 0;
          totalWeeklyShares += weekData.shares || 0;
        }
      });

      const stats = {
        activeUsersThisWeek,
        totalWeeklyPoints,
        totalWeeklyMessages,
        totalWeeklyShares,
        weekStart: weekStart.toISOString(),
      };

      logger.info('Activity statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Error getting activity statistics:', error);
      return {
        activeUsersThisWeek: 0,
        totalWeeklyPoints: 0,
        totalWeeklyMessages: 0,
        totalWeeklyShares: 0,
      };
    }
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
    try {
      const db = getFirestore();
      let query = db.collection(COLLECTION);

      if (period === 'week') {
        const weekStart = this.getWeekStart(new Date());
        const weekKey = weekStart.toISOString().split('T')[0];
        query = query.where(`weekly.${weekKey}.interactions`, '>', 0);
      }

      const snapshot = await query.get();

      const breakdown = {
        totalMessages: 0,
        totalShares: 0,
        totalLikes: 0,
        totalInteractions: 0,
        totalPoints: 0,
      };

      if (period === 'week') {
        const weekStart = this.getWeekStart(new Date());
        const weekKey = weekStart.toISOString().split('T')[0];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const weekData = data.weekly?.[weekKey] || {};

          breakdown.totalMessages += weekData.messages || 0;
          breakdown.totalShares += weekData.shares || 0;
          breakdown.totalLikes += weekData.likes || 0;
          breakdown.totalInteractions += weekData.interactions || 0;
          breakdown.totalPoints += weekData.points || 0;
        });
      } else {
        snapshot.forEach((doc) => {
          const data = doc.data();

          breakdown.totalMessages += data.totalMessages || 0;
          breakdown.totalShares += data.totalShares || 0;
          breakdown.totalLikes += data.totalLikes || 0;
          breakdown.totalInteractions += data.totalInteractions || 0;
          breakdown.totalPoints += data.totalPoints || 0;
        });
      }

      logger.info(`Activity breakdown (${period}):`, breakdown);
      return breakdown;
    } catch (error) {
      logger.error('Error getting activity breakdown:', error);
      return {
        totalMessages: 0,
        totalShares: 0,
        totalLikes: 0,
        totalInteractions: 0,
        totalPoints: 0,
      };
    }
  }
}

module.exports = GamificationModel;
