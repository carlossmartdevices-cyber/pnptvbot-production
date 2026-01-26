const { Markup } = require('telegraf');
const MediaPlayerModel = require('../../../models/mediaPlayerModel');
const radioStreamManager = require('../../../services/radio/radioStreamManager');
const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');
const { safeReplyOrEdit } = require('../../utils/helpers');

/**
 * Videorama handlers - Media center with Radio integration
 * @param {Telegraf} bot - Bot instance
 */
const registerVideoramaHandlers = (bot) => {
  const VIDEORAMA_WEB_APP_URL = process.env.VIDEORAMA_WEB_APP_URL || 'https://pnptv.app/videorama-app';
  const RADIO_WEB_APP_URL = process.env.RADIO_WEB_APP_URL || 'https://pnptv.app/radio';

  // ==========================================
  // VIDEORAMA MENU
  // ==========================================

  /**
   * Show Videorama menu with media stats and radio integration
   */
  bot.action('menu_videorama', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      // Get media stats
      const mediaStats = await getMediaStats();
      const radioStatus = await getRadioStatus();

      const radioStatusText = radioStatus.isPlaying
        ? (lang === 'es'
          ? `🎵 *En Vivo:* ${radioStatus.track?.title || 'PNPtv Radio'}`
          : `🎵 *Live:* ${radioStatus.track?.title || 'PNPtv Radio'}`)
        : (lang === 'es' ? '📻 Radio disponible 24/7' : '📻 Radio available 24/7');

      const message = lang === 'es'
        ? `🎬 *PNPtv Videorama*\n\n` +
          `Tu centro de entretenimiento.\n\n` +
          `📹 *${mediaStats.videos}* Videos\n` +
          `🎵 *${mediaStats.music}* Pistas de Música\n` +
          `🎙️ *${mediaStats.podcasts}* Podcasts\n\n` +
          `${radioStatusText}\n\n` +
          `Elige una opción:`
        : `🎬 *PNPtv Videorama*\n\n` +
          `Your entertainment center.\n\n` +
          `📹 *${mediaStats.videos}* Videos\n` +
          `🎵 *${mediaStats.music}* Music Tracks\n` +
          `🎙️ *${mediaStats.podcasts}* Podcasts\n\n` +
          `${radioStatusText}\n\n` +
          `Choose an option:`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(
            lang === 'es' ? '🎬 Abrir Videorama' : '🎬 Open Videorama',
            VIDEORAMA_WEB_APP_URL
          )],
          [
            Markup.button.callback(lang === 'es' ? '📹 Videos' : '📹 Videos', 'videorama_videos'),
            Markup.button.callback(lang === 'es' ? '🎵 Música' : '🎵 Music', 'videorama_music'),
          ],
          [
            Markup.button.callback(lang === 'es' ? '🎙️ Podcasts' : '🎙️ Podcasts', 'videorama_podcasts'),
            Markup.button.callback(lang === 'es' ? '📻 Radio' : '📻 Radio', 'menu_radio'),
          ],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'back_to_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in menu_videorama:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(lang === 'es' ? '❌ Error' : '❌ Error');
    }
  });

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================

  /**
   * Show videos category
   */
  bot.action('videorama_videos', async (ctx) => {
    await showMediaCategory(ctx, 'video', '📹');
  });

  /**
   * Show music category
   */
  bot.action('videorama_music', async (ctx) => {
    await showMediaCategory(ctx, 'audio', '🎵');
  });

  /**
   * Show podcasts category
   */
  bot.action('videorama_podcasts', async (ctx) => {
    await showMediaCategory(ctx, 'podcast', '🎙️');
  });

  /**
   * Show media by category
   */
  async function showMediaCategory(ctx, type, emoji) {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const media = await MediaPlayerModel.getMediaLibrary(type, 10);

      if (media.length === 0) {
        const message = lang === 'es'
          ? `${emoji} *Sin contenido*\n\nNo hay contenido disponible en esta categoría todavía.`
          : `${emoji} *No content*\n\nNo content available in this category yet.`;

        await safeReplyOrEdit(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu_videorama')],
          ]),
        });
        return;
      }

      const typeName = type === 'video' ? (lang === 'es' ? 'Videos' : 'Videos')
        : type === 'audio' ? (lang === 'es' ? 'Música' : 'Music')
        : (lang === 'es' ? 'Podcasts' : 'Podcasts');

      const mediaList = media.slice(0, 8).map((item, index) => {
        const duration = item.duration ? formatDuration(item.duration) : '';
        return `${index + 1}. *${item.title}*\n   ${item.artist || (lang === 'es' ? 'Desconocido' : 'Unknown')} ${duration ? `• ${duration}` : ''}`;
      }).join('\n\n');

      const message = lang === 'es'
        ? `${emoji} *${typeName}*\n\n${mediaList}\n\n_Abre Videorama para ver más_`
        : `${emoji} *${typeName}*\n\n${mediaList}\n\n_Open Videorama to see more_`;

      await safeReplyOrEdit(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp(
            lang === 'es' ? '🎬 Abrir Videorama' : '🎬 Open Videorama',
            `${VIDEORAMA_WEB_APP_URL}?view=${type}`
          )],
          [Markup.button.callback(lang === 'es' ? '⬅️ Volver' : '⬅️ Back', 'menu_videorama')],
        ]),
      });
    } catch (error) {
      logger.error('Error showing media category:', error);
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(lang === 'es' ? '❌ Error' : '❌ Error');
    }
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  /**
   * Get media library stats
   */
  async function getMediaStats() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'video') as videos,
          COUNT(*) FILTER (WHERE type = 'audio') as music,
          COUNT(*) FILTER (WHERE type = 'podcast') as podcasts
        FROM media_library
        WHERE is_public = true
      `);

      const stats = result.rows[0] || {};
      return {
        videos: parseInt(stats.videos) || 0,
        music: parseInt(stats.music) || 0,
        podcasts: parseInt(stats.podcasts) || 0,
      };
    } catch (error) {
      logger.error('Error getting media stats:', error);
      return { videos: 0, music: 0, podcasts: 0 };
    }
  }

  /**
   * Get radio status for integration
   */
  async function getRadioStatus() {
    try {
      const nowPlaying = await radioStreamManager.getNowPlaying();
      const channelInfo = radioStreamManager.getChannelInfo();

      return {
        isPlaying: channelInfo?.isPlaying || false,
        track: nowPlaying?.track || null,
        listenerCount: nowPlaying?.listenerCount || 0,
      };
    } catch (error) {
      logger.error('Error getting radio status:', error);
      return { isPlaying: false, track: null, listenerCount: 0 };
    }
  }

  /**
   * Format duration in seconds to MM:SS or HH:MM:SS
   */
  function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};

module.exports = registerVideoramaHandlers;
