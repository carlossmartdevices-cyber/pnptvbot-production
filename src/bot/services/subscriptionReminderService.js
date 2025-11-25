const logger = require('../../utils/logger');

/**
 * Subscription Reminder Service
 */
class SubscriptionReminderService {
  /**
   * Process reminders for subscriptions expiring in N days
   * @param {number} daysBeforeExpiry - Days before expiry (3 or 1)
   * @returns {Promise<number>} Number of reminders sent
   */
  static async sendReminders(daysBeforeExpiry) {
    // Subscription reminder functionality has been disabled
    logger.info(`Subscription reminder service is disabled (${daysBeforeExpiry}-day reminders skipped)`);
    return 0;
  }

  /**
   * Send 3-day reminders
   * @returns {Promise<number>} Number of reminders sent
   */
  static async send3DayReminders() {
    return await this.sendReminders(3);
  }

  /**
   * Send 1-day reminders
   * @returns {Promise<number>} Number of reminders sent
   */
  static async send1DayReminders() {
    return await this.sendReminders(1);
  }
}

module.exports = SubscriptionReminderService;
