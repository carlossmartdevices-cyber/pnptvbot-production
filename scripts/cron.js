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
  // Cron jobs have been disabled
  logger.info('Cron jobs are disabled (subscription reminders and expiry checks have been disabled)');
};

// Start cron jobs if enabled
if (process.env.ENABLE_CRON === 'true') {
  startCronJobs();
} else {
  logger.info('Cron jobs disabled');
}

module.exports = { startCronJobs };
