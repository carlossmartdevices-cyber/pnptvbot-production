const { query } = require('../../../config/postgres');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Activation code handlers for lifetime pass
 * @param {Telegraf} bot - Bot instance
 */
const registerActivationHandlers = (bot) => {
  /**
   * Handle /activate command
   * Usage: /activate CODE123
   */
  bot.command('activate', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id;

      // Extract code from command
      const commandText = ctx.message.text.trim();
      const parts = commandText.split(/\s+/);

      if (parts.length < 2) {
        return ctx.reply(
          lang === 'es'
            ? '❌ Por favor proporciona un código válido.\n\nUso: /activate TU_CODIGO\n\nEjemplo: /activate ABC123XYZ'
            : '❌ Please provide a valid code.\n\nUsage: /activate YOUR_CODE\n\nExample: /activate ABC123XYZ',
        );
      }

      const code = parts[1].trim().toUpperCase();

      // Validate code format (alphanumeric, 6-20 characters)
      if (!/^[A-Z0-9]{6,20}$/.test(code)) {
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. El código debe contener entre 6 y 20 caracteres alfanuméricos.'
            : '❌ Invalid code. The code must contain 6-20 alphanumeric characters.',
        );
      }

      await ctx.reply(
        lang === 'es'
          ? '⏳ Verificando código...'
          : '⏳ Verifying code...',
      );

      // Verify code in PostgreSQL
      const codeResult = await query(
        'SELECT * FROM activation_codes WHERE code = $1',
        [code]
      );

      if (codeResult.rows.length === 0) {
        logger.warn(`Invalid activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. Por favor verifica que hayas ingresado el código correctamente.\n\nSi el problema persiste, contacta al soporte.'
            : '❌ Invalid code. Please verify that you entered the code correctly.\n\nIf the problem persists, contact support.',
        );
      }

      const codeData = codeResult.rows[0];

      // Check if code is already used
      if (codeData.used) {
        logger.warn(`Used activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ya ha sido utilizado.\n\nCada código solo puede ser activado una vez.\n\nSi crees que esto es un error, contacta al soporte.'
            : '❌ This code has already been used.\n\nEach code can only be activated once.\n\nIf you believe this is an error, contact support.',
        );
      }

      // Check if code has expired (if expiration date is set)
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        logger.warn(`Expired activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ha expirado.\n\nPor favor contacta al soporte para obtener un nuevo código.'
            : '❌ This code has expired.\n\nPlease contact support to get a new code.',
        );
      }

      // Get product type (default to lifetime-pass)
      const product = codeData.product || 'lifetime-pass';

      try {
        // Mark code as used
        await query(
          `UPDATE activation_codes
           SET used = true, used_at = $1, used_by = $2, used_by_username = $3
           WHERE code = $4`,
          [new Date(), String(userId), ctx.from.username || null, code]
        );

        // Update user subscription using the correct method
        await UserModel.updateSubscription(userId, {
          status: 'active',
          planId: 'lifetime',
          expiry: null, // Lifetime = no expiry
        });

        // Log successful activation
        logger.info(`Lifetime pass activated: code=${code}, userId=${userId}, product=${product}`);

        // Log activation event to PostgreSQL
        await query(
          `INSERT INTO activation_logs (user_id, username, code, product, activated_at, success)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [String(userId), ctx.from.username || null, code, product, new Date(), true]
        );

        // Send success message with enhanced formatting
        const successMessage = lang === 'es'
          ? '🎉 ¡Felicidades! Tu Lifetime Pass ha sido activado con éxito.\n\n'
            + '✅ Tu membresía es ahora PERMANENTE\n'
            + '✅ Acceso ilimitado a todo el contenido\n'
            + '✅ Sin fechas de expiración\n'
            + '✅ Todas las funciones premium desbloqueadas\n\n'
            + '🔥 Disfruta de:\n'
            + '• Videos HD/4K completos\n'
            + '• Contenido exclusivo PNP\n'
            + '• Función "Quién está cerca"\n'
            + '• Soporte prioritario 24/7\n'
            + '• Actualizaciones futuras gratis\n\n'
            + '¡Bienvenido a la comunidad PNPtv! 🎊'
          : '🎉 Congratulations! Your Lifetime Pass has been successfully activated.\n\n'
            + '✅ Your membership is now PERMANENT\n'
            + '✅ Unlimited access to all content\n'
            + '✅ No expiration dates\n'
            + '✅ All premium features unlocked\n\n'
            + '🔥 Enjoy:\n'
            + '• Full HD/4K videos\n'
            + '• Exclusive PNP content\n'
            + '• "Who\'s Nearby" feature\n'
            + '• Priority 24/7 support\n'
            + '• Free future updates\n\n'
            + 'Welcome to the PNPtv community! 🎊';

        await ctx.reply(successMessage);

        // Send PRIME channel invites for all channels
        try {
          const primeChannels = (process.env.PRIME_CHANNEL_ID || '').split(',').map(id => id.trim()).filter(id => id);
          if (primeChannels.length > 0) {
            const inviteLinks = [];
            for (const channelId of primeChannels) {
              try {
                const inviteLink = await ctx.telegram.createChatInviteLink(channelId, {
                  member_limit: 1,
                  name: `Activation code - ${userId}`,
                });
                inviteLinks.push(inviteLink.invite_link);
              } catch (channelError) {
                logger.error('Error creating invite for channel:', { channelId, error: channelError.message });
              }
            }

            if (inviteLinks.length > 0) {
              const linksText = inviteLinks.map((link, i) => `${i + 1}. ${link}`).join('\n');
              const inviteMessage = lang === 'es'
                ? `🔗 *Acceso a los Canales PRIME*\n\nHaz clic en los siguientes enlaces para unirte a los canales exclusivos:\n\n${linksText}\n\n⚠️ Estos enlaces son de uso único y personal.`
                : `🔗 *PRIME Channels Access*\n\nClick the following links to join the exclusive channels:\n\n${linksText}\n\n⚠️ These links are for single use only.`;

              await ctx.reply(inviteMessage, { parse_mode: 'Markdown' });
            }
          }
        } catch (inviteError) {
          logger.error('Error creating PRIME channel invites:', inviteError);
        }

        // Send follow-up message after initial response
        // Using Promise.resolve().then() instead of setTimeout to maintain context
        Promise.resolve().then(async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await ctx.reply(
              lang === 'es'
                ? '📱 Usa /menu para ver todas las funciones disponibles.'
                : '📱 Use /menu to see all available features.',
            );
          } catch (err) {
            logger.error('Error sending follow-up message:', err);
          }
        });
      } catch (updateError) {
        // Rollback code usage if user update fails
        logger.error('Error updating user after activation:', updateError);

        try {
          await query(
            `UPDATE activation_codes
             SET used = false, used_at = NULL, used_by = NULL, used_by_username = NULL
             WHERE code = $1`,
            [code]
          );
        } catch (rollbackError) {
          logger.error('Error rolling back code usage:', rollbackError);
        }

        return ctx.reply(
          lang === 'es'
            ? `❌ Ocurrió un error al activar tu membresía. Por favor intenta nuevamente.\n\nSi el problema persiste, contacta al soporte con este código: ${code}`
            : `❌ An error occurred while activating your membership. Please try again.\n\nIf the problem persists, contact support with this code: ${code}`,
        );
      }
    } catch (error) {
      logger.error('Error in activation command:', error);
      const lang = getLanguage(ctx);

      ctx.reply(
        lang === 'es'
          ? '❌ Ocurrió un error al procesar tu activación. Por favor intenta nuevamente más tarde o contacta al soporte.'
          : '❌ An error occurred while processing your activation. Please try again later or contact support.',
      );
    }
  });

  /**
   * Handle /checkcode command (for support/debugging)
   * Only for admins
   */
  bot.command('checkcode', async (ctx) => {
    try {
      const userId = ctx.from.id;

      // Check if user is admin (you should implement proper admin check)
      const user = await UserModel.getById(userId);
      if (!user || user.role !== 'admin') {
        return; // Silently ignore for non-admins
      }

      const lang = getLanguage(ctx);
      const commandText = ctx.message.text.trim();
      const parts = commandText.split(/\s+/);

      if (parts.length < 2) {
        return ctx.reply('Usage: /checkcode CODE');
      }

      const code = parts[1].trim().toUpperCase();

      const codeResult = await query(
        'SELECT * FROM activation_codes WHERE code = $1',
        [code]
      );

      if (codeResult.rows.length === 0) {
        return ctx.reply('❌ Code does not exist in database.');
      }

      const codeData = codeResult.rows[0];

      let status = '📊 Code Information:\n\n';
      status += `Code: ${code}\n`;
      status += `Product: ${codeData.product || 'Not specified'}\n`;
      status += `Used: ${codeData.used ? 'Yes' : 'No'}\n`;

      if (codeData.used) {
        status += `Used At: ${codeData.used_at ? new Date(codeData.used_at).toISOString() : 'Unknown'}\n`;
        status += `Used By: ${codeData.used_by || 'Unknown'}\n`;
        status += `Username: ${codeData.used_by_username || 'Unknown'}\n`;
      }

      if (codeData.created_at) {
        status += `Created At: ${new Date(codeData.created_at).toISOString()}\n`;
      }

      if (codeData.expires_at) {
        status += `Expires At: ${new Date(codeData.expires_at).toISOString()}\n`;
        status += `Expired: ${new Date(codeData.expires_at) < new Date() ? 'Yes' : 'No'}\n`;
      }

      if (codeData.email) {
        status += `Email: ${codeData.email}\n`;
      }

      await ctx.reply(status);
    } catch (error) {
      logger.error('Error in checkcode command:', error);
      ctx.reply('❌ Error checking code.');
    }
  });
};

module.exports = registerActivationHandlers;
