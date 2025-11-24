const radioHandlers = require('./radio');
const zoomHandlers = require('./zoom');
const jitsiHandlers = require('./jitsi');
const liveHandlers = require('./live');
const livestreamHandlers = require('./livestream');
const supportHandlers = require('./support');
const playerHandlers = require('./player');
const { registerTopicMenuHandlers } = require('./topicMenu');

/**
 * Register all media handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMediaHandlers = (bot) => {
  radioHandlers(bot);
  zoomHandlers(bot);
  jitsiHandlers(bot);
  liveHandlers(bot);
  livestreamHandlers(bot);
  supportHandlers(bot);
  playerHandlers(bot);
  registerTopicMenuHandlers(bot);
};

module.exports = registerMediaHandlers;
