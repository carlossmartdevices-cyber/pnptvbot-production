const logger = require('../../../utils/logger');

/**
 * Moderation filter middleware
 * Filters messages in groups based on moderation rules
 * @returns {Function} Middleware function
 */
const moderationFilter = () => async (ctx, next) => {
  // Moderation filter has been disabled
  return next();
};

module.exports = moderationFilter;
