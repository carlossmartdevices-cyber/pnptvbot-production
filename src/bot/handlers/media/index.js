const radioHandlers = require('./radio');
const zoomHandlers = require('./zoomV2');
const jitsiHandlers = require('./jitsi');
const liveHandlers = require('./live');
const supportHandlers = require('./support');
const playerHandlers = require('./player');
const membersAreaHandlers = require('./membersArea');

/**
 * Register all media handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMediaHandlers = (bot) => {
  radioHandlers(bot);
  zoomHandlers(bot);
  jitsiHandlers(bot);
  liveHandlers(bot);
  supportHandlers(bot);
  playerHandlers(bot);
  membersAreaHandlers(bot);
};

module.exports = registerMediaHandlers;
