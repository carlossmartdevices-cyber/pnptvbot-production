require('dotenv-safe').config();
const cron = require('node-cron');
const { initializeRedis } = require('../src/config/redis');
const SubscriptionReminderService = require('../src/bot/services/subscriptionReminderService');
const logger = require('../src/utils/logger');

/**
 * Initialize and start cron jobs
 * @param {Telegraf} bot - Bot instance (required for sending reminders)
 */
const startCronJobs = async (bot) => {
  try {
    logger.info('Initializing cron jobs...');

    // Initialize Redis (optional)
    try {
      initializeRedis();
      logger.info('✓ Redis initialized for cron jobs');
    } catch (error) {
      logger.warn('Redis initialization failed for cron jobs:', error.message);
    }

    // Initialize subscription reminder service with bot instance
    if (bot) {
      SubscriptionReminderService.initialize(bot);
      logger.info('✓ Subscription reminder service initialized');
    } else {
      logger.error('Bot instance not provided. Cannot initialize subscription reminder service.');
      return;
    }

    // ========================================
    // SUBSCRIPTION REMINDERS - 3-DAY WARNING
    // ========================================
    // Runs every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
      try {
        logger.info('🔔 Running 3-day subscription reminder job...');
        const sent = await SubscriptionReminderService.send3DayReminders();
        logger.info(`✅ 3-day reminder job completed: ${sent} reminders sent`);
      } catch (error) {
        logger.error('❌ Error in 3-day reminder job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York', // Adjust to your timezone
    });
    logger.info('✓ Scheduled: 3-day subscription reminders (daily at 10:00 AM)');

    // ========================================
    // SUBSCRIPTION REMINDERS - 1-DAY WARNING
    // ========================================
    // Runs every day at 6:00 PM
    cron.schedule('0 18 * * *', async () => {
      try {
        logger.info('🔔 Running 1-day subscription reminder job...');
        const sent = await SubscriptionReminderService.send1DayReminders();
        logger.info(`✅ 1-day reminder job completed: ${sent} reminders sent`);
      } catch (error) {
        logger.error('❌ Error in 1-day reminder job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });
    logger.info('✓ Scheduled: 1-day subscription reminders (daily at 6:00 PM)');

    // ========================================
    // EXPIRED SUBSCRIPTIONS PROCESSOR
    // ========================================
    // Runs every day at midnight to process expired subscriptions
    cron.schedule('0 0 * * *', async () => {
      try {
        logger.info('🔔 Running expired subscriptions processor...');
        const processed = await SubscriptionReminderService.processExpiredSubscriptions();
        logger.info(`✅ Expired subscriptions job completed: ${processed} subscriptions processed`);
      } catch (error) {
        logger.error('❌ Error in expired subscriptions job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });
    logger.info('✓ Scheduled: Expired subscriptions processor (daily at midnight)');

    // ========================================
    // HEALTH CHECK (Optional)
    // ========================================
    // Runs every hour to log cron system health
    cron.schedule('0 * * * *', () => {
      logger.debug('💓 Cron system health check - All scheduled jobs are running');
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });
    logger.info('✓ Scheduled: Cron health check (every hour)');

    logger.info('');
    logger.info('✅ All cron jobs initialized successfully!');
    logger.info('');
    logger.info('Scheduled jobs:');
    logger.info('  • 3-day subscription reminders: Daily at 10:00 AM');
    logger.info('  • 1-day subscription reminders: Daily at 6:00 PM');
    logger.info('  • Expired subscriptions: Daily at midnight');
    logger.info('  • Health check: Every hour');
    logger.info('');
  } catch (error) {
    logger.error('Error starting cron jobs:', error);
    throw error;
  }
};

// Start cron jobs if enabled via environment variable or if bot is provided
if (process.env.ENABLE_CRON === 'true') {
  logger.info('⚠️  ENABLE_CRON is true, but bot instance is required');
  logger.info('⚠️  Call startCronJobs(bot) from your bot initialization code');
} else {
  logger.info('ℹ️  Cron jobs disabled (set ENABLE_CRON=true to enable)');
}

module.exports = { startCronJobs };
