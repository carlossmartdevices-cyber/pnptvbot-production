const UserModel = require('../../models/userModel');
const logger = require('../../utils/logger');

/**
 * Subscription Reminder Service
 * Sends private reminders to users about expiring subscriptions
 * NEVER sends to groups - only direct messages to users
 */
class SubscriptionReminderService {
  /**
   * Initialize the service with bot instance
   * @param {Telegraf} bot - Bot instance
   */
  static initialize(bot) {
    this.bot = bot;
    logger.info('Subscription reminder service initialized');
  }

  /**
   * Process reminders for subscriptions expiring in N days
   * @param {number} daysBeforeExpiry - Days before expiry (3 or 1)
   * @returns {Promise<number>} Number of reminders sent
   */
  static async sendReminders(daysBeforeExpiry) {
    try {
      if (!this.bot) {
        logger.error('Bot instance not initialized. Call initialize(bot) first.');
        return 0;
      }

      logger.info(`Processing ${daysBeforeExpiry}-day subscription reminders...`);

      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + daysBeforeExpiry);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);

      // Get users with subscriptions expiring in the target date range
      const users = await UserModel.getSubscriptionsExpiringBetween(startDate, endDate);

      logger.info(`Found ${users.length} users with subscriptions expiring in ${daysBeforeExpiry} day(s)`);

      let sentCount = 0;

      for (const user of users) {
        try {
          const success = await this.sendReminderToUser(user, daysBeforeExpiry);
          if (success) {
            sentCount++;
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Error sending reminder to user ${user.id}:`, error);
        }
      }

      logger.info(`Sent ${sentCount} out of ${users.length} ${daysBeforeExpiry}-day reminders`);
      return sentCount;
    } catch (error) {
      logger.error(`Error in sendReminders(${daysBeforeExpiry}):`, error);
      return 0;
    }
  }

  /**
   * Send reminder to individual user via private message
   * @param {Object} user - User object
   * @param {number} daysBeforeExpiry - Days before expiry
   * @returns {Promise<boolean>} Success status
   */
  static async sendReminderToUser(user, daysBeforeExpiry) {
    try {
      const userId = user.id;
      const expiryDate = new Date(user.planExpiry);
      const userLang = user.language || 'en';
      const isSpanish = userLang.startsWith('es');

      let message;

      if (daysBeforeExpiry === 3) {
        // 3-day reminder
        if (isSpanish) {
          message = `⏰ **Recordatorio de Suscripción**

¡Hola! Tu membresía PRIME de PNPtv expirará en **3 días**.

📅 **Fecha de expiración:** ${expiryDate.toLocaleDateString('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}

💎 **¿Qué sucede después de la expiración?**
• Acceso limitado a contenido exclusivo
• Solo 3 vistas de Miembros Cercanos por día
• Sin acceso a videos completos

✨ **Renueva ahora y mantén todos los beneficios PRIME:**
• Videos exclusivos completos
• Miembros Cercanos ilimitados
• Presentaciones en vivo y llamadas privadas
• Música y podcasts premium
• Acceso total sin anuncios

Escribe /prime para renovar tu membresía.`;
        } else {
          message = `⏰ **Subscription Reminder**

Hey there! Your PNPtv PRIME membership will expire in **3 days**.

📅 **Expiration date:** ${expiryDate.toLocaleDateString('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}

💎 **What happens after expiration?**
• Limited access to exclusive content
• Only 3 Nearby Member views per day
• No access to full-length videos

✨ **Renew now and keep all PRIME benefits:**
• Full-length exclusive videos
• Unlimited Nearby Members
• Live performances + private calls
• Premium music & podcasts
• Zero ads, all access

Type /prime to renew your membership.`;
        }
      } else if (daysBeforeExpiry === 1) {
        // 1-day reminder (more urgent)
        if (isSpanish) {
          message = `🚨 **¡Última Oportunidad!**

Tu membresía PRIME de PNPtv expira **MAÑANA**.

📅 **Fecha de expiración:** ${expiryDate.toLocaleDateString('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}

⚠️ **No pierdas el acceso a:**
• Videos exclusivos completos de Santino, Lex y el equipo
• Miembros Cercanos ilimitados
• Presentaciones en vivo y llamadas privadas de Zoom
• Toda la música y podcasts premium

💎 **Renueva ahora para mantener tu acceso PRIME.**

Escribe /prime ahora para renovar.`;
        } else {
          message = `🚨 **Last Chance!**

Your PNPtv PRIME membership expires **TOMORROW**.

📅 **Expiration date:** ${expiryDate.toLocaleDateString('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}

⚠️ **Don't lose access to:**
• Full-length exclusive videos from Santino, Lex & the crew
• Unlimited Nearby Members
• Live performances + private Zoom calls
• All premium music & podcasts

💎 **Renew now to keep your PRIME access.**

Type /prime now to renew.`;
        }
      } else {
        logger.warn(`Invalid daysBeforeExpiry value: ${daysBeforeExpiry}`);
        return false;
      }

      // Send private message to user (NEVER to group)
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
      });

      logger.info(`Sent ${daysBeforeExpiry}-day reminder to user ${userId}`);
      return true;
    } catch (error) {
      // If we can't send (user blocked bot, etc), log but don't throw
      if (error.response?.error_code === 403) {
        logger.debug(`Cannot send reminder to user ${user.id}: User blocked bot`);
      } else if (error.response?.error_code === 400) {
        logger.debug(`Cannot send reminder to user ${user.id}: Chat not found`);
      } else {
        logger.error(`Error sending reminder to user ${user.id}:`, error);
      }
      return false;
    }
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

  /**
   * Process expired subscriptions (downgrade to free)
   * @returns {Promise<number>} Number of subscriptions expired
   */
  static async processExpiredSubscriptions() {
    try {
      logger.info('Processing expired subscriptions...');

      const expiredUsers = await UserModel.getExpiredSubscriptions();
      logger.info(`Found ${expiredUsers.length} expired subscriptions`);

      let processedCount = 0;

      for (const user of expiredUsers) {
        try {
          // Update subscription to free
          await UserModel.updateSubscription(user.id, {
            status: 'free',
            planId: null,
            expiry: null,
          });

          // Send expiration notice (optional - only if bot is initialized)
          if (this.bot) {
            await this.sendExpirationNotice(user);
          }

          processedCount++;

          // Add small delay
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Error processing expired subscription for user ${user.id}:`, error);
        }
      }

      logger.info(`Processed ${processedCount} expired subscriptions`);
      return processedCount;
    } catch (error) {
      logger.error('Error in processExpiredSubscriptions:', error);
      return 0;
    }
  }

  /**
   * Send expiration notice to user
   * @param {Object} user - User object
   * @returns {Promise<boolean>} Success status
   */
  static async sendExpirationNotice(user) {
    try {
      const userLang = user.language || 'en';
      const isSpanish = userLang.startsWith('es');

      let message;
      if (isSpanish) {
        message = `😔 **Tu membresía PRIME ha expirado**

Tu suscripción PRIME de PNPtv ha finalizado. Ahora tienes acceso de miembro gratuito.

🎁 **Acceso gratuito:**
• Acceso al grupo
• Biblioteca de música gratis
• 3 vistas de Miembros Cercanos por día
• Vistas previas de videos cortos

💎 **¿Extrañas PRIME? Reactiva tu membresía:**
• Videos exclusivos completos
• Miembros Cercanos ilimitados
• Presentaciones en vivo + llamadas privadas
• Música y podcasts premium
• Sin anuncios, acceso total

Escribe /prime para reactivar tu membresía PRIME.`;
      } else {
        message = `😔 **Your PRIME membership has expired**

Your PNPtv PRIME subscription has ended. You now have free member access.

🎁 **Free access:**
• Group access
• Free music library
• 3 Nearby Member views per day
• Short video previews

💎 **Missing PRIME? Reactivate your membership:**
• Full-length exclusive videos
• Unlimited Nearby Members
• Live performances + private calls
• Premium music & podcasts
• Zero ads, all access

Type /prime to reactivate your PRIME membership.`;
      }

      await this.bot.telegram.sendMessage(user.id, message, {
        parse_mode: 'Markdown',
      });

      logger.info(`Sent expiration notice to user ${user.id}`);
      return true;
    } catch (error) {
      if (error.response?.error_code === 403) {
        logger.debug(`Cannot send expiration notice to user ${user.id}: User blocked bot`);
      } else {
        logger.error(`Error sending expiration notice to user ${user.id}:`, error);
      }
      return false;
    }
  }
}

module.exports = SubscriptionReminderService;
