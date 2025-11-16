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
    buttons.push([Markup.button.callback(t('userManagement', lang), 'admin_users')]);

    // Admin and SuperAdmin features
    if (userRole === 'superadmin' || userRole === 'admin') {
      buttons.push([Markup.button.callback(t('broadcast', lang), 'admin_broadcast')]);
      buttons.push([Markup.button.callback(t('analytics', lang), 'admin_analytics')]);
      buttons.push([Markup.button.callback(t('gamification.title', lang), 'admin_gamification')]);
      buttons.push([Markup.button.callback('📻 Radio Management', 'admin_radio')]);
      buttons.push([Markup.button.callback('📺 Live Stream Management', 'admin_live_streams')]);
    }

    // SuperAdmin only features
    if (userRole === 'superadmin') {
      buttons.push([Markup.button.callback('📋 Gestión de Menús', 'admin_menus')]);
      buttons.push([Markup.button.callback('👑 Gestión de Roles', 'admin_roles')]);
      buttons.push([Markup.button.callback(t('planManagement', lang), 'admin_plans')]);
      buttons.push([Markup.button.callback('📜 Ver Logs', 'admin_logs')]);
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
        + `${Object.entries(last30Revenue.byPlan).map(([plan, count]) => `  ${plan}: ${count}`).join('\n') || '  No data'}\n\n`
        + '*Provider Breakdown:*\n'
        + `${Object.entries(last30Revenue.byProvider).map(([provider, count]) => `  ${provider}: ${count}`).join('\n') || '  No data'}\n\n`
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
      ctx.session.temp.adminSearchingUser = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('searchUser', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'admin_cancel')],
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

      await ctx.editMessageText(
        t('broadcastTarget', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('allUsers', lang), 'broadcast_all')],
          [Markup.button.callback(t('premiumOnly', lang), 'broadcast_premium')],
          [Markup.button.callback(t('freeOnly', lang), 'broadcast_free')],
          [Markup.button.callback(t('cancel', lang), 'admin_cancel')],
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
      ctx.session.temp.waitingForBroadcast = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('enterBroadcast', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error in broadcast target:', error);
    }
  });

  // Plan management
  bot.action('admin_plans', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);
      const plans = await PlanModel.getAll();

      let message = `${t('planManagement', lang)}\n\n`;
      plans.forEach((plan) => {
        message += `💎 ${plan.name} - $${plan.price}/month\n`;
      });

      await ctx.editMessageText(
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Plan', 'admin_plan_add')],
          [Markup.button.callback(t('back', lang), 'admin_cancel')],
        ]),
      );
    } catch (error) {
      logger.error('Error in admin plans:', error);
    }
  });

  // Analytics
  bot.action('admin_analytics', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const lang = getLanguage(ctx);

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
          [Markup.button.callback('🔄 Refresh', 'admin_analytics')],
          [Markup.button.callback(t('back', lang), 'admin_cancel')],
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
          + `💎 Status: ${user.subscriptionStatus}`,
          Markup.inlineKeyboard([
            [Markup.button.callback(t('extendSubscription', lang), 'admin_extend_sub')],
            [Markup.button.callback(t('deactivateUser', lang), 'admin_deactivate')],
            [Markup.button.callback(t('back', lang), 'admin_cancel')],
          ]),
        );
      } catch (error) {
        logger.error('Error searching user:', error);
      }
      return;
    }

    // Broadcast message
    if (ctx.session.temp?.waitingForBroadcast) {
      try {
        const lang = getLanguage(ctx);
        const message = ctx.message.text;
        const target = ctx.session.temp.broadcastTarget;

        ctx.session.temp.waitingForBroadcast = false;
        await ctx.saveSession();

        // Get target users
        let users = [];
        if (target === 'all') {
          const result = await UserModel.getAll(1000);
          users = result.users;
        } else if (target === 'premium') {
          users = await UserModel.getBySubscriptionStatus('active');
        } else if (target === 'free') {
          users = await UserModel.getBySubscriptionStatus('free');
        }

        // Send broadcast
        let sent = 0;
        for (const user of users) {
          try {
            await ctx.telegram.sendMessage(user.id, `📢 ${message}`);
            sent += 1;
          } catch (sendError) {
            logger.warn('Failed to send broadcast to user:', { userId: user.id });
          }
        }

        await ctx.reply(
          t('broadcastSent', lang, { count: sent }),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'admin_cancel')],
          ]),
        );

        logger.info('Broadcast sent', { adminId: ctx.from.id, target, sent });
      } catch (error) {
        logger.error('Error sending broadcast:', error);
      }
      return;
    }

    return next();
  });

  // Extend subscription
  bot.action('admin_extend_sub', async (ctx) => {
    try {
      const isAdmin = await PermissionService.isAdmin(ctx.from.id);
      if (!isAdmin) return;

      const userId = ctx.session.temp.selectedUserId;
      const lang = getLanguage(ctx);

      // Extend by 30 days
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);

      await UserModel.updateSubscription(userId, {
        status: 'active',
        planId: 'premium',
        expiry: newExpiry,
      });

      await ctx.editMessageText(
        `✅ Subscription extended for user ${userId} until ${newExpiry.toLocaleDateString()}`,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'admin_cancel')],
        ]),
      );

      logger.info('Subscription extended by admin', { adminId: ctx.from.id, userId });
    } catch (error) {
      logger.error('Error extending subscription:', error);
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
          [Markup.button.callback(t('back', lang), 'admin_cancel')],
        ]),
      );

      logger.info('User deactivated by admin', { adminId: ctx.from.id, userId });
    } catch (error) {
      logger.error('Error deactivating user:', error);
    }
  });
};

module.exports = registerAdminHandlers;
