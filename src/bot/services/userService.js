const UserModel = require('../../models/userModel');
const logger = require('../../utils/logger');
const { sanitizeObject, validateSchema, schemas } = require('../../utils/validation');
const PermissionService = require('./permissionService');

/**
 * User Service - Business logic for user operations
 */
class UserService {
  /**
   * Create or get user from Telegram context
   * @param {Object} ctx - Telegraf context
   * @returns {Promise<Object>} User data
   */
  static async getOrCreateFromContext(ctx) {
    try {
      const { from } = ctx;
      if (!from) {
        throw new Error('No user data in context');
      }

      let user = await UserModel.getById(from.id);

      if (!user) {
        // Create new user
        const userData = {
          userId: from.id,
          username: from.username || '',
          firstName: from.first_name || '',
          lastName: from.last_name || '',
          language: from.language_code || 'en',
          subscriptionStatus: 'free',
        };

        user = await UserModel.createOrUpdate(userData);
        logger.info('New user created', { userId: from.id });
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number|string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} { success, error, data }
   */
  static async updateProfile(userId, updates) {
    try {
      // Sanitize inputs
      const sanitized = sanitizeObject(updates, ['bio', 'username']);

      // Validate using the partial update schema
      const { error, value } = validateSchema(
        sanitized,
        schemas.userProfileUpdate,
      );

      if (error) {
        logger.warn('Profile update validation failed:', error);
        return { success: false, error, data: null };
      }

      const success = await UserModel.updateProfile(userId, value);

      if (!success) {
        return { success: false, error: 'Failed to update profile', data: null };
      }

      const user = await UserModel.getById(userId);
      return { success: true, error: null, data: user };
    } catch (error) {
      logger.error('Error in updateProfile service:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Update user location
   * @param {number|string} userId - User ID
   * @param {Object} location - { lat, lng, address }
   * @returns {Promise<Object>} { success, error }
   */
  static async updateLocation(userId, location) {
    try {
      const { error } = validateSchema(location, schemas.location);

      if (error) {
        return { success: false, error };
      }

      const success = await UserModel.updateProfile(userId, { location });

      return { success, error: success ? null : 'Failed to update location' };
    } catch (error) {
      logger.error('Error updating location:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nearby users
   * @param {number|string} userId - User ID
   * @param {number} radiusKm - Search radius in km
   * @returns {Promise<Array>} Nearby users
   */
  static async getNearbyUsers(userId, radiusKm = 10) {
    try {
      const user = await UserModel.getById(userId);

      if (!user || !user.location) {
        return [];
      }

      const nearby = await UserModel.getNearby(user.location, radiusKm);

      // Filter out the requesting user
      return nearby.filter((u) => u.id !== userId.toString());
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      return [];
    }
  }

  /**
   * Check if user has active subscription
   * Admin/SuperAdmin users ALWAYS have access (bypass subscription check)
   * @param {number|string} userId - User ID
   * @returns {Promise<boolean>} Subscription status
   */
  static async hasActiveSubscription(userId) {
    try {
      // BYPASS: Admin and SuperAdmin always have access to everything
      if (PermissionService.isEnvSuperAdmin(userId) || PermissionService.isEnvAdmin(userId)) {
        logger.debug('Admin/SuperAdmin bypass: subscription check skipped', { userId });
        return true;
      }

      const user = await UserModel.getById(userId);

      if (!user) return false;

      if (user.subscriptionStatus !== 'active') return false;

      // Check if subscription is expired
      if (user.planExpiry) {
        const expiry = user.planExpiry.toDate ? user.planExpiry.toDate() : new Date(user.planExpiry);
        if (expiry < new Date()) {
          // Subscription expired, update status
          await UserModel.updateSubscription(userId, {
            status: 'expired',
            planId: user.planId,
            expiry: user.planExpiry,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   * @param {number|string} userId - User ID
   * @returns {boolean} Admin status
   */
  static isAdmin(userId) {
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').map((id) => id.trim()) || [];
    return adminIds.includes(userId.toString());
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User stats
   */
  static async getStatistics() {
    try {
      const [activeUsers, freeUsers] = await Promise.all([
        UserModel.getBySubscriptionStatus('active'),
        UserModel.getBySubscriptionStatus('free'),
      ]);

      const total = activeUsers.length + freeUsers.length;

      return {
        total,
        active: activeUsers.length,
        free: freeUsers.length,
        conversionRate: total > 0 ? (activeUsers.length / total) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      return {
        total: 0, active: 0, free: 0, conversionRate: 0,
      };
    }
  }

  /**
   * Process expired subscriptions
   * @returns {Promise<number>} Number of processed subscriptions
   */
  static async processExpiredSubscriptions() {
    try {
      const { Telegraf } = require('telegraf');
      const PlanModel = require('../../models/planModel');
      const EmailService = require('../../services/emailService');
      const bot = new Telegraf(process.env.BOT_TOKEN);
      const primeChannels = (process.env.PRIME_CHANNEL_ID || '').split(',').map(id => id.trim()).filter(id => id);

      const expiredUsers = await UserModel.getExpiredSubscriptions();

      for (const user of expiredUsers) {
        try {
          // Update subscription status to expired
          await UserModel.updateSubscription(user.id, {
            status: 'expired',
            planId: user.plan_id,
            expiry: user.plan_expiry,
          });

          logger.info('Subscription expired', { userId: user.id });

          // Get plan name for messages
          const plan = await PlanModel.getById(user.plan_id);
          const planName = plan?.display_name || plan?.name || 'PRIME';

          // Remove user from PRIME channels
          for (const channelId of primeChannels) {
            try {
              await bot.telegram.banChatMember(channelId, user.id);
              // Immediately unban so they can rejoin if they resubscribe
              await bot.telegram.unbanChatMember(channelId, user.id);
              logger.info('User removed from PRIME channel', { userId: user.id, channelId });
            } catch (channelErr) {
              logger.error('Error removing user from PRIME channel:', {
                userId: user.id,
                channelId,
                error: channelErr.message
              });
            }
          }

          // Send farewell message via bot
          try {
            const farewellMessage = [
              '💔 *Te vamos a extrañar*',
              '',
              `Hola ${user.first_name || 'Usuario'},`,
              '',
              `Tu suscripción *${planName}* ha expirado y has sido removido de los canales PRIME.`,
              '',
              '❌ *Has perdido acceso a:*',
              '• Canales exclusivos PRIME',
              '• Contenido premium sin publicidad',
              '• Salas Zoom ilimitadas',
              '• Transmisiones en vivo exclusivas',
              '• Soporte prioritario',
              '',
              '🎁 *¡Vuelve a PRIME!*',
              'Renueva hoy y recupera todos tus beneficios inmediatamente. Te estamos esperando.',
              '',
              '👉 Siempre serás bienvenido de vuelta. La familia PNPtv te extraña.'
            ].join('\n');

            await bot.telegram.sendMessage(user.id, farewellMessage, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '💎 Volver a PRIME',
                    url: `${process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store'}/subscription/plans`
                  }
                ]]
              }
            });

            logger.info('Sent farewell bot message', { userId: user.id });
          } catch (botErr) {
            logger.error('Error sending farewell bot message:', { userId: user.id, error: botErr.message });
          }

          // Send farewell email if user has email
          if (user.email) {
            try {
              await EmailService.sendSubscriptionExpired({
                email: user.email,
                name: user.first_name || 'Usuario',
                planName,
                renewUrl: `${process.env.BOT_WEBHOOK_DOMAIN || 'https://easybots.store'}/subscription/plans`
              });

              logger.info('Sent farewell email', { userId: user.id, email: user.email });
            } catch (emailErr) {
              logger.error('Error sending farewell email:', { userId: user.id, error: emailErr.message });
            }
          }
        } catch (userErr) {
          logger.error('Error processing expired user:', { userId: user.id, error: userErr.message });
        }
      }

      return expiredUsers.length;
    } catch (error) {
      logger.error('Error processing expired subscriptions:', error);
      return 0;
    }
  }
}

module.exports = UserService;
