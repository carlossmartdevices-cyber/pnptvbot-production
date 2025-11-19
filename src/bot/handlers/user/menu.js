const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const ChatCleanupService = require('../../services/chatCleanupService');

/**
 * Envía mensaje de bienvenida y link de ingreso al canal PRIME
 * @param {Telegraf} bot - Bot instance
 * @param {string|number} userId - Telegram user ID
 */
const sendPrimeWelcome = async (bot, userId) => {
  const primeChannelLink = 'https://t.me/PNPTV_PRIME'; // Actualiza si el link es diferente
  const message = [
    '🎉 ¡Bienvenido a PRIME!',
    '',
    'Tu suscripción Lifetime está activa.',
    '',
    'Accede al canal exclusivo aquí:',
    `👉 [Ingresar a PRIME](${primeChannelLink})`,
    '',
    'Disfruta todos los beneficios y novedades.'
  ].join('\n');
  try {
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error enviando bienvenida PRIME:', error);
  }
};

module.exports.sendPrimeWelcome = sendPrimeWelcome;

/**
 * Main menu handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerMenuHandlers = (bot) => {
    // Locked feature handler for free users
    bot.action('locked_feature', async (ctx) => {
      const lang = ctx.session?.language || 'en';
      await ctx.answerCbQuery(
        lang === 'es'
          ? '🔒 Función solo para usuarios premium. Suscríbete para acceder.'
          : '🔒 Feature for premium users only. Subscribe to unlock.',
        { show_alert: true }
      );
    });
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

  // Note: show_subscription_plans handler is in payments/index.js

  // Group menu actions
  bot.action('group_contact_admin', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const messageEs = [
        '📞 *Contactar a un Admin*',
        '',
        'Para contactar a un administrador del grupo, por favor:',
        '',
        '1. Menciona a uno de los administradores en el chat del grupo',
        '2. O envía un mensaje directo al bot con tu consulta usando el botón "Chat Bot PNPtv!"',
        '',
        'Los administradores responderán lo antes posible.'
      ].join('\n');

      const messageEn = [
        '📞 *Contact an Admin*',
        '',
        'To contact a group administrator, please:',
        '',
        '1. Mention one of the administrators in the group chat',
        '2. Or send a direct message to the bot with your query using the "PNPtv! Bot Chat" button',
        '',
        'Administrators will respond as soon as possible.'
      ].join('\n');

      const message = lang === 'es' ? messageEs : messageEn;

      const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

      // Auto-delete menu messages in groups after 2 minutes
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroup) {
        ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 2 * 60 * 1000, false);
      }
    } catch (error) {
      logger.error('Error in group contact admin:', error);
    }
  });

  bot.action('group_show_rules', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const lang = ctx.session?.language || 'en';

      const rulesEs = [
        '📋 *Reglas de la Comunidad PNPtv!*',
        '',
        '1️⃣ *Respeto:* Trata a todos los miembros con respeto y cortesía',
        '',
        '2️⃣ *No Spam:* Evita el spam, publicidad no autorizada o contenido repetitivo',
        '',
        '3️⃣ *Privacidad:* No compartas información personal de otros miembros sin su consentimiento',
        '',
        '4️⃣ *Contenido Apropiado:* El contenido debe ser apropiado para la comunidad',
        '',
        '5️⃣ *No Acoso:* El acoso, bullying o comportamiento hostil no será tolerado',
        '',
        '6️⃣ *Uso del Bot:* Usa el bot en privado para funciones personales (perfil, suscripciones, pagos)',
        '',
        '⚠️ *Incumplir estas reglas puede resultar en advertencias, restricciones o expulsión del grupo.*',
        '',
        '¡Gracias por mantener nuestra comunidad segura y agradable! 🙏'
      ].join('\n');

      const rulesEn = [
        '📋 *PNPtv! Community Rules*',
        '',
        '1️⃣ *Respect:* Treat all members with respect and courtesy',
        '',
        '2️⃣ *No Spam:* Avoid spam, unauthorized advertising or repetitive content',
        '',
        '3️⃣ *Privacy:* Do not share personal information of other members without their consent',
        '',
        '4️⃣ *Appropriate Content:* Content must be appropriate for the community',
        '',
        '5️⃣ *No Harassment:* Harassment, bullying or hostile behavior will not be tolerated',
        '',
        '6️⃣ *Bot Usage:* Use the bot privately for personal features (profile, subscriptions, payments)',
        '',
        '⚠️ *Breaking these rules may result in warnings, restrictions or expulsion from the group.*',
        '',
        'Thank you for keeping our community safe and enjoyable! 🙏'
      ].join('\n');

      const message = lang === 'es' ? rulesEs : rulesEn;

      const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

      // Auto-delete menu messages in groups after 2 minutes
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroup) {
        ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 2 * 60 * 1000, false);
      }
    } catch (error) {
      logger.error('Error showing group rules:', error);
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
  const user = ctx.session?.user || {};
  const isPremium = user.subscriptionStatus === 'active';
  const isAdmin = user.role === 'admin';

  if (chatType === 'group' || chatType === 'supergroup') {
    await showGroupMenu(ctx);
    return;
  }

  // Texts for each type
  let menuText = '';
  if (isAdmin) {
    menuText = lang === 'es'
      ? '👑 ¡Bienvenido Admin!\nAcceso total a todas las funciones y panel de administración.'
      : '👑 Welcome Admin!\nFull access to all features and admin panel.';
  } else if (isPremium) {
    menuText = t('welcomeScreenPrime', lang);
  } else {
    menuText = t('welcomeScreenFree', lang);
  }

  // Button builder
  function buildButton(label, action, locked) {
    return Markup.button.callback(locked ? `${label} 🔒` : label, locked ? 'locked_feature' : action);
  }

  const buttons = [
    [
      Markup.button.callback(t('subscribe', lang), 'show_subscription_plans'),
      Markup.button.callback(t('myProfile', lang), 'show_profile'),
    ],
    [
      Markup.button.callback(t('nearbyUsers', lang), 'show_nearby'),
      buildButton(t('liveStreams', lang), 'show_live', !isPremium && !isAdmin),
    ],
    [
      Markup.button.callback(t('radioMenu', lang), 'show_radio'),
      buildButton(t('zoomRooms', lang), 'show_zoom', !isPremium && !isAdmin),
    ],
    [
      Markup.button.callback(t('support', lang), 'show_support'),
      Markup.button.callback(t('settings', lang), 'show_settings'),
    ],
  ];
  if (isAdmin) {
    buttons.push([Markup.button.callback('🛡️ Admin Panel', 'admin_panel')]);
  }

  await ctx.reply(menuText, Markup.inlineKeyboard(buttons));
}

/**
 * Show limited group menu (for privacy and anti-spam)
 * @param {Context} ctx - Telegraf context
 */
const showGroupMenu = async (ctx) => {
  const lang = ctx.session?.language || 'en';
  const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'User';
  const botUsername = ctx.botInfo?.username || 'pnptv_bot';

  const messageEs = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `👋 ¡Hola ${username}!`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🙌 Este es tu panel rápido de miembros.',
    '',
    '🔒 Recuerda: las funciones principales de PNPtv! se manejan directamente desde el chat del bot para proteger tu privacidad.',
    '',
    'Desde aquí puedes:',
    '• 📞 Contactar a un Admin',
    '• 📋 Ver reglas de la comunidad',
    '• 💬 Acceder al chat del bot',
  ].join('\n');

  const messageEn = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `👋 Hey ${username}!`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🙌 This is your quick member panel.',
    '',
    '🔒 Reminder: all core PNPtv! features work through the bot chat to protect your privacy.',
    '',
    'From here you can:',
    '• 📞 Contact an Admin',
    '• 📋 View community rules',
    '• 💬 Access the bot chat',
  ].join('\n');

  const message = lang === 'es' ? messageEs : messageEn;

  const keyboard = lang === 'es'
    ? [
      [Markup.button.callback('📞 Contactar a un Admin', 'group_contact_admin')],
      [Markup.button.callback('📋 Reglas de la Comunidad', 'group_show_rules')],
      [Markup.button.url(`💬 Chat Bot PNPtv!`, `https://t.me/${botUsername}?start=group_menu`)],
    ]
    : [
      [Markup.button.callback('📞 Contact an Admin', 'group_contact_admin')],
      [Markup.button.callback('📋 Community Rules', 'group_show_rules')],
      [Markup.button.url(`💬 PNPtv! Bot Chat`, `https://t.me/${botUsername}?start=group_menu`)],
    ];

  const sentMessage = await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard),
    },
  );

  // Auto-delete menu messages in groups after 2 minutes
  ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 2 * 60 * 1000, false);
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

// Export as default function for consistency with other handlers
module.exports = registerMenuHandlers;

// Also export named functions for direct imports
module.exports.showMainMenu = showMainMenu;
module.exports.showMainMenuEdit = showMainMenuEdit;
module.exports.sendPrimeWelcome = sendPrimeWelcome;
