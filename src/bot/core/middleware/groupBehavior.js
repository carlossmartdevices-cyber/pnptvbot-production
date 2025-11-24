const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

/**
 * Group Behavior Rules Configuration
 * These rules OVERRIDE all previous group behavior settings
 */

// Configuration constants
const GROUP_CHAT_ID = process.env.GROUP_ID;
const NOTIFICATIONS_TOPIC_ID = 3135;
const GROUP_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes in milliseconds

// Personal information keywords to detect (questions that should go to private)
const PERSONAL_INFO_KEYWORDS = [
  // English
  'my email', 'my phone', 'my address', 'my password', 'my account',
  'my subscription', 'my payment', 'my card', 'credit card', 'debit card',
  'my profile', 'my location', 'my ip', 'my data', 'my information',
  'bank account', 'social security', 'ssn', 'my id', 'identification',
  'billing', 'invoice', 'receipt', 'transaction', 'purchase history',
  'login', 'credentials', 'username', 'my name', 'full name',
  // Spanish
  'mi email', 'mi correo', 'mi teléfono', 'mi dirección', 'mi contraseña',
  'mi cuenta', 'mi suscripción', 'mi pago', 'mi tarjeta', 'tarjeta de crédito',
  'mi perfil', 'mi ubicación', 'mis datos', 'mi información',
  'cuenta bancaria', 'seguro social', 'mi id', 'identificación',
  'factura', 'recibo', 'transacción', 'historial de compras',
  'iniciar sesión', 'credenciales', 'nombre de usuario', 'mi nombre'
];

/**
 * Check if a message contains personal information requests
 * @param {string} text - Message text
 * @returns {boolean} True if personal info detected
 */
function containsPersonalInfoRequest(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return PERSONAL_INFO_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Send message to topic 3135 and schedule deletion after 3 minutes
 * @param {Object} ctx - Telegraf context
 * @param {string} text - Message text
 * @param {Object} extra - Extra options (parse_mode, reply_markup, etc.)
 * @returns {Object} Sent message
 */
async function sendToNotificationsTopic(ctx, text, extra = {}) {
  const chatId = ctx.chat?.id?.toString();

  // Only apply to configured group
  if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
    return ctx.reply(text, extra);
  }

  try {
    const sentMessage = await ctx.telegram.sendMessage(
      chatId,
      text,
      {
        message_thread_id: NOTIFICATIONS_TOPIC_ID,
        ...extra
      }
    );

    // Schedule deletion after 3 minutes
    ChatCleanupService.scheduleBotMessage(
      ctx.telegram,
      sentMessage,
      GROUP_DELETE_DELAY,
      false
    );

    return sentMessage;
  } catch (error) {
    logger.error('Error sending to notifications topic:', error);
    // Fallback to normal reply
    return ctx.reply(text, extra);
  }
}

/**
 * Group Behavior Middleware
 * Overrides all previous group behavior rules
 */
function groupBehaviorMiddleware() {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    // Only apply to the configured group
    if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
      return next();
    }

    // Only apply to group/supergroup chats
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next();
    }

    // Override ctx.reply to route all bot messages to topic 3135 with 3-minute auto-delete
    const originalReply = ctx.reply.bind(ctx);
    ctx.reply = async function(text, extra = {}) {
      try {
        // Send to notifications topic
        const sentMessage = await ctx.telegram.sendMessage(
          chatId,
          text,
          {
            message_thread_id: NOTIFICATIONS_TOPIC_ID,
            parse_mode: extra.parse_mode,
            reply_markup: extra.reply_markup,
            ...extra
          }
        );

        // Schedule deletion after 3 minutes
        ChatCleanupService.scheduleBotMessage(
          ctx.telegram,
          sentMessage,
          GROUP_DELETE_DELAY,
          false
        );

        return sentMessage;
      } catch (error) {
        logger.error('Error in group behavior reply override:', error);
        // Fallback to original reply
        return originalReply(text, extra);
      }
    };

    return next();
  };
}

/**
 * Cristina AI Group Filter Middleware
 * Allows Cristina to reply in group unless it's about personal information
 */
function cristinaGroupFilterMiddleware() {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    // Only apply to the configured group
    if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
      return next();
    }

    // Only apply to group/supergroup chats
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next();
    }

    // Check if this is a text message (not a command)
    const messageText = ctx.message?.text;
    if (!messageText || messageText.startsWith('/')) {
      return next();
    }

    // Check if message contains personal information requests
    if (containsPersonalInfoRequest(messageText)) {
      const lang = ctx.session?.language || ctx.from?.language_code === 'es' ? 'es' : 'en';
      const botUsername = ctx.botInfo?.username || 'PNPtvbot';

      const redirectMessage = lang === 'es'
        ? '🔒 Esta pregunta contiene información personal. Por favor, contáctame en privado para proteger tu privacidad.'
        : '🔒 This question contains personal information. Please contact me privately to protect your privacy.';

      // Send redirect message to topic 3135
      const sentMessage = await ctx.telegram.sendMessage(
        chatId,
        redirectMessage,
        {
          message_thread_id: NOTIFICATIONS_TOPIC_ID,
          reply_markup: {
            inline_keyboard: [[
              { text: lang === 'es' ? '💬 Chat Privado' : '💬 Private Chat', url: `https://t.me/${botUsername}` }
            ]]
          }
        }
      );

      // Schedule deletion after 3 minutes
      ChatCleanupService.scheduleBotMessage(
        ctx.telegram,
        sentMessage,
        GROUP_DELETE_DELAY,
        false
      );

      // Mark that we handled this - don't process through AI
      ctx.session = ctx.session || {};
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.personalInfoBlocked = true;

      return; // Don't call next() - stop processing
    }

    return next();
  };
}

/**
 * Group Menu Button Redirect Middleware
 * When buttons are clicked in group, redirect user to private bot chat
 */
function groupMenuRedirectMiddleware() {
  return async (ctx, next) => {
    // Only handle callback queries (button clicks)
    if (!ctx.callbackQuery) {
      return next();
    }

    const chatType = ctx.chat?.type;

    // Only apply to groups
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next();
    }

    const chatId = ctx.chat?.id?.toString();

    // Only apply to configured group
    if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
      return next();
    }

    const action = ctx.callbackQuery.data;
    const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'User';
    const botUsername = ctx.botInfo?.username || 'PNPtvbot';
    const lang = ctx.session?.language || ctx.from?.language_code === 'es' ? 'es' : 'en';

    // Actions that should be redirected to private
    const privateActions = [
      'show_subscription_plans',
      'show_profile',
      'show_nearby',
      'show_radio',
      'show_support',
      'show_settings',
      'admin_panel',
      'show_live',
      'show_zoom',
      'show_player',
      'support_ai_chat',
      'support_contact_admin',
      'support_faq',
      'support_request_activation'
    ];

    if (privateActions.includes(action)) {
      try {
        await ctx.answerCbQuery();

        // Send notification in group to topic 3135
        const groupNotice = lang === 'es'
          ? `${username}, te envié un mensaje privado. ¡Revísalo! 💬`
          : `${username}, I sent you a private message. Check it out! 💬`;

        const sentMessage = await ctx.telegram.sendMessage(
          chatId,
          groupNotice,
          {
            message_thread_id: NOTIFICATIONS_TOPIC_ID
          }
        );

        // Schedule deletion after 3 minutes
        ChatCleanupService.scheduleBotMessage(
          ctx.telegram,
          sentMessage,
          GROUP_DELETE_DELAY,
          false
        );

        // Send private message with button to access the feature
        try {
          const pmMessage = lang === 'es'
            ? `¡Hiciste clic en un botón del grupo! Usa el botón de abajo para acceder a esta función:`
            : `You clicked a button in the group! Use the button below to access this feature:`;

          await ctx.telegram.sendMessage(
            ctx.from.id,
            pmMessage,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: lang === 'es' ? '🚀 Abrir Función' : '🚀 Open Feature', url: `https://t.me/${botUsername}?start=${action}` }
                ]]
              }
            }
          );
        } catch (pmError) {
          logger.debug('Could not send private message:', pmError.message);

          // If can't send PM, notify in group
          const errorNotice = lang === 'es'
            ? `${username}, no pude enviarte un mensaje privado. Por favor, inicia una conversación conmigo primero.`
            : `${username}, I couldn't send you a private message. Please start a conversation with me first.`;

          const errorMsg = await ctx.telegram.sendMessage(
            chatId,
            errorNotice,
            {
              message_thread_id: NOTIFICATIONS_TOPIC_ID,
              reply_markup: {
                inline_keyboard: [[
                  { text: lang === 'es' ? '💬 Iniciar Chat' : '💬 Start Chat', url: `https://t.me/${botUsername}` }
                ]]
              }
            }
          );

          ChatCleanupService.scheduleBotMessage(
            ctx.telegram,
            errorMsg,
            GROUP_DELETE_DELAY,
            false
          );
        }

        return; // Don't call next() - we handled it
      } catch (error) {
        logger.error('Error in group menu redirect:', error);
      }
    }

    return next();
  };
}

/**
 * Delete user commands in group after 3 minutes
 */
function groupCommandDeleteMiddleware() {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    // Only apply to the configured group
    if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
      return next();
    }

    // Only apply to group/supergroup chats
    if (chatType !== 'group' && chatType !== 'supergroup') {
      return next();
    }

    // Check if this is a command
    if (ctx.message?.text?.startsWith('/')) {
      // Schedule command deletion after 3 minutes
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(chatId, ctx.message.message_id);
          logger.debug('Group command deleted after 3 minutes', {
            chatId,
            messageId: ctx.message.message_id
          });
        } catch (error) {
          logger.debug('Could not delete group command:', error.message);
        }
      }, GROUP_DELETE_DELAY);
    }

    return next();
  };
}

module.exports = {
  groupBehaviorMiddleware,
  cristinaGroupFilterMiddleware,
  groupMenuRedirectMiddleware,
  groupCommandDeleteMiddleware,
  sendToNotificationsTopic,
  containsPersonalInfoRequest,
  GROUP_DELETE_DELAY,
  NOTIFICATIONS_TOPIC_ID
};
