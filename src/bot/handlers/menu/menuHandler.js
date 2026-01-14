/**
 * Menu Handler
 * Handles all menu display and navigation
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');
const {
  MENU_CONFIG,
  getMenuOptions,
  getOptionById,
  getOptionTitle,
  generateDeepLink,
  getMessage
} = require('../../../config/menuConfig');
const { detectLanguage } = require('../../../utils/languageDetector');
const { showProfile } = require('../user/profile');

/**
 * Store the last menu message ID per user per chat
 * Format: { chatId: { userId: messageId } }
 */
const lastMenuMessages = {};

/**
 * Require ChatCleanupService for message deletion
 */
const ChatCleanupService = require('../../services/chatCleanupService');

/**
 * Check if message is in a group/supergroup
 */
function isGroupChat(ctx) {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

/**
 * Check if message is in topic 3809
 */
function isTopic3809(ctx) {
  return isGroupChat(ctx) &&
         ctx.message?.message_thread_id === MENU_CONFIG.TOPICS.CONTENT_MENU;
}

/**
 * Get user's language preference
 */
async function getUserLanguage(ctx) {
  // Try to detect from recent messages or user settings
  const detectedLang = await detectLanguage(ctx);
  return detectedLang || ctx.from?.language_code || 'en';
}

/**
 * Build main menu keyboard (for private chat)
 */
function buildMainMenuKeyboard(lang = 'en') {
  const keyboard = [];

  for (const category of Object.values(MENU_CONFIG.MAIN_CATEGORIES)) {
    // Add category as a row header (optional)
    const categoryButtons = [];

    for (const option of category.options) {
      categoryButtons.push(
        Markup.button.callback(
          option.title[lang] || option.title.en,
          option.callback
        )
      );
    }

    // Split into rows of 2 buttons each
    for (let i = 0; i < categoryButtons.length; i += 2) {
      keyboard.push(categoryButtons.slice(i, i + 2));
    }
  }

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Build group menu keyboard (simple vertical layout)
 */
function buildGroupMenuKeyboard(lang = 'en') {
  const buttons = MENU_CONFIG.GROUP_MENU.options.map(option =>
    [Markup.button.callback(
      option.title[lang] || option.title.en,
      option.callback
    )]
  );

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build PRIME members menu keyboard (2-column layout for /start)
 */
function buildPrimeMenuKeyboard(lang = 'en') {
  const buttons = [];

  // Add PRIME menu options (already organized in 2-column rows)
  for (const row of MENU_CONFIG.PRIME_MENU.options) {
    if (Array.isArray(row)) {
      // Row is already a group of options
      buttons.push(
        row.map(option =>
          Markup.button.callback(
            option.title[lang] || option.title.en,
            option.callback
          )
        )
      );
    } else {
      // Single option
      buttons.push([
        Markup.button.callback(
          row.title[lang] || row.title.en,
          row.callback
        )
      ]);
    }
  }

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build topic 3809 menu keyboard
 */
function buildTopic3809MenuKeyboard(lang = 'en') {
  const buttons = MENU_CONFIG.TOPIC_3809_MENU.options.map(option =>
    Markup.button.callback(
      option.title[lang] || option.title.en,
      option.callback
    )
  );

  return Markup.inlineKeyboard([buttons]);
}

/**
 * Build category menu keyboard (shows options within a category)
 */
function buildCategoryMenuKeyboard(categoryId, lang = 'en') {
  const category = MENU_CONFIG.MAIN_CATEGORIES[categoryId.toUpperCase()];
  if (!category) return null;

  const buttons = category.options.map(option =>
    [Markup.button.callback(
      option.title[lang] || option.title.en,
      option.callback
    )]
  );

  // Add back button
  buttons.push([
    Markup.button.callback(
      lang === 'es' ? '⬅️ Volver al Menú' : '⬅️ Back to Menu',
      'menu:back'
    )
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Helper function to delete previous menu message and track the new one
 * Ensures only ONE menu message per user remains (anti-spam)
 */
async function deletePreviousMenuMessage(ctx) {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    // Initialize chat storage if needed
    if (!lastMenuMessages[chatId]) {
      lastMenuMessages[chatId] = {};
    }

    // Delete previous menu message if it exists
    if (lastMenuMessages[chatId][userId]) {
      try {
        await ctx.telegram.deleteMessage(chatId, lastMenuMessages[chatId][userId]);
        logger.info(`Deleted previous menu message (anti-spam) - ${lastMenuMessages[chatId][userId]} for user ${userId} in chat ${chatId}`);
      } catch (error) {
        // Message may have already been deleted, ignore
        logger.debug(`Could not delete previous menu message: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error('Error deleting previous menu message:', error);
  }
}

/**
 * Helper function to store new menu message ID
 */
function storeMenuMessage(ctx, messageId) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  if (!lastMenuMessages[chatId]) {
    lastMenuMessages[chatId] = {};
  }

  lastMenuMessages[chatId][userId] = messageId;
}

/**
 * Handle /menu command
 */
async function handleMenuCommand(ctx) {
  try {
    const lang = await getUserLanguage(ctx);
    const username = ctx.from.username || ctx.from.first_name || 'User';

    // Check if in topic 3809
    if (isTopic3809(ctx)) {
      // Display special menu for topic 3809
      const message = getMessage('TOPIC_3809_MENU', lang);
      const keyboard = buildTopic3809MenuKeyboard(lang);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });

      logger.info(`Topic 3809 menu displayed for user ${ctx.from.id}`);
      return;
    }

    // Check if in group (but not topic 3809)
    if (isGroupChat(ctx)) {
      // Delete previous menu message
      await deletePreviousMenuMessage(ctx);

      // Display group-specific menu in the group
      const groupMenuMessage = lang === 'es'
        ? '🎯 *PNPtv Menu*\n\nSelecciona una opción:'
        : '🎯 *PNPtv Menu*\n\nSelect an option:';

      const groupMenuKeyboard = buildGroupMenuKeyboard(lang);

      const sentMessage = await ctx.reply(groupMenuMessage, {
        parse_mode: 'Markdown',
        ...groupMenuKeyboard
      });

      // Store the menu message ID to delete it later
      storeMenuMessage(ctx, sentMessage.message_id);

      // Schedule auto-delete for menu message (1 minute)
      ChatCleanupService.scheduleMenuMessage(ctx.telegram, sentMessage);

      // Also delete the /menu command message from user
      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Ignore if we can't delete the command message
      }

      logger.info(`Group menu displayed for user ${ctx.from.id} in group ${ctx.chat.id}`);

      return;
    }

    // Private chat - display full menu (same as /start)
    const message = getMessage('MAIN_MENU', lang);
    const keyboard = buildMainMenuKeyboard(lang);

    // Delete previous menu message first (single message rule)
    await deletePreviousMenuMessage(ctx);

    const sentMessage = await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });

    // Store the new menu message ID
    storeMenuMessage(ctx, sentMessage.message_id);

    // Schedule auto-delete for menu message (1 minute)
    ChatCleanupService.scheduleMenuMessage(ctx.telegram, sentMessage);

    logger.info(`Main menu displayed for user ${ctx.from.id} in private chat`);

  } catch (error) {
    logger.error('Error handling menu command:', error);
    const lang = await getUserLanguage(ctx);
    await ctx.reply(
      lang === 'es'
        ? '❌ Error al mostrar el menú. Por favor, intenta de nuevo.'
        : '❌ Error displaying menu. Please try again.'
    );
  }
}

/**
 * Handle deep link start parameters
 */
async function handleDeepLinkStart(ctx) {
  try {
    const startPayload = ctx.startPayload;

    if (!startPayload) {
      // No deep link, show regular menu
      return handleMenuCommand(ctx);
    }

    // Check if it's a menu deep link
    if (startPayload.startsWith('menu_')) {
      const optionId = startPayload.replace('menu_', '');
      const lang = await getUserLanguage(ctx);

      // Get the option
      const option = getOptionById(optionId);
      if (!option) {
        return handleMenuCommand(ctx);
      }

      // Send the option-specific menu
      const message = getMessage('DM_MESSAGE', lang, {
        option: option.title[lang] || option.title.en
      });

      await ctx.reply(message, {
        parse_mode: 'Markdown'
      });

      // Trigger the menu callback
      ctx.callbackQuery = { data: option.callback };
      return handleMenuCallback(ctx);
    }

    // Not a menu deep link, proceed with default behavior
    return handleMenuCommand(ctx);

  } catch (error) {
    logger.error('Error handling deep link start:', error);
    return handleMenuCommand(ctx);
  }
}

/**
 * Handle menu option callbacks
 */
async function handleMenuCallback(ctx) {
  try {
    const callbackData = ctx.callbackQuery?.data || '';
    logger.info(`>>> handleMenuCallback called with data: ${callbackData}`);
    const lang = await getUserLanguage(ctx);

    // Acknowledge the callback
    await ctx.answerCbQuery();

    // Parse callback data
    const [prefix, action] = callbackData.split(':');
    logger.info(`>>> Menu callback parsed: prefix=${prefix}, action=${action}`);

    if (prefix !== 'menu') {
      return;
    }

    // Handle back button
    if (action === 'back') {
      const message = getMessage('MAIN_MENU', lang);
      const keyboard = buildMainMenuKeyboard(lang);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      return;
    }

    // Handle specific menu options
    switch (action) {
      case 'subscribe':
        await handleSubscribeMenu(ctx, lang);
        break;

      case 'prime_content':
        await handlePrimeContent(ctx, lang);
        break;

      case 'subscription_status':
        await handleSubscriptionStatus(ctx, lang);
        break;

      case 'renew':
        await handleRenewMenu(ctx, lang);
        break;

      case 'payment_methods':
        await handlePaymentMethods(ctx, lang);
        break;

      case 'live_streams':
        await handleLiveStreams(ctx, lang);
        break;

      case 'video_calls':
        await handleVideoCalls(ctx, lang);
        break;

      case 'photos':
        await handlePhotos(ctx, lang);
        break;

      case 'videos':
        await handleVideos(ctx, lang);
        break;

      case 'podcasts':
        await handlePodcasts(ctx, lang);
        break;

      case 'join_group':
        await handleJoinGroup(ctx, lang);
        break;

      case 'badges':
        await handleBadges(ctx, lang);
        break;

      case 'leaderboard':
        await handleLeaderboard(ctx, lang);
        break;

      case 'events':
        await handleEvents(ctx, lang);
        break;

      case 'faq':
        await handleFAQ(ctx, lang);
        break;

      case 'support':
        await handleSupport(ctx, lang);
        break;

      case 'cristina_ai':
        await handleCristinaAI(ctx, lang);
        break;

      case 'rules':
        await handleRules(ctx, lang);
        break;

      case 'how_to_use':
        await handleHowToUse(ctx, lang);
        break;

      case 'profile':
        logger.info(`>>> Calling handleProfile for user ${ctx.from.id}`);
        await handleProfile(ctx, lang);
        break;

      case 'notifications':
        await handleNotificationSettings(ctx, lang);
        break;

      case 'language':
        await handleLanguageSettings(ctx, lang);
        break;

      case 'privacy':
        await handlePrivacySettings(ctx, lang);
        break;

      case 'view_plans':
        await handleViewPlans(ctx, lang);
        break;

      case 'vc_rooms':
        await handleVCRooms(ctx, lang);
        break;

      case 'videorama':
        await handleVideorama(ctx, lang);
        break;

      case 'settings':
        await handleSettingsMenu(ctx, lang);
        break;

      default:
        // Coming soon for unimplemented features
        await ctx.editMessageText(
          getMessage('FEATURE_COMING_SOON', lang),
          { parse_mode: 'Markdown' }
        );
    }

    logger.info(`Menu callback handled: ${action} for user ${ctx.from.id}`);

  } catch (error) {
    logger.error('Error handling menu callback:', error);
    try {
      await ctx.answerCbQuery('Error processing request');
    } catch (e) {
      // Ignore
    }
  }
}

// ==========================================
// Menu Option Handlers (Placeholder implementations)
// ==========================================

async function handleSubscribeMenu(ctx, lang) {
  const message = lang === 'es'
    ? '✨ *Suscripción*\n\nAquí puedes suscribirte para acceder a contenido exclusivo.\n\n_Esta función estará disponible pronto._'
    : '✨ *Subscription*\n\nHere you can subscribe to access exclusive content.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handlePrimeContent(ctx, lang) {
  const message = lang === 'es'
    ? '💎 *Contenido PRIME*\n\nAccede a todo nuestro contenido exclusivo de PRIME.\n\n_Esta función estará disponible pronto._'
    : '💎 *PRIME Content*\n\nAccess all our exclusive PRIME content.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleSubscriptionStatus(ctx, lang) {
  const message = lang === 'es'
    ? '📊 *Estado de Suscripción*\n\nAquí puedes ver el estado de tu suscripción.\n\n_Esta función estará disponible pronto._'
    : '📊 *Subscription Status*\n\nHere you can view your subscription status.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleRenewMenu(ctx, lang) {
  const message = lang === 'es'
    ? '🔄 *Renovar Suscripción*\n\nAquí puedes renovar tu suscripción.\n\n_Esta función estará disponible pronto._'
    : '🔄 *Renew Subscription*\n\nHere you can renew your subscription.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handlePaymentMethods(ctx, lang) {
  const message = lang === 'es'
    ? '💳 *Métodos de Pago*\n\nAquí puedes administrar tus métodos de pago.\n\n_Esta función estará disponible pronto._'
    : '💳 *Payment Methods*\n\nHere you can manage your payment methods.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleLiveStreams(ctx, lang) {
  const message = lang === 'es'
    ? '🔴 *Transmisiones en Vivo*\n\nAquí puedes acceder a transmisiones en vivo exclusivas.\n\n_Esta función estará disponible pronto._'
    : '🔴 *Live Streams*\n\nHere you can access exclusive live streams.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleVideoCalls(ctx, lang) {
  const displayName = ctx.from.first_name || 'Guest';
  const videoRoomsUrl = `https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

  const message = lang === 'es'
    ? '📹 *Salas de Videollamadas*\n\nAccede a nuestras salas de videollamadas en vivo.\n\nHaz clic en el botón de abajo para acceder a la sala:'
    : '📹 *Video Call Rooms*\n\nAccess our live video calling rooms.\n\nClick the button below to join the room:';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(lang === 'es' ? '🎥 Entrar a Sala' : '🎥 Join Room', videoRoomsUrl)],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handlePhotos(ctx, lang) {
  const message = lang === 'es'
    ? '📸 *Fotos Exclusivas*\n\nAquí puedes acceder a fotos exclusivas.\n\n_Esta función estará disponible pronto._'
    : '📸 *Exclusive Photos*\n\nHere you can access exclusive photos.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleVideos(ctx, lang) {
  const message = lang === 'es'
    ? '🎥 *Videos Exclusivos*\n\nAquí puedes acceder a videos exclusivos.\n\n_Esta función estará disponible pronto._'
    : '🎥 *Exclusive Videos*\n\nHere you can access exclusive videos.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handlePodcasts(ctx, lang) {
  const message = lang === 'es'
    ? '🎙️ *Podcasts*\n\nAquí puedes acceder a podcasts exclusivos.\n\n_Esta función estará disponible pronto._'
    : '🎙️ *Podcasts*\n\nHere you can access exclusive podcasts.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleJoinGroup(ctx, lang) {
  const groupLink = config.GROUP_INVITE_LINK || 'https://t.me/your_group';

  const message = lang === 'es'
    ? '🌟 *Unirse al Grupo*\n\n¡Únete a nuestra comunidad exclusiva!'
    : '🌟 *Join Group*\n\nJoin our exclusive community!';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(lang === 'es' ? '🚀 Unirse Ahora' : '🚀 Join Now', groupLink)],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleBadges(ctx, lang) {
  const message = lang === 'es'
    ? '🏆 *Tus Insignias*\n\nAquí puedes ver tus insignias ganadas.\n\n_Esta función estará disponible pronto._'
    : '🏆 *Your Badges*\n\nHere you can view your earned badges.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleLeaderboard(ctx, lang) {
  const message = lang === 'es'
    ? '📊 *Tabla de Clasificación*\n\nAquí puedes ver la tabla de clasificación de la comunidad.\n\n_Esta función estará disponible pronto._'
    : '📊 *Leaderboard*\n\nHere you can view the community leaderboard.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleEvents(ctx, lang) {
  const message = lang === 'es'
    ? '🎉 *Eventos*\n\nAquí puedes ver los próximos eventos.\n\n_Esta función estará disponible pronto._'
    : '🎉 *Events*\n\nHere you can view upcoming events.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleFAQ(ctx, lang) {
  const message = lang === 'es'
    ? '❓ *Preguntas Frecuentes*\n\nAquí puedes encontrar respuestas a preguntas frecuentes.\n\n_Esta función estará disponible pronto._'
    : '❓ *FAQ*\n\nHere you can find answers to frequently asked questions.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleSupport(ctx, lang) {
  const message = lang === 'es'
    ? '🆘 *Contactar Soporte*\n\nAquí puedes contactar a nuestro equipo de soporte.\n\n_Esta función estará disponible pronto._'
    : '🆘 *Contact Support*\n\nHere you can contact our support team.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleCristinaAI(ctx, lang) {
  const message = lang === 'es'
    ? '🤖 *Asistente IA Cristina*\n\nHola! Soy Cristina, tu asistente de IA.\n\nUsa el comando /cristina para hablar conmigo en cualquier momento.'
    : '🤖 *Cristina AI Assistant*\n\nHi! I\'m Cristina, your AI assistant.\n\nUse the /cristina command to talk to me anytime.';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleRules(ctx, lang) {
  // Import moderation config to get rules
  const MODERATION_CONFIG = require('../../../config/moderationConfig');

  // Get rules in user's language (keys are lowercase: 'en', 'es')
  const rules = MODERATION_CONFIG.RULES[lang] || MODERATION_CONFIG.RULES.en;

  // Format rules as numbered list
  const rulesText = `📜 *Community Rules*\n\n${rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n\n')}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(rulesText, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleHowToUse(ctx, lang) {
  const message = lang === 'es'
    ? '📖 *¡Cómo usar PNPtv!*\n\nVisita nuestro centro de ayuda para aprender más sobre cómo utilizar todas las características de PNPtv.'
    : '📖 *How to use PNPtv!*\n\nVisit our community features guide to learn more about using PNPtv.';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(lang === 'es' ? '📖 Centro de Ayuda' : '📖 Community Features', 'https://pnptv.app/community-features')],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleProfile(ctx, lang) {
  // Call the actual profile feature handler
  await showProfile(ctx, ctx.from.id, true, true);
}

async function handleNotificationSettings(ctx, lang) {
  const message = lang === 'es'
    ? '🔔 *Configuración de Notificaciones*\n\nAquí puedes administrar tus preferencias de notificaciones.\n\n_Esta función estará disponible pronto._'
    : '🔔 *Notification Settings*\n\nHere you can manage your notification preferences.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleLanguageSettings(ctx, lang) {
  const message = lang === 'es'
    ? '🌍 *Idioma / Language*\n\nSelecciona tu idioma preferido:'
    : '🌍 *Language / Idioma*\n\nSelect your preferred language:';

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🇺🇸 English', 'lang:en'),
      Markup.button.callback('🇪🇸 Español', 'lang:es')
    ],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handlePrivacySettings(ctx, lang) {
  const message = lang === 'es'
    ? '🔒 *Configuración de Privacidad*\n\nAquí puedes administrar tu configuración de privacidad.\n\n_Esta función estará disponible pronto._'
    : '🔒 *Privacy Settings*\n\nHere you can manage your privacy settings.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleVCRooms(ctx, lang) {
  const message = lang === 'es'
    ? '🎥 *Salas VC PNPtv*\n\n' +
      '*PNPtv Main Room*\n' +
      '✨ Sala segura y privada\n' +
      '🔐 Auto-alojada (self-hosted)\n' +
      '📹 Grabación de pantalla deshabilitada\n' +
      '✅ Usuarios verificados por edad\n' +
      '👥 Videollamadas de grupo en vivo\n\n' +
      '*PNPtv Hangouts*\n' +
      '🎭 Salas temáticas de networking\n' +
      '💬 Interacciones sociales enfocadas\n' +
      '🎯 Conexiones auténticas\n' +
      '🔒 Privacidad garantizada\n\n' +
      '_Selecciona una sala para acceder:_'
    : '🎥 *PNPtv VC Rooms*\n\n' +
      '*PNPtv Main Room*\n' +
      '✨ Safe and private room\n' +
      '🔐 Self-hosted infrastructure\n' +
      '📹 Screen recording disabled\n' +
      '✅ Age-verified users\n' +
      '👥 Live group video calls\n\n' +
      '*PNPtv Hangouts*\n' +
      '🎭 Themed networking rooms\n' +
      '💬 Social interactions\n' +
      '🎯 Authentic connections\n' +
      '🔒 Privacy guaranteed\n\n' +
      '_Select a room to join:_';

  const displayName = ctx.from.first_name || 'Guest';
  const mainRoomUrl = `https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;
  const hangoutsUrl = `https://meet.jit.si/pnptv-hangouts#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.url(lang === 'es' ? '🎥 Main Room' : '🎥 Main Room', mainRoomUrl),
      Markup.button.url(lang === 'es' ? '🎭 Hangouts' : '🎭 Hangouts', hangoutsUrl)
    ],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleVideorama(ctx, lang) {
  const message = lang === 'es'
    ? '🎬 *PNPtv Videorama*\n\n' +
      'Accede a Videorama y reproduce la playlist completa (auto-secuencial) con descripciones.\n\n' +
      'Pulsa el botón de abajo:'
    : '🎬 *PNPtv Videorama*\n\n' +
      'Open Videorama and play the full sequence (auto-advance) with descriptions.\n\n' +
      'Tap the button below:';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(
      lang === 'es' ? '🎬 Abrir Videorama' : '🎬 Open Videorama',
      (() => {
        const tg = ctx.from?.username ? `@${ctx.from.username}` : '';
        return tg ? `https://pnptv.app/videorama-app/?tg=${encodeURIComponent(tg)}` : 'https://pnptv.app/videorama-app/';
      })()
    )],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

async function handleSettingsMenu(ctx, lang) {
  const message = lang === 'es'
    ? '⚙️ *Configuración*\n\n' +
      'Accede a tus configuraciones personales en el bot.'
    : '⚙️ *Settings*\n\n' +
      'Access your personal settings in the bot.';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(
      lang === 'es' ? '⚙️ Abrir Configuración' : '⚙️ Open Settings',
      `https://t.me/${MENU_CONFIG.BOT_USERNAME}`
    )],
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

module.exports = {
  handleMenuCommand,
  handleDeepLinkStart,
  handleMenuCallback,
  isGroupChat,
  isTopic3809
};
