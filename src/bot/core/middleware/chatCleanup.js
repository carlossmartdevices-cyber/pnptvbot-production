const ChatCleanupService = require('../../services/chatCleanupService');
const logger = require('../../../utils/logger');

/**
 * Chat cleanup middleware
 * Automatically schedules deletion of:
 * 1. Bot messages (replies, notifications)
 * 2. User commands (/command)
 * 3. System messages (joins, leaves, etc.)
 *
 * User regular messages are NOT deleted
 *
 * @param {number} delay - Delay in milliseconds (default: 5 minutes)
 * @returns {Function} Middleware function
 */
const chatCleanupMiddleware = (delay = 5 * 60 * 1000) => {
  return async (ctx, next) => {
    const chatType = ctx.chat?.type;

    // Only apply to groups and supergroups
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return next();
    }

    try {
      // Handle incoming messages
      if (ctx.message) {
        await handleIncomingMessage(ctx, delay);
      }

      // Continue with the rest of the middleware chain
      await next();

      // Handle outgoing bot messages (replies)
      await handleOutgoingMessages(ctx, delay);
    } catch (error) {
      logger.error('Chat cleanup middleware error:', error);
      // Don't block the message flow
      throw error;
    }
  };
};

/**
 * Handle incoming messages
 * Schedule deletion of commands and system messages
 */
async function handleIncomingMessage(ctx, delay) {
  const message = ctx.message;

  // Check if it's a command
  if (message.text && message.text.startsWith('/')) {
    ChatCleanupService.scheduleCommand(ctx, delay);

    logger.debug('Command scheduled for deletion', {
      chatId: ctx.chat.id,
      messageId: message.message_id,
      command: message.text.split(' ')[0],
    });
    return;
  }

  // Check for system messages
  if (isSystemMessage(message)) {
    ChatCleanupService.scheduleSystemMessage(
      ctx.telegram,
      ctx.chat.id,
      message.message_id,
      delay,
    );

    logger.debug('System message scheduled for deletion', {
      chatId: ctx.chat.id,
      messageId: message.message_id,
      type: getSystemMessageType(message),
    });
  }

  // Regular user messages are NOT scheduled for deletion
}

/**
 * Handle outgoing messages (bot replies)
 * Intercepts ctx.reply, ctx.replyWithMarkdown, etc.
 */
async function handleOutgoingMessages(ctx, delay) {
  // Store original reply methods
  const originalReply = ctx.reply;
  const originalReplyWithMarkdown = ctx.replyWithMarkdown;
  const originalReplyWithHTML = ctx.replyWithHTML;
  const originalReplyWithPhoto = ctx.replyWithPhoto;
  const originalReplyWithDocument = ctx.replyWithDocument;

  // Wrap reply method
  ctx.reply = async function (...args) {
    const sentMessage = await originalReply.apply(this, args);

    if (sentMessage) {
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, delay);

      logger.debug('Bot message scheduled for deletion', {
        chatId: ctx.chat.id,
        messageId: sentMessage.message_id,
      });
    }

    return sentMessage;
  };

  // Wrap replyWithMarkdown
  ctx.replyWithMarkdown = async function (...args) {
    const sentMessage = await originalReplyWithMarkdown.apply(this, args);

    if (sentMessage) {
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, delay);
    }

    return sentMessage;
  };

  // Wrap replyWithHTML
  ctx.replyWithHTML = async function (...args) {
    const sentMessage = await originalReplyWithHTML.apply(this, args);

    if (sentMessage) {
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, delay);
    }

    return sentMessage;
  };

  // Wrap replyWithPhoto
  ctx.replyWithPhoto = async function (...args) {
    const sentMessage = await originalReplyWithPhoto.apply(this, args);

    if (sentMessage) {
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, delay);
    }

    return sentMessage;
  };

  // Wrap replyWithDocument
  ctx.replyWithDocument = async function (...args) {
    const sentMessage = await originalReplyWithDocument.apply(this, args);

    if (sentMessage) {
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, delay);
    }

    return sentMessage;
  };
}

/**
 * Check if a message is a system message
 * @param {Object} message - Telegram message
 * @returns {boolean} Is system message
 */
function isSystemMessage(message) {
  return !!(
    message.new_chat_members
    || message.left_chat_member
    || message.new_chat_title
    || message.new_chat_photo
    || message.delete_chat_photo
    || message.group_chat_created
    || message.supergroup_chat_created
    || message.channel_chat_created
    || message.migrate_to_chat_id
    || message.migrate_from_chat_id
    || message.pinned_message
    || message.invoice
    || message.successful_payment
    || message.connected_website
    || message.passport_data
    || message.proximity_alert_triggered
    || message.forum_topic_created
    || message.forum_topic_edited
    || message.forum_topic_closed
    || message.forum_topic_reopened
    || message.video_chat_scheduled
    || message.video_chat_started
    || message.video_chat_ended
    || message.video_chat_participants_invited
  );
}

/**
 * Get system message type
 * @param {Object} message - Telegram message
 * @returns {string} System message type
 */
function getSystemMessageType(message) {
  if (message.new_chat_members) return 'new_members';
  if (message.left_chat_member) return 'left_member';
  if (message.new_chat_title) return 'new_title';
  if (message.new_chat_photo) return 'new_photo';
  if (message.delete_chat_photo) return 'delete_photo';
  if (message.group_chat_created) return 'group_created';
  if (message.supergroup_chat_created) return 'supergroup_created';
  if (message.pinned_message) return 'pinned_message';
  if (message.video_chat_started) return 'video_chat_started';
  if (message.video_chat_ended) return 'video_chat_ended';
  return 'unknown';
}

module.exports = chatCleanupMiddleware;
