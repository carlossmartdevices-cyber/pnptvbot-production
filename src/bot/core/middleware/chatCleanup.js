const logger = require('../../../utils/logger');

/**
 * Chat cleanup middleware
 * @param {number} delay - Delay in milliseconds (default: 5 minutes)
 * @returns {Function} Middleware function
 */
const chatCleanupMiddleware = (delay = 5 * 60 * 1000) => async (ctx, next) => {
  // Chat cleanup middleware has been disabled
  return next();
};

module.exports = chatCleanupMiddleware;
