const logger = require('../../../utils/logger');

/**
 * Register moderation user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerModerationHandlers = (bot) => {
  // /rules - Show group rules
  bot.command('rules', handleRules);

  // /warnings - Show my warnings
  bot.command('warnings', handleMyWarnings);

  // /blockword <word> - Add banned word (admin only)
  bot.command('blockword', async (ctx) => {
    const chatType = ctx.chat?.type;
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }
    const groupId = ctx.chat.id;
    const userId = ctx.from.id;
    // Only allow admins
    const chatMember = await ctx.getChatMember(userId);
    if (!['creator', 'administrator'].includes(chatMember.status)) {
      return ctx.reply('Only admins can use this command.');
    }
    const word = ctx.message.text.split(' ').slice(1).join(' ').trim().toLowerCase();
    if (!word) {
      return ctx.reply('Usage: /blockword <word>');
    }
    const ModerationService = require('../../services/moderationService');
    const settings = await ModerationService.getStatistics(groupId);
    const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
    if (bannedWords.includes(word)) {
      return ctx.reply(`Word '${word}' is already blocked.`);
    }
    bannedWords.push(word);
    await ModerationService.updateGroupSettings(groupId, { bannedWords });
    return ctx.reply(`Word '${word}' has been blocked in this group.`);
  });
};

module.exports = registerModerationHandlers;
