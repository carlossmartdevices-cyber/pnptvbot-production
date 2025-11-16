const { Markup } = require('telegraf');
const PermissionService = require('../../services/permissionService');
const { PERMISSIONS } = require('../../models/permissionModel');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Show role management panel with current admins/moderators
 * @param {Context} ctx - Telegraf context
 * @param {boolean} edit - Whether to edit message
 */
async function showRoleManagement(ctx, edit = false) {
  try {
    const admins = await PermissionService.getAllAdmins();

    let message = '👑 *Gestión de Roles*\n\n';

    // Super Admins
    message += `🔴 *Super Admins* (${admins.superadmins.length}):\n`;
    if (admins.superadmins.length > 0) {
      for (const admin of admins.superadmins) {
        message += `  • @${admin.username || admin.id} (${admin.id})\n`;
      }
    } else {
      message += '  _Ninguno_\n';
    }
    message += '\n';

    // Admins
    message += `🟡 *Administradores* (${admins.admins.length}):\n`;
    if (admins.admins.length > 0) {
      for (const admin of admins.admins) {
        message += `  • @${admin.username || admin.id} (${admin.id})\n`;
      }
    } else {
      message += '  _Ninguno_\n';
    }
    message += '\n';

    // Moderators
    message += `🟢 *Moderadores* (${admins.moderators.length}):\n`;
    if (admins.moderators.length > 0) {
      for (const mod of admins.moderators) {
        message += `  • @${mod.username || mod.id} (${mod.id})\n`;
      }
    } else {
      message += '  _Ninguno_\n';
    }

    // Build keyboard
    const keyboard = [];

    // Add buttons
    keyboard.push([Markup.button.callback('➕ Agregar Admin', 'role_add_admin')]);
    keyboard.push([Markup.button.callback('➕ Agregar Moderador', 'role_add_moderator')]);

    // Show manage buttons if there are admins/moderators
    if (admins.admins.length > 0 || admins.moderators.length > 0) {
      keyboard.push([Markup.button.callback('⚙️ Gestionar Roles', 'role_manage_list')]);
    }

    keyboard.push([Markup.button.callback('⬅️ Volver', 'admin_cancel')]);

    if (edit) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      });
    }
  } catch (error) {
    logger.error('Error showing role management:', error);
  }
}

/**
 * Role Management Handlers - SuperAdmin only
 * @param {Telegraf} bot - Bot instance
 */
const registerRoleManagementHandlers = (bot) => {
  // Main role management menu
  bot.action('admin_roles', async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) {
        await ctx.answerCbQuery('❌ Solo Super Administradores pueden acceder');
        return;
      }

      await showRoleManagement(ctx, true);
    } catch (error) {
      logger.error('Error in admin roles:', error);
    }
  });

  // Add admin
  bot.action('role_add_admin', async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const lang = getLanguage(ctx);
      ctx.session.temp.addingRole = 'admin';
      ctx.session.temp.waitingForUserId = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        '👤 Agregar Admin\n\nEnvía el ID de Telegram del usuario que quieres promover a Admin:',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'admin_roles')],
        ]),
      );
    } catch (error) {
      logger.error('Error adding admin:', error);
    }
  });

  // Add moderator
  bot.action('role_add_moderator', async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const lang = getLanguage(ctx);
      ctx.session.temp.addingRole = 'moderator';
      ctx.session.temp.waitingForUserId = true;
      await ctx.saveSession();

      await ctx.editMessageText(
        '👤 Agregar Moderador\n\nEnvía el ID de Telegram del usuario que quieres promover a Moderador:',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'admin_roles')],
        ]),
      );
    } catch (error) {
      logger.error('Error adding moderator:', error);
    }
  });

  // Remove role (demote to user)
  bot.action(/^role_remove_(.+)$/, async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const targetUserId = ctx.match[1];
      const result = await PermissionService.removeRole(targetUserId, ctx.from.id);

      if (result.success) {
        await ctx.answerCbQuery(`✅ ${result.message}`);
        await showRoleManagement(ctx, true);
      } else {
        await ctx.answerCbQuery(`❌ ${result.message}`);
      }
    } catch (error) {
      logger.error('Error removing role:', error);
    }
  });

  // Promote moderator to admin
  bot.action(/^role_promote_(.+)$/, async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const targetUserId = ctx.match[1];
      const result = await PermissionService.assignRole(targetUserId, 'admin', ctx.from.id);

      if (result.success) {
        await ctx.answerCbQuery(`✅ ${result.message}`);
        await showRoleManagement(ctx, true);
      } else {
        await ctx.answerCbQuery(`❌ ${result.message}`);
      }
    } catch (error) {
      logger.error('Error promoting user:', error);
    }
  });

  // Demote admin to moderator
  bot.action(/^role_demote_(.+)$/, async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const targetUserId = ctx.match[1];
      const result = await PermissionService.assignRole(targetUserId, 'moderator', ctx.from.id);

      if (result.success) {
        await ctx.answerCbQuery(`✅ ${result.message}`);
        await showRoleManagement(ctx, true);
      } else {
        await ctx.answerCbQuery(`❌ ${result.message}`);
      }
    } catch (error) {
      logger.error('Error demoting user:', error);
    }
  });

  // Manage individual roles - show list
  bot.action('role_manage_list', async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const admins = await PermissionService.getAllAdmins();
      const keyboard = [];

      // List admins with actions
      if (admins.admins.length > 0) {
        keyboard.push([{ text: '🟡 ADMINISTRADORES', callback_data: 'noop' }]);
        for (const admin of admins.admins) {
          keyboard.push([
            Markup.button.callback(
              `@${admin.username || admin.id}`,
              `role_manage_detail_${admin.id}`,
            ),
          ]);
        }
      }

      // List moderators with actions
      if (admins.moderators.length > 0) {
        keyboard.push([{ text: '🟢 MODERADORES', callback_data: 'noop' }]);
        for (const mod of admins.moderators) {
          keyboard.push([
            Markup.button.callback(
              `@${mod.username || mod.id}`,
              `role_manage_detail_${mod.id}`,
            ),
          ]);
        }
      }

      keyboard.push([Markup.button.callback('⬅️ Volver', 'admin_roles')]);

      await ctx.editMessageText(
        '⚙️ *Gestionar Roles*\n\nSelecciona un usuario:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard),
        },
      );
    } catch (error) {
      logger.error('Error showing role manage list:', error);
    }
  });

  // Show details for specific user
  bot.action(/^role_manage_detail_(.+)$/, async (ctx) => {
    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return;

      const userId = ctx.match[1];
      const user = await UserModel.getById(userId);

      if (!user) {
        await ctx.answerCbQuery('❌ Usuario no encontrado');
        return;
      }

      const role = user.role || 'user';
      const roleDisplay = await PermissionService.getUserRoleDisplay(userId, 'es');

      let message = '👤 *Gestionar Usuario*\n\n';
      message += `Nombre: ${user.firstName || 'N/A'}\n`;
      message += `Usuario: @${user.username || 'N/A'}\n`;
      message += `ID: \`${userId}\`\n`;
      message += `Rol actual: ${roleDisplay}\n\n`;
      message += '¿Qué deseas hacer?';

      const keyboard = [];

      if (role === 'admin') {
        keyboard.push([Markup.button.callback('⬇️ Degradar a Moderador', `role_demote_${userId}`)]);
        keyboard.push([Markup.button.callback('❌ Remover Rol (a Usuario)', `role_remove_${userId}`)]);
      } else if (role === 'moderator') {
        keyboard.push([Markup.button.callback('⬆️ Promover a Admin', `role_promote_${userId}`)]);
        keyboard.push([Markup.button.callback('❌ Remover Rol (a Usuario)', `role_remove_${userId}`)]);
      }

      keyboard.push([Markup.button.callback('⬅️ Volver', 'role_manage_list')]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      });
    } catch (error) {
      logger.error('Error showing role manage detail:', error);
    }
  });

  // Handle user ID input for adding roles
  bot.on('text', async (ctx, next) => {
    if (!ctx.session.temp?.waitingForUserId || !ctx.session.temp?.addingRole) {
      return next();
    }

    try {
      const isSuperAdmin = await PermissionService.isSuperAdmin(ctx.from.id);
      if (!isSuperAdmin) return next();

      const userId = ctx.message.text.trim();
      const role = ctx.session.temp.addingRole;

      // Validate user ID (should be a number)
      if (!/^\d+$/.test(userId)) {
        await ctx.reply('❌ ID de usuario inválido. Debe ser un número.');
        return;
      }

      // Check if user exists
      const user = await UserModel.getById(userId);
      if (!user) {
        await ctx.reply('❌ Usuario no encontrado en la base de datos.');
        return;
      }

      // Assign role
      const result = await PermissionService.assignRole(userId, role, ctx.from.id);

      ctx.session.temp.waitingForUserId = false;
      ctx.session.temp.addingRole = null;
      await ctx.saveSession();

      if (result.success) {
        const roleEmoji = role === 'admin' ? '🟡' : '🟢';
        const roleName = role === 'admin' ? 'Admin' : 'Moderador';

        await ctx.reply(
          `✅ ${roleEmoji} ${user.firstName || 'Usuario'} (@${user.username || userId}) asignado como ${roleName}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Volver a Roles', 'admin_roles')],
            [Markup.button.callback('⬅️ Volver al Panel', 'admin_cancel')],
          ]),
        );

        logger.info(`Role assigned: ${userId} -> ${role} by ${ctx.from.id}`);
      } else {
        await ctx.reply(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      logger.error('Error processing user ID for role:', error);
      await ctx.reply('❌ Error al asignar rol. Intenta nuevamente.');
    }

    // Don't call next() - we handled this message
  });
};

module.exports = registerRoleManagementHandlers;
module.exports.showRoleManagement = showRoleManagement;
