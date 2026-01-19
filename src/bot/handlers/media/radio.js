const { Markup } = require('telegraf');
const moment = require('moment');
const RadioModel = require('../../../models/radioModel');
const radioStreamManager = require('../../../services/radio/radioStreamManager');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

// Radio streaming URL (configure in .env)
const RADIO_STREAM_URL = process.env.RADIO_STREAM_URL || 'https://pnptv.app/radio/stream';

/**
 * Format seconds to MM:SS
 */
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Create progress bar for track
 */
const createProgressBar = (elapsed, total) => {
  const barLength = 12;
  const progress = total > 0 ? Math.min(elapsed / total, 1) : 0;
  const filledLength = Math.floor(progress * barLength);
  const emptyLength = barLength - filledLength;
  return '━'.repeat(filledLength) + '●' + '━'.repeat(emptyLength);
};

/**
 * Get relative time string
 */
const getRelativeTime = (date) => {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

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

      // Check existing request position
      const existingRequest = await RadioModel.getUserRequestPosition(ctx.from.id);
      const dailyCount = await RadioModel.getUserDailyRequestCount(ctx.from.id);
      const pendingRequests = await RadioModel.getPendingRequests(100);

      let text = '🎵 **Request a Song**\n\n';

      if (existingRequest) {
        text += `📬 **Your Current Request:**\n`;
        text += `"${existingRequest.songName}"\n`;
        text += `Position: #${existingRequest.position} of ${existingRequest.total}\n\n`;
      }

      text += `📊 **Queue Info:**\n`;
      text += `• ${pendingRequests.length} song${pendingRequests.length !== 1 ? 's' : ''} in queue\n`;
      text += `• Your requests today: ${dailyCount}/5\n\n`;

      if (dailyCount >= 5) {
        text += '❌ You\'ve reached your daily limit.\n';
        text += 'Come back tomorrow! 💜';

        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'radio_menu')],
          ]),
        });
        return;
      }

      text += '_Send the song name or "Artist - Title":_';

      ctx.session.temp.waitingForSongRequest = true;
      await ctx.saveSession();

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'radio_menu')],
        ]),
      });
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

  // Skip track (admin only for now)
  bot.action('radio_skip', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏭️ Skip requests coming soon!');
    } catch (error) {
      logger.error('Error handling skip:', error);
    }
  });

  // Like current track
  bot.action('radio_like', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const success = await RadioModel.likeCurrentTrack(userId);
      
      if (success) {
        await ctx.answerCbQuery('💜 You liked this track!');
        // Refresh the now playing display to show updated like count
        await showNowPlaying(ctx);
      } else {
        await ctx.answerCbQuery('❌ Could not like track - no song playing');
      }
    } catch (error) {
      logger.error('Error handling like:', error);
      await ctx.answerCbQuery('❌ Error liking track');
    }
  });

  // Radio settings
  bot.action('radio_settings', async (ctx) => {
    try {
      await showRadioSettings(ctx);
    } catch (error) {
      logger.error('Error showing radio settings:', error);
    }
  });

  // Toggle notifications
  bot.action('radio_notify_toggle', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const success = await RadioModel.toggleRadioNotifications(userId);
      
      if (success) {
        const status = await RadioModel.getNotificationStatus(userId);
        const message = status 
          ? '🔔 Notifications ENABLED - You\'ll get updates when your songs play!'
          : '🔔 Notifications DISABLED - No more song notifications.';
        await ctx.answerCbQuery(message);
        await showRadioSettings(ctx);
      } else {
        await ctx.answerCbQuery('❌ Error updating notification settings');
      }
    } catch (error) {
      logger.error('Error toggling notifications:', error);
      await ctx.answerCbQuery('❌ Error updating notifications');
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
        const requestCount = await RadioModel.getUserDailyRequestCount(ctx.from.id);
        if (requestCount >= 5) {
          await ctx.reply(
            '❌ **Request Limit Reached**\n\n' +
            'You can only request 5 songs per day.\n' +
            'Come back tomorrow! 💜',
            { parse_mode: 'Markdown' },
          );
          ctx.session.temp.waitingForSongRequest = false;
          await ctx.saveSession();
          return;
        }

        // Create request
        const request = await RadioModel.requestSong(ctx.from.id, songName);

        ctx.session.temp.waitingForSongRequest = false;
        await ctx.saveSession();

        if (request) {
          // Get queue position
          const queueInfo = await RadioModel.getUserRequestPosition(ctx.from.id);

          let text = '✅ **Song Request Received!**\n\n';
          text += `🎵 "${songName}"\n\n`;

          if (queueInfo) {
            text += `📋 **Queue Position:** #${queueInfo.position} of ${queueInfo.total}\n\n`;
          }

          text += '🔔 You\'ll be notified when your song plays!\n';
          text += `📊 Requests today: ${requestCount + 1}/5`;

          await ctx.reply(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Back to Radio', 'radio_menu')],
            ]),
          });
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
 * Show radio main menu with enhanced UI
 */
const showRadioMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Get now playing info
    let nowPlaying = null;
    try {
      nowPlaying = await radioStreamManager.getNowPlaying();
    } catch (err) {
      // Fallback to RadioModel if stream manager not available
      nowPlaying = await RadioModel.getNowPlaying();
    }

    // Get listener and like counts
    const listenerCount = await RadioModel.getListenerCount();
    const likeCount = await RadioModel.getLikeCount();

    // Build enhanced header
    let text = '🎧 ═══ **PNPtv RADIO** ═══ 🎧\n\n';

    // Show compact now playing card
    if (nowPlaying && nowPlaying.track) {
      const track = nowPlaying.track;
      const elapsed = track.durationSeconds - (nowPlaying.remaining || 0);
      const progress = createProgressBar(elapsed, track.durationSeconds);

      text += '   ▶️ **NOW PLAYING**\n';
      text += `   🎵 ${track.title}\n`;
      text += `   🎤 ${track.artist || 'Unknown Artist'}\n`;
      text += `   ${progress} ${formatTime(elapsed)}/${formatTime(track.durationSeconds)}\n\n`;
    } else if (nowPlaying && nowPlaying.title) {
      // Fallback for old format
      text += '   ▶️ **NOW PLAYING**\n';
      text += `   🎵 ${nowPlaying.title}\n`;
      text += `   🎤 ${nowPlaying.artist || 'Unknown Artist'}\n`;
      if (nowPlaying.duration) {
        text += `   ⏱️ ${nowPlaying.duration}\n`;
      }
      text += '\n';
    } else {
      text += '   ⏸️ **RADIO IDLE**\n';
      text += '   _No track currently playing_\n\n';
    }

    // Stats line
    text += `📊 Listeners: ${listenerCount} | 💜 Likes: ${likeCount}\n\n`;

    // Show current program if available
    const currentProgram = await RadioModel.getCurrentProgram();
    if (currentProgram) {
      text += `🎙️ **${lang === 'es' ? 'Al Aire' : 'On Air'}:** ${currentProgram.programName}\n`;
      text += `⏰ ${currentProgram.timeSlot}\n\n`;
    }

    // Get user's request queue position
    const userId = ctx.from?.id;
    let requestInfo = null;
    if (userId) {
      requestInfo = await RadioModel.getUserRequestPosition(userId);
    }

    if (requestInfo) {
      text += `📬 Your request **"${requestInfo.songName}"** is #${requestInfo.position} in queue\n\n`;
    }

    // Footer
    text += lang === 'es'
      ? '_Elige una opción abajo 💜_'
      : '_Choose an option below 💜_';

    // Enhanced keyboard layout
    const keyboard = Markup.inlineKeyboard([
      // Quick action row
      [
        Markup.button.callback('▶️ Listen', 'radio_listen'),
        Markup.button.callback('⏭️ Skip', 'radio_skip'),
        Markup.button.callback('💜 Like', 'radio_like'),
      ],
      // Main navigation
      [
        Markup.button.callback('📜 History', 'radio_history'),
        Markup.button.callback('🎵 Request', 'radio_request'),
        Markup.button.callback('📅 Schedule', 'radio_schedule'),
      ],
      // Settings and back
      [
        Markup.button.callback('⚙️ Settings', 'radio_settings'),
        Markup.button.callback('🔙 Back', 'back_to_main'),
      ],
    ]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    logger.error('Error in showRadioMenu:', error);
    // Fallback to simple menu on error
    const lang = getLanguage(ctx);
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('listenNow', lang), 'radio_listen')],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);
    await ctx.editMessageText('📻 PNPtv Radio', { ...keyboard });
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
 * Show now playing with enhanced display
 */
const showNowPlaying = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Try to get from stream manager first
    let nowPlaying = null;
    try {
      nowPlaying = await radioStreamManager.getNowPlaying();
    } catch (err) {
      nowPlaying = await RadioModel.getNowPlaying();
    }

    let text = '🎵 **Now Playing**\n\n';

    if (nowPlaying && nowPlaying.track) {
      const track = nowPlaying.track;
      const elapsed = track.durationSeconds - (nowPlaying.remaining || 0);
      const progress = createProgressBar(elapsed, track.durationSeconds);

      // Album art placeholder (thumbnail URL available)
      if (track.thumbnailUrl) {
        text += `🖼️ [Album Art](${track.thumbnailUrl})\n\n`;
      }

      text += `🎼 **${track.title}**\n`;
      text += `🎤 ${track.artist || 'Unknown Artist'}\n`;
      if (track.album) {
        text += `💿 ${track.album}\n`;
      }
      text += `\n${progress}\n`;
      text += `⏱️ ${formatTime(elapsed)} / ${formatTime(track.durationSeconds)}\n\n`;

      const listenerCount = nowPlaying.listenerCount || 0;
      text += `👥 ${listenerCount} listener${listenerCount !== 1 ? 's' : ''}\n`;

      if (nowPlaying.startedAt) {
        text += `\n🕐 Started at ${moment(nowPlaying.startedAt).format('HH:mm')}\n`;
      }
    } else if (nowPlaying && nowPlaying.title) {
      // Fallback for old format
      text += `🎼 **${nowPlaying.title}**\n`;
      if (nowPlaying.artist) {
        text += `🎤 ${nowPlaying.artist}\n`;
      }
      if (nowPlaying.duration) {
        text += `⏱️ ${nowPlaying.duration}\n`;
      }
      if (nowPlaying.startedAt) {
        const startedAt = nowPlaying.startedAt?.toDate ? nowPlaying.startedAt.toDate() : new Date(nowPlaying.startedAt);
        text += `\n🕐 Started at ${moment(startedAt).format('HH:mm')}\n`;
      }
    } else {
      text += lang === 'es'
        ? '_No hay información de canción disponible._\n\n'
        : '_No song information available._\n\n';
      text += 'The radio might be idle or loading...';
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('💜 Like', 'radio_like'),
        Markup.button.callback('🔄 Refresh', 'radio_now_playing'),
      ],
      [Markup.button.callback('🔙 Back', 'radio_menu')],
    ]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    logger.error('Error in showNowPlaying:', error);
  }
};

/**
 * Show song history with improved format
 */
const showHistory = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const history = await RadioModel.getHistory(10);

    let text = '📜 **Recently Played**\n\n';

    if (history && history.length > 0) {
      history.forEach((song, index) => {
        const playedAt = song.playedAt?.toDate ? song.playedAt.toDate() : new Date(song.playedAt);
        const relTime = getRelativeTime(playedAt);

        text += `${index + 1}. 🎵 **${song.title}**`;
        if (song.artist) {
          text += ` - ${song.artist}`;
        }
        text += ` _(${relTime})_\n`;
      });

      text += '\n_Updated automatically_';
    } else {
      text += lang === 'es'
        ? '_No hay historial disponible aún._'
        : '_No history available yet._';
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh', 'radio_history')],
      [Markup.button.callback('🔙 Back', 'radio_menu')],
    ]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    logger.error('Error in showHistory:', error);
  }
};

/**
 * Show radio settings
 */
const showRadioSettings = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    
    // Get current notification status
    const notifyStatus = await RadioModel.getNotificationStatus(userId);

    let text = '⚙️ **Radio Settings**\n\n';
    text += '**🔔 Notifications:**\n';
    text += `• Song Play Alerts: ${notifyStatus ? '🟢 ON' : '🔴 OFF'}\n`;
    text += '• New Show Alerts: 🟢 ON\n\n';
    
    text += '**🎧 Preferences:**\n';
    text += '• Audio Quality: High\n';
    text += '• Auto-play: On\n\n';
    
    text += '_Customize your radio experience!_\n';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`🔔 ${notifyStatus ? 'Disable' : 'Enable'} Notifications`, 'radio_notify_toggle')],
      [Markup.button.callback('🔙 Back', 'radio_menu')],
    ]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } catch (error) {
    logger.error('Error in showRadioSettings:', error);
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
