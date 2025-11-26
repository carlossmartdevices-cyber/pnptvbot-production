const { Markup } = require('telegraf');
const moment = require('moment');
const VideoCallModel = require('../../../models/videoCallModel');
const MainRoomModel = require('../../../models/mainRoomModel');
const AgoraTokenService = require('../../../services/agora/agoraTokenService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

// Web app URL for Hangouts
const HANGOUTS_WEB_URL = process.env.HANGOUTS_WEB_URL || 'https://pnptv.app/hangouts';

/**
 * Hangouts (Video Calls) handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerHangoutsHandlers = (bot) => {
  // Main hangouts menu
  bot.action(['hangouts_menu', 'show_hangouts'], async (ctx) => {
    try {
      await showHangoutsMenu(ctx);
    } catch (error) {
      logger.error('Error showing hangouts menu:', error);
    }
  });

  // Join main room
  bot.action('hangouts_join_main', async (ctx) => {
    try {
      await joinMainRoom(ctx);
    } catch (error) {
      logger.error('Error joining main room:', error);
    }
  });

  // Create private call
  bot.action('hangouts_create_private', async (ctx) => {
    try {
      await createPrivateCall(ctx);
    } catch (error) {
      logger.error('Error creating private call:', error);
    }
  });

  // Join private call with ID
  bot.action('hangouts_join_private', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForCallId = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('hangouts.enterCallId', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'hangouts_menu')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting join private call:', error);
    }
  });

  // My active calls
  bot.action('hangouts_my_calls', async (ctx) => {
    try {
      await showMyCalls(ctx);
    } catch (error) {
      logger.error('Error showing my calls:', error);
    }
  });

  // End call action
  bot.action(/hangouts_end_(.+)/, async (ctx) => {
    try {
      const callId = ctx.match[1];
      await endCall(ctx, callId);
    } catch (error) {
      logger.error('Error ending call:', error);
    }
  });

  // Handle text input for call ID
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForCallId) {
      try {
        const lang = getLanguage(ctx);
        const callId = validateUserInput(ctx.message.text, 50);

        if (!callId) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        ctx.session.temp.waitingForCallId = false;
        await ctx.saveSession();

        // Try to join the call
        await joinPrivateCallById(ctx, callId);
      } catch (error) {
        logger.error('Error processing call ID:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show hangouts main menu
 */
const showHangoutsMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    let text = `🎥 ${t('hangouts.title', lang)}\n\n`;
    text += `${t('hangouts.description', lang)}\n\n`;

    // Get active participants count in main room (room ID 1)
    try {
      const mainRoom = await MainRoomModel.getById(1);
      if (mainRoom && mainRoom.isActive) {
        const participants = await MainRoomModel.getParticipants(1);
        text += `👥 ${t('hangouts.mainRoomActive', lang)}: ${participants.length} ${t('hangouts.participants', lang)}\n\n`;
      }
    } catch (error) {
      // If room doesn't exist yet, skip showing count
      logger.debug('Main room not yet initialized:', error);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('hangouts.joinMainRoom', lang), 'hangouts_join_main')],
      [
        Markup.button.callback(t('hangouts.createPrivate', lang), 'hangouts_create_private'),
        Markup.button.callback(t('hangouts.joinPrivate', lang), 'hangouts_join_private'),
      ],
      [Markup.button.callback(t('hangouts.myCalls', lang), 'hangouts_my_calls')],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showHangoutsMenu:', error);
  }
};

/**
 * Join main room
 */
const joinMainRoom = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Join main room (room ID 1) - joinRoom handles everything
    const roomId = 1; // Main room is always room 1
    const result = await MainRoomModel.joinRoom(roomId, userId, username, true); // true = as publisher (can broadcast)

    // Get current participants count
    const participants = await MainRoomModel.getParticipants(roomId);

    // Create web app URL with token from joinRoom result
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${result.room.channelName}&token=${result.token}&uid=${userId}&username=${encodeURIComponent(username)}&type=main`;

    let text = `✅ ${t('hangouts.joinedMainRoom', lang)}\n\n`;
    text += `🎥 ${t('hangouts.roomName', lang)}: ${result.room.name}\n`;
    text += `👥 ${t('hangouts.participants', lang)}: ${participants.length}\n\n`;
    text += `💡 ${t('hangouts.clickToJoin', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('hangouts.leaveRoom', lang), 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in joinMainRoom:', error);
    const lang = getLanguage(ctx);

    // Handle specific errors
    if (error.message.includes('full')) {
      await ctx.reply(t('hangouts.roomFull', lang));
    } else if (error.message.includes('not active')) {
      await ctx.reply(t('hangouts.roomNotActive', lang));
    } else if (error.message.includes('not found')) {
      await ctx.reply(t('hangouts.roomNotFound', lang));
    } else {
      await ctx.reply(t('error', lang));
    }
  }
};

/**
 * Create private call
 */
const createPrivateCall = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Create private call using correct API
    const result = await VideoCallModel.create({
      creatorId: userId,
      creatorName: username,
      title: `${username}'s Call`,
      maxParticipants: 10,
      enforceCamera: false,
      allowGuests: true,
      isPublic: false,
    });

    // result includes call data + tokens already generated
    // Create web app URL with the token from result
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${result.channelName}&token=${result.token}&uid=${userId}&username=${encodeURIComponent(username)}&type=private`;

    let text = `✅ ${t('hangouts.callCreated', lang)}\n\n`;
    text += `🎥 ${t('hangouts.callId', lang)}: \`${result.id}\`\n`;
    text += `🔗 ${t('hangouts.shareId', lang)}\n\n`;
    text += `💡 ${t('hangouts.clickToStart', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('hangouts.endCall', lang), `hangouts_end_${result.id}`)],
      [Markup.button.callback(t('back', lang), 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in createPrivateCall:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

/**
 * Join private call by ID
 */
const joinPrivateCallById = async (ctx, callId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Join call using correct API - joinCall handles everything
    const result = await VideoCallModel.joinCall(callId, userId, username, false); // false = not guest

    // Get current participants count
    const participants = await VideoCallModel.getParticipants(callId);

    // Create web app URL with token from joinCall result
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${result.call.channelName}&token=${result.token}&uid=${userId}&username=${encodeURIComponent(username)}&type=private`;

    let text = `✅ ${t('hangouts.joinedCall', lang)}\n\n`;
    text += `🎥 ${t('hangouts.callId', lang)}: ${callId}\n`;
    text += `👥 ${t('hangouts.participants', lang)}: ${participants.length}\n\n`;
    text += `💡 ${t('hangouts.clickToJoin', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('back', lang), 'hangouts_menu')],
    ]);

    await ctx.reply(text, keyboard);
  } catch (error) {
    logger.error('Error in joinPrivateCallById:', error);
    const lang = getLanguage(ctx);

    // Handle specific errors
    if (error.message.includes('not found')) {
      await ctx.reply(t('hangouts.callNotFound', lang));
    } else if (error.message.includes('ended')) {
      await ctx.reply(t('hangouts.callEnded', lang));
    } else if (error.message.includes('full')) {
      await ctx.reply(t('hangouts.callFull', lang));
    } else {
      await ctx.reply(t('error', lang));
    }
  }
};

/**
 * Show my active calls
 */
const showMyCalls = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Use correct API method
    const calls = await VideoCallModel.getActiveByCreator(userId);

    let text = `📞 ${t('hangouts.myCalls', lang)}\n\n`;

    if (calls && calls.length > 0) {
      calls.forEach((call, index) => {
        const createdAt = call.createdAt;
        text += `${index + 1}. ${t('hangouts.call', lang)} \`${call.id}\`\n`;
        text += `   👥 ${call.currentParticipants || 0} ${t('hangouts.participants', lang)}\n`;
        text += `   ⏰ ${moment(createdAt).format('HH:mm')}\n`;
        text += `   Status: ${call.isActive ? 'Active' : 'Ended'}\n\n`;
      });
    } else {
      text += t('hangouts.noActiveCalls', lang);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('refresh', lang), 'hangouts_my_calls')],
      [Markup.button.callback(t('back', lang), 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showMyCalls:', error);
  }
};

/**
 * End a call
 */
const endCall = async (ctx, callId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Verify user is the host - use correct API
    const call = await VideoCallModel.getById(callId);

    if (!call) {
      await ctx.answerCbQuery(t('hangouts.callNotFound', lang));
      return;
    }

    if (call.creatorId !== String(userId)) {
      await ctx.answerCbQuery(t('hangouts.notHost', lang));
      return;
    }

    // End the call - pass creatorId
    await VideoCallModel.endCall(callId, userId);

    await ctx.answerCbQuery(t('hangouts.callEndedSuccess', lang));
    await showHangoutsMenu(ctx);
  } catch (error) {
    logger.error('Error in endCall:', error);
    const lang = getLanguage(ctx);
    await ctx.answerCbQuery(t('error', lang));
  }
};

module.exports = registerHangoutsHandlers;
