const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const UserService = require('../../services/userService');

/**
 * PRIME Members Area menu handler
 * @param {Telegraf} bot - Bot instance
 */
const registerMembersAreaHandlers = (bot) => {
    // Main PRIME Members Area menu
    bot.action('show_members_area', async (ctx) => {
        try {
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            // Check if user has active subscription
            const hasSubscription = await UserService.hasActiveSubscription(userId);

            if (!hasSubscription) {
                await ctx.editMessageText(
                    lang === 'es'
                        ? '🔒 *Área de Miembros PRIME*\n\nEsta área está disponible solo para miembros PRIME.\n\n✨ Con PRIME obtienes acceso a:\n• Salas de Video Llamadas\n• Shows en Vivo\n• Radio PNPtv!\n• Y mucho más...'
                        : '🔒 *PRIME Members Area*\n\nThis area is only available for PRIME members.\n\n✨ With PRIME you get access to:\n• Video Call Rooms\n• Live Stream Shows\n• Radio PNPtv!\n• And much more...',
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'es' ? '⭐ Obtener PRIME' : '⭐ Get PRIME', 'show_subscription_plans')],
                            [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'back_to_main')]
                        ])
                    }
                );
                return;
            }

            // Show PRIME Members Area menu
            const message = lang === 'es'
                ? '💎 *Área de Miembros PRIME*\n\n¡Bienvenido al área exclusiva para miembros PRIME!\n\nSelecciona una opción:'
                : '💎 *PRIME Members Area*\n\nWelcome to the exclusive area for PRIME members!\n\nSelect an option:';

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(lang === 'es' ? '📹 Salas de Video Llamadas' : '📹 Video Call Rooms', 'hangouts_join_main')],
                    [Markup.button.callback(lang === 'es' ? '🎬 Shows en Vivo' : '🎬 Live Stream Shows', 'show_live')],
                    [Markup.button.callback(lang === 'es' ? '📻 Radio PNPtv!' : '📻 Radio PNPtv!', 'show_radio')],
                    [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'back_to_main')]
                ])
            });
        } catch (error) {
            logger.error('Error showing PRIME members area:', error);
            await ctx.answerCbQuery(
                lang === 'es'
                    ? 'Error al cargar el área de miembros'
                    : 'Error loading members area'
            );
        }
    });
};

module.exports = registerMembersAreaHandlers;
