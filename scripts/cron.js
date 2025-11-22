require('dotenv-safe').config();
const cron = require('node-cron');
const { initializeFirebase } = require('../src/config/firebase');
const { initializeRedis } = require('../src/config/redis');
const UserService = require('../src/bot/services/userService');
const SubscriptionReminderService = require('../src/bot/services/subscriptionReminderService');
const logger = require('../src/utils/logger');

/**
 * Initialize and start cron jobs
 */
const startCronJobs = async () => {
  try {
    logger.info('Initializing cron jobs...');

    // Initialize dependencies
    initializeFirebase();
    initializeRedis();

    // Check for expired subscriptions daily at midnight
    cron.schedule(process.env.SUBSCRIPTION_CHECK_CRON || '0 0 * * *', async () => {
      try {
        logger.info('Running subscription expiry check...');
        const processed = await UserService.processExpiredSubscriptions();
        logger.info(`Processed ${processed} expired subscriptions`);
      } catch (error) {
        logger.error('Error in subscription expiry cron:', error);
      }
    });

    // Send 3-day reminders daily at 10 AM
    cron.schedule(process.env.REMINDER_3DAY_CRON || '0 10 * * *', async () => {
      try {
        logger.info('Running 3-day subscription reminder check...');
        const sent = await SubscriptionReminderService.send3DayReminders();
        logger.info(`Sent ${sent} 3-day reminders`);
      } catch (error) {
        logger.error('Error in 3-day reminder cron:', error);
      }
    });

    // Send 1-day reminders daily at 10 AM
    cron.schedule(process.env.REMINDER_1DAY_CRON || '0 10 * * *', async () => {
      try {
        logger.info('Running 1-day subscription reminder check...');
        const sent = await SubscriptionReminderService.send1DayReminders();
        logger.info(`Sent ${sent} 1-day reminders`);
      } catch (error) {
        logger.error('Error in 1-day reminder cron:', error);
      }
    });

    logger.info('✓ Cron jobs started successfully');
    logger.info('  - Subscription expiry check: Daily at midnight');
    logger.info('  - 3-day reminders: Daily at 10 AM');
    logger.info('  - 1-day reminders: Daily at 10 AM');
  } catch (error) {
    logger.error('Failed to start cron jobs:', error);
    process.exit(1);
  }
};

// Start cron jobs if enabled
if (process.env.ENABLE_CRON === 'true') {
  startCronJobs();
} else {
  logger.info('Cron jobs disabled');
}

module.exports = { startCronJobs };
