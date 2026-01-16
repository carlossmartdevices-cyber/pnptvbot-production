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
  // Handle new members joining the group via message (traditional way)
  bot.on('new_chat_members', handleNewMembers);

  // Also handle chat_member updates (webhook-compatible way)
  bot.on('chat_member', handleChatMemberUpdate);

  // Handle badge selection
  bot.action(/^badge_select_(.+)$/, handleBadgeSelection);

  // Handle view rules button
  bot.action('group_view_rules', handleViewRules);
};

/**
 * Handle chat member updates (webhook-compatible way to detect new members)
 * This catches join/leave events from chat_member updates
 */
async function handleChatMemberUpdate(ctx) {
  try {
    const chatMember = ctx.chatMember;
    if (!chatMember) return;

    const chatType = ctx.chat?.type;
    // Only works in groups
    if (!chatType || (chatType !== 'group' && chatType !== 'supergroup')) {
      return;
    }

    const newMember = chatMember.new_chat_member;
    const oldMember = chatMember.old_chat_member;

    // Check if this is a join event (user was not in chat before, now is)
    const wasInChat = oldMember?.status && ['member', 'administrator', 'creator'].includes(oldMember.status);
    const isNowInChat = newMember?.status && ['member', 'administrator', 'creator'].includes(newMember.status);

    if (!wasInChat && isNowInChat) {
      // User joined the group
      const member = newMember.user;
      if (!member || member.is_bot) {
        // Let bot removal be handled by the other handler if needed
        return;
      }

      logger.debug('New member detected via chat_member update', {
        userId: member.id,
        username: member.username,
        chatId: ctx.chat.id,
      });

      // Process the new member using same logic as message-based handler
      await processNewMember(ctx, member);
    }
  } catch (error) {
    logger.error('Error handling chat member update:', error);
  }
}

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
      await processNewMember(ctx, member);
    }
  } catch (error) {
    logger.error('Error handling new members:', error);
  }
}

/**
 * Process a new member joining (shared logic for both message and chat_member update handlers)
 */
async function processNewMember(ctx, member) {
  try {
    // Remove all bots from the group (except this bot)
    if (member.is_bot) {
      try {
        await ctx.kickChatMember(member.id);

        // Send notification about bot removal
        const botName = member.first_name || 'Bot';
        const message = `🚫 **Bot Removed**\n\nNo other bots are allowed in this group. Only the official PNPtv bot is permitted.`;

        const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

        // Auto-delete notification after 2 minutes
        ChatCleanupService.scheduleBotMessage(ctx.telegram, sentMessage, 2 * 60 * 1000);

        logger.info('Bot removed from group', {
          botName,
          botId: member.id,
          chatId: ctx.chat.id,
        });
      } catch (error) {
        logger.error('Error removing bot from group:', error);
      }
      return;
    }

    // Get or create user
    const user = await UserModel.createOrUpdate({
      userId: member.id,
      username: member.username,
      firstName: member.first_name,
      lastName: member.last_name,
    });

    if (!user) {
      logger.error('Failed to get/create user for new member', { userId: member.id });
      return;
    }

    const lang = user.language || 'en';
    const username = member.first_name || 'Friend';

    // Send welcome message
    await sendWelcomeMessage(ctx, username, user, lang);

    // Send badge selection message
    await sendBadgeSelectionMessage(ctx, username, lang);
  } catch (error) {
    logger.error('Error processing new member:', error);
  }
}

/**
 * Send welcome message with membership info
 * Only sends once per user (tracked via ChatCleanupService)
 */
async function sendWelcomeMessage(ctx, username, user, lang) {
  try {
    const userId = user.userId;
    
    // Check if user has already received welcome message
    if (ChatCleanupService.hasReceivedWelcome(userId)) {
      logger.debug('Welcome message already sent to user', { userId });
      return; // Skip if already welcomed
    }

    const subscriptionStatus = user.subscriptionStatus === 'active' ? 'PRIME Member' : 'Free Member';

    const message = lang === 'es'
      ? `👋 Ey ${username}, bienvenidx a PNPtv!

Aquí la vuelta es simple: gente real, buena vibra, cero filtro. Antes de meterte de lleno, mira cómo entras hoy:

⭐ Tu membresía actual:

${subscriptionStatus}

🔥 Lo que tienes por ahora:

• Acceso al grupo
• Contenido corto
• Music Library gratis
• 3 vistas en Nearby

💎 Si te haces PRIME, desbloqueas:

• Videos completos de Santino, Lex y la comunidad
• Nearby ilimitado
• Hangouts privados (video rooms)
• Videorama 24/7 (streaming de música y videos)
• Canal PRIME exclusivo
• Música + Podcasts premium
• Contenido exclusivo que no sale en ningún otro lado
• Soporte prioritario

💰 Planes desde solo $14.99 USD/mes
💎 Lifetime Pass: $100 USD (acceso de por vida)

Si te quieres meter más duro en la comunidad:
👉 /subscribe`
      : `👋 Hey ${username}, welcome to PNPtv!

This place is simple: real people, real vibes, no filters. Before you jump in, here's how you're entering today:

⭐ Your current membership:

${subscriptionStatus}

🔥 What you get right now:

• Group access
• Short content
• Free Music Library
• 3 views in Nearby Members

💎 If you go PRIME, you unlock:

• Full-length videos from Santino, Lex, and the community
• Unlimited Nearby Members
• Private Hangouts (video rooms)
• Videorama 24/7 (music & video streaming)
• PRIME Channel (exclusive posts)
• Premium Music & Podcasts
• Exclusive content you won't see anywhere else
• Priority Support

💰 Plans start at just $14.99 USD/month
💎 Lifetime Pass: $100 USD (lifetime access)

If you want the full experience:
👉 /subscribe`;

    const sentMessage = await ctx.reply(message, { parse_mode: 'Markdown' });

    // Use 1-minute auto-delete for temporary messages
    ChatCleanupService.scheduleWelcomeMessage(ctx.telegram, sentMessage);

    // Mark user as welcomed
    ChatCleanupService.markWelcomeSent(userId);

    logger.info('Welcome message sent', {
      userId: user.userId,
      chatId: ctx.chat.id,
      language: lang,
      firstTime: true,
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
      ? `👑 Ahora dinos… qué vibra eres tú?

Escoge tu energía y te damos tu primera insignia. Se guarda al instante.`
      : `👑 Tell us… what's your vibe?

Pick your energy and get your first badge. It saves instantly.`;

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

    const sentMessage = await ctx.reply(message, keyboard);

    // Use 1-minute auto-delete for temporary messages
    ChatCleanupService.scheduleMenuMessage(ctx.telegram, sentMessage);

    logger.info('Badge selection message sent', {
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending badge selection message:', error);
  }
}

/**
 * Send photo sharing invitation after badge selection
 */
async function sendPhotoSharingInvitation(ctx, username, lang) {
  try {
    const message = lang === 'es'
      ? `📸 ¡COMPARTE TU ESTILO Y GANA! 📸

💡 ¿Sabías que puedes ser la próxima LEYENDA PNPtv DEL DÍA?

🏆 Cada día seleccionamos UN miembro para ser destacado
🎁 El ganador recibe 1 DÍA GRATIS de acceso PRIME
📢 Tu foto/video será publicada en el Muro de la Fama

👉 Simplemente sube fotos/videos de calidad en el grupo
👉 Usa tu mejor energía y estilo
👉 ¡Sé auténtico y destaca!

💎 ¿Listo para ser el próximo? ¡Sube tu mejor contenido ahora!`
      : `📸 SHARE YOUR STYLE AND WIN! 📸

💡 Did you know you can be the next PNPtv LEGEND OF THE DAY?

🏆 We select ONE member daily to be featured
🎁 The winner gets 1 FREE DAY of PRIME access
📢 Your photo/video will be posted on the Wall of Fame

👉 Just upload quality photos/videos in the group
👉 Show your best energy and style
👉 Be authentic and stand out!

💎 Ready to be next? Upload your best content now!`;

    const sentMessage = await ctx.reply(message);

    // Use 1-minute auto-delete for temporary messages
    ChatCleanupService.scheduleMenuMessage(ctx.telegram, sentMessage);

    logger.info('Photo sharing invitation sent', {
      chatId: ctx.chat.id,
      language: lang,
    });
  } catch (error) {
    logger.error('Error sending photo sharing invitation:', error);
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

    // Send rules menu
    await sendRulesMenu(ctx, lang);

    // Send photo sharing invitation
    await sendPhotoSharingInvitation(ctx, username, lang);

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
      ? `${badge.emoji} Listo ${username}, ya tienes tu primera insignia.

Eres ${badge.name} y oficialmente parte de la familia PNPtv!. Aquí ya entraste de verdad.`
      : `${badge.emoji} Nice ${username} — you just earned your first badge.

You're officially a ${badge.name} and now part of the PNPtv! family for real.`;

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
      ? `📘 *Normas de la Comunidad PNPtv* 📘

💙 *Respeto y Seguridad:*
• Trata a todos con respeto y amabilidad
• Prohibido: discriminación, acoso, lenguaje de odio
• Consentimiento obligatorio para contenido sensible
• Reporta comportamiento inapropiado

💬 *Contenido de Calidad:*
• Prohibido spam o autopromoción excesiva
• Mantén conversaciones relevantes y valiosas
• Comparte contenido significativo y positivo

🛡️ *Normas de la Comunidad:*
• No ventas o promociones externas
• Sigue las reglas de Telegram y PNPtv
• Ayuda a mantener un ambiente positivo

❤️ *Cuidado Personal y Apoyo:*
• Cuídate y cuida a los demás
• Apoya a los miembros de la comunidad
• Recursos de salud mental disponibles`
      : `📘 *PNPtv Community Guidelines* 📘

💙 *Respect & Safety:*
• Be kind and respectful to all members
• No discrimination, harassment, or hate speech
• Consent required for sensitive content
• Report inappropriate behavior

💬 *Quality Content:*
• No spam or excessive self-promotion
• Keep conversations relevant and valuable
• Share meaningful, positive content

🛡️ *Community Standards:*
• No external selling or promotions
• Follow Telegram and PNPtv guidelines
• Help maintain a positive environment

❤️ *Self-Care & Support:*
• Take care of yourself and others
• Support fellow community members
• Mental health resources available`;

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

module.exports = registerGroupWelcomeHandlers;
