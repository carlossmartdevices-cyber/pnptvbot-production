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

    // Get active participants count in main room
    const mainRoom = await MainRoomModel.getById(1); // Room 1 is default main room
    if (mainRoom) {
      text += `👥 ${t('hangouts.mainRoomActive', lang)}: ${mainRoom.currentParticipants} ${t('hangouts.participants', lang)}\n\n`;
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

    // Get main room (room ID 1 is the default main room)
    const roomId = 1;
    let mainRoom = await MainRoomModel.getById(roomId);
    
    if (!mainRoom) {
      throw new Error('Main room not found');
    }

    // Generate Agora token for main room
    const channelName = `main_room_${roomId}`;
    const tokenData = await MainRoomModel.joinRoom(roomId, userId, username, true);
    const token = tokenData.rtcToken;

    // Create web app URL with token
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${channelName}&token=${token}&uid=${userId}&username=${encodeURIComponent(username)}&type=main`;

    let text = `✅ ${t('hangouts.joinedMainRoom', lang)}\n\n`;
    text += `🎥 ${t('hangouts.roomId', lang)}: ${mainRoom.roomId}\n`;
    text += `👥 ${t('hangouts.participants', lang)}: ${await MainRoomModel.getActiveParticipantsCount()}\n\n`;
    text += `💡 ${t('hangouts.clickToJoin', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('hangouts.leaveRoom', lang), 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in joinMainRoom:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
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

    // Create private call
    const call = await VideoCallModel.create({
      creatorId: userId,
      creatorName: username,
      title: `${username}'s Private Call`,
      maxParticipants: 10,
      enforceCamera: true,
      allowGuests: true,
      isPublic: false,
    });

    const channelName = call.channelName;
    const token = call.rtcToken; // Token is already generated by create()

    // Create web app URL with token
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${channelName}&token=${token}&uid=${userId}&username=${encodeURIComponent(username)}&type=private`;

    let text = `✅ ${t('hangouts.callCreated', lang)}\n\n`;
    text += `🎥 ${t('hangouts.callId', lang)}: \`${call.callId}\`\n`;
    text += `🔗 ${t('hangouts.shareId', lang)}\n\n`;
    text += `💡 ${t('hangouts.clickToStart', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('hangouts.endCall', lang), `hangouts_end_${call.callId}`)],
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

    // Get call details and join
    const call = await VideoCallModel.getById(callId);

    if (!call) {
      await ctx.reply(t('hangouts.callNotFound', lang));
      return;
    }

    if (!call.isActive) {
      await ctx.reply(t('hangouts.callEnded', lang));
      return;
    }

    // Join call (adds participant and generates token)
    const tokenData = await VideoCallModel.joinCall(callId, userId, username, false);
    const channelName = call.channelName;
    const token = tokenData.rtcToken;

    // Create web app URL with token
    const webAppUrl = `${HANGOUTS_WEB_URL}?room=${channelName}&token=${token}&uid=${userId}&username=${encodeURIComponent(username)}&type=private`;

    let text = `✅ ${t('hangouts.joinedCall', lang)}\n\n`;
    text += `🎥 ${t('hangouts.callId', lang)}: ${callId}\n`;
    text += `👥 ${t('hangouts.participants', lang)}: ${call.participants ? call.participants.length : 1}\n\n`;
    text += `💡 ${t('hangouts.clickToJoin', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('hangouts.openCall', lang), webAppUrl)],
      [Markup.button.callback(t('back', lang), 'hangouts_menu')],
    ]);

    await ctx.reply(text, keyboard);
  } catch (error) {
    logger.error('Error in joinPrivateCallById:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

/**
 * Show my active calls
 */
const showMyCalls = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    const calls = await VideoCallModel.getActiveByCreator(userId);

    let text = `📞 ${t('hangouts.myCalls', lang)}\n\n`;

    if (calls && calls.length > 0) {
      calls.forEach((call, index) => {
        const createdAt = call.createdAt.toDate ? call.createdAt.toDate() : new Date(call.createdAt);
        text += `${index + 1}. ${t('hangouts.call', lang)} \`${call.callId}\`\n`;
        text += `   👥 ${call.participants ? call.participants.length : 0} ${t('hangouts.participants', lang)}\n`;
        text += `   ⏰ ${moment(createdAt).format('HH:mm')}\n`;
        text += `   Status: ${call.status}\n\n`;
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

    // Verify user is the creator
    const call = await VideoCallModel.getById(callId);

    if (!call) {
      await ctx.answerCbQuery(t('hangouts.callNotFound', lang));
      return;
    }

    if (call.creatorId !== userId) {
      await ctx.answerCbQuery(t('hangouts.notHost', lang));
      return;
    }

    // End the call
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
