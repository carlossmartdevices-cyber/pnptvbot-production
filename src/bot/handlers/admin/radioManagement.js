const { Markup } = require('telegraf');
const RadioModel = require('../../../models/radioModel');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Radio management handlers for admin
 * @param {Telegraf} bot - Bot instance
 */
const registerRadioManagementHandlers = (bot) => {
  // Main radio admin menu
  bot.action('admin_radio', async (ctx) => {
    try {
      await showRadioAdminMenu(ctx);
    } catch (error) {
      logger.error('Error showing radio admin menu:', error);
    }
  });

  // Set now playing
  bot.action('admin_radio_set_now_playing', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForNowPlaying = { step: 'title' };
      await ctx.saveSession();

      await ctx.editMessageText(t('radio.admin.enterSongTitle', lang));
    } catch (error) {
      logger.error('Error starting set now playing:', error);
    }
  });

  // View pending requests
  bot.action('admin_radio_requests', async (ctx) => {
    try {
      await showPendingRequests(ctx);
    } catch (error) {
      logger.error('Error showing pending requests:', error);
    }
  });

  // Approve request
  bot.action(/^admin_radio_approve_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      await approveRequest(ctx, requestId);
    } catch (error) {
      logger.error('Error approving request:', error);
    }
  });

  // Reject request
  bot.action(/^admin_radio_reject_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      await rejectRequest(ctx, requestId);
    } catch (error) {
      logger.error('Error rejecting request:', error);
    }
  });

  // Manage schedule
  bot.action('admin_radio_schedule', async (ctx) => {
    try {
      await showScheduleManagement(ctx);
    } catch (error) {
      logger.error('Error showing schedule management:', error);
    }
  });

  // Add to schedule
  bot.action('admin_radio_add_schedule', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForSchedule = { step: 'day' };
      await ctx.saveSession();

      await ctx.editMessageText(
        t('radio.admin.selectDay', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback('Monday', 'schedule_day_1')],
          [Markup.button.callback('Tuesday', 'schedule_day_2')],
          [Markup.button.callback('Wednesday', 'schedule_day_3')],
          [Markup.button.callback('Thursday', 'schedule_day_4')],
          [Markup.button.callback('Friday', 'schedule_day_5')],
          [Markup.button.callback('Saturday', 'schedule_day_6')],
          [Markup.button.callback('Sunday', 'schedule_day_0')],
          [Markup.button.callback(t('cancel', lang), 'admin_radio_schedule')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting schedule creation:', error);
    }
  });

  // Select day for schedule
  bot.action(/^schedule_day_(\d)$/, async (ctx) => {
    try {
      const dayOfWeek = parseInt(ctx.match[1], 10);
      const lang = getLanguage(ctx);

      ctx.session.temp.waitingForSchedule.dayOfWeek = dayOfWeek;
      ctx.session.temp.waitingForSchedule.step = 'timeSlot';
      await ctx.saveSession();

      await ctx.editMessageText(t('radio.admin.enterTimeSlot', lang));
    } catch (error) {
      logger.error('Error selecting schedule day:', error);
    }
  });

  // Delete schedule entry
  bot.action(/^admin_radio_delete_schedule_(.+)$/, async (ctx) => {
    try {
      const scheduleId = ctx.match[1];
      await deleteScheduleEntry(ctx, scheduleId);
    } catch (error) {
      logger.error('Error deleting schedule entry:', error);
    }
  });

  // Radio statistics
  bot.action('admin_radio_stats', async (ctx) => {
    try {
      await showRadioStatistics(ctx);
    } catch (error) {
      logger.error('Error showing radio statistics:', error);
    }
  });

  // Handle text inputs for radio admin
  bot.on('text', async (ctx, next) => {
    const { temp } = ctx.session;

    // Set now playing flow
    if (temp?.waitingForNowPlaying) {
      try {
        await handleNowPlayingInput(ctx);
        return;
      } catch (error) {
        logger.error('Error in now playing flow:', error);
      }
      return;
    }

    // Schedule creation flow
    if (temp?.waitingForSchedule) {
      try {
        await handleScheduleInput(ctx);
        return;
      } catch (error) {
        logger.error('Error in schedule flow:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show radio admin menu
 */
const showRadioAdminMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const stats = await RadioModel.getStatistics();

    let text = `📻 ${t('radio.admin.title', lang)}\n\n`;
    text += `${t('radio.admin.stats', lang)}:\n`;
    text += `📊 ${t('radio.admin.totalRequests', lang)}: ${stats.totalRequests}\n`;
    text += `🎵 ${t('radio.admin.songsPlayed', lang)}: ${stats.totalSongsPlayed}\n`;
    text += `⏳ ${t('radio.admin.pendingRequests', lang)}: ${stats.pendingRequests}\n`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('radio.admin.setNowPlaying', lang), 'admin_radio_set_now_playing')],
      [Markup.button.callback(t('radio.admin.viewRequests', lang), 'admin_radio_requests')],
      [Markup.button.callback(t('radio.admin.manageSchedule', lang), 'admin_radio_schedule')],
      [Markup.button.callback(t('radio.admin.statistics', lang), 'admin_radio_stats')],
      [Markup.button.callback(t('back', lang), 'admin_panel')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showRadioAdminMenu:', error);
  }
};

/**
 * Show pending song requests
 */
const showPendingRequests = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const requests = await RadioModel.getPendingRequests(10);

    let text = `🎵 ${t('radio.admin.pendingRequests', lang)}\n\n`;

    if (requests && requests.length > 0) {
      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const user = await UserModel.getById(request.userId);
        const userName = user ? `${user.firstName} ${user.lastName || ''}` : `User ${request.userId}`;

        text += `${i + 1}. ${request.songName}\n`;
        text += `   👤 Requested by: ${userName}\n\n`;
      }
    } else {
      text += t('radio.admin.noRequests', lang);
    }

    const keyboard = [];

    // Add approve/reject buttons for each request
    requests.forEach((request) => {
      keyboard.push([
        Markup.button.callback(`✅ ${request.songName}`, `admin_radio_approve_${request.id}`),
        Markup.button.callback('❌', `admin_radio_reject_${request.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback(t('back', lang), 'admin_radio')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error in showPendingRequests:', error);
  }
};

/**
 * Approve song request
 */
const approveRequest = async (ctx, requestId) => {
  try {
    const lang = getLanguage(ctx);

    await RadioModel.updateRequestStatus(requestId, 'approved');

    await ctx.answerCbQuery(t('radio.admin.requestApproved', lang));
    await showPendingRequests(ctx);
  } catch (error) {
    logger.error('Error approving request:', error);
  }
};

/**
 * Reject song request
 */
const rejectRequest = async (ctx, requestId) => {
  try {
    const lang = getLanguage(ctx);

    await RadioModel.updateRequestStatus(requestId, 'rejected');

    await ctx.answerCbQuery(t('radio.admin.requestRejected', lang));
    await showPendingRequests(ctx);
  } catch (error) {
    logger.error('Error rejecting request:', error);
  }
};

/**
 * Show schedule management
 */
const showScheduleManagement = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const schedule = await RadioModel.getSchedule();

    let text = `📅 ${t('radio.admin.scheduleManagement', lang)}\n\n`;

    if (schedule && schedule.length > 0) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      schedule.forEach((entry) => {
        text += `${days[entry.dayOfWeek]} ${entry.timeSlot}\n`;
        text += `📻 ${entry.programName}\n`;
        if (entry.description) {
          text += `_${entry.description}_\n`;
        }
        text += '\n';
      });
    } else {
      text += t('radio.admin.noScheduleEntries', lang);
    }

    const keyboard = [[Markup.button.callback(t('radio.admin.addToSchedule', lang), 'admin_radio_add_schedule')]];

    // Add delete buttons for each schedule entry
    schedule.forEach((entry) => {
      keyboard.push([
        Markup.button.callback(`🗑️ ${entry.programName}`, `admin_radio_delete_schedule_${entry.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback(t('back', lang), 'admin_radio')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error in showScheduleManagement:', error);
  }
};

/**
 * Delete schedule entry
 */
const deleteScheduleEntry = async (ctx, scheduleId) => {
  try {
    const lang = getLanguage(ctx);

    await RadioModel.deleteSchedule(scheduleId);

    await ctx.answerCbQuery(t('radio.admin.scheduleDeleted', lang));
    await showScheduleManagement(ctx);
  } catch (error) {
    logger.error('Error deleting schedule entry:', error);
  }
};

/**
 * Show radio statistics
 */
const showRadioStatistics = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const stats = await RadioModel.getStatistics();
    const history = await RadioModel.getHistory(5);

    let text = `📊 ${t('radio.admin.statistics', lang)}\n\n`;
    text += `📈 **Overall Stats:**\n`;
    text += `Total Requests: ${stats.totalRequests}\n`;
    text += `Songs Played: ${stats.totalSongsPlayed}\n`;
    text += `Pending Requests: ${stats.pendingRequests}\n\n`;

    text += `🎵 **Recently Played:**\n`;
    if (history && history.length > 0) {
      history.forEach((song, index) => {
        text += `${index + 1}. ${song.title}`;
        if (song.artist) {
          text += ` - ${song.artist}`;
        }
        text += '\n';
      });
    } else {
      text += 'No songs played yet.\n';
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('refresh', lang), 'admin_radio_stats')],
      [Markup.button.callback(t('back', lang), 'admin_radio')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showRadioStatistics:', error);
  }
};

/**
 * Handle now playing input
 */
const handleNowPlayingInput = async (ctx) => {
  const lang = getLanguage(ctx);
  const { waitingForNowPlaying } = ctx.session.temp;

  if (waitingForNowPlaying.step === 'title') {
    waitingForNowPlaying.title = ctx.message.text;
    waitingForNowPlaying.step = 'artist';
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.enterArtist', lang));
  } else if (waitingForNowPlaying.step === 'artist') {
    waitingForNowPlaying.artist = ctx.message.text;
    waitingForNowPlaying.step = 'duration';
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.enterDuration', lang));
  } else if (waitingForNowPlaying.step === 'duration') {
    const duration = ctx.message.text;

    // Set now playing
    await RadioModel.setNowPlaying({
      title: waitingForNowPlaying.title,
      artist: waitingForNowPlaying.artist,
      duration,
    });

    delete ctx.session.temp.waitingForNowPlaying;
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.nowPlayingSet', lang));
    await showRadioAdminMenu(ctx);
  }
};

/**
 * Handle schedule input
 */
const handleScheduleInput = async (ctx) => {
  const lang = getLanguage(ctx);
  const { waitingForSchedule } = ctx.session.temp;

  if (waitingForSchedule.step === 'timeSlot') {
    waitingForSchedule.timeSlot = ctx.message.text;
    waitingForSchedule.step = 'programName';
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.enterProgramName', lang));
  } else if (waitingForSchedule.step === 'programName') {
    waitingForSchedule.programName = ctx.message.text;
    waitingForSchedule.step = 'description';
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.enterDescription', lang));
  } else if (waitingForSchedule.step === 'description') {
    const description = ctx.message.text;

    // Create schedule
    await RadioModel.createOrUpdateSchedule({
      dayOfWeek: waitingForSchedule.dayOfWeek,
      timeSlot: waitingForSchedule.timeSlot,
      programName: waitingForSchedule.programName,
      description,
    });

    delete ctx.session.temp.waitingForSchedule;
    await ctx.saveSession();

    await ctx.reply(t('radio.admin.scheduleCreated', lang));
    await showScheduleManagement(ctx);
  }
};

module.exports = registerRadioManagementHandlers;
