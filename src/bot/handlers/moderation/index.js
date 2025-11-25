const registerModerationCommands = require('./moderationCommands');
const logger = require('../../../utils/logger');

/**
 * Register moderation user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerModerationHandlers = (bot) => {
  // Register all moderation commands
  registerModerationCommands(bot);

  logger.info('Moderation handlers registered successfully');
};

module.exports = registerModerationHandlers;
