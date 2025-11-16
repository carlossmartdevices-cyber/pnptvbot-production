require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initializeFirebase } = require('../../config/firebase');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const chatCleanupMiddleware = require('./middleware/chatCleanup');
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
    try {
      validateCriticalEnvVars();
      logger.info('✓ Environment variables validated');
    } catch (error) {
      logger.error('CRITICAL: Missing environment variables, but attempting to continue...');
      logger.error(error.message);
      // Continuar de todos modos, el bot puede fallar después pero al menos intentamos
    }

    // Initialize Sentry (optional)
    try {
      initSentry();
      logger.info('✓ Sentry initialized');
    } catch (error) {
      logger.warn('Sentry initialization failed, continuing without monitoring:', error.message);
    }

    // Initialize Firebase (with fallback)
    try {
      initializeFirebase();
      logger.info('✓ Firebase initialized');
    } catch (error) {
      logger.error('Firebase initialization failed. Bot will run in DEGRADED mode without database.');
      logger.error('Error:', error.message);
      logger.warn('⚠️  Bot features requiring database will not work!');
      // NO hacemos throw, permitimos que el bot continúe
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
      logger.warn('⚠️  Performance may be degraded without caching');
    }

    // Create bot instance
    const bot = new Telegraf(process.env.BOT_TOKEN);

    // Register middleware
    bot.use(sessionMiddleware());
    bot.use(rateLimitMiddleware());
    bot.use(chatCleanupMiddleware()); // Auto-delete bot messages, commands, and system messages after 5 min
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
        // Disable response timeout for this specific route
        req.setTimeout(0);
        res.setTimeout(0);

        // Set headers for stable connection
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Content-Type', 'application/json');

        try {
          logger.info('Telegram webhook received:', {
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            contentType: req.headers['content-type'],
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });

          // Validate that we have a body
          if (!req.body || Object.keys(req.body).length === 0) {
            logger.warn('Webhook received empty body');
            return res.status(200).json({ ok: true, message: 'Empty body received' });
          }

          // Process the update
          await bot.handleUpdate(req.body);

          // Send success response
          res.status(200).json({ ok: true });
          logger.info('Webhook processed successfully');
        } catch (error) {
          logger.error('Error processing Telegram webhook:', {
            error: error.message,
            stack: error.stack,
            body: req.body,
          });

          // Always send a response to prevent connection reset
          // Telegram expects a response even on errors
          res.status(200).json({ ok: false, error: error.message });
        }
      });
      logger.info(`✓ Webhook callback registered at: ${webhookPath}`);

      // Add a test endpoint to verify webhook configuration
      apiApp.get(webhookPath, (req, res) => {
        res.status(200).json({
          status: 'ok',
          message: 'Telegram webhook endpoint is active',
          path: webhookPath,
          webhookUrl,
          note: 'This endpoint only accepts POST requests from Telegram',
        });
      });
      logger.info(`✓ Webhook test endpoint registered at: ${webhookPath} (GET)`);
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

    // Start API server with proper connection handling
    const PORT = process.env.PORT || 3000;
    const server = apiApp.listen(PORT, () => {
      logger.info(`✓ API server running on port ${PORT}`);
    });

    // Configure server timeouts and keepalive to prevent connection resets
    server.keepAliveTimeout = 65000; // Slightly higher than nginx timeout
    server.headersTimeout = 66000; // Higher than keepAliveTimeout
    server.timeout = 120000; // 2 minutes total timeout for long requests

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
    logger.error('❌ CRITICAL ERROR during bot startup:', error);
    logger.error('Stack trace:', error.stack);
    logger.warn('⚠️  Bot encountered a critical error but will attempt to keep process alive');
    logger.warn('⚠️  Some features may not work properly. Check logs above for details.');

    // NO hacemos process.exit(1) para que el proceso no muera
    // En Railway/Render esto evita reinicios infinitos
    // El proceso se mantiene vivo pero en estado degradado

    // Intentar mantener el proceso vivo con un servidor mínimo
    try {
      const PORT = process.env.PORT || 3000;
      apiApp.listen(PORT, () => {
        logger.info(`⚠️  Emergency API server running on port ${PORT} (degraded mode)`);
        logger.info('Bot is NOT fully functional. Fix configuration and restart.');
      });
    } catch (apiError) {
      logger.error('Failed to start emergency API server:', apiError);
      // Como último recurso, mantener el proceso vivo sin hacer nada
      logger.warn('Process will stay alive but non-functional. Manual intervention required.');
    }
  }
};

// Manejadores globales de errores para evitar que el proceso muera
process.on('uncaughtException', (error) => {
  logger.error('❌ UNCAUGHT EXCEPTION:', error);
  logger.error('Stack:', error.stack);
  logger.warn('Process will continue despite uncaught exception');
  // NO hacer process.exit(), mantener el proceso vivo
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ UNHANDLED PROMISE REJECTION:', reason);
  logger.error('Promise:', promise);
  logger.warn('Process will continue despite unhandled rejection');
  // NO hacer process.exit(), mantener el proceso vivo
});

// Start the bot
if (require.main === module) {
  startBot().catch((err) => {
    logger.error('Unhandled error in startBot():', err);
    logger.warn('Process will stay alive despite error');
    // No hacer nada más, mantener proceso vivo
  });
}

module.exports = { startBot };
