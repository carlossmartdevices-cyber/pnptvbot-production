const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

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
          const result = await query(
            'SELECT * FROM group_settings WHERE group_id = $1',
            [groupId.toString()]
          );

          if (result.rows.length === 0) {
            // Create default settings
            const defaultSettings = {
              groupId: groupId.toString(),
              antiLinksEnabled: true,
              antiSpamEnabled: true,
              antiFloodEnabled: true,
              profanityFilterEnabled: false,
              maxWarnings: 3,
              floodLimit: 5, // messages
              floodWindow: 10, // seconds
              muteDuration: 3600, // 1 hour in seconds
              allowedDomains: [], // Whitelist domains
              bannedWords: [], // Custom banned words list
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await query(
              `INSERT INTO group_settings (group_id, anti_links_enabled, anti_spam_enabled,
               anti_flood_enabled, profanity_filter_enabled, max_warnings, flood_limit,
               flood_window, mute_duration, allowed_domains, banned_words, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
                defaultSettings.createdAt,
                defaultSettings.updatedAt,
              ]
            );

            logger.info('Created default group settings', { groupId });
            return defaultSettings;
          }

          const row = result.rows[0];
          return {
            id: row.id,
            groupId: row.group_id,
            antiLinksEnabled: row.anti_links_enabled,
            antiSpamEnabled: row.anti_spam_enabled,
            antiFloodEnabled: row.anti_flood_enabled,
            profanityFilterEnabled: row.profanity_filter_enabled,
            maxWarnings: row.max_warnings,
            floodLimit: row.flood_limit,
            floodWindow: row.flood_window,
            muteDuration: row.mute_duration,
            allowedDomains: row.allowed_domains || [],
            bannedWords: row.banned_words || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
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
      // Map camelCase to snake_case for database columns
      const fieldMap = {
        antiLinksEnabled: 'anti_links_enabled',
        antiSpamEnabled: 'anti_spam_enabled',
        antiFloodEnabled: 'anti_flood_enabled',
        profanityFilterEnabled: 'profanity_filter_enabled',
        maxWarnings: 'max_warnings',
        floodLimit: 'flood_limit',
        floodWindow: 'flood_window',
        muteDuration: 'mute_duration',
        allowedDomains: 'allowed_domains',
        bannedWords: 'banned_words',
      };

      const dbFields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach((key) => {
        const dbField = fieldMap[key] || key;
        dbFields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      });

      if (dbFields.length === 0) {
        return true;
      }

      // Add updated_at
      dbFields.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      // Add groupId for WHERE clause
      values.push(groupId.toString());

      await query(
        `UPDATE group_settings SET ${dbFields.join(', ')} WHERE group_id = $${paramIndex}`,
        values
      );

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
      const result = await query(
        `SELECT * FROM user_warnings
         WHERE user_id = $1 AND group_id = $2
         ORDER BY timestamp DESC`,
        [userId.toString(), groupId.toString()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Aggregate warnings into the expected format
      const warnings = result.rows.map(row => ({
        reason: row.reason,
        details: row.details,
        timestamp: row.timestamp,
      }));

      const lastWarning = result.rows[0];

      return {
        id: `${groupId}_${userId}`,
        userId: userId.toString(),
        groupId: groupId.toString(),
        warnings,
        totalWarnings: result.rows.length,
        lastWarningAt: lastWarning.timestamp,
        createdAt: result.rows[result.rows.length - 1].timestamp,
      };
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
      const timestamp = new Date();

      // Insert new warning
      await query(
        `INSERT INTO user_warnings (user_id, group_id, reason, details, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId.toString(), groupId.toString(), reason, details, timestamp]
      );

      logger.info('Warning added to user', { userId, groupId, reason });

      // Return updated warnings data
      return await this.getUserWarnings(userId, groupId);
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
      await query(
        'DELETE FROM user_warnings WHERE user_id = $1 AND group_id = $2',
        [userId.toString(), groupId.toString()]
      );

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
      // Get all warnings for the group, grouped by user
      const result = await query(
        `SELECT user_id, group_id,
                array_agg(json_build_object('reason', reason, 'details', details, 'timestamp', timestamp)
                         ORDER BY timestamp DESC) as warnings,
                COUNT(*) as total_warnings,
                MAX(timestamp) as last_warning_at
         FROM user_warnings
         WHERE group_id = $1
         GROUP BY user_id, group_id
         ORDER BY MAX(timestamp) DESC
         LIMIT $2`,
        [groupId.toString(), limit]
      );

      const warnings = result.rows.map(row => ({
        id: `${row.group_id}_${row.user_id}`,
        userId: row.user_id,
        groupId: row.group_id,
        warnings: row.warnings,
        totalWarnings: parseInt(row.total_warnings),
        lastWarningAt: row.last_warning_at,
      }));

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
      const bannedAt = new Date();

      const banData = {
        userId: userId.toString(),
        groupId: groupId.toString(),
        reason,
        bannedBy: bannedBy.toString(),
        bannedAt,
      };

      await query(
        `INSERT INTO banned_users (user_id, group_id, reason, banned_by, banned_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, group_id) DO UPDATE
         SET reason = $3, banned_by = $4, banned_at = $5`,
        [banData.userId, banData.groupId, reason, banData.bannedBy, bannedAt]
      );

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
      await query(
        'DELETE FROM banned_users WHERE user_id = $1 AND group_id = $2',
        [userId.toString(), groupId.toString()]
      );

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
      const result = await query(
        'SELECT 1 FROM banned_users WHERE user_id = $1 AND group_id = $2',
        [userId.toString(), groupId.toString()]
      );

      return result.rows.length > 0;
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
      const result = await query(
        `SELECT * FROM banned_users
         WHERE group_id = $1
         ORDER BY banned_at DESC`,
        [groupId.toString()]
      );

      const bannedUsers = result.rows.map(row => ({
        id: `${row.group_id}_${row.user_id}`,
        userId: row.user_id,
        groupId: row.group_id,
        reason: row.reason,
        bannedBy: row.banned_by,
        bannedAt: row.banned_at,
      }));

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
      const log = {
        action: logData.action,
        userId: logData.userId?.toString() || null,
        groupId: logData.groupId?.toString() || null,
        reason: logData.reason || '',
        details: logData.details || '',
        moderatorId: logData.moderatorId?.toString() || 'system',
        timestamp: new Date(),
      };

      const result = await query(
        `INSERT INTO moderation_logs (action, user_id, group_id, reason, details, moderator_id, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [log.action, log.userId, log.groupId, log.reason, log.details, log.moderatorId, log.timestamp]
      );

      const logId = result.rows[0].id;
      logger.info('Moderation log added', { logId, action: log.action });
      return logId.toString();
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
      const result = await query(
        `SELECT * FROM moderation_logs
         WHERE group_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [groupId.toString(), limit]
      );

      const logs = result.rows.map(row => ({
        id: row.id.toString(),
        action: row.action,
        userId: row.user_id,
        groupId: row.group_id,
        reason: row.reason,
        details: row.details,
        moderatorId: row.moderator_id,
        timestamp: row.timestamp,
      }));

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
      const result = await query(
        `SELECT * FROM moderation_logs
         WHERE group_id = $1 AND user_id = $2
         ORDER BY timestamp DESC
         LIMIT $3`,
        [groupId.toString(), userId.toString(), limit]
      );

      const logs = result.rows.map(row => ({
        id: row.id.toString(),
        action: row.action,
        userId: row.user_id,
        groupId: row.group_id,
        reason: row.reason,
        details: row.details,
        moderatorId: row.moderator_id,
        timestamp: row.timestamp,
      }));

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
          // Get total warnings count
          const warningsResult = await query(
            'SELECT COUNT(*) as total FROM user_warnings WHERE group_id = $1',
            [groupId.toString()]
          );
          const totalWarnings = parseInt(warningsResult.rows[0].total);

          // Get number of users with warnings
          const usersWithWarningsResult = await query(
            'SELECT COUNT(DISTINCT user_id) as count FROM user_warnings WHERE group_id = $1',
            [groupId.toString()]
          );
          const usersWithWarnings = parseInt(usersWithWarningsResult.rows[0].count);

          // Get total bans
          const bansResult = await query(
            'SELECT COUNT(*) as total FROM banned_users WHERE group_id = $1',
            [groupId.toString()]
          );
          const totalBans = parseInt(bansResult.rows[0].total);

          // Get recent actions (last 24 hours)
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentLogsResult = await query(
            'SELECT COUNT(*) as total FROM moderation_logs WHERE group_id = $1 AND timestamp >= $2',
            [groupId.toString(), yesterday]
          );
          const recentActions = parseInt(recentLogsResult.rows[0].total);

          const stats = {
            totalWarnings,
            totalBans,
            recentActions,
            usersWithWarnings,
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
      const changedAt = new Date();

      const result = await query(
        `INSERT INTO username_history (user_id, old_username, new_username, group_id, changed_at, flagged)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId.toString(), oldUsername || null, newUsername || null, groupId ? groupId.toString() : null, changedAt, false]
      );

      const recordId = result.rows[0].id.toString();

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
      const result = await query(
        `SELECT * FROM username_history
         WHERE user_id = $1
         ORDER BY changed_at DESC
         LIMIT $2`,
        [userId.toString(), limit]
      );

      const history = result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        oldUsername: row.old_username,
        newUsername: row.new_username,
        groupId: row.group_id,
        changedAt: row.changed_at,
        flagged: row.flagged,
        flaggedBy: row.flagged_by,
        flaggedAt: row.flagged_at,
        flagReason: row.flag_reason,
      }));

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
      const result = await query(
        `SELECT * FROM username_history
         WHERE group_id = $1
         ORDER BY changed_at DESC
         LIMIT $2`,
        [groupId.toString(), limit]
      );

      const changes = result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        oldUsername: row.old_username,
        newUsername: row.new_username,
        groupId: row.group_id,
        changedAt: row.changed_at,
        flagged: row.flagged,
        flaggedBy: row.flagged_by,
        flaggedAt: row.flagged_at,
        flagReason: row.flag_reason,
      }));

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
      await query(
        `UPDATE username_history
         SET flagged = $1, flagged_by = $2, flagged_at = $3, flag_reason = $4
         WHERE id = $5`,
        [true, flaggedBy.toString(), new Date(), reason, recordId]
      );

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
      let result;
      if (groupId) {
        result = await query(
          `SELECT * FROM username_history
           WHERE flagged = true AND group_id = $1
           ORDER BY flagged_at DESC
           LIMIT 100`,
          [groupId.toString()]
        );
      } else {
        result = await query(
          `SELECT * FROM username_history
           WHERE flagged = true
           ORDER BY flagged_at DESC
           LIMIT 100`,
          []
        );
      }

      const flagged = result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        oldUsername: row.old_username,
        newUsername: row.new_username,
        groupId: row.group_id,
        changedAt: row.changed_at,
        flagged: row.flagged,
        flaggedBy: row.flagged_by,
        flaggedAt: row.flagged_at,
        flagReason: row.flag_reason,
      }));

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
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const result = await query(
        `SELECT 1 FROM username_history
         WHERE user_id = $1 AND changed_at >= $2
         LIMIT 1`,
        [userId.toString(), since]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking recent username change:', error);
      return false;
    }
  }

  /**
   * Count recent username changes for a user
   * @param {number|string} userId - User ID
   * @param {number} hours - Time window in hours
   * @returns {Promise<number>} Number of changes
   */
  static async countRecentUsernameChanges(userId, hours = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const result = await query(
        `SELECT COUNT(*) as count FROM username_history
         WHERE user_id = $1 AND changed_at >= $2`,
        [userId.toString(), since]
      );

      return parseInt(result.rows[0]?.count || 0, 10);
    } catch (error) {
      logger.error('Error counting recent username changes:', error);
      return 0;
    }
  }

  /**
   * Get non-compliant users in a group
   * @param {number|string} groupId - Group ID
   * @returns {Promise<Array>} Non-compliant users with pending warning
   */
  static async getNonCompliantUsers(groupId) {
    try {
      const result = await query(
        `SELECT * FROM profile_compliance
         WHERE group_id = $1 AND warning_sent_at IS NOT NULL AND compliance_met_at IS NULL
         ORDER BY purge_deadline ASC`,
        [groupId.toString()]
      );

      return result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        groupId: row.group_id,
        usernameValid: row.username_valid,
        nameValid: row.name_valid,
        complianceIssues: row.compliance_issues,
        warningSentAt: row.warning_sent_at,
        warningCount: row.warning_count,
        purgeDeadline: row.purge_deadline,
        purged: row.purged,
        purgedAt: row.purged_at,
        complianceMet: row.compliance_met_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error getting non-compliant users:', error);
      return [];
    }
  }

  /**
   * Get all users pending purge (deadline passed, not purged yet)
   * @returns {Promise<Array>} Users pending purge
   */
  static async getUsersPendingPurge() {
    try {
      const now = new Date();

      const result = await query(
        `SELECT * FROM profile_compliance
         WHERE purge_deadline <= $1 AND purged = false AND compliance_met_at IS NULL
         ORDER BY purge_deadline ASC`,
        [now]
      );

      return result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        groupId: row.group_id,
        complianceIssues: row.compliance_issues,
        purgeDeadline: row.purge_deadline,
      }));
    } catch (error) {
      logger.error('Error getting users pending purge:', error);
      return [];
    }
  }

  /**
   * Mark user compliance as met
   * @param {number|string} userId - User ID
   * @param {number|string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  static async markComplianceMet(userId, groupId) {
    try {
      await query(
        `UPDATE profile_compliance
         SET compliance_met_at = $1, username_valid = true, name_valid = true
         WHERE user_id = $2 AND group_id = $3`,
        [new Date(), userId.toString(), groupId.toString()]
      );

      logger.info('User marked as compliant', { userId, groupId });
      return true;
    } catch (error) {
      logger.error('Error marking compliance as met:', error);
      return false;
    }
  }
}

module.exports = ModerationModel;
