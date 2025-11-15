const { getFirestore, Collections } = require('../config/firebase');
const logger = require('../../utils/logger');
const userService = require('./userService');

class AdminService {
  constructor() {
    this.db = getFirestore();
    this.adminLogsCollection = this.db.collection(Collections.ADMIN_LOGS);
    this.broadcastsCollection = this.db.collection(Collections.BROADCASTS);
  }

  /**
   * Log admin action
   */
  async logAction(adminId, action, metadata = {}) {
    try {
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
      const users = await userService.getAllUsers();
      const results = {
        total: users.length,
        sent: 0,
        failed: 0,
        errors: [],
      };

      logger.info(`Starting broadcast to ${users.length} users`);

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
        userService.getUserStats(),
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
