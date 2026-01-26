const { Markup } = require('telegraf');
const VideoCallModel = require('../../../models/videoCallModel');
const MainRoomModel = require('../../../models/mainRoomModel');
const logger = require('../../../utils/logger');
const { isPrimeUser, safeReplyOrEdit } = require('../../utils/helpers');
const config = require('../../../config/config');

/**
 * Hangouts handlers for video calls and main rooms
 * @param {Telegraf} bot - Bot instance
 */
const registerHangoutsHandlers = (bot) => {
  const HANGOUTS_WEB_APP_URL = process.env.HANGOUTS_WEB_APP_URL || 'https://pnptv.app/hangouts';

  // ==========================================
  // HANGOUTS MENU
  // ==========================================

  /**
   * Show hangouts menu (replaces menu_hangouts in menu.js)
   * This provides the full hangouts experience with video calls and main rooms
   */
  bot.action('hangouts_menu', async (ctx) => {
    try {
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '🚧 ESTRENO EL FIN DE SEMANA' : '🚧 COMING OUT THIS WEEKEND',
        { show_alert: true }
      );
    } catch (error) {
      logger.error('Error in hangouts_menu:', error);
    }
  });

  // ==========================================
  // VIDEO CALLS (PRIME ONLY)
  // ==========================================

  /**
   * Create a new video call
   */
  bot.action('create_video_call', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';
      const user = ctx.session?.user || {};

      // Check PRIME status
      if (!isPrimeUser(user)) {
        const message = lang === 'es'
          ? '🔒 *Función PRIME*\n\nLas videollamadas requieren membresía PRIME.'
          : '🔒 *PRIME Feature*\n\nVideo calls require PRIME membership.';

        await safeReplyOrEdit(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '💎 Ver Planes' : '💎 View Plans', 'show_subscription_plans')],
            [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'hangouts_menu')],
          ]),
        });
        return;
      }

      // Create the call
      const call = await VideoCallModel.create({
        creatorId: ctx.from.id,
        creatorName: ctx.from.first_name || ctx.from.username || 'User',
        isPublic: false,
        maxParticipants: 10,
      });

      const webAppUrl = `${HANGOUTS_WEB_APP_URL}/call/${call.channelName}?token=${call.rtcToken}&uid=${ctx.from.id}`;
      const joinLink = `https://t.me/${ctx.botInfo.username}?start=call_${call.id}`;

      const message = lang === 'es'
        ? `✅ *¡Videollamada Creada!*\n\n` +
          `👥 Capacidad: 0/10 personas\n` +
          `🔗 Comparte: \`${joinLink}\`\n\n` +
          `Presiona "Lanzar" para iniciar la llamada.`
        : `✅ *Video Call Created!*\n\n` +
          `👥 Capacity: 0/10 people\n` +
          `🔗 Share: \`${joinLink}\`\n\n` +
          `Tap "Launch" to start the call.`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(lang === 'es' ? '🚀 Lanzar Llamada' : '🚀 Launch Call', webAppUrl)],
          [Markup.button.callback(lang === 'es' ? '❌ Terminar Llamada' : '❌ End Call', `end_call_${call.id}`)],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'hangouts_menu')],
        ]),
      });

      logger.info('Video call created', { callId: call.id, creatorId: ctx.from.id });
    } catch (error) {
      logger.error('Error creating video call:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error creando llamada' : '❌ Error creating call',
        { show_alert: true }
      );
    }
  });

  /**
   * End a video call (creator only)
   */
  bot.action(/^end_call_(.+)$/, async (ctx) => {
    try {
      const callId = ctx.match[1];
      const lang = ctx.session?.language || 'en';

      await VideoCallModel.endCall(callId, ctx.from.id);

      await ctx.answerCbQuery(
        lang === 'es' ? '✅ Llamada terminada' : '✅ Call ended',
        { show_alert: true }
      );

      // Return to hangouts menu
      await ctx.editMessageText(
        lang === 'es' ? '📞 Llamada terminada. Volviendo al menú...' : '📞 Call ended. Returning to menu...',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '📞 Hangouts' : '📞 Hangouts', 'hangouts_menu')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error ending call:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error terminando llamada' : '❌ Error ending call',
        { show_alert: true }
      );
    }
  });

  /**
   * Delete a video call (creator only, when empty)
   */
  bot.action(/^delete_call_(.+)$/, async (ctx) => {
    try {
      const callId = ctx.match[1];
      const lang = ctx.session?.language || 'en';

      await VideoCallModel.deleteCall(callId, ctx.from.id);

      await ctx.answerCbQuery(
        lang === 'es' ? '✅ Llamada eliminada' : '✅ Call deleted',
        { show_alert: true }
      );

      // Return to active calls
      await showActiveCalls(ctx);
    } catch (error) {
      logger.error('Error deleting call:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        error.message.includes('active participants')
          ? (lang === 'es' ? '❌ No se puede eliminar con participantes activos' : '❌ Cannot delete with active participants')
          : (lang === 'es' ? '❌ Error eliminando llamada' : '❌ Error deleting call'),
        { show_alert: true }
      );
    }
  });

  /**
   * Show user's active calls
   */
  bot.action('my_active_calls', async (ctx) => {
    await showActiveCalls(ctx);
  });

  async function showActiveCalls(ctx) {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const calls = await VideoCallModel.getActiveByCreator(ctx.from.id);

      if (calls.length === 0) {
        const message = lang === 'es'
          ? '📋 *Mis Llamadas Activas*\n\nNo tienes llamadas activas.'
          : '📋 *My Active Calls*\n\nYou have no active calls.';

        await safeReplyOrEdit(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🎥 Crear Llamada' : '🎥 Create Call', 'create_video_call')],
            [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'hangouts_menu')],
          ]),
        });
        return;
      }

      const callButtons = calls.map(call => {
        const label = `📞 ${call.title || 'Call'} (${call.currentParticipants}/${call.maxParticipants})`;
        return [Markup.button.callback(label, `view_call_${call.id}`)];
      });

      const message = lang === 'es'
        ? `📋 *Mis Llamadas Activas*\n\nTienes ${calls.length} llamada(s) activa(s):`
        : `📋 *My Active Calls*\n\nYou have ${calls.length} active call(s):`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...callButtons,
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'hangouts_menu')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing active calls:', error);
    }
  }

  /**
   * View call details
   */
  bot.action(/^view_call_(.+)$/, async (ctx) => {
    try {
      const callId = ctx.match[1];
      const lang = ctx.session?.language || 'en';

      const call = await VideoCallModel.getById(callId);

      if (!call) {
        await ctx.answerCbQuery(
          lang === 'es' ? '❌ Llamada no encontrada' : '❌ Call not found',
          { show_alert: true }
        );
        return;
      }

      const webAppUrl = `${HANGOUTS_WEB_APP_URL}/call/${call.channelName}?token=${call.rtcToken}&uid=${ctx.from.id}`;
      const joinLink = `https://t.me/${ctx.botInfo.username}?start=call_${call.id}`;

      const message = lang === 'es'
        ? `📞 *Detalles de Llamada*\n\n` +
          `👥 Participantes: ${call.currentParticipants}/${call.maxParticipants}\n` +
          `📅 Creada: ${new Date(call.createdAt).toLocaleString()}\n` +
          `🔗 Compartir: \`${joinLink}\``
        : `📞 *Call Details*\n\n` +
          `👥 Participants: ${call.currentParticipants}/${call.maxParticipants}\n` +
          `📅 Created: ${new Date(call.createdAt).toLocaleString()}\n` +
          `🔗 Share: \`${joinLink}\``;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(lang === 'es' ? '🚀 Entrar' : '🚀 Join', webAppUrl)],
          [Markup.button.callback(lang === 'es' ? '❌ Terminar' : '❌ End', `end_call_${call.id}`)],
          [Markup.button.callback(lang === 'es' ? '🗑️ Eliminar' : '🗑️ Delete', `delete_call_${call.id}`)],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'my_active_calls')],
        ]),
      });
    } catch (error) {
      logger.error('Error viewing call:', error);
    }
  });

  // ==========================================
  // MAIN ROOMS (AVAILABLE TO ALL)
  // ==========================================

  /**
   * Join a main room
   */
  bot.action(/^join_main_room_(\d)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const roomId = parseInt(ctx.match[1]);
      const lang = ctx.session?.language || 'en';

      const room = await MainRoomModel.getById(roomId);

      if (!room) {
        await ctx.answerCbQuery(
          lang === 'es' ? '❌ Sala no encontrada' : '❌ Room not found',
          { show_alert: true }
        );
        return;
      }

      // Join the room (as viewer by default)
      const { rtcToken, rtmToken } = await MainRoomModel.joinRoom(
        roomId,
        ctx.from.id,
        ctx.from.first_name || ctx.from.username || 'User',
        false // Start as viewer
      );

      const webAppUrl = `${HANGOUTS_WEB_APP_URL}/room/${roomId}?rtc=${rtcToken}&rtm=${rtmToken}&uid=${ctx.from.id}`;

      // Also provide Jitsi fallback
      const displayName = ctx.from.first_name || ctx.from.username || 'User';
      const jitsiUrl = `https://meet.jit.si/pnptv-main-room-${roomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

      const message = lang === 'es'
        ? `🏠 *${room.name}*\n\n` +
          `${room.description}\n\n` +
          `👥 ${room.currentParticipants}/50 participantes\n\n` +
          `Elige cómo quieres entrar:`
        : `🏠 *${room.name}*\n\n` +
          `${room.description}\n\n` +
          `👥 ${room.currentParticipants}/50 participants\n\n` +
          `Choose how to join:`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(lang === 'es' ? '🚀 Entrar (Agora)' : '🚀 Join (Agora)', webAppUrl)],
          [Markup.button.url(lang === 'es' ? '🎥 Entrar (Jitsi)' : '🎥 Join (Jitsi)', jitsiUrl)],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'hangouts_menu')],
        ]),
      });

      logger.info('User joining main room', { roomId, userId: ctx.from.id });
    } catch (error) {
      logger.error('Error joining main room:', error);
      const lang = ctx.session?.language || 'en';

      if (error.message.includes('full')) {
        await ctx.answerCbQuery(
          lang === 'es' ? '❌ La sala está llena' : '❌ Room is full',
          { show_alert: true }
        );
      } else {
        await ctx.answerCbQuery(
          lang === 'es' ? '❌ Error al entrar' : '❌ Error joining',
          { show_alert: true }
        );
      }
    }
  });

  // ==========================================
  // DEEPLINK HANDLERS
  // ==========================================

  /**
   * Handle /start call_<id> deeplink for joining calls
   */
  bot.start(async (ctx, next) => {
    const payload = ctx.startPayload;

    if (payload && payload.startsWith('call_')) {
      const callId = payload.replace('call_', '');
      const lang = ctx.session?.language || 'en';

      try {
        const call = await VideoCallModel.getById(callId);

        if (!call || !call.isActive) {
          await ctx.reply(
            lang === 'es' ? '❌ Esta llamada ya no está disponible.' : '❌ This call is no longer available.'
          );
          return;
        }

        // Join the call
        const { rtcToken, rtmToken } = await VideoCallModel.joinCall(
          callId,
          ctx.from.id,
          ctx.from.first_name || ctx.from.username || 'User',
          false // Not a guest
        );

        const webAppUrl = `${HANGOUTS_WEB_APP_URL}/call/${call.channelName}?token=${rtcToken}&uid=${ctx.from.id}`;

        const message = lang === 'es'
          ? `📞 *Unirse a Videollamada*\n\n` +
            `Creada por: ${call.creatorName}\n` +
            `👥 ${call.currentParticipants}/${call.maxParticipants} participantes\n\n` +
            `Presiona el botón para entrar:`
          : `📞 *Join Video Call*\n\n` +
            `Created by: ${call.creatorName}\n` +
            `👥 ${call.currentParticipants}/${call.maxParticipants} participants\n\n` +
            `Tap the button to join:`;

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp(lang === 'es' ? '🚀 Entrar a Llamada' : '🚀 Join Call', webAppUrl)],
          ]),
        });

        logger.info('User joining call via deeplink', { callId, userId: ctx.from.id });
        return;
      } catch (error) {
        logger.error('Error joining call via deeplink:', error);
        await ctx.reply(
          lang === 'es' ? '❌ Error al unirse a la llamada.' : '❌ Error joining the call.'
        );
        return;
      }
    }

    // Continue to next handler if not a call deeplink
    return next();
  });
};

module.exports = registerHangoutsHandlers;
