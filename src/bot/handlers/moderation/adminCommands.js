const ModerationService = require('../../services/moderationService');
const ModerationModel = require('../../../models/moderationModel');
const logger = require('../../../utils/logger');
const { t } = require('../../../utils/i18n');

/**
 * Register moderation admin handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerModerationAdminHandlers = (bot) => {
  // /moderation - Toggle moderation on/off
  bot.command('moderation', handleModerationToggle);

  // /ban - Ban user
  bot.command('ban', handleBanUser);

  // /unban - Unban user
  bot.command('unban', handleUnbanUser);

  // /clearwarnings - Clear user warnings
  bot.command('clearwarnings', handleClearWarnings);

  // /modlogs - View moderation logs
  bot.command('modlogs', handleModLogs);

  // /modstats - View moderation statistics
  bot.command('modstats', handleModStats);

  // /setlinks - Configure link policy
  bot.command('setlinks', handleSetLinks);

  // /userhistory - View username history
  bot.command('userhistory', handleUserHistory);

  // /usernamechanges - View recent username changes in group
  bot.command('usernamechanges', handleUsernameChanges);

  // /globalban - Ban user from all groups and channels
  bot.command('globalban', handleGlobalBan);

  // /globalunban - Unban user from all groups and channels
  bot.command('globalunban', handleGlobalUnban);

  // /globalbans - View all globally banned users
  bot.command('globalbans', handleViewGlobalBans);

  // /noncompliant - View non-compliant users in group
  bot.command('noncompliant', handleViewNonCompliant);

  // /sendcompliancewarnings - Send compliance warnings to all non-compliant users
  bot.command('sendcompliancewarnings', handleSendComplianceWarnings);

  // /purgenoncompliant - Manually purge non-compliant users (debug/override)
  bot.command('purgenoncompliant', handlePurgeNonCompliant);
};

/**
 * Check if user is admin in the chat
 * @param {Object} ctx - Telegraf context
 * @returns {Promise<boolean>} Is admin
 */
async function isAdmin(ctx) {
  try {
    const userId = ctx.from.id;
    const chatMember = await ctx.getChatMember(userId);
    return ['creator', 'administrator'].includes(chatMember.status);
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Handle /moderation command
 * Toggle moderation on/off or configure settings
 */
async function handleModerationToggle(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const action = args[0]?.toLowerCase();

    if (!action || !['on', 'off', 'status'].includes(action)) {
      let helpMessage = '**Moderation Settings**\n\n';
      helpMessage += '**Usage:**\n';
      helpMessage += '`/moderation on` - Enable all moderation features\n';
      helpMessage += '`/moderation off` - Disable all moderation features\n';
      helpMessage += '`/moderation status` - Show current settings\n\n';
      helpMessage += '**Other commands:**\n';
      helpMessage += '`/setlinks <strict|warn|allow>` - Configure link policy\n';
      helpMessage += '`/ban @user [reason]` - Ban user\n';
      helpMessage += '`/unban @user` - Unban user\n';
      helpMessage += '`/clearwarnings @user` - Clear user warnings\n';
      helpMessage += '`/modlogs [limit]` - View moderation logs\n';
      helpMessage += '`/modstats` - View moderation statistics\n';

      return ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    }

    if (action === 'status') {
      const settings = await ModerationModel.getGroupSettings(groupId);

      let statusMessage = '**📊 Moderation Status**\n\n';
      statusMessage += `🔗 Anti-Links: ${settings.antiLinksEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      statusMessage += `📢 Anti-Spam: ${settings.antiSpamEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      statusMessage += `💬 Anti-Flood: ${settings.antiFloodEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      statusMessage += `🚫 Profanity Filter: ${settings.profanityFilterEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n`;
      statusMessage += `⚠️ Max Warnings: ${settings.maxWarnings}\n`;
      statusMessage += `💬 Flood Limit: ${settings.floodLimit} messages / ${settings.floodWindow}s\n`;

      if (settings.allowedDomains && settings.allowedDomains.length > 0) {
        statusMessage += `\n✅ Allowed Domains: ${settings.allowedDomains.join(', ')}`;
      }

      return ctx.reply(statusMessage, { parse_mode: 'Markdown' });
    }

    const enableAll = action === 'on';

    await ModerationService.updateGroupSettings(groupId, {
      antiLinksEnabled: enableAll,
      antiSpamEnabled: enableAll,
      antiFloodEnabled: enableAll,
    });

    const message = enableAll
      ? '✅ Moderation has been **enabled** for this group.'
      : '❌ Moderation has been **disabled** for this group.';

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Moderation toggled', {
      groupId,
      adminId: ctx.from.id,
      enabled: enableAll,
    });
  } catch (error) {
    logger.error('Error handling moderation toggle:', error);
    await ctx.reply('Error updating moderation settings.');
  }
}

/**
 * Handle /setlinks command
 * Configure link policy
 */
async function handleSetLinks(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const policy = args[0]?.toLowerCase();

    if (!policy || !['strict', 'warn', 'allow'].includes(policy)) {
      let helpMessage = '**Link Policy Configuration**\n\n';
      helpMessage += '**Usage:** `/setlinks <policy>`\n\n';
      helpMessage += '**Policies:**\n';
      helpMessage += '• `strict` - Delete all links immediately\n';
      helpMessage += '• `warn` - Warn users before deleting (default)\n';
      helpMessage += '• `allow` - Allow all links\n';

      return ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    }

    const enabled = policy !== 'allow';

    await ModerationService.updateGroupSettings(groupId, {
      antiLinksEnabled: enabled,
    });

    const message = policy === 'allow'
      ? '✅ Links are now **allowed** in this group.'
      : `✅ Link policy set to **${policy}** mode.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Link policy updated', {
      groupId,
      adminId: ctx.from.id,
      policy,
    });
  } catch (error) {
    logger.error('Error setting link policy:', error);
    await ctx.reply('Error updating link policy.');
  }
}

/**
 * Handle /ban command
 * Ban user from group
 */
async function handleBanUser(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const { message } = ctx;

    // Get user from reply or mention
    let targetUserId;
    let targetUserName;

    if (message.reply_to_message) {
      targetUserId = message.reply_to_message.from.id;
      targetUserName = message.reply_to_message.from.first_name;
    } else {
      const args = message.text.split(' ').slice(1);
      const mention = args[0];

      if (!mention || !mention.startsWith('@')) {
        return ctx.reply('Usage: `/ban @username [reason]` or reply to a message with `/ban [reason]`', {
          parse_mode: 'Markdown',
        });
      }

      // Note: Getting user ID from username requires additional API calls
      // For simplicity, we'll require reply-to-message for now
      return ctx.reply('Please reply to the user\'s message with `/ban [reason]`', {
        parse_mode: 'Markdown',
      });
    }

    const args = message.text.split(' ').slice(1);
    const reason = args.join(' ') || 'Banned by administrator';

    // Ban user
    await ModerationService.banUser(targetUserId, groupId, reason, ctx.from.id);

    // Kick from Telegram
    await ctx.kickChatMember(targetUserId);

    await ctx.reply(
      `🚫 **${targetUserName}** has been banned.\n\n**Reason:** ${reason}`,
      { parse_mode: 'Markdown' },
    );

    logger.info('User banned by admin', {
      groupId,
      adminId: ctx.from.id,
      targetUserId,
      reason,
    });
  } catch (error) {
    logger.error('Error banning user:', error);
    await ctx.reply('Error banning user. Make sure I have admin permissions.');
  }
}

/**
 * Handle /unban command
 * Unban user from group
 */
async function handleUnbanUser(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const { message } = ctx;

    let targetUserId;

    if (message.reply_to_message) {
      targetUserId = message.reply_to_message.from.id;
    } else {
      return ctx.reply('Please reply to the user\'s message with `/unban`', {
        parse_mode: 'Markdown',
      });
    }

    // Unban user
    await ModerationService.unbanUser(targetUserId, groupId, ctx.from.id);

    // Unban from Telegram
    await ctx.unbanChatMember(targetUserId);

    await ctx.reply('✅ User has been unbanned and can rejoin the group.', {
      parse_mode: 'Markdown',
    });

    logger.info('User unbanned by admin', {
      groupId,
      adminId: ctx.from.id,
      targetUserId,
    });
  } catch (error) {
    logger.error('Error unbanning user:', error);
    await ctx.reply('Error unbanning user.');
  }
}

/**
 * Handle /clearwarnings command
 * Clear user warnings
 */
async function handleClearWarnings(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const { message } = ctx;

    let targetUserId;
    let targetUserName;

    if (message.reply_to_message) {
      targetUserId = message.reply_to_message.from.id;
      targetUserName = message.reply_to_message.from.first_name;
    } else {
      return ctx.reply('Please reply to the user\'s message with `/clearwarnings`', {
        parse_mode: 'Markdown',
      });
    }

    await ModerationService.clearWarnings(targetUserId, groupId, ctx.from.id);

    await ctx.reply(`✅ Warnings cleared for **${targetUserName}**.`, {
      parse_mode: 'Markdown',
    });

    logger.info('Warnings cleared by admin', {
      groupId,
      adminId: ctx.from.id,
      targetUserId,
    });
  } catch (error) {
    logger.error('Error clearing warnings:', error);
    await ctx.reply('Error clearing warnings.');
  }
}

/**
 * Handle /modlogs command
 * View moderation logs
 */
async function handleModLogs(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const limit = parseInt(args[0], 10) || 10;

    const logs = await ModerationService.getLogs(groupId, Math.min(limit, 50));

    if (logs.length === 0) {
      return ctx.reply('No moderation logs found.');
    }

    let message = `📋 **Moderation Logs** (Last ${logs.length})\n\n`;

    logs.forEach((log, index) => {
      const date = new Date(log.timestamp.toDate());
      const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

      message += `**${index + 1}.** ${log.action}\n`;
      message += `   User: ${log.userId || 'N/A'}\n`;
      message += `   Reason: ${log.reason || 'N/A'}\n`;
      message += `   Date: ${dateStr}\n\n`;
    });

    // Send as document if too long
    if (message.length > 4000) {
      message = `${message.substring(0, 4000)}\n\n_...truncated_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Moderation logs viewed', {
      groupId,
      adminId: ctx.from.id,
      count: logs.length,
    });
  } catch (error) {
    logger.error('Error viewing moderation logs:', error);
    await ctx.reply('Error loading moderation logs.');
  }
}

/**
 * Handle /modstats command
 * View moderation statistics
 */
async function handleModStats(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const stats = await ModerationService.getStatistics(groupId);

    let message = '📊 **Moderation Statistics**\n\n';
    message += `⚠️ Total Warnings: ${stats.totalWarnings}\n`;
    message += `👥 Users with Warnings: ${stats.usersWithWarnings}\n`;
    message += `🚫 Total Bans: ${stats.totalBans}\n`;
    message += `⚡ Recent Actions (24h): ${stats.recentActions}\n`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Moderation stats viewed', {
      groupId,
      adminId: ctx.from.id,
    });
  } catch (error) {
    logger.error('Error viewing moderation stats:', error);
    await ctx.reply('Error loading moderation statistics.');
  }
}

/**
 * Handle /userhistory command
 * View username change history for a specific user
 */
async function handleUserHistory(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    let targetUserId;

    // Get user from reply or argument
    if (ctx.message.reply_to_message) {
      targetUserId = ctx.message.reply_to_message.from.id;
    } else if (args[0]) {
      targetUserId = args[0];
    } else {
      return ctx.reply('Usage: `/userhistory <user_id>` or reply to a user\'s message with `/userhistory`', {
        parse_mode: 'Markdown',
      });
    }

    // Get username history
    const history = await ModerationModel.getUsernameHistory(targetUserId, 20);

    if (history.length === 0) {
      return ctx.reply('No username history found for this user.');
    }

    let message = '📋 **Username History**\n\n';
    message += `👤 **User ID:** ${targetUserId}\n`;
    message += `📊 **Total Changes:** ${history.length}\n\n`;

    history.forEach((record, index) => {
      const date = new Date(record.changedAt.toDate());
      const dateStr = date.toLocaleString();

      message += `**${index + 1}.** ${dateStr}\n`;
      message += `   From: @${record.oldUsername || 'none'}\n`;
      message += `   To: @${record.newUsername || 'none'}\n`;

      if (record.flagged) {
        message += `   🚩 **FLAGGED:** ${record.flagReason || 'Suspicious'}\n`;
      }

      message += '\n';
    });

    // Send as file if too long
    if (message.length > 4000) {
      message = `${message.substring(0, 4000)}\n\n_...truncated_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Username history viewed', {
      groupId: ctx.chat.id,
      adminId: ctx.from.id,
      targetUserId,
      historyCount: history.length,
    });
  } catch (error) {
    logger.error('Error viewing username history:', error);
    await ctx.reply('Error loading username history.');
  }
}

/**
 * Handle /usernamechanges command
 * View recent username changes in the group
 */
async function handleUsernameChanges(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const limit = parseInt(args[0], 10) || 20;

    // Get recent username changes
    const changes = await ModerationModel.getRecentUsernameChanges(groupId, Math.min(limit, 50));

    if (changes.length === 0) {
      return ctx.reply('No username changes recorded in this group yet.');
    }

    let message = '📋 **Recent Username Changes**\n\n';
    message += `📊 **Last ${changes.length} changes:**\n\n`;

    changes.forEach((record, index) => {
      const date = new Date(record.changedAt.toDate());
      const dateStr = date.toLocaleDateString();

      message += `**${index + 1}.** User ID: ${record.userId}\n`;
      message += `   ${dateStr}: @${record.oldUsername || 'none'} → @${record.newUsername || 'none'}\n`;

      if (record.flagged) {
        message += '   🚩 FLAGGED\n';
      }

      message += '\n';
    });

    message += '\nUse /userhistory <user_id> to see full history for a specific user.';

    // Send as file if too long
    if (message.length > 4000) {
      message = `${message.substring(0, 4000)}\n\n_...truncated_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Username changes viewed', {
      groupId,
      adminId: ctx.from.id,
      count: changes.length,
    });
  } catch (error) {
    logger.error('Error viewing username changes:', error);
    await ctx.reply('Error loading username changes.');
  }
}

/**
 * Handle /globalban command
 * Ban user from all groups and channels
 */
async function handleGlobalBan(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const { message } = ctx;

    // Get user from reply or mention
    let targetUserId;
    let targetUserName;

    if (message.reply_to_message) {
      targetUserId = message.reply_to_message.from.id;
      targetUserName = message.reply_to_message.from.first_name;
    } else {
      return ctx.reply('Please reply to the user\'s message with `/globalban [reason]`', {
        parse_mode: 'Markdown',
      });
    }

    const args = message.text.split(' ').slice(1);
    const reason = args.join(' ') || 'Globally banned by administrator';

    // Add global ban record using special group ID "GLOBAL"
    await ModerationModel.banUser(targetUserId, 'GLOBAL', reason, ctx.from.id);

    // Also ban from current group
    try {
      await ctx.kickChatMember(targetUserId);
    } catch (error) {
      logger.debug('Could not kick from current group:', error.message);
    }

    const confirmMessage = `🌍 **${targetUserName}** has been **GLOBALLY BANNED**.\n\n`
      + `**Reason:** ${reason}\n\n`
      + '⚠️ This user is now blocked from all groups and channels using this bot.';

    await ctx.reply(confirmMessage, { parse_mode: 'Markdown' });

    logger.info('User globally banned by admin', {
      adminId: ctx.from.id,
      targetUserId,
      reason,
    });
  } catch (error) {
    logger.error('Error globally banning user:', error);
    await ctx.reply('Error globally banning user.');
  }
}

/**
 * Handle /globalunban command
 * Unban user from all groups and channels
 */
async function handleGlobalUnban(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const { message } = ctx;

    let targetUserId;
    let targetUserName;

    if (message.reply_to_message) {
      targetUserId = message.reply_to_message.from.id;
      targetUserName = message.reply_to_message.from.first_name;
    } else {
      return ctx.reply('Please reply to the user\'s message with `/globalunban`', {
        parse_mode: 'Markdown',
      });
    }

    // Remove global ban
    await ModerationModel.unbanUser(targetUserId, 'GLOBAL');

    const confirmMessage = `✅ **${targetUserName}** has been **GLOBALLY UNBANNED**.\n\n`
      + 'This user can now access all groups and channels again.';

    await ctx.reply(confirmMessage, { parse_mode: 'Markdown' });

    logger.info('User globally unbanned by admin', {
      adminId: ctx.from.id,
      targetUserId,
    });
  } catch (error) {
    logger.error('Error globally unbanning user:', error);
    await ctx.reply('Error globally unbanning user.');
  }
}

/**
 * Handle /globalbans command
 * View all globally banned users
 */
async function handleViewGlobalBans(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    // Get globally banned users
    const bannedUsers = await ModerationModel.getBannedUsers('GLOBAL');

    if (bannedUsers.length === 0) {
      return ctx.reply('No globally banned users.');
    }

    let message = '🌍 **Globally Banned Users**\n\n';
    message += `📊 **Total:** ${bannedUsers.length} users\n\n`;

    bannedUsers.forEach((record, index) => {
      const date = new Date(record.banned_at.toDate());
      const dateStr = date.toLocaleString();

      message += `**${index + 1}.** User ID: ${record.user_id}\n`;
      message += `   📅 Banned: ${dateStr}\n`;
      message += `   📝 Reason: ${record.reason || 'No reason provided'}\n`;
      message += `   👤 By: Admin ID ${record.banned_by}\n\n`;
    });

    // Send as file if too long
    if (message.length > 4000) {
      message = `${message.substring(0, 4000)}\n\n_...truncated_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Global bans viewed', {
      groupId: ctx.chat.id,
      adminId: ctx.from.id,
      count: bannedUsers.length,
    });
  } catch (error) {
    logger.error('Error viewing global bans:', error);
    await ctx.reply('Error loading global bans.');
  }
}

/**
 * Handle /noncompliant command
 * View non-compliant users in the group
 */
async function handleViewNonCompliant(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;

    // Get non-compliant users
    const nonCompliant = await ModerationModel.getNonCompliantUsers(groupId);

    if (nonCompliant.length === 0) {
      return ctx.reply('All users in this group have compliant profiles! ✅');
    }

    let message = '⚠️ **Non-Compliant Users**\n\n';
    message += `📊 **Total:** ${nonCompliant.length} users\n\n`;

    nonCompliant.forEach((record, index) => {
      const warnDate = new Date(record.warningSentAt);
      const deadline = new Date(record.purgeDeadline);
      const now = new Date();
      const hoursRemaining = Math.max(0, Math.round((deadline - now) / (60 * 60 * 1000)));

      message += `**${index + 1}.** User ID: ${record.userId}\n`;
      message += `   ⏰ Warned: ${warnDate.toLocaleString()}\n`;
      message += `   ⏳ Hours remaining: ${hoursRemaining}h\n`;
      message += `   ❌ Issues: ${record.complianceIssues.join(', ')}\n`;

      if (record.purged) {
        message += `   🚫 PURGED\n`;
      }

      message += '\n';
    });

    // Send as file if too long
    if (message.length > 4000) {
      message = `${message.substring(0, 4000)}\n\n_...truncated_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Non-compliant users viewed', {
      groupId,
      adminId: ctx.from.id,
      count: nonCompliant.length,
    });
  } catch (error) {
    logger.error('Error viewing non-compliant users:', error);
    await ctx.reply('Error loading non-compliant users.');
  }
}

/**
 * Handle /sendcompliancewarnings command
 * Send compliance warnings to all members
 */
async function handleSendComplianceWarnings(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;

    const message = `📋 **Profile Compliance Requirements**\n\n`
      + `All members must have:\n\n`
      + `✅ **A Telegram username** (@username)\n\n`
      + `**Why?** To ensure proper identification.\n\n`
      + `**How to set a username:**\n`
      + `1. Open Telegram Settings\n`
      + `2. Tap on "Username"\n`
      + `3. Choose a unique username (@yourname)\n`
      + `4. Return to this group\n\n`
      + `⏰ **Deadline: 48 hours**\n\n`
      + `Users who don't comply will be automatically removed from the group.`;

    const sentMessage = await ctx.reply(message, {
      parse_mode: 'Markdown',
    });

    logger.info('Compliance warning sent to group', { groupId, adminId: ctx.from.id });

    await ctx.reply('✅ Compliance warning sent to the group!');
  } catch (error) {
    logger.error('Error sending compliance warnings:', error);
    await ctx.reply('Error sending compliance warnings.');
  }
}

/**
 * Handle /purgenoncompliant command
 * Manually purge all non-compliant users
 */
async function handlePurgeNonCompliant(ctx) {
  try {
    const chatType = ctx.chat?.type;

    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return ctx.reply('This command only works in groups.');
    }

    if (!(await isAdmin(ctx))) {
      return ctx.reply('⛔ Only administrators can use this command.');
    }

    const groupId = ctx.chat.id;

    // Get non-compliant users
    const nonCompliant = await ModerationModel.getNonCompliantUsers(groupId);

    if (nonCompliant.length === 0) {
      return ctx.reply('No non-compliant users to purge.');
    }

    let purgedCount = 0;
    let errorCount = 0;

    for (const user of nonCompliant) {
      try {
        await ctx.kickChatMember(user.userId);
        purgedCount++;

        logger.info('User purged via manual command', {
          userId: user.userId,
          groupId,
          adminId: ctx.from.id,
        });
      } catch (error) {
        errorCount++;
        logger.debug(`Could not kick user ${user.userId}:`, error.message);
      }
    }

    const resultMessage = `🚫 **Purge Complete**\n\n`
      + `✅ Purged: ${purgedCount} users\n`
      + `❌ Errors: ${errorCount} users\n\n`
      + `Note: Users have been kicked from the group.`;

    await ctx.reply(resultMessage, { parse_mode: 'Markdown' });

    logger.info('Bulk purge executed', {
      groupId,
      adminId: ctx.from.id,
      purgedCount,
      errorCount,
    });
  } catch (error) {
    logger.error('Error purging non-compliant users:', error);
    await ctx.reply('Error purging non-compliant users.');
  }
}

module.exports = registerModerationAdminHandlers;
