const logger = require('../../../utils/logger');

/**
 * Auto-delete commands in groups
 * Deletes command messages immediately after they're sent
 * Allows all commands to work but keeps group chat clean
 */
const commandAutoDeleteMiddleware = () => {
  return async (ctx, next) => {
    try {
      // Only process in groups (not private chats)
      if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
        // Check if this is a command message
        if (ctx.message?.entities) {
          const hasCommand = ctx.message.entities.some(entity => entity.type === 'bot_command');
          
          if (hasCommand) {
            // Delete the command message
            try {
              await ctx.deleteMessage();
              logger.debug('Command auto-deleted from group', {
                command: ctx.message.text,
                chatId: ctx.chat.id,
                userId: ctx.from.id,
              });
            } catch (deleteError) {
              logger.debug('Could not auto-delete command message:', deleteError.message);
            }
          }
        }
      }

      // Continue to next middleware/handler
      return next();
    } catch (error) {
      logger.error('Error in commandAutoDeleteMiddleware:', error);
      return next();
    }
  };
};

module.exports = commandAutoDeleteMiddleware;
