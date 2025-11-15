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
const userService = require('../services/userService');

// Import handlers
const {
  handleStart,
  handleLanguageSelection,
  handleAgeVerification,
  handleTermsAcceptance,
  handleUsernameInput,
  handleBioInput,
  handleLocationInput,
} = require('../handlers/user/start');

const { handleSubscribe, handlePlanSelection, handlePaymentMethod } = require('../handlers/user/subscribe');
const { handleProfile, handleEditProfile, handleEditField, handleProfileUpdate } = require('../handlers/user/profile');
const { handleNearby } = require('../handlers/user/nearby');
const { handleSupport } = require('../handlers/user/support');
const { handleSettings, handleSettingsLanguage, handleLanguageChange } = require('../handlers/user/settings');

const { handleLiveStreams } = require('../handlers/group/liveStreams');
const { handleRadio } = require('../handlers/group/radio');
const { handleZoomRooms } = require('../handlers/group/zoomRooms');

const { handleAdminDashboard } = require('../handlers/admin/dashboard');
const {
  handleBroadcastMenu,
  handleBroadcastType,
  handleBroadcastInput,
  handleBroadcastConfirm,
} = require('../handlers/admin/broadcast');
const { handleUserManagement, handleUserSearch, handleExtendSubscription } = require('../handlers/admin/users');
const {
  handleAnalytics,
  handleUserGrowthAnalytics,
  handleRevenueAnalytics,
  handlePlanDistributionAnalytics,
} = require('../handlers/admin/analytics');

const { getMainMenu } = require('../utils/menus');

/**
 * Initialize and configure the bot
 */
function createBot() {
  try {
    // Validate configuration
    validateConfig();

    // Initialize Firebase
    initializeFirebase();

    // Initialize Sentry
    initializeSentry();

    // Create bot instance
    const bot = new Telegraf(config.botToken);

    logger.info('Bot instance created successfully');

    // Register middleware
    registerMiddleware(bot);

    // Register handlers
    registerHandlers(bot);

    // Error handling
    bot.catch((error, ctx) => {
      logger.error('Bot error:', error);
      sentryErrorHandler()(ctx, async () => {
        throw error;
      });
    });

    return bot;
  } catch (error) {
    logger.error('Failed to create bot:', error);
    throw error;
  }
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
