const NodeCache = require('node-cache');
const { config } = require('../../config/botConfig');
const logger = require('../../../utils/logger');
const { t } = require('../../../utils/i18n');
const UserService = require('../../services/userService');

// In-memory cache for rate limiting
const rateLimitCache = new NodeCache({
  stdTTL: config.rateLimit.windowMs / 1000,
  checkperiod: 10,
});

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = () => {
  const { windowMs, maxRequests } = config.rateLimit;

  return async (ctx, next) => {
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      return next();
    }

    // Exempt admin users from rate limiting
    if (UserService.isAdmin(userId)) {
      return next();
    }

    try {
      await limiter.consume(userId.toString());
      return next();
    } catch (rejRes) {
      const lang = ctx.session?.language || 'en';

    // Filter out old timestamps
    const recentRequests = timestamps.filter(t => t > windowStart);

    if (recentRequests.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for user ${userId}`);
      return ctx.reply(
        '⚠️ You\'re sending commands too quickly. Please wait a moment and try again.',
        { reply_to_message_id: ctx.message?.message_id }
      );
    }

    // Add current timestamp
    recentRequests.push(now);
    rateLimitCache.set(key, recentRequests);

    return next();
  };
};

/**
 * Clear rate limit for a user (useful for admins)
 */
const clearRateLimit = (userId) => {
  const key = `ratelimit:${userId}`;
  rateLimitCache.del(key);
  logger.info(`Rate limit cleared for user ${userId}`);
};

module.exports = {
  rateLimitMiddleware,
  clearRateLimit,
};
