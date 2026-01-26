const onboardingHandlers = require('./onboarding');
const menuHandlers = require('./menu');
const profileHandlers = require('./profile');
const nearbyHandlers = require('./nearby');
const settingsHandlers = require('./settings');
const groupWelcomeHandlers = require('./groupWelcome');
const { registerAgeVerificationHandlers } = require('./ageVerificationHandler');
const lifetimeMigrationHandlers = require('./lifetimeMigration');
const { registerSubscriptionHandlers } = require('./subscriptionManagement');
const registerPNPLiveHandlers = require('./pnpLiveHandler');
const PNPLiveNotificationService = require('../../services/pnpLiveNotificationService');
const registerHangoutsHandlers = require('./hangoutsHandler');
const registerRadioHandlers = require('./radioHandler');

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
  registerSubscriptionHandlers(bot);
  registerPNPLiveHandlers(bot);
  registerHangoutsHandlers(bot);
  registerRadioHandlers(bot);

  // Initialize PNP Live notification service with bot instance
  PNPLiveNotificationService.init(bot);
};

module.exports = registerUserHandlers;
