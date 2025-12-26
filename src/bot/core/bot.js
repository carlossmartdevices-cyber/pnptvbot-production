require('dotenv-safe').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const { initializePostgres, testConnection } = require('../../config/postgres');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const chatCleanupMiddleware = require('./middleware/chatCleanup');
const usernameEnforcement = require('./middleware/usernameEnforcement');
const moderationFilter = require('./middleware/moderationFilter');
const activityTrackerMiddleware = require('./middleware/activityTracker');
const groupCommandReminder = require('./middleware/groupCommandReminder');
const errorHandler = require('./middleware/errorHandler');
// Topic middleware
const { topicPermissionsMiddleware, registerApprovalHandlers } = require('./middleware/topicPermissions');
const mediaOnlyValidator = require('./middleware/mediaOnlyValidator');
const { mediaMirrorMiddleware } = require('./middleware/mediaMirror');
const { commandRedirectionMiddleware, notificationsAutoDelete } = require('./middleware/commandRedirection');
const { groupSecurityEnforcementMiddleware, registerGroupSecurityHandlers } = require('./middleware/groupSecurityEnforcement');
// Group behavior rules (overrides previous rules)
const {
  groupBehaviorMiddleware,
  cristinaGroupFilterMiddleware,
  groupMenuRedirectMiddleware,
  groupCommandDeleteMiddleware
} = require('./middleware/groupBehavior');
const logger = require('../../utils/logger');
// Handlers
const registerUserHandlers = require('../handlers/user');
const registerAdminHandlers = require('../handlers/admin');
const registerPaymentHandlers = require('../handlers/payments');
const registerMediaHandlers = require('../handlers/media');
const registerModerationHandlers = require('../handlers/moderation');
const registerModerationAdminHandlers = require('../handlers/moderation/adminCommands');
const registerCallManagementHandlers = require('../handlers/admin/callManagement');
const registerRoleManagementHandlers = require('../handlers/admin/roleManagement');
const registerGamificationHandlers = require('../handlers/admin/gamification');
const registerLiveStreamManagementHandlers = require('../handlers/admin/liveStreamManagement');
const registerRadioManagementHandlers = require('../handlers/admin/radioManagement');
const registerPrivateCallHandlers = require('../handlers/user/privateCalls');
const registerPaymentHistoryHandlers = require('../handlers/user/paymentHistory');
const registerPaymentAnalyticsHandlers = require('../handlers/admin/paymentAnalytics');
const registerUserCallManagementHandlers = require('../handlers/user/callManagement');
const registerCallFeedbackHandlers = require('../handlers/user/callFeedback');
const registerCallPackageHandlers = require('../handlers/user/callPackages');
// Middleware
const { setupAgeVerificationMiddleware } = require('./middleware/ageVerificationRequired');
// Services
const CallReminderService = require('../services/callReminderService');
const GroupCleanupService = require('../services/groupCleanupService');
const broadcastScheduler = require('../../services/broadcastScheduler');
const SubscriptionReminderService = require('../services/subscriptionReminderService');
const radioStreamManager = require('../../services/radio/radioStreamManager');
const { startCronJobs } = require('../../../scripts/cron');
// Models for cache prewarming
const PlanModel = require('../../models/planModel');
// API Server
const apiApp = require('../api/routes');
// Variable de estado para saber si el bot está iniciado
let botStarted = false;
let botInstance = null;
let isWebhookMode = false;

/**
 * Validate critical environment variables
 */
const validateCriticalEnvVars = () => {
  // Only BOT_TOKEN is critical - PostgreSQL can use defaults or DATABASE_URL
  const criticalVars = ['BOT_TOKEN'];
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
      logger.error('CRITICAL: Missing environment variables, cannot start bot');
      logger.error(error.message);
      logger.error('Please configure all required environment variables in your .env file');
      process.exit(1);
    }
    // Initialize Sentry (optional)
    try {
      initSentry();
      logger.info('✓ Sentry initialized');
    } catch (error) {
      logger.warn('Sentry initialization failed, continuing without monitoring:', error.message);
    }
    // Initialize PostgreSQL
    try {
      initializePostgres();
      const connected = await testConnection();
      if (connected) {
        logger.info('✓ PostgreSQL initialized');
      } else {
        logger.warn('⚠️ PostgreSQL connection test failed, but will retry on first query');
      }
    } catch (error) {
      logger.error('PostgreSQL initialization failed. Bot will run in DEGRADED mode without database.');
      logger.error('Error:', error.message);
      logger.warn('⚠️  Bot features requiring database will not work!');
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
    bot.use(chatCleanupMiddleware());
    // DISABLED: bot.use(usernameEnforcement()); // Username enforcement rules disabled
    bot.use(moderationFilter());
    bot.use(activityTrackerMiddleware());
    bot.use(groupCommandReminder());

    // Group behavior rules (OVERRIDE all previous rules)
    bot.use(groupBehaviorMiddleware()); // Route all bot messages to topic 3135, 3-min delete
    bot.use(cristinaGroupFilterMiddleware()); // Filter personal info from Cristina in groups
    bot.use(groupMenuRedirectMiddleware()); // Redirect menu button clicks to private
    bot.use(groupCommandDeleteMiddleware()); // Delete commands after 3 minutes

    // Topic-specific middlewares
    bot.use(notificationsAutoDelete()); // Auto-delete in notifications topic
    bot.use(commandRedirectionMiddleware()); // Redirect commands to notifications
    bot.use(mediaMirrorMiddleware()); // Mirror media to PNPtv Gallery
    bot.use(topicPermissionsMiddleware()); // Admin-only and approval queue
    bot.use(mediaOnlyValidator()); // Media-only validation for PNPtv Gallery
    // Register handlers
    registerUserHandlers(bot);
    registerAdminHandlers(bot);
    registerPaymentHandlers(bot);
    registerMediaHandlers(bot);
    registerModerationHandlers(bot);
    registerModerationAdminHandlers(bot);
    registerCallManagementHandlers(bot);
    registerRoleManagementHandlers(bot);
    registerGamificationHandlers(bot);
    registerLiveStreamManagementHandlers(bot);
    registerRadioManagementHandlers(bot);
    registerPrivateCallHandlers(bot);
    registerPaymentHistoryHandlers(bot);
    registerPaymentAnalyticsHandlers(bot);
    registerUserCallManagementHandlers(bot);
    registerCallFeedbackHandlers(bot);
    registerCallPackageHandlers(bot);
    // Setup age verification middleware for protected features
    setupAgeVerificationMiddleware(bot);
    logger.info('✓ Age verification middleware configured');
    // Initialize call reminder service
    CallReminderService.initialize(bot);
    logger.info('✓ Call reminder service initialized');
    // Initialize group cleanup service
    const groupCleanup = new GroupCleanupService(bot);
    groupCleanup.initialize();
    // Initialize broadcast scheduler service
    try {
      broadcastScheduler.initialize(bot);
      broadcastScheduler.start();
      logger.info('✓ Broadcast scheduler initialized and started');
    } catch (error) {
      logger.warn('Broadcast scheduler initialization failed, continuing without scheduler:', error.message);
    }
    // Initialize radio stream manager
    try {
      await radioStreamManager.initialize();
      logger.info('✓ Radio stream manager initialized and started');
    } catch (error) {
      logger.warn('Radio stream manager initialization failed, continuing without radio:', error.message);
    }
    // Error handling
    bot.catch(errorHandler);
    // Start bot
    if (process.env.NODE_ENV === 'production' && process.env.BOT_WEBHOOK_DOMAIN) {
      // Webhook mode for production
      const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}${webhookPath}`;

      // Configure allowed updates to include member join/leave events
      const allowedUpdates = [
        'message',
        'callback_query',
        'my_chat_member',  // Bot added/removed from group
        'chat_member',     // User joined/left group (for welcome messages)
        'channel_post',
        'edited_message',
      ];

      await bot.telegram.setWebhook(webhookUrl, { allowed_updates: allowedUpdates });
      logger.info(`✓ Webhook set to: ${webhookUrl}`);
      // Register webhook callback
      apiApp.post(webhookPath, async (req, res) => {
        req.setTimeout(0);
        res.setTimeout(0);
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Content-Type', 'application/json');
        try {
          logger.info('Telegram webhook received:', {
            hasBody: !!req.body,
            bodySize: req.body ? JSON.stringify(req.body).length : 0,
            contentType: req.headers['content-type'],
            method: req.method,
            path: req.path,
          });
          if (!req.body || Object.keys(req.body).length === 0) {
            logger.warn('Webhook received empty body');
            return res.status(200).json({ ok: true, message: 'Empty body received' });
          }

          // Deduplicate incoming webhook updates using Redis
          try {
            const { cache } = require('../../config/redis');
            const updateId = req.body.update_id;
            if (updateId) {
              const key = `telegram:processed_update:${updateId}`;
              const set = await cache.setNX(key, true, 60); // keep for 60s
              if (!set) {
                logger.warn('Duplicate webhook update ignored', { updateId });
                return res.status(200).json({ ok: true, message: 'Duplicate update ignored' });
              }
            }
          } catch (err) {
            // If Redis fails we don't want to block processing — log and continue
            logger.warn('Failed to dedupe update via Redis, continuing', { error: err.message });
          }
          // Log the callback query data if present
          if (req.body.callback_query) {
            logger.info(`>>> CALLBACK_QUERY received: data=${req.body.callback_query.data}, from=${req.body.callback_query.from?.id}`);
          }
          if (req.body.message) {
            logger.info(`>>> MESSAGE received: text=${req.body.message.text || 'N/A'}, from=${req.body.message.from?.id}`);
          }
          await bot.handleUpdate(req.body);
          res.status(200).json({ ok: true });
          logger.info('Webhook processed successfully');
        } catch (error) {
          logger.error('Error processing Telegram webhook:', {
            error: error.message,
            stack: error.stack,
            body: req.body,
          });
          res.status(200).json({ ok: false, error: error.message });
        }
      });
      logger.info(`✓ Webhook callback registered at: ${webhookPath}`);
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
      botInstance = bot; // Asignar la instancia del bot
      botStarted = true; // Actualizar el estado
      isWebhookMode = true; // Marcar que estamos en modo webhook
      logger.info('✓ Bot started in webhook mode');
    } else {
      // Polling mode for development
      await bot.telegram.deleteWebhook();
      await bot.launch();
      botInstance = bot; // Asignar la instancia del bot
      botStarted = true; // Actualizar el estado
      logger.info('✓ Bot started in polling mode');
    }
    // Add 404 and error handlers
    const {
      errorHandler: expressErrorHandler,
      notFoundHandler: expressNotFoundHandler
    } = require('../api/middleware/errorHandler');
    apiApp.use(expressNotFoundHandler);
    apiApp.use(expressErrorHandler);
    logger.info('✓ Error handlers registered');
    // Start API server
    const PORT = process.env.PORT || 3000;
    const server = apiApp.listen(PORT, () => {
      logger.info(`✓ API server running on port ${PORT}`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.timeout = 120000;
    logger.info('🚀 PNPtv Telegram Bot is running!');
  } catch (error) {
    logger.error('❌ CRITICAL ERROR during bot startup:', error);
    logger.error('Stack trace:', error.stack);
    logger.warn('⚠️  Bot encountered a critical error but will attempt to keep process alive');
    logger.warn('⚠️  Some features may not work properly. Check logs above for details.');
    try {
      const PORT = process.env.PORT || 3000;
      apiApp.listen(PORT, () => {
        logger.info(`⚠️  Emergency API server running on port ${PORT} (degraded mode)`);
        logger.info('Bot is NOT fully functional. Fix configuration and restart.');
      });
    } catch (apiError) {
      logger.error('Failed to start emergency API server:', apiError);
      logger.warn('Process will stay alive but non-functional. Manual intervention required.');
    }
  }
};

// Manejadores de señales corregidos
process.once('SIGINT', async () => {
  logger.info('Received SIGINT, stopping bot...');
  if (botStarted && botInstance && !isWebhookMode) {
    // Solo llamar stop() en modo polling, no en webhook
    try {
      await botInstance.stop('SIGINT');
      logger.info('Bot stopped successfully (SIGINT)');
    } catch (err) {
      logger.error('Error stopping bot:', err);
    }
  } else if (isWebhookMode) {
    logger.info('Bot running in webhook mode, graceful shutdown (SIGINT)');
  } else {
    logger.warn('SIGINT received but bot was not started, skipping stop()');
  }
  process.exit(0);
});

process.once('SIGTERM', async () => {
  logger.info('Received SIGTERM, stopping bot...');
  if (botStarted && botInstance && !isWebhookMode) {
    // Solo llamar stop() en modo polling, no en webhook
    try {
      await botInstance.stop('SIGTERM');
      logger.info('Bot stopped successfully (SIGTERM)');
    } catch (err) {
      logger.error('Error stopping bot:', err);
    }
  } else if (isWebhookMode) {
    logger.info('Bot running in webhook mode, graceful shutdown (SIGTERM)');
  } else {
    logger.warn('SIGTERM received but bot was not started, skipping stop()');
  }
  process.exit(0);
});

// Manejadores globales de errores
process.on('uncaughtException', (error) => {
  logger.error('❌ UNCAUGHT EXCEPTION:', error);
  logger.error('Stack:', error.stack);
  logger.warn('Process will continue despite uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ UNHANDLED PROMISE REJECTION:', reason);
  logger.error('Promise:', promise);
  logger.warn('Process will continue despite unhandled rejection');
});

// Start the bot
if (require.main === module) {
  startBot().catch((err) => {
    logger.error('Unhandled error in startBot():', err);
    logger.warn('Process will stay alive despite error');
  });
}

/**
 * Get the bot instance for sending messages from services
 * @returns {Telegraf|null} The bot instance or null if not started
 */
const getBotInstance = () => botInstance;

module.exports = { startBot, getBotInstance };
