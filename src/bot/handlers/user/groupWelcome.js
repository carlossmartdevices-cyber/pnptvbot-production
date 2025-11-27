const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const logger = require('../../../utils/logger');

// Configuration
const GROUP_ID = process.env.GROUP_ID;
const AUTO_DELETE_DELAY = 3 * 60 * 1000; // 3 minutes

// Deduplication: track recently processed joins to avoid duplicate welcomes
const recentJoins = new Map(); // Map<`${chatId}_${userId}`, timestamp>
const DEDUPE_WINDOW = 5 * 60 * 1000; // 5 minutes window to prevent duplicates (increased from 60s)

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentJoins.entries()) {
    if (now - timestamp > DEDUPE_WINDOW) {
      recentJoins.delete(key);
    }
  }
}, 10 * 60 * 1000);

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

    const message = `\`💎 Unlock PRIME\`

Unlock the full PNPtv! experience and join the hottest Latino PnP community on Telegram — unfiltered, intimate, raw, and always active.

**As a PRIME member, you get instant access to:**

• Full-length videos (Santino + sexy Latino performers)
• Weekly new content drops
• Unlimited Nearby access
• Your interactive community profile
• Video Calls & Live Streams with hot performers
• The ability to host radio podcasts, video call rooms, or live stream shows directly from our platform
• Member-only perks, exclusive events, and premium tools

Choose the plan that fits you best.
Pay with debit/credit card, crypto, popular pay apps — and soon PayPal.

\`Membership Plans\``;

    // Create inline keyboard with plan buttons
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🧪 Trial Week — $14.99 — 7 Days', 'plan_trial')],
      [Markup.button.callback('💎 Monthly PRIME — $24.99 — 30 Days', 'plan_monthly')],
      [Markup.button.callback('💠 Crystal PRIME — $49.99 — 90 Days', 'plan_crystal')],
      [Markup.button.callback('🔥 Diamond PRIME — $99.99 — 180 Days', 'plan_diamond')],
      [Markup.button.callback('♾️ Lifetime PRIME — $249.99 Promo — Forever', 'plan_lifetime')],
    ]);

    // Answer the callback query
    await ctx.answerCbQuery();

    // Try to send private message with buttons
    try {
      await ctx.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });

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
    const message = `\`📹 Book a Video Call\`

**Coming This Weekend!**

Private 1:1 video calls with Santino and other hot performers will be available very soon.

_Stay tuned — this feature drops this weekend!_`;

    // Answer the callback query
    await ctx.answerCbQuery('Coming this weekend! 🔥', { show_alert: true });

    // Try to send private message
    try {
      await ctx.telegram.sendMessage(ctx.from.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

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
    const message = `\`👤 My PNPtv Profile\`

Your PNPtv! profile is your identity inside the community.
It will be automatically linked under every photo you share in the group, helping other members discover who you are and connect with you.

This section also shows your subscription status and the benefits included in your current membership tier.

**Your profile includes:**
• Bio, interests, tribe & what you're looking for
• Your profile picture
• Your social links
• Your membership tier and perks
• A shareable community profile card`;

    // Create inline keyboard with profile options
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📝 Update Profile', 'profile_update_bio'),
        Markup.button.callback('📸 Update Picture', 'profile_update_picture')
      ],
      [
        Markup.button.callback('🔗 Social Media', 'profile_social_links'),
        Markup.button.callback('⚙️ Profile Settings', 'profile_settings')
      ],
      [
        Markup.button.callback('🖨️ Print My Profile', 'profile_print_card'),
        Markup.button.callback('⭐ Apply to PNP Contacto!', 'profile_apply_contacto')
      ]
    ]);

    // Answer the callback query
    await ctx.answerCbQuery();

    // Try to send private message with buttons
    try {
      await ctx.telegram.sendMessage(ctx.from.id, message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.debug('Could not send private message:', error.message);

      // If can't send PM, inform in group
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });

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
    const chatId = ctx.chat.id;
    const updateId = ctx.update?.update_id;

    logger.info('New chat members event received', {
      chatId,
      updateId,
      memberCount: newMembers?.length,
      members: newMembers?.map(m => ({ id: m.id, name: m.first_name }))
    });

    for (const member of newMembers) {
      // Skip if the new member is a bot
      if (member.is_bot) {
        logger.debug('Skipping bot member', { botId: member.id });
        continue;
      }

      // Deduplication check - prevent duplicate welcome messages
      const dedupeKey = `${chatId}_${member.id}`;
      const lastJoinTime = recentJoins.get(dedupeKey);
      const now = Date.now();

      if (lastJoinTime && (now - lastJoinTime) < DEDUPE_WINDOW) {
        logger.warn('DUPLICATE WELCOME PREVENTED', { 
          userId: member.id, 
          chatId,
          updateId,
          timeSinceLastJoin: now - lastJoinTime,
          dedupeKey
        });
        continue;
      }

      // Mark this join as processed BEFORE sending messages
      recentJoins.set(dedupeKey, now);
      logger.info('Processing new member welcome', { 
        userId: member.id, 
        username: member.first_name,
        dedupeKey,
        updateId
      });

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
