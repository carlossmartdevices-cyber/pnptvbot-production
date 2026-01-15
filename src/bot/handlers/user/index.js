const onboardingHandlers = require('./onboarding');
const menuHandlers = require('./menu');
const profileHandlers = require('./profile');
const nearbyHandlers = require('./nearby');
const settingsHandlers = require('./settings');
const groupWelcomeHandlers = require('./groupWelcome');
const { registerAgeVerificationHandlers } = require('./ageVerificationHandler');
const lifetimeMigrationHandlers = require('./lifetimeMigration');

/**
 * Register all user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerUserHandlers = (bot) => {
  onboardingHandlers(bot);
  registerAgeVerificationHandlers(bot);
  menuHandlers(bot);
  profileHandlers(bot);
  nearbyHandlers(bot);
  settingsHandlers(bot);
  groupWelcomeHandlers(bot);
  lifetimeMigrationHandlers(bot);
};

module.exports = registerUserHandlers;
