# PROMPT COMPLETO PARTE 2: IMPLEMENTACIÓN DETALLADA

## CONTINUACIÓN DE LA FASE 4

### FASE 5: MIDDLEWARE COMPLETO

#### 5.1 Session Middleware (src/bot/core/middleware/session.js)

```javascript
const { cache } = require('../../../config/redis');
const logger = require('../../../utils/logger');

// Fallback in-memory store
const memoryStore = new Map();

const getSessionKey = (ctx) => {
  const userId = ctx.from?.id || ctx.chat?.id;
  return `session:${userId}`;
};

const sessionMiddleware = () => async (ctx, next) => {
  const sessionKey = getSessionKey(ctx);

  try {
    // Cargar sesión (Redis o memoria)
    let session;
    try {
      session = await cache.get(sessionKey);
    } catch (redisError) {
      logger.warn('Redis unavailable, using in-memory session');
      session = memoryStore.get(sessionKey);
    }

    if (!session) {
      session = {
        language: ctx.from?.language_code || 'en',
        userId: ctx.from?.id,
        temp: {}, // Datos temporales para flujos multi-step
      };
    }

    // Adjuntar a contexto
    ctx.session = session;

    // Método para guardar sesión
    ctx.saveSession = async () => {
      try {
        const ttl = parseInt(process.env.SESSION_TTL || '86400', 10);
        try {
          await cache.set(sessionKey, ctx.session, ttl);
        } catch (redisError) {
          memoryStore.set(sessionKey, ctx.session);
        }
      } catch (error) {
        logger.error('Error saving session:', error);
      }
    };

    // Método para limpiar sesión
    ctx.clearSession = async () => {
      try {
        try {
          await cache.del(sessionKey);
        } catch (redisError) {
          memoryStore.delete(sessionKey);
        }
        ctx.session = {
          language: ctx.from?.language_code || 'en',
          userId: ctx.from?.id,
          temp: {},
        };
      } catch (error) {
        logger.error('Error clearing session:', error);
      }
    };

    await next();

    // Auto-guardar después de procesar
    await ctx.saveSession();
  } catch (error) {
    logger.error('Session middleware error:', error);
    await next();
  }
};

module.exports = sessionMiddleware;
```

#### 5.2 Rate Limit Middleware (src/bot/core/middleware/rateLimit.js)

```javascript
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { getRedis } = require('../../../config/redis');
const logger = require('../../../utils/logger');

let rateLimiter;

// Configuración
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minuto
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10);

try {
  // Intentar usar Redis
  const redis = getRedis();
  rateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'ratelimit',
    points: maxRequests,
    duration: Math.floor(windowMs / 1000), // segundos
    blockDuration: 60, // Bloquear por 60 segundos si excede
  });
  logger.info('Rate limiter using Redis');
} catch (error) {
  // Fallback a memoria
  rateLimiter = new RateLimiterMemory({
    points: maxRequests,
    duration: Math.floor(windowMs / 1000),
    blockDuration: 60,
  });
  logger.warn('Rate limiter using in-memory storage');
}

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = () => async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId) {
    return next();
  }

  try {
    await rateLimiter.consume(userId.toString());
    return next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      logger.error('Rate limiter error:', rejRes);
      return next();
    }

    // Usuario bloqueado por rate limit
    const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);
    logger.warn('User rate limited', { userId, retryAfter });

    await ctx.reply(
      `⏱️ Too many requests. Please wait ${retryAfter} seconds before trying again.`
    );
  }
};

module.exports = rateLimitMiddleware;
```

#### 5.3 Error Handler Middleware (src/bot/core/middleware/errorHandler.js)

```javascript
const logger = require('../../../utils/logger');
const Sentry = require('@sentry/node');

/**
 * Global error handler para Telegraf
 */
const errorHandler = async (err, ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const update = ctx.update;

  logger.error('Bot error occurred', {
    error: err.message,
    stack: err.stack,
    userId,
    username,
    updateType: update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown',
  });

  // Enviar a Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      user: { id: userId, username },
      extra: { update },
    });
  }

  // Responder al usuario
  try {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '❌ An error occurred. Please try again or contact support.'
      : `❌ Error: ${err.message}`;

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('An error occurred', { show_alert: true });
    }
    await ctx.reply(errorMessage);
  } catch (replyError) {
    logger.error('Failed to send error message to user:', replyError);
  }
};

module.exports = errorHandler;
```

#### 5.4 Sentry Plugin (src/bot/core/plugins/sentry.js)

```javascript
const Sentry = require('@sentry/node');
const logger = require('../../../utils/logger');

/**
 * Inicializar Sentry
 */
const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry DSN not configured, skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0, // 100% de traces en desarrollo, ajustar en producción
      beforeSend(event, hint) {
        // Filtrar errores que no queremos enviar
        const error = hint.originalException;
        if (error && error.message && error.message.includes('ECONNRESET')) {
          // Ignorar errores de conexión de red
          return null;
        }
        return event;
      },
    });

    logger.info('✓ Sentry initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
};

module.exports = { initSentry };
```

---

### FASE 6: HANDLERS COMPLETOS

#### 6.1 User Handlers Index (src/bot/handlers/user/index.js)

```javascript
const registerOnboardingHandlers = require('./onboarding');
const registerMenuHandlers = require('./menu');
const registerProfileHandlers = require('./profile');
const registerNearbyHandlers = require('./nearby');
const registerSettingsHandlers = require('./settings');

/**
 * Registrar todos los handlers de usuario
 */
const registerUserHandlers = (bot) => {
  registerOnboardingHandlers(bot);
  registerMenuHandlers(bot);
  registerProfileHandlers(bot);
  registerNearbyHandlers(bot);
  registerSettingsHandlers(bot);
};

module.exports = registerUserHandlers;
```

#### 6.2 Menu Handler (src/bot/handlers/user/menu.js)

```javascript
const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const { getLanguage } = require('../../utils/helpers');
const logger = require('../../../utils/logger');

const registerMenuHandlers = (bot) => {
  // Comando /menu
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error showing menu:', error);
      await ctx.reply('Error showing menu');
    }
  });

  // Callback: back_to_main
  bot.action('back_to_main', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error returning to main menu:', error);
    }
  });
};

/**
 * Mostrar menú principal
 */
const showMainMenu = async (ctx) => {
  const lang = getLanguage(ctx);

  const menuText = t('mainMenu', lang);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(t('subscribeToPrime', lang), 'show_subscription_plans')],
    [Markup.button.callback(t('myProfile', lang), 'show_profile')],
    [Markup.button.callback(t('nearbyUsers', lang), 'show_nearby')],
    [
      Markup.button.callback(t('liveStreams', lang), 'show_live'),
      Markup.button.callback(t('radio', lang), 'show_radio'),
    ],
    [
      Markup.button.callback(t('zoomRooms', lang), 'show_zoom'),
      Markup.button.callback(t('support', lang), 'show_support'),
    ],
    [Markup.button.callback(t('settings', lang), 'show_settings')],
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(menuText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } else {
    await ctx.reply(menuText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  }
};

module.exports = registerMenuHandlers;
module.exports.showMainMenu = showMainMenu;
```

#### 6.3 Payment Handler Completo (src/bot/handlers/payments/index.js)

```javascript
const { Markup } = require('telegraf');
const PaymentService = require('../../services/paymentService');
const PlanModel = require('../../../models/planModel');
const { t } = require('../../../utils/i18n');
const { getLanguage } = require('../../utils/helpers');
const logger = require('../../../utils/logger');

const registerPaymentHandlers = (bot) => {
  // Mostrar planes de suscripción
  bot.action('show_subscription_plans', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);

      // Obtener planes activos
      const plans = await PlanModel.getAll();

      if (!plans || plans.length === 0) {
        await ctx.editMessageText(
          '❌ No subscription plans available at the moment.',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'back_to_main')],
          ])
        );
        return;
      }

      // Construir mensaje con planes
      let message = t('chooseYourPlan', lang) + '\n\n';

      plans.forEach((plan) => {
        const planName = lang === 'es' ? plan.nameEs : plan.name;
        const features = lang === 'es' ? plan.featuresEs : plan.features;

        message += `💎 *${planName}* - $${plan.price} ${plan.currency}\n`;
        message += `📅 ${plan.duration} days\n`;
        features.forEach((feature) => {
          message += `  ✓ ${feature}\n`;
        });
        message += '\n';
      });

      // Botones de planes
      const buttons = plans.map((plan) => [
        Markup.button.callback(
          `${lang === 'es' ? plan.nameEs : plan.name} - $${plan.price}`,
          `select_plan_${plan.id}`
        ),
      ]);

      buttons.push([Markup.button.callback(t('back', lang), 'back_to_main')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing subscription plans:', error);
      await ctx.reply('Error loading plans');
    }
  });

  // Seleccionar plan
  bot.action(/^select_plan_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const planId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Guardar plan seleccionado en sesión
      ctx.session.temp.selectedPlanId = planId;
      await ctx.saveSession();

      // Mostrar métodos de pago
      await ctx.editMessageText(
        t('selectPaymentMethod', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('payWithEpayco', lang), `pay_epayco_${planId}`)],
          [Markup.button.callback(t('payWithDaimo', lang), `pay_daimo_${planId}`)],
          [Markup.button.callback(t('back', lang), 'show_subscription_plans')],
        ])
      );
    } catch (error) {
      logger.error('Error selecting plan:', error);
    }
  });

  // Pagar con ePayco
  bot.action(/^pay_epayco_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Processing...');
      const planId = ctx.match[1];
      const userId = ctx.from.id;
      const lang = getLanguage(ctx);

      // Crear pago
      const result = await PaymentService.createPayment({
        userId,
        planId,
        provider: 'epayco',
      });

      if (result.success) {
        await ctx.reply(
          `✅ Payment link created!\n\n🔗 Click here to complete payment:\n${result.paymentUrl}`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Pay Now', result.paymentUrl)],
            [Markup.button.callback(t('back', lang), 'back_to_main')],
          ])
        );
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
    } catch (error) {
      logger.error('Error creating ePayco payment:', error);
      await ctx.reply('Error creating payment');
    }
  });

  // Pagar con Daimo
  bot.action(/^pay_daimo_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Processing...');
      const planId = ctx.match[1];
      const userId = ctx.from.id;
      const lang = getLanguage(ctx);

      // Crear pago
      const result = await PaymentService.createPayment({
        userId,
        planId,
        provider: 'daimo',
      });

      if (result.success) {
        await ctx.reply(
          `✅ USDC Payment link created!\n\n🔗 Click here to complete payment:\n${result.paymentUrl}`,
          Markup.inlineKeyboard([
            [Markup.button.url('💰 Pay with USDC', result.paymentUrl)],
            [Markup.button.callback(t('back', lang), 'back_to_main')],
          ])
        );
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
    } catch (error) {
      logger.error('Error creating Daimo payment:', error);
      await ctx.reply('Error creating payment');
    }
  });
};

module.exports = registerPaymentHandlers;
```

#### 6.4 Admin Handler Completo (src/bot/handlers/admin/index.js)

```javascript
const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const { getLanguage } = require('../../utils/helpers');
const logger = require('../../../utils/logger');
const moment = require('moment');

// Admin user IDs desde env
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => parseInt(id.trim(), 10));

/**
 * Verificar si usuario es admin
 */
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

const registerAdminHandlers = (bot) => {
  // Middleware: solo admins
  const adminOnly = async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) {
      await ctx.reply('❌ Access denied. Admin only.');
      return;
    }
    return next();
  };

  // Comando /admin
  bot.command('admin', adminOnly, async (ctx) => {
    try {
      await showAdminPanel(ctx);
    } catch (error) {
      logger.error('Error showing admin panel:', error);
      await ctx.reply('Error showing admin panel');
    }
  });

  // Panel de administración
  bot.action('admin_panel', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showAdminPanel(ctx);
    } catch (error) {
      logger.error('Error showing admin panel:', error);
    }
  });

  // Estadísticas
  bot.action('admin_stats', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery('Loading stats...');

      const stats = await UserModel.getStatistics();

      const message = `📊 *Statistics*\n\n` +
        `👥 Total Users: ${stats.total}\n` +
        `💎 Premium Users: ${stats.premium}\n` +
        `🆓 Free Users: ${stats.free}\n` +
        `📈 Conversion Rate: ${stats.conversionRate}%\n\n` +
        `🕐 Updated: ${moment(stats.timestamp).format('YYYY-MM-DD HH:mm:ss')}`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'admin_stats')],
          [Markup.button.callback('◀️ Back', 'admin_panel')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing stats:', error);
    }
  });

  // Gestión de usuarios
  bot.action('admin_users', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '👥 *User Management*\n\nWhat would you like to do?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📋 List All Users', 'admin_list_users')],
            [Markup.button.callback('🔍 Search User', 'admin_search_user')],
            [Markup.button.callback('💎 List Premium Users', 'admin_list_premium')],
            [Markup.button.callback('◀️ Back', 'admin_panel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing user management:', error);
    }
  });

  // Broadcast
  bot.action('admin_broadcast', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      ctx.session.temp.waitingForBroadcast = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        '📢 *Broadcast Message*\n\n' +
        'Send me the message you want to broadcast to all users.\n\n' +
        '⚠️ This will send to ALL users. Use with caution!',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'admin_panel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error initiating broadcast:', error);
    }
  });

  // Escuchar mensaje de broadcast
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForBroadcast && isAdmin(ctx.from?.id)) {
      const message = ctx.message.text;

      ctx.session.temp.waitingForBroadcast = false;
      await ctx.saveSession();

      await ctx.reply(
        `📢 Ready to broadcast:\n\n"${message}"\n\n⚠️ Confirm?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirm', 'confirm_broadcast')],
          [Markup.button.callback('❌ Cancel', 'admin_panel')],
        ])
      );

      ctx.session.temp.broadcastMessage = message;
      await ctx.saveSession();

      return;
    }

    return next();
  });

  // Confirmar broadcast
  bot.action('confirm_broadcast', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery('Broadcasting...');

      const message = ctx.session.temp.broadcastMessage;

      if (!message) {
        await ctx.reply('No message found');
        return;
      }

      // Obtener todos los usuarios (paginado)
      const { users } = await UserModel.getAll(1000);

      let sent = 0;
      let failed = 0;

      await ctx.reply(`📤 Sending to ${users.length} users...`);

      // Enviar en lotes para no saturar
      for (const user of users) {
        try {
          await bot.telegram.sendMessage(user.id, message);
          sent++;

          // Rate limit: 30 mensajes por segundo (Telegram limit)
          if (sent % 30 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failed++;
          logger.error(`Failed to send broadcast to ${user.id}:`, error);
        }
      }

      await ctx.reply(
        `✅ Broadcast completed!\n\n` +
        `📤 Sent: ${sent}\n` +
        `❌ Failed: ${failed}`
      );

      // Limpiar sesión
      ctx.session.temp.broadcastMessage = null;
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error broadcasting message:', error);
      await ctx.reply('Error broadcasting message');
    }
  });

  // Gestión de planes
  bot.action('admin_plans', adminOnly, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const PlanModel = require('../../../models/planModel');
      const plans = await PlanModel.getAll();

      let message = '💎 *Subscription Plans*\n\n';

      plans.forEach((plan) => {
        message += `*${plan.name}*\n`;
        message += `  Price: $${plan.price} ${plan.currency}\n`;
        message += `  Duration: ${plan.duration} days\n`;
        message += `  Active: ${plan.active ? '✅' : '❌'}\n\n`;
      });

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Plan', 'admin_add_plan')],
          [Markup.button.callback('◀️ Back', 'admin_panel')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing plans:', error);
    }
  });
};

/**
 * Mostrar panel de administración
 */
const showAdminPanel = async (ctx) => {
  const message = '👨‍💼 *Admin Panel*\n\nSelect an option:';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 Statistics', 'admin_stats')],
    [Markup.button.callback('👥 User Management', 'admin_users')],
    [Markup.button.callback('📢 Broadcast Message', 'admin_broadcast')],
    [Markup.button.callback('💎 Manage Plans', 'admin_plans')],
    [Markup.button.callback('📈 Analytics', 'admin_analytics')],
    [Markup.button.callback('◀️ Back to Menu', 'back_to_main')],
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  }
};

module.exports = registerAdminHandlers;
```

---

### FASE 7: SERVICES (Lógica de Negocio)

#### 7.1 User Service (src/bot/services/userService.js)

```javascript
const UserModel = require('../../models/userModel');
const logger = require('../../utils/logger');

class UserService {
  /**
   * Obtener o crear usuario desde contexto de Telegram
   */
  static async getOrCreateFromContext(ctx) {
    try {
      const telegramUser = ctx.from;

      if (!telegramUser) {
        throw new Error('No user in context');
      }

      // Buscar usuario existente
      let user = await UserModel.getById(telegramUser.id);

      if (!user) {
        // Crear nuevo usuario
        user = await UserModel.createOrUpdate({
          userId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name || null,
          username: telegramUser.username || null,
          language: telegramUser.language_code || 'en',
        });

        logger.info('New user created', { userId: telegramUser.id });
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw error;
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  static async updateProfile(userId, updates) {
    try {
      return await UserModel.updateProfile(userId, updates);
    } catch (error) {
      logger.error('Error updating profile:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  static async getStatistics() {
    try {
      return await UserModel.getStatistics();
    } catch (error) {
      logger.error('Error getting statistics:', error);
      return { total: 0, premium: 0, free: 0, conversionRate: 0 };
    }
  }

  /**
   * Obtener usuarios cercanos
   */
  static async getNearbyUsers(location, radius = 10) {
    try {
      return await UserModel.getNearby(location, radius);
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }
}

module.exports = UserService;
```

#### 7.2 Payment Service - COMPLETO (src/bot/services/paymentService.js)

```javascript
const axios = require('axios');
const crypto = require('crypto');
const PaymentModel = require('../../models/paymentModel');
const UserModel = require('../../models/userModel');
const PlanModel = require('../../models/planModel');
const logger = require('../../utils/logger');
const { cache } = require('../../config/redis');
const moment = require('moment');

class PaymentService {
  /**
   * Crear pago
   */
  static async createPayment(paymentData) {
    try {
      // Obtener plan
      const plan = await PlanModel.getById(paymentData.planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      // Crear registro de pago
      const payment = await PaymentModel.create({
        userId: paymentData.userId.toString(),
        planId: paymentData.planId,
        amount: plan.price,
        currency: plan.currency,
        provider: paymentData.provider,
      });

      logger.info('Payment record created', {
        paymentId: payment.id,
        userId: paymentData.userId,
      });

      // Generar URL de pago según proveedor
      let paymentUrl;
      if (paymentData.provider === 'epayco') {
        paymentUrl = await this.createEpaycoPayment(payment, plan);
      } else if (paymentData.provider === 'daimo') {
        paymentUrl = await this.createDaimoPayment(payment, plan);
      } else {
        return { success: false, error: 'Invalid payment provider' };
      }

      // Actualizar payment con URL
      await PaymentModel.updateStatus(payment.id, 'pending', null, { paymentUrl });

      return {
        success: true,
        paymentId: payment.id,
        paymentUrl,
      };
    } catch (error) {
      logger.error('Error creating payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear pago ePayco (Checkout)
   */
  static async createEpaycoPayment(payment, plan) {
    try {
      const publicKey = process.env.EPAYCO_PUBLIC_KEY;
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/epayco`;
      const responseUrl = `${process.env.BOT_WEBHOOK_DOMAIN}/api/payment-response`;

      // ePayco usa checkout por GET parameters
      const params = new URLSearchParams({
        public_key: publicKey,
        currency: plan.currency,
        amount: plan.price.toString(),
        tax_base: '0',
        tax: '0',
        country: 'co',
        lang: 'en',
        external: 'false',
        confirmation: webhookUrl,
        response: responseUrl,
        name_billing: plan.name,
        description: `Subscription: ${plan.name}`,
        invoice: payment.id,
        extra1: payment.id,
        extra2: payment.userId,
        extra3: payment.planId,
        test: process.env.EPAYCO_TEST_MODE === 'true' ? 'true' : 'false',
      });

      const checkoutUrl = `https://checkout.epayco.co/checkout.php?${params.toString()}`;

      logger.info('ePayco payment URL generated', {
        paymentId: payment.id,
        url: checkoutUrl,
      });

      return checkoutUrl;
    } catch (error) {
      logger.error('Error creating ePayco payment:', error);
      throw error;
    }
  }

  /**
   * Crear pago Daimo (USDC)
   */
  static async createDaimoPayment(payment, plan) {
    try {
      const apiKey = process.env.DAIMO_API_KEY;
      const webhookUrl = `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/daimo`;

      // Llamar API de Daimo para crear pago
      const response = await axios.post(
        'https://api.daimo.com/v1/payments',
        {
          amount: plan.price,
          currency: 'USDC',
          description: `Subscription: ${plan.name}`,
          metadata: {
            paymentId: payment.id,
            userId: payment.userId,
            planId: payment.planId,
          },
          callback_url: webhookUrl,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const paymentUrl = response.data.payment_url;

      logger.info('Daimo payment URL generated', {
        paymentId: payment.id,
        url: paymentUrl,
      });

      return paymentUrl;
    } catch (error) {
      logger.error('Error creating Daimo payment:', error);
      throw error;
    }
  }

  /**
   * Procesar webhook de ePayco
   */
  static async processEpaycoWebhook(webhookData) {
    try {
      // Verificar firma (CRÍTICO para seguridad)
      const isValid = this.verifyEpaycoSignature(webhookData);
      if (!isValid) {
        logger.error('Invalid ePayco webhook signature');
        return { success: false, error: 'Invalid signature' };
      }

      const paymentId = webhookData.x_extra1;
      const transactionId = webhookData.x_transaction_id;
      const status = webhookData.x_cod_transaction_state;

      // Idempotency check
      const lockKey = `webhook:epayco:${transactionId}`;
      const locked = await cache.acquireLock(lockKey, 120);

      if (!locked) {
        logger.warn('Duplicate ePayco webhook', { transactionId });
        return { success: true, message: 'Already processed' };
      }

      try {
        // Obtener pago
        const payment = await PaymentModel.getById(paymentId);
        if (!payment) {
          logger.error('Payment not found', { paymentId });
          return { success: false, error: 'Payment not found' };
        }

        // Verificar que no esté ya procesado
        if (payment.status !== 'pending') {
          logger.warn('Payment already processed', { paymentId, status: payment.status });
          return { success: true, message: 'Already processed' };
        }

        // Estados ePayco:
        // 1 = Aceptada
        // 2 = Rechazada
        // 3 = Pendiente
        // 4 = Fallida
        if (status === '1') {
          // Pago exitoso
          await this.activateSubscription(payment);
          await PaymentModel.updateStatus(paymentId, 'success', transactionId);

          logger.info('ePayco payment successful', { paymentId, transactionId });
          return { success: true, message: 'Payment successful' };
        } else {
          // Pago fallido
          await PaymentModel.updateStatus(paymentId, 'failed', transactionId, {
            reason: webhookData.x_response_reason_text,
          });

          logger.info('ePayco payment failed', { paymentId, transactionId, status });
          return { success: true, message: 'Payment failed' };
        }
      } finally {
        // Liberar lock
        await cache.releaseLock(lockKey);
      }
    } catch (error) {
      logger.error('Error processing ePayco webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar firma de ePayco
   */
  static verifyEpaycoSignature(webhookData) {
    try {
      const privateKey = process.env.EPAYCO_PRIVATE_KEY;
      const custId = process.env.EPAYCO_P_CUST_ID;

      if (!privateKey) {
        logger.error('EPAYCO_PRIVATE_KEY not configured');
        return false;
      }

      const {
        x_ref_payco,
        x_transaction_id,
        x_amount,
        x_signature,
      } = webhookData;

      // Generar firma esperada
      const signatureString = `${custId}^${privateKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}`;
      const expectedSignature = crypto
        .createHash('sha256')
        .update(signatureString)
        .digest('hex');

      return x_signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying ePayco signature:', error);
      return false;
    }
  }

  /**
   * Procesar webhook de Daimo
   */
  static async processDaimoWebhook(webhookData) {
    try {
      // Verificar firma (CRÍTICO para seguridad)
      const isValid = this.verifyDaimoSignature(webhookData);
      if (!isValid) {
        logger.error('Invalid Daimo webhook signature');
        return { success: false, error: 'Invalid signature' };
      }

      const paymentId = webhookData.metadata.paymentId;
      const transactionId = webhookData.id;
      const status = webhookData.status;

      // Idempotency check
      const lockKey = `webhook:daimo:${transactionId}`;
      const locked = await cache.acquireLock(lockKey, 120);

      if (!locked) {
        logger.warn('Duplicate Daimo webhook', { transactionId });
        return { success: true, message: 'Already processed' };
      }

      try {
        const payment = await PaymentModel.getById(paymentId);
        if (!payment) {
          logger.error('Payment not found', { paymentId });
          return { success: false, error: 'Payment not found' };
        }

        if (payment.status !== 'pending') {
          logger.warn('Payment already processed', { paymentId, status: payment.status });
          return { success: true, message: 'Already processed' };
        }

        if (status === 'completed') {
          // Pago exitoso
          await this.activateSubscription(payment);
          await PaymentModel.updateStatus(paymentId, 'success', transactionId);

          logger.info('Daimo payment successful', { paymentId, transactionId });
          return { success: true, message: 'Payment successful' };
        } else {
          // Pago fallido
          await PaymentModel.updateStatus(paymentId, 'failed', transactionId);

          logger.info('Daimo payment failed', { paymentId, transactionId, status });
          return { success: true, message: 'Payment failed' };
        }
      } finally {
        await cache.releaseLock(lockKey);
      }
    } catch (error) {
      logger.error('Error processing Daimo webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar firma de Daimo
   */
  static verifyDaimoSignature(webhookData, signature) {
    try {
      const secret = process.env.DAIMO_WEBHOOK_SECRET;

      if (!secret) {
        logger.error('DAIMO_WEBHOOK_SECRET not configured');
        return false;
      }

      // Generar firma esperada (HMAC-SHA256)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(webhookData))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying Daimo signature:', error);
      return false;
    }
  }

  /**
   * Activar suscripción de usuario
   */
  static async activateSubscription(payment) {
    try {
      const plan = await PlanModel.getById(payment.planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Calcular fecha de expiración
      const expiry = moment().add(plan.duration, 'days').toDate();

      // Actualizar usuario
      await UserModel.updateSubscription(payment.userId, {
        status: 'active',
        planId: payment.planId,
        expiry,
      });

      logger.info('Subscription activated', {
        userId: payment.userId,
        planId: payment.planId,
        expiry,
      });

      return true;
    } catch (error) {
      logger.error('Error activating subscription:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;
```

---

### FASE 8: API Y WEBHOOKS

#### 8.1 Webhook Controller (src/bot/api/controllers/webhookController.js)

```javascript
const PaymentService = require('../../services/paymentService');
const logger = require('../../../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Webhook ePayco
 */
exports.handleEpaycoWebhook = asyncHandler(async (req, res) => {
  logger.info('ePayco webhook received', { body: req.body });

  const webhookData = req.body;

  // Procesar webhook
  const result = await PaymentService.processEpaycoWebhook(webhookData);

  if (result.success) {
    res.status(200).json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

/**
 * Webhook Daimo
 */
exports.handleDaimoWebhook = asyncHandler(async (req, res) => {
  logger.info('Daimo webhook received', { body: req.body });

  const webhookData = req.body;
  const signature = req.headers['x-daimo-signature'];

  // Procesar webhook
  const result = await PaymentService.processDaimoWebhook(webhookData, signature);

  if (result.success) {
    res.status(200).json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

/**
 * Response de pago (redirect)
 */
exports.handlePaymentResponse = asyncHandler(async (req, res) => {
  const { ref_payco, status } = req.query;

  logger.info('Payment response received', { ref_payco, status });

  // Mostrar página de respuesta
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment ${status === 'Aceptada' ? 'Successful' : 'Failed'}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: white;
          color: #333;
          padding: 40px;
          border-radius: 10px;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 20px 0;
        }
        p {
          font-size: 18px;
          margin: 10px 0;
        }
        .btn {
          display: inline-block;
          margin-top: 30px;
          padding: 15px 40px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${status === 'Aceptada' ? '✅' : '❌'}</div>
        <h1>${status === 'Aceptada' ? 'Payment Successful!' : 'Payment Failed'}</h1>
        <p>${status === 'Aceptada'
          ? 'Your subscription has been activated!'
          : 'There was an issue processing your payment.'}</p>
        <p>Reference: ${ref_payco}</p>
        <a href="https://t.me/${process.env.BOT_USERNAME}" class="btn">Return to Bot</a>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});
```

#### 8.2 API Error Handler (src/bot/api/middleware/errorHandler.js)

```javascript
const logger = require('../../../utils/logger');

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
};

/**
 * Error handler
 */
const errorHandler = (err, req, res, next) => {
  logger.error('API error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
```

---

**[ESTE ES EL FIN DE LA PARTE 2 - CONTINÚA EN PARTE 3]**

Secciones restantes:
- ✅ FASE 5-8 completadas
- ⏳ FASE 9: Utilidades (validación, errors)
- ⏳ FASE 10: Docker completo
- ⏳ FASE 11: Scripts (seed, cron)
- ⏳ FASE 12: .env.example completo
- ⏳ Guía de despliegue paso a paso
