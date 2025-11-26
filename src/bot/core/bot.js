const { Telegraf } = require('telegraf');
const { config, validateConfig } = require('../config/botConfig');
const { initializeFirebase } = require('../config/firebase');
const { initializeSentry, sentryErrorHandler } = require('./plugins/sentry');
const { chatTypeMiddleware } = require('./middleware/chatType');
const { checkAdminStatus, adminOnly } = require('./middleware/admin');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const sessionMiddleware = require('./middleware/session');
const i18n = require('../utils/i18n');
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
// Services
const CallReminderService = require('../services/callReminderService');
const GroupCleanupService = require('../services/groupCleanupService');
// Models for cache prewarming
const PlanModel = require('../../models/planModel');
// API Server
const apiApp = require('../api/routes');
// Variable de estado para saber si el bot está iniciado
let botStarted = false;
let botInstance = null;
let isWebhookMode = false;

/**
 * Initialize and configure the bot
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
    // Initialize Firebase (with fallback)
    try {
      initializeFirebase();
      logger.info('✓ Firebase initialized');
    } catch (error) {
      logger.error('Firebase initialization failed. Bot will run in DEGRADED mode without database.');
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
    bot.use(usernameEnforcement());
    bot.use(moderationFilter());
    bot.use(activityTrackerMiddleware());
    bot.use(groupCommandReminder());
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
    // Initialize call reminder service
    CallReminderService.initialize(bot);
    logger.info('✓ Call reminder service initialized');
    // Initialize group cleanup service
    const groupCleanup = new GroupCleanupService(bot);
    groupCleanup.initialize();
    // Error handling
    bot.catch(errorHandler);
    // Start bot
    if (process.env.NODE_ENV === 'production' && process.env.BOT_WEBHOOK_DOMAIN) {
      // Webhook mode for production
      const webhookPath = process.env.BOT_WEBHOOK_PATH || '/webhook/telegram';
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}${webhookPath}`;
      await bot.telegram.setWebhook(webhookUrl);
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
 * Register middleware
 */
function registerMiddleware(bot) {
  // Chat type detection
  bot.use(chatTypeMiddleware());

  // Session management
  bot.use(sessionMiddleware.middleware());

  // Rate limiting
  bot.use(rateLimitMiddleware());

  // Admin status check
  bot.use(checkAdminStatus());

  // User context middleware
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      ctx.user = await userService.getUser(ctx.from.id);
    }
    return next();
  });

  // i18n middleware
  bot.use(i18n.middleware());

  logger.info('Middleware registered');
}

/**
 * Register all command and callback handlers
 */
function registerHandlers(bot) {
  // ===== USER COMMANDS =====
  bot.command('start', handleStart);
  bot.command('profile', handleProfile);
  bot.command('subscribe', handleSubscribe);
  bot.command('nearby', handleNearby);
  bot.command('support', handleSupport);
  bot.command('settings', handleSettings);

  // ===== GROUP COMMANDS =====
  bot.hears(/live streams?|transmisiones/i, handleLiveStreams);
  bot.hears(/radio/i, handleRadio);
  bot.hears(/zoom rooms?|salas zoom/i, handleZoomRooms);

  // ===== ADMIN COMMANDS =====
  bot.command('admin', adminOnly(), handleAdminDashboard);

  // ===== CALLBACK QUERY HANDLERS =====

  // Language selection
  bot.action(/^lang_/, handleLanguageSelection);

  // Onboarding callbacks
  bot.action(/^accept_terms$/, handleTermsAcceptance);
  bot.action(/^decline_terms$/, handleTermsAcceptance);

  // Main menu callbacks
  bot.action('menu_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await handleProfile(ctx);
  });

  bot.action('menu_subscribe', async (ctx) => {
    await ctx.answerCbQuery();
    await handleSubscribe(ctx);
  });

  bot.action('menu_nearby', async (ctx) => {
    await ctx.answerCbQuery();
    await handleNearby(ctx);
  });

  bot.action('menu_streams', async (ctx) => {
    await ctx.answerCbQuery();
    await handleLiveStreams(ctx);
  });

  bot.action('menu_radio', async (ctx) => {
    await ctx.answerCbQuery();
    await handleRadio(ctx);
  });

  bot.action('menu_zoom', async (ctx) => {
    await ctx.answerCbQuery();
    await handleZoomRooms(ctx);
  });

  bot.action('menu_support', async (ctx) => {
    await ctx.answerCbQuery();
    await handleSupport(ctx);
  });

  bot.action('menu_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await handleSettings(ctx);
  });

  // Profile callbacks
  bot.action('edit_profile', handleEditProfile);
  bot.action(/^edit_(username|bio|location)$/, handleEditField);

  // Subscription callbacks
  bot.action(/^plan_/, handlePlanSelection);
  bot.action(/^pay_(epayco|daimo)_/, handlePaymentMethod);

  // Settings callbacks
  bot.action('settings_language', handleSettingsLanguage);

  // Admin callbacks
  bot.action('admin_broadcast', handleBroadcastMenu);
  bot.action(/^broadcast_(text|photo|video)$/, handleBroadcastType);
  bot.action(/^confirm_broadcast$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleBroadcastConfirm(ctx, bot);
  });
  bot.action(/^cancel_broadcast$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleBroadcastConfirm(ctx, bot);
  });

  bot.action('admin_users', handleUserManagement);
  bot.action(/^admin_extend_sub_/, handleExtendSubscription);

  bot.action('admin_analytics', handleAnalytics);
  bot.action('analytics_users', handleUserGrowthAnalytics);
  bot.action('analytics_revenue', handleRevenueAnalytics);
  bot.action('analytics_plans', handlePlanDistributionAnalytics);

  // Back navigation callbacks
  bot.action('back_main', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await userService.getUser(ctx.from.id);
    const language = user?.language || 'en';
    await ctx.editMessageText(
      i18n.t('welcome', language),
      { reply_markup: getMainMenu(language) }
    );
  });

  bot.action('back_admin', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAdminDashboard(ctx);
  });

  bot.action('back_plans', async (ctx) => {
    await ctx.answerCbQuery();
    await handleSubscribe(ctx);
  });

  // ===== TEXT MESSAGE HANDLERS =====
  bot.on('text', async (ctx) => {
    const session = ctx.session || {};

    // Handle onboarding steps
    if (session.step === 'age_verification') {
      await handleAgeVerification(ctx);
      return;
    }

    if (session.step === 'username_input') {
      await handleUsernameInput(ctx);
      return;
    }

    if (session.step === 'bio_input') {
      await handleBioInput(ctx);
      return;
    }

    // Handle admin broadcast input
    if (session.waitingForBroadcast) {
      const handled = await handleBroadcastInput(ctx, bot);
      if (handled) return;
    }

    // Handle admin user search
    if (session.waitingForUserSearch) {
      const handled = await handleUserSearch(ctx);
      if (handled) return;
    }

    // Handle profile editing
    if (session.editingField) {
      await handleProfileUpdate(ctx, session.editingField, ctx.message.text);
      return;
    }

    // Default: ignore or show help
    // (Optional: show a help message for unrecognized commands)
  });

  // ===== LOCATION HANDLER =====
  bot.on('location', async (ctx) => {
    const session = ctx.session || {};

    if (session.step === 'location_input') {
      await handleLocationInput(ctx);
      return;
    }

    // Update user location if they share it anytime
    try {
      const { latitude, longitude } = ctx.message.location;
      await userService.updateUser(ctx.from.id, {
        location: { lat: latitude, lng: longitude },
      });
      await ctx.reply('✅ Location updated!');
    } catch (error) {
      logger.error('Error updating location:', error);
    }
  });

  // ===== PHOTO/VIDEO HANDLERS (for broadcast) =====
  bot.on(['photo', 'video'], async (ctx) => {
    const session = ctx.session || {};

    if (session.waitingForBroadcast) {
      await handleBroadcastInput(ctx, bot);
    }
  });

  logger.info('Handlers registered');
}

module.exports = {
  createBot,
};
