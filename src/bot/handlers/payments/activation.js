const { getFirestore } = require('../../../config/firebase');
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
            : '❌ Please provide a valid code.\n\nUsage: /activate YOUR_CODE\n\nExample: /activate ABC123XYZ'
        );
      }

      const code = parts[1].trim().toUpperCase();

      // Validate code format (alphanumeric, 6-20 characters)
      if (!/^[A-Z0-9]{6,20}$/.test(code)) {
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. El código debe contener entre 6 y 20 caracteres alfanuméricos.'
            : '❌ Invalid code. The code must contain 6-20 alphanumeric characters.'
        );
      }

      await ctx.reply(
        lang === 'es'
          ? '⏳ Verificando código...'
          : '⏳ Verifying code...'
      );

      // Verify code in Firestore
      const db = getFirestore();
      const codeRef = db.collection('activationCodes').doc(code);
      const codeDoc = await codeRef.get();

      if (!codeDoc.exists) {
        logger.warn(`Invalid activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. Por favor verifica que hayas ingresado el código correctamente.\n\nSi el problema persiste, contacta al soporte.'
            : '❌ Invalid code. Please verify that you entered the code correctly.\n\nIf the problem persists, contact support.'
        );
      }

      const codeData = codeDoc.data();

      // Check if code is already used
      if (codeData.used) {
        logger.warn(`Used activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ya ha sido utilizado.\n\nCada código solo puede ser activado una vez.\n\nSi crees que esto es un error, contacta al soporte.'
            : '❌ This code has already been used.\n\nEach code can only be activated once.\n\nIf you believe this is an error, contact support.'
        );
      }

      // Check if code has expired (if expiration date is set)
      if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
        logger.warn(`Expired activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ha expirado.\n\nPor favor contacta al soporte para obtener un nuevo código.'
            : '❌ This code has expired.\n\nPlease contact support to get a new code.'
        );
      }

      // Get product type (default to lifetime-pass)
      const product = codeData.product || 'lifetime-pass';

      try {
        // Mark code as used
        await codeRef.update({
          used: true,
          usedAt: new Date(),
          usedBy: userId,
          usedByUsername: ctx.from.username || null,
        });

        // Update user subscription
        const updates = {
          subscriptionStatus: 'active',
          planType: 'lifetime',
          planExpiry: null, // Lifetime = no expiry
          lifetimeAccess: true,
          activatedAt: new Date(),
          activationCode: code,
        };

        await UserModel.updateById(userId, updates);

        // Log successful activation
        logger.info(`Lifetime pass activated: code=${code}, userId=${userId}, product=${product}`);

        // Log activation event to Firestore
        await db.collection('activationLogs').add({
          userId,
          username: ctx.from.username || null,
          code,
          product,
          activatedAt: new Date(),
          success: true,
        });

        // Send success message with enhanced formatting
        const successMessage = lang === 'es'
          ? `🎉 ¡Felicidades! Tu Lifetime Pass ha sido activado con éxito.\n\n` +
            `✅ Tu membresía es ahora PERMANENTE\n` +
            `✅ Acceso ilimitado a todo el contenido\n` +
            `✅ Sin fechas de expiración\n` +
            `✅ Todas las funciones premium desbloqueadas\n\n` +
            `🔥 Disfruta de:\n` +
            `• Videos HD/4K completos\n` +
            `• Contenido exclusivo PNP\n` +
            `• Función "Quién está cerca"\n` +
            `• Soporte prioritario 24/7\n` +
            `• Actualizaciones futuras gratis\n\n` +
            `¡Bienvenido a la comunidad PNPtv! 🎊`
          : `🎉 Congratulations! Your Lifetime Pass has been successfully activated.\n\n` +
            `✅ Your membership is now PERMANENT\n` +
            `✅ Unlimited access to all content\n` +
            `✅ No expiration dates\n` +
            `✅ All premium features unlocked\n\n` +
            `🔥 Enjoy:\n` +
            `• Full HD/4K videos\n` +
            `• Exclusive PNP content\n` +
            `• "Who's Nearby" feature\n` +
            `• Priority 24/7 support\n` +
            `• Free future updates\n\n` +
            `Welcome to the PNPtv community! 🎊`;

        await ctx.reply(successMessage);

        // Optional: Send to main menu or show features
        setTimeout(async () => {
          try {
            await ctx.reply(
              lang === 'es'
                ? '📱 Usa /menu para ver todas las funciones disponibles.'
                : '📱 Use /menu to see all available features.',
            );
          } catch (err) {
            logger.error('Error sending follow-up message:', err);
          }
        }, 2000);

      } catch (updateError) {
        // Rollback code usage if user update fails
        logger.error('Error updating user after activation:', updateError);

        try {
          await codeRef.update({
            used: false,
            usedAt: null,
            usedBy: null,
            usedByUsername: null,
          });
        } catch (rollbackError) {
          logger.error('Error rolling back code usage:', rollbackError);
        }

        return ctx.reply(
          lang === 'es'
            ? '❌ Ocurrió un error al activar tu membresía. Por favor intenta nuevamente.\n\nSi el problema persiste, contacta al soporte con este código: ' + code
            : '❌ An error occurred while activating your membership. Please try again.\n\nIf the problem persists, contact support with this code: ' + code
        );
      }

    } catch (error) {
      logger.error('Error in activation command:', error);
      const lang = getLanguage(ctx);

      ctx.reply(
        lang === 'es'
          ? '❌ Ocurrió un error al procesar tu activación. Por favor intenta nuevamente más tarde o contacta al soporte.'
          : '❌ An error occurred while processing your activation. Please try again later or contact support.'
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

      const db = getFirestore();
      const codeRef = db.collection('activationCodes').doc(code);
      const codeDoc = await codeRef.get();

      if (!codeDoc.exists) {
        return ctx.reply('❌ Code does not exist in database.');
      }

      const codeData = codeDoc.data();

      let status = '📊 Code Information:\n\n';
      status += `Code: ${code}\n`;
      status += `Product: ${codeData.product || 'Not specified'}\n`;
      status += `Used: ${codeData.used ? 'Yes' : 'No'}\n`;

      if (codeData.used) {
        status += `Used At: ${codeData.usedAt?.toDate()?.toISOString() || 'Unknown'}\n`;
        status += `Used By: ${codeData.usedBy || 'Unknown'}\n`;
        status += `Username: ${codeData.usedByUsername || 'Unknown'}\n`;
      }

      if (codeData.createdAt) {
        status += `Created At: ${codeData.createdAt.toDate().toISOString()}\n`;
      }

      if (codeData.expiresAt) {
        status += `Expires At: ${codeData.expiresAt.toDate().toISOString()}\n`;
        status += `Expired: ${codeData.expiresAt.toDate() < new Date() ? 'Yes' : 'No'}\n`;
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
