const logger = require('../../../utils/logger');

/**
 * Register moderation admin handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerModerationAdminHandlers = (bot) => {
  // All moderation admin commands have been disabled
  logger.info('Moderation admin handlers are disabled');
};

module.exports = registerModerationAdminHandlers;
