const logger = require('../../utils/logger');
const UserModel = require('../../models/userModel');
const PlanModel = require('../../models/planModel');
const ConfirmationTokenService = require('./confirmationTokenService');

/**
 * Payment Notification Service
 * Sends confirmation messages to users via Telegram after successful payment
 */
class PaymentNotificationService {
  /**
   * Send payment confirmation message to user
   * @param {Object} params - Notification parameters
   * @param {Object} params.bot - Telegraf bot instance
   * @param {string} params.userId - Telegram user ID
   * @param {string} params.paymentId - Payment ID
   * @param {string} params.planId - Plan ID
   * @param {string} params.provider - Payment provider
   * @param {string} params.amount - Payment amount
   * @param {Date} params.expiryDate - Subscription expiry date
   * @returns {Promise<boolean>} Success status
   */
  static async sendPaymentConfirmation({
    bot,
    userId,
    paymentId,
    planId,
    provider,
    amount,
    expiryDate,
  }) {
    try {
      // Get user details
      const user = await UserModel.getById(userId);
      if (!user) {
        logger.warn('User not found for payment confirmation', { userId, paymentId });
        return false;
      }

      // Get plan details
      const plan = await PlanModel.getById(planId);
      if (!plan) {
        logger.warn('Plan not found for payment confirmation', { planId, paymentId });
        return false;
      }

      // Generate one-time confirmation token
      const token = await ConfirmationTokenService.generateToken({
        paymentId,
        userId,
        planId,
        provider,
      });

      const confirmationLink = ConfirmationTokenService.getConfirmationLink(token);
      const planName = plan.display_name || plan.name;
      const formattedAmount = parseFloat(amount).toFixed(2);

      // Determine language (default to Spanish if not set)
      const lang = user.language || 'es';

      // Build confirmation message
      let message = '';
      let confirmButtonText = '';

      if (lang === 'es') {
        message = `🎉 ¡Pago Confirmado!\n\n`;
        message += `✅ Tu suscripción a ${planName} ha sido completada con éxito\n\n`;
        message += `📋 Detalles de tu compra:\n`;
        message += `• Plan: ${planName}\n`;
        message += `• Monto: $${formattedAmount}\n`;
        message += `• Proveedor: ${this.getProviderName(provider, lang)}\n`;
        message += `• Fecha de compra: ${new Date().toLocaleDateString('es-ES')}\n`;

        if (expiryDate && !plan.is_lifetime) {
          message += `• Vence: ${expiryDate.toLocaleDateString('es-ES')}\n`;
        } else if (plan.is_lifetime) {
          message += `• Duración: Permanente ♾️\n`;
        }

        message += `\n🔐 Verifica tu compra usando el enlace seguro de abajo.\n`;
        message += `Este enlace es única y solo puede ser usado una vez.\n\n`;
        message += `¡Gracias por tu confianza en PNPtv! 🙏`;
        confirmButtonText = '✅ Confirmar Compra';
      } else {
        message = `🎉 Payment Confirmed!\n\n`;
        message += `✅ Your subscription to ${planName} has been completed successfully\n\n`;
        message += `📋 Purchase Details:\n`;
        message += `• Plan: ${planName}\n`;
        message += `• Amount: $${formattedAmount}\n`;
        message += `• Provider: ${this.getProviderName(provider, lang)}\n`;
        message += `• Purchase Date: ${new Date().toLocaleDateString('en-US')}\n`;

        if (expiryDate && !plan.is_lifetime) {
          message += `• Expires: ${expiryDate.toLocaleDateString('en-US')}\n`;
        } else if (plan.is_lifetime) {
          message += `• Duration: Permanent ♾️\n`;
        }

        message += `\n🔐 Verify your purchase using the secure link below.\n`;
        message += `This link is unique and can only be used once.\n\n`;
        message += `Thank you for your trust in PNPtv! 🙏`;
        confirmButtonText = '✅ Confirm Purchase';
      }

      // Send message with inline button
      try {
        const { Markup } = require('telegraf');

        await bot.telegram.sendMessage(userId, message, {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url(confirmButtonText, confirmationLink)],
          ]).reply_markup,
        });

        logger.info('Payment confirmation sent to user', {
          userId,
          paymentId,
          provider,
          planId,
        });

        return true;
      } catch (sendError) {
        logger.error('Error sending payment confirmation message:', {
          userId,
          paymentId,
          error: sendError.message,
        });
        // Return true anyway as the payment is still valid
        return true;
      }
    } catch (error) {
      logger.error('Error in payment confirmation notification:', {
        userId,
        paymentId,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Get payment provider name for display
   * @param {string} provider - Provider code
   * @param {string} lang - Language code
   * @returns {string} Provider display name
   */
  static getProviderName(provider, lang = 'en') {
    const providers = {
      paypal: { en: 'PayPal', es: 'PayPal' },
      daimo: { en: 'Daimo Pay', es: 'Daimo Pay' },
      epayco: { en: 'ePayco', es: 'ePayco' },
    };

    return providers[provider]?.[lang] || provider.toUpperCase();
  }

  /**
   * Send subscription activated message
   * @param {Object} params - Notification parameters
   * @param {Object} params.bot - Telegraf bot instance
   * @param {string} params.userId - Telegram user ID
   * @param {string} params.planName - Plan name
   * @param {Date} params.expiryDate - Subscription expiry date
   * @returns {Promise<boolean>} Success status
   */
  static async sendSubscriptionActivated({ bot, userId, planName, expiryDate }) {
    try {
      const user = await UserModel.getById(userId);
      if (!user) {
        logger.warn('User not found for subscription activated notification', { userId });
        return false;
      }

      const lang = user.language || 'es';
      let message = '';

      if (lang === 'es') {
        message = `🎊 ¡Membresía Activada!\n\n`;
        message += `🌟 ${planName} ya está activa en tu cuenta\n\n`;
        message += `✨ Ahora tienes acceso a:\n`;
        message += `• Videos HD/4K completos\n`;
        message += `• Contenido exclusivo PNP\n`;
        message += `• Función "Quién está cerca"\n`;
        message += `• Salas de llamadas de video en vivo\n`;
        message += `• Soporte prioritario 24/7\n\n`;
        message += `📋 Detalles de tu membresía:\n`;
        message += `• Plan: ${planName}\n`;
        if (expiryDate) {
          message += `• Vence: ${expiryDate.toLocaleDateString('es-ES')}\n`;
        } else {
          message += `• Duración: Permanente ♾️\n`;
        }
        message += `\n📱 Usa /menu para ver todas las funciones disponibles\n`;
        message += `🎥 Accede a la sala de videos en vivo: /live\n`;
        message += `🔗 Comparte tu cuenta de forma segura: /share-account`;
      } else {
        message = `🎊 Membership Activated!\n\n`;
        message += `🌟 ${planName} is now active on your account\n\n`;
        message += `✨ You now have access to:\n`;
        message += `• Full HD/4K videos\n`;
        message += `• Exclusive PNP content\n`;
        message += `• "Who's Nearby" feature\n`;
        message += `• Live video chat rooms\n`;
        message += `• Priority 24/7 support\n\n`;
        message += `📋 Your membership details:\n`;
        message += `• Plan: ${planName}\n`;
        if (expiryDate) {
          message += `• Expires: ${expiryDate.toLocaleDateString('en-US')}\n`;
        } else {
          message += `• Duration: Permanent ♾️\n`;
        }
        message += `\n📱 Use /menu to see all available features\n`;
        message += `🎥 Access live video room: /live\n`;
        message += `🔗 Share your account securely: /share-account`;
      }

      try {
        await bot.telegram.sendMessage(userId, message, {
          parse_mode: 'HTML',
        });

        logger.info('Subscription activated notification sent', { userId, planName });
        return true;
      } catch (sendError) {
        logger.error('Error sending subscription activated message:', {
          userId,
          error: sendError.message,
        });
        return true; // Don't fail the overall process
      }
    } catch (error) {
      logger.error('Error in subscription activated notification:', {
        userId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Send admin notification for payment completion
   * @param {Object} params - Notification parameters
   * @param {Object} params.bot - Telegraf bot instance
   * @param {string} params.userId - Customer user ID
   * @param {string} params.planName - Plan name
   * @param {number} params.amount - Payment amount
   * @param {string} params.provider - Payment provider
   * @param {string} params.transactionId - Transaction ID
   * @param {string} params.customerName - Customer name
   * @param {string} params.customerEmail - Customer email
   * @returns {Promise<boolean>} Success status
   */
  static async sendAdminPaymentNotification({
    bot,
    userId,
    planName,
    amount,
    provider,
    transactionId,
    customerName,
    customerEmail,
  }) {
    try {
      const adminId = process.env.ADMIN_ID;
      if (!adminId) {
        logger.warn('ADMIN_ID not configured, skipping admin notification');
        return false;
      }

      const formattedAmount = parseFloat(amount).toFixed(2);
      const timestamp = new Date().toLocaleString('es-ES');

      const message = [
        '💰 *NUEVA COMPRA COMPLETADA*',
        '',
        '✅ Un cliente ha completado su pago exitosamente',
        '',
        '👤 *Información del Cliente:*',
        `• Nombre: ${customerName || 'N/A'}`,
        `• Email: ${customerEmail || 'N/A'}`,
        `• ID Usuario: ${userId}`,
        '',
        '📦 *Detalles de la Compra:*',
        `• Plan: ${planName}`,
        `• Monto: $${formattedAmount} USD`,
        `• Proveedor: ${this.getProviderName(provider, 'es')}`,
        `• Transacción ID: \`${transactionId}\``,
        `• Fecha: ${timestamp}`,
        '',
        '🔑 *Acciones Disponibles:*',
        `/user_${userId} - Ver perfil del cliente`,
        `/plan_${planName} - Ver detalles del plan`,
      ].join('\n');

      try {
        await bot.telegram.sendMessage(adminId, message, {
          parse_mode: 'Markdown',
        });

        logger.info('Admin payment notification sent', {
          adminId,
          userId,
          planName,
          amount,
          provider,
        });

        return true;
      } catch (sendError) {
        logger.error('Error sending admin notification:', {
          adminId,
          userId,
          error: sendError.message,
        });
        return false;
      }
    } catch (error) {
      logger.error('Error in admin payment notification:', {
        userId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Send admin daily payment summary
   * @param {Object} params - Notification parameters
   * @param {Object} params.bot - Telegraf bot instance
   * @param {number} params.totalPayments - Total payment count
   * @param {number} params.totalAmount - Total amount collected
   * @param {Array} params.payments - Array of payment objects
   * @returns {Promise<boolean>} Success status
   */
  static async sendAdminDailySummary({ bot, totalPayments, totalAmount, payments = [] }) {
    try {
      const adminId = process.env.ADMIN_ID;
      if (!adminId) {
        logger.warn('ADMIN_ID not configured, skipping daily summary');
        return false;
      }

      const date = new Date().toLocaleDateString('es-ES');

      let message = [
        '📊 *RESUMEN DIARIO DE PAGOS*',
        `Fecha: ${date}`,
        '',
        '💰 *Totales:*',
        `• Pagos completados: ${totalPayments}`,
        `• Monto total: $${totalAmount.toFixed(2)} USD`,
        '',
      ].join('\n');

      if (payments.length > 0) {
        message += '📝 *Últimos Pagos:*\n';
        payments.slice(0, 5).forEach((payment, index) => {
          message += `${index + 1}. ${payment.planName} - $${payment.amount.toFixed(2)} (${payment.provider})\n`;
        });
      }

      try {
        await bot.telegram.sendMessage(adminId, message, {
          parse_mode: 'Markdown',
        });

        logger.info('Admin daily summary sent', {
          totalPayments,
          totalAmount,
        });

        return true;
      } catch (sendError) {
        logger.error('Error sending admin daily summary:', {
          error: sendError.message,
        });
        return false;
      }
    } catch (error) {
      logger.error('Error in admin daily summary:', {
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = PaymentNotificationService;
