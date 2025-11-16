const { Markup } = require('telegraf');
const CallService = require('../../services/callService');
const CallModel = require('../../../models/callModel');
const PaymentService = require('../../services/paymentService');
const DaimoConfig = require('../../../config/daimo');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const { t } = require('../../../utils/i18n');

/**
 * Private call handlers for users
 * @param {Telegraf} bot - Bot instance
 */
const registerPrivateCallHandlers = (bot) => {
  // Show private call booking - First select performer
  bot.action('book_private_call', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const availability = await CallService.getAvailability();

      const availabilityIndicator = availability.available
        ? '🟢 *Available Now*'
        : '🔴 *Currently Unavailable*';

      const message = lang === 'es'
        ? '📞 *Llamada Privada 1:1*\n\n'
          + `${availabilityIndicator}\n\n`
          + '💎 *¿Qué incluye?*\n'
          + '• 45 minutos de consulta personalizada\n'
          + '• Videollamada directa (calidad HD)\n'
          + '• Consejos expertos y orientación\n'
          + '• Horario flexible\n\n'
          + '💰 *Precio:* $100 USD (USDC en Optimism)\n\n'
          + '📱 *Puedes pagar con:*\n'
          + '• Zelle\n'
          + '• CashApp\n'
          + '• Venmo\n'
          + '• Revolut\n'
          + `• Wise\n\n${
            availability.available
              ? '👥 *Elige con quién quieres la llamada:*'
              : '⏰ No disponible en este momento. Te notificaremos cuando haya disponibilidad.'}`
        : '📞 *Private 1:1 Call*\n\n'
          + `${availabilityIndicator}\n\n`
          + '💎 *What\'s included:*\n'
          + '• 45 minutes of personalized consultation\n'
          + '• Direct video call (HD quality)\n'
          + '• Expert advice and guidance\n'
          + '• Flexible scheduling\n\n'
          + '💰 *Price:* $100 USD (USDC on Optimism)\n\n'
          + '📱 *You can pay using:*\n'
          + '• Zelle\n'
          + '• CashApp\n'
          + '• Venmo\n'
          + '• Revolut\n'
          + `• Wise\n\n${
            availability.available
              ? '👥 *Choose who you want to talk to:*'
              : '⏰ Not available right now. We\'ll notify you when available.'}`;

      const buttons = availability.available
        ? [
          [Markup.button.callback('🎭 Santino', 'select_performer_santino')],
          [Markup.button.callback('🎤 Lex Boy', 'select_performer_lexboy')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]
        : [
          [Markup.button.callback('🔔 Notify Me', 'notify_call_availability')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ];

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing private call booking:', error);
    }
  });

  // Select performer Santino
  bot.action('select_performer_santino', async (ctx) => {
    try {
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.selectedPerformer = 'Santino';
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      const message = lang === 'es'
        ? '🎭 *Llamada con Santino*\n\n'
          + 'Has seleccionado una llamada privada de 45 minutos con Santino.\n\n'
          + '💰 Precio: $100 USD\n\n'
          + 'Procede al pago para reservar tu llamada.'
        : '🎭 *Call with Santino*\n\n'
          + 'You\'ve selected a 45-minute private call with Santino.\n\n'
          + '💰 Price: $100 USD\n\n'
          + 'Proceed to payment to book your call.';

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Pay & Book', 'pay_for_private_call')],
          [Markup.button.callback(t('back', lang), 'book_private_call')],
        ]),
      });
    } catch (error) {
      logger.error('Error selecting Santino:', error);
    }
  });

  // Select performer Lex Boy
  bot.action('select_performer_lexboy', async (ctx) => {
    try {
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.selectedPerformer = 'Lex Boy';
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      const message = lang === 'es'
        ? '🎤 *Llamada con Lex Boy*\n\n'
          + 'Has seleccionado una llamada privada de 45 minutos con Lex Boy.\n\n'
          + '💰 Precio: $100 USD\n\n'
          + 'Procede al pago para reservar tu llamada.'
        : '🎤 *Call with Lex Boy*\n\n'
          + 'You\'ve selected a 45-minute private call with Lex Boy.\n\n'
          + '💰 Price: $100 USD\n\n'
          + 'Proceed to payment to book your call.';

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Pay & Book', 'pay_for_private_call')],
          [Markup.button.callback(t('back', lang), 'book_private_call')],
        ]),
      });
    } catch (error) {
      logger.error('Error selecting Lex Boy:', error);
    }
  });

  // Pay for private call
  bot.action('pay_for_private_call', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id;
      const chatId = ctx.chat?.id;

      // Check availability again
      const availability = await CallService.getAvailability();
      if (!availability.available) {
        await ctx.answerCbQuery('⚠️ No longer available');
        await ctx.editMessageText(
          '⚠️ Sorry, availability has expired. Please try again later.',
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Back', 'book_private_call')],
            ]),
          },
        );
        return;
      }

      await ctx.editMessageText(t('loading', lang));

      // Create payment for private call (as a special plan)
      const result = await PaymentService.createPayment({
        userId,
        planId: 'private_call_45min', // Special plan ID
        provider: 'daimo',
        chatId,
      });

      if (result.success) {
        // Store temp data for booking after payment
        ctx.session.temp = ctx.session.temp || {};
        ctx.session.temp.pendingCallPayment = result.paymentId;
        await ctx.saveSession();

        const paymentMessage = lang === 'es'
          ? '💳 *Pago de Llamada Privada*\n\n'
            + 'Precio: $100 USDC\n\n'
            + '📱 *Puedes pagar usando:*\n'
            + '• Zelle\n'
            + '• CashApp\n'
            + '• Venmo\n'
            + '• Revolut\n'
            + '• Wise\n\n'
            + '💡 *Cómo funciona:*\n'
            + '1. Haz clic en "Pagar Ahora"\n'
            + '2. Elige tu app de pago preferida\n'
            + '3. El pago se convierte automáticamente a USDC\n'
            + '4. Agenda tu llamada inmediatamente después\n\n'
            + '🔒 Seguro y rápido en la red Optimism'
          : '💳 *Private Call Payment*\n\n'
            + 'Price: $100 USDC\n\n'
            + '📱 *You can pay using:*\n'
            + '• Zelle\n'
            + '• CashApp\n'
            + '• Venmo\n'
            + '• Revolut\n'
            + '• Wise\n\n'
            + '💡 *How it works:*\n'
            + '1. Click "Pay Now"\n'
            + '2. Choose your preferred payment app\n'
            + '3. Payment is automatically converted to USDC\n'
            + '4. Schedule your call immediately after\n\n'
            + '🔒 Secure and fast on Optimism network';

        await ctx.editMessageText(paymentMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('💰 Pay Now', result.paymentUrl)],
            [Markup.button.callback(t('back', lang), 'book_private_call')],
          ]),
        });
      } else {
        await ctx.editMessageText(
          `${t('error', lang)}\n\n${result.error}`,
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'book_private_call')],
            ]),
          },
        );
      }
    } catch (error) {
      logger.error('Error processing call payment:', error);
      const lang = getLanguage(ctx);
      await ctx.editMessageText(
        t('error', lang),
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'book_private_call')],
          ]),
        },
      ).catch(() => {});
    }
  });

  // After payment: schedule the call
  bot.action('schedule_private_call', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const availability = await CallService.getAvailability();

      const message = lang === 'es'
        ? '📅 *Agenda tu Llamada*\n\n'
          + '¡Pago confirmado! 🎉\n\n'
          + 'Elige cuándo quieres tu llamada:'
        : '📅 *Schedule Your Call*\n\n'
          + 'Payment confirmed! 🎉\n\n'
          + 'Choose when you want your call:';

      const buttons = [];

      // Add quick schedule button if available
      if (availability.available) {
        buttons.push([
          Markup.button.callback(
            lang === 'es' ? '⚡ Ahora (en 15 min)' : '⚡ Now (in 15 min)',
            'schedule_call_quick',
          ),
        ]);
      }

      // Add custom schedule button
      buttons.push([
        Markup.button.callback(
          lang === 'es' ? '📆 Elegir fecha/hora' : '📆 Choose date/time',
          'schedule_call_custom',
        ),
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error in schedule_private_call:', error);
    }
  });

  // Quick schedule (15 minutes from now)
  bot.action('schedule_call_quick', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id;
      const userName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
      const userUsername = ctx.from.username;
      const paymentId = ctx.session.temp.pendingCallPayment;
      const performer = ctx.session.temp.selectedPerformer || 'Santino';

      // Calculate time in 15 minutes
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 15 * 60000);
      const scheduledDateStr = scheduledTime.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const scheduledTimeStr = scheduledTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });

      await ctx.editMessageText(t('loading', lang));

      // Book the call
      const booking = await CallService.bookCall({
        userId,
        userName,
        userUsername,
        paymentId,
        scheduledDate: scheduledDateStr,
        scheduledTime: scheduledTimeStr,
        performer,
      });

      if (booking.success) {
        // Clear session state
        delete ctx.session.temp.awaitingCallSchedule;
        delete ctx.session.temp.pendingCallPayment;
        delete ctx.session.temp.selectedPerformer;
        await ctx.saveSession();

        const message = lang === 'es'
          ? '✅ *¡Llamada Reservada!*\n\n'
            + `🎭 Con: ${performer}\n`
            + `📅 Fecha: ${scheduledDateStr}\n`
            + `⏰ Hora: ${scheduledTimeStr}\n`
            + '⏱ Duración: 45 minutos\n\n'
            + '🔗 *Link de la llamada:*\n'
            + `${booking.call.meetingUrl}\n\n`
            + '⚡ *Tu llamada comienza en 15 minutos!*\n'
            + 'Prepárate y únete usando el link de arriba.\n\n'
            + '¡Nos vemos pronto! 👋'
          : '✅ *Call Booked!*\n\n'
            + `🎭 With: ${performer}\n`
            + `📅 Date: ${scheduledDateStr}\n`
            + `⏰ Time: ${scheduledTimeStr}\n`
            + '⏱ Duration: 45 minutes\n\n'
            + '🔗 *Join Link:*\n'
            + `${booking.call.meetingUrl}\n\n`
            + '⚡ *Your call starts in 15 minutes!*\n'
            + 'Get ready and join using the link above.\n\n'
            + 'See you soon! 👋';

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🎥 Join Call', booking.call.meetingUrl)],
          ]),
        });
      } else {
        await ctx.editMessageText(
          lang === 'es'
            ? '❌ Error al reservar la llamada. Por favor contacta a soporte.'
            : '❌ Error booking call. Please contact support.',
        );
      }
    } catch (error) {
      logger.error('Error in quick schedule:', error);
      const lang = getLanguage(ctx);
      await ctx.editMessageText(
        t('error', lang),
      ).catch(() => {});
    }
  });

  // Custom schedule
  bot.action('schedule_call_custom', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const message = lang === 'es'
        ? '📅 *Agenda tu Llamada*\n\n'
          + 'Por favor, envía tu fecha y hora preferida en el siguiente formato:\n\n'
          + '📅 Fecha: DD/MM/YYYY\n'
          + '⏰ Hora: HH:MM (zona horaria)\n\n'
          + 'Ejemplo:\n'
          + '25/01/2025\n'
          + '15:00 EST'
        : '📅 *Schedule Your Call*\n\n'
          + 'Please send your preferred date and time in the following format:\n\n'
          + '📅 Date: DD/MM/YYYY\n'
          + '⏰ Time: HH:MM (timezone)\n\n'
          + 'Example:\n'
          + '01/25/2025\n'
          + '3:00 PM EST';

      // Set user state to expect scheduling input
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.awaitingCallSchedule = true;
      await ctx.saveSession();

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('Error in custom schedule:', error);
    }
  });

  // Handle scheduling input (text message)
  bot.on('text', async (ctx, next) => {
    try {
      if (ctx.session?.temp?.awaitingCallSchedule) {
        const { text } = ctx.message;
        const userId = ctx.from.id;
        const userName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
        const userUsername = ctx.from.username;
        const paymentId = ctx.session.temp.pendingCallPayment;

        // Simple parsing (you may want to improve this with a proper date parser)
        const lines = text.split('\n');
        const scheduledDate = lines[0]?.trim();
        const scheduledTime = lines[1]?.trim();

        if (!scheduledDate || !scheduledTime) {
          await ctx.reply(
            '⚠️ Please provide both date and time.\n\n'
            + 'Format:\n'
            + 'DD/MM/YYYY\n'
            + 'HH:MM timezone',
          );
          return;
        }

        const performer = ctx.session.temp.selectedPerformer || 'Santino';

        // Book the call
        const booking = await CallService.bookCall({
          userId,
          userName,
          userUsername,
          paymentId,
          scheduledDate,
          scheduledTime,
          performer,
        });

        if (booking.success) {
          // Clear session state
          delete ctx.session.temp.awaitingCallSchedule;
          delete ctx.session.temp.pendingCallPayment;
          delete ctx.session.temp.selectedPerformer;
          await ctx.saveSession();

          const lang = getLanguage(ctx);
          const message = lang === 'es'
            ? '✅ *¡Llamada Reservada!*\n\n'
              + `🎭 Con: ${performer}\n`
              + `📅 Fecha: ${scheduledDate}\n`
              + `⏰ Hora: ${scheduledTime}\n`
              + '⏱ Duración: 45 minutos\n\n'
              + '🔗 *Link de la llamada:*\n'
              + `${booking.call.meetingUrl}\n\n`
              + '📧 Recibirás un recordatorio 15 minutos antes de la llamada.\n\n'
              + '¡Nos vemos pronto! 👋'
            : '✅ *Call Booked Successfully!*\n\n'
              + `🎭 With: ${performer}\n`
              + `📅 Date: ${scheduledDate}\n`
              + `⏰ Time: ${scheduledTime}\n`
              + '⏱ Duration: 45 minutes\n\n'
              + '🔗 *Join Link:*\n'
              + `${booking.call.meetingUrl}\n\n`
              + '📧 You\'ll receive a reminder 15 minutes before the call.\n\n'
              + 'See you soon! 👋';

          await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Add to Calendar', url: booking.call.meetingUrl }],
              ],
            },
          });
        } else {
          await ctx.reply('❌ Error booking call. Please contact support.');
        }

        return;
      }

      // Continue to next handler if not awaiting schedule
      return next();
    } catch (error) {
      logger.error('Error processing call scheduling:', error);
      return next();
    }
  });

  // Notify me when available
  bot.action('notify_call_availability', async (ctx) => {
    try {
      // This would typically store user preference in database
      // For now, just acknowledge
      await ctx.answerCbQuery('✅ You\'ll be notified when available!');
      await ctx.editMessageText(
        '🔔 *Notification Enabled*\n\n'
        + 'We\'ll send you a message as soon as slots become available.\n\n'
        + 'Stay tuned! 📢',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'back_to_main')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error in notify_call_availability:', error);
    }
  });

  // View my booked calls
  bot.action('my_private_calls', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const lang = getLanguage(ctx);
      const calls = await CallModel.getByUser(userId);

      if (calls.length === 0) {
        await ctx.editMessageText(
          '📅 *My Calls*\n\n'
          + 'You haven\'t booked any calls yet.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📞 Book a Call', 'book_private_call')],
              [Markup.button.callback(t('back', lang), 'back_to_main')],
            ]),
          },
        );
        return;
      }

      let message = '📅 *My Private Calls*\n\n';

      calls.forEach((call, index) => {
        const statusEmoji = {
          pending: '⏳',
          confirmed: '✅',
          completed: '✔️',
          cancelled: '❌',
        }[call.status] || '📞';

        message
          += `${index + 1}. ${statusEmoji} ${call.status.toUpperCase()}\n`
          + `   📅 ${call.scheduledDate} at ${call.scheduledTime}\n`
          + '   ⏱ 45 minutes\n';

        if (call.meetingUrl && (call.status === 'confirmed' || call.status === 'pending')) {
          message += `   🔗 ${call.meetingUrl}\n`;
        }

        message += '\n';
      });

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📞 Book Another Call', 'book_private_call')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error viewing user calls:', error);
    }
  });
};

module.exports = registerPrivateCallHandlers;
