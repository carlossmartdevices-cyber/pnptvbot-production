/**
 * Cristina AI Support Agent
 * Provides AI-powered support and assistance using Mistral AI
 */

const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const { detectLanguage } = require('../../../utils/languageDetector');

// Mistral AI integration
let mistral = null;
let AGENT_ID = null;

try {
  const { Mistral } = require('@mistralai/mistralai');
  if (process.env.MISTRAL_API_KEY) {
    mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    AGENT_ID = process.env.MISTRAL_AGENT_ID || null;
    logger.info('Cristina AI: Mistral AI initialized');
  }
} catch (error) {
  logger.warn('Cristina AI: Mistral AI package not installed, using keyword fallback');
}

// Agent instructions for Mistral
const AGENT_INSTRUCTIONS = `You are Cristina, the PNPtv Customer Support AI Assistant - a professional, helpful, and friendly support chatbot.

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
- Respond in the user's language
- Use emojis sparingly for clarity
- Keep responses under 300 words

🔑 KEY INFORMATION
**Membership Plans:**
- Basic ($9.99/month): Access to radio, Basic Zoom rooms, Profile customization
- Premium ($19.99/month): Everything in Basic + Unlimited Zoom rooms, Live streaming, Priority support
- Gold ($29.99/month): Everything in Premium + Advanced analytics, Custom branding, API access

**Commands:** /menu (main menu), /support (help), /cristina (AI assistant)
**Support Email:** support@pnptv.app

🚫 LIMITATIONS
- Do not provide explicit content or medical advice
- Do not share private user information
- Direct complex issues to /support for human assistance`;

// Store active conversations
const activeConversations = new Map();

/**
 * Get user's language preference
 */
async function getUserLanguage(ctx) {
  const detectedLang = await detectLanguage(ctx);
  return detectedLang || ctx.from?.language_code || 'en';
}

/**
 * Handle /cristina command
 */
async function handleCristinaCommand(ctx) {
  try {
    const lang = await getUserLanguage(ctx);
    const userId = ctx.from.id;

    // Check if this is a question or just starting the conversation
    const commandText = ctx.message.text;
    const question = commandText.replace('/cristina', '').trim();

    if (!question) {
      // Just the command without a question - show introduction
      const introMessage = lang === 'es'
        ? `🤖 *Hola! Soy Cristina, tu asistente de IA*

Estoy aquí para ayudarte con cualquier pregunta o problema que tengas.

*Cómo usarme:*
📝 Simplemente escribe: \`/cristina tu pregunta aquí\`

*Ejemplos:*
• \`/cristina ¿Cómo puedo renovar mi suscripción?\`
• \`/cristina ¿Cuándo es la próxima transmisión en vivo?\`
• \`/cristina Necesito ayuda con mi perfil\`

También puedes usar los botones de abajo para acceso rápido a temas comunes.`
        : `🤖 *Hi! I'm Cristina, your AI assistant*

I'm here to help you with any questions or issues you have.

*How to use me:*
📝 Simply type: \`/cristina your question here\`

*Examples:*
• \`/cristina How do I renew my subscription?\`
• \`/cristina When is the next live stream?\`
• \`/cristina I need help with my profile\`

You can also use the buttons below for quick access to common topics.`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            lang === 'es' ? '📱 Suscripción' : '📱 Subscription',
            'cristina:subscription'
          ),
          Markup.button.callback(
            lang === 'es' ? '🎬 Contenido' : '🎬 Content',
            'cristina:content'
          )
        ],
        [
          Markup.button.callback(
            lang === 'es' ? '💳 Pagos' : '💳 Payments',
            'cristina:payments'
          ),
          Markup.button.callback(
            lang === 'es' ? '⚙️ Configuración' : '⚙️ Settings',
            'cristina:settings'
          )
        ],
        [
          Markup.button.callback(
            lang === 'es' ? '🆘 Soporte Técnico' : '🆘 Technical Support',
            'cristina:technical'
          )
        ]
      ]);

      await ctx.reply(introMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });

      // Mark conversation as active
      activeConversations.set(userId, {
        startedAt: Date.now(),
        lang,
        messagesCount: 0
      });

      logger.info(`Cristina AI conversation started for user ${userId}`);
      return;
    }

    // User asked a question
    const response = await processQuestion(question, lang, userId);

    await ctx.reply(response, {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });

    // Update conversation stats
    const conversation = activeConversations.get(userId) || {
      startedAt: Date.now(),
      lang,
      messagesCount: 0
    };
    conversation.messagesCount++;
    activeConversations.set(userId, conversation);

    logger.info(`Cristina AI processed question for user ${userId}: ${question.substring(0, 50)}`);

  } catch (error) {
    logger.error('Error handling Cristina command:', error);
    const lang = await getUserLanguage(ctx);
    await ctx.reply(
      lang === 'es'
        ? '❌ Lo siento, tuve un problema procesando tu solicitud. Por favor, intenta de nuevo.'
        : '❌ Sorry, I had trouble processing your request. Please try again.'
    );
  }
}

/**
 * Handle Cristina callback queries (button clicks)
 */
async function handleCristinaCallback(ctx) {
  try {
    const callbackData = ctx.callbackQuery?.data || '';
    const lang = await getUserLanguage(ctx);

    // Acknowledge the callback
    await ctx.answerCbQuery();

    // Parse callback data
    const [prefix, topic] = callbackData.split(':');

    if (prefix !== 'cristina') {
      return;
    }

    let response = '';

    switch (topic) {
      case 'subscription':
        response = lang === 'es'
          ? `📱 *Ayuda con Suscripción*

¿En qué puedo ayudarte con tu suscripción?

*Temas comunes:*
• Cómo suscribirse
• Estado de suscripción
• Renovación
• Cancelación

Escribe tu pregunta usando: \`/cristina tu pregunta\``
          : `📱 *Subscription Help*

How can I help you with your subscription?

*Common topics:*
• How to subscribe
• Subscription status
• Renewal
• Cancellation

Type your question using: \`/cristina your question\``;
        break;

      case 'content':
        response = lang === 'es'
          ? `🎬 *Ayuda con Contenido*

¿Qué tipo de contenido te interesa?

*Disponible:*
• Transmisiones en vivo
• Videollamadas
• Fotos exclusivas
• Videos exclusivos
• Podcasts

Escribe tu pregunta usando: \`/cristina tu pregunta\``
          : `🎬 *Content Help*

What type of content are you interested in?

*Available:*
• Live streams
• Video calls
• Exclusive photos
• Exclusive videos
• Podcasts

Type your question using: \`/cristina your question\``;
        break;

      case 'payments':
        response = lang === 'es'
          ? `💳 *Ayuda con Pagos*

¿Necesitas ayuda con pagos?

*Temas comunes:*
• Métodos de pago aceptados
• Problemas con pagos
• Reembolsos
• Facturación

Escribe tu pregunta usando: \`/cristina tu pregunta\``
          : `💳 *Payment Help*

Need help with payments?

*Common topics:*
• Accepted payment methods
• Payment issues
• Refunds
• Billing

Type your question using: \`/cristina your question\``;
        break;

      case 'settings':
        response = lang === 'es'
          ? `⚙️ *Ayuda con Configuración*

¿Qué configuración necesitas ajustar?

*Opciones disponibles:*
• Perfil
• Notificaciones
• Idioma
• Privacidad

Escribe tu pregunta usando: \`/cristina tu pregunta\``
          : `⚙️ *Settings Help*

What settings do you need to adjust?

*Available options:*
• Profile
• Notifications
• Language
• Privacy

Type your question using: \`/cristina your question\``;
        break;

      case 'technical':
        response = lang === 'es'
          ? `🆘 *Soporte Técnico*

¿Tienes algún problema técnico?

*Problemas comunes:*
• No puedo acceder al grupo
• Los mensajes no se envían
• Problemas con multimedia
• Otros problemas

Escribe tu pregunta usando: \`/cristina tu pregunta\`

Si el problema persiste, usa /support para contactar a un humano.`
          : `🆘 *Technical Support*

Having a technical issue?

*Common issues:*
• Can't access the group
• Messages not sending
• Multimedia problems
• Other issues

Type your question using: \`/cristina your question\`

If the issue persists, use /support to contact a human.`;
        break;

      default:
        response = lang === 'es'
          ? '🤖 ¿En qué puedo ayudarte?'
          : '🤖 How can I help you?';
    }

    await ctx.editMessageText(response, {
      parse_mode: 'Markdown'
    });

    logger.info(`Cristina AI callback handled: ${topic} for user ${ctx.from.id}`);

  } catch (error) {
    logger.error('Error handling Cristina callback:', error);
    try {
      await ctx.answerCbQuery('Error processing request');
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Process a question and generate a response using Mistral AI or keyword fallback
 */
async function processQuestion(question, lang, userId) {
  // Try Mistral AI first
  if (mistral) {
    try {
      const languagePrompt = lang === 'es' ? 'Responde en español.' : 'Respond in English.';

      let aiResponse;
      if (AGENT_ID) {
        // Use Agents API
        const completion = await mistral.agents.complete({
          agentId: AGENT_ID,
          messages: [{ role: 'user', content: `${languagePrompt}\n\n${question}` }],
        });
        aiResponse = completion.choices?.[0]?.message?.content || completion.message?.content;
      } else {
        // Use Chat Completions API
        const completion = await mistral.chat.complete({
          model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
          messages: [
            { role: 'system', content: `${AGENT_INSTRUCTIONS}\n\n${languagePrompt}` },
            { role: 'user', content: question },
          ],
          maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || '500', 10),
          temperature: 0.7,
        });
        aiResponse = completion.choices[0].message.content;
      }

      if (aiResponse) {
        logger.info(`Cristina AI: Mistral response generated for user ${userId}`);
        return aiResponse;
      }
    } catch (aiError) {
      logger.error('Cristina AI: Mistral error, falling back to keywords:', aiError.message);
    }
  }

  // Fallback to keyword-based responses
  const questionLower = question.toLowerCase();

  // Subscription-related questions
  if (questionLower.includes('subscri') || questionLower.includes('suscri')) {
    return lang === 'es'
      ? `📱 *Sobre Suscripción*

Para suscribirte, usa el comando /menu y selecciona "Suscripción".

Tu suscripción te da acceso a:
• Contenido exclusivo
• Transmisiones en vivo
• Videollamadas
• Grupo privado

¿Necesitas más información sobre algo específico?`
      : `📱 *About Subscription*

To subscribe, use the /menu command and select "Subscription".

Your subscription gives you access to:
• Exclusive content
• Live streams
• Video calls
• Private group

Need more information about something specific?`;
  }

  // Payment-related questions
  if (questionLower.includes('pay') || questionLower.includes('pag') || questionLower.includes('price') || questionLower.includes('precio')) {
    return lang === 'es'
      ? `💳 *Información de Pagos*

Aceptamos varios métodos de pago seguros.

Para ver métodos de pago y precios, usa:
/menu → Suscripción → Métodos de Pago

¿Tienes alguna pregunta específica sobre pagos?`
      : `💳 *Payment Information*

We accept various secure payment methods.

To view payment methods and prices, use:
/menu → Subscription → Payment Methods

Do you have any specific questions about payments?`;
  }

  // Live stream questions
  if (questionLower.includes('live') || questionLower.includes('stream') || questionLower.includes('vivo')) {
    return lang === 'es'
      ? `🔴 *Transmisiones en Vivo*

Las transmisiones en vivo son exclusivas para suscriptores.

Para acceder:
/menu → Contenido → Transmisiones en Vivo

Te notificaremos cuando comience una nueva transmisión.

¿Quieres saber más sobre el horario?`
      : `🔴 *Live Streams*

Live streams are exclusive to subscribers.

To access:
/menu → Content → Live Streams

We'll notify you when a new stream starts.

Want to know more about the schedule?`;
  }

  // Video call questions
  if (questionLower.includes('video call') || questionLower.includes('videollamada') || questionLower.includes('video chat')) {
    return lang === 'es'
      ? `📹 *Videollamadas*

Las videollamadas son un beneficio premium para suscriptores.

Para programar una videollamada:
/menu → Contenido → Videollamadas

¿Necesitas ayuda para programar una?`
      : `📹 *Video Calls*

Video calls are a premium benefit for subscribers.

To schedule a video call:
/menu → Content → Video Calls

Need help scheduling one?`;
  }

  // Group access questions
  if (questionLower.includes('group') || questionLower.includes('grupo') || questionLower.includes('join') || questionLower.includes('unir')) {
    return lang === 'es'
      ? `👥 *Acceso al Grupo*

Para unirte al grupo exclusivo:

1. Asegúrate de tener una suscripción activa
2. Usa /menu → Comunidad → Unirse al Grupo
3. Haz clic en el enlace de invitación

¿Tienes problemas para acceder?`
      : `👥 *Group Access*

To join the exclusive group:

1. Make sure you have an active subscription
2. Use /menu → Community → Join Group
3. Click the invitation link

Having trouble accessing?`;
  }

  // Rules questions
  if (questionLower.includes('rule') || questionLower.includes('regla')) {
    return lang === 'es'
      ? `📜 *Reglas de la Comunidad*

Para ver las reglas completas, usa:
/rules

Es importante seguir las reglas para mantener una comunidad positiva.

¿Tienes alguna pregunta sobre una regla específica?`
      : `📜 *Community Rules*

To view the complete rules, use:
/rules

It's important to follow the rules to maintain a positive community.

Do you have any questions about a specific rule?`;
  }

  // Profile/settings questions
  if (questionLower.includes('profile') || questionLower.includes('perfil') || questionLower.includes('setting') || questionLower.includes('config')) {
    return lang === 'es'
      ? `⚙️ *Perfil y Configuración*

Para administrar tu perfil y configuración:
/menu → Configuración

Puedes ajustar:
• Tu perfil
• Notificaciones
• Idioma
• Privacidad

¿Necesitas ayuda con algo específico?`
      : `⚙️ *Profile and Settings*

To manage your profile and settings:
/menu → Settings

You can adjust:
• Your profile
• Notifications
• Language
• Privacy

Need help with something specific?`;
  }

  // Help/support questions
  if (questionLower.includes('help') || questionLower.includes('ayuda') || questionLower.includes('support') || questionLower.includes('soporte')) {
    return lang === 'es'
      ? `🆘 *Ayuda y Soporte*

Estoy aquí para ayudarte! Puedes:

• Hacer cualquier pregunta con /cristina
• Ver el menú principal con /menu
• Ver preguntas frecuentes con /menu → Soporte → FAQ
• Contactar soporte humano con /support

¿En qué más puedo ayudarte?`
      : `🆘 *Help and Support*

I'm here to help! You can:

• Ask any question with /cristina
• View the main menu with /menu
• View FAQ with /menu → Support → FAQ
• Contact human support with /support

What else can I help you with?`;
  }

  // Default response for unrecognized questions
  return lang === 'es'
    ? `🤖 *Cristina AI*

Entiendo tu pregunta: "${question}"

Estoy trabajando en mejorar mis respuestas. Mientras tanto, puedes:

• Explorar el menú: /menu
• Ver preguntas frecuentes: /menu → Soporte → FAQ
• Contactar soporte: /support

O intenta reformular tu pregunta de manera más específica.

*Temas que entiendo bien:*
• Suscripciones
• Pagos
• Transmisiones en vivo
• Videollamadas
• Acceso al grupo
• Reglas de la comunidad
• Configuración`
    : `🤖 *Cristina AI*

I understand your question: "${question}"

I'm working on improving my responses. In the meantime, you can:

• Explore the menu: /menu
• View FAQ: /menu → Support → FAQ
• Contact support: /support

Or try rephrasing your question more specifically.

*Topics I understand well:*
• Subscriptions
• Payments
• Live streams
• Video calls
• Group access
• Community rules
• Settings`;
}

/**
 * Clean up old conversations (called periodically)
 */
function cleanupOldConversations() {
  const maxAge = 60 * 60 * 1000; // 1 hour
  const now = Date.now();

  for (const [userId, conversation] of activeConversations.entries()) {
    if (now - conversation.startedAt > maxAge) {
      activeConversations.delete(userId);
    }
  }
}

// Clean up every 30 minutes
setInterval(cleanupOldConversations, 30 * 60 * 1000);

module.exports = {
  handleCristinaCommand,
  handleCristinaCallback
};
