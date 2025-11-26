const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

/**
 * Envía mensaje de bienvenida y link de ingreso al canal PRIME
 * @param {Telegraf} bot - Bot instance
 * @param {string|number} userId - Telegram user ID
 */
const sendPrimeWelcome = async (bot, userId) => {
  const messageEs = [
    '🎉 ¡Bienvenido a PNPtv!',
    '',
    'Para explorar PNPtv, pulsa /menu',
    '',
    'Disfruta todos los beneficios y novedades.'
  ].join('\n');
  const messageEn = [
    '🎉 Welcome to PNPtv!',
    '',
    'To explore PNPtv, press /menu',
    '',
    'Enjoy all the benefits and updates.'
  ].join('\n');
  const lang = (bot.language || 'es').toLowerCase();
  const message = lang === 'en' ? messageEn : messageEs;
  try {
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error enviando bienvenida PNPtv:', error);
  }
};

module.exports.sendPrimeWelcome = sendPrimeWelcome;

/**
 * Main menu handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMenuHandlers = (bot) => {
    // /cristina command: starts AI support chat, message stays in chat (no autodelete)
    bot.command('cristina', async (ctx) => {
      try {
        // Activate AI chat session
        ctx.session.temp = ctx.session.temp || {};
        ctx.session.temp.aiChatActive = true;
        await ctx.saveSession();
        const lang = ctx.session?.language || 'en';
        await ctx.reply(
          lang === 'es'
            ? '🤖 Cristina está lista para ayudarte. Escribe tu pregunta o mensaje.'
            : '🤖 Cristina is ready to help you. Type your question or message.'
        );
      } catch (error) {
        logger.error('Error starting Cristina AI chat:', error);
      }
    });
  // /menu command opens the same menu as /start
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error showing menu:', error);
    }
  });

  // Intercept main menu button actions in group and show redirect message
  const mainMenuActions = [
    'show_subscription_plans',
    'show_profile',
    'show_nearby',
    'show_radio',
    'show_jitsi',
    'show_support',
    'show_settings',
    'admin_panel'
  ];
  mainMenuActions.forEach(action => {
    bot.action(action, async (ctx, next) => {
      const chatType = ctx.chat?.type;
      if (chatType === 'group' || chatType === 'supergroup') {
        try {
          const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'user';
          const botUsername = ctx.botInfo?.username || 'PNPtvbot';

          // Send notification in group
          const groupMsg = `${username} I sent you a private message please check it out! 💬`;
          const sentMessage = await ctx.reply(groupMsg);
          ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 30 * 1000, false);

          // Send private message with link to the feature
          try {
            const pmLink = `https://t.me/${botUsername}?start=${action}`;
            const pmMsg = `You clicked on a menu button in the group! Click the link below to access this feature:\n\n${pmLink}`;
            await ctx.telegram.sendMessage(ctx.from.id, pmMsg);
          } catch (pmError) {
            logger.debug('Could not send private message:', pmError.message);
          }

          return;
        } catch (error) {
          logger.error('Error handling group menu action:', error);
        }
      }
      return next();
    });
  });

  // Live Streams - Coming Soon
  bot.action('show_live', async (ctx) => {
    const lang = ctx.session?.language || 'en';
    await ctx.answerCbQuery(
      lang === 'es' ? '🚧 Próximamente: Transmisiones en Vivo.' : '🚧 Coming Soon: Live Streaming.',
      { show_alert: true }
    );
  });
  bot.action('show_zoom', async (ctx) => {
    const lang = ctx.session?.language || 'en';
    await ctx.answerCbQuery(
      lang === 'es' ? '🚧 Próximamente: Salas Zoom.' : '🚧 Coming soon: Zoom Rooms.',
      { show_alert: true }
    );
  });
    // Locked feature handler for free users
    bot.action('locked_feature', async (ctx) => {
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es'
          ? '🔒 Función solo para usuarios premium. Suscríbete para acceder.'
          : '🔒 Feature for premium users only. Subscribe to unlock.',
        { show_alert: true }
      );
    });
    // Admin panel handler: only superadmins can access role management
    bot.action('admin_panel', async (ctx) => {
      try {
        // PermissionService is required from roleManagement.js
        const PermissionService = require('../admin/../../services/permissionService');
        const showRoleManagement = require('../admin/roleManagement.js').showRoleManagement;
        const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
        if (!isSuperAdmin) {
          await ctx.answerCbQuery('❌ Solo Super Administradores pueden acceder');
          return;
        }
        await showRoleManagement(ctx);
      } catch (error) {
        logger.error('Error in admin panel:', error);
      }
    });
  // Menu command
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error showing menu:', error);
    }
  });

  // Back to main menu action
  bot.action('back_to_main', async (ctx) => {
    try {
      await showMainMenuEdit(ctx);
    } catch (error) {
      logger.error('Error in back to main:', error);
    }
  });

  // Note: show_subscription_plans handler is in payments/index.js

  // Group menu actions have been disabled
  bot.action('group_contact_admin', async (ctx) => {
    logger.info('Group menu actions have been disabled');
    await ctx.answerCbQuery('This feature has been disabled');
  });

  bot.action('group_show_rules', async (ctx) => {
    logger.info('Group menu actions have been disabled');
    await ctx.answerCbQuery('This feature has been disabled');
  });
        '📋 *PNPtv! Community Rules*',
        '',
        '1️⃣ *Respect:* Treat all members with respect and courtesy',
        '',
        '2️⃣ *No Spam:* Avoid spam, unauthorized advertising or repetitive content',
        '',
        '3️⃣ *Privacy:* Do not share personal information of other members without their consent',
        '',
        '4️⃣ *Appropriate Content:* Content must be appropriate for the community',
        '',
        '5️⃣ *No Harassment:* Harassment, bullying or hostile behavior will not be tolerated',
        '',
        '6️⃣ *Bot Usage:* Use the bot privately for personal features (profile, subscriptions, payments)',
        '',
        '⚠️ *Breaking these rules may result in warnings, restrictions or expulsion from the group.*',
        '',
        'Thank you for keeping our community safe and enjoyable! 🙏'
      ].join('\n');

      const message = lang === 'es' ? rulesEs : rulesEn;

      const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

      // Auto-delete menu messages in groups after 2 minutes
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroup) {
        ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 30 * 1000, false);
      }
    } catch (error) {
      logger.error('Error showing group rules:', error);
    }
  });
};

/**
 * Show main menu (new message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const chatType = ctx.chat?.type;
  const user = ctx.session?.user || {};
  const isPremium = user.subscriptionStatus === 'active';
  const isAdmin = user.role === 'admin';

  if (chatType === 'group' || chatType === 'supergroup') {
    await showGroupMenu(ctx);
    return;
  }

  // Show full private chat menu
  await ctx.reply(
    t('mainMenuIntro', lang),
    Markup.inlineKeyboard([
      [
        Markup.button.callback('👑 Suscríbete a PRIME', 'show_subscription_plans'),
        Markup.button.callback(t('myProfile', lang), 'show_profile'),
      ],
      [
        Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
        Markup.button.callback(t('liveStreams', lang), 'show_live'),
      ],
      [
        Markup.button.callback(t('radioMenu', lang), 'show_radio'),
        Markup.button.callback(t('playerMenu', lang), 'show_player'),
      ],
      [
        Markup.button.callback('📹 Video Call Rooms', 'show_jitsi'),
      ],
      [
        Markup.button.callback(t('support', lang), 'show_support'),
        Markup.button.callback(t('settings', lang), 'show_settings'),
      ],
    ]),
  );
};

/**
 * Show limited group menu (for privacy and anti-spam)
 * @param {Context} ctx - Telegraf context
 */
const showGroupMenu = async (ctx) => {
  // Group menu has been disabled
  logger.info('Group menu functionality has been disabled');
};

/**
 * Show main menu (edit existing message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenuEdit = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const user = ctx.session?.user || {};
  const isPremium = user.subscriptionStatus === 'active';
  const isAdmin = user.role === 'admin';

  let menuText = '';
  if (isAdmin) {
    menuText = lang === 'es'
      ? '👑 ¡Bienvenido Admin!\nAcceso total a todas las funciones y panel de administración.'
      : '👑 Welcome Admin!\nFull access to all features and admin panel.';
  } else if (isPremium) {
    menuText = t('welcomeScreenPrime', lang);
  } else {
    menuText = t('welcomeScreenFree', lang);
  }

  function buildButton(label, action, locked) {
    return Markup.button.callback(locked ? `${label} 🔒` : label, locked ? 'locked_feature' : action);
  }

  const buttons = [
    [
      Markup.button.callback('👑 Suscríbete a PRIME', 'show_subscription_plans'),
      Markup.button.callback(t('myProfile', lang), 'show_profile'),
    ],
    [
      Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
      buildButton(t('liveStreams', lang), 'show_live', !isPremium && !isAdmin),
    ],
    [
      Markup.button.callback(t('radioMenu', lang), 'show_radio'),
      buildButton('📹 Video Call Rooms', 'show_jitsi', !isPremium && !isAdmin),
    ],
    [
      Markup.button.callback(t('support', lang), 'show_support'),
    ],
    [
      Markup.button.callback(t('settings', lang), 'show_settings'),
    ],
  ];
  if (isAdmin) {
    buttons.push([Markup.button.callback('🛡️ Admin Panel', 'admin_panel')]);
  }

  try {
    await ctx.editMessageText(
      t('mainMenuIntro', lang),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('👑 Suscríbete a PRIME', 'show_subscription_plans'),
          Markup.button.callback(t('myProfile', lang), 'show_profile'),
        ],
        [
          Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
          Markup.button.callback(t('liveStreams', lang), 'show_live'),
        ],
        [
          Markup.button.callback(t('radioMenu', lang), 'show_radio'),
          Markup.button.callback(t('playerMenu', lang), 'show_player'),
        ],
        [
          Markup.button.callback('📹 Video Call Rooms', 'show_jitsi'),
        ],
        [
          Markup.button.callback(t('support', lang), 'show_support'),
          Markup.button.callback(t('settings', lang), 'show_settings'),
        ],
      ]),
    );
  } catch (error) {
    // If edit fails, send new message
    await showMainMenu(ctx);
  }
};

// Export as default function for consistency with other handlers
module.exports = registerMenuHandlers;

// Also export named functions for direct imports
module.exports.showMainMenu = showMainMenu;
module.exports.showMainMenuEdit = showMainMenuEdit;
module.exports.sendPrimeWelcome = sendPrimeWelcome;
