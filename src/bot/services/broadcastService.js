/**
 * Broadcast Service
 * Handles broadcast creation, scheduling, and delivery with S3 media support
 */

const { getPool } = require('../../config/postgres');
const logger = require('../../utils/logger');
const s3Service = require('../../utils/s3Service');
const userService = require('./userService');
const { v4: uuidv4 } = require('uuid');

class BroadcastService {
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getTelegramRetryAfterSeconds(error) {
    return error?.parameters?.retry_after
      || error?.response?.parameters?.retry_after
      || error?.response?.parameters?.retryAfter
      || null;
  }

  classifyTelegramSendError(error) {
    const description = error?.response?.description || error?.description || error?.message || '';
    const lower = description.toLowerCase();

    if (error?.code === 429 || lower.includes('too many requests')) {
      return { status: 'retry', reason: 'rate_limited', description };
    }
    if (lower.includes('bot was blocked') || lower.includes('blocked by the user')) {
      return { status: 'blocked', reason: 'blocked', description };
    }
    if (lower.includes('user is deactivated') || lower.includes('deactivated user')) {
      return { status: 'deactivated', reason: 'deactivated', description };
    }
    if (lower.includes('chat not found')) {
      return { status: 'failed', reason: 'chat_not_found', description };
    }
    return { status: 'failed', reason: 'unknown', description };
  }
  /**
   * Create a new broadcast
   * @param {Object} broadcastData - Broadcast configuration
   * @returns {Promise<Object>} Created broadcast
   */
  async createBroadcast(broadcastData) {
    const {
      adminId,
      adminUsername,
      title,
      messageEn,
      messageEs,
      targetType = 'all',
      mediaType = null,
      mediaUrl = null,
      mediaFileId = null,
      s3Key = null,
      s3Bucket = null,
      scheduledAt = null,
      timezone = 'UTC',
      includeFilters = {},
      excludeUserIds = [],
    } = broadcastData;

    const query = `
      INSERT INTO broadcasts (
        broadcast_id, admin_id, admin_username, title,
        message_en, message_es, target_type,
        media_type, media_url, media_file_id, s3_key, s3_bucket,
        scheduled_at, timezone, include_filters, exclude_user_ids,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const broadcastId = uuidv4();
    const status = scheduledAt ? 'scheduled' : 'pending';

    try {
      const result = await getPool().query(query, [
        broadcastId,
        adminId,
        adminUsername,
        title,
        messageEn,
        messageEs,
        targetType,
        mediaType,
        mediaUrl,
        mediaFileId,
        s3Key,
        s3Bucket,
        scheduledAt,
        timezone,
        JSON.stringify(includeFilters),
        excludeUserIds,
        status,
      ]);

      logger.info(`Broadcast created: ${broadcastId} by ${adminUsername}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating broadcast:', error);
      throw error;
    }
  }

  /**
   * Upload media to S3 and create broadcast media record
   * @param {Object} bot - Telegram bot instance
   * @param {string} fileId - Telegram file ID
   * @param {string} mediaType - Media type
   * @param {string} broadcastId - Associated broadcast ID
   * @returns {Promise<Object>} Media upload result
   */
  async uploadBroadcastMedia(bot, fileId, mediaType, broadcastId = null) {
    try {
      // Upload to S3
      const uploadResult = await s3Service.uploadTelegramFileToS3(bot, fileId, mediaType, {
        folder: 'broadcasts',
        metadata: {
          broadcast_id: broadcastId || 'pending',
        },
      });

      // Save media metadata to database
      const query = `
        INSERT INTO broadcast_media (
          media_id, broadcast_id, original_filename, media_type,
          file_size, s3_bucket, s3_key, s3_url, s3_region,
          telegram_file_id, processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const mediaId = uuidv4();
      const result = await getPool().query(query, [
        mediaId,
        broadcastId,
        uploadResult.originalFilename,
        mediaType,
        uploadResult.fileSize,
        uploadResult.s3Bucket,
        uploadResult.s3Key,
        uploadResult.s3Url,
        uploadResult.s3Region,
        fileId,
        'uploaded',
      ]);

      logger.info(`Broadcast media uploaded: ${mediaId}`);

      return {
        ...result.rows[0],
        uploadResult,
      };
    } catch (error) {
      logger.error('Error uploading broadcast media:', error);
      throw error;
    }
  }

  /**
   * Get target users for broadcast based on target type and filters
   * @param {string} targetType - Target audience type
   * @param {Array} excludeUserIds - User IDs to exclude
   * @returns {Promise<Array>} List of target users
   */
  async getTargetUsers(targetType, excludeUserIds = []) {
    try {
      let query = 'SELECT id, language, subscription_tier FROM users WHERE 1=1';
      const params = [];

      // Filter by target type
      if (targetType === 'premium') {
        query += ' AND subscription_tier = $1';
        params.push('premium');
      } else if (targetType === 'free') {
        query += ' AND (subscription_tier IS NULL OR subscription_tier = $1)';
        params.push('free');
      } else if (targetType === 'churned') {
        query += ' AND subscription_tier = $1';
        params.push('churned');
      }

      // Exclude specific users
      if (excludeUserIds.length > 0) {
        query += ` AND id NOT IN (${excludeUserIds.map((_, i) => `$${params.length + i + 1}`).join(',')})`;
        params.push(...excludeUserIds);
      }

      // Exclude bots (known bot IDs)
      query += " AND id != '1087968824'"; // GroupAnonymousBot

      const result = await getPool().query(query, params);

      logger.info(`Found ${result.rows.length} target users for broadcast (type: ${targetType})`);
      return result.rows;
    } catch (error) {
      logger.error('Error getting target users:', error);
      throw error;
    }
  }

  /**
   * Send broadcast to users
   * @param {Object} bot - Telegram bot instance
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Broadcast results
   */
  async sendBroadcast(bot, broadcastId) {
    try {
      // Get broadcast details
      const broadcastQuery = 'SELECT * FROM broadcasts WHERE broadcast_id = $1';
      const broadcastResult = await getPool().query(broadcastQuery, [broadcastId]);

      if (broadcastResult.rows.length === 0) {
        throw new Error(`Broadcast not found: ${broadcastId}`);
      }

      const broadcast = broadcastResult.rows[0];

      // Check if broadcast is already being processed or completed (idempotency check)
      if (broadcast.status === 'sending' || broadcast.status === 'completed') {
        logger.warn(`Broadcast ${broadcastId} is already ${broadcast.status}, skipping duplicate execution`);
        return {
          total: broadcast.total_recipients || 0,
          sent: broadcast.sent_count || 0,
          failed: broadcast.failed_count || 0,
          blocked: broadcast.blocked_count || 0,
          deactivated: broadcast.deactivated_count || 0,
          errors: broadcast.error_count || 0,
          duplicate: true,
        };
      }

      // Update status to sending
      await getPool().query(
        'UPDATE broadcasts SET status = $1, started_at = CURRENT_TIMESTAMP WHERE broadcast_id = $2',
        ['sending', broadcastId]
      );

      // Get target users
      const targetUsers = await this.getTargetUsers(
        broadcast.target_type,
        broadcast.exclude_user_ids || []
      );

      const stats = {
        total: targetUsers.length,
        sent: 0,
        failed: 0,
        blocked: 0,
        deactivated: 0,
        errors: 0,
      };

      // Update total recipients
      await getPool().query(
        'UPDATE broadcasts SET total_recipients = $1 WHERE broadcast_id = $2',
        [stats.total, broadcastId]
      );

      logger.info(`Starting broadcast ${broadcastId} to ${stats.total} users`);

      const perRecipientDelayMs = parseInt(process.env.BROADCAST_SEND_DELAY_MS || '80', 10);
      const progressUpdateEvery = parseInt(process.env.BROADCAST_PROGRESS_EVERY || '10', 10);
      const cancellationCheckEvery = parseInt(process.env.BROADCAST_CANCELLATION_CHECK_EVERY || '25', 10);

      // Send to each user
      for (let index = 0; index < targetUsers.length; index++) {
        const user = targetUsers[index];
        try {
          // Allow cancelling mid-flight
          if (index % cancellationCheckEvery === 0) {
            const current = await this.getBroadcastById(broadcastId);
            if (current?.status === 'cancelled') {
              logger.warn(`Broadcast ${broadcastId} cancelled during send loop, stopping early`);
              break;
            }
          }

          const message = user.language === 'es' ? broadcast.message_es : broadcast.message_en;

          // Send based on media type
          let messageId = null;
          const attemptSend = async () => {
            if (broadcast.media_type && broadcast.media_url) {
              return this.sendMediaMessage(
                bot,
                user.id,
                broadcast.media_type,
                broadcast.media_url,
                message,
                broadcast.s3_key
              );
            }
            const result = await bot.telegram.sendMessage(user.id, message, { parse_mode: 'Markdown' });
            return result.message_id;
          };

          try {
            messageId = await attemptSend();
          } catch (error) {
            const classification = this.classifyTelegramSendError(error);
            if (classification.status === 'retry') {
              const retryAfterSeconds = this.getTelegramRetryAfterSeconds(error);
              const waitMs = Math.min(Math.max(retryAfterSeconds ? retryAfterSeconds * 1000 : 1500, 1000), 120000);
              logger.warn(`Rate limited, waiting ${Math.round(waitMs / 1000)}s then retrying user ${user.id}`);
              await this.sleep(waitMs);
              messageId = await attemptSend();
            } else {
              throw error;
            }
          }

          // Record successful delivery
          await this.recordRecipient(broadcastId, user.id, 'sent', {
            messageId,
            language: user.language,
            subscriptionTier: user.subscription_tier,
          });

          stats.sent++;

          // Small delay to avoid rate limiting
          await this.sleep(perRecipientDelayMs);
        } catch (error) {
          const classification = this.classifyTelegramSendError(error);
          const status = classification.status === 'retry' ? 'failed' : classification.status;
          if (status === 'blocked') stats.blocked++;
          else if (status === 'deactivated') stats.deactivated++;
          else stats.errors++;
          stats.failed++;

          // Record failed delivery
          await this.recordRecipient(broadcastId, user.id, status, {
            errorCode: error.code,
            errorMessage: classification.description || error.message,
            language: user.language,
            subscriptionTier: user.subscription_tier,
          });

          logger.warn(`Failed to send to user ${user.id}: ${classification.description || error.message}`);
        }

        // Update progress
        if (index % progressUpdateEvery === 0 || index === targetUsers.length - 1) {
          const progress = ((stats.sent + stats.failed) / stats.total) * 100;
          await getPool().query(
            'UPDATE broadcasts SET sent_count = $1, failed_count = $2, blocked_count = $3, deactivated_count = $4, error_count = $5, progress_percentage = $6 WHERE broadcast_id = $7',
            [stats.sent, stats.failed, stats.blocked, stats.deactivated, stats.errors, progress.toFixed(2), broadcastId]
          );
        }
      }

      // Mark broadcast as completed (or keep cancelled)
      const finalBroadcast = await this.getBroadcastById(broadcastId);
      if (finalBroadcast?.status !== 'cancelled') {
        await getPool().query(
          'UPDATE broadcasts SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE broadcast_id = $2',
          ['completed', broadcastId]
        );
      }

      logger.info(`Broadcast ${broadcastId} completed: ${stats.sent} sent, ${stats.failed} failed`);

      return stats;
    } catch (error) {
      // Mark broadcast as failed
      await getPool().query(
        'UPDATE broadcasts SET status = $1 WHERE broadcast_id = $2',
        ['failed', broadcastId]
      );

      logger.error(`Error sending broadcast ${broadcastId}:`, error);
      throw error;
    }
  }

  /**
   * Send media message (photo, video, document, audio, voice)
   * @param {Object} bot - Telegram bot instance
   * @param {string} userId - User ID
   * @param {string} mediaType - Media type
   * @param {string} mediaUrl - Media URL (S3 URL or Telegram file_id)
   * @param {string} caption - Message caption
   * @param {string} s3Key - S3 key (optional, for generating presigned URLs)
   * @returns {Promise<number>} Message ID
   */
  async sendMediaMessage(bot, userId, mediaType, mediaUrl, caption, s3Key = null) {
    const options = {
      caption,
      parse_mode: 'Markdown',
    };

    // If we have an S3 key and the URL is an S3 URL, generate a presigned URL
    // Telegram cannot access private S3 URLs directly
    let urlToSend = mediaUrl;
    if (s3Key && (mediaUrl.includes('s3.amazonaws.com') || mediaUrl.includes('s3://'))) {
      try {
        // Generate presigned URL valid for 1 hour
        urlToSend = await s3Service.getPresignedUrl(s3Key, {
          expiresIn: 3600, // 1 hour
        });
        logger.info(`Generated presigned URL for broadcast media: ${s3Key}`);
      } catch (error) {
        logger.warn(`Failed to generate presigned URL for ${s3Key}, falling back to direct URL: ${error.message}`);
        // Fall back to mediaUrl (might be Telegram file_id)
      }
    }

    let result;
    switch (mediaType) {
      case 'photo':
        result = await bot.telegram.sendPhoto(userId, urlToSend, options);
        break;
      case 'video':
        result = await bot.telegram.sendVideo(userId, urlToSend, options);
        break;
      case 'document':
        result = await bot.telegram.sendDocument(userId, urlToSend, options);
        break;
      case 'audio':
        result = await bot.telegram.sendAudio(userId, urlToSend, options);
        break;
      case 'voice':
        result = await bot.telegram.sendVoice(userId, urlToSend, options);
        break;
      default:
        throw new Error(`Unsupported media type: ${mediaType}`);
    }

    return result.message_id;
  }

  /**
   * Record broadcast recipient delivery status
   * @param {string} broadcastId - Broadcast ID
   * @param {string} userId - User ID
   * @param {string} status - Delivery status
   * @param {Object} metadata - Additional metadata
   */
  async recordRecipient(broadcastId, userId, status, metadata = {}) {
    const query = `
      INSERT INTO broadcast_recipients (
        broadcast_id, user_id, status, message_id,
        language, subscription_tier, error_code, error_message, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (broadcast_id, user_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        message_id = EXCLUDED.message_id,
        sent_at = EXCLUDED.sent_at,
        error_code = EXCLUDED.error_code,
        error_message = EXCLUDED.error_message
    `;

    try {
      await getPool().query(query, [
        broadcastId,
        userId,
        status,
        metadata.messageId || null,
        metadata.language || 'en',
        metadata.subscriptionTier || 'free',
        metadata.errorCode || null,
        metadata.errorMessage || null,
        status === 'sent' ? new Date() : null,
      ]);
    } catch (error) {
      logger.error('Error recording recipient:', error);
    }
  }

  /**
   * Get broadcast by ID
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Broadcast data
   */
  async getBroadcastById(broadcastId) {
    const query = 'SELECT * FROM broadcasts WHERE broadcast_id = $1';

    try {
      const result = await getPool().query(query, [broadcastId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting broadcast:', error);
      throw error;
    }
  }

  /**
   * Get broadcast statistics
   * @param {string} broadcastId - Broadcast ID
   * @returns {Promise<Object>} Broadcast statistics
   */
  async getBroadcastStats(broadcastId) {
    const query = `
      SELECT
        b.*,
        COUNT(br.id) as total_tracked,
        COUNT(CASE WHEN br.status = 'sent' THEN 1 END) as recipients_sent,
        COUNT(CASE WHEN br.status = 'failed' THEN 1 END) as recipients_failed,
        COUNT(CASE WHEN br.status = 'blocked' THEN 1 END) as recipients_blocked
      FROM broadcasts b
      LEFT JOIN broadcast_recipients br ON b.broadcast_id = br.broadcast_id
      WHERE b.broadcast_id = $1
      GROUP BY b.id
    `;

    try {
      const result = await getPool().query(query, [broadcastId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting broadcast stats:', error);
      throw error;
    }
  }

  /**
   * Get all broadcasts (with pagination)
   * @param {number} limit - Number of results
   * @param {number} offset - Offset for pagination
   * @param {string} status - Filter by status
   * @returns {Promise<Array>} List of broadcasts
   */
  async getAllBroadcasts(limit = 50, offset = 0, status = null) {
    let query = 'SELECT * FROM broadcasts';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    try {
      const result = await getPool().query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting broadcasts:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled broadcast
   * @param {string} broadcastId - Broadcast ID
   * @param {string} cancelledBy - User who cancelled
   * @param {string} reason - Cancellation reason
   */
  async cancelBroadcast(broadcastId, cancelledBy, reason = null) {
    const query = `
      UPDATE broadcasts
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by = $1,
          cancellation_reason = $2
      WHERE broadcast_id = $3 AND status IN ('pending', 'scheduled')
      RETURNING *
    `;

    try {
      const result = await getPool().query(query, [cancelledBy, reason, broadcastId]);

      if (result.rows.length === 0) {
        throw new Error('Broadcast not found or cannot be cancelled');
      }

      logger.info(`Broadcast ${broadcastId} cancelled by ${cancelledBy}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error cancelling broadcast:', error);
      throw error;
    }
  }

  /**
   * Get pending scheduled broadcasts (for scheduler to process)
   * @returns {Promise<Array>} List of pending broadcasts
   */
  async getPendingScheduledBroadcasts() {
    const query = `
      SELECT * FROM broadcasts
      WHERE status = 'scheduled'
        AND scheduled_at <= CURRENT_TIMESTAMP
      ORDER BY scheduled_at ASC
    `;

    try {
      const result = await getPool().query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting pending scheduled broadcasts:', error);
      throw error;
    }
  }
}

module.exports = BroadcastService;
