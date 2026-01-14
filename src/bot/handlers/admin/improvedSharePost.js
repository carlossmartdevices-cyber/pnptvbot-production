/**
 * Improved Share Post to Channel/Group Handler
 * Multi-step wizard for creating and scheduling posts with media, text, and buttons
 * Based on broadcast feature structure but simplified for channel/group posting
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const communityPostService = require('../../services/communityPostService');
const PermissionService = require('../../services/permissionService');
const { getLanguage } = require('../../utils/helpers');
const GrokService = require('../../services/grokService');
const broadcastUtils = require('../../utils/broadcastUtils');
const performanceUtils = require('../../utils/performanceUtils');
const uxUtils = require('../../utils/uxUtils');

// Use shared utilities
const { 
  getStandardButtonOptions, 
  normalizeButtons, 
  buildInlineKeyboard, 
  buildPostCaption 
} = broadcastUtils;

function getSharePostButtonOptions() {
  return getStandardButtonOptions();
}

/**
 * Register improved share post handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerImprovedSharePostHandlers = (bot) => {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Main entry point - Show channel/group selection
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('admin_improved_share_post', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      if (!ctx.session.temp) ctx.session.temp = {};

      // Initialize session data
      ctx.session.temp.sharePostStep = 'select_destinations';
      ctx.session.temp.sharePostData = {
        channelIds: [],
        groupIds: [],
        mediaType: null,
        mediaFileId: null,
        fileSizeMB: 0,
        text: '',
        buttons: [getSharePostButtonOptions()[0]], // default: home button only
        scheduledAt: null,
        isScheduled: false
      };
      await ctx.saveSession();

      await ctx.answerCbQuery();

      // Show destination selection (channels + groups)
      const destinations = await communityPostService.getPostingDestinations();
      const buttons = [];

      // Separate channels and groups
      const channels = destinations.filter(d => d.destination_type === 'channel');
      const groups = destinations.filter(d => d.destination_type === 'group');

      // Add channel selection buttons
      if (channels.length > 0) {
        buttons.push([Markup.button.callback('━━ Canales ━━', 'share_post_channels_header')]);
        for (const channel of channels) {
          buttons.push([
            Markup.button.callback(
              channel.icon + ' ' + channel.destination_name,
              'share_post_channel_' + channel.telegram_id
            ),
          ]);
        }
      }

      // Add group selection buttons
      if (groups.length > 0) {
        buttons.push([Markup.button.callback('━━ Grupos ━━', 'share_post_groups_header')]);
        for (const group of groups) {
          buttons.push([
            Markup.button.callback(
              group.icon + ' ' + group.destination_name,
              'share_post_group_' + group.telegram_id
            ),
          ]);
        }
      }

      // Add action buttons
      buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all')]);
      buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection')]);
      buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
      buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

      await ctx.editMessageText(
        '📤 *Compartir Publicacion*\n\n'
        + '*Paso 1/6: Selecciona Destinos*\n\n'
        + 'Selecciona uno o mas canales/grupos:\n\n'
        + '━━━━━━━━━━━━━━━━━\n\n'
        + '📢 *Canales:* Para anuncios importantes\n'
        + '👥 *Grupos:* Para discusion comunitaria\n\n'
        + '💡 *Tip:* Puedes compartir en multiples destinos a la vez.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error in improved share post entry:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTINATION SELECTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Channel selection
  bot.action(/^share_post_channel_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const channelId = ctx.match[1];
      const channelIds = ctx.session.temp?.sharePostData?.channelIds || [];

      // Toggle channel selection
      const index = channelIds.indexOf(channelId);
      if (index > -1) {
        channelIds.splice(index, 1);
      } else {
        channelIds.push(channelId);
      }

      ctx.session.temp.sharePostData.channelIds = channelIds;
      await ctx.saveSession();

      await ctx.answerCbQuery(channelIds.includes(channelId) ? '✅ Canal anadido' : '⬜ Canal removido');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting channel:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Group selection
  bot.action(/^share_post_group_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const groupId = ctx.match[1];
      const groupIds = ctx.session.temp?.sharePostData?.groupIds || [];

      // Toggle group selection
      const index = groupIds.indexOf(groupId);
      if (index > -1) {
        groupIds.splice(index, 1);
      } else {
        groupIds.push(groupId);
      }

      ctx.session.temp.sharePostData.groupIds = groupIds;
      await ctx.saveSession();

      await ctx.answerCbQuery(groupIds.includes(groupId) ? '✅ Grupo anadido' : '⬜ Grupo removido');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting group:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Select all destinations
  bot.action('share_post_select_all', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const destinations = await communityPostService.getPostingDestinations();
      const channelIds = destinations.filter(d => d.destination_type === 'channel').map(d => d.telegram_id);
      const groupIds = destinations.filter(d => d.destination_type === 'group').map(d => d.telegram_id);

      ctx.session.temp.sharePostData.channelIds = channelIds;
      ctx.session.temp.sharePostData.groupIds = groupIds;
      await ctx.saveSession();

      await ctx.answerCbQuery('✅ Todos los ' + destinations.length + ' destinos seleccionados');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting all destinations:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Clear all destinations
  bot.action('share_post_clear_selection', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.sharePostData.channelIds = [];
      ctx.session.temp.sharePostData.groupIds = [];
      await ctx.saveSession();

      await ctx.answerCbQuery('⬜ Seleccion borrada');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error clearing destinations:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Helper function to show destination selection UI
  async function showDestinationSelection(ctx) {
    const destinations = await communityPostService.getPostingDestinations();
    const channelIds = ctx.session.temp?.sharePostData?.channelIds || [];
    const groupIds = ctx.session.temp?.sharePostData?.groupIds || [];
    const buttons = [];

    // Separate channels and groups
    const channels = destinations.filter(d => d.destination_type === 'channel');
    const groups = destinations.filter(d => d.destination_type === 'group');

    // Channel buttons
    if (channels.length > 0) {
      buttons.push([Markup.button.callback('━━ Canales ━━', 'share_post_channels_header')]);
      for (const channel of channels) {
        const isSelected = channelIds.includes(channel.telegram_id);
        const prefix = isSelected ? '✅' : '⬜';
        buttons.push([
          Markup.button.callback(
            prefix + ' ' + channel.icon + ' ' + channel.destination_name,
            'share_post_channel_' + channel.telegram_id
          ),
        ]);
      }
    }

    // Group buttons
    if (groups.length > 0) {
      buttons.push([Markup.button.callback('━━ Grupos ━━', 'share_post_groups_header')]);
      for (const group of groups) {
        const isSelected = groupIds.includes(group.telegram_id);
        const prefix = isSelected ? '✅' : '⬜';
        buttons.push([
          Markup.button.callback(
            prefix + ' ' + group.icon + ' ' + group.destination_name,
            'share_post_group_' + group.telegram_id
          ),
        ]);
      }
    }

    buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all')]);
    buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection')]);
    buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
    buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

    const selectedCount = channelIds.length + groupIds.length;
    const message = '📤 *Compartir Publicacion*\n\n'
      + '*Paso 1/6: Selecciona Destinos*\n\n'
      + 'Destinos seleccionados: *' + selectedCount + '*\n\n'
      + '━━━━━━━━━━━━━━━━━\n\n'
      + '📢 *Canales:* ' + channelIds.length + ' seleccionados\n'
      + '👥 *Grupos:* ' + groupIds.length + ' seleccionados\n\n'
      + '💡 *Tip:* Selecciona multiples destinos para mayor alcance.';

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Continue to media upload
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_continue_to_media', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const channelIds = ctx.session.temp?.sharePostData?.channelIds || [];
      const groupIds = ctx.session.temp?.sharePostData?.groupIds || [];
      
      if (channelIds.length === 0 && groupIds.length === 0) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino');
        return;
      }

      ctx.session.temp.sharePostStep = 'upload_media';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📤 *Compartir Publicacion*\n\n'
        + '*Paso 2/6: Subir Media (Opcional)*\n\n'
        + '📸 Puedes subir una foto o video para acompanar tu publicacion.\n\n'
        + '💡 *Opciones:*\n'
        + '• 📷 Envia una foto (JPEG, PNG)\n'
        + '• 🎥 Envia un video (MP4, MOV)\n'
        + '• ➡️ Click "Sin Media" para continuar sin imagen/video\n\n'
        + '✅ *Videos grandes:* Se publican usando Telegram (sin re-subir) para soportar archivos muy grandes.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬜ Sin Media', 'share_post_skip_media')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );

      // Wait for media upload via middleware
      ctx.session.temp.waitingForMedia = true;
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error continuing to media:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action('share_post_skip_media', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.sharePostStep = 'write_text';
      ctx.session.temp.waitingForMedia = false;
      await ctx.saveSession();

      await ctx.answerCbQuery('⬜ Media omitida');
      await showTextInputStep(ctx);
    } catch (error) {
      logger.error('Error skipping media:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Media upload middleware (handle photo/video from user)
  // ═══════════════════════════════════════════════════════════════════════════
  bot.on('photo', async (ctx, next) => {
    try {
      if (!ctx.session.temp?.waitingForMedia) return next();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return next();

      const photo = ctx.message.photo[ctx.message.photo.length - 1];

      // Use batch session updates for better performance
      await performanceUtils.batchSessionUpdates(ctx, [
        { key: 'sharePostData.sourceChatId', value: ctx.chat.id },
        { key: 'sharePostData.sourceMessageId', value: ctx.message.message_id },
        { key: 'sharePostData.mediaType', value: 'photo' },
        { key: 'sharePostData.mediaFileId', value: photo.file_id },
        { key: 'sharePostStep', value: 'write_text' },
        { key: 'waitingForMedia', value: false }
      ]);

      await ctx.reply('✅ Foto guardada');
      await showTextInputStep(ctx);
    } catch (error) {
      logger.error('Error handling photo upload:', error);
      await ctx.reply('❌ Error al cargar la foto');
    }
  });

  bot.on('video', async (ctx, next) => {
    try {
      if (!ctx.session.temp?.waitingForMedia) return next();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return next();

      const video = ctx.message.video;

      const fileSizeMB = video.file_size ? Math.round((video.file_size / (1024 * 1024)) * 10) / 10 : 0;
      // Use batch session updates for better performance
      await performanceUtils.batchSessionUpdates(ctx, [
        { key: 'sharePostData.sourceChatId', value: ctx.chat.id },
        { key: 'sharePostData.sourceMessageId', value: ctx.message.message_id },
        { key: 'sharePostData.mediaType', value: 'video' },
        { key: 'sharePostData.mediaFileId', value: video.file_id },
        { key: 'sharePostData.fileSizeMB', value: fileSizeMB },
        { key: 'sharePostStep', value: 'write_text' },
        { key: 'waitingForMedia', value: false }
      ]);

      await ctx.reply('✅ Video guardado' + (fileSizeMB ? ' (' + fileSizeMB + ' MB)' : ''));
      await showTextInputStep(ctx);
    } catch (error) {
      logger.error('Error handling video upload:', error);
      await ctx.reply('❌ Error al cargar el video');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Write post text
  // ═══════════════════════════════════════════════════════════════════════════
  async function showTextInputStep(ctx) {
    ctx.session.temp.sharePostStep = 'write_text';
    await ctx.saveSession();

    try {
      await ctx.editMessageText(
        '📤 *Compartir Publicacion*\n\n'
        + '*Paso 3/6: Escribir Texto*\n\n'
        + '✍️ Envia el texto de tu publicacion.\n\n'
        + '💡 *Tip:* Puedes usar *negrita* y _cursiva_.\n\n'
        + '📝 *Limites:* 1024 si hay media / 4096 si es solo texto',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🤖 AI Write (Grok)', 'share_post_ai_text')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (editError) {
      if (editError.response?.description?.includes("can't be edited")) {
        // Message can't be edited, send as new message instead
        await ctx.reply(
          '📤 *Compartir Publicacion*\n\n'
          + '*Paso 3/6: Escribir Texto*\n\n'
          + '✍️ Envia el texto de tu publicacion.\n\n'
          + '💡 *Tip:* Puedes usar *negrita* y _cursiva_.\n\n'
          + '📝 *Limites:* 1024 si hay media / 4096 si es solo texto',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🤖 AI Write (Grok)', 'share_post_ai_text')],
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          }
        );
      } else {
        throw editError; // Re-throw other errors
      }
    }

    ctx.session.temp.waitingForText = true;
    await ctx.saveSession();
  }

  // AI text generation
  bot.action('share_post_ai_text', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      ctx.session.temp.sharePostStep = 'ai_prompt';
      await ctx.saveSession();
      await ctx.reply(
        '🤖 *AI Write (Grok)*\n\nDescribe el post que quieres publicar.\nEjemplo:\n`Anuncia un evento hoy, tono sexy, incluye CTA a membership`',
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      logger.error('Error in share_post_ai_text:', error);
    }
  });

  // Text input handling
  bot.on('text', async (ctx, next) => {
    try {
      if (!ctx.session.temp?.sharePostStep) return next();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return next();

      const step = ctx.session.temp.sharePostStep;
      const text = ctx.message.text;

      // Check if this is a command (starts with /) - if so, pass to other handlers
      if (text && text.startsWith('/')) {
        return next();
      }

      if (step === 'ai_prompt') {
        const prompt = (text || '').trim();
        if (!prompt) return;
        try {
          const hasMedia = !!ctx.session.temp.sharePostData.mediaFileId;
          const maxTokens = hasMedia ? 260 : 380;
          const result = await GrokService.chat({
            mode: 'post',
            language: 'Spanish',
            prompt,
            maxTokens,
          });
          ctx.session.temp.sharePostData.text = result;
          ctx.session.temp.sharePostStep = 'select_buttons';
          await ctx.saveSession();
          await ctx.reply('✅ *AI draft saved*\n\n' + result, { parse_mode: 'Markdown' });
          await showButtonSelectionStep(ctx);
        } catch (e) {
          await ctx.reply('❌ AI error: ' + e.message);
        }
        return;
      }

      // Text input during write_text step
      if (step === 'write_text') {
        const hasMedia = !!ctx.session.temp.sharePostData.mediaFileId;
        const maxLen = hasMedia ? 1024 : 4096;
        if (text.length > maxLen) {
          await ctx.reply('❌ El texto es demasiado largo (maximo ' + maxLen + ' caracteres)');
          return;
        }

        ctx.session.temp.sharePostData.text = text;
        ctx.session.temp.sharePostStep = 'select_buttons';
        ctx.session.temp.waitingForText = false;
        await ctx.saveSession();

        await showButtonSelectionStep(ctx);
        return;
      }
      
      // If we get here and it's not a handled step, pass to other handlers
      return next();
    } catch (error) {
      logger.error('Error handling text input:', error);
      await ctx.reply('❌ Error al procesar el texto').catch(() => {});
      return next(); // Pass to other handlers even on error
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Select buttons
  // ═══════════════════════════════════════════════════════════════════════════
  async function showButtonSelectionStep(ctx) {
    try {
      const options = getSharePostButtonOptions();
      const selected = new Set((normalizeButtons(ctx.session.temp.sharePostData.buttons) || []).map((b) => (typeof b === 'string' ? JSON.parse(b).key : b.key)));

      const buttons = options.map((opt) => {
        const on = selected.has(opt.key);
        return [Markup.button.callback((on ? '✅' : '➕') + ' ' + opt.text, 'share_post_toggle_' + opt.key)];
      });

      buttons.push([Markup.button.callback('➕ Custom Link', 'share_post_add_custom_link')]);
      buttons.push([Markup.button.callback('👀 Preview', 'share_post_preview')]);
      buttons.push([Markup.button.callback('❌ Cancelar', 'admin_cancel')]);

      try {
        await ctx.editMessageText(
          '📤 *Compartir Publicacion*\n\n'
          + '*Paso 4/6: Seleccionar Botones*\n\n'
          + '🔗 Selecciona 1 o varios botones (o deja solo el default):',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
          }
        );
      } catch (editError) {
        if (editError.response?.description?.includes("can't be edited")) {
          // Message can't be edited, send as new message instead
          await ctx.reply(
            '📤 *Compartir Publicacion*\n\n'
            + '*Paso 4/6: Seleccionar Botones*\n\n'
            + '🔗 Selecciona 1 o varios botones (o deja solo el default):',
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard(buttons),
            }
          );
        } else {
          throw editError; // Re-throw other errors
        }
      }

      ctx.session.temp.sharePostStep = 'select_buttons';
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error showing button selection:', error);
      await ctx.reply('❌ Error al mostrar botones').catch(() => {});
    }
  }

  // Button toggle handlers
  bot.action(/^share_post_toggle_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      const key = ctx.match?.[1];
      if (!key) return;

      const options = getSharePostButtonOptions();
      const opt = options.find((o) => o.key === key);
      if (!opt) {
        await ctx.answerCbQuery('❌ Boton no encontrado');
        return;
      }

      const current = normalizeButtons(ctx.session.temp.sharePostData.buttons);
      const idx = current.findIndex((b) => (typeof b === 'string' ? JSON.parse(b).key : b.key) === key);
      if (idx >= 0) {
        current.splice(idx, 1);
        await ctx.answerCbQuery('Removed');
      } else {
        current.push(opt);
        await ctx.answerCbQuery('Added');
      }
      ctx.session.temp.sharePostData.buttons = current;
      await ctx.saveSession();
      await showButtonSelectionStep(ctx);
    } catch (error) {
      logger.error('Error toggling share post button:', error);
    }
  });

  // Custom link handling
  bot.action('share_post_add_custom_link', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      ctx.session.temp.sharePostStep = 'custom_link';
      await ctx.saveSession();
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '🔗 *Custom Link*\n\nEnvia: `Texto|https://link.com`',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back', 'share_post_back_to_buttons')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting custom link for share post:', error);
    }
  });

  bot.action('share_post_back_to_buttons', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      ctx.session.temp.sharePostStep = 'select_buttons';
      await ctx.saveSession();
      await showButtonSelectionStep(ctx);
    } catch (error) {
      logger.error('Error in share_post_back_to_buttons:', error);
    }
  });

  // Custom link text handling
  bot.on('text', async (ctx, next) => {
    try {
      if (!ctx.session.temp?.sharePostStep) return next();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return next();

      const step = ctx.session.temp.sharePostStep;
      const text = ctx.message.text;

      // Check if this is a command (starts with /) - if so, pass to other handlers
      if (text && text.startsWith('/')) {
        return next();
      }

      if (step === 'custom_link') {
        const parts = (text || '').split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length !== 2) {
          await ctx.reply('❌ Formato invalido. Usa: `Texto|https://link.com`', { parse_mode: 'Markdown' });
          return;
        }
        const [label, url] = parts;
        if (!/^https?:\/\//i.test(url)) {
          await ctx.reply('❌ El link debe comenzar con http:// o https://', { parse_mode: 'Markdown' });
          return;
        }
        const buttons = normalizeButtons(ctx.session.temp.sharePostData.buttons);
        buttons.push({ key: 'custom', text: label, type: 'url', target: url });
        ctx.session.temp.sharePostData.buttons = buttons;
        ctx.session.temp.sharePostStep = 'select_buttons';
        await ctx.saveSession();
        await ctx.reply('✅ Custom link agregado');
        await showButtonSelectionStep(ctx);
        return;
      }
      
      // If we get here and it's not a handled step, pass to other handlers
      return next();
    } catch (error) {
      logger.error('Error handling custom link input:', error);
      return next();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Preview
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_preview', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      await ctx.answerCbQuery();

      const postData = ctx.session.temp.sharePostData;
      const caption = buildPostCaption(postData);
      const kb = buildInlineKeyboard(postData.buttons);

      // Render a preview message (copy media to admin chat if present to support very large videos)
      if (postData.sourceChatId && postData.sourceMessageId) {
        try {
          await ctx.telegram.copyMessage(ctx.chat.id, postData.sourceChatId, postData.sourceMessageId, {
            caption,
            parse_mode: 'Markdown',
            ...(kb ? { reply_markup: kb.reply_markup } : {}),
          });
        } catch (e) {
          logger.warn('Preview copyMessage failed (continuing):', e.message);
        }
      } else if (caption) {
        await ctx.reply(caption, { parse_mode: 'Markdown', ...(kb ? { reply_markup: kb.reply_markup } : {}) });
      }

      await ctx.reply(
        '👀 *Preview*\n\n¿Enviar ahora o programar para mas tarde?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Send Now', 'share_post_send_now')],
            [Markup.button.callback('📅 Schedule', 'share_post_schedule')],
            [Markup.button.callback('🔘 Edit Buttons', 'share_post_back_to_buttons')],
            [Markup.button.callback('❌ Cancel', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error in share_post_preview:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Send/Schedule options
  // ═══════════════════════════════════════════════════════════════════════════

  // Send now
  bot.action('share_post_send_now', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      await sendPostNow(ctx);
    } catch (error) {
      logger.error('Error sending post now:', error);
      await ctx.reply('❌ Error al enviar publicacion').catch(() => {});
    }
  });

  // Schedule for later
  bot.action('share_post_schedule', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.sharePostStep = 'schedule_datetime';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📅 *Programar Publicacion*\n\n'
        + 'Por favor envia la fecha y hora en el siguiente formato:\n\n'
        + '`YYYY-MM-DD HH:MM`\n\n'
        + '*Ejemplos:*\n'
        + '• `2025-12-15 14:30` (15 dic 2025, 2:30 PM)\n'
        + '• `2025-12-25 09:00` (25 dic 2025, 9:00 AM)\n\n'
        + '⏰ *Zona horaria:* UTC\n\n'
        + '💡 Tip: Asegurate de que la fecha sea en el futuro',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );

      ctx.session.temp.waitingForDateTime = true;
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error scheduling post:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Handle datetime input for scheduling
  bot.on('text', async (ctx, next) => {
    try {
      if (!ctx.session.temp?.waitingForDateTime) return next();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return next();

      const dateTimeStr = ctx.message.text.trim();
      
      // Check if this is a command (starts with /) - if so, pass to other handlers
      if (dateTimeStr && dateTimeStr.startsWith('/')) {
        return next();
      }

      const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})$/;

      if (!dateTimeRegex.test(dateTimeStr)) {
        await ctx.reply('❌ Formato invalido. Usa: YYYY-MM-DD HH:MM');
        return;
      }

      const dateTime = new Date(dateTimeStr + ' UTC');
      if (isNaN(dateTime.getTime())) {
        await ctx.reply('❌ Fecha/hora invalida');
        return;
      }

      if (dateTime <= new Date()) {
        await ctx.reply('❌ La fecha debe estar en el futuro');
        return;
      }

      ctx.session.temp.sharePostData.scheduledAt = dateTime;
      ctx.session.temp.sharePostData.isScheduled = true;
      ctx.session.temp.waitingForDateTime = false;
      await ctx.saveSession();

      await ctx.reply('✅ Fecha programada');
      await confirmScheduledPost(ctx);
      return;
    } catch (error) {
      logger.error('Error handling datetime input:', error);
      await ctx.reply('❌ Error al procesar la fecha').catch(() => {});
      return next(); // Pass to other handlers even on error
    }
  });

  // Confirm scheduled post
  async function confirmScheduledPost(ctx) {
    try {
      const postData = ctx.session.temp.sharePostData;
      const scheduledAt = postData.scheduledAt;

      await ctx.reply(
        '📅 *Publicacion Programada*\n\n'
        + '🗓️ Fecha: ' + scheduledAt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC\n'
        + '📢 Destinos: ' + (postData.channelIds.length + postData.groupIds.length) + '\n\n'
        + '✅ ¿Confirmar programacion?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirmar', 'share_post_confirm_schedule')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error confirming scheduled post:', error);
      await ctx.reply('❌ Error al confirmar programacion').catch(() => {});
    }
  }

  // Confirm and schedule post
  bot.action('share_post_confirm_schedule', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery('⏳ Programando...');
      await schedulePost(ctx);
    } catch (error) {
      logger.error('Error confirming scheduled post:', error);
      await ctx.answerCbQuery('❌ Error al programar').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL: Send post now
  // ═══════════════════════════════════════════════════════════════════════════
  async function sendPostNow(ctx) {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const postData = ctx.session.temp.sharePostData;

      // Validate all required fields
      if ((postData.channelIds.length === 0 && postData.groupIds.length === 0)) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino');
        return;
      }

      if (!postData.text) {
        await ctx.answerCbQuery('❌ Debes escribir el texto');
        return;
      }

      await ctx.answerCbQuery('⏳ Enviando...');

      const caption = buildPostCaption(postData);
      const kb = buildInlineKeyboard(postData.buttons);

      let sent = 0;
      let failed = 0;

      // Send to groups using the service method
      if (postData.groupIds.length > 0) {
        const groups = await communityPostService.getCommunityGroups();
        const targetGroups = groups.filter((g) => postData.groupIds.includes(g.telegram_group_id));
        
        if (targetGroups.length > 0) {
          const groupResults = await communityPostService.sendPostToGroups(
            {
              post_id: 'immediate-' + Date.now(),
              formatted_template_type: 'standard',
              media_type: postData.mediaType,
              telegram_file_id: postData.mediaFileId,
              message_en: postData.text,
              message_es: postData.text,
              title: postData.text.substring(0, 100),
            },
            targetGroups,
            ctx.telegram
          );
          sent += groupResults.successful;
          failed += groupResults.failed;
        }
      }

      // Send to channels using the service method
      if (postData.channelIds.length > 0) {
        const channelResults = await communityPostService.sendPostToChannels(
          {
            post_id: 'immediate-' + Date.now(),
            formatted_template_type: 'standard',
            media_type: postData.mediaType,
            telegram_file_id: postData.mediaFileId,
            message_en: postData.text,
            message_es: postData.text,
            title: postData.text.substring(0, 100),
          },
          postData.channelIds,
          ctx.telegram
        );
        sent += channelResults.successful;
        failed += channelResults.failed;
      }

      // Clear session
      ctx.session.temp = {};
      await ctx.saveSession();

      const message = '✅ *Publicacion Enviada*\n\n'
        + '📊 Destinos: ' + (postData.channelIds.length + postData.groupIds.length) + '\n'
        + '✓ Enviados: ' + sent + '\n'
        + '✗ Fallidos: ' + failed;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📤 Nueva Publicacion', 'admin_improved_share_post')],
          [Markup.button.callback('⬅️ Panel Admin', 'admin_dashboard')],
        ]),
      });

      logger.info('Shared post sent now', {
        adminId: ctx.from.id,
        destinations: postData.channelIds.length + postData.groupIds.length,
        sent,
        failed,
      });
    } catch (error) {
      logger.error('Error sending post now:', error);
      await ctx.answerCbQuery('❌ Error al enviar publicacion').catch(() => {});
      await ctx.reply('❌ Error: ' + error.message).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Schedule post for later
  // ═══════════════════════════════════════════════════════════════════════════
  async function schedulePost(ctx) {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const postData = ctx.session.temp.sharePostData;

      // Validate all required fields
      if ((postData.channelIds.length === 0 && postData.groupIds.length === 0)) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino');
        return;
      }

      if (!postData.text) {
        await ctx.answerCbQuery('❌ Debes escribir el texto');
        return;
      }

      if (!postData.scheduledAt) {
        await ctx.answerCbQuery('❌ Debes seleccionar una fecha');
        return;
      }

      await ctx.answerCbQuery('⏳ Programando...');

      // Create the post in database for scheduling
      const postId = await communityPostService.createCommunityPost({
        adminId: ctx.from.id,
        adminUsername: ctx.from.username || 'unknown',
        title: postData.text.substring(0, 100),
        messageEn: postData.text,
        messageEs: postData.text, // For now, same for both languages
        mediaType: postData.mediaType,
        mediaUrl: postData.mediaFileId,
        telegramFileId: postData.mediaFileId,
        targetGroupIds: postData.groupIds,
        targetChannelIds: postData.channelIds,
        targetAllGroups: false,
        postToPrimeChannel: false,
        templateType: 'standard',
        buttonLayout: 'single_row',
        scheduledAt: postData.scheduledAt,
        timezone: 'UTC',
        isRecurring: false,
        status: 'scheduled',
      });

      // Clear session
      ctx.session.temp = {};
      await ctx.saveSession();

      const message = '✅ *Publicacion Programada*\n\n'
        + '🗓️ Fecha: ' + postData.scheduledAt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC\n'
        + '📢 Destinos: ' + (postData.channelIds.length + postData.groupIds.length) + '\n'
        + '📝 ID: ' + postId;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📤 Nueva Publicacion', 'admin_improved_share_post')],
          [Markup.button.callback('⬅️ Panel Admin', 'admin_dashboard')],
        ]),
      });

      logger.info('Shared post scheduled', {
        adminId: ctx.from.id,
        postId,
        scheduledAt: postData.scheduledAt,
        destinations: postData.channelIds.length + postData.groupIds.length,
      });
    } catch (error) {
      logger.error('Error scheduling post:', error);
      await ctx.answerCbQuery('❌ Error al programar publicacion').catch(() => {});
      await ctx.reply('❌ Error: ' + error.message).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cancel action
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('admin_cancel', async (ctx) => {
    try {
      ctx.session.temp = {};
      await ctx.saveSession();

      await ctx.answerCbQuery('❌ Cancelado');
      await ctx.editMessageText(
        '❌ Publicacion cancelada',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Nueva Publicacion', 'admin_improved_share_post')],
            [Markup.button.callback('⬅️ Panel Admin', 'admin_dashboard')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error cancelling:', error);
    }
  });
};

module.exports = registerImprovedSharePostHandlers;