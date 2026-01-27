/**
 * PNP Live Model Self-Service Handler
 * Allows models to manage their online status, schedule, and availability
 */

const { Markup } = require('telegraf');
const PNPLiveAvailabilityService = require('../../services/pnpLiveAvailabilityService');
const PNPLiveService = require('../../services/pnpLiveService');
const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');

const registerPNPLiveModelHandlers = (bot) => {
  /**
   * Get model by Telegram ID
   */
  async function getModelByTelegramId(telegramId) {
    try {
      const result = await query(
        `SELECT * FROM pnp_models WHERE telegram_id = $1 AND is_active = TRUE`,
        [telegramId.toString()]
      );
      return result.rows?.[0] || null;
    } catch (error) {
      logger.error('Error getting model by telegram ID:', error);
      return null;
    }
  }

  /**
   * Check if user is a registered model
   */
  async function isModel(ctx) {
    const model = await getModelByTelegramId(ctx.from.id);
    return model !== null;
  }

  /**
   * Model dashboard command
   */
  bot.command('modelo', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);

      if (!model) {
        return ctx.reply(
          '❌ No estás registrada como modelo en PNP Television Live.\n\n' +
          'Contacta al administrador para registrarte.'
        );
      }

      await showModelDashboard(ctx, model);
    } catch (error) {
      logger.error('Error in /modelo command:', error);
      await ctx.reply('❌ Error al cargar el panel de modelo');
    }
  });

  /**
   * Show model dashboard
   */
  async function showModelDashboard(ctx, model) {
    const statusEmoji = model.is_online ? '🟢' : '⚪';
    const statusText = model.is_online ? 'ONLINE' : 'OFFLINE';

    // Get today's bookings count
    const todayBookings = await query(
      `SELECT COUNT(*) as count FROM pnp_bookings
       WHERE model_id = $1
       AND DATE(booking_time) = CURRENT_DATE
       AND status NOT IN ('cancelled', 'refunded')`,
      [model.id]
    );

    // Get pending earnings
    const pendingEarnings = await query(
      `SELECT COALESCE(SUM(model_earnings), 0) as total
       FROM pnp_model_earnings
       WHERE model_id = $1
       AND payout_status = 'pending'`,
      [model.id]
    );

    const message =
      `💃 *Panel de Modelo - PNP Television Live*\n\n` +
      `👤 *${model.name}*\n` +
      `${statusEmoji} Estado: *${statusText}*\n` +
      `${model.status_message ? `💬 "${model.status_message}"\n` : ''}` +
      `\n📊 *Estadísticas:*\n` +
      `⭐ Rating: ${model.avg_rating?.toFixed(1) || '0.0'}/5\n` +
      `📹 Shows totales: ${model.total_shows || 0}\n` +
      `📅 Shows hoy: ${todayBookings.rows?.[0]?.count || 0}\n` +
      `💰 Ganancias pendientes: $${pendingEarnings.rows?.[0]?.total?.toFixed(2) || '0.00'}`;

    const keyboard = Markup.inlineKeyboard([
      [
        model.is_online
          ? Markup.button.callback('⚪ Desconectarme', 'model_go_offline')
          : Markup.button.callback('🟢 Conectarme', 'model_go_online')
      ],
      [
        Markup.button.callback('📅 Mi Horario', 'model_schedule'),
        Markup.button.callback('🚫 Días Bloqueados', 'model_blocked_days')
      ],
      [
        Markup.button.callback('📋 Mis Reservas', 'model_bookings'),
        Markup.button.callback('💰 Mis Ganancias', 'model_earnings')
      ],
      [
        Markup.button.callback('✏️ Mi Mensaje', 'model_set_message'),
        Markup.button.callback('🔄 Actualizar', 'model_refresh')
      ]
    ]);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Go online
   */
  bot.action('model_go_online', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      await PNPLiveAvailabilityService.setModelOnlineStatus(
        model.id,
        true,
        ctx.from.id.toString(),
        'manual'
      );

      await ctx.answerCbQuery('🟢 ¡Estás online!');

      // Refresh dashboard
      const updatedModel = await getModelByTelegramId(ctx.from.id);
      await showModelDashboard(ctx, updatedModel);
    } catch (error) {
      logger.error('Error going online:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Go offline
   */
  bot.action('model_go_offline', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      await PNPLiveAvailabilityService.setModelOnlineStatus(
        model.id,
        false,
        ctx.from.id.toString(),
        'manual'
      );

      await ctx.answerCbQuery('⚪ Estás offline');

      // Refresh dashboard
      const updatedModel = await getModelByTelegramId(ctx.from.id);
      await showModelDashboard(ctx, updatedModel);
    } catch (error) {
      logger.error('Error going offline:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Refresh dashboard
   */
  bot.action('model_refresh', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      // Update activity
      await PNPLiveAvailabilityService.updateModelActivity(model.id);

      await ctx.answerCbQuery('🔄 Actualizado');
      await showModelDashboard(ctx, model);
    } catch (error) {
      logger.error('Error refreshing dashboard:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show schedule management
   */
  bot.action('model_schedule', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      const schedules = await PNPLiveAvailabilityService.getModelSchedule(model.id);

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const validDays = [4, 5, 6, 0, 1]; // Thu-Mon

      let scheduleText = '📅 *Tu Horario Semanal*\n\n';

      if (schedules.length === 0) {
        scheduleText += '⚠️ No tienes horario configurado.\n\n';
        scheduleText += 'Días disponibles: Jueves a Lunes\n';
        scheduleText += 'Horario operativo: 10:00 - 22:00';
      } else {
        for (const day of validDays) {
          const daySchedules = schedules.filter(s => s.day_of_week === day);
          scheduleText += `*${dayNames[day]}:* `;

          if (daySchedules.length > 0) {
            scheduleText += daySchedules.map(s =>
              `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`
            ).join(', ');
          } else {
            scheduleText += '❌ No disponible';
          }
          scheduleText += '\n';
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Agregar Horario', 'model_add_schedule')],
        [Markup.button.callback('🗑️ Limpiar Horario', 'model_clear_schedule')],
        [Markup.button.callback('📆 Generar Disponibilidad', 'model_generate_availability')],
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(scheduleText, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('Error showing schedule:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Add schedule - show day selection
   */
  bot.action('model_add_schedule', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      ctx.session = ctx.session || {};
      ctx.session.modelSchedule = { step: 'day', modelId: model.id };

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('Jueves', 'model_sched_day_4'),
          Markup.button.callback('Viernes', 'model_sched_day_5')
        ],
        [
          Markup.button.callback('Sábado', 'model_sched_day_6'),
          Markup.button.callback('Domingo', 'model_sched_day_0')
        ],
        [Markup.button.callback('Lunes', 'model_sched_day_1')],
        [Markup.button.callback('🔙 Cancelar', 'model_schedule')]
      ]);

      await ctx.editMessageText(
        '📅 *Agregar Horario*\n\nSelecciona el día:',
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error) {
      logger.error('Error in add schedule:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle day selection for schedule
   */
  bot.action(/^model_sched_day_(\d)$/, async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      const dayOfWeek = parseInt(ctx.match[1]);
      ctx.session = ctx.session || {};
      ctx.session.modelSchedule = {
        step: 'start_time',
        modelId: model.id,
        dayOfWeek
      };

      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

      // Generate time buttons (10:00 - 20:00 start times)
      const buttons = [];
      for (let hour = 10; hour <= 20; hour += 2) {
        buttons.push([
          Markup.button.callback(`${hour}:00`, `model_sched_start_${hour}_00`),
          Markup.button.callback(`${hour + 1}:00`, `model_sched_start_${hour + 1}_00`)
        ]);
      }
      buttons.push([Markup.button.callback('🔙 Cancelar', 'model_schedule')]);

      await ctx.editMessageText(
        `📅 *Agregar Horario - ${dayNames[dayOfWeek]}*\n\nSelecciona hora de inicio:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
      );
    } catch (error) {
      logger.error('Error selecting day:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle start time selection
   */
  bot.action(/^model_sched_start_(\d+)_(\d+)$/, async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model || !ctx.session?.modelSchedule) {
        return ctx.answerCbQuery('❌ Sesión expirada');
      }

      const hour = parseInt(ctx.match[1]);
      const minute = parseInt(ctx.match[2]);
      ctx.session.modelSchedule.startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      ctx.session.modelSchedule.step = 'end_time';

      // Generate end time buttons (start + 2 to 22:00)
      const buttons = [];
      for (let endHour = hour + 2; endHour <= 22; endHour += 2) {
        const row = [];
        row.push(Markup.button.callback(`${endHour}:00`, `model_sched_end_${endHour}_00`));
        if (endHour + 1 <= 22) {
          row.push(Markup.button.callback(`${endHour + 1}:00`, `model_sched_end_${endHour + 1}_00`));
        }
        buttons.push(row);
      }
      buttons.push([Markup.button.callback('🔙 Cancelar', 'model_schedule')]);

      await ctx.editMessageText(
        `📅 *Agregar Horario*\n\n` +
        `Inicio: ${ctx.session.modelSchedule.startTime}\n\n` +
        `Selecciona hora de fin:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
      );
    } catch (error) {
      logger.error('Error selecting start time:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle end time selection and save schedule
   */
  bot.action(/^model_sched_end_(\d+)_(\d+)$/, async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model || !ctx.session?.modelSchedule) {
        return ctx.answerCbQuery('❌ Sesión expirada');
      }

      const hour = parseInt(ctx.match[1]);
      const minute = parseInt(ctx.match[2]);
      const endTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      const { dayOfWeek, startTime } = ctx.session.modelSchedule;

      // Save schedule
      await query(
        `INSERT INTO pnp_model_schedules (model_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (model_id, day_of_week, start_time) DO UPDATE
         SET end_time = $4, updated_at = NOW()`,
        [model.id, dayOfWeek, startTime, endTime]
      );

      ctx.session.modelSchedule = null;

      await ctx.answerCbQuery('✅ Horario guardado');

      // Show schedule
      const schedules = await PNPLiveAvailabilityService.getModelSchedule(model.id);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const validDays = [4, 5, 6, 0, 1];

      let scheduleText = '📅 *Tu Horario Semanal*\n\n';
      for (const day of validDays) {
        const daySchedules = schedules.filter(s => s.day_of_week === day);
        scheduleText += `*${dayNames[day]}:* `;
        if (daySchedules.length > 0) {
          scheduleText += daySchedules.map(s =>
            `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`
          ).join(', ');
        } else {
          scheduleText += '❌ No disponible';
        }
        scheduleText += '\n';
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Agregar Horario', 'model_add_schedule')],
        [Markup.button.callback('🗑️ Limpiar Horario', 'model_clear_schedule')],
        [Markup.button.callback('📆 Generar Disponibilidad', 'model_generate_availability')],
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(scheduleText, { parse_mode: 'Markdown', ...keyboard });
    } catch (error) {
      logger.error('Error saving schedule:', error);
      await ctx.answerCbQuery('❌ Error guardando horario');
    }
  });

  /**
   * Clear all schedules
   */
  bot.action('model_clear_schedule', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      await query(
        `DELETE FROM pnp_model_schedules WHERE model_id = $1`,
        [model.id]
      );

      await ctx.answerCbQuery('✅ Horario limpiado');

      // Redirect to schedule view
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Agregar Horario', 'model_add_schedule')],
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(
        '📅 *Tu Horario Semanal*\n\n⚠️ No tienes horario configurado.',
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error) {
      logger.error('Error clearing schedule:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Generate availability from schedule
   */
  bot.action('model_generate_availability', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14); // 2 weeks

      const count = await PNPLiveAvailabilityService.generateRecurringAvailability(
        model.id,
        startDate,
        endDate
      );

      await ctx.answerCbQuery(`✅ ${count} slots generados`);

      // Go back to schedule
      const schedules = await PNPLiveAvailabilityService.getModelSchedule(model.id);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const validDays = [4, 5, 6, 0, 1];

      let scheduleText = '📅 *Tu Horario Semanal*\n\n';
      for (const day of validDays) {
        const daySchedules = schedules.filter(s => s.day_of_week === day);
        scheduleText += `*${dayNames[day]}:* `;
        if (daySchedules.length > 0) {
          scheduleText += daySchedules.map(s =>
            `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`
          ).join(', ');
        } else {
          scheduleText += '❌ No disponible';
        }
        scheduleText += '\n';
      }

      scheduleText += `\n✅ *${count} slots* generados para las próximas 2 semanas`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Agregar Horario', 'model_add_schedule')],
        [Markup.button.callback('🗑️ Limpiar Horario', 'model_clear_schedule')],
        [Markup.button.callback('📆 Generar Disponibilidad', 'model_generate_availability')],
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(scheduleText, { parse_mode: 'Markdown', ...keyboard });
    } catch (error) {
      logger.error('Error generating availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show blocked days management
   */
  bot.action('model_blocked_days', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const blockedDates = await PNPLiveAvailabilityService.getBlockedDates(
        model.id,
        startDate,
        endDate
      );

      let message = '🚫 *Días Bloqueados*\n\n';

      if (blockedDates.length === 0) {
        message += 'No tienes días bloqueados.\n\n';
      } else {
        for (const blocked of blockedDates) {
          const date = new Date(blocked.blocked_date);
          message += `📅 ${date.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' })}`;
          if (blocked.reason) {
            message += ` - ${blocked.reason}`;
          }
          message += '\n';
        }
        message += '\n';
      }

      message += 'Usa /bloquear DD/MM para bloquear un día\n';
      message += 'Usa /desbloquear DD/MM para desbloquear';

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (error) {
      logger.error('Error showing blocked days:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Block date command
   */
  bot.command('bloquear', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.reply('❌ No eres modelo registrada');
      }

      const args = ctx.message.text.split(' ').slice(1).join(' ');
      if (!args) {
        return ctx.reply('Uso: /bloquear DD/MM [motivo]\nEjemplo: /bloquear 25/12 Navidad');
      }

      const parts = args.split(' ');
      const datePart = parts[0];
      const reason = parts.slice(1).join(' ') || null;

      const [day, month] = datePart.split('/').map(Number);
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);

      if (isNaN(date.getTime())) {
        return ctx.reply('❌ Fecha inválida. Usa formato DD/MM');
      }

      await PNPLiveAvailabilityService.addBlockedDate(model.id, date, reason);
      await ctx.reply(`✅ Día ${datePart} bloqueado${reason ? `: ${reason}` : ''}`);
    } catch (error) {
      logger.error('Error blocking date:', error);
      await ctx.reply('❌ Error al bloquear fecha');
    }
  });

  /**
   * Unblock date command
   */
  bot.command('desbloquear', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.reply('❌ No eres modelo registrada');
      }

      const datePart = ctx.message.text.split(' ')[1];
      if (!datePart) {
        return ctx.reply('Uso: /desbloquear DD/MM\nEjemplo: /desbloquear 25/12');
      }

      const [day, month] = datePart.split('/').map(Number);
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);

      if (isNaN(date.getTime())) {
        return ctx.reply('❌ Fecha inválida. Usa formato DD/MM');
      }

      await PNPLiveAvailabilityService.removeBlockedDate(model.id, date);
      await ctx.reply(`✅ Día ${datePart} desbloqueado`);
    } catch (error) {
      logger.error('Error unblocking date:', error);
      await ctx.reply('❌ Error al desbloquear fecha');
    }
  });

  /**
   * Show model bookings
   */
  bot.action('model_bookings', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      const bookings = await query(
        `SELECT b.*, u.username as user_username
         FROM pnp_bookings b
         LEFT JOIN users u ON b.user_id = u.telegram_id::text
         WHERE b.model_id = $1
         AND b.booking_time >= NOW()
         AND b.status NOT IN ('cancelled', 'refunded')
         ORDER BY b.booking_time
         LIMIT 10`,
        [model.id]
      );

      let message = '📋 *Próximas Reservas*\n\n';

      if (bookings.rows?.length === 0) {
        message += 'No tienes reservas próximas.';
      } else {
        for (const booking of bookings.rows) {
          const date = new Date(booking.booking_time);
          const statusEmoji = booking.payment_status === 'paid' ? '✅' : '⏳';
          message += `${statusEmoji} *${date.toLocaleDateString('es-ES', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}*\n`;
          message += `   ${booking.duration_minutes} min - $${booking.model_earnings?.toFixed(2) || '0.00'}\n`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (error) {
      logger.error('Error showing bookings:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show model earnings
   */
  bot.action('model_earnings', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      // Get earnings summary
      const summary = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN model_earnings ELSE 0 END), 0) as pending,
           COALESCE(SUM(CASE WHEN payout_status = 'completed' THEN model_earnings ELSE 0 END), 0) as paid,
           COALESCE(SUM(model_earnings), 0) as total,
           COUNT(*) as total_bookings
         FROM pnp_model_earnings
         WHERE model_id = $1`,
        [model.id]
      );

      // Get recent earnings
      const recent = await query(
        `SELECT * FROM pnp_model_earnings
         WHERE model_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [model.id]
      );

      const stats = summary.rows?.[0] || {};

      let message = '💰 *Mis Ganancias*\n\n';
      message += `💵 *Total ganado:* $${parseFloat(stats.total || 0).toFixed(2)}\n`;
      message += `⏳ *Pendiente de pago:* $${parseFloat(stats.pending || 0).toFixed(2)}\n`;
      message += `✅ *Ya pagado:* $${parseFloat(stats.paid || 0).toFixed(2)}\n`;
      message += `📹 *Total shows:* ${stats.total_bookings || 0}\n\n`;

      if (recent.rows?.length > 0) {
        message += '*Últimas ganancias:*\n';
        for (const earning of recent.rows) {
          const date = new Date(earning.created_at);
          const type = earning.earning_type === 'tip' ? '💝' : '📹';
          message += `${type} ${date.toLocaleDateString('es-ES')} - $${parseFloat(earning.model_earnings).toFixed(2)}\n`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Volver', 'model_refresh')]
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (error) {
      logger.error('Error showing earnings:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Set status message
   */
  bot.action('model_set_message', async (ctx) => {
    try {
      const model = await getModelByTelegramId(ctx.from.id);
      if (!model) {
        return ctx.answerCbQuery('❌ No autorizado');
      }

      ctx.session = ctx.session || {};
      ctx.session.waitingForStatusMessage = model.id;

      await ctx.editMessageText(
        '✏️ *Establecer Mensaje de Estado*\n\n' +
        'Escribe tu mensaje (máx 200 caracteres).\n' +
        'Este mensaje se mostrará a los usuarios.\n\n' +
        `Mensaje actual: ${model.status_message || 'Ninguno'}\n\n` +
        'Escribe /cancelar para cancelar.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error setting up message input:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle status message text input
   */
  bot.on('text', async (ctx, next) => {
    if (!ctx.session?.waitingForStatusMessage) {
      return next();
    }

    try {
      const modelId = ctx.session.waitingForStatusMessage;
      const message = ctx.message.text;

      if (message === '/cancelar') {
        ctx.session.waitingForStatusMessage = null;
        return ctx.reply('❌ Cancelado. Usa /modelo para volver al panel.');
      }

      await PNPLiveAvailabilityService.setModelStatusMessage(modelId, message);

      ctx.session.waitingForStatusMessage = null;

      await ctx.reply(`✅ Mensaje actualizado: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n\nUsa /modelo para volver al panel.`);
    } catch (error) {
      logger.error('Error saving status message:', error);
      await ctx.reply('❌ Error al guardar mensaje');
    }
  });

  logger.info('PNP Live Model handlers registered');
};

module.exports = registerPNPLiveModelHandlers;
