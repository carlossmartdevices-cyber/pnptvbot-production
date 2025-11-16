const handleStart = require('../start');
const menuHandlers = require('./menu');
const profileHandlers = require('./profile');
const nearbyHandlers = require('./nearby');
const settingsHandlers = require('./settings');
const onboardingHelpers = require('../helpers/onboardingHelpers');

/**
 * Register all user handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerUserHandlers = (bot) => {
  // Start command (new onboarding system)
  bot.command('start', handleStart);

  // Onboarding callback actions
  bot.action(/language_(.+)/, onboardingHelpers.handleLanguageSelection);
  bot.action('confirm_age', onboardingHelpers.handleAgeConfirmation);
  bot.action('accept_terms', onboardingHelpers.handleTermsAcceptance);
  bot.action('decline_terms', onboardingHelpers.handleTermsDecline);
  bot.action('accept_privacy', onboardingHelpers.handlePrivacyAcceptance);
  bot.action('decline_privacy', onboardingHelpers.handlePrivacyDecline);
  bot.action('skip_email', onboardingHelpers.handleSkipEmail);

  // Text message handler for email collection
  bot.on('text', async (ctx, next) => {
    // Handle email submission during onboarding
    if (ctx.session?.awaitingEmail) {
      return onboardingHelpers.handleEmailSubmission(ctx);
    }
    // Continue to next handler if not awaiting email
    return next();
  });

  // Register other user handlers
  menuHandlers(bot);
  profileHandlers(bot);
  nearbyHandlers(bot);
  settingsHandlers(bot);
};

module.exports = registerUserHandlers;
