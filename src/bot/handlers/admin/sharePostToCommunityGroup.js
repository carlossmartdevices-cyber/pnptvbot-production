/**
 * Share Post to Community Group Handler
 * Multi-step wizard for creating and scheduling community posts with media, text, and buttons
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const communityPostService = require('../../services/communityPostService');
const PermissionService = require('../../services/permissionService');
const s3Service = require('../../../utils/s3Service');
const { getLanguage } = require('../../utils/helpers');

/**
 * Register community post handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerCommunityPostHandlers = (bot) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Main entry point - Show community groups
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('admin_share_post_to_groups', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      if (!ctx.session.temp) ctx.session.temp = {};

      // Initialize session data
      ctx.session.temp.communityPostStep = 'select_destinations';
      ctx.session.temp.communityPostData = {
        targetGroups: [],
        targetPrimeChannel: false, // NEW: Prime channel support
        postDestinations: [], // NEW: Multiple destinations
        mediaType: null,
        mediaFileId: null,
        s3Key: null,
        s3Url: null,
        fileSizeMB: 0, // NEW: Track file size for large videos
        textEn: '',
        textEs: '',
        buttons: [],
        templateType: 'standard',
        buttonLayout: 'single_row',
        isRecurring: false,
        recurrencePattern: 'daily',
        maxOccurrences: 1,
        scheduledTimes: [],
        scheduledCount: 1,
        currentScheduleIndex: 0,
      };
      await ctx.saveSession();

      await ctx.answerCbQuery();

      // Show destination selection (groups + Prime channel)
      const destinations = await communityPostService.getPostingDestinations();
      const buttons = [];

      // Add Prime Channel button first
      buttons.push([
        Markup.button.callback(
          '💎 Prime Channel',
          'share_post_dest_prime_channel'
        ),
      ]);

      // Add group selection buttons
      buttons.push([Markup.button.callback('━━ Community Groups ━━', 'share_post_groups_header')]);
      for (const group of destinations.filter(d => d.destination_type === 'group')) {
        buttons.push([
          Markup.button.callback(
            `${group.icon} ${group.destination_name}`,
            `share_post_dest_${group.telegram_id}`
          ),
        ]);
      }

      // Add select all button
      buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all_dest')]);
      buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection_dest')]);
      buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
      buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

      await ctx.editMessageText(
        '📤 *Compartir Publicación*\n\n'
        + '*Paso 1/9: Selecciona Destinos*\n\n'
        + 'Selecciona uno o más destinos (grupos o canal):\n\n'
        + '━━━━━━━━━━━━━━━━━\n\n'
        + '💎 *Prime Channel:* Para miembros premium\n'
        + '👥 *Grupos Comunitarios:* Todos los usuarios\n\n'
        + '💡 *Tip:* Puedes compartir en múltiples destinos a la vez.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error in share_post entry:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTINATION SELECTION (Groups + Prime Channel)
  // ═══════════════════════════════════════════════════════════════════════════

  // Prime Channel selection
  bot.action('share_post_dest_prime_channel', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const postDestinations = ctx.session.temp?.communityPostData?.postDestinations || [];
      const primeChannelId = '-1002997324714'; // From env

      // Toggle Prime Channel selection
      const index = postDestinations.indexOf(primeChannelId);
      if (index > -1) {
        postDestinations.splice(index, 1);
      } else {
        postDestinations.push(primeChannelId);
      }

      ctx.session.temp.communityPostData.postDestinations = postDestinations;
      ctx.session.temp.communityPostData.targetPrimeChannel = postDestinations.includes(primeChannelId);
      await ctx.saveSession();

      await ctx.answerCbQuery(postDestinations.includes(primeChannelId) ? '💎 Prime Channel añadido' : '💎 Prime Channel removido');

      // Refresh UI
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting Prime Channel:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Destination selection by ID (for groups)
  bot.action(/^share_post_dest_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const destId = ctx.match[1];
      if (destId === 'prime_channel') return; // Handled by other handler

      const postDestinations = ctx.session.temp?.communityPostData?.postDestinations || [];

      // Toggle destination selection
      const index = postDestinations.indexOf(destId);
      if (index > -1) {
        postDestinations.splice(index, 1);
      } else {
        postDestinations.push(destId);
      }

      ctx.session.temp.communityPostData.postDestinations = postDestinations;
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Destino ${postDestinations.length > 0 ? 'añadido' : 'removido'}`);

      // Refresh UI
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting destination:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Select all destinations
  bot.action('share_post_select_all_dest', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const destinations = await communityPostService.getPostingDestinations();
      const destIds = destinations.map(d => d.telegram_id);

      ctx.session.temp.communityPostData.postDestinations = destIds;
      ctx.session.temp.communityPostData.targetPrimeChannel = destIds.some(id => id === '-1002997324714');
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Todos los ${destinations.length} destinos seleccionados`);
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error selecting all destinations:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Clear all destinations
  bot.action('share_post_clear_selection_dest', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.communityPostData.postDestinations = [];
      ctx.session.temp.communityPostData.targetPrimeChannel = false;
      await ctx.saveSession();

      await ctx.answerCbQuery('⬜ Selección borrada');
      await showDestinationSelection(ctx);
    } catch (error) {
      logger.error('Error clearing destinations:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Helper function to show destination selection UI
  async function showDestinationSelection(ctx) {
    const destinations = await communityPostService.getPostingDestinations();
    const postDestinations = ctx.session.temp?.communityPostData?.postDestinations || [];
    const buttons = [];

    // Prime Channel button
    const primeChannelId = '-1002997324714';
    const isPrimeSelected = postDestinations.includes(primeChannelId);
    const primePrefix = isPrimeSelected ? '💎✅' : '💎⬜';
    buttons.push([
      Markup.button.callback(
        `${primePrefix} Prime Channel`,
        'share_post_dest_prime_channel'
      ),
    ]);

    // Group buttons
    buttons.push([Markup.button.callback('━━ Community Groups ━━', 'share_post_groups_header')]);
    for (const dest of destinations.filter(d => d.destination_type === 'group')) {
      const isSelected = postDestinations.includes(dest.telegram_id);
      const prefix = isSelected ? '✅' : '⬜';
      buttons.push([
        Markup.button.callback(
          `${prefix} ${dest.icon} ${dest.destination_name}`,
          `share_post_dest_${dest.telegram_id}`
        ),
      ]);
    }

    buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all_dest')]);
    buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection_dest')]);
    buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
    buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

    const selectedCount = postDestinations.length;
    const message = `📤 *Compartir Publicación*\n\n`
      + `*Paso 1/9: Selecciona Destinos*\n\n`
      + `Destinos seleccionados: *${selectedCount}*\n\n`
      + `━━━━━━━━━━━━━━━━━\n\n`
      + `💎 *Prime Channel:* Contenido exclusivo para miembros\n`
      + `👥 *Grupos:* Contenido para todos\n\n`
      + `💡 *Tip:* Selecciona múltiples destinos para mayor alcance.`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Group selection actions (legacy - keep for compatibility)
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action(/^share_post_group_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const groupId = ctx.match[1];
      const targetGroups = ctx.session.temp?.communityPostData?.targetGroups || [];

      // Toggle group selection
      const index = targetGroups.indexOf(groupId);
      if (index > -1) {
        targetGroups.splice(index, 1);
      } else {
        targetGroups.push(groupId);
      }

      ctx.session.temp.communityPostData.targetGroups = targetGroups;
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Grupo ${targetGroups.length > 0 ? 'añadido' : 'removido'}`);

      // Refresh the UI to show selected groups
      const groups = await communityPostService.getCommunityGroups();
      const buttons = [];

      for (const group of groups) {
        const isSelected = targetGroups.includes(group.group_id);
        const prefix = isSelected ? '✅' : '⬜';
        buttons.push([
          Markup.button.callback(
            `${prefix} ${group.icon} ${group.name}`,
            `share_post_group_${group.group_id}`
          ),
        ]);
      }

      buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all')]);
      buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection')]);
      buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
      buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

      const selectedCount = targetGroups.length;
      const message = `📤 *Compartir Publicación en Comunidad*\n\n`
        + `*Paso 1/9: Selecciona Grupos*\n\n`
        + `Grupos seleccionados: *${selectedCount}*\n\n`
        + `━━━━━━━━━━━━━━━━━\n\n`
        + `💡 *Tip:* Puedes seleccionar múltiples grupos o todos de una vez.`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error selecting group:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action('share_post_select_all', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const groups = await communityPostService.getCommunityGroups();
      const groupIds = groups.map((g) => g.group_id);

      ctx.session.temp.communityPostData.targetGroups = groupIds;
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Todos los ${groups.length} grupos seleccionados`);

      // Refresh UI
      const buttons = [];
      for (const group of groups) {
        buttons.push([
          Markup.button.callback(
            `✅ ${group.icon} ${group.name}`,
            `share_post_group_${group.group_id}`
          ),
        ]);
      }

      buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all')]);
      buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection')]);
      buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
      buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

      await ctx.editMessageText(
        `📤 *Compartir Publicación en Comunidad*\n\n`
        + `*Paso 1/9: Selecciona Grupos*\n\n`
        + `Grupos seleccionados: *${groups.length}* (todos)`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error selecting all groups:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action('share_post_clear_selection', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.communityPostData.targetGroups = [];
      await ctx.saveSession();

      await ctx.answerCbQuery('⬜ Selección borrada');

      const groups = await communityPostService.getCommunityGroups();
      const buttons = [];

      for (const group of groups) {
        buttons.push([
          Markup.button.callback(
            `⬜ ${group.icon} ${group.name}`,
            `share_post_group_${group.group_id}`
          ),
        ]);
      }

      buttons.push([Markup.button.callback('✅ Select All', 'share_post_select_all')]);
      buttons.push([Markup.button.callback('⬜ Clear Selection', 'share_post_clear_selection')]);
      buttons.push([Markup.button.callback('➡️ Continue', 'share_post_continue_to_media')]);
      buttons.push([Markup.button.callback('❌ Cancel', 'admin_cancel')]);

      await ctx.editMessageText(
        `📤 *Compartir Publicación en Comunidad*\n\n`
        + `*Paso 1/9: Selecciona Grupos*\n\n`
        + `Grupos seleccionados: *0*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      logger.error('Error clearing selection:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

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

      const targetGroups = ctx.session.temp?.communityPostData?.targetGroups || [];
      if (targetGroups.length === 0) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un grupo');
        return;
      }

      ctx.session.temp.communityPostStep = 'upload_media';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 2/9: Subir Media (Opcional)*\n\n'
        + '📸 Puedes subir una foto o video para acompañar tu publicación.\n\n'
        + '💡 *Opciones:*\n'
        + '• 📷 Envía una foto (JPEG, PNG)\n'
        + '• 🎥 Envía un video (MP4, MOV)\n'
        + '• ➡️ Click "Sin Media" para continuar sin imagen/video\n\n'
        + '⚠️ *Tamaño máximo:* 50 MB',
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

      ctx.session.temp.communityPostStep = 'write_text';
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
  bot.on('photo', async (ctx) => {
    try {
      if (!ctx.session.temp?.waitingForMedia) return;

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      await ctx.reply('📤 Uploading photo to S3...');

      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);

      // Upload to S3
      const s3Result = await s3Service.uploadFromUrl(fileLink.href, 'community-posts');

      ctx.session.temp.communityPostData.mediaType = 'photo';
      ctx.session.temp.communityPostData.mediaFileId = photo.file_id;
      ctx.session.temp.communityPostData.s3Key = s3Result.key;
      ctx.session.temp.communityPostData.s3Url = s3Result.url;
      ctx.session.temp.communityPostData.s3Bucket = s3Result.bucket;
      ctx.session.temp.communityPostStep = 'write_text';
      ctx.session.temp.waitingForMedia = false;
      await ctx.saveSession();

      await ctx.reply('✅ Foto cargada exitosamente');
      await showTextInputStep(ctx);
    } catch (error) {
      logger.error('Error handling photo upload:', error);
      await ctx.reply('❌ Error al cargar la foto');
    }
  });

  bot.on('video', async (ctx) => {
    try {
      if (!ctx.session.temp?.waitingForMedia) return;

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      await ctx.reply('📤 Uploading video to S3...');

      const video = ctx.message.video;
      const fileLink = await ctx.telegram.getFileLink(video.file_id);

      // Upload to S3
      const s3Result = await s3Service.uploadFromUrl(fileLink.href, 'community-posts');

      ctx.session.temp.communityPostData.mediaType = 'video';
      ctx.session.temp.communityPostData.mediaFileId = video.file_id;
      ctx.session.temp.communityPostData.s3Key = s3Result.key;
      ctx.session.temp.communityPostData.s3Url = s3Result.url;
      ctx.session.temp.communityPostData.s3Bucket = s3Result.bucket;
      ctx.session.temp.communityPostStep = 'write_text';
      ctx.session.temp.waitingForMedia = false;
      await ctx.saveSession();

      await ctx.reply('✅ Video cargado exitosamente');
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
    ctx.session.temp.communityPostStep = 'write_text';
    await ctx.saveSession();

    await ctx.editMessageText(
      '📤 *Compartir Publicación en Comunidad*\n\n'
      + '*Paso 3/9: Escribir Texto*\n\n'
      + '✍️ Envía el texto de tu publicación.\n\n'
      + '💡 *Instrucciones:*\n'
      + '• Escribe tu mensaje en Inglés\n'
      + '• Luego enviarás la versión en Español\n'
      + '• Usa *negrita* para destacar\n'
      + '• Usa _cursiva_ para énfasis\n\n'
      + '📝 *Máximo:* 1024 caracteres',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
        ]),
      }
    );

    ctx.session.temp.waitingForText = 'en';
    await ctx.saveSession();
  }

  bot.on('text', async (ctx) => {
    try {
      if (!ctx.session.temp?.communityPostStep) return;

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const step = ctx.session.temp.communityPostStep;
      const text = ctx.message.text;

      // Text input during write_text step
      if (step === 'write_text') {
        if (ctx.session.temp.waitingForText === 'en') {
          if (text.length > 1024) {
            await ctx.reply('❌ El texto es demasiado largo (máximo 1024 caracteres)');
            return;
          }

          ctx.session.temp.communityPostData.textEn = text;
          ctx.session.temp.waitingForText = 'es';
          await ctx.saveSession();

          await ctx.reply(
            '✅ Texto en Inglés guardado.\n\n'
            + 'Ahora envía la versión en Español:'
          );
        } else if (ctx.session.temp.waitingForText === 'es') {
          if (text.length > 1024) {
            await ctx.reply('❌ El texto es demasiado largo (máximo 1024 caracteres)');
            return;
          }

          ctx.session.temp.communityPostData.textEs = text;
          ctx.session.temp.communityPostStep = 'select_buttons';
          ctx.session.temp.waitingForText = null;
          await ctx.saveSession();

          await showButtonSelectionStep(ctx);
        }
      }
    } catch (error) {
      logger.error('Error handling text input:', error);
      await ctx.reply('❌ Error al procesar el texto').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Select buttons
  // ═══════════════════════════════════════════════════════════════════════════
  async function showButtonSelectionStep(ctx) {
    try {
      const presets = await communityPostService.getButtonPresets();
      const buttons = [];

      for (const preset of presets) {
        buttons.push([
          Markup.button.callback(
            `${preset.icon_emoji} ${preset.button_label}`,
            `share_post_add_button_${preset.button_type}`
          ),
        ]);
      }

      buttons.push([Markup.button.callback('➡️ Continuar', 'share_post_continue_to_template')]);
      buttons.push([Markup.button.callback('❌ Cancelar', 'admin_cancel')]);

      await ctx.editMessageText(
        '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 4/9: Seleccionar Botones*\n\n'
        + '🔗 Añade botones interactivos a tu publicación:\n\n'
        + '📍 Nearby\n'
        + '👤 Profile\n'
        + '🎯 Main Room\n'
        + '🎉 Hangouts\n'
        + '🤖 Cristina AI\n'
        + '🎬 Videorama\n'
        + '🔗 Custom Link\n\n'
        + '💡 Tip: Puedes seleccionar múltiples botones',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );

      ctx.session.temp.communityPostStep = 'select_buttons';
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error showing button selection:', error);
      await ctx.reply('❌ Error al mostrar botones').catch(() => {});
    }
  }

  bot.action(/^share_post_add_button_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const buttonType = ctx.match[1];
      const preset = (await communityPostService.getButtonPresets()).find(
        (p) => p.button_type === buttonType
      );

      if (!preset) {
        await ctx.answerCbQuery('❌ Botón no encontrado');
        return;
      }

      const buttons = ctx.session.temp.communityPostData.buttons || [];
      const exists = buttons.some((b) => b.buttonType === buttonType);

      if (exists) {
        // Remove button
        ctx.session.temp.communityPostData.buttons = buttons.filter(
          (b) => b.buttonType !== buttonType
        );
        await ctx.answerCbQuery('❌ Botón removido');
      } else {
        // Add button
        buttons.push({
          buttonType: preset.button_type,
          label: preset.button_label,
          defaultLabel: preset.default_label,
          icon: preset.icon_emoji,
          targetUrl: preset.target_url,
          allowCustomUrl: preset.allow_custom_url,
        });
        ctx.session.temp.communityPostData.buttons = buttons;
        await ctx.answerCbQuery('✅ Botón añadido');
      }

      await ctx.saveSession();

      // Refresh UI
      await showButtonSelectionStep(ctx);
    } catch (error) {
      logger.error('Error adding button:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Select template
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_continue_to_template', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.communityPostStep = 'select_template';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 5/9: Seleccionar Plantilla*\n\n'
        + '🎨 Elige el estilo visual de tu publicación:\n\n'
        + '📝 *Standard* - Formato limpio y simple\n'
        + '✨ *Featured* - Destacada con bordes\n'
        + '📢 *Announcement* - Anuncio importante\n'
        + '🎪 *Event* - Formato para eventos',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Standard', 'share_post_template_standard')],
            [Markup.button.callback('✨ Featured', 'share_post_template_featured')],
            [Markup.button.callback('📢 Announcement', 'share_post_template_announcement')],
            [Markup.button.callback('🎪 Event', 'share_post_template_event')],
            [Markup.button.callback('➡️ Continuar', 'share_post_continue_to_recurrence')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing template selection:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action(/^share_post_template_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const templateType = ctx.match[1];
      ctx.session.temp.communityPostData.templateType = templateType;
      await ctx.saveSession();

      await ctx.answerCbQuery(`✅ Plantilla: ${templateType}`);
    } catch (error) {
      logger.error('Error selecting template:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Select recurrence
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_continue_to_recurrence', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.communityPostStep = 'select_recurrence';
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 6/9: Configurar Recurrencia*\n\n'
        + '🔄 ¿Quieres que la publicación se repita?\n\n'
        + '📅 *Opciones:*\n'
        + '• Una sola vez\n'
        + '• Diariamente\n'
        + '• Semanalmente\n'
        + '• Mensualmente\n\n'
        + '💡 Para publicaciones únicas, elige "Una sola vez"',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('1️⃣ Una sola vez', 'share_post_recurrence_once')],
            [Markup.button.callback('📅 Diariamente', 'share_post_recurrence_daily')],
            [Markup.button.callback('📆 Semanalmente', 'share_post_recurrence_weekly')],
            [Markup.button.callback('📋 Mensualmente', 'share_post_recurrence_monthly')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing recurrence selection:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  bot.action(/^share_post_recurrence_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const recurrenceType = ctx.match[1];

      if (recurrenceType === 'once') {
        ctx.session.temp.communityPostData.isRecurring = false;
        ctx.session.temp.communityPostData.recurrencePattern = null;
        await ctx.answerCbQuery('1️⃣ Una sola vez');
      } else {
        ctx.session.temp.communityPostData.isRecurring = true;
        ctx.session.temp.communityPostData.recurrencePattern = recurrenceType;
        await ctx.answerCbQuery(`✅ Recurrencia: ${recurrenceType}`);
      }

      ctx.session.temp.communityPostStep = 'select_schedule_count';
      await ctx.saveSession();

      // Show schedule count selection
      await ctx.editMessageText(
        '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 7/9: Cantidad de Programaciones*\n\n'
        + '🗓️ ¿Cuántas veces deseas programar esta publicación?\n\n'
        + '💡 Ejemplo: Programa la misma publicación 3 veces en diferentes fechas/horas',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('1️⃣ Una', 'share_post_schedule_count_1'),
              Markup.button.callback('2️⃣ Dos', 'share_post_schedule_count_2'),
              Markup.button.callback('3️⃣ Tres', 'share_post_schedule_count_3'),
            ],
            [
              Markup.button.callback('4️⃣ Cuatro', 'share_post_schedule_count_4'),
              Markup.button.callback('5️⃣ Cinco', 'share_post_schedule_count_5'),
              Markup.button.callback('6️⃣ Seis', 'share_post_schedule_count_6'),
            ],
            [
              Markup.button.callback('7️⃣ Siete', 'share_post_schedule_count_7'),
              Markup.button.callback('8️⃣ Ocho', 'share_post_schedule_count_8'),
              Markup.button.callback('9️⃣ Nueve', 'share_post_schedule_count_9'),
            ],
            [
              Markup.button.callback('🔟 Diez', 'share_post_schedule_count_10'),
              Markup.button.callback('1️⃣1️⃣ Once', 'share_post_schedule_count_11'),
              Markup.button.callback('1️⃣2️⃣ Doce', 'share_post_schedule_count_12'),
            ],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error selecting recurrence:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Schedule count
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 1; i <= 12; i++) {
    bot.action(`share_post_schedule_count_${i}`, async (ctx) => {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) {
          await ctx.answerCbQuery('❌ No autorizado');
          return;
        }

        ctx.session.temp.communityPostData.scheduledCount = i;
        ctx.session.temp.communityPostData.currentScheduleIndex = 0;
        ctx.session.temp.communityPostData.scheduledTimes = [];
        ctx.session.temp.communityPostStep = 'enter_schedule_datetime';
        await ctx.saveSession();

        await ctx.answerCbQuery();
        await askForScheduleDateTime(ctx, i, 0);
      } catch (error) {
        logger.error('Error selecting schedule count:', error);
        await ctx.answerCbQuery('❌ Error').catch(() => {});
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Enter schedule dates/times
  // ═══════════════════════════════════════════════════════════════════════════
  async function askForScheduleDateTime(ctx, total, current) {
    const nextIndex = current + 1;

    await ctx.editMessageText(
      `📤 *Compartir Publicación en Comunidad*\n\n`
      + `*Paso 8/9: Programar Fechas y Horas (${nextIndex}/${total})*\n\n`
      + `Por favor envía la fecha y hora del envío:\n\n`
      + '`YYYY-MM-DD HH:MM`\n\n'
      + '*Ejemplos:*\n'
      + '• `2025-01-15 14:30` (15 enero 2025, 2:30 PM)\n'
      + '• `2025-01-20 09:00` (20 enero 2025, 9:00 AM)\n\n'
      + '⏰ *Zona horaria:* UTC\n\n'
      + `📝 *Programación ${nextIndex}/${total}*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
        ]),
      }
    );

    ctx.session.temp.currentScheduleIndex = current;
    ctx.session.temp.waitingForDateTime = true;
    await ctx.saveSession();
  }

  // Handle datetime input
  bot.on('text', async (ctx) => {
    try {
      if (!ctx.session.temp?.waitingForDateTime) return;

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const dateTimeStr = ctx.message.text.trim();
      const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})$/;

      if (!dateTimeRegex.test(dateTimeStr)) {
        await ctx.reply('❌ Formato inválido. Usa: YYYY-MM-DD HH:MM');
        return;
      }

      const dateTime = new Date(dateTimeStr + ' UTC');
      if (isNaN(dateTime.getTime())) {
        await ctx.reply('❌ Fecha/hora inválida');
        return;
      }

      if (dateTime <= new Date()) {
        await ctx.reply('❌ La fecha debe estar en el futuro');
        return;
      }

      const scheduledTimes = ctx.session.temp.communityPostData.scheduledTimes || [];
      scheduledTimes.push(dateTime);
      ctx.session.temp.communityPostData.scheduledTimes = scheduledTimes;

      const currentIndex = ctx.session.temp.currentScheduleIndex;
      const totalCount = ctx.session.temp.communityPostData.scheduledCount;

      if (currentIndex + 1 < totalCount) {
        await ctx.reply(`✅ Fecha ${currentIndex + 1} guardada`);
        await askForScheduleDateTime(ctx, totalCount, currentIndex + 1);
      } else {
        ctx.session.temp.communityPostStep = 'preview';
        ctx.session.temp.waitingForDateTime = false;
        await ctx.saveSession();

        await ctx.reply('✅ Todas las fechas guardadas');
        await showPreviewStep(ctx);
      }
    } catch (error) {
      logger.error('Error handling datetime input:', error);
      await ctx.reply('❌ Error al procesar la fecha').catch(() => {});
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Preview
  // ═══════════════════════════════════════════════════════════════════════════
  async function showPreviewStep(ctx) {
    try {
      const postData = ctx.session.temp.communityPostData;

      // Format preview message
      let previewText = '📤 *Compartir Publicación en Comunidad*\n\n'
        + '*Paso 9/9: Vista Previa*\n\n'
        + '━━━━━━━━━━━━━━━━━\n'
        + '*VISTA PREVIA (EN):*\n'
        + '━━━━━━━━━━━━━━━━━\n\n';

      if (postData.mediaType) {
        previewText += `[${postData.mediaType.toUpperCase()}]\n\n`;
      }

      previewText += communityPostService.formatMessage(
        postData.templateType,
        postData.textEn,
        postData.title
      );

      previewText += '\n━━━━━━━━━━━━━━━━━\n'
        + '*VISTA PREVIA (ES):*\n'
        + '━━━━━━━━━━━━━━━━━\n\n';

      if (postData.mediaType) {
        previewText += `[${postData.mediaType.toUpperCase()}]\n\n`;
      }

      previewText += communityPostService.formatMessage(
        postData.templateType,
        postData.textEs,
        postData.title
      );

      previewText += '\n━━━━━━━━━━━━━━━━━\n'
        + '*CONFIGURACIÓN:*\n'
        + '━━━━━━━━━━━━━━━━━\n'
        + `Grupos: ${postData.targetGroups.length}\n`
        + `Plantilla: ${postData.templateType}\n`
        + `Recurrente: ${postData.isRecurring ? 'Sí (' + postData.recurrencePattern + ')' : 'No'}\n`
        + `Programaciones: ${postData.scheduledCount}\n`
        + `Botones: ${postData.buttons.length}\n`;

      await ctx.editMessageText(previewText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirmar y Enviar', 'share_post_confirm_and_send')],
          [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
        ]),
      });

      ctx.session.temp.communityPostStep = 'preview';
      await ctx.saveSession();
    } catch (error) {
      logger.error('Error showing preview:', error);
      await ctx.reply('❌ Error al mostrar vista previa').catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL: Confirm and send
  // ═══════════════════════════════════════════════════════════════════════════
  bot.action('share_post_confirm_and_send', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const postData = ctx.session.temp.communityPostData;

      // Validate all required fields
      if (!postData.targetGroups.length) {
        await ctx.answerCbQuery('❌ Debes seleccionar al menos un grupo');
        return;
      }

      if (!postData.textEn || !postData.textEs) {
        await ctx.answerCbQuery('❌ Debes proporcionar texto en ambos idiomas');
        return;
      }

      await ctx.answerCbQuery('⏳ Guardando publicación...');

      // Create community post
      const createdPost = await communityPostService.createCommunityPost({
        adminId: ctx.from.id,
        adminUsername: ctx.from.username,
        title: postData.title,
        messageEn: postData.textEn,
        messageEs: postData.textEs,
        mediaType: postData.mediaType,
        mediaUrl: postData.s3Url,
        s3Key: postData.s3Key,
        s3Bucket: postData.s3Bucket,
        telegramFileId: postData.mediaFileId,
        targetGroupIds: postData.targetGroups,
        templateType: postData.templateType,
        buttonLayout: postData.buttonLayout,
        isRecurring: postData.isRecurring,
        recurrencePattern: postData.recurrencePattern,
        status: 'scheduled',
        scheduledCount: postData.scheduledCount,
      });

      // Add buttons if any
      if (postData.buttons.length > 0) {
        await communityPostService.addButtonsToPost(createdPost.post_id, postData.buttons);
      }

      // Schedule post(s)
      const schedules = await communityPostService.schedulePost(
        createdPost.post_id,
        postData.scheduledTimes,
        {
          timezone: 'UTC',
          isRecurring: postData.isRecurring,
          recurrencePattern: postData.recurrencePattern,
        }
      );

      // Clear session
      ctx.session.temp = {};
      await ctx.saveSession();

      const message = `✅ *Publicación Guardada*\n\n`
        + `📦 Post ID: \`${createdPost.post_id}\`\n`
        + `📊 Grupos: ${postData.targetGroups.length}\n`
        + `🗓️ Programaciones: ${schedules.length}\n\n`
        + `La publicación será enviada según la programación configurada.`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📤 Nueva Publicación', 'admin_share_post_to_groups')],
          [Markup.button.callback('⬅️ Panel Admin', 'admin_dashboard')],
        ]),
      });

      logger.info('Community post created and scheduled', {
        postId: createdPost.post_id,
        adminId: ctx.from.id,
        groups: postData.targetGroups.length,
        schedules: schedules.length,
      });
    } catch (error) {
      logger.error('Error confirming and sending post:', error);
      await ctx.answerCbQuery('❌ Error al guardar publicación').catch(() => {});
      await ctx.reply(`❌ Error: ${error.message}`).catch(() => {});
    }
  });

  // Cancel action
  bot.action('admin_cancel', async (ctx) => {
    try {
      ctx.session.temp = {};
      await ctx.saveSession();

      await ctx.answerCbQuery('❌ Cancelado');
      await ctx.editMessageText(
        '❌ Publicación cancelada',
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Nueva Publicación', 'admin_share_post_to_groups')],
            [Markup.button.callback('⬅️ Panel Admin', 'admin_dashboard')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error cancelling:', error);
    }
  });
};

module.exports = registerCommunityPostHandlers;
