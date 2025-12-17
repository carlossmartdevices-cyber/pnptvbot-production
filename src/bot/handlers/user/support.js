const { requirePrivateChat } = require('../../utils/notifications');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle support command
 */
async function handleSupport(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Check if command is in group chat
    const isPrivate = await requirePrivateChat(
      ctx,
      'Support',
      i18n.t('support', language)
    );

    if (!isPrivate) {
      return;
    }

    const supportMessage = language === 'es'
      ? `💬 **Soporte**\n\n¿Cómo podemos ayudarte hoy?\n\nPor favor describe tu problema o pregunta:`
      : `💬 **Support**\n\nHow can we help you today?\n\nPlease describe your issue or question:`;

    await ctx.reply(supportMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: language === 'es' ? '📧 Email Soporte' : '📧 Email Support', url: 'mailto:support@pnptv.com' }],
          [{ text: language === 'es' ? '🔙 Menú Principal' : '🔙 Main Menu', callback_data: 'back_main' }],
        ],
      },
    });

    logger.info(`User ${userId} accessed support`);
  } catch (error) {
    logger.error('Error in support command:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleSupport,
};
