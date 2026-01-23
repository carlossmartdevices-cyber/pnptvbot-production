const { Markup } = require('telegraf');
const ModelService = require('../../services/modelService');
const AvailabilityService = require('../../services/availabilityService');
const PNPLiveService = require('../../services/pnpLiveService');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const { query } = require('../../config/postgres');

/**
 * Admin PNP Television Live Management Handler
 * Complete admin interface for managing PNP Television Live models, availability, and bookings
 */

const registerPNPLiveManagementHandlers = (bot) => {
  
  /**
   * Main PNP Live management menu
   */
  bot.action('admin_pnp_live', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const keyboard = [
        [{
          text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
          callback_data: 'pnplive_add_model'
        }],
        [{
          text: lang === 'es' ? '📋 Ver Todos los Modelos' : '📋 View All Models',
          callback_data: 'pnplive_view_models'
        }],
        [{
          text: lang === 'es' ? '📊 Estadísticas' : '📊 Statistics',
          callback_data: 'pnplive_statistics'
        }],
        [{
          text: lang === 'es' ? '💸 Solicitudes de Reembolso' : '💸 Refund Requests',
          callback_data: 'pnplive_refund_requests'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_home'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '📹 **Gestión de PNP Television Live**\n\nAdministra modelos, disponibilidad, reservas y reembolsos.' : '📹 **PNP Television Live Management**\n\nManage models, availability, bookings, and refunds.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in admin_pnp_live:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Add new model - Step 1: Name
   */
  bot.action('pnplive_add_model', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Initialize session data
      ctx.session.pnpLiveAdmin = ctx.session.pnpLiveAdmin || {};
      ctx.session.pnpLiveAdmin.newModel = {};
      ctx.session.pnpLiveAdmin.step = 'name';
      
      await ctx.editMessageText(
        lang === 'es' ? '📛 **Agregar Nuevo Modelo - PNP Television Live**\n\nPaso 1/4: Ingresa el nombre del modelo:' : '📛 **Add New Model - PNP Television Live**\n\nStep 1/4: Enter the model\'s name:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: 'admin_pnp_live'
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_add_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle text input for model creation
   */
  bot.on('text', async (ctx, next) => {
    try {
      if (!ctx.session.pnpLiveAdmin || !ctx.session.pnpLiveAdmin.step) {
        return next();
      }

      const lang = getLanguage(ctx);
      const step = ctx.session.pnpLiveAdmin.step;
      const text = ctx.message.text.trim();

      switch (step) {
        case 'name':
          ctx.session.pnpLiveAdmin.newModel.name = text;
          ctx.session.pnpLiveAdmin.step = 'username';
          await ctx.reply(
            lang === 'es' ? '📝 **Paso 2/4: Nombre de Usuario**\n\nIngresa el nombre de usuario de Telegram (sin @):' : '📝 **Step 2/4: Username**\n\nEnter the Telegram username (without @):',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'username':
          ctx.session.pnpLiveAdmin.newModel.username = text;
          ctx.session.pnpLiveAdmin.step = 'bio';
          await ctx.reply(
            lang === 'es' ? '📄 **Paso 3/4: Biografía**\n\nIngresa una breve biografía (máx 200 caracteres):' : '📄 **Step 3/4: Bio**\n\nEnter a short bio (max 200 characters):',
            { parse_mode: 'Markdown' }
          );
          break;

        case 'bio':
          ctx.session.pnpLiveAdmin.newModel.bio = text.substring(0, 200);
          ctx.session.pnpLiveAdmin.step = 'photo';
          await ctx.reply(
            lang === 'es' ? '📸 **Paso 4/4: Foto de Perfil**\n\nEnvía una foto de perfil para el modelo:' : '📸 **Step 4/4: Profile Photo**\n\nSend a profile photo for the model:',
            { parse_mode: 'Markdown' }
          );
          break;
      }
    } catch (error) {
      logger.error('Error in text handler for PNP Live model creation:', error);
      await ctx.reply('❌ Error processing input');
    }
  });

  /**
   * Handle photo upload for model
   */
  bot.on('photo', async (ctx) => {
    try {
      if (ctx.session.pnpLiveAdmin?.step !== 'photo') return;

      const lang = getLanguage(ctx);
      const file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file_path = await ctx.telegram.getFile(file_id);
      const download_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path.file_path}`;

      ctx.session.pnpLiveAdmin.newModel.profile_image_url = download_url;

      // Create the model
      await createNewModel(ctx, lang);
    } catch (error) {
      logger.error('Error handling photo upload for PNP Live:', error);
      await ctx.reply('❌ Error uploading photo');
    }
  });

  /**
   * Create new model in database
   */
  async function createNewModel(ctx, lang) {
    try {
      const newModel = ctx.session.pnpLiveAdmin.newModel;

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

      // Clean up session
      ctx.session.pnpLiveAdmin = null;

      const keyboard = [
        [{
          text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
          callback_data: `pnplive_view_model_${createdModel.id}`
        }],
        [{
          text: lang === 'es' ? '➕ Agregar Otro' : '➕ Add Another',
          callback_data: 'pnplive_add_model'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_pnp_live'
        }]
      ];

      await ctx.reply(
        lang === 'es' ? `✅ **Modelo Creado Exitosamente!**\n\n📛 **${createdModel.name}**\n📅 Disponibilidad: Sin configurar` : `✅ **Model Created Successfully!**\n\n📛 **${createdModel.name}**\n📅 Availability: Not configured`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      logger.error('Error creating new PNP Live model:', error);
      await ctx.reply(lang === 'es' ? '❌ Error creando el modelo' : '❌ Error creating model');
    }
  }

  /**
   * View all models
   */
  bot.action('pnplive_view_models', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const models = await ModelService.getAllActiveModels();

      if (models.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
            callback_data: 'pnplive_add_model'
          }],
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_pnp_live'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '📋 **Todos los Modelos - PNP Television Live**\n\nNo hay modelos disponibles.' : '📋 **All Models - PNP Television Live**\n\nNo models available.',
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
            callback_data: `pnplive_view_model_${model.id}`
          });
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_pnp_live'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '📋 **Todos los Modelos - PNP Television Live**\n\nSelecciona un modelo para ver detalles:' : '📋 **All Models - PNP Television Live**\n\nSelect a model to view details:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_view_models:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * View model details
   */
  bot.action(/^pnplive_view_model_(\d+)$/, async (ctx) => {
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

      // Get online status
      const onlineStatus = await PNPLiveService.getModelOnlineStatus(modelId);
      const statusText = onlineStatus.is_online 
        ? (lang === 'es' ? '🟢 Online ahora' : '🟢 Online now')
        : (lang === 'es' ? '⚪ Offline' : '⚪ Offline');

      const keyboard = [
        [{
          text: model.is_active 
            ? (lang === 'es' ? '❌ Desactivar' : '❌ Deactivate') 
            : (lang === 'es' ? '✅ Activar' : '✅ Activate'),
          callback_data: `pnplive_toggle_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '✏️ Editar Modelo' : '✏️ Edit Model',
          callback_data: `pnplive_edit_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Modelo' : '🗑️ Delete Model',
          callback_data: `pnplive_delete_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_view_models'
        }]
      ];

      await ctx.editMessageText(
        `👤 **${model.name}** ${statusText}\n\n` +
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
      logger.error('Error in pnplive_view_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Toggle model active status
   */
  bot.action(/^pnplive_toggle_model_(\d+)$/, async (ctx) => {
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

      // Refresh view
      const m = await ModelService.getModelById(modelId);
      const availability = await AvailabilityService.getAvailability(modelId);
      const onlineStatus = await PNPLiveService.getModelOnlineStatus(modelId);
      const statusText = onlineStatus.is_online 
        ? (lang === 'es' ? '🟢 Online ahora' : '🟢 Online now')
        : (lang === 'es' ? '⚪ Offline' : '⚪ Offline');
      
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
          callback_data: `pnplive_toggle_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '✏️ Editar Modelo' : '✏️ Edit Model',
          callback_data: `pnplive_edit_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '🗑️ Eliminar Modelo' : '🗑️ Delete Model',
          callback_data: `pnplive_delete_model_${m.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_view_models'
        }]
      ];

      await ctx.editMessageText(
        `👤 **${m.name}** ${statusText}\n\n` +
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
   * Edit model
   */
  bot.action(/^pnplive_edit_model_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);
      const model = await ModelService.getModelById(modelId);

      if (!model) {
        await ctx.answerCbQuery(lang === 'es' ? 'Modelo no encontrado' : 'Model not found');
        return;
      }

      // Store in session
      ctx.session.pnpLiveAdmin = ctx.session.pnpLiveAdmin || {};
      ctx.session.pnpLiveAdmin.editingModel = model;
      ctx.session.pnpLiveAdmin.editStep = 'name';

      await ctx.editMessageText(
        lang === 'es' ? `✏️ **Editar Modelo: ${model.name} - PNP Television Live**\n\nPaso 1/4: Nuevo nombre (actual: ${model.name}):` : `✏️ **Edit Model: ${model.name} - PNP Television Live**\n\nStep 1/4: New name (current: ${model.name}):`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
              callback_data: `pnplive_view_model_${modelId}`
            }]]
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_edit_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Handle edit steps
   */
  bot.on('text', async (ctx, next) => {
    try {
      if (!ctx.session.pnpLiveAdmin || !ctx.session.pnpLiveAdmin.editStep) {
        return next();
      }

      const lang = getLanguage(ctx);
      const step = ctx.session.pnpLiveAdmin.editStep;
      const text = ctx.message.text.trim();
      const model = ctx.session.pnpLiveAdmin.editingModel;

      switch (step) {
        case 'name':
          model.name = text;
          ctx.session.pnpLiveAdmin.editStep = 'username';
          await ctx.reply(
            lang === 'es' ? `Paso 2/4: Nuevo username (actual: @${model.username}):` : `Step 2/4: New username (current: @${model.username}):`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'username':
          model.username = text;
          ctx.session.pnpLiveAdmin.editStep = 'bio';
          await ctx.reply(
            lang === 'es' ? `Paso 3/4: Nueva bio (actual: ${model.bio || 'Sin bio'}):` : `Step 3/4: New bio (current: ${model.bio || 'No bio'}):`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'bio':
          model.bio = text.substring(0, 200);
          ctx.session.pnpLiveAdmin.editStep = 'photo';
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

            ctx.session.pnpLiveAdmin = null;

            const keyboard = [
              [{
                text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
                callback_data: `pnplive_view_model_${model.id}`
              }],
              [{
                text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
                callback_data: 'pnplive_view_models'
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
      if (ctx.session.pnpLiveAdmin?.editStep !== 'photo') return;

      const lang = getLanguage(ctx);
      const file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file_path = await ctx.telegram.getFile(file_id);
      const download_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path.file_path}`;

      const model = ctx.session.pnpLiveAdmin.editingModel;
      model.profile_image_url = download_url;

      // Save changes
      await ModelService.updateModel(model.id, {
        name: model.name,
        username: model.username,
        bio: model.bio,
        profile_image_url: model.profile_image_url
      });

      ctx.session.pnpLiveAdmin = null;

      const keyboard = [
        [{
          text: lang === 'es' ? '👥 Ver Modelo' : '👥 View Model',
          callback_data: `pnplive_view_model_${model.id}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_view_models'
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
  bot.action(/^pnplive_delete_model_(\d+)$/, async (ctx) => {
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
          callback_data: `pnplive_confirm_delete_${modelId}`
        }],
        [{
          text: lang === 'es' ? '❌ Cancelar' : '❌ Cancel',
          callback_data: `pnplive_view_model_${modelId}`
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? `🗑️ **Eliminar Modelo - PNP Television Live**\n\n¿Estás seguro de eliminar a ${model.name}? Esta acción no se puede deshacer.` : `🗑️ **Delete Model - PNP Television Live**\n\nAre you sure you want to delete ${model.name}? This action cannot be undone.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_delete_model:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Confirm delete model
   */
  bot.action(/^pnplive_confirm_delete_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const modelId = parseInt(ctx.match[1]);

      // Delete model (soft delete)
      await ModelService.deleteModel(modelId);

      await ctx.answerCbQuery(lang === 'es' ? '✅ Modelo eliminado' : '✅ Model deleted');

      // Refresh models list
      const models = await ModelService.getAllActiveModels();
      
      if (models.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '➕ Agregar Modelo' : '➕ Add Model',
            callback_data: 'pnplive_add_model'
          }],
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_pnp_live'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '📋 **Todos los Modelos - PNP Television Live**\n\nNo hay modelos disponibles.' : '📋 **All Models - PNP Television Live**\n\nNo models available.',
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
            callback_data: `pnplive_view_model_${model.id}`
          });
        }
        buttons.push(row);
      }

      // Add navigation buttons
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_pnp_live'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '📋 **Todos los Modelos - PNP Television Live**\n\nSelecciona un modelo para ver detalles:' : '📋 **All Models - PNP Television Live**\n\nSelect a model to view details:',
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
  bot.action('pnplive_statistics', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      const keyboard = [
        [{
          text: lang === 'es' ? '📊 Resumen General' : '📊 General Summary',
          callback_data: 'pnplive_stats_summary'
        }],
        [{
          text: lang === 'es' ? '💰 Ingresos por Modelo' : '💰 Revenue by Model',
          callback_data: 'pnplive_stats_revenue'
        }],
        [{
          text: lang === 'es' ? '📅 Reservas Recientes' : '📅 Recent Bookings',
          callback_data: 'pnplive_stats_bookings'
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'admin_pnp_live'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' ? '📊 **Estadísticas de PNP Television Live**\n\nSelecciona el tipo de estadísticas:' : '📊 **PNP Television Live Statistics**\n\nSelect statistics type:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_statistics:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show general statistics summary
   */
  bot.action('pnplive_stats_summary', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Get statistics for last 30 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const stats = await PNPLiveService.getStatistics(startDate, endDate);
      const totalBookings = stats?.total_bookings || 0;
      const completedBookings = stats?.completed_bookings || 0;
      const totalRevenue = stats?.total_revenue || 0;
      const paidRevenue = stats?.paid_revenue || 0;
      
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_statistics'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' 
          ? `📊 **Resumen General - PNP Television Live**\n\n*Últimos 30 días:*\n\n` +
            `📅 *Total de Reservas:* ${totalBookings}\n` +
            `✅ *Shows Completados:* ${completedBookings}\n` +
            `💰 *Ingresos Totales:* $${totalRevenue.toFixed(2)}\n` +
            `💳 *Ingresos Pagados:* $${paidRevenue.toFixed(2)}\n` +
            `📈 *Tasa de Conversión:* ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%`
          : `📊 **General Summary - PNP Television Live**\n\n*Last 30 days:*\n\n` +
            `📅 *Total Bookings:* ${totalBookings}\n` +
            `✅ *Completed Shows:* ${completedBookings}\n` +
            `💰 *Total Revenue:* $${totalRevenue.toFixed(2)}\n` +
            `💳 *Paid Revenue:* $${paidRevenue.toFixed(2)}\n` +
            `📈 *Conversion Rate:* ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_stats_summary:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show revenue by model
   */
  bot.action('pnplive_stats_revenue', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Get statistics for last 30 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const revenueByModel = await PNPLiveService.getRevenueByModel(startDate, endDate);
      
      let message = lang === 'es' 
        ? `💰 **Ingresos por Modelo - PNP Television Live**\n\n*Últimos 30 días:*\n\n`
        : `💰 **Revenue by Model - PNP Television Live**\n\n*Last 30 days:*\n\n`;
      
      if (revenueByModel.length === 0) {
        message += lang === 'es' ? 'No hay datos de ingresos disponibles.' : 'No revenue data available.';
      } else {
        let position = 1;
        for (const modelRev of revenueByModel) {
          message += `${position}. ${modelRev.model_name} - $${modelRev.paid_revenue.toFixed(2)} (${modelRev.booking_count} shows)\n`;
          position++;
        }
      }
      
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_statistics'
        }]
      ];

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_stats_revenue:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show recent bookings
   */
  bot.action('pnplive_stats_bookings', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Get recent bookings (last 10)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      
      const bookings = await PNPLiveService.getBookingsForModel(null); // Get all bookings
      const recentBookings = bookings
        .filter(b => new Date(b.booking_time) >= startDate && new Date(b.booking_time) <= endDate)
        .sort((a, b) => new Date(b.booking_time) - new Date(a.booking_time))
        .slice(0, 10);
      
      let message = lang === 'es' 
        ? `📅 **Reservas Recientes - PNP Television Live**\n\n*Últimos 7 días:*\n\n`
        : `📅 **Recent Bookings - PNP Television Live**\n\n*Last 7 days:*\n\n`;
      
      if (recentBookings.length === 0) {
        message += lang === 'es' ? 'No hay reservas recientes.' : 'No recent bookings.';
      } else {
        for (const booking of recentBookings) {
          const model = await ModelService.getModelById(booking.model_id);
          const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const statusEmoji = booking.status === 'completed' ? '✅' : 
                           booking.status === 'cancelled' ? '❌' : '⏳';
          message += `${statusEmoji} ${startTime} - ${model?.name || 'Model'} (${booking.duration_minutes} min) - $${booking.price_usd}\n`;
        }
      }
      
      const keyboard = [
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_statistics'
        }]
      ];

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_stats_bookings:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Show refund requests
   */
  bot.action('pnplive_refund_requests', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      // Get pending refund requests
      const refundsResult = await query(
        `SELECT r.*, b.user_id, b.model_id, b.duration_minutes, b.price_usd 
         FROM pnp_refunds r
         JOIN pnp_bookings b ON r.booking_id = b.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at DESC`
      );
      
      const refunds = refundsResult.rows || [];
      
      if (refunds.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_pnp_live'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nNo hay solicitudes de reembolso pendientes.' : '💸 **Refund Requests - PNP Television Live**\n\nNo pending refund requests.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }
      
      // Show list of refund requests
      const buttons = [];
      for (const refund of refunds) {
        const model = await ModelService.getModelById(refund.model_id);
        const bookingTime = new Date(refund.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        buttons.push([{
          text: `${bookingTime} - ${model?.name || 'Model'} - $${refund.amount_usd}`,
          callback_data: `pnplive_process_refund_${refund.id}`
        }]);
      }
      
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_pnp_live'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nSelecciona una solicitud para procesar:' : '💸 **Refund Requests - PNP Television Live**\n\nSelect a request to process:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_refund_requests:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Process refund request
   */
  bot.action(/^pnplive_process_refund_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const refundId = parseInt(ctx.match[1]);
      
      // Get refund details
      const refundResult = await query(
        `SELECT r.*, b.user_id, b.model_id, b.duration_minutes, b.price_usd 
         FROM pnp_refunds r
         JOIN pnp_bookings b ON r.booking_id = b.id
         WHERE r.id = $1`,
        [refundId]
      );
      
      if (!refundResult.rows || refundResult.rows.length === 0) {
        await ctx.answerCbQuery(lang === 'es' ? 'Solicitud no encontrada' : 'Request not found');
        return;
      }
      
      const refund = refundResult.rows[0];
      const model = await ModelService.getModelById(refund.model_id);
      
      const keyboard = [
        [{
          text: lang === 'es' ? '✅ Aprobar Reembolso' : '✅ Approve Refund',
          callback_data: `pnplive_approve_refund_${refundId}`
        }],
        [{
          text: lang === 'es' ? '❌ Rechazar Reembolso' : '❌ Reject Refund',
          callback_data: `pnplive_reject_refund_${refundId}`
        }],
        [{
          text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
          callback_data: 'pnplive_refund_requests'
        }]
      ];

      await ctx.editMessageText(
        lang === 'es' 
          ? `💸 **Procesar Reembolso - PNP Television Live**\n\n` +
            `📅 *Fecha de Solicitud:* ${new Date(refund.created_at).toLocaleString()}\n` +
            `👤 *Usuario:* ${refund.user_id}\n` +
            `💃 *Modelo:* ${model?.name || 'Desconocido'}\n` +
            `⏱️ *Duración:* ${refund.duration_minutes} minutos\n` +
            `💰 *Monto:* $${refund.amount_usd}\n` +
            `📝 *Motivo:* ${refund.reason}\n\n` +
            `📝 *Selecciona una acción:*`
          : `💸 **Process Refund - PNP Television Live**\n\n` +
            `📅 *Request Date:* ${new Date(refund.created_at).toLocaleString()}\n` +
            `👤 *User:* ${refund.user_id}\n` +
            `💃 *Model:* ${model?.name || 'Unknown'}\n` +
            `⏱️ *Duration:* ${refund.duration_minutes} minutes\n` +
            `💰 *Amount:* $${refund.amount_usd}\n` +
            `📝 *Reason:* ${refund.reason}\n\n` +
            `📝 *Select an action:*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );

      await ctx.answerCbQuery();
    } catch (error) {
      logger.error('Error in pnplive_process_refund:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Approve refund
   */
  bot.action(/^pnplive_approve_refund_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const refundId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id.toString();
      
      // Process refund
      await PNPLiveService.processRefund(refundId, 'approved', adminId);
      
      await ctx.answerCbQuery(lang === 'es' ? '✅ Reembolso aprobado' : '✅ Refund approved');
      
      // Refresh refund requests list
      const refundsResult = await query(
        `SELECT r.*, b.user_id, b.model_id, b.duration_minutes, b.price_usd 
         FROM pnp_refunds r
         JOIN pnp_bookings b ON r.booking_id = b.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at DESC`
      );
      
      const refunds = refundsResult.rows || [];
      
      if (refunds.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_pnp_live'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nNo hay solicitudes de reembolso pendientes.' : '💸 **Refund Requests - PNP Television Live**\n\nNo pending refund requests.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }
      
      // Show updated list
      const buttons = [];
      for (const refund of refunds) {
        const model = await ModelService.getModelById(refund.model_id);
        const bookingTime = new Date(refund.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        buttons.push([{
          text: `${bookingTime} - ${model?.name || 'Model'} - $${refund.amount_usd}`,
          callback_data: `pnplive_process_refund_${refund.id}`
        }]);
      }
      
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_pnp_live'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nSelecciona una solicitud para procesar:' : '💸 **Refund Requests - PNP Television Live**\n\nSelect a request to process:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error approving refund:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });

  /**
   * Reject refund
   */
  bot.action(/^pnplive_reject_refund_(\d+)$/, async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const refundId = parseInt(ctx.match[1]);
      const adminId = ctx.from.id.toString();
      
      // Process refund
      await PNPLiveService.processRefund(refundId, 'rejected', adminId);
      
      await ctx.answerCbQuery(lang === 'es' ? '❌ Reembolso rechazado' : '❌ Refund rejected');
      
      // Refresh refund requests list
      const refundsResult = await query(
        `SELECT r.*, b.user_id, b.model_id, b.duration_minutes, b.price_usd 
         FROM pnp_refunds r
         JOIN pnp_bookings b ON r.booking_id = b.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at DESC`
      );
      
      const refunds = refundsResult.rows || [];
      
      if (refunds.length === 0) {
        const keyboard = [
          [{
            text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
            callback_data: 'admin_pnp_live'
          }]
        ];

        await ctx.editMessageText(
          lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nNo hay solicitudes de reembolso pendientes.' : '💸 **Refund Requests - PNP Television Live**\n\nNo pending refund requests.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }
      
      // Show updated list
      const buttons = [];
      for (const refund of refunds) {
        const model = await ModelService.getModelById(refund.model_id);
        const bookingTime = new Date(refund.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        buttons.push([{
          text: `${bookingTime} - ${model?.name || 'Model'} - $${refund.amount_usd}`,
          callback_data: `pnplive_process_refund_${refund.id}`
        }]);
      }
      
      buttons.push([{
        text: lang === 'es' ? '🔙 Volver' : '🔙 Back',
        callback_data: 'admin_pnp_live'
      }]);

      await ctx.editMessageText(
        lang === 'es' ? '💸 **Solicitudes de Reembolso - PNP Television Live**\n\nSelecciona una solicitud para procesar:' : '💸 **Refund Requests - PNP Television Live**\n\nSelect a request to process:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    } catch (error) {
      logger.error('Error rejecting refund:', error);
      await ctx.answerCbQuery('❌ Error');
    }
  });
};

module.exports = registerPNPLiveManagementHandlers;