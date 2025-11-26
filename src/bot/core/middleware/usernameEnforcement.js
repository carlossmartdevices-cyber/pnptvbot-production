const ModerationModel = require('../../../models/moderationModel');
const UserModel = require('../../../models/userModel');
const ChatCleanupService = require('../../services/chatCleanupService');
const logger = require('../../../utils/logger');
const { t } = require('../../../utils/i18n');

/**
 * Username enforcement middleware
 * - Requires users to have a username in groups
 * - Detects and logs username changes
 * - Notifies admins of suspicious changes
 *
 * @returns {Function} Middleware function
 */
const usernameEnforcement = () => {
  // Cache to track last known usernames
  const usernameCache = new Map();

  return async (ctx, next) => {
    const chatType = ctx.chat?.type;

    // Only apply to groups and supergroups
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return next();
    }

    const userId = ctx.from?.id;
    const currentUsername = ctx.from?.username;
    const groupId = ctx.chat.id;

    if (!userId) {
      return next();
    }

    try {
      // Check if user is admin (admins can have no username)
      const isAdmin = await checkIfAdmin(ctx, userId);

      // Get last known username from database
      const user = await UserModel.getById(userId);
      const lastKnownUsername = user?.username;

      // Detect username change
      if (lastKnownUsername !== currentUsername) {
        await handleUsernameChange(
          ctx,
          userId,
          lastKnownUsername,
          currentUsername,
          groupId,
        );

        // Update user in database
        await UserModel.updateProfile(userId, { username: currentUsername || '' });
      }

      // Enforce username requirement for non-admins
      if (!isAdmin && !currentUsername) {
        await handleNoUsername(ctx, userId, groupId);
        // Don't call next() - block the message
        return;
      }

      // Continue with message processing
      await next();
    } catch (error) {
      logger.error('Username enforcement error:', error);
      // On error, allow message through to avoid blocking legitimate users
      return next();
    }
  };
};

/**
 * Check if user is admin
 */
async function checkIfAdmin(ctx, userId) {
  try {
    const chatMember = await ctx.getChatMember(userId);
    return ['creator', 'administrator'].includes(chatMember.status);
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Handle username change detection
 */
async function handleUsernameChange(ctx, userId, oldUsername, newUsername, groupId) {
  try {
    // Record the change
    await ModerationModel.recordUsernameChange(
      userId,
      oldUsername,
      newUsername,
      groupId,
    );

    logger.info('Username change detected', {
      userId,
      oldUsername,
      newUsername,
      groupId,
    });

    // Check if this is a recent change (within 24 hours)
    const hasRecentChange = await ModerationModel.hasRecentUsernameChange(userId, 24);

    if (hasRecentChange) {
      // Notify group admins about suspicious activity
      await notifyAdminsOfUsernameChange(ctx, userId, oldUsername, newUsername, groupId);
    }

    // Send notification in group (will be auto-deleted)
    const firstName = ctx.from?.first_name || 'User';
    const lang = ctx.session?.language || 'en';

    let notificationMessage = '🔔 **Username Change Detected**\n\n';
    notificationMessage += `👤 **User:** ${firstName}\n`;
    notificationMessage += `📝 **Previous:** @${oldUsername || 'none'}\n`;
    notificationMessage += `📝 **Current:** @${newUsername || 'none'}\n`;

    if (hasRecentChange) {
      notificationMessage += '\n⚠️ **Warning:** Multiple username changes detected within 24 hours.';
    }

    const sentMessage = await ctx.reply(notificationMessage, {
      parse_mode: 'Markdown',
    });

    // Auto-delete notification after 30 seconds
    ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 30000);
  } catch (error) {
    logger.error('Error handling username change:', error);
  }
}

/**
 * Handle user without username
 */
async function handleNoUsername(ctx, userId, groupId) {
  try {
    const firstName = ctx.from?.first_name || 'User';
    const lang = ctx.session?.language || 'en';

    // Delete the message
    try {
      await ctx.deleteMessage();
    } catch (error) {
      logger.debug('Could not delete message from user without username:', error.message);
    }

    // Send warning message
    let warningMessage = `⚠️ **${t('moderation.username_required', lang)}**\n\n`;
    warningMessage += `👤 ${firstName}\n\n`;
    warningMessage += 'This group requires all members to have a Telegram username (@username).\n\n';
    warningMessage += '**How to set a username:**\n';
    warningMessage += '1. Open Telegram Settings\n';
    warningMessage += '2. Tap on "Username"\n';
    warningMessage += '3. Choose a unique username\n';
    warningMessage += '4. Return to this group once set\n\n';
    warningMessage += 'Your messages will be deleted until you set a username.';

    const sentMessage = await ctx.reply(warningMessage, {
      parse_mode: 'Markdown',
    });

    // Delete warning after 60 seconds
    ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 60000);

    // Try to send private message
    try {
      await ctx.telegram.sendMessage(
        userId,
        '⚠️ **Username Required**\n\n'
        + `You need to set a Telegram username (@username) to participate in **${ctx.chat.title}**.\n\n`
        + 'Please set your username in Settings and return to the group.',
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      logger.debug('Could not send private message about username:', error.message);
    }

    // Log the event
    await ModerationModel.addLog({
      action: 'no_username_warning',
      userId,
      groupId,
      reason: 'User without username attempted to send message',
      details: `User: ${firstName}`,
    });

    logger.info('User without username warned', { userId, groupId, firstName });
  } catch (error) {
    logger.error('Error handling user without username:', error);
  }
}

/**
 * Notify group admins of username change
 */
async function notifyAdminsOfUsernameChange(ctx, userId, oldUsername, newUsername, groupId) {
  try {
    // Get group administrators
    const admins = await ctx.getChatAdministrators();

    const firstName = ctx.from?.first_name || 'User';

    const notificationMessage = '🚨 **Suspicious Username Change**\n\n'
      + `👤 **User:** ${firstName} (ID: ${userId})\n`
      + `📝 **Old:** @${oldUsername || 'none'}\n`
      + `📝 **New:** @${newUsername || 'none'}\n`
      + `📅 **When:** ${new Date().toLocaleString()}\n\n`
      + '⚠️ This user has changed their username multiple times in the last 24 hours.\n'
      + 'This could indicate evasion attempts.\n\n'
      + `Use /userhistory ${userId} to see full history.`;

    // Send to each admin via DM
    for (const admin of admins) {
      if (admin.user.is_bot) continue; // Skip bots

      try {
        await ctx.telegram.sendMessage(
          admin.user.id,
          notificationMessage,
          { parse_mode: 'Markdown' },
        );

        logger.debug('Admin notified of username change', {
          adminId: admin.user.id,
          userId,
        });
      } catch (error) {
        // Admin hasn't started bot or blocked it
        logger.debug(`Could not notify admin ${admin.user.id}:`, error.message);
      }
    }
  } catch (error) {
    logger.error('Error notifying admins of username change:', error);
  }
}

module.exports = usernameEnforcement;
