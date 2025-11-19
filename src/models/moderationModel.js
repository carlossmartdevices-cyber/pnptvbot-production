const { getFirestore } = require('../config/firebase');
const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const COLLECTIONS = {
  GROUP_SETTINGS: 'groupSettings',
  USER_WARNINGS: 'userWarnings',
  BANNED_USERS: 'bannedUsers',
  MODERATION_LOGS: 'moderationLogs',
  USERNAME_HISTORY: 'usernameHistory',
};

/**
 * Moderation Model - Handles all moderation data operations
 */
class ModerationModel {
  // ==================== GROUP SETTINGS ====================

  /**
   * Get or create group settings
   * @param {number|string} groupId - Group chat ID
   * @returns {Promise<Object>} Group settings
   */
  static async getGroupSettings(groupId) {
    try {
      const cacheKey = `moderation:settings:${groupId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          // Try PostgreSQL first
          const result = await query(
            'SELECT * FROM group_settings WHERE group_id = $1',
            [groupId.toString()],
          );

          if (result.rows.length > 0) {
            const settings = result.rows[0];
            return {
              groupId: settings.group_id,
              antiLinksEnabled: settings.anti_links_enabled,
              antiSpamEnabled: settings.anti_spam_enabled,
              antiFloodEnabled: settings.anti_flood_enabled,
              profanityFilterEnabled: settings.profanity_filter_enabled,
              maxWarnings: settings.max_warnings,
              floodLimit: settings.flood_limit,
              floodWindow: settings.flood_window,
              muteDuration: settings.mute_duration,
              allowedDomains: settings.allowed_domains || [],
              bannedWords: settings.banned_words || [],
              createdAt: settings.created_at,
              updatedAt: settings.updated_at,
            };
          }

          // Create default settings if not found
          const defaultSettings = {
            groupId: groupId.toString(),
            antiLinksEnabled: true,
            antiSpamEnabled: true,
            antiFloodEnabled: true,
            profanityFilterEnabled: false,
            maxWarnings: 3,
            floodLimit: 5,
            floodWindow: 10,
            muteDuration: 3600,
            allowedDomains: [],
            bannedWords: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await query(
            `INSERT INTO group_settings (
              group_id, anti_links_enabled, anti_spam_enabled, anti_flood_enabled,
              profanity_filter_enabled, max_warnings, flood_limit, flood_window,
              mute_duration, allowed_domains, banned_words
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              defaultSettings.groupId,
              defaultSettings.antiLinksEnabled,
              defaultSettings.antiSpamEnabled,
              defaultSettings.antiFloodEnabled,
              defaultSettings.profanityFilterEnabled,
              defaultSettings.maxWarnings,
              defaultSettings.floodLimit,
              defaultSettings.floodWindow,
              defaultSettings.muteDuration,
              defaultSettings.allowedDomains,
              defaultSettings.bannedWords,
            ],
          );

          logger.info('Created default group settings', { groupId });
          return defaultSettings;
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting group settings:', error);
      throw error;
    }
  }

  /**
   * Update group settings
   * @param {number|string} groupId - Group chat ID
   * @param {Object} updates - Settings to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateGroupSettings(groupId, updates) {
    try {
      const db = getFirestore();
      const groupRef = db.collection(COLLECTIONS.GROUP_SETTINGS).doc(groupId.toString());

      await groupRef.update({
        ...updates,
        updatedAt: new Date(),
      });

      // Invalidate cache
      await cache.del(`moderation:settings:${groupId}`);

      logger.info('Group settings updated', { groupId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating group settings:', error);
      return false;
    }
  }

  // ==================== USER WARNINGS ====================

  /**
   * Get user warnings in a group
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @returns {Promise<Object|null>} User warnings data
   */
  static async getUserWarnings(userId, groupId) {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;
      const doc = await db.collection(COLLECTIONS.USER_WARNINGS).doc(docId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting user warnings:', error);
      return null;
    }
  }

  /**
   * Add warning to user
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @param {string} reason - Warning reason
   * @param {string} details - Additional details
   * @returns {Promise<Object>} Updated warnings
   */
  static async addWarning(userId, groupId, reason, details = '') {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;
      const warningRef = db.collection(COLLECTIONS.USER_WARNINGS).doc(docId);

      const warning = {
        reason,
        details,
        timestamp: new Date(),
      };

      const doc = await warningRef.get();

      if (!doc.exists) {
        // Create new warnings document
        const newData = {
          userId: userId.toString(),
          groupId: groupId.toString(),
          warnings: [warning],
          totalWarnings: 1,
          lastWarningAt: new Date(),
          createdAt: new Date(),
        };

        await warningRef.set(newData);
        logger.info('Created user warnings', { userId, groupId, reason });
        return newData;
      }

      // Add to existing warnings
      const currentData = doc.data();
      const updatedWarnings = [...currentData.warnings, warning];

      const updatedData = {
        warnings: updatedWarnings,
        totalWarnings: updatedWarnings.length,
        lastWarningAt: new Date(),
      };

      await warningRef.update(updatedData);

      logger.info('Warning added to user', {
        userId, groupId, reason, total: updatedWarnings.length,
      });
      return { ...currentData, ...updatedData };
    } catch (error) {
      logger.error('Error adding warning:', error);
      throw error;
    }
  }

  /**
   * Clear user warnings
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  static async clearWarnings(userId, groupId) {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;

      await db.collection(COLLECTIONS.USER_WARNINGS).doc(docId).delete();

      logger.info('User warnings cleared', { userId, groupId });
      return true;
    } catch (error) {
      logger.error('Error clearing warnings:', error);
      return false;
    }
  }

  /**
   * Get all warnings for a group
   * @param {number|string} groupId - Group ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} List of user warnings
   */
  static async getGroupWarnings(groupId, limit = 50) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.USER_WARNINGS)
        .where('groupId', '==', groupId.toString())
        .orderBy('lastWarningAt', 'desc')
        .limit(limit)
        .get();

      const warnings = [];
      snapshot.forEach((doc) => {
        warnings.push({ id: doc.id, ...doc.data() });
      });

      return warnings;
    } catch (error) {
      logger.error('Error getting group warnings:', error);
      return [];
    }
  }

  // ==================== BANNED USERS ====================

  /**
   * Ban user from group
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @param {string} reason - Ban reason
   * @param {number|string} bannedBy - Admin user ID
   * @returns {Promise<Object>} Ban data
   */
  static async banUser(userId, groupId, reason, bannedBy) {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;

      const banData = {
        userId: userId.toString(),
        groupId: groupId.toString(),
        reason,
        bannedBy: bannedBy.toString(),
        bannedAt: new Date(),
      };

      await db.collection(COLLECTIONS.BANNED_USERS).doc(docId).set(banData);

      // Clear warnings when banned
      await this.clearWarnings(userId, groupId);

      logger.info('User banned', {
        userId, groupId, reason, bannedBy,
      });
      return banData;
    } catch (error) {
      logger.error('Error banning user:', error);
      throw error;
    }
  }

  /**
   * Unban user from group
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  static async unbanUser(userId, groupId) {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;

      await db.collection(COLLECTIONS.BANNED_USERS).doc(docId).delete();

      logger.info('User unbanned', { userId, groupId });
      return true;
    } catch (error) {
      logger.error('Error unbanning user:', error);
      return false;
    }
  }

  /**
   * Check if user is banned
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @returns {Promise<boolean>} Is banned
   */
  static async isUserBanned(userId, groupId) {
    try {
      const db = getFirestore();
      const docId = `${groupId}_${userId}`;
      const doc = await db.collection(COLLECTIONS.BANNED_USERS).doc(docId).get();

      return doc.exists;
    } catch (error) {
      logger.error('Error checking if user is banned:', error);
      return false;
    }
  }

  /**
   * Get all banned users in a group
   * @param {number|string} groupId - Group ID
   * @returns {Promise<Array>} List of banned users
   */
  static async getBannedUsers(groupId) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.BANNED_USERS)
        .where('groupId', '==', groupId.toString())
        .orderBy('bannedAt', 'desc')
        .get();

      const bannedUsers = [];
      snapshot.forEach((doc) => {
        bannedUsers.push({ id: doc.id, ...doc.data() });
      });

      return bannedUsers;
    } catch (error) {
      logger.error('Error getting banned users:', error);
      return [];
    }
  }

  // ==================== MODERATION LOGS ====================

  /**
   * Add moderation log entry
   * @param {Object} logData - Log data
   * @returns {Promise<string>} Log ID
   */
  static async addLog(logData) {
    try {
      const db = getFirestore();

      const log = {
        action: logData.action,
        userId: logData.userId?.toString(),
        groupId: logData.groupId?.toString(),
        reason: logData.reason || '',
        details: logData.details || '',
        moderatorId: logData.moderatorId?.toString() || 'system',
        timestamp: new Date(),
      };

      const docRef = await db.collection(COLLECTIONS.MODERATION_LOGS).add(log);

      logger.info('Moderation log added', { logId: docRef.id, action: log.action });
      return docRef.id;
    } catch (error) {
      logger.error('Error adding moderation log:', error);
      throw error;
    }
  }

  /**
   * Get moderation logs for a group
   * @param {number|string} groupId - Group ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Moderation logs
   */
  static async getGroupLogs(groupId, limit = 50) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.MODERATION_LOGS)
        .where('groupId', '==', groupId.toString())
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const logs = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      return logs;
    } catch (error) {
      logger.error('Error getting group logs:', error);
      return [];
    }
  }

  /**
   * Get moderation logs for a specific user in a group
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Moderation logs
   */
  static async getUserLogs(userId, groupId, limit = 20) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.MODERATION_LOGS)
        .where('groupId', '==', groupId.toString())
        .where('userId', '==', userId.toString())
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const logs = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      return logs;
    } catch (error) {
      logger.error('Error getting user logs:', error);
      return [];
    }
  }

  /**
   * Get moderation statistics for a group
   * @param {number|string} groupId - Group ID
   * @returns {Promise<Object>} Statistics
   */
  static async getGroupStatistics(groupId) {
    try {
      const cacheKey = `moderation:stats:${groupId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();

          // Get total warnings
          const warningsSnapshot = await db.collection(COLLECTIONS.USER_WARNINGS)
            .where('groupId', '==', groupId.toString())
            .get();

          let totalWarnings = 0;
          warningsSnapshot.forEach((doc) => {
            totalWarnings += doc.data().totalWarnings || 0;
          });

          // Get total bans
          const bansSnapshot = await db.collection(COLLECTIONS.BANNED_USERS)
            .where('groupId', '==', groupId.toString())
            .count()
            .get();

          const totalBans = bansSnapshot.data().count;

          // Get recent actions (last 24 hours)
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentLogsSnapshot = await db.collection(COLLECTIONS.MODERATION_LOGS)
            .where('groupId', '==', groupId.toString())
            .where('timestamp', '>=', yesterday)
            .get();

          const recentActions = recentLogsSnapshot.size;

          const stats = {
            totalWarnings,
            totalBans,
            recentActions,
            usersWithWarnings: warningsSnapshot.size,
            timestamp: new Date().toISOString(),
          };

          logger.info('Moderation statistics calculated', { groupId, stats });
          return stats;
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting moderation statistics:', error);
      return {
        totalWarnings: 0,
        totalBans: 0,
        recentActions: 0,
        usersWithWarnings: 0,
      };
    }
  }

  /**
   * Invalidate moderation cache for a group
   * @param {number|string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateCache(groupId) {
    try {
      await cache.del(`moderation:settings:${groupId}`);
      await cache.del(`moderation:stats:${groupId}`);
      logger.info('Moderation cache invalidated', { groupId });
      return true;
    } catch (error) {
      logger.error('Error invalidating moderation cache:', error);
      return false;
    }
  }

  // ==================== USERNAME TRACKING ====================

  /**
   * Record username change
   * @param {number|string} userId - User ID
   * @param {string} oldUsername - Previous username (null if first time)
   * @param {string} newUsername - New username (null if removed)
   * @param {number|string} groupId - Group ID where change was detected
   * @returns {Promise<string>} Record ID
   */
  static async recordUsernameChange(userId, oldUsername, newUsername, groupId = null) {
    try {
      const result = await query(
        `INSERT INTO username_history (
          user_id, old_username, new_username, group_id, flagged
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          userId.toString(),
          oldUsername || null,
          newUsername || null,
          groupId ? groupId.toString() : null,
          false,
        ],
      );

      const recordId = result.rows[0].id;

      // Also log it
      await this.addLog({
        action: 'username_changed',
        userId,
        groupId,
        reason: 'Username change detected',
        details: `${oldUsername || 'none'} → ${newUsername || 'none'}`,
      });

      logger.info('Username change recorded', {
        userId,
        oldUsername,
        newUsername,
        groupId,
        recordId,
      });

      return recordId;
    } catch (error) {
      logger.error('Error recording username change:', error);
      throw error;
    }
  }

  /**
   * Get username history for a user
   * @param {number|string} userId - User ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Username history
   */
  static async getUsernameHistory(userId, limit = 20) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.USERNAME_HISTORY)
        .where('userId', '==', userId.toString())
        .orderBy('changedAt', 'desc')
        .limit(limit)
        .get();

      const history = [];
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });

      return history;
    } catch (error) {
      logger.error('Error getting username history:', error);
      return [];
    }
  }

  /**
   * Get recent username changes in a group
   * @param {number|string} groupId - Group ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Recent username changes
   */
  static async getRecentUsernameChanges(groupId, limit = 50) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(COLLECTIONS.USERNAME_HISTORY)
        .where('groupId', '==', groupId.toString())
        .orderBy('changedAt', 'desc')
        .limit(limit)
        .get();

      const changes = [];
      snapshot.forEach((doc) => {
        changes.push({ id: doc.id, ...doc.data() });
      });

      return changes;
    } catch (error) {
      logger.error('Error getting recent username changes:', error);
      return [];
    }
  }

  /**
   * Flag a username change as suspicious
   * @param {string} recordId - Username change record ID
   * @param {number|string} flaggedBy - Admin user ID
   * @param {string} reason - Reason for flagging
   * @returns {Promise<boolean>} Success status
   */
  static async flagUsernameChange(recordId, flaggedBy, reason = '') {
    try {
      const db = getFirestore();
      await db.collection(COLLECTIONS.USERNAME_HISTORY).doc(recordId).update({
        flagged: true,
        flaggedBy: flaggedBy.toString(),
        flaggedAt: new Date(),
        flagReason: reason,
      });

      logger.info('Username change flagged', { recordId, flaggedBy, reason });
      return true;
    } catch (error) {
      logger.error('Error flagging username change:', error);
      return false;
    }
  }

  /**
   * Get flagged username changes
   * @param {number|string} groupId - Group ID (optional)
   * @returns {Promise<Array>} Flagged username changes
   */
  static async getFlaggedUsernameChanges(groupId = null) {
    try {
      const db = getFirestore();
      let query = db.collection(COLLECTIONS.USERNAME_HISTORY)
        .where('flagged', '==', true)
        .orderBy('flaggedAt', 'desc');

      if (groupId) {
        query = query.where('groupId', '==', groupId.toString());
      }

      const snapshot = await query.limit(100).get();

      const flagged = [];
      snapshot.forEach((doc) => {
        flagged.push({ id: doc.id, ...doc.data() });
      });

      return flagged;
    } catch (error) {
      logger.error('Error getting flagged username changes:', error);
      return [];
    }
  }

  /**
   * Check if user has changed username recently (within hours)
   * @param {number|string} userId - User ID
   * @param {number} hours - Time window in hours
   * @returns {Promise<boolean>} Has recent change
   */
  static async hasRecentUsernameChange(userId, hours = 24) {
    try {
      const db = getFirestore();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const snapshot = await db.collection(COLLECTIONS.USERNAME_HISTORY)
        .where('userId', '==', userId.toString())
        .where('changedAt', '>=', since)
        .limit(1)
        .get();

      return !snapshot.empty;
    } catch (error) {
      logger.error('Error checking recent username change:', error);
      return false;
    }
  }
}

module.exports = ModerationModel;
