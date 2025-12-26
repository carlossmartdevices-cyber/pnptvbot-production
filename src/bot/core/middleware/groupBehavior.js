const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');
const PermissionService = require('../../services/permissionService');

const GROUP_ID = process.env.GROUP_ID;
const NOTIFICATIONS_TOPIC_ID = process.env.NOTIFICATIONS_TOPIC_ID || '3135';
const AUTO_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes

/**
 * Group Behavior Middleware
 * Routes all bot messages to topic 3135 (Notifications) and auto-deletes after 3 minutes
 */
function groupBehaviorMiddleware() {
  return async (ctx, next) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const chatIdStr = ctx.chat?.id?.toString();

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

    // Override ctx.reply to route to notifications topic
    ctx.reply = async (text, extra = {}) => {
      // Route to notifications topic if not already in a specific topic and not admin
      if (!isAdmin && !extra.message_thread_id) {
        extra.message_thread_id = parseInt(NOTIFICATIONS_TOPIC_ID);
      }

      const message = await originalReply(text, extra);

      // Schedule deletion after 3 minutes
      if (message) {
        ChatCleanupService.scheduleDelete(
          ctx.telegram,
          ctx.chat.id,
          message.message_id,
          'group-bot-behavior',
          AUTO_DELETE_DELAY
        );

        logger.debug('Bot message routed to notifications topic and scheduled for deletion', {
          chatId: ctx.chat.id,
          messageId: message.message_id,
          topicId: NOTIFICATIONS_TOPIC_ID,
          deleteIn: '3 minutes',
        });
      }

      return message;
    };

    // Override ctx.telegram.sendMessage for groups
    ctx.telegram.sendMessage = async (chatId, text, extra = {}) => {
      const chatIdStr = chatId.toString();
      const isTargetGroup = GROUP_ID ? chatIdStr === GROUP_ID : chatIdStr.startsWith('-');

      // Route to notifications topic if sending to group and not admin
      if (isTargetGroup && !isAdmin && !extra.message_thread_id) {
        extra.message_thread_id = parseInt(NOTIFICATIONS_TOPIC_ID);
      }

      const message = await originalSendMessage(chatId, text, extra);

      // Schedule deletion after 3 minutes
      if (isTargetGroup && message) {
        ChatCleanupService.scheduleDelete(
          ctx.telegram,
          chatId,
          message.message_id,
          'group-bot-behavior',
          AUTO_DELETE_DELAY
        );

        logger.debug('Bot message routed to notifications topic and scheduled for deletion', {
          chatId,
          messageId: message.message_id,
          topicId: NOTIFICATIONS_TOPIC_ID,
          deleteIn: '3 minutes',
        });
      }

      return message;
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

      const redirectMessage = isSpanish
        ? '🔒 Esta pregunta contiene información personal. Por favor, contáctame en privado para proteger tu privacidad.'
        : '🔒 This question contains personal information. Please contact me privately to protect your privacy.';

      // Delete original message
      try {
        await ctx.deleteMessage();
      } catch (error) {
        logger.debug('Could not delete message with personal info:', error.message);
      }

      // Send redirect notice
      const sentMessage = await ctx.reply(redirectMessage);

      // Auto-delete warning after 30 seconds
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
        } catch (error) {
          logger.debug('Could not delete warning:', error.message);
        }
      }, 30000);

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
 * Group Menu Button Redirect Middleware
 * Allows menu buttons to work directly in group chat
 */
function groupMenuRedirectMiddleware() {
  return async (ctx, next) => {
    // Allow all callbacks to process normally, including menu buttons in groups
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
  groupCommandDeleteMiddleware,
};
