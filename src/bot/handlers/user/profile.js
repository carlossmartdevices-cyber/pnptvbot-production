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

    return next();
  });
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

    if (!isPrivate) {
      return;
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
 * Handle profile field update
 */
async function handleProfileUpdate(ctx, field, value) {
  try {
    const userId = ctx.from.id;
    const user = await userService.getUser(userId);
    const language = user?.language || 'en';

    // Validate and update
    const { sanitizeText, validateUsername, validateBio } = require('../../utils/validation');

    if (field === 'username') {
      const cleanValue = sanitizeText(value);
      const validation = validateUsername(cleanValue);
      if (!validation.valid) {
        await ctx.reply(validation.error);
        return;
      }
      await userService.updateUser(userId, { username: cleanValue });
    } else if (field === 'bio') {
      const cleanValue = sanitizeText(value);
      const validation = validateBio(cleanValue);
      if (!validation.valid) {
        await ctx.reply(validation.error);
        return;
      }
      await userService.updateUser(userId, { bio: cleanValue });
    }

    await ctx.reply(i18n.t('profile_updated', language));
    await ctx.clearSession();

    // Show updated profile
    await handleProfile(ctx);

    logger.info(`User ${userId} updated ${field}`);
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
