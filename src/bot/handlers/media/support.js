const { Markup } = require('telegraf');
const { Configuration, OpenAIApi } = require('openai');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');

let openai = null;

// Initialize OpenAI
if (process.env.OPENAI_API_KEY) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  openai = new OpenAIApi(configuration);
}

/**
 * Support handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerSupportHandlers = (bot) => {
  // Show support menu
  bot.action('show_support', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';

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
      const lang = ctx.session.language || 'en';
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
      const lang = ctx.session.language || 'en';
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
      const lang = ctx.session.language || 'en';

      const faq = lang === 'es'
        ? `❓ Preguntas Frecuentes:\n\n` +
          `1. ¿Cómo me suscribo a PRIME?\n` +
          `   → Use /menu y seleccione "Suscribirse a PRIME"\n\n` +
          `2. ¿Cómo actualizo mi perfil?\n` +
          `   → Use /menu → "Mi Perfil" → "Editar Perfil"\n\n` +
          `3. ¿Cómo encuentro usuarios cercanos?\n` +
          `   → Comparta su ubicación en "Usuarios Cercanos"\n\n` +
          `4. ¿Cómo inicio una transmisión en vivo?\n` +
          `   → Necesita suscripción PRIME → "Transmisiones en Vivo"`
        : `❓ Frequently Asked Questions:\n\n` +
          `1. How do I subscribe to PRIME?\n` +
          `   → Use /menu and select "Subscribe to PRIME"\n\n` +
          `2. How do I update my profile?\n` +
          `   → Use /menu → "My Profile" → "Edit Profile"\n\n` +
          `3. How do I find nearby users?\n` +
          `   → Share your location in "Nearby Users"\n\n` +
          `4. How do I start a live stream?\n` +
          `   → Requires PRIME subscription → "Live Streams"`;

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
        const lang = ctx.session.language || 'en';
        const userMessage = ctx.message.text;

        // Exit AI chat
        if (userMessage.toLowerCase() === '/exit' || userMessage.toLowerCase() === 'exit') {
          ctx.session.temp.aiChatActive = false;
          await ctx.saveSession();
          await ctx.reply(
            'Chat ended. Use /support to access support menu.',
            Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

        // Send to OpenAI
        if (openai) {
          try {
            const response = await openai.createChatCompletion({
              model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: `You are Cristina, a helpful AI assistant for PNPtv, a Telegram bot platform for live streaming, radio, and social networking. Answer questions concisely in ${lang === 'es' ? 'Spanish' : 'English'}.`,
                },
                {
                  role: 'user',
                  content: userMessage,
                },
              ],
              max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
            });

            const aiResponse = response.data.choices[0].message.content;
            await ctx.reply(`🤖 Cristina: ${aiResponse}\n\n_Type "exit" to end chat_`);
          } catch (aiError) {
            logger.error('OpenAI error:', aiError);
            await ctx.reply('Sorry, I encountered an error. Please try again.');
          }
        } else {
          // Fallback response if OpenAI not configured
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
        const lang = ctx.session.language || 'en';
        const message = ctx.message.text;

        // Send to admin users
        const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
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
      const lang = ctx.session.language || 'en';

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
