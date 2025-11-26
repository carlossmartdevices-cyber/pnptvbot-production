const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle radio in group chat
 */
async function handleRadio(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);

    if (!isGroup) {
      // In private chat, redirect to group
      await ctx.reply(
        language === 'es'
          ? '📻 Por favor usa este comando en el grupo de PNPtv para escuchar la radio.'
          : '📻 Please use this command in the PNPtv group to listen to the radio.'
      );
      return;
    }

    // PNPtv radio stream URL (replace with actual URL)
    const radioUrl = 'https://icecast.pnptv.com/stream.mp3';
    const nowPlaying = 'PNPtv Radio - Live';

    await ctx.reply(
      `📻 **${i18n.t('radio', language)}**\n\n🎵 ${i18n.t('radio_now_playing', language)} ${nowPlaying}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: language === 'es' ? '🎵 Escuchar Ahora' : '🎵 Listen Now', url: radioUrl }],
            [{ text: language === 'es' ? '🎶 Solicitar Canción' : '🎶 Request Song', callback_data: 'radio_request' }],
          ],
        },
        reply_to_message_id: ctx.message?.message_id,
      }
    );

    logger.info(`Radio displayed in group ${ctx.chat.id}`);
  } catch (error) {
    logger.error('Error in radio:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleRadio,
};
