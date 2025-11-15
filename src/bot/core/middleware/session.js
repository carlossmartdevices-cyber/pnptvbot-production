const { cache } = require('../../../config/redis');
const logger = require('../../../utils/logger');

/**
 * Session middleware for Telegraf
 * Uses Redis for session storage
 */

/**
 * Get session key for user
 * @param {Object} ctx - Telegraf context
 * @returns {string} Session key
 */
const getSessionKey = (ctx) => {
  const userId = ctx.from?.id || ctx.chat?.id;
  return `session:${userId}`;
};

/**
 * Session middleware
 * @returns {Function} Middleware function
 */
const sessionMiddleware = () => async (ctx, next) => {
  const sessionKey = getSessionKey(ctx);

  try {
    // Load session from Redis
    let session = await cache.get(sessionKey);

    if (!session) {
      session = {
        language: ctx.from?.language_code || 'en',
        userId: ctx.from?.id,
        temp: {}, // Temporary data for multi-step flows
      };
    }

    // Attach session to context
    ctx.session = session;

    // Save session method
    ctx.saveSession = async () => {
      try {
        const ttl = parseInt(process.env.SESSION_TTL || '86400', 10);
        await cache.set(sessionKey, ctx.session, ttl);
      } catch (error) {
        logger.error('Error saving session:', error);
      }
    };

    // Clear session method
    ctx.clearSession = async () => {
      try {
        await cache.del(sessionKey);
        ctx.session = {
          language: ctx.from?.language_code || 'en',
          userId: ctx.from?.id,
          temp: {},
        };
      } catch (error) {
        logger.error('Error clearing session:', error);
      }
    };

    // Execute next middleware
    await next();

    // Auto-save session after processing
    await ctx.saveSession();
  } catch (error) {
    logger.error('Session middleware error:', error);
    await next();
  }
};

module.exports = sessionMiddleware;
