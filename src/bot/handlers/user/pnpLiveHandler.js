const { Markup } = require('telegraf');
const ModelService = require('../../services/modelService');
const PNPLiveService = require('../../services/pnpLiveService');
const PNPLiveMediaService = require('../../services/pnpLiveMediaService');
const PNPLiveTimeSlotService = require('../../services/pnpLiveTimeSlotService');
const AvailabilityService = require('../../services/availabilityService');
const { getLanguage, safeEditMessage } = require('../../utils/helpers');
const logger = require('../../../utils/logger');

/**
 * PNP Television Live Handler - Main handler for PNP Television Live system
 * Replaces Meet & Greet with enhanced private shows
 */
const registerPNPLiveHandlers = (bot) => {
  // Start PNP Live flow
  bot.action('PNP_LIVE_START', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from?.id;
      
      // Check if user is admin for testing access
      const PermissionService = require('../../services/permissionService');
      const isAdmin = await PermissionService.isAdmin(userId);
      
      if (isAdmin) {
        // Allow admin to access the feature for testing
        await showFeaturedModelsCarousel(ctx, lang);
      } else {
        await ctx.answerCbQuery(
          lang === 'es' ? '🚧 ESTRENO EL FIN DE SEMANA' : '🚧 COMING OUT THIS WEEKEND',
          { show_alert: true }
        );
      }
    } catch (error) {
      logger.error('Error starting PNP Live:', error);
      await ctx.answerCbQuery('❌ Error starting PNP Live');
    }
  });

  // Show featured models with enhanced sales display and profile images
  async function showFeaturedModelsCarousel(ctx, lang) {
    try {
      // Get featured models with images and pricing
      const featuredModels = await PNPLiveMediaService.getFeaturedModelsWithImages(6);
      
      if (featuredModels.length > 0) {
        const branding = PNPLiveMediaService.getBrandingAssets();
        
        let message = lang === 'es'
          ? `📹 *${branding.icon} PNP Television Live - Modelos Disponibles*\n\n` +
            `🟢 *Online Ahora* | ⚪ *Disponibles*\n\n` +
            `💃 *Selecciona un modelo para tu Show Privado:*`
          : `📹 *${branding.icon} PNP Television Live - Available Models*\n\n` +
            `🟢 *Online Now* | ⚪ *Available*\n\n` +
            `💃 *Select a model for your Private Show:*`;
        
        // Create enhanced sales-oriented buttons with status, ratings, and profile info
        const buttons = [];
        
        for (const model of featuredModels) {
          const statusEmoji = model.isOnline ? '🟢' : '⚪';
          const ratingDisplay = model.avg_rating > 0 ? ` ⭐${parseFloat(model.avg_rating).toFixed(1)}` : '';
          
          // Enhanced button with model name, status, and rating
          buttons.push([{
            text: `${model.name} ${statusEmoji}${ratingDisplay}`,
            callback_data: `pnp_select_model_${model.modelId}`
          }]);
        }
        
        // Add pricing info and call-to-action
        buttons.push([
          {
            text: lang === 'es' ? '💰 Desde $60 - 30 min' : '💰 From $60 - 30 min',
            callback_data: 'pnp_show_pricing'
          }
        ]);
        
        // Add payment options
        buttons.push([
          {
            text: lang === 'es' ? '💳 Pagar con ePayco' : '💳 Pay with ePayco',
            callback_data: 'pnp_show_payment_options'
          },
          {
            text: lang === 'es' ? '🪙 Pagar con Crypto (Daimo)' : '🪙 Pay with Crypto (Daimo)',
            callback_data: 'pnp_show_crypto_options'
          }
        ]);
        
        buttons.push([
          {
            text: lang === 'es' ? '🔍 Ver Todos los Modelos' : '🔍 View All Models',
            callback_data: 'pnp_show_all_models'
          }
        ]);
        
        await safeEditMessage(ctx, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        });
      } else {
        // If no featured models, show regular model selection
        await showModelSelection(ctx, lang);
      }
    } catch (error) {
      logger.error('Error showing featured models:', error);
      // Fallback to regular model selection
      await showModelSelection(ctx, lang);
    }
  }

  // Show model selection with online status and ratings
  async function showModelSelection(ctx, lang) {
    try {
      // Use enhanced method that includes ratings
      const models = await PNPLiveService.getActiveModelsWithRatings();

      if (models.length === 0) {
        const message = lang === 'es'
          ? `🔍 *No hay modelos disponibles*

No hay modelos disponibles en este momento. Por favor, intenta más tarde.`
          : `🔍 *No Models Available*

No models are available at this time. Please try again later.`;

        await safeEditMessage(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver al Menú' : '🔙 Back to Menu', 'back_to_main')]
          ])
        });
        return;
      }

      // Create model buttons with online status and ratings (2 per row for more info)
      const buttons = [];
      for (let i = 0; i < models.length; i += 2) {
        const row = [];
        for (let j = 0; j < 2 && i + j < models.length; j++) {
          const model = models[i + j];
          const onlineStatus = model.is_online ? '🟢' : '⚪';
          // Show rating if available
          const ratingDisplay = model.avg_rating > 0
            ? `⭐${parseFloat(model.avg_rating).toFixed(1)}`
            : '';
          row.push(Markup.button.callback(
            `${model.name} ${onlineStatus} ${ratingDisplay}`.trim(),
            `pnp_select_model_${model.id}`
          ));
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'back_to_main')
      ]);

      const message = lang === 'es'
        ? `📹 *PNP Television Live - Selecciona un Modelo*

🟢 Online ahora | ⚪ Disponible | ⭐ Rating

Elige un modelo para tu Show Privado:`
        : `📹 *PNP Television Live - Select a Model*

🟢 Online now | ⚪ Available | ⭐ Rating

Choose a model for your Private Show:`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing model selection:', error);
      await ctx.answerCbQuery('❌ Error loading models');
    }
  }

  // Handle pricing info request
  bot.action('pnp_show_pricing', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      
      const pricingMessage = lang === 'es'
        ? `💰 *Precios de Shows Privados*

` +
          `🕒 30 min: $60 USD
` +
          `🕒 60 min: $100 USD
` +
          `🕒 90 min: $250 USD

` +
          `💜 *Incluye:* Sala privada, modelo exclusivo, soporte 24/7`
        : `💰 *Private Show Pricing*

` +
          `🕒 30 min: $60 USD
` +
          `🕒 60 min: $100 USD
` +
          `🕒 90 min: $250 USD

` +
          `💜 *Includes:* Private room, exclusive model, 24/7 support`;
      
      await safeEditMessage(ctx, pricingMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{
              text: lang === 'es' ? '🔙 Volver a Modelos' : '🔙 Back to Models',
              callback_data: 'PNP_LIVE_START'
            }]
          ]
        }
      });
    } catch (error) {
      logger.error('Error showing pricing:', error);
      await ctx.answerCbQuery('❌ Error loading pricing');
    }
  });
  
  // Handle "show all models" request
  bot.action('pnp_show_all_models', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showModelSelection(ctx, getLanguage(ctx));
    } catch (error) {
      logger.error('Error showing all models:', error);
      await ctx.answerCbQuery('❌ Error loading models');
    }
  });
  
  // Handle payment options display
  bot.action('pnp_show_payment_options', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      
      const paymentMessage = lang === 'es'
        ? `💳 *Opciones de Pago - ePayco*
\n` +
          `🏦 *Métodos disponibles:*
` +
          `• Tarjetas de crédito/débito
` +
          `• PSE (Bancos colombianos)
` +
          `• Transferencias bancarias
` +
          `• Efecty, Baloto, y más
\n` +
          `🔒 *Seguro y discreto*
` +
          `• Facturación como: "Servicio de Entretenimiento Digital"
` +
          `• Protección de datos garantizada`
        : `💳 *Payment Options - ePayco*
\n` +
          `🏦 *Available methods:*
` +
          `• Credit/Debit cards
` +
          `• PSE (Colombian banks)
` +
          `• Bank transfers
` +
          `• Efecty, Baloto, and more
\n` +
          `🔒 *Secure and discreet*
` +
          `• Billed as: "Digital Entertainment Service"
` +
          `• Data protection guaranteed`;
      
      await safeEditMessage(ctx, paymentMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{
              text: lang === 'es' ? '💰 Ver Precios' : '💰 View Pricing',
              callback_data: 'pnp_show_pricing'
            }],
            [{
              text: lang === 'es' ? '🔙 Volver a Modelos' : '🔙 Back to Models',
              callback_data: 'PNP_LIVE_START'
            }]
          ]
        }
      });
    } catch (error) {
      logger.error('Error showing payment options:', error);
      await ctx.answerCbQuery('❌ Error loading payment options');
    }
  });
  
  // Handle crypto payment options display
  bot.action('pnp_show_crypto_options', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      
      const cryptoMessage = lang === 'es'
        ? `🪙 *Opciones de Pago - Daimo (Crypto)*
\n` +
          `💱 *Métodos disponibles:*
` +
          `• USDC (USD Coin)
` +
          `• ETH (Ethereum)
` +
          `• DAI (Stablecoin)
` +
          `• Otras criptomonedas
\n` +
          `⚡ *Ventajas:*
` +
          `• Transacciones instantáneas
` +
          `• Sin intermediarios bancarios
` +
          `• Privacidad mejorada
` +
          `• Facturación discreta
\n` +
          `🔒 *Seguro y discreto*
` +
          `• Facturación como: "Servicio Digital Premium"
` +
          `• Sin registros bancarios`
        : `🪙 *Payment Options - Daimo (Crypto)*
\n` +
          `💱 *Available methods:*
` +
          `• USDC (USD Coin)
` +
          `• ETH (Ethereum)
` +
          `• DAI (Stablecoin)
` +
          `• Other cryptocurrencies
\n` +
          `⚡ *Benefits:*
` +
          `• Instant transactions
` +
          `• No bank intermediaries
` +
          `• Enhanced privacy
` +
          `• Discreet billing
\n` +
          `🔒 *Secure and discreet*
` +
          `• Billed as: "Premium Digital Service"
` +
          `• No bank records`;
      
      await safeEditMessage(ctx, cryptoMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{
              text: lang === 'es' ? '💰 Ver Precios' : '💰 View Pricing',
              callback_data: 'pnp_show_pricing'
            }],
            [{
              text: lang === 'es' ? '🔙 Volver a Modelos' : '🔙 Back to Models',
              callback_data: 'PNP_LIVE_START'
            }]
          ]
        }
      });
    } catch (error) {
      logger.error('Error showing crypto options:', error);
      await ctx.answerCbQuery('❌ Error loading crypto options');
    }
  });
  
  // Handle duration selection
  bot.action(/^pnp_set_duration_(\d+)_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const duration = parseInt(ctx.match[2]);
      
      // Get pricing for selected duration
      const pricing = await PNPLiveService.getModelPricing(modelId, duration);
      
      // Update session with selected duration
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.selectedModel = ctx.session.temp.selectedModel || {};
      ctx.session.temp.selectedModel.duration = duration;
      ctx.session.temp.selectedModel.price = pricing.price;
      await ctx.saveSession();
      
      const confirmationMessage = lang === 'es'
        ? `✅ *Duración seleccionada: ${duration} minutos*
\n` +
          `💰 *Precio: $${pricing.price} USD*
\n` +
          `💃 *¿Cuándo quieres tu show?*`
        : `✅ *Selected duration: ${duration} minutes*
\n` +
          `💰 *Price: $${pricing.price} USD*
\n` +
          `💃 *When do you want your show?*`;
      
      // Check if model is available now
      const model = await PNPLiveService.getModelWithStats(modelId);
      const isAvailableNow = model.is_online;
      
      const buttons = [];
      
      // Immediate booking option
      if (isAvailableNow) {
        buttons.push([{
          text: lang === 'es' ? '🚀 ¡QUERO AHORA! (Inmediato)' : '🚀 I WANT IT NOW! (Immediate)',
          callback_data: `pnp_book_now_${modelId}_${duration}`
        }]);
      }
      
      // Schedule for later option
      buttons.push([{
        text: lang === 'es' ? '📅 Programar para más tarde' : '📅 Schedule for later',
        callback_data: `pnp_schedule_booking_${modelId}_${duration}`
      }]);
      
      // Payment options
      buttons.push([
        {
          text: lang === 'es' ? '💳 Pagar con ePayco' : '💳 Pay with ePayco',
          callback_data: `pnp_pay_epayco_${modelId}_${duration}`
        },
        {
          text: lang === 'es' ? '🪙 Pagar con Crypto' : '🪙 Pay with Crypto',
          callback_data: `pnp_pay_crypto_${modelId}_${duration}`
        }
      ]);
      
      buttons.push([{
        text: lang === 'es' ? '🔙 Cambiar duración' : '🔙 Change duration',
        callback_data: `pnp_select_model_${modelId}`
      }]);
      
      await safeEditMessage(ctx, confirmationMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
      
    } catch (error) {
      logger.error('Error setting duration:', error);
      await ctx.answerCbQuery('❌ Error setting duration');
    }
  });
  
  // Handle model selection with booking options
  bot.action(/^pnp_select_model_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      
      // Get model details
      const model = await PNPLiveService.getModelWithStats(modelId);
      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? '❌ Modelo no encontrado' : '❌ Model not found');
        return;
      }
      
      // Check model availability
      const isAvailableNow = model.is_online;
      const availability = await AvailabilityService.getModelAvailability(modelId);
      
      // Show booking options
      const statusEmoji = isAvailableNow ? '🟢' : '⚪';
      const ratingDisplay = model.avg_rating > 0 ? ` ⭐${parseFloat(model.avg_rating).toFixed(1)}` : '';
      
      const bookingMessage = lang === 'es'
        ? `📹 *${model.name} ${statusEmoji}${ratingDisplay}*
\n` +
          `📅 *Disponibilidad:* ${isAvailableNow ? '🟢 Disponible AHORA' : '⚪ No disponible ahora'}
\n` +
          `💃 *Sobre ${model.name}:*
` +
          `• ${model.total_shows || 0} shows completados
` +
          `• ${model.rating_count || 0} reseñas
` +
          `• Rating: ${model.avg_rating || 'Nuevo'}
\n` +
          `💰 *Precios:*
` +
          `• 30 min: $60 USD
` +
          `• 60 min: $100 USD
` +
          `• 90 min: $250 USD`
        : `📹 *${model.name} ${statusEmoji}${ratingDisplay}*
\n` +
          `📅 *Availability:* ${isAvailableNow ? '🟢 Available NOW' : '⚪ Not available now'}
\n` +
          `💃 *About ${model.name}:*
` +
          `• ${model.total_shows || 0} completed shows
` +
          `• ${model.rating_count || 0} reviews
` +
          `• Rating: ${model.avg_rating || 'New'}
\n` +
          `💰 *Pricing:*
` +
          `• 30 min: $60 USD
` +
          `• 60 min: $100 USD
` +
          `• 90 min: $250 USD`;
      
      // Create booking options based on availability
      const buttons = [];
      
      // Immediate booking option (if available now)
      if (isAvailableNow) {
        buttons.push([{
          text: lang === 'es' ? '🚀 Reservar AHORA (Inmediato)' : '🚀 Book NOW (Immediate)',
          callback_data: `pnp_book_now_${modelId}_30`
        }]);
      }
      
      // Future booking options
      buttons.push([{
        text: lang === 'es' ? '📅 Reservar para más tarde' : '📅 Book for later',
        callback_data: `pnp_schedule_booking_${modelId}`
      }]);
      
      // Duration options
      buttons.push([
        {
          text: lang === 'es' ? '⏱️ 30 min ($60)' : '⏱️ 30 min ($60)',
          callback_data: `pnp_set_duration_${modelId}_30`
        },
        {
          text: lang === 'es' ? '⏱️ 60 min ($100)' : '⏱️ 60 min ($100)',
          callback_data: `pnp_set_duration_${modelId}_60`
        }
      ]);
      
      buttons.push([
        {
          text: lang === 'es' ? '⏱️ 90 min ($250)' : '⏱️ 90 min ($250)',
          callback_data: `pnp_set_duration_${modelId}_90`
        }
      ]);
      
      // Payment and back options
      buttons.push([
        {
          text: lang === 'es' ? '💳 Métodos de Pago' : '💳 Payment Methods',
          callback_data: 'pnp_show_payment_options'
        }
      ]);
      
      buttons.push([
        {
          text: lang === 'es' ? '🔙 Volver a Modelos' : '🔙 Back to Models',
          callback_data: 'PNP_LIVE_START'
        }
      ]);
      
      // Store selected model in session
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.selectedModel = {
        modelId: modelId,
        modelName: model.name,
        isAvailableNow: isAvailableNow,
        duration: 30, // default duration
        price: 60
      };
      await ctx.saveSession();
      
      await safeEditMessage(ctx, bookingMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
      
    } catch (error) {
      logger.error('Error in model selection:', error);
      await ctx.answerCbQuery('❌ Error selecting model');
    }
  });

  // Show duration selection with enhanced UI
  async function showDurationSelection(ctx, lang, modelId) {
    try {
      const model = await ModelService.getModelById(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      const buttons = [
        [Markup.button.callback('🔥 30 min - $60', 'pnp_select_duration_30')],
        [Markup.button.callback('🔥 60 min - $100', 'pnp_select_duration_60')],
        [Markup.button.callback('🔥 90 min - $250 (2 modelos)', 'pnp_select_duration_90')],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'PNP_LIVE_START')]
      ];

      const message = lang === 'es'
        ? `📹 *PNP Television Live - ${model.name}*

💃 *Opciones de Show Privado:*

` +
          `🔥 *30 min* - $60
📹 Video privado 1:1 con ${model.name}
💬 Chat en vivo con tu Latino favorito
🎁 Experiencia íntima y personal

` +
          `🔥 *60 min* - $100
📹 Video privado extendido (60 min)
💬 Conversación profunda y conexión
🎁 Incluye contenido exclusivo

` +
          `🔥 *90 min* - $250
📹 Video privado VIP (90 min)
👥 ${model.name} + modelo invitado
💬 Experiencia premium doble
🎁 El paquete más exclusivo

` +
          `💰 *Selecciona la duración para tu experiencia PNP Television Live:*`
        : `📹 *PNP Television Live - ${model.name}*

💃 *Private Show Options:*

` +
          `🔥 *30 min* - $60
📹 1:1 Private video with ${model.name}
💬 Live chat with your fav Latino
🎁 Intimate and personal experience

` +
          `🔥 *60 min* - $100
📹 Extended private video (60 min)
💬 Deep conversation and connection
🎁 Includes exclusive content

` +
          `🔥 *90 min* - $250
📹 VIP Private video (90 min)
👥 ${model.name} + guest model
💬 Premium double experience
🎁 The most exclusive package

` +
          `💰 *Select duration for your PNP Television Live experience:*`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing duration selection:', error);
      await ctx.answerCbQuery('❌ Error loading duration options');
    }
  }

  // Handle duration selection
  bot.action(/^pnp_select_duration_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const duration = parseInt(ctx.match[1]);
      
      // Validate duration
      if (![30, 60, 90].includes(duration)) {
        throw new Error('Invalid duration');
      }
      
      // Store selected duration in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.selectedDuration = duration;
      await ctx.saveSession();
      
      // Show date selection
      await showDateSelection(ctx, lang);
    } catch (error) {
      logger.error('Error selecting duration:', error);
      await ctx.answerCbQuery('❌ Error selecting duration');
    }
  });

  // Show date selection with PNP constraints (Thursday to Monday)
  async function showDateSelection(ctx, lang) {
    try {
      const { selectedModel, selectedDuration } = ctx.session.pnpLive || {};
      if (!selectedModel || !selectedDuration) {
        throw new Error('Model or duration not selected');
      }

      const model = await ModelService.getModelById(selectedModel);
      if (!model) {
        throw new Error('Model not found');
      }

      // Get available days (Thursday to Monday) for next 2 weeks
      const availableDays = PNPLiveTimeSlotService.getAvailableDays(2);

      // Create date buttons
      const buttons = [];
      for (const date of availableDays) {
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' });
        const dayMonth = date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' });
        
        buttons.push([
          Markup.button.callback(`${dayName} ${dayMonth}`, `pnp_select_date_${dateStr}`)
        ]);
      }

      // Add navigation
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `pnp_select_model_${selectedModel}`)
      ]);

      const price = PNPLiveService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const message = lang === 'es'
        ? `📅 *PNP Television Live - Selecciona una Fecha*

💃 Modelo: ${model.name}
⏱️ Duración: ${durationText}
💰 Precio: $${price}

📅 *Disponible solo Jueves a Lunes*

Elige una fecha disponible:`
        : `📅 *PNP Television Live - Select a Date*

💃 Model: ${model.name}
⏱️ Duration: ${durationText}
💰 Price: $${price}

📅 *Available Thursday to Monday only*

Choose an available date:`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing date selection:', error);
      await ctx.answerCbQuery('❌ Error loading date options');
    }
  }

  // Handle date selection
  bot.action(/^pnp_select_date_(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const dateStr = ctx.match[1];
      
      // Store selected date in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.selectedDate = dateStr;
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
      const { selectedModel, selectedDuration } = ctx.session.pnpLive || {};
      if (!selectedModel || !selectedDuration) {
        throw new Error('Model or duration not selected');
      }

      const model = await ModelService.getModelById(selectedModel);
      if (!model) {
        throw new Error('Model not found');
      }

      // Get available slots for the selected date
      const date = new Date(dateStr);
      const slots = await PNPLiveService.getAvailableSlots(selectedModel, date, selectedDuration);

      if (slots.length === 0) {
        const message = lang === 'es'
          ? `⏰ *No hay horarios disponibles*

No hay horarios disponibles para esta fecha. Por favor, elige otra fecha.`
          : `⏰ *No Time Slots Available*

No time slots are available for this date. Please choose another date.`;
        
        await safeEditMessage(ctx, message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `pnp_select_date_${dateStr}`)]
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
          Markup.button.callback(`${startTime} - ${endTime}`, `pnp_select_slot_${slot.id}`)
        ]);
      }

      // Add navigation
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `pnp_select_date_${dateStr}`)
      ]);

      const price = PNPLiveService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const message = lang === 'es'
        ? `⏰ *PNP Television Live - Selecciona un Horario*

💃 Modelo: ${model.name}
📅 Fecha: ${dateStr}
⏱️ Duración: ${durationText}
💰 Precio: $${price}

🕒 *Horarios disponibles (10 AM - 10 PM):*

Elige un horario para tu Show Privado:`
        : `⏰ *PNP Television Live - Select a Time Slot*

💃 Model: ${model.name}
📅 Date: ${dateStr}
⏱️ Duration: ${durationText}
💰 Price: $${price}

🕒 *Available time slots (10 AM - 10 PM):*

Choose a time slot for your Private Show:`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing time slot selection:', error);
      await ctx.answerCbQuery('❌ Error loading time slots');
    }
  }

  // Handle time slot selection
  bot.action(/^pnp_select_slot_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const slotId = parseInt(ctx.match[1]);
      
      // Store selected slot in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.selectedSlot = slotId;
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
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.pnpLive || {};
      
      // Validate booking details with user-friendly feedback
      if (!selectedModel || !selectedDuration || !selectedDate || !selectedSlot) {
        logger.warn('Incomplete booking details in session', {
          userId: ctx.from?.id,
          session: ctx.session.pnpLive
        });
        
        const missingMessage = lang === 'es' 
          ? '❌ Por favor completa todos los pasos de reserva primero.'
          : '❌ Please complete all booking steps first.';
        
        try {
          await ctx.answerCbQuery(missingMessage);
        } catch (cbError) {
          logger.warn('Failed to answer callback query for incomplete booking', {
            error: cbError.message,
            userId: ctx.from?.id
          });
          // Try to send as a regular message if callback fails
          try {
            await ctx.reply(missingMessage);
          } catch (replyError) {
            logger.error('Failed to send incomplete booking message', {
              error: replyError.message,
              userId: ctx.from?.id
            });
          }
        }
        return;
      }

      const model = await ModelService.getModelById(selectedModel);
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      
      if (!model || !slot) {
        logger.warn('Model or slot not found', {
          selectedModel,
          selectedSlot,
          userId: ctx.from?.id
        });
        
        const notFoundMessage = lang === 'es'
          ? '❌ Modelo o horario no disponible. Por favor selecciona nuevamente.'
          : '❌ Model or time slot not available. Please select again.';
        
        await ctx.answerCbQuery(notFoundMessage);
        return;
      }

      const price = PNPLiveService.calculatePrice(selectedDuration);
      const durationText = lang === 'es'
        ? `${selectedDuration} minutos`
        : `${selectedDuration} minutes`;

      const startTime = new Date(slot.available_from).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const buttons = [
        [Markup.button.callback('💳 Tarjeta de Crédito', 'pnp_pay_credit_card')],
        [Markup.button.callback('₿ Crypto (USDC)', 'pnp_pay_crypto')],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `pnp_select_date_${selectedDate}`)]
      ];

      const message = lang === 'es'
        ? `💰 *PNP Television Live - Método de Pago*

📹 *Show Privado con ${model.name}*
📅 Fecha: ${selectedDate}
⏰ Hora: ${startTime}
⏱️ Duración: ${durationText}
💰 Total: $${price} USD

🔒 *Tu pago está protegido*
✅ Sala privada garantizada
✅ Reembolso disponible (15 min)
✅ Soporte 24/7

Selecciona tu método de pago:`
        : `💰 *PNP Television Live - Payment Method*

📹 *Private Show with ${model.name}*
📅 Date: ${selectedDate}
⏰ Time: ${startTime}
⏱️ Duration: ${durationText}
💰 Total: $${price} USD

🔒 *Your payment is protected*
✅ Guaranteed private room
✅ Refund available (15 min)
✅ 24/7 Support

Select your payment method:`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing payment selection:', error);
      await ctx.answerCbQuery('❌ Error loading payment options');
    }
  }

  // Handle payment selection - Credit Card (ePayco)
  bot.action('pnp_pay_credit_card', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);

      // Create booking
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.pnpLive || {};
      const userId = ctx.from.id.toString();

      // Validate booking details with user-friendly feedback
      if (!selectedModel || !selectedDuration || !selectedSlot) {
        logger.warn('Incomplete booking details for payment', {
          userId,
          session: ctx.session.pnpLive
        });
        
        const missingMessage = lang === 'es'
          ? '❌ Por favor completa todos los pasos de reserva primero.'
          : '❌ Please complete all booking steps first.';
        
        await safeEditMessage(ctx, missingMessage);
        return;
      }

      // Get slot details
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      if (!slot) {
        logger.warn('Slot not found for booking', {
          selectedSlot,
          userId
        });
        
        const notFoundMessage = lang === 'es'
          ? '❌ Horario seleccionado no disponible. Por favor elige otro.'
          : '❌ Selected time slot not available. Please choose another.';
        
        await safeEditMessage(ctx, notFoundMessage);
        return;
      }

      const model = await ModelService.getModelById(selectedModel);
      const price = PNPLiveService.calculatePrice(selectedDuration);

      // Create booking with pending status
      const booking = await PNPLiveService.createBooking(
        userId,
        selectedModel,
        selectedDuration,
        slot.available_from,
        'credit_card'
      );

      // Mark slot as booked (temporarily - will be released if payment fails)
      await AvailabilityService.bookAvailability(selectedSlot, booking.id);

      // Store booking ID in session for webhook callback
      ctx.session.pnpLive.bookingId = booking.id;
      await ctx.saveSession();

      // Generate ePayco checkout URL
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store';
      const checkoutUrl = `${webhookDomain}/pnp/live/checkout/${booking.id}`;

      const message = lang === 'es'
        ? `💳 *PNP Television Live - Pago con Tarjeta*

📹 *Show Privado con ${model.name}*
💰 Total: $${price} USD

👇 *Haz clic en el botón para completar tu pago:*

🔒 *Pago seguro con ePayco*
✅ Encriptación SSL
✅ Protección contra fraude
✅ Reembolso garantizado

*Tu sala privada será creada inmediatamente después del pago.*`
        : `💳 *PNP Television Live - Credit Card Payment*

📹 *Private Show with ${model.name}*
💰 Total: $${price} USD

👇 *Click the button below to complete your payment:*

🔒 *Secure payment with ePayco*
✅ SSL Encryption
✅ Fraud Protection
✅ Guaranteed Refund

*Your private room will be created immediately after payment.*`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('💳 Pagar Ahora', checkoutUrl)],
          [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'PNP_LIVE_START')]
        ])
      });
    } catch (error) {
      logger.error('Error processing credit card payment:', error);
      await ctx.answerCbQuery('❌ Error: ' + error.message);
    }
  });

  // Handle payment selection - Crypto (Daimo)
  bot.action('pnp_pay_crypto', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);

      // Create booking
      const { selectedModel, selectedDuration, selectedDate, selectedSlot } = ctx.session.pnpLive || {};
      const userId = ctx.from.id.toString();

      // Validate booking details with user-friendly feedback
      if (!selectedModel || !selectedDuration || !selectedSlot) {
        logger.warn('Incomplete booking details for crypto payment', {
          userId,
          session: ctx.session.pnpLive
        });
        
        const missingMessage = lang === 'es'
          ? '❌ Por favor completa todos los pasos de reserva primero.'
          : '❌ Please complete all booking steps first.';
        
        await safeEditMessage(ctx, missingMessage);
        return;
      }

      // Get slot details
      const slot = await AvailabilityService.getAvailabilityById(selectedSlot);
      if (!slot) {
        logger.warn('Slot not found for crypto booking', {
          selectedSlot,
          userId
        });
        
        const notFoundMessage = lang === 'es'
          ? '❌ Horario seleccionado no disponible. Por favor elige otro.'
          : '❌ Selected time slot not available. Please choose another.';
        
        await safeEditMessage(ctx, notFoundMessage);
        return;
      }

      const model = await ModelService.getModelById(selectedModel);
      const price = PNPLiveService.calculatePrice(selectedDuration);

      // Create booking with pending status
      const booking = await PNPLiveService.createBooking(
        userId,
        selectedModel,
        selectedDuration,
        slot.available_from,
        'crypto'
      );

      // Mark slot as booked (temporarily - will be released if payment fails)
      await AvailabilityService.bookAvailability(selectedSlot, booking.id);

      // Store booking ID in session for webhook callback
      ctx.session.pnpLive.bookingId = booking.id;
      await ctx.saveSession();

      // Generate Daimo checkout URL
      const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store';
      const checkoutUrl = `${webhookDomain}/pnp/live/daimo-checkout/${booking.id}`;

      const message = lang === 'es'
        ? `₿ *PNP Television Live - Pago con Crypto*

📹 *Show Privado con ${model.name}*
💰 Total: $${price} USDC

👇 *Haz clic en el botón para completar tu pago:*

🔒 *Pago seguro con Daimo*
✅ Blockchain seguro
✅ Sin comisiones ocultas
✅ Confirmación instantánea

*Tu sala privada será creada inmediatamente después del pago.*`
        : `₿ *PNP Television Live - Crypto Payment*

📹 *Private Show with ${model.name}*
💰 Total: $${price} USDC

👇 *Click the button below to complete your payment:*

🔒 *Secure payment with Daimo*
✅ Secure blockchain
✅ No hidden fees
✅ Instant confirmation

*Your private room will be created immediately after payment.*`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('₿ Pagar con Crypto', checkoutUrl)],
          [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'PNP_LIVE_START')]
        ])
      });
    } catch (error) {
      logger.error('Error processing crypto payment:', error);
      await ctx.answerCbQuery('❌ Error: ' + error.message);
    }
  });

  // Show user's bookings
  bot.action('my_pnp_bookings', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const userId = ctx.from.id.toString();
      
      // Get user's bookings
      const bookings = await PNPLiveService.getBookingsForUser(userId);
      
      if (bookings.length === 0) {
        const message = lang === 'es'
          ? `📹 *No tienes reservas de PNP Television Live*

Aún no has reservado ningún Show Privado.`
          : `📹 *No PNP Television Live Bookings*

You haven't booked any Private Shows yet.`;
        
        await safeEditMessage(ctx, message, {
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
    try {
      // Sort bookings by date (upcoming first)
      const upcomingBookings = bookings.filter(b => 
        new Date(b.booking_time) > new Date() && b.status !== 'cancelled'
      ).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time));

      const pastBookings = bookings.filter(b => 
        new Date(b.booking_time) <= new Date() || b.status === 'cancelled'
      ).sort((a, b) => new Date(b.booking_time) - new Date(a.booking_time));

      // Create message
      let message = lang === 'es'
        ? `📹 *Mis Reservas de PNP Television Live*

`
        : `📹 *My PNP Television Live Bookings*

`;

      // Upcoming bookings
      if (upcomingBookings.length > 0) {
        message += lang === 'es' ? `💬 *Próximos Shows:*\n\n` : `💬 *Upcoming Shows:*\n\n`;
        
        for (const booking of upcomingBookings) {
          const model = await ModelService.getModelById(booking.model_id);
          const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const statusEmoji = booking.payment_status === 'paid' ? '✅' : '⏳';
          message += `${statusEmoji} ${startTime} - ${model?.name || 'Modelo'} (${booking.duration_minutes} min)\n`;
        }
        message += '\n';
      }

      // Past bookings
      if (pastBookings.length > 0) {
        message += lang === 'es' ? `📅 *Shows Pasados:*\n\n` : `📅 *Past Shows:*\n\n`;
        
        for (const booking of pastBookings) {
          const model = await ModelService.getModelById(booking.model_id);
          const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const statusText = booking.status === 'completed' ? '✅' : 
                           booking.status === 'cancelled' ? '❌' : '⏳';
          message += `${statusText} ${startTime} - ${model?.name || 'Modelo'} (${booking.duration_minutes} min)\n`;
        }
      }

      const buttons = [
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'back_to_main')]
      ];

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing bookings list:', error);
      await ctx.answerCbQuery('❌ Error loading bookings');
    }
  }

  // Handle booking feedback
  bot.action(/^pnp_feedback_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const bookingId = parseInt(ctx.match[1]);
      
      // Store in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.feedbackBookingId = bookingId;
      await ctx.saveSession();
      
      // Show rating selection
      await showRatingSelection(ctx, lang, bookingId);
    } catch (error) {
      logger.error('Error starting feedback:', error);
      await ctx.answerCbQuery('❌ Error starting feedback');
    }
  });

  // Show rating selection
  async function showRatingSelection(ctx, lang, bookingId) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await ModelService.getModelById(booking.model_id);
      
      const buttons = [
        [
          Markup.button.callback('⭐', 'pnp_rate_1'),
          Markup.button.callback('⭐⭐', 'pnp_rate_2'),
          Markup.button.callback('⭐⭐⭐', 'pnp_rate_3'),
          Markup.button.callback('⭐⭐⭐⭐', 'pnp_rate_4'),
          Markup.button.callback('⭐⭐⭐⭐⭐', 'pnp_rate_5')
        ],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'my_pnp_bookings')]
      ];

      const message = lang === 'es'
        ? `🌟 *Califica tu Experiencia PNP Television Live*

📹 Show con ${model?.name || 'modelo'}
📅 ${new Date(booking.booking_time).toLocaleDateString()}

¿Cómo calificarías tu experiencia? (1-5 estrellas)`
        : `🌟 *Rate Your PNP Television Live Experience*

📹 Show with ${model?.name || 'model'}
📅 ${new Date(booking.booking_time).toLocaleDateString()}

How would you rate your experience? (1-5 stars)`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing rating selection:', error);
      await ctx.answerCbQuery('❌ Error loading rating options');
    }
  }

  // Handle rating selection
  bot.action(/^pnp_rate_(\d)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const rating = parseInt(ctx.match[1]);
      
      // Store rating in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.rating = rating;
      await ctx.saveSession();
      
      // Show comments input
      await showCommentsInput(ctx, lang);
    } catch (error) {
      logger.error('Error selecting rating:', error);
      await ctx.answerCbQuery('❌ Error selecting rating');
    }
  });

  // Show comments input
  async function showCommentsInput(ctx, lang) {
    try {
      const { feedbackBookingId, rating } = ctx.session.pnpLive || {};
      if (!feedbackBookingId || !rating) {
        throw new Error('Feedback booking or rating not set');
      }

      const booking = await PNPLiveService.getBookingById(feedbackBookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await ModelService.getModelById(booking.model_id);
      
      // Store step in session
      ctx.session.pnpLive.feedbackStep = 'comments';
      await ctx.saveSession();

      const stars = '⭐'.repeat(rating);
      const message = lang === 'es'
        ? `💬 *Comentarios sobre tu Experiencia*

🌟 Calificación: ${stars}
📹 Show con ${model?.name || 'modelo'}

*Opcional:* ¿Te gustaría compartir algún comentario sobre tu experiencia?

Envía un mensaje con tus comentarios o escribe "/skip" para omitir.`
        : `💬 *Comments about Your Experience*

🌟 Rating: ${stars}
📹 Show with ${model?.name || 'model'}

*Optional:* Would you like to share any comments about your experience?

Send a message with your comments or type "/skip" to skip.`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', `pnp_feedback_${feedbackBookingId}`)]
        ])
      });
    } catch (error) {
      logger.error('Error showing comments input:', error);
      await ctx.answerCbQuery('❌ Error loading comments input');
    }
  }

  // Handle text input for feedback comments
  bot.on('text', async (ctx, next) => {
    try {
      if (ctx.session.pnpLive?.feedbackStep === 'comments') {
        const lang = getLanguage(ctx);
        const text = ctx.message.text.trim();
        const { feedbackBookingId, rating } = ctx.session.pnpLive || {};
        
        if (!feedbackBookingId || !rating) {
          throw new Error('Feedback booking or rating not set');
        }

        // Submit feedback
        const comments = text === '/skip' ? '' : text;
        const userId = ctx.from.id.toString();
        
        await PNPLiveService.submitFeedback(feedbackBookingId, userId, rating, comments);
        
        // Clean up session
        ctx.session.pnpLive.feedbackStep = null;
        ctx.session.pnpLive.feedbackBookingId = null;
        ctx.session.pnpLive.rating = null;
        await ctx.saveSession();
        
        const message = lang === 'es'
          ? `✅ *¡Gracias por tu Feedback!*

🌟 Calificación: ${'⭐'.repeat(rating)}
💬 Comentarios: ${comments || 'Ninguno'}

Tu feedback ayuda a mejorar PNP Television Live.`
          : `✅ *Thank You for Your Feedback!*

🌟 Rating: ${'⭐'.repeat(rating)}
💬 Comments: ${comments || 'None'}

Your feedback helps improve PNP Television Live.`;
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'es' ? '🔙 Volver a Mis Reservas' : '🔙 Back to My Bookings', 'my_pnp_bookings')]
          ])
        });
        
        return; // Don't call next middleware
      }
      
      return next(); // Continue with other handlers
    } catch (error) {
      logger.error('Error handling feedback comments:', error);
      await ctx.reply('❌ Error processing feedback');
    }
  });

  // Handle refund request
  bot.action(/^pnp_refund_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const bookingId = parseInt(ctx.match[1]);
      const userId = ctx.from.id.toString();
      
      // Store in session
      ctx.session.pnpLive = ctx.session.pnpLive || {};
      ctx.session.pnpLive.refundBookingId = bookingId;
      await ctx.saveSession();
      
      // Show refund reason selection
      await showRefundReasonSelection(ctx, lang, bookingId);
    } catch (error) {
      logger.error('Error starting refund:', error);
      await ctx.answerCbQuery('❌ Error starting refund');
    }
  });

  // Show refund reason selection
  async function showRefundReasonSelection(ctx, lang, bookingId) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await ModelService.getModelById(booking.model_id);
      
      const buttons = [
        [Markup.button.callback(lang === 'es' ? '🚫 Cambio de planes' : '🚫 Change of plans', 'pnp_refund_reason_change')],
        [Markup.button.callback(lang === 'es' ? '⏰ No puedo asistir' : '⏰ Can\'t attend', 'pnp_refund_reason_cant_attend')],
        [Markup.button.callback(lang === 'es' ? '💔 Problema técnico' : '💔 Technical issue', 'pnp_refund_reason_technical')],
        [Markup.button.callback(lang === 'es' ? '📝 Otro motivo' : '📝 Other reason', 'pnp_refund_reason_other')],
        [Markup.button.callback(lang === 'es' ? '🔙 Volver' : '🔙 Back', 'my_pnp_bookings')]
      ];

      const message = lang === 'es'
        ? `💸 *Solicitar Reembolso - PNP Television Live*

📹 Show con ${model?.name || 'modelo'}
📅 ${new Date(booking.booking_time).toLocaleString()}

*Selecciona el motivo del reembolso:*

📝 *Nota:* Los reembolsos solo están disponibles dentro de los primeros 15 minutos después de la hora de inicio del show.`
        : `💸 *Request Refund - PNP Television Live*

📹 Show with ${model?.name || 'model'}
📅 ${new Date(booking.booking_time).toLocaleString()}

*Select refund reason:*

📝 *Note:* Refunds are only available within the first 15 minutes after the show start time.`;

      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (error) {
      logger.error('Error showing refund reason selection:', error);
      await ctx.answerCbQuery('❌ Error loading refund options');
    }
  }

  // Handle refund reason selection
  bot.action(/^pnp_refund_reason_(\w+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = getLanguage(ctx);
      const reasonType = ctx.match[1];
      const { refundBookingId } = ctx.session.pnpLive || {};
      
      if (!refundBookingId) {
        throw new Error('Refund booking not set');
      }

      // Map reason type to text
      const reasonMap = {
        change: lang === 'es' ? 'Cambio de planes' : 'Change of plans',
        cant_attend: lang === 'es' ? 'No puedo asistir' : 'Can\'t attend',
        technical: lang === 'es' ? 'Problema técnico' : 'Technical issue',
        other: lang === 'es' ? 'Otro motivo' : 'Other reason'
      };

      const reason = reasonMap[reasonType] || 'Other reason';
      const userId = ctx.from.id.toString();
      
      // Request refund
      await PNPLiveService.requestRefund(refundBookingId, userId, reason);
      
      // Clean up session
      ctx.session.pnpLive.refundBookingId = null;
      await ctx.saveSession();
      
      const message = lang === 'es'
        ? `✅ *Solicitud de Reembolso Enviada*

💸 Motivo: ${reason}
📅 Show: ${new Date(new Date(refundBookingId).getTime()).toLocaleString()}

📝 *Tu solicitud será procesada en las próximas 24 horas.*
💬 *Recibirás una notificación cuando se procese.*`
        : `✅ *Refund Request Submitted*

💸 Reason: ${reason}
📅 Show: ${new Date(new Date(refundBookingId).getTime()).toLocaleString()}

📝 *Your request will be processed within the next 24 hours.*
💬 *You will receive a notification when processed.*`;
      
      await safeEditMessage(ctx, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Volver a Mis Reservas' : '🔙 Back to My Bookings', 'my_pnp_bookings')]
        ])
      });
    } catch (error) {
      logger.error('Error processing refund request:', error);
      await ctx.answerCbQuery('❌ Error: ' + error.message);
    }
  });
};

module.exports = registerPNPLiveHandlers;