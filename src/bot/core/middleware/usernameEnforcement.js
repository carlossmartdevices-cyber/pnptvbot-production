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

  let nextCalled = false;
  return async (ctx, next) => {
    const chatType = ctx.chat?.type;

    // Only apply to groups and supergroups
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      if (!nextCalled) { nextCalled = true; await next(); }
      return;
    }

    const userId = ctx.from?.id;
    const currentUsername = ctx.from?.username;
    const groupId = ctx.chat.id;

    if (!userId) {
      if (!nextCalled) { nextCalled = true; await next(); }
      return;
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
      if (!nextCalled) { nextCalled = true; await next(); }
    } catch (error) {
      logger.error('Username enforcement error:', error);
      // On error, allow message through to avoid blocking legitimate users
      if (!nextCalled) { nextCalled = true; await next(); }
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
    const changeCount = await ModerationModel.countRecentUsernameChanges(userId, 24);

    // Username change notifications disabled
    // if (changeCount > 1) {
    //   // Notify support group admins about suspicious activity (not in group chat)
    //   await notifyAdminsOfUsernameChange(ctx, userId, oldUsername, newUsername, groupId, changeCount);
    // }
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
      if (error.message && error.message.includes('message to delete not found')) {
        logger.debug('Message to delete not found, ignoring.');
      } else {
        logger.debug('Could not delete message from user without username:', error.message);
      }
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

    // Sanitize warningMessage for Markdown
    warningMessage = warningMessage.replace(/([*_`])/g, '\\$1');
    const sentMessage = await ctx.reply(warningMessage, {
      parse_mode: 'Markdown',
    });

    // Delete warning after 60 seconds
    ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 60000);

    // Try to send private message
    try {
      let pmMsg = '⚠️ **Username Required**\n\n'
        + `You need to set a Telegram username (@username) to participate in **${ctx.chat.title}**.\n\n`
        + 'Please set your username in Settings and return to the group.';
      pmMsg = pmMsg.replace(/([*_`])/g, '\\$1');
      await ctx.telegram.sendMessage(
        userId,
        pmMsg,
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
 * Notify support group of username change
 */
async function notifyAdminsOfUsernameChange(ctx, userId, oldUsername, newUsername, groupId, changeCount) {
  try {
    const supportGroupId = process.env.SUPPORT_GROUP_ID;

    if (!supportGroupId) {
      logger.warn('SUPPORT_GROUP_ID not configured, skipping username change notification');
      return;
    }

    const firstName = ctx.from?.first_name || 'User';
    const groupTitle = ctx.chat?.title || 'Unknown Group';

    const notificationMessage = '🚨 **Suspicious Username Change**\n\n'
      + `👤 **User:** ${firstName} (ID: ${userId})\n`
      + `👥 **Group:** ${groupTitle}\n`
      + `📝 **Old:** @${oldUsername || 'none'}\n`
      + `📝 **New:** @${newUsername || 'none'}\n`
      + `🔄 **Changes in 24h:** ${changeCount}\n`
      + `📅 **When:** ${new Date().toLocaleString()}\n\n`
      + '⚠️ This user has changed their username multiple times in the last 24 hours.\n'
      + 'This could indicate evasion attempts.\n\n'
      + `Use /userhistory ${userId} to see full history.`;

    // Send to support group only
    try {
      await ctx.telegram.sendMessage(
        supportGroupId,
        notificationMessage,
        { parse_mode: 'Markdown' },
      );

      logger.debug('Support group notified of suspicious username change', {
        supportGroupId,
        userId,
        groupId,
      });
    } catch (error) {
      logger.error('Could not send message to support group:', error.message);
    }
  } catch (error) {
    logger.error('Error notifying support group of username change:', error);
  }
}

module.exports = usernameEnforcement;
