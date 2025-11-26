const { getFirestore, Collections } = require('../../config/firebase');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle zoom rooms in group chat
 */
async function handleZoomRooms(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';
    const isGroup = ['group', 'supergroup'].includes(ctx.chat?.type);

    if (!isGroup) {
      // In private chat, redirect to group
      await ctx.reply(
        language === 'es'
          ? '🎥 Por favor usa este comando en el grupo de PNPtv para ver las salas Zoom.'
          : '🎥 Please use this command in the PNPtv group to view Zoom rooms.'
      );
      return;
    }

    // Get active Zoom rooms from Firestore
    const db = getFirestore();
    const roomsSnapshot = await db
      .collection(Collections.ZOOM_ROOMS)
      .where('active', '==', true)
      .limit(5)
      .get();

    if (roomsSnapshot.empty) {
      await ctx.reply(i18n.t('no_zoom_rooms', language), {
        reply_to_message_id: ctx.message?.message_id,
      });
      return;
    }

    // Build inline keyboard with room links
    const keyboard = [];
    roomsSnapshot.docs.forEach(doc => {
      const room = doc.data();
      keyboard.push([
        { text: `🔗 ${room.name}`, url: room.joinUrl },
      ]);
    });

    await ctx.reply(i18n.t('zoom_rooms', language), {
      reply_markup: { inline_keyboard: keyboard },
      reply_to_message_id: ctx.message?.message_id,
    });

    logger.info(`Zoom rooms displayed in group ${ctx.chat.id}`);
  } catch (error) {
    logger.error('Error in zoom rooms:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleZoomRooms,
};
