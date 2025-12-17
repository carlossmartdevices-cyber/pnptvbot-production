const { Markup } = require('telegraf');
const GamificationModel = require('../../../models/gamificationModel');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Gamification handlers for admin
 * @param {Telegraf} bot - Bot instance
 */
const registerGamificationHandlers = (bot) => {
  // Main gamification menu
  bot.action('admin_gamification', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showGamificationMenu(ctx);
    } catch (error) {
      logger.error('Error showing gamification menu:', error);
    }
  });

  // Weekly leaderboard
  bot.action('gamification_weekly_leaderboard', async (ctx) => {
    try {
      await showWeeklyLeaderboard(ctx);
    } catch (error) {
      logger.error('Error showing weekly leaderboard:', error);
    }
  });

  // All-time leaderboard
  bot.action('gamification_alltime_leaderboard', async (ctx) => {
    try {
      await showAllTimeLeaderboard(ctx);
    } catch (error) {
      logger.error('Error showing all-time leaderboard:', error);
    }
  });

  // Activity statistics
  bot.action('gamification_statistics', async (ctx) => {
    try {
      await showActivityStatistics(ctx);
    } catch (error) {
      logger.error('Error showing activity statistics:', error);
    }
  });

  // Badge management menu
  bot.action('gamification_badges', async (ctx) => {
    try {
      await showBadgeManagement(ctx);
    } catch (error) {
      logger.error('Error showing badge management:', error);
    }
  });

  // Create custom badge
  bot.action('gamification_create_badge', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForBadgeData = { step: 'name' };
      await ctx.saveSession();

      await ctx.editMessageText(t('gamification.enterBadgeName', lang));
    } catch (error) {
      logger.error('Error starting badge creation:', error);
    }
  });

  // List custom badges
  bot.action('gamification_list_badges', async (ctx) => {
    try {
      await showCustomBadges(ctx);
    } catch (error) {
      logger.error('Error showing custom badges:', error);
    }
  });

  // Delete badge
  bot.action(/^delete_badge_(.+)$/, async (ctx) => {
    try {
      const badgeId = ctx.match[1];
      await deleteCustomBadge(ctx, badgeId);
    } catch (error) {
      logger.error('Error deleting badge:', error);
    }
  });

  // Assign badge menu
  bot.action('gamification_assign_badge', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForBadgeAssignment = { step: 'userId' };
      await ctx.saveSession();

      await ctx.editMessageText(t('gamification.enterUserIdForBadge', lang));
    } catch (error) {
      logger.error('Error starting badge assignment:', error);
    }
  });

  // Select badge to assign
  bot.action(/^assign_badge_(.+)_(.+)$/, async (ctx) => {
    try {
      const userId = ctx.match[1];
      const badgeType = ctx.match[2];
      await assignBadgeToUser(ctx, userId, badgeType);
    } catch (error) {
      logger.error('Error assigning badge:', error);
    }
  });

  // Remove badge from user
  bot.action(/^remove_badge_(.+)_(.+)$/, async (ctx) => {
    try {
      const userId = ctx.match[1];
      const badgeType = ctx.match[2];
      await removeBadgeFromUser(ctx, userId, badgeType);
    } catch (error) {
      logger.error('Error removing badge:', error);
    }
  });

  // View user activity
  bot.action(/^view_activity_(.+)$/, async (ctx) => {
    try {
      const userId = ctx.match[1];
      await showUserActivity(ctx, userId);
    } catch (error) {
      logger.error('Error showing user activity:', error);
    }
  });

  // Handle text inputs for badge creation and assignment
  bot.on('text', async (ctx, next) => {
    const { temp } = ctx.session;

    // Badge creation flow
    if (temp?.waitingForBadgeData) {
      try {
        await handleBadgeCreationInput(ctx);
        return;
      } catch (error) {
        logger.error('Error in badge creation flow:', error);
      }
      return;
    }

    // Badge assignment flow
    if (temp?.waitingForBadgeAssignment) {
      try {
        await handleBadgeAssignmentInput(ctx);
        return;
      } catch (error) {
        logger.error('Error in badge assignment flow:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show gamification menu
 */
const showGamificationMenu = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    // Clear any ongoing admin tasks
    ctx.session.temp = {};
    await ctx.saveSession();

    const text = `${t('gamification.title', lang)}\n\n${t('gamification.description', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🏆 Ranking Semanal', 'gamification_weekly_leaderboard')],
      [Markup.button.callback('🌟 Ranking Histórico', 'gamification_alltime_leaderboard')],
      [Markup.button.callback('📊 Estadísticas', 'gamification_statistics')],
      [Markup.button.callback('🏅 Gestión de Insignias', 'gamification_badges')],
      [Markup.button.callback('◀️ Volver', 'admin_cancel')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error in showGamificationMenu:', error);
  }
};

/**
 * Show weekly leaderboard
 */
const showWeeklyLeaderboard = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const leaderboard = await GamificationModel.getWeeklyLeaderboard(10);

    if (!leaderboard || leaderboard.length === 0) {
      await ctx.editMessageText(
        t('gamification.noActivityThisWeek', lang),
        Markup.inlineKeyboard([[Markup.button.callback('◀️ Volver', 'admin_gamification')]]),
      );
      return;
    }

    let text = `🏆 ${t('gamification.weeklyLeaderboard', lang)}\n\n`;

    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await UserModel.getById(entry.userId);

      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const userName = user ? `${user.firstName} ${user.lastName || ''}` : `User ${entry.userId}`;

      text += `${medal} ${userName}\n`;
      text += `   💎 ${entry.points} pts | 💬 ${entry.messages} msgs | 📤 ${entry.shares} shares\n\n`;
    }

    const keyboard = [
      [Markup.button.callback('🔄 Actualizar', 'gamification_weekly_leaderboard')],
      [Markup.button.callback('◀️ Volver', 'admin_gamification')],
    ];

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing weekly leaderboard:', error);
  }
};

/**
 * Show all-time leaderboard
 */
const showAllTimeLeaderboard = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const leaderboard = await GamificationModel.getAllTimeLeaderboard(10);

    if (!leaderboard || leaderboard.length === 0) {
      await ctx.editMessageText(
        t('gamification.noActivity', lang),
        Markup.inlineKeyboard([[Markup.button.callback('◀️ Volver', 'admin_gamification')]]),
      );
      return;
    }

    let text = `🌟 ${t('gamification.allTimeLeaderboard', lang)}\n\n`;

    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await UserModel.getById(entry.userId);

      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const userName = user ? `${user.firstName} ${user.lastName || ''}` : `User ${entry.userId}`;

      text += `${medal} ${userName}\n`;
      text += `   💎 ${entry.totalPoints} pts | 💬 ${entry.totalMessages} msgs | 📤 ${entry.totalShares} shares\n\n`;
    }

    const keyboard = [
      [Markup.button.callback('🔄 Actualizar', 'gamification_alltime_leaderboard')],
      [Markup.button.callback('◀️ Volver', 'admin_gamification')],
    ];

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing all-time leaderboard:', error);
  }
};

/**
 * Show activity statistics
 */
const showActivityStatistics = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const stats = await GamificationModel.getStatistics();
    const weeklyBreakdown = await GamificationModel.getActivityBreakdown('week');
    const allTimeBreakdown = await GamificationModel.getActivityBreakdown('alltime');

    let text = `📊 ${t('gamification.statistics', lang)}\n\n`;
    text += '📅 **This Week:**\n';
    text += `👥 Active Users: ${stats.activeUsersThisWeek}\n`;
    text += `💎 Total Points: ${weeklyBreakdown.totalPoints}\n`;
    text += `💬 Messages: ${weeklyBreakdown.totalMessages}\n`;
    text += `📤 Shares: ${weeklyBreakdown.totalShares}\n`;
    text += `👍 Likes: ${weeklyBreakdown.totalLikes}\n`;
    text += `🔄 Interactions: ${weeklyBreakdown.totalInteractions}\n\n`;

    text += '🌍 **All Time:**\n';
    text += `💎 Total Points: ${allTimeBreakdown.totalPoints}\n`;
    text += `💬 Messages: ${allTimeBreakdown.totalMessages}\n`;
    text += `📤 Shares: ${allTimeBreakdown.totalShares}\n`;
    text += `👍 Likes: ${allTimeBreakdown.totalLikes}\n`;
    text += `🔄 Interactions: ${allTimeBreakdown.totalInteractions}\n`;

    const keyboard = [
      [Markup.button.callback('🔄 Actualizar', 'gamification_statistics')],
      [Markup.button.callback('◀️ Volver', 'admin_gamification')],
    ];

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing activity statistics:', error);
  }
};

/**
 * Show badge management menu
 */
const showBadgeManagement = async (ctx) => {
  try {
    const lang = getLanguage(ctx);

    const text = `🏅 ${t('gamification.badgeManagement', lang)}\n\n${t('gamification.badgeDescription', lang)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Crear Insignia', 'gamification_create_badge')],
      [Markup.button.callback('📋 Ver Insignias', 'gamification_list_badges')],
      [Markup.button.callback('🎯 Asignar Insignia', 'gamification_assign_badge')],
      [Markup.button.callback('◀️ Volver', 'admin_gamification')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error showing badge management:', error);
  }
};

/**
 * Show custom badges
 */
const showCustomBadges = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const badges = await GamificationModel.getCustomBadges();

    let text = `🏅 ${t('gamification.customBadges', lang)}\n\n`;

    if (!badges || badges.length === 0) {
      text += t('gamification.noBadges', lang);
    } else {
      badges.forEach((badge, index) => {
        text += `${index + 1}. ${badge.icon} ${badge.name}\n`;
        text += `   ${badge.description}\n\n`;
      });
    }

    const keyboard = [];

    // Add delete buttons for each badge
    badges.forEach((badge) => {
      keyboard.push([
        Markup.button.callback(`🗑️ ${badge.name}`, `delete_badge_${badge.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback('◀️ Volver', 'gamification_badges')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing custom badges:', error);
  }
};

/**
 * Handle badge creation input
 */
const handleBadgeCreationInput = async (ctx) => {
  const lang = getLanguage(ctx);
  const { waitingForBadgeData } = ctx.session.temp;

  if (waitingForBadgeData.step === 'name') {
    waitingForBadgeData.name = ctx.message.text;
    waitingForBadgeData.step = 'description';
    await ctx.saveSession();

    await ctx.reply(t('gamification.enterBadgeDescription', lang));
  } else if (waitingForBadgeData.step === 'description') {
    waitingForBadgeData.description = ctx.message.text;
    waitingForBadgeData.step = 'icon';
    await ctx.saveSession();

    await ctx.reply(t('gamification.enterBadgeIcon', lang));
  } else if (waitingForBadgeData.step === 'icon') {
    const icon = ctx.message.text;

    // Create the badge
    const badge = await GamificationModel.createCustomBadge({
      name: waitingForBadgeData.name,
      description: waitingForBadgeData.description,
      icon,
      color: '#FFD700',
      createdBy: ctx.from.id.toString(),
    });

    delete ctx.session.temp.waitingForBadgeData;
    await ctx.saveSession();

    if (badge) {
      await ctx.reply(t('gamification.badgeCreated', lang, { name: badge.name }));
      await showCustomBadges(ctx);
    } else {
      await ctx.reply(t('error', lang));
    }
  }
};

/**
 * Delete custom badge
 */
const deleteCustomBadge = async (ctx, badgeId) => {
  try {
    const lang = getLanguage(ctx);
    await GamificationModel.deleteCustomBadge(badgeId);
    await ctx.answerCbQuery(t('gamification.badgeDeleted', lang));
    await showCustomBadges(ctx);
  } catch (error) {
    logger.error('Error deleting badge:', error);
  }
};

/**
 * Handle badge assignment input
 */
const handleBadgeAssignmentInput = async (ctx) => {
  const lang = getLanguage(ctx);
  const { waitingForBadgeAssignment } = ctx.session.temp;

  if (waitingForBadgeAssignment.step === 'userId') {
    const userId = ctx.message.text.trim();

    // Check if user exists
    const user = await UserModel.getById(userId);
    if (!user) {
      await ctx.reply(t('userNotFound', lang));
      return;
    }

    waitingForBadgeAssignment.userId = userId;
    waitingForBadgeAssignment.step = 'badge';
    await ctx.saveSession();

    // Show badge selection - get all badges from database
    const text = `${t('gamification.selectBadge', lang)}\n\n👤 ${user.firstName} ${user.lastName || ''}`;

    const keyboard = [];

    // Get all custom badges from database
    const customBadges = await GamificationModel.getCustomBadges();
    customBadges.forEach((badge) => {
      // Format: "icon name" like "🏆 Trailblazer"
      const badgeDisplay = `${badge.icon} ${badge.name}`;
      keyboard.push([
        Markup.button.callback(badgeDisplay, `assign_badge_${userId}_${badge.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback('❌ Cancelar', 'gamification_badges')]);

    await ctx.reply(text, Markup.inlineKeyboard(keyboard));
  }
};

/**
 * Assign badge to user
 */
const assignBadgeToUser = async (ctx, userId, badgeId) => {
  try {
    const lang = getLanguage(ctx);

    // Get badge from database
    const badge = await GamificationModel.getBadgeById(badgeId);
    if (!badge) {
      await ctx.answerCbQuery('Badge not found');
      return;
    }

    // Format badge as "icon name" like "🏆 Trailblazer"
    const badgeString = `${badge.icon} ${badge.name}`;
    
    await UserModel.addBadge(userId, badgeString);

    delete ctx.session.temp.waitingForBadgeAssignment;
    await ctx.saveSession();

    const user = await UserModel.getById(userId);
    await ctx.answerCbQuery(t('gamification.badgeAssigned', lang));
    await ctx.editMessageText(
      t('gamification.badgeAssignedSuccess', lang, { name: user.firstName, badge: badgeString }),
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Volver', 'gamification_badges')]]),
    );
  } catch (error) {
    logger.error('Error assigning badge:', error);
  }
};

/**
 * Remove badge from user
 */
const removeBadgeFromUser = async (ctx, userId, badgeType) => {
  try {
    const lang = getLanguage(ctx);

    await UserModel.removeBadge(userId, badgeType);

    await ctx.answerCbQuery(t('gamification.badgeRemoved', lang));
    await showUserActivity(ctx, userId);
  } catch (error) {
    logger.error('Error removing badge:', error);
  }
};

/**
 * Show user activity
 */
const showUserActivity = async (ctx, userId) => {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(userId);
    const activity = await GamificationModel.getUserActivity(userId);

    if (!user) {
      await ctx.reply(t('userNotFound', lang));
      return;
    }

    let text = `📊 ${t('gamification.userActivity', lang)}\n\n`;
    text += `👤 ${user.firstName} ${user.lastName || ''}\n`;
    if (user.username) text += `@${user.username}\n`;
    text += '\n';

    if (activity) {
      text += `💎 Total Points: ${activity.totalPoints || 0}\n`;
      text += `💬 Total Messages: ${activity.totalMessages || 0}\n`;
      text += `📤 Total Shares: ${activity.totalShares || 0}\n`;
      text += `👍 Total Likes: ${activity.totalLikes || 0}\n`;
      text += `🔄 Total Interactions: ${activity.totalInteractions || 0}\n`;

      const weeklyRank = await GamificationModel.getUserWeeklyRank(userId);
      if (weeklyRank) {
        text += `\n🏆 Weekly Rank: #${weeklyRank}\n`;
      }
    } else {
      text += t('gamification.noUserActivity', lang);
    }

    // Show user badges
    if (user.badges && user.badges.length > 0) {
      text += `\n🏅 Badges: ${user.badges.join(', ')}\n`;
    }

    const keyboard = [[Markup.button.callback('◀️ Volver', 'admin_gamification')]];

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing user activity:', error);
  }
};

module.exports = registerGamificationHandlers;
