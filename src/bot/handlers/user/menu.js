const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');
const PermissionService = require('../../services/permissionService');

/**
 * Sanitize text for Telegram Markdown to prevent parsing errors
 * Ensures backticks are properly matched and no newlines inside monospace
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
const sanitizeMarkdown = (text) => {
  if (!text) return '';
  // Replace any backtick followed immediately by newline with backtick + space + newline
  // This prevents Telegram from failing to find the end of monospace entity
  return text.replace(/`\n/g, '` \n').replace(/\n`/g, '\n `');
};

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

  // Special topic IDs for Live & Radio updates
  const LIVE_RADIO_TOPIC_ID = 3809;
  const PRIME_CHAT_ID = -1003291737499;

  // /menu command opens the same menu as /start
  bot.command('menu', async (ctx) => {
    try {
      const chatId = ctx.chat?.id;
      const topicId = ctx.message?.message_thread_id;
      
      // Special handling for Live & Radio topic
      if (chatId === PRIME_CHAT_ID && topicId === LIVE_RADIO_TOPIC_ID) {
        await showLiveRadioTopicMenu(ctx);
        return;
      }
      
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

  // Bloquear Live Streams y mostrar "Coming soon"
  bot.action('show_live', async (ctx) => {
    const lang = ctx.session?.language || 'en';
    await ctx.answerCbQuery(
      lang === 'es' ? '🚧 Próximamente: Transmisiones en Vivo.' : '🚧 Coming Soon: Live Streaming.',
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

    // Already PRIME handler
    bot.action('already_prime', async (ctx) => {
      await ctx.answerCbQuery('✅ You are already a PRIME member! Enjoy all features.', { show_alert: true });
    });

    // Members Area handler
    bot.action('show_members_area', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const message = 
          '`🧑‍💼  Members Area`\n\n' +
          'Welcome to the **PRIME Members Area**! 💎\n\n' +
          'You have exclusive access to:\n\n' +
          '**Available Now:**\n' +
          '• 📹 Full-length Videos\n' +
          '• 📍 Nearby Members\n' +
          '• 👤 Community Profiles\n' +
          '• 🎙️ Radio & Podcasts\n\n' +
          '**Coming Soon:**\n' +
          '• 📞 Video Calls with Performers\n' +
          '• 🎬 Live Streams\n' +
          '• 🎉 Exclusive Events\n\n' +
          '`Enjoy being PRIME! 💜`';

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📹 Watch Videos', 'members_videos')],
          [Markup.button.callback('📍 Who Is Nearby?', 'show_nearby')],
          [Markup.button.callback('🎙️ Radio & Podcasts', 'show_radio')],
          [Markup.button.callback('🔙 Back to Menu', 'back_to_main')],
        ]);

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } catch (error) {
        logger.error('Error showing members area:', error);
      }
    });

    // Members videos handler (placeholder)
    bot.action('members_videos', async (ctx) => {
      await ctx.answerCbQuery('🎬 Videos section coming soon!', { show_alert: true });
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
};

/**
 * Get the effective view mode for admin preview
 * @param {Context} ctx - Telegraf context
 * @returns {Object} { isPremium, isAdmin, viewMode }
 */
const getEffectiveViewMode = (ctx) => {
  const user = ctx.session?.user || {};
  const userId = ctx.from?.id;
  const actualIsAdmin = user.role === 'admin' || PermissionService.isEnvSuperAdmin(userId) || PermissionService.isEnvAdmin(userId);
  const actualIsPremium = user.subscriptionStatus === 'active';

  // Check if admin has set a view mode
  const adminViewMode = ctx.session?.adminViewMode;

  if (actualIsAdmin && adminViewMode) {
    // Admin is previewing as a specific user type
    return {
      isPremium: adminViewMode === 'prime',
      isAdmin: false, // Don't show admin features when previewing
      viewMode: adminViewMode,
      isPreviewMode: true,
      actualIsAdmin: true
    };
  }

  return {
    isPremium: actualIsPremium,
    isAdmin: actualIsAdmin,
    viewMode: null,
    isPreviewMode: false,
    actualIsAdmin: actualIsAdmin
  };
};

/**
 * Show main menu (new message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const chatType = ctx.chat?.type;
  const user = ctx.session?.user || {};
  const username = ctx.from?.username || ctx.from?.first_name || 'Member';

  if (chatType === 'group' || chatType === 'supergroup') {
    await showGroupMenu(ctx);
    return;
  }

  // Get effective view mode (handles admin preview)
  const viewState = getEffectiveViewMode(ctx);
  const { isPremium, isAdmin, isPreviewMode, viewMode, actualIsAdmin } = viewState;

  let menuText;
  let keyboard;

  const creatorBtnText = lang === 'es' ? '🎬 ¡Sé Creador! - Próximamente' : '🎬 Be a Creator! - Coming Soon';

  // Add preview mode indicator for admins
  let previewBanner = '';
  if (isPreviewMode) {
    const modeLabel = viewMode === 'prime'
      ? (lang === 'es' ? '👁️ VISTA PRIME' : '👁️ PRIME VIEW')
      : (lang === 'es' ? '👁️ VISTA FREE' : '👁️ FREE VIEW');
    previewBanner = `\`${modeLabel}\`\n\n`;
  }

  // Build keyboard buttons array
  let buttons = [];

  if (isPremium || isAdmin) {
    // PRIME MEMBER VERSION
    menuText = previewBanner + (lang === 'es'
      ? '`🎬 ¡Eres PRIME!`\n\n' +
        '¡Gracias por ser PRIME, papi! 🔥\n\n' +
        'Pulsa **Área de Miembros** y disfruta todo lo que hemos preparado para ti — videos, Nearby, hangouts, lives, shows, y más.\n\n' +
        '**Cristina**, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.\n\n' +
        '`¡Eso está muy hot! 🔥`'
      : '`🎬 You are PRIME!`\n\n' +
        'Thank you for being PRIME, papi! 🔥\n\n' +
        'Hit **Members Area** and enjoy everything we\'ve prepared for you — videos, Nearby, hangouts, lives, shows, and more.\n\n' +
        '**Cristina**, our AI assistant, is here to guide you and answer questions.\n\n' +
        '`That\'s so hot! 🔥`');

    buttons = [
      [
        Markup.button.callback('💎 PRIME ✓', 'already_prime'),
        Markup.button.callback(lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile', 'show_profile'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who Is Nearby?', 'show_nearby'),
        Markup.button.callback(lang === 'es' ? '🧑‍💼 Área Miembros' : '🧑‍💼 Members Area', 'show_members_area'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '🆘 Ayuda' : '🆘 Help', 'show_support'),
        Markup.button.callback(lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings', 'show_settings'),
      ],
      [
        Markup.button.callback(creatorBtnText, 'creator_coming_soon'),
      ],
    ];
  } else {
    // FREE MEMBER VERSION
    menuText = previewBanner + (lang === 'es'
      ? '`🎬 ¡Bienvenido a PNPtv!`\n\n' +
        `@${username} ¡nos encanta tenerte en la Comunidad PNPtv! 💜\n\n` +
        'Pulsa **Desbloquear PRIME** para más diversión — videos completos, lives, hangouts, Nearby, y todas las funciones de miembro.\n\n' +
        '**Cristina**, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.\n\n' +
        '`¡Desbloquea la diversión! 🔓`'
      : '`🎬 Welcome to PNPtv!`\n\n' +
        `@${username} we love having you in the PNPtv Community! 💜\n\n` +
        'Hit **Unlock PRIME** to get even more cloudy fun — full-length videos, lives, hangouts, Nearby, and all member features.\n\n' +
        '**Cristina**, our AI assistant, is here to guide you and answer questions.\n\n' +
        '`Unlock the fun! 🔓`');

    buttons = [
      [
        Markup.button.callback(lang === 'es' ? '🔓 Desbloquear PRIME' : '🔓 Unlock PRIME', 'show_subscription_plans'),
        Markup.button.callback(lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile', 'show_profile'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who Is Nearby?', 'show_nearby'),
        Markup.button.callback(lang === 'es' ? '🧑‍💼 Área Miembros 🔒' : '🧑‍💼 Members Area 🔒', 'locked_feature'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '🆘 Ayuda' : '🆘 Help', 'show_support'),
        Markup.button.callback(lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings', 'show_settings'),
      ],
      [
        Markup.button.callback(creatorBtnText, 'creator_coming_soon'),
      ],
    ];
  }

  // Add exit preview button if in preview mode
  if (isPreviewMode && actualIsAdmin) {
    buttons.push([
      Markup.button.callback(lang === 'es' ? '🔙 Salir Vista Previa' : '🔙 Exit Preview', 'admin_exit_preview'),
    ]);
  }

  keyboard = Markup.inlineKeyboard(buttons);

  try {
    await ctx.reply(sanitizeMarkdown(menuText), {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    // Fallback to plain text if Markdown parsing fails
    logger.warn('Markdown parsing failed in showMainMenu, falling back to plain text:', error.message);
    await ctx.reply(menuText.replace(/`/g, '').replace(/\*\*/g, ''), keyboard);
  }
};

/**
 * Show limited group menu (for privacy and anti-spam)
 * Redirects user to private chat for full menu
 * @param {Context} ctx - Telegraf context
 */
const showGroupMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'friend';
  const botUsername = ctx.botInfo?.username || 'PNPtvbot';

  const message = lang === 'es'
    ? `👋 ¡Hola ${username}!\n\n` +
      `El menú completo está disponible en nuestro chat privado.\n\n` +
      `Presiona el botón para abrirlo 👇`
    : `👋 Hey ${username}!\n\n` +
      `The full menu is available in our private chat.\n\n` +
      `Tap the button to open it 👇`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(
      lang === 'es' ? '💬 Abrir Chat Privado' : '💬 Open Private Chat',
      `https://t.me/${botUsername}?start=menu`
    )]
  ]);

  try {
    await ctx.reply(message, keyboard);
    logger.info('Group menu redirect sent', { userId: ctx.from?.id, chatId: ctx.chat?.id });
  } catch (error) {
    logger.error('Error sending group menu redirect:', error);
  }
};

/**
 * Show main menu (edit existing message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenuEdit = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const user = ctx.session?.user || {};
  const username = ctx.from?.username || ctx.from?.first_name || 'Member';

  // Get effective view mode (handles admin preview)
  const viewState = getEffectiveViewMode(ctx);
  const { isPremium, isAdmin, isPreviewMode, viewMode, actualIsAdmin } = viewState;

  let menuText;
  let buttons = [];

  const creatorBtnText = lang === 'es' ? '🎬 ¡Sé Creador! - Próximamente' : '🎬 Be a Creator! - Coming Soon';

  // Add preview mode indicator for admins
  let previewBanner = '';
  if (isPreviewMode) {
    const modeLabel = viewMode === 'prime'
      ? (lang === 'es' ? '👁️ VISTA PRIME' : '👁️ PRIME VIEW')
      : (lang === 'es' ? '👁️ VISTA FREE' : '👁️ FREE VIEW');
    previewBanner = `\`${modeLabel}\`\n\n`;
  }

  if (isPremium || isAdmin) {
    // PRIME MEMBER VERSION
    menuText = previewBanner + (lang === 'es'
      ? '`🎬 ¡Eres PRIME!`\n\n' +
        '¡Gracias por ser PRIME, papi! 🔥\n\n' +
        'Pulsa **Área de Miembros** y disfruta todo lo que hemos preparado para ti — videos, Nearby, hangouts, lives, shows, y más.\n\n' +
        '**Cristina**, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.\n\n' +
        '`¡Eso está muy hot! 🔥`'
      : '`🎬 You are PRIME!`\n\n' +
        'Thank you for being PRIME, papi! 🔥\n\n' +
        'Hit **Members Area** and enjoy everything we\'ve prepared for you — videos, Nearby, hangouts, lives, shows, and more.\n\n' +
        '**Cristina**, our AI assistant, is here to guide you and answer questions.\n\n' +
        '`That\'s so hot! 🔥`');

    buttons = [
      [
        Markup.button.callback('💎 PRIME ✓', 'already_prime'),
        Markup.button.callback(lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile', 'show_profile'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who Is Nearby?', 'show_nearby'),
        Markup.button.callback(lang === 'es' ? '🧑‍💼 Área Miembros' : '🧑‍💼 Members Area', 'show_members_area'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '🆘 Ayuda' : '🆘 Help', 'show_support'),
        Markup.button.callback(lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings', 'show_settings'),
      ],
      [
        Markup.button.callback(creatorBtnText, 'creator_coming_soon'),
      ],
    ];
  } else {
    // FREE MEMBER VERSION
    menuText = previewBanner + (lang === 'es'
      ? '`🎬 ¡Bienvenido a PNPtv!`\n\n' +
        `@${username} ¡nos encanta tenerte en la Comunidad PNPtv! 💜\n\n` +
        'Pulsa **Desbloquear PRIME** para más diversión — videos completos, lives, hangouts, Nearby, y todas las funciones de miembro.\n\n' +
        '**Cristina**, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.\n\n' +
        '`¡Desbloquea la diversión! 🔓`'
      : '`🎬 Welcome to PNPtv!`\n\n' +
        `@${username} we love having you in the PNPtv Community! 💜\n\n` +
        'Hit **Unlock PRIME** to get even more cloudy fun — full-length videos, lives, hangouts, Nearby, and all member features.\n\n' +
        '**Cristina**, our AI assistant, is here to guide you and answer questions.\n\n' +
        '`Unlock the fun! 🔓`');

    buttons = [
      [
        Markup.button.callback(lang === 'es' ? '🔓 Desbloquear PRIME' : '🔓 Unlock PRIME', 'show_subscription_plans'),
        Markup.button.callback(lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile', 'show_profile'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who Is Nearby?', 'show_nearby'),
        Markup.button.callback(lang === 'es' ? '🧑‍💼 Área Miembros 🔒' : '🧑‍💼 Members Area 🔒', 'locked_feature'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '🆘 Ayuda' : '🆘 Help', 'show_support'),
        Markup.button.callback(lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings', 'show_settings'),
      ],
      [
        Markup.button.callback(creatorBtnText, 'creator_coming_soon'),
      ],
    ];
  }

  // Add exit preview button if in preview mode
  if (isPreviewMode && actualIsAdmin) {
    buttons.push([
      Markup.button.callback(lang === 'es' ? '🔙 Salir Vista Previa' : '🔙 Exit Preview', 'admin_exit_preview'),
    ]);
  }

  const keyboard = Markup.inlineKeyboard(buttons);

  try {
    await ctx.editMessageText(sanitizeMarkdown(menuText), {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    // If edit fails due to Markdown, try plain text; otherwise send new message
    logger.warn('Error in showMainMenuEdit:', error.message);
    try {
      await ctx.editMessageText(menuText.replace(/`/g, '').replace(/\*\*/g, ''), keyboard);
    } catch {
      await showMainMenu(ctx);
    }
  }
};

/**
 * Show special menu for Live & Radio topic
 * Shows subscription invite for free users or quick links for PRIME members
 */
const showLiveRadioTopicMenu = async (ctx) => {
  const user = ctx.session?.user || {};
  const isPremium = user.subscriptionStatus === 'active';
  const userId = ctx.from?.id;
  const isAdmin = user.role === 'admin' || PermissionService.isEnvSuperAdmin(userId) || PermissionService.isEnvAdmin(userId);
  const firstName = ctx.from?.first_name || 'friend';
  const botUsername = ctx.botInfo?.username || 'PNPtvbot';

  let menuText;
  let keyboard;

  if (isPremium || isAdmin) {
    // PRIME member - show quick links
    menuText = 
      '`📻 LIVE & RADIO HUB 🎙️`\n\n' +
      `Hey ${firstName}! 🔥\n\n` +
      'This is where all the action happens! Shows, calls, radio updates — right here.\n\n' +
      '**Quick Access:**\n' +
      '• 📻 Radio — 24/7 cloudy beats\n' +
      '• 🎥 Salas 24/7 — Community video rooms\n' +
      '• 🎬 Live Shows — Performers streaming\n\n' +
      '`Stay tuned papi! 🎧`';

    keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url('📻 Radio', `https://t.me/${botUsername}?start=show_radio`),
        Markup.button.url('🎥 Salas 24/7', `https://t.me/${botUsername}?start=hangouts_join_main`),
      ],
      [
        Markup.button.url('🎬 Live Shows', `https://t.me/${botUsername}?start=show_live`),
        Markup.button.url('📍 Nearby', `https://t.me/${botUsername}?start=show_nearby`),
      ],
      [
        Markup.button.url('💬 Full Menu', `https://t.me/${botUsername}?start=menu`),
      ],
    ]);
  } else {
    // FREE user - show subscription invite
    menuText = 
      '`🔒 PRIME MEMBERS ONLY`\n\n' +
      `Hey ${firstName}! 👋\n\n` +
      'This topic is for **PRIME members** to get live updates on shows, calls & radio!\n\n' +
      '**With PRIME you get:**\n' +
      '• 📻 24/7 Radio access\n' +
      '• 🎥 Join video hangouts\n' +
      '• 🎬 Watch live performer shows\n' +
      '• 📍 Find nearby cloudy papis\n' +
      '• 📹 Full-length videos\n\n' +
      '`Unlock the fun! 🔓`';

    keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url('💎 Unlock PRIME', `https://t.me/${botUsername}?start=show_subscription_plans`),
      ],
      [
        Markup.button.url('❓ Learn More', `https://t.me/${botUsername}?start=show_support`),
      ],
    ]);
  }

  await ctx.reply(menuText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
};

/**
 * Send notification to Live & Radio topic about new events
 * @param {Telegram} telegram - Telegram instance
 * @param {string} eventType - Type of event: 'radio_show', 'hangout', 'live_stream'
 * @param {object} eventData - Event details { title, host, description, link }
 */
const notifyLiveRadioTopic = async (telegram, eventType, eventData) => {
  const LIVE_RADIO_TOPIC_ID = 3809;
  const PRIME_CHAT_ID = -1003291737499;

  let emoji, eventTitle;
  switch (eventType) {
    case 'radio_show':
      emoji = '📻';
      eventTitle = 'RADIO SHOW';
      break;
    case 'hangout':
      emoji = '🎥';
      eventTitle = 'VIDEO HANGOUT';
      break;
    case 'live_stream':
      emoji = '🎬';
      eventTitle = 'LIVE SHOW';
      break;
    default:
      emoji = '🔔';
      eventTitle = 'NEW EVENT';
  }

  const message = 
    '```\n' +
    '──────────────────────────────┐\n' +
    `  ${emoji} ${eventTitle} NOW! ${emoji}  \n` +
    '──────────────────────────────┘\n' +
    '```\n\n' +
    `🔥 **${eventData.title || 'Something hot is happening!'}**\n\n` +
    (eventData.host ? `👤 Host: ${eventData.host}\n\n` : '') +
    (eventData.description ? `${eventData.description}\n\n` : '') +
    '```\n' +
    '┌─────────────────────────┐\n' +
    '│   Join now papi! 🔥    │\n' +
    '└─────────────────────────┘\n' +
    '```';

  let keyboard;
  if (eventData.link) {
    keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🚀 Join Now', eventData.link)]
    ]);
  }

  try {
    await telegram.sendMessage(PRIME_CHAT_ID, message, {
      message_thread_id: LIVE_RADIO_TOPIC_ID,
      parse_mode: 'Markdown',
      ...keyboard
    });
    logger.info('Live/Radio topic notification sent', { eventType, title: eventData.title });
  } catch (error) {
    logger.error('Error sending Live/Radio topic notification:', error);
  }
};

// Export as default function for consistency with other handlers
module.exports = registerMenuHandlers;

// Also export named functions for direct imports
module.exports.showMainMenu = showMainMenu;
module.exports.showMainMenuEdit = showMainMenuEdit;
module.exports.sendPrimeWelcome = sendPrimeWelcome;
module.exports.showLiveRadioTopicMenu = showLiveRadioTopicMenu;
module.exports.notifyLiveRadioTopic = notifyLiveRadioTopic;
