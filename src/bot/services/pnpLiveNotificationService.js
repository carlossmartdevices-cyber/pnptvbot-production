const logger = require('../../utils/logger');
const { query } = require('../../config/postgres');
const PNPLiveService = require('./pnpLiveService');

/**
 * PNP Latino Live Notification Service
 * Handles all notifications for bookings, reminders, and system alerts
 */

class PNPLiveNotificationService {
  /**
   * Send booking confirmation notification to user
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User Telegram ID
   * @param {string} lang - Language code
   */
  static async sendBookingConfirmation(bookingId, userId, lang) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await query(
        `SELECT name FROM pnp_models WHERE id = $1`,
        [booking.model_id]
      );

      const modelName = model.rows?.[0]?.name || 'Model';
      const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = lang === 'es'
        ? `🎉 *¡Reserva Confirmada - PNP Latino Live!*\n\n` +
          `📹 *Show Privado con ${modelName}*\n` +
          `📅 *Fecha:* ${startTime}\n` +
          `⏱️ *Duración:* ${booking.duration_minutes} minutos\n` +
          `💰 *Precio:* $${booking.price_usd}\n\n` +
          `✅ *Tu sala privada está lista*\n` +
          `🔔 *Recibirás un recordatorio 1 hora antes*\n` +
          `💬 *¿Preguntas? Responde a este mensaje*`
        : `🎉 *Booking Confirmed - PNP Latino Live!*\n\n` +
          `📹 *Private Show with ${modelName}*\n` +
          `📅 *Date:* ${startTime}\n` +
          `⏱️ *Duration:* ${booking.duration_minutes} minutes\n` +
          `💰 *Price:* $${booking.price_usd}\n\n` +
          `✅ *Your private room is ready*\n` +
          `🔔 *You\'ll receive a reminder 1 hour before*\n` +
          `💬 *Questions? Reply to this message*`;

      // Send notification via bot
      if (userId) {
        // This would be called from the bot instance
        // For now, log the notification
        logger.info('Booking confirmation notification', {
          bookingId,
          userId,
          message: 'Notification would be sent to user'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      return false;
    }
  }

  /**
   * Send booking reminder notification (1 hour before)
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User Telegram ID
   * @param {string} lang - Language code
   */
  static async sendBookingReminder(bookingId, userId, lang) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await query(
        `SELECT name FROM pnp_models WHERE id = $1`,
        [booking.model_id]
      );

      const modelName = model.rows?.[0]?.name || 'Model';
      const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = lang === 'es'
        ? `🔔 *Recordatorio - PNP Latino Live*\n\n` +
          `📹 *Tu Show Privado con ${modelName} comienza en 1 hora*\n` +
          `⏰ *Hora:* ${startTime}\n` +
          `📱 *Prepárate para una experiencia increíble*\n\n` +
          `💡 *Consejos:*\n` +
          `- Usa auriculares para mejor audio\n` +
          `- Conéctate desde un lugar privado\n` +
          `- Ten tu cámara y micrófono listos`
        : `🔔 *Reminder - PNP Latino Live*\n\n` +
          `📹 *Your Private Show with ${modelName} starts in 1 hour*\n` +
          `⏰ *Time:* ${startTime}\n` +
          `📱 *Get ready for an amazing experience*\n\n` +
          `💡 *Tips:*\n` +
          `- Use headphones for better audio\n` +
          `- Connect from a private location\n` +
          `- Have your camera and microphone ready`;

      // Send notification via bot
      if (userId) {
        logger.info('Booking reminder notification', {
          bookingId,
          userId,
          message: 'Reminder would be sent to user'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending booking reminder:', error);
      return false;
    }
  }

  /**
   * Send notification to model about upcoming booking
   * @param {number} bookingId - Booking ID
   * @param {string} modelId - Model Telegram ID
   * @param {string} lang - Language code
   */
  static async sendModelBookingAlert(bookingId, modelId, lang) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const user = await query(
        `SELECT username FROM users WHERE id = $1`,
        [booking.user_id]
      );

      const username = user.rows?.[0]?.username || 'Client';
      const startTime = new Date(booking.booking_time).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = lang === 'es'
        ? `📅 *Nuevo Show - PNP Latino Live*\n\n` +
          `👤 *Cliente:* @${username}\n` +
          `⏰ *Hora:* ${startTime}\n` +
          `⏱️ *Duración:* ${booking.duration_minutes} minutos\n` +
          `💰 *Ingresos:* $${booking.price_usd}\n\n` +
          `💡 *Prepárate para entrar a la sala 5 minutos antes*`
        : `📅 *New Show - PNP Latino Live*\n\n` +
          `👤 *Client:* @${username}\n` +
          `⏰ *Time:* ${startTime}\n` +
          `⏱️ *Duration:* ${booking.duration_minutes} minutes\n` +
          `💰 *Earnings:* $${booking.price_usd}\n\n` +
          `💡 *Be ready to join the room 5 minutes before*`;

      // Send notification via bot
      if (modelId) {
        logger.info('Model booking alert notification', {
          bookingId,
          modelId,
          message: 'Alert would be sent to model'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending model booking alert:', error);
      return false;
    }
  }

  /**
   * Send payment received notification
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User Telegram ID
   * @param {string} lang - Language code
   */
  static async sendPaymentReceived(bookingId, userId, lang) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await query(
        `SELECT name FROM pnp_models WHERE id = $1`,
        [booking.model_id]
      );

      const modelName = model.rows?.[0]?.name || 'Model';

      const message = lang === 'es'
        ? `💳 *Pago Recibido - PNP Latino Live*\n\n` +
          `✅ *Tu pago para el Show con ${modelName} ha sido procesado*\n` +
          `📹 *Tu sala privada está lista y segura*\n` +
          `🔒 *Todos los datos están encriptados*\n\n` +
          `💬 *¿Necesitas ayuda? Responde a este mensaje*`
        : `💳 *Payment Received - PNP Latino Live*\n\n` +
          `✅ *Your payment for the Show with ${modelName} has been processed*\n` +
          `📹 *Your private room is ready and secure*\n` +
          `🔒 *All data is encrypted*\n\n` +
          `💬 *Need help? Reply to this message*`;

      // Send notification via bot
      if (userId) {
        logger.info('Payment received notification', {
          bookingId,
          userId,
          message: 'Payment notification would be sent to user'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending payment received notification:', error);
      return false;
    }
  }

  /**
   * Send refund processed notification
   * @param {number} refundId - Refund ID
   * @param {string} userId - User Telegram ID
   * @param {string} lang - Language code
   * @param {boolean} approved - Whether refund was approved
   */
  static async sendRefundProcessed(refundId, userId, lang, approved) {
    try {
      const refund = await query(
        `SELECT amount_usd, reason, processed_at 
         FROM pnp_refunds 
         WHERE id = $1`,
        [refundId]
      );

      if (!refund.rows?.[0]) {
        throw new Error('Refund not found');
      }

      const { amount_usd, reason, processed_at } = refund.rows[0];
      const statusText = approved ? 'aprobado' : 'rechazado';
      const statusEmoji = approved ? '✅' : '❌';

      const message = lang === 'es'
        ? `${statusEmoji} *Reembolso ${statusText} - PNP Latino Live*\n\n` +
          `💸 *Monto:* $${amount_usd}\n` +
          `📝 *Motivo:* ${reason}\n` +
          `📅 *Procesado:* ${new Date(processed_at).toLocaleString()}\n\n` +
          (approved 
            ? `💰 *El reembolso será acreditado en 3-5 días hábiles*`
            : `📋 *Revisa nuestras políticas de reembolso*`)
        : `${statusEmoji} *Refund ${approved ? 'Approved' : 'Rejected'} - PNP Latino Live*\n\n` +
          `💸 *Amount:* $${amount_usd}\n` +
          `📝 *Reason:* ${reason}\n` +
          `📅 *Processed:* ${new Date(processed_at).toLocaleString()}\n\n` +
          (approved 
            ? `💰 *Refund will be credited in 3-5 business days*`
            : `📋 *Please review our refund policies*`);

      // Send notification via bot
      if (userId) {
        logger.info('Refund processed notification', {
          refundId,
          userId,
          approved,
          message: 'Refund notification would be sent to user'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending refund processed notification:', error);
      return false;
    }
  }

  /**
   * Send feedback received notification to model
   * @param {number} feedbackId - Feedback ID
   * @param {string} modelId - Model Telegram ID
   * @param {string} lang - Language code
   */
  static async sendFeedbackReceived(feedbackId, modelId, lang) {
    try {
      const feedback = await query(
        `SELECT rating, comments, created_at, 
                (SELECT user_id FROM pnp_bookings WHERE id = booking_id) as user_id 
         FROM pnp_feedback 
         WHERE id = $1`,
        [feedbackId]
      );

      if (!feedback.rows?.[0]) {
        throw new Error('Feedback not found');
      }

      const { rating, comments, user_id } = feedback.rows[0];
      const stars = '⭐'.repeat(rating);

      const message = lang === 'es'
        ? `🌟 *Nuevo Feedback - PNP Latino Live*\n\n` +
          `🌟 *Calificación:* ${stars}\n` +
          `👤 *Cliente:* @${user_id}\n` +
          `💬 *Comentarios:* ${comments || 'Ninguno'}\n\n` +
          `💡 *¡Gracias por tu excelente servicio!*`
        : `🌟 *New Feedback - PNP Latino Live*\n\n` +
          `🌟 *Rating:* ${stars}\n` +
          `👤 *Client:* @${user_id}\n` +
          `💬 *Comments:* ${comments || 'None'}\n\n` +
          `💡 *Thank you for your excellent service!*`;

      // Send notification via bot
      if (modelId) {
        logger.info('Feedback received notification', {
          feedbackId,
          modelId,
          rating,
          message: 'Feedback notification would be sent to model'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending feedback received notification:', error);
      return false;
    }
  }

  /**
   * Send show starting soon notification to both parties
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User Telegram ID
   * @param {string} modelId - Model Telegram ID
   * @param {string} lang - Language code
   */
  static async sendShowStartingSoon(bookingId, userId, modelId, lang) {
    try {
      const booking = await PNPLiveService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const model = await query(
        `SELECT name FROM pnp_models WHERE id = $1`,
        [booking.model_id]
      );

      const modelName = model.rows?.[0]?.name || 'Model';

      // Notification for user
      const userMessage = lang === 'es'
        ? `🚀 *¡Tu Show está por comenzar! - PNP Latino Live*\n\n` +
          `📹 *Con ${modelName} en 5 minutos*\n` +
          `🔗 *Prepárate para unirte a la sala*\n` +
          `💬 *¡Disfruta tu experiencia!*`
        : `🚀 *Your Show is about to start! - PNP Latino Live*\n\n` +
          `📹 *With ${modelName} in 5 minutes*\n` +
          `🔗 *Get ready to join the room*\n` +
          `💬 *Enjoy your experience!*`;

      // Notification for model
      const modelMessage = lang === 'es'
        ? `🚀 *¡Show por comenzar! - PNP Latino Live*\n\n` +
          `📹 *Con tu cliente en 5 minutos*\n` +
          `🔗 *Prepárate para entrar a la sala*\n` +
          `💬 *¡Brinda una experiencia increíble!*`
        : `🚀 *Show about to start! - PNP Latino Live*\n\n` +
          `📹 *With your client in 5 minutes*\n` +
          `🔗 *Get ready to join the room*\n` +
          `💬 *Provide an amazing experience!*`;

      // Send notifications
      if (userId) {
        logger.info('Show starting soon notification to user', {
          bookingId,
          userId
        });
      }

      if (modelId) {
        logger.info('Show starting soon notification to model', {
          bookingId,
          modelId
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending show starting soon notification:', error);
      return false;
    }
  }

  /**
   * Send system alert notification
   * @param {string} userId - User Telegram ID
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {string} lang - Language code
   */
  static async sendSystemAlert(userId, title, message, lang) {
    try {
      const alertMessage = lang === 'es'
        ? `⚠️ *${title} - PNP Latino Live*\n\n${message}`
        : `⚠️ *${title} - PNP Latino Live*\n\n${message}`;

      if (userId) {
        logger.info('System alert notification', {
          userId,
          title,
          message: 'Alert would be sent to user'
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending system alert:', error);
      return false;
    }
  }

  /**
   * Get upcoming bookings that need notifications
   * @returns {Promise<Array>} Bookings needing notifications
   */
  static async getBookingsNeedingNotifications() {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // Get bookings that need 1-hour reminders
      const oneHourReminders = await query(
        `SELECT id, user_id, model_id 
         FROM pnp_bookings 
         WHERE booking_time BETWEEN $1 AND $2
         AND status = 'confirmed'
         AND payment_status = 'paid'`,
        [now, oneHourFromNow]
      );

      // Get bookings that need 5-minute alerts
      const fiveMinuteAlerts = await query(
        `SELECT id, user_id, model_id 
         FROM pnp_bookings 
         WHERE booking_time BETWEEN $1 AND $2
         AND status = 'confirmed'
         AND payment_status = 'paid'`,
        [now, fiveMinutesFromNow]
      );

      return {
        oneHourReminders: oneHourReminders.rows || [],
        fiveMinuteAlerts: fiveMinuteAlerts.rows || []
      };
    } catch (error) {
      logger.error('Error getting bookings needing notifications:', error);
      return { oneHourReminders: [], fiveMinuteAlerts: [] };
    }
  }

  /**
   * Process all pending notifications
   */
  static async processPendingNotifications() {
    try {
      const { oneHourReminders, fiveMinuteAlerts } = await this.getBookingsNeedingNotifications();
      
      // Process 1-hour reminders
      for (const booking of oneHourReminders) {
        const userLang = 'es'; // Would get from user preferences
        await this.sendBookingReminder(booking.id, booking.user_id, userLang);
        await this.sendModelBookingAlert(booking.id, booking.model_id, userLang);
      }

      // Process 5-minute alerts
      for (const booking of fiveMinuteAlerts) {
        const userLang = 'es'; // Would get from user preferences
        await this.sendShowStartingSoon(booking.id, booking.user_id, booking.model_id, userLang);
      }

      logger.info('Pending notifications processed', {
        oneHourReminders: oneHourReminders.length,
        fiveMinuteAlerts: fiveMinuteAlerts.length
      });

      return true;
    } catch (error) {
      logger.error('Error processing pending notifications:', error);
      return false;
    }
  }

  /**
   * Send broadcast notification to all active models
   * @param {string} message - Broadcast message
   * @param {string} lang - Language code
   */
  static async sendBroadcastToModels(message, lang) {
    try {
      const models = await query(
        `SELECT id FROM pnp_models WHERE is_active = TRUE`
      );

      const broadcastMessage = lang === 'es'
        ? `📢 *Anuncio Importante - PNP Latino Live*\n\n${message}`
        : `📢 *Important Announcement - PNP Latino Live*\n\n${message}`;

      logger.info('Broadcast notification to models', {
        modelCount: models.rows?.length,
        message: 'Broadcast would be sent to all models'
      });

      return true;
    } catch (error) {
      logger.error('Error sending broadcast to models:', error);
      return false;
    }
  }

  /**
   * Send broadcast notification to all users with bookings
   * @param {string} message - Broadcast message
   * @param {string} lang - Language code
   */
  static async sendBroadcastToUsers(message, lang) {
    try {
      const users = await query(
        `SELECT DISTINCT user_id FROM pnp_bookings WHERE status != 'cancelled'`
      );

      const broadcastMessage = lang === 'es'
        ? `📢 *Anuncio - PNP Latino Live*\n\n${message}`
        : `📢 *Announcement - PNP Latino Live*\n\n${message}`;

      logger.info('Broadcast notification to users', {
        userCount: users.rows?.length,
        message: 'Broadcast would be sent to all users'
      });

      return true;
    } catch (error) {
      logger.error('Error sending broadcast to users:', error);
      return false;
    }
  }
}

module.exports = PNPLiveNotificationService;