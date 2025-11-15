require('dotenv-safe').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const express = require('express');
const { initializeDatabase, testConnection } = require('../../config/database');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('../../utils/logger');

// Handlers
const registerUserHandlers = require('../handlers/user');
const registerAdminHandlers = require('../handlers/admin');
const registerPaymentHandlers = require('../handlers/payments');
const registerMediaHandlers = require('../handlers/media');

// API Server
const apiApp = require('../api/routes');

/**
 * Initialize and start the bot
 */
const startBot = async () => {
  try {
    logger.info('Starting PNPtv Telegram Bot...');

    // Initialize Sentry
    initSentry();

    // Initialize PostgreSQL
    initializeDatabase();
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to PostgreSQL');
    }
    logger.info('✓ PostgreSQL connected');

    // Initialize Redis
    initializeRedis();
    logger.info('✓ Redis initialized');

    // Create bot instance
    const bot = new Telegraf(process.env.BOT_TOKEN);

    // Register middleware
    bot.use(sessionMiddleware());
    bot.use(rateLimitMiddleware());

    // Register handlers
    registerUserHandlers(bot);
    registerAdminHandlers(bot);
    registerPaymentHandlers(bot);
    registerMediaHandlers(bot);

    // Error handling
    bot.catch(errorHandler);

    // Start bot
    if (process.env.NODE_ENV === 'production' && process.env.BOT_WEBHOOK_DOMAIN) {
      // Webhook mode for production
      const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}${webhookPath}`;

      await bot.telegram.setWebhook(webhookUrl);
      logger.info(`✓ Webhook set to: ${webhookUrl}`);

      // Use Express for webhook
      apiApp.use(bot.webhookCallback(webhookPath));
    } else {
      // Polling mode for development
      await bot.telegram.deleteWebhook();
      await bot.launch();
      logger.info('✓ Bot started in polling mode');
    }

    // Start API server
    const PORT = process.env.PORT || 3000;
    apiApp.listen(PORT, () => {
      logger.info(`✓ API server running on port ${PORT}`);
    });

    logger.info('🚀 PNPtv Telegram Bot is running!');

    // Graceful shutdown
    process.once('SIGINT', () => {
      logger.info('Received SIGINT, stopping bot...');
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping bot...');
      bot.stop('SIGTERM');
    });
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Start the bot
if (require.main === module) {
  startBot();
}

module.exports = { startBot };
