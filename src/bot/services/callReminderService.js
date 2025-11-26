const logger = require('../../utils/logger');

/**
 * Call Reminder Service
 */
class CallReminderService {
  /**
   * Check and send due reminders
   * @param {Object} bot - Telegram bot instance
   * @returns {Promise<Object>} { sent, failed }
   */
  static async checkAndSendReminders(bot) {
    // Call reminder functionality has been disabled
    logger.info('Call reminder service is disabled (check skipped)');
    return { sent: 0, failed: 0 };
  }

  /**
   * Initialize reminder service
   * @param {Object} bot - Telegram bot instance
   */
  static initialize(bot) {
    // Call reminder service has been disabled
    logger.info('Call reminder service is disabled (initialization skipped)');
  }
}

module.exports = CallReminderService;
