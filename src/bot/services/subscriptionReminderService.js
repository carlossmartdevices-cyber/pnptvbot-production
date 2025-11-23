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
    try {
      logger.info(`Processing ${daysBeforeExpiry}-day subscription reminders...`);

      // Calculate target date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + daysBeforeExpiry);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);

      // Get users expiring within the target date range
      const expiringUsers = await UserModel.getSubscriptionsExpiringBetween(startDate, endDate);

      if (!expiringUsers || expiringUsers.length === 0) {
        logger.info(`No subscriptions expiring in ${daysBeforeExpiry} days`);
        return 0;
      }

      logger.info(`Found ${expiringUsers.length} subscriptions expiring in ${daysBeforeExpiry} days`);

      let sentCount = 0;
      const bot = new Telegraf(process.env.BOT_TOKEN);

      for (const user of expiringUsers) {
        try {
          const plan = await PlanModel.getById(user.plan_id);
          const planName = plan?.display_name || plan?.name || 'PRIME';
          const expiryDate = user.plan_expiry?.toDate
            ? user.plan_expiry.toDate()
            : new Date(user.plan_expiry);
          const formattedExpiryDate = expiryDate.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Send Telegram bot message
          try {
            const botMessage = this.getBotReminderMessage(
              user.first_name || 'Usuario',
              planName,
              formattedExpiryDate,
              daysBeforeExpiry
            );

            await bot.telegram.sendMessage(user.id, botMessage, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🔄 Renovar Suscripción',
                    url: `${process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store'}/subscription/plans`
                  }
                ]]
              }
            });

            logger.info(`Sent ${daysBeforeExpiry}-day reminder bot message`, { userId: user.id });
          } catch (botErr) {
            logger.error('Error sending reminder bot message:', { userId: user.id, error: botErr.message });
          }

          // Send email reminder if user has email
          if (user.email) {
            try {
              await EmailService.sendSubscriptionReminder({
                email: user.email,
                name: user.first_name || 'Usuario',
                planName,
                expiryDate: formattedExpiryDate,
                daysRemaining: daysBeforeExpiry,
                renewUrl: `${process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store'}/subscription/plans`
              });

              logger.info(`Sent ${daysBeforeExpiry}-day reminder email`, { userId: user.id, email: user.email });
            } catch (emailErr) {
              logger.error('Error sending reminder email:', { userId: user.id, error: emailErr.message });
            }
          }

          sentCount++;
        } catch (userErr) {
          logger.error('Error processing user reminder:', { userId: user.id, error: userErr.message });
        }
      }

      logger.info(`Sent ${sentCount} ${daysBeforeExpiry}-day reminders`);
      return sentCount;
    } catch (error) {
      logger.error(`Error processing ${daysBeforeExpiry}-day reminders:`, error);
      return 0;
    }
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
