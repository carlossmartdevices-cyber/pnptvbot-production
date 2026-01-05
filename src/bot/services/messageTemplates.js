const logger = require('../../utils/logger');

/**
 * Message Templates Service
 * Centralized message formatting for consistent user communications
 */
class MessageTemplates {
  /**
   * Build unified prime activation confirmation message
   * Used across all payment and activation sources for consistency
   *
   * @param {Object} params - Message parameters
   * @param {string} params.planName - Plan display name (e.g., "PRIME Monthly")
   * @param {number} params.amount - Payment amount (can be null for manual activations)
   * @param {Date|null} params.expiryDate - Subscription expiry date (null for lifetime)
   * @param {string} params.transactionId - Transaction/activation/code ID
   * @param {string} params.inviteLink - Prime channel invite link
   * @param {string} params.language - Language code ('es' for Spanish, 'en' for English)
   * @returns {string} Formatted message ready for Telegram
   */
  static buildPrimeActivationMessage({
    planName,
    amount,
    expiryDate,
    transactionId,
    inviteLink,
    language = 'es',
  }) {
    try {
      // Format expiry date
      let expiryStr = '';
      if (expiryDate) {
        expiryStr = expiryDate.toLocaleDateString(
          language === 'es' ? 'es-ES' : 'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        );
      } else {
        expiryStr = language === 'es' ? 'Permanente ♾️' : 'Permanent ♾️';
      }

      // Format amount (handle null for manual activations)
      let amountLine = '';
      if (amount !== null && amount !== undefined) {
        amountLine = `💵 ${language === 'es' ? 'Monto' : 'Amount'}: $${parseFloat(amount).toFixed(2)} USD\n`;
      }

      // Build message based on language
      if (language === 'es') {
        return [
          '🎉 *¡Pago Confirmado!*',
          '',
          '✅ Tu suscripción ha sido activada exitosamente.',
          '',
          '📋 *Detalles de la Compra:*',
          `💎 ${language === 'es' ? 'Plan' : 'Plan'}: ${planName}`,
          amountLine.trim(),
          `📅 ${language === 'es' ? 'Válido hasta' : 'Valid until'}: ${expiryStr}`,
          `🔖 ${language === 'es' ? 'ID de Transacción' : 'Transaction ID'}: ${transactionId}`,
          '',
          '🌟 *¡Bienvenido a PRIME!*',
          '',
          '👉 Accede al canal exclusivo aquí:',
          `[🔗 Ingresar a PRIME](${inviteLink})`,
          '',
          '💎 Disfruta de todo el contenido premium y beneficios exclusivos.',
          '',
          '📚 *¿Cómo usar PNPtv?*',
          '👉 Guía completa: https://pnptv.app/how-to-use',
          '',
          '📱 Usa /menu para ver todas las funciones disponibles.',
          '',
          '¡Gracias por tu apoyo! 🙏',
        ]
          .filter((line) => line !== '') // Remove empty lines from amount if not included
          .join('\n');
      } else {
        return [
          '🎉 *Payment Confirmed!*',
          '',
          '✅ Your subscription has been activated successfully.',
          '',
          '📋 *Purchase Details:*',
          `💎 Plan: ${planName}`,
          amountLine.trim(),
          `📅 Valid until: ${expiryStr}`,
          `🔖 Transaction ID: ${transactionId}`,
          '',
          '🌟 *Welcome to PRIME!*',
          '',
          '👉 Access the exclusive channel here:',
          `[🔗 Join PRIME](${inviteLink})`,
          '',
          '💎 Enjoy all premium content and exclusive benefits.',
          '',
          '📚 *How to use PNPtv?*',
          '👉 Complete guide: https://pnptv.app/how-to-use',
          '',
          '📱 Use /menu to see all available features.',
          '',
          'Thanks for your support! 🙏',
        ]
          .filter((line) => line !== '') // Remove empty lines from amount if not included
          .join('\n');
      }
    } catch (error) {
      logger.error('Error building prime activation message:', error);
      throw error;
    }
  }

  /**
   * Build lifetime pass activation message
   * Special format for lifetime/permanent subscriptions
   *
   * @param {string} language - Language code ('es' or 'en')
   * @returns {string} Formatted lifetime pass message
   */
  static buildLifetimePassMessage(language = 'es') {
    if (language === 'es') {
      return [
        '🎉 *¡Felicidades! Tu Lifetime Pass ha sido activado con éxito.*',
        '',
        '✅ Tu membresía es ahora PERMANENTE',
        '✅ Acceso ilimitado a todo el contenido',
        '✅ Sin fechas de expiración',
        '✅ Todas las funciones premium desbloqueadas',
        '',
        '🔥 *Disfruta de:*',
        '• Videos HD/4K completos',
        '• Contenido exclusivo PNP',
        '• Función "Quién está cerca"',
        '• Soporte prioritario 24/7',
        '• Actualizaciones futuras gratis',
        '',
        '📚 *¿Cómo usar PNPtv?*',
        '👉 Guía completa: https://pnptv.app/how-to-use',
        '',
        '📱 Usa /menu para ver todas las funciones disponibles.',
        '',
        '¡Bienvenido a la comunidad PNPtv! 🎊',
      ].join('\n');
    } else {
      return [
        '🎉 *Congratulations! Your Lifetime Pass has been successfully activated.*',
        '',
        '✅ Your membership is now PERMANENT',
        '✅ Unlimited access to all content',
        '✅ No expiration dates',
        '✅ All premium features unlocked',
        '',
        '🔥 *Enjoy:*',
        '• Full HD/4K videos',
        '• Exclusive PNP content',
        '• "Who\'s Nearby" feature',
        '• Priority 24/7 support',
        '• Free future updates',
        '',
        '📚 *How to use PNPtv?*',
        '👉 Complete guide: https://pnptv.app/how-to-use',
        '',
        '📱 Use /menu to see all available features.',
        '',
        'Welcome to the PNPtv community! 🎊',
      ].join('\n');
    }
  }

  /**
   * Get formatted expiry date string
   * @param {Date|null} expiryDate - Date to format
   * @param {string} language - Language code
   * @returns {string} Formatted date or "Permanent" text
   */
  static getFormattedExpiryDate(expiryDate, language = 'es') {
    if (!expiryDate) {
      return language === 'es' ? 'Permanente ♾️' : 'Permanent ♾️';
    }

    return expiryDate.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Validate message parameters
   * @param {Object} params - Parameters to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validateParams(params) {
    const { planName, transactionId, inviteLink, language } = params;

    if (!planName || typeof planName !== 'string') {
      throw new Error('planName is required and must be a string');
    }

    if (!transactionId || typeof transactionId !== 'string') {
      throw new Error('transactionId is required and must be a string');
    }

    if (!inviteLink || typeof inviteLink !== 'string') {
      throw new Error('inviteLink is required and must be a string');
    }

    if (!language || !['es', 'en'].includes(language)) {
      throw new Error('language must be "es" or "en"');
    }

    return true;
  }
}

module.exports = MessageTemplates;
