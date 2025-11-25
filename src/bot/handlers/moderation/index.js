const logger = require('../../../utils/logger');

/**
 * Register moderation user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerModerationHandlers = (bot) => {
  // All moderation commands have been disabled
  logger.info('Moderation user handlers are disabled');
};

module.exports = registerModerationHandlers;
