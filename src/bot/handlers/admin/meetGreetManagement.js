const { Markup } = require('telegraf');
const ModelService = require('../../services/modelService');
const AvailabilityService = require('../../services/availabilityService');
const AdminAvailabilityService = require('../../services/adminAvailabilityService');
const MeetGreetTimeSlotService = require('../../services/meetGreetTimeSlotService');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Admin Meet & Greet Management Handler
 * Complete admin interface for managing Meet & Greet models, availability, and bookings
 */

const registerMeetGreetManagementHandlers = (bot) => {
  
  /**
   * Main Meet & Greet management menu
   */
  bot.action('admin_meet_greet', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
          callback_data: 'mg_add_model'
        }],
        [{
          text: lang === 'es' ? '📋 Ver Todos los Modelos' : '📋 View All Models',
          callback_data: 'mg_view_models'
        }],
        [{
          text: lang === 'es' ? '📅 Gestionar Disponibilidad' : '📅 Manage Availability',
          callback_data: 'mg_manage_availability'
        }],
        [{
          text: lang === 'es' ? '📊 Estadísticas' : '📊 Statistics',
          callback_data: 'mg_statistics'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_home'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '💃 **Gestión de Meet & Greet**\n\nAdministra modelos, disponibilidad y reservas.' : '💃 **Meet & Greet Management**\n\nManage models, availability, and bookings.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in admin_meet_greet:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Add new model - Step 1: Name
   */
  bot.action('mg_add_model', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Initialize session data
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.newModel = {};
      ctx.session.meetGreetAdmin.step = 'name';
      
      await ctx.editMessageText(
        lang === 'es' ? '📛 **Agregar Nuevo Modelo**\n\nPaso 1/5: Ingresa el nombre del modelo:' : '📛 **Add New Model**\n\nStep 1/5: Enter the model\'s name:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: 'admin_meet_greet'
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_add_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle text input for model creation
   */
  bot.on('text', async (ctx, next) => {
    try {
      if (ctx.chat?.type && ctx.chat.type !== 'private') return next();
      if (!ctx.session.meetGreetAdmin || !ctx.session.meetGreetAdmin.step) {
        return next();
      }

      const lang = getLanguage(ctx);
      const step = ctx.session.meetGreetAdmin.step;
      const text = ctx.message.text.trim();

      switch (step) {
        case 'name':
          ctx.session.meetGreetAdmin.newModel.name = text;
          ctx.session.meetGreetAdmin.step = 'username';
          await ctx.reply(
            lang === 'es' ? '📝 **Paso 2/5: Nombre de Usuario**\n\nIngresa el nombre de usuario de Telegram (sin @):' : '📝 **Step 2/5: Username**\n\nEnter the Telegram username (without @):',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'username':
          ctx.session.meetGreetAdmin.newModel.username = text;
          ctx.session.meetGreetAdmin.step = 'bio';
          await ctx.reply(
            lang === 'es' ? '📄 **Paso 3/5: Biografía**\n\nIngresa una breve biografía (máx 200 caracteres):' : '📄 **Step 3/5: Bio**\n\nEnter a short bio (max 200 characters):',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'bio':
          ctx.session.meetGreetAdmin.newModel.bio = text.substring(0, 200);
          ctx.session.meetGreetAdmin.step = 'photo';
          await ctx.reply(
            lang === 'es' ? '📸 **Paso 4/5: Foto de Perfil**\n\nEnvía una foto de perfil para el modelo:' : '📸 **Step 4/5: Profile Photo**\n\nSend a profile photo for the model:',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'availability_date':
          // Handle date input for availability
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(text)) {
            await ctx.reply(lang === 'es' ? '❌ Formato de fecha inválido. Usa YYYY-MM-DD.' : '❌ Invalid date format. Use YYYY-MM-DD.');
            return;
          }
          
          ctx.session.meetGreetAdmin.availabilityDate = text;
          ctx.session.meetGreetAdmin.step = 'availability_time';
          await ctx.reply(
            lang === 'es' ? '⏰ **Paso 5/5: Horario de Disponibilidad**\n\nIngresa el horario en formato HH:MM-HH:MM (ej: 09:00-17:00):' : '⏰ **Step 5/5: Availability Time**\n\nEnter the time range in format HH:MM-HH:MM (e.g., 09:00-17:00):',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'availability_time':
          // Handle time range input
          const timeRegex = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;
          if (!timeRegex.test(text)) {
            await ctx.reply(lang === 'es' ? '❌ Formato de horario inválido. Usa HH:MM-HH:MM.' : '❌ Invalid time format. Use HH:MM-HH:MM.');
            return;
          }
          
          const [startTime, endTime] = text.split('-');
          const date = ctx.session.meetGreetAdmin.availabilityDate;
          
          // Create Date objects
          const startDateTime = new Date(`${date}T${startTime}:00`);
          const endDateTime = new Date(`${date}T${endTime}:00`);
          
          if (startDateTime >= endDateTime) {
            await ctx.reply(lang === 'es' ? '❌ La hora de inicio debe ser antes que la hora de fin.' : '❌ Start time must be before end time.');
            return;
          }
          
          // Store availability
          ctx.session.meetGreetAdmin.newModel.availability = [{
            from: startDateTime,
            to: endDateTime
          }];
          
          // Create the model
          await createNewModel(ctx, lang);
          break;
      }
    } catch (error) {
      logger.error('Error in text handler for Meet & Greet model creation:', error);
      await ctx.reply('❌ Error processing input');
    }
  });

  /**
   * Handle photo upload for model
   */
  bot.on('photo', async (ctx) => {
    try {
      if (ctx.session.meetGreetAdmin?.step !== 'photo') return;

      const lang = getLanguage(ctx);
      const file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file_path = await ctx.telegram.getFile(file_id);
      const download_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path.file_path}`;

      ctx.session.meetGreetAdmin.newModel.profile_image_url = download_url;
      ctx.session.meetGreetAdmin.step = 'availability_date';

      await ctx.reply(
        lang === 'es' ? '📅 **Paso 5/5: Disponibilidad**\n\nIngresa la fecha para la disponibilidad (YYYY-MM-DD):' : '📅 **Step 5/5: Availability**\n\nEnter the date for availability (YYYY-MM-DD):',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error handling photo upload for Meet & Greet:', error);
      await ctx.reply('❌ Error uploading photo');
    }
  });

  /**
   * Create new model in database
   */
  async function createNewModel(ctx, lang) {
    try {
      const newModel = ctx.session.meetGreetAdmin.newModel;

      if (!newModel.name || !newModel.username) {
        await ctx.reply(lang === 'es' ? '❌ Faltan campos obligatorios' : '❌ Missing required fields');
        return;
      }

      // Create model
      const createdModel = await ModelService.createModel({
        name: newModel.name,
        username: newModel.username,
        bio: newModel.bio || '',
        profile_image_url: newModel.profile_image_url || '',
        is_active: true
      });

      // Add availability if provided
      if (newModel.availability && newModel.availability.length > 0) {
        for (const avail of newModel.availability) {
          await AvailabilityService.addAvailability(
            createdModel.id,
            avail.from,
            avail.to
          );
        }
      }

      // Clean up session
      ctx.session.meetGreetAdmin = null;

      const keyboard = [
        [{
          text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
          callback_data: `mg_view_model_${createdModel.id}`
        }],
        [{
          text: lang === 'es' ? '➕ Agregar Otro' : '➕ Add Another',
          callback_data: 'mg_add_model'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_meet_greet'
        }]
      ];

      await ctx.reply(
        lang === 'es' ? `✅ **Modelo Creado Exitosamente!**\n\n📛 **${createdModel.name}**\n📅 Disponibilidad: ${createdModel.availability ? 'Configurada' : 'Sin configurar'}` : `✅ **Model Created Successfully!**\n\n📛 **${createdModel.name}**\n📅 Availability: ${createdModel.availability ? 'Configured' : 'Not configured'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      // Remove answerCbQuery() as this is a message context, not a callback query context
      // await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error creating new Meet & Greet model:', error);
      await ctx.reply(lang === 'es' ? '❌ Error creando el modelo' : '❌ Error creating model');
    }
  }

  /**
   * View all models
   */
  bot.action('mg_view_models', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const models = await ModelService.getAllActiveModels();

      if (models.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
            callback_data: 'mg_add_model'
          }],
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_meet_greet'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '📋 **Todos los Modelos**\n\nNo hay modelos disponibles.' : '📋 **All Models**\n\nNo models available.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }

      // Create model buttons (2 per row)
      const buttons = [];
      for (let i = 0; i < models.length; i += 2) {
        const row = [];
        for (let j = 0; j < 2 && i + j < models.length; j++) {
          const model = models[i + j];
          row.push({
            text: `${model.name} ${model.is_active ? '🟢' : '⚪'}`,
            callback_data: `mg_view_model_${model.id}`
          });
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_meet_greet'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '📋 **Todos los Modelos**\n\nSelecciona un modelo para ver detalles:' : '📋 **All Models**\n\nSelect a model to view details:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_view_models:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * View model details
   */
  bot.action(/^mg_view_model_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Get availability
      const availability = await AvailabilityService.getAvailability(modelId);
      const availabilityText = availability.length > 0
        ? availability.map(a => {
            const start = new Date(a.available_from).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const end = new Date(a.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${start} - ${end}`;
          }).join('\n')
        : lang === 'es' ? 'Sin disponibilidad configurada' : 'No availability configured';

      const keyboard = [
        [{
          text: model.is_active 
            ? (lang === 'es' ? '❌ Desactivar' : '❌ Deactivate') 
            : (lang === 'es' ? '✅ Activar' : '✅ Activate'),
          callback_data: `mg_toggle_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '⏱️ Gestionar Disponibilidad' : '⏱️ Manage Availability',
          callback_data: `mg_manage_model_availability_${model.id}`
        }],
        [{
          text: lang === 'es' ? '✏️ Editar Modelo' : '✏️ Edit Model',
          callback_data: `mg_edit_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Modelo' : '🗑️ Delete Model',
          callback_data: `mg_delete_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_view_models'
        }]
      ];

      await ctx.editMessageText(
        `👤 **${model.name}**\n\n` +
        `📛 Username: @${model.username}\n` +
        `📝 Bio: ${model.bio || lang === 'es' ? 'Sin bio' : 'No bio'}\n` +
        `📅 **Disponibilidad:**\n${availabilityText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_view_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Toggle model active status
   */
  bot.action(/^mg_toggle_model_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Toggle status
      const newStatus = !model.is_active;
      await ModelService.updateModel(modelId, { is_active: newStatus });

      await ctx.answerCbQuery(newStatus 
        ? (lang === 'es' ? '✅ Modelo activado' : '✅ Model activated')
        : (lang === 'es' ? '❌ Modelo desactivado' : '❌ Model deactivated'));

      // Refresh view by showing the model details directly
      const m = await ModelService.getModelById(modelId);
      const availability = await AvailabilityService.getAvailability(modelId);
      
      const availText = availability.length > 0
        ? availability.map(a => {
            const start = new Date(a.available_from).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const end = new Date(a.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${start} - ${end}`;
          }).join('\n')
        : lang === 'es' ? 'Sin disponibilidad configurada' : 'No availability configured';

      const keyboard = [
        [{
          text: m.is_active 
            ? (lang === 'es' ? '❌ Desactivar' : '❌ Deactivate') 
            : (lang === 'es' ? '✅ Activar' : '✅ Activate'),
          callback_data: `mg_toggle_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '⏱️ Gestionar Disponibilidad' : '⏱️ Manage Availability',
          callback_data: `mg_manage_model_availability_${m.id}`
        }],
        [{
          text: lang === 'es' ? '✏️ Editar Modelo' : '✏️ Edit Model',
          callback_data: `mg_edit_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Modelo' : '🗑️ Delete Model',
          callback_data: `mg_delete_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_view_models'
        }]
      ];

      await ctx.editMessageText(
        `👤 **${m.name}**\n\n` +
        `📛 Username: @${m.username}\n` +
        `📝 Bio: ${m.bio || lang === 'es' ? 'Sin bio' : 'No bio'}\n` +
        `📅 **Disponibilidad:**\n${availText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      logger.error('Error toggling model status:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Manage model availability
   */
  bot.action(/^mg_manage_model_availability_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Store in session for availability management
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.managingModelId = modelId;

      const availability = await AvailabilityService.getAvailability(modelId);
      const availabilityText = availability.length > 0
        ? availability.map((a, index) => {
            const start = new Date(a.available_from).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const end = new Date(a.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${index + 1}. ${start} - ${end} [${a.is_booked ? (lang === 'es' ? 'Reservado' : 'Booked') : (lang === 'es' ? 'Disponible' : 'Available')}]`;
          }).join('\n')
        : lang === 'es' ? 'Sin disponibilidad configurada' : 'No availability configured';

      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Marco de Tiempo' : '➕ Add Time Frame',
          callback_data: `mg_add_time_frame_${modelId}`
        }],
        [{
          text: lang === 'es' ? '📅 Ver Disponibilidad' : '📅 View Availability',
          callback_data: `mg_view_availability_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Disponibilidad' : '🗑️ Delete Availability',
          callback_data: `mg_delete_availability_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: `mg_view_model_${modelId}`
        }]
      ];

      await ctx.editMessageText(
        `⏱️ **Disponibilidad de ${model.name}**\n\n` +
        `📅 **Horarios Configurados:**\n${availabilityText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_manage_model_availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Add time frame for availability (NEW IMPROVED METHOD)
   */
  bot.action(/^mg_add_time_frame_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Store in session
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.addingTimeFrameFor = modelId;
      ctx.session.meetGreetAdmin.timeFrameStep = 'date';

      // Show suggested time frames
      const suggestedFrames = AdminAvailabilityService.getSuggestedTimeFrames();
      
      const keyboard = suggestedFrames.map(frame => [{
        text: lang === 'es' ? `🕒 ${frame.name}` : `🕒 ${frame.name}`,
        callback_data: `mg_suggested_frame_${modelId}_${frame.startHour}_${frame.endHour}`
      }]);

      keyboard.push([{
        text: lang === 'es' ? '📅 Personalizado' : '📅 Custom',
        callback_data: `mg_custom_time_frame_${modelId}`
      }]);

      keyboard.push([{
        text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
        callback_data: `mg_manage_model_availability_${modelId}`
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '🕒 **Agregar Marco de Tiempo**\n\nSelecciona un marco de tiempo sugerido o personaliza:' : '🕒 **Add Time Frame**\n\nSelect a suggested time frame or customize:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_add_time_frame:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle suggested time frame selection
   */
  bot.action(/^mg_suggested_frame_(\d+)_(\d+)_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const startHour = parseInt(ctx.match[2]);
      const endHour = parseInt(ctx.match[3]);

      // Get today's date
      const today = new Date();
      
      // Set to next valid day (Thursday-Monday)
      let startDate = new Date(today);
      while (!MeetGreetTimeSlotService.isDayInWindow(startDate)) {
        startDate.setDate(startDate.getDate() + 1);
      }

      // Set hours
      startDate.setHours(startHour, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(endHour, 0, 0, 0);

      // Validate
      const validation = AdminAvailabilityService.validateTimeFrame(startDate, endDate);
      
      if (!validation.valid) {
        await ctx.answerCbQuery(lang === 'es' ? 'Marco de tiempo inválido' : 'Invalid time frame');
        return;
      }

      // Create availability
      const slots = await AdminAvailabilityService.createAvailabilityForTimeFrame(modelId, startDate, endDate);

      await ctx.answerCbQuery(lang === 'es' ? `✅ ${slots.length} slots creados` : `✅ ${slots.length} slots created`);

      // Refresh view by showing availability management directly
      const m = await ModelService.getModelById(modelId);
      const availability = await AvailabilityService.getAvailability(modelId);
      
      const availText = availability.length > 0
        ? availability.map((a, index) => {
            const start = new Date(a.available_from).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const end = new Date(a.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${index + 1}. ${start} - ${end} [${a.is_booked ? (lang === 'es' ? 'Reservado' : 'Booked') : (lang === 'es' ? 'Disponible' : 'Available')}]`;
          }).join('\n')
        : lang === 'es' ? 'Sin disponibilidad configurada' : 'No availability configured';

      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Marco de Tiempo' : '➕ Add Time Frame',
          callback_data: `mg_add_time_frame_${modelId}`
        }],
        [{
          text: lang === 'es' ? '📅 Ver Disponibilidad' : '📅 View Availability',
          callback_data: `mg_view_availability_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Disponibilidad' : '🗑️ Delete Availability',
          callback_data: `mg_delete_availability_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: `mg_view_model_${modelId}`
        }]
      ];

      await ctx.editMessageText(
        `⏱️ **Disponibilidad de ${m.name}**\n\n` +
        `📅 **Horarios Configurados:**\n${availText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      logger.error('Error in mg_suggested_frame:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle custom time frame selection
   */
  bot.action(/^mg_custom_time_frame_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);

      // Store in session
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.addingTimeFrameFor = modelId;
      ctx.session.meetGreetAdmin.timeFrameStep = 'date';

      await ctx.editMessageText(
        lang === 'es' ? '📅 **Marco de Tiempo Personalizado**\n\nIngresa la fecha (YYYY-MM-DD):' : '📅 **Custom Time Frame**\n\nEnter the date (YYYY-MM-DD):',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: `mg_manage_model_availability_${modelId}`
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_custom_time_frame:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * View availability in calendar format
   */
  bot.action(/^mg_view_availability_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Get availability data
      const adminService = require('../../services/adminAvailabilityService');
      const availabilityData = await adminService.getAvailabilityForAdminInterface(modelId);

      // Format availability by date
      const availabilityText = availabilityData.availability.map(day => {
        const slotsText = day.slots.map(slot => {
          const start = new Date(slot.start).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          const end = new Date(slot.end).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          return `• ${start}-${end} (${slot.duration}min) ${slot.isBooked ? (lang === 'es' ? '[Reservado]' : '[Booked]') : (lang === 'es' ? '[Disponible]' : '[Available]')}`;
        }).join('\n');

        return `📅 **${day.dayName}, ${day.dateStr}**\n${slotsText}`;
      }).join('\n\n');

      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Marco de Tiempo' : '➕ Add Time Frame',
          callback_data: `mg_add_time_frame_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Disponibilidad' : '🗑️ Delete Availability',
          callback_data: `mg_delete_availability_${modelId}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: `mg_manage_model_availability_${modelId}`
        }]
      ];

      await ctx.editMessageText(
        `📅 **Calendario de Disponibilidad - ${model.name}**\n\n` +
        `📊 **Estadísticas:**\n` +
        `• Total: ${availabilityData.totalSlots} slots\n` +
        `• Disponibles: ${availabilityData.availableSlots} slots\n` +
        `• Reservados: ${availabilityData.bookedSlots} slots\n\n` +
        `📅 **Disponibilidad por Día:**\n${availabilityText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_view_availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Add availability for model
   */
  bot.action(/^mg_add_availability_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      
      // Store in session
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.addingAvailabilityFor = modelId;
      ctx.session.meetGreetAdmin.availabilityStep = 'date';

      await ctx.editMessageText(
        lang === 'es' ? '📅 **Agregar Disponibilidad**\n\nIngresa la fecha (YYYY-MM-DD):' : '📅 **Add Availability**\n\nEnter the date (YYYY-MM-DD):',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: `mg_manage_model_availability_${modelId}`
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_add_availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle availability date input
   */
  bot.action(/^mg_delete_availability_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const availability = await AvailabilityService.getAvailability(modelId);

      if (availability.length === 0) {
        await ctx.answerCbQuery(lang === 'es' ? 'No hay disponibilidad para eliminar' : 'No availability to delete');
        return;
      }

      // Show list of availability slots to delete
      const keyboard = availability.map((a, index) => [{
        text: `${index + 1}. ${new Date(a.available_from).toLocaleString()} - ${new Date(a.available_to).toLocaleTimeString()}`,
        callback_data: `mg_confirm_delete_avail_${a.id}`
      }]);

      keyboard.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: `mg_manage_model_availability_${modelId}`
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '🗑️ **Eliminar Disponibilidad**\n\nSelecciona un horario para eliminar:' : '🗑️ **Delete Availability**\n\nSelect a time slot to delete:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_delete_availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Confirm delete availability
   */
  bot.action(/^mg_confirm_delete_avail_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const availabilityId = parseInt(ctx.match[1]);
      const availability = await AvailabilityService.getAvailabilityById(availabilityId);

      if (!availability) {
        await ctx.answerCbQuery(lang === 'es' ? 'Disponibilidad no encontrada' : 'Availability not found');
        return;
      }

      if (availability.is_booked) {
        await ctx.answerCbQuery(lang === 'es' ? '❌ No se puede eliminar disponibilidad reservada' : '❌ Cannot delete booked availability');
        return;
      }

      // Delete availability
      await AvailabilityService.deleteAvailability(availabilityId);

      await ctx.answerCbQuery(lang === 'es' ? '✅ Disponibilidad eliminada' : '✅ Availability deleted');

      // Refresh view by showing availability management directly
      const mId = availability.model_id;
      const m = await ModelService.getModelById(mId);
      const avail = await AvailabilityService.getAvailability(mId);
      
      const availText = avail.length > 0
        ? avail.map((a, index) => {
            const start = new Date(a.available_from).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const end = new Date(a.available_to).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${index + 1}. ${start} - ${end} [${a.is_booked ? (lang === 'es' ? 'Reservado' : 'Booked') : (lang === 'es' ? 'Disponible' : 'Available')}]`;
          }).join('\n')
        : lang === 'es' ? 'Sin disponibilidad configurada' : 'No availability configured';

      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Disponibilidad' : '➕ Add Availability',
          callback_data: `mg_add_availability_${mId}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Disponibilidad' : '🗑️ Delete Availability',
          callback_data: `mg_delete_availability_${mId}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: `mg_view_model_${mId}`
        }]
      ];

      await ctx.editMessageText(
          `⏱️ **Disponibilidad de ${m.name}**\n\n` +
          `📅 **Horarios Configurados:**\n${availText}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
    } catch (error) {
      logger.error('Error confirming delete availability:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Edit model
   */
  bot.action(/^mg_edit_model_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Store in session
      ctx.session.meetGreetAdmin = ctx.session.meetGreetAdmin || {};
      ctx.session.meetGreetAdmin.editingModel = model;
      ctx.session.meetGreetAdmin.editStep = 'name';

      await ctx.editMessageText(
        lang === 'es' ? `✏️ **Editar Modelo: ${model.name}**\n\nPaso 1/4: Nuevo nombre (actual: ${model.name}):` : `✏️ **Edit Model: ${model.name}**\n\nStep 1/4: New name (current: ${model.name}):`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: `mg_view_model_${modelId}`
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_edit_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle edit steps
   */
  bot.on('text', async (ctx, next) => {
    try {
      if (ctx.chat?.type && ctx.chat.type !== 'private') return next();
      if (!ctx.session.meetGreetAdmin || !ctx.session.meetGreetAdmin.editStep) {
        return next();
      }

      const lang = getLanguage(ctx);
      const step = ctx.session.meetGreetAdmin.editStep;
      const text = ctx.message.text.trim();
      const model = ctx.session.meetGreetAdmin.editingModel;

      switch (step) {
        case 'name':
          model.name = text;
          ctx.session.meetGreetAdmin.editStep = 'username';
          await ctx.reply(
            lang === 'es' ? `Paso 2/4: Nuevo username (actual: @${model.username}):` : `Step 2/4: New username (current: @${model.username}):`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'username':
          model.username = text;
          ctx.session.meetGreetAdmin.editStep = 'bio';
          await ctx.reply(
            lang === 'es' ? `Paso 3/4: Nueva bio (actual: ${model.bio || 'Sin bio'}):` : `Step 3/4: New bio (current: ${model.bio || 'No bio'}):`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'bio':
          model.bio = text.substring(0, 200);
          ctx.session.meetGreetAdmin.editStep = 'photo';
          await ctx.reply(
            lang === 'es' ? 'Paso 4/4: Envía una nueva foto de perfil o escribe "skip" para mantener la actual:' : 'Step 4/4: Send a new profile photo or type "skip" to keep current:',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'photo':
          if (text.toLowerCase() === 'skip') {
            // Save changes
            await ModelService.updateModel(model.id, {
              name: model.name,
              username: model.username,
              bio: model.bio
            });

            ctx.session.meetGreetAdmin = null;

            const keyboard = [
              [{
                text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
                callback_data: `mg_view_model_${model.id}`
              }],
              [{
                text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
                callback_data: 'mg_view_models'
              }]
            ];

            await ctx.reply(
              lang === 'es' ? `✅ **Modelo Actualizado!**\n\n📛 **${model.name}**\n📝 Cambios guardados exitosamente.` : `✅ **Model Updated!**\n\n📛 **${model.name}**\n📝 Changes saved successfully.`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: keyboard
                }
              }
            );
          } else {
            await ctx.reply(lang === 'es' ? '❌ Respuesta inválida. Escribe "skip" o envía una foto.' : '❌ Invalid response. Type "skip" or send a photo.');
          }
          break;
      }
    } catch (error) {
      logger.error('Error in edit text handler:', error);
      await ctx.reply('❌ Error processing input');
    }
  });

  /**
   * Handle photo upload for edit
   */
  bot.on('photo', async (ctx) => {
    try {
      if (ctx.session.meetGreetAdmin?.editStep !== 'photo') return;

      const lang = getLanguage(ctx);
      const file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file_path = await ctx.telegram.getFile(file_id);
      const download_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path.file_path}`;

      const model = ctx.session.meetGreetAdmin.editingModel;
      model.profile_image_url = download_url;

      // Save changes
      await ModelService.updateModel(model.id, {
        name: model.name,
        username: model.username,
        bio: model.bio,
        profile_image_url: model.profile_image_url
      });

      ctx.session.meetGreetAdmin = null;

      const keyboard = [
        [{
          text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
          callback_data: `mg_view_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_view_models'
        }]
      ];

      await ctx.reply(
        lang === 'es' ? `✅ **Modelo Actualizado!**\n\n📛 **${model.name}**\n📝 Cambios guardados exitosamente.` : `✅ **Model Updated!**\n\n📛 **${model.name}**\n📝 Changes saved successfully.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      logger.error('Error handling photo upload for edit:', error);
      await ctx.reply('❌ Error uploading photo');
    }
  });

  /**
   * Delete model
   */
  bot.action(/^mg_delete_model_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Confirm deletion
      const keyboard = [
        [{
          text: lang === 'es' ? '✅ Sí, Eliminar' : '✅ Yes, Delete',
          callback_data: `mg_confirm_delete_${modelId}`
        }],
        [{
          text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
          callback_data: `mg_view_model_${modelId}`
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? `🗑️ **Eliminar Modelo**\n\n¿Estás seguro de eliminar a ${model.name}? Esta acción no se puede deshacer.` : `🗑️ **Delete Model**\n\nAre you sure you want to delete ${model.name}? This action cannot be undone.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_delete_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Confirm delete model
   */
  bot.action(/^mg_confirm_delete_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);

      // Delete model (soft delete)
      await ModelService.deleteModel(modelId);

      await ctx.answerCbQuery(lang === 'es' ? '✅ Modelo eliminado' : '✅ Model deleted');

      // Refresh models list by calling the view models function directly
      const models = await ModelService.getAllActiveModels();
      
      if (models.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
            callback_data: 'mg_add_model'
          }],
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_meet_greet'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '📋 **Todos los Modelos**\n\nNo hay modelos disponibles.' : '📋 **All Models**\n\nNo models available.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }

      // Create model buttons (2 per row)
      const buttons = [];
      for (let i = 0; i < models.length; i += 2) {
        const row = [];
        for (let j = 0; j < 2 && i + j < models.length; j++) {
          const model = models[i + j];
          row.push({
            text: `${model.name} ${model.is_active ? '🟢' : '⚪'}`,
            callback_data: `mg_view_model_${model.id}`
          });
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_meet_greet'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '📋 **Todos los Modelos**\n\nSelecciona un modelo para ver detalles:' : '📋 **All Models**\n\nSelect a model to view details:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error confirming delete model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show statistics
   */
  bot.action('mg_statistics', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // This would integrate with MeetGreetService statistics
      // For now, show placeholder
      const keyboard = [
        [{
          text: lang === 'es' ? '📊 Resumen General' : '📊 General Summary',
          callback_data: 'mg_stats_summary'
        }],
        [{
          text: lang === 'es' ? '💰 Ingresos por Modelo' : '💰 Revenue by Model',
          callback_data: 'mg_stats_revenue'
        }],
        [{
          text: lang === 'es' ? '📅 Reservas Recientes' : '📅 Recent Bookings',
          callback_data: 'mg_stats_bookings'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_meet_greet'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '📊 **Estadísticas de Meet & Greet**\n\nSelecciona el tipo de estadísticas:' : '📊 **Meet & Greet Statistics**\n\nSelect statistics type:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_statistics:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show general statistics summary
   */
  bot.action('mg_stats_summary', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Placeholder - would integrate with actual statistics
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_statistics'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '📊 **Resumen General**\n\n*Total de Reservas:* 42\n*Ingresos Totales:* $2,500\n*Modelos Activos:* 8\n*Tasa de Conversión:* 65%' : '📊 **General Summary**\n\n*Total Bookings:* 42\n*Total Revenue:* $2,500\n*Active Models:* 8\n*Conversion Rate:* 65%',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_stats_summary:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show revenue by model
   */
  bot.action('mg_stats_revenue', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Placeholder - would integrate with actual statistics
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_statistics'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '💰 **Ingresos por Modelo**\n\n1. Maria - $800\n2. Sofia - $650\n3. Laura - $500\n4. Ana - $350\n5. Carla - $200' : '💰 **Revenue by Model**\n\n1. Maria - $800\n2. Sofia - $650\n3. Laura - $500\n4. Ana - $350\n5. Carla - $200',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_stats_revenue:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show recent bookings
   */
  bot.action('mg_stats_bookings', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Placeholder - would integrate with actual bookings
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'mg_statistics'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '📅 **Reservas Recientes**\n\n1. Maria - 2024-01-15 14:00 - 60 min - $100\n2. Sofia - 2024-01-14 16:30 - 30 min - $60\n3. Laura - 2024-01-13 11:00 - 90 min - $250' : '📅 **Recent Bookings**\n\n1. Maria - 2024-01-15 14:00 - 60 min - $100\n2. Sofia - 2024-01-14 16:30 - 30 min - $60\n3. Laura - 2024-01-13 11:00 - 90 min - $250',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in mg_stats_bookings:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });
};

module.exports = registerMeetGreetManagementHandlers;
