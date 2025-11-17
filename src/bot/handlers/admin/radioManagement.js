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

  // All requests management
  bot.action('admin_radio_all_requests', async (ctx) => {
    try {
      await showAllRequestsMenu(ctx);
    } catch (error) {
      logger.error('Error showing all requests menu:', error);
    }
  });

  // View requests by status
  bot.action(/^admin_radio_view_(.+)$/, async (ctx) => {
    try {
      const status = ctx.match[1];
      if (['pending', 'approved', 'rejected', 'played', 'all'].includes(status)) {
        await showRequestsByStatus(ctx, status);
      }
    } catch (error) {
      logger.error('Error viewing requests by status:', error);
    }
  });

  // Play request directly
  bot.action(/^admin_radio_play_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      await playRequest(ctx, requestId);
    } catch (error) {
      logger.error('Error playing request:', error);
    }
  });

  // Search history
  bot.action('admin_radio_search', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForHistorySearch = true;
      await ctx.saveSession();

      await ctx.editMessageText('🔍 Enter song title or artist to search:');
    } catch (error) {
      logger.error('Error starting history search:', error);
    }
  });

  // Top requests
  bot.action('admin_radio_top', async (ctx) => {
    try {
      await showTopRequests(ctx);
    } catch (error) {
      logger.error('Error showing top requests:', error);
    }
  });

  // Edit schedule entry
  bot.action(/^admin_radio_edit_schedule_(.+)$/, async (ctx) => {
    try {
      const scheduleId = ctx.match[1];
      await startEditSchedule(ctx, scheduleId);
    } catch (error) {
      logger.error('Error starting schedule edit:', error);
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

    // History search flow
    if (temp?.waitingForHistorySearch) {
      try {
        await handleHistorySearch(ctx);
        return;
      } catch (error) {
        logger.error('Error in history search:', error);
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

    // Clear any ongoing admin tasks
    ctx.session.temp = {};
    await ctx.saveSession();

    const stats = await RadioModel.getStatistics();

    let text = `📻 ${t('radio.admin.title', lang)}\n\n`;
    text += `${t('radio.admin.stats', lang)}:\n`;
    text += `📊 ${t('radio.admin.totalRequests', lang)}: ${stats.totalRequests}\n`;
    text += `🎵 ${t('radio.admin.songsPlayed', lang)}: ${stats.totalSongsPlayed}\n`;
    text += `⏳ ${t('radio.admin.pendingRequests', lang)}: ${stats.pendingRequests}\n`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎵 Canción en Vivo', 'admin_radio_set_now_playing')],
      [Markup.button.callback('📋 Solicitudes', 'admin_radio_all_requests')],
      [Markup.button.callback('📅 Programación', 'admin_radio_schedule')],
      [Markup.button.callback('📊 Estadísticas', 'admin_radio_stats')],
      [Markup.button.callback('🔍 Buscar Canción', 'admin_radio_search')],
      [Markup.button.callback('🎯 Top 10', 'admin_radio_top')],
      [Markup.button.callback('◀️ Volver', 'admin_cancel')],
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

    let text = `📅 **Radio Programming Schedule**\n\n`;

    if (schedule && schedule.length > 0) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      schedule.forEach((entry) => {
        text += `**${days[entry.dayOfWeek]} ${entry.timeSlot}**\n`;
        text += `📻 ${entry.programName}\n`;
        if (entry.description) {
          text += `_${entry.description}_\n`;
        }
        text += '\n';
      });
    } else {
      text += 'No schedule entries yet.';
    }

    const keyboard = [[Markup.button.callback('➕ Nuevo Programa', 'admin_radio_add_schedule')]];

    // Add edit and delete buttons for each schedule entry
    schedule.forEach((entry) => {
      const programName = entry.programName.length > 15 ? entry.programName.substring(0, 15) + '...' : entry.programName;
      keyboard.push([
        Markup.button.callback(`✏️ ${programName}`, `admin_radio_edit_schedule_${entry.id}`),
        Markup.button.callback('🗑️', `admin_radio_delete_schedule_${entry.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback('◀️ Volver', 'admin_radio')]);

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
    const stats = await RadioModel.getDetailedStatistics();
    const history = await RadioModel.getHistory(5);

    let text = `📊 Radio Statistics\n\n`;
    text += '📈 **Overall Stats:**\n';
    text += `Total Requests: ${stats.totalRequests}\n`;
    text += `Songs Played: ${stats.totalSongsPlayed}\n`;
    text += `Approval Rate: ${stats.approvalRate}%\n\n`;

    text += '📊 **Request Status:**\n';
    text += `⏳ Pending: ${stats.pendingRequests}\n`;
    text += `✅ Approved: ${stats.approvedRequests}\n`;
    text += `❌ Rejected: ${stats.rejectedRequests}\n\n`;

    text += '📅 **Time-based Stats:**\n';
    text += `Today: ${stats.todayRequests} requests\n`;
    text += `This Week: ${stats.weekRequests} requests\n\n`;

    text += '🎵 **Recently Played:**\n';
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
      [Markup.button.callback('🔄 Actualizar', 'admin_radio_stats')],
      [Markup.button.callback('◀️ Volver', 'admin_radio')],
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

/**
 * Show all requests menu
 */
const showAllRequestsMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    let text = '📋 **Manage Song Requests**\n\n';
    text += 'Select request status to view:\n';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Pendientes', 'admin_radio_view_pending')],
      [Markup.button.callback('✅ Aprobadas', 'admin_radio_view_approved')],
      [Markup.button.callback('❌ Rechazadas', 'admin_radio_view_rejected')],
      [Markup.button.callback('🎵 Reproducidas', 'admin_radio_view_played')],
      [Markup.button.callback('📊 Todas', 'admin_radio_view_all')],
      [Markup.button.callback('◀️ Volver', 'admin_radio')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showAllRequestsMenu:', error);
  }
};

/**
 * Show requests by status
 */
const showRequestsByStatus = async (ctx, status) => {
  try {
    const lang = getLanguage(ctx);
    const requests = await RadioModel.getRequestsByStatus(status, 20);

    const statusEmoji = {
      pending: '⏳',
      approved: '✅',
      rejected: '❌',
      played: '🎵',
      all: '📊',
    };

    let text = `${statusEmoji[status]} **${status.charAt(0).toUpperCase() + status.slice(1)} Requests**\n\n`;

    if (requests && requests.length > 0) {
      for (let i = 0; i < Math.min(requests.length, 10); i++) {
        const request = requests[i];
        const user = await UserModel.getById(request.userId);
        const userName = user ? `${user.firstName} ${user.lastName || ''}` : `User ${request.userId}`;

        text += `${i + 1}. ${request.songName}\n`;
        text += `   👤 ${userName}\n`;
        text += `   📅 ${request.requestedAt.toDate ? request.requestedAt.toDate().toLocaleDateString() : new Date(request.requestedAt).toLocaleDateString()}\n\n`;
      }

      if (requests.length > 10) {
        text += `\n_Showing 10 of ${requests.length} requests_\n`;
      }
    } else {
      text += `No ${status} requests found.`;
    }

    const keyboard = [];

    // Add action buttons for each request
    if (status === 'pending') {
      requests.slice(0, 5).forEach((request) => {
        keyboard.push([
          Markup.button.callback(`✅ ${request.songName.substring(0, 20)}`, `admin_radio_approve_${request.id}`),
          Markup.button.callback('❌', `admin_radio_reject_${request.id}`),
          Markup.button.callback('▶️', `admin_radio_play_${request.id}`),
        ]);
      });
    } else if (status === 'approved') {
      requests.slice(0, 5).forEach((request) => {
        keyboard.push([
          Markup.button.callback(`▶️ ${request.songName.substring(0, 25)}`, `admin_radio_play_${request.id}`),
          Markup.button.callback('❌', `admin_radio_reject_${request.id}`),
        ]);
      });
    }

    keyboard.push([Markup.button.callback('◀️ Volver', 'admin_radio_all_requests')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error in showRequestsByStatus:', error);
  }
};

/**
 * Play request and set as now playing
 */
const playRequest = async (ctx, requestId) => {
  try {
    const lang = getLanguage(ctx);

    const success = await RadioModel.playRequest(requestId);

    if (success) {
      await ctx.answerCbQuery('✅ Now playing!');
      await showRadioAdminMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Error playing request');
    }
  } catch (error) {
    logger.error('Error playing request:', error);
  }
};

/**
 * Handle history search
 */
const handleHistorySearch = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const query = ctx.message.text;

    const results = await RadioModel.searchHistory(query);

    delete ctx.session.temp.waitingForHistorySearch;
    await ctx.saveSession();

    let text = `🔍 **Search Results for "${query}"**\n\n`;

    if (results && results.length > 0) {
      results.forEach((song, index) => {
        text += `${index + 1}. ${song.title}`;
        if (song.artist) {
          text += ` - ${song.artist}`;
        }
        const playedAt = song.playedAt.toDate ? song.playedAt.toDate() : new Date(song.playedAt);
        text += `\n   ⏰ ${playedAt.toLocaleDateString()} ${playedAt.toLocaleTimeString()}\n\n`;
      });
    } else {
      text += 'No results found.';
    }

    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Nueva Búsqueda', 'admin_radio_search')],
        [Markup.button.callback('◀️ Volver', 'admin_radio')],
      ]),
    );
  } catch (error) {
    logger.error('Error handling history search:', error);
  }
};

/**
 * Show top requested songs
 */
const showTopRequests = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const topSongs = await RadioModel.getTopRequests(10);

    let text = '🎯 **Top Requested Songs**\n\n';

    if (topSongs && topSongs.length > 0) {
      topSongs.forEach((song, index) => {
        text += `${index + 1}. ${song.songName}\n`;
        text += `   🔢 Requested ${song.count} times\n\n`;
      });
    } else {
      text += 'No data available yet.';
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Actualizar', 'admin_radio_top')],
      [Markup.button.callback('◀️ Volver', 'admin_radio')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showTopRequests:', error);
  }
};

/**
 * Start editing schedule entry
 */
const startEditSchedule = async (ctx, scheduleId) => {
  try {
    const lang = getLanguage(ctx);

    ctx.session.temp.editingSchedule = {
      scheduleId,
      step: 'field',
    };
    await ctx.saveSession();

    await ctx.editMessageText(
      '✏️ ¿Qué deseas editar?',
      Markup.inlineKeyboard([
        [Markup.button.callback('📝 Nombre del Programa', `edit_schedule_field_programName_${scheduleId}`)],
        [Markup.button.callback('⏰ Horario', `edit_schedule_field_timeSlot_${scheduleId}`)],
        [Markup.button.callback('📄 Descripción', `edit_schedule_field_description_${scheduleId}`)],
        [Markup.button.callback('❌ Cancelar', 'admin_radio_schedule')],
      ]),
    );
  } catch (error) {
    logger.error('Error starting schedule edit:', error);
  }
};

module.exports = registerRadioManagementHandlers;
