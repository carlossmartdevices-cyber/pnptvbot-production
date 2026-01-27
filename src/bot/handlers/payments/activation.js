const { getFirestore } = require('../../../config/firebase');
const UserModel = require('../../../models/userModel');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const MessageTemplates = require('../../services/messageTemplates');
const { Telegraf } = require('telegraf');

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

      // Verify code in Firestore
      const db = getFirestore();
      const codeRef = db.collection('activationCodes').doc(code);
      const codeDoc = await codeRef.get();

      if (!codeDoc.exists) {
        logger.warn(`Invalid activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. Por favor verifica que hayas ingresado el código correctamente.\n\nSi el problema persiste, contacta al soporte.'
            : '❌ Invalid code. Please verify that you entered the code correctly.\n\nIf the problem persists, contact support.',
        );
      }

      const codeData = codeDoc.data();

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
      if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
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

        // Generate PRIME channel invite link for lifetime pass
        let inviteLink = 'https://t.me/PNPTV_PRIME'; // Fallback
        try {
          const bot = new Telegraf(process.env.BOT_TOKEN);
          const groupId = process.env.PRIME_CHANNEL_ID || '-1002997324714';
          const response = await bot.telegram.createChatInviteLink(groupId, {
            member_limit: 1,
            name: `LifetimePass ${code}`,
          });
          inviteLink = response.invite_link;
          logger.info('Lifetime pass channel invite link created', {
            userId,
            code,
            inviteLink,
            channelId: groupId,
          });
        } catch (linkError) {
          logger.warn('Failed to create lifetime pass invite link, using fallback', {
            userId,
            code,
            error: linkError.message,
          });
        }

        // Use unified lifetime pass message template with channel invite
        const successMessage = MessageTemplates.buildLifetimePassMessage(lang);

        // Add channel invite to the message
        const messageWithInvite = lang === 'es'
          ? successMessage + `\n\n🌟 *¡Accede al canal PRIME!*\n👉 [🔗 Ingresar a PRIME](${inviteLink})`
          : successMessage + `\n\n🌟 *Access PRIME Channel!*\n👉 [🔗 Join PRIME](${inviteLink})`;

        await ctx.reply(messageWithInvite, { parse_mode: 'Markdown', disable_web_page_preview: false });
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
   * Handle /lifetime100 command for Lifetime100 Promo activation
   * Usage: /lifetime100 CODE123
   */
  bot.command('lifetime100', async (ctx) => {
    try {
      const lang = getLanguage(ctx);
      const userId = ctx.from.id;

      // Extract code from command
      const commandText = ctx.message.text.trim();
      const parts = commandText.split(/\s+/);

      if (parts.length < 2) {
        return ctx.reply(
          lang === 'es'
            ? '❌ Por favor proporciona un código válido.\n\nUso: /lifetime100 TU_CODIGO\n\nEjemplo: /lifetime100 ABC123XYZ'
            : '❌ Please provide a valid code.\n\nUsage: /lifetime100 YOUR_CODE\n\nExample: /lifetime100 ABC123XYZ',
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

      // Verify code in Firestore
      const db = getFirestore();
      const codeRef = db.collection('activationCodes').doc(code);
      const codeDoc = await codeRef.get();

      if (!codeDoc.exists) {
        logger.warn(`Invalid lifetime100 activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Código inválido. Por favor verifica que hayas ingresado el código correctamente.\n\nSi el problema persiste, contacta al soporte.'
            : '❌ Invalid code. Please verify that you entered the code correctly.\n\nIf the problem persists, contact support.',
        );
      }

      const codeData = codeDoc.data();

      // Check if code is already used
      if (codeData.used) {
        logger.warn(`Used lifetime100 activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ya ha sido utilizado.\n\nCada código solo puede ser activado una vez.\n\nSi crees que esto es un error, contacta al soporte.'
            : '❌ This code has already been used.\n\nEach code can only be activated once.\n\nIf you believe this is an error, contact support.',
        );
      }

      // Check if code has expired (if expiration date is set)
      if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
        logger.warn(`Expired lifetime100 activation code attempted: ${code} by user ${userId}`);
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código ha expirado.\n\nPor favor contacta al soporte para obtener un nuevo código.'
            : '❌ This code has expired.\n\nPlease contact support to get a new code.',
        );
      }

      // Check if this is a lifetime100 promo code
      const product = codeData.product || 'lifetime-pass';
      if (product !== 'lifetime100-promo') {
        return ctx.reply(
          lang === 'es'
            ? '❌ Este código no es válido para Lifetime100 Promo. Por favor usa /activate para códigos regulares.'
            : '❌ This code is not valid for Lifetime100 Promo. Please use /activate for regular codes.',
        );
      }

      // Request receipt attachment
      const receiptRequest = lang === 'es'
        ? '📝 *Por favor adjunta tu recibo de pago*\n\nPara completar la activación de tu Lifetime100 Promo, por favor envía tu recibo de pago como respuesta a este mensaje.\n\nPuedes adjuntar una imagen o documento que muestre la transacción.'
        : '📝 *Please attach your payment receipt*\n\nTo complete your Lifetime100 Promo activation, please send your payment receipt as a reply to this message.\n\nYou can attach an image or document showing the transaction.';

      // Store code in session for receipt processing
      ctx.session.temp.lifetime100Code = code;
      await ctx.saveSession();

      await ctx.reply(receiptRequest, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error in lifetime100 activation command:', error);
      const lang = getLanguage(ctx);

      ctx.reply(
        lang === 'es'
          ? '❌ Ocurrió un error al procesar tu activación. Por favor intenta nuevamente más tarde o contacta al soporte.'
          : '❌ An error occurred while processing your activation. Please try again later or contact support.',
      );
    }
  });

  /**
   * Handle receipt attachment for lifetime100 activation
   */
  bot.on('message', async (ctx, next) => {
    try {
      // Check if this is a reply to a lifetime100 activation request
      const lifetime100Code = ctx.session?.temp?.lifetime100Code;
      
      if (lifetime100Code && ctx.message && (ctx.message.photo || ctx.message.document)) {
        const lang = getLanguage(ctx);
        const userId = ctx.from.id;
        
        // Process the receipt
        const receiptInfo = {
          userId: userId,
          username: ctx.from.username || null,
          code: lifetime100Code,
          messageId: ctx.message.message_id,
          chatId: ctx.chat.id,
          date: new Date(),
        };

        if (ctx.message.photo) {
          receiptInfo.type = 'photo';
          receiptInfo.fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          receiptInfo.caption = ctx.message.caption || 'Payment receipt';
        } else if (ctx.message.document) {
          receiptInfo.type = 'document';
          receiptInfo.fileId = ctx.message.document.file_id;
          receiptInfo.fileName = ctx.message.document.file_name;
          receiptInfo.caption = ctx.message.caption || 'Payment receipt';
        }

        // Store receipt info in Firestore
        const db = getFirestore();
        await db.collection('lifetime100Receipts').add(receiptInfo);

        // Clean up session
        delete ctx.session.temp.lifetime100Code;
        await ctx.saveSession();

        // Notify user that receipt is being processed
        const processingMsg = lang === 'es'
          ? '✅ *Recibo recibido*\n\nTu recibo de pago ha sido recibido y está siendo procesado.\n\nRecibirás una notificación cuando tu Lifetime100 Promo sea activado.\n\n📝 *Nota:* Esto puede tomar hasta 24 horas.'
          : '✅ *Receipt received*\n\nYour payment receipt has been received and is being processed.\n\nYou will receive a notification when your Lifetime100 Promo is activated.\n\n📝 *Note:* This may take up to 24 hours.';

        await ctx.reply(processingMsg, { parse_mode: 'Markdown' });

        // Notify admins about new receipt
        const adminNotification = `📝 *New Lifetime100 Receipt*\n\nUser: ${userId} (${ctx.from.username || 'No username'})\nCode: ${lifetime100Code}\nType: ${receiptInfo.type}\nFile ID: ${receiptInfo.fileId}`;

        // Send to support group and admins
        logger.info('Lifetime100 receipt received:', receiptInfo);
        
        // Send to support group if configured
        const supportGroupId = process.env.SUPPORT_GROUP_ID;
        if (supportGroupId) {
          try {
            await ctx.telegram.sendMessage(supportGroupId, adminNotification, {
              parse_mode: 'Markdown'
            });
            logger.info('Lifetime100 receipt notification sent to support group', {
              userId,
              code: lifetime100Code,
              supportGroupId
            });
          } catch (sendError) {
            logger.error('Failed to send lifetime100 notification to support group:', {
              error: sendError.message,
              userId,
              code: lifetime100Code
            });
          }
        }
        
        // Also send to admin users as backup
        const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter((id) => id.trim()) || [];
        for (const adminId of adminIds) {
          try {
            await ctx.telegram.sendMessage(adminId.trim(), adminNotification, {
              parse_mode: 'Markdown'
            });
            logger.info('Lifetime100 receipt notification sent to admin', {
              userId,
              code: lifetime100Code,
              adminId
            });
          } catch (sendError) {
            logger.error('Failed to send lifetime100 notification to admin:', {
              error: sendError.message,
              userId,
              code: lifetime100Code,
              adminId
            });
          }
        }

        return; // Don't process further
      }
    } catch (error) {
      logger.error('Error processing lifetime100 receipt:', error);
    }

    // Continue with normal message processing
    await next();
  });

  /**
   * Admin command to manually activate lifetime100 promo after receipt verification
   * Usage: /activate_lifetime100 USERID CODE123
   */
  bot.command('activate_lifetime100', async (ctx) => {
    try {
      // Check if user is admin
      const userId = ctx.from.id;
      const user = await UserModel.getById(userId);
      
      if (!user || !user.isAdmin) {
        return ctx.reply('❌ This command is only available to administrators.');
      }

      const lang = getLanguage(ctx);
      
      // Extract user ID and code from command
      const commandText = ctx.message.text.trim();
      const parts = commandText.split(/\s+/);

      if (parts.length < 3) {
        return ctx.reply(
          '❌ Usage: /activate_lifetime100 USERID CODE123'
        );
      }

      const targetUserId = parts[1];
      const code = parts[2].trim().toUpperCase();

      // Validate code format
      if (!/^[A-Z0-9]{6,20}$/.test(code)) {
        return ctx.reply('❌ Invalid code format. The code must contain 6-20 alphanumeric characters.');
      }

      await ctx.reply('⏳ Verifying code and activating lifetime100 promo...');

      // Verify code in Firestore
      const db = getFirestore();
      const codeRef = db.collection('activationCodes').doc(code);
      const codeDoc = await codeRef.get();

      if (!codeDoc.exists) {
        logger.warn(`Invalid lifetime100 activation code attempted by admin: ${code} by user ${userId}`);
        return ctx.reply('❌ Invalid code. Please verify that you entered the code correctly.');
      }

      const codeData = codeDoc.data();

      // Check if code is already used
      if (codeData.used) {
        logger.warn(`Used lifetime100 activation code attempted by admin: ${code} by user ${userId}`);
        return ctx.reply('❌ This code has already been used.');
      }

      // Check if this is a lifetime100 promo code
      const product = codeData.product || 'lifetime-pass';
      if (product !== 'lifetime100-promo') {
        return ctx.reply('❌ This code is not valid for Lifetime100 Promo.');
      }

      try {
        // Mark code as used
        await codeRef.update({
          used: true,
          usedAt: new Date(),
          usedBy: targetUserId,
          usedByUsername: ctx.from.username || null,
          activatedByAdmin: userId,
        });

        // Update user subscription
        const updates = {
          subscriptionStatus: 'active',
          planType: 'lifetime100',
          planExpiry: null, // Lifetime = no expiry
          lifetimeAccess: true,
          activatedAt: new Date(),
          activationCode: code,
        };

        await UserModel.updateById(targetUserId, updates);

        // Log successful activation
        logger.info(`Lifetime100 promo activated by admin: code=${code}, userId=${targetUserId}, adminId=${userId}`);

        // Log activation event to Firestore
        await db.collection('activationLogs').add({
          userId: targetUserId,
          username: ctx.from.username || null,
          code,
          product: 'lifetime100-promo',
          activatedAt: new Date(),
          success: true,
          activatedByAdmin: userId,
        });

        // Generate PRIME channel invite link for lifetime pass
        let inviteLink = 'https://t.me/PNPTV_PRIME'; // Fallback
        try {
          const bot = new Telegraf(process.env.BOT_TOKEN);
          const groupId = process.env.PRIME_CHANNEL_ID || '-1002997324714';
          const response = await bot.telegram.createChatInviteLink(groupId, {
            member_limit: 1,
            name: `Lifetime100 ${code}`,
          });
          inviteLink = response.invite_link;
          logger.info('Lifetime100 promo channel invite link created', {
            userId: targetUserId,
            code,
            inviteLink,
            channelId: groupId,
          });
        } catch (linkError) {
          logger.warn('Failed to create lifetime100 promo invite link, using fallback', {
            userId: targetUserId,
            code,
            error: linkError.message,
          });
        }

        // Use lifetime100 promo message template with channel invite
        const successMessage = MessageTemplates.buildLifetime100PromoMessage(lang);

        // Add channel invite to the message
        const messageWithInvite = lang === 'es'
          ? successMessage + `\n\n🌟 *¡Accede al canal PRIME!*\n👉 [🔗 Ingresar a PRIME](${inviteLink})`
          : successMessage + `\n\n🌟 *Access PRIME Channel!*\n👉 [🔗 Join PRIME](${inviteLink})`;

        // Send activation message to the user
        try {
          await ctx.telegram.sendMessage(targetUserId, messageWithInvite, { 
            parse_mode: 'Markdown', 
            disable_web_page_preview: false 
          });
        } catch (sendError) {
          logger.error('Error sending activation message to user:', sendError);
          await ctx.reply(`⚠️ Activation successful but couldn\'t notify user ${targetUserId}. They may have blocked the bot.`);
        }

        // Notify admin of success
        await ctx.reply(`✅ Lifetime100 promo successfully activated for user ${targetUserId} with code ${code}`);

      } catch (updateError) {
        // Rollback code usage if user update fails
        logger.error('Error updating user after lifetime100 activation:', updateError);

        try {
          await codeRef.update({
            used: false,
            usedAt: null,
            usedBy: null,
            usedByUsername: null,
            activatedByAdmin: null,
          });
        } catch (rollbackError) {
          logger.error('Error rolling back code usage:', rollbackError);
        }

        return ctx.reply(`❌ An error occurred while activating lifetime100 promo for user ${targetUserId}. Please try again.`);
      }
    } catch (error) {
      logger.error('Error in activate_lifetime100 command:', error);
      ctx.reply('❌ An error occurred while processing your activation request. Please try again later.');
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
