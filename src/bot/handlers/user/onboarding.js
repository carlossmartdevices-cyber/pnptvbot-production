const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const { isValidEmail } = require('../../../utils/validation');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Onboarding handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerOnboardingHandlers = (bot) => {
  // Start command - begin onboarding or show main menu
  bot.command('start', async (ctx) => {
    try {
      const user = await UserService.getOrCreateFromContext(ctx);

      if (user.onboardingComplete) {
        // User already onboarded, show main menu
        return ctx.scene?.enter ? ctx.scene.enter('main_menu') : showMainMenu(ctx);
      }

      // Start onboarding - language selection
      await showLanguageSelection(ctx);
    } catch (error) {
      logger.error('Error in /start command:', error);
      await ctx.reply('An error occurred. Please try again.');
    }
  });

  // Language selection
  bot.action(/^set_lang_(.+)$/, async (ctx) => {
    try {
      const lang = ctx.match[1];
      ctx.session.language = lang;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('languageSelected', lang),
        { parse_mode: 'Markdown' },
      );

      // Move to age confirmation
      await showAgeConfirmation(ctx);
    } catch (error) {
      logger.error('Error setting language:', error);
    }
  });

  // Age confirmation
  bot.action('age_confirm_yes', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.ageConfirmed = true;

      await ctx.editMessageText(t('termsAccepted', lang));

      // Move to terms acceptance
      await showTermsAndPrivacy(ctx);
    } catch (error) {
      logger.error('Error in age confirmation:', error);
    }
  });

  bot.action('age_confirm_no', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.editMessageText(t('underAge', lang));
    } catch (error) {
      logger.error('Error in age rejection:', error);
    }
  });

  // Terms acceptance
  bot.action('accept_terms', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.termsAccepted = true;

      await ctx.editMessageText(t('termsAccepted', lang));

      // Move to email prompt
      await showEmailPrompt(ctx);
    } catch (error) {
      logger.error('Error accepting terms:', error);
    }
  });

  // Email prompt actions
  bot.action('skip_email', async (ctx) => {
    try {
      await completeOnboarding(ctx);
    } catch (error) {
      logger.error('Error skipping email:', error);
    }
  });

  bot.action('provide_email', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForEmail = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        '📧 Please send your email address:',
      );
    } catch (error) {
      logger.error('Error in provide email:', error);
    }
  });

  // Listen for email input
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.waitingForEmail) {
      const email = ctx.message.text.trim();
      const lang = getLanguage(ctx);

      if (isValidEmail(email)) {
        ctx.session.temp.email = email;
        ctx.session.temp.waitingForEmail = false;
        await ctx.saveSession();

        await ctx.reply(t('emailReceived', lang));
        await completeOnboarding(ctx);
      } else {
        await ctx.reply(t('invalidInput', lang) + '\nPlease send a valid email address.');
      }
      return;
    }

    return next();
  });
};

/**
 * Show language selection
 * @param {Context} ctx - Telegraf context
 */
const showLanguageSelection = async (ctx) => {
  await ctx.reply(
    '👋 Welcome to PNPtv!\n\nPlease select your language / Por favor selecciona tu idioma:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🇺🇸 English', 'set_lang_en'),
        Markup.button.callback('🇪🇸 Español', 'set_lang_es'),
      ],
    ]),
  );
};

/**
 * Show age confirmation
 * @param {Context} ctx - Telegraf context
 */
const showAgeConfirmation = async (ctx) => {
  const lang = getLanguage(ctx);

  await ctx.reply(
    t('ageConfirmation', lang),
    Markup.inlineKeyboard([
      [Markup.button.callback(t('ageConfirmYes', lang), 'age_confirm_yes')],
      [Markup.button.callback(t('ageConfirmNo', lang), 'age_confirm_no')],
    ]),
  );
};

/**
 * Show terms and privacy
 * @param {Context} ctx - Telegraf context
 */
const showTermsAndPrivacy = async (ctx) => {
  const lang = getLanguage(ctx);

  await ctx.reply(
    t('termsAndPrivacy', lang) + '\n\n📄 Terms: https://pnptv.com/terms\n🔒 Privacy: https://pnptv.com/privacy',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ ' + t('confirm', lang), 'accept_terms')],
    ]),
  );
};

/**
 * Show email prompt
 * @param {Context} ctx - Telegraf context
 */
const showEmailPrompt = async (ctx) => {
  const lang = getLanguage(ctx);

  await ctx.reply(
    t('emailPrompt', lang),
    Markup.inlineKeyboard([
      [Markup.button.callback('📧 Provide Email', 'provide_email')],
      [Markup.button.callback(t('skipEmail', lang), 'skip_email')],
    ]),
  );
};

/**
 * Complete onboarding
 * @param {Context} ctx - Telegraf context
 */
const completeOnboarding = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const userId = ctx.from.id;

    // Update user profile
    await UserService.updateProfile(userId, {
      language: lang,
      email: ctx.session.temp.email || null,
      onboardingComplete: true,
    });

    // Clear temp session data
    ctx.session.temp = {};
    await ctx.saveSession();

    await ctx.reply(t('onboardingComplete', lang));

    // Show main menu
    const { showMainMenu } = require('./menu');
    await showMainMenu(ctx);
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    await ctx.reply('An error occurred. Please try /start again.');
  }
};

module.exports = registerOnboardingHandlers;
