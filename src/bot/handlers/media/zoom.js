const { Markup } = require('telegraf');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Zoom room handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerZoomHandlers = (bot) => {
  // Show zoom menu
  bot.action('show_zoom', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      await ctx.editMessageText(
        t('zoomTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('createRoom', lang), 'zoom_create')],
          [Markup.button.callback(t('joinRoom', lang), 'zoom_join')],
          [Markup.button.callback(t('myRooms', lang), 'zoom_my_rooms')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing zoom menu:', error);
    }
  });

  // Create room
  bot.action('zoom_create', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';
      ctx.session.temp.creatingZoomRoom = true;
      ctx.session.temp.zoomRoomStep = 'name';
      await ctx.saveSession();

      await ctx.editMessageText(
        t('enterRoomName', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'show_zoom')],
        ]),
      );
    } catch (error) {
      logger.error('Error in zoom create:', error);
    }
  });

  // Join room
  bot.action('zoom_join', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      // In production, fetch active rooms from database
      const activeRooms = [
        { id: '1', name: 'Community Chat', host: 'PNPtv', participants: 15 },
        { id: '2', name: 'Music Session', host: 'DJ Alex', participants: 8 },
      ];

      if (activeRooms.length === 0) {
        await ctx.editMessageText(
          t('noActiveRooms', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_zoom')],
          ]),
        );
        return;
      }

      let message = `${t('joinRoom', lang)}\n\n`;
      const buttons = [];

      activeRooms.forEach((room) => {
        message += `🎥 ${room.name}\n👤 ${room.host}\n👥 ${room.participants} participants\n\n`;
        buttons.push([
          Markup.button.callback(`▶️ ${room.name}`, `zoom_join_${room.id}`),
        ]);
      });

      buttons.push([Markup.button.callback(t('back', lang), 'show_zoom')]);

      await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error('Error showing zoom rooms:', error);
    }
  });

  // My rooms
  bot.action('zoom_my_rooms', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      await ctx.editMessageText(
        `${t('myRooms', lang)}\n\nYour room history will appear here.`,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_zoom')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing my rooms:', error);
    }
  });

  // Handle room creation text input
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.creatingZoomRoom) {
      try {
        const lang = ctx.session.language || 'en';
        const step = ctx.session.temp.zoomRoomStep;

        if (step === 'name') {
          ctx.session.temp.zoomRoomName = ctx.message.text;
          ctx.session.temp.zoomRoomStep = 'privacy';
          await ctx.saveSession();

          await ctx.reply(
            t('roomPrivacy', lang),
            Markup.inlineKeyboard([
              [
                Markup.button.callback(t('publicRoom', lang), 'zoom_privacy_public'),
                Markup.button.callback(t('privateRoom', lang), 'zoom_privacy_private'),
              ],
              [Markup.button.callback(t('cancel', lang), 'show_zoom')],
            ]),
          );
          return;
        }
      } catch (error) {
        logger.error('Error in zoom room creation:', error);
      }
      return;
    }

    return next();
  });

  // Handle privacy selection
  bot.action(/^zoom_privacy_(.+)$/, async (ctx) => {
    try {
      const privacy = ctx.match[1];
      const lang = ctx.session.language || 'en';

      ctx.session.temp.zoomRoomPrivacy = privacy;
      await ctx.saveSession();

      // Create Zoom meeting
      await createZoomMeeting(ctx);
    } catch (error) {
      logger.error('Error setting zoom privacy:', error);
    }
  });
};

/**
 * Create Zoom meeting
 * @param {Context} ctx - Telegraf context
 */
const createZoomMeeting = async (ctx) => {
  try {
    const lang = ctx.session.language || 'en';
    const roomName = ctx.session.temp.zoomRoomName;
    const privacy = ctx.session.temp.zoomRoomPrivacy;

    await ctx.editMessageText(t('loading', lang));

    // Generate Zoom JWT token
    const token = generateZoomToken();

    // Create meeting via Zoom API
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: roomName,
        type: 2, // Scheduled meeting
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: privacy === 'public',
          mute_upon_entry: false,
          approval_type: privacy === 'public' ? 0 : 2,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { join_url, id: meetingId } = response.data;

    // Clear session temp data
    ctx.session.temp.creatingZoomRoom = false;
    ctx.session.temp.zoomRoomName = null;
    ctx.session.temp.zoomRoomPrivacy = null;
    await ctx.saveSession();

    await ctx.editMessageText(
      t('roomCreated', lang, { url: join_url }),
      Markup.inlineKeyboard([
        [Markup.button.url('🎥 Join Room', join_url)],
        [Markup.button.callback(t('back', lang), 'show_zoom')],
      ]),
    );

    logger.info('Zoom meeting created', { userId: ctx.from.id, meetingId });
  } catch (error) {
    logger.error('Error creating Zoom meeting:', error);
    const lang = ctx.session.language || 'en';
    await ctx.reply(t('error', lang));
  }
};

/**
 * Generate Zoom JWT token
 * @returns {string} JWT token
 */
const generateZoomToken = () => {
  const payload = {
    iss: process.env.ZOOM_API_KEY,
    exp: Date.now() + 5000,
  };

  return jwt.sign(payload, process.env.ZOOM_API_SECRET);
};

module.exports = registerZoomHandlers;
