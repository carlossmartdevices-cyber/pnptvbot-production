const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const ChatCleanupService = require('../../services/chatCleanupService');
const logger = require('../../../utils/logger');

/**
 * Badge options for "Which vibe are you?"
 */
const BADGE_OPTIONS = {
  meth_alpha: { emoji: '🔥', name: 'Meth Alpha' },
  chem_mermaids: { emoji: '🧜', name: 'Chem Mermaids' },
  slam_slut: { emoji: '💉', name: 'Slam Slut' },
  spun_royal: { emoji: '👑', name: 'Spun Royal' },
};

/**
 * Register group welcome handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerGroupWelcomeHandlers = (bot) => {
  // Handle new members joining the group
  bot.on('new_chat_members', handleNewMembers);

  // Handle badge selection
  bot.action(/^badge_select_(.+)$/, handleBadgeSelection);

  // Handle action buttons
  bot.action('group_subscribe_prime', handleSubscribeAction);
  bot.action('group_book_call', handleBookCallAction);

  // Handle view rules button
  bot.action('group_view_rules', handleViewRules);
};

/**
 * Handle new members joining the group
 */
async function handleNewMembers(ctx) {
  try {
    const chatType = ctx.chat?.type;

    // Only works in groups
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return;
    }

    const newMembers = ctx.message?.new_chat_members || [];

    // Process each new member
    for (const member of newMembers) {
      // Skip bots
      if (member.is_bot) continue;

      // Get or create user
      const user = await UserModel.createOrUpdate({
        userId: member.id,
        username: member.username,
        firstName: member.first_name,
        lastName: member.last_name,
      });

      if (!user) {
        logger.error('Failed to get/create user for new member', { userId: member.id });
        continue;
      }

      const lang = user.language || 'en';
      const username = member.username ? `@${member.username}` : member.first_name;

      // Send welcome message
      await sendWelcomeMessage(ctx, username, user, lang);

      // Send badge selection message
      await sendBadgeSelectionMessage(ctx, username, lang);
    }
  } catch (error) {
    logger.error('Error handling new members:', error);
  }
}

/**
 * Send welcome message with membership info
 */
async function sendWelcomeMessage(ctx, username, user, lang) {
  try {
    const subscriptionStatus = user.subscriptionStatus === 'active' ? 'PRIME Member' : 'Free Member';

    const message = lang === 'es'
      ? `👋 Ey ${username}, bienvenidx a PNPtv!

Envía /menu o /start para ver lo que el bot puede hacer.`
      : `👋 Hey ${username}, welcome to PNPtv!

Send /menu or /start to see what the bot can do.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info('Welcome message sent', {
      userId: user.userId,
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending welcome message:', error);
  }
}

/**
 * Send badge selection message
 */
async function sendBadgeSelectionMessage(ctx, username, lang) {
  try {
    const message = lang === 'es'
      ? `👑 Perteneces a… (elige tu tribu)

Dime qué clase de desmadre eres, y te doy tu primera insignia.
Se guarda al toque.`
      : `👑 You belong to… (pick your tribe)

Tell us what kind of chaos you are, and we'll give you your first badge.
It saves instantly.`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.meth_alpha.emoji} ${BADGE_OPTIONS.meth_alpha.name}`,
          'badge_select_meth_alpha'
        ),
        Markup.button.callback(
          `${BADGE_OPTIONS.chem_mermaids.emoji} ${BADGE_OPTIONS.chem_mermaids.name}`,
          'badge_select_chem_mermaids'
        ),
      ],
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.slam_slut.emoji} ${BADGE_OPTIONS.slam_slut.name}`,
          'badge_select_slam_slut'
        ),
        Markup.button.callback(
          `${BADGE_OPTIONS.spun_royal.emoji} ${BADGE_OPTIONS.spun_royal.name}`,
          'badge_select_spun_royal'
        ),
      ],
    ]);

    await ctx.reply(message, keyboard);

    logger.info('Badge selection message sent', {
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending badge selection message:', error);
  }
}

/**
 * Handle badge selection
 */
async function handleBadgeSelection(ctx) {
  try {
    if (!ctx.match || !ctx.match[1]) {
      logger.error('Invalid badge selection format');
      return;
    }

    const badgeKey = ctx.match[1];
    const badge = BADGE_OPTIONS[badgeKey];

    if (!badge) {
      logger.error('Invalid badge key:', badgeKey);
      return;
    }

    const userId = ctx.from.id;
    const user = await UserModel.getById(userId);

    if (!user) {
      await ctx.answerCbQuery('Error: User not found. Please use /start first.');
      return;
    }

    const lang = user.language || 'en';
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    // Save badge to user profile
    await UserModel.addBadge(userId, badgeKey);

    // Delete the badge selection message (optional)
    try {
      await ctx.deleteMessage();
    } catch (error) {
      logger.warn('Could not delete badge selection message:', error);
    }

    // Send congratulations message
    await sendCongratsMessage(ctx, username, badge, lang);

    // Send action buttons (Subscribe + Book Call)
    await sendActionButtons(ctx, lang);

    // Send rules menu
    await sendRulesMenu(ctx, lang);

    // Answer the callback query
    await ctx.answerCbQuery(`${badge.emoji} Badge saved!`);

    logger.info('Badge selected and saved', {
      userId,
      badge: badgeKey,
      chatId: ctx.chat.id,
    });
  } catch (error) {
    logger.error('Error handling badge selection:', error);
    await ctx.answerCbQuery('An error occurred. Please try again.');
  }
}

/**
 * Send congratulations message after badge selection
 */
async function sendCongratsMessage(ctx, username, badge, lang) {
  try {
    const message = lang === 'es'
      ? `🎉 Que chimba papi! Primera insignia desbloqueada.

${username} es ${badge.name}
y oficialmente parte de la familia PNPtv!`
      : `🎉 Que chimba papi! First badge unlocked.

${username} is a ${badge.name}
and officially part of the PNPtv! family.`;

    await ctx.reply(message);

    logger.info('Congrats message sent', {
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      badge: badge.name,
    });
  } catch (error) {
    logger.error('Error sending congrats message:', error);
  }
}

/**
 * Send action buttons (Subscribe + Book Call)
 */
async function sendActionButtons(ctx, lang) {
  try {
    const message = lang === 'es'
      ? `🚀 ¿Quieres más?

Explora todo lo que PNPtv! tiene para ti:`
      : `🚀 Want more?

Explore everything PNPtv! has for you:`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === 'es' ? '⭐ Suscríbete a PNPtv! PRIME' : '⭐ Subscribe to PNPtv! PRIME',
        'group_subscribe_prime'
      )],
      [Markup.button.callback(
        lang === 'es' ? '📲 Reserva una Llamada con Performers' : '📲 Book a Call with Performers',
        'group_book_call'
      )],
    ]);

    await ctx.reply(message, keyboard);

    logger.info('Action buttons sent', {
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending action buttons:', error);
  }
}

/**
 * Send rules menu with inline button
 */
async function sendRulesMenu(ctx, lang) {
  try {
    const buttonText = lang === 'es' ? '📘 Ver Reglas del Grupo' : '📘 View Group Rules';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(buttonText, 'group_view_rules')],
    ]);

    await ctx.reply(
      lang === 'es'
        ? '📋 Lee las reglas del grupo:'
        : '📋 Check out the group rules:',
      keyboard
    );

    logger.info('Rules menu sent', {
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending rules menu:', error);
  }
}

/**
 * Handle view rules button click
 */
async function handleViewRules(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await UserModel.getById(userId);
    const lang = user?.language || 'en';

    const rulesMessage = lang === 'es'
      ? `📘 Reglas rápidas del grupo:

• Respeto
• Nada de spam
• Consentimiento siempre
• No ventas externas
• No compartas links
• Cuídate y cuida a los demás

Lista completa de reglas y términos en nuestro sitio.`
      : `📘 Quick Rules:

• Respect people
• No spam
• Consent always
• No external selling
• Do not share links
• Take care of yourself and others

Full list of rules and terms and conditions on our site.`;

    // Send rules as a reply or edit the message
    try {
      await ctx.editMessageText(rulesMessage, { parse_mode: 'Markdown' });
    } catch {
      // If editing fails, send as new message
      const sentMessage = await ctx.reply(rulesMessage, { parse_mode: 'Markdown' });

      // Auto-delete after 2 minutes
      ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 2 * 60 * 1000);
    }

    await ctx.answerCbQuery();

    logger.info('Rules displayed', {
      userId,
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error handling view rules:', error);
    await ctx.answerCbQuery('Error loading rules. Please try again.');
  }
}

/**
 * Handle subscribe button action
 */
async function handleSubscribeAction(ctx) {
  try {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;
    const user = await UserModel.getById(userId);
    const lang = user?.language || 'en';

    // Send subscribe command message
    const message = lang === 'es'
      ? '⭐ Para suscribirte a PRIME, usa el comando /subscribe'
      : '⭐ To subscribe to PRIME, use the /subscribe command';

    await ctx.reply(message);

    logger.info('Subscribe action triggered', {
      userId,
      chatId: ctx.chat.id,
    });
  } catch (error) {
    logger.error('Error handling subscribe action:', error);
    await ctx.answerCbQuery('An error occurred. Please try again.');
  }
}

/**
 * Handle book call button action
 */
async function handleBookCallAction(ctx) {
  try {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;
    const user = await UserModel.getById(userId);
    const lang = user?.language || 'en';

    // Redirect to private chat with the bot
    const botUsername = ctx.botInfo?.username || 'PNPtvBot';
    const message = lang === 'es'
      ? `📲 Para reservar una llamada con performers, abre el chat privado del bot:

👉 @${botUsername}

Luego usa el menú para acceder a las videollamadas.`
      : `📲 To book a call with performers, open the bot's private chat:

👉 @${botUsername}

Then use the menu to access video calls.`;

    await ctx.reply(message);

    logger.info('Book call action triggered', {
      userId,
      chatId: ctx.chat.id,
    });
  } catch (error) {
    logger.error('Error handling book call action:', error);
    await ctx.answerCbQuery('An error occurred. Please try again.');
  }
}

module.exports = registerGroupWelcomeHandlers;
