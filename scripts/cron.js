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

    // Comprehensive membership status sync - runs twice daily (6 AM and 6 PM UTC)
    // Ensures all users have correct status/tier based on plan_expiry
    cron.schedule(process.env.MEMBERSHIP_SYNC_CRON || '0 6,18 * * *', async () => {
      try {
        logger.info('Running membership status sync (twice daily)...');
        const results = await MembershipCleanupService.syncAllMembershipStatuses();
        logger.info('Membership status sync completed', {
          toActive: results.toActive,
          toChurned: results.toChurned,
          toFree: results.toFree,
          errors: results.errors
        });
      } catch (error) {
        logger.error('Error in membership sync cron:', error);
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

    // NOTE: Tutorial reminders are handled by TutorialReminderService.startScheduling() in bot.js
    // Do NOT duplicate them here to avoid exceeding the 6 messages/day rate limit
    // The service alternates between health tips and PRIME feature tutorials every 4 hours

    logger.info('✓ Cron jobs started successfully');
    return true;
  } catch (error) {
    logger.error('Failed to start cron jobs:', error);
    logger.error('Application will continue running without cron jobs');
    return false;
  }
};

// NOTE: Cron jobs are started from bot.js via startCronJobs(bot)
// Do NOT start them here to avoid double execution
// The bot instance is needed for services like MembershipCleanupService

module.exports = { startCronJobs };
