const logger = require('../../../utils/logger');

const GROUP_ID = process.env.GROUP_ID;
const CLEANUP_DELAY = 90 * 1000; // 90 seconds

/**
 * Chat cleanup middleware
 * Auto-deletes commands and bot messages after 90 seconds
 *
 * Features:
 * - Deletes user commands (messages starting with /)
 * - Deletes bot responses to commands
 * - Configurable delay (default: 90 seconds)
 * - Only operates in configured group
 */
const chatCleanupMiddleware = (delay = CLEANUP_DELAY) => async (ctx, next) => {
  try {
    // Only process in group chats
    if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
      return next();
    }

    // Only process in configured group (if GROUP_ID is set)
    if (GROUP_ID && ctx.chat.id.toString() !== GROUP_ID) {
      return next();
    }

    // Track if this is a command
    const isCommand = ctx.message?.text?.startsWith('/');
    const messageId = ctx.message?.message_id;

    // Process message first
    await next();

    // Schedule deletion for commands
    if (isCommand && messageId) {
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
          logger.debug('Auto-deleted command message', {
            messageId,
            command: ctx.message.text.split(' ')[0]
          });
        } catch (error) {
          // Ignore errors (message might already be deleted)
          logger.debug('Could not delete command message:', error.message);
        }
      }, delay);

      logger.debug('Scheduled command deletion', {
        messageId,
        command: ctx.message.text.split(' ')[0],
        delayMs: delay
      });
    }

    // If bot replied, schedule deletion for bot message too
    if (ctx.botInfo && ctx.message?.reply_to_message?.from?.id === ctx.botInfo.id) {
      const botMessageId = ctx.message.message_id;

      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, botMessageId);
          logger.debug('Auto-deleted bot reply message', { messageId: botMessageId });
        } catch (error) {
          logger.debug('Could not delete bot reply:', error.message);
        }
      }, delay);
    }

  } catch (error) {
    logger.error('Error in chat cleanup middleware:', error);
    // Continue processing even on error
    return next();
  }
};

/**
 * Helper function to schedule bot message deletion
 * Use this when sending bot messages that should auto-delete
 *
 * @param {Object} telegram - Telegram bot API
 * @param {Object} sentMessage - Message object returned from send* methods
 * @param {number} delay - Delay in milliseconds (default: 90 seconds)
 */
const scheduleMessageDeletion = (telegram, sentMessage, delay = CLEANUP_DELAY) => {
  if (!sentMessage || !sentMessage.chat || !sentMessage.message_id) {
    logger.warn('Invalid message object for scheduled deletion');
    return;
  }

  setTimeout(async () => {
    try {
      await telegram.deleteMessage(sentMessage.chat.id, sentMessage.message_id);
      logger.debug('Auto-deleted scheduled message', {
        messageId: sentMessage.message_id,
        chatId: sentMessage.chat.id
      });
    } catch (error) {
      logger.debug('Could not delete scheduled message:', error.message);
    }
  }, delay);

  logger.debug('Scheduled message deletion', {
    messageId: sentMessage.message_id,
    chatId: sentMessage.chat.id,
    delayMs: delay
  });
};

module.exports = chatCleanupMiddleware;
module.exports.scheduleMessageDeletion = scheduleMessageDeletion;
module.exports.CLEANUP_DELAY = CLEANUP_DELAY;
