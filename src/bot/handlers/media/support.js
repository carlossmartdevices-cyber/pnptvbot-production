const { Markup } = require('telegraf');
const Mistral = require('@mistralai/mistralai');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

let mistralClient = null;

// Initialize Mistral AI
if (process.env.MISTRAL_API_KEY) {
  mistralClient = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
  });
  logger.info('Mistral AI initialized for customer support');
}

/**
 * Support handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerSupportHandlers = (bot) => {
  // Show support menu
  bot.action('show_support', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      await ctx.editMessageText(
        t('supportTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('chatWithCristina', lang), 'support_ai_chat')],
          [Markup.button.callback(t('contactAdmin', lang), 'support_contact_admin')],
          [Markup.button.callback(t('faq', lang), 'support_faq')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing support menu:', error);
    }
  });

  // AI Chat
  bot.action('support_ai_chat', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.aiChatActive = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('cristinaGreeting', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_support')],
        ]),
      );
    } catch (error) {
      logger.error('Error starting AI chat:', error);
    }
  });

  // Contact Admin
  bot.action('support_contact_admin', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.contactingAdmin = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('adminMessage', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('cancel', lang), 'show_support')],
        ]),
      );
    } catch (error) {
      logger.error('Error in contact admin:', error);
    }
  });

  // FAQ
  bot.action('support_faq', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      const faq = lang === 'es'
        ? '❓ Preguntas Frecuentes:\n\n'
          + '1. ¿Cómo me suscribo a PRIME?\n'
          + '   → Use /menu y seleccione "Suscribirse a PRIME"\n\n'
          + '2. ¿Cómo actualizo mi perfil?\n'
          + '   → Use /menu → "Mi Perfil" → "Editar Perfil"\n\n'
          + '3. ¿Cómo encuentro usuarios cercanos?\n'
          + '   → Comparta su ubicación en "Usuarios Cercanos"\n\n'
          + '4. ¿Cómo inicio una transmisión en vivo?\n'
          + '   → Necesita suscripción PRIME → "Transmisiones en Vivo"'
        : '❓ Frequently Asked Questions:\n\n'
          + '1. How do I subscribe to PRIME?\n'
          + '   → Use /menu and select "Subscribe to PRIME"\n\n'
          + '2. How do I update my profile?\n'
          + '   → Use /menu → "My Profile" → "Edit Profile"\n\n'
          + '3. How do I find nearby users?\n'
          + '   → Share your location in "Nearby Users"\n\n'
          + '4. How do I start a live stream?\n'
          + '   → Requires PRIME subscription → "Live Streams"';

      await ctx.editMessageText(
        faq,
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_support')],
        ]),
      );
    } catch (error) {
      logger.error('Error showing FAQ:', error);
    }
  });

  // Handle AI chat messages
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.aiChatActive) {
      try {
        const lang = getLanguage(ctx);

        // Validate message text exists
        if (!ctx.message?.text) {
          logger.warn('AI chat received message without text');
          return next();
        }

        const userMessage = ctx.message.text;

        // Exit AI chat for any command or exit keyword
        if (userMessage.startsWith('/') || userMessage.toLowerCase() === 'exit') {
          ctx.session.temp.aiChatActive = false;
          await ctx.saveSession();

          // If it's a command other than /exit, pass it to the next handler
          if (userMessage.startsWith('/') && !userMessage.toLowerCase().startsWith('/exit')) {
            return next();
          }

          await ctx.reply(
            'Chat ended. Use /support to access support menu.',
            Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

        // Send to Mistral AI
        if (mistralClient) {
          try {
            const response = await mistralClient.chat.complete({
              model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
              messages: [
                {
                  role: 'system',
                  content: `You are Cristina, a helpful AI assistant for PNPtv, a Telegram bot platform for live streaming, radio, and social networking. Answer questions concisely in ${lang === 'es' ? 'Spanish' : 'English'}. Be friendly, professional, and helpful.`,
                },
                {
                  role: 'user',
                  content: userMessage,
                },
              ],
              maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || '1000', 10),
            });

            const aiResponse = response.choices[0].message.content;
            await ctx.reply(`🤖 Cristina: ${aiResponse}\n\n_Type "exit" to end chat_`);
          } catch (aiError) {
            logger.error('Mistral AI error:', aiError);
            await ctx.reply('Sorry, I encountered an error. Please try again.');
          }
        } else {
          // Fallback response if Mistral AI not configured
          await ctx.reply(
            '🤖 Cristina: I\'m here to help! Please use /support to access the support menu for specific assistance.',
          );
        }
      } catch (error) {
        logger.error('Error in AI chat:', error);
      }
      return;
    }

    if (ctx.session.temp?.contactingAdmin) {
      try {
        const lang = getLanguage(ctx);

        // Validate message text exists
        if (!ctx.message?.text) {
          logger.warn('Contact admin received message without text');
          return next();
        }

        const message = ctx.message.text;

        // Exit contact admin mode if user sends a command
        if (message.startsWith('/')) {
          ctx.session.temp.contactingAdmin = false;
          await ctx.saveSession();
          return next();
        }

        // Send to admin users
        const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter((id) => id.trim()) || [];

        if (adminIds.length === 0) {
          logger.error('No admin users configured for support messages');
          await ctx.reply('Support system not configured. Please contact us via email.');
          ctx.session.temp.contactingAdmin = false;
          return;
        }

        for (const adminId of adminIds) {
          try {
            await ctx.telegram.sendMessage(
              adminId.trim(),
              `📬 Support Message from User ${ctx.from.id} (@${ctx.from.username || 'no username'}):\n\n${message}`,
            );
          } catch (sendError) {
            logger.error('Error sending to admin:', sendError);
          }
        }

        ctx.session.temp.contactingAdmin = false;
        await ctx.saveSession();

        await ctx.reply(
          t('messageSent', lang),
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_support')],
          ]),
        );
      } catch (error) {
        logger.error('Error contacting admin:', error);
      }
      return;
    }

    return next();
  });

  // Support command
  bot.command('support', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      await ctx.reply(
        t('supportTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('chatWithCristina', lang), 'support_ai_chat')],
          [Markup.button.callback(t('contactAdmin', lang), 'support_contact_admin')],
          [Markup.button.callback(t('faq', lang), 'support_faq')],
        ]),
      );
    } catch (error) {
      logger.error('Error in /support command:', error);
    }
  });
};

module.exports = registerSupportHandlers;
