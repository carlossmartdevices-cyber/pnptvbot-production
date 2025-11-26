const onboardingHandlers = require('./onboarding');
const menuHandlers = require('./menu');
const profileHandlers = require('./profile');
const nearbyHandlers = require('./nearby');
const settingsHandlers = require('./settings');
const groupWelcomeHandlers = require('./groupWelcome');

/**
 * Register all user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerUserHandlers = (bot) => {
  onboardingHandlers(bot);
  menuHandlers(bot);
  profileHandlers(bot);
  nearbyHandlers(bot);
  settingsHandlers(bot);
  groupWelcomeHandlers(bot);
};

module.exports = registerUserHandlers;
