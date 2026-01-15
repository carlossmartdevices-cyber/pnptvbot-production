const UserModel = require('../../models/userModel');
const { query } = require('../../config/postgres');
const logger = require('../../utils/logger');

/**
 * Membership Cleanup Service
 * Handles automatic membership status updates and channel access management
 */
class MembershipCleanupService {
  static bot = null;
  static primeChannelId = process.env.PRIME_CHANNEL_ID;

  /**
   * Initialize the service with bot instance
   * @param {Telegraf} bot - Bot instance
   */
  static initialize(bot) {
    this.bot = bot;
    logger.info('Membership cleanup service initialized', {
      primeChannelId: this.primeChannelId
    });
  }

  /**
   * Run full membership cleanup
   * - Updates subscription statuses (active/churned/free)
   * - Kicks churned users from PRIME channel
   * @returns {Promise<Object>} Cleanup results
   */
  static async runFullCleanup() {
    logger.info('Starting full membership cleanup...');

    const results = {
      statusUpdates: { toChurned: 0, toFree: 0, errors: 0 },
      channelKicks: { kicked: 0, failed: 0, skipped: 0 },
      startTime: new Date(),
      endTime: null
    };

    try {
      // Step 1: Update subscription statuses
      const statusResults = await this.updateAllSubscriptionStatuses();
      results.statusUpdates = statusResults;

      // Step 2: Kick churned/expired users from PRIME channel
      if (this.bot && this.primeChannelId) {
        const kickResults = await this.kickExpiredUsersFromPrimeChannel();
        results.channelKicks = kickResults;
      } else {
        logger.warn('Skipping channel kicks: Bot or PRIME_CHANNEL_ID not configured');
      }

      results.endTime = new Date();
      const duration = (results.endTime - results.startTime) / 1000;

      logger.info('Membership cleanup completed', {
        duration: `${duration}s`,
        statusUpdates: results.statusUpdates,
        channelKicks: results.channelKicks
      });

      return results;
    } catch (error) {
      logger.error('Error in full membership cleanup:', error);
      results.endTime = new Date();
      return results;
    }
  }

  /**
   * Update subscription statuses for all users
   * - active + expired plan_expiry → churned
   * - expired status → churned (standardize)
   * - Lifetime pass users remain active (no expiry)
   * @returns {Promise<Object>} Update results
   */
  static async updateAllSubscriptionStatuses() {
    const results = { toChurned: 0, toFree: 0, errors: 0 };

    try {
      // Find users with 'active' status but expired plan_expiry (excluding lifetime)
      const expiredActiveUsers = await query(`
        SELECT id, username, subscription_status, plan_expiry, plan_id
        FROM users
        WHERE subscription_status = 'active'
        AND plan_expiry IS NOT NULL
        AND plan_expiry <= NOW()
      `);

      logger.info(`Found ${expiredActiveUsers.rows.length} users with expired 'active' subscriptions`);

      // Update expired active users to 'churned'
      for (const user of expiredActiveUsers.rows) {
        try {
          await UserModel.updateSubscription(user.id, {
            status: 'churned',
            planId: user.plan_id, // Keep plan_id for history
            expiry: user.plan_expiry // Keep expiry for history
          });
          results.toChurned++;
          logger.info(`Updated user ${user.id} (${user.username || 'no username'}) to churned`);
        } catch (error) {
          results.errors++;
          logger.error(`Error updating user ${user.id} to churned:`, error);
        }
      }

      // Find users with 'expired' status and update to 'churned'
      const expiredStatusUsers = await query(`
        SELECT id, username, plan_expiry, plan_id
        FROM users
        WHERE subscription_status = 'expired'
      `);

      logger.info(`Found ${expiredStatusUsers.rows.length} users with 'expired' status to convert to 'churned'`);

      for (const user of expiredStatusUsers.rows) {
        try {
          await UserModel.updateSubscription(user.id, {
            status: 'churned',
            planId: user.plan_id,
            expiry: user.plan_expiry
          });
          results.toChurned++;
          logger.info(`Updated user ${user.id} (${user.username || 'no username'}) from expired to churned`);
        } catch (error) {
          results.errors++;
          logger.error(`Error updating user ${user.id} from expired to churned:`, error);
        }
      }

      logger.info('Subscription status updates completed', results);
      return results;
    } catch (error) {
      logger.error('Error updating subscription statuses:', error);
      return results;
    }
  }

  /**
   * Kick churned and expired users from PRIME channel
   * @returns {Promise<Object>} Kick results
   */
  static async kickExpiredUsersFromPrimeChannel() {
    const results = { kicked: 0, failed: 0, skipped: 0 };

    if (!this.bot || !this.primeChannelId) {
      logger.warn('Cannot kick users: Bot or PRIME_CHANNEL_ID not configured');
      return results;
    }

    try {
      // Get all churned users (formerly had subscription)
      const churnedUsers = await query(`
        SELECT id, username FROM users
        WHERE subscription_status IN ('churned', 'expired')
      `);

      logger.info(`Found ${churnedUsers.rows.length} churned/expired users to check for PRIME channel access`);

      for (const user of churnedUsers.rows) {
        try {
          // Check if user is in the PRIME channel
          const chatMember = await this.bot.telegram.getChatMember(this.primeChannelId, user.id);

          // Only kick if they're actually a member (not already kicked/left)
          if (['member', 'restricted'].includes(chatMember.status)) {
            await this.bot.telegram.banChatMember(this.primeChannelId, user.id);
            // Immediately unban to allow re-joining if they resubscribe
            await this.bot.telegram.unbanChatMember(this.primeChannelId, user.id);

            results.kicked++;
            logger.info(`Kicked user ${user.id} (${user.username || 'no username'}) from PRIME channel`);

            // Notify user they were removed
            try {
              await this.sendRemovalNotice(user.id);
            } catch (notifyError) {
              // Don't fail if notification fails
              logger.debug(`Could not notify user ${user.id} of removal:`, notifyError.message);
            }

            // Rate limit protection
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            results.skipped++;
          }
        } catch (error) {
          if (error.response?.error_code === 400 && error.response?.description?.includes('user not found')) {
            // User not in channel, skip
            results.skipped++;
          } else if (error.response?.error_code === 400 && error.response?.description?.includes('CHAT_ADMIN_REQUIRED')) {
            logger.error('Bot needs admin rights in PRIME channel to kick users');
            results.failed++;
          } else {
            results.failed++;
            logger.error(`Error processing user ${user.id} for PRIME channel:`, error.message);
          }
        }
      }

      logger.info('PRIME channel cleanup completed', results);
      return results;
    } catch (error) {
      logger.error('Error kicking users from PRIME channel:', error);
      return results;
    }
  }

  /**
   * Send removal notice to user
   * @param {number} userId - User ID
   */
  static async sendRemovalNotice(userId) {
    if (!this.bot) return;

    const message = `⚠️ **Membership Expired**

Your PRIME membership has expired and your access to the exclusive PRIME channel has been removed.

💎 **Miss your PRIME benefits?**
Reactivate your membership to regain access to:
• Exclusive content channel
• Full-length videos
• Premium features

Type /subscribe to view membership plans and reactivate your access!`;

    await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Get membership statistics
   * @returns {Promise<Object>} Membership stats
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT
          subscription_status,
          COUNT(*) as count,
          COUNT(CASE WHEN plan_expiry > NOW() THEN 1 END) as active_plan,
          COUNT(CASE WHEN plan_expiry <= NOW() THEN 1 END) as expired_plan,
          COUNT(CASE WHEN plan_id LIKE '%lifetime%' THEN 1 END) as lifetime
        FROM users
        GROUP BY subscription_status
        ORDER BY count DESC
      `);

      return {
        byStatus: result.rows,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error getting membership stats:', error);
      return null;
    }
  }
}

module.exports = MembershipCleanupService;
