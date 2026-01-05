/**
 * Group Command Restriction Middleware
 * Blocks all commands except /menu in groups
 * Deletes all command messages immediately (except /menu)
 */

const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

const groupCommandRestrictionMiddleware = () => {
  return async (ctx, next) => {
    try {
      // Only apply in groups (not private chats)
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        return next();
      }

      // Check if this is a command message
      if (ctx.message?.entities) {
        const hasCommand = ctx.message.entities.some(entity => entity.type === 'bot_command');

        if (hasCommand && ctx.message?.text) {
          // Extract the command (first word starting with /)
          const commandMatch = ctx.message.text.match(/^\/(\w+)/);
          const command = commandMatch ? commandMatch[1] : null;

          // Allow only /menu command in groups
          if (command && command !== 'menu') {
            logger.info(`Blocking command /${command} in group ${ctx.chat.id} from user ${ctx.from.id}`);

            // Send reply message that only /menu is allowed
            try {
              const replyMsg = await ctx.reply('Only /menu command is allowed in this group.');
              logger.info(`Sent restriction message for blocked command /${command} in group ${ctx.chat.id}`);

              // Schedule the reply message for deletion after 30 seconds
              if (replyMsg?.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  replyMsg.message_id,
                  'command-restriction-reply',
                  30000
                );
              }
            } catch (replyError) {
              logger.error(`Failed to send restriction message for /${command}:`, replyError);
            }

            // Delete the command message immediately
            try {
              await ctx.deleteMessage();
              logger.info(`Deleted blocked command message: /${command} in group ${ctx.chat.id}`);
            } catch (deleteError) {
              // If immediate deletion fails, schedule it with retry
              logger.debug(`Immediate deletion failed for /${command}, scheduling for retry`, {
                chatId: ctx.chat.id,
                messageId: ctx.message.message_id,
                error: deleteError.message,
              });

              // Schedule deletion as fallback
              if (ctx.message.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  ctx.message.message_id,
                  'blocked-group-command',
                  100
                );
              }
            }

            // Don't proceed to the actual command handler
            return;
          }

          // If it's /menu, allow it to proceed normally
          if (command === 'menu') {
            return next();
          }
        }
      }

      // Continue to next middleware/handler for non-command messages
      return next();
    } catch (error) {
      logger.error('Error in groupCommandRestrictionMiddleware:', error);
      return next();
    }
  };
};

module.exports = groupCommandRestrictionMiddleware;
