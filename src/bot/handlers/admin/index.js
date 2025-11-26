const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const PermissionService = require('../../services/permissionService');
const { PERMISSIONS } = require('../../../models/permissionModel');
const UserModel = require('../../../models/userModel');
const PaymentModel = require('../../../models/paymentModel');
const PlanModel = require('../../../models/planModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

/**
 * Show admin panel based on user role
 * @param {Context} ctx - Telegraf context
 * @param {boolean} edit - Whether to edit message or send new
 */
async function showAdminPanel(ctx, edit = false) {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;
    const userRole = await PermissionService.getUserRole(userId);
    const roleDisplay = await PermissionService.getUserRoleDisplay(userId, lang);

    // Build menu based on role
    const buttons = [];

    // Common for all admin roles
    buttons.push([Markup.button.callback('👥 Usuarios', 'admin_users')]);
    buttons.push([Markup.button.callback('🎁 Activar Membresía', 'admin_activate_membership')]);

    // Admin and SuperAdmin features
    if (userRole === 'superadmin' || userRole === 'admin') {
      buttons.push([Markup.button.callback('📢 Difusión', 'admin_broadcast')]);
      buttons.push([Markup.button.callback('📊 Analíticas', 'admin_analytics')]);
      buttons.push([Markup.button.callback('🎮 Gamificación', 'admin_gamification')]);
      buttons.push([Markup.button.callback('📻 Radio', 'admin_radio')]);
      buttons.push([Markup.button.callback('📺 Transmisiones', 'admin_live_streams')]);
    }

    // SuperAdmin only features
    if (userRole === 'superadmin') {
      buttons.push([Markup.button.callback('📋 Menús', 'admin_menus')]);
      buttons.push([Markup.button.callback('👑 Roles', 'admin_roles')]);
      buttons.push([Markup.button.callback('💎 Planes', 'admin_plans')]);
      buttons.push([Markup.button.callback('📜 Logs', 'admin_logs')]);
    }

    const message = `${roleDisplay}\n\n${t('adminPanel', lang)}`;

    if (edit) {
      await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } else {
      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    }
  } catch (error) {
    logger.error('Error showing admin panel:', error);
  }
}

/**
 * Admin handlers
 * @param {Telegraf} bot - Bot instance
 */
// Import gamification handler
const registerGamificationHandlers = require('./gamification');
const registerRadioManagementHandlers = require('./radioManagement');
const registerLiveStreamManagementHandlers = require('./liveStreamManagement');

const registerAdminHandlers = (bot) => {
  // Register gamification handlers
  registerGamificationHandlers(bot);
  registerRadioManagementHandlers(bot);
  registerLiveStreamManagementHandlers(bot);

  // Admin command
  bot.command('admin', async (ctx) => {
    try {
      // Check if user is admin using new permission system
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      if (!isAdmin) {
        await ctx.reply(t('unauthorized', getLanguage(ctx)));
        return;
      }

      await showAdminPanel(ctx, false);
    } catch (error) {
      logger.error('Error in /admin command:', error);
    }
  });

  // Quick stats command
  bot.command('stats', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.reply(t('unauthorized', getLanguage(ctx)));
        return;
      }

      const lang = getLanguage(ctx);

      // Get comprehensive statistics
      const userStats = await UserService.getStatistics();

      // Revenue stats for different periods
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [todayRevenue, monthRevenue, last30Revenue] = await Promise.all([
        PaymentModel.getRevenue(today, now),
        PaymentModel.getRevenue(thisMonth, now),
        PaymentModel.getRevenue(last30Days, now),
      ]);

      // Build comprehensive stats message
      const statsMessage = '📊 *Real-Time Statistics*\n\n'
        + '*User Metrics:*\n'
        + `👥 Total Users: ${userStats.total}\n`
        + `💎 Premium Users: ${userStats.active}\n`
        + `🆓 Free Users: ${userStats.free}\n`
        + `📈 Conversion Rate: ${userStats.conversionRate.toFixed(2)}%\n\n`
        + '*Revenue - Today:*\n'
        + `💰 Total: $${todayRevenue.total.toFixed(2)}\n`
        + `📦 Payments: ${todayRevenue.count}\n`
        + `📊 Average: $${todayRevenue.average.toFixed(2)}\n\n`
        + '*Revenue - This Month:*\n'
        + `💰 Total: $${monthRevenue.total.toFixed(2)}\n`
        + `📦 Payments: ${monthRevenue.count}\n`
        + `📊 Average: $${monthRevenue.average.toFixed(2)}\n\n`
        + '*Revenue - Last 30 Days:*\n'
        + `💰 Total: $${last30Revenue.total.toFixed(2)}\n`
        + `📦 Payments: ${last30Revenue.count}\n`
        + `📊 Average: $${last30Revenue.average.toFixed(2)}\n\n`
        + '*Payment Breakdown (Last 30 Days):*\n'
        + `${Object.entries(last30Revenue.byPlan)
          .map(([plan, count]) => `  ${plan}: ${count}`)
          .join('\n') || '  No data'}\n\n`
        + '*Provider Breakdown:*\n'
        + `${Object.entries(last30Revenue.byProvider)
          .map(([provider, count]) => `  ${provider}: ${count}`)
          .join('\n') || '  No data'}\n\n`
        + `_Updated: ${now.toLocaleString()}_`;

      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });

      logger.info('Stats command executed', { adminId: ctx.from.id });
    } catch (error) {
      logger.error('Error in /stats command:', error);
      await ctx.reply('Error fetching statistics. Please try again.');
    }
  });

  // User management
  bot.action('admin_users', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {
        adminSearchingUser: true,
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        t('searchUser', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error in admin users:', error);
    }
  });

  // Broadcast
  bot.action('admin_broadcast', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {};
      await ctx.saveSession();

      await ctx.editMessageText(
        t('broadcastTarget', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback('👥 Todos los Usuarios', 'broadcast_all')],
          [Markup.button.callback('💎 Solo Premium', 'broadcast_premium')],
          [Markup.button.callback('🆓 Solo Gratis', 'broadcast_free')],
          [Markup.button.callback('↩️ Churned (Ex-Premium)', 'broadcast_churned')],
          [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error in admin broadcast:', error);
    }
  });

  // Broadcast target selection
  bot.action(/^broadcast_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid broadcast target action format');
        return;
      }

      const target = ctx.match[1];
      const lang = getLanguage(ctx);

      ctx.session.temp.broadcastTarget = target;
      ctx.session.temp.broadcastStep = 'media';
      ctx.session.temp.broadcastData = {};
      await ctx.saveSession();

      await ctx.editMessageText(
        '📎 *Paso 1/4: Subir Media*\n\n'
        + 'Por favor envía una imagen, video o archivo para adjuntar al broadcast.\n\n'
        + '💡 También puedes saltar este paso si solo quieres enviar texto.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⏭️ Saltar (Solo Texto)', 'broadcast_skip_media')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error in broadcast target:', error);
    }
  });

  // Skip media upload
  bot.action('broadcast_skip_media', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.editMessageText(
        '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error skipping media:', error);
    }
  });

  // Plan management - List all plans
  bot.action('admin_plans', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {};
      await ctx.saveSession();

      const plans = await PlanModel.getAll();

      let message = `💎 **Gestión de Planes**\n\n`;
      message += `Total de planes activos: ${plans.length}\n\n`;
      message += `Selecciona un plan para editar o eliminar:`;

      const keyboard = [];

      // Add button for each plan
      plans.forEach((plan) => {
        keyboard.push([
          Markup.button.callback(
            `${plan.nameEs || plan.name} - $${plan.price}`,
            `admin_plan_view_${plan.id}`,
          ),
        ]);
      });

      keyboard.push([Markup.button.callback('➕ Agregar Plan', 'admin_plan_add')]);
      keyboard.push([Markup.button.callback('◀️ Volver', 'admin_cancel')]);

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard(keyboard),
      );
    } catch (error) {
      logger.error('Error in admin plans:', error);
      await ctx.answerCbQuery('Error al cargar planes');
    }
  });

  // View plan details
  bot.action(/^admin_plan_view_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      let message = `💎 **Detalles del Plan**\n\n`;
      message += `📋 ID: ${plan.id}\n`;
      message += `📦 SKU: ${plan.sku || 'N/A'}\n`;
      message += `🏷️ Nombre (EN): ${plan.name}\n`;
      message += `🏷️ Nombre (ES): ${plan.nameEs}\n`;
      message += `💰 Precio: $${plan.price} ${plan.currency}\n`;
      message += `⏱️ Duración: ${plan.duration} días\n`;
      message += `✅ Activo: ${plan.active ? 'Sí' : 'No'}\n\n`;

      message += `📝 Características (EN):\n`;
      plan.features.forEach((feature, index) => {
        message += `  ${index + 1}. ${feature}\n`;
      });

      message += `\n📝 Características (ES):\n`;
      plan.featuresEs.forEach((feature, index) => {
        message += `  ${index + 1}. ${feature}\n`;
      });

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Editar', `admin_plan_edit_${planId}`)],
          [Markup.button.callback('🗑️ Eliminar', `admin_plan_delete_${planId}`)],
          [Markup.button.callback('◀️ Volver a Planes', 'admin_plans')],
        ]),
      );
    } catch (error) {
      logger.error('Error viewing plan:', error);
      await ctx.answerCbQuery('Error al cargar plan');
    }
  });

  // Edit plan - Show edit menu
  bot.action(/^admin_plan_edit_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      // Store plan ID in session for editing
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingPlanId = planId;
      await ctx.saveSession();

      let message = `✏️ **Editar Plan: ${plan.nameEs}**\n\n`;
      message += `Selecciona qué campo deseas modificar:\n`;

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('🏷️ Nombre', `admin_plan_edit_field_${planId}_name`)],
          [Markup.button.callback('💰 Precio', `admin_plan_edit_field_${planId}_price`)],
          [Markup.button.callback('⏱️ Duración', `admin_plan_edit_field_${planId}_duration`)],
          [Markup.button.callback('📝 Características', `admin_plan_edit_field_${planId}_features`)],
          [Markup.button.callback('✅ Activar/Desactivar', `admin_plan_toggle_active_${planId}`)],
          [Markup.button.callback('◀️ Volver', `admin_plan_view_${planId}`)],
        ]),
      );
    } catch (error) {
      logger.error('Error showing edit menu:', error);
      await ctx.answerCbQuery('Error al mostrar menú de edición');
    }
  });

  // Toggle plan active status
  bot.action(/^admin_plan_toggle_active_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      // Toggle active status
      await PlanModel.createOrUpdate(planId, {
        ...plan.dataValues,
        active: !plan.active,
      });

      await ctx.answerCbQuery(`Plan ${!plan.active ? 'activado' : 'desactivado'} exitosamente`);

      // Refresh the view
      ctx.match = [null, planId];
      await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
          ...ctx.update.callback_query,
          data: `admin_plan_view_${planId}`,
        },
      });
    } catch (error) {
      logger.error('Error toggling plan active status:', error);
      await ctx.answerCbQuery('Error al cambiar estado');
    }
  });

  // Edit plan field - Prompt for input
  bot.action(/^admin_plan_edit_field_(.+)_(name|price|duration|features)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const field = ctx.match[2];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      // Store edit context in session
      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingPlanId = planId;
      ctx.session.temp.editingPlanField = field;
      await ctx.saveSession();

      let message = '';
      let currentValue = '';

      switch (field) {
        case 'name':
          currentValue = `EN: ${plan.name}\nES: ${plan.nameEs}`;
          message = `✏️ **Editar Nombre del Plan**\n\n`;
          message += `Valor actual:\n${currentValue}\n\n`;
          message += `Envía el nuevo nombre en formato:\n`;
          message += `EN: Nombre en inglés\n`;
          message += `ES: Nombre en español\n\n`;
          message += `Ejemplo:\n`;
          message += `EN: Premium Plan\n`;
          message += `ES: Plan Premium`;
          break;

        case 'price':
          currentValue = `$${plan.price}`;
          message = `💰 **Editar Precio del Plan**\n\n`;
          message += `Precio actual: ${currentValue}\n\n`;
          message += `Envía el nuevo precio (solo el número):\n`;
          message += `Ejemplo: 29.99`;
          break;

        case 'duration':
          currentValue = `${plan.duration} días`;
          message = `⏱️ **Editar Duración del Plan**\n\n`;
          message += `Duración actual: ${currentValue}\n\n`;
          message += `Envía la nueva duración en días:\n`;
          message += `Ejemplo: 30`;
          break;

        case 'features':
          currentValue = `EN:\n${plan.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n`;
          currentValue += `ES:\n${plan.featuresEs.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
          message = `📝 **Editar Características del Plan**\n\n`;
          message += `Características actuales:\n${currentValue}\n\n`;
          message += `Envía las nuevas características en formato:\n`;
          message += `EN:\n`;
          message += `- Característica 1\n`;
          message += `- Característica 2\n`;
          message += `ES:\n`;
          message += `- Característica 1\n`;
          message += `- Característica 2`;
          break;
      }

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', `admin_plan_edit_${planId}`)],
        ]),
      );
    } catch (error) {
      logger.error('Error prompting for plan field edit:', error);
      await ctx.answerCbQuery('Error al iniciar edición');
    }
  });

  // Delete plan - Confirmation
  bot.action(/^admin_plan_delete_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      let message = `⚠️ **Confirmar Eliminación**\n\n`;
      message += `¿Estás seguro de que deseas eliminar este plan?\n\n`;
      message += `📋 Plan: ${plan.nameEs}\n`;
      message += `💰 Precio: $${plan.price}\n\n`;
      message += `⚠️ Esta acción no se puede deshacer.\n`;
      message += `Los usuarios con este plan no se verán afectados.`;

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sí, eliminar', `admin_plan_delete_confirm_${planId}`)],
          [Markup.button.callback('❌ Cancelar', `admin_plan_view_${planId}`)],
        ]),
      );
    } catch (error) {
      logger.error('Error showing delete confirmation:', error);
      await ctx.answerCbQuery('Error al mostrar confirmación');
    }
  });

  // Delete plan - Confirmed
  bot.action(/^admin_plan_delete_confirm_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const planId = ctx.match[1];
      const plan = await PlanModel.getById(planId);

      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      const planName = plan.nameEs;
      const success = await PlanModel.delete(planId);

      if (success) {
        await ctx.editMessageText(
          `✅ **Plan Eliminado**\n\n` +
          `El plan "${planName}" ha sido eliminado exitosamente.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Volver a Planes', 'admin_plans')],
          ]),
        );

        logger.info('Plan deleted by admin', { adminId: ctx.from.id, planId, planName });
        await ctx.answerCbQuery('Plan eliminado exitosamente');
      } else {
        await ctx.answerCbQuery('Error al eliminar plan');
      }
    } catch (error) {
      logger.error('Error deleting plan:', error);
      await ctx.answerCbQuery('Error al eliminar plan');
    }
  });

  // Analytics
  bot.action('admin_analytics', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {};
      await ctx.saveSession();

      // Get statistics
      const userStats = await UserService.getStatistics();
      const revenue = await PaymentModel.getRevenue(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
      );

      const analytics = `${t('analytics', lang)}\n\n`
        + `👥 Total Users: ${userStats.total}\n`
        + `💎 Premium Users: ${userStats.active}\n`
        + `🆓 Free Users: ${userStats.free}\n`
        + `📈 Conversion Rate: ${userStats.conversionRate.toFixed(2)}%\n\n`
        + '💰 Last 30 Days Revenue:\n'
        + `Total: $${revenue.total.toFixed(2)}\n`
        + `Payments: ${revenue.count}\n`
        + `Average: $${revenue.average.toFixed(2)}`;

      await ctx.editMessageText(
        analytics,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Actualizar', 'admin_analytics')],
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error in admin analytics:', error);
    }
  });

  // Admin cancel / back to main panel
  bot.action('admin_cancel', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      ctx.session.temp = {};
      await ctx.saveSession();

      await showAdminPanel(ctx, true);
    } catch (error) {
      logger.error('Error in admin cancel:', error);
    }
  });

  // Handle media uploads for broadcast
  bot.on('photo', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin || ctx.session.temp?.broadcastStep !== 'media') {
      return next();
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      ctx.session.temp.broadcastData.mediaType = 'photo';
      ctx.session.temp.broadcastData.mediaFileId = photo.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.reply(
        '✅ Imagen guardada correctamente\n\n'
        + '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error handling photo for broadcast:', error);
    }
  });

  bot.on('video', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin || ctx.session.temp?.broadcastStep !== 'media') {
      return next();
    }

    try {
      ctx.session.temp.broadcastData.mediaType = 'video';
      ctx.session.temp.broadcastData.mediaFileId = ctx.message.video.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.reply(
        '✅ Video guardado correctamente\n\n'
        + '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error handling video for broadcast:', error);
    }
  });

  bot.on('document', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin || ctx.session.temp?.broadcastStep !== 'media') {
      return next();
    }

    try {
      ctx.session.temp.broadcastData.mediaType = 'document';
      ctx.session.temp.broadcastData.mediaFileId = ctx.message.document.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.reply(
        '✅ Documento guardado correctamente\n\n'
        + '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error handling document for broadcast:', error);
    }
  });

  bot.on('audio', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin || ctx.session.temp?.broadcastStep !== 'media') {
      return next();
    }

    try {
      ctx.session.temp.broadcastData.mediaType = 'audio';
      ctx.session.temp.broadcastData.mediaFileId = ctx.message.audio.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.reply(
        '✅ Audio guardado correctamente\n\n'
        + '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error handling audio for broadcast:', error);
    }
  });

  bot.on('voice', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin || ctx.session.temp?.broadcastStep !== 'media') {
      return next();
    }

    try {
      ctx.session.temp.broadcastData.mediaType = 'voice';
      ctx.session.temp.broadcastData.mediaFileId = ctx.message.voice.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.reply(
        '✅ Mensaje de voz guardado correctamente\n\n'
        + '🇺🇸 *Paso 2/4: Texto en Inglés*\n\n'
        + 'Por favor escribe el mensaje en inglés que quieres enviar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error handling voice for broadcast:', error);
    }
  });

  // Handle admin text inputs
  bot.on('text', async (ctx, next) => {
    const isAdmin = await PermissionService.isAdmin(ctx.from.id);
    if (!isAdmin) {
      return next();
    }

    // User search
    if (ctx.session.temp?.adminSearchingUser) {
      try {
        const lang = getLanguage(ctx);
        const query = ctx.message.text;

        let user = null;
        if (!Number.isNaN(parseInt(query, 10))) {
          user = await UserModel.getById(query);
        }

        if (!user) {
          await ctx.reply(t('userNotFound', lang));
          return;
        }

        ctx.session.temp.adminSearchingUser = false;
        ctx.session.temp.selectedUserId = user.id;
        await ctx.saveSession();

        await ctx.reply(
          `${t('userFound', lang)}\n\n`
          + `👤 ${user.firstName || ''} ${user.lastName || ''}\n`
          + `🆔 ${user.id}\n`
          + `📧 ${user.email || 'N/A'}\n`
          + `💎 Status: ${user.subscriptionStatus}\n`
          + `📦 Plan: ${user.planId || 'N/A'}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('📅 Extender Suscripción', 'admin_extend_sub')],
            [Markup.button.callback('💎 Cambiar Plan', 'admin_change_plan')],
            [Markup.button.callback('🚫 Desactivar Usuario', 'admin_deactivate')],
            [Markup.button.callback('◀️ Volver', 'admin_cancel')],
          ]),
        );
      } catch (error) {
        logger.error('Error searching user:', error);
      }
      return;
    }

    // Broadcast flow - Handle text inputs
    if (ctx.session.temp?.broadcastStep === 'text_en') {
      try {
        const message = ctx.message.text;

        // Save English text
        ctx.session.temp.broadcastData.textEn = message;
        ctx.session.temp.broadcastStep = 'text_es';
        await ctx.saveSession();

        await ctx.reply(
          '🇪🇸 *Paso 3/4: Texto en Español*\n\n'
          + 'Por favor escribe el mensaje en español que quieres enviar:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          },
        );
      } catch (error) {
        logger.error('Error saving English text:', error);
      }
      return;
    }

    // Broadcast flow - Spanish text and send
    if (ctx.session.temp?.broadcastStep === 'text_es') {
      try {
        const message = ctx.message.text;
        const target = ctx.session.temp.broadcastTarget;
        const broadcastData = ctx.session.temp.broadcastData;

        // Save Spanish text
        broadcastData.textEs = message;

        await ctx.reply(
          '📤 *Paso 4/4: Enviando Broadcast...*\n\n'
          + 'Procesando envío a usuarios seleccionados...',
          { parse_mode: 'Markdown' },
        );

        // Get target users
        let users = [];
        if (target === 'all') {
          const result = await UserModel.getAll(1000);
          users = result.users;
        } else if (target === 'premium') {
          users = await UserModel.getBySubscriptionStatus('active');
        } else if (target === 'free') {
          users = await UserModel.getBySubscriptionStatus('free');
        } else if (target === 'churned') {
          users = await UserModel.getChurnedUsers();
        }

        // Send broadcast
        let sent = 0;
        let failed = 0;

        for (const user of users) {
          try {
            const userLang = user.language || 'en';
            const textToSend = userLang === 'es' ? broadcastData.textEs : broadcastData.textEn;

            // Send with media if available
            if (broadcastData.mediaType && broadcastData.mediaFileId) {
              const sendMethod = {
                photo: 'sendPhoto',
                video: 'sendVideo',
                document: 'sendDocument',
                audio: 'sendAudio',
                voice: 'sendVoice',
              }[broadcastData.mediaType];

              if (sendMethod) {
                await ctx.telegram[sendMethod](user.id, broadcastData.mediaFileId, {
                  caption: `📢 ${textToSend}`,
                });
              } else {
                await ctx.telegram.sendMessage(user.id, `📢 ${textToSend}`);
              }
            } else {
              // Text only
              await ctx.telegram.sendMessage(user.id, `📢 ${textToSend}`);
            }

            sent += 1;
          } catch (sendError) {
            failed += 1;
            logger.warn('Failed to send broadcast to user:', { userId: user.id, error: sendError.message });
          }
        }

        // Clear broadcast session data
        ctx.session.temp.broadcastTarget = null;
        ctx.session.temp.broadcastStep = null;
        ctx.session.temp.broadcastData = null;
        await ctx.saveSession();

        await ctx.reply(
          `✅ *Broadcast Completado*\n\n`
          + `📊 Estadísticas:\n`
          + `✓ Enviados: ${sent}\n`
          + `✗ Fallidos: ${failed}\n`
          + `📈 Total intentos: ${sent + failed}\n\n`
          + `🎯 Audiencia: ${target === 'all' ? 'Todos' : target === 'premium' ? 'Premium' : target === 'free' ? 'Gratis' : 'Churned'}\n`
          + `🌐 Mensajes bilingües: EN / ES\n`
          + `${broadcastData.mediaType ? `📎 Con media: ${broadcastData.mediaType}` : '📝 Solo texto'}`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
            ]),
          },
        );

        logger.info('Broadcast sent', {
          adminId: ctx.from.id,
          target,
          sent,
          failed,
          hasMedia: !!broadcastData.mediaType,
        });
      } catch (error) {
        logger.error('Error sending broadcast:', error);
        await ctx.reply('❌ Error al enviar el broadcast. Por favor intenta de nuevo.');
      }
      return;
    }

    // Plan field editing
    if (ctx.session.temp?.editingPlanId && ctx.session.temp?.editingPlanField) {
      try {
        const planId = ctx.session.temp.editingPlanId;
        const field = ctx.session.temp.editingPlanField;
        const input = ctx.message.text;
        const plan = await PlanModel.getById(planId);

        if (!plan) {
          await ctx.reply('Plan no encontrado');
          ctx.session.temp.editingPlanId = null;
          ctx.session.temp.editingPlanField = null;
          await ctx.saveSession();
          return;
        }

        let updateData = { ...plan.dataValues };
        let successMessage = '';

        switch (field) {
          case 'name': {
            // Parse format: EN: name\nES: name
            const lines = input.split('\n');
            let nameEn = plan.name;
            let nameEs = plan.nameEs;

            lines.forEach((line) => {
              if (line.startsWith('EN:')) {
                nameEn = line.substring(3).trim();
              } else if (line.startsWith('ES:')) {
                nameEs = line.substring(3).trim();
              }
            });

            updateData.name = nameEn;
            updateData.nameEs = nameEs;
            successMessage = `✅ Nombre actualizado:\nEN: ${nameEn}\nES: ${nameEs}`;
            break;
          }

          case 'price': {
            const price = parseFloat(input);
            if (Number.isNaN(price) || price < 0) {
              await ctx.reply('❌ Precio inválido. Por favor ingresa un número válido.');
              return;
            }
            updateData.price = price;
            successMessage = `✅ Precio actualizado: $${price}`;
            break;
          }

          case 'duration': {
            const duration = parseInt(input, 10);
            if (Number.isNaN(duration) || duration < 1) {
              await ctx.reply('❌ Duración inválida. Por favor ingresa un número de días válido.');
              return;
            }
            updateData.duration = duration;
            // Regenerate SKU with new duration
            updateData.sku = PlanModel.generateSKU(planId, duration);
            successMessage = `✅ Duración actualizada: ${duration} días\nSKU actualizado: ${updateData.sku}`;
            break;
          }

          case 'features': {
            // Parse format: EN:\n- feature1\n- feature2\nES:\n- feature1\n- feature2
            const sections = input.split(/EN:|ES:/i).filter((s) => s.trim());
            const featuresEn = [];
            const featuresEs = [];

            if (sections.length >= 1) {
              // First section is EN
              const enLines = sections[0].split('\n').filter((l) => l.trim().startsWith('-'));
              enLines.forEach((line) => {
                const feature = line.replace(/^-\s*/, '').trim();
                if (feature) featuresEn.push(feature);
              });
            }

            if (sections.length >= 2) {
              // Second section is ES
              const esLines = sections[1].split('\n').filter((l) => l.trim().startsWith('-'));
              esLines.forEach((line) => {
                const feature = line.replace(/^-\s*/, '').trim();
                if (feature) featuresEs.push(feature);
              });
            }

            if (featuresEn.length === 0 || featuresEs.length === 0) {
              await ctx.reply('❌ Formato inválido. Asegúrate de incluir características en ambos idiomas.');
              return;
            }

            updateData.features = featuresEn;
            updateData.featuresEs = featuresEs;
            successMessage = `✅ Características actualizadas:\nEN: ${featuresEn.length} características\nES: ${featuresEs.length} características`;
            break;
          }

          default:
            await ctx.reply('Campo desconocido');
            return;
        }

        // Update the plan
        await PlanModel.createOrUpdate(planId, updateData);

        // Clear editing state
        ctx.session.temp.editingPlanId = null;
        ctx.session.temp.editingPlanField = null;
        await ctx.saveSession();

        await ctx.reply(
          successMessage,
          Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Editar Otro Campo', `admin_plan_edit_${planId}`)],
            [Markup.button.callback('👁️ Ver Detalles', `admin_plan_view_${planId}`)],
            [Markup.button.callback('◀️ Volver a Planes', 'admin_plans')],
          ]),
        );

        logger.info('Plan field updated by admin', {
          adminId: ctx.from.id,
          planId,
          field,
          newValue: updateData[field],
        });
      } catch (error) {
        logger.error('Error updating plan field:', error);
        await ctx.reply('Error al actualizar el plan');
      }
      return;
    }

    // Membership activation - User search
    if (ctx.session.temp?.activatingMembership && ctx.session.temp?.activationStep === 'search_user') {
      try {
        const userId = ctx.message.text.trim();

        // Validate it's a number
        if (!/^\d+$/.test(userId)) {
          await ctx.reply('❌ ID inválido. Por favor envía un ID de Telegram válido (solo números).');
          return;
        }

        const user = await UserModel.getById(userId);

        if (!user) {
          await ctx.reply(
            '❌ **Usuario no encontrado**\n\n' +
            `No se encontró ningún usuario con el ID: ${userId}\n\n` +
            '💡 Asegúrate de que el usuario haya iniciado el bot al menos una vez con /start',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        // Clear activation step
        ctx.session.temp.activationStep = null;
        await ctx.saveSession();

        // Show user info and type selection
        let text = '✅ **Usuario Encontrado**\n\n';
        text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
        text += `🆔 ${userId}\n`;
        text += `📧 ${user.email || 'Sin email'}\n`;
        text += `💎 Estado actual: ${user.subscriptionStatus || 'free'}\n`;
        if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()) {
          text += `⏰ Expira: ${new Date(user.subscriptionExpiry).toLocaleDateString('es-ES')}\n`;
        }
        text += '\n¿Qué tipo de membresía deseas activar?\n';

        await ctx.reply(
          text,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💎 Plan Existente', `admin_activate_type_${userId}_plan`)],
              [Markup.button.callback('🎁 Pase de Cortesía', `admin_activate_type_${userId}_courtesy`)],
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          },
        );
      } catch (error) {
        logger.error('Error searching user for activation:', error);
        await ctx.reply('❌ Error al buscar usuario. Por favor intenta de nuevo.');
      }
      return;
    }

    return next();
  });

  // Extend subscription - Show duration options
  bot.action('admin_extend_sub', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.session.temp.selectedUserId;
      const lang = getLanguage(ctx);
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      let text = `📅 **Extender Membresía**\n\n`;
      text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
      text += `💎 Status: ${user.subscriptionStatus}\n`;
      if (user.subscriptionExpiry) {
        text += `⏰ Expira: ${new Date(user.subscriptionExpiry).toLocaleDateString()}\n`;
      }
      text += `\nSelecciona la duración de la extensión:\n`;

      await ctx.editMessageText(
        text,
        Markup.inlineKeyboard([
          [Markup.button.callback('📅 1 Semana', `admin_extend_duration_${userId}_7`)],
          [Markup.button.callback('📅 2 Semanas', `admin_extend_duration_${userId}_14`)],
          [Markup.button.callback('📅 1 Mes', `admin_extend_duration_${userId}_30`)],
          [Markup.button.callback('♾️ Lifetime', `admin_extend_duration_${userId}_lifetime`)],
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing extension options:', error);
      await ctx.answerCbQuery('Error al mostrar opciones');
    }
  });

  // Handle extension duration selection
  bot.action(/^admin_extend_duration_(.+)_(7|14|30|lifetime)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const duration = ctx.match[2];
      const lang = getLanguage(ctx);
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      let newExpiry;
      let durationText;

      if (duration === 'lifetime') {
        // Lifetime subscription - no expiry
        newExpiry = null;
        durationText = 'Lifetime (sin vencimiento)';
      } else {
        // Calculate new expiry based on current expiry or now
        const baseDate = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()
          ? new Date(user.subscriptionExpiry)
          : new Date();

        newExpiry = new Date(baseDate);
        const days = parseInt(duration, 10);
        newExpiry.setDate(newExpiry.getDate() + days);

        if (days === 7) {
          durationText = '1 semana';
        } else if (days === 14) {
          durationText = '2 semanas';
        } else if (days === 30) {
          durationText = '1 mes';
        } else {
          durationText = `${days} días`;
        }
      }

      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId: user.planId || 'premium',
        expiry: newExpiry,
      });

      let successText = `✅ **Membresía Extendida**\n\n`;
      successText += `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`;
      successText += `⏱️ Duración: ${durationText}\n`;
      if (newExpiry) {
        successText += `📅 Nueva fecha de vencimiento: ${newExpiry.toLocaleDateString()}\n`;
      } else {
        successText += `♾️ Membresía Lifetime activada\n`;
      }

      await ctx.editMessageText(
        successText,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
        ]),
      );

      logger.info('Subscription extended by admin', {
        adminId: ctx.from.id,
        userId,
        duration,
        newExpiry,
      });

      await ctx.answerCbQuery('✅ Membresía extendida exitosamente');
    } catch (error) {
      logger.error('Error extending subscription:', error);
      await ctx.answerCbQuery('Error al extender membresía');
    }
  });

  // Deactivate user
  bot.action('admin_deactivate', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.session.temp.selectedUserId;
      const lang = getLanguage(ctx);

      await UserModel.updateSubscription(userId, {
        status: 'deactivated',
        planId: null,
        expiry: new Date(),
      });

      await ctx.editMessageText(
        `✅ User ${userId} deactivated`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
        ]),
      );

      logger.info('User deactivated by admin', { adminId: ctx.from.id, userId });
    } catch (error) {
      logger.error('Error deactivating user:', error);
    }
  });

  // Change plan - Show available plans
  bot.action('admin_change_plan', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.session.temp.selectedUserId;
      const lang = getLanguage(ctx);
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('User not found');
        return;
      }

      const plans = await PlanModel.getAll();

      let text = `💎 **Cambiar Plan de Usuario**\n\n`;
      text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
      text += `📦 Plan Actual: ${user.planId || 'Ninguno'}\n`;
      text += `💎 Status: ${user.subscriptionStatus}\n\n`;
      text += `Selecciona el nuevo plan:\n`;

      const keyboard = [];

      // Add button for each plan
      plans.forEach((plan) => {
        keyboard.push([
          Markup.button.callback(
            `${plan.name} - $${plan.price}`,
            `admin_set_plan_${userId}_${plan.id}`,
          ),
        ]);
      });

      // Add option to set as free
      keyboard.push([Markup.button.callback('🆓 Plan Gratis', `admin_set_plan_${userId}_free`)]);
      keyboard.push([Markup.button.callback('◀️ Volver', 'admin_cancel')]);

      await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
    } catch (error) {
      logger.error('Error showing plan change menu:', error);
    }
  });

  // Set plan for user
  bot.action(/^admin_set_plan_(.+)_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const planId = ctx.match[2];
      const lang = getLanguage(ctx);

      const user = await UserModel.getById(userId);
      if (!user) {
        await ctx.answerCbQuery('User not found');
        return;
      }

      // Set new plan
      if (planId === 'free') {
        await UserModel.updateSubscription(userId, {
          status: 'free',
          planId: null,
          expiry: null,
        });
      } else {
        const plan = await PlanModel.getById(planId);
        if (!plan) {
          await ctx.answerCbQuery('Plan not found');
          return;
        }

        // Set new expiry date based on plan duration
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30));

        await UserModel.updateSubscription(userId, {
          status: 'active',
          planId,
          expiry: newExpiry,
        });
      }

      await ctx.editMessageText(
        `✅ Plan actualizado exitosamente\n\n`
        + `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`
        + `💎 Nuevo Plan: ${planId === 'free' ? 'Gratis' : planId}\n`
        + `📅 Estado: ${planId === 'free' ? 'free' : 'active'}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver', 'admin_cancel')],
        ]),
      );

      logger.info('Plan changed by admin', { adminId: ctx.from.id, userId, newPlan: planId });
    } catch (error) {
      logger.error('Error changing user plan:', error);
      await ctx.answerCbQuery('Error al cambiar el plan');
    }
  });

  // ====== MANUAL MEMBERSHIP ACTIVATION ======

  // Start membership activation flow
  bot.action('admin_activate_membership', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

      // Clear any ongoing admin tasks
      ctx.session.temp = {
        activatingMembership: true,
        activationStep: 'search_user',
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        '🎁 **Activar Membresía Manualmente**\n\n'
        + '👤 Por favor envía el **ID de Telegram** del usuario al que deseas activar la membresía.\n\n'
        + '💡 Puedes encontrar el ID pidiendo al usuario que use /start en el bot.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error starting membership activation:', error);
    }
  });

  // Handle membership type selection
  bot.action(/^admin_activate_type_(.+)_(plan|courtesy)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const type = ctx.match[2];

      const user = await UserModel.getById(userId);
      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      if (type === 'courtesy') {
        // Show courtesy pass options
        let text = '🎁 **Pase de Cortesía**\n\n';
        text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
        text += `🆔 ${userId}\n\n`;
        text += 'Selecciona la duración del pase de cortesía:';

        await ctx.editMessageText(
          text,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📅 2 Días', `admin_activate_courtesy_${userId}_2`)],
              [Markup.button.callback('📅 7 Días (1 Semana)', `admin_activate_courtesy_${userId}_7`)],
              [Markup.button.callback('📅 14 Días (2 Semanas)', `admin_activate_courtesy_${userId}_14`)],
              [Markup.button.callback('◀️ Volver', `admin_activate_select_type_${userId}`)],
            ]),
          },
        );
      } else {
        // Show available plans
        const plans = await PlanModel.getAll();

        let text = '💎 **Seleccionar Plan**\n\n';
        text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
        text += `🆔 ${userId}\n\n`;
        text += 'Selecciona el plan a activar:';

        const keyboard = [];

        // Add button for each active plan
        plans.filter((p) => p.active).forEach((plan) => {
          const lang = user.language || 'es';
          const planName = lang === 'es' ? (plan.nameEs || plan.name) : plan.name;
          keyboard.push([
            Markup.button.callback(
              `${planName} - $${plan.price} (${plan.duration} días)`,
              `admin_activate_plan_${userId}_${plan.id}`,
            ),
          ]);
        });

        keyboard.push([Markup.button.callback('◀️ Volver', `admin_activate_select_type_${userId}`)]);

        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard),
        });
      }
    } catch (error) {
      logger.error('Error showing membership type options:', error);
      await ctx.answerCbQuery('Error al mostrar opciones');
    }
  });

  // Activate courtesy pass
  bot.action(/^admin_activate_courtesy_(.+)_(\d+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const days = parseInt(ctx.match[2], 10);

      const user = await UserModel.getById(userId);
      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      // Activate subscription with courtesy pass plan
      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId: `courtesy_${days}d`,
        expiry: expiryDate,
      });

      const lang = user.language || 'es';
      const durationText = days === 2 ? '2 días' : days === 7 ? '1 semana (7 días)' : '2 semanas (14 días)';

      let successText = '✅ **Pase de Cortesía Activado**\n\n';
      successText += `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`;
      successText += `🆔 ID: ${userId}\n`;
      successText += `🎁 Tipo: Pase de Cortesía\n`;
      successText += `⏱️ Duración: ${durationText}\n`;
      successText += `📅 Expira: ${expiryDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      successText += `💎 Estado: Activo\n\n`;
      successText += '📨 El usuario ha sido notificado por el bot.';

      await ctx.editMessageText(
        successText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
          ]),
        },
      );

      // Send notification to user via bot
      try {
        const welcomeMessage = lang === 'es'
          ? `🎉 **¡Membresía Activada!**\n\n` +
            `Has recibido un **pase de cortesía** de **${durationText}**.\n\n` +
            `✅ Tu membresía está activa hasta el **${expiryDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}**\n\n` +
            `💎 Disfruta de todo el contenido premium de PNPtv!`
          : `🎉 **Membership Activated!**\n\n` +
            `You have received a **courtesy pass** for **${days} days**.\n\n` +
            `✅ Your membership is active until **${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}**\n\n` +
            `💎 Enjoy all premium PNPtv content!`;

        await ctx.telegram.sendMessage(userId, welcomeMessage, { parse_mode: 'Markdown' });
      } catch (notifyError) {
        logger.warn('Could not notify user about courtesy pass', { userId, error: notifyError.message });
      }

      logger.info('Courtesy pass activated by admin', {
        adminId: ctx.from.id,
        userId,
        days,
        expiryDate,
      });

      await ctx.answerCbQuery('✅ Pase de cortesía activado');
    } catch (error) {
      logger.error('Error activating courtesy pass:', error);
      await ctx.answerCbQuery('Error al activar pase de cortesía');
    }
  });

  // Activate specific plan
  bot.action(/^admin_activate_plan_(.+)_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const planId = ctx.match[2];

      const user = await UserModel.getById(userId);
      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      const plan = await PlanModel.getById(planId);
      if (!plan) {
        await ctx.answerCbQuery('Plan no encontrado');
        return;
      }

      // Calculate expiry date based on plan duration
      let expiryDate;
      if (plan.isLifetime || plan.duration >= 36500) {
        expiryDate = null; // Lifetime = no expiry
      } else {
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + plan.duration);
      }

      // Activate subscription
      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId: plan.id,
        expiry: expiryDate,
      });

      const lang = user.language || 'es';
      const planName = lang === 'es' ? (plan.nameEs || plan.name) : plan.name;

      let successText = '✅ **Membresía Activada**\n\n';
      successText += `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`;
      successText += `🆔 ID: ${userId}\n`;
      successText += `💎 Plan: ${planName}\n`;
      successText += `⏱️ Duración: ${plan.isLifetime || plan.duration >= 36500 ? 'Lifetime' : `${plan.duration} días`}\n`;
      if (expiryDate) {
        successText += `📅 Expira: ${expiryDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      } else {
        successText += `♾️ Sin vencimiento (Lifetime)\n`;
      }
      successText += `💰 Valor: $${plan.price} ${plan.currency}\n`;
      successText += `📊 Estado: Activo\n\n`;
      successText += '📨 El usuario ha sido notificado por el bot.';

      await ctx.editMessageText(
        successText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
          ]),
        },
      );

      // Send notification to user via bot
      try {
        const durationText = plan.isLifetime || plan.duration >= 36500
          ? (lang === 'es' ? 'acceso de por vida' : 'lifetime access')
          : (lang === 'es' ? `${plan.duration} días` : `${plan.duration} days`);

        const expiryText = expiryDate
          ? (lang === 'es'
            ? `hasta el **${expiryDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}**`
            : `until **${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}**`)
          : (lang === 'es' ? '**sin vencimiento**' : '**no expiration**');

        const welcomeMessage = lang === 'es'
          ? `🎉 **¡Membresía Activada!**\n\n` +
            `Has recibido el plan **${planName}** con ${durationText}.\n\n` +
            `✅ Tu membresía está activa ${expiryText}\n\n` +
            `💎 Disfruta de todo el contenido premium de PNPtv!`
          : `🎉 **Membership Activated!**\n\n` +
            `You have received the **${planName}** plan with ${durationText}.\n\n` +
            `✅ Your membership is active ${expiryText}\n\n` +
            `💎 Enjoy all premium PNPtv content!`;

        await ctx.telegram.sendMessage(userId, welcomeMessage, { parse_mode: 'Markdown' });
      } catch (notifyError) {
        logger.warn('Could not notify user about plan activation', { userId, error: notifyError.message });
      }

      logger.info('Plan activated manually by admin', {
        adminId: ctx.from.id,
        userId,
        planId: plan.id,
        planName,
        duration: plan.duration,
        expiryDate,
      });

      await ctx.answerCbQuery('✅ Membresía activada');
    } catch (error) {
      logger.error('Error activating plan:', error);
      await ctx.answerCbQuery('Error al activar membresía');
    }
  });

  // Show type selection (plan or courtesy)
  bot.action(/^admin_activate_select_type_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      let text = '🎁 **Activar Membresía**\n\n';
      text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
      text += `🆔 ${userId}\n`;
      text += `📧 ${user.email || 'Sin email'}\n`;
      text += `💎 Estado actual: ${user.subscriptionStatus || 'free'}\n`;
      if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()) {
        text += `⏰ Expira: ${new Date(user.subscriptionExpiry).toLocaleDateString('es-ES')}\n`;
      }
      text += '\n¿Qué tipo de membresía deseas activar?\n';

      await ctx.editMessageText(
        text,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💎 Plan Existente', `admin_activate_type_${userId}_plan`)],
            [Markup.button.callback('🎁 Pase de Cortesía', `admin_activate_type_${userId}_courtesy`)],
            [Markup.button.callback('◀️ Volver', 'admin_activate_membership')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error showing type selection:', error);
      await ctx.answerCbQuery('Error al mostrar opciones');
    }
  });
};

module.exports = registerAdminHandlers;
