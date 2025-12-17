const { getAdminMenu } = require('../../utils/menus');
const { adminOnly } = require('../../core/middleware/admin');
const adminService = require('../../services/adminService');
const logger = require('../../../utils/logger');

/**
 * Handle /admin command - show admin dashboard
 */
async function handleAdminDashboard(ctx) {
  try {
    const userId = ctx.from.id;

    // Get dashboard stats
    const stats = await adminService.getDashboardStats();

    const dashboardMessage = `🔐 **Admin Dashboard**\n\n` +
      `**User Statistics:**\n` +
      `• Total Users: ${stats.users.totalUsers}\n` +
      `• Active Subscriptions: ${stats.users.activeSubscriptions}\n` +
      `• New Users (30 days): ${stats.users.newUsersLast30Days}\n\n` +
      `**Plans Distribution:**\n` +
      `${Object.entries(stats.users.byPlan)
        .map(([plan, count]) => `• ${plan}: ${count}`)
        .join('\n')}\n\n` +
      `Use the buttons below to manage your bot:`;

    await ctx.reply(dashboardMessage, {
      parse_mode: 'Markdown',
      reply_markup: getAdminMenu(),
    });

    logger.info(`Admin dashboard accessed by ${userId}`);
  } catch (error) {
    logger.error('Error in admin dashboard:', error);
    await ctx.reply('❌ Error loading dashboard. Please try again.');
  }
}

module.exports = {
  handleAdminDashboard,
};
