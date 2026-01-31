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
const XPostService = require('../../services/xPostService');
const XOAuthService = require('../../services/xOAuthService');

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
        destinations: [], // Array of {chatId, threadId, name}
        mediaType: null,
        mediaFileId: null,
        fileSizeMB: 0,
        text: '',
        buttons: [getSharePostButtonOptions()[0]], // default: home button only
        scheduledAt: null,
        isScheduled: false,
        postToX: false,
        xAccountId: null,
        xAccountHandle: null,
        xAccountDisplayName: null
      };
      await ctx.saveSession();

      await ctx.answerCbQuery();

      // Hardcoded destinations - Prime Channel and Community Group topics
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error in improved share post entry:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTINATION CONFIGURATION - From environment variables
  // ═══════════════════════════════════════════════════════════════════════════

  // Parse topic IDs from env (handles both numeric and URL format like t.me/c/xxx/2)
  const parseTopicId = (value) => {
    if (!value) return null;
    const str = String(value);
    // If it's already numeric, parse directly
    if (/^\d+$/.test(str)) {
      return parseInt(str);
    }
    // Otherwise extract from URL format
    const parsed = parseInt(str.replace(/.*\//, ''));
    return isNaN(parsed) ? null : parsed;
  };

  // Available destinations - dynamically configured from env
  // NOTE: General topic (thread 1) doesn't work for this forum - removed
  const SHARE_DESTINATIONS = [
    { id: 'prime', chatId: process.env.PRIME_CHANNEL_ID, threadId: null, name: '💎 Prime Channel', type: 'channel' },
    { id: 'news', chatId: process.env.GROUP_ID, threadId: 5525, name: '📰 PNP Latino News', type: 'topic' },
    { id: 'walloffame', chatId: process.env.GROUP_ID, threadId: parseTopicId(process.env.WALL_OF_FAME_TOPIC_ID), name: '🏆 Wall Of Fame', type: 'topic' },
  ].filter(d => d && d.chatId);

  // Log destinations at startup for debugging
  logger.info('Share post destinations configured:', SHARE_DESTINATIONS.map(d => ({
    id: d.id,
    chatId: d.chatId,
    threadId: d.threadId,
    name: d.name
  })));

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTINATION SELECTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Toggle destination selection
  bot.action(/^share_post_dest_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const destId = ctx.match[1];
      const destinations = ctx.session.temp?.sharePostData?.destinations || [];

      // Toggle destination selection
      const index = destinations.findIndex(d => d.id === destId);
      if (index > -1) {
        destinations.splice(index, 1);
      } else {
        const dest = SHARE_DESTINATIONS.find(d => d.id === destId);
        if (dest) {
          destinations.push({ ...dest });
        }
      }

      ctx.session.temp.sharePostData.destinations = destinations;
      await ctx.saveSession();

      const isSelected = destinations.some(d => d.id === destId);
      await ctx.answerCbQuery(isSelected ? '✅ Agregado' : '⬜ Removido');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting destination:', error);
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

      ctx.session.temp.sharePostData.destinations = SHARE_DESTINATIONS.map(d => ({ ...d }));
      await ctx.saveSession();

      await ctx.answerCbQuery('✅ Todos seleccionados');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting all destinations:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // X (Twitter) ACCOUNT SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  async function showXAccountSelection(ctx) {
    try {
      const accounts = await XPostService.listActiveAccounts();
      const currentAccountId = ctx.session.temp?.sharePostData?.xAccountId;

      const buttons = accounts.map((account) => {
        const selected = currentAccountId === account.account_id;
        const label = `${selected ? '✅' : '⬜'} @${account.handle}`;
        return [Markup.button.callback(label, `share_post_x_account_${account.account_id}`)];
      });

      buttons.push([Markup.button.callback('➕ Conectar cuenta X', 'share_post_x_connect')]);
      buttons.push([Markup.button.callback('🚫 No publicar en X', 'share_post_x_disable')]);
      buttons.push([Markup.button.callback('⬅️ Volver', 'share_post_preview')]);

      if (!accounts.length) {
        await ctx.reply(
          '🐦 *Publicar en X*\n\n'
          + 'No hay cuentas activas configuradas.\n\n'
          + 'Puedes conectar una nueva cuenta ahora mismo.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
          }
        );
        return;
      }

      await ctx.reply(
        '🐦 *Publicar en X*\n\nSelecciona la cuenta desde la cual se publicará:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error showing X account selection:', error);
      await ctx.reply('❌ Error al cargar cuentas de X').catch(() => {});
    }
  }

  bot.action('share_post_configure_x', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      await showXAccountSelection(ctx);
    } catch (error) {
      logger.error('Error configuring X account:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action('share_post_x_connect', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const authUrl = await XOAuthService.createAuthUrl({
        adminId: ctx.from.id,
        adminUsername: ctx.from.username || null,
      });

      await ctx.answerCbQuery();
      await ctx.reply(
        '🔗 *Conectar cuenta de X*\n\n'
        + '1) Abre este enlace.\n'
        + '2) Autoriza la cuenta.\n'
        + '3) Regresa al bot y selecciona la cuenta.\n\n'
        + authUrl,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error starting X OAuth flow:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
      await ctx.reply('❌ No se pudo iniciar la conexion con X').catch(() => {});
    }
  });

  bot.action(/^share_post_x_account_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const accountId = ctx.match[1];
      const accounts = await XPostService.listActiveAccounts();
      const selected = accounts.find((account) => account.account_id === accountId);

      if (!selected) {
        await ctx.answerCbQuery('❌ Cuenta no válida');
        return;
      }

      ctx.session.temp.sharePostData.postToX = true;
      ctx.session.temp.sharePostData.xAccountId = selected.account_id;
      ctx.session.temp.sharePostData.xAccountHandle = selected.handle;
      ctx.session.temp.sharePostData.xAccountDisplayName = selected.display_name;
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Usando @${selected.handle}`);
      await showXAccountSelection(ctx);
    } catch (error) {
      logger.error('Error selecting X account:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action('share_post_x_disable', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.sharePostData.postToX = false;
      ctx.session.temp.sharePostData.xAccountId = null;
      ctx.session.temp.sharePostData.xAccountHandle = null;
      ctx.session.temp.sharePostData.xAccountDisplayName = null;
      await ctx.saveSession();

      await ctx.answerCbQuery('🚫 X desactivado');
      await showXAccountSelection(ctx);
    } catch (error) {
      logger.error('Error disabling X posting:', error);
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

      ctx.session.temp.sharePostData.destinations = [];
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
    const selectedDestinations = ctx.session.temp?.sharePostData?.destinations || [];
    const buttons = [];

    // Prime Channel section
    buttons.push([Markup.button.callback('━━ Canal ━━', 'share_post_header_channel')]);
    const primeChannel = SHARE_DESTINATIONS.find(d => d.id === 'prime');
    const isPrimeSelected = selectedDestinations.some(d => d.id === 'prime');
    buttons.push([
      Markup.button.callback(
        (isPrimeSelected ? '✅ ' : '⬜ ') + primeChannel.name,
        'share_post_dest_prime'
      ),
    ]);

    // Community Group Topics section
    buttons.push([Markup.button.callback('━━ Comunidad (Topics) ━━', 'share_post_header_topics')]);
    const topicDestinations = SHARE_DESTINATIONS.filter(d => d.type === 'topic');
    for (const dest of topicDestinations) {
      const isSelected = selectedDestinations.some(d => d.id === dest.id);
      buttons.push([
        Markup.button.callback(
          (isSelected ? '✅ ' : '⬜ ') + dest.name,
          'share_post_dest_' + dest.id
        ),
      ]);
    }

    // Action buttons
    buttons.push([Markup.button.callback('✅ Seleccionar Todo', 'share_post_select_all')]);
    buttons.push([Markup.button.callback('⬜ Limpiar', 'share_post_clear_selection')]);
    buttons.push([Markup.button.callback('➡️ Continuar', 'share_post_continue_to_media')]);
    buttons.push([Markup.button.callback('❌ Cancelar', 'share_post_cancel')]);

    const selectedCount = selectedDestinations.length;
    const message = '📤 *Compartir Publicación*\n\n'
      + '*Paso 1/6: Selecciona Destinos*\n\n'
      + 'Destinos seleccionados: *' + selectedCount + '*\n\n'
      + '━━━━━━━━━━━━━━━━━\n\n'
      + '💎 *Prime Channel:* Canal principal\n'
      + '👥 *Comunidad:* Grupo con topics\n\n'
      + '💡 Selecciona donde quieres publicar.';

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

      const destinations = ctx.session.temp?.sharePostData?.destinations || [];

      if (destinations.length === 0 && !postData.postToX) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino o habilitar X');
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
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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
        { key: 'temp.sharePostData.sourceChatId', value: ctx.chat.id },
        { key: 'temp.sharePostData.sourceMessageId', value: ctx.message.message_id },
        { key: 'temp.sharePostData.mediaType', value: 'photo' },
        { key: 'temp.sharePostData.mediaFileId', value: photo.file_id },
        { key: 'temp.sharePostStep', value: 'write_text' },
        { key: 'temp.waitingForMedia', value: false }
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
        { key: 'temp.sharePostData.sourceChatId', value: ctx.chat.id },
        { key: 'temp.sharePostData.sourceMessageId', value: ctx.message.message_id },
        { key: 'temp.sharePostData.mediaType', value: 'video' },
        { key: 'temp.sharePostData.mediaFileId', value: video.file_id },
        { key: 'temp.sharePostData.fileSizeMB', value: fileSizeMB },
        { key: 'temp.sharePostStep', value: 'write_text' },
        { key: 'temp.waitingForMedia', value: false }
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
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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
              [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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

  // Use AI-generated text as-is
  bot.action('share_post_use_ai', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const aiDraft = ctx.session.temp?.aiDraft;
      if (!aiDraft) {
        await ctx.answerCbQuery('❌ No hay texto AI guardado');
        return;
      }

      ctx.session.temp.sharePostData.text = aiDraft;
      ctx.session.temp.sharePostStep = 'select_buttons';
      ctx.session.temp.aiDraft = null;
      await ctx.saveSession();

      await ctx.answerCbQuery('✅ Texto guardado');
      await showButtonSelectionStep(ctx);
    } catch (error) {
      logger.error('Error in share_post_use_ai:', error);
      try { await ctx.answerCbQuery('❌ Error'); } catch (e) { /* ignore */ }
    }
  });

  // Edit AI-generated text manually
  bot.action('share_post_edit_ai', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.sharePostStep = 'edit_ai_share';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      const aiDraft = ctx.session.temp?.aiDraft || '';
      const hasMedia = !!ctx.session.temp.sharePostData?.mediaFileId;
      const maxLen = hasMedia ? 1024 : 4096;

      // Send without parse_mode to avoid conflicts with AI-generated text
      await ctx.reply(
        '✏️ Editar Texto\n\n' +
        'Texto actual generado por AI:\n\n' +
        '---\n' + aiDraft + '\n---\n\n' +
        '📝 Envia tu versión editada del texto.\n' +
        '(Máximo ' + maxLen + ' caracteres)',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Volver', 'share_post_back_to_review')],
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error in share_post_edit_ai:', error);
      try { await ctx.answerCbQuery('❌ Error'); } catch (e) { /* ignore */ }
    }
  });

  // Back to AI review from edit mode
  bot.action('share_post_back_to_review', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const aiDraft = ctx.session.temp?.aiDraft;
      if (!aiDraft) {
        // No draft, go back to text input
        ctx.session.temp.sharePostStep = 'write_text';
        await ctx.saveSession();
        await ctx.answerCbQuery();
        await showTextInputStep(ctx);
        return;
      }

      ctx.session.temp.sharePostStep = 'review_ai_share';
      await ctx.saveSession();

      await ctx.answerCbQuery();
      // No parse_mode to avoid conflicts with AI-generated text
      await ctx.editMessageText(
        '🤖 AI Draft (Bilingual):\n\n' + aiDraft + '\n\n' +
        'Puedes usar este texto o editarlo manualmente.',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Usar texto', 'share_post_use_ai')],
            [Markup.button.callback('✏️ Editar manualmente', 'share_post_edit_ai')],
            [Markup.button.callback('🔄 Regenerar', 'share_post_ai_text')],
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error in share_post_back_to_review:', error);
      try { await ctx.answerCbQuery('❌ Error'); } catch (e) { /* ignore */ }
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

          await ctx.reply('⏳ Generando texto con AI...');

          // Use optimized parallel bilingual generation
          const result = await GrokService.generateSharePost({
            prompt,
            hasMedia,
          });

          // Store AI draft temporarily for review/edit
          ctx.session.temp.aiDraft = result.combined;
          ctx.session.temp.sharePostStep = 'review_ai_share';
          await ctx.saveSession();

          // Show preview with edit options (no parse_mode to avoid conflicts with AI-generated text)
          await ctx.reply(
            '🤖 AI Draft (Bilingual):\n\n' + result.combined + '\n\n' +
            'Puedes usar este texto o editarlo manualmente.',
            {
              ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Usar texto', 'share_post_use_ai')],
                [Markup.button.callback('✏️ Editar manualmente', 'share_post_edit_ai')],
                [Markup.button.callback('🔄 Regenerar', 'share_post_ai_text')],
                [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
              ]),
            },
          );
        } catch (e) {
          logger.error('AI generation error:', e);
          await ctx.reply('❌ AI error: ' + e.message);
        }
        return;
      }

      // Handle manual text edit for AI-generated content
      if (step === 'edit_ai_share') {
        const hasMedia = !!ctx.session.temp.sharePostData.mediaFileId;
        const maxLen = hasMedia ? 1024 : 4096;
        if (text.length > maxLen) {
          await ctx.reply('❌ El texto es demasiado largo (maximo ' + maxLen + ' caracteres)');
          return;
        }

        ctx.session.temp.sharePostData.text = text;
        ctx.session.temp.sharePostStep = 'select_buttons';
        ctx.session.temp.aiDraft = null;
        await ctx.saveSession();

        await ctx.reply('✅ Texto guardado');
        await showButtonSelectionStep(ctx);
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
      buttons.push([Markup.button.callback('❌ Cancelar', 'share_post_cancel')]);

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
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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
      const text = postData.text || '';
      const hasMedia = !!(postData.mediaFileId || postData.sourceMessageId);
      const maxLen = hasMedia ? 1024 : 4096;
      const kb = buildInlineKeyboard(postData.buttons);

      // Check caption length
      let lengthWarning = '';
      let xWarning = '';
      if (text.length > maxLen) {
        lengthWarning = `\n\n⚠️ ADVERTENCIA: El texto tiene ${text.length} caracteres (máximo ${maxLen} para ${hasMedia ? 'posts con media' : 'posts sin media'}). Será truncado al enviar.`;
      }

      const xStatus = postData.postToX
        ? `🐦 X: @${postData.xAccountHandle || 'cuenta seleccionada'}`
        : '🐦 X: No se publicará';

      if (postData.postToX) {
        const { truncated } = XPostService.normalizeXText(text);
        if (truncated) {
          xWarning = '\n\n⚠️ ADVERTENCIA: El texto supera 280 caracteres para X y será truncado.';
        }
      }

      // Show text preview (truncated if too long)
      const previewText = text.length > 500 ? text.substring(0, 500) + '...\n\n[Texto truncado para preview]' : text;

      // Try to show media preview if available
      if (postData.sourceChatId && postData.sourceMessageId) {
        try {
          // Use shorter caption for preview to avoid errors
          const shortCaption = text.length > 800 ? text.substring(0, 800) + '...' : text;
          await ctx.telegram.copyMessage(ctx.chat.id, postData.sourceChatId, postData.sourceMessageId, {
            caption: shortCaption,
            ...(kb ? { reply_markup: kb.reply_markup } : {}),
          });
        } catch (e) {
          logger.warn('Preview copyMessage failed:', e.message);
          // Fallback: just show text
          await ctx.reply('📷 [Media adjunta]\n\n' + previewText, {
            ...(kb ? { reply_markup: kb.reply_markup } : {}),
          });
        }
      } else if (text) {
        await ctx.reply(previewText, { ...(kb ? { reply_markup: kb.reply_markup } : {}) });
      }

      await ctx.reply(
        '👀 Preview\n\n' + xStatus + lengthWarning + xWarning + '\n\n¿Enviar ahora o programar para mas tarde?',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Send Now', 'share_post_send_now')],
            [Markup.button.callback('📅 Schedule', 'share_post_schedule')],
            [Markup.button.callback('✏️ Edit Text', 'share_post_edit_text')],
            [Markup.button.callback('🔘 Edit Buttons', 'share_post_back_to_buttons')],
            [Markup.button.callback('🐦 Configurar X', 'share_post_configure_x')],
            [Markup.button.callback('❌ Cancel', 'share_post_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error in share_post_preview:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Edit text from preview
  bot.action('share_post_edit_text', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;
      await ctx.answerCbQuery();
      ctx.session.temp.sharePostStep = 'write_text';
      await ctx.saveSession();
      await showTextInputStep(ctx);
    } catch (error) {
      logger.error('Error in share_post_edit_text:', error);
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
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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
      const destinations = postData.destinations || [];

      await ctx.reply(
        '📅 *Publicación Programada*\n\n'
        + '🗓️ Fecha: ' + scheduledAt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC\n'
        + '📢 Destinos: ' + destinations.length + '\n\n'
        + '✅ ¿Confirmar programación?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirmar', 'share_post_confirm_schedule')],
            [Markup.button.callback('❌ Cancelar', 'share_post_cancel')],
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
      const destinations = postData.destinations || [];

      // Validate all required fields
      if (destinations.length === 0 && !postData.postToX) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino o habilitar X');
        return;
      }

      if (!postData.text) {
        await ctx.answerCbQuery('❌ Debes escribir el texto');
        return;
      }

      await ctx.answerCbQuery('⏳ Enviando...');

      const kb = buildInlineKeyboard(postData.buttons);

      let sent = 0;
      let failed = 0;
      let xResult = null;

      // Send to each destination directly
      for (const dest of destinations) {
        try {
          // No parse_mode to avoid Markdown conflicts with AI-generated text
          const options = {
            reply_markup: kb.reply_markup,
          };

          // Add thread_id for topics
          if (dest.threadId) {
            options.message_thread_id = dest.threadId;
          }

          if (postData.mediaType === 'photo' && postData.mediaFileId) {
            await ctx.telegram.sendPhoto(dest.chatId, postData.mediaFileId, {
              caption: postData.text,
              ...options,
            });
          } else if (postData.mediaType === 'video' && postData.mediaFileId) {
            await ctx.telegram.sendVideo(dest.chatId, postData.mediaFileId, {
              caption: postData.text,
              ...options,
            });
          } else {
            await ctx.telegram.sendMessage(dest.chatId, postData.text, options);
          }

          sent++;
          logger.info(`Post sent to ${dest.name}`, { chatId: dest.chatId, threadId: dest.threadId });
        } catch (sendError) {
          failed++;
          const errMsg = sendError.response?.description || sendError.message || 'Unknown error';
          logger.error(`Failed to send to ${dest.name}`, {
            chatId: dest.chatId,
            threadId: dest.threadId,
            error: errMsg
          });
        }
      }

      if (postData.postToX && postData.xAccountId) {
        try {
          xResult = await XPostService.sendPostNow({
            accountId: postData.xAccountId,
            adminId: ctx.from.id,
            adminUsername: ctx.from.username || 'unknown',
            text: postData.text,
          });
        } catch (xError) {
          xResult = { error: xError.message || 'Error desconocido' };
        }
      }

      // Clear session
      ctx.session.temp = {};
      await ctx.saveSession();

      const xSummary = postData.postToX
        ? `\n🐦 X: ${xResult?.response?.data?.id ? 'Publicado' : 'Error'}`
        : '';

      const message = '✅ *Publicación Enviada*\n\n'
        + '📊 Destinos: ' + destinations.length + '\n'
        + '✓ Enviados: ' + sent + '\n'
        + '✗ Fallidos: ' + failed
        + xSummary;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📤 Nueva Publicación', 'admin_improved_share_post')],
          [Markup.button.callback('⬅️ Panel Admin', 'admin_home')],
        ]),
      });

      logger.info('Shared post sent now', {
        adminId: ctx.from.id,
        destinations: destinations.length,
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
      const destinations = postData.destinations || [];

      // Validate all required fields
      if (destinations.length === 0 && !postData.postToX) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un destino o habilitar X');
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

      // Extract channel and group IDs for compatibility with database
      const channelDests = destinations.filter(d => d.type === 'channel');
      const topicDests = destinations.filter(d => d.type === 'topic');

      // Create the post in database for scheduling
      const postId = await communityPostService.createCommunityPost({
        adminId: ctx.from.id,
        adminUsername: ctx.from.username || 'unknown',
        title: postData.text.substring(0, 100),
        messageEn: postData.text,
        messageEs: postData.text,
        mediaType: postData.mediaType,
        mediaUrl: postData.mediaFileId,
        telegramFileId: postData.mediaFileId,
        targetGroupIds: topicDests.map(d => d.chatId),
        targetChannelIds: channelDests.map(d => d.chatId),
        targetTopics: topicDests.map(d => ({ chatId: d.chatId, threadId: d.threadId, name: d.name })),
        targetAllGroups: false,
        postToPrimeChannel: channelDests.length > 0,
        templateType: 'standard',
        buttonLayout: 'single_row',
        scheduledAt: postData.scheduledAt,
        timezone: 'UTC',
        isRecurring: false,
        status: 'scheduled',
      });

      let xPostId = null;
      if (postData.postToX && postData.xAccountId) {
        const normalized = XPostService.normalizeXText(postData.text);
        xPostId = await XPostService.createPostJob({
          accountId: postData.xAccountId,
          adminId: ctx.from.id,
          adminUsername: ctx.from.username || 'unknown',
          text: normalized.text,
          scheduledAt: postData.scheduledAt,
          status: 'scheduled',
        });
      }

      // Clear session
      ctx.session.temp = {};
      await ctx.saveSession();

      const xInfo = postData.postToX
        ? `\n🐦 X: ${xPostId ? 'Programado' : 'Error'}`
        : '';

      const message = '✅ *Publicación Programada*\n\n'
        + '🗓️ Fecha: ' + postData.scheduledAt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC\n'
        + '📢 Destinos: ' + destinations.length + '\n'
        + '📝 ID: ' + postId
        + xInfo;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📤 Nueva Publicación', 'admin_improved_share_post')],
          [Markup.button.callback('⬅️ Panel Admin', 'admin_home')],
        ]),
      });

      logger.info('Shared post scheduled', {
        adminId: ctx.from.id,
        postId,
        scheduledAt: postData.scheduledAt,
        destinations: destinations.length,
      });
    } catch (error) {
      logger.error('Error scheduling post:', error);
      await ctx.answerCbQuery('❌ Error al programar publicacion').catch(() => {});
      await ctx.reply('❌ Error: ' + error.message).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cancel action for share post
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_cancel', async (ctx) => {
    try {
      ctx.session.temp = {};
      await ctx.saveSession();

      await ctx.answerCbQuery('❌ Cancelado');
      await ctx.editMessageText(
        '❌ Publicacion cancelada',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Nueva Publicacion', 'admin_improved_share_post')],
            [Markup.button.callback('⬅️ Panel Admin', 'admin_home')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error cancelling:', error);
    }
  });
};

module.exports = registerImprovedSharePostHandlers;
