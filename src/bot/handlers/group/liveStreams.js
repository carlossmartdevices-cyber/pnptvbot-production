const { getFirestore, Collections } = require('../../config/firebase');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle live streams in group chat
 */
async function handleLiveStreams(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);

    if (!isGroup) {
      // In private chat, redirect to group
      await ctx.reply(
        language === 'es'
          ? '🎥 Por favor usa este comando en el grupo de PNPtv para ver las transmisiones en vivo.'
          : '🎥 Please use this command in the PNPtv group to view live streams.'
      );
      return;
    }

    // Get active live streams from Firestore
    const db = getFirestore();
    const streamsSnapshot = await db
      .collection(Collections.LIVE_STREAMS)
      .where('active', '==', true)
      .limit(5)
      .get();

    if (streamsSnapshot.empty) {
      await ctx.reply(i18n.t('no_live_streams', language), {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    // Build inline keyboard with stream links
    const keyboard = [];
    streamsSnapshot.docs.forEach(doc => {
      const stream = doc.data();
      keyboard.push([
        { text: `🎬 ${stream.title}`, url: stream.url },
      ]);
    });

    await ctx.reply(i18n.t('live_streams', language), {
      reply_markup: { inline_keyboard: keyboard },
      reply_to_message_id: ctx.message?.message_id,
    });

    logger.info(`Live streams displayed in group ${ctx.chat.id}`);
  } catch (error) {
    logger.error('Error in live streams:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleLiveStreams,
};
