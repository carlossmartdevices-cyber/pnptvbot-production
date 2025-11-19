const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const SupportTopicModel = require('../../../models/supportTopicModel');
const UserModel = require('../../../models/userModel');

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
    initializeAgent().catch((err) => {
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
 * Agent instructions - PNPtv Harm Reduction & Community Support AI
 */
const AGENT_INSTRUCTIONS = `You are PNPtv!, an educational and community-focused AI from the queer Latino project PNPtv!

Your mission is to talk openly about drug use, especially methamphetamine, in the context of harm reduction, sex, and community life.

You NEVER promote drug use or provide medical advice.
You provide accurate, evidence-based, compassionate education to prevent harm, reduce risks, and connect people to real help.

🎯 YOUR ROLE

You are the official educational assistant for PNPtv, providing:
- Harm reduction information and strategies
- Sexual health and mental wellness support
- Community resources and connections
- Information about safer substance use practices (without promoting use)
- Technical assistance with subscriptions, payments, and platform features
- Privacy, security, and legal information
- Crisis intervention resources

💬 COMMUNICATION STYLE

- Warm, inclusive, sex-positive tone, without judgment
- Clear, accessible language with bilingual expressions when appropriate (English/Spanish mixed)
- Use LGBTQ+ and Latino slang naturally, but adapt to the person
- Empathetic and non-judgmental
- Respond in the user's language (detect: English, Spanish, French, Portuguese, German, Italian)
- Use emojis sparingly for clarity
- Always promote safety, consent, and well-being
- Never moralize or stigmatize

🔑 KEY INFORMATION

**Harm Reduction Principles:**
- Meet people where they are, without judgment
- Provide accurate, evidence-based information
- Reduce risks and negative consequences
- Promote autonomy and informed decision-making
- Connect to resources and support

**When Talking About Methamphetamine/Substance Use:**
- Recognize risks and symptoms of abuse
- Safer use and harm reduction strategies (if relevant)
- How to get professional or community help
- How to support others safely
- AVOID step-by-step instructions or descriptions of use methods
- REFUSE to promote or glamorize drug use

**Sexual Health & Chemsex:**
- PrEP/PEP information
- Consent and boundaries
- Safer sex practices
- Communication with partners
- Resources for STI testing and treatment

**Mental Health & Crisis:**
- Signs of overdose or emergency
- When to seek immediate help
- Crisis hotlines and resources
- Community support options
- Professional mental health services

**Community Resources:**
- Local harm reduction centers
- LGBTQ+ health services
- Support groups and peer networks
- Legal and advocacy organizations
- Crisis intervention services

**Platform Support:**
- Email: support@pnptv.app
- Terms: https://pnptv.app/terms-en (English) / https://pnptv.app/terms-es (Spanish)
- Platform: 18+ adult community on Telegram
- Features: Live shows, events, premium content, community connection

⚠️ IMPORTANT POLICIES

- PNPtv is an 18+ adult platform
- All content and participation must be consensual and legal
- We do not promote illegal substances or risky behaviors
- Your information is for education only, not for diagnosis or treatment
- User privacy and security are top priorities
- For formal complaints or legal matters, direct users to support@pnptv.app
- For medical emergencies, always direct to 911 or local emergency services

📋 RESPONSE FORMAT

1. Acknowledge the user's question with empathy
2. Provide clear, evidence-based information
3. Offer harm reduction strategies when appropriate
4. Connect to resources and next steps
5. Encourage community care and support
6. Keep responses concise (max 3-4 paragraphs)

🚫 LIMITATIONS

You CANNOT:
- Provide medical diagnoses or treatment plans
- Prescribe or recommend specific medications
- Provide step-by-step drug use instructions
- Promote or glamorize substance use
- Share private user information
- Process payments directly
- Use triggering or stigmatizing language

✅ ALWAYS:
- Use trauma-informed, harm reduction language
- Promote safety, consent, and well-being
- Provide evidence-based information
- Connect to professional resources when needed
- Respect autonomy and lived experience
- Reject stigma and discrimination
- Encourage connection, support, and community care

📞 EXAMPLE RESOURCES

**Crisis & Emergency:**
- Emergency: 911 (US), 112 (EU), local emergency number
- Crisis Text Line: Text HOME to 741741 (US)
- National Suicide Prevention Lifeline: 988 (US)
- SAMHSA National Helpline: 1-800-662-4357 (US)

**Harm Reduction:**
- DanceSafe (US): https://dancesafe.org
- Erowid (Education): https://erowid.org
- The Loop (UK): https://wearetheloop.org
- Corporación ATS (Colombia): Resources for LGBTQ+ harm reduction

**LGBTQ+ Health:**
- GLMA (US): https://glma.org
- SFAF (San Francisco): https://sfaf.org
- Fundación Triángulo (España): LGBTQ+ support

**Mental Health:**
- Trevor Project: 1-866-488-7386 (LGBTQ+ youth)
- Trans Lifeline: 1-877-565-8860 (US)

Remember: You're here to educate, support, and connect - not to judge, prescribe, or replace professional help. 💜`;

/**
 * Initialize or get the Mistral AI Agent
 * Note: Agents must be created via Mistral console (https://console.mistral.ai)
 * or the environment variable MISTRAL_AGENT_ID can be set
 */
async function initializeAgent() {
  if (!mistral) return null;

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

      await ctx.editMessageText(
        t('supportTitle', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('chatWithCristina', lang), 'support_ai_chat')],
          [Markup.button.callback(t('contactAdmin', lang), 'support_contact_admin')],
          [Markup.button.callback(
            lang === 'es' ? '🎁 Solicitar Activación' : '🎁 Request Activation',
            'support_request_activation'
          )],
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

      const greeting = lang === 'es'
        ? '💬 **¡Hola! Soy PNPtv! AI**\n\n'
          + 'Estoy aquí para apoyarte con:\n'
          + '• Reducción de daños y uso seguro\n'
          + '• Salud sexual y mental\n'
          + '• Recursos comunitarios\n'
          + '• Información sobre la plataforma\n\n'
          + '_Escribe tu pregunta o inquietud. Escribe "exit" para salir._'
        : '💬 **Hi! I\'m PNPtv! AI**\n\n'
          + 'I\'m here to support you with:\n'
          + '• Harm reduction and safer use\n'
          + '• Sexual and mental health\n'
          + '• Community resources\n'
          + '• Platform information\n\n'
          + '_Type your question or concern. Type "exit" to exit._';

      await ctx.editMessageText(
        greeting,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_support')],
          ]),
        }
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
          lang === 'es' ? '🤔 Pensando...' : '🤔 Thinking...',
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
              `${aiResponse}\n\n_${exitMessage}_`,
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

        const supportGroupId = process.env.SUPPORT_GROUP_ID;

        if (!supportGroupId) {
          logger.error('Support group ID not configured');
          await ctx.reply(
            lang === 'es'
              ? 'Sistema de soporte no configurado. Por favor contacta con nosotros vía email.'
              : 'Support system not configured. Please contact us via email.',
          );
          ctx.session.temp.contactingAdmin = false;
          return;
        }

        // Get or create support topic for this user
        const userId = ctx.from.id.toString();
        let topic = await SupportTopicModel.getByUserId(userId);

        if (!topic) {
          // Create new topic for this user
          const user = await UserModel.getById(userId);
          const username = ctx.from.username || 'NoUsername';
          const firstName = ctx.from.first_name || 'User';
          const topicName = `👤 ${firstName} (@${username}) - ID: ${userId}`;

          try {
            // Create forum topic in support group
            const forumTopic = await ctx.telegram.createForumTopic(
              supportGroupId,
              topicName,
              {
                icon_custom_emoji_id: '5312536423851630001', // 💬 emoji (optional)
              },
            );

            // Save topic to database
            topic = await SupportTopicModel.create({
              userId,
              threadId: forumTopic.message_thread_id,
              threadName: topicName,
            });

            logger.info('Support topic created', {
              userId,
              threadId: topic.thread_id,
              topicName,
            });

            // Send welcome message to topic
            const welcomeMessage = lang === 'es'
              ? `🆕 **Nuevo ticket de soporte**\n\n`
                + `👤 Usuario: ${firstName} ${ctx.from.last_name || ''}\n`
                + `📧 Username: @${username}\n`
                + `🆔 Telegram ID: \`${userId}\`\n`
                + `🌍 Idioma: Español\n`
                + `⏰ Fecha: ${new Date().toLocaleString('es-ES')}\n\n`
                + `━━━━━━━━━━━━━━━━━━━━\n\n`
                + `📝 **Primer mensaje:**\n${message}\n\n`
                + `━━━━━━━━━━━━━━━━━━━━\n\n`
                + `💡 Responde en este topic para comunicarte con el usuario.`
              : `🆕 **New Support Ticket**\n\n`
                + `👤 User: ${firstName} ${ctx.from.last_name || ''}\n`
                + `📧 Username: @${username}\n`
                + `🆔 Telegram ID: \`${userId}\`\n`
                + `🌍 Language: English\n`
                + `⏰ Date: ${new Date().toLocaleString('en-US')}\n\n`
                + `━━━━━━━━━━━━━━━━━━━━\n\n`
                + `📝 **First message:**\n${message}\n\n`
                + `━━━━━━━━━━━━━━━━━━━━\n\n`
                + `💡 Reply in this topic to communicate with the user.`;

            await ctx.telegram.sendMessage(supportGroupId, welcomeMessage, {
              message_thread_id: topic.thread_id,
              parse_mode: 'Markdown',
            });
          } catch (topicError) {
            logger.error('Error creating forum topic:', topicError);
            await ctx.reply(
              lang === 'es'
                ? '❌ Error al crear el ticket de soporte. Por favor intenta de nuevo.'
                : '❌ Error creating support ticket. Please try again.',
            );
            ctx.session.temp.contactingAdmin = false;
            return;
          }
        } else {
          // Topic exists, send message to existing topic
          const firstName = ctx.from.first_name || 'User';
          const username = ctx.from.username || 'NoUsername';

          const formattedMessage = `👤 **${firstName}** (@${username}):\n\n${message}`;

          await ctx.telegram.sendMessage(supportGroupId, formattedMessage, {
            message_thread_id: topic.thread_id,
            parse_mode: 'Markdown',
          });

          // Update last message timestamp
          await SupportTopicModel.updateLastMessage(userId);

          logger.info('Message sent to existing support topic', {
            userId,
            threadId: topic.thread_id,
          });
        }

        ctx.session.temp.contactingAdmin = false;
        await ctx.saveSession();

        await ctx.reply(
          lang === 'es'
            ? '✅ Tu mensaje ha sido enviado al equipo de soporte. Te responderemos pronto por este chat.'
            : '✅ Your message has been sent to the support team. We will reply to you soon via this chat.',
          Markup.inlineKeyboard([
            [Markup.button.callback(t('back', lang), 'show_support')],
          ]),
        );
      } catch (error) {
        logger.error('Error contacting admin:', error);
      }
      return;
    }

    if (ctx.session.temp?.requestingActivation) {
      try {
        const lang = getLanguage(ctx);

        // Validate message text exists
        if (!ctx.message?.text) {
          logger.warn('Request activation received message without text');
          return next();
        }

        const message = ctx.message.text;

        // Exit request activation mode if user sends a command
        if (message.startsWith('/')) {
          ctx.session.temp.requestingActivation = false;
          await ctx.saveSession();
          return next();
        }

        // Send to admin users with special format for activation request
        const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter((id) => id.trim()) || [];

        if (adminIds.length === 0) {
          logger.error('No admin users configured for activation requests');
          await ctx.reply(
            lang === 'es'
              ? 'Sistema de soporte no configurado. Por favor contacta con nosotros vía email.'
              : 'Support system not configured. Please contact us via email.',
          );
          ctx.session.temp.requestingActivation = false;
          return;
        }

        const user = ctx.from;
        const activationRequest = lang === 'es'
          ? `🎁 **SOLICITUD DE ACTIVACIÓN DE MEMBRESÍA**\n\n`
            + `👤 Usuario: ${user.first_name} ${user.last_name || ''}\n`
            + `🆔 Telegram ID: ${user.id}\n`
            + `📧 Username: @${user.username || 'sin username'}\n\n`
            + `📝 **Información proporcionada:**\n\n${message}\n\n`
            + `⚡ Usa /admin → Activar Membresía para procesar manualmente.`
          : `🎁 **MEMBERSHIP ACTIVATION REQUEST**\n\n`
            + `👤 User: ${user.first_name} ${user.last_name || ''}\n`
            + `🆔 Telegram ID: ${user.id}\n`
            + `📧 Username: @${user.username || 'no username'}\n\n`
            + `📝 **Information provided:**\n\n${message}\n\n`
            + `⚡ Use /admin → Activate Membership to process manually.`;

        for (const adminId of adminIds) {
          try {
            await ctx.telegram.sendMessage(
              adminId.trim(),
              activationRequest,
              { parse_mode: 'Markdown' }
            );
          } catch (sendError) {
            logger.error('Error sending activation request to admin:', sendError);
          }
        }

        ctx.session.temp.requestingActivation = false;
        await ctx.saveSession();

        logger.info('Activation request sent to admins', {
          userId: user.id,
          username: user.username,
        });

        const successMessageEs = '✅ **Solicitud Enviada**\n\n'
          + 'Tu solicitud de activación ha sido enviada a los administradores.\n\n'
          + '📨 Recibirás una notificación cuando tu membresía sea activada.\n\n'
          + '⏱️ Tiempo estimado de respuesta: 1-24 horas.';

        const successMessageEn = '✅ **Request Sent**\n\n'
          + 'Your activation request has been sent to the administrators.\n\n'
          + '📨 You will receive a notification when your membership is activated.\n\n'
          + '⏱️ Estimated response time: 1-24 hours.';

        await ctx.reply(
          lang === 'es' ? successMessageEs : successMessageEn,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          },
        );
      } catch (error) {
        logger.error('Error processing activation request:', error);
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
          [Markup.button.callback(
            lang === 'es' ? '🎁 Solicitar Activación' : '🎁 Request Activation',
            'support_request_activation'
          )],
          [Markup.button.callback(t('faq', lang), 'support_faq')],
        ]),
      );
    } catch (error) {
      logger.error('Error in /support command:', error);
    }
  });

  // Cristina command - Direct AI chat
  bot.command('cristina', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Check if Mistral AI is available
      if (!mistral) {
        await ctx.reply(
          lang === 'es'
            ? '❌ El chat de IA no está disponible en este momento.'
            : '❌ AI chat is not available at the moment.',
        );
        return;
      }

      // Get text after command
      const commandText = ctx.message.text;
      const question = commandText.replace('/cristina', '').trim();

      // If no question, just greet
      if (!question) {
        const greeting = lang === 'es'
          ? '💬 ¡Hola papi! Soy PNPtv! AI\n\n'
            + 'Pregúntame lo que quieras sobre reducción de daños, salud sexual, recursos comunitarios, o lo que necesites.\n\n'
            + 'Ejemplo: `/cristina es bueno tomar entre semana?`'
          : '💬 Hi! I\'m PNPtv! AI\n\n'
            + 'Ask me anything about harm reduction, sexual health, community resources, or whatever you need.\n\n'
            + 'Example: `/cristina is it ok to party during the week?`';

        await ctx.reply(greeting, { parse_mode: 'Markdown' });
        return;
      }

      // Show thinking indicator
      const thinkingMsg = await ctx.reply(
        lang === 'es' ? '🤔 Pensando...' : '🤔 Thinking...',
      );

      // Ensure agent is initialized
      if (AGENT_ID === null && mistral) {
        await initializeAgent();
      }

      // Prepare language prompt
      const languagePrompt = lang === 'es'
        ? 'Responde en español con tono cercano y empático.'
        : 'Respond in English with a warm and empathetic tone.';

      let aiResponse;

      try {
        // Use Agents API if configured, otherwise Chat Completions
        if (AGENT_ID) {
          const completion = await mistral.agents.complete({
            agentId: AGENT_ID,
            messages: [
              {
                role: 'user',
                content: `${languagePrompt}\n\n${question}`,
              },
            ],
          });

          aiResponse = completion.choices?.[0]?.message?.content ||
                      completion.message?.content ||
                      (lang === 'es'
                        ? 'Disculpa, no pude procesar tu pregunta. Intenta de nuevo.'
                        : 'Sorry, I couldn\'t process your question. Try again.');
        } else {
          const completion = await mistral.chat.complete({
            model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
            messages: [
              {
                role: 'system',
                content: AGENT_INSTRUCTIONS + `\n\n${languagePrompt}`,
              },
              {
                role: 'user',
                content: question,
              },
            ],
            maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || '500', 10),
            temperature: 0.7,
          });

          aiResponse = completion.choices[0].message.content;
        }

        // Delete thinking message
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        } catch (e) {
          // Ignore
        }

        // Send response
        await ctx.reply(aiResponse, { parse_mode: 'Markdown' });

      } catch (aiError) {
        logger.error('Mistral AI error in /cristina:', aiError);

        // Delete thinking message
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        } catch (e) {
          // Ignore
        }

        await ctx.reply(
          lang === 'es'
            ? '❌ Lo siento, encontré un error. Por favor intenta de nuevo.'
            : '❌ Sorry, I encountered an error. Please try again.',
        );
      }
    } catch (error) {
      logger.error('Error in /cristina command:', error);
    }
  });

  // Request membership activation
  bot.action('support_request_activation', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.requestingActivation = true;
      await ctx.saveSession();

      const messageEs = '🎁 **Solicitar Activación de Membresía**\n\n'
        + 'Si compraste tu membresía fuera del bot o tu pago no se activó automáticamente, '
        + 'por favor envía la siguiente información:\n\n'
        + '📝 **Datos necesarios:**\n'
        + '• Método de pago usado (ePayco, Daimo, etc.)\n'
        + '• ID de transacción o comprobante\n'
        + '• Plan comprado\n'
        + '• Tu email (si lo usaste)\n'
        + '• Cualquier detalle adicional\n\n'
        + '💡 Un administrador revisará tu solicitud y activará tu membresía manualmente.\n\n'
        + '_Escribe toda la información en un solo mensaje._';

      const messageEn = '🎁 **Request Membership Activation**\n\n'
        + 'If you purchased your membership outside the bot or your payment wasn\'t activated automatically, '
        + 'please send the following information:\n\n'
        + '📝 **Required information:**\n'
        + '• Payment method used (ePayco, Daimo, etc.)\n'
        + '• Transaction ID or receipt\n'
        + '• Plan purchased\n'
        + '• Your email (if you used one)\n'
        + '• Any additional details\n\n'
        + '💡 An administrator will review your request and activate your membership manually.\n\n'
        + '_Write all the information in a single message._';

      await ctx.editMessageText(
        lang === 'es' ? messageEs : messageEn,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t('cancel', lang), 'show_support')],
          ]),
        },
      );
    } catch (error) {
      logger.error('Error in request activation:', error);
    }
  });

  /**
   * Listen for replies from support group
   * Forward support team messages back to users
   */
  bot.on('message', async (ctx, next) => {
    try {
      const supportGroupId = process.env.SUPPORT_GROUP_ID;

      // Only process messages from the support group
      if (!supportGroupId || ctx.chat.id.toString() !== supportGroupId) {
        return next();
      }

      // Only process messages in forum topics (not general messages)
      if (!ctx.message.message_thread_id) {
        return next();
      }

      // Skip messages from the bot itself
      if (ctx.from.is_bot) {
        return next();
      }

      // Get the topic from database
      const topic = await SupportTopicModel.getByThreadId(ctx.message.message_thread_id);

      if (!topic) {
        logger.warn('Message in unknown support topic', {
          threadId: ctx.message.message_thread_id,
        });
        return next();
      }

      // Forward message to user
      const userId = topic.user_id;
      const supporterName = ctx.from.first_name || 'Support Team';
      const messageText = ctx.message.text;

      if (!messageText) {
        logger.warn('Non-text message in support topic, skipping forward');
        return next();
      }

      // Format message with support team branding
      const formattedMessage = `💬 **Soporte Técnico** (${supporterName}):\n\n${messageText}`;

      try {
        await ctx.telegram.sendMessage(userId, formattedMessage, {
          parse_mode: 'Markdown',
        });

        // React to message in group to show it was sent
        try {
          await ctx.react('✅');
        } catch (reactError) {
          // Reactions might not be available, ignore
          logger.debug('Could not react to message:', reactError.message);
        }

        logger.info('Support reply forwarded to user', {
          userId,
          threadId: topic.thread_id,
          supporterName,
        });
      } catch (sendError) {
        logger.error('Error forwarding message to user:', {
          userId,
          error: sendError.message,
        });

        // Notify in group that message couldn't be delivered
        await ctx.reply(
          `❌ No se pudo enviar el mensaje al usuario. El usuario puede haber bloqueado el bot o eliminado la conversación.`,
          {
            message_thread_id: ctx.message.message_thread_id,
          },
        );
      }
    } catch (error) {
      logger.error('Error processing support group message:', error);
      return next();
    }
  });

  /**
   * Command to close support ticket (admin only, in support group)
   */
  bot.command('cerrar', async (ctx) => {
    try {
      const supportGroupId = process.env.SUPPORT_GROUP_ID;

      // Only works in support group
      if (!supportGroupId || ctx.chat.id.toString() !== supportGroupId) {
        return;
      }

      // Only in forum topics
      if (!ctx.message.message_thread_id) {
        return;
      }

      const topic = await SupportTopicModel.getByThreadId(ctx.message.message_thread_id);

      if (!topic) {
        await ctx.reply('❌ Topic no encontrado en la base de datos.');
        return;
      }

      // Update topic status to closed
      await SupportTopicModel.updateStatus(topic.user_id, 'closed');

      // Close the forum topic
      try {
        await ctx.telegram.closeForumTopic(supportGroupId, ctx.message.message_thread_id);
      } catch (closeError) {
        logger.warn('Could not close forum topic:', closeError.message);
      }

      await ctx.reply(
        `✅ Ticket cerrado.\n\n`
        + `Usuario: ${topic.thread_name}\n`
        + `Total de mensajes: ${topic.message_count}`,
        {
          message_thread_id: ctx.message.message_thread_id,
        },
      );

      // Notify user
      await ctx.telegram.sendMessage(
        topic.user_id,
        '✅ Tu ticket de soporte ha sido cerrado. Si necesitas ayuda adicional, puedes contactar a soporte nuevamente.',
      );

      logger.info('Support ticket closed', {
        userId: topic.user_id,
        threadId: topic.thread_id,
      });
    } catch (error) {
      logger.error('Error closing support ticket:', error);
    }
  });

  /**
   * Command to reopen support ticket (admin only, in support group)
   */
  bot.command('reabrir', async (ctx) => {
    try {
      const supportGroupId = process.env.SUPPORT_GROUP_ID;

      // Only works in support group
      if (!supportGroupId || ctx.chat.id.toString() !== supportGroupId) {
        return;
      }

      // Only in forum topics
      if (!ctx.message.message_thread_id) {
        return;
      }

      const topic = await SupportTopicModel.getByThreadId(ctx.message.message_thread_id);

      if (!topic) {
        await ctx.reply('❌ Topic no encontrado en la base de datos.');
        return;
      }

      // Update topic status to open
      await SupportTopicModel.updateStatus(topic.user_id, 'open');

      // Reopen the forum topic
      try {
        await ctx.telegram.reopenForumTopic(supportGroupId, ctx.message.message_thread_id);
      } catch (reopenError) {
        logger.warn('Could not reopen forum topic:', reopenError.message);
      }

      await ctx.reply(
        `✅ Ticket reabierto.\n\n`
        + `Usuario: ${topic.thread_name}`,
        {
          message_thread_id: ctx.message.message_thread_id,
        },
      );

      logger.info('Support ticket reopened', {
        userId: topic.user_id,
        threadId: topic.thread_id,
      });
    } catch (error) {
      logger.error('Error reopening support ticket:', error);
    }
  });
};

module.exports = registerSupportHandlers;
