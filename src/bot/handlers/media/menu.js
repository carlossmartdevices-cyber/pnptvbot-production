const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const UserService = require('../../services/userService');
const PermissionService = require('../../services/permissionService');

/**
 * Store the last menu message ID per user per chat
 * Format: { chatId: { userId: messageId } }
 */
const lastMenuMessages = {};

/**
 * Helper function to delete previous menu message
 */
async function deletePreviousMenuMessage(ctx) {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    // Initialize chat storage if needed
    if (!lastMenuMessages[chatId]) {
      lastMenuMessages[chatId] = {};
    }

    // Delete previous menu message if it exists
    if (lastMenuMessages[chatId][userId]) {
      try {
        await ctx.telegram.deleteMessage(chatId, lastMenuMessages[chatId][userId]);
        logger.debug(`Deleted previous menu message for user ${userId} in chat ${chatId}`);
      } catch (error) {
        // Message may have already been deleted, ignore
      }
    }
  } catch (error) {
    logger.error('Error deleting previous menu message:', error);
  }
}

/**
 * Helper function to store new menu message ID
 */
function storeMenuMessage(ctx, messageId) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  if (!lastMenuMessages[chatId]) {
    lastMenuMessages[chatId] = {};
  }

  lastMenuMessages[chatId][userId] = messageId;
}

/**
 * Main Menu Handler - Displays all PNPtv features and options
 * Can be used in groups and private chats
 * @param {Telegraf} bot - Bot instance
 */
function buildGroupMenuPayload(ctx) {
  const lang = getLanguage(ctx);
  const botUsername = ctx.botInfo?.username || process.env.BOT_USERNAME || 'pnptv_bot';
  const displayName = ctx.from?.first_name || ctx.from?.username || 'User';
  const jitsiUrl = `https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

  const text = lang === 'es'
    ? `📱 *Menú PNPtv*\n\nSelecciona una opción:`
    : `📱 *PNPtv Menu*\n\nChoose an option:`;

  const buttons = [
    [Markup.button.callback(
      lang === 'es' ? '💎 Planes PRIME' : '💎 PRIME Membership Plans',
      'show_subscription_plans'
    )],
    [Markup.button.callback(
      lang === 'es' ? '📍 PNP Nearby' : '📍 PNP Nearby',
      'menu_nearby'
    )],
    [Markup.button.url(
      lang === 'es' ? '🎥 PNPtv Main Room' : '🎥 PNPtv Main Room',
      jitsiUrl
    )],
    [Markup.button.url(
      lang === 'es' ? '🎬 PNPtv Hangouts' : '🎬 PNPtv Hangouts',
      'https://pnptv.app/hangouts'
    )],
    [Markup.button.url(
      lang === 'es' ? '✨ Todas las funciones (Abrir Bot)' : '✨ All features (Open Bot)',
      `https://t.me/${botUsername}?start=from_menu`
    )],
  ];

  return { text, buttons };
}

const registerMenuHandlers = (bot) => {

  /**
   * Show main menu with all options
   * Displays different views based on subscription status
   */
  const showMainMenu = async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from?.id;
      const botUsername = ctx.botInfo?.username || process.env.BOT_USERNAME || 'pnptv_bot';
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

      // Delete previous menu message if in group
      if (isGroup) {
        await deletePreviousMenuMessage(ctx);
      }

      // Check subscription status
      const hasSubscription = userId ? await UserService.hasActiveSubscription(userId) : false;
      const username = ctx.from?.username || ctx.from?.first_name || 'Member';

      let menuText;
      let buttons;

      // In group chats, always show a simple, consistent menu (so /menu and /menu@Bot work as expected)
      if (isGroup) {
        const groupMenu = buildGroupMenuPayload(ctx);
        menuText = groupMenu.text;
        buttons = groupMenu.buttons;
      } else if (hasSubscription) {
        // PRIME MEMBER VIEW
        menuText = lang === 'es'
          ? `🎬 *¡Eres PRIME!*

¡Gracias por ser PRIME, papi! 🔥

Pulsa los botones de abajo y disfruta todo lo que hemos preparado para ti — videos, Nearby, hangouts, lives, shows, y más.

*Cristina*, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.

\`¡Eso está muy hot! 🔥\``
          : `🎬 *You are PRIME!*

Thank you for being PRIME, papi! 🔥

Tap the buttons below and enjoy everything we've prepared for you — videos, Nearby, hangouts, lives, shows, and more.

*Cristina*, our AI assistant, is here to guide you and answer questions.

\`That's so hot! 🔥\``;

        // Get user's display name for Jitsi
        const displayName = ctx.from?.first_name || ctx.from?.username || 'User';
        const jitsiUrl = `https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

        buttons = [
          [Markup.button.url(
            lang === 'es' ? '💬 Abrir Bot' : '💬 Open Bot',
            `https://t.me/${botUsername}?start=from_menu`
          )],
          [Markup.button.callback(
            lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile',
            'show_profile'
          )],
          [Markup.button.callback(
            lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who is Nearby?',
            'menu_nearby'
          )],
          [Markup.button.url(
            lang === 'es' ? '🎬 Ver Contenido' : '🎬 Watch Content',
            'https://t.me/+mUGxQj6w9AI2NGUx'
          )],
          [Markup.button.url(
            lang === 'es' ? '🎥 PNPtv main Room!' : '🎥 PNPtv main Room!',
            jitsiUrl
          )],
          [Markup.button.url(
            lang === 'es' ? '🎬 PNPtv Hangouts!' : '🎬 PNPtv Hangouts!',
            'https://pnptv.app/hangouts'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🆘 Ayuda' : '🆘 Help',
            'menu_help'
          )],
          [Markup.button.callback(
            lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings',
            'show_settings'
          )],
        ];
      } else {
        // FREE MEMBER VIEW
        menuText = lang === 'es'
          ? `🎬 *¡Bienvenido a PNPtv!*

@${username} ¡nos encanta tenerte en la Comunidad PNPtv! 💜

Pulsa *Desbloquear PRIME* para más diversión — videos completos, lives, hangouts, Nearby, y todas las funciones de miembro.

*Cristina*, nuestra asistente IA, está aquí para guiarte y responder tus preguntas.

\`¡Desbloquea la diversión! 🔓\``
          : `🎬 *Welcome to PNPtv!*

@${username} we love having you in the PNPtv Community! 💜

Hit *Unlock PRIME* to get even more cloudy fun — full-length videos, lives, hangouts, Nearby, and all member features.

*Cristina*, our AI assistant, is here to guide you and answer questions.

\`Unlock the fun! 🔓\``;

        buttons = [
          [Markup.button.url(
            lang === 'es' ? '💬 Abrir Bot' : '💬 Open Bot',
            `https://t.me/${botUsername}?start=from_menu`
          )],
          [Markup.button.callback(
            lang === 'es' ? '🔓 Desbloquear PRIME' : '🔓 Unlock PRIME',
            'show_subscription_plans'
          )],
          [Markup.button.callback(
            lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile',
            'show_profile'
          )],
          [Markup.button.callback(
            lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who is Nearby?',
            'menu_nearby'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🎬 Ver Contenido 🔒' : '🎬 Watch Content 🔒',
            'locked_feature'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🆘 Ayuda' : '🆘 Help',
            'menu_help'
          )],
          [Markup.button.callback(
            lang === 'es' ? '⚙️ Ajustes' : '⚙️ Settings',
            'show_settings'
          )],
        ];
      }

      const sentMessage = await ctx.reply(menuText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });

      // Store menu message ID if in group
      if (isGroup) {
        storeMenuMessage(ctx, sentMessage.message_id);

        // Also delete the /menu command message from user if available
        try {
          if (ctx.message) {
            await ctx.deleteMessage();
          }
        } catch (error) {
          // Ignore if we can't delete the command message
        }
      }
    } catch (error) {
      logger.error('Error showing main menu:', error);
    }
  };

  /**
   * Who is Nearby? - Geolocation based member discovery
   */
  bot.action('menu_nearby', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const nearbyText = lang === 'es'
        ? `🌍 ¿Quién está cerca?

Descubre miembros de PNPtv cerca de ti basado en ubicación.

Características:
• Encuentra miembros en tu área
• Filtra por edad, género e intereses
• Chat privado con conexiones
• Privacidad garantizada - compartir ubicación es opcional

Para usar esta función:
1. Ve a tu perfil
2. Habilita la ubicación (opcional)
3. Explora miembros cercanos

Privacidad: Tu ubicación exacta nunca se comparte públicamente`
        : `🌍 Who is Nearby?

Discover PNPtv members near you based on location.

Features:
• Find members in your area
• Filter by age, gender and interests
• Private chat with matches
• Privacy guaranteed - sharing location is optional

To use this feature:
1. Go to your profile
2. Enable location (optional)
3. Explore nearby members

Privacy: Your exact location is never publicly shared`;

      await ctx.editMessageText(nearbyText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in nearby menu:', error);
    }
  });

  /**
   * PNPtv Hangouts! - Video rooms
   */
  bot.action('menu_hangouts', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const hangoutsText = lang === 'es'
        ? `🎥 PNPtv Video Room!

Salas de video en vivo para conectar con otros miembros.

**Características:**
• 👥 Sala Comunitaria 24/7 - Siempre abierta para conocer gente
• 🔒 Salas privadas - Crea salas exclusivas con amigos
• 👫 Hasta 4 participantes por sala
• 🎬 Video y audio de alta calidad
• 💬 Chat en tiempo real

**Sala Comunitaria 24/7:**
Nuestra sala principal está abierta 24 horas para que conozcas miembros nuevos, hagas amigos y disfrutes de conexiones sin presión.

**Cómo usar:**
1. Entra a la Sala Comunitaria 24/7 para empezar
2. O crea tu propia sala privada
3. Invita amigos a tu sala personal
4. ¡Disfruta conexiones en video de calidad!`
        : `🎥 PNPtv Video Room!

Live video rooms to connect with other members.

**Features:**
• 👥 24/7 PNPtv Haus - Always open to meet new people
• 🔒 Private rooms - Create exclusive rooms with friends
• 👫 Up to 4 participants per room
• 🎬 High-quality video and audio
• 💬 Real-time chat

**24/7 PNPtv Haus:**
Our main room is open around the clock for you to meet new members, make friends, and enjoy pressure-free connections.

**How to use:**
1. Join the 24/7 PNPtv Haus to get started
2. Or create your own private room
3. Invite friends to your personal room
4. Enjoy quality video connections!`;

      // Get user's display name for Jitsi
      const displayName = ctx.from?.first_name || ctx.from?.username || 'User';
      const jitsiUrl = `https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=${encodeURIComponent(displayName)}`;

      await ctx.editMessageText(hangoutsText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url(
            lang === 'es' ? '👥 PNPtv Haus 24/7' : '👥 PNPtv Haus 24/7',
            jitsiUrl
          )],
          [Markup.button.url(
            lang === 'es' ? '📱 Abre Hangouts' : '📱 Open Hangouts',
            process.env.HANGOUTS_WEB_APP_URL || 'https://pnptv.app/hangouts'
          )],
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in hangouts menu:', error);
    }
  });

  /**
   * PNPtv Live! - Coming soon
   */
  bot.action('menu_live', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const liveText = lang === 'es'
        ? `📺 PNPtv Live!

Streaming en vivo de tus creadores favoritos - ¡Próximamente!

Lo que vendrá:
• Transmisiones en vivo de miembros premium
• Chat interactivo durante transmisiones
• Regalos y propinas virtuales
• Programa de creadores verificados
• Contenido exclusivo para suscriptores

Mantente atento: Te notificaremos cuando este servicio esté disponible.

Por ahora, disfruta de:
• Hangouts para video privado
• Radio para contenido de audio`
        : `📺 PNPtv Live!

Live streaming from your favorite creators - Coming soon!

What's coming:
• Live broadcasts from premium members
• Interactive chat during streams
• Virtual gifts and tips
• Verified creator program
• Exclusive subscriber content

Stay tuned: We'll notify you when this service is available.

For now, enjoy:
• Hangouts for private video
• Radio for audio content`;

      await ctx.editMessageText(liveText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in live menu:', error);
    }
  });

  /**
   * Help! - Support and tutorials
   */
  bot.action('menu_help', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const helpText = lang === 'es'
        ? `🆘 ¡Ayuda!

Obtén soporte y aprende a usar todas las características de PNPtv.

Recursos Disponibles:
• Tutoriales paso a paso
• Chat con Cristina (asistente IA)
  → Responde preguntas sobre la plataforma
  → Recursos de salud y bienestar
  → Información sobre suscripciones
  → Y mucho más...
• Contacta con nuestro equipo de soporte
• Preguntas frecuentes (FAQ)

Cristina - Tu Asistente IA
Disponible 24/7 para ayudarte con:
• Cómo usar las características de PNPtv
• Información de seguridad y privacidad
• Problemas técnicos
• Cambios de suscripción
• Y cualquier otra pregunta

¡Haz clic en el botón de abajo para conectar!`
        : `🆘 Help!

Get support and learn how to use all PNPtv features.

Available Resources:
• Step-by-step tutorials
• Chat with Cristina (AI assistant)
  → Answer platform questions
  → Health and wellness resources
  → Subscription information
  → And much more...
• Contact our support team
• Frequently Asked Questions (FAQ)

Cristina - Your AI Assistant
Available 24/7 to help with:
• How to use PNPtv features
• Safety and privacy information
• Technical issues
• Subscription changes
• And any other questions

Click the button below to connect!`;

      await ctx.editMessageText(helpText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(
            lang === 'es' ? '🤖 Chat con Cristina' : '🤖 Chat with Cristina',
            'support_ai_chat'
          )],
          [Markup.button.callback(
            lang === 'es' ? '📧 Contactar Soporte' : '📧 Contact Support',
            'support_contact_admin'
          )],
          [Markup.button.callback(
            lang === 'es' ? '❓ FAQ' : '❓ FAQ',
            'support_faq'
          )],
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in help menu:', error);
    }
  });

  /**
   * Back to main menu action
   */
  bot.action('menu_main', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error going back to main menu:', error);
    }
  });

  /**
   * Locked feature handler for free users
   */
  bot.action('locked_feature', async (ctx) => {
    const lang = getLanguage(ctx);
    await ctx.answerCbQuery(
      lang === 'es'
        ? '🔒 Esta función solo está disponible para miembros PRIME. ¡Suscríbete ahora!'
        : '🔒 This feature is only available for PRIME members. Subscribe now!',
      { show_alert: true }
    );
  });

  /**
   * /menu command - Main entry point
   * Can be used in groups and private chats
   */
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error in /menu command:', error);
      const lang = getLanguage(ctx);
      await ctx.reply(
        lang === 'es' ? '❌ Error al mostrar el menú. Por favor intenta de nuevo.' : '❌ Error displaying menu. Please try again.',
        Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔄 Reintentar' : '🔄 Retry', 'menu_main')],
        ])
      );
    }
  });
};

registerMenuHandlers.buildGroupMenuPayload = buildGroupMenuPayload;

module.exports = registerMenuHandlers;
