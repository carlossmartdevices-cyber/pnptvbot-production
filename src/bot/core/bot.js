require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initializeFirebase } = require('../../config/firebase');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const chatCleanupMiddleware = require('./middleware/chatCleanup');
const usernameEnforcement = require('./middleware/usernameEnforcement');
const moderationFilter = require('./middleware/moderationFilter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('../../utils/logger');

// Handlers
const registerUserHandlers = require('../handlers/user');
const registerAdminHandlers = require('../handlers/admin');
const registerPaymentHandlers = require('../handlers/payments');
const registerMediaHandlers = require('../handlers/media');
const registerModerationHandlers = require('../handlers/moderation');
const registerModerationAdminHandlers = require('../handlers/moderation/adminCommands');

// Models for cache prewarming
const PlanModel = require('../../models/planModel');

// API Server
const apiApp = require('../api/routes');

/**
 * Validate critical environment variables
 */
const validateCriticalEnvVars = () => {
  const criticalVars = ['BOT_TOKEN', 'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
  const missing = criticalVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error(`Missing critical environment variables: ${missing.join(', ')}`);
    logger.error('Please configure these variables in your .env file');
    throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Initialize and start the bot
 */
const startBot = async () => {
  try {
    logger.info('Starting PNPtv Telegram Bot...');

    // Validate critical environment variables
    validateCriticalEnvVars();
    logger.info('✓ Environment variables validated');

    // Initialize Sentry (optional)
    initSentry();

    // Initialize Firebase
    try {
      initializeFirebase();
      logger.info('✓ Firebase initialized');
    } catch (error) {
      logger.error('Failed to initialize Firebase. Please check your Firebase credentials.');
      throw error;
    }

    // Initialize Redis (optional, will use default localhost if not configured)
    try {
      initializeRedis();
      logger.info('✓ Redis initialized');

      // Prewarm cache with critical data
      try {
        await PlanModel.prewarmCache();
        logger.info('✓ Cache prewarmed successfully');
      } catch (cacheError) {
        logger.warn('Cache prewarming failed, continuing:', cacheError.message);
      }
    } catch (error) {
      logger.warn('Redis initialization failed, continuing without cache:', error.message);
    }

    // Create bot instance
    const bot = new Telegraf(process.env.BOT_TOKEN);

    // Register middleware
    bot.use(sessionMiddleware());
    bot.use(rateLimitMiddleware());
    bot.use(chatCleanupMiddleware()); // Auto-delete bot messages, commands, and system messages after 5 min
    bot.use(usernameEnforcement()); // Require username and track changes
    bot.use(moderationFilter()); // Moderation filter for group messages

    // Register handlers
    registerUserHandlers(bot);
    registerAdminHandlers(bot);
    registerPaymentHandlers(bot);
    registerMediaHandlers(bot);
    registerModerationHandlers(bot); // User moderation commands
    registerModerationAdminHandlers(bot); // Admin moderation commands

    // Error handling
    bot.catch(errorHandler);

    // Start bot
    if (process.env.NODE_ENV === 'production' && process.env.BOT_WEBHOOK_DOMAIN) {
      // Webhook mode for production
      const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}${webhookPath}`;

      await bot.telegram.setWebhook(webhookUrl);
      logger.info(`✓ Webhook set to: ${webhookUrl}`);

      // Register webhook callback BEFORE 404 handler
      // Use bot.handleUpdate() directly since express.json() already parses the body
      // bot.webhookCallback() expects raw body, but express.json() consumes it
      apiApp.post(webhookPath, async (req, res) => {
        try {
          logger.info('Received webhook request:', {
            body: req.body,
            headers: req.headers,
            method: req.method,
            path: req.path,
          });

          await bot.handleUpdate(req.body);
          res.sendStatus(200);
          logger.info('Webhook processed successfully');
        } catch (error) {
          logger.error('Error processing webhook:', error);
          res.sendStatus(500);
        }
      });
      logger.info(`✓ Webhook callback registered at: ${webhookPath}`);
    } else {
      // Polling mode for development
      await bot.telegram.deleteWebhook();
      await bot.launch();
      logger.info('✓ Bot started in polling mode');
    }

    // Add 404 and error handlers AFTER webhook callback
    const { errorHandler: expressErrorHandler, notFoundHandler: expressNotFoundHandler } = require('../api/middleware/errorHandler');
    apiApp.use(expressNotFoundHandler);
    apiApp.use(expressErrorHandler);
    logger.info('✓ Error handlers registered');

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
