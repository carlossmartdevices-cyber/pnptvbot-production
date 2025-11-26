const { requirePrivateChat } = require('../../utils/notifications');
const { getBackButton } = require('../../utils/menus');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle profile command
 */
const registerProfileHandlers = (bot) => {
  // Show profile
  bot.action('show_profile', async (ctx) => {
    try {
      await showProfile(ctx, true);
    } catch (error) {
      logger.error('Error showing profile:', error);
    }
  });

  // Edit profile actions
  bot.action('edit_photo', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForPhoto = true;
      await ctx.saveSession();

      await ctx.editMessageText(t('sendPhoto', lang));
    } catch (error) {
      logger.error('Error in edit photo:', error);
    }
  });

  bot.action('edit_bio', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForBio = true;
      await ctx.saveSession();

      await ctx.editMessageText(t('sendBio', lang));
    } catch (error) {
      logger.error('Error in edit bio:', error);
    }
  });

  bot.action('edit_location', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForLocation = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        t('sendLocation', lang),
        Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_profile')],
        ]),
      );
    } catch (error) {
      logger.error('Error in edit location:', error);
    }
  });

  bot.action('edit_interests', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForInterests = true;
      await ctx.saveSession();

      await ctx.editMessageText(t('sendInterests', lang));
    } catch (error) {
      logger.error('Error in edit interests:', error);
    }
  });

  // Social Media Handlers
  bot.action('edit_social', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await showSocialMediaMenu(ctx, lang);
    } catch (error) {
      logger.error('Error showing social media menu:', error);
    }
  });

  bot.action('edit_tiktok', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForTikTok = true;
      await ctx.saveSession();
      await ctx.editMessageText(
        lang === 'es'
          ? '📱 Envía tu nombre de usuario de TikTok (sin @) o "borrar" para eliminar.\nEjemplo: miperfil'
          : '📱 Send your TikTok username (without @) or "delete" to remove.\nExample: myprofile'
      );
    } catch (error) {
      logger.error('Error in edit tiktok:', error);
    }
  });

  bot.action('edit_twitter', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForTwitter = true;
      await ctx.saveSession();
      await ctx.editMessageText(
        lang === 'es'
          ? '🐦 Envía tu nombre de usuario de X/Twitter (sin @) o "borrar" para eliminar.\nEjemplo: miperfil'
          : '🐦 Send your X/Twitter username (without @) or "delete" to remove.\nExample: myprofile'
      );
    } catch (error) {
      logger.error('Error in edit twitter:', error);
    }
  });

  bot.action('edit_facebook', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForFacebook = true;
      await ctx.saveSession();
      await ctx.editMessageText(
        lang === 'es'
          ? '📘 Envía tu nombre de usuario de Facebook o "borrar" para eliminar.\nEjemplo: miperfil'
          : '📘 Send your Facebook username or "delete" to remove.\nExample: myprofile'
      );
    } catch (error) {
      logger.error('Error in edit facebook:', error);
    }
  });

  bot.action('edit_instagram', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForInstagram = true;
      await ctx.saveSession();
      await ctx.editMessageText(
        lang === 'es'
          ? '📷 Envía tu nombre de usuario de Instagram (sin @) o "borrar" para eliminar.\nEjemplo: miperfil'
          : '📷 Send your Instagram username (without @) or "delete" to remove.\nExample: myprofile'
      );
    } catch (error) {
      logger.error('Error in edit instagram:', error);
    }
  });

  // Handle photo upload
  bot.on('photo', async (ctx, next) => {
    if (ctx.session.temp?.waitingForPhoto) {
      try {
        const lang = getLanguage(ctx);
        const photo = ctx.message.photo[ctx.message.photo.length - 1];

        await UserService.updateProfile(ctx.from.id, {
          photoFileId: photo.file_id,
        });

        ctx.session.temp.waitingForPhoto = false;
        await ctx.saveSession();

        await ctx.reply(t('photoUpdated', lang));
        await showProfile(ctx, false);
      } catch (error) {
        logger.error('Error updating photo:', error);
      }
      return;
    }

    return next();
  });

  // Handle location
  bot.on('location', async (ctx, next) => {
    if (ctx.session.temp?.waitingForLocation) {
      try {
        const lang = getLanguage(ctx);
        const { latitude, longitude } = ctx.message.location;

        const result = await UserService.updateLocation(ctx.from.id, {
          lat: latitude,
          lng: longitude,
        });

        ctx.session.temp.waitingForLocation = false;
        await ctx.saveSession();

        if (result.success) {
          await ctx.reply(t('locationUpdated', lang));
          await showProfile(ctx, false);
        } else {
          await ctx.reply(t('error', lang));
        }
      } catch (error) {
        logger.error('Error updating location:', error);
      }
      return;
    }

    return next();
  });

  // Handle text inputs (bio, interests)
  bot.on('text', async (ctx, next) => {
    const { temp } = ctx.session;

    if (temp?.waitingForBio) {
      try {
        const lang = getLanguage(ctx);
        const bio = validateUserInput(ctx.message.text, 1000);

        if (!bio) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await UserService.updateProfile(ctx.from.id, { bio });

        ctx.session.temp.waitingForBio = false;
        await ctx.saveSession();

        await ctx.reply(t('bioUpdated', lang));
        await showProfile(ctx, false);
      } catch (error) {
        logger.error('Error updating bio:', error);
      }
      return;
    }

    if (temp?.waitingForInterests) {
      try {
        const lang = getLanguage(ctx);
        const inputText = validateUserInput(ctx.message.text, 500);

        if (!inputText) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        const interests = inputText
          .split(',')
          .map((i) => i.trim())
          .filter((i) => i.length > 0)
          .slice(0, 10);

        if (interests.length === 0) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await UserService.updateProfile(ctx.from.id, { interests });

        ctx.session.temp.waitingForInterests = false;
        await ctx.saveSession();

        await ctx.reply(t('interestsUpdated', lang));
        await showProfile(ctx, false);
      } catch (error) {
        logger.error('Error updating interests:', error);
      }
      return;
    }

    // Social Media Handlers
    if (temp?.waitingForTikTok) {
      try {
        const lang = getLanguage(ctx);
        const input = validateUserInput(ctx.message.text, 100);

        if (input && (input.toLowerCase() === 'delete' || input.toLowerCase() === 'borrar')) {
          await UserService.updateProfile(ctx.from.id, { tiktok: null });
          ctx.session.temp.waitingForTikTok = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ TikTok eliminado' : '✅ TikTok removed');
        } else if (input) {
          const username = input.replace('@', '').trim();
          await UserService.updateProfile(ctx.from.id, { tiktok: username });
          ctx.session.temp.waitingForTikTok = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ TikTok actualizado' : '✅ TikTok updated');
        } else {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating TikTok:', error);
      }
      return;
    }

    if (temp?.waitingForTwitter) {
      try {
        const lang = getLanguage(ctx);
        const input = validateUserInput(ctx.message.text, 100);

        if (input && (input.toLowerCase() === 'delete' || input.toLowerCase() === 'borrar')) {
          await UserService.updateProfile(ctx.from.id, { twitter: null });
          ctx.session.temp.waitingForTwitter = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ X/Twitter eliminado' : '✅ X/Twitter removed');
        } else if (input) {
          const username = input.replace('@', '').trim();
          await UserService.updateProfile(ctx.from.id, { twitter: username });
          ctx.session.temp.waitingForTwitter = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ X/Twitter actualizado' : '✅ X/Twitter updated');
        } else {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating Twitter:', error);
      }
      return;
    }

    if (temp?.waitingForFacebook) {
      try {
        const lang = getLanguage(ctx);
        const input = validateUserInput(ctx.message.text, 100);

        if (input && (input.toLowerCase() === 'delete' || input.toLowerCase() === 'borrar')) {
          await UserService.updateProfile(ctx.from.id, { facebook: null });
          ctx.session.temp.waitingForFacebook = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Facebook eliminado' : '✅ Facebook removed');
        } else if (input) {
          const username = input.trim();
          await UserService.updateProfile(ctx.from.id, { facebook: username });
          ctx.session.temp.waitingForFacebook = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Facebook actualizado' : '✅ Facebook updated');
        } else {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating Facebook:', error);
      }
      return;
    }

    if (temp?.waitingForInstagram) {
      try {
        const lang = getLanguage(ctx);
        const input = validateUserInput(ctx.message.text, 100);

        if (input && (input.toLowerCase() === 'delete' || input.toLowerCase() === 'borrar')) {
          await UserService.updateProfile(ctx.from.id, { instagram: null });
          ctx.session.temp.waitingForInstagram = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Instagram eliminado' : '✅ Instagram removed');
        } else if (input) {
          const username = input.replace('@', '').trim();
          await UserService.updateProfile(ctx.from.id, { instagram: username });
          ctx.session.temp.waitingForInstagram = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Instagram actualizado' : '✅ Instagram updated');
        } else {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating Instagram:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show social media menu
 */
const showSocialMediaMenu = async (ctx, lang) => {
  try {
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    let text = lang === 'es'
      ? '📱 *Redes Sociales*\n\nEdita tus redes sociales:\n\n'
      : '📱 *Social Media*\n\nEdit your social media:\n\n';

    text += user.tiktok ? `📱 TikTok: @${user.tiktok}\n` : '📱 TikTok: -\n';
    text += user.twitter ? `🐦 X: @${user.twitter}\n` : '🐦 X: -\n';
    text += user.facebook ? `📘 Facebook: ${user.facebook}\n` : '📘 Facebook: -\n';
    text += user.instagram ? `📷 Instagram: @${user.instagram}\n` : '📷 Instagram: -\n';

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📱 TikTok', 'edit_tiktok'),
        Markup.button.callback('🐦 X', 'edit_twitter'),
      ],
      [
        Markup.button.callback('📘 Facebook', 'edit_facebook'),
        Markup.button.callback('📷 Instagram', 'edit_instagram'),
      ],
      [Markup.button.callback(t('back', lang), 'show_profile')],
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } catch (error) {
    logger.error('Error showing social media menu:', error);
  }
};

/**
 * Show user profile
 * @param {Context} ctx - Telegraf context
 * @param {boolean} edit - Whether to edit existing message
 */
const showProfile = async (ctx, edit = true) => {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    if (!user) {
      await ctx.reply('User not found. Please /start first.');
      return;
    }

    // Check if command is in group chat
    const isPrivate = await requirePrivateChat(
      ctx,
      'My Profile',
      '' // Will be set below
    );

    // Build profile text with consistent design
    let profileText = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      isOwnProfile ? '👤 My Profile' : '👤 User Profile',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      targetUser.badges && targetUser.badges.length > 0
        ? targetUser.badges.map(badge => (typeof badge === 'object' && badge.icon ? `${badge.icon} ${badge.name}` : t(`badges.${badge}`, lang))).filter(Boolean).join(' ') : '',
      `👤 ${targetUser.firstName || 'User'} ${targetUser.lastName || ''}`,
      targetUser.username ? `@${targetUser.username}` : '',
      targetUser.bio && (isOwnProfile || targetUser.privacy?.showBio !== false) ? `📝 ${targetUser.bio}` : '',
      targetUser.looking_for && (isOwnProfile || targetUser.privacy?.showBio !== false) ? `${lang === 'es' ? '🔎 Buscado' : '🔎 Looking for'}: ${targetUser.looking_for}` : '',
      targetUser.interests && targetUser.interests.length > 0 && (isOwnProfile || targetUser.privacy?.showInterests !== false)
        ? `🎯 ${targetUser.interests.join(', ')}` : '',
      targetUser.location && (isOwnProfile || targetUser.privacy?.showLocation !== false) ? '📍 Location shared' : '',
      targetUser.subscriptionStatus === 'active' && targetUser.planExpiry
        ? (() => {
            let expiry;
            if (targetUser.planExpiry.toDate && typeof targetUser.planExpiry.toDate === 'function') {
              expiry = targetUser.planExpiry.toDate();
            } else if (targetUser.planExpiry._seconds) {
              expiry = new Date(targetUser.planExpiry._seconds * 1000);
            } else {
              expiry = new Date(targetUser.planExpiry);
            }
            return expiry && !isNaN(expiry.getTime())
              ? `💎 PRIME: ${t('subscriptionActive', lang, { expiry: moment(expiry).format('MMM DD, YYYY') })}`
              : (isOwnProfile ? '⭐ Free Plan' : '');
          })()
        : (isOwnProfile ? '⭐ Free Plan' : ''),
      isOwnProfile ? `${t('profileViews', lang, { views: targetUser.profileViews || 0 })}` : '',
      ''
    ].filter(Boolean).join('\n');

    // Add social media section (only show if any are filled)
    const hasSocialMedia = targetUser.tiktok || targetUser.twitter || targetUser.facebook || targetUser.instagram;
    if (hasSocialMedia) {
      profileText += '\n📱 Social Media:\n';
      if (targetUser.tiktok) profileText += `  TikTok: @${targetUser.tiktok}\n`;
      if (targetUser.twitter) profileText += `  X: @${targetUser.twitter}\n`;
      if (targetUser.facebook) profileText += `  Facebook: ${targetUser.facebook}\n`;
      if (targetUser.instagram) profileText += `  Instagram: @${targetUser.instagram}\n`;
    }
    // Parse createdAt date
    let createdAtDate;
    if (targetUser.createdAt) {
      if (typeof targetUser.createdAt === 'object' && typeof targetUser.createdAt.toDate === 'function') {
        createdAtDate = targetUser.createdAt.toDate();
      } else if (targetUser.createdAt._seconds) {
        createdAtDate = new Date(targetUser.createdAt._seconds * 1000);
      } else if (typeof targetUser.createdAt === 'string' || typeof targetUser.createdAt === 'number') {
        createdAtDate = new Date(targetUser.createdAt);
      }
    }
    const validDate = createdAtDate && !isNaN(createdAtDate.getTime())
      ? moment(createdAtDate).format('MMM DD, YYYY')
      : 'Recently';
    profileText += `${t('memberSince', lang, { date: validDate })}\n`;

    // Build keyboard
    const keyboard = [];

    if (isOwnProfile) {
      // Own profile - edit options
      keyboard.push([
        Markup.button.callback(t('editPhoto', lang), 'edit_photo'),
        Markup.button.callback(t('editBio', lang), 'edit_bio'),
        Markup.button.callback(lang === 'es' ? 'Editar Buscado' : 'Edit Looking For', 'edit_looking_for'),
      ]);
      keyboard.push([
        Markup.button.callback(t('editLocation', lang), 'edit_location'),
        Markup.button.callback(t('editInterests', lang), 'edit_interests'),
      ]);
      keyboard.push([
        Markup.button.callback(lang === 'es' ? '📱 Redes Sociales' : '📱 Social Media', 'edit_social'),
      ]);
      keyboard.push([
        Markup.button.callback(t('privacySettings', lang), 'privacy_settings'),
      ]);
      keyboard.push([
        Markup.button.callback(t('shareProfile', lang), 'share_profile'),
      ]);
      keyboard.push([
        Markup.button.callback(t('myFavorites', lang), 'show_favorites'),
        Markup.button.callback(t('blockedUsers', lang), 'show_blocked'),
      ]);
      keyboard.push([Markup.button.callback(t('back', lang), 'back_to_main')]);
    } else {
      // Other user's profile - interaction options
      const viewer = await UserModel.getById(viewerId);
      const isFavorite = viewer.favorites && viewer.favorites.includes(targetUserId.toString());

      if (isFavorite) {
        keyboard.push([Markup.button.callback(t('removeFromFavorites', lang), `remove_favorite_${targetUserId}`)]);
      } else {
        keyboard.push([Markup.button.callback(t('addToFavorites', lang), `add_favorite_${targetUserId}`)]);
      }

    // Format profile message
    const profileMessage = formatProfileMessage(user, language);

    await ctx.reply(profileMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: language === 'es' ? '✏️ Editar Perfil' : '✏️ Edit Profile', callback_data: 'edit_profile' }],
          [{ text: language === 'es' ? '🔙 Menú Principal' : '🔙 Main Menu', callback_data: 'back_main' }],
        ],
      },
    });

    logger.info(`User ${userId} viewed profile`);
  } catch (error) {
    logger.error('Error in profile command:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Format profile message
 */
function formatProfileMessage(user, language) {
  const labels = {
    en: {
      title: '👤 **Your Profile**',
      username: 'Username',
      bio: 'Bio',
      age: 'Age',
      plan: 'Plan',
      status: 'Subscription Status',
      expiry: 'Expires',
      location: 'Location',
      joined: 'Joined',
    },
    es: {
      title: '👤 **Tu Perfil**',
      username: 'Nombre de usuario',
      bio: 'Biografía',
      age: 'Edad',
      plan: 'Plan',
      status: 'Estado de Suscripción',
      expiry: 'Expira',
      location: 'Ubicación',
      joined: 'Se unió',
    },
  };

  const l = labels[language] || labels.en;
  const planName = user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free';
  const status = user.subscriptionStatus || 'inactive';
  const statusEmoji = status === 'active' ? '✅' : '❌';

  let message = `${l.title}\n\n`;
  message += `**${l.username}:** ${user.username || 'Not set'}\n`;
  message += `**${l.bio}:** ${user.bio || 'Not set'}\n`;
  message += `**${l.age}:** ${user.age || 'Not set'}\n`;
  message += `**${l.plan}:** ${planName}\n`;
  message += `**${l.status}:** ${statusEmoji} ${status}\n`;

  if (user.planExpiry) {
    const expiryDate = new Date(user.planExpiry).toLocaleDateString();
    message += `**${l.expiry}:** ${expiryDate}\n`;
  }

  if (user.location) {
    message += `**${l.location}:** ${language === 'es' ? 'Compartido' : 'Shared'}\n`;
  }

  if (user.createdAt) {
    const joinedDate = new Date(user.createdAt).toLocaleDateString();
    message += `**${l.joined}:** ${joinedDate}\n`;
  }

  return message;
}

/**
 * Handle edit profile
 */
async function handleEditProfile(ctx) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    const labels = {
      en: {
        message: 'What would you like to edit?',
        username: '✏️ Username',
        bio: '✏️ Bio',
        location: '📍 Location',
        back: '🔙 Back to Profile',
      },
      es: {
        message: '¿Qué te gustaría editar?',
        username: '✏️ Nombre de usuario',
        bio: '✏️ Biografía',
        location: '📍 Ubicación',
        back: '🔙 Volver al Perfil',
      },
    };

    const l = labels[language] || labels.en;

    await ctx.editMessageText(l.message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: l.username, callback_data: 'edit_username' }],
          [{ text: l.bio, callback_data: 'edit_bio' }],
          [{ text: l.location, callback_data: 'edit_location' }],
          [{ text: l.back, callback_data: 'menu_profile' }],
        ],
      },
    });

    logger.info(`User ${userId} entered profile edit mode`);
  } catch (error) {
    logger.error('Error in edit profile:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Handle edit field selection
 */
async function handleEditField(ctx) {
  try {
    const userId = ctx.from.id;
    const field = ctx.callbackQuery.data.split('_')[1]; // 'edit_username' -> 'username'
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    const prompts = {
      en: {
        username: 'Enter your new username:',
        bio: 'Enter your new bio:',
        location: 'Share your new location:',
      },
      es: {
        username: 'Ingresa tu nuevo nombre de usuario:',
        bio: 'Ingresa tu nueva biografía:',
        location: 'Comparte tu nueva ubicación:',
      },
    };

    const prompt = prompts[language]?.[field] || prompts.en[field];

    await ctx.editMessageText(prompt);

    // Save session state
    await ctx.saveSession({ editingField: field, language });

    logger.info(`User ${userId} editing field: ${field}`);
  } catch (error) {
    logger.error('Error in edit field:', error);
    await ctx.answerCbQuery(i18n.t('error_occurred', 'en'));
  }
}

/**
 * Share profile - Generate Member Card with Photo (Pseudo-code format)
 */
async function handleProfileUpdate(ctx, field, value) {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    await ctx.answerCbQuery();

    // Build clean pseudo-code style Member Card
    let cardText = '';

    // Header
    cardText += `╔════════════════════════════════╗\n`;
    cardText += `║      💎  MEMBER  PROFILE      ║\n`;
    cardText += `╚════════════════════════════════╝\n\n`;

    // Badges section
    if (user.badges && user.badges.length > 0) {
      const badgeList = user.badges.map((badge) => {
        if (typeof badge === 'string') {
          const badgeKey = `badges.${badge}`;
          return t(badgeKey, lang);
        }
        if (typeof badge === 'object' && badge.icon && badge.name) {
          return `${badge.icon} ${badge.name}`;
        }
        return '';
      }).filter(Boolean).join('  ');
      cardText += `${badgeList}\n\n`;
    }

    // Main Profile Section
    cardText += `<b>// USER IDENTITY</b>\n`;
    cardText += `name: "${user.firstName || 'User'}${user.lastName ? ' ' + user.lastName : ''}"\n`;
    if (user.username) cardText += `handle: "@${user.username}"\n`;

    // Membership status
    if (user.subscriptionStatus === 'active' && user.planExpiry) {
      try {
        let expiry;
        if (user.planExpiry.toDate && typeof user.planExpiry.toDate === 'function') {
          expiry = user.planExpiry.toDate();
        } else if (user.planExpiry._seconds) {
          expiry = new Date(user.planExpiry._seconds * 1000);
        } else {
          expiry = new Date(user.planExpiry);
        }

        if (expiry && !isNaN(expiry.getTime())) {
          cardText += `status: "💎 PRIME"\n`;
          cardText += `expires: "${moment(expiry).format('MMM DD, YYYY')}"\n`;
        }
      } catch (error) {
        logger.warn('Error parsing planExpiry in share:', error);
        cardText += `status: "⭐ FREE"\n`;
      }
    } else {
      cardText += `status: "⭐ FREE"\n`;
    }

    // Bio section
    if (user.bio) {
      cardText += `\n<b>// ABOUT</b>\n`;
      const escapedBio = user.bio.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cardText += `bio: "${escapedBio}"\n`;
    }

    // Looking for section
    if (user.looking_for) {
      cardText += `\n<b>// SEEKING</b>\n`;
      const escapedLookingFor = user.looking_for.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cardText += `looking_for: "${escapedLookingFor}"\n`;
    }

    // Interests section
    if (user.interests && user.interests.length > 0) {
      cardText += `\n<b>// INTERESTS</b>\n`;
      const escapedInterests = user.interests.map(i =>
        i.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      );
      cardText += `interests: [\n`;
      escapedInterests.forEach((interest, index) => {
        const comma = index < escapedInterests.length - 1 ? ',' : '';
        cardText += `  "${interest}"${comma}\n`;
      });
      cardText += `]\n`;
    }

    // Social media section (only show if any are filled)
    const hasSocialMedia = user.tiktok || user.twitter || user.facebook || user.instagram;
    if (hasSocialMedia) {
      cardText += `\n<b>// SOCIAL MEDIA</b>\n`;
      cardText += `connect: {\n`;
      if (user.tiktok) cardText += `  tiktok: "@${user.tiktok}",\n`;
      if (user.twitter) cardText += `  x: "@${user.twitter}",\n`;
      if (user.facebook) cardText += `  facebook: "${user.facebook}",\n`;
      if (user.instagram) cardText += `  instagram: "@${user.instagram}",\n`;
      cardText += `}\n`;
    }

    // Footer with profile link
    cardText += `\n<b>// ACTIONS</b>\n`;
    cardText += `view_profile() {\n`;
    cardText += `  url: "https://t.me/${ctx.botInfo.username}?start=viewprofile_${ctx.from.id}"\n`;
    cardText += `}\n\n`;
    cardText += `─────────────────────────────────\n`;
    cardText += `🎬 <b>PNPtv!</b> | Entertainment Hub`;

    // Share keyboard
    const shareKeyboard = Markup.inlineKeyboard([
      [Markup.button.switchToChat(
        t('shareProfileCard', lang) || '📤 Share Profile Card',
        cardText,
      )],
      [Markup.button.callback(t('back', lang), 'show_profile')],
    ]);

    // Check if user has a profile photo
    if (user.photoFileId) {
      // Send with photo
      await ctx.replyWithPhoto(user.photoFileId, {
        caption: cardText,
        parse_mode: 'HTML',
        ...shareKeyboard,
      });
    } else {
      // Send without photo (text only)
      await ctx.reply(cardText, {
        parse_mode: 'HTML',
        ...shareKeyboard,
      });
    }
  } catch (error) {
    logger.error('Error updating profile:', error);
    await ctx.reply(i18n.t('error_occurred', 'en'));
  }
}

module.exports = {
  handleProfile,
  handleEditProfile,
  handleEditField,
  handleProfileUpdate,
  formatProfileMessage,
};
