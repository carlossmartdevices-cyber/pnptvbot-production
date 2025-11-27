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
  // Show nearby users menu
  bot.action('show_nearby', async (ctx) => {
    try {
      const lang = getLanguage(ctx);

      // Sexy monospace design
      const headerText = 
        '```\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
        '   🔥 Find Nearby Users   \n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
        '```\n\n' +
        'Looking for that meth alpha, that cloudy papi,\n' +
        'or a slam slut close to you?\n\n' +
        '💡 _Complete your PNPtv! profile so the right\n' +
        'guys can spot you, hit you up, and get the\n' +
        'fun started fast._\n\n' +
        '```\n' +
        '📍 Distance ━━━━━━━━━━━━━━━━━\n' +
        '```';

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
            [Markup.button.callback('🔙 Back', 'back_to_main')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error showing nearby menu:', error);
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

      await ctx.editMessageText('🔍 _Scanning your area..._', { parse_mode: 'Markdown' });

      const nearbyUsers = await UserService.getNearbyUsers(userId, radius);

      if (nearbyUsers.length === 0) {
        const noResultsText = 
          '```\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
          '      😢 No Results       \n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
          '```\n\n' +
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
        '```\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┐\n' +
        '   🔥 Nearby Hotties 🔥   \n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━┘\n' +
        '```\n\n' +
        `Found **${nearbyUsers.length}** users within ${radius} km 👀\n\n`;

      const buttons = [];
      nearbyUsers.slice(0, 10).forEach((user, index) => {
        const name = user.firstName || 'Anonymous';
        const distance = user.distance.toFixed(1);
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        message += `${emoji} **${name}** - _${distance} km away_\n`;

        buttons.push([
          Markup.button.callback(
            `👁️ View ${name}`,
            `view_user_${user.id}`,
          ),
        ]);
      });

      message += '\n_Tap to view profile & slide into their DMs_ 😏';

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

      const user = await UserService.getOrCreateFromContext({ from: { id: targetUserId } });

      // Build sexy profile card
      let profileText = 
        '```\n' +
        '╔════════════════════════╗\n' +
        '║    👤 PROFILE CARD     ║\n' +
        '╚════════════════════════╝\n' +
        '```\n\n';

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
        '```\n' +
        '┌─────────────────────────┐\n' +
        '│  Don\'t be shy... DM!   │\n' +
        '└─────────────────────────┘\n' +
        '```';

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
};

module.exports = registerNearbyHandlers;
