/**
 * Group Command Restriction Middleware
 *
 * New Behavior:
 * - User commands: Cristina responds with a friendly redirect to the bot PM
 * - Admin/Mod commands: Silent redirect (no response in group)
 * - /menu command: Allowed to work normally
 * - Inline buttons: Use deep links to bot functionality
 */

const logger = require('../../../utils/logger');
const { Markup } = require('telegraf');
const ChatCleanupService = require('../../services/chatCleanupService');
const PermissionService = require('../../services/permissionService');
const { getLanguage } = require('../../utils/helpers');

const GROUP_ID = process.env.GROUP_ID;
const WALL_OF_FAME_TOPIC_ID = parseInt(process.env.WALL_OF_FAME_TOPIC_ID || '3132', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'PNPLatinoTV_bot';

/**
 * Admin/Moderator commands that should be silent in group
 */
const ADMIN_COMMANDS = [
  'admin', 'broadcast', 'stats', 'available', 'viewas', 'support',
  'moderation', 'ban', 'unban', 'kick', 'mute', 'unmute', 'warn',
  'warnings', 'clearwarnings', 'modlogs', 'modstats', 'setlinks',
  'topicmod', 'settopicmod', 'activate', 'activar', 'solved', 'resuelto',
  'user', 'usuario', 'respuestas', 'ayuda', 'r1', 'r2', 'r3', 'r4', 'r5',
  'r6', 'r7', 'r8', 'r9', 'close', 'reopen', 'rules'
];

/**
 * Commands that map to specific deep link destinations
 */
const COMMAND_DEEP_LINKS = {
  'start': 'home',
  'subscribe': 'plans',
  'subscription': 'plans',
  'plans': 'plans',
  'prime': 'plans',
  'nearby': 'nearby',
  'profile': 'profile',
  'content': 'content',
  'videos': 'content',
  'hangouts': 'hangouts',
  'calls': 'hangouts',
  'radio': 'show_radio',
  'live': 'show_live',
  'pnplive': 'pnp_live',
  'cristina': 'cristina',
  'help': 'cristina',
  'ayuda': 'cristina',
  'language': 'settings',
  'settings': 'settings',
  'payments': 'payments',
  'history': 'payments',
  'leaderboard': 'leaderboard',
  'ranking': 'leaderboard',
  'top': 'leaderboard',
};

/**
 * Get Cristina's redirect message based on language
 */
function getCristinaRedirectMessage(username, lang, botUsername, deepLink = 'home') {
  const pmLink = `https://t.me/${botUsername}?start=${deepLink}`;

  if (lang === 'es') {
    return {
      text: `@${username} gracias por usar nuestro bot. Por favor revisa @${botUsername} para mas informacion.\n\nRecuerda enviar "Ey Cristina" si tienes alguna pregunta.`,
      button: Markup.button.url('Abrir Bot', pmLink),
    };
  }

  return {
    text: `@${username} thank you for using our bot. Please check @${botUsername} for more info.\n\nRemember to send "Hey Cristina" if you have a question.`,
    button: Markup.button.url('Open Bot', pmLink),
  };
}

/**
 * Build group menu with deep links (no callbacks)
 */
function buildGroupMenuWithDeepLinks(ctx) {
  const lang = getLanguage(ctx);
  const botUsername = ctx.botInfo?.username || BOT_USERNAME;

  const text = lang === 'es'
    ? `PNPtv - Selecciona una opcion:`
    : `PNPtv - Choose an option:`;

  const buttons = [
    [
      Markup.button.url(
        lang === 'es' ? 'PRIME' : 'PRIME',
        `https://t.me/${botUsername}?start=plans`
      ),
      Markup.button.url(
        lang === 'es' ? 'Nearby' : 'Nearby',
        `https://t.me/${botUsername}?start=nearby`
      ),
    ],
    [
      Markup.button.url(
        lang === 'es' ? 'Contenido' : 'Content',
        `https://t.me/${botUsername}?start=content`
      ),
      Markup.button.url(
        lang === 'es' ? 'Cristina' : 'Cristina',
        `https://t.me/${botUsername}?start=cristina`
      ),
    ],
  ];

  return { text, buttons };
}

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

      // Never intercept in Wall of Fame topic
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
          const lang = getLanguage(ctx);
          const botUsername = ctx.botInfo?.username || BOT_USERNAME;
          const username = ctx.from?.username || ctx.from?.first_name || 'Friend';

          // Check if user is admin/moderator
          const isAdmin = await PermissionService.isAdmin(ctx.from?.id);

          // ADMIN/MODERATOR COMMANDS - Silent (no response in group)
          if (ADMIN_COMMANDS.includes(command)) {
            if (isAdmin) {
              // Allow admin commands to proceed for admins
              return next();
            }

            // Non-admins trying admin commands - silently delete
            try {
              await ctx.deleteMessage();
            } catch (e) {
              logger.debug('Could not delete admin command from non-admin');
            }
            return;
          }

          // /menu command - Show menu with deep links
          if (command === 'menu') {
            try {
              const menu = buildGroupMenuWithDeepLinks(ctx);
              const replyMsg = await ctx.reply(menu.text, {
                reply_to_message_id: ctx.message.message_id,
                ...Markup.inlineKeyboard(menu.buttons),
              });

              // Schedule deletion after 30 seconds
              if (replyMsg?.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  replyMsg.message_id,
                  'group-menu-reply',
                  30000
                );
              }

              // Delete the command message
              try {
                await ctx.deleteMessage();
              } catch (e) {
                ChatCleanupService.scheduleDelete(ctx.telegram, ctx.chat.id, ctx.message.message_id, 'command', 100);
              }
            } catch (error) {
              logger.error('Error showing group menu:', error);
            }
            return;
          }

          // USER COMMANDS - Cristina redirect response
          if (command && command !== 'menu') {
            logger.info(`Cristina redirecting command /${command} in group ${ctx.chat.id} from user ${ctx.from.id}`);

            // Determine deep link destination
            const deepLink = COMMAND_DEEP_LINKS[command] || 'home';

            try {
              const cristina = getCristinaRedirectMessage(username, lang, botUsername, deepLink);
              let replyMsg;
              try {
                replyMsg = await ctx.reply(cristina.text, {
                  reply_to_message_id: ctx.message.message_id,
                  ...Markup.inlineKeyboard([[cristina.button]]),
                });
              } catch (replyError) {
                // If reply fails (message deleted), send without reply
                replyMsg = await ctx.reply(cristina.text, {
                  ...Markup.inlineKeyboard([[cristina.button]]),
                });
              }

              logger.info(`Cristina responded to /${command} in group ${ctx.chat.id}`);

              // Schedule the reply for deletion after 30 seconds
              if (replyMsg?.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  replyMsg.message_id,
                  'cristina-redirect',
                  30000
                );
              }
            } catch (replyError) {
              logger.error(`Failed to send Cristina redirect for /${command}:`, replyError);
            }

            // Delete the command message
            try {
              await ctx.deleteMessage();
              logger.debug(`Deleted command message: /${command} in group ${ctx.chat.id}`);
            } catch (deleteError) {
              // Schedule deletion as fallback
              if (ctx.message.message_id) {
                ChatCleanupService.scheduleDelete(
                  ctx.telegram,
                  ctx.chat.id,
                  ctx.message.message_id,
                  'command-delete',
                  100
                );
              }
            }

            // Don't proceed to the actual command handler
            return;
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
module.exports.buildGroupMenuWithDeepLinks = buildGroupMenuWithDeepLinks;
