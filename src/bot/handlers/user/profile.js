const { requirePrivateChat } = require('../../utils/notifications');
const { getBackButton } = require('../../utils/menus');
const userService = require('../../services/userService');
const i18n = require('../../utils/i18n');
const logger = require('../../../utils/logger');

/**
 * Handle profile command
 */
async function handleProfile(ctx) {
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
