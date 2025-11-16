const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Nearby users handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerNearbyHandlers = (bot) => {
  // Show nearby users menu
  bot.action('show_nearby', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      await ctx.editMessageText(
        `${t('nearbyTitle', lang)}\n\n${t('selectRadius', lang)}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(t('radius5km', lang), 'nearby_radius_5'),
            Markup.button.callback(t('radius10km', lang), 'nearby_radius_10'),
          ],
          [Markup.button.callback(t('radius25km', lang), 'nearby_radius_25')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing nearby menu:', error);
    }
  });

  // Handle radius selection
  bot.action(/^nearby_radius_(\d+)$/, async (ctx) => {
    try {
      const radius = parseInt(ctx.match[1], 10);
      const lang = getLanguage(ctx);

      // Validate user context exists
      if (!ctx.from?.id) {
        logger.error('Missing user context in nearby users search');
        await ctx.reply(t('error', lang));
        return;
      }

      const userId = ctx.from.id;

      await ctx.editMessageText(t('loading', lang));

      const nearbyUsers = await UserService.getNearbyUsers(userId, radius);

      if (nearbyUsers.length === 0) {
        await ctx.editMessageText(
          t('noNearbyUsers', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_nearby')],
          ]),
        );
        return;
      }

      // Show list of nearby users
      let message = `${t('nearbyUsersFound', lang, { count: nearbyUsers.length })}\n\n`;

      const buttons = [];
      nearbyUsers.slice(0, 10).forEach((user, index) => {
        const name = user.firstName || 'User';
        const distance = user.distance.toFixed(1);
        message += `${index + 1}. ${name} - ${t('distance', lang, { distance })}\n`;

        buttons.push([
          Markup.button.callback(
            `👁️ ${name}`,
            `view_user_${user.id}`,
          ),
        ]);
      });

      buttons.push([Markup.button.callback(t('back', lang), 'show_nearby')]);

      await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error('Error showing nearby users:', error);
      const lang = getLanguage(ctx);
      await ctx.reply(t('error', lang));
    }
  });

  // View user profile
  bot.action(/^view_user_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid view user action format');
        return;
      }

      const targetUserId = ctx.match[1];
      const lang = getLanguage(ctx);

      const user = await UserService.getOrCreateFromContext({ from: { id: targetUserId } });

      let profileText = `👤 ${user.firstName || 'User'} ${user.lastName || ''}\n`;
      if (user.username) profileText += `@${user.username}\n`;
      if (user.bio) profileText += `\n${user.bio}\n`;
      if (user.interests && user.interests.length > 0) {
        profileText += `\n🎯 ${user.interests.join(', ')}\n`;
      }

      await ctx.editMessageText(
        profileText,
        Markup.inlineKeyboard([
          [Markup.button.url(t('sendMessage', lang), `https://t.me/${user.username || targetUserId}`)],
          [Markup.button.callback(t('back', lang), 'show_nearby')],
        ]),
      );
    } catch (error) {
      logger.error('Error viewing user profile:', error);
    }
  });
};

module.exports = registerNearbyHandlers;
