const { Markup } = require('telegraf');
const RoleService = require('../../services/roleService');
const UserModel = require('../../../models/userModel');
const logger = require('../../../utils/logger');

const BroadcastService = require('../../services/broadcastService');

const PerformerProfileModel = require('../../../models/performerProfileModel');

/**
 * PNP Live Model Handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerPNPLiveModelHandlers = (bot) => {
  bot.command('pnp_live', async (ctx) => {
    try {
      const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
      if (!isPerformer) {
        return;
      }

      const user = await UserModel.getById(ctx.from.id);
      const status = user.status || 'offline';

      const message = `🎭 *PNP Live - Performer Menu*\n\nYour current status: *${status.toUpperCase()}*`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(status === 'online' ? '🟢 Go Offline' : '🔴 Go Online', 'pnp_live_toggle_status')],
        [Markup.button.callback('📝 Manage Profile', 'pnp_live_manage_profile')],
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error in /pnp_live command:', error);
    }
  });

  bot.action('pnp_live_manage_profile', async (ctx) => {
    try {
      const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
      if (!isPerformer) {
        return;
      }

      let profile = await PerformerProfileModel.getByUserId(ctx.from.id);
      if (!profile) {
        profile = await PerformerProfileModel.create(ctx.from.id);
      }

      const message = `
📝 *Your Performer Profile*

*Bio:*
${profile.bio || '_Not set_'}

*Rates:*
${profile.rates ? JSON.stringify(profile.rates) : '_Not set_'}

*Tags:*
${profile.tags ? profile.tags.join(', ') : '_Not set_'}
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Edit Bio', 'pnp_live_edit_bio')],
        [Markup.button.callback('✏️ Edit Rates', 'pnp_live_edit_rates')],
        [Markup.button.callback('✏️ Edit Tags', 'pnp_live_edit_tags')],
        [Markup.button.callback('⬅️ Back', 'pnp_live_back_to_menu')],
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      logger.error('Error in pnp_live_manage_profile:', error);
    }
  });

  bot.action('pnp_live_edit_bio', async (ctx) => {
    try {
      const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
      if (!isPerformer) {
        return;
      }

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingProfileField = 'bio';
      await ctx.saveSession();

      await ctx.editMessageText('📝 *Edit Bio*\n\nPlease send your new bio.', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back', 'pnp_live_manage_profile')],
        ]),
      });
    } catch (error) {
      logger.error('Error in pnp_live_edit_bio:', error);
    }
  });

  bot.action('pnp_live_edit_rates', async (ctx) => {
    try {
      const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
      if (!isPerformer) {
        return;
      }

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingProfileField = 'rates';
      await ctx.saveSession();

      await ctx.editMessageText('💰 *Edit Rates*\n\nPlease send your new rates in JSON format (e.g., `{"30min": 50, "60min": 90}`).', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back', 'pnp_live_manage_profile')],
        ]),
      });
    } catch (error) {
      logger.error('Error in pnp_live_edit_rates:', error);
    }
  });

  bot.action('pnp_live_edit_tags', async (ctx) => {
    try {
      const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
      if (!isPerformer) {
        return;
      }

      ctx.session.temp = ctx.session.temp || {};
      ctx.session.temp.editingProfileField = 'tags';
      await ctx.saveSession();

      await ctx.editMessageText('🏷️ *Edit Tags*\n\nPlease send your new tags as a comma-separated list (e.g., `tag1, tag2, tag3`).', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back', 'pnp_live_manage_profile')],
        ]),
      });
    } catch (error) {
      logger.error('Error in pnp_live_edit_tags:', error);
    }
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.temp?.editingProfileField) {
      try {
        const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
        if (!isPerformer) {
          return next();
        }

        const field = ctx.session.temp.editingProfileField;
        let value = ctx.message.text;

        if (field === 'rates') {
          try {
            value = JSON.parse(value);
          } catch (error) {
            return ctx.reply('❌ Invalid JSON format. Please try again.');
          }
        } else if (field === 'tags') {
          value = value.split(',').map(tag => tag.trim());
        }

        await PerformerProfileModel.update(ctx.from.id, { [field]: value });
        delete ctx.session.temp.editingProfileField;
        await ctx.saveSession();

        await ctx.reply(`✅ ${field.charAt(0).toUpperCase() + field.slice(1)} updated!`);
        return bot.handleUpdate({ callback_query: { data: 'pnp_live_manage_profile', from: ctx.from, message: ctx.message } });
      } catch (error) {
        logger.error(`Error updating ${ctx.session.temp.editingProfileField}:`, error);
      }
    }
    return next();
  });

  bot.action('pnp_live_back_to_menu', async (ctx) => {
      // This is a bit of a hack, but it works for now
      await bot.handleUpdate({ message: { text: '/pnp_live', from: ctx.from, chat: ctx.chat } });
  });

  bot.action('pnp_live_toggle_status', async (ctx) => {
    try {
        const isPerformer = await RoleService.hasRole(ctx.from.id, 'PERFORMER');
        if (!isPerformer) {
            return;
        }

        const user = await UserModel.getById(ctx.from.id);
        const currentStatus = user.status || 'offline';
        const newStatus = currentStatus === 'online' ? 'offline' : 'online';

        await UserModel.updateProfile(ctx.from.id, { status: newStatus });

        const message = `🎭 *PNP Live - Performer Menu*\n\nYour current status: *${newStatus.toUpperCase()}*`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(newStatus === 'online' ? '🟢 Go Offline' : '🔴 Go Online', 'pnp_live_toggle_status')],
        ]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard,
        });

        if (newStatus === 'online') {
            const broadcastService = new BroadcastService();
            const broadcastData = {
                adminId: user.id,
                adminUsername: user.username,
                title: 'Performer Online',
                messageEn: `${user.firstName} is now online for PNP Live! Book a private call now.`,
                messageEs: `${user.firstName} ya está en línea para PNP Live! Reserva una llamada privada ahora.`,
                targetType: 'all',
                buttons: [
                    {
                        text: 'Book a call',
                        type: 'callback',
                        data: `book_private_call:${user.id}`,
                    },
                ],
            };
            const broadcast = await broadcastService.createBroadcast(broadcastData);
            await broadcastService.sendBroadcast(bot, broadcast.broadcast_id);
        }
    } catch (error) {
        logger.error('Error in pnp_live_toggle_status:', error);
    }
    });
};

module.exports = registerPNPLiveModelHandlers;