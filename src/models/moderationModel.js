const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Note: Moderation features are disabled as the moderation tables don't exist in PostgreSQL
// These are stub implementations that return sensible defaults without crashing

/**
 * Moderation Model - Handles all moderation data operations
 * Currently disabled - returns defaults without database operations
 */
class ModerationModel {
  // ==================== GROUP SETTINGS ====================

  /**
   * Get default group settings (stub - no database)
   */
  static async getGroupSettings(groupId) {
    // Return default settings without database access
    return {
      groupId: groupId.toString(),
      antiLinksEnabled: false,
      antiSpamEnabled: false,
      antiFloodEnabled: false,
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
  }

  /**
   * Update group settings (stub - disabled)
   */
  static async updateGroupSettings(groupId, updates) {
    logger.warn('Moderation settings update is disabled (no PostgreSQL table)');
    return true;
  }

  // ==================== USER WARNINGS ====================

  /**
   * Get user warnings (stub - returns null)
   */
  static async getUserWarnings(userId, groupId) {
    return null;
  }

  /**
   * Add warning (stub - disabled)
   */
  static async addWarning(userId, groupId, reason, details = '') {
    logger.warn('Warning system is disabled (no PostgreSQL table)');
    return { userId: userId.toString(), groupId: groupId.toString(), warnings: [], totalWarnings: 0 };
  }

  /**
   * Clear warnings (stub - disabled)
   */
  static async clearWarnings(userId, groupId) {
    return true;
  }

  /**
   * Get group warnings (stub - returns empty array)
   */
  static async getGroupWarnings(groupId, limit = 50) {
    return [];
  }

  // ==================== BANNED USERS ====================

  /**
   * Ban user (stub - disabled)
   */
  static async banUser(userId, groupId, reason, bannedBy) {
    logger.warn('Ban system is disabled (no PostgreSQL table)');
    return { userId: userId.toString(), groupId: groupId.toString(), reason, bannedBy: bannedBy.toString(), bannedAt: new Date() };
  }

  /**
   * Unban user (stub - disabled)
   */
  static async unbanUser(userId, groupId) {
    return true;
  }

  /**
   * Check if user is banned (stub - always returns false)
   */
  static async isUserBanned(userId, groupId) {
    return false;
  }

  /**
   * Get banned users (stub - returns empty array)
   */
  static async getBannedUsers(groupId) {
    return [];
  }

  // ==================== MODERATION LOGS ====================

  /**
   * Add moderation log (stub - disabled)
   */
  static async addLog(logData) {
    logger.debug('Moderation log skipped (disabled)', { action: logData.action });
    return 'stub-log-id';
  }

  /**
   * Get group logs (stub - returns empty array)
   */
  static async getGroupLogs(groupId, limit = 50) {
    return [];
  }

  /**
   * Get user logs (stub - returns empty array)
   */
  static async getUserLogs(userId, groupId, limit = 20) {
    return [];
  }

  /**
   * Get group statistics (stub - returns zeros)
   */
  static async getGroupStatistics(groupId) {
    return {
      totalWarnings: 0,
      totalBans: 0,
      recentActions: 0,
      usersWithWarnings: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Invalidate cache (stub)
   */
  static async invalidateCache(groupId) {
    await cache.del(`moderation:settings:${groupId}`);
    await cache.del(`moderation:stats:${groupId}`);
    return true;
  }

  // ==================== USERNAME TRACKING ====================

  /**
   * Record username change (stub - disabled)
   */
  static async recordUsernameChange(userId, oldUsername, newUsername, groupId = null) {
    logger.debug('Username change recording skipped (disabled)', { userId, oldUsername, newUsername });
    return 'stub-record-id';
  }

  /**
   * Get username history (stub - returns empty array)
   */
  static async getUsernameHistory(userId, limit = 20) {
    return [];
  }

  /**
   * Get recent username changes (stub - returns empty array)
   */
  static async getRecentUsernameChanges(groupId, limit = 50) {
    return [];
  }

  /**
   * Flag username change (stub - disabled)
   */
  static async flagUsernameChange(recordId, flaggedBy, reason = '') {
    return true;
  }

  /**
   * Get flagged username changes (stub - returns empty array)
   */
  static async getFlaggedUsernameChanges(groupId = null) {
    return [];
  }

  /**
   * Check recent username change (stub - returns false)
   */
  static async hasRecentUsernameChange(userId, hours = 24) {
    return false;
  }
}

module.exports = ModerationModel;
