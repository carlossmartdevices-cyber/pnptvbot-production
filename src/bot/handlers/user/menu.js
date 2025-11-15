const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Main menu handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMenuHandlers = (bot) => {
  // Menu command
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error showing menu:', error);
    }
  });

  // Back to main menu action
  bot.action('back_to_main', async (ctx) => {
    try {
      await showMainMenuEdit(ctx);
    } catch (error) {
      logger.error('Error in back to main:', error);
    }
  });
};

/**
 * Show main menu (new message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';

  await ctx.reply(
    t('mainMenuIntro', lang),
    Markup.inlineKeyboard([
      [
        Markup.button.callback(t('subscribe', lang), 'show_subscription_plans'),
        Markup.button.callback(t('myProfile', lang), 'show_profile'),
      ],
      [
        Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
        Markup.button.callback(t('liveStreams', lang), 'show_live'),
      ],
      [
        Markup.button.callback(t('radio', lang), 'show_radio'),
        Markup.button.callback(t('zoomRooms', lang), 'show_zoom'),
      ],
      [
        Markup.button.callback(t('support', lang), 'show_support'),
        Markup.button.callback(t('settings', lang), 'show_settings'),
      ],
    ]),
  );
};

/**
 * Show main menu (edit existing message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenuEdit = async (ctx) => {
  const lang = ctx.session?.language || 'en';

  try {
    await ctx.editMessageText(
      t('mainMenuIntro', lang),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t('subscribe', lang), 'show_subscription_plans'),
          Markup.button.callback(t('myProfile', lang), 'show_profile'),
        ],
        [
          Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
          Markup.button.callback(t('liveStreams', lang), 'show_live'),
        ],
        [
          Markup.button.callback(t('radio', lang), 'show_radio'),
          Markup.button.callback(t('zoomRooms', lang), 'show_zoom'),
        ],
        [
          Markup.button.callback(t('support', lang), 'show_support'),
          Markup.button.callback(t('settings', lang), 'show_settings'),
        ],
      ]),
    );
  } catch (error) {
    // If edit fails, send new message
    await showMainMenu(ctx);
  }
};

module.exports = registerMenuHandlers;
module.exports.showMainMenu = showMainMenu;
module.exports.showMainMenuEdit = showMainMenuEdit;
