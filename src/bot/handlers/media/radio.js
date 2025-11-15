const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Radio handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerRadioHandlers = (bot) => {
  // Show radio menu
  bot.action('show_radio', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      await ctx.editMessageText(
        t('radioTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('listenNow', lang), 'radio_listen')],
          [Markup.button.callback(t('requestSong', lang), 'radio_request')],
          [Markup.button.callback(t('nowPlaying', lang), 'radio_now_playing')],
          [Markup.button.callback(t('radioSchedule', lang), 'radio_schedule')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing radio menu:', error);
    }
  });

  // Listen now
  bot.action('radio_listen', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';
      const streamUrl = process.env.RADIO_STREAM_URL || 'https://stream.pnptv.com/radio';

      await ctx.editMessageText(
        `${t('radioTitle', lang)}\n\n${t('streamUrl', lang, { url: streamUrl })}\n\n🎧 Click the link to start listening!`,
        Markup.inlineKeyboard([
          [Markup.button.url('🎧 Listen Now', streamUrl)],
          [Markup.button.callback(t('back', lang), 'show_radio')],
        ]),
      );
    } catch (error) {
      logger.error('Error in radio listen:', error);
    }
  });

  // Request song
  bot.action('radio_request', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';
      ctx.session.temp.waitingForSongRequest = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('enterSongName', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_radio')],
        ]),
      );
    } catch (error) {
      logger.error('Error in radio request:', error);
    }
  });

  // Now playing
  bot.action('radio_now_playing', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      // In production, fetch from radio API
      const nowPlaying = {
        title: 'Live Music Mix',
        artist: 'PNPtv Radio',
        listeners: 150,
      };

      await ctx.editMessageText(
        `${t('nowPlaying', lang)}\n\n🎵 ${nowPlaying.title}\n🎤 ${nowPlaying.artist}\n👥 ${nowPlaying.listeners} listeners`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'radio_now_playing')],
          [Markup.button.callback(t('back', lang), 'show_radio')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing now playing:', error);
    }
  });

  // Radio schedule
  bot.action('radio_schedule', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

      await ctx.editMessageText(
        `${t('radioSchedule', lang)}\n\n` +
        '📅 Daily Schedule:\n\n' +
        '00:00 - 06:00 - Night Mix\n' +
        '06:00 - 12:00 - Morning Vibes\n' +
        '12:00 - 18:00 - Afternoon Hits\n' +
        '18:00 - 00:00 - Evening Special',
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_radio')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing radio schedule:', error);
    }
  });

  // Handle song request text
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForSongRequest) {
      try {
        const lang = ctx.session.language || 'en';
        const songName = ctx.message.text;

        // In production, save to queue
        logger.info('Song requested', { userId: ctx.from.id, songName });

        ctx.session.temp.waitingForSongRequest = false;
        await ctx.saveSession();

        await ctx.reply(
          t('songRequested', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_radio')],
          ]),
        );
      } catch (error) {
        logger.error('Error processing song request:', error);
      }
      return;
    }

    return next();
  });
};

module.exports = registerRadioHandlers;
