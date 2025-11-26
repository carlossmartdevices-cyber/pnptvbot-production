const radioHandlers = require('./radio');
const zoomHandlers = require('./zoom');
const liveHandlers = require('./live');
const supportHandlers = require('./support');

/**
 * Register all media handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMediaHandlers = (bot) => {
  radioHandlers(bot);
  zoomHandlers(bot);
  liveHandlers(bot);
  supportHandlers(bot);
};

module.exports = registerMediaHandlers;
