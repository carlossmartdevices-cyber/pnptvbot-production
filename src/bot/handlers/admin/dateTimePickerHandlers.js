/**
 * Date/Time Picker Handlers
 * Handles all interactions with the visual date/time picker
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const PermissionService = require('../../services/permissionService');
const dateTimePicker = require('../../utils/dateTimePicker');

/**
 * Register date/time picker handlers for broadcast scheduling
 * @param {Telegraf} bot - Bot instance
 */
const registerDateTimePickerHandlers = (bot) => {
  const PREFIX = 'bcast_sched'; // Prefix for all scheduling callbacks

  // ==========================================
  // SHOW INITIAL SCHEDULING MENU
  // ==========================================

  /**
   * Show the scheduling menu with quick presets and calendar option
   * Called after selecting "schedule for later" in broadcast flow
   */
  bot.action('broadcast_show_datetime_picker', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      // Initialize scheduling session
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.schedulingStep = 'selecting_datetime';
      await ctx.saveSession();

      const { text, keyboard } = dateTimePicker.getSchedulingMenu(lang, PREFIX);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error showing datetime picker:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ==========================================
  // QUICK PRESETS
  // ==========================================

  // Handle preset selection (0-5)
  for (let i = 0; i < 6; i++) {
    bot.action(`${PREFIX}_preset_${i}`, async (ctx) => {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) {
          await ctx.answerCbQuery('❌ No autorizado');
          return;
        }

        await ctx.answerCbQuery();
        const lang = ctx.session?.language || 'es';

        // Calculate the date from preset
        const scheduledDate = dateTimePicker.calculatePresetDate(i);

        if (!scheduledDate) {
          await ctx.answerCbQuery(lang === 'es' ? '❌ Error con la fecha' : '❌ Date error');
          return;
        }

        // Store in session
        if (!ctx.session.temp) ctx.session.temp = {};
        ctx.session.temp.scheduledDate = scheduledDate.toISOString();
        ctx.session.temp.schedulingStep = 'confirming';
        await ctx.saveSession();

        // Show timezone selection before confirmation
        await showTimezoneSelection(ctx, lang);
      } catch (error) {
        logger.error('Error handling preset:', error);
        await ctx.answerCbQuery('❌ Error').catch(() => {});
      }
    });
  }

  // ==========================================
  // CALENDAR NAVIGATION
  // ==========================================

  /**
   * Open calendar view
   */
  bot.action(`${PREFIX}_open_calendar`, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      const now = new Date();
      const { text, keyboard } = dateTimePicker.getCalendarView(
        now.getFullYear(),
        now.getMonth(),
        lang,
        PREFIX
      );

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error opening calendar:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  /**
   * Navigate to different month
   */
  bot.action(new RegExp(`^${PREFIX}_month_(\\d{4})_(-?\\d+)$`), async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      const parsed = dateTimePicker.parseMonthCallback(ctx.match[0]);
      if (!parsed) return;

      let { year, month } = parsed;

      // Normalize month
      while (month < 0) {
        month += 12;
        year--;
      }
      while (month > 11) {
        month -= 12;
        year++;
      }

      // Don't allow going to past months
      const now = new Date();
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())) {
        return;
      }

      const { text, keyboard } = dateTimePicker.getCalendarView(year, month, lang, PREFIX);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error navigating month:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  /**
   * Handle date selection from calendar
   */
  bot.action(new RegExp(`^${PREFIX}_date_(\\d{4})_(\\d+)_(\\d+)$`), async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      const parsed = dateTimePicker.parseDateCallback(ctx.match[0]);
      if (!parsed) return;

      const { year, month, day } = parsed;

      // Store selected date
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.selectedYear = year;
      ctx.session.temp.selectedMonth = month;
      ctx.session.temp.selectedDay = day;
      ctx.session.temp.schedulingStep = 'selecting_time';
      await ctx.saveSession();

      // Show time selection
      const { text, keyboard } = dateTimePicker.getTimeSelectionView(year, month, day, lang, PREFIX);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error selecting date:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ==========================================
  // TIME SELECTION
  // ==========================================

  /**
   * Handle time slot selection
   */
  bot.action(new RegExp(`^${PREFIX}_time_(\\d{4})-(\\d{2})-(\\d{2})_(\\d{2})_(\\d{2})$`), async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      const parsed = dateTimePicker.parseTimeCallback(ctx.match[0]);
      if (!parsed) return;

      const { year, month, day, hour, minute } = parsed;

      // Create the scheduled date
      const scheduledDate = new Date(year, month, day, hour, minute);

      // Validate it's in the future
      if (scheduledDate <= new Date()) {
        const msg = lang === 'es'
          ? '❌ La hora seleccionada ya pasó'
          : '❌ Selected time has already passed';
        await ctx.answerCbQuery(msg, { show_alert: true });
        return;
      }

      // Store in session
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.scheduledDate = scheduledDate.toISOString();
      ctx.session.temp.schedulingStep = 'selecting_timezone';
      await ctx.saveSession();

      // Show timezone selection
      await showTimezoneSelection(ctx, lang);
    } catch (error) {
      logger.error('Error selecting time:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  /**
   * Handle custom time input request
   */
  bot.action(new RegExp(`^${PREFIX}_custom_time_(\\d{4})-(\\d{2})-(\\d{2})$`), async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      // Extract date from callback
      const match = ctx.match[0].match(/custom_time_(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return;

      const [, year, month, day] = match;

      // Store date and set step for text input
      if (!ctx.session.temp) ctx.session.temp = {};
      ctx.session.temp.selectedYear = parseInt(year);
      ctx.session.temp.selectedMonth = parseInt(month) - 1;
      ctx.session.temp.selectedDay = parseInt(day);
      ctx.session.temp.schedulingStep = 'custom_time_input';
      await ctx.saveSession();

      const monthName = dateTimePicker.MONTHS_FULL[lang][parseInt(month) - 1];
      const formattedDate = `${day} ${monthName} ${year}`;

      const text = lang === 'es'
        ? `⌨️ *Hora Personalizada*\n\n` +
          `📅 Fecha: *${formattedDate}*\n\n` +
          `Escribe la hora en formato HH:MM (24 horas)\n\n` +
          `*Ejemplos:*\n` +
          `• \`09:30\` - 9:30 AM\n` +
          `• \`14:45\` - 2:45 PM\n` +
          `• \`20:00\` - 8:00 PM`
        : `⌨️ *Custom Time*\n\n` +
          `📅 Date: *${formattedDate}*\n\n` +
          `Type the time in HH:MM format (24-hour)\n\n` +
          `*Examples:*\n` +
          `• \`09:30\` - 9:30 AM\n` +
          `• \`14:45\` - 2:45 PM\n` +
          `• \`20:00\` - 8:00 PM`;

      const backLabel = lang === 'es' ? '◀️ Volver' : '◀️ Back';

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(backLabel, `${PREFIX}_date_${year}_${parseInt(month) - 1}_${day}`)],
        ]),
      });
    } catch (error) {
      logger.error('Error requesting custom time:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ==========================================
  // TIMEZONE SELECTION
  // ==========================================

  async function showTimezoneSelection(ctx, lang) {
    const text = lang === 'es'
      ? `🌍 *Zona Horaria*\n\n` +
        `Selecciona tu zona horaria:\n\n` +
        `⏰ La programación será en esta zona`
      : `🌍 *Timezone*\n\n` +
        `Select your timezone:\n\n` +
        `⏰ Scheduling will be in this timezone`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🌎 New York (EST)', `${PREFIX}_tz_America/New_York`)],
        [Markup.button.callback('🌎 Los Angeles (PST)', `${PREFIX}_tz_America/Los_Angeles`)],
        [Markup.button.callback('🌎 Mexico City (CST)', `${PREFIX}_tz_America/Mexico_City`)],
        [Markup.button.callback('🌎 Bogotá (COT)', `${PREFIX}_tz_America/Bogota`)],
        [Markup.button.callback('🌍 Madrid (CET)', `${PREFIX}_tz_Europe/Madrid`)],
        [Markup.button.callback('🌍 London (GMT)', `${PREFIX}_tz_Europe/London`)],
        [Markup.button.callback('🌏 UTC', `${PREFIX}_tz_UTC`)],
        [Markup.button.callback(lang === 'es' ? '◀️ Volver' : '◀️ Back', `${PREFIX}_back_to_presets`)],
      ]),
    });
  }

  /**
   * Handle timezone selection
   */
  const timezones = [
    'America/New_York',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/Bogota',
    'Europe/Madrid',
    'Europe/London',
    'UTC',
  ];

  for (const tz of timezones) {
    bot.action(`${PREFIX}_tz_${tz}`, async (ctx) => {
      try {
        const isAdmin = await PermissionService.isAdmin(ctx.from.id);
        if (!isAdmin) {
          await ctx.answerCbQuery('❌ No autorizado');
          return;
        }

        await ctx.answerCbQuery();
        const lang = ctx.session?.language || 'es';

        // Store timezone
        if (!ctx.session.temp) ctx.session.temp = {};
        ctx.session.temp.timezone = tz;
        ctx.session.temp.schedulingStep = 'confirming';
        await ctx.saveSession();

        // Show confirmation
        const scheduledDate = new Date(ctx.session.temp.scheduledDate);
        const { text, keyboard } = dateTimePicker.getConfirmationView(scheduledDate, tz, lang, PREFIX);

        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } catch (error) {
        logger.error('Error selecting timezone:', error);
        await ctx.answerCbQuery('❌ Error').catch(() => {});
      }
    });
  }

  // ==========================================
  // CONFIRMATION
  // ==========================================

  /**
   * Confirm the scheduled date/time
   */
  bot.action(`${PREFIX}_confirm`, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      if (!ctx.session.temp?.scheduledDate || !ctx.session.temp?.timezone) {
        await ctx.answerCbQuery(lang === 'es' ? '❌ Sesión expirada' : '❌ Session expired', { show_alert: true });
        return;
      }

      const scheduledDate = new Date(ctx.session.temp.scheduledDate);
      const timezone = ctx.session.temp.timezone;

      // Store the final scheduled info for broadcast creation
      ctx.session.temp.confirmedSchedule = {
        date: scheduledDate,
        timezone: timezone,
        timestamp: scheduledDate.toISOString(),
      };
      ctx.session.temp.schedulingStep = 'confirmed';
      await ctx.saveSession();

      const formattedDate = dateTimePicker.formatDate(scheduledDate, lang);

      const text = lang === 'es'
        ? `✅ *Programación Confirmada*\n\n` +
          `📅 ${formattedDate}\n` +
          `🌍 ${timezone}\n\n` +
          `El broadcast será enviado en la fecha y hora programadas.`
        : `✅ *Schedule Confirmed*\n\n` +
          `📅 ${formattedDate}\n` +
          `🌍 ${timezone}\n\n` +
          `The broadcast will be sent at the scheduled date and time.`;

      const continueLabel = lang === 'es' ? '✅ Crear Broadcast' : '✅ Create Broadcast';

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(continueLabel, 'broadcast_create_scheduled')],
          [Markup.button.callback(lang === 'es' ? '✏️ Cambiar' : '✏️ Change', `${PREFIX}_back_to_presets`)],
        ]),
      });
    } catch (error) {
      logger.error('Error confirming schedule:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // ==========================================
  // NAVIGATION
  // ==========================================

  /**
   * Back to presets menu
   */
  bot.action(`${PREFIX}_back_to_presets`, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'es';

      const { text, keyboard } = dateTimePicker.getSchedulingMenu(lang, PREFIX);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error going back:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  /**
   * Ignore button (for disabled/header buttons)
   */
  bot.action(`${PREFIX}_ignore`, async (ctx) => {
    await ctx.answerCbQuery();
  });
};

module.exports = registerDateTimePickerHandlers;
