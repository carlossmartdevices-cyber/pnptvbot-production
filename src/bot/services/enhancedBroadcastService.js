/**
 * Enhanced Broadcast Service
 * Integrates BroadcastService with BroadcastEnhancements for advanced features
 * Handles user preferences, segmentation, analytics, A/B testing, and retries
 */

const { getPool } = require('../../config/postgres');
const logger = require('../../utils/logger');
const BroadcastService = require('./broadcastService');
const BroadcastEnhancements = require('./broadcastEnhancements');

class EnhancedBroadcastService {
  constructor() {
    this.broadcastService = new BroadcastService();
    this.enhancements = new BroadcastEnhancements();
  }

  /**
   * Send broadcast with all enhancements enabled
   * @param {Object} bot - Telegram bot instance
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Broadcast statistics
   */
  async sendBroadcastWithEnhancements(bot, broadcastId) {
    try {
      // Get broadcast details
      const broadcastQuery = 'SELECT * FROM broadcasts WHERE broadcast_id = $1';
      const broadcastResult = await getPool().query(broadcastQuery, [broadcastId]);

      if (broadcastResult.rows.length === 0) {
        throw new Error(`Broadcast ${broadcastId} not found`);
      }

      const broadcast = broadcastResult.rows[0];

      // Initialize statistics
      const stats = {
        total: 0,
        sent: 0,
        failed: 0,
        blocked: 0,
        deactivated: 0,
        errors: 0,
        opted_out: 0,
        frequency_limited: 0,
      };

      // Update broadcast status to sending
      await getPool().query(
        'UPDATE broadcasts SET status = $1, started_at = CURRENT_TIMESTAMP WHERE broadcast_id = $2',
        ['sending', broadcastId]
      );

      // Get target users based on type
      let targetUsers = await this.broadcastService.getTargetUsers(
        broadcast.target_type,
        broadcast.exclude_user_ids || []
      );

      logger.info(`Starting enhanced broadcast ${broadcastId} to ${targetUsers.length} users`);

      // Filter out opted-out users
      const filteredUsers = [];
      for (const user of targetUsers) {
        const isOptedOut = await this.enhancements.isUserOptedOut(user.id);
        if (isOptedOut) {
          stats.opted_out++;
          continue;
        }

        // Check frequency limits
        const exceedsFrequency = await this.enhancements.exceedsFrequencyLimit(user.id);
        if (exceedsFrequency) {
          stats.frequency_limited++;
          continue;
        }

        filteredUsers.push(user);
      }

      stats.total = filteredUsers.length;

      // Update total recipients in database
      await getPool().query(
        'UPDATE broadcasts SET total_recipients = $1 WHERE broadcast_id = $2',
        [stats.total, broadcastId]
      );

      // Handle A/B testing if enabled
      let abTestId = null;
      let variantMap = {};

      if (broadcast.ab_test_id) {
        abTestId = broadcast.ab_test_id;
        // Get variant assignments for users
        const variantQuery = `
          SELECT user_id, assigned_variant
          FROM ab_test_assignments
          WHERE ab_test_id = $1
        `;
        const variantResult = await getPool().query(variantQuery, [abTestId]);
        variantResult.rows.forEach(row => {
          variantMap[row.user_id] = row.assigned_variant;
        });
      }

      // Send to each user
      for (const user of filteredUsers) {
        try {
          // Determine message variant (A or B)
          let message = user.language === 'es' ? broadcast.message_es : broadcast.message_en;
          let mediaUrl = broadcast.media_url;

          if (abTestId && variantMap[user.id]) {
            const variant = variantMap[user.id];
            // In a real implementation, fetch variant-specific content from ab_tests table
            // For now, use the primary message
          }

          // Send based on media type
          let messageId = null;
          if (broadcast.media_type && mediaUrl) {
            messageId = await this.broadcastService.sendMediaMessage(
              bot,
              user.id,
              broadcast.media_type,
              mediaUrl,
              message,
              broadcast.s3_key
            );
          } else {
            const result = await bot.telegram.sendMessage(user.id, message, {
              parse_mode: 'Markdown',
            });
            messageId = result.message_id;
          }

          // Record successful delivery with engagement tracking
          await this.broadcastService.recordRecipient(broadcastId, user.id, 'sent', {
            messageId,
            language: user.language,
            subscriptionTier: user.subscription_tier,
          });

          // Initialize engagement tracking
          await this.enhancements.recordEngagementEvent(
            broadcastId,
            user.id,
            'sent',
            { messageId }
          );

          // Update frequency tracking
          await this.enhancements.recordBroadcastFrequency(user.id);

          stats.sent++;

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          // Handle specific errors
          let status = 'failed';
          if (error.message.includes('bot was blocked')) {
            status = 'blocked';
            stats.blocked++;
          } else if (error.message.includes('user is deactivated')) {
            status = 'deactivated';
            stats.deactivated++;
          } else {
            stats.errors++;
          }

          stats.failed++;

          // Record failed delivery
          await this.broadcastService.recordRecipient(broadcastId, user.id, status, {
            errorCode: error.code,
            errorMessage: error.message,
            language: user.language,
            subscriptionTier: user.subscription_tier,
          });

          // Queue for retry if retriable error
          if (this._isRetriableError(error)) {
            await this.enhancements.queueForRetry(broadcastId, user.id, error, {
              maxRetries: 5,
              initialDelay: 60, // 60 seconds
              backoffMultiplier: 2.0,
            });
          }

          logger.warn(`Failed to send to user ${user.id}: ${error.message}`);
        }

        // Update progress
        const progress = ((stats.sent + stats.failed) / stats.total) * 100;
        await getPool().query(
          'UPDATE broadcasts SET sent_count = $1, failed_count = $2, blocked_count = $3, deactivated_count = $4, error_count = $5, progress_percentage = $6 WHERE broadcast_id = $7',
          [
            stats.sent,
            stats.failed,
            stats.blocked,
            stats.deactivated,
            stats.errors,
            progress.toFixed(2),
            broadcastId,
          ]
        );
      }

      // Mark broadcast as completed
      await getPool().query(
        'UPDATE broadcasts SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE broadcast_id = $2',
        ['completed', broadcastId]
      );

      // Generate analytics
      const analytics = await this.enhancements.getBroadcastAnalytics(broadcastId);

      logger.info(
        `Enhanced broadcast ${broadcastId} completed:`,
        JSON.stringify({ ...stats, ...analytics })
      );

      return { ...stats, analytics };
    } catch (error) {
      logger.error(`Error in enhanced broadcast ${broadcastId}:`, error);

      // Mark broadcast as failed
      await getPool().query(
        'UPDATE broadcasts SET status = $1 WHERE broadcast_id = $2',
        ['failed', broadcastId]
      );

      throw error;
    }
  }

  /**
   * Send broadcast to a specific user segment
   * @param {Object} bot - Telegram bot instance
   * @param {string} broadcastId - Broadcast ID
   * @param {string} segmentId - Segment ID
   * @returns {Promise<Object>} Broadcast statistics
   */
  async sendBroadcastToSegment(bot, broadcastId, segmentId) {
    try {
      const broadcast = await getPool().query('SELECT * FROM broadcasts WHERE broadcast_id = $1', [
        broadcastId,
      ]);

      if (broadcast.rows.length === 0) {
        throw new Error(`Broadcast ${broadcastId} not found`);
      }

      // Get users in segment
      const segmentUsers = await this.enhancements.getUsersInSegment(segmentId);

      logger.info(
        `Starting segment broadcast ${broadcastId} to segment ${segmentId} (${segmentUsers.length} users)`
      );

      const stats = {
        total: segmentUsers.length,
        sent: 0,
        failed: 0,
        segment_id: segmentId,
      };

      // Send to segment users
      for (const user of segmentUsers) {
        try {
          const bcData = broadcast.rows[0];
          const message = user.language === 'es' ? bcData.message_es : bcData.message_en;

          let messageId = null;
          if (bcData.media_type && bcData.media_url) {
            messageId = await this.broadcastService.sendMediaMessage(
              bot,
              user.id,
              bcData.media_type,
              bcData.media_url,
              message,
              bcData.s3_key
            );
          } else {
            const result = await bot.telegram.sendMessage(user.id, message, {
              parse_mode: 'Markdown',
            });
            messageId = result.message_id;
          }

          // Track engagement
          await this.enhancements.recordEngagementEvent(broadcastId, user.id, 'sent', {
            messageId,
            segment_id: segmentId,
          });

          stats.sent++;
        } catch (error) {
          stats.failed++;
          logger.warn(`Failed to send segment broadcast to user ${user.id}:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return stats;
    } catch (error) {
      logger.error(`Error sending broadcast to segment:`, error);
      throw error;
    }
  }

  /**
   * Process retry queue for failed broadcasts
   * @param {Object} bot - Telegram bot instance
   * @returns {Promise<Object>} Retry statistics
   */
  async processRetryQueue(bot) {
    try {
      // Get all pending retries due for execution
      const retriesQuery = `
        SELECT * FROM broadcast_retry_queue
        WHERE status = 'pending'
        AND next_retry_at <= CURRENT_TIMESTAMP
        ORDER BY next_retry_at ASC
        LIMIT 100
      `;

      const retriesResult = await getPool().query(retriesQuery);
      const retries = retriesResult.rows;

      if (retries.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      logger.info(`Processing ${retries.length} broadcast retries`);

      const stats = { processed: 0, succeeded: 0, failed: 0 };

      for (const retry of retries) {
        try {
          // Get broadcast details
          const bcQuery = 'SELECT * FROM broadcasts WHERE broadcast_id = $1';
          const bcResult = await getPool().query(bcQuery, [retry.broadcast_id]);

          if (bcResult.rows.length === 0) {
            await this.enhancements.markRetryFailed(
              retry.retry_id,
              'Broadcast not found',
              retry.attempt_number + 1
            );
            stats.failed++;
            continue;
          }

          const broadcast = bcResult.rows[0];

          // Get user
          const userQuery = 'SELECT * FROM users WHERE id = $1';
          const userResult = await getPool().query(userQuery, [retry.user_id]);

          if (userResult.rows.length === 0) {
            await this.enhancements.markRetryFailed(
              retry.retry_id,
              'User not found',
              retry.attempt_number + 1
            );
            stats.failed++;
            continue;
          }

          const user = userResult.rows[0];
          const message = user.language === 'es' ? broadcast.message_es : broadcast.message_en;

          // Attempt to send
          let messageId = null;
          if (broadcast.media_type && broadcast.media_url) {
            messageId = await this.broadcastService.sendMediaMessage(
              bot,
              user.id,
              broadcast.media_type,
              broadcast.media_url,
              message,
              broadcast.s3_key
            );
          } else {
            const result = await bot.telegram.sendMessage(user.id, message, {
              parse_mode: 'Markdown',
            });
            messageId = result.message_id;
          }

          // Mark retry as successful
          await this.enhancements.markRetrySuccessful(retry.retry_id);
          stats.succeeded++;

          logger.info(`Retry succeeded for broadcast ${retry.broadcast_id}, user ${retry.user_id}`);
        } catch (error) {
          const nextAttempt = retry.attempt_number + 1;
          const nextDelay = retry.retry_delay_seconds * Math.pow(retry.backoff_multiplier, nextAttempt);

          // Mark retry as failed with next attempt details
          await this.enhancements.markRetryFailed(
            retry.retry_id,
            error.message,
            nextAttempt,
            nextDelay
          );

          stats.failed++;
          logger.warn(
            `Retry failed for broadcast ${retry.broadcast_id}, user ${retry.user_id}: ${error.message}`
          );
        }

        stats.processed++;
      }

      logger.info(`Retry queue processing complete:`, stats);
      return stats;
    } catch (error) {
      logger.error('Error processing retry queue:', error);
      throw error;
    }
  }

  /**
   * Pause an in-progress broadcast
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Pause result
   */
  async pauseBroadcast(broadcastId) {
    try {
      const result = await this.enhancements.pauseBroadcast(broadcastId);
      logger.info(`Broadcast ${broadcastId} paused`);
      return result;
    } catch (error) {
      logger.error(`Error pausing broadcast:`, error);
      throw error;
    }
  }

  /**
   * Resume a paused broadcast
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Resume result
   */
  async resumeBroadcast(broadcastId) {
    try {
      const result = await this.enhancements.resumeBroadcast(broadcastId);
      logger.info(`Broadcast ${broadcastId} resumed`);
      return result;
    } catch (error) {
      logger.error(`Error resuming broadcast:`, error);
      throw error;
    }
  }

  /**
   * Get broadcast analytics
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Analytics data
   */
  async getBroadcastAnalytics(broadcastId) {
    return this.enhancements.getBroadcastAnalytics(broadcastId);
  }

  /**
   * Create and run A/B test for broadcast
   * @param {string} broadcastId - Broadcast ID
   * @param {Object} testConfig - A/B test configuration
   * @returns {Promise<Object>} A/B test details
   */
  async setupABTest(broadcastId, testConfig) {
    try {
      const abTest = await this.enhancements.createABTest(broadcastId, testConfig);
      logger.info(`A/B test ${abTest.ab_test_id} created for broadcast ${broadcastId}`);
      return abTest;
    } catch (error) {
      logger.error(`Error setting up A/B test:`, error);
      throw error;
    }
  }

  /**
   * Get A/B test results
   * @param {string} abTestId - A/B test ID
   * @returns {Promise<Object>} Test results
   */
  async getABTestResults(abTestId) {
    return this.enhancements.getABTestResults(abTestId);
  }

  /**
   * Check if error is retriable
   * @private
   */
  _isRetriableError(error) {
    const nonRetriableErrors = [
      'user is deactivated',
      'chat not found',
      'user not found',
      'chat_id_invalid',
    ];

    const errorMsg = error.message.toLowerCase();
    return !nonRetriableErrors.some(err => errorMsg.includes(err));
  }
}

// Singleton instance
let instance = null;

function getEnhancedBroadcastService() {
  if (!instance) {
    instance = new EnhancedBroadcastService();
  }
  return instance;
}

module.exports = {
  EnhancedBroadcastService,
  getEnhancedBroadcastService,
};
