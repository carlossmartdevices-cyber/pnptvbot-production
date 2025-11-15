const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const moment = require('moment');

/**
 * Profile handlers
 * @param {Telegraf} bot - Bot instance
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
      const lang = ctx.session.language || 'en';
      ctx.session.temp.waitingForPhoto = true;
      await ctx.saveSession();

      await ctx.editMessageText(t('sendPhoto', lang));
    } catch (error) {
      logger.error('Error in edit photo:', error);
    }
  });

  bot.action('edit_bio', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';
      ctx.session.temp.waitingForBio = true;
      await ctx.saveSession();

      await ctx.editMessageText(t('sendBio', lang));
    } catch (error) {
      logger.error('Error in edit bio:', error);
    }
  });

  bot.action('edit_location', async (ctx) => {
    try {
      const lang = ctx.session.language || 'en';
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
      const lang = ctx.session.language || 'en';
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
        const lang = ctx.session.language || 'en';
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
        const lang = ctx.session.language || 'en';
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
        const lang = ctx.session.language || 'en';
        const bio = ctx.message.text.substring(0, 500);

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
        const lang = ctx.session.language || 'en';
        const interests = ctx.message.text
          .split(',')
          .map((i) => i.trim())
          .filter((i) => i.length > 0)
          .slice(0, 10);

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
    const lang = ctx.session.language || 'en';
    const user = await UserService.getOrCreateFromContext(ctx);

    let profileText = `${t('profileTitle', lang)}\n\n`;
    profileText += `👤 ${user.firstName || 'User'} ${user.lastName || ''}\n`;
    if (user.username) profileText += `@${user.username}\n`;
    if (user.bio) profileText += `\n📝 ${user.bio}\n`;
    if (user.interests && user.interests.length > 0) {
      profileText += `\n🎯 ${user.interests.join(', ')}\n`;
    }
    if (user.location) {
      profileText += `\n📍 Location shared\n`;
    }

    // Subscription info
    if (user.subscriptionStatus === 'active' && user.planExpiry) {
      const expiry = user.planExpiry.toDate ? user.planExpiry.toDate() : new Date(user.planExpiry);
      profileText += `\n💎 PRIME: ${t('subscriptionActive', lang, { expiry: moment(expiry).format('MMM DD, YYYY') })}\n`;
    } else {
      profileText += `\n⭐ Free Plan\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(t('editPhoto', lang), 'edit_photo'),
        Markup.button.callback(t('editBio', lang), 'edit_bio'),
      ],
      [
        Markup.button.callback(t('editLocation', lang), 'edit_location'),
        Markup.button.callback(t('editInterests', lang), 'edit_interests'),
      ],
      [Markup.button.callback(t('back', lang), 'back_to_main')],
    ]);

    if (edit) {
      await ctx.editMessageText(profileText, keyboard);
    } else {
      await ctx.reply(profileText, keyboard);
    }
  } catch (error) {
    logger.error('Error in showProfile:', error);
    const lang = ctx.session?.language || 'en';
    await ctx.reply(t('error', lang));
  }
};

module.exports = registerProfileHandlers;
