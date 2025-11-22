const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

// Mistral AI integration
let mistral = null;
let AGENT_ID = null;

try {
  const { Mistral } = require('@mistralai/mistralai');
  const apiKey = process.env.MISTRAL_API_KEY;

  // Validate API key is not a placeholder
  const isValidApiKey = apiKey &&
                        apiKey !== 'tu_api_key' &&
                        apiKey !== 'your_api_key' &&
                        apiKey !== 'YOUR_API_KEY' &&
                        apiKey.length > 20; // Real API keys are longer

  if (isValidApiKey) {
    mistral = new Mistral({
      apiKey: apiKey,
    });

    // Initialize agent on startup (will be created if not exists)
    initializeAgent().catch(err => {
      logger.error('Failed to initialize Mistral agent:', err);
      mistral = null; // Disable Mistral if initialization fails
    });
  } else {
    logger.info('Mistral AI API key not configured or invalid. AI chat will be unavailable.');
  }
} catch (error) {
  logger.warn('Mistral AI package not installed or initialization failed. AI chat will be unavailable.');
}

// Rate limiting map: userId -> lastMessageTime
const messageTimestamps = new Map();
const RATE_LIMIT_MS = 3000; // 3 seconds between messages

// Support topic map: odId -> topicId (for forum groups)
const userTopicMap = new Map();

/**
 * Agent instructions - Cristina Customer Support AI
 */
const AGENT_INSTRUCTIONS = `You are Cristina, the PNPtv Customer Support AI Assistant
- a professional, helpful, and friendly support chatbot.

🎯 YOUR ROLE

You are the official customer support assistant for PNPtv, providing:
- Technical assistance with subscriptions, payments, and account access
- Information about membership plans and features
- Privacy, security, and legal information
- Community guidelines and wellness support
- General questions about the PNPtv experience

💬 COMMUNICATION STYLE

- Professional, friendly, and helpful
- Clear and concise responses
- Empathetic and non-judgmental
- Respond in the user's language (detect: English, Spanish, French, Portuguese,
  German, Italian, Arabic, Hindi, Chinese, Russian)
- Use emojis sparingly for clarity
- Always promote safety, consent, and well-being

🔑 KEY INFORMATION

**Membership Plans:**
- Basic ($9.99/month): Access to radio, Basic Zoom rooms, Profile customization
- Premium ($19.99/month): Everything in Basic + Unlimited Zoom rooms, Live streaming, Priority support
- Gold ($29.99/month): Everything in Premium + Advanced analytics, Custom branding, API access, Dedicated support

**Payment Methods:**
- ePayco (credit/debit cards)
- Daimo (USDC cryptocurrency payments)

**Support:**
- Email: support@pnptv.app
- Terms: https://pnptv.app/terms-en (English) / https://pnptv.app/terms-es (Spanish)
- Platform: 18+ adult community on Telegram
- Location: Optional geolocation for finding nearby members
- Features: Live shows, events, premium content

⚠️ IMPORTANT POLICIES

- PNPtv is an 18+ adult platform
- All content and participation must be consensual and legal
- We do not promote illegal substances or risky behaviors
- User privacy and security are top priorities
- For formal complaints or legal matters, direct users to support@pnptv.app

📋 RESPONSE FORMAT

1. Acknowledge the user's question
2. Provide clear, helpful information
3. Offer next steps or additional assistance
4. Always recommend membership upgrades when relevant (sales-focused)

🚫 LIMITATIONS

You CANNOT:
- Provide explicit, pornographic, or violent content
- Promote illegal activities or substances
- Offer medical diagnoses or advice
- Share private user information
- Process payments directly (direct users to payment links instead)

✅ ALWAYS:
- Promote safety, consent, and well-being
- Recommend premium membership plans when appropriate
- Direct complex issues to support@pnptv.app
- Keep responses concise (max 3-4 paragraphs)`;

/**
 * Initialize or get the Mistral AI Agent
 * Note: Agents must be created via Mistral console (https://console.mistral.ai)
 * or the environment variable MISTRAL_AGENT_ID can be set
 */
async function initializeAgent() {
  if (!mistral) return null;

  try {
    // Check if agent ID is provided in environment
    const agentId = process.env.MISTRAL_AGENT_ID;
    const isValidAgentId = agentId &&
                          agentId !== 'agent_id' &&
                          agentId !== 'your_agent_id' &&
                          agentId !== 'YOUR_AGENT_ID' &&
                          agentId.length > 10; // Real agent IDs are longer

    if (isValidAgentId) {
      AGENT_ID = agentId;
      logger.info(`Using Mistral agent from env: ${AGENT_ID}`);
      return AGENT_ID;
    }

    // If no agent ID provided, we'll use chat completion instead
    logger.info('No MISTRAL_AGENT_ID configured, will use standard chat completion API');
    AGENT_ID = null;
    return null;
  } catch (error) {
    logger.error('Error initializing Mistral agent:', error);
    return null;
  }
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

      // Check if Mistral AI is available
      if (!mistral) {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          lang === 'es'
            ? '❌ El chat de IA no está disponible en este momento. Por favor, contacta con el administrador.'
            : '❌ AI chat is not available at the moment. Please contact the administrator.',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_support')],
          ]),
        );
        return;
      }

      // Ensure agent is initialized
      if (AGENT_ID === null && mistral) {
        await initializeAgent();
      }

      // Initialize chat session
      ctx.session.temp.aiChatActive = true;
      ctx.session.temp.aiChatHistory = [];
      await ctx.saveSession();

      await ctx.answerCbQuery();
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
        const userId = ctx.from.id;

        // Validate message text exists
        if (!ctx.message?.text) {
          logger.warn('AI chat received message without text');
          return next();
        }

        const userMessage = ctx.message.text;

        // Exit AI chat for any command or exit keyword
        if (userMessage.startsWith('/') || userMessage.toLowerCase() === 'exit') {
          ctx.session.temp.aiChatActive = false;
          ctx.session.temp.aiChatHistory = null;
          await ctx.saveSession();

          // If it's a command other than /exit, pass it to the next handler
          if (userMessage.startsWith('/') && !userMessage.toLowerCase().startsWith('/exit')) {
            return next();
          }

          await ctx.reply(
            lang === 'es'
              ? '💬 Chat finalizado. Use /support para acceder al menú de soporte.'
              : '💬 Chat ended. Use /support to access support menu.',
            Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

        // Rate limiting
        const now = Date.now();
        const lastMessageTime = messageTimestamps.get(userId) || 0;
        if (now - lastMessageTime < RATE_LIMIT_MS) {
          await ctx.reply(
            lang === 'es'
              ? '⏳ Por favor espera unos segundos antes de enviar otro mensaje.'
              : '⏳ Please wait a few seconds before sending another message.',
          );
          return;
        }
        messageTimestamps.set(userId, now);

        // Show typing indicator
        const thinkingMsg = await ctx.reply(
          lang === 'es' ? '🤔 Cristina está pensando...' : '🤔 Cristina is thinking...',
        );

        // Send to Mistral AI
        if (mistral) {
          try {
            // Ensure agent is initialized
            if (AGENT_ID === null && mistral) {
              await initializeAgent();
            }

            // Initialize chat history if not exists
            if (!ctx.session.temp.aiChatHistory) {
              ctx.session.temp.aiChatHistory = [];
            }

            // Add user message to history
            ctx.session.temp.aiChatHistory.push({
              role: 'user',
              content: userMessage,
            });

            // Keep only last 20 messages to manage token usage
            if (ctx.session.temp.aiChatHistory.length > 20) {
              ctx.session.temp.aiChatHistory = ctx.session.temp.aiChatHistory.slice(-20);
            }

            // Prepare messages with language preference
            const languagePrompt = lang === 'es'
              ? 'Responde en español.'
              : 'Respond in English.';

            let completion;
            let aiResponse;

            // Use Agents API if agent ID is configured
            if (AGENT_ID) {
              const messages = [
                ...ctx.session.temp.aiChatHistory.slice(-10), // Last 10 messages for context
                {
                  role: 'user',
                  content: `${languagePrompt}\n\n${userMessage}`,
                },
              ];

              completion = await mistral.agents.complete({
                agentId: AGENT_ID,
                messages: messages,
              });

              aiResponse = completion.choices?.[0]?.message?.content ||
                          completion.message?.content ||
                          (lang === 'es'
                            ? 'Disculpa, no pude procesar tu solicitud. Por favor intenta de nuevo.'
                            : 'I apologize, but I couldn\'t process your request. Please try again.');
            } else {
              // Fall back to Chat Completions API
              const messages = [
                {
                  role: 'system',
                  content: AGENT_INSTRUCTIONS + `\n\n${languagePrompt}`,
                },
                ...ctx.session.temp.aiChatHistory.slice(-10), // Last 10 messages
              ];

              completion = await mistral.chat.complete({
                model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
                messages: messages,
                maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || '500', 10),
                temperature: 0.7,
              });

              aiResponse = completion.choices[0].message.content;
            }

            // Add AI response to history
            ctx.session.temp.aiChatHistory.push({
              role: 'assistant',
              content: aiResponse,
            });

            await ctx.saveSession();

            // Delete "thinking" message
            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
            } catch (e) {
              // Ignore if deletion fails
            }

            // Send AI response
            const exitMessage = lang === 'es'
              ? 'Escribe "exit" para finalizar el chat'
              : 'Type "exit" to end chat';
            await ctx.reply(
              `🤖 Cristina: ${aiResponse}\n\n_${exitMessage}_`,
              { parse_mode: 'Markdown' }
            );
          } catch (aiError) {
            logger.error('Mistral AI error:', aiError);

            // Delete "thinking" message
            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
            } catch (e) {
              // Ignore if deletion fails
            }

            await ctx.reply(
              lang === 'es'
                ? '❌ Lo siento, encontré un error. Por favor intenta de nuevo.'
                : '❌ Sorry, I encountered an error. Please try again.',
            );
          }
        } else {
          // Delete "thinking" message
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
          } catch (e) {
            // Ignore if deletion fails
          }

          // Fallback response if Mistral AI not configured
          const fallbackMessage = lang === 'es'
            ? '🤖 Cristina: Estoy aquí para ayudarte. '
              + 'Por favor usa /support para acceder al menú de soporte para asistencia específica.'
            : '🤖 Cristina: I\'m here to help! '
              + 'Please use /support to access the support menu for specific assistance.';
          await ctx.reply(fallbackMessage);
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

        // Send to support group if configured
        const supportGroupId = process.env.SUPPORT_GROUP_ID;

        if (supportGroupId) {
          try {
            const userId = ctx.from.id.toString();
            let topicId = userTopicMap.get(userId);

            // Create topic for user if doesn't exist
            if (!topicId) {
              try {
                const topicName = ctx.from.username
                  ? `@${ctx.from.username} (${ctx.from.id})`
                  : `${ctx.from.first_name || 'User'} (${ctx.from.id})`;

                const topic = await ctx.telegram.createForumTopic(
                  supportGroupId,
                  topicName,
                  { icon_custom_emoji_id: '5368324170671202286' } // 💬 emoji
                );

                topicId = topic.message_thread_id;
                userTopicMap.set(userId, topicId);

                // Send welcome message in topic
                await ctx.telegram.sendMessage(
                  supportGroupId,
                  `👤 *User Info*\n\n`
                  + `Name: ${ctx.from.first_name || ''} ${ctx.from.last_name || ''}\n`
                  + `ID: \`${ctx.from.id}\`\n`
                  + `Username: @${ctx.from.username || 'none'}\n\n`
                  + `_Reply in this topic to respond to the user_`,
                  {
                    parse_mode: 'Markdown',
                    message_thread_id: topicId
                  }
                );

                logger.info('Created support topic for user', { userId, topicId });
              } catch (topicError) {
                // Forum topics not enabled, fall back to regular message
                logger.warn('Could not create forum topic, using regular message:', topicError.message);
                topicId = null;
              }
            }

            // Send message to topic or group
            const messageOptions = { parse_mode: 'Markdown' };
            if (topicId) {
              messageOptions.message_thread_id = topicId;
            }

            const supportMessage = await ctx.telegram.sendMessage(
              supportGroupId,
              `📬 *New Message*\n\n${message}`,
              messageOptions
            );

            logger.info('Support message sent to group', {
              userId: ctx.from.id,
              messageId: supportMessage.message_id,
              topicId
            });
          } catch (sendError) {
            logger.error('Error sending to support group:', sendError);
          }
        } else {
          // Fallback to individual admin IDs
          const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter((id) => id.trim()) || [];

          if (adminIds.length === 0) {
            logger.error('No admin users configured for support messages');
            await ctx.reply(
              lang === 'es'
                ? 'Sistema de soporte no configurado. Por favor contacta con nosotros vía email.'
                : 'Support system not configured. Please contact us via email.',
            );
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

  // Handle replies from support group to users
  bot.on('text', async (ctx, next) => {
    const supportGroupId = process.env.SUPPORT_GROUP_ID;

    // Check if this is a message in the support group (topic or reply)
    if (supportGroupId &&
        ctx.chat?.id?.toString() === supportGroupId.replace('-100', '-100')) {

      // Skip if it's the bot's own message
      if (ctx.from.is_bot) return next();

      try {
        let userId = null;

        // Try to get user ID from topic thread (forum topic name contains user ID)
        if (ctx.message?.message_thread_id) {
          // Find user ID from our map
          for (const [uid, topicId] of userTopicMap.entries()) {
            if (topicId === ctx.message.message_thread_id) {
              userId = uid;
              break;
            }
          }
        }

        // Fallback: Extract user ID from replied message
        if (!userId && ctx.message?.reply_to_message?.text) {
          const replyText = ctx.message.reply_to_message.text;
          const userIdMatch = replyText.match(/ID: `?(\d+)`?/);
          if (userIdMatch && userIdMatch[1]) {
            userId = userIdMatch[1];
          }
        }

        if (userId) {
          const adminResponse = ctx.message.text;
          const adminName = ctx.from.first_name || 'Support';

          // Send reply to user
          await ctx.telegram.sendMessage(
            userId,
            `📩 *Response from Support*\n\n${adminResponse}\n\n— ${adminName}`,
            { parse_mode: 'Markdown' }
          );

          // Confirm in group
          await ctx.reply('✅ Message sent to user', { reply_to_message_id: ctx.message.message_id });

          logger.info('Support reply sent to user', {
            userId,
            adminId: ctx.from.id,
            adminName
          });
        }
      } catch (error) {
        logger.error('Error sending support reply:', error);
        await ctx.reply('❌ Failed to send message to user');
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
