require('dotenv-safe').config();
const cron = require('node-cron');
const { initializeFirebase } = require('../src/config/firebase');
const { initializeRedis } = require('../src/config/redis');
const UserService = require('../src/bot/services/userService');
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

    logger.info('✓ Cron jobs started successfully');
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
