require('dotenv-safe').config({ allowEmptyValues: true });
const cron = require('node-cron');
const { initializeFirebase } = require('../src/config/firebase');
const { initializeRedis } = require('../src/config/redis');
const { initializePostgres } = require('../src/config/postgres');
const UserService = require('../src/bot/services/userService');
const MembershipCleanupService = require('../src/bot/services/membershipCleanupService');
const TutorialReminderService = require('../src/bot/services/tutorialReminderService');
const logger = require('../src/utils/logger');

/**
 * Initialize and start cron jobs
 */
const startCronJobs = async (bot = null) => {
  try {
    logger.info('Initializing cron jobs...');

    // Initialize dependencies
    initializeFirebase();
    initializeRedis();
    await initializePostgres();

    // Initialize services with bot if provided
    if (bot) {
      MembershipCleanupService.initialize(bot);
      TutorialReminderService.initialize(bot);
    }

    // Full membership cleanup daily at midnight
    // Updates statuses (active/churned/free) and kicks expired users from PRIME channel
    cron.schedule(process.env.MEMBERSHIP_CLEANUP_CRON || '0 0 * * *', async () => {
      try {
        logger.info('Running daily membership cleanup...');
        const results = await MembershipCleanupService.runFullCleanup();
        logger.info('Membership cleanup completed', {
          statusUpdates: results.statusUpdates,
          channelKicks: results.channelKicks
        });
      } catch (error) {
        logger.error('Error in membership cleanup cron:', error);
      }
    });

    // Subscription expiry check (legacy - keeping for backwards compatibility)
    cron.schedule(process.env.SUBSCRIPTION_CHECK_CRON || '0 6 * * *', async () => {
      try {
        logger.info('Running subscription expiry check...');
        const processed = await UserService.processExpiredSubscriptions();
        logger.info(`Processed ${processed} expired subscriptions`);
      } catch (error) {
        logger.error('Error in subscription expiry cron:', error);
      }
    });

    // Tutorial reminders for FREE users (how to become PRIME) - every 60 minutes
    cron.schedule(process.env.FREE_TUTORIAL_CRON || '0 */1 * * *', async () => {
      try {
        logger.info('Running FREE user tutorial reminders...');
        const results = await TutorialReminderService.sendFreeTutorials(50);
        logger.info('FREE tutorials completed', results);
      } catch (error) {
        logger.error('Error in FREE tutorial cron:', error);
      }
    });

    // Tutorial reminders for PRIME users (how to use features) - every 60 minutes
    cron.schedule(process.env.PRIME_TUTORIAL_CRON || '0 */1 * * *', async () => {
      try {
        logger.info('Running PRIME user tutorial reminders...');
        const results = await TutorialReminderService.sendPrimeTutorials(50);
        logger.info('PRIME tutorials completed', results);
      } catch (error) {
        logger.error('Error in PRIME tutorial cron:', error);
      }
    });

    logger.info('✓ Cron jobs started successfully');
    return true;
  } catch (error) {
    logger.error('Failed to start cron jobs:', error);
    logger.error('Application will continue running without cron jobs');
    return false;
  }
};

// Start cron jobs if enabled
if (process.env.ENABLE_CRON === 'true') {
  startCronJobs();
} else {
  logger.info('Cron jobs disabled');
}

module.exports = { startCronJobs };
