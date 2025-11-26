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
      // Send DM redirect message
      const redirectMessage = getMessage('GROUP_REDIRECT', lang, {
        username,
        option: lang === 'es' ? 'Menú Principal' : 'Main Menu'
      });

      const deepLink = `https://t.me/${MENU_CONFIG.BOT_USERNAME}?start=menu`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url(
          getMessage('OPEN_BOT_BUTTON', lang),
          deepLink
        )]
      ]);

      // Try to send DM first
      try {
        const dmMessage = getMessage('MAIN_MENU', lang);
        const dmKeyboard = buildMainMenuKeyboard(lang);

        await ctx.telegram.sendMessage(
          ctx.from.id,
          dmMessage,
          {
            parse_mode: 'Markdown',
            ...dmKeyboard
          }
        );

        // DM sent successfully, now send group message
        const sentMessage = await ctx.reply(redirectMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });

        // Delete the group message after 90 seconds (chat cleanup)
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
          } catch (error) {
            // Ignore deletion errors
          }
        }, 90000);

        logger.info(`Menu redirect sent to user ${ctx.from.id} in group ${ctx.chat.id}`);

      } catch (dmError) {
        // User hasn't started bot yet
        const pleaseStartMessage = getMessage('PLEASE_START_BOT', lang);

        const sentMessage = await ctx.reply(pleaseStartMessage, {
          parse_mode: 'Markdown',
          ...keyboard
        });

        // Delete after 90 seconds
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
          } catch (error) {
            // Ignore deletion errors
          }
        }, 90000);

        logger.info(`User ${ctx.from.id} needs to start bot first`);
      }

      return;
    }

    // Private chat - display full menu (same as /start)
    const message = getMessage('MAIN_MENU', lang);
    const keyboard = buildMainMenuKeyboard(lang);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });

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
    const lang = await getUserLanguage(ctx);

    // Acknowledge the callback
    await ctx.answerCbQuery();

    // Parse callback data
    const [prefix, action] = callbackData.split(':');

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

      case 'profile':
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
  const message = lang === 'es'
    ? '📹 *Videollamadas*\n\nAquí puedes programar videollamadas exclusivas.\n\n_Esta función estará disponible pronto._'
    : '📹 *Video Calls*\n\nHere you can schedule exclusive video calls.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
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

async function handleProfile(ctx, lang) {
  const message = lang === 'es'
    ? '👤 *Mi Perfil*\n\nAquí puedes ver y editar tu perfil.\n\n_Esta función estará disponible pronto._'
    : '👤 *My Profile*\n\nHere you can view and edit your profile.\n\n_This feature is coming soon._';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu:back')]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
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

module.exports = {
  handleMenuCommand,
  handleDeepLinkStart,
  handleMenuCallback,
  isGroupChat,
  isTopic3809
};
