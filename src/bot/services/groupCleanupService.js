const logger = require('../../utils/logger');
const cron = require('node-cron');

const GROUP_ID = process.env.GROUP_ID;
const CLEANUP_INTERVAL_DAYS = 7; // Run cleanup every 7 days
const MESSAGE_RETENTION_DAYS = 7; // Delete messages older than 7 days

/**
 * Group Cleanup Service
 * Automatically removes old non-media messages from the group
 *
 * Features:
 * - Runs every 7 days
 * - Deletes non-media messages older than 7 days
 * - Preserves media files (photos, videos, documents)
 * - Tracks message IDs to delete
 * - Configurable retention period
 */
class GroupCleanupService {
  constructor(bot) {
    this.bot = bot;
    this.messageTracker = new Map(); // messageId -> { timestamp, hasMedia, chatId }
    this.isEnabled = process.env.ENABLE_GROUP_CLEANUP === 'true';
    this.cronJob = null;
  }

  /**
   * Initialize the cleanup service
   */
  initialize() {
    if (!this.isEnabled) {
      logger.info('Group cleanup service is disabled (set ENABLE_GROUP_CLEANUP=true to enable)');
      return;
    }

    if (!GROUP_ID) {
      logger.warn('GROUP_ID not configured, group cleanup service cannot start');
      return;
    }

    logger.info('Initializing group cleanup service...');

    // Start tracking messages
    this.startMessageTracking();

    // Schedule cleanup job - runs every 7 days at 3:00 AM
    this.cronJob = cron.schedule('0 3 */' + CLEANUP_INTERVAL_DAYS + ' * *', async () => {
      await this.runCleanup();
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });

    logger.info(`✓ Group cleanup service initialized`);
    logger.info(`  • Cleanup runs every ${CLEANUP_INTERVAL_DAYS} days at 3:00 AM`);
    logger.info(`  • Messages older than ${MESSAGE_RETENTION_DAYS} days will be deleted`);
    logger.info(`  • Media files (photos, videos, documents) are preserved`);
  }

  /**
   * Start tracking messages in the group
   */
  startMessageTracking() {
    // Track new messages
    this.bot.on('message', async (ctx) => {
      try {
        // Only track messages in configured group
        if (!GROUP_ID || ctx.chat.id.toString() !== GROUP_ID) {
          return;
        }

        // Skip private chats
        if (ctx.chat.type === 'private') {
          return;
        }

        const messageId = ctx.message.message_id;
        const chatId = ctx.chat.id;
        const timestamp = Date.now();

        // Check if message contains media
        const hasMedia = !!(
          ctx.message.photo ||
          ctx.message.video ||
          ctx.message.document ||
          ctx.message.animation ||
          ctx.message.voice ||
          ctx.message.video_note ||
          ctx.message.audio ||
          ctx.message.sticker
        );

        // Store message info
        this.messageTracker.set(messageId, {
          timestamp,
          hasMedia,
          chatId,
          userId: ctx.from?.id,
        });

        logger.debug('Tracking message', {
          messageId,
          hasMedia,
          chatId,
        });

        // Cleanup old tracked messages from memory (older than 8 days)
        this.cleanupTracker();

      } catch (error) {
        logger.error('Error tracking message:', error);
      }
    });

    logger.info('✓ Message tracking started');
  }

  /**
   * Clean up old entries from message tracker
   */
  cleanupTracker() {
    const cutoffTime = Date.now() - (MESSAGE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [messageId, data] of this.messageTracker.entries()) {
      if (data.timestamp < cutoffTime) {
        this.messageTracker.delete(messageId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} old entries from message tracker`);
    }
  }

  /**
   * Run cleanup job
   */
  async runCleanup() {
    try {
      logger.info('🧹 Starting group cleanup job...');

      const cutoffTime = Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      let deletedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Get messages to delete
      const messagesToDelete = [];

      for (const [messageId, data] of this.messageTracker.entries()) {
        // Skip if message is newer than retention period
        if (data.timestamp >= cutoffTime) {
          continue;
        }

        // Skip if message has media
        if (data.hasMedia) {
          skippedCount++;
          continue;
        }

        messagesToDelete.push({ messageId, chatId: data.chatId });
      }

      logger.info(`Found ${messagesToDelete.length} messages to delete`);

      // Delete messages (with rate limiting)
      for (const { messageId, chatId } of messagesToDelete) {
        try {
          await this.bot.telegram.deleteMessage(chatId, messageId);
          this.messageTracker.delete(messageId);
          deletedCount++;

          // Rate limit: 100ms between deletions
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          errorCount++;
          logger.debug(`Could not delete message ${messageId}:`, error.message);

          // Remove from tracker anyway (message might already be deleted)
          this.messageTracker.delete(messageId);
        }
      }

      logger.info(`✅ Group cleanup job completed:`);
      logger.info(`  • Deleted: ${deletedCount} messages`);
      logger.info(`  • Skipped (media): ${skippedCount} messages`);
      logger.info(`  • Errors: ${errorCount}`);
      logger.info(`  • Tracked messages: ${this.messageTracker.size}`);

    } catch (error) {
      logger.error('Error in group cleanup job:', error);
    }
  }

  /**
   * Manually trigger cleanup (for testing)
   */
  async manualCleanup() {
    logger.info('Manual cleanup triggered');
    await this.runCleanup();
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    const now = Date.now();
    const cutoffTime = now - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let eligibleForDeletion = 0;
    let mediaMessages = 0;
    let recentMessages = 0;

    for (const [messageId, data] of this.messageTracker.entries()) {
      if (data.timestamp >= cutoffTime) {
        recentMessages++;
      } else if (data.hasMedia) {
        mediaMessages++;
      } else {
        eligibleForDeletion++;
      }
    }

    return {
      isEnabled: this.isEnabled,
      trackedMessages: this.messageTracker.size,
      eligibleForDeletion,
      mediaMessages,
      recentMessages,
      retentionDays: MESSAGE_RETENTION_DAYS,
      cleanupIntervalDays: CLEANUP_INTERVAL_DAYS,
    };
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Group cleanup service stopped');
    }
  }
}

module.exports = GroupCleanupService;
