const { getFirestore, Collections } = require('../config/firebase');
const logger = require('../../utils/logger');
const userService = require('./userService');

class AdminService {
  constructor() {
    this.db = getFirestore();
    this.adminLogsCollection = this.db ? this.db.collection(Collections.ADMIN_LOGS) : null;
    this.broadcastsCollection = this.db ? this.db.collection(Collections.BROADCASTS) : null;
  }

  /**
   * Log admin action
   */
  async logAction(adminId, action, metadata = {}) {
    try {
      if (!this.adminLogsCollection) return;
      await this.adminLogsCollection.add({
        adminId,
        action,
        metadata,
        timestamp: new Date(),
      });
      logger.info(`Admin action logged: ${action} by ${adminId}`);
    } catch (error) {
      logger.error('Error logging admin action:', error);
    }
  }

  /**
   * Send broadcast message to all users
   */
  async sendBroadcast(bot, adminId, message, options = {}) {
    try {
      const allUsers = await userService.getAllUsers();

      // Filter out bot users (user IDs ending with specific patterns or flagged as bots)
      // Telegram bot IDs are typically identified by is_bot flag, but we check the stored data
      const users = allUsers.filter(user => {
        // Skip if user is explicitly marked as bot
        if (user.is_bot === true) return false;
        // Skip known bot user IDs (bots can't receive messages from other bots)
        // User ID 1087968824 is a known bot (GroupAnonymousBot)
        if (user.id === '1087968824' || user.id === 1087968824) return false;
        return true;
      });

      const results = {
        total: users.length,
        sent: 0,
        failed: 0,
        skippedBots: allUsers.length - users.length,
        errors: [],
      };

      logger.info(`Starting broadcast to ${users.length} users (skipped ${results.skippedBots} bots)`);

      for (const user of users) {
        try {
          if (options.mediaType === 'photo' && options.mediaUrl) {
            await bot.telegram.sendPhoto(user.id, options.mediaUrl, {
              caption: message,
              parse_mode: 'Markdown',
            });
          } else if (options.mediaType === 'video' && options.mediaUrl) {
            await bot.telegram.sendVideo(user.id, options.mediaUrl, {
              caption: message,
              parse_mode: 'Markdown',
            });
          } else {
            await bot.telegram.sendMessage(user.id, message, {
              parse_mode: 'Markdown',
            });
          }

          results.sent++;

          // Log successful broadcast
          await this.broadcastsCollection.add({
            userId: user.id,
            message,
            status: 'sent',
            sentAt: new Date(),
            adminId,
          });

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: user.id,
            error: error.message,
          });

          // Log failed broadcast
          await this.broadcastsCollection.add({
            userId: user.id,
            message,
            status: 'failed',
            error: error.message,
            sentAt: new Date(),
            adminId,
          });

          logger.warn(`Failed to send broadcast to user ${user.id}: ${error.message}`);
        }
      }

      // Log admin action
      await this.logAction(adminId, 'broadcast_sent', {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
      });

      logger.info(`Broadcast completed: ${results.sent} sent, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error('Error sending broadcast:', error);
      throw error;
    }
  }

  /**
   * Get broadcast history
   */
  async getBroadcastHistory(limit = 50) {
    try {
      if (!this.broadcastsCollection) return [];
      const snapshot = await this.broadcastsCollection
        .orderBy('sentAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error getting broadcast history:', error);
      throw error;
    }
  }

  /**
   * Get admin logs
   */
  async getAdminLogs(limit = 100) {
    try {
      if (!this.adminLogsCollection) return [];
      const snapshot = await this.adminLogsCollection
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error getting admin logs:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      const [userStats, broadcasts] = await Promise.all([
        userService.getStatistics(),
        this.getBroadcastHistory(10),
      ]);

      const recentBroadcasts = broadcasts.slice(0, 5);

      return {
        users: userStats,
        recentBroadcasts,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
}

module.exports = new AdminService();
