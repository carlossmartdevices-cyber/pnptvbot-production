const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

const GROUP_ID = process.env.GROUP_ID;
const AUTO_DELETE_DELAY = 5 * 60 * 1000; // 5 minutes

/**
 * Group Message Auto-Delete Middleware
 * 
 * Automatically schedules all bot messages sent to groups
 * for deletion after 5 minutes.
 * 
 * This keeps the group clean and focused on user content.
 */
function groupMessageAutoDeleteMiddleware() {
  return async (ctx, next) => {
    // Store original reply and sendMessage functions
    const originalReply = ctx.reply.bind(ctx);
    const originalSendMessage = ctx.telegram.sendMessage.bind(ctx.telegram);
    
    // Check if this is a group context
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    
    // Override ctx.reply for groups
    ctx.reply = async (text, extra = {}) => {
      const message = await originalReply(text, extra);
      
      if (isGroup && message) {
        // Schedule deletion after 5 minutes
        ChatCleanupService.scheduleDelete(
          ctx.telegram,
          ctx.chat.id,
          message.message_id,
          'group-bot-reply',
          AUTO_DELETE_DELAY
        );
        
        logger.debug('Bot reply scheduled for auto-delete', {
          chatId: ctx.chat.id,
          messageId: message.message_id,
          deleteIn: '5 minutes',
        });
      }
      
      return message;
    };
    
    // Override ctx.telegram.sendMessage for groups
    const originalTelegramSendMessage = ctx.telegram.sendMessage;
    ctx.telegram.sendMessage = async (chatId, text, extra = {}) => {
      const message = await originalTelegramSendMessage.call(ctx.telegram, chatId, text, extra);
      
      // Check if this is the configured group or any group
      const chatIdStr = chatId.toString();
      const isTargetGroup = GROUP_ID ? chatIdStr === GROUP_ID : chatIdStr.startsWith('-');
      
      if (isTargetGroup && message) {
        // Schedule deletion after 5 minutes
        ChatCleanupService.scheduleDelete(
          ctx.telegram,
          chatId,
          message.message_id,
          'group-bot-message',
          AUTO_DELETE_DELAY
        );
        
        logger.debug('Bot message scheduled for auto-delete', {
          chatId,
          messageId: message.message_id,
          deleteIn: '5 minutes',
        });
      }
      
      return message;
    };
    
    return next();
  };
}

/**
 * Schedule deletion of a message sent to a group
 * @param {Object} telegram - Telegram instance
 * @param {number|string} chatId - Chat ID
 * @param {number} messageId - Message ID
 */
function scheduleGroupMessageDelete(telegram, chatId, messageId) {
  ChatCleanupService.scheduleDelete(
    telegram,
    chatId,
    messageId,
    'group-notification',
    AUTO_DELETE_DELAY
  );
  
  logger.debug('Group notification scheduled for auto-delete', {
    chatId,
    messageId,
    deleteIn: '5 minutes',
  });
}

module.exports = {
  groupMessageAutoDeleteMiddleware,
  scheduleGroupMessageDelete,
  AUTO_DELETE_DELAY,
};
