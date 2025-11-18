const { Markup } = require('telegraf');
const moment = require('moment');
const UserService = require('../../services/userService');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput } = require('../../utils/helpers');

/**
 * Profile handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerProfileHandlers = (bot) => {
  // Show own profile
  bot.action('show_profile', async (ctx) => {
    try {
      await showProfile(ctx, ctx.from.id, true, true);
    } catch (error) {
      logger.error('Error showing profile:', error);
    }
  });

  // Show privacy settings
  bot.action('privacy_settings', async (ctx) => {
    try {
      await showPrivacySettings(ctx);
    } catch (error) {
      logger.error('Error showing privacy settings:', error);
    }
  });

  // Toggle privacy settings
  bot.action(/^privacy_toggle_(.+)$/, async (ctx) => {
    try {
      const setting = ctx.match[1];
      await togglePrivacySetting(ctx, setting);
    } catch (error) {
      logger.error('Error toggling privacy setting:', error);
    }
  });

  // Show favorites
  bot.action('show_favorites', async (ctx) => {
    try {
      await showFavorites(ctx);
    } catch (error) {
      logger.error('Error showing favorites:', error);
    }
  });

  // Show blocked users
  bot.action('show_blocked', async (ctx) => {
    try {
      await showBlockedUsers(ctx);
    } catch (error) {
      logger.error('Error showing blocked users:', error);
    }
  });

  // View user profile
  bot.action(/^view_user_(\d+)$/, async (ctx) => {
    try {
      const targetUserId = ctx.match[1];
      await showProfile(ctx, targetUserId, true, false);
    } catch (error) {
      logger.error('Error viewing user profile:', error);
    }
  });

  // Add to favorites
  bot.action(/^add_favorite_(\d+)$/, async (ctx) => {
    try {
      const targetUserId = ctx.match[1];
      await addToFavorites(ctx, targetUserId);
    } catch (error) {
      logger.error('Error adding to favorites:', error);
    }
  });

  // Remove from favorites
  bot.action(/^remove_favorite_(\d+)$/, async (ctx) => {
    try {
      const targetUserId = ctx.match[1];
      await removeFromFavorites(ctx, targetUserId);
    } catch (error) {
      logger.error('Error removing from favorites:', error);
    }
  });

  // Block user
  bot.action(/^block_user_(\d+)$/, async (ctx) => {
    try {
      const targetUserId = ctx.match[1];
      await blockUser(ctx, targetUserId);
    } catch (error) {
      logger.error('Error blocking user:', error);
    }
  });

  // Unblock user
  bot.action(/^unblock_user_(\d+)$/, async (ctx) => {
    try {
      const targetUserId = ctx.match[1];
      await unblockUser(ctx, targetUserId);
    } catch (error) {
      logger.error('Error unblocking user:', error);
    }
  });

  // Share profile
  bot.action('share_profile', async (ctx) => {
    try {
      await shareProfile(ctx);
    } catch (error) {
      logger.error('Error sharing profile:', error);
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

      await ctx.answerCbQuery();

      // Send new message with location request keyboard
      await ctx.reply(
        t('sendLocation', lang),
        Markup.keyboard([
          [Markup.button.locationRequest(lang === 'es' ? '📍 Compartir Ubicación' : '📍 Share Location')],
          [lang === 'es' ? '❌ Cancelar' : '❌ Cancel'],
        ]).resize(),
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

  // Handle photo upload
  bot.on('photo', async (ctx, next) => {
    if (ctx.session.temp?.waitingForPhoto) {
      try {
        const lang = getLanguage(ctx);

        // Validate photo exists
        if (!ctx.message?.photo || ctx.message.photo.length === 0) {
          logger.warn('Photo handler triggered but no photo found');
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        const photo = ctx.message.photo[ctx.message.photo.length - 1];

        await UserService.updateProfile(ctx.from.id, {
          photoFileId: photo.file_id,
        });

        ctx.session.temp.waitingForPhoto = false;
        await ctx.saveSession();

        await ctx.reply(t('photoUpdated', lang));
        await showProfile(ctx, ctx.from.id, false, true);
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
      const lang = getLanguage(ctx);

      try {
        // Validate location exists
        if (!ctx.message?.location || !ctx.message.location.latitude || !ctx.message.location.longitude) {
          logger.warn('Location handler triggered but no valid location found');
          await ctx.reply(t('invalidInput', lang), Markup.removeKeyboard());
          return;
        }

        const { latitude, longitude } = ctx.message.location;

        const result = await UserService.updateLocation(ctx.from.id, {
          lat: latitude,
          lng: longitude,
        });

        ctx.session.temp.waitingForLocation = false;
        await ctx.saveSession();

        if (result.success) {
          await ctx.reply(t('locationUpdated', lang), Markup.removeKeyboard());
          await showProfile(ctx, ctx.from.id, false, true);
        } else {
          await ctx.reply(t('error', lang), Markup.removeKeyboard());
        }
      } catch (error) {
        logger.error('Error updating location:', error);
        await ctx.reply(t('error', lang), Markup.removeKeyboard());
      }
      return;
    }

    return next();
  });

  // Handle text inputs (bio, interests, cancel)
  bot.on('text', async (ctx, next) => {
    const { temp } = ctx.session;

    // Handle cancel for location
    if (temp?.waitingForLocation && (ctx.message.text === '❌ Cancelar' || ctx.message.text === '❌ Cancel')) {
      try {
        const lang = getLanguage(ctx);
        ctx.session.temp.waitingForLocation = false;
        await ctx.saveSession();

        await ctx.reply(t('operationCancelled', lang) || 'Operation cancelled', Markup.removeKeyboard());
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error cancelling location update:', error);
      }
      return;
    }

    if (temp?.waitingForBio) {
      try {
        const lang = getLanguage(ctx);
        const bio = validateUserInput(ctx.message.text, 500);

        if (!bio) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await UserService.updateProfile(ctx.from.id, { bio });

        ctx.session.temp.waitingForBio = false;
        await ctx.saveSession();

        await ctx.reply(t('bioUpdated', lang));

        // Small delay to ensure DB update is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        await showProfile(ctx, ctx.from.id, false, true);
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

        // Small delay to ensure DB update is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating interests:', error);
      }
      return;
    }

    return next();
  });
};

/**
 * Show user profile
 * @param {Context} ctx - Telegraf context
 * @param {string|number} targetUserId - User ID to show
 * @param {boolean} edit - Whether to edit existing message
 * @param {boolean} isOwnProfile - Whether this is the user's own profile
 */
const showProfile = async (ctx, targetUserId, edit = true, isOwnProfile = false) => {
  try {
    const lang = getLanguage(ctx);
    const viewerId = ctx.from.id;

    // Get target user
    const targetUser = await UserModel.getById(targetUserId);

    if (!targetUser) {
      await ctx.reply(t('userNotFound', lang));
      return;
    }

    // Check if viewer is blocked
    if (!isOwnProfile) {
      const isBlocked = await UserModel.isBlocked(targetUserId, viewerId);
      const hasBlockedTarget = await UserModel.isBlocked(viewerId, targetUserId);

      if (isBlocked || hasBlockedTarget) {
        await ctx.reply(t('cannotViewProfile', lang));
        return;
      }

      // Increment profile views
      await UserModel.incrementProfileViews(targetUserId);
    }

    // Build profile text
    let profileText = isOwnProfile ? `${t('profileTitle', lang)}\n\n` : '👤 User Profile\n\n';

    // Badges (objeto-objeto, mostrar emoji y nombre)
    if (targetUser.badges && targetUser.badges.length > 0) {
      const badgeList = targetUser.badges.map((badge) => {
        // Si es badge estándar
        if (typeof badge === 'string') {
          const badgeKey = `badges.${badge}`;
          return t(badgeKey, lang);
        }
        // Si es badge personalizado (objeto)
        if (typeof badge === 'object' && badge.icon && badge.name) {
          return `${badge.icon} ${badge.name}`;
        }
        return '';
      }).filter(Boolean).join(' ');
      profileText += `${badgeList}\n`;
    }

    // Basic info
    profileText += `👤 ${targetUser.firstName || 'User'} ${targetUser.lastName || ''}\n`;
    if (targetUser.username) profileText += `@${targetUser.username}\n`;

    // Bio (check privacy)
    if (targetUser.bio && (isOwnProfile || targetUser.privacy?.showBio !== false)) {
      profileText += `\n📝 ${targetUser.bio}\n`;
    }

    // Interests (check privacy)
    if (targetUser.interests && targetUser.interests.length > 0
      && (isOwnProfile || targetUser.privacy?.showInterests !== false)) {
      profileText += `\n🎯 ${targetUser.interests.join(', ')}\n`;
    }

    // Location (check privacy)
    if (targetUser.location && (isOwnProfile || targetUser.privacy?.showLocation !== false)) {
      profileText += '\n📍 Location shared\n';
    }

    // Subscription info
    if (targetUser.subscriptionStatus === 'active' && targetUser.planExpiry) {
      try {
        let expiry;
        if (targetUser.planExpiry.toDate && typeof targetUser.planExpiry.toDate === 'function') {
          expiry = targetUser.planExpiry.toDate();
        } else if (targetUser.planExpiry._seconds) {
          expiry = new Date(targetUser.planExpiry._seconds * 1000);
        } else {
          expiry = new Date(targetUser.planExpiry);
        }

        if (expiry && !isNaN(expiry.getTime())) {
          profileText += `\n💎 PRIME: ${t('subscriptionActive', lang, { expiry: moment(expiry).format('MMM DD, YYYY') })}\n`;
        } else if (isOwnProfile) {
          profileText += '\n⭐ Free Plan\n';
        }
      } catch (error) {
        logger.warn('Error parsing planExpiry date:', error);
        if (isOwnProfile) {
          profileText += '\n⭐ Free Plan\n';
        }
      }
    } else if (isOwnProfile) {
      profileText += '\n⭐ Free Plan\n';
    }

    // Profile stats (only for own profile)
    if (isOwnProfile) {
      const views = targetUser.profileViews || 0;
      profileText += `\n${t('profileViews', lang, { views })}\n`;

      // Parse createdAt date
      let createdAtDate;
      try {
        if (targetUser.createdAt) {
          if (typeof targetUser.createdAt === 'object' && typeof targetUser.createdAt.toDate === 'function') {
            createdAtDate = targetUser.createdAt.toDate();
          } else if (targetUser.createdAt._seconds) {
            createdAtDate = new Date(targetUser.createdAt._seconds * 1000);
          } else if (typeof targetUser.createdAt === 'string' || typeof targetUser.createdAt === 'number') {
            createdAtDate = new Date(targetUser.createdAt);
          }
        }
      } catch (error) {
        logger.warn('Error parsing createdAt date:', error);
      }

      const validDate = createdAtDate && !isNaN(createdAtDate.getTime())
        ? moment(createdAtDate).format('MMM DD, YYYY')
        : 'Recently';
      profileText += `${t('memberSince', lang, { date: validDate })}\n`;
    }

    // Build keyboard
    const keyboard = [];

    if (isOwnProfile) {
      // Own profile - edit options
      keyboard.push([
        Markup.button.callback(t('editPhoto', lang), 'edit_photo'),
        Markup.button.callback(t('editBio', lang), 'edit_bio'),
      ]);
      keyboard.push([
        Markup.button.callback(t('editLocation', lang), 'edit_location'),
        Markup.button.callback(t('editInterests', lang), 'edit_interests'),
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

      keyboard.push([Markup.button.callback(t('blockUser', lang), `block_user_${targetUserId}`)]);
      keyboard.push([Markup.button.callback(t('back', lang), 'back_to_main')]);
    }

    if (edit) {
      await ctx.editMessageText(profileText, Markup.inlineKeyboard(keyboard));
    } else {
      await ctx.reply(profileText, Markup.inlineKeyboard(keyboard));
    }
  } catch (error) {
    logger.error('Error in showProfile:', error);
    const lang = ctx.session?.language || 'en';
    await ctx.reply(t('error', lang));
  }
};

/**
 * Show privacy settings
 */
const showPrivacySettings = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    const privacy = user.privacy || {
      showLocation: true,
      showInterests: true,
      showBio: true,
      allowMessages: true,
      showOnline: true,
    };

    let text = `${t('privacyTitle', lang)}\n\n`;
    text += `${privacy.showLocation ? '✅' : '❌'} ${t('showLocation', lang)}\n`;
    text += `${privacy.showInterests ? '✅' : '❌'} ${t('showInterests', lang)}\n`;
    text += `${privacy.showBio ? '✅' : '❌'} ${t('showBio', lang)}\n`;
    text += `${privacy.allowMessages ? '✅' : '❌'} ${t('allowMessages', lang)}\n`;
    text += `${privacy.showOnline ? '✅' : '❌'} ${t('showOnline', lang)}\n`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`${privacy.showLocation ? '✅' : '❌'} ${t('showLocation', lang)}`, 'privacy_toggle_showLocation')],
      [Markup.button.callback(`${privacy.showInterests ? '✅' : '❌'} ${t('showInterests', lang)}`, 'privacy_toggle_showInterests')],
      [Markup.button.callback(`${privacy.showBio ? '✅' : '❌'} ${t('showBio', lang)}`, 'privacy_toggle_showBio')],
      [Markup.button.callback(`${privacy.allowMessages ? '✅' : '❌'} ${t('allowMessages', lang)}`, 'privacy_toggle_allowMessages')],
      [Markup.button.callback(`${privacy.showOnline ? '✅' : '❌'} ${t('showOnline', lang)}`, 'privacy_toggle_showOnline')],
      [Markup.button.callback(t('back', lang), 'show_profile')],
    ]);

    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    logger.error('Error showing privacy settings:', error);
  }
};

/**
 * Toggle privacy setting
 */
const togglePrivacySetting = async (ctx, setting) => {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    const privacy = user.privacy || {
      showLocation: true,
      showInterests: true,
      showBio: true,
      allowMessages: true,
      showOnline: true,
    };

    // Toggle the setting
    privacy[setting] = !privacy[setting];

    await UserModel.updatePrivacy(ctx.from.id, privacy);

    await ctx.answerCbQuery(t('privacyUpdated', lang));
    await showPrivacySettings(ctx);
  } catch (error) {
    logger.error('Error toggling privacy setting:', error);
  }
};

/**
 * Show favorites list
 */
const showFavorites = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const favorites = await UserModel.getFavorites(ctx.from.id);

    if (!favorites || favorites.length === 0) {
      await ctx.editMessageText(
        t('noFavorites', lang),
        Markup.inlineKeyboard([[Markup.button.callback(t('back', lang), 'show_profile')]]),
      );
      return;
    }

    let text = `${t('myFavorites', lang)}\n\n`;
    const keyboard = [];

    favorites.forEach((user, index) => {
      text += `${index + 1}. ${user.firstName} ${user.lastName || ''}${user.username ? ` (@${user.username})` : ''}\n`;
      keyboard.push([
        Markup.button.callback(`👁️ ${user.firstName}`, `view_user_${user.id}`),
        Markup.button.callback('❌', `remove_favorite_${user.id}`),
      ]);
    });

    keyboard.push([Markup.button.callback(t('back', lang), 'show_profile')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing favorites:', error);
  }
};

/**
 * Show blocked users list
 */
const showBlockedUsers = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(ctx.from.id);

    if (!user || !user.blocked || user.blocked.length === 0) {
      await ctx.editMessageText(
        t('noBlockedUsers', lang),
        Markup.inlineKeyboard([[Markup.button.callback(t('back', lang), 'show_profile')]]),
      );
      return;
    }

    let text = `${t('blockedUsers', lang)}\n\n`;
    const keyboard = [];

    for (const blockedId of user.blocked) {
      const blockedUser = await UserModel.getById(blockedId);
      if (blockedUser) {
        text += `• ${blockedUser.firstName} ${blockedUser.lastName || ''}${blockedUser.username ? ` (@${blockedUser.username})` : ''}\n`;
        keyboard.push([
          Markup.button.callback(`✅ Unblock ${blockedUser.firstName}`, `unblock_user_${blockedId}`),
        ]);
      }
    }

    keyboard.push([Markup.button.callback(t('back', lang), 'show_profile')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard));
  } catch (error) {
    logger.error('Error showing blocked users:', error);
  }
};

/**
 * Add user to favorites
 */
const addToFavorites = async (ctx, targetUserId) => {
  try {
    const lang = getLanguage(ctx);
    await UserModel.addToFavorites(ctx.from.id, targetUserId);
    await ctx.answerCbQuery(t('addedToFavorites', lang));
    await showProfile(ctx, targetUserId, true, false);
  } catch (error) {
    logger.error('Error adding to favorites:', error);
  }
};

/**
 * Remove user from favorites
 */
const removeFromFavorites = async (ctx, targetUserId) => {
  try {
    const lang = getLanguage(ctx);
    await UserModel.removeFromFavorites(ctx.from.id, targetUserId);
    await ctx.answerCbQuery(t('removedFromFavorites', lang));

    // Check if we're in the favorites list view or profile view
    if (ctx.callbackQuery?.message?.text?.includes(t('myFavorites', lang))) {
      await showFavorites(ctx);
    } else {
      await showProfile(ctx, targetUserId, true, false);
    }
  } catch (error) {
    logger.error('Error removing from favorites:', error);
  }
};

/**
 * Block user
 */
const blockUser = async (ctx, targetUserId) => {
  try {
    const lang = getLanguage(ctx);
    await UserModel.blockUser(ctx.from.id, targetUserId);
    await ctx.answerCbQuery(t('userBlocked', lang));
    await ctx.editMessageText(
      t('userBlocked', lang),
      Markup.inlineKeyboard([[Markup.button.callback(t('back', lang), 'back_to_main')]]),
    );
  } catch (error) {
    logger.error('Error blocking user:', error);
  }
};

/**
 * Unblock user
 */
const unblockUser = async (ctx, targetUserId) => {
  try {
    const lang = getLanguage(ctx);
    await UserModel.unblockUser(ctx.from.id, targetUserId);
    await ctx.answerCbQuery(t('userUnblocked', lang));
    await showBlockedUsers(ctx);
  } catch (error) {
    logger.error('Error unblocking user:', error);
  }
};

/**
 * Share profile - Generate Member Card with Photo
 */
const shareProfile = async (ctx) => {
  try {
    const lang = getLanguage(ctx);
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    await ctx.answerCbQuery();

    // Build enhanced Member Card text (using HTML for better parsing)
    let cardText = '┏━━━━━━━━━━━━━━━━━━━━━━━┓\n';
    cardText += '┃      💎 MEMBER CARD 💎      ┃\n';
    cardText += '┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n';

    // Badges - display prominently
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
      }).filter(Boolean).join(' ');
      cardText += `${badgeList}\n\n`;
    }

    // Basic info with better formatting
    cardText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    cardText += `👤 <b>${user.firstName || 'User'} ${user.lastName || ''}</b>\n`;
    if (user.username) cardText += `📱 @${user.username}\n`;

    // Subscription status - highlight for PRIME members
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
          cardText += `💎 <b>PRIME Member</b>\n`;
          cardText += `   Valid until: ${moment(expiry).format('MMM DD, YYYY')}\n`;
        }
      } catch (error) {
        logger.warn('Error parsing planExpiry in share:', error);
      }
    } else {
      cardText += `⭐ Free Member\n`;
    }
    cardText += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Bio
    if (user.bio) {
      cardText += `📝 <b>About</b>\n`;
      // Escape HTML special characters in bio
      const escapedBio = user.bio.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cardText += `${escapedBio}\n\n`;
    }

    // Interests with better formatting
    if (user.interests && user.interests.length > 0) {
      cardText += `🎯 <b>Interests</b>\n`;
      // Escape HTML special characters in interests
      const escapedInterests = user.interests.map(i =>
        i.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      );
      cardText += `${escapedInterests.join(' • ')}\n\n`;
    }

    // Profile link (deep link to view profile)
    cardText += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    cardText += `🔗 <b>View Full Profile:</b>\n`;
    cardText += `https://t.me/${ctx.botInfo.username}?start=viewprofile_${ctx.from.id}\n\n`;

    cardText += '┏━━━━━━━━━━━━━━━━━━━━━━━┓\n';
    cardText += '┃  🎬 PNPtv! - Entertainment Hub  ┃\n';
    cardText += '┗━━━━━━━━━━━━━━━━━━━━━━━┛';

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
    logger.error('Error sharing profile:', error);
    const lang = ctx.session?.language || 'en';
    await ctx.reply(t('error', lang));
  }
};

module.exports = registerProfileHandlers;
module.exports.showProfile = showProfile;
