const { Markup } = require('telegraf');
const ModelService = require('../../services/modelService');
const MeetGreetService = require('../../services/meetGreetService');
const AvailabilityService = require('../../services/availabilityService');
const { getLanguage } = require('../../utils/helpers');
const logger = require('../../../utils/logger');

/**
 * Meet & Greet Handler - Main handler for Meet & Greet system
 */
const registerMeetGreetHandlers = (bot) => {
  // Start Meet & Greet flow
  bot.action('MEET_GREET_START', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      
      // Show model selection
      await showModelSelection(ctx, lang);
    } catch (error) {
      logger.error('Error starting Meet & Greet:', error);
      await ctx.answerCbQuery('❌ Error starting Meet & Greet');
    }
  });

  // Show model selection
  async function showModelSelection(ctx, lang) {
    try {
      const models = await ModelService.getAllActiveModels();
      
      if (models.length === 0) {
        const message = lang === 'es'
          ? `🔍 *No hay modelos disponibles*\n\nNo hay modelos disponibles en este momento. Por favor, intenta más tarde.`
          : `🔍 *No Models Available*\n\nNo models are available at this time. Please try again later.`;
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver al Menú' : '🔙 Back to Menu', 'back_to_main')]
          ])
        });
        return;
      }

      // Create model buttons (3 per row)
      const buttons = [];
      for (let i = 0; i < models.length; i += 3) {
        const row = [];
        for (let j = 0; j < 3 && i + j < models.length; j++) {
          const model = models[i + j];
          row.push(Markup.button.callback(
            `${model.name}`, 
            `select_model_${model.id}`
          ));
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'back_to_main')
      ]);

      const message = lang === 'es'
        ? `💃 *Selecciona un Modelo*\n\nElige un modelo para tu Video Llamada VIP:`
        : `💃 *Select a Model*\n\nChoose a model for your VIP Video Call:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing model selection:', error);
      await ctx.answerCbQuery('❌ Error loading models');
    }
  }

  // Handle model selection
  bot.action(/^select_model_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      
      // Store selected model in session
      ctx.session.meetGreet = ctx.session.meetGreet || {};
      ctx.session.meetGreet.selectedModel = modelId;
      await ctx.saveSession();
      
      // Show duration selection
      await showDurationSelection(ctx, lang, modelId);
    } catch (error) {
      logger.error('Error selecting model:', error);
      await ctx.answerCbQuery('❌ Error selecting model');
    }
  });

  // Show duration selection
  async function showDurationSelection(ctx, lang, modelId) {
    try {
      const model = await ModelService.getModelById(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      const buttons = [
        [Markup.button.callback('30 min - $60', 'select_duration_30')],
        [Markup.button.callback('60 min - $100', 'select_duration_60')],
        [Markup.button.callback('90 min - $250', 'select_duration_90')],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'MEET_GREET_START')]
      ];

      const message = lang === 'es'
        ? `🕒 *Selecciona la Duración*\n\nModelo: ${model.name}\n\nElige la duración para tu Video Llamada VIP:`
        : `🕒 *Select Duration*\n\nModel: ${model.name}\n\nChoose the duration for your VIP Video Call:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing duration selection:', error);
      await ctx.answerCbQuery('❌ Error loading duration options');
    }
  }

  // Handle duration selection
  bot.action(/^select_duration_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const duration = parseInt(ctx.match[1]);
      
      // Validate duration
      if (![30, 60, 90].includes(duration)) {
        throw new Error('Invalid duration');
      }
      
      // Store selected duration in session
      ctx.session.meetGreet = ctx.session.meetGreet || {};
      ctx.session.meetGreet.selectedDuration = duration;
      await ctx.saveSession();
      
      // Show date selection
      await showDateSelection(ctx, lang);
    } catch (error) {
      logger.error('Error selecting duration:', error);
      await ctx.answerCbQuery('❌ Error selecting duration');
    }
  });

  // Show date selection
  async function showDateSelection(ctx, lang) {
    try {
      const { selectedModel, selectedDuration } = ctx.session.meetGreet || {};
      if (!selectedModel || !selectedDuration) {
        throw new Error('Model or duration not selected');
      }

      const model = await ModelService.getModelById(selectedModel);
      if (!model) {
        throw new Error('Model not found');
      }

      // Get today's date and next 7 days
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        dates.push(date);
      }

      // Create date buttons
      const buttons = [];
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' });
        const dayMonth = date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' });
        
        buttons.push([
          Markup.button.callback(`${dayName} ${dayMonth}`, `select_date_${dateStr}`)
        ]);
      }

      // Add navigation
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `select_model_${selectedModel}`)
      ]);

      const price = MeetGreetService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const message = lang === 'es'
        ? `📅 *Selecciona una Fecha*\n\nModelo: ${model.name}\nDuración: ${durationText}\nPrecio: $${price}\n\nElige una fecha disponible:`
        : `📅 *Select a Date*\n\nModel: ${model.name}\nDuration: ${durationText}\nPrice: $${price}\n\nChoose an available date:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing date selection:', error);
      await ctx.answerCbQuery('❌ Error loading date options');
    }
  }

  // Handle date selection
  bot.action(/^select_date_(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const dateStr = ctx.match[1];
      
      // Store selected date in session
      ctx.session.meetGreet = ctx.session.meetGreet || {};
      ctx.session.meetGreet.selectedDate = dateStr;
      await ctx.saveSession();
      
      // Show time slot selection
      await showTimeSlotSelection(ctx, lang, dateStr);
    } catch (error) {
      logger.error('Error selecting date:', error);
      await ctx.answerCbQuery('❌ Error selecting date');
    }
  });

  // Show time slot selection
  async function showTimeSlotSelection(ctx, lang, dateStr) {
    try {
      const { selectedModel, selectedDuration } = ctx.session.meetGreet || {};
      if (!selectedModel || !selectedDuration) {
        throw new Error('Model or duration not selected');
      }

      const model = await ModelService.getModelById(selectedModel);
      if (!model) {
        throw new Error('Model not found');
      }

      // Get available slots for the selected date
      const date = new Date(dateStr);
      const slots = await MeetGreetService.getAvailableSlots(selectedModel, date, selectedDuration);

      if (slots.length === 0) {
        const message = lang === 'es'
          ? `⏰ *No hay horarios disponibles*\n\nNo hay horarios disponibles para esta fecha. Por favor, elige otra fecha.`
          : `⏰ *No Time Slots Available*\n\nNo time slots are available for this date. Please choose another date.`;
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `select_date_${dateStr}`)]
          ])
        });
        return;
      }

      // Create time slot buttons
      const buttons = [];
      for (const slot of slots) {
        const startTime = new Date(slot.available_from).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        const endTime = new Date(slot.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        buttons.push([
          Markup.button.callback(`${startTime} - ${endTime}`, `select_slot_${slot.id}`)
        ]);
      }

      // Add navigation
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `select_date_${dateStr}`)
      ]);

      const price = MeetGreetService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const message = lang === 'es'
        ? `⏰ *Selecciona un Horario*\n\nModelo: ${model.name}\nFecha: ${dateStr}\nDuración: ${durationText}\nPrecio: $${price}\n\nHorarios disponibles:`
        : `⏰ *Select a Time Slot*\n\nModel: ${model.name}\nDate: ${dateStr}\nDuration: ${durationText}\nPrice: $${price}\n\nAvailable time slots:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing time slot selection:', error);
      await ctx.answerCbQuery('❌ Error loading time slots');
    }
  }

  // Handle time slot selection
  bot.action(/^select_slot_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const slotId = parseInt(ctx.match[1]);
      
      // Store selected slot in session
      ctx.session.meetGreet = ctx.session.meetGreet || {};
      ctx.session.meetGreet.selectedSlot = slotId;
      await ctx.saveSession();
      
      // Show payment selection
      await showPaymentSelection(ctx, lang);
    } catch (error) {
      logger.error('Error selecting time slot:', error);
      await ctx.answerCbQuery('❌ Error selecting time slot');
    }
  });

  // Show payment selection
  async function showPaymentSelection(ctx, lang) {
    try {
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.meetGreet || {};
      if (!selectedModel || !selectedDuration || !selectedDate || !selectedSlot) {
        throw new Error('Booking details incomplete');
      }

      const model = await ModelService.getModelById(selectedModel);
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      if (!model || !slot) {
        throw new Error('Model or slot not found');
      }

      const price = MeetGreetService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const startTime = new Date(slot.available_from).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const buttons = [
        [Markup.button.callback(lang === 'es' ? '💳 Tarjeta de Crédito' : '💳 Credit Card', 'mg_pay_credit_card')],
        [Markup.button.callback('₿ Crypto (USDC)', 'mg_pay_crypto')],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `select_date_${selectedDate}`)]
      ];

      const message = lang === 'es'
        ? `💰 *Selecciona Método de Pago*\n\n📞 Video Llamada VIP\nModelo: ${model.name}\nFecha: ${selectedDate}\nHora: ${startTime}\nDuración: ${durationText}\nPrecio: $${price}\n\nSelecciona tu método de pago:`
        : `💰 *Select Payment Method*\n\n📞 VIP Video Call\nModel: ${model.name}\nDate: ${selectedDate}\nTime: ${startTime}\nDuration: ${durationText}\nPrice: $${price}\n\nSelect your payment method:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing payment selection:', error);
      await ctx.answerCbQuery('❌ Error loading payment options');
    }
  }

  // Handle payment selection - Credit Card (ePayco)
  bot.action('mg_pay_credit_card', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);

      // Create booking
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.meetGreet || {};
      const userId = ctx.from.id.toString();

      if (!selectedModel || !selectedDuration || !selectedSlot) {
        throw new Error('Booking details incomplete');
      }

      // Get slot details
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      if (!slot) {
        throw new Error('Slot not found');
      }

      const model = await ModelService.getModelById(selectedModel);
      const price = MeetGreetService.calculatePrice(selectedDuration);

      // Create booking with pending status
      const booking = await MeetGreetService.createBooking(
        userId,
        selectedModel,
        selectedDuration,
        slot.available_from,
        'credit_card'
      );

      // Mark slot as booked (temporarily - will be released if payment fails)
      await AvailabilityService.bookAvailability(selectedSlot, booking.id);

      // Store booking ID in session for webhook callback
      ctx.session.meetGreet.bookingId = booking.id;
      await ctx.saveSession();

      // Generate ePayco checkout URL
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store';
      const checkoutUrl = `${webhookDomain}/pnp/meet-greet/checkout/${booking.id}`;

      const message = lang === 'es'
        ? `💳 *Pago con Tarjeta de Crédito*\n\n📞 Video Llamada VIP con ${model.name}\n💰 Total: $${price} USD\n\n👇 Haz clic en el botón para completar tu pago:`
        : `💳 *Credit Card Payment*\n\n📞 VIP Video Call with ${model.name}\n💰 Total: $${price} USD\n\n👇 Click the button below to complete your payment:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url(lang === 'es' ? '💳 Pagar Ahora' : '💳 Pay Now', checkoutUrl)],
          [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'MEET_GREET_START')]
        ])
      });
    } catch (error) {
      logger.error('Error processing credit card payment:', error);
      await ctx.answerCbQuery('❌ Error: ' + error.message);
    }
  });

  // Handle payment selection - Crypto (Daimo)
  bot.action('mg_pay_crypto', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);

      // Create booking
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.meetGreet || {};
      const userId = ctx.from.id.toString();

      if (!selectedModel || !selectedDuration || !selectedSlot) {
        throw new Error('Booking details incomplete');
      }

      // Get slot details
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      if (!slot) {
        throw new Error('Slot not found');
      }

      const model = await ModelService.getModelById(selectedModel);
      const price = MeetGreetService.calculatePrice(selectedDuration);

      // Create booking with pending status
      const booking = await MeetGreetService.createBooking(
        userId,
        selectedModel,
        selectedDuration,
        slot.available_from,
        'crypto'
      );

      // Mark slot as booked (temporarily - will be released if payment fails)
      await AvailabilityService.bookAvailability(selectedSlot, booking.id);

      // Store booking ID in session for webhook callback
      ctx.session.meetGreet.bookingId = booking.id;
      await ctx.saveSession();

      // Generate Daimo checkout URL
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store';
      const checkoutUrl = `${webhookDomain}/pnp/meet-greet/daimo-checkout/${booking.id}`;

      const message = lang === 'es'
        ? `₿ *Pago con Crypto (USDC)*\n\n📞 Video Llamada VIP con ${model.name}\n💰 Total: $${price} USDC\n\n👇 Haz clic en el botón para completar tu pago:`
        : `₿ *Crypto Payment (USDC)*\n\n📞 VIP Video Call with ${model.name}\n💰 Total: $${price} USDC\n\n👇 Click the button below to complete your payment:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url(lang === 'es' ? '₿ Pagar con Crypto' : '₿ Pay with Crypto', checkoutUrl)],
          [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'MEET_GREET_START')]
        ])
      });
    } catch (error) {
      logger.error('Error processing crypto payment:', error);
      await ctx.answerCbQuery('❌ Error: ' + error.message);
    }
  });

  // Show user's bookings
  bot.action('my_bookings', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();
      
      // Get user's bookings
      const bookings = await MeetGreetService.getBookingsForUser(userId);
      
      if (bookings.length === 0) {
        const message = lang === 'es'
          ? `📅 *No tienes reservas*\n\nNo tienes reservas de Video Llamadas VIP.`
          : `📅 *No Bookings*\n\nYou have no VIP Video Call bookings.`;
        
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'back_to_main')]
          ])
        });
        return;
      }

      // Show bookings list
      await showBookingsList(ctx, lang, bookings);
    } catch (error) {
      logger.error('Error showing bookings:', error);
      await ctx.answerCbQuery('❌ Error loading bookings');
    }
  });

  // Show bookings list
  async function showBookingsList(ctx, lang, bookings) {
    // Implementation for showing bookings list
    // This would show a list of bookings with options to view details or cancel
  }
};

module.exports = registerMeetGreetHandlers;