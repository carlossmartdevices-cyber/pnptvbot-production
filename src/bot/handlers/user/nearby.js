const { requirePrivateChat } = require('../../utils/notifications');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle nearby users command
 */
async function handleNearby(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Check if command is in group chat
    const isPrivate = await requirePrivateChat(
      ctx,
      'Nearby Users',
      i18n.t('nearby_users', language)
    );

    if (!isPrivate) {
      return;
    }

    // Check if user has shared location
    if (!user.location) {
      await ctx.reply(
        language === 'es'
          ? '📍 Por favor comparte tu ubicación primero para ver usuarios cercanos.\n\nUsa /start para configurar tu perfil.'
          : '📍 Please share your location first to see nearby users.\n\nUse /start to set up your profile.',
        {
          reply_markup: {
            keyboard: [
              [{ text: language === 'es' ? '📍 Compartir Ubicación' : '📍 Share Location', request_location: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return;
    }

    // Get nearby users
    const nearbyUsers = await userService.getNearbyUsers(
      user.location.lat,
      user.location.lng,
      10 // 10km radius
    );

    if (nearbyUsers.length === 0) {
      await ctx.reply(i18n.t('no_nearby_users', language));
      return;
    }

    // Format nearby users list
    let message = `📍 **${i18n.t('nearby_users', language)}** (${nearbyUsers.length})\n\n`;
    nearbyUsers.slice(0, 10).forEach((nearbyUser, index) => {
      message += `${index + 1}. ${nearbyUser.username || nearbyUser.firstName || 'User'}\n`;
      if (nearbyUser.bio) {
        message += `   ${nearbyUser.bio.substring(0, 50)}...\n`;
      }
      message += `\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(`User ${userId} viewed nearby users`);
  } catch (error) {
    logger.error('Error in nearby command:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleNearby,
};
