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
    // Command redirection middleware has been disabled
    return next();
  };
}

/**
 * Schedule a message for deletion
 */
function scheduleMessageDeletion(ctx, chatId, messageId, topicId, delaySeconds = 180) {
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
 * Schedule command message deletion (3 minutes - GROUP BEHAVIOR OVERRIDE)
 */
async function scheduleCommandDeletion(ctx, chatId, messageId, topicId) {
  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(chatId, messageId);
      logger.debug(`Deleted command message ${messageId} from topic ${topicId}`);
    } catch (error) {
      logger.debug(`Could not delete command message:`, error.message);
    }
  }, 180000); // 3 minutes
}

/**
 * Auto-delete middleware for notifications topic
 * Enforces 5-minute auto-deletion for all messages in notifications topic
 */
function notificationsAutoDelete() {
  return async (ctx, next) => {
    // Notifications auto-delete middleware has been disabled
    return next();
  };
}

module.exports = {
  commandRedirectionMiddleware,
  notificationsAutoDelete
};
