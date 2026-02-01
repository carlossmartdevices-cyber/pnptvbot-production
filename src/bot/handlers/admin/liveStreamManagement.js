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
      await ctx.answerCbQuery(); // Answer immediately

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        return;
      }

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {};
      await ctx.saveSession();

      await ctx.editMessageText(
        '📺 Gestión de Transmisiones en Vivo',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔴 Transmisiones Activas', 'admin_live_active')],
          [Markup.button.callback('📊 Estadísticas', 'admin_live_stats')],
          [Markup.button.callback('🗑 Gestionar Todas', 'admin_live_all')],
          [Markup.button.callback('🎭 Aprobar Emotes', 'admin_emote_approval')],
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
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
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
          ]),
        );
        return;
      }

      let message = `🔴 *Active Streams (${activeStreams.length})*\n\n`;
      const buttons = [];

      activeStreams.forEach((stream, index) => {
        if (index < 10) { // Show max 10 in message
          const priceTag = stream.isPaid ? ` 💰$${stream.price}` : '';
          message
            += `${index + 1}. ${stream.title}${priceTag}\n`
            + `   👤 ${stream.hostName} (ID: ${stream.hostId})\n`
            + `   👥 ${stream.currentViewers} watching | 👁 ${stream.totalViews} views\n`
            + `   ❤️ ${stream.likes} likes\n\n`;

          buttons.push([
            Markup.button.callback(
              `⚙️ ${stream.title.substring(0, 25)}`,
              `admin_stream_manage_${stream.streamId}`,
            ),
          ]);
        }
      });

      if (activeStreams.length > 10) {
        message += `_...and ${activeStreams.length - 10} more_\n`;
      }

      buttons.push([Markup.button.callback('🔄 Actualizar', 'admin_live_active')]);
      buttons.push([Markup.button.callback('◀️ Volver', 'admin_live_streams')]);

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

      const message = '📊 *Live Stream Statistics*\n\n'
        + `📺 Total Streams: ${stats.total}\n`
        + `🔴 Active: ${stats.active}\n`
        + `🗓 Scheduled: ${stats.scheduled}\n`
        + `⚫ Ended: ${stats.ended}\n\n`
        + '*Engagement:*\n'
        + `👁 Total Views: ${stats.totalViewers.toLocaleString()}\n`
        + `❤️ Total Likes: ${stats.totalLikes.toLocaleString()}\n\n`
        + `_Updated: ${new Date().toLocaleString()}_`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Actualizar', 'admin_live_stats')],
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
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
          ]),
        );
        return;
      }

      const message = '📺 *All Streams*\n\n';
      const buttons = [];

      activeStreams.slice(0, 15).forEach((stream) => {
        const statusIcon = stream.status === 'active' ? '🔴'
          : stream.status === 'scheduled' ? '🗓' : '⚫';

        buttons.push([
          Markup.button.callback(
            `${statusIcon} ${stream.title.substring(0, 30)}`,
            `admin_stream_manage_${stream.streamId}`,
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
            [Markup.button.callback('◀️ Volver', 'admin_live_active')],
          ]),
        );
        return;
      }

      const statusEmoji = stream.status === 'active' ? '🔴 LIVE'
        : stream.status === 'scheduled' ? '🗓 Scheduled' : '⚫ Ended';

      const message = '📺 *Stream Details*\n\n'
        + `${statusEmoji}\n\n`
        + `*Title:* ${stream.title}\n`
        + `*Host:* ${stream.hostName} (ID: ${stream.hostId})\n`
        + `*Status:* ${stream.status}\n\n`
        + `*Viewers:* ${stream.currentViewers} watching now\n`
        + `*Total Views:* ${stream.totalViews}\n`
        + `*Likes:* ${stream.likes}\n\n`
        + `*Type:* ${stream.isPaid ? `💰 Paid ($${stream.price})` : '🆓 Free'}\n`
        + `*Max Viewers:* ${stream.maxViewers}\n\n`;

      const buttons = [];

      // Show different actions based on stream status
      if (stream.status === 'active') {
        buttons.push([Markup.button.callback('🛑 Finalizar Transmisión', `admin_stream_end_${streamId}`)]);
      }

      buttons.push([Markup.button.callback('🗑 Eliminar Transmisión', `admin_stream_delete_${streamId}`)]);
      buttons.push([Markup.button.callback('◀️ Volver', 'admin_live_active')]);

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
        '✅ Stream ended by admin\n\n'
          + `🎤 ${stream.title}\n`
          + `👁 ${stream.totalViews} total views\n`
          + `❤️ ${stream.likes} likes`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'admin_live_active')],
        ]),
      );

      logger.info('Stream ended by admin', { adminId: ctx.from.id, streamId });

      // Notify the host
      try {
        await ctx.telegram.sendMessage(
          stream.hostId,
          `⚠️ Your stream "${stream.title}" was ended by an administrator.`,
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
        '⚠️ *Confirm Deletion*\n\n'
          + 'Are you sure you want to delete this stream?\n\n'
          + `*Title:* ${stream.title}\n`
          + `*Host:* ${stream.hostName}\n`
          + `*Views:* ${stream.totalViews}\n\n`
          + 'This action cannot be undone.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Confirmar', `admin_stream_delete_confirm_${streamId}`),
              Markup.button.callback('❌ Cancelar', `admin_stream_manage_${streamId}`),
            ],
          ]),
        },
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
        '✅ Stream deleted successfully\n\n'
          + `🎤 ${stream.title}\n`
          + `👤 ${stream.hostName}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'admin_live_active')],
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
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
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

      buttons.push([Markup.button.callback('🔄 Actualizar', 'admin_emote_approval')]);
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
            [Markup.button.callback('◀️ Volver', 'admin_emote_approval')],
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
            Markup.button.callback('✅ Aprobar', `admin_emote_approve_${emoteId}`),
            Markup.button.callback('❌ Rechazar', `admin_emote_reject_${emoteId}`),
          ],
          [Markup.button.url('🖼️ Ver Imagen', emote.imageUrl)],
          [Markup.button.callback('◀️ Volver', 'admin_emote_approval')],
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
            [Markup.button.callback('◀️ Volver', 'admin_emote_approval')],
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
            [Markup.button.callback('◀️ Volver', 'admin_emote_approval')],
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

  // ============= CREATE STREAM =============
  // Create stream - Step 1: Ask for host ID
  bot.action('admin_live_create', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.creatingStream = true;
      ctx.session.temp.streamData = {};
      ctx.session.temp.streamStep = 'hostId';
      await ctx.saveSession();

      await ctx.editMessageText(
        '➕ **Crear Nueva Transmisión**\n\n' +
        'Paso 1 de 6: Host de la Transmisión\n\n' +
        'Envía el ID de Telegram del usuario que será el host de la transmisión:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting stream creation:', error);
      await ctx.answerCbQuery('Error al iniciar creación');
    }
  });

  // ============= EDIT STREAM =============
  // Edit stream menu
  bot.action(/^admin_stream_edit_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.answerCbQuery('Transmisión no encontrada');
        return;
      }

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingStreamId = streamId;
      await ctx.saveSession();

      await ctx.editMessageText(
        `✏️ **Editar Transmisión**\n\n` +
        `**${stream.title}**\n\n` +
        `Selecciona qué campo deseas modificar:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Título', `admin_stream_edit_field_${streamId}_title`)],
            [Markup.button.callback('📄 Descripción', `admin_stream_edit_field_${streamId}_description`)],
            [Markup.button.callback('💰 Precio', `admin_stream_edit_field_${streamId}_price`)],
            [Markup.button.callback('👥 Max Viewers', `admin_stream_edit_field_${streamId}_maxViewers`)],
            [Markup.button.callback('🖼️ Thumbnail', `admin_stream_edit_field_${streamId}_thumbnail`)],
            [Markup.button.callback('◀️ Volver', `admin_stream_manage_${streamId}`)],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing stream edit menu:', error);
      await ctx.answerCbQuery('Error al mostrar menú de edición');
    }
  });

  // Edit stream field - Prompt for input
  bot.action(/^admin_stream_edit_field_(.+)_(title|description|price|maxViewers|thumbnail)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const field = ctx.match[2];
      const stream = await LiveStreamModel.getById(streamId);

      if (!stream) {
        await ctx.answerCbQuery('Transmisión no encontrada');
        return;
      }

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingStreamId = streamId;
      ctx.session.temp.editingStreamField = field;
      await ctx.saveSession();

      let message = '';
      let currentValue = '';

      switch (field) {
        case 'title':
          currentValue = stream.title;
          message = `📝 **Editar Título**\n\n` +
            `Título actual: ${currentValue}\n\n` +
            `Envía el nuevo título:`;
          break;

        case 'description':
          currentValue = stream.description || 'N/A';
          message = `📄 **Editar Descripción**\n\n` +
            `Descripción actual: ${currentValue}\n\n` +
            `Envía la nueva descripción:`;
          break;

        case 'price':
          currentValue = stream.isPaid ? `$${stream.price}` : 'Gratis';
          message = `💰 **Editar Precio**\n\n` +
            `Precio actual: ${currentValue}\n\n` +
            `Envía el nuevo precio (0 para gratis):\n` +
            `Ejemplo: 5.99`;
          break;

        case 'maxViewers':
          currentValue = stream.maxViewers;
          message = `👥 **Editar Límite de Espectadores**\n\n` +
            `Límite actual: ${currentValue}\n\n` +
            `Envía el nuevo límite de espectadores:\n` +
            `Ejemplo: 1000`;
          break;

        case 'thumbnail':
          currentValue = stream.thumbnailUrl || 'Sin thumbnail';
          message = `🖼️ **Editar Thumbnail**\n\n` +
            `Thumbnail actual: ${currentValue}\n\n` +
            `Envía la URL del nuevo thumbnail:`;
          break;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', `admin_stream_edit_${streamId}`)],
        ]),
      });
    } catch (error) {
      logger.error('Error prompting for stream field edit:', error);
      await ctx.answerCbQuery('Error al iniciar edición');
    }
  });

  // ============= VOD MANAGEMENT =============
  // View VODs
  bot.action('admin_live_vods', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const vods = await LiveStreamModel.getVODs({}, 20);

      if (vods.length === 0) {
        await ctx.editMessageText(
          '📹 **VODs Grabados**\n\n' +
          'No hay grabaciones disponibles.',
          Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
          ])
        );
        return;
      }

      let message = `📹 **VODs Grabados (${vods.length})**\n\n`;
      const buttons = [];

      vods.slice(0, 10).forEach((vod, index) => {
        if (index < 5) {
          message += `${index + 1}. ${vod.title}\n` +
            `   👤 ${vod.hostName}\n` +
            `   ⏱️ ${vod.duration} min | 👁 ${vod.totalViews} views\n\n`;
        }

        buttons.push([
          Markup.button.callback(
            `📹 ${vod.title.substring(0, 30)}`,
            `admin_vod_manage_${vod.streamId}`
          ),
        ]);
      });

      if (vods.length > 5) {
        message += `_...y ${vods.length - 5} más_\n`;
      }

      buttons.push([Markup.button.callback('🔄 Actualizar', 'admin_live_vods')]);
      buttons.push([Markup.button.callback('◀️ Volver', 'admin_live_streams')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error viewing VODs:', error);
      await ctx.reply('Error al cargar VODs');
    }
  });

  // Manage specific VOD
  bot.action(/^admin_vod_manage_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];
      const vod = await LiveStreamModel.getById(streamId);

      if (!vod) {
        await ctx.answerCbQuery('VOD no encontrado');
        return;
      }

      const message = '📹 **Detalles del VOD**\n\n' +
        `*Título:* ${vod.title}\n` +
        `*Host:* ${vod.hostName}\n` +
        `*Duración:* ${vod.duration} minutos\n` +
        `*Vistas:* ${vod.totalViews}\n` +
        `*Likes:* ${vod.likes}\n` +
        `*Categoría:* ${vod.category}\n\n` +
        `*Grabado:* ${vod.endedAt ? vod.endedAt.toLocaleDateString() : 'N/A'}\n` +
        `*URL:* ${vod.recordingUrl || 'No disponible'}`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Editar Thumbnail', `admin_vod_edit_thumb_${streamId}`)],
          [Markup.button.callback('🗑 Eliminar VOD', `admin_stream_delete_${streamId}`)],
          vod.recordingUrl ? [Markup.button.url('▶️ Ver VOD', vod.recordingUrl)] : [],
          [Markup.button.callback('◀️ Volver', 'admin_live_vods')],
        ].filter(row => row.length > 0)),
      });
    } catch (error) {
      logger.error('Error managing VOD:', error);
      await ctx.reply('Error al cargar VOD');
    }
  });

  // Edit VOD thumbnail
  bot.action(/^admin_vod_edit_thumb_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamId = ctx.match[1];

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingStreamId = streamId;
      ctx.session.temp.editingStreamField = 'thumbnail';
      await ctx.saveSession();

      await ctx.editMessageText(
        '🖼️ **Editar Thumbnail del VOD**\n\n' +
        'Envía la URL del nuevo thumbnail:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', `admin_vod_manage_${streamId}`)],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error editing VOD thumbnail:', error);
      await ctx.answerCbQuery('Error al editar thumbnail');
    }
  });

  // ============= TEXT INPUT HANDLERS =============
  // Handle text inputs for stream creation and editing
  bot.on('text', async (ctx, next) => {
    // Stream creation flow
    if (ctx.session.temp?.creatingStream) {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) return next();

        const step = ctx.session.temp.streamStep;
        const input = ctx.message.text.trim();
        const streamData = ctx.session.temp.streamData || {};

        switch (step) {
          case 'hostId': {
            // Validate user ID
            if (!/^\d+$/.test(input)) {
              await ctx.reply('❌ ID de usuario inválido. Debe ser un número.');
              return;
            }

            const UserModel = require('../../../models/userModel');
            const user = await UserModel.getById(input);
            if (!user) {
              await ctx.reply('❌ Usuario no encontrado.');
              return;
            }

            streamData.hostId = input;
            streamData.hostName = user.firstName || user.username || 'Usuario';
            ctx.session.temp.streamData = streamData;
            ctx.session.temp.streamStep = 'title';
            await ctx.saveSession();

            await ctx.reply(
              `✅ Host: ${streamData.hostName}\n\n` +
              `Paso 2 de 6: Título\n\n` +
              `Envía el título de la transmisión:`,
              Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
              ])
            );
            break;
          }

          case 'title': {
            if (input.length < 3 || input.length > 100) {
              await ctx.reply('❌ El título debe tener entre 3 y 100 caracteres.');
              return;
            }

            streamData.title = input;
            ctx.session.temp.streamData = streamData;
            ctx.session.temp.streamStep = 'description';
            await ctx.saveSession();

            await ctx.reply(
              `✅ Título: ${streamData.title}\n\n` +
              `Paso 3 de 6: Descripción\n\n` +
              `Envía la descripción de la transmisión (o "skip" para omitir):`,
              Markup.inlineKeyboard([
                [Markup.button.callback('⏭ Omitir', 'admin_stream_create_skip_desc')],
                [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
              ])
            );
            break;
          }

          case 'description': {
            streamData.description = input === 'skip' ? '' : input;
            ctx.session.temp.streamData = streamData;
            ctx.session.temp.streamStep = 'category';
            await ctx.saveSession();

            await ctx.reply(
              `✅ Descripción configurada\n\n` +
              `Paso 4 de 6: Categoría\n\n` +
              `Selecciona la categoría:`,
              Markup.inlineKeyboard([
                [Markup.button.callback('🎵 Música', 'admin_stream_cat_music')],
                [Markup.button.callback('🎮 Gaming', 'admin_stream_cat_gaming')],
                [Markup.button.callback('🎙 Talk Show', 'admin_stream_cat_talk_show')],
                [Markup.button.callback('📚 Educación', 'admin_stream_cat_education')],
                [Markup.button.callback('🎭 Entretenimiento', 'admin_stream_cat_entertainment')],
                [Markup.button.callback('📁 Otro', 'admin_stream_cat_other')],
              ])
            );
            break;
          }

          case 'price': {
            const price = parseFloat(input);
            if (isNaN(price) || price < 0) {
              await ctx.reply('❌ Precio inválido. Envía un número válido (0 para gratis).');
              return;
            }

            streamData.isPaid = price > 0;
            streamData.price = price;
            ctx.session.temp.streamData = streamData;
            ctx.session.temp.streamStep = 'schedule';
            await ctx.saveSession();

            await ctx.reply(
              `✅ Precio: ${price > 0 ? `$${price}` : 'Gratis'}\n\n` +
              `Paso 6 de 6: Programación\n\n` +
              `¿Deseas programar la transmisión para más tarde?`,
              Markup.inlineKeyboard([
                [Markup.button.callback('📅 Programar', 'admin_stream_schedule_yes')],
                [Markup.button.callback('🔴 Iniciar Ahora', 'admin_stream_schedule_no')],
                [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
              ])
            );
            break;
          }

          case 'scheduledFor': {
            // Parse date/time - expecting format: YYYY-MM-DD HH:MM
            const dateMatch = input.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
            if (!dateMatch) {
              await ctx.reply(
                '❌ Formato de fecha inválido.\n\n' +
                'Usa el formato: YYYY-MM-DD HH:MM\n' +
                'Ejemplo: 2025-01-20 15:30'
              );
              return;
            }

            const scheduledDate = new Date(input);
            if (scheduledDate <= new Date()) {
              await ctx.reply('❌ La fecha debe ser en el futuro.');
              return;
            }

            streamData.scheduledFor = scheduledDate;

            // Create the stream
            try {
              const newStream = await LiveStreamModel.create(streamData);

              ctx.session.temp.creatingStream = false;
              ctx.session.temp.streamData = null;
              ctx.session.temp.streamStep = null;
              await ctx.saveSession();

              await ctx.reply(
                `✅ **Transmisión Programada Creada**\n\n` +
                `📺 ${newStream.title}\n` +
                `👤 Host: ${newStream.hostName}\n` +
                `📅 Programada para: ${scheduledDate.toLocaleString()}\n` +
                `🆔 ID: ${newStream.streamId}`,
                {
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [Markup.button.callback('◀️ Volver a Lives', 'admin_live_streams')],
                  ]),
                }
              );



              logger.info('Scheduled stream created by admin', {
                adminId: ctx.from.id,
                streamId: newStream.streamId,
                hostId: newStream.hostId,
              });
            } catch (createError) {
              logger.error('Error creating scheduled stream:', createError);
              await ctx.reply('❌ Error al crear la transmisión programada.');

              ctx.session.temp.creatingStream = false;
              ctx.session.temp.streamData = null;
              await ctx.saveSession();
            }
            break;
          }
        }
      } catch (error) {
        logger.error('Error in stream creation flow:', error);
        await ctx.reply('❌ Error en el proceso de creación');

        ctx.session.temp.creatingStream = false;
        ctx.session.temp.streamData = null;
        await ctx.saveSession();
      }
      return;
    }

    // Stream editing flow
    if (ctx.session.temp?.editingStreamId && ctx.session.temp?.editingStreamField) {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) return next();

        const streamId = ctx.session.temp.editingStreamId;
        const field = ctx.session.temp.editingStreamField;
        const input = ctx.message.text.trim();

        const db = require('../../../config/firebase').getFirestore();
        const updateData = { updatedAt: new Date() };
        let successMessage = '';

        switch (field) {
          case 'title': {
            if (input.length < 3 || input.length > 100) {
              await ctx.reply('❌ El título debe tener entre 3 y 100 caracteres.');
              return;
            }
            updateData.title = input;
            successMessage = `✅ Título actualizado: ${input}`;
            break;
          }

          case 'description': {
            updateData.description = input;
            successMessage = `✅ Descripción actualizada`;
            break;
          }

          case 'price': {
            const price = parseFloat(input);
            if (isNaN(price) || price < 0) {
              await ctx.reply('❌ Precio inválido. Envía un número válido.');
              return;
            }
            updateData.isPaid = price > 0;
            updateData.price = price;
            successMessage = `✅ Precio actualizado: ${price > 0 ? `$${price}` : 'Gratis'}`;
            break;
          }

          case 'maxViewers': {
            const maxViewers = parseInt(input, 10);
            if (isNaN(maxViewers) || maxViewers < 1) {
              await ctx.reply('❌ Número de espectadores inválido.');
              return;
            }
            updateData.maxViewers = maxViewers;
            successMessage = `✅ Límite de espectadores actualizado: ${maxViewers}`;
            break;
          }

          case 'thumbnail': {
            // Basic URL validation
            if (!input.startsWith('http://') && !input.startsWith('https://')) {
              await ctx.reply('❌ URL inválida. Debe comenzar con http:// o https://');
              return;
            }
            updateData.thumbnailUrl = input;
            successMessage = `✅ Thumbnail actualizado`;
            break;
          }
        }

        // Update the stream
        await db.collection('live_streams').doc(streamId).update(updateData);

        ctx.session.temp.editingStreamId = null;
        ctx.session.temp.editingStreamField = null;
        await ctx.saveSession();

        await ctx.reply(
          successMessage,
          Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Editar Otro Campo', `admin_stream_edit_${streamId}`)],
            [Markup.button.callback('👁️ Ver Detalles', `admin_stream_manage_${streamId}`)],
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
          ])
        );

        logger.info('Stream field updated by admin', {
          adminId: ctx.from.id,
          streamId,
          field,
        });
      } catch (error) {
        logger.error('Error updating stream field:', error);
        await ctx.reply('❌ Error al actualizar la transmisión');
      }
      return;
    }

    return next();
  });

  // Skip description in creation flow
  bot.action('admin_stream_create_skip_desc', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamData = ctx.session.temp.streamData || {};
      streamData.description = '';
      ctx.session.temp.streamData = streamData;
      ctx.session.temp.streamStep = 'category';
      await ctx.saveSession();

      await ctx.editMessageText(
        `✅ Descripción omitida\n\n` +
        `Paso 4 de 6: Categoría\n\n` +
        `Selecciona la categoría:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🎵 Música', 'admin_stream_cat_music')],
          [Markup.button.callback('🎮 Gaming', 'admin_stream_cat_gaming')],
          [Markup.button.callback('🎙 Talk Show', 'admin_stream_cat_talk_show')],
          [Markup.button.callback('📚 Educación', 'admin_stream_cat_education')],
          [Markup.button.callback('🎭 Entretenimiento', 'admin_stream_cat_entertainment')],
          [Markup.button.callback('📁 Otro', 'admin_stream_cat_other')],
        ])
      );
    } catch (error) {
      logger.error('Error skipping description:', error);
    }
  });

  // Category selection handlers
  const categories = {
    music: 'Música',
    gaming: 'Gaming',
    talk_show: 'Talk Show',
    education: 'Educación',
    entertainment: 'Entretenimiento',
    other: 'Otro'
  };

  Object.keys(categories).forEach((catKey) => {
    bot.action(`admin_stream_cat_${catKey}`, async (ctx) => {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) return;

        const streamData = ctx.session.temp.streamData || {};
        streamData.category = catKey;
        ctx.session.temp.streamData = streamData;
        ctx.session.temp.streamStep = 'price';
        await ctx.saveSession();

        await ctx.editMessageText(
          `✅ Categoría: ${categories[catKey]}\n\n` +
          `Paso 5 de 6: Precio\n\n` +
          `Envía el precio de la transmisión (0 para gratis):\n` +
          `Ejemplo: 5.99`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🆓 Gratis', 'admin_stream_price_free')],
            [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
          ])
        );
      } catch (error) {
        logger.error('Error setting category:', error);
      }
    });
  });

  // Free price shortcut
  bot.action('admin_stream_price_free', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamData = ctx.session.temp.streamData || {};
      streamData.isPaid = false;
      streamData.price = 0;
      ctx.session.temp.streamData = streamData;
      ctx.session.temp.streamStep = 'schedule';
      await ctx.saveSession();

      await ctx.editMessageText(
        `✅ Precio: Gratis\n\n` +
        `Paso 6 de 6: Programación\n\n` +
        `¿Deseas programar la transmisión para más tarde?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📅 Programar', 'admin_stream_schedule_yes')],
          [Markup.button.callback('🔴 Iniciar Ahora', 'admin_stream_schedule_no')],
          [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
        ])
      );
    } catch (error) {
      logger.error('Error setting free price:', error);
    }
  });

  // Schedule options
  bot.action('admin_stream_schedule_yes', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      ctx.session.temp.streamStep = 'scheduledFor';
      await ctx.saveSession();

      await ctx.editMessageText(
        `📅 **Programar Transmisión**\n\n` +
        `Envía la fecha y hora de inicio:\n\n` +
        `Formato: YYYY-MM-DD HH:MM\n` +
        `Ejemplo: 2025-01-20 15:30`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_live_streams')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error prompting for schedule:', error);
    }
  });

  bot.action('admin_stream_schedule_no', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const streamData = ctx.session.temp.streamData || {};

      // Create the stream
      try {
        const newStream = await LiveStreamModel.create(streamData);

        ctx.session.temp.creatingStream = false;
        ctx.session.temp.streamData = null;
        ctx.session.temp.streamStep = null;
        await ctx.saveSession();

        await ctx.editMessageText(
          `✅ **Transmisión Creada**\n\n` +
          `🔴 LIVE: ${newStream.title}\n` +
          `👤 Host: ${newStream.hostName} (ID: ${newStream.hostId})\n` +
          `📂 Categoría: ${categories[newStream.category] || newStream.category}\n` +
          `💰 ${newStream.isPaid ? `$${newStream.price}` : 'Gratis'}\n\n` +
          `🆔 Stream ID: ${newStream.streamId}\n` +
          `📡 Channel: ${newStream.channelName}`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('👁️ Ver Detalles', `admin_stream_manage_${newStream.streamId}`)],
              [Markup.button.callback('◀️ Volver a Lives', 'admin_live_streams')],
            ]),
          }
        );

        // Notify the host
        try {
          await ctx.telegram.sendMessage(
            newStream.hostId,
            `🔴 Se ha creado una transmisión en vivo para ti:\n\n` +
            `📺 ${newStream.title}\n` +
            `🆔 ID: ${newStream.streamId}\n\n` +
            `Usa el bot para comenzar a transmitir.`
          );
        } catch (notifyError) {
          logger.warn('Failed to notify stream host:', { hostId: newStream.hostId });
        }



        logger.info('Stream created by admin', {
          adminId: ctx.from.id,
          streamId: newStream.streamId,
          hostId: newStream.hostId,
        });
      } catch (createError) {
        logger.error('Error creating stream:', createError);
        await ctx.editMessageText(
          '❌ Error al crear la transmisión.\n\n' +
          `Detalles: ${createError.message}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Volver', 'admin_live_streams')],
          ])
        );

        ctx.session.temp.creatingStream = false;
        ctx.session.temp.streamData = null;
        await ctx.saveSession();
      }
    } catch (error) {
      logger.error('Error in immediate stream creation:', error);
    }
  });
};

module.exports = registerLiveStreamManagementHandlers;
