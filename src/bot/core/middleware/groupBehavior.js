const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');
const PermissionService = require('../../services/permissionService');

const GROUP_ID = process.env.GROUP_ID;
const PRIME_CHANNEL_ID = process.env.PRIME_CHANNEL_ID;
const NOTIFICATIONS_TOPIC_ID = parseInt(process.env.NOTIFICATIONS_TOPIC_ID || '10682', 10);
const AUTO_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes

// Cache valid topic IDs per chat to avoid repeated failed attempts
const validTopicsPerChat = {};

/**
 * PRIME Channel Silent Redirect Middleware
 * Makes PRIME channel 100% clean - NO bot messages at all
 * Silently redirects ALL user interactions to private chat
 */
function primeChannelSilentRedirectMiddleware() {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    // Only apply to PRIME channel
    if (!isGroup || !PRIME_CHANNEL_ID || chatId !== PRIME_CHANNEL_ID) {
      return next();
    }

    const userId = ctx.from?.id;
    const isAdmin = userId && (
      PermissionService.isEnvSuperAdmin(userId) ||
      PermissionService.isEnvAdmin(userId)
    );

    // Admins can use bot normally in PRIME channel
    if (isAdmin) {
      return next();
    }

    // BLOCK ALL BOT RESPONSES IN PRIME CHANNEL
    // Override ctx.reply to silently block any message
    const originalReply = ctx.reply?.bind(ctx);
    ctx.reply = async () => {
      logger.debug('Blocked bot reply in PRIME channel', { chatId, userId });
      return null; // Silently block
    };

    // Override ctx.replyWithMarkdown
    ctx.replyWithMarkdown = async () => null;
    ctx.replyWithHTML = async () => null;
    ctx.replyWithPhoto = async () => null;
    ctx.replyWithVideo = async () => null;
    ctx.replyWithDocument = async () => null;
    ctx.replyWithAudio = async () => null;
    ctx.replyWithVoice = async () => null;
    ctx.replyWithSticker = async () => null;
    ctx.replyWithAnimation = async () => null;

    // Override editMessageText to block edits
    const originalEditMessageText = ctx.editMessageText?.bind(ctx);
    ctx.editMessageText = async () => {
      logger.debug('Blocked bot edit in PRIME channel', { chatId, userId });
      return null;
    };

    // Store original sendMessage to use for private messages
    const originalSendMessage = ctx.telegram.sendMessage.bind(ctx.telegram);

    // Override ctx.telegram.sendMessage to block messages TO the PRIME channel
    ctx.telegram.sendMessage = async (targetChatId, text, extra = {}) => {
      const targetChatIdStr = targetChatId?.toString();
      // Block messages to PRIME channel, allow to other chats
      if (targetChatIdStr === PRIME_CHANNEL_ID) {
        logger.debug('Blocked sendMessage to PRIME channel', { targetChatId });
        return null;
      }
      return originalSendMessage(targetChatId, text, extra);
    };

    // Check if this is any user interaction
    const messageText = ctx.message?.text || '';
    const isCommand = messageText.startsWith('/');
    const isCallback = ctx.callbackQuery;
    const isAnyMessage = ctx.message;

    // Delete user's message silently if it's a command or bot mention
    if (ctx.message?.message_id && (isCommand || messageText.includes('@'))) {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        logger.debug('Could not delete user message in PRIME channel:', error.message);
      }
    }

    // Answer callback silently if it's a callback query
    if (isCallback) {
      try {
        await ctx.answerCbQuery();
      } catch (error) {
        logger.debug('Could not answer callback in PRIME channel:', error.message);
      }
    }

    // Only send private redirect for commands/callbacks (not every message)
    if (isCommand || isCallback) {
      const userLang = ctx.session?.language || ctx.from?.language_code || 'en';
      const isSpanish = userLang.startsWith('es');
      const botUsername = ctx.botInfo?.username || 'PNPLatinoTV_bot';

      // Send private message to user redirecting them to bot
      try {
        const privateMessage = isSpanish
          ? `👋 ¡Hola! Para usar el menú y todas las funciones del bot, por favor usa nuestro chat privado.\n\n👉 Toca aquí: @${botUsername}`
          : `👋 Hi! To use the menu and all bot features, please use our private chat.\n\n👉 Tap here: @${botUsername}`;

        await originalSendMessage(userId, privateMessage);
        logger.info('User silently redirected from PRIME channel to private chat', { userId, chatId });
      } catch (error) {
        // User might have blocked the bot or never started it
        logger.debug('Could not send private redirect message:', error.message);
      }
    }

    // Don't proceed with normal handler chain - channel stays 100% clean
    return;
  };
}

/**
 * Group Behavior Middleware
 * Routes messages to valid topics only. Falls back to main chat if topic doesn't exist.
 */
function groupBehaviorMiddleware() {
  return async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const chatId = ctx.chat?.id;
    const chatIdStr = chatId?.toString();

    // Only apply to configured group
    if (!isGroup || (GROUP_ID && chatIdStr !== GROUP_ID)) {
      return next();
    }

    // Store original reply and sendMessage functions
    const originalReply = ctx.reply.bind(ctx);
    const originalSendMessage = ctx.telegram.sendMessage.bind(ctx.telegram);

    // Check if user is admin (admins' messages not redirected)
    const userId = ctx.from?.id;
    const isAdmin = userId && (
      PermissionService.isEnvSuperAdmin(userId) ||
      PermissionService.isEnvAdmin(userId)
    );

    // Determine if we should use a topic ID
    const shouldUseTopic = !isAdmin && NOTIFICATIONS_TOPIC_ID &&
      (validTopicsPerChat[chatId] === undefined || validTopicsPerChat[chatId] === true);

    const incomingText = (ctx.message?.text || '').toLowerCase();
    const isMenuCommand = incomingText.startsWith('/menu');

    // Override ctx.reply to route to notifications topic
    ctx.reply = async (text, extra = {}) => {
      // /menu should be visible in the same place it was invoked (main chat or current topic)
      if (isMenuCommand) {
        if (ctx.message?.message_thread_id && !extra.message_thread_id) {
          extra.message_thread_id = ctx.message.message_thread_id;
        }
      }
      // Only add topic ID if we haven't determined it doesn't exist
      if (!isMenuCommand && shouldUseTopic && !extra.message_thread_id) {
        extra.message_thread_id = NOTIFICATIONS_TOPIC_ID;
      }

      try {
        const message = await originalReply(text, extra);

        // Mark topic as valid for this chat
        if (shouldUseTopic && validTopicsPerChat[chatId] === undefined) {
          validTopicsPerChat[chatId] = true;
        }

        // Schedule deletion after 3 minutes (keep /menu longer)
        if (message) {
          ChatCleanupService.scheduleDelete(
            ctx.telegram,
            chatId,
            message.message_id,
            'group-bot-behavior',
            isMenuCommand ? 15 * 60 * 1000 : AUTO_DELETE_DELAY
          );

          logger.debug('Bot message sent and scheduled for deletion', {
            chatId,
            messageId: message.message_id,
            topicId: extra.message_thread_id || 'main',
            deleteIn: isMenuCommand ? '15 minutes' : '3 minutes',
          });
        }

        return message;
      } catch (error) {
        // If topic not found, mark it as invalid and retry without topic
        if (error.description && error.description.includes('message thread not found')) {
          logger.info('Topic does not exist, marking as invalid and using main chat', {
            chatId,
            topicId: NOTIFICATIONS_TOPIC_ID,
          });

          validTopicsPerChat[chatId] = false;
          extra.message_thread_id = undefined;

          const message = await originalReply(text, extra);

          if (message) {
            ChatCleanupService.scheduleDelete(
              ctx.telegram,
              chatId,
              message.message_id,
              'group-bot-behavior',
              AUTO_DELETE_DELAY
            );
          }

          return message;
        }
        throw error;
      }
    };

    // Override ctx.telegram.sendMessage for groups
    ctx.telegram.sendMessage = async (chatId, text, extra = {}) => {
      const chatIdStr = chatId.toString();
      const isTargetGroup = GROUP_ID ? chatIdStr === GROUP_ID : chatIdStr.startsWith('-');
      const shouldUseTopic = isTargetGroup && !isAdmin && NOTIFICATIONS_TOPIC_ID &&
        (validTopicsPerChat[chatId] === undefined || validTopicsPerChat[chatId] === true);

      // Only add topic ID if we haven't determined it doesn't exist
      if (shouldUseTopic && !extra.message_thread_id) {
        extra.message_thread_id = NOTIFICATIONS_TOPIC_ID;
      }

      try {
        const message = await originalSendMessage(chatId, text, extra);

        // Mark topic as valid for this chat
        if (shouldUseTopic && validTopicsPerChat[chatId] === undefined) {
          validTopicsPerChat[chatId] = true;
        }

        // Schedule deletion after 3 minutes
        if (isTargetGroup && message) {
          ChatCleanupService.scheduleDelete(
            ctx.telegram,
            chatId,
            message.message_id,
            'group-bot-behavior',
            AUTO_DELETE_DELAY
          );

          logger.debug('Bot message sent and scheduled for deletion', {
            chatId,
            messageId: message.message_id,
            topicId: extra.message_thread_id || 'main',
            deleteIn: '3 minutes',
          });
        }

        return message;
      } catch (error) {
        // If topic not found, mark it as invalid and retry without topic
        if (error.description && error.description.includes('message thread not found')) {
          logger.info('Topic does not exist, marking as invalid and using main chat', {
            chatId,
            topicId: NOTIFICATIONS_TOPIC_ID,
          });

          validTopicsPerChat[chatId] = false;
          extra.message_thread_id = undefined;

          const message = await originalSendMessage(chatId, text, extra);

          if (isTargetGroup && message) {
            ChatCleanupService.scheduleDelete(
              ctx.telegram,
              chatId,
              message.message_id,
              'group-bot-behavior',
              AUTO_DELETE_DELAY
            );
          }

          return message;
        }
        throw error;
      }
    };

    return next();
  };
}

/**
 * Cristina AI Group Filter Middleware
 * Detects personal information in Cristina responses and redirects to private chat
 */
function cristinaGroupFilterMiddleware() {
  return async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    if (!isGroup) {
      return next();
    }

    // Personal info keywords (English & Spanish)
    const personalInfoKeywords = [
      // English
      'my email', 'my phone', 'my password', 'credit card', 'billing',
      'login', 'credentials', 'my address', 'my account',
      // Spanish
      'mi email', 'mi correo', 'mi teléfono', 'mi contraseña',
      'tarjeta de crédito', 'factura', 'iniciar sesión',
      'mi dirección', 'mi cuenta'
    ];

    const messageText = ctx.message?.text?.toLowerCase() || '';

    // Check if message contains personal info keywords
    const containsPersonalInfo = personalInfoKeywords.some(keyword =>
      messageText.includes(keyword.toLowerCase())
    );

    if (containsPersonalInfo) {
      const userLang = ctx.from?.language_code || 'en';
      const isSpanish = userLang.startsWith('es');
      const CRISTINA_EMOJI = '🧜‍♀️';

      const redirectMessage = isSpanish
        ? `${CRISTINA_EMOJI} Esta pregunta contiene información personal. Por favor, contáctame en privado para proteger tu privacidad.`
        : `${CRISTINA_EMOJI} This question contains personal information. Please contact me privately to protect your privacy.`;

      // Delete original message
      try {
        await ctx.deleteMessage();
      } catch (error) {
        logger.debug('Could not delete message with personal info:', error.message);
      }

      // Send redirect notice - Cristina messages are NOT auto-deleted
      await ctx.reply(redirectMessage);

      logger.info('Personal info detected in group, message redirected to private', {
        userId: ctx.from?.id,
        chatId: ctx.chat.id,
      });

      return; // Don't proceed with message processing
    }

    return next();
  };
}

/**
 * Group Callback Redirect Middleware
 * Redirects inline button clicks to deep links instead of processing in group
 */
function groupCallbackRedirectMiddleware() {
  return async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const isCallback = ctx.callbackQuery;

    if (!isGroup || !isCallback) {
      return next();
    }

    const chatIdStr = ctx.chat?.id?.toString();

    // Only apply to configured community group
    if (GROUP_ID && chatIdStr !== GROUP_ID) {
      return next();
    }

    // Check if user is admin
    const userId = ctx.from?.id;
    const isAdmin = userId && (
      PermissionService.isEnvSuperAdmin(userId) ||
      PermissionService.isEnvAdmin(userId)
    );

    // Admins can use callbacks normally
    if (isAdmin) {
      return next();
    }

    const callbackData = ctx.callbackQuery.data || '';
    const userLang = ctx.from?.language_code || 'en';
    const isSpanish = userLang.startsWith('es');
    const botUsername = ctx.botInfo?.username || 'PNPLatinoTV_bot';

    // Map callback actions to deep links
    const CALLBACK_DEEP_LINKS = {
      'show_subscription_plans': 'plans',
      'menu_nearby': 'nearby',
      'menu_content': 'content',
      'menu_profile': 'profile',
      'show_profile': 'profile',
      'menu_hangouts': 'hangouts',
      'show_hangouts': 'hangouts',
      'cristina': 'cristina',
      'menu_cristina': 'cristina',
      'show_radio': 'show_radio',
      'show_live': 'show_live',
      'pnp_live': 'pnp_live',
      'show_leaderboard': 'leaderboard',
      'menu_leaderboard': 'leaderboard',
    };

    // Check if this callback should be redirected
    const deepLink = CALLBACK_DEEP_LINKS[callbackData];

    if (deepLink) {
      const pmLink = `https://t.me/${botUsername}?start=${deepLink}`;

      // Answer callback with redirect message
      const redirectText = isSpanish
        ? `Por favor usa el bot en privado para esta funcion`
        : `Please use the bot in private for this feature`;

      try {
        await ctx.answerCbQuery(redirectText, { show_alert: false, url: pmLink });
        logger.info('Callback redirected to deep link', { callbackData, deepLink, userId });
      } catch (error) {
        logger.debug('Could not answer callback with redirect:', error.message);
      }

      return; // Don't proceed with callback handler
    }

    // Allow other callbacks to proceed
    return next();
  };
}

/**
 * Group Menu Button Redirect Middleware (Legacy - kept for compatibility)
 * @deprecated Use groupCallbackRedirectMiddleware instead
 */
function groupMenuRedirectMiddleware() {
  return async (ctx, next) => {
    return next();
  };
}

/**
 * Delete user commands in group after 3 minutes
 */
function groupCommandDeleteMiddleware() {
  return async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    if (!isGroup) {
      return next();
    }

    const messageText = ctx.message?.text || '';
    const isCommand = messageText.startsWith('/');

    if (isCommand && ctx.message?.message_id) {
      // Schedule deletion of user command after 3 minutes
      ChatCleanupService.scheduleDelete(
        ctx.telegram,
        ctx.chat.id,
        ctx.message.message_id,
        'group-user-command',
        AUTO_DELETE_DELAY
      );

      logger.debug('User command scheduled for deletion', {
        chatId: ctx.chat.id,
        messageId: ctx.message.message_id,
        command: messageText.split(' ')[0],
        deleteIn: '3 minutes',
      });
    }

    return next();
  };
}

module.exports = {
  groupBehaviorMiddleware,
  cristinaGroupFilterMiddleware,
  groupMenuRedirectMiddleware,
  groupCallbackRedirectMiddleware,
  groupCommandDeleteMiddleware,
  primeChannelSilentRedirectMiddleware,
};
