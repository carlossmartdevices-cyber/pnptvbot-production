const radioHandlers = require('./radio');
<<<<<<< HEAD
const zoomHandlers = require('./zoom');
=======
const jitsiHandlers = require('./jitsi');
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
const liveHandlers = require('./live');
const supportHandlers = require('./support');
const playerHandlers = require('./player');

/**
 * Register all media handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMediaHandlers = (bot) => {
  radioHandlers(bot);
<<<<<<< HEAD
  zoomHandlers(bot);
=======
  jitsiHandlers(bot);
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
  liveHandlers(bot);
  supportHandlers(bot);
  playerHandlers(bot);
};

module.exports = registerMediaHandlers;
