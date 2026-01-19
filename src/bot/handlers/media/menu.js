const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const { getLanguage, safeReplyOrEdit } = require('../../utils/helpers');
const UserService = require('../../services/userService');
const PermissionService = require('../../services/permissionService');
const { showMainMenu: showUserMainMenu } = require('../user/menu');

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
    [Markup.button.callback(
      lang === 'es' ? '🎥 PNPtv Video Rooms' : '🎥 PNPtv Video Rooms',
      'menu_hangouts'
    )],
    [Markup.button.callback(
      lang === 'es' ? '🎬 Contenido Exclusivo' : '🎬 Exclusive Content',
      'menu_content'
    )],
    [Markup.button.callback(
      lang === 'es' ? '🎵 Videorama' : '🎵 Videorama',
      'menu_videorama'
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
          [Markup.button.callback(
            lang === 'es' ? '📸 Mi Perfil' : '📸 My Profile',
            'show_profile'
          )],
          [Markup.button.callback(
            lang === 'es' ? '📍 ¿Quién está cerca?' : '📍 Who is Nearby?',
            'menu_nearby'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🎥 PNPtv Video Rooms' : '🎥 PNPtv Video Rooms',
            'menu_hangouts'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🎬 Contenido Exclusivo' : '🎬 Exclusive Content',
            'menu_content'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🎵 Videorama' : '🎵 Videorama',
            'menu_videorama'
          )],
          [Markup.button.callback(
            lang === 'es' ? '💎 Mi Membresía' : '💎 My Membership',
            'menu_membership'
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
          [Markup.button.callback(
            lang === 'es' ? '🔓 Desbloquear PRIME' : '🔓 Unlock PRIME',
            'menu_membership'
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
            lang === 'es' ? '🎥 PNPtv Video Rooms' : '🎥 PNPtv Video Rooms',
            'menu_hangouts'
          )],
          [Markup.button.callback(
            lang === 'es' ? '🎬 Contenido Exclusivo 🔒' : '🎬 Exclusive Content 🔒',
            'menu_content'
          )],
          [Markup.button.url(
            lang === 'es' ? '🎵 Videorama' : '🎵 Videorama',
            'https://pnptv.app/videorama-app'
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
   * My Profile - Redirect to show_profile action
   */
  bot.action('menu_profile', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing show_profile handler
      const profileText = lang === 'es'
        ? '📸 *Mi Perfil* 📸\n\nRedirigiendo a tu perfil...'
        : '📸 *My Profile* 📸\n\nRedirecting to your profile...';

      await ctx.editMessageText(profileText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_profile action
      ctx.callbackQuery.data = 'show_profile';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_profile:', error);
    }
  });

  /**
   * Subscribe to PRIME - Redirect to show_subscription_plans action
   */
  bot.action('menu_subscribe', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing show_subscription_plans handler
      const subscribeText = lang === 'es'
        ? '💎 *Suscribirse a PRIME* 💎\n\nRedirigiendo a los planes de membresía...'
        : '💎 *Subscribe to PRIME* 💎\n\nRedirecting to membership plans...';

      await ctx.editMessageText(subscribeText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_subscription_plans action
      ctx.callbackQuery.data = 'show_subscription_plans';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_subscribe:', error);
    }
  });

  /**
   * Live Streams - Redirect to show_live action
   */
  bot.action('menu_streams', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing live streams handler
      const streamsText = lang === 'es'
        ? '🎥 *Transmisiones en Vivo* 🎥\n\nRedirigiendo a las transmisiones en vivo...'
        : '🎥 *Live Streams* 🎥\n\nRedirecting to live streams...';

      await ctx.editMessageText(streamsText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_live action
      ctx.callbackQuery.data = 'show_live';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_streams:', error);
    }
  });

  /**
   * Radio - Redirect to show_radio action
   */
  bot.action('menu_radio', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing radio handler
      const radioText = lang === 'es'
        ? '📻 *Radio PNPtv* 📻\n\nRedirigiendo a la radio...'
        : '📻 *PNPtv Radio* 📻\n\nRedirecting to radio...';

      await ctx.editMessageText(radioText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_radio action
      ctx.callbackQuery.data = 'show_radio';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_radio:', error);
    }
  });

  /**
   * Zoom Rooms - Redirect to show_zoom action
   */
  bot.action('menu_zoom', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing zoom handler
      const zoomText = lang === 'es'
        ? '🎥 *Salas Zoom* 🎥\n\nRedirigiendo a las salas Zoom...'
        : '🎥 *Zoom Rooms* 🎥\n\nRedirecting to Zoom rooms...';

      await ctx.editMessageText(zoomText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_zoom action
      ctx.callbackQuery.data = 'show_zoom';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_zoom:', error);
    }
  });

  /**
   * Support - Redirect to show_support action
   */
  bot.action('menu_support', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing support handler
      const supportText = lang === 'es'
        ? '💬 *Soporte* 💬\n\nRedirigiendo al menú de soporte...'
        : '💬 *Support* 💬\n\nRedirecting to support menu...';

      await ctx.editMessageText(supportText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_support action
      ctx.callbackQuery.data = 'show_support';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_support:', error);
    }
  });

  /**
   * Settings - Redirect to show_settings action
   */
  bot.action('menu_settings', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      // Redirect to the existing settings handler
      const settingsText = lang === 'es'
        ? '⚙️ *Configuración* ⚙️\n\nRedirigiendo al menú de configuración...'
        : '⚙️ *Settings* ⚙️\n\nRedirecting to settings menu...';

      await ctx.editMessageText(settingsText, {
        parse_mode: 'Markdown'
      });

      // Trigger the show_settings action
      ctx.callbackQuery.data = 'show_settings';
      await bot.handleUpdate(ctx.update);
    } catch (error) {
      logger.error('Error handling menu_settings:', error);
    }
  });

  /**
   * Who is Nearby? - Geolocation based member discovery
   * Now shows directly in group chat with auto-delete
   */
  bot.action('menu_nearby', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const nearbyText = lang === 'es'
        ? `🌍 *¿Quién está cerca?* 🌍

📍 *Descubre miembros de PNPtv cerca de ti*

🎯 *Características:*
✅ Encuentra miembros en tu área
✅ Filtra por edad, género e intereses
✅ Chat privado con conexiones
✅ Privacidad garantizada

📱 *Cómo usar:*
1. Ve a tu perfil → ⚙️ Ajustes
2. Habilita "Compartir ubicación" (opcional)
3. Usa el botón "📍 ¿Quién está cerca?" en el menú principal
4. Explora y conecta con miembros cercanos

🔒 *Privacidad:* Tu ubicación exacta NUNCA se comparte públicamente

💡 *Consejo:* Más miembros activan la ubicación = más conexiones posibles`
        : `🌍 *Who is Nearby?* 🌍

📍 *Discover PNPtv members near you*

🎯 *Features:*
✅ Find members in your area
✅ Filter by age, gender and interests
✅ Private chat with matches
✅ Privacy guaranteed

📱 *How to use:*
1. Go to your profile → ⚙️ Settings
2. Enable "Share location" (optional)
3. Use the "📍 Who is Nearby?" button in main menu
4. Explore and connect with nearby members

🔒 *Privacy:* Your exact location is NEVER publicly shared

💡 *Tip:* More members enable location = more possible connections`;

      const sentMessage = await safeReplyOrEdit(ctx, nearbyText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Volver al Menú' : '🔙 Back to Menu', 'menu_main')],
        ]),
      });

      // Auto-delete after 30 seconds of inactivity
      if (sentMessage) {
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
          } catch (error) {
            // Message may have already been deleted or chat may not allow deletion
          }
        }, 30000);
      }
    } catch (error) {
      logger.error('Error in nearby menu:', error);
    }
  });

  /**
   * Exclusive Content Menu
   */
  bot.action('menu_content', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const contentText = lang === 'es'
        ? `🎬 Contenido Exclusivo PNPtv

💎 *Para miembros PRIME:*
• Videos completos de la comunidad
• Acceso a contenido premium
• Colecciones exclusivas
• Actualizaciones diarias

📱 *Para miembros gratuitos:*
• Previsualizaciones de contenido
• Muestras y avances
• Acceso limitado a videos

💡 *¿Quieres más?* Desbloquea PRIME para acceso completo a toda nuestra biblioteca de contenido.`
        : `🎬 PNPtv Exclusive Content

💎 *For PRIME members:*
• Full-length community videos
• Premium content access
• Exclusive collections
• Daily updates

📱 *For free members:*
• Content previews
• Samples and trailers
• Limited video access

💡 *Want more?* Unlock PRIME for full access to our entire content library.`;

      await ctx.editMessageText(contentText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in content menu:', error);
    }
  });

  /**
   * Private Calls Menu
   */
  bot.action('menu_private_calls', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const userId = ctx.from?.id;
      const user = userId ? await UserService.getUserById(userId) : null;
      const isPrime = user ? await UserService.hasActiveSubscription(userId) : false;

      let privateCallsText;
      let buttons;

      if (isPrime) {
        privateCallsText = lang === 'es'
          ? `📞 Llamadas Privadas 1:1

💎 *Disponible para miembros PRIME*

🎭 *¿Qué incluye?*
• Videollamada privada con un performer
• Duración configurable (30-60 minutos)
• Calidad HD y conexión segura
• Horario flexible según disponibilidad

💰 *Precio:* Desde $100 USD por sesión

📅 *Disponibilidad:* Performers disponibles 24/7

💡 *Cómo funciona:*
1. Elige un performer
2. Selecciona fecha y hora
3. Confirma las reglas
4. Completa el pago
5. ¡Disfruta tu llamada!`
          : `📞 Private 1:1 Calls

💎 *Available for PRIME Members*

🎭 *What's included?*
• Private video call with a performer
• Configurable duration (30-60 minutes)
• HD quality and secure connection
• Flexible scheduling based on availability

💰 *Price:* From $100 USD per session

📅 *Availability:* Performers available 24/7

💡 *How it works:*
1. Choose a performer
2. Select date and time
3. Confirm the rules
4. Complete payment
5. Enjoy your call!`;

        buttons = [
          [Markup.button.callback(lang === 'es' ? '📅 Reservar Llamada' : '📅 Book a Call', 'book_private_call')],
          [Markup.button.callback(lang === 'es' ? '📋 Mis Llamadas' : '📋 My Calls', 'my_private_calls')],
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ];
      } else {
        privateCallsText = lang === 'es'
          ? `📞 Llamadas Privadas 1:1

🔒 *Función para miembros PRIME*

💎 *Beneficios de las llamadas privadas:*
• Acceso exclusivo a performers
• Sesiones personalizadas
• Conexión segura y privada
• Agendamiento flexible

💰 *Precio:* Desde $100 USD por sesión

💡 *¿Quieres acceder?* Conviértete en PRIME para desbloquear esta función y muchas más.`
          : `📞 Private 1:1 Calls

🔒 *Feature for PRIME Members*

💎 *Benefits of private calls:*
• Exclusive access to performers
• Personalized sessions
• Secure and private connection
• Flexible scheduling

💰 *Price:* From $100 USD per session

💡 *Want access?* Become PRIME to unlock this feature and many more.`;

        buttons = [
          [Markup.button.callback(lang === 'es' ? '💎 Convertirme en PRIME' : '💎 Become PRIME', 'menu_membership')],
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ];
      }

      await ctx.editMessageText(privateCallsText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error in private calls menu:', error);
    }
  });

  /**
   * Videorama Menu
   */
  bot.action('menu_videorama', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery();

      const videoramaText = lang === 'es'
        ? `🎵 *Videorama - Tu Biblioteca de Videos*

🎬 *Descubre y disfruta contenido de video de la comunidad*

🎯 *Características:*
✅ Explora videos de miembros de PNPtv
✅ Filtra por categorías y popularidad
✅ Guarda tus videos favoritos
✅ Acceso rápido a contenido nuevo
✅ Interfaz intuitiva y rápida

📱 *Cómo usar:*
1. Abre Videorama desde el menú principal
2. Explora las categorías disponibles
3. Selecciona un video para verlo
4. Usa los filtros para encontrar lo que buscas
5. Guarda tus favoritos para acceso rápido

💡 *Consejo:* Videorama muestra contenido de toda la comunidad. Más interacciones = más contenido recomendado para ti!`
        : `🎵 *Videorama - Your Video Library*

🎬 *Discover and enjoy video content from the community*

🎯 *Features:*
✅ Browse videos from PNPtv members
✅ Filter by categories and popularity
✅ Save your favorite videos
✅ Quick access to new content
✅ Intuitive and fast interface

📱 *How to use:*
1. Open Videorama from the main menu
2. Explore available categories
3. Select a video to watch
4. Use filters to find what you're looking for
5. Save favorites for quick access

💡 *Tip:* Videorama shows content from the entire community. More interactions = more recommended content for you!`;

      await ctx.editMessageText(videoramaText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url(
            lang === 'es' ? '🌐 Abrir Videorama' : '🌐 Open Videorama',
            (() => {
              const tg = ctx.from?.username ? `@${ctx.from.username}` : '';
              return tg ? `https://pnptv.app/videorama-app/?tg=${encodeURIComponent(tg)}` : 'https://pnptv.app/videorama-app/';
            })()
          )],
          [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')],
        ]),
      });
    } catch (error) {
      logger.error('Error in videorama menu:', error);
    }
  });

  /**
   * Membership Menu
   */
  bot.action('menu_membership', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from?.id;
      const hasSubscription = userId ? await UserService.hasActiveSubscription(userId) : false;
      
      await ctx.answerCbQuery();

      let membershipText;
      if (hasSubscription) {
        // PRIME member view
        membershipText = lang === 'es'
          ? `💎 Tu Membresía PRIME

✅ *Estado:* ACTIVA 🎉

🎁 *Beneficios PRIME:*
• 🎬 Videos completos y contenido exclusivo
• 📍 Acceso completo a PNP Nearby
• 🎥 Salas de video premium
• 💬 Chat privado con miembros
• 🌟 Perfil destacado
• 🎟️ Acceso a eventos especiales

💜 *Gracias por apoyar a PNPtv!*`
          : `💎 Your PRIME Membership

✅ *Status:* ACTIVE 🎉

🎁 *PRIME Benefits:*
• 🎬 Full-length and exclusive videos
• 📍 Full access to PNP Nearby
• 🎥 Premium video rooms
• 💬 Private chat with members
• 🌟 Featured profile
• 🎟️ Access to special events

💜 *Thank you for supporting PNPtv!*`;
      } else {
        // Free member view
        membershipText = lang === 'es'
          ? `📱 Tu Membresía Actual

🔓 *Estado:* GRATIS

🎁 *Beneficios gratuitos:*
• 📍 PNP Nearby básico
• 🎥 Sala comunitaria 24/7
• 📸 Perfil y fotos
• 💬 Chat grupal

💎 *Desbloquea PRIME para:*
• 🎬 Videos completos y exclusivos
• 📍 Filtros avanzados en Nearby
• 🎥 Salas de video privadas
• 💬 Chat privado con miembros
• 🌟 Perfil destacado
• 🎟️ Eventos especiales

💡 *¡Hazte PRIME hoy y disfruta de todo!*`
          : `📱 Your Current Membership

🔓 *Status:* FREE

🎁 *Free Benefits:*
• 📍 Basic PNP Nearby
• 🎥 24/7 Community Room
• 📸 Profile and photos
• 💬 Group chat

💎 *Unlock PRIME for:*
• 🎬 Full-length and exclusive videos
• 📍 Advanced Nearby filters
• 🎥 Private video rooms
• 💬 Private chat with members
• 🌟 Featured profile
• 🎟️ Special events

💡 *Go PRIME today and enjoy everything!*`;
      }

      const buttons = [];
      if (!hasSubscription) {
        buttons.push([
          Markup.button.callback(lang === 'es' ? '💎 Ver Planes PRIME' : '💎 View PRIME Plans', 'show_subscription_plans')
        ]);
      }
      buttons.push([
        Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'menu_main')
      ]);

      await ctx.editMessageText(membershipText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error in membership menu:', error);
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
   * In private chats, uses the same menu as /start (from user/menu.js)
   * In groups, uses the group-specific menu
   */
  bot.command('menu', async (ctx) => {
    try {
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

      if (isGroup) {
        // Use group menu
        await showMainMenu(ctx);
      } else {
        // Use the same menu as /start for private chats
        await showUserMainMenu(ctx);
      }
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
