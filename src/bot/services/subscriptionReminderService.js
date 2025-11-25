const UserModel = require('../../models/userModel');
const PlanModel = require('../../models/planModel');
const EmailService = require('../../services/emailService');
const logger = require('../../utils/logger');
const { Telegraf } = require('telegraf');

/**
 * Subscription Reminder Service
 * Handles reminder notifications for expiring subscriptions
 */
class SubscriptionReminderService {
  /**
   * Process reminders for subscriptions expiring in N days
   * @param {number} daysBeforeExpiry - Days before expiry (3 or 1)
   * @returns {Promise<number>} Number of reminders sent
   */
  static async sendReminders(daysBeforeExpiry) {
    // Subscription reminder functionality has been disabled
    logger.info(`Subscription reminder service is disabled (${daysBeforeExpiry}-day reminders skipped)`);
    return 0;
  }

  /**
   * Get bot reminder message text
   * @param {string} name - User name
   * @param {string} planName - Plan name
   * @param {string} expiryDate - Formatted expiry date
   * @param {number} daysRemaining - Days remaining
   * @returns {string} Message text
   */
  static getBotReminderMessage(name, planName, expiryDate, daysRemaining) {
    const urgencyIcon = daysRemaining === 1 ? '🚨' : '⏰';
    const urgencyText = daysRemaining === 1
      ? '¡ÚLTIMO RECORDATORIO!'
      : 'Recordatorio de Suscripción';

    return [
      `${urgencyIcon} *${urgencyText}*`,
      '',
      `Hola ${name},`,
      '',
      `Tu suscripción *${planName}* expira en *${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}*.`,
      '',
      `📅 *Fecha de expiración:* ${expiryDate}`,
      '',
      '💎 *No pierdas acceso a:*',
      '• Canales exclusivos PRIME',
      '• Contenido premium sin publicidad',
      '• Salas Zoom ilimitadas',
      '• Transmisiones en vivo exclusivas',
      '• Soporte prioritario',
      '',
      '👉 Renueva ahora y mantén todos tus beneficios activos.',
      '',
      '⚠️ *Importante:* Si tu suscripción expira, serás removido automáticamente de los canales PRIME a medianoche.'
    ].join('\n');
  }

  /**
   * Send 3-day reminders
   * @returns {Promise<number>} Number of reminders sent
   */
  static async send3DayReminders() {
    return await this.sendReminders(3);
  }

  /**
   * Send 1-day reminders
   * @returns {Promise<number>} Number of reminders sent
   */
  static async send1DayReminders() {
    return await this.sendReminders(1);
  }
}

module.exports = SubscriptionReminderService;
