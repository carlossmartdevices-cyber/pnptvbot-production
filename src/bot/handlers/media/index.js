const radioHandlers = require('./radio');
const jitsiHandlers = require('./jitsi');
const liveHandlers = require('./live');
const supportHandlers = require('./support');
const playerHandlers = require('./player');

/**
 * Register all media handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMediaHandlers = (bot) => {
  radioHandlers(bot);
  jitsiHandlers(bot);
  liveHandlers(bot);
  supportHandlers(bot);
  playerHandlers(bot);
};

module.exports = registerMediaHandlers;
