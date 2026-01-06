const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const PermissionService = require('../../services/permissionService');
const { PERMISSIONS } = require('../../../models/permissionModel');
const UserModel = require('../../../models/userModel');
const PaymentModel = require('../../../models/paymentModel');
const PlanModel = require('../../../models/planModel');
const PaymentService = require('../../services/paymentService');
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

    // Build menu based on role with organized sections
    const buttons = [];

    // Common for all admin roles
    buttons.push([Markup.button.callback('👥 Usuarios', 'admin_users')]);
    buttons.push([Markup.button.callback('🎁 Activar Membresía', 'admin_activate_membership')]);

    // Admin and SuperAdmin features
    if (userRole === 'superadmin' || userRole === 'admin') {
      // ═══ CONTENT & MEDIA ═══
      buttons.push([
        Markup.button.callback('📻 Radio', 'admin_radio'),
        Markup.button.callback('📺 ' + (lang === 'es' ? 'En Vivo' : 'Live'), 'admin_live_streams'),
      ]);

      // ═══ ENGAGEMENT ═══
      buttons.push([
        Markup.button.callback('📢 ' + (lang === 'es' ? 'Difusión' : 'Broadcast'), 'admin_broadcast'),
        Markup.button.callback('🎮 ' + (lang === 'es' ? 'Gamificación' : 'Gamification'), 'admin_gamification'),
      ]);

      // ═══ COMMUNITY POSTS ═══
      buttons.push([
        Markup.button.callback('📤 ' + (lang === 'es' ? 'Compartir Publicación' : 'Share Post'), 'admin_share_post_to_groups'),
      ]);

      // ═══ COMMUNITY REWARDS ═══
      buttons.push([
        Markup.button.callback('🎁 ' + (lang === 'es' ? 'Premium Comunitario' : 'Community Premium'), 'admin_community_premium_broadcast'),
      ]);

      // ═══ PREVIEW MODE ═══
      buttons.push([
        Markup.button.callback('👁️ ' + (lang === 'es' ? 'Vista Previa' : 'Preview Mode'), 'admin_view_mode'),
      ]);
    }

    // SuperAdmin only features
    if (userRole === 'superadmin') {
      // ═══ SYSTEM CONFIG ═══
      buttons.push([
        Markup.button.callback('💎 ' + (lang === 'es' ? 'Planes' : 'Plans'), 'admin_plans'),
        Markup.button.callback('👑 Roles', 'admin_roles'),
      ]);
      buttons.push([
        Markup.button.callback('📋 ' + (lang === 'es' ? 'Menús' : 'Menus'), 'admin_menus'),
        Markup.button.callback('📜 Logs', 'admin_logs'),
      ]);
    }

    // Build styled message
    const header = lang === 'es' ? '`⚙️ Panel de Administración`' : '`⚙️ Admin Panel`';
    const divider = '━━━━━━━━━━━━━━━━━━━━';
    const footer = lang === 'es' ? '`Selecciona una opción 💜`' : '`Choose an option 💜`';

    const message = `${header}\n${divider}\n\n${roleDisplay}\n\n${footer}`;

    const options = {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    };

    if (edit) {
      await ctx.editMessageText(message, options);
    } else {
      await ctx.reply(message, options);
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
const registerCommunityPremiumBroadcast = require('./communityPremiumBroadcast');
const registerCommunityPostHandlers = require('./sharePostToCommunityGroup');

let registerAdminHandlers = (bot) => {
  logger.info('[DEBUG-INIT] registerAdminHandlers called - registering admin command handlers');
  // Register gamification handlers
  registerGamificationHandlers(bot);
  registerRadioManagementHandlers(bot);
  registerLiveStreamManagementHandlers(bot);
  registerCommunityPremiumBroadcast(bot);
  registerCommunityPostHandlers(bot);

  // Admin command
  bot.command('admin', async (ctx) => {
    console.log(`[DEBUG] /admin command triggered for user ${ctx.from.id}`);
    try {
      // Check if user is admin using new permission system
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      console.log(`[DEBUG] isAdmin check result: ${isAdmin} for user ${ctx.from.id}`);

      if (!isAdmin) {
        console.log(`[DEBUG] User ${ctx.from.id} is NOT admin`);
        await ctx.reply(t('unauthorized', getLanguage(ctx)));
        return;
      }

      console.log(`[DEBUG] User ${ctx.from.id} IS admin, calling showAdminPanel`);
      await showAdminPanel(ctx, false);
    } catch (error) {
      console.log(`[DEBUG] Error in /admin command: ${error.message}`);
      logger.error('Error in /admin command:', error);
    }
  });

  // Quick view mode command: /viewas free | /viewas prime | /viewas normal
  bot.command('viewas', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.reply(t('unauthorized', getLanguage(ctx)));
        return;
      }

      const lang = getLanguage(ctx);
      const args = ctx.message.text.split(' ');
      const mode = args[1]?.toLowerCase();

      if (!mode || !['free', 'prime', 'normal'].includes(mode)) {
        const helpMsg = lang === 'es'
          ? '👁️ **Comando de Vista Previa**\n\n' +
            'Uso: `/viewas <modo>`\n\n' +
            'Modos disponibles:\n' +
            '• `free` - Ver como usuario FREE\n' +
            '• `prime` - Ver como usuario PRIME\n' +
            '• `normal` - Vista normal (admin)\n\n' +
            'Ejemplo: `/viewas free`'
          : '👁️ **Preview Mode Command**\n\n' +
            'Usage: `/viewas <mode>`\n\n' +
            'Available modes:\n' +
            '• `free` - View as FREE user\n' +
            '• `prime` - View as PRIME user\n' +
            '• `normal` - Normal view (admin)\n\n' +
            'Example: `/viewas free`';
        await ctx.reply(helpMsg, { parse_mode: 'Markdown' });
        return;
      }

      if (mode === 'normal') {
        delete ctx.session.adminViewMode;
      } else {
        ctx.session.adminViewMode = mode;
      }
      await ctx.saveSession();

      const modeText = mode === 'free'
        ? (lang === 'es' ? '🆓 FREE' : '🆓 FREE')
        : mode === 'prime'
        ? (lang === 'es' ? '💎 PRIME' : '💎 PRIME')
        : (lang === 'es' ? '🔙 Normal' : '🔙 Normal');

      await ctx.reply(
        lang === 'es'
          ? `👁️ Vista activada: ${modeText}\n\nUsa /menu para ver el menú.`
          : `👁️ View activated: ${modeText}\n\nUse /menu to see the menu.`,
        { parse_mode: 'Markdown' }
      );

      logger.info('Admin view mode changed via command', { userId: ctx.from.id, mode });
    } catch (error) {
      logger.error('Error in /viewas command:', error);
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
      await ctx.answerCbQuery(); // Answer immediately

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

  // View Mode - Show options to preview as Free or Prime
  bot.action('admin_view_mode', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);
      const currentMode = ctx.session?.adminViewMode;

      let statusText = '';
      if (currentMode === 'free') {
        statusText = lang === 'es' ? '\n\n_Actualmente: Vista FREE_' : '\n\n_Currently: FREE View_';
      } else if (currentMode === 'prime') {
        statusText = lang === 'es' ? '\n\n_Actualmente: Vista PRIME_' : '\n\n_Currently: PRIME View_';
      } else {
        statusText = lang === 'es' ? '\n\n_Actualmente: Vista Normal (Admin)_' : '\n\n_Currently: Normal View (Admin)_';
      }

      const message = lang === 'es'
        ? '👁️ **Vista Previa de Menú**\n\nSelecciona cómo quieres ver el menú para probar la experiencia del usuario:' + statusText
        : '👁️ **Menu Preview Mode**\n\nSelect how you want to view the menu to test the user experience:' + statusText;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(lang === 'es' ? '🆓 Ver como FREE' : '🆓 View as FREE', 'admin_view_as_free'),
            Markup.button.callback(lang === 'es' ? '💎 Ver como PRIME' : '💎 View as PRIME', 'admin_view_as_prime'),
          ],
          [
            Markup.button.callback(lang === 'es' ? '🔙 Vista Normal' : '🔙 Normal View', 'admin_view_as_normal'),
          ],
          [
            Markup.button.callback(lang === 'es' ? '↩️ Volver' : '↩️ Back', 'admin_cancel'),
          ],
        ]),
      });
    } catch (error) {
      logger.error('Error in admin view mode:', error);
    }
  });

  // Set view mode to FREE
  bot.action('admin_view_as_free', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.adminViewMode = 'free';
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(lang === 'es' ? '👁️ Vista FREE activada' : '👁️ FREE View activated');

      // Show menu with new view mode
      const { showMainMenu } = require('../user/menu');
      await ctx.deleteMessage().catch(() => {});
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error setting free view mode:', error);
    }
  });

  // Set view mode to PRIME
  bot.action('admin_view_as_prime', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.adminViewMode = 'prime';
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(lang === 'es' ? '👁️ Vista PRIME activada' : '👁️ PRIME View activated');

      // Show menu with new view mode
      const { showMainMenu } = require('../user/menu');
      await ctx.deleteMessage().catch(() => {});
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error setting prime view mode:', error);
    }
  });

  // Set view mode back to Normal (admin)
  bot.action('admin_view_as_normal', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      delete ctx.session.adminViewMode;
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(lang === 'es' ? '🔙 Vista Normal activada' : '🔙 Normal View activated');

      // Show menu with normal view
      const { showMainMenu } = require('../user/menu');
      await ctx.deleteMessage().catch(() => {});
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error setting normal view mode:', error);
    }
  });

  // Exit preview mode (from menu button)
  bot.action('admin_exit_preview', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      delete ctx.session.adminViewMode;
      await ctx.saveSession();

      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(lang === 'es' ? '🔙 Vista Normal' : '🔙 Normal View');

      // Show menu with normal view
      const { showMainMenu } = require('../user/menu');
      await ctx.deleteMessage().catch(() => {});
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error exiting preview mode:', error);
    }
  });

  // Broadcast
  bot.action('admin_broadcast', async (ctx) => {
    try {
      await ctx.answerCbQuery(); // Answer immediately to prevent timeout

      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        logger.warn('Non-admin tried to access broadcast:', { userId: ctx.from.id });
        return;
      }

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
      try {
        await ctx.answerCbQuery('Error al iniciar broadcast');
      } catch (e) {
        // Already answered
      }
    }
  });

  // Broadcast target selection
  bot.action(/^broadcast_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid broadcast target action format');
        await ctx.answerCbQuery('❌ Error en formato de acción');
        return;
      }

      const target = ctx.match[1];
      const lang = getLanguage(ctx);

      // Initialize session temp if needed
      if (!ctx.session.temp) {
        ctx.session.temp = {};
      }

      ctx.session.temp.broadcastTarget = target;
      ctx.session.temp.broadcastStep = 'media';
      ctx.session.temp.broadcastData = {};
      await ctx.saveSession();

      logger.info('Broadcast target selected', { target, userId: ctx.from.id });

      await ctx.answerCbQuery(`✓ Audiencia: ${target}`);

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
      await ctx.answerCbQuery('❌ Error al seleccionar audiencia').catch(() => {});
    }
  });

  // Skip media upload
  bot.action('broadcast_skip_media', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      // Validate session state
      if (!ctx.session.temp || !ctx.session.temp.broadcastTarget) {
        await ctx.answerCbQuery('❌ Sesión expirada. Por favor inicia de nuevo.');
        logger.warn('Broadcast session expired or missing', { userId: ctx.from.id });
        return;
      }

      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      await ctx.answerCbQuery('⏭️ Saltando media');

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

      logger.info('Broadcast media skipped', { userId: ctx.from.id });
    } catch (error) {
      logger.error('Error skipping media:', error);
      await ctx.answerCbQuery('❌ Error al saltar media').catch(() => {});
    }
  });

  // Broadcast - Button preset selection (regex for all presets)
  bot.action(/^broadcast_preset_(\d+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      const presetId = parseInt(ctx.match[1]);
      const BroadcastButtonModel = require('../../../models/broadcastButtonModel');
      const preset = await BroadcastButtonModel.getPresetById(presetId);

      if (!preset) {
        await ctx.answerCbQuery('❌ Preset not found');
        return;
      }

      // Save selected preset buttons
      if (!ctx.session.temp.broadcastData) {
        ctx.session.temp.broadcastData = {};
      }
      ctx.session.temp.broadcastData.buttons = preset.buttons;
      ctx.session.temp.broadcastData.presetId = presetId;
      ctx.session.temp.broadcastStep = 'schedule_options';
      await ctx.saveSession();

      await ctx.answerCbQuery(`✓ ${preset.name}`);
      await ctx.editMessageText(
        `✅ Botones configurados: ${preset.name}\n\n`
        + '⏰ *Paso 5/5: Envío*\n\n'
        + '¿Cuándo quieres enviar este broadcast?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Enviar Ahora', 'broadcast_send_now_with_buttons')],
            [Markup.button.callback('📅 Programar Envío', 'broadcast_schedule_with_buttons')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error selecting button preset:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Broadcast - No buttons option
  bot.action('broadcast_no_buttons', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      // Save no buttons selection
      if (!ctx.session.temp.broadcastData) {
        ctx.session.temp.broadcastData = {};
      }
      ctx.session.temp.broadcastData.buttons = [];
      ctx.session.temp.broadcastStep = 'schedule_options';
      await ctx.saveSession();

      await ctx.answerCbQuery('⏭️ Sin botones');
      await ctx.editMessageText(
        '⏰ *Paso 5/5: Envío*\n\n'
        + '¿Cuándo quieres enviar este broadcast?',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📤 Enviar Ahora', 'broadcast_send_now_with_buttons')],
            [Markup.button.callback('📅 Programar Envío', 'broadcast_schedule_with_buttons')],
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error selecting no buttons:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Broadcast - Custom buttons option
  bot.action('broadcast_custom_buttons', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      ctx.session.temp.broadcastStep = 'custom_buttons';
      ctx.session.temp.customButtons = [];
      await ctx.saveSession();

      await ctx.answerCbQuery('➕ Botones Personalizados');
      await ctx.editMessageText(
        '➕ *Agregar Botones Personalizados*\n\n'
        + 'Envía cada botón en este formato:\n\n'
        + '`Texto del Botón|tipo|destino`\n\n'
        + '**Tipos disponibles:**\n'
        + '• `url` - Enlace externo (ej: https://...)\n'
        + '• `plan` - Plan específico (ej: premium, gold)\n'
        + '• `command` - Comando bot (ej: /plans, /support)\n'
        + '• `feature` - Característica (ej: features, nearby)\n\n'
        + '**Ejemplos:**\n'
        + '`💎 Ver Planes|command|/plans`\n'
        + '`⭐ Premium Now|plan|premium`\n'
        + '`🔗 Website|url|https://pnptv.app`\n\n'
        + 'Escribe cada botón en un mensaje. Cuando termines, di \"listo\".',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error starting custom buttons:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Broadcast - Send now with buttons
  bot.action('broadcast_send_now_with_buttons', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      await ctx.answerCbQuery();
      ctx.session.temp.broadcastStep = 'sending';
      await ctx.saveSession();

      // Process broadcast sending with buttons
      await sendBroadcastWithButtons(ctx, bot);
    } catch (error) {
      logger.error('Error in broadcast send now with buttons:', error);
      await ctx.reply('❌ Error al enviar broadcast').catch(() => {});
    }
  });

  // Broadcast - Schedule with buttons
  bot.action('broadcast_schedule_with_buttons', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.answerCbQuery('❌ No autorizado');
        return;
      }

      if (!ctx.session.temp || !ctx.session.temp.broadcastTarget) {
        await ctx.answerCbQuery('❌ Sesión expirada');
        return;
      }

      ctx.session.temp.broadcastStep = 'schedule_count';
      ctx.session.temp.scheduledTimes = [];
      await ctx.saveSession();

      await ctx.answerCbQuery();

      await ctx.editMessageText(
        '📅 *Programar Broadcasts*\n\n'
        + '¿Cuántas veces deseas programar este broadcast?\n\n'
        + '🔄 *Opciones:* 1 a 12 programaciones diferentes',
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
      logger.error('Error in broadcast schedule with buttons:', error);
      await ctx.answerCbQuery('❌ Error').catch(() => {});
    }
  });

  // Plan management - List all plans
  bot.action('admin_plans', async (ctx) => {
    try {
      await ctx.answerCbQuery(); // Answer immediately

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
      await ctx.answerCbQuery(); // Answer immediately

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
      await ctx.answerCbQuery(); // Answer immediately

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
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      // Check if this is for broadcast
      if (!isAdmin || !ctx.session.temp || ctx.session.temp.broadcastStep !== 'media') {
        return next();
      }

      // Validate session state
      if (!ctx.session.temp.broadcastTarget || !ctx.session.temp.broadcastData) {
        logger.warn('Broadcast session incomplete when uploading photo', { userId: ctx.from.id });
        await ctx.reply('❌ Sesión expirada. Por favor inicia el broadcast de nuevo con /admin');
        return;
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1];

      if (!photo || !photo.file_id) {
        logger.error('Invalid photo upload', { userId: ctx.from.id });
        await ctx.reply('❌ Error al procesar la imagen. Por favor intenta de nuevo.');
        return;
      }

      ctx.session.temp.broadcastData.mediaType = 'photo';
      ctx.session.temp.broadcastData.mediaFileId = photo.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      logger.info('Broadcast photo uploaded', {
        userId: ctx.from.id,
        fileId: photo.file_id,
        target: ctx.session.temp.broadcastTarget
      });

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
      await ctx.reply('❌ Error al procesar la imagen. Por favor intenta de nuevo.').catch(() => {});
    }
  });

  bot.on('video', async (ctx, next) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      // Check if this is for broadcast
      if (!isAdmin || !ctx.session.temp || ctx.session.temp.broadcastStep !== 'media') {
        return next();
      }

      // Validate session state
      if (!ctx.session.temp.broadcastTarget || !ctx.session.temp.broadcastData) {
        logger.warn('Broadcast session incomplete when uploading video', { userId: ctx.from.id });
        await ctx.reply('❌ Sesión expirada. Por favor inicia el broadcast de nuevo con /admin');
        return;
      }

      const video = ctx.message.video;

      if (!video || !video.file_id) {
        logger.error('Invalid video upload', { userId: ctx.from.id });
        await ctx.reply('❌ Error al procesar el video. Por favor intenta de nuevo.');
        return;
      }

      ctx.session.temp.broadcastData.mediaType = 'video';
      ctx.session.temp.broadcastData.mediaFileId = video.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      logger.info('Broadcast video uploaded', {
        userId: ctx.from.id,
        fileId: video.file_id,
        target: ctx.session.temp.broadcastTarget
      });

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
      await ctx.reply('❌ Error al procesar el video. Por favor intenta de nuevo.').catch(() => {});
    }
  });

  bot.on('document', async (ctx, next) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      // Check if this is for broadcast
      if (!isAdmin || !ctx.session.temp || ctx.session.temp.broadcastStep !== 'media') {
        return next();
      }

      // Validate session state
      if (!ctx.session.temp.broadcastTarget || !ctx.session.temp.broadcastData) {
        logger.warn('Broadcast session incomplete when uploading document', { userId: ctx.from.id });
        await ctx.reply('❌ Sesión expirada. Por favor inicia el broadcast de nuevo con /admin');
        return;
      }

      const document = ctx.message.document;

      if (!document || !document.file_id) {
        logger.error('Invalid document upload', { userId: ctx.from.id });
        await ctx.reply('❌ Error al procesar el documento. Por favor intenta de nuevo.');
        return;
      }

      ctx.session.temp.broadcastData.mediaType = 'document';
      ctx.session.temp.broadcastData.mediaFileId = document.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      logger.info('Broadcast document uploaded', {
        userId: ctx.from.id,
        fileId: document.file_id,
        target: ctx.session.temp.broadcastTarget
      });

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
      await ctx.reply('❌ Error al procesar el documento. Por favor intenta de nuevo.').catch(() => {});
    }
  });

  bot.on('audio', async (ctx, next) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      // Check if this is for broadcast
      if (!isAdmin || !ctx.session.temp || ctx.session.temp.broadcastStep !== 'media') {
        return next();
      }

      // Validate session state
      if (!ctx.session.temp.broadcastTarget || !ctx.session.temp.broadcastData) {
        logger.warn('Broadcast session incomplete when uploading audio', { userId: ctx.from.id });
        await ctx.reply('❌ Sesión expirada. Por favor inicia el broadcast de nuevo con /admin');
        return;
      }

      const audio = ctx.message.audio;

      if (!audio || !audio.file_id) {
        logger.error('Invalid audio upload', { userId: ctx.from.id });
        await ctx.reply('❌ Error al procesar el audio. Por favor intenta de nuevo.');
        return;
      }

      ctx.session.temp.broadcastData.mediaType = 'audio';
      ctx.session.temp.broadcastData.mediaFileId = audio.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      logger.info('Broadcast audio uploaded', {
        userId: ctx.from.id,
        fileId: audio.file_id,
        target: ctx.session.temp.broadcastTarget
      });

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
      await ctx.reply('❌ Error al procesar el audio. Por favor intenta de nuevo.').catch(() => {});
    }
  });

  bot.on('voice', async (ctx, next) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);

      // Check if this is for broadcast
      if (!isAdmin || !ctx.session.temp || ctx.session.temp.broadcastStep !== 'media') {
        return next();
      }

      // Validate session state
      if (!ctx.session.temp.broadcastTarget || !ctx.session.temp.broadcastData) {
        logger.warn('Broadcast session incomplete when uploading voice', { userId: ctx.from.id });
        await ctx.reply('❌ Sesión expirada. Por favor inicia el broadcast de nuevo con /admin');
        return;
      }

      const voice = ctx.message.voice;

      if (!voice || !voice.file_id) {
        logger.error('Invalid voice upload', { userId: ctx.from.id });
        await ctx.reply('❌ Error al procesar el mensaje de voz. Por favor intenta de nuevo.');
        return;
      }

      ctx.session.temp.broadcastData.mediaType = 'voice';
      ctx.session.temp.broadcastData.mediaFileId = voice.file_id;
      ctx.session.temp.broadcastStep = 'text_en';
      await ctx.saveSession();

      logger.info('Broadcast voice uploaded', {
        userId: ctx.from.id,
        fileId: voice.file_id,
        target: ctx.session.temp.broadcastTarget
      });

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
      await ctx.reply('❌ Error al procesar el mensaje de voz. Por favor intenta de nuevo.').catch(() => {});
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

    // Message to user after activation
    if (ctx.session.temp?.awaitingMessageInput) {
      try {
        const message = ctx.message.text;
        const recipientId = ctx.session.temp.messageRecipientId;
        const user = await UserModel.getById(recipientId);

        if (!user) {
          await ctx.reply('❌ Usuario no encontrado');
          ctx.session.temp.awaitingMessageInput = false;
          await ctx.saveSession();
          return;
        }

        // Send message to user
        try {
          await ctx.telegram.sendMessage(recipientId, message, { parse_mode: 'Markdown' });

          // Confirm to admin
          let confirmText = '✅ **Mensaje Enviado**\n\n';
          confirmText += `👤 Destinatario: ${user.firstName} ${user.lastName || ''}\n`;
          confirmText += `🆔 ID: ${recipientId}\n\n`;
          confirmText += '📨 El mensaje ha sido entregado correctamente.';

          await ctx.reply(confirmText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
            ]),
          });

          logger.info('Admin sent custom message to user', {
            adminId: ctx.from.id,
            recipientId,
            messageLength: message.length,
          });
        } catch (sendError) {
          logger.warn('Could not send message to user', { recipientId, error: sendError.message });

          let errorText = '⚠️ **Error al Enviar Mensaje**\n\n';
          errorText += `Usuario ${user.firstName} no pudo recibir el mensaje.\n\n`;
          errorText += `Posibles razones:\n`;
          errorText += `• El usuario ha bloqueado al bot\n`;
          errorText += `• El usuario ha eliminado su cuenta\n`;
          errorText += `• Error de Telegram`;

          await ctx.reply(errorText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
            ]),
          });
        }

        // Clear message input state
        ctx.session.temp.awaitingMessageInput = false;
        ctx.session.temp.messageRecipientId = null;
        await ctx.saveSession();
      } catch (error) {
        logger.error('Error handling message input:', error);
        await ctx.reply('❌ Error al procesar el mensaje');
      }
      return;
    }

    // Handle button preset selection
    const presetMatch = ctx.session?.broadcastStep === 'buttons' ? true : false;

    // Broadcast flow - If user types while in media step, guide them
    if (ctx.session.temp?.broadcastStep === 'media') {
      try {
        await ctx.reply(
          '⏳ *Esperando Media*\n\n'
          + 'Parece que estás escribiendo texto, pero aún estamos en el paso de media.\n\n'
          + 'Tienes dos opciones:\n'
          + '1️⃣ **Salta el media** - Presiona el botón "Saltar (Solo Texto)" arriba\n'
          + '2️⃣ **Sube media** - Envía una imagen, video o archivo\n\n'
          + 'Luego podrás escribir tu mensaje.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('⏭️ Saltar (Solo Texto)', 'broadcast_skip_media')],
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          }
        );
      } catch (error) {
        logger.error('Error guiding user during media step:', error);
      }
      return;
    }

    // Broadcast flow - Handle custom button entries
    if (ctx.session.temp?.broadcastStep === 'custom_buttons') {
      try {
        const message = ctx.message.text;

        // Check for "listo" (done) command
        if (message.toLowerCase() === 'listo') {
          // Verify at least one button was added
          if (!ctx.session.temp.customButtons || ctx.session.temp.customButtons.length === 0) {
            await ctx.reply(
              '❌ *Sin Botones*\n\n'
              + 'No has agregado ningún botón. Por favor agrega al menos uno o selecciona "Sin Botones".',
              {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('◀️ Volver a Presets', 'broadcast_custom_buttons')],
                ]),
              }
            );
            return;
          }

          // Convert custom buttons to same format as presets
          ctx.session.temp.broadcastData.buttons = ctx.session.temp.customButtons;

          // Move to schedule/send options
          ctx.session.temp.broadcastStep = 'schedule_options';
          await ctx.saveSession();

          await ctx.reply(
            '✅ *Botones Configurados*\n\n'
            + `📝 Botones agregados: ${ctx.session.temp.customButtons.length}\n\n`
            + '¿Qué deseas hacer?',
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📤 Enviar Ahora', 'broadcast_send_now_with_buttons')],
                [Markup.button.callback('📅 Programar', 'broadcast_schedule_with_buttons')],
                [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
              ]),
            }
          );
          return;
        }

        // Parse button entry: "Button Text|type|target"
        const parts = message.split('|');
        if (parts.length !== 3) {
          await ctx.reply(
            '❌ *Formato Inválido*\n\n'
            + 'Por favor usa el formato: `Texto|tipo|destino`\n\n'
            + '**Ejemplo:**\n'
            + '`💎 Ver Planes|command|/plans`\n\n'
            + 'O di "listo" cuando termines.',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const [buttonText, buttonType, buttonTarget] = parts.map(p => p.trim());

        // Validate button type
        const validTypes = ['url', 'plan', 'command', 'feature'];
        if (!validTypes.includes(buttonType.toLowerCase())) {
          await ctx.reply(
            '❌ *Tipo de Botón Inválido*\n\n'
            + `Tipo recibido: \`${buttonType}\`\n\n`
            + '**Tipos válidos:**\n'
            + '• `url` - Enlace web (ej: https://...)\n'
            + '• `plan` - Plan (ej: premium)\n'
            + '• `command` - Comando (ej: /plans)\n'
            + '• `feature` - Característica (ej: features)\n\n'
            + 'Por favor intenta de nuevo.',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Validate URL format if type is url
        if (buttonType.toLowerCase() === 'url') {
          if (!buttonTarget.startsWith('http://') && !buttonTarget.startsWith('https://')) {
            await ctx.reply(
              '❌ *URL Inválida*\n\n'
              + `URL recibida: \`${buttonTarget}\`\n\n`
              + 'Las URLs deben comenzar con `http://` o `https://`\n\n'
              + 'Por favor intenta de nuevo.',
              { parse_mode: 'Markdown' }
            );
            return;
          }
        }

        // Validate command format if type is command
        if (buttonType.toLowerCase() === 'command') {
          if (!buttonTarget.startsWith('/')) {
            await ctx.reply(
              '❌ *Comando Inválido*\n\n'
              + `Comando recibido: \`${buttonTarget}\`\n\n`
              + 'Los comandos deben comenzar con `/` (ej: /plans, /support)\n\n'
              + 'Por favor intenta de nuevo.',
              { parse_mode: 'Markdown' }
            );
            return;
          }
        }

        // Validate button text length
        if (buttonText.length > 64) {
          await ctx.reply(
            '❌ *Texto del Botón Muy Largo*\n\n'
            + `Longitud actual: ${buttonText.length} caracteres\n`
            + 'Máximo: 64 caracteres\n\n'
            + 'Por favor acorta el texto.',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Initialize customButtons array if needed
        if (!ctx.session.temp.customButtons) {
          ctx.session.temp.customButtons = [];
        }

        // Add button
        ctx.session.temp.customButtons.push({
          text: buttonText,
          type: buttonType.toLowerCase(),
          target: buttonTarget,
        });

        await ctx.saveSession();

        await ctx.reply(
          `✅ *Botón Agregado*\n\n`
          + `📝 ${buttonText}\n`
          + `🔗 Tipo: ${buttonType}\n`
          + `🎯 Destino: ${buttonTarget}\n\n`
          + `Total: ${ctx.session.temp.customButtons.length} botón(es)\n\n`
          + 'Envía otro botón o escribe "listo" cuando termines.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar', 'admin_cancel')],
            ]),
          }
        );
      } catch (error) {
        logger.error('Error handling custom button input:', error);
        await ctx.reply('❌ Error al procesar el botón. Por favor intenta de nuevo.').catch(() => {});
      }
      return;
    }

    // Broadcast flow - Handle text inputs
    if (ctx.session.temp?.broadcastStep === 'text_en') {
      try {
        const message = ctx.message.text;

        // Validate message length
        // Telegram caption limit is 1024 chars for media, 4096 for text-only
        // Use 1020 to leave room for the "📢 " prefix and safety margin
        const hasMedia = ctx.session.temp.broadcastData?.mediaFileId;
        const maxLength = hasMedia ? 1020 : 4000;
        const charCount = message.length;

        if (charCount > maxLength) {
          const excessChars = charCount - maxLength;
          await ctx.reply(
            `❌ *Mensaje demasiado largo*\n\n`
            + `📏 Tu mensaje: ${charCount} caracteres\n`
            + `📏 Límite máximo: ${maxLength} caracteres\n`
            + `⚠️ Exceso: ${excessChars} caracteres\n\n`
            + `${hasMedia ? '⚠️ *Nota:* Los mensajes con foto/video tienen un límite de 1024 caracteres en Telegram.\n\n' : ''}`
            + `Por favor acorta tu mensaje y envíalo de nuevo.`,
            { parse_mode: 'Markdown' },
          );
          return;
        }

        // Initialize broadcastData if needed
        if (!ctx.session.temp.broadcastData) {
          ctx.session.temp.broadcastData = {};
        }
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

        // Validate message length
        // Telegram caption limit is 1024 chars for media, 4096 for text-only
        // Use 1020 to leave room for the "📢 " prefix and safety margin
        const hasMedia = broadcastData.mediaFileId;
        const maxLength = hasMedia ? 1020 : 4000;
        const charCount = message.length;

        if (charCount > maxLength) {
          const excessChars = charCount - maxLength;
          await ctx.reply(
            `❌ *Mensaje demasiado largo*\n\n`
            + `📏 Tu mensaje: ${charCount} caracteres\n`
            + `📏 Límite máximo: ${maxLength} caracteres\n`
            + `⚠️ Exceso: ${excessChars} caracteres\n\n`
            + `${hasMedia ? '⚠️ *Nota:* Los mensajes con foto/video tienen un límite de 1024 caracteres en Telegram.\n\n' : ''}`
            + `Por favor acorta tu mensaje y envíalo de nuevo.`,
            { parse_mode: 'Markdown' },
          );
          return;
        }

        // Validate English text exists
        if (!broadcastData.textEn) {
          await ctx.reply('❌ Error: Falta el texto en inglés. Por favor inicia el broadcast de nuevo.');
          ctx.session.temp = {};
          await ctx.saveSession();
          return;
        }
        // Save Spanish text
        broadcastData.textEs = message;

        // Move to buttons step
        ctx.session.temp.broadcastStep = 'buttons';
        await ctx.saveSession();

        // Show buttons configuration screen
        const BroadcastButtonModel = require('../../../models/broadcastButtonModel');
        const presets = await BroadcastButtonModel.getAllPresets();

        const buttonMenu = presets.map(preset =>
          [Markup.button.callback(`${preset.icon} ${preset.name}`, `broadcast_preset_${preset.preset_id}`)]
        );
        buttonMenu.push([Markup.button.callback('➕ Botones Personalizados', 'broadcast_custom_buttons')]);
        buttonMenu.push([Markup.button.callback('⏭️ Sin Botones', 'broadcast_no_buttons')]);
        buttonMenu.push([Markup.button.callback('❌ Cancelar', 'admin_cancel')]);

        await ctx.reply(
          '🎯 *Paso 4/5: Configurar Botones*\n\n'
          + '¿Qué botones quieres agregar al broadcast?\n\n'
          + '💡 Selecciona un preset o agrega botones personalizados:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttonMenu),
          }
        );
        return;

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

            const replyMarkup = Markup.inlineKeyboard([
              Markup.button.callback(t('subscribe', userLang), 'show_subscription_plans'),
              Markup.button.callback(t('support', userLang), 'show_support'),
              Markup.button.callback(userLang === 'es' ? 'Menú Principal' : 'Main Menu', 'back_to_main')
            ]);

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
                  parse_mode: 'Markdown',
                  reply_markup: replyMarkup
                });
              } else {
                logger.warn(`Invalid media type for broadcast: ${broadcastData.mediaType}`);
                continue;
              }
            } else {
              // Text only
              await ctx.telegram.sendMessage(user.id, `📢 ${textToSend}`, { 
                parse_mode: 'Markdown',
                reply_markup: replyMarkup 
              });
            }

            sent += 1;
          } catch (sendError) {
            failed += 1;
            const errorMsg = sendError.message || '';
            
            // Log specific error types
            if (errorMsg.includes('caption is too long')) {
              logger.error('Broadcast caption too long - should have been caught by validation', { 
                userId: user.id, 
                textLength: textToSend?.length,
                hasMedia: !!broadcastData.mediaType 
              });
            } else if (errorMsg.includes('bot was blocked') || errorMsg.includes('user is deactivated')) {
              // User blocked bot or deactivated account - this is expected
              logger.debug('User unavailable for broadcast:', { userId: user.id });
            } else if (errorMsg.includes('chat not found')) {
              // Chat doesn't exist - user never started the bot
              logger.debug('Chat not found for broadcast:', { userId: user.id });
            } else {
              logger.warn('Failed to send broadcast to user:', { userId: user.id, error: errorMsg });
            }
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

    // Broadcast schedule datetime handling (collect up to 12 scheduled times)
    if (ctx.session.temp?.broadcastStep === 'schedule_datetime') {
      try {
        const input = ctx.message.text;
        const scheduleCount = ctx.session.temp.scheduleCount || 1;
        const currentIndex = ctx.session.temp.currentScheduleIndex || 0;

        // Parse date/time - expecting format: YYYY-MM-DD HH:MM
        const dateMatch = input.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (!dateMatch) {
          await ctx.reply(
            '❌ Formato de fecha inválido.\n\n'
            + 'Usa el formato: YYYY-MM-DD HH:MM\n'
            + 'Ejemplo: 2025-01-20 15:30'
          );
          return;
        }

        const scheduledDate = new Date(input);
        if (scheduledDate <= new Date()) {
          await ctx.reply('❌ La fecha debe ser en el futuro.');
          return;
        }

        // Add to scheduled times array
        if (!ctx.session.temp.scheduledTimes) {
          ctx.session.temp.scheduledTimes = [];
        }
        ctx.session.temp.scheduledTimes.push(scheduledDate);
        ctx.session.temp.currentScheduleIndex = currentIndex + 1;
        await ctx.saveSession();

        // If we need more datetimes, ask for the next one
        if (currentIndex + 1 < scheduleCount) {
          await ctx.reply(
            `✅ Programación ${currentIndex + 1}/${scheduleCount} confirmada\n`
            + `📅 ${scheduledDate.toLocaleString('es-ES', { timeZone: 'UTC' })} UTC\n\n`
            + `📅 *Programación ${currentIndex + 2}/${scheduleCount}*\n\n`
            + 'Por favor envía la fecha y hora en el siguiente formato:\n\n'
            + '`YYYY-MM-DD HH:MM`\n\n'
            + '*Ejemplos:*\n'
            + '• `2025-12-15 14:30` (15 dic 2025, 2:30 PM)\n'
            + '• `2025-12-25 09:00` (25 dic 2025, 9:00 AM)\n\n'
            + '⏰ *Zona horaria:* UTC',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // All datetimes collected - create broadcasts for each scheduled time
        const { broadcastTarget, broadcastData } = ctx.session.temp;

        if (!broadcastData || !broadcastData.textEn || !broadcastData.textEs) {
          await ctx.reply('❌ Error: Faltan datos del broadcast');
          return;
        }

        await ctx.reply(
          '📤 *Creando broadcasts programados...*\n\n'
          + `Generando ${scheduleCount} broadcast(s) programado(s)...`,
          { parse_mode: 'Markdown' }
        );

        const broadcastIds = [];
        let successCount = 0;
        let errorCount = 0;

        // Create a broadcast for each scheduled time
        for (let i = 0; i < ctx.session.temp.scheduledTimes.length; i += 1) {
          try {
            const scheduledTime = ctx.session.temp.scheduledTimes[i];
            const broadcast = await broadcastService.createBroadcast({
              adminId: String(ctx.from.id),
              adminUsername: ctx.from.username || 'Admin',
              title: `Broadcast programado ${scheduledTime.toLocaleDateString()} ${scheduledTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} UTC`,
              messageEn: broadcastData.textEn,
              messageEs: broadcastData.textEs,
              targetType: broadcastTarget,
              mediaType: broadcastData.mediaType || null,
              mediaUrl: broadcastData.s3Url || broadcastData.mediaFileId || null,
              mediaFileId: broadcastData.mediaFileId || null,
              s3Key: broadcastData.s3Key || null,
              s3Bucket: broadcastData.s3Bucket || null,
              scheduledAt: scheduledTime,
              timezone: 'UTC',
            });

            broadcastIds.push(broadcast.broadcast_id);
            successCount += 1;

            logger.info('Broadcast scheduled', {
              broadcastId: broadcast.broadcast_id,
              scheduleNumber: i + 1,
              scheduledAt: scheduledTime,
              totalSchedules: scheduleCount,
            });
          } catch (error) {
            logger.error(`Error creating broadcast ${i + 1}:`, error);
            errorCount += 1;
          }
        }

        // Clear session data
        ctx.session.temp.broadcastTarget = null;
        ctx.session.temp.broadcastStep = null;
        ctx.session.temp.broadcastData = null;
        ctx.session.temp.scheduledTimes = null;
        ctx.session.temp.scheduleCount = null;
        ctx.session.temp.currentScheduleIndex = null;
        await ctx.saveSession();

        // Show results
        let resultMessage = `✅ *Broadcasts Programados*\n\n`;
        resultMessage += `📊 *Resultados:*\n`;
        resultMessage += `✓ Creados: ${successCount}/${scheduleCount}\n`;
        if (errorCount > 0) {
          resultMessage += `✗ Errores: ${errorCount}\n`;
        }
        resultMessage += `\n🎯 Audiencia: ${broadcastTarget === 'all' ? 'Todos' : broadcastTarget === 'premium' ? 'Premium' : broadcastTarget === 'free' ? 'Gratis' : 'Churned'}\n`;
        resultMessage += `🌐 Mensajes bilingües: EN / ES\n`;
        resultMessage += `${broadcastData.mediaType ? `📎 Con media: ${broadcastData.mediaType}` : '📝 Solo texto'}\n`;
        resultMessage += `\n📅 *Programaciones:*\n`;

        ctx.session.temp.scheduledTimes?.forEach((time, idx) => {
          resultMessage += `${idx + 1}. ${time.toLocaleString('es-ES', { timeZone: 'UTC' })} UTC\n`;
        });

        resultMessage += `\n💡 Los broadcasts se enviarán automáticamente a la hora programada.`;

        await ctx.reply(
          resultMessage,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
            ]),
          }
        );

        logger.info('Broadcast scheduling completed', {
          adminId: ctx.from.id,
          totalSchedules: scheduleCount,
          successCount,
          errorCount,
          broadcastIds,
        });
      } catch (error) {
        logger.error('Error scheduling broadcasts:', error);
        await ctx.reply(
          '❌ *Error al programar broadcasts*\n\n'
          + `Detalles: ${error.message}`,
          { parse_mode: 'Markdown' }
        );
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
        let userId = ctx.message.text.trim();

        // Extract numeric ID if user sent /user123456789 format
        const match = userId.match(/\/user(\d+)|(\d+)/);
        if (match) {
          userId = match[1] || match[2];
        }

        // Validate it's a number
        if (!/^\d+$/.test(userId)) {
          await ctx.reply('❌ ID inválido. Por favor envía un ID de Telegram válido (solo números).\n\nEjemplos válidos: `1541921361` o `/user1541921361`', { parse_mode: 'Markdown' });
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

      const planName = user.planId || 'premium';

      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId: planName,
        expiry: newExpiry,
      });

      // Send PRIME confirmation with invite link to user
      await PaymentService.sendPrimeConfirmation(userId, planName, newExpiry, 'admin-extend');

      let successText = `✅ **Membresía Extendida**\n\n`;
      successText += `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`;
      successText += `⏱️ Duración: ${durationText}\n`;
      if (newExpiry) {
        successText += `📅 Nueva fecha de vencimiento: ${newExpiry.toLocaleDateString()}\n`;
      } else {
        successText += `♾️ Membresía Lifetime activada\n`;
      }
      successText += `\n📨 Se envió confirmación con enlace PRIME al usuario`;

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
      let newExpiry = null;
      let planName = 'Gratis';

      if (planId === 'free') {
        await UserModel.updateSubscription(userId, {
          status: 'free',
          planId: null,
          expiry: null,
        });
        // No PRIME confirmation for free plan
      } else {
        const plan = await PlanModel.getById(planId);
        if (!plan) {
          await ctx.answerCbQuery('Plan not found');
          return;
        }

        planName = plan.name || planId;

        // Set new expiry date based on plan duration
        newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30));

        await UserModel.updateSubscription(userId, {
          status: 'active',
          planId,
          expiry: newExpiry,
        });

        // Send PRIME confirmation with invite link to user
        await PaymentService.sendPrimeConfirmation(userId, planName, newExpiry, 'admin-plan-change');
      }

      let successMsg = `✅ Plan actualizado exitosamente\n\n`
        + `👤 Usuario: ${user.firstName} ${user.lastName || ''}\n`
        + `💎 Nuevo Plan: ${planId === 'free' ? 'Gratis' : planName}\n`
        + `📅 Estado: ${planId === 'free' ? 'free' : 'active'}`;

      if (planId !== 'free') {
        successMsg += `\n\n📨 Se envió confirmación con enlace PRIME al usuario`;
      }

      await ctx.editMessageText(
        successMsg,
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
      successText += '📨 El usuario ha sido notificado por el bot.\n\n';
      successText += '💬 **¿Deseas enviar un mensaje personalizado al usuario?**';

      // Store activation details for potential message sending
      ctx.session.temp.lastActivation = {
        userId,
        activationType: 'courtesy',
        durationText,
        expiryDate: expiryDate.toISOString(),
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        successText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Enviar Mensaje', `admin_send_message_${userId}`)],
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
    } catch (error) {
      logger.error('Error activating courtesy pass:', error);
      try {
        await ctx.answerCbQuery('Error al activar pase de cortesía');
      } catch (cbError) {
        // Ignore callback query errors if it times out
      }
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
      successText += '📨 El usuario ha sido notificado por el bot.\n\n';
      successText += '💬 **¿Deseas enviar un mensaje personalizado al usuario?**';

      // Store activation details for potential message sending
      ctx.session.temp.lastActivation = {
        userId,
        activationType: 'plan',
        planName,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
      };
      await ctx.saveSession();

      await ctx.editMessageText(
        successText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Enviar Mensaje', `admin_send_message_${userId}`)],
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
    } catch (error) {
      logger.error('Error activating plan:', error);
      try {
        await ctx.answerCbQuery('Error al activar membresía');
      } catch (cbError) {
        // Ignore callback query errors if it times out
      }
    }
  });

  // Handle send message button after activation
  bot.action(/^admin_send_message_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.match[1];
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('Usuario no encontrado');
        return;
      }

      // Set up session to capture message input
      ctx.session.temp.messageRecipientId = userId;
      ctx.session.temp.awaitingMessageInput = true;
      await ctx.saveSession();

      const lang = user.language || 'es';
      const messagePrompt = lang === 'es'
        ? `📝 **Enviar Mensaje a ${user.firstName}**\n\nPor favor, escribe el mensaje que deseas enviar a este usuario. Usa /cancelar para salir.`
        : `📝 **Send Message to ${user.firstName}**\n\nPlease type the message you want to send to this user. Use /cancelar to cancel.`;

      await ctx.reply(messagePrompt, { parse_mode: 'Markdown' });
      try {
        await ctx.answerCbQuery('Escribe tu mensaje');
      } catch (cbError) {
        // Ignore callback query errors if it times out
      }
    } catch (error) {
      logger.error('Error handling send message action:', error);
      try {
        await ctx.answerCbQuery('Error al procesar solicitud');
      } catch (cbError) {
        // Ignore callback query errors if it times out
      }
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

/**
 * Send broadcast with buttons
 */
async function sendBroadcastWithButtons(ctx, bot) {
  try {
    const { broadcastTarget, broadcastData } = ctx.session.temp;
    const { getLanguage } = require('../../utils/helpers');

    if (!broadcastData || !broadcastData.textEn || !broadcastData.textEs) {
      await ctx.reply('❌ Error: Faltan datos del broadcast');
      return;
    }

    await ctx.editMessageText(
      '📤 *Enviando Broadcast...*\n\n'
      + 'Tu broadcast se está enviando a los usuarios seleccionados...'
    );

    // Get target users
    let users = [];
    if (broadcastTarget === 'all') {
      const result = await UserModel.getAll(1000);
      users = result.users;
    } else if (broadcastTarget === 'premium') {
      users = await UserModel.getBySubscriptionStatus('active');
    } else if (broadcastTarget === 'free') {
      users = await UserModel.getBySubscriptionStatus('free');
    } else if (broadcastTarget === 'churned') {
      users = await UserModel.getChurnedUsers();
    }

    let sent = 0;
    let failed = 0;

    // Build button markup
    const buildButtonMarkup = (buttons, userLang) => {
      if (!buttons || buttons.length === 0) {
        return undefined; // No buttons
      }

      try {
        // If buttons is a JSON string, parse it
        let buttonArray = buttons;
        if (typeof buttons === 'string') {
          buttonArray = JSON.parse(buttons);
        }

        if (!Array.isArray(buttonArray) || buttonArray.length === 0) {
          return undefined;
        }

        const buttonRows = [];
        for (const btn of buttonArray) {
          const buttonObj = typeof btn === 'string' ? JSON.parse(btn) : btn;

          if (buttonObj.type === 'url') {
            buttonRows.push([Markup.button.url(buttonObj.text, buttonObj.target)]);
          } else if (buttonObj.type === 'command') {
            buttonRows.push([Markup.button.callback(buttonObj.text, `broadcast_action_${buttonObj.target}`)]);
          } else if (buttonObj.type === 'plan') {
            buttonRows.push([Markup.button.callback(buttonObj.text, `broadcast_plan_${buttonObj.target}`)]);
          } else if (buttonObj.type === 'feature') {
            buttonRows.push([Markup.button.callback(buttonObj.text, `broadcast_feature_${buttonObj.target}`)]);
          }
        }

        return Markup.inlineKeyboard(buttonRows);
      } catch (error) {
        logger.warn('Error building button markup:', error);
        return undefined;
      }
    };

    // Send to each user
    for (const user of users) {
      try {
        const userLang = user.language || 'en';
        const textToSend = userLang === 'es' ? broadcastData.textEs : broadcastData.textEn;
        const buttonMarkup = buildButtonMarkup(broadcastData.buttons, userLang);

        // Send with media if available
        if (broadcastData.mediaType && broadcastData.mediaFileId) {
          const sendMethod = {
            photo: 'sendPhoto',
            video: 'sendVideo',
            document: 'sendDocument',
          }[broadcastData.mediaType];

          if (sendMethod) {
            const options = {
              caption: `📢 ${textToSend}`,
              parse_mode: 'Markdown',
            };
            if (buttonMarkup) {
              options.reply_markup = buttonMarkup;
            }

            await ctx.telegram[sendMethod](user.id, broadcastData.mediaFileId, options);
          }
        } else {
          // Text only
          const options = {
            parse_mode: 'Markdown',
          };
          if (buttonMarkup) {
            options.reply_markup = buttonMarkup;
          }

          await ctx.telegram.sendMessage(user.id, `📢 ${textToSend}`, options);
        }

        sent++;
      } catch (error) {
        failed++;
        const errorMsg = error.message || '';

        if (errorMsg.includes('bot was blocked') || errorMsg.includes('user is deactivated') || errorMsg.includes('chat not found')) {
          logger.debug('User unavailable for broadcast:', { userId: user.id });
        } else {
          logger.warn('Failed to send broadcast to user:', { userId: user.id, error: errorMsg });
        }
      }
    }

    // Clear broadcast session data
    ctx.session.temp.broadcastTarget = null;
    ctx.session.temp.broadcastStep = null;
    ctx.session.temp.broadcastData = null;
    await ctx.saveSession();

    // Show results
    const buttonInfo = broadcastData.buttons && broadcastData.buttons.length > 0
      ? `\n🔘 Botones: ${Array.isArray(broadcastData.buttons) ? broadcastData.buttons.length : JSON.parse(broadcastData.buttons).length}`
      : '';

    await ctx.reply(
      `✅ *Broadcast Completado*\n\n`
      + `📊 Estadísticas:\n`
      + `✓ Enviados: ${sent}\n`
      + `✗ Fallidos: ${failed}\n`
      + `📈 Total intentos: ${sent + failed}`
      + buttonInfo,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Volver al Panel Admin', 'admin_cancel')],
        ]),
      }
    );

    logger.info('Broadcast with buttons sent', {
      adminId: ctx.from.id,
      sent,
      failed,
      buttons: broadcastData.buttons ? (Array.isArray(broadcastData.buttons) ? broadcastData.buttons.length : JSON.parse(broadcastData.buttons).length) : 0,
    });
  } catch (error) {
    logger.error('Error sending broadcast with buttons:', error);
    await ctx.reply('❌ Error al enviar broadcast').catch(() => {});
  }
}

// Import and register audio management handlers
const registerAudioManagementHandlers = require('./audioManagement');
const ChatCleanupService = require('../../services/chatCleanupService');

// Group cleanup command for admins
const registerGroupCleanupCommand = (bot) => {
  bot.command('cleanupcommunity', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.reply(t('unauthorized', getLanguage(ctx)));
        return;
      }

      const lang = getLanguage(ctx);
      const groupId = process.env.GROUP_ID || '-1003291737499';

      // Send status message
      const statusMsg = await ctx.reply(
        lang === 'es'
          ? '🧹 Limpiando mensajes del bot en la comunidad...\n\n⚠️ Nota: Solo se eliminan mensajes del bot\n✨ Las fotos y videos del Muro de la Fama NO se eliminan NUNCA'
          : '🧹 Cleaning bot messages in community...\n\n⚠️ Note: Only bot messages are deleted\n✨ Wall of Fame photos and videos are NEVER deleted'
      );

      try {
        // Get the Telegram instance
        const telegram = ctx.telegram;

        // Delete all previous bot messages except the status message itself
        const deletedCount = await ChatCleanupService.deleteAllPreviousBotMessages(
          telegram,
          groupId,
          statusMsg.message_id // Keep only the most recent message (this one)
        );

        // Build detailed results message
        const detailedResults = lang === 'es'
          ? `✅ Limpieza completada\n\n📊 Estadísticas:\n• Mensajes del bot eliminados: ${deletedCount}\n• Mensaje actual: ✨ Conservado (más reciente)\n\n🛡️ Excepciones:\n• Muro de la Fama: NUNCA se eliminan ♾️\n• Fotos/Videos: Permanentes en el Muro ♾️\n• Solo mensajes del bot anterior: Eliminados`
          : `✅ Cleanup completed\n\n📊 Statistics:\n• Bot messages deleted: ${deletedCount}\n• Current message: ✨ Kept (most recent)\n\n🛡️ Exceptions:\n• Wall of Fame: NEVER deleted ♾️\n• Photos/Videos: Permanent on Wall ♾️\n• Only previous bot messages: Deleted`;

        // Update status message with results
        await ctx.telegram.editMessageText(
          groupId,
          statusMsg.message_id,
          undefined,
          detailedResults
        );

        // Also send confirmation to admin
        await ctx.reply(
          lang === 'es'
            ? `✅ Limpieza completada exitosamente\n\n📊 Mensajes eliminados: ${deletedCount}\n\n🔐 Regla de Eliminación:\n✅ Se eliminan: Todos los mensajes previos del bot\n✨ Se conservan: Solo el mensaje más reciente\n♾️ NUNCA se eliminan: Fotos/Videos del Muro de la Fama`
            : `✅ Cleanup completed successfully\n\n📊 Messages deleted: ${deletedCount}\n\n🔐 Deletion Rule:\n✅ Deleted: All previous bot messages\n✨ Kept: Only the most recent message\n♾️ NEVER deleted: Wall of Fame photos/videos`
        );

        logger.info('Group cleanup completed', {
          groupId,
          deletedCount,
          keptMessage: statusMsg.message_id,
          rule: 'Only previous bot messages deleted, keep most recent, Wall of Fame forever',
        });
      } catch (cleanupError) {
        logger.error('Error during cleanup:', cleanupError);
        await ctx.telegram.editMessageText(
          groupId,
          statusMsg.message_id,
          undefined,
          lang === 'es'
            ? '❌ Error durante la limpieza'
            : '❌ Error during cleanup'
        );
        await ctx.reply(
          lang === 'es'
            ? '❌ Error al limpiar los mensajes'
            : '❌ Error cleaning messages'
        );
      }
    } catch (error) {
      logger.error('Error in cleanupcommunity command:', error);
      await ctx.reply('❌ ' + (getLanguage(ctx) === 'es' ? 'Error en el comando' : 'Command error')).catch(() => {});
    }
  });
};

// After registerAdminHandlers is defined, wrap it to add additional handlers
const wrappedRegisterAdminHandlers = registerAdminHandlers;

// Create wrapper function that also registers audio management and group cleanup
const finalRegisterAdminHandlers = (bot) => {
  wrappedRegisterAdminHandlers(bot);
  registerAudioManagementHandlers(bot);
  registerGroupCleanupCommand(bot);
};

module.exports = finalRegisterAdminHandlers;
