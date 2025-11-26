const { getBroadcastTypeMenu, getConfirmationMenu } = require('../../utils/menus');
const adminService = require('../../services/adminService');
const logger = require('../../../utils/logger');

/**
 * Handle broadcast menu
 */
async function handleBroadcastMenu(ctx) {
  try {
    await ctx.editMessageText(
      '📢 **Broadcast Messages**\n\nSelect the type of message you want to broadcast:',
      {
        parse_mode: 'Markdown',
        reply_markup: getBroadcastTypeMenu(),
      }
    );

    logger.info(`Broadcast menu accessed by ${ctx.from.id}`);
  } catch (error) {
    logger.error('Error in broadcast menu:', error);
    await ctx.answerCbQuery('❌ Error loading broadcast menu');
  }
}

/**
 * Handle broadcast type selection
 */
async function handleBroadcastType(ctx) {
  try {
    const type = ctx.callbackQuery.data.split('_')[1]; // 'broadcast_text' -> 'text'

    await ctx.editMessageText(
      `📝 Enter the ${type} message to broadcast:\n\n` +
      `For text: Just type your message\n` +
      `For media: Send the photo/video with a caption`
    );

    // Save session
    await ctx.saveSession({ broadcastType: type, waitingForBroadcast: true });

    logger.info(`Admin ${ctx.from.id} selected broadcast type: ${type}`);
  } catch (error) {
    logger.error('Error in broadcast type selection:', error);
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Handle broadcast message input
 */
async function handleBroadcastInput(ctx, bot) {
  try {
    const session = ctx.session || {};

    if (!session.waitingForBroadcast) {
      return false;
    }

    const type = session.broadcastType;
    let message = '';
    let mediaUrl = null;
    let mediaType = null;

    if (type === 'text' && ctx.message.text) {
      message = ctx.message.text;
    } else if (type === 'photo' && ctx.message.photo) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      mediaUrl = photo.file_id;
      mediaType = 'photo';
      message = ctx.message.caption || '';
    } else if (type === 'video' && ctx.message.video) {
      mediaUrl = ctx.message.video.file_id;
      mediaType = 'video';
      message = ctx.message.caption || '';
    } else {
      await ctx.reply('❌ Invalid message type. Please try again.');
      return true;
    }

    // Show preview and confirmation
    const previewMessage = `📢 **Broadcast Preview**\n\n${message}\n\n` +
      `This message will be sent to all users. Continue?`;

    await ctx.reply(previewMessage, {
      parse_mode: 'Markdown',
      reply_markup: getConfirmationMenu('broadcast'),
    });

    // Save broadcast data
    await ctx.saveSession({
      broadcastMessage: message,
      broadcastMediaUrl: mediaUrl,
      broadcastMediaType: mediaType,
      waitingForBroadcastConfirm: true,
      waitingForBroadcast: false,
    });

    return true;
  } catch (error) {
    logger.error('Error in broadcast input:', error);
    await ctx.reply('❌ Error processing broadcast');
    return false;
  }
}

/**
 * Handle broadcast confirmation
 */
async function handleBroadcastConfirm(ctx, bot) {
  try {
    const session = ctx.session || {};
    const confirmed = ctx.callbackQuery.data === 'confirm_broadcast';

    if (!confirmed) {
      await ctx.editMessageText('❌ Broadcast cancelled');
      await ctx.clearSession();
      return;
    }

    await ctx.editMessageText('📢 Sending broadcast...');

    // Send broadcast
    const results = await adminService.sendBroadcast(
      bot,
      ctx.from.id,
      session.broadcastMessage,
      {
        mediaUrl: session.broadcastMediaUrl,
        mediaType: session.broadcastMediaType,
      }
    );

    const resultMessage = `✅ Broadcast completed!\n\n` +
      `• Total users: ${results.total}\n` +
      `• Sent successfully: ${results.sent}\n` +
      `• Failed: ${results.failed}`;

    await ctx.editMessageText(resultMessage);
    await ctx.clearSession();

    logger.info(`Broadcast sent by admin ${ctx.from.id}: ${results.sent} sent, ${results.failed} failed`);
  } catch (error) {
    logger.error('Error in broadcast confirm:', error);
    await ctx.editMessageText('❌ Error sending broadcast');
  }
}

module.exports = {
  handleBroadcastMenu,
  handleBroadcastType,
  handleBroadcastInput,
  handleBroadcastConfirm,
};
