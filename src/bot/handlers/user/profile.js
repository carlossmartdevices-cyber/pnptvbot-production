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
      await ctx.answerCbQuery();
      logger.info(`>>> show_profile action triggered for user ${ctx.from.id}`);
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

  // Edit 'looking_for' field
  bot.action('edit_looking_for', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForLookingFor = true;
      await ctx.saveSession();
      await ctx.editMessageText(t('sendLookingFor', lang));
    } catch (error) {
      logger.error('Error in edit looking_for:', error);
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

  // Social Media Handlers
  bot.action('edit_social', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await showSocialMediaMenu(ctx, lang);
    } catch (error) {
      logger.error('Error showing social media menu:', error);
    }
  });

  // Edit Profile Info (Bio, Interests, Tribe, Looking For)
  bot.action('edit_profile_info', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await showEditProfileMenu(ctx, lang);
    } catch (error) {
      logger.error('Error showing edit profile menu:', error);
    }
  });

  // Edit Tribe
  bot.action('edit_tribe', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      ctx.session.temp.waitingForTribe = true;
      await ctx.saveSession();
      await ctx.editMessageText(
        lang === 'es'
          ? '🏳️‍🌈 ¿Cuál es tu tribu?\n\nEjemplos: Bear, Otter, Jock, Twink, Daddy, etc.\n\nEnvía tu tribu o "borrar" para eliminar:'
          : '🏳️‍🌈 What\'s your tribe?\n\nExamples: Bear, Otter, Jock, Twink, Daddy, etc.\n\nSend your tribe or "delete" to remove:'
      );
    } catch (error) {
      logger.error('Error in edit tribe:', error);
    }
  });

  // Apply to PNP Contacto!
  bot.action('apply_pnp_contacto', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await showPnpContactoApplication(ctx, lang);
    } catch (error) {
      logger.error('Error showing PNP Contacto application:', error);
    }
  });

  // Confirm PNP Contacto Application
  bot.action('confirm_pnp_contacto', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      await submitPnpContactoApplication(ctx, lang);
    } catch (error) {
      logger.error('Error submitting PNP Contacto application:', error);
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
        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating bio:', error);
      }
      return;
    }

    if (temp?.waitingForLookingFor) {
      try {
        const lang = getLanguage(ctx);
        const lookingFor = validateUserInput(ctx.message.text, 200);
        if (!lookingFor) {
          await ctx.reply(t('invalidInput', lang));
          return;
        }
        await UserService.updateProfile(ctx.from.id, { looking_for: lookingFor });
        ctx.session.temp.waitingForLookingFor = false;
        await ctx.saveSession();
        await ctx.reply(t('lookingForUpdated', lang));
        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating looking_for:', error);
      }
      return;
    }

    if (temp?.waitingForTribe) {
      try {
        const lang = getLanguage(ctx);
        const input = validateUserInput(ctx.message.text, 100);

        if (input && (input.toLowerCase() === 'delete' || input.toLowerCase() === 'borrar')) {
          await UserService.updateProfile(ctx.from.id, { tribe: null });
          ctx.session.temp.waitingForTribe = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Tribu eliminada' : '✅ Tribe removed');
        } else if (input) {
          await UserService.updateProfile(ctx.from.id, { tribe: input });
          ctx.session.temp.waitingForTribe = false;
          await ctx.saveSession();
          await ctx.reply(lang === 'es' ? '✅ Tribu actualizada' : '✅ Tribe updated');
        } else {
          await ctx.reply(t('invalidInput', lang));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await showProfile(ctx, ctx.from.id, false, true);
      } catch (error) {
        logger.error('Error updating tribe:', error);
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
 * Show edit profile menu (Bio, Interests, Tribe, Looking For)
 */
const showEditProfileMenu = async (ctx, lang) => {
  try {
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    let text = lang === 'es'
      ? [
          '📝 *Actualizar Perfil*',
          '',
          'Edita la información de tu perfil:',
          '',
          `📝 Bio: ${user.bio || '-'}`,
          `🎯 Intereses: ${user.interests?.join(', ') || '-'}`,
          `🏳️‍🌈 Tribu: ${user.tribe || '-'}`,
          `🔎 Buscando: ${user.looking_for || '-'}`,
          '',
          'Selecciona qué deseas actualizar:',
        ].join('\n')
      : [
          '📝 *Update Profile*',
          '',
          'Edit your profile information:',
          '',
          `📝 Bio: ${user.bio || '-'}`,
          `🎯 Interests: ${user.interests?.join(', ') || '-'}`,
          `🏳️‍🌈 Tribe: ${user.tribe || '-'}`,
          `🔎 Looking for: ${user.looking_for || '-'}`,
          '',
          'Select what you want to update:',
        ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(lang === 'es' ? '📝 Bio' : '📝 Bio', 'edit_bio'),
        Markup.button.callback(lang === 'es' ? '🎯 Intereses' : '🎯 Interests', 'edit_interests'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '🏳️‍🌈 Tribu' : '🏳️‍🌈 Tribe', 'edit_tribe'),
        Markup.button.callback(lang === 'es' ? '🔎 Buscando' : '🔎 Looking For', 'edit_looking_for'),
      ],
      [
        Markup.button.callback(lang === 'es' ? '📍 Ubicación' : '📍 Location', 'edit_location'),
      ],
      [Markup.button.callback(t('back', lang), 'show_profile')],
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } catch (error) {
    logger.error('Error showing edit profile menu:', error);
  }
};

/**
 * Show PNP Contacto! application page
 */
const showPnpContactoApplication = async (ctx, lang) => {
  try {
    const user = await UserModel.getById(ctx.from.id);

    if (!user) {
      await ctx.reply(t('error', lang));
      return;
    }

    // Check if already applied
    const alreadyApplied = user.pnpContactoStatus === 'pending' || user.pnpContactoStatus === 'approved';

    let text = lang === 'es'
      ? [
          '⭐ *Aplicar a PNP Contacto!*',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'PNP Contacto! es el roster de performers de PNPtv!',
          '',
          'Como miembro de PNP Contacto! podrás:',
          '• Aparecer en el directorio de performers',
          '• Recibir solicitudes de shows en vivo',
          '• Conectar con otros performers',
          '• Acceso a eventos exclusivos',
          '• Badge especial en tu perfil',
          '',
          '*Requisitos:*',
          '• Perfil completo con foto',
          '• Membresía PRIME activa',
          '• Bio y descripción de servicios',
          '',
        ].join('\n')
      : [
          '⭐ *Apply to PNP Contacto!*',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'PNP Contacto! is PNPtv!\'s performer roster!',
          '',
          'As a PNP Contacto! member you can:',
          '• Appear in the performers directory',
          '• Receive live show requests',
          '• Connect with other performers',
          '• Access to exclusive events',
          '• Special badge on your profile',
          '',
          '*Requirements:*',
          '• Complete profile with photo',
          '• Active PRIME membership',
          '• Bio and service description',
          '',
        ].join('\n');

    let keyboard;

    if (alreadyApplied) {
      const statusText = user.pnpContactoStatus === 'approved'
        ? (lang === 'es' ? '✅ Ya eres miembro de PNP Contacto!' : '✅ You\'re already a PNP Contacto! member')
        : (lang === 'es' ? '⏳ Tu aplicación está pendiente de revisión' : '⏳ Your application is pending review');

      text += `\n${statusText}`;

      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(t('back', lang), 'show_profile')],
      ]);
    } else {
      // Check requirements
      const hasPhoto = !!user.photoFileId;
      const hasBio = !!user.bio;
      const isPrime = user.subscriptionStatus === 'active';

      text += lang === 'es'
        ? [
            '*Tu estado:*',
            `${hasPhoto ? '✅' : '❌'} Foto de perfil`,
            `${hasBio ? '✅' : '❌'} Bio completada`,
            `${isPrime ? '✅' : '❌'} Membresía PRIME`,
          ].join('\n')
        : [
            '*Your status:*',
            `${hasPhoto ? '✅' : '❌'} Profile photo`,
            `${hasBio ? '✅' : '❌'} Bio completed`,
            `${isPrime ? '✅' : '❌'} PRIME membership`,
          ].join('\n');

      const canApply = hasPhoto && hasBio && isPrime;

      if (canApply) {
        keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(
            lang === 'es' ? '✨ Enviar Aplicación' : '✨ Submit Application',
            'confirm_pnp_contacto'
          )],
          [Markup.button.callback(t('back', lang), 'show_profile')],
        ]);
      } else {
        text += lang === 'es'
          ? '\n\n⚠️ Completa los requisitos antes de aplicar.'
          : '\n\n⚠️ Complete the requirements before applying.';

        keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(t('back', lang), 'show_profile')],
        ]);
      }
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } catch (error) {
    logger.error('Error showing PNP Contacto application:', error);
  }
};

/**
 * Submit PNP Contacto! application
 */
const submitPnpContactoApplication = async (ctx, lang) => {
  try {
    // Update user's PNP Contacto status
    await UserService.updateProfile(ctx.from.id, {
      pnpContactoStatus: 'pending',
      pnpContactoAppliedAt: new Date(),
    });

    const text = lang === 'es'
      ? [
          '✅ *¡Aplicación Enviada!*',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'Tu aplicación a PNP Contacto! ha sido recibida.',
          '',
          'Nuestro equipo revisará tu perfil y te notificaremos',
          'cuando tu aplicación sea aprobada.',
          '',
          '¡Gracias por tu interés en unirte al roster de performers!',
        ].join('\n')
      : [
          '✅ *Application Submitted!*',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'Your application to PNP Contacto! has been received.',
          '',
          'Our team will review your profile and notify you',
          'when your application is approved.',
          '',
          'Thank you for your interest in joining the performer roster!',
        ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('back', lang), 'show_profile')],
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });

    await ctx.answerCbQuery(lang === 'es' ? '✅ Aplicación enviada' : '✅ Application submitted');
  } catch (error) {
    logger.error('Error submitting PNP Contacto application:', error);
  }
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

    // Build profile text with new design
    let profileText = '';

    if (isOwnProfile) {
      // New header design for own profile
      profileText = lang === 'es'
        ? '`📸 Mi Perfil PNPtv`\n\n' +
          'Tu perfil es tu identidad en la comunidad.\n' +
          'Se mostrará junto a cada foto que compartas,\n' +
          'ayudando a otros a conectar contigo.\n\n'
        : '`📸 My PNPtv Profile`\n\n' +
          'Your profile is your identity in the community.\n' +
          'It shows alongside every photo you share,\n' +
          'helping others connect with you.\n\n';
    }

    // Username header
    const displayName = targetUser.username 
      ? `@${targetUser.username}` 
      : targetUser.firstName || 'User';
    profileText += `**${displayName}**\n`;
    profileText += '______________________________\n\n';

    // Badges line (emojis only)
    if (targetUser.badges && targetUser.badges.length > 0) {
      const badgeEmojis = targetUser.badges.map(badge => {
        if (typeof badge === 'string') {
          // Map known badge names to emojis
          const badgeEmojiMap = {
            'verified': '✅',
            'premium': '💎',
            'vip': '👑',
            'moderator': '🛡️',
            'admin': '👨‍💼',
            'trailblazer': '🏆',
            'Trailblazer': '🏆',
          };
          return badgeEmojiMap[badge] || '⭐';
        }
        if (typeof badge === 'object' && badge.emoji) {
          return badge.emoji;
        }
        if (typeof badge === 'object' && badge.icon) {
          return badge.icon;
        }
        return '';
      }).filter(Boolean).join(' ');
      
      if (badgeEmojis) {
        profileText += `${badgeEmojis}\n\n`;
      }
    }

    // Bio
    if (targetUser.bio && (isOwnProfile || targetUser.privacy?.showBio !== false)) {
      profileText += `📝 ${targetUser.bio}\n`;
    }

    // Location
    if (targetUser.location && (isOwnProfile || targetUser.privacy?.showLocation !== false)) {
      profileText += `📍 ${lang === 'es' ? 'Ubicación compartida' : 'Location shared'}\n`;
    }

    // Looking for
    if (targetUser.looking_for && (isOwnProfile || targetUser.privacy?.showBio !== false)) {
      profileText += `🔎 ${lang === 'es' ? 'Buscando' : 'Looking for'}: ${targetUser.looking_for}\n`;
    }

    // Tribe
    if (targetUser.tribe && (isOwnProfile || targetUser.privacy?.showBio !== false)) {
      profileText += `🏳️‍🌈 ${lang === 'es' ? 'Tribu' : 'Tribe'}: ${targetUser.tribe}\n`;
    }

    // Interests
    if (targetUser.interests && targetUser.interests.length > 0 && (isOwnProfile || targetUser.privacy?.showInterests !== false)) {
      profileText += `🎯 ${targetUser.interests.join(', ')}\n`;
    }

    profileText += '______________________________\n';

    // Social media section
    const hasSocialMedia = targetUser.tiktok || targetUser.twitter || targetUser.facebook || targetUser.instagram;
    if (hasSocialMedia) {
      profileText += `\n📱 ${lang === 'es' ? 'Redes Sociales' : 'Social Media'}:\n`;
      if (targetUser.tiktok) profileText += `  TikTok: @${targetUser.tiktok}\n`;
      if (targetUser.twitter) profileText += `  X: @${targetUser.twitter}\n`;
      if (targetUser.facebook) profileText += `  Facebook: ${targetUser.facebook}\n`;
      if (targetUser.instagram) profileText += `  Instagram: @${targetUser.instagram}\n`;
    }

    // Subscription status
    if (targetUser.subscriptionStatus === 'active' && targetUser.planExpiry) {
      let expiry;
      if (targetUser.planExpiry.toDate && typeof targetUser.planExpiry.toDate === 'function') {
        expiry = targetUser.planExpiry.toDate();
      } else if (targetUser.planExpiry._seconds) {
        expiry = new Date(targetUser.planExpiry._seconds * 1000);
      } else {
        expiry = new Date(targetUser.planExpiry);
      }
      if (expiry && !isNaN(expiry.getTime())) {
        profileText += `\n💎 PRIME ${lang === 'es' ? 'hasta' : 'until'} ${moment(expiry).format('MMM DD, YYYY')}\n`;
      }
    } else if (isOwnProfile) {
      profileText += `\n⭐ ${lang === 'es' ? 'Plan Gratis' : 'Free Plan'}\n`;
    }

    // Member since
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
      : lang === 'es' ? 'Recientemente' : 'Recently';
    profileText += `${lang === 'es' ? 'Miembro desde' : 'Member since'}: ${validDate}\n`;

    // Profile views (only for own profile)
    if (isOwnProfile) {
      profileText += `👁️ ${lang === 'es' ? 'Vistas' : 'Views'}: ${targetUser.profileViews || 0}\n`;
    }

    // Build keyboard
    const keyboard = [];

    if (isOwnProfile) {
      // Options footer
      profileText += `\n\`${lang === 'es' ? 'Edita tu perfil abajo 💜' : 'Edit your profile below 💜'}\`\n`;

      // Row 1: Update Profile | Update Picture
      keyboard.push([
        Markup.button.callback(
          lang === 'es' ? '📝 Actualizar Perfil' : '📝 Update Profile',
          'edit_profile_info'
        ),
        Markup.button.callback(
          lang === 'es' ? '📸 Actualizar Foto' : '📸 Update Picture',
          'edit_photo'
        ),
      ]);

      // Row 2: Social Media | Profile Settings
      keyboard.push([
        Markup.button.callback(
          lang === 'es' ? '🔗 Redes Sociales' : '🔗 Social Media',
          'edit_social'
        ),
        Markup.button.callback(
          lang === 'es' ? '⚙️ Ajustes de Perfil' : '⚙️ Profile Settings',
          'privacy_settings'
        ),
      ]);

      // Row 3: Print My Profile | Apply to PNP Contacto!
      keyboard.push([
        Markup.button.callback(
          lang === 'es' ? '🖨️ Imprimir Mi Perfil' : '🖨️ Print My Profile',
          'share_profile'
        ),
        Markup.button.callback(
          lang === 'es' ? '⭐ Aplicar a PNP Contacto!' : '⭐ Apply to PNP Contacto!',
          'apply_pnp_contacto'
        ),
      ]);

      // Row 4: Favorites | Blocked
      keyboard.push([
        Markup.button.callback(t('myFavorites', lang), 'show_favorites'),
        Markup.button.callback(t('blockedUsers', lang), 'show_blocked'),
      ]);

      // Back button
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

    let text = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '⭐ My Favorites',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ].join('\n');
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

    let text = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🚫 Blocked Users',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ].join('\n');
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
 * Share profile - Generate Member Card with Photo (Pseudo-code format)
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
          return t(badgeKey, lang) || badge;
        }
        if (typeof badge === 'object' && badge.emoji && badge.name) {
          return `${badge.emoji} ${badge.name}`;
        }
        if (typeof badge === 'object' && badge.icon && badge.name) {
          return `${badge.icon} ${badge.name}`;
        }
        return '';
      }).filter(Boolean).join('  ');
      if (badgeList) {
        cardText += `${badgeList}\n\n`;
      }
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
    logger.error('Error sharing profile:', error);
    const lang = ctx.session?.language || 'en';
    await ctx.reply(t('error', lang));
  }
};

module.exports = registerProfileHandlers;
module.exports.showProfile = showProfile;
