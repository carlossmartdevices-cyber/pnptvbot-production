const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const logger = require('../../../utils/logger');

// Configuration
const GROUP_ID = process.env.GROUP_ID;
const AUTO_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes

// Badge options with emojis and descriptions
const BADGE_OPTIONS = {
  meth_alpha: { emoji: '🔥', name: 'Meth Alpha', description: 'The fire starter' },
  chem_mermaids: { emoji: '🧜', name: 'Chem Mermaids', description: 'Flow with the current' },
  slam_slut: { emoji: '💉', name: 'Slam Slut', description: 'Unapologetically intense' },
  spun_royal: { emoji: '👑', name: 'Spun Royal', description: 'Elevated and exclusive' },
};

/**
 * Send welcome message to new member
 */
async function sendWelcomeMessage(ctx, newMember) {
  try {
    const username = newMember.first_name || 'there';
    const userId = newMember.id;

    // Get user's subscription status
    let subscriptionStatus = 'FREE Member';
    try {
      const user = await UserModel.findByTelegramId(userId);
      if (user?.subscription?.isPrime) {
        subscriptionStatus = '💎 PRIME Member';
      }
    } catch (error) {
      logger.debug('Could not fetch user subscription status:', error.message);
    }

    // Detect language (default to English)
    const userLang = newMember.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `👋 Hola ${username}, ¡bienvenido a PNPtv!

Te acabas de unir a una de las comunidades más reales que existen — sin filtros, sin juicios, solo vibras.

⭐ TU MEMBRESÍA: ${subscriptionStatus}

🎁 Lo que obtienes ahora mismo:
• Acceso completo al grupo
• Biblioteca de música gratis
• 3 vistas de Miembros Cercanos por día
• Vistas previas de videos cortos

💎 ¿Quieres más? Activa PRIME y desbloquea:
• Miembros Cercanos ilimitados
• Videos exclusivos completos de Santino, Lex y el equipo
• Presentaciones en vivo + llamadas privadas de Zoom
• Música y podcasts premium
• Cero anuncios, acceso total

Escribe /menu para explorar todo 🚀`;
    } else {
      message = `👋 Hey ${username}, welcome to PNPtv!

You just joined one of the realest communities out there — no filters, no judgment, just vibes.

⭐ YOUR MEMBERSHIP: ${subscriptionStatus}

🎁 What you get right now:
• Full group access
• Free music library
• 3 Nearby Member views per day
• Short video previews

💎 Want more? Go PRIME and unlock:
• Unlimited Nearby Members
• Full-length exclusive videos from Santino, Lex & the crew
• Live performances + private Zoom calls
• Premium music & podcasts
• Zero ads, all access

Type /menu to explore everything 🚀`;
    }

    // Send to general group chat
    const sentMessage = await ctx.reply(message);

    // Auto-delete after 3 minutes
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
        logger.debug('Welcome message auto-deleted', { messageId: sentMessage.message_id });
      } catch (error) {
        logger.debug('Could not delete welcome message:', error.message);
      }
    }, AUTO_DELETE_DELAY);

    // Send badge selection after a short delay
    setTimeout(() => {
      sendBadgeSelectionMessage(ctx, newMember);
    }, 2000);

  } catch (error) {
    logger.error('Error sending welcome message:', error);
  }
}

/**
 * Send badge selection message
 */
async function sendBadgeSelectionMessage(ctx, user) {
  try {
    const username = user.first_name || 'there';
    const userLang = user.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `🎭 ¿Cuál es tu vibra?

Elige tu tribu — así es como te muestras en la comunidad.
(No te preocupes, puedes cambiarlo en cualquier momento)

Elige tu insignia abajo ⬇️`;
    } else {
      message = `🎭 Which vibe are you?

Pick your tribe — this is how you show up in the community.
(Don't stress, you can change it anytime)

Choose your badge below ⬇️`;
    }

    // Create inline keyboard with badge options
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.meth_alpha.emoji} ${BADGE_OPTIONS.meth_alpha.name} — ${BADGE_OPTIONS.meth_alpha.description}`,
          'badge_select_meth_alpha'
        ),
      ],
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.chem_mermaids.emoji} ${BADGE_OPTIONS.chem_mermaids.name} — ${BADGE_OPTIONS.chem_mermaids.description}`,
          'badge_select_chem_mermaids'
        ),
      ],
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.slam_slut.emoji} ${BADGE_OPTIONS.slam_slut.name} — ${BADGE_OPTIONS.slam_slut.description}`,
          'badge_select_slam_slut'
        ),
      ],
      [
        Markup.button.callback(
          `${BADGE_OPTIONS.spun_royal.emoji} ${BADGE_OPTIONS.spun_royal.name} — ${BADGE_OPTIONS.spun_royal.description}`,
          'badge_select_spun_royal'
        ),
      ],
    ]);

    // Send to general group chat
    const sentMessage = await ctx.reply(message, keyboard);

    // Auto-delete after 3 minutes
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
        logger.debug('Badge selection message auto-deleted', { messageId: sentMessage.message_id });
      } catch (error) {
        logger.debug('Could not delete badge selection message:', error.message);
      }
    }, AUTO_DELETE_DELAY);

  } catch (error) {
    logger.error('Error sending badge selection message:', error);
  }
}

/**
 * Handle badge selection
 */
async function handleBadgeSelection(ctx) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.first_name || 'Member';
    const badgeKey = ctx.match[1]; // Extract badge key from callback data

    if (!BADGE_OPTIONS[badgeKey]) {
      logger.warn('Invalid badge selection:', badgeKey);
      return;
    }

    const badge = BADGE_OPTIONS[badgeKey];

    // Save badge to user profile
    try {
      await UserModel.addBadge(userId, badgeKey);
      logger.info('Badge added to user profile', { userId, badge: badgeKey });
    } catch (error) {
      logger.error('Error saving badge to user profile:', error);
    }

    // Answer the callback query to remove loading state
    await ctx.answerCbQuery();

    // Send congratulations message
    await sendCongratsMessage(ctx, username, badge);

  } catch (error) {
    logger.error('Error handling badge selection:', error);
    try {
      await ctx.answerCbQuery('An error occurred. Please try again.');
    } catch (cbError) {
      logger.debug('Could not answer callback query:', cbError.message);
    }
  }
}

/**
 * Send congratulations message after badge selection
 */
async function sendCongratsMessage(ctx, username, badge) {
  try {
    const userLang = ctx.from.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `🎉 ¡Insignia reclamada!

@${username} es oficialmente un ${badge.emoji} ${badge.name}

¡Bienvenido a la familia! 💙`;
    } else {
      message = `🎉 Badge claimed!

@${username} is officially a ${badge.emoji} ${badge.name}

Welcome to the family! 💙`;
    }

    // Send to general group chat
    const sentMessage = await ctx.reply(message);

    // Auto-delete after 3 minutes
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
        logger.debug('Congrats message auto-deleted', { messageId: sentMessage.message_id });
      } catch (error) {
        logger.debug('Could not delete congrats message:', error.message);
      }
    }, AUTO_DELETE_DELAY);

    // Send action buttons after a short delay
    setTimeout(() => {
      sendActionButtons(ctx, username);
    }, 2000);

  } catch (error) {
    logger.error('Error sending congratulations message:', error);
  }
}

/**
 * Send action buttons for next steps
 */
async function sendActionButtons(ctx, username) {
  try {
    const userLang = ctx.from.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `🚀 ¿Listo para más?`;
    } else {
      message = `🚀 Ready for more?`;
    }

    // Create inline keyboard with action buttons
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(isSpanish ? '⭐ Activar PRIME' : '⭐ Get PRIME', 'welcome_get_prime')],
      [Markup.button.callback(isSpanish ? '📞 Reservar Llamada' : '📞 Book a Call', 'welcome_book_call')],
      [Markup.button.callback(isSpanish ? '👤 Configurar Perfil' : '👤 Setup Profile', 'welcome_setup_profile')],
    ]);

    // Send to general group chat
    const sentMessage = await ctx.reply(message, keyboard);

    // Auto-delete after 3 minutes
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
        logger.debug('Action buttons message auto-deleted', { messageId: sentMessage.message_id });
      } catch (error) {
        logger.debug('Could not delete action buttons message:', error.message);
      }
    }, AUTO_DELETE_DELAY);

  } catch (error) {
    logger.error('Error sending action buttons:', error);
  }
}

/**
 * Handle "Get PRIME" action
 */
async function handleGetPrimeAction(ctx) {
  try {
    const userId = ctx.from.id;
    const userLang = ctx.from.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `💎 ¿Listo para activar PRIME?

Desbloquea todo: videos completos, presentaciones en vivo, llamadas privadas, y más.

Escribe /prime para ver las opciones de membresía.`;
    } else {
      message = `💎 Ready to go PRIME?

Unlock everything: full videos, live shows, private calls, and more.

Type /prime to see membership options.`;
    }

    // Answer the callback query
    await ctx.answerCbQuery();

    // Try to send private message
    try {
      await ctx.telegram.sendMessage(userId, message);
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message);

      // Auto-delete after 3 minutes
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
          logger.debug('Get PRIME message auto-deleted', { messageId: sentMessage.message_id });
        } catch (delError) {
          logger.debug('Could not delete message:', delError.message);
        }
      }, AUTO_DELETE_DELAY);
    }

  } catch (error) {
    logger.error('Error handling Get PRIME action:', error);
  }
}

/**
 * Handle "Book a Call" action
 */
async function handleBookCallAction(ctx) {
  try {
    const userId = ctx.from.id;
    const userLang = ctx.from.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `📞 ¡Reserva una Videollamada 1:1!

Conéctate directamente con Santino o Lex para una sesión privada.

Escribe /call para reservar tu espacio.`;
    } else {
      message = `📞 Book a 1:1 Video Call!

Connect directly with Santino or Lex for a private session.

Type /call to book your spot.`;
    }

    // Answer the callback query
    await ctx.answerCbQuery();

    // Try to send private message
    try {
      await ctx.telegram.sendMessage(userId, message);
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message);

      // Auto-delete after 3 minutes
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
          logger.debug('Book Call message auto-deleted', { messageId: sentMessage.message_id });
        } catch (delError) {
          logger.debug('Could not delete message:', delError.message);
        }
      }, AUTO_DELETE_DELAY);
    }

  } catch (error) {
    logger.error('Error handling Book Call action:', error);
  }
}

/**
 * Handle "Setup Profile" action
 */
async function handleSetupProfileAction(ctx) {
  try {
    const userId = ctx.from.id;
    const userLang = ctx.from.language_code || 'en';
    const isSpanish = userLang.startsWith('es');

    let message;
    if (isSpanish) {
      message = `⚙️ ¡Configura tu Perfil!

Personaliza tu experiencia, actualiza tu ubicación y preferencias.

Escribe /profile para comenzar.`;
    } else {
      message = `⚙️ Setup Your Profile!

Customize your experience, update your location and preferences.

Type /profile to get started.`;
    }

    // Answer the callback query
    await ctx.answerCbQuery();

    // Try to send private message
    try {
      await ctx.telegram.sendMessage(userId, message);
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message);

      // Auto-delete after 3 minutes
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, sentMessage.message_id);
          logger.debug('Setup Profile message auto-deleted', { messageId: sentMessage.message_id });
        } catch (delError) {
          logger.debug('Could not delete message:', delError.message);
        }
      }, AUTO_DELETE_DELAY);
    }

  } catch (error) {
    logger.error('Error handling Setup Profile action:', error);
  }
}

/**
 * Handle new members joining the group
 */
async function handleNewMembers(ctx) {
  try {
    // Only process in the configured group
    if (GROUP_ID && ctx.chat.id.toString() !== GROUP_ID) {
      return;
    }

    const newMembers = ctx.message.new_chat_members;

    for (const member of newMembers) {
      // Skip if the new member is a bot
      if (member.is_bot) {
        continue;
      }

      // Create or update user in database
      try {
        await UserModel.createOrUpdate({
          telegramId: member.id,
          username: member.username,
          firstName: member.first_name,
          lastName: member.last_name,
        });
        logger.info('User created/updated on join', { userId: member.id });
      } catch (error) {
        logger.error('Error creating/updating user:', error);
      }

      // Send welcome message
      await sendWelcomeMessage(ctx, member);
    }

  } catch (error) {
    logger.error('Error handling new members:', error);
  }
}

/**
 * Register group welcome handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerGroupWelcomeHandlers = (bot) => {
  // Handle new members joining
  bot.on('new_chat_members', handleNewMembers);

  // Handle badge selection callbacks
  bot.action(/^badge_select_(.+)$/, handleBadgeSelection);

  // Handle action button callbacks
  bot.action('welcome_get_prime', handleGetPrimeAction);
  bot.action('welcome_book_call', handleBookCallAction);
  bot.action('welcome_setup_profile', handleSetupProfileAction);

  logger.info('Group welcome handlers registered');
};

module.exports = registerGroupWelcomeHandlers;
