const logger = require('../../../utils/logger');
const TopicConfigModel = require('../../../models/topicConfigModel');

// Group and topic IDs (should be configurable)
const GROUP_CHAT_ID = process.env.GROUP_ID;
const NOTIFICATIONS_TOPIC_ID = 3135;

/**
 * Command Redirection Middleware
 * Redirects bot command responses to a dedicated notifications topic
 */
function commandRedirectionMiddleware() {
  return async (ctx, next) => {
  const chatId = ctx.chat?.id?.toString();
  const message = ctx.message;

  // Only apply in the configured group
  if (!GROUP_CHAT_ID || chatId !== GROUP_CHAT_ID.toString()) {
    return next();
  }

  // Check if this is a command
  const isCommand = message?.text?.startsWith('/');

  if (!isCommand) {
    return next();
  }

  const command = message.text.split(' ')[0].toLowerCase();
  const currentTopicId = message?.message_thread_id;

  // Exceptions - commands that should NOT be redirected
  const excludedCommands = [
    '/start',
    '/cristina',
    '/support'
  ];

  if (excludedCommands.includes(command)) {
    return next();
  }

  // Check if already in notifications topic
  if (currentTopicId === NOTIFICATIONS_TOPIC_ID) {
    // Already in notifications topic, process normally but schedule deletion
    await scheduleCommandDeletion(ctx, chatId, message.message_id, currentTopicId);
    return next();
  }

  try {
    // Store original context for later
    const originalMessageId = message.message_id;
    const originalTopicId = currentTopicId;
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Send redirect notice to user in current topic
    const lang = ctx.from.language_code === 'es' ? 'es' : 'en';
    const redirectNotice = lang === 'es'
      ? '💬 Los comandos del bot se procesan en el tema **Notifications** →'
      : '💬 Bot commands are processed in the **Notifications** topic →';

    const redirectMessage = await ctx.reply(
      redirectNotice,
      {
        message_thread_id: currentTopicId,
        reply_to_message_id: originalMessageId,
        parse_mode: 'Markdown'
      }
    );

    // Delete user's original command after 30 seconds (after processing)
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(chatId, originalMessageId);
      } catch (error) {
        logger.debug('Could not delete original command:', error.message);
      }
    }, 30000); // 30 seconds

    // Delete redirect notice after 10 seconds
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(chatId, redirectMessage.message_id);
      } catch (error) {
        logger.debug('Could not delete redirect notice:', error.message);
      }
    }, 10000); // 10 seconds

    // Process the command in the notifications topic
    // We need to intercept the bot's response and redirect it

    // Store redirect context
    ctx.session = ctx.session || {};
    ctx.session.redirectToTopic = NOTIFICATIONS_TOPIC_ID;
    ctx.session.originalSendMessage = ctx.reply.bind(ctx);
    ctx.session.commandUser = username;

    // Override ctx.reply to redirect to notifications topic
    const originalReply = ctx.reply.bind(ctx);
    ctx.reply = async function(text, extra = {}) {
      try {
        // Send to notifications topic instead
        const botReply = await ctx.telegram.sendMessage(
          chatId,
          `🤖 **Command:** ${command}\n👤 **User:** @${username}\n\n${text}`,
          {
            message_thread_id: NOTIFICATIONS_TOPIC_ID,
            parse_mode: extra.parse_mode || 'Markdown',
            reply_markup: extra.reply_markup
          }
        );

        // Schedule deletion after 5 minutes
        scheduleMessageDeletion(ctx, chatId, botReply.message_id, NOTIFICATIONS_TOPIC_ID, 300);

        return botReply;
      } catch (error) {
        logger.error('Error redirecting bot reply:', error);
        // Fallback to normal reply
        return originalReply(text, extra);
      }
    };

    // Continue processing the command
    return next();

  } catch (error) {
    logger.error('Error in command redirection:', error);
    return next();
  }
  };
}

/**
 * Schedule a message for deletion
 */
function scheduleMessageDeletion(ctx, chatId, messageId, topicId, delaySeconds = 300) {
  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(chatId, messageId);
      logger.debug(`Auto-deleted message ${messageId} from topic ${topicId}`);
    } catch (error) {
      logger.debug(`Could not delete message ${messageId}:`, error.message);
    }
  }, delaySeconds * 1000);
}

/**
 * Schedule command message deletion (30 seconds)
 */
async function scheduleCommandDeletion(ctx, chatId, messageId, topicId) {
  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(chatId, messageId);
      logger.debug(`Deleted command message ${messageId} from topic ${topicId}`);
    } catch (error) {
      logger.debug(`Could not delete command message:`, error.message);
    }
  }, 30000); // 30 seconds
}

/**
 * Auto-delete middleware for notifications topic
 * Enforces 5-minute auto-deletion for all messages in notifications topic
 */
function notificationsAutoDelete() {
  return async (ctx, next) => {
    const messageThreadId = ctx.message?.message_thread_id;
    const chatId = ctx.chat?.id?.toString();

    // Check if in notifications topic
    if (messageThreadId === NOTIFICATIONS_TOPIC_ID && chatId === GROUP_CHAT_ID?.toString()) {
      const messageId = ctx.message?.message_id;

      if (messageId) {
        // Schedule deletion after 5 minutes
        scheduleMessageDeletion(ctx, chatId, messageId, NOTIFICATIONS_TOPIC_ID, 300);
      }
    }

    return next();
  };
}

module.exports = {
  commandRedirectionMiddleware,
  notificationsAutoDelete
};
