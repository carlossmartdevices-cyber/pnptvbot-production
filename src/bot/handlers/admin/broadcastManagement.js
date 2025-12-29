/**
 * Enhanced Broadcast Management Handler
 * Includes scheduling and S3 media upload support
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const broadcastService = require('../../services/broadcastService');
const s3Service = require('../../../utils/s3Service');
const PermissionService = require('../../services/permissionService');
const { getLanguage } = require('../../utils/helpers');

/**
 * Register enhanced broadcast handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerBroadcastHandlers = (bot) => {
  // Step 4: Ask if user wants to schedule the broadcast
  bot.action('broadcast_schedule_options', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      if (!ctx.session.temp || !ctx.session.temp.broadcastData) {
        await ctx.answerCbQuery('❌ Sesión expirada');
        return;
      }

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '⏰ *Paso 4/5: Programación*\n\n'
        + '¿Cuándo quieres enviar este broadcast?\n\n'
        + '📤 *Enviar Ahora:* El broadcast se enviará inmediatamente\n'
        + '📅 *Programar:* Elige una fecha y hora para enviar',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Enviar Ahora', 'broadcast_send_now')],
            [Markup.button.callback('📅 Programar Envío', 'broadcast_schedule_later')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing schedule options:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Send broadcast immediately
  bot.action('broadcast_send_now', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      await sendBroadcastNow(ctx, bot);
    } catch (error) {
      logger.error('Error sending broadcast now:', error);
      await ctx.reply('❌ Error al enviar broadcast').catch(() => {});
    }
  });

  // Schedule broadcast for later
  bot.action('broadcast_schedule_later', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      if (!ctx.session.temp) {
        ctx.session.temp = {};
      }

      ctx.session.temp.broadcastStep = 'schedule_count';
      ctx.session.temp.scheduledTimes = [];
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📅 *Programar Broadcasts*\n\n'
        + '¿Cuántas veces deseas programar este broadcast?\n\n'
        + '🔄 *Opciones:* 1 a 12 programaciones diferentes\n\n'
        + 'Ejemplo: Puedes programar el mismo mensaje para 3 fechas/horas diferentes',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('1️⃣ Una vez', 'schedule_count_1'), Markup.button.callback('2️⃣ Dos veces', 'schedule_count_2'), Markup.button.callback('3️⃣ Tres veces', 'schedule_count_3')],
            [Markup.button.callback('4️⃣ Cuatro', 'schedule_count_4'), Markup.button.callback('5️⃣ Cinco', 'schedule_count_5'), Markup.button.callback('6️⃣ Seis', 'schedule_count_6')],
            [Markup.button.callback('7️⃣ Siete', 'schedule_count_7'), Markup.button.callback('8️⃣ Ocho', 'schedule_count_8'), Markup.button.callback('9️⃣ Nueve', 'schedule_count_9')],
            [Markup.button.callback('🔟 Diez', 'schedule_count_10'), Markup.button.callback('1️⃣1️⃣ Once', 'schedule_count_11'), Markup.button.callback('1️⃣2️⃣ Doce', 'schedule_count_12')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error scheduling broadcast:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Handle schedule count selection (1-12)
  for (let i = 1; i <= 12; i++) {
    bot.action(`schedule_count_${i}`, async (ctx) => {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) {
          await ctx.answerCbQuery('❌ No autorizado');
          return;
        }

        if (!ctx.session.temp) {
          ctx.session.temp = {};
        }

        ctx.session.temp.broadcastStep = 'schedule_datetime';
        ctx.session.temp.scheduleCount = i;
        ctx.session.temp.scheduledTimes = [];
        ctx.session.temp.currentScheduleIndex = 0;
        await ctx.saveSession();

        await ctx.answerCbQuery();

        await ctx.editMessageText(
          `📅 *Programar Broadcasts (1/${i})*\n\n`
          + 'Por favor envía la fecha y hora en el siguiente formato:\n\n'
          + '`YYYY-MM-DD HH:MM`\n\n'
          + '*Ejemplos:*\n'
          + '• `2025-12-15 14:30` (15 dic 2025, 2:30 PM)\n'
          + '• `2025-12-25 09:00` (25 dic 2025, 9:00 AM)\n\n'
          + '⏰ *Zona horaria:* UTC\n\n'
          + '💡 Tip: Asegúrate de que la fecha sea en el futuro',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          }
        );
      } catch (error) {
        logger.error('Error selecting schedule count:', error);
        await ctx.answerCbQuery('❌ Error').catch(() => {});
      }
    });
  }

  // Upload media with S3 support (called when media is uploaded)
  const uploadMediaToS3 = async (ctx, fileId, mediaType) => {
    try {
      logger.info(`Uploading ${mediaType} to S3...`, { fileId });

      // Show upload progress
      await ctx.reply(
        '☁️ Subiendo archivo a almacenamiento seguro (S3)...',
        { parse_mode: 'Markdown' }
      );

      // Upload to S3
      const uploadResult = await s3Service.uploadTelegramFileToS3(
        bot,
        fileId,
        mediaType,
        {
          folder: 'broadcasts',
          metadata: {
            admin_id: String(ctx.from.id),
            admin_username: ctx.from.username || 'unknown',
          },
        }
      );

      logger.info('S3 upload successful', {
        s3Key: uploadResult.s3Key,
        s3Url: uploadResult.s3Url,
      });

      // Store both S3 and Telegram file info
      if (!ctx.session.temp.broadcastData) {
        ctx.session.temp.broadcastData = {};
      }

      ctx.session.temp.broadcastData.mediaType = mediaType;
      ctx.session.temp.broadcastData.mediaFileId = fileId; // Keep for fallback
      ctx.session.temp.broadcastData.s3Key = uploadResult.s3Key;
      ctx.session.temp.broadcastData.s3Url = uploadResult.s3Url;
      ctx.session.temp.broadcastData.s3Bucket = uploadResult.s3Bucket;

      await ctx.saveSession();

      return uploadResult;
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw error;
    }
  };

  return {
    uploadMediaToS3,
  };
};

/**
 * Send broadcast immediately using new broadcast service
 * @param {Context} ctx - Telegraf context
 * @param {Telegraf} bot - Bot instance
 */
async function sendBroadcastNow(ctx, bot) {
  try {
    const { broadcastTarget, broadcastData } = ctx.session.temp;

    if (!broadcastData || !broadcastData.textEn || !broadcastData.textEs) {
      await ctx.reply('❌ Error: Faltan datos del broadcast');
      return;
    }

    await ctx.editMessageText(
      '📤 *Enviando Broadcast...*\n\n'
      + 'Tu broadcast se está enviando a los usuarios seleccionados.\n'
      + 'Esto puede tardar unos minutos dependiendo del número de destinatarios...',
      { parse_mode: 'Markdown' }
    );

    // Create broadcast record
    const broadcast = await broadcastService.createBroadcast({
      adminId: String(ctx.from.id),
      adminUsername: ctx.from.username || 'Admin',
      title: `Broadcast ${new Date().toLocaleDateString()}`,
      messageEn: broadcastData.textEn,
      messageEs: broadcastData.textEs,
      targetType: broadcastTarget,
      mediaType: broadcastData.mediaType || null,
      mediaUrl: broadcastData.s3Url || broadcastData.mediaFileId || null,
      mediaFileId: broadcastData.mediaFileId || null,
      s3Key: broadcastData.s3Key || null,
      s3Bucket: broadcastData.s3Bucket || null,
      scheduledAt: null, // Immediate
      timezone: 'UTC',
    });

    logger.info('Broadcast created', {
      broadcastId: broadcast.broadcast_id,
      target: broadcastTarget,
    });

    // Queue broadcast using async queue if available
    let results;
    const queueIntegration = global.broadcastQueueIntegration;
    if (queueIntegration) {
      try {
        const job = await queueIntegration.queueBroadcast(broadcast.broadcast_id);
        logger.info('Broadcast queued', {
          broadcastId: broadcast.broadcast_id,
          jobId: job.job_id,
        });
        results = { success: true, jobId: job.job_id, queued: true };
      } catch (error) {
        logger.warn('Failed to queue broadcast, falling back to sync:', error.message);
        results = await broadcastService.sendBroadcast(bot, broadcast.broadcast_id);
      }
    } else {
      // Fallback if queue not initialized
      results = await broadcastService.sendBroadcast(bot, broadcast.broadcast_id);
    }

    // Clear session data
    ctx.session.temp.broadcastTarget = null;
    ctx.session.temp.broadcastStep = null;
    ctx.session.temp.broadcastData = null;
    await ctx.saveSession();

    // Show results
    await ctx.reply(
      `✅ *Broadcast Completado*\n\n`
      + `📊 *Estadísticas:*\n`
      + `✓ Enviados: ${results.sent}\n`
      + `✗ Fallidos: ${results.failed}\n`
      + `🚫 Bloqueados: ${results.blocked}\n`
      + `👤 Desactivados: ${results.deactivated}\n`
      + `📈 Total intentos: ${results.total}\n\n`
      + `🎯 Audiencia: ${broadcastTarget}\n`
      + `🆔 ID: \`${broadcast.broadcast_id}\`\n`
      + `${broadcastData.mediaType ? `📎 Con media (${broadcastData.mediaType})` : '📝 Solo texto'}\n`
      + `${broadcastData.s3Key ? '☁️ Almacenado en S3' : ''}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
        ]),
      }
    );

    logger.info('Broadcast completed', {
      broadcastId: broadcast.broadcast_id,
      results,
    });
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    await ctx.reply(
      '❌ *Error al enviar broadcast*\n\n'
      + `Detalles: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Schedule broadcast for later
 * @param {Context} ctx - Telegraf context
 * @param {Date} scheduledDate - When to send
 */
async function scheduleBroadcastForLater(ctx, scheduledDate) {
  try {
    const { broadcastTarget, broadcastData } = ctx.session.temp;

    if (!broadcastData || !broadcastData.textEn || !broadcastData.textEs) {
      await ctx.reply('❌ Error: Faltan datos del broadcast');
      return;
    }

    // Create scheduled broadcast
    const broadcast = await broadcastService.createBroadcast({
      adminId: String(ctx.from.id),
      adminUsername: ctx.from.username || 'Admin',
      title: `Broadcast programado ${scheduledDate.toLocaleDateString()}`,
      messageEn: broadcastData.textEn,
      messageEs: broadcastData.textEs,
      targetType: broadcastTarget,
      mediaType: broadcastData.mediaType || null,
      mediaUrl: broadcastData.s3Url || broadcastData.mediaFileId || null,
      mediaFileId: broadcastData.mediaFileId || null,
      s3Key: broadcastData.s3Key || null,
      s3Bucket: broadcastData.s3Bucket || null,
      scheduledAt: scheduledDate,
      timezone: 'UTC',
    });

    logger.info('Broadcast scheduled', {
      broadcastId: broadcast.broadcast_id,
      scheduledAt: scheduledDate,
    });

    // Clear session data
    ctx.session.temp.broadcastTarget = null;
    ctx.session.temp.broadcastStep = null;
    ctx.session.temp.broadcastData = null;
    await ctx.saveSession();

    // Show confirmation
    await ctx.reply(
      `✅ *Broadcast Programado*\n\n`
      + `📅 Fecha programada: ${scheduledDate.toLocaleString('es-ES', { timeZone: 'UTC' })} UTC\n`
      + `🎯 Audiencia: ${broadcastTarget}\n`
      + `🆔 ID: \`${broadcast.broadcast_id}\`\n`
      + `${broadcastData.mediaType ? `📎 Con media (${broadcastData.mediaType})` : '📝 Solo texto'}\n`
      + `${broadcastData.s3Key ? '☁️ Almacenado en S3\n' : ''}`
      + `\n💡 El broadcast se enviará automáticamente a la hora programada.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
        ]),
      }
    );
  } catch (error) {
    logger.error('Error scheduling broadcast:', error);
    await ctx.reply(
      '❌ *Error al programar broadcast*\n\n'
      + `Detalles: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = {
  registerBroadcastHandlers,
  sendBroadcastNow,
  scheduleBroadcastForLater,
};
