const { Markup } = require('telegraf');
const moment = require('moment');
const VideoCallModel = require('../../../models/videoCallModel');
const JitsiRoomModel = require('../../../models/jitsiRoomModel');
const MainRoomModel = require('../../../models/mainRoomModel');
const AgoraTokenService = require('../../../services/agora/agoraTokenService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

// Jitsi Meet URL for all rooms (no authentication required)
const JITSI_MEET_URL = process.env.JITSI_MEET_URL || 'https://meet.jit.si';

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

  // Show main rooms list
  bot.action('hangouts_join_main', async (ctx) => {
    try {
      await showMainRoomsList(ctx);
    } catch (error) {
      logger.error('Error showing main rooms list:', error);
    }
  });

  // Join specific main room
  bot.action(/hangouts_join_room_(\d+)/, async (ctx) => {
    try {
      const roomId = parseInt(ctx.match[1]);
      await joinMainRoom(ctx, roomId);
    } catch (error) {
      logger.error('Error joining main room:', error);
    }
  });

  // Create private room
  bot.action('hangouts_create_private', async (ctx) => {
    try {
      await createPrivateRoom(ctx);
    } catch (error) {
      logger.error('Error creating private room:', error);
    }
  });

  // Show list of private rooms
  bot.action('hangouts_join_private', async (ctx) => {
    try {
      await showPrivateRoomsList(ctx);
    } catch (error) {
      logger.error('Error showing private rooms list:', error);
    }
  });

  // Join specific private room
  bot.action(/hangouts_join_private_(\w+)/, async (ctx) => {
    try {
      const roomId = ctx.match[1];
      await joinPrivateRoomById(ctx, roomId);
    } catch (error) {
      logger.error('Error joining private room:', error);
    }
  });

  // My active rooms
  bot.action('hangouts_my_rooms', async (ctx) => {
    try {
      await showMyRooms(ctx);
    } catch (error) {
      logger.error('Error showing my rooms:', error);
    }
  });

  // End room action
  bot.action(/hangouts_end_(.+)/, async (ctx) => {
    try {
      const roomId = ctx.match[1];
      await endRoom(ctx, roomId);
    } catch (error) {
      logger.error('Error ending room:', error);
    }
  });

  // Delete video call room action
  bot.action(/hangouts_delete_call_(.+)/, async (ctx) => {
    try {
      const roomId = ctx.match[1];
      await deleteVideoCallRoom(ctx, roomId);
    } catch (error) {
      logger.error('Error deleting video call room:', error);
    }
  });

  // Delete Jitsi room action
  bot.action(/hangouts_delete_jitsi_(\d+)/, async (ctx) => {
    try {
      const roomId = parseInt(ctx.match[1]);
      await deleteJitsiRoom(ctx, roomId);
    } catch (error) {
      logger.error('Error deleting Jitsi room:', error);
    }
  });

  // Delete main room action
  bot.action(/hangouts_delete_main_(\d+)/, async (ctx) => {
    try {
      const roomId = parseInt(ctx.match[1]);
      await deleteMainRoom(ctx, roomId);
    } catch (error) {
      logger.error('Error deleting main room:', error);
    }
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
      [Markup.button.callback('🏠 Join PNPtv! Main Rooms', 'hangouts_join_main')],
      [
        Markup.button.callback('➕ Create Private Room', 'hangouts_create_private'),
        Markup.button.callback('🚪 Join Private Room', 'hangouts_join_private'),
      ],
      [Markup.button.callback('📱 My Active Rooms', 'hangouts_my_rooms')],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showHangoutsMenu:', error);
  }
};

/**
 * Show list of main rooms with active participants
 */
const showMainRoomsList = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Get all main rooms
    const rooms = await MainRoomModel.getAll();

    let text = `🏠 ${t('hangouts.mainRoomsTitle', lang) || 'Join PNPtv! Main Rooms'}\n\n`;
    text += `${t('hangouts.selectRoom', lang) || 'Select a room to join:'}\n\n`;

    // Build buttons for each room
    const buttons = [];

    for (const room of rooms) {
      if (room.isActive) {
        // Get participant count
        let participantCount = 0;
        try {
          const participants = await MainRoomModel.getParticipants(room.id);
          participantCount = participants.length;
        } catch (error) {
          logger.debug(`Could not get participants for room ${room.id}:`, error);
        }

        const roomText = `${room.name} (${participantCount}/${room.maxParticipants})`;
        text += `🎥 ${roomText}\n`;
        buttons.push([
          Markup.button.callback(roomText, `hangouts_join_room_${room.id}`)
        ]);
      }
    }

    // Add back button
    buttons.push([Markup.button.callback(t('back', lang), 'hangouts_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showMainRoomsList:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

/**
 * Show list of private rooms
 */
const showPrivateRoomsList = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Get all active private rooms (public or available)
    const allRooms = await VideoCallModel.getAll();
    const activeRooms = allRooms.filter(room => room.isActive);

    let text = `🚪 Join Private Room\n\n`;
    text += `Select a room to join:\n\n`;

    // Build buttons for each active room
    const buttons = [];

    if (activeRooms && activeRooms.length > 0) {
      for (const room of activeRooms) {
        // Get participant count
        let participantCount = 0;
        try {
          const participants = await VideoCallModel.getParticipants(room.id);
          participantCount = participants.length;
        } catch (error) {
          logger.debug(`Could not get participants for room ${room.id}:`, error);
        }

        const roomText = `${room.title} (${participantCount}/${room.maxParticipants})`;
        text += `🎥 ${roomText}\n`;
        text += `   👤 Host: ${room.creatorName}\n\n`;
        buttons.push([
          Markup.button.callback(roomText, `hangouts_join_private_${room.id}`)
        ]);
      }
    } else {
      text += `No active private rooms available.\n`;
    }

    // Add back button
    buttons.push([Markup.button.callback(t('back', lang), 'hangouts_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showPrivateRoomsList:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

/**
 * Join main room
 * @param {number} roomId - Room ID to join (1, 2, or 3)
 */
const joinMainRoom = async (ctx, roomId = 1) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Get room info first
    const room = await MainRoomModel.getById(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isActive) {
      throw new Error('Room is not active');
    }

    // Join the specified main room to track participants
    const result = await MainRoomModel.joinRoom(roomId, userId, username, true); // true = as publisher (can broadcast)

    // Get current participants count
    const participants = await MainRoomModel.getParticipants(roomId);

    // Use Jitsi Meet directly - no authentication, no moderator required
    // Format: https://meet.jit.si/{roomName}#config.prejoinPageEnabled=false&userInfo.displayName={name}
    const jitsiUrl = `${JITSI_MEET_URL}/${encodeURIComponent(room.channelName)}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(username)}`;

    const webAppUrl = jitsiUrl;

    let text = `✅ Joined Main Room!\n\n`;
    text += `🎥 Room: ${result.room.name}\n`;
    text += `👥 Participants: ${participants.length}\n\n`;
    text += `💡 Click "Open Room" to join`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🎥 Open Room', webAppUrl)],
      [Markup.button.callback('🔙 Back to Menu', 'hangouts_menu')],
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
 * Create private room
 */
const createPrivateRoom = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Create private room using correct API
    const result = await VideoCallModel.create({
      creatorId: userId,
      creatorName: username,
      title: `${username}'s Room`,
      maxParticipants: 10,
      enforceCamera: false,
      allowGuests: true,
      isPublic: false,
    });

    // Generate Jitsi Meet URL for private rooms (instead of Agora)
    // Use the channel name as the Jitsi room ID
    const jitsiUrl = `${JITSI_MEET_URL}/${result.channelName}#config.prejoinPageEnabled=false&userInfo.displayName="${encodeURIComponent(username)}"`;

    let text = `✅ Private Room Created!\n\n`;
    text += `🎥 Room ID: \`${result.id}\`\n`;
    text += `🔗 Share this ID with others to invite them\n\n`;
    text += `💡 Click "Open Room" to join via Jitsi Meet\n`;
    text += `🎯 Room: ${result.channelName}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🎥 Open Room (Jitsi)', jitsiUrl)],
      [Markup.button.callback('🚪 End Room', `hangouts_end_${result.id}`)],
      [Markup.button.callback('🔙 Back to Menu', 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in createPrivateRoom:', error);
    const lang = getLanguage(ctx);
    await ctx.reply(t('error', lang));
  }
};

/**
 * Join private room by ID
 */
const joinPrivateRoomById = async (ctx, roomId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Join room using correct API - joinCall handles everything
    const result = await VideoCallModel.joinCall(roomId, userId, username, false); // false = not guest

    // Get current participants count
    const participants = await VideoCallModel.getParticipants(roomId);

    // Generate Jitsi Meet URL for private rooms (instead of Agora)
    const jitsiUrl = `${JITSI_MEET_URL}/${result.call.channelName}#config.prejoinPageEnabled=false&userInfo.displayName="${encodeURIComponent(username)}"`;

    let text = `✅ Joined Private Room!\n\n`;
    text += `🎥 Room ID: ${roomId}\n`;
    text += `👥 Participants: ${participants.length}\n\n`;
    text += `💡 Click "Open Room" to join via Jitsi Meet\n`;
    text += `🎯 Room: ${result.call.channelName}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🎥 Open Room (Jitsi)', jitsiUrl)],
      [Markup.button.callback('🔙 Back to Menu', 'hangouts_menu')],
    ]);

    await ctx.reply(text, keyboard);
  } catch (error) {
    logger.error('Error in joinPrivateRoomById:', error);
    const lang = getLanguage(ctx);

    // Handle specific errors
    if (error.message.includes('not found')) {
      await ctx.reply('Room not found. Please check the Room ID.');
    } else if (error.message.includes('ended')) {
      await ctx.reply('This room has ended.');
    } else if (error.message.includes('full')) {
      await ctx.reply('This room is full.');
    } else {
      await ctx.reply(t('error', lang));
    }
  }
};

/**
 * Show my active rooms
 */
const showMyRooms = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Use correct API method
    const rooms = await VideoCallModel.getActiveByCreator(userId);

    let text = `📱 My Active Rooms\n\n`;

    if (rooms && rooms.length > 0) {
      rooms.forEach((room, index) => {
        const createdAt = room.createdAt;
        text += `${index + 1}. Room \`${room.id}\`\n`;
        text += `   📝 ${room.title}\n`;
        text += `   👥 ${room.currentParticipants || 0} participants\n`;
        text += `   ⏰ ${moment(createdAt).format('HH:mm')}\n`;
        text += `   Status: ${room.isActive ? 'Active' : 'Ended'}\n\n`;
      });
    } else {
      text += 'No active rooms found.';
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh', 'hangouts_my_rooms')],
      [Markup.button.callback('🔙 Back to Menu', 'hangouts_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showMyRooms:', error);
  }
};

/**
 * End a room
 */
const endRoom = async (ctx, roomId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Verify user is the host - use correct API
    const room = await VideoCallModel.getById(roomId);

    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }

    if (room.creatorId !== String(userId)) {
      await ctx.answerCbQuery('Only the host can end this room');
      return;
    }

    // End the room - pass creatorId
    await VideoCallModel.endCall(roomId, userId);

    await ctx.answerCbQuery('Room ended successfully');
    await showHangoutsMenu(ctx);
  } catch (error) {
    logger.error('Error in endRoom:', error);
    const lang = getLanguage(ctx);
    await ctx.answerCbQuery(t('error', lang));
  }
};

/**
 * Delete a video call room (only when empty)
 */
const deleteVideoCallRoom = async (ctx, roomId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Verify user is the creator
    const room = await VideoCallModel.getById(roomId);

    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }

    if (room.creatorId !== String(userId)) {
      await ctx.answerCbQuery('Only the creator can delete this room');
      return;
    }

    // Delete the room
    await VideoCallModel.deleteCall(roomId, userId);

    await ctx.answerCbQuery('Room deleted successfully');
    await ctx.reply('✅ Your video call room has been deleted.');
    await showHangoutsMenu(ctx);
  } catch (error) {
    logger.error('Error in deleteVideoCallRoom:', error);

    // Handle specific errors
    if (error.message.includes('active participants')) {
      await ctx.answerCbQuery('Cannot delete: room still has active participants');
      await ctx.reply('⚠️ Cannot delete room with active participants. Please wait for all participants to leave.');
    } else {
      await ctx.answerCbQuery(t('error', lang));
    }
  }
};

/**
 * Delete a Jitsi room (only when empty)
 */
const deleteJitsiRoom = async (ctx, roomId) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Verify user is the host
    const room = await JitsiRoomModel.getById(roomId);

    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }

    if (room.host_user_id !== String(userId)) {
      await ctx.answerCbQuery('Only the host can delete this room');
      return;
    }

    // Delete the room
    await JitsiRoomModel.hardDelete(roomId, userId);

    await ctx.answerCbQuery('Room deleted successfully');
    await ctx.reply('✅ Your Jitsi room has been deleted.');
    await showHangoutsMenu(ctx);
  } catch (error) {
    logger.error('Error in deleteJitsiRoom:', error);

    // Handle specific errors
    if (error.message.includes('active participants')) {
      await ctx.answerCbQuery('Cannot delete: room still has active participants');
      await ctx.reply('⚠️ Cannot delete room with active participants. Please wait for all participants to leave.');
    } else {
      await ctx.answerCbQuery(t('error', lang));
    }
  }
};

/**
 * Delete a main room (only when empty)
 */
const deleteMainRoom = async (ctx, roomId) => {
  try {
    const lang = getLanguage(ctx);

    // Delete the room
    await MainRoomModel.deleteRoom(roomId);

    await ctx.answerCbQuery('Room deleted successfully');
    await ctx.reply('✅ Main room has been deleted.');
    await showHangoutsMenu(ctx);
  } catch (error) {
    logger.error('Error in deleteMainRoom:', error);

    // Handle specific errors
    if (error.message.includes('active participants')) {
      await ctx.answerCbQuery('Cannot delete: room still has active participants');
      await ctx.reply('⚠️ Cannot delete room with active participants. Please wait for all participants to leave.');
    } else {
      await ctx.answerCbQuery(t('error', lang));
    }
  }
};

module.exports = registerHangoutsHandlers;
