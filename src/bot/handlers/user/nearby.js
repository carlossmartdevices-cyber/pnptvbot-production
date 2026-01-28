const { Markup } = require('telegraf');
const UserService = require('../../services/userService');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Nearby users handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerNearbyHandlers = (bot) => {
  // Show nearby menu - redirects to enhanced nearby menu
  bot.action('show_nearby', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Get user's current location sharing preference
      const user = await UserService.getOrCreateFromContext(ctx);
      const locationStatus = user.locationSharingEnabled ? '🟢 ON' : '🔴 OFF';

      const headerText = lang === 'es'
        ? '`🔥 Buscar Usuarios Cerca`\n\n' +
          '¿Buscando ese papi, ese meth alpha,\n' +
          'o un slam slut cerca de ti?\n\n' +
          '💡 _Completa tu perfil PNPtv para que\n' +
          'los chicos correctos te encuentren._\n\n' +
          '`📍 Selecciona distancia:`'
        : '`🔥 Find Nearby Users`\n\n' +
          'Looking for that meth alpha, that cloudy papi,\n' +
          'or a slam slut close to you?\n\n' +
          '💡 _Complete your PNPtv! profile so the right\n' +
          'guys can spot you, hit you up, and get the\n' +
          'fun started fast._\n\n' +
          '`📍 Select distance:`';

      await ctx.editMessageText(
        headerText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('📍 5 km', 'nearby_radius_5'),
              Markup.button.callback('📍 10 km', 'nearby_radius_10'),
            ],
            [
              Markup.button.callback('📍 25 km', 'nearby_radius_25'),
              Markup.button.callback('📍 50 km', 'nearby_radius_50'),
            ],
            [Markup.button.callback(`📍 Location: ${locationStatus}`, 'toggle_location_sharing')],
            [Markup.button.callback(lang === 'es' ? '🏪 Negocios y Lugares' : '🏪 Businesses & Places', 'show_nearby_menu')],
            [Markup.button.callback('🔙 Back', 'back_to_main')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing nearby menu:', error);
    }
  });

  // Toggle location sharing
  bot.action('toggle_location_sharing', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      
      if (!ctx.from?.id) {
        logger.error('Missing user context in location sharing toggle');
        await ctx.answerCbQuery(t('error', lang));
        return;
      }

      const userId = ctx.from.id;
      const user = await UserService.getOrCreateFromContext(ctx);
      
      // Toggle the current setting
      const newSetting = !user.locationSharingEnabled;
      
      await UserService.updateProfile(userId, {
        locationSharingEnabled: newSetting
      });

      const message = newSetting 
        ? t('locationSharingToggleEnabled', lang)
        : t('locationSharingToggleDisabled', lang);

      await ctx.answerCbQuery(message);
      
      // Update the button text
      await ctx.editMessageReplyMarkup({
        inline_keyboard: ctx.callbackQuery.message.reply_markup.inline_keyboard.map(row => {
          if (row[0]?.callback_data === 'toggle_location_sharing') {
            const newStatus = newSetting ? '🟢 ON' : '🔴 OFF';
            return [Markup.button.callback(`📍 Location: ${newStatus}`, 'toggle_location_sharing')];
          }
          return row;
        })
      });
    } catch (error) {
      logger.error('Error toggling location sharing:', error);
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(t('error', lang));
    }
  });

  // Handle radius selection
  bot.action(/^nearby_radius_(\d+)$/, async (ctx) => {
    try {
      const radius = parseInt(ctx.match[1], 10);
      const lang = getLanguage(ctx);

      // Validate user context exists
      if (!ctx.from?.id) {
        logger.error('Missing user context in nearby users search');
        await ctx.reply(t('error', lang));
        return;
      }

      const userId = ctx.from.id;

      // Check if user has location set
      const currentUser = await UserService.getOrCreateFromContext(ctx);
      if (!currentUser.location || !currentUser.location.lat) {
        const noLocationText =
          '`📍 Location Required`\n\n' +
          'You need to share your location first!\n\n' +
          '_Go to your Profile → Location to share your location, then come back here._';

        await ctx.editMessageText(
          noLocationText,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📝 Go to Profile', 'edit_profile')],
              [Markup.button.callback('🔙 Back', 'back_to_main')],
            ]),
          }
        );
        return;
      }

      await ctx.editMessageText('🔍 _Scanning your area..._', { parse_mode: 'Markdown' });

      const nearbyUsers = await UserService.getNearbyUsers(userId, radius);

      if (nearbyUsers.length === 0) {
        const noResultsText =
          '`😢 No Results`\n\n' +
          `No users found within ${radius} km 😔\n\n` +
          '_Try a larger radius or check back later!_';

        await ctx.editMessageText(
          noResultsText,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Try Again', 'show_nearby')],
              [Markup.button.callback('🔙 Back', 'back_to_main')],
            ]),
          }
        );
        return;
      }

      // Show list of nearby users with sexy design
      let message = 
        '`🔥 Nearby Hotties 🔥`\n\n' +
        `Found **${nearbyUsers.length}** users within ${radius} km 👀\n\n`;

      const buttons = [];
      nearbyUsers.slice(0, 10).forEach((user, index) => {
        const name = user.firstName || 'Anonymous';
        const distance = user.distance.toFixed(1);
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        message += `${emoji} **${name}** - _${distance} km away_\n`;

        // Create buttons - use callback for DM to avoid Telegram URL restrictions
        buttons.push([
          Markup.button.callback(`👁️ View`, `view_user_${user.id}`),
          Markup.button.callback(`💬 DM ${name}`, `dm_user_${user.id}`),
        ]);
      });

      message += '\n_Tap to view profile or slide into their DMs_ 😏';

      buttons.push([Markup.button.callback('🔙 Change Radius', 'show_nearby')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing nearby users:', error);
      const lang = getLanguage(ctx);
      await ctx.reply(t('error', lang));
    }
  });

  // View user profile
  bot.action(/^view_user_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid view user action format');
        return;
      }

      const targetUserId = ctx.match[1];
      const lang = getLanguage(ctx);

      const user = await UserService.getById(targetUserId);

      if (!user) {
        await ctx.answerCbQuery(t('userNotFound', lang));
        return;
      }

      // Build sexy profile card
      let profileText = 
        '`👤 PROFILE CARD`\n\n';

      const displayName = user.firstName || 'Anonymous';
      profileText += `**${displayName}**`;
      if (user.lastName) profileText += ` ${user.lastName}`;
      profileText += '\n';
      
      if (user.username) {
        profileText += `@${user.username}\n`;
      }

      profileText += '\n';

      if (user.bio) {
        profileText += `💭 _"${user.bio}"_\n\n`;
      }

      if (user.interests && user.interests.length > 0) {
        profileText += `🎯 **Into:** ${user.interests.join(', ')}\n\n`;
      }

      // Add social media if available
      const socials = [];
      if (user.twitter) socials.push(`𝕏 ${user.twitter}`);
      if (user.instagram) socials.push(`IG ${user.instagram}`);
      if (user.tiktok) socials.push(`TT ${user.tiktok}`);
      
      if (socials.length > 0) {
        profileText += `🔗 ${socials.join(' • ')}\n\n`;
      }

      profileText += 
        '`Don\'t be shy... DM! 💬`';

      // Build DM button
      let dmButton;
      if (user.username) {
        dmButton = Markup.button.url(`💬 Message ${displayName}`, `https://t.me/${user.username}`);
      } else {
        dmButton = Markup.button.url(`💬 Message ${displayName}`, `tg://user?id=${targetUserId}`);
      }

      await ctx.editMessageText(
        profileText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [dmButton],
            [Markup.button.callback('🔙 Back to List', 'show_nearby')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error viewing user profile:', error);
    }
  });

  // Handle DM button clicks
  bot.action(/^dm_user_(.+)$/, async (ctx) => {
    try {
      // Validate match result exists
      if (!ctx.match || !ctx.match[1]) {
        logger.error('Invalid DM user action format');
        return;
      }

      const targetUserId = ctx.match[1];
      const lang = getLanguage(ctx);

      // Get the target user
      const targetUser = await UserService.getById(targetUserId);

      if (!targetUser) {
        await ctx.answerCbQuery(t('userNotFound', lang));
        return;
      }

      // Try to open a chat with the user
      try {
        if (targetUser.username) {
          // If user has a username, we can open a chat via URL
          const chatUrl = `https://t.me/${targetUser.username}`;
          await ctx.answerCbQuery(t('openingChat', lang), {
            url: chatUrl,
          });
        } else {
          // If no username, we can't directly open a chat
          // Show a message with instructions
          await ctx.answerCbQuery(t('userNoUsername', lang), {
            show_alert: true,
          });
        }
      } catch (chatError) {
        logger.error('Error opening chat:', chatError);
        await ctx.answerCbQuery(t('errorOpeningChat', lang), {
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error('Error handling DM action:', error);
      const lang = getLanguage(ctx);
      await ctx.answerCbQuery(t('error', lang), {
        show_alert: true,
      });
    }
  });
};

module.exports = registerNearbyHandlers;
