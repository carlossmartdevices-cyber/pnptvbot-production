const { Markup } = require('telegraf');
const LiveStreamModel = require('../../../models/liveStreamModel');
const EmoteModel = require('../../../models/emoteModel');
const PermissionService = require('../../services/permissionService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Register live stream management handlers for admins
 * @param {Telegraf} bot - Bot instance
 */
const registerLiveStreamManagementHandlers = (bot) => {
  // Main live stream management menu
  bot.action('admin_live_streams', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery(t('unauthorized', getLanguage(ctx)));
        return;
      }

      const lang = getLanguage(ctx);

      await ctx.editMessageText(
        '📺 Live Stream Management',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔴 Active Streams', 'admin_live_active')],
          [Markup.button.callback('📊 Stream Statistics', 'admin_live_stats')],
          [Markup.button.callback('🗑 Manage All Streams', 'admin_live_all')],
          [Markup.button.callback('🎭 Approve Emotes', 'admin_emote_approval')],
          [Markup.button.callback(t('back', lang), 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing live stream management:', error);
    }
  });

  // View active streams
  bot.action('admin_live_active', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);
      const activeStreams = await LiveStreamModel.getActiveStreams(50);

      if (activeStreams.length === 0) {
        await ctx.editMessageText(
          t('noActiveStreams', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_live_streams')],
          ]),
        );
        return;
      }

      let message = `🔴 *Active Streams (${activeStreams.length})*\n\n`;
      const buttons = [];

      activeStreams.forEach((stream, index) => {
        if (index < 10) { // Show max 10 in message
          const priceTag = stream.isPaid ? ` 💰$${stream.price}` : '';
          message +=
            `${index + 1}. ${stream.title}${priceTag}\n` +
            `   👤 ${stream.hostName} (ID: ${stream.hostId})\n` +
            `   👥 ${stream.currentViewers} watching | 👁 ${stream.totalViews} views\n` +
            `   ❤️ ${stream.likes} likes\n\n`;

          buttons.push([
            Markup.button.callback(
              `⚙️ ${stream.title.substring(0, 25)}`,
              `admin_stream_manage_${stream.streamId}`
            ),
          ]);
        }
      });

      if (activeStreams.length > 10) {
        message += `_...and ${activeStreams.length - 10} more_\n`;
      }

      buttons.push([Markup.button.callback('🔄 Refresh', 'admin_live_active')]);
      buttons.push([Markup.button.callback(t('back', lang), 'admin_live_streams')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error viewing active streams:', error);
      await ctx.reply('Error loading active streams');
    }
  });

  // View stream statistics
  bot.action('admin_live_stats', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);
      const stats = await LiveStreamModel.getStatistics();

      const message =
        '📊 *Live Stream Statistics*\n\n' +
        `📺 Total Streams: ${stats.total}\n` +
        `🔴 Active: ${stats.active}\n` +
        `🗓 Scheduled: ${stats.scheduled}\n` +
        `⚫ Ended: ${stats.ended}\n\n` +
        `*Engagement:*\n` +
        `👁 Total Views: ${stats.totalViewers.toLocaleString()}\n` +
        `❤️ Total Likes: ${stats.totalLikes.toLocaleString()}\n\n` +
        `_Updated: ${new Date().toLocaleString()}_`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'admin_live_stats')],
          [Markup.button.callback(t('back', lang), 'admin_live_streams')],
        ]),
      });
    } catch (error) {
      logger.error('Error viewing stream statistics:', error);
      await ctx.reply('Error loading statistics');
    }
  });

  // Manage all streams (paginated)
  bot.action(/^admin_live_all(?:_(\d+))?$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Get both active and ended streams
      const activeStreams = await LiveStreamModel.getActiveStreams(100);

      if (activeStreams.length === 0) {
        await ctx.editMessageText(
          'No streams found',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_live_streams')],
          ]),
        );
        return;
      }

      let message = '📺 *All Streams*\n\n';
      const buttons = [];

      activeStreams.slice(0, 15).forEach((stream) => {
        const statusIcon =
          stream.status === 'active' ? '🔴' :
          stream.status === 'scheduled' ? '🗓' : '⚫';

        buttons.push([
          Markup.button.callback(
            `${statusIcon} ${stream.title.substring(0, 30)}`,
            `admin_stream_manage_${stream.streamId}`
          ),
        ]);
      });

      buttons.push([Markup.button.callback(t('back', lang), 'admin_live_streams')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error viewing all streams:', error);
      await ctx.reply('Error loading streams');
    }
  });

  // Manage specific stream
  bot.action(/^admin_stream_manage_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid stream manage action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const lang = getLanguage(ctx);
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.editMessageText(
          t('streamNotFound', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_live_active')],
          ]),
        );
        return;
      }

      const statusEmoji =
        stream.status === 'active' ? '🔴 LIVE' :
        stream.status === 'scheduled' ? '🗓 Scheduled' : '⚫ Ended';

      const message =
        `📺 *Stream Details*\n\n` +
        `${statusEmoji}\n\n` +
        `*Title:* ${stream.title}\n` +
        `*Host:* ${stream.hostName} (ID: ${stream.hostId})\n` +
        `*Status:* ${stream.status}\n\n` +
        `*Viewers:* ${stream.currentViewers} watching now\n` +
        `*Total Views:* ${stream.totalViews}\n` +
        `*Likes:* ${stream.likes}\n\n` +
        `*Type:* ${stream.isPaid ? `💰 Paid ($${stream.price})` : '🆓 Free'}\n` +
        `*Max Viewers:* ${stream.maxViewers}\n\n`;

      const buttons = [];

      // Show different actions based on stream status
      if (stream.status === 'active') {
        buttons.push([Markup.button.callback('🛑 End Stream', `admin_stream_end_${streamId}`)]);
      }

      buttons.push([Markup.button.callback('🗑 Delete Stream', `admin_stream_delete_${streamId}`)]);
      buttons.push([Markup.button.callback(t('back', lang), 'admin_live_active')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error managing stream:', error);
      await ctx.reply('Error loading stream details');
    }
  });

  // Admin end stream
  bot.action(/^admin_stream_end_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid stream end action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const lang = getLanguage(ctx);
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.editMessageText(t('streamNotFound', lang));
        return;
      }

      // Admin can end any stream by passing the host ID
      await LiveStreamModel.endStream(streamId, stream.hostId);

      await ctx.editMessageText(
        `✅ Stream ended by admin\n\n` +
          `🎤 ${stream.title}\n` +
          `👁 ${stream.totalViews} total views\n` +
          `❤️ ${stream.likes} likes`,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'admin_live_active')],
        ]),
      );

      logger.info('Stream ended by admin', { adminId: ctx.from.id, streamId });

      // Notify the host
      try {
        await ctx.telegram.sendMessage(
          stream.hostId,
          `⚠️ Your stream "${stream.title}" was ended by an administrator.`
        );
      } catch (notifyError) {
        logger.warn('Failed to notify stream host:', { streamId, hostId: stream.hostId });
      }
    } catch (error) {
      logger.error('Error ending stream as admin:', error);
      await ctx.reply('Error ending stream');
    }
  });

  // Admin delete stream
  bot.action(/^admin_stream_delete_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid stream delete action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Store stream data before deletion for confirmation message
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.editMessageText(t('streamNotFound', lang));
        return;
      }

      // Confirm deletion
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.streamToDelete = streamId;
      await ctx.saveSession();

      await ctx.editMessageText(
        `⚠️ *Confirm Deletion*\n\n` +
          `Are you sure you want to delete this stream?\n\n` +
          `*Title:* ${stream.title}\n` +
          `*Host:* ${stream.hostName}\n` +
          `*Views:* ${stream.totalViews}\n\n` +
          `This action cannot be undone.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Confirm', `admin_stream_delete_confirm_${streamId}`),
              Markup.button.callback('❌ Cancel', `admin_stream_manage_${streamId}`),
            ],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error preparing stream deletion:', error);
      await ctx.reply('Error deleting stream');
    }
  });

  // Confirm stream deletion
  bot.action(/^admin_stream_delete_confirm_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid stream delete confirm action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Get stream info before deletion
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.editMessageText(t('streamNotFound', lang));
        return;
      }

      // Delete the stream
      await LiveStreamModel.delete(streamId);

      await ctx.editMessageText(
        `✅ Stream deleted successfully\n\n` +
          `🎤 ${stream.title}\n` +
          `👤 ${stream.hostName}`,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'admin_live_active')],
        ]),
      );

      logger.info('Stream deleted by admin', { adminId: ctx.from.id, streamId, title: stream.title });

      // Clear session
      if (ctx.session.temp) {
        ctx.session.temp.streamToDelete = null;
        await ctx.saveSession();
      }
    } catch (error) {
      logger.error('Error confirming stream deletion:', error);
      await ctx.reply('Error deleting stream');
    }
  });

  // Admin emote approval
  bot.action('admin_emote_approval', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);
      const pendingEmotes = await EmoteModel.getPendingEmotes(20);

      if (pendingEmotes.length === 0) {
        await ctx.editMessageText(
          '✅ No pending emotes to review',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_live_streams')],
          ]),
        );
        return;
      }

      let message = `🎭 *Pending Emotes (${pendingEmotes.length})*\n\n`;

      pendingEmotes.slice(0, 10).forEach((emote, index) => {
        message +=
          `${index + 1}. \`:${emote.code}:\`\n` +
          `   👤 ${emote.streamerName}\n` +
          `   📅 ${emote.createdAt.toDate().toLocaleDateString()}\n\n`;
      });

      if (pendingEmotes.length > 10) {
        message += `_...and ${pendingEmotes.length - 10} more_\n`;
      }

      const buttons = [];
      pendingEmotes.slice(0, 10).forEach((emote) => {
        buttons.push([
          Markup.button.callback(
            `Review :${emote.code}:`,
            `admin_emote_review_${emote.emoteId}`
          ),
        ]);
      });

      buttons.push([Markup.button.callback('🔄 Refresh', 'admin_emote_approval')]);
      buttons.push([Markup.button.callback(t('back', lang), 'admin_live_streams')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing emote approval:', error);
      await ctx.reply('Error loading pending emotes');
    }
  });

  // Review specific emote
  bot.action(/^admin_emote_review_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid emote review action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const emoteId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Get all pending emotes to find this one
      const pendingEmotes = await EmoteModel.getPendingEmotes(100);
      const emote = pendingEmotes.find((e) => e.emoteId === emoteId);

      if (!emote) {
        await ctx.editMessageText(
          'Emote not found or already reviewed',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_emote_approval')],
          ]),
        );
        return;
      }

      const message =
        `🎭 *Review Emote*\n\n` +
        `Code: \`:${emote.code}:\`\n` +
        `Creator: ${emote.streamerName} (ID: ${emote.streamerId})\n` +
        `Image: ${emote.imageUrl}\n` +
        `Created: ${emote.createdAt.toDate().toLocaleDateString()}\n\n` +
        `Please review the emote image and decide:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `admin_emote_approve_${emoteId}`),
            Markup.button.callback('❌ Reject', `admin_emote_reject_${emoteId}`),
          ],
          [Markup.button.url('🖼️ View Image', emote.imageUrl)],
          [Markup.button.callback(t('back', lang), 'admin_emote_approval')],
        ]),
      });
    } catch (error) {
      logger.error('Error reviewing emote:', error);
      await ctx.reply('Error loading emote details');
    }
  });

  // Approve emote
  bot.action(/^admin_emote_approve_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid emote approve action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const emoteId = ctx.match[1];
      const lang = getLanguage(ctx);
      const adminId = ctx.from.id;

      // Get emote info before approval
      const pendingEmotes = await EmoteModel.getPendingEmotes(100);
      const emote = pendingEmotes.find((e) => e.emoteId === emoteId);

      if (!emote) {
        await ctx.answerCbQuery('Emote not found');
        return;
      }

      await EmoteModel.approveEmote(emoteId, adminId);

      await ctx.editMessageText(
        `✅ *Emote Approved*\n\n` +
          `Code: :${emote.code}:\n` +
          `Creator: ${emote.streamerName}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_emote_approval')],
          ]),
        }
      );

      logger.info('Emote approved by admin', { adminId, emoteId, code: emote.code });

      // Notify the creator
      try {
        await ctx.telegram.sendMessage(
          emote.streamerId,
          `✅ Your emote \":${emote.code}:\" has been approved and is now active!`
        );
      } catch (notifyError) {
        logger.warn('Failed to notify emote creator:', { emoteId, streamerId: emote.streamerId });
      }
    } catch (error) {
      logger.error('Error approving emote:', error);
      await ctx.reply('Error approving emote');
    }
  });

  // Reject emote
  bot.action(/^admin_emote_reject_(.+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid emote reject action format');
        return;
      }

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const emoteId = ctx.match[1];
      const lang = getLanguage(ctx);
      const adminId = ctx.from.id;

      // Get emote info before rejection
      const pendingEmotes = await EmoteModel.getPendingEmotes(100);
      const emote = pendingEmotes.find((e) => e.emoteId === emoteId);

      if (!emote) {
        await ctx.answerCbQuery('Emote not found');
        return;
      }

      await EmoteModel.rejectEmote(emoteId, adminId, 'Inappropriate or against guidelines');

      await ctx.editMessageText(
        `❌ *Emote Rejected*\n\n` +
          `Code: :${emote.code}:\n` +
          `Creator: ${emote.streamerName}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_emote_approval')],
          ]),
        }
      );

      logger.info('Emote rejected by admin', { adminId, emoteId, code: emote.code });

      // Notify the creator
      try {
        await ctx.telegram.sendMessage(
          emote.streamerId,
          `❌ Your emote \":${emote.code}:\" was rejected. Reason: Inappropriate or against guidelines`
        );
      } catch (notifyError) {
        logger.warn('Failed to notify emote creator:', { emoteId, streamerId: emote.streamerId });
      }
    } catch (error) {
      logger.error('Error rejecting emote:', error);
      await ctx.reply('Error rejecting emote');
    }
  });
};

module.exports = registerLiveStreamManagementHandlers;
