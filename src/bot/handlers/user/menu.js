const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Main menu handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMenuHandlers = (bot) => {
  // Menu command
  bot.command('menu', async (ctx) => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error showing menu:', error);
    }
  });

  // Back to main menu action
  bot.action('back_to_main', async (ctx) => {
    try {
      await showMainMenuEdit(ctx);
    } catch (error) {
      logger.error('Error in back to main:', error);
    }
  });

  // Group menu actions
  bot.action('group_contact_admin', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const messageEs = `📞 *Contactar a un Admin*\n\n` +
        `Para contactar a un administrador del grupo, por favor:\n\n` +
        `1. Menciona a uno de los administradores en el chat del grupo\n` +
        `2. O envía un mensaje directo al bot con tu consulta usando el botón "Chat Bot PNPtv!"\n\n` +
        `Los administradores responderán lo antes posible.`;

      const messageEn = `📞 *Contact an Admin*\n\n` +
        `To contact a group administrator, please:\n\n` +
        `1. Mention one of the administrators in the group chat\n` +
        `2. Or send a direct message to the bot with your query using the "PNPtv! Bot Chat" button\n\n` +
        `Administrators will respond as soon as possible.`;

      const message = lang === 'es' ? messageEs : messageEn;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error in group contact admin:', error);
    }
  });

  bot.action('group_show_rules', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const rulesEs = `📋 *Reglas de la Comunidad PNPtv!*\n\n` +
        `1️⃣ *Respeto:* Trata a todos los miembros con respeto y cortesía\n\n` +
        `2️⃣ *No Spam:* Evita el spam, publicidad no autorizada o contenido repetitivo\n\n` +
        `3️⃣ *Privacidad:* No compartas información personal de otros miembros sin su consentimiento\n\n` +
        `4️⃣ *Contenido Apropiado:* El contenido debe ser apropiado para la comunidad\n\n` +
        `5️⃣ *No Acoso:* El acoso, bullying o comportamiento hostil no será tolerado\n\n` +
        `6️⃣ *Uso del Bot:* Usa el bot en privado para funciones personales (perfil, suscripciones, pagos)\n\n` +
        `⚠️ *Incumplir estas reglas puede resultar en advertencias, restricciones o expulsión del grupo.*\n\n` +
        `¡Gracias por mantener nuestra comunidad segura y agradable! 🙏`;

      const rulesEn = `📋 *PNPtv! Community Rules*\n\n` +
        `1️⃣ *Respect:* Treat all members with respect and courtesy\n\n` +
        `2️⃣ *No Spam:* Avoid spam, unauthorized advertising or repetitive content\n\n` +
        `3️⃣ *Privacy:* Do not share personal information of other members without their consent\n\n` +
        `4️⃣ *Appropriate Content:* Content must be appropriate for the community\n\n` +
        `5️⃣ *No Harassment:* Harassment, bullying or hostile behavior will not be tolerated\n\n` +
        `6️⃣ *Bot Usage:* Use the bot privately for personal features (profile, subscriptions, payments)\n\n` +
        `⚠️ *Breaking these rules may result in warnings, restrictions or expulsion from the group.*\n\n` +
        `Thank you for keeping our community safe and enjoyable! 🙏`;

      const message = lang === 'es' ? rulesEs : rulesEn;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error showing group rules:', error);
    }
  });

  bot.action('group_subscription_plans', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';
      const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'User';

      const messageEs = `⭐ *PNPtv! PRIME Subscription*\n\n` +
        `¡Hola ${username}! 👋\n\n` +
        `Revisa todos nuestros planes premium directamente en el bot.\n\n` +
        `Desbloquea la experiencia completa de PNPtv! con:\n` +
        `• 🔥 Videos completos de Santino, Lex y la comunidad\n` +
        `• 🌍 Miembros Cercanos para conectar con chicos cerca de ti\n` +
        `• 🎧 Biblioteca de Música y Podcasts con nuevo contenido semanal\n` +
        `• 🎥 Llamadas de Zoom y Presentaciones en Vivo exclusivas para miembros\n\n` +
        `Toca abajo para explorar todos los planes disponibles:`;

      const messageEn = `⭐ *PNPtv! PRIME Subscription*\n\n` +
        `Hey ${username}! 👋\n\n` +
        `Check out all our premium plans directly in the bot.\n\n` +
        `Unlock the full PNPtv! experience with:\n` +
        `• 🔥 Full-length videos from Santino, Lex, and the community\n` +
        `• 🌍 Nearby Members to connect with guys near you\n` +
        `• 🎧 Music & Podcast Library with weekly new drops\n` +
        `• 🎥 Zoom Calls & Live Performances exclusive for members\n\n` +
        `Tap below to explore all available plans:`;

      const message = lang === 'es' ? messageEs : messageEn;

      const keyboard = lang === 'es'
        ? [
          [Markup.button.callback('💳 Ver Planes de Suscripción', 'show_subscription_plans')],
          [Markup.button.callback('⬅️ Volver al Menú', 'back_to_group_menu')],
        ]
        : [
          [Markup.button.callback('💳 View Subscription Plans', 'show_subscription_plans')],
          [Markup.button.callback('⬅️ Back to Menu', 'back_to_group_menu')],
        ];

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      });
    } catch (error) {
      logger.error('Error showing group subscription plans:', error);
    }
  });

  bot.action('group_book_call', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';
      const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'User';

      const messageEs = `📞 *Reserva una Llamada con los Performers*\n\n` +
        `Hola ${username}… 👋\n` +
        `¿Listo para estar más cerquita? 😏\n\n` +
        `Nuestros performers están listos para darte una experiencia privada, intensa y totalmente personal.\n\n` +
        `🔥 *Servicios disponibles:*\n` +
        `• 📹 Videollamadas — cara a cara, cerquita y sin filtros\n` +
        `• 🎤 Llamadas de voz — habla, provoca y conecta\n` +
        `• 💬 Chats privados — tú y él/ella, sin interrupciones\n` +
        `• 🎁 Pedidos especiales — hechos solo para ti\n\n` +
        `Toca abajo y consigue la atención que estás buscando:`;

      const messageEn = `📞 *Book a Call with Performers*\n\n` +
        `Hey ${username}… 👋\n` +
        `Ready to get a little closer? 😏\n\n` +
        `Our performers are waiting to give you the most intense, personal, and private experience we offer.\n\n` +
        `🔥 *Available services:*\n` +
        `• 📹 Video calls — face-to-face, up close, and very personal\n` +
        `• 🎤 Voice calls — talk, tease, and connect\n` +
        `• 💬 Private chats — one-on-one, no distractions\n` +
        `• 🎁 Custom requests — made just for you\n\n` +
        `Tap below and get the attention you've been craving:`;

      const message = lang === 'es' ? messageEs : messageEn;

      const keyboard = lang === 'es'
        ? [
          [Markup.button.callback('📅 Reservar Ahora', 'book_private_call')],
          [Markup.button.callback('⬅️ Volver al Menú', 'back_to_group_menu')],
        ]
        : [
          [Markup.button.callback('📅 Book a Call Now', 'book_private_call')],
          [Markup.button.callback('⬅️ Back to Menu', 'back_to_group_menu')],
        ];

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      });
    } catch (error) {
      logger.error('Error showing group book call:', error);
    }
  });

  bot.action('back_to_group_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showGroupMenu(ctx);
    } catch (error) {
      logger.error('Error in back to group menu:', error);
    }
  });
};

/**
 * Show main menu (new message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const chatType = ctx.chat?.type;

  // Check if this is a group or supergroup
  if (chatType === 'group' || chatType === 'supergroup') {
    // Show limited group menu
    await showGroupMenu(ctx);
    return;
  }

  // Show full private chat menu
  await ctx.reply(
    t('mainMenuIntro', lang),
    Markup.inlineKeyboard([
      [
        Markup.button.callback(t('subscribe', lang), 'show_subscription_plans'),
        Markup.button.callback(t('myProfile', lang), 'show_profile'),
      ],
      [
        Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
        Markup.button.callback(t('liveStreams', lang), 'show_live'),
      ],
      [
        Markup.button.callback(t('radioMenu', lang), 'show_radio'),
        Markup.button.callback(t('zoomRooms', lang), 'show_zoom'),
      ],
      [
        Markup.button.callback(t('support', lang), 'show_support'),
        Markup.button.callback(t('settings', lang), 'show_settings'),
      ],
    ]),
  );
};

/**
 * Show limited group menu (for privacy and anti-spam)
 * @param {Context} ctx - Telegraf context
 */
const showGroupMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'User';
  const botUsername = ctx.botInfo?.username || 'pnptv_bot';

  const messageEs = `✨ ¡Hola ${username}!\nGracias por pasarte por el Panel Rápido para Miembros 🙌\n\n` +
    `🔒 Solo un recordatorio: las funciones principales de PNPtv! se manejan directamente desde el chat del bot. Así protegemos tu privacidad y mantenemos la comunidad limpia y libre de spam.\n\n` +
    `Igual, desde este panel puedes acceder a las opciones esenciales:`;

  const messageEn = `✨ Hey ${username}!\nThanks for stopping by the Quick Member Panel 🙌\n\n` +
    `🔒 Just a heads-up: all core PNPtv! features work exclusively through the bot chat. This keeps your activity private and helps us maintain a clean, spam-free community for everyone.\n\n` +
    `But no worries — from this panel you can still jump into the essentials:`;

  const message = lang === 'es' ? messageEs : messageEn;

  const keyboard = lang === 'es'
    ? [
      [Markup.button.callback('⭐ Planes PRIME', 'group_subscription_plans')],
      [Markup.button.callback('📞 Reservar Llamada', 'group_book_call')],
      [Markup.button.callback('📞 Contactar a un Admin', 'group_contact_admin')],
      [Markup.button.callback('📋 Reglas de la Comunidad', 'group_show_rules')],
      [Markup.button.url(`💬 Chat Bot PNPtv!`, `https://t.me/${botUsername}?start=group_menu`)],
    ]
    : [
      [Markup.button.callback('⭐ PRIME Subscription', 'group_subscription_plans')],
      [Markup.button.callback('📞 Book a Call', 'group_book_call')],
      [Markup.button.callback('📞 Contact an Admin', 'group_contact_admin')],
      [Markup.button.callback('📋 Community Rules', 'group_show_rules')],
      [Markup.button.url(`💬 PNPtv! Bot Chat`, `https://t.me/${botUsername}?start=group_menu`)],
    ];

  await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard),
    },
  );
};

/**
 * Show main menu (edit existing message)
 * @param {Context} ctx - Telegraf context
 */
const showMainMenuEdit = async (ctx) => {
  const lang = ctx.session?.language || 'en';

  try {
    await ctx.editMessageText(
      t('mainMenuIntro', lang),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t('subscribe', lang), 'show_subscription_plans'),
          Markup.button.callback(t('myProfile', lang), 'show_profile'),
        ],
        [
          Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
          Markup.button.callback(t('liveStreams', lang), 'show_live'),
        ],
        [
          Markup.button.callback(t('radioMenu', lang), 'show_radio'),
          Markup.button.callback(t('zoomRooms', lang), 'show_zoom'),
        ],
        [
          Markup.button.callback(t('support', lang), 'show_support'),
          Markup.button.callback(t('settings', lang), 'show_settings'),
        ],
      ]),
    );
  } catch (error) {
    // If edit fails, send new message
    await showMainMenu(ctx);
  }
};

module.exports = registerMenuHandlers;
module.exports.showMainMenu = showMainMenu;
module.exports.showMainMenuEdit = showMainMenuEdit;
