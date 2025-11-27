const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const SupportTopicModel = require('../../../models/supportTopicModel');
const UserModel = require('../../../models/userModel');
const ChatCleanupService = require('../../services/chatCleanupService');

// Mistral AI integration
let mistral = null;

try {
  const { Mistral } = require('@mistralai/mistralai');
  if (process.env.MISTRAL_API_KEY) {
    mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });
    logger.info('Mistral AI initialized successfully');
  }
} catch (error) {
  logger.warn('Mistral AI package not installed. AI chat will be unavailable.');
}

// Rate limiting map: userId -> lastMessageTime
const messageTimestamps = new Map();
const RATE_LIMIT_MS = 3000; // 3 seconds between messages

// Support topic map: odId -> topicId (for forum groups)
const userTopicMap = new Map();

/**
 * Cristina's instructions - PNPtv Community Assistant
 */
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

/**
 * Call Mistral AI using the Conversations API
 */
async function callMistralAI(messages, lang = 'es') {
  if (!mistral) {
    throw new Error('Mistral AI not initialized');
  }

  const languagePrompt = lang === 'es'
    ? 'Responde en español con tono cercano y empático. Sé BREVE, máximo 2-3 oraciones.'
    : 'Respond in English with a warm and empathetic tone. Be BRIEF, max 2-3 sentences.';

  try {
    const response = await mistral.beta.conversations.start({
      inputs: messages,
      model: process.env.MISTRAL_MODEL || 'mistral-small-2409',
      instructions: CRISTINA_INSTRUCTIONS + `\n\n${languagePrompt}`,
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
    });

    logger.info('Mistral API response structure:', { 
      hasChoices: !!response.choices,
      hasMessage: !!response.message,
      hasContent: !!response.content,
      responseKeys: Object.keys(response || {})
    });

    // Handle different response structures
    // Conversations API returns outputs array
    const content = response.outputs?.[0]?.content ||
                   response.choices?.[0]?.message?.content ||
                   response.message?.content ||
                   response.content ||
                   response;

    if (typeof content === 'string' && content.length > 0) {
      return content;
    }

    logger.warn('Unexpected Mistral response format:', response);
    return lang === 'es'
      ? 'Disculpa, no pude procesar tu solicitud. Por favor intenta de nuevo.'
      : 'I apologize, but I couldn\'t process your request. Please try again.';
  } catch (error) {
    logger.error('Mistral AI API error:', error);
    logger.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body
    });
    throw error;
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
        '```\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
        '       🆘 Help Center     \n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
        '```\n\n' +
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
          '```\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
          '       ❌ Unavailable     \n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
          '```\n\n' +
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

      // Reset chat session counters
      ctx.session.temp.aiChatHistory = [];
      ctx.session.temp.aiQuestionCount = 0; // Track questions asked
      await ctx.saveSession();

      await ctx.answerCbQuery();

      const greeting = 
        '```\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
        '   🤖 Cristina AI Chat    \n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
        '```\n\n' +
        '**Hey! I\'m Cristina** 💜\n\n' +
        'I\'m here to help you with:\n' +
        '• 🛡️ Harm reduction & safer use\n' +
        '• 💗 Sexual & mental health\n' +
        '• 🏠 Community resources\n' +
        '• 📱 Platform help\n\n' +
        '```\n' +
        '┌─────────────────────────┐\n' +
        '│  Just type your message │\n' +
        '│  and I\'ll respond! 💬  │\n' +
        '└─────────────────────────┘\n' +
        '```\n\n' +
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
        '```\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
        '         ❓ FAQ           \n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
        '```\n\n' +
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
        '```\n' +
        '┌─────────────────────────┐\n' +
        '│  Still need help? 💬   │\n' +
        '│  Chat with Cristina!   │\n' +
        '└─────────────────────────┘\n' +
        '```';

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

  // Handle text messages - AI chat is now automatic for all messages
  bot.on('text', async (ctx, next) => {
    // Skip commands - let them be handled by command handlers
    if (ctx.message?.text?.startsWith('/')) {
      return next();
    }

    // AUTO AI CHAT: Process all non-command messages through AI
    // Special modes (contactingAdmin, requestingActivation) are handled after this block
    if (!ctx.session.temp?.contactingAdmin && !ctx.session.temp?.requestingActivation) {
      try {
        const lang = getLanguage(ctx);
        const userId = ctx.from.id;

        // Validate message text exists
        if (!ctx.message?.text) {
          logger.warn('AI chat received message without text');
          return next();
        }

        const userMessage = ctx.message.text;

        // Allow users to exit AI chat with "exit" or "/exit"
        if (userMessage.toLowerCase() === 'exit' || userMessage.toLowerCase() === '/exit') {
          ctx.session.temp.aiChatHistory = null;
          ctx.session.temp.aiQuestionCount = 0;
          await ctx.saveSession();

          await ctx.reply(
            lang === 'es'
              ? '💬 Chat finalizado. Usa /support si necesitas más ayuda.'
              : '💬 Chat ended. Use /support if you need more help.',
            Markup.inlineKeyboard([
              [Markup.button.callback(t('back', lang), 'show_support')],
            ]),
          );
          return;
        }

        // Check question limit (5 questions max)
        const questionCount = ctx.session.temp.aiQuestionCount || 0;

        if (questionCount >= 5) {
          // Reset counters after reaching limit
          ctx.session.temp.aiChatHistory = null;
          ctx.session.temp.aiQuestionCount = 0;
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
            // Initialize chat history if not exists
            if (!ctx.session.temp.aiChatHistory) {
              ctx.session.temp.aiChatHistory = [];
            }

            // Add user message to history
            ctx.session.temp.aiChatHistory.push({
              role: 'user',
              content: userMessage,
            });

            // Keep only last 10 messages to manage token usage
            if (ctx.session.temp.aiChatHistory.length > 10) {
              ctx.session.temp.aiChatHistory = ctx.session.temp.aiChatHistory.slice(-10);
            }

            // Call Mistral AI using Conversations API
            const aiResponse = await callMistralAI(ctx.session.temp.aiChatHistory, lang);

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

            // Increment question count
            ctx.session.temp.aiQuestionCount = (ctx.session.temp.aiQuestionCount || 0) + 1;
            await ctx.saveSession();

            // Send AI response with appropriate footer
            const questionsRemaining = 5 - ctx.session.temp.aiQuestionCount;
            let footer;

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

            const sentMessage = await ctx.reply(
              `${aiResponse}${footer}`,
              { parse_mode: 'Markdown' }
            );

            // Mark Cristina's response as permanent (won't be deleted)
            if (sentMessage && sentMessage.message_id) {
              ChatCleanupService.markAsPermanent(ctx.chat.id, sentMessage.message_id);
            }
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

  // Handle replies from support group to users
  bot.on('text', async (ctx, next) => {
    const supportGroupId = process.env.SUPPORT_GROUP_ID;

    // Check if this is a message in the support group (topic or reply)
    if (supportGroupId &&
        ctx.chat?.id?.toString() === supportGroupId.toString()) {

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

      // If no question, just greet and reset counter
      if (!question) {
        ctx.session.temp.cristinaQuestionCount = 0;
        await ctx.saveSession();

        const greeting = lang === 'es'
          ? '💬 ¡Hola papi! Soy Cristina\n\n'
            + 'Pregúntame lo que quieras sobre reducción de daños, salud sexual, recursos comunitarios, o lo que necesites.\n\n'
            + 'Puedes hacerme hasta 5 preguntas. Después de eso, te conectaré con una persona real.\n\n'
            + 'Ejemplo: `/cristina es bueno tomar entre semana?`'
          : '💬 Hi! I\'m Cristina\n\n'
            + 'Ask me anything about harm reduction, sexual health, community resources, or whatever you need.\n\n'
            + 'You can ask me up to 5 questions. After that, I\'ll connect you with a real person.\n\n'
            + 'Example: `/cristina is it ok to party during the week?`';

        await ctx.reply(greeting, { parse_mode: 'Markdown' });
        return;
      }

      // Check question limit
      const questionCount = ctx.session.temp.cristinaQuestionCount || 0;

      if (questionCount >= 5) {
        const limitMessage = lang === 'es'
          ? '💬 Has alcanzado el límite de preguntas con Cristina (5 preguntas).\n\n'
            + 'Para continuar con tu consulta, por favor usa /support y selecciona "Contactar Admin" para hablar con una persona real.'
          : '💬 You\'ve reached the question limit with Cristina (5 questions).\n\n'
            + 'To continue with your inquiry, please use /support and select "Contact Admin" to talk with a real person.';

        await ctx.reply(limitMessage);
        return;
      }

      // Show thinking indicator
      const thinkingMsg = await ctx.reply(
        lang === 'es' ? '🤔 Pensando...' : '🤔 Thinking...',
      );

      let aiResponse;

      try {
        // Call Mistral AI using Conversations API
        const messages = [{ role: 'user', content: question }];
        aiResponse = await callMistralAI(messages, lang);

        // Delete thinking message
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        } catch (e) {
          // Ignore
        }

        // Increment question count
        ctx.session.temp.cristinaQuestionCount = (ctx.session.temp.cristinaQuestionCount || 0) + 1;
        await ctx.saveSession();

        // Send response with question counter
        const questionsRemaining = 5 - ctx.session.temp.cristinaQuestionCount;
        let footer;

        if (questionsRemaining === 0) {
          footer = lang === 'es'
            ? '\n\n_Esta fue tu última pregunta. Para más ayuda, usa /support → Contactar Admin._'
            : '\n\n_This was your last question. For more help, use /support → Contact Admin._';
        } else if (questionsRemaining === 1) {
          footer = lang === 'es'
            ? '\n\n_Te queda 1 pregunta más._'
            : '\n\n_You have 1 question left._';
        } else {
          footer = lang === 'es'
            ? `\n\n_Te quedan ${questionsRemaining} preguntas._`
            : `\n\n_You have ${questionsRemaining} questions left._`;
        }

        const sentMessage = await ctx.reply(
          `${aiResponse}${footer}`,
          { parse_mode: 'Markdown' }
        );

        // Mark Cristina's response as permanent (won't be deleted)
        if (sentMessage && sentMessage.message_id) {
          ChatCleanupService.markAsPermanent(ctx.chat.id, sentMessage.message_id);
        }

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
