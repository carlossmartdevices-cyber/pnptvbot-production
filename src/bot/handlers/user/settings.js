const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Settings handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerSettingsHandlers = (bot) => {
  // Show settings menu
  bot.action('show_settings', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const settingsText = 
        '`⚙️ Settings`\n\n' +
        'Customize your PNPtv! experience.\n\n' +
        '_Choose an option below:_';

      await ctx.editMessageText(
        settingsText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🌐 Language', 'settings_language')],
            [Markup.button.callback('🔔 Notifications', 'settings_notifications')],
            [Markup.button.callback('🔒 Privacy', 'settings_privacy')],
            [Markup.button.callback('ℹ️ About', 'settings_about')],
            [Markup.button.callback('🔙 Back', 'back_to_main')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing settings:', error);
    }
  });

  // Language settings
  bot.action('settings_language', async (ctx) => {
    try {
      const langText = 
        '`🌐 Language`\n\n' +
        'Select your preferred language:\n' +
        '_Selecciona tu idioma preferido:_';

      await ctx.editMessageText(
        langText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('🇺🇸 English', 'change_lang_en'),
              Markup.button.callback('🇪🇸 Español', 'change_lang_es'),
            ],
            [Markup.button.callback('🔙 Back', 'show_settings')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing language settings:', error);
    }
  });

  // Change language
  bot.action(/^change_lang_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid language change action format');
        return;
      }

      const newLang = ctx.match[1];
      ctx.session.language = newLang;
      await ctx.saveSession();

      await UserService.updateProfile(ctx.from.id, { language: newLang });

      const lang = newLang;
      await ctx.editMessageText(
        t('languageChanged', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_settings')],
        ]),
      );
    } catch (error) {
      logger.error('Error changing language:', error);
    }
  });

  // Notifications settings
  bot.action('settings_notifications', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const notifText = 
        '`🔔 Notifications`\n\n' +
        '_Coming soon..._\n\n' +
        'You\'ll be able to customize:\n' +
        '• Message alerts\n' +
        '• New content notifications\n' +
        '• Nearby user alerts\n' +
        '• Promotional updates';

      await ctx.editMessageText(
        notifText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'show_settings')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing notifications:', error);
    }
  });

  // Privacy settings
  bot.action('settings_privacy', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const privacyText = 
        '`🔒 Privacy`\n\n' +
        '_Coming soon..._\n\n' +
        'You\'ll be able to control:\n' +
        '• Who sees your profile\n' +
        '• Location sharing\n' +
        '• Online status visibility\n' +
        '• Message requests';

      await ctx.editMessageText(
        privacyText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'show_settings')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing privacy:', error);
    }
  });

  // About
  bot.action('settings_about', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const aboutText = 
        '`ℹ️ About`\n\n' +
        '🎬 **PNPtv Bot** v1.0.0\n\n' +
        'Your entertainment hub for:\n' +
        '• Live streams & shows\n' +
        '• Radio & podcasts\n' +
        '• Community connections\n' +
        '• And much more!\n\n' +
        '`Made with 💜 by PNPtv`\n\n' +
        '🌐 pnptv.app\n' +
        '📧 support@pnptv.app';

      await ctx.editMessageText(
        aboutText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 Visit Website', 'https://pnptv.app')],
            [Markup.button.callback('🔙 Back', 'show_settings')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing about:', error);
    }
  });

  // Language command
  bot.command('language', async (ctx) => {
    try {
      await ctx.reply(
        'Select Language / Seleccionar Idioma:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🇺🇸 English', 'change_lang_en'),
            Markup.button.callback('🇪🇸 Español', 'change_lang_es'),
          ],
        ]),
      );
    } catch (error) {
      logger.error('Error in /language command:', error);
    }
  });
};

module.exports = registerSettingsHandlers;
