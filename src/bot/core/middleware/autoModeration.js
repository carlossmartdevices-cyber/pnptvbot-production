const WarningService = require('../../../services/warningService');
const logger = require('../../../utils/logger');
const MODERATION_CONFIG = require('../../../config/moderationConfig');

// Store recent messages for spam/flood detection
const userMessageHistory = new Map();

/**
 * Check if user is exempt from auto-moderation
 * Only admins are exempt
 */
async function isExempt(ctx) {
  try {
    // Check if user is admin
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (['creator', 'administrator'].includes(member.status)) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking exempt status:', error);
    return false;
  }
}

/**
 * Add message to user history for tracking
 */
function addToHistory(userId, messageText) {
  if (!userMessageHistory.has(userId)) {
    userMessageHistory.set(userId, []);
  }

  const history = userMessageHistory.get(userId);
  history.push({
    text: messageText,
    timestamp: Date.now(),
  });

  // Keep only recent messages (last 2 minutes)
  const cutoff = Date.now() - 2 * 60 * 1000;
  userMessageHistory.set(
    userId,
    history.filter((msg) => msg.timestamp > cutoff)
  );
}

/**
 * Check for spam (duplicate messages)
 */
function checkSpam(userId, messageText) {
  if (!MODERATION_CONFIG.FILTERS.SPAM.enabled) {
    return false;
  }

  const history = userMessageHistory.get(userId) || [];
  const { maxDuplicateMessages, duplicateTimeWindow } = MODERATION_CONFIG.FILTERS.SPAM;

  const cutoff = Date.now() - duplicateTimeWindow;
  const recentDuplicates = history.filter(
    (msg) => msg.text === messageText && msg.timestamp > cutoff
  );

  return recentDuplicates.length >= maxDuplicateMessages;
}

/**
 * Check for flooding (too many messages)
 */
function checkFlood(userId) {
  if (!MODERATION_CONFIG.FILTERS.FLOOD.enabled) {
    return false;
  }

  const history = userMessageHistory.get(userId) || [];
  const { maxMessages, timeWindow } = MODERATION_CONFIG.FILTERS.FLOOD;

  const cutoff = Date.now() - timeWindow;
  const recentMessages = history.filter((msg) => msg.timestamp > cutoff);

  return recentMessages.length >= maxMessages;
}

/**
 * Check for unauthorized links
 */
function checkLinks(messageText) {
  if (!MODERATION_CONFIG.FILTERS.LINKS.enabled) {
    return false;
  }

  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const urls = messageText.match(urlPattern);

  if (!urls) {
    return false;
  }

  const { allowedDomains } = MODERATION_CONFIG.FILTERS.LINKS;

  // Check if any URL is not in allowed domains
  for (const url of urls) {
    const isAllowed = allowedDomains.some((domain) => url.includes(domain));
    if (!isAllowed) {
      return true; // Found unauthorized link
    }
  }

  return false;
}

/**
 * Check for profanity
 */
function checkProfanity(messageText) {
  if (!MODERATION_CONFIG.FILTERS.PROFANITY.enabled) {
    return false;
  }

  const { blacklist } = MODERATION_CONFIG.FILTERS.PROFANITY;
  const lowerText = messageText.toLowerCase();

  return blacklist.some((word) => lowerText.includes(word.toLowerCase()));
}

/**
 * Delete message and notify user
 */
async function deleteAndNotify(ctx, reason) {
  try {
    // Delete the message
    await ctx.deleteMessage();

    // Send notification (auto-delete after 30 seconds)
    const notification = await ctx.reply(
      `⚠️ @${ctx.from.username || ctx.from.first_name}, your message was removed: ${reason}`,
      { reply_to_message_id: ctx.message.message_id }
    );

    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, notification.message_id);
      } catch (error) {
        logger.debug('Could not delete notification:', error.message);
      }
    }, 30000);

    logger.info('Message auto-moderated', { userId: ctx.from.id, reason });
  } catch (error) {
    logger.error('Error deleting message:', error);
  }
}

/**
 * Auto-moderation middleware
 */
const autoModerationMiddleware = () => async (ctx, next) => {
  try {
    // Only process text messages in groups
    if (!ctx.message?.text || ctx.chat.type === 'private') {
      return next();
    }

    // Skip if user is exempt
    if (await isExempt(ctx)) {
      return next();
    }

    // Check if user is muted
    const muteStatus = await WarningService.getMuteStatus(ctx.from.id, ctx.chat.id);
    if (muteStatus?.isMuted) {
      await deleteAndNotify(ctx, 'You are currently muted');
      return; // Don't proceed
    }

    const userId = ctx.from.id;
    const messageText = ctx.message.text;

    // Add message to history
    addToHistory(userId, messageText);

    // Check for spam
    if (checkSpam(userId, messageText)) {
      await deleteAndNotify(ctx, 'Spam detected (duplicate messages)');

      // Issue auto-warning
      await WarningService.addWarning({
        userId,
        adminId: 'system',
        reason: 'Auto-moderation: Spam',
        groupId: ctx.chat.id,
      });

      return; // Don't proceed
    }

    // Check for flooding
    if (checkFlood(userId)) {
      await deleteAndNotify(ctx, 'Too many messages too quickly');

      // Mute for 5 minutes
      const muteDuration = 5 * 60 * 1000;
      const until = Math.floor((Date.now() + muteDuration) / 1000);

      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        until_date: until,
        permissions: { can_send_messages: false },
      });

      await WarningService.recordAction({
        userId,
        adminId: 'system',
        action: 'mute',
        reason: 'Auto-moderation: Flooding',
        duration: muteDuration,
        groupId: ctx.chat.id,
      });

      return; // Don't proceed
    }

    // Check for unauthorized links
    if (checkLinks(messageText)) {
      await deleteAndNotify(ctx, 'Unauthorized links are not allowed');

      // Issue auto-warning
      await WarningService.addWarning({
        userId,
        adminId: 'system',
        reason: 'Auto-moderation: Unauthorized link',
        groupId: ctx.chat.id,
      });

      return; // Don't proceed
    }

    // Check for profanity
    if (checkProfanity(messageText)) {
      await deleteAndNotify(ctx, 'Inappropriate language detected');

      // Issue auto-warning
      await WarningService.addWarning({
        userId,
        adminId: 'system',
        reason: 'Auto-moderation: Profanity',
        groupId: ctx.chat.id,
      });

      return; // Don't proceed
    }

    // All checks passed, proceed to next middleware
    return next();
  } catch (error) {
    logger.error('Error in auto-moderation middleware:', error);
    return next(); // Continue on error to avoid blocking legitimate messages
  }
};

// Clean up old message history every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;

  for (const [userId, history] of userMessageHistory.entries()) {
    const filtered = history.filter((msg) => msg.timestamp > cutoff);

    if (filtered.length === 0) {
      userMessageHistory.delete(userId);
    } else {
      userMessageHistory.set(userId, filtered);
    }
  }

  logger.debug('Auto-moderation history cleaned', { activeUsers: userMessageHistory.size });
}, 5 * 60 * 1000);

module.exports = autoModerationMiddleware;
