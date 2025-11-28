const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

// Mistral AI integration
let mistral = null;
let AGENT_ID = null;

try {
  const { Mistral } = require('@mistralai/mistralai');
  if (process.env.MISTRAL_API_KEY) {
    mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });

    // Initialize agent on startup (will be created if not exists)
    initializeAgent().catch(err => {
      logger.error('Failed to initialize Mistral agent:', err);
    });
  }
} catch (error) {
  logger.warn('Mistral AI package not installed. AI chat will be unavailable.');
}

// Rate limiting map: userId -> lastMessageTime
const messageTimestamps = new Map();
const RATE_LIMIT_MS = 3000; // 3 seconds between messages

/**
 * Agent instructions - Cristina Customer Support AI
 */
<<<<<<< HEAD
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
=======
const CRISTINA_INSTRUCTIONS = `You are Cristina, the AI assistant for PNPtv community.

⚡ CRITICAL RULES - FOLLOW STRICTLY:
1. Keep responses SHORT (2-3 sentences max, NEVER more than 4)
2. NEVER repeat yourself or go in circles
3. NEVER celebrate excessively or use too many emojis
4. Give ONE clear answer, then STOP
5. Don't ask follow-up questions unless absolutely necessary
6. Be warm but CONCISE - no rambling

🎭 PERSONALITY:
- Warm Latina vibe, uses "papi", "mi amor" sparingly
- Helpful but brief
- Sexy undertone but never explicit
- Confident and street-smart

📋 RESPONSE FORMAT:
- Maximum 2-3 short sentences
- One emoji max per response
- Direct answer first, then brief context if needed
- NO long explanations or multiple paragraphs

🚫 NEVER DO:
- Write more than 4 sentences
- Repeat what you already said
- Say "Great question!" or celebrate the user's message
- Use more than 2 emojis
- Give long lists or explanations
- Go in circles asking the same things

✅ ALWAYS:
- Answer directly and briefly
- One clear point per response
- Move the conversation forward
- End conversations cleanly when done

For technical support: support@pnptv.app
For emergencies: 911`;
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1

/**
 * Initialize or get the Mistral AI Agent
 * Note: Agents must be created via Mistral console (https://console.mistral.ai)
 * or the environment variable MISTRAL_AGENT_ID can be set
 */
<<<<<<< HEAD
async function initializeAgent() {
  if (!mistral) return null;
=======
async function callMistralAI(messages, lang = 'es') {
  if (!mistral) {
    throw new Error('Mistral AI not initialized');
  }

  const languagePrompt = lang === 'es'
    ? 'Responde en español con tono cercano y empático. Sé BREVE, máximo 2-3 oraciones.'
    : 'Respond in English with a warm and empathetic tone. Be BRIEF, max 2-3 sentences.';
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1

  try {
    // Check if agent ID is provided in environment
    if (process.env.MISTRAL_AGENT_ID) {
      AGENT_ID = process.env.MISTRAL_AGENT_ID;
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

      const supportText = 
        '`🆘 Help Center`\n\n' +
        'Need help? We got you! 💜\n\n' +
        '**Cristina** is our AI assistant —\n' +
        'she can answer questions about:\n' +
        '• Platform features\n' +
        '• Harm reduction & safer use\n' +
        '• Sexual & mental health\n' +
        '• Community resources\n\n' +
        '_Or contact Santino directly for\n' +
        'account issues & billing._';

      await ctx.editMessageText(
<<<<<<< HEAD
        t('supportTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('chatWithCristina', lang), 'support_ai_chat')],
          [Markup.button.callback(t('contactAdmin', lang), 'support_contact_admin')],
          [Markup.button.callback(t('faq', lang), 'support_faq')],
          [Markup.button.callback(t('back', lang), 'back_to_main')],
        ]),
=======
        supportText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🤖 Chat with Cristina', 'support_ai_chat')],
            [Markup.button.callback('👤 Contact Santino', 'support_contact_admin')],
            [Markup.button.callback('🎁 Request Activation', 'support_request_activation')],
            [Markup.button.callback('❓ FAQ', 'support_faq')],
            [Markup.button.callback('🔙 Back', 'back_to_main')],
          ]),
        }
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
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
        const errorText = 
          '`❌ Unavailable`\n\n' +
          'AI chat is not available right now.\n' +
          'Please contact Santino directly.';

        await ctx.editMessageText(
          errorText,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Back', 'show_support')],
            ]),
          }
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
<<<<<<< HEAD
      await ctx.saveSession();

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        t('cristinaGreeting', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_support')],
        ]),
=======
      ctx.session.temp.aiQuestionCount = 0; // Track questions asked
      ctx.session.temp.aiChatActive = true; // Activate AI chat mode
      await ctx.saveSession();

      await ctx.answerCbQuery();

      const greeting = 
        '`🤖 Cristina AI Chat`\n\n' +
        '**Hey! I\'m Cristina** 💜\n\n' +
        'I\'m here to help you with:\n' +
        '• 🛡️ Harm reduction & safer use\n' +
        '• 💗 Sexual & mental health\n' +
        '• 🏠 Community resources\n' +
        '• 📱 Platform help\n\n' +
        '`Just type your message and I\'ll respond! 💬`\n\n' +
        '_5 questions before human support.\n' +
        'Tap on /exit to clear history._';

      await ctx.editMessageText(
        greeting,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'show_support')],
          ]),
        }
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
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

      const faqText = 
        '`❓ FAQ`\n\n' +
        '**1. How do I get PRIME?**\n' +
        '→ Menu > Unlock PRIME > Choose plan\n\n' +
        '**2. How do I update my profile?**\n' +
        '→ Menu > My Profile > Update Profile\n\n' +
        '**3. How do I find nearby users?**\n' +
        '→ Menu > Who Is Nearby? > Share location\n\n' +
        '**4. How do I start streaming?**\n' +
        '→ Requires PRIME > Members Area > Streams\n\n' +
        '**5. How do I contact support?**\n' +
        '→ Chat with Cristina or contact Santino\n\n' +
        '`Still need help? 💬 Chat with Cristina!`';

      await ctx.editMessageText(
        faqText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🤖 Chat with Cristina', 'support_ai_chat')],
            [Markup.button.callback('🔙 Back', 'show_support')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing FAQ:', error);
    }
  });

<<<<<<< HEAD
  // Handle AI chat messages
  bot.on('text', async (ctx, next) => {
    if (ctx.session.temp?.aiChatActive) {
=======
  // Handle text messages for AI chat
  bot.on('text', async (ctx, next) => {
    // Skip commands - let them be handled by command handlers
    if (ctx.message?.text?.startsWith('/')) {
      return next();
    }

    const chatType = ctx.chat?.type;
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    const userMessage = ctx.message?.text || '';

    // IN GROUPS: Only respond if message mentions "Cristina" (case insensitive)
    if (isGroup) {
      const mentionsCristina = /\bcristina\b/i.test(userMessage);
      if (!mentionsCristina) {
        return next(); // Don't respond in groups unless Cristina is mentioned
      }
      // Remove "Cristina" from the message before processing
      const cleanedMessage = userMessage.replace(/\bcristina\b/i, '').trim();
      if (!cleanedMessage) {
        // Just said "Cristina" with no question
        const lang = getLanguage(ctx);
        await ctx.reply(
          lang === 'es'
            ? '¿Sí papi? ¿Qué necesitas? 💜'
            : 'Yes papi? What do you need? 💜',
          { reply_to_message_id: ctx.message.message_id }
        );
        return;
      }
      // Store cleaned message for processing
      ctx.cristinaMessage = cleanedMessage;
    } else {
      // IN PRIVATE: Only process when AI chat session is active
      if (!ctx.session.temp?.aiChatActive) {
        return next();
      }
      ctx.cristinaMessage = userMessage;
    }

    // AI CHAT: Process messages
    // Special modes (contactingAdmin, requestingActivation) are handled after this block
    if (!ctx.session.temp?.contactingAdmin && !ctx.session.temp?.requestingActivation) {
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
      try {
        const lang = getLanguage(ctx);
        const userId = ctx.from.id;
        const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

        // Use cleaned message (without "Cristina") or original
        const messageToProcess = ctx.cristinaMessage || ctx.message?.text;

        // Validate message text exists
        if (!messageToProcess) {
          logger.warn('AI chat received message without text');
          return next();
        }

<<<<<<< HEAD
        const userMessage = ctx.message.text;

        // Exit AI chat for any command or exit keyword
        if (userMessage.startsWith('/') || userMessage.toLowerCase() === 'exit') {
          ctx.session.temp.aiChatActive = false;
          ctx.session.temp.aiChatHistory = null;
=======
        // Allow users to exit AI chat with "exit" or "/exit" (only in private)
        if (!isGroup && (messageToProcess.toLowerCase() === 'exit' || messageToProcess.toLowerCase() === '/exit')) {
          ctx.session.temp.aiChatHistory = null;
          ctx.session.temp.aiQuestionCount = 0;
          ctx.session.temp.aiChatActive = false; // Deactivate AI chat
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
          await ctx.saveSession();

          // If it's a command other than /exit, pass it to the next handler
          if (userMessage.startsWith('/') && !userMessage.toLowerCase().startsWith('/exit')) {
            return next();
          }

          await ctx.reply(
            lang === 'es'
<<<<<<< HEAD
              ? '💬 Chat finalizado. Use /support para acceder al menú de soporte.'
              : '💬 Chat ended. Use /support to access support menu.',
=======
              ? '💬 Chat finalizado. Usa /support si necesitas más ayuda.'
              : '💬 Chat ended. Use /support if you need more help.',
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
            Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

<<<<<<< HEAD
=======
        // Check question limit (5 questions max)
        const questionCount = ctx.session.temp.aiQuestionCount || 0;

        if (questionCount >= 5) {
          // Reset counters after reaching limit
          ctx.session.temp.aiChatHistory = null;
          ctx.session.temp.aiQuestionCount = 0;
          ctx.session.temp.aiChatActive = false; // Deactivate AI chat
          await ctx.saveSession();

          const limitMessage = lang === 'es'
            ? '💬 Has alcanzado el límite de preguntas con Cristina (5 preguntas).\n\n'
              + 'Para continuar con tu consulta, por favor contacta con nuestro equipo humano:\n\n'
              + '👉 Usa el botón "Contactar Admin" abajo para hablar con una persona real.'
            : '💬 You\'ve reached the question limit with Cristina (5 questions).\n\n'
              + 'To continue with your inquiry, please contact our human team:\n\n'
              + '👉 Use the "Contact Admin" button below to talk with a real person.';

          await ctx.reply(
            limitMessage,
            Markup.inlineKeyboard([
              [Markup.button.callback(t('contactAdmin', lang), 'support_contact_admin')],
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
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
              content: messageToProcess,
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

<<<<<<< HEAD
            // Send AI response
            const exitMessage = lang === 'es'
              ? 'Escribe "exit" para finalizar el chat'
              : 'Type "exit" to end chat';
            await ctx.reply(
              `🤖 Cristina: ${aiResponse}\n\n_${exitMessage}_`,
              { parse_mode: 'Markdown' }
=======
            // Increment question count
            ctx.session.temp.aiQuestionCount = (ctx.session.temp.aiQuestionCount || 0) + 1;
            await ctx.saveSession();

            // For groups, don't show question count footer
            let footer = '';
            if (!isGroup) {
              const questionsRemaining = 5 - ctx.session.temp.aiQuestionCount;

              if (questionsRemaining === 0) {
                footer = lang === 'es'
                  ? '\n\n_Esta fue tu última pregunta. La próxima te conectaré con un humano._'
                  : '\n\n_This was your last question. Next time I\'ll connect you with a human._';
              } else if (questionsRemaining === 1) {
                footer = lang === 'es'
                  ? '\n\n_Te queda 1 pregunta más. Toca /exit para salir._'
                  : '\n\n_You have 1 question left. Tap on /exit to leave._';
              } else {
                footer = lang === 'es'
                  ? `\n\n_Te quedan ${questionsRemaining} preguntas. Toca /exit para salir._`
                  : `\n\n_You have ${questionsRemaining} questions left. Tap on /exit to leave._`;
              }
            }

            // Reply to message in groups for context
            const replyOptions = { parse_mode: 'Markdown' };
            if (isGroup) {
              replyOptions.reply_to_message_id = ctx.message.message_id;
            }

            const sentMessage = await ctx.reply(
              `${aiResponse}${footer}`,
              replyOptions
>>>>>>> 1a985afecd6b66d7133bc5308e9724567cc778f1
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

        // Send to admin users
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
