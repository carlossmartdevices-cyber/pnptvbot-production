const { Markup } = require('telegraf');
const radioStreamManager = require('../../../services/radio/radioStreamManager');
const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');
const { safeReplyOrEdit } = require('../../utils/helpers');

/**
 * Radio handlers for 24/7 streaming
 * @param {Telegraf} bot - Bot instance
 */
const registerRadioHandlers = (bot) => {
  const RADIO_WEB_APP_URL = process.env.RADIO_WEB_APP_URL || 'https://pnptv.app/radio';

  // ==========================================
  // RADIO MENU
  // ==========================================

  /**
   * Show radio menu with now playing info
   */
  bot.action('menu_radio', async (ctx) => {
    try {
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '🚧 ESTRENO EL FIN DE SEMANA' : '🚧 COMING OUT THIS WEEKEND',
        { show_alert: true }
      );
    } catch (error) {
      logger.error('Error handling menu_radio:', error);
    }
  });
          [Markup.button.callback(
            lang === 'es' ? '📋 Ver Playlist' : '📋 View Playlist',
            'radio_playlist'
          )],


  // ==========================================
  // LISTEN TO RADIO
  // ==========================================

  /**
   * Open radio player
   */
  bot.action('radio_listen', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      // Generate listener token
      const tokens = await radioStreamManager.generateListenerToken(ctx.from.id);

      const webAppUrl = `${RADIO_WEB_APP_URL}?token=${tokens.rtcToken}&uid=${ctx.from.id}`;

      const message = lang === 'es'
        ? `🎧 *Escuchar PNPtv Radio*\n\n` +
          `Presiona el botón para abrir el reproductor.`
        : `🎧 *Listen to PNPtv Radio*\n\n` +
          `Tap the button to open the player.`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(
            lang === 'es' ? '🎧 Abrir Reproductor' : '🎧 Open Player',
            webAppUrl
          )],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu_radio')],
        ]),
      });

      logger.info('User opening radio player', { userId: ctx.from.id });
    } catch (error) {
      logger.error('Error opening radio player:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error abriendo reproductor' : '❌ Error opening player',
        { show_alert: true }
      );
    }
  });

  // ==========================================
  // PLAYLIST
  // ==========================================

  /**
   * View current playlist
   */
  bot.action('radio_playlist', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      // Get recent tracks
      const result = await query(
        `SELECT title, artist, type
         FROM radio_tracks
         WHERE is_active = true
         ORDER BY play_order ASC NULLS LAST, created_at DESC
         LIMIT 10`
      );

      if (result.rows.length === 0) {
        const message = lang === 'es'
          ? '📋 *Playlist*\n\nNo hay canciones en la playlist.'
          : '📋 *Playlist*\n\nNo songs in the playlist.';

        await safeReplyOrEdit(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu_radio')],
          ]),
        });
        return;
      }

      const trackList = result.rows.map((track, index) => {
        const typeEmoji = track.type === 'podcast' ? '🎙️' : track.type === 'talkshow' ? '🎤' : '🎵';
        return `${index + 1}. ${typeEmoji} ${track.title}\n   • ${track.artist || (lang === 'es' ? 'Desconocido' : 'Unknown')}`;
      }).join('\n\n');

      const message = lang === 'es'
        ? `📋 *Playlist de Radio*\n\n${trackList}\n\n_Mostrando ${result.rows.length} canciones_`
        : `📋 *Radio Playlist*\n\n${trackList}\n\n_Showing ${result.rows.length} tracks_`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(
            lang === 'es' ? '🎧 Escuchar' : '🎧 Listen',
            'radio_listen'
          )],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu_radio')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing playlist:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error cargando playlist' : '❌ Error loading playlist',
        { show_alert: true }
      );
    }
  });

  // ==========================================
  // SONG REQUEST
  // ==========================================

  /**
   * Start song request flow
   */
  bot.action('radio_request', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      // Set session state for request
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.awaitingRadioRequest = true;
      await ctx.saveSession();

      const message = lang === 'es'
        ? `🎵 *Solicitar Canción*\n\n` +
          `Escribe el nombre de la canción y artista que quieres escuchar.\n\n` +
          `Ejemplo: "Despacito - Luis Fonsi"`
        : `🎵 *Request a Song*\n\n` +
          `Type the name of the song and artist you want to hear.\n\n` +
          `Example: "Despacito - Luis Fonsi"`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '❌ Cancelar' : '❌ Cancel', 'radio_request_cancel')],
        ]),
      });
    } catch (error) {
      logger.error('Error starting song request:', error);
    }
  });

  /**
   * Handle song request text
   */
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.temp?.awaitingRadioRequest) {
      const lang = ctx.session?.language || 'en';
      const songName = ctx.message.text;

      // Clear the awaiting state
      ctx.session.temp.awaitingRadioRequest = false;
      await ctx.saveSession();

      try {
        // Save the request
        await query(
          `INSERT INTO radio_requests (user_id, song_name, status, requested_at)
           VALUES ($1, $2, 'pending', NOW())
           ON CONFLICT DO NOTHING`,
          [ctx.from.id.toString(), songName]
        );

        const message = lang === 'es'
          ? `✅ *Solicitud Enviada*\n\n` +
            `Tu solicitud para "${songName}" ha sido enviada.\n` +
            `Los administradores la revisarán pronto.`
          : `✅ *Request Submitted*\n\n` +
            `Your request for "${songName}" has been submitted.\n` +
            `Admins will review it soon.`;

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '📻 Volver a Radio' : '📻 Back to Radio', 'menu_radio')],
          ]),
        });

        logger.info('Song request submitted', { userId: ctx.from.id, songName });
      } catch (error) {
        logger.error('Error submitting song request:', error);
        await ctx.reply(
          lang === 'es' ? '❌ Error enviando solicitud' : '❌ Error submitting request'
        );
      }

      return;
    }

    return next();
  });

  /**
   * Cancel song request
   */
  bot.action('radio_request_cancel', async (ctx) => {
    ctx.session.temp = ctx.session.temp || {};
    ctx.session.temp.awaitingRadioRequest = false;
    await ctx.saveSession();

    // Return to radio menu
    await ctx.answerCbQuery();
    const lang = ctx.session?.language || 'en';

    // Trigger radio menu
    await bot.handleUpdate({
      ...ctx.update,
      callback_query: {
        ...ctx.update.callback_query,
        data: 'menu_radio',
      },
    });
  });

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  /**
   * Subscribe to radio notifications
   */
  bot.action('radio_subscribe', async (ctx) => {
    try {
      const lang = ctx.session?.language || 'en';

      await query(
        `INSERT INTO radio_subscribers (user_id, notify_now_playing, subscribed_at)
         VALUES ($1, true, NOW())
         ON CONFLICT (user_id) DO UPDATE SET notify_now_playing = true`,
        [ctx.from.id.toString()]
      );

      await ctx.answerCbQuery(
        lang === 'es' ? '✅ ¡Suscrito! Recibirás notificaciones.' : '✅ Subscribed! You will receive notifications.',
        { show_alert: true }
      );

      logger.info('User subscribed to radio', { userId: ctx.from.id });

      // Refresh menu
      await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
          ...ctx.update.callback_query,
          data: 'menu_radio',
        },
      });
    } catch (error) {
      logger.error('Error subscribing to radio:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error al suscribirse' : '❌ Error subscribing',
        { show_alert: true }
      );
    }
  });

  /**
   * Unsubscribe from radio notifications
   */
  bot.action('radio_unsubscribe', async (ctx) => {
    try {
      const lang = ctx.session?.language || 'en';

      await query(
        `UPDATE radio_subscribers
         SET notify_now_playing = false
         WHERE user_id = $1`,
        [ctx.from.id.toString()]
      );

      await ctx.answerCbQuery(
        lang === 'es' ? '✅ Suscripción cancelada' : '✅ Unsubscribed',
        { show_alert: true }
      );

      logger.info('User unsubscribed from radio', { userId: ctx.from.id });

      // Refresh menu
      await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
          ...ctx.update.callback_query,
          data: 'menu_radio',
        },
      });
    } catch (error) {
      logger.error('Error unsubscribing from radio:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es' ? '❌ Error al cancelar suscripción' : '❌ Error unsubscribing',
        { show_alert: true }
      );
    }
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  /**
   * Check if user is subscribed to radio
   */
  async function isUserSubscribed(userId) {
    try {
      const result = await query(
        `SELECT notify_now_playing
         FROM radio_subscribers
         WHERE user_id = $1`,
        [userId.toString()]
      );

      return result.rows.length > 0 && result.rows[0].notify_now_playing;
    } catch (error) {
      logger.error('Error checking subscription:', error);
      return false;
    }
  }
};

module.exports = registerRadioHandlers;
