/**
 * Group Command Restriction Middleware
 * Blocks all commands except /menu in groups
 * Deletes all command messages immediately (except /menu)
 */

const logger = require('../../../utils/logger');
const { Markup } = require('telegraf');
const ChatCleanupService = require('../../services/chatCleanupService');
const { buildGroupMenuPayload } = require('../../handlers/media/menu');
const PermissionService = require('../../services/permissionService');

const GROUP_ID = process.env.GROUP_ID;
const WALL_OF_FAME_TOPIC_ID = parseInt(process.env.WALL_OF_FAME_TOPIC_ID || '3132', 10);

const groupCommandRestrictionMiddleware = () => {
  return async (ctx, next) => {
    try {
      // Only apply in groups (not private chats)
      if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
        return next();
      }

      // Only apply to configured community group (if set)
      const chatIdStr = ctx.chat?.id?.toString();
      if (GROUP_ID && chatIdStr !== GROUP_ID) {
        return next();
      }

      // Never show menus in Wall of Fame topic (bot-only posting enforced elsewhere)
      if (ctx.message?.message_thread_id && Number(ctx.message.message_thread_id) === WALL_OF_FAME_TOPIC_ID) {
        return next();
      }

      // Check if this is a command message
      const messageText = ctx.message?.text || '';
      const isCommandLike = messageText.startsWith('/');

      if (ctx.message?.entities || isCommandLike) {
        const hasCommandEntity = ctx.message?.entities?.some((entity) => entity.type === 'bot_command');
        const hasCommand = Boolean(hasCommandEntity || isCommandLike);

        if (hasCommand && messageText) {
          // Normalize the command (handles /cmd@BotUsername)
          const commandRaw = messageText.split(' ')[0]?.toLowerCase() || '';
          const command = commandRaw.split('@')[0].replace('/', '');

          // Allow /admin to work in the community group for admins
          if (command === 'admin') {
            const isAdmin = await PermissionService.isAdmin(ctx.from?.id);
            if (isAdmin) return next();
          }

          // Any slash command in the community group shows the menu (except /menu itself)
          if (command && command !== 'menu') {
            logger.info(`Redirecting command /${command} to group menu in group ${ctx.chat.id} from user ${ctx.from.id}`);

            // Send menu
            try {
              const menu = buildGroupMenuPayload(ctx);
              const replyMsg = await ctx.reply(menu.text, {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(menu.buttons),
              });
              logger.info(`Sent group menu for /${command} in group ${ctx.chat.id}`);

              // Schedule the reply message for deletion after 30 seconds
              if (replyMsg?.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  replyMsg.message_id,
                  'group-command-menu-reply',
                  30000
                );
              }
            } catch (replyError) {
              logger.error(`Failed to send group menu for /${command}:`, replyError);
            }

            // Delete the command message immediately
            try {
              await ctx.deleteMessage();
              logger.info(`Deleted command message: /${command} in group ${ctx.chat.id}`);
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
                  'group-command-delete',
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
