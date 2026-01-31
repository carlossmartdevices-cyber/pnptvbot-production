// Force IPv4 for DNS resolution BEFORE any network requests
// This must be at the very top to fix IPv6 timeout issues with Telegram API
const dns = require('dns');
const fs = require('fs');
const os = require('os');
const path = require('path');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const { initializePostgres, testConnection } = require('../../config/postgres');
const { initializeRedis } = require('../../config/redis');
const { initSentry } = require('./plugins/sentry');
const sessionMiddleware = require('./middleware/session');
const rateLimitMiddleware = require('./middleware/rateLimit');
const chatCleanupMiddleware = require('./middleware/chatCleanup');
const moderationFilter = require('./middleware/moderationFilter');
const groupCommandReminder = require('./middleware/groupCommandReminder');
const errorHandler = require('./middleware/errorHandler');
// Topic middleware
const { topicPermissionsMiddleware, registerApprovalHandlers } = require('./middleware/topicPermissions');
const mediaOnlyValidator = require('./middleware/mediaOnlyValidator');
const { mediaMirrorMiddleware } = require('./middleware/mediaMirror');
const topicModerationMiddleware = require('./middleware/topicModeration');
const botAdditionPreventionMiddleware = require('./middleware/botAdditionPrevention');
const autoModerationMiddleware = require('./middleware/autoModeration');
const { commandRedirectionMiddleware, notificationsAutoDelete } = require('./middleware/commandRedirection');
const { groupSecurityEnforcementMiddleware, registerGroupSecurityHandlers } = require('./middleware/groupSecurityEnforcement');
// Group behavior rules (overrides previous rules)
const {
  groupBehaviorMiddleware,
  cristinaGroupFilterMiddleware,
  groupMenuRedirectMiddleware,
  groupCallbackRedirectMiddleware,
  groupCommandDeleteMiddleware,
  primeChannelSilentRedirectMiddleware
} = require('./middleware/groupBehavior');
const groupCommandRestrictionMiddleware = require('./middleware/groupCommandRestriction');
const wallOfFameGuard = require('./middleware/wallOfFameGuard');
const notificationsTopicGuard = require('./middleware/notificationsTopicGuard');
const logger = require('../../utils/logger');
const performanceMonitor = require('../../utils/performanceMonitor');
// Media popularity tracking
const MediaPopularityService = require('../services/mediaPopularityService');
const MediaPopularityScheduler = require('../services/mediaPopularityScheduler');
// Handlers
const registerUserHandlers = require('../handlers/user');
const registerAdminHandlers = require('../handlers/admin');
const registerPaymentHandlers = require('../handlers/payments');
const registerMediaHandlers = require('../handlers/media');
const registerModerationHandlers = require('../handlers/moderation');
const registerModerationAdminHandlers = require('../handlers/moderation/adminCommands');
const registerAccessControlHandlers = require('../handlers/moderation/accessControlCommands');
const registerJitsiModeratorHandlers = require('../handlers/moderation/jitsiModerator');
const registerCallManagementHandlers = require('../handlers/admin/callManagement');
const registerRoleManagementHandlers = require('../handlers/admin/roleManagement');
<<<<<<< HEAD
const registerPerformerManagementHandlers = require('../handlers/admin/performerManagement');
const registerLiveStreamManagementHandlers = require('../handlers/admin/liveStreamManagement');
const registerRadioManagementHandlers = require('../handlers/admin/radioManagement');
const registerPNPLiveModelHandlers = require('../handlers/model/pnpLiveModelHandler');
const { registerWallOfFameHandlers } = require('../handlers/group/wallOfFame');
const registerPrivateCallHandlers = require('../handlers/user/privateCalls');
const registerPrivateCallsProntoHandlers = require('../handlers/user/privateCallsPronto');
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
const MembershipCleanupService = require('../services/membershipCleanupService');
const TutorialReminderService = require('../services/tutorialReminderService');
const MessageRateLimiter = require('../services/messageRateLimiter');
const radioStreamManager = require('../../services/radio/radioStreamManager');
const CommunityPostScheduler = require('./schedulers/communityPostScheduler');
const XPostScheduler = require('./schedulers/xPostScheduler');
const { initializeWorker: initializePrivateCallsWorker } = require('../../workers/privateCallsWorker');
const PNPLiveWorker = require('../../workers/pnpLiveWorker');
const { startCronJobs } = require('../../../scripts/cron');
// Models for cache prewarming
const PlanModel = require('../../models/planModel');
// Support model for ticket tracking
const SupportTopicModel = require('../../models/supportTopicModel');
// Support routing service and handlers
const supportRoutingService = require('../services/supportRoutingService');
const registerSupportRoutingHandlers = require('../handlers/support/supportRouting');
const slaMonitor = require('../services/slaMonitor');
// Async Broadcast Queue
const { initializeAsyncBroadcastQueue } = require('../services/initializeQueue');
// API Server
const apiApp = require('../api/routes');
// Broadcast buttons presets
const BroadcastButtonModel = require('../../models/broadcastButtonModel');
// Variable de estado para saber si el bot está iniciado
let botStarted = false;
let botInstance = null;
let isWebhookMode = false;
let apiServer = null;

const LOCK_PATH = process.env.BOT_LOCK_PATH || path.join(os.tmpdir(), 'pnptvbot.lock');
const LOCK_ENABLED = process.env.BOT_LOCK_ENABLED !== 'false';
let hasProcessLock = false;

const acquireProcessLock = () => {
  if (!LOCK_ENABLED) return true;
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
    hasProcessLock = true;
    logger.info(`✓ Process lock acquired: ${LOCK_PATH}`);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      logger.warn(`Failed to create process lock (${LOCK_PATH}); continuing without lock: ${error.message}`);
      return true;
    }
  }

  try {
    const raw = fs.readFileSync(LOCK_PATH, 'utf8').trim();
    let lockedPid = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        lockedPid = Number(parsed.pid);
      } catch (_) {
        lockedPid = Number(raw);
      }
    }

    if (lockedPid) {
      try {
        process.kill(lockedPid, 0);
        logger.error(`Another bot instance is already running (pid ${lockedPid}).`);
        logger.error('If this is unexpected, stop the other process or remove the lock file.');
        return false;
      } catch (err) {
        if (err.code !== 'ESRCH') {
          logger.error(`Unable to verify existing lock pid ${lockedPid}: ${err.message}`);
          return false;
        }
      }
    }

    fs.unlinkSync(LOCK_PATH);
    return acquireProcessLock();
  } catch (error) {
    logger.warn(`Failed to validate existing lock; continuing without lock: ${error.message}`);
    return true;
  }
};

const releaseProcessLock = () => {
  if (!LOCK_ENABLED || !hasProcessLock) return;
  try {
    fs.unlinkSync(LOCK_PATH);
    hasProcessLock = false;
    logger.info(`✓ Process lock released: ${LOCK_PATH}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Failed to remove process lock (${LOCK_PATH}): ${error.message}`);
    }
  }
};

const startApiServer = (modeLabel) => {
  if (apiServer) {
    logger.warn('API server already started; skipping additional listen.');
    return apiServer;
  }

  const PORT = process.env.PORT || 3001;
  const server = apiApp.listen(PORT, '0.0.0.0', () => {
    const prefix = modeLabel ? `${modeLabel} ` : '';
    logger.info(`✓ ${prefix}API server running on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`API port ${PORT} is already in use. Another instance may be running.`);
      releaseProcessLock();
      process.exit(1);
    }
    logger.error('API server error:', error);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.timeout = 120000;
  apiServer = server;
  return server;
};

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
    performanceMonitor.start('bot_startup');
    logger.info('Starting PNPtv Telegram Bot...');
    if (!acquireProcessLock()) {
      process.exit(1);
    }
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
        // Initialize support topics table
        try {
          await SupportTopicModel.initTable();
          logger.info('✓ Support topics table initialized');
        } catch (tableError) {
          logger.warn('Support topics table initialization failed:', tableError.message);
        }
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

    // FIX: Register /menu command early to avoid middleware conflicts
    const { showMainMenu: showPrivateMenu } = require('../handlers/user/menu');
    bot.command('menu', async (ctx) => {
      logger.info('/menu command handler reached', { userId: ctx.from?.id, chatType: ctx.chat?.type });
      try {
        logger.info('Calling showPrivateMenu...');
        const result = await showPrivateMenu(ctx);
        logger.info('showPrivateMenu completed', { result });
      } catch (error) {
        logger.error('Error in /menu handler:', error.message, error.stack);
        await ctx.reply('Error loading menu. Please try again.');
      }
    });

    // FIX: Register /admin command early using admin handler directly  
    bot.command('admin', async (ctx) => {
      logger.info('[ADMIN-EARLY] /admin command received');
      try {
        const PermissionService = require('../services/permissionService');
        const { getLanguage, t } = require('../utils/helpers');
        const { showAdminPanel } = require('../handlers/admin/index');
        
        const isAdmin = await PermissionService.isAdmin(ctx.from?.id);
        logger.info(`[ADMIN-EARLY] Permission check: isAdmin=${isAdmin}`);
        
        if (!isAdmin) {
          logger.info(`[ADMIN-EARLY] User not authorized`);
          await ctx.reply(t('unauthorized', getLanguage(ctx)));
          return;
        }

        logger.info('[ADMIN-EARLY] User authorized, calling showAdminPanel...');
        await showAdminPanel(ctx, false);
        logger.info('[ADMIN-EARLY] showAdminPanel completed successfully');
      } catch (error) {
        logger.error('[ADMIN-EARLY] Error in /admin handler:', error.message, error.stack);
        await ctx.reply('❌ Error loading admin panel.');
      }
    });

    // DEBUG: Log all updates
    bot.use(async (ctx, next) => {
      if (ctx.message?.text?.startsWith('/')) {
        logger.info(`[TELEGRAF] Command received: text="${ctx.message.text}", from=${ctx.from?.id}, chat=${ctx.chat?.id}`);
      }
      return next();
    });

    // Register middleware
    bot.use(sessionMiddleware());
    bot.use(rateLimitMiddleware());

    // CRITICAL: Group security enforcement - MUST be early in the chain
    // This prevents the bot from operating in unauthorized groups/channels
    bot.use(groupSecurityEnforcementMiddleware());

    bot.use(chatCleanupMiddleware());
    // DISABLED: bot.use(usernameEnforcement()); // Username enforcement rules disabled
    bot.use(botAdditionPreventionMiddleware()); // Prevent unauthorized bot additions
    bot.use(autoModerationMiddleware()); // Auto-moderation for links, spam, flooding
    bot.use(moderationFilter());

    // Group behavior rules (OVERRIDE all previous rules)
    bot.use(primeChannelSilentRedirectMiddleware()); // PRIME channel: silent redirect to private (no messages in channel)
    bot.use(groupBehaviorMiddleware()); // Route all bot messages to topic 3135, 3-min delete
    bot.use(cristinaGroupFilterMiddleware()); // Filter personal info from Cristina in groups
    bot.use(groupMenuRedirectMiddleware()); // Redirect menu button clicks to private
    bot.use(groupCallbackRedirectMiddleware()); // Redirect inline button callbacks to deep links
    bot.use(wallOfFameGuard()); // Wall of Fame topic is bot-only
    bot.use(notificationsTopicGuard()); // Notifications topic is bot-only (and env admins)
    bot.use(groupCommandRestrictionMiddleware()); // Block all commands except /menu in groups

    // Topic-specific middlewares
    bot.use(notificationsAutoDelete()); // Auto-delete in notifications topic
    bot.use(mediaMirrorMiddleware()); // Mirror media to PNPtv Gallery
    bot.use(topicPermissionsMiddleware()); // Admin-only and approval queue
    bot.use(topicModerationMiddleware()); // Anti-spam, anti-flood for topics
    bot.use(mediaOnlyValidator()); // Media-only validation for PNPtv Gallery

    // CRITICAL: Register group security handlers (my_chat_member events)
    // This auto-leaves unauthorized groups when bot is added
    registerGroupSecurityHandlers(bot);
    logger.info('✓ Group security handlers registered');

    // Register handlers
    registerUserHandlers(bot);
    registerAdminHandlers(bot); // This registers radio, live streams, community premium, and community posts handlers
    registerPNPLiveModelHandlers(bot); // Register PNP Live model self-service handlers
    registerPaymentHandlers(bot);
    registerMediaHandlers(bot);
    registerModerationHandlers(bot);
    registerModerationAdminHandlers(bot);
    registerAccessControlHandlers(bot);
    registerJitsiModeratorHandlers(bot);
    registerCallManagementHandlers(bot);
    registerRoleManagementHandlers(bot);
    registerPerformerManagementHandlers(bot);
    registerWallOfFameHandlers(bot);
    registerPrivateCallHandlers(bot);
    registerPrivateCallsProntoHandlers(bot);
    registerPaymentHistoryHandlers(bot);
    registerPaymentAnalyticsHandlers(bot);
    registerUserCallManagementHandlers(bot);
    registerCallFeedbackHandlers(bot);
    registerCallPackageHandlers(bot);
    // Register support routing handlers (for forum topic-based support)
    registerSupportRoutingHandlers(bot);

    // Start SLA monitor if configured
    const slaCheckInterval = parseInt(process.env.SLA_CHECK_INTERVAL) || 3600000;
    if (process.env.SUPPORT_GROUP_ID && process.env.SLA_MONITOR_ENABLED !== 'false') {
      slaMonitor.start(slaCheckInterval);
      logger.info('SLA monitor initialized', { intervalMs: slaCheckInterval });
    } else {
      logger.info('SLA monitor disabled (SUPPORT_GROUP_ID not configured or SLA_MONITOR_ENABLED=false)');
    }
    // Initialize support routing service with telegram instance
    supportRoutingService.initialize(bot.telegram);
    logger.info('✓ Support routing service initialized');
    // Setup age verification middleware for protected features
    setupAgeVerificationMiddleware(bot);
    logger.info('✓ Age verification middleware configured');
    // Initialize call reminder service
    CallReminderService.initialize(bot);
    logger.info('✓ Call reminder service initialized');
    // Initialize private calls pronto worker (expiry, reminders, auto-end)
    try {
      const privateCallsWorker = initializePrivateCallsWorker(bot);
      privateCallsWorker.start();
      logger.info('✓ Private calls pronto worker initialized and started');
    } catch (workerError) {
      logger.warn('Private calls worker initialization failed, continuing without background jobs:', workerError.message);
    }

    // Initialize PNP Live worker (notifications, auto-complete, model status)
    try {
      const pnpLiveWorker = new PNPLiveWorker(bot);
      pnpLiveWorker.start();
      logger.info('✓ PNP Live worker initialized and started');
    } catch (workerError) {
      logger.warn('PNP Live worker initialization failed, continuing without background jobs:', workerError.message);
    }
    // Initialize membership cleanup service (for daily status updates and channel management)
    MembershipCleanupService.initialize(bot);
    logger.info('✓ Membership cleanup service initialized');
    // Start cron jobs for scheduled tasks (membership sync, cleanup, etc.)
    try {
      await startCronJobs(bot);
      logger.info('✓ Cron jobs started');
    } catch (cronError) {
      logger.warn('Cron jobs initialization failed, continuing without scheduled tasks:', cronError.message);
    }
    // Initialize message rate limiter (to limit group messages to 6/day)
    MessageRateLimiter.initialize();
    logger.info('✓ Message rate limiter initialized');

    // Initialize tutorial reminder service (proactive tutorials for FREE and PRIME users)
    TutorialReminderService.initialize(bot);
    TutorialReminderService.startScheduling();
    logger.info('✓ Tutorial reminder service initialized and started');
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
    // Initialize broadcast buttons tables (presets/custom CTAs)
    try {
      await BroadcastButtonModel.initializeTables();
    } catch (error) {
      logger.warn('Broadcast button tables initialization failed (broadcasts will run without presets until fixed):', error.message);
    }
    // Initialize media popularity scheduler
    try {
      const mediaPopularityScheduler = new MediaPopularityScheduler(bot);
      await mediaPopularityScheduler.initialize();
      logger.info('✓ Media popularity scheduler initialized');
    } catch (error) {
      logger.error('Media popularity scheduler initialization failed:', error.message);
      logger.warn('⚠️  Automated media announcements will not work');
    }
    // Initialize async broadcast queue
    try {
      const queueIntegration = await initializeAsyncBroadcastQueue(bot, {
        concurrency: 2,
        maxAttempts: 3,
        autoStart: true,
      });
      global.broadcastQueueIntegration = queueIntegration;
      logger.info('✓ Async broadcast queue initialized and started');
    } catch (error) {
      logger.warn('Async broadcast queue initialization failed, continuing without async processing:', error.message);
    }
    // Initialize radio stream manager
    try {
      await radioStreamManager.initialize();
      logger.info('✓ Radio stream manager initialized and started');
    } catch (error) {
      logger.warn('Radio stream manager initialization failed, continuing without radio:', error.message);
    }
    // Initialize community post scheduler
    try {
      const communityPostScheduler = new CommunityPostScheduler(bot);
      communityPostScheduler.start();
      global.communityPostScheduler = communityPostScheduler;
      logger.info('✓ Community post scheduler initialized and started');
    } catch (error) {
      logger.warn('Community post scheduler initialization failed, continuing without community posts:', error.message);
    }

    // Initialize X post scheduler
    try {
      const xPostScheduler = new XPostScheduler();
      xPostScheduler.start();
      global.xPostScheduler = xPostScheduler;
      logger.info('✓ X post scheduler initialized and started');
    } catch (error) {
      logger.warn('X post scheduler initialization failed, continuing without X posts:', error.message);
    }

    // Initialize proactive reminder service
    try {
      const ProactiveReminderService = require('../services/proactiveReminderService');

      // Check if proactive reminders are enabled (disabled by default if bot is kicked from group)
      const PROACTIVE_REMINDERS_ENABLED = process.env.PROACTIVE_REMINDERS_ENABLED === 'true';

      if (PROACTIVE_REMINDERS_ENABLED) {
        // Start reminders for main group (replace with your actual group ID)
        const GROUP_ID = process.env.GROUP_ID || '-1001234567890'; // Default fallback
        const GROUP_LANGUAGE = 'en'; // Default language

        ProactiveReminderService.startReminders(bot.telegram, GROUP_ID, GROUP_LANGUAGE);
        logger.info('✓ Proactive reminder service initialized and started');
      } else {
        logger.info('✓ Proactive reminder service skipped (PROACTIVE_REMINDERS_ENABLED=false)');
      }
      
      // Store reference for potential future use
      global.proactiveReminderService = ProactiveReminderService;
    } catch (error) {
      logger.warn('Proactive reminder service initialization failed, continuing without reminders:', error.message);
    }
    // Register commands with Telegram
    try {
      const commands = [
        { command: 'start', description: 'Start the bot and select your language' },
        { command: 'menu', description: 'Show main menu with all features' },
        { command: 'admin', description: 'Open admin panel (admin only)' },
        { command: 'stats', description: 'View real-time statistics (admin only)' },
        { command: 'viewas', description: 'Preview as different user type (admin only)' },
        { command: 'support', description: 'Get help and support' },
        { command: 'about', description: 'Learn about PNPtv' },
      ];
      await bot.telegram.setMyCommands(commands);
      logger.info('✓ Bot commands registered with Telegram:', commands.map(c => `/${c.command}`).join(', '));
    } catch (error) {
      logger.warn('Failed to register bot commands with Telegram:', error.message);
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

      // Try to set webhook with retry logic and fallback
      let webhookSet = false;
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          await bot.telegram.setWebhook(webhookUrl, {
            allowed_updates: allowedUpdates,
            drop_pending_updates: false
          });
          logger.info(`✓ Webhook set to: ${webhookUrl}`);
          webhookSet = true;
          break;
        } catch (webhookError) {
          logger.warn(`Webhook setup attempt ${i + 1}/${maxRetries} failed:`, webhookError.message);
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          }
        }
      }

      if (!webhookSet) {
        logger.error('Failed to set webhook after multiple attempts');
        logger.warn('Webhook setup failed. Falling back to polling mode for bot functionality.');
        try {
          await bot.telegram.deleteWebhook();
          await bot.launch();
          botInstance = bot;
          botStarted = true;
          logger.info('✓ Bot started in polling mode (webhook fallback)');
          return; // Exit webhook setup, polling is now active
        } catch (pollingError) {
          logger.error('Failed to enable polling fallback:', pollingError.message);
          logger.warn('Bot will continue in degraded mode. Manual webhook setup required.');
          logger.warn('You can set webhook later using: curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=' + webhookUrl);
        }
      }
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
            const entities = req.body.message.entities || [];
            const hasBotCommand = entities.some(e => e.type === 'bot_command');
            logger.info(`>>> MESSAGE received: text="${req.body.message.text || 'N/A'}", from=${req.body.message.from?.id}, hasBotCommand=${hasBotCommand}, entities=${JSON.stringify(entities)}`);
            if (req.body.message.text && req.body.message.text.startsWith('/')) {
              logger.info(`>>> COMMAND MESSAGE detected: text="${req.body.message.text}", hasBotCommand=${hasBotCommand}`);
            }
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
    startApiServer();
    logger.info('🚀 PNPtv Telegram Bot is running!');
    performanceMonitor.end('bot_startup', { mode: isWebhookMode ? 'webhook' : 'polling' });
    performanceMonitor.logSummary();
  } catch (error) {
    logger.error('❌ CRITICAL ERROR during bot startup:', error);
    logger.error('Stack trace:', error.stack);
    logger.warn('⚠️  Bot encountered a critical error but will attempt to keep process alive');
    logger.warn('⚠️  Some features may not work properly. Check logs above for details.');
    try {
      startApiServer('Emergency');
      logger.info('Bot is NOT fully functional. Fix configuration and restart.');
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
  releaseProcessLock();
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
  releaseProcessLock();
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

process.once('exit', () => {
  releaseProcessLock();
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
