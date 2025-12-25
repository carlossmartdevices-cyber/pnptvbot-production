const radioHandlers = require('./radio');
const jitsiHandlers = require('./jitsi');
const liveHandlers = require('./live');
const supportHandlers = require('./support');
const playerHandlers = require('./player');
const membersAreaHandlers = require('./membersArea');
const hangoutsHandlers = require('./hangouts');

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
  membersAreaHandlers(bot);
  hangoutsHandlers(bot);
};

module.exports = registerMediaHandlers;
