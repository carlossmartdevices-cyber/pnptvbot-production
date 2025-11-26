const { requirePrivateChat } = require('../../utils/notifications');
const { getSettingsMenu, getLanguageMenu } = require('../../utils/menus');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle settings command
 */
async function handleSettings(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Check if command is in group chat
    const isPrivate = await requirePrivateChat(
      ctx,
      'Settings',
      i18n.t('settings', language)
    );

    if (!isPrivate) {
      return;
    }

    await ctx.reply(
      i18n.t('settings', language),
      { reply_markup: getSettingsMenu(language) }
    );

    logger.info(`User ${userId} accessed settings`);
  } catch (error) {
    logger.error('Error in settings command:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Handle settings language change
 */
async function handleSettingsLanguage(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    await ctx.editMessageText(
      i18n.t('select_language', language),
      { reply_markup: getLanguageMenu() }
    );

    logger.info(`User ${userId} changing language in settings`);
  } catch (error) {
    logger.error('Error in settings language:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Handle language change from settings
 */
async function handleLanguageChange(ctx) {
  try {
    const userId = ctx.from.id;
    const newLanguage = ctx.callbackQuery.data.split('_')[1]; // 'lang_en' -> 'en'

    await userService.updateUser(userId, { language: newLanguage });

    await ctx.editMessageText(i18n.t('language_changed', newLanguage));

    logger.info(`User ${userId} changed language to ${newLanguage}`);
  } catch (error) {
    logger.error('Error changing language:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleSettings,
  handleSettingsLanguage,
  handleLanguageChange,
};
