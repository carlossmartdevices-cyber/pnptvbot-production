const { Markup } = require('telegraf');
const moment = require('moment');
const RadioModel = require('../../../models/radioModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

// Radio streaming URL (configure in .env)
const RADIO_STREAM_URL = process.env.RADIO_STREAM_URL || 'https://stream.pnptv.app/radio';

/**
 * Radio handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerRadioHandlers = (bot) => {
  // Main radio menu (backward compatible with 'show_radio')
  bot.action(['show_radio', 'radio_menu'], async (ctx) => {
    try {
      await showRadioMenu(ctx);
    } catch (error) {
      logger.error('Error showing radio menu:', error);
    }
  });

  // Listen now
  bot.action('radio_listen', async (ctx) => {
    try {
      await showListenNow(ctx);
    } catch (error) {
      logger.error('Error showing listen now:', error);
    }
  });

  // Now playing
  bot.action('radio_now_playing', async (ctx) => {
    try {
      await showNowPlaying(ctx);
    } catch (error) {
      logger.error('Error showing now playing:', error);
    }
  });

  // Request song
  bot.action('radio_request', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForSongRequest = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('enterSongName', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'radio_menu')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting song request:', error);
    }
  });

  // Show history
  bot.action('radio_history', async (ctx) => {
    try {
      await showHistory(ctx);
    } catch (error) {
      logger.error('Error showing history:', error);
    }
  });

  // Show schedule
  bot.action('radio_schedule', async (ctx) => {
    try {
      await showSchedule(ctx);
    } catch (error) {
      logger.error('Error showing schedule:', error);
    }
  });

  // Handle text input for song requests
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForSongRequest) {
      try {
        const lang = getLanguage(ctx);
        const songName = validateUserInput(ctx.message.text, 200);

        if (!songName) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        // Check request limits (max 5 per day per user)
        const requestCount = await RadioModel.getUserRequestCount(ctx.from.id);
        if (requestCount >= 5) {
          await ctx.reply(t('radio.requestLimitReached', lang));
          ctx.session.temp.waitingForSongRequest = false;
          await ctx.saveSession();
          return;
        }

        // Create request
        const request = await RadioModel.requestSong(ctx.from.id, songName);

        ctx.session.temp.waitingForSongRequest = false;
        await ctx.saveSession();

        if (request) {
          await ctx.reply(t('songRequested', lang));
          await showRadioMenu(ctx);
        } else {
          await ctx.reply(t('error', lang));
        }
      } catch (error) {
        logger.error('Error processing song request:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show radio main menu
 */
const showRadioMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    let text = `${t('radioTitle', lang)}\n\n`;
    text += `${t('radio.description', lang)}\n\n`;

    // Show current program if available
    const currentProgram = await RadioModel.getCurrentProgram();
    if (currentProgram) {
      text += `🎙️ ${t('radio.onAir', lang)}: ${currentProgram.programName}\n`;
      text += `⏰ ${currentProgram.timeSlot}\n\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('listenNow', lang), 'radio_listen')],
      [
        Markup.button.callback(t('nowPlaying', lang), 'radio_now_playing'),
        Markup.button.callback(t('radio.history', lang), 'radio_history'),
      ],
      [
        Markup.button.callback(t('requestSong', lang), 'radio_request'),
        Markup.button.callback(t('radioSchedule', lang), 'radio_schedule'),
      ],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showRadioMenu:', error);
  }
};

/**
 * Show listen now with streaming link
 */
const showListenNow = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const nowPlaying = await RadioModel.getNowPlaying();

    let text = `🎧 ${t('radio.liveNow', lang)}\n\n`;
    text += `📻 ${t('streamUrl', lang, { url: RADIO_STREAM_URL })}\n\n`;

    if (nowPlaying) {
      text += `🎵 ${t('nowPlaying', lang)}:\n`;
      text += `${nowPlaying.title}`;
      if (nowPlaying.artist) {
        text += ` - ${nowPlaying.artist}`;
      }
      text += '\n\n';
    }

    text += `💡 ${t('radio.tip', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(t('radio.openStream', lang), RADIO_STREAM_URL)],
      [Markup.button.callback(t('back', lang), 'radio_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showListenNow:', error);
  }
};

/**
 * Show now playing
 */
const showNowPlaying = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const nowPlaying = await RadioModel.getNowPlaying();

    let text = `🎵 ${t('nowPlaying', lang)}\n\n`;

    if (nowPlaying) {
      text += `🎼 ${nowPlaying.title}\n`;
      if (nowPlaying.artist) {
        text += `🎤 ${t('radio.artist', lang)}: ${nowPlaying.artist}\n`;
      }
      if (nowPlaying.duration) {
        text += `⏱️ ${t('radio.duration', lang)}: ${nowPlaying.duration}\n`;
      }

      const startedAt = nowPlaying.startedAt.toDate ? nowPlaying.startedAt.toDate() : new Date(nowPlaying.startedAt);
      text += `\n⏰ ${t('radio.startedAt', lang)}: ${moment(startedAt).format('HH:mm')}\n`;
    } else {
      text += t('radio.noSongPlaying', lang);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('refresh', lang), 'radio_now_playing')],
      [Markup.button.callback(t('back', lang), 'radio_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showNowPlaying:', error);
  }
};

/**
 * Show song history
 */
const showHistory = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const history = await RadioModel.getHistory(10);

    let text = `📜 ${t('radio.recentlyPlayed', lang)}\n\n`;

    if (history && history.length > 0) {
      history.forEach((song, index) => {
        const playedAt = song.playedAt.toDate ? song.playedAt.toDate() : new Date(song.playedAt);
        text += `${index + 1}. ${song.title}`;
        if (song.artist) {
          text += ` - ${song.artist}`;
        }
        text += `\n   ⏰ ${moment(playedAt).format('HH:mm')}\n\n`;
      });
    } else {
      text += t('radio.noHistory', lang);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('refresh', lang), 'radio_history')],
      [Markup.button.callback(t('back', lang), 'radio_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showHistory:', error);
  }
};

/**
 * Show radio schedule
 */
const showSchedule = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const schedule = await RadioModel.getSchedule();

    let text = `📅 ${t('radioSchedule', lang)}\n\n`;

    if (schedule && schedule.length > 0) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayNames = lang === 'es' ? daysEs : days;

      // Group by day
      const scheduleByDay = {};
      schedule.forEach((entry) => {
        if (!scheduleByDay[entry.dayOfWeek]) {
          scheduleByDay[entry.dayOfWeek] = [];
        }
        scheduleByDay[entry.dayOfWeek].push(entry);
      });

      // Display schedule
      Object.keys(scheduleByDay).sort().forEach((day) => {
        const dayNum = parseInt(day, 10);
        text += `**${dayNames[dayNum]}**\n`;

        scheduleByDay[day].forEach((entry) => {
          text += `  ${entry.timeSlot} - ${entry.programName}\n`;
          if (entry.description) {
            text += `  _${entry.description}_\n`;
          }
        });

        text += '\n';
      });
    } else {
      text += t('radio.noSchedule', lang);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('back', lang), 'radio_menu')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showSchedule:', error);
  }
};

module.exports = registerRadioHandlers;
