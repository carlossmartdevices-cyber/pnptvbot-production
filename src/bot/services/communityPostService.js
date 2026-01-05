/**
 * Community Post Service
 * Handles creation, scheduling, and delivery of community group posts
 */

const db = require('../../utils/db');
const logger = require('../../utils/logger');
const s3Service = require('../../utils/s3Service');
const { Markup } = require('telegraf');

class CommunityPostService {
  /**
   * Create a new community post
   * @param {Object} postData - Post data
   * @returns {Promise<Object>} Created post object
   */
  async createCommunityPost(postData) {
    try {
      const {
        adminId,
        adminUsername,
        title,
        messageEn,
        messageEs,
        mediaType = null,
        mediaUrl = null,
        s3Key = null,
        s3Bucket = null,
        telegramFileId = null,
        targetGroupIds = [],
        targetAllGroups = false,
        templateType = 'standard',
        buttonLayout = 'single_row',
        scheduledAt = null,
        timezone = 'UTC',
        isRecurring = false,
        recurrencePattern = null,
        cronExpression = null,
        recurrenceEndDate = null,
        maxOccurrences = null,
        status = 'draft',
        scheduledCount = 0,
      } = postData;

      const query = `
        INSERT INTO community_posts (
          admin_id, admin_username, title, message_en, message_es,
          media_type, media_url, s3_key, s3_bucket, telegram_file_id,
          target_group_ids, target_all_groups,
          formatted_template_type, button_layout,
          scheduled_at, timezone,
          is_recurring, recurrence_pattern, cron_expression, recurrence_end_date, max_occurrences,
          status, scheduled_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *;
      `;

      const values = [
        adminId,
        adminUsername,
        title,
        messageEn,
        messageEs,
        mediaType,
        mediaUrl,
        s3Key,
        s3Bucket,
        telegramFileId,
        targetGroupIds,
        targetAllGroups,
        templateType,
        buttonLayout,
        scheduledAt,
        timezone,
        isRecurring,
        recurrencePattern,
        cronExpression,
        recurrenceEndDate,
        maxOccurrences,
        status,
        scheduledCount,
      ];

      const result = await db.query(query, values);
      logger.info('Community post created', { postId: result.rows[0].post_id });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating community post:', error);
      throw error;
    }
  }

  /**
   * Get all active community groups
   * @param {boolean} activeOnly - Only return active groups
   * @returns {Promise<Array>} Array of groups
   */
  async getCommunityGroups(activeOnly = true) {
    try {
      const query = activeOnly
        ? `SELECT * FROM community_groups WHERE is_active = true ORDER BY display_order ASC`
        : `SELECT * FROM community_groups ORDER BY display_order ASC`;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching community groups:', error);
      throw error;
    }
  }

  /**
   * Get community group by ID
   * @param {string} groupId - Group UUID
   * @returns {Promise<Object>} Group object
   */
  async getCommunityGroupById(groupId) {
    try {
      const query = `SELECT * FROM community_groups WHERE group_id = $1`;
      const result = await db.query(query, [groupId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching community group:', error);
      throw error;
    }
  }

  /**
   * Add buttons to a post
   * @param {string} postId - Post UUID
   * @param {Array} buttons - Array of button objects
   * @returns {Promise<Array>} Created buttons
   */
  async addButtonsToPost(postId, buttons) {
    try {
      const query = `
        INSERT INTO community_post_buttons (
          post_id, button_type, button_label, target_url, icon_emoji, button_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;

      const createdButtons = [];
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const result = await db.query(query, [
          postId,
          button.buttonType,
          button.label,
          button.targetUrl || null,
          button.icon || null,
          i,
        ]);
        createdButtons.push(result.rows[0]);
      }

      logger.info('Buttons added to post', { postId, count: createdButtons.length });
      return createdButtons;
    } catch (error) {
      logger.error('Error adding buttons to post:', error);
      throw error;
    }
  }

  /**
   * Get buttons for a post
   * @param {string} postId - Post UUID
   * @returns {Promise<Array>} Array of buttons
   */
  async getButtonsForPost(postId) {
    try {
      const query = `
        SELECT * FROM community_post_buttons
        WHERE post_id = $1
        ORDER BY button_order ASC
      `;
      const result = await db.query(query, [postId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching buttons for post:', error);
      throw error;
    }
  }

  /**
   * Create schedules for a post
   * @param {string} postId - Post UUID
   * @param {Array} scheduledTimes - Array of timestamps
   * @param {Object} recurrenceConfig - Recurrence configuration
   * @returns {Promise<Array>} Created schedules
   */
  async schedulePost(postId, scheduledTimes = [], recurrenceConfig = {}) {
    try {
      const schedules = [];

      // If recurring, create single schedule with recurrence pattern
      if (recurrenceConfig.isRecurring && scheduledTimes.length > 0) {
        const query = `
          INSERT INTO community_post_schedules (
            post_id, scheduled_for, timezone,
            is_recurring, recurrence_pattern, cron_expression,
            status, execution_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;
        `;

        for (let i = 0; i < scheduledTimes.length; i++) {
          const result = await db.query(query, [
            postId,
            scheduledTimes[i],
            recurrenceConfig.timezone || 'UTC',
            true,
            recurrenceConfig.recurrencePattern || 'daily',
            recurrenceConfig.cronExpression || null,
            'scheduled',
            i + 1,
          ]);
          schedules.push(result.rows[0]);
        }
      } else {
        // Non-recurring: create separate schedule for each time
        const query = `
          INSERT INTO community_post_schedules (
            post_id, scheduled_for, timezone,
            is_recurring, status, execution_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *;
        `;

        for (let i = 0; i < scheduledTimes.length; i++) {
          const result = await db.query(query, [
            postId,
            scheduledTimes[i],
            recurrenceConfig.timezone || 'UTC',
            false,
            'scheduled',
            i + 1,
          ]);
          schedules.push(result.rows[0]);
        }
      }

      logger.info('Post scheduled', { postId, scheduleCount: schedules.length });
      return schedules;
    } catch (error) {
      logger.error('Error scheduling post:', error);
      throw error;
    }
  }

  /**
   * Get pending posts ready for execution
   * @returns {Promise<Array>} Array of pending posts
   */
  async getPendingPosts() {
    try {
      const query = `
        SELECT
          p.*,
          s.schedule_id,
          s.execution_order,
          s.next_execution_at
        FROM community_posts p
        JOIN community_post_schedules s ON p.post_id = s.post_id
        WHERE s.status = 'scheduled'
        AND s.scheduled_for <= NOW()
        AND p.status IN ('scheduled', 'sending')
        ORDER BY s.execution_order ASC
        LIMIT 10;
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching pending posts:', error);
      throw error;
    }
  }

  /**
   * Get a post with all details
   * @param {string} postId - Post UUID
   * @returns {Promise<Object>} Post object with buttons and schedules
   */
  async getPostWithDetails(postId) {
    try {
      const postQuery = `SELECT * FROM community_posts WHERE post_id = $1`;
      const buttonsQuery = `SELECT * FROM community_post_buttons WHERE post_id = $1 ORDER BY button_order ASC`;
      const schedulesQuery = `SELECT * FROM community_post_schedules WHERE post_id = $1 ORDER BY execution_order ASC`;

      const [postResult, buttonsResult, schedulesResult] = await Promise.all([
        db.query(postQuery, [postId]),
        db.query(buttonsQuery, [postId]),
        db.query(schedulesQuery, [postId]),
      ]);

      if (!postResult.rows[0]) {
        return null;
      }

      return {
        ...postResult.rows[0],
        buttons: buttonsResult.rows,
        schedules: schedulesResult.rows,
      };
    } catch (error) {
      logger.error('Error fetching post with details:', error);
      throw error;
    }
  }

  /**
   * Format message based on template type
   * @param {string} templateType - Template type
   * @param {string} messageText - Message text
   * @param {string} title - Optional title
   * @param {string} mediaType - Optional media type
   * @returns {string} Formatted message
   */
  formatMessage(templateType, messageText, title = null, mediaType = null) {
    let formatted = '';

    switch (templateType) {
      case 'featured':
        formatted = `━━━━━━━━━━━━━━━━━\n✨ ${title || 'Featured Post'}\n━━━━━━━━━━━━━━━━━\n\n*${messageText}*\n\n`;
        break;

      case 'announcement':
        formatted = `📢 *ANNOUNCEMENT*\n\n*${title || 'Important Update'}*\n\n${messageText}\n\n`;
        break;

      case 'event':
        formatted = `🎪 *EVENT*\n\n*${title || 'Event'}*\n\n${messageText}\n\n`;
        break;

      case 'standard':
      default:
        formatted = messageText + '\n\n';
    }

    return formatted;
  }

  /**
   * Build inline keyboard for buttons
   * @param {Array} buttons - Array of button objects
   * @returns {Object} Telegraf Markup keyboard
   */
  buildButtonKeyboard(buttons) {
    if (!buttons || buttons.length === 0) {
      return Markup.inlineKeyboard([]);
    }

    // Group buttons based on layout
    const keyboard = [];
    let currentRow = [];

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const url = button.target_url || `https://t.me/pnptvbot?start=${button.button_type}`;

      currentRow.push(
        Markup.button.url(
          `${button.icon_emoji || '🔗'} ${button.button_label}`,
          url
        )
      );

      // Add max 2 buttons per row for better mobile UX
      if (currentRow.length === 2 || i === buttons.length - 1) {
        keyboard.push(currentRow);
        currentRow = [];
      }
    }

    return Markup.inlineKeyboard(keyboard);
  }

  /**
   * Send post to a single group
   * @param {Object} post - Post object with details
   * @param {Object} group - Group object
   * @param {Object} bot - Telegraf bot instance
   * @param {string} messageLanguage - 'en' or 'es'
   * @returns {Promise<Object>} Delivery result
   */
  async sendPostToGroup(post, group, bot, messageLanguage = 'en') {
    try {
      let message = this.formatMessage(
        post.formatted_template_type,
        messageLanguage === 'es' ? post.message_es : post.message_en,
        post.title,
        post.media_type
      );

      const buttons = await this.getButtonsForPost(post.post_id);
      const markup = this.buildButtonKeyboard(buttons);

      let messageId = null;
      const options = {
        parse_mode: 'Markdown',
        ...markup,
      };

      try {
        // Send media if present
        if (post.media_type === 'photo' && (post.telegram_file_id || post.media_url)) {
          const response = await bot.telegram.sendPhoto(
            group.telegram_group_id,
            post.telegram_file_id || post.media_url,
            { ...options, caption: message }
          );
          messageId = response.message_id;
        } else if (post.media_type === 'video' && (post.telegram_file_id || post.media_url)) {
          const response = await bot.telegram.sendVideo(
            group.telegram_group_id,
            post.telegram_file_id || post.media_url,
            { ...options, caption: message }
          );
          messageId = response.message_id;
        } else {
          // Text-only message
          const response = await bot.telegram.sendMessage(
            group.telegram_group_id,
            message,
            options
          );
          messageId = response.message_id;
        }

        // Log successful delivery
        await this.logDelivery(post.post_id, group.group_id, 'sent', messageId);

        return {
          success: true,
          messageId,
          groupId: group.group_id,
        };
      } catch (telegramError) {
        logger.error('Telegram send error', {
          groupId: group.group_id,
          error: telegramError.message
        });
        await this.logDelivery(post.post_id, group.group_id, 'failed', null, telegramError.message);

        return {
          success: false,
          groupId: group.group_id,
          error: telegramError.message,
        };
      }
    } catch (error) {
      logger.error('Error sending post to group:', error);
      throw error;
    }
  }

  /**
   * Send post to multiple groups
   * @param {Object} post - Post object
   * @param {Array} groups - Array of group objects
   * @param {Object} bot - Telegraf bot instance
   * @returns {Promise<Object>} Results summary
   */
  async sendPostToGroups(post, groups, bot) {
    try {
      const results = {
        successful: 0,
        failed: 0,
        total: groups.length,
        details: [],
      };

      for (const group of groups) {
        const result = await this.sendPostToGroup(post, group, bot, 'en');
        results.details.push(result);

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }
      }

      // Update post sent/failed counts
      await this.updatePostStatus(post.post_id, 'sent', results.successful, results.failed);

      logger.info('Batch send complete', {
        postId: post.post_id,
        results,
      });

      return results;
    } catch (error) {
      logger.error('Error sending post to groups:', error);
      throw error;
    }
  }

  /**
   * Log post delivery
   * @param {string} postId - Post UUID
   * @param {string} groupId - Group UUID
   * @param {string} status - Delivery status
   * @param {string} messageId - Telegram message ID
   * @param {string} errorMessage - Optional error message
   */
  async logDelivery(postId, groupId, status, messageId = null, errorMessage = null) {
    try {
      const query = `
        INSERT INTO community_post_deliveries (
          post_id, group_id, status, message_id, error_message, sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING;
      `;

      await db.query(query, [
        postId,
        groupId,
        status,
        messageId,
        errorMessage,
        status === 'sent' ? new Date() : null,
      ]);
    } catch (error) {
      logger.error('Error logging delivery:', error);
      // Don't throw - logging failures shouldn't break main flow
    }
  }

  /**
   * Update post status and counts
   * @param {string} postId - Post UUID
   * @param {string} status - New status
   * @param {number} sentCount - Number of successful sends
   * @param {number} failedCount - Number of failed sends
   */
  async updatePostStatus(postId, status, sentCount = 0, failedCount = 0) {
    try {
      const query = `
        UPDATE community_posts
        SET status = $1, sent_count = sent_count + $2, failed_count = failed_count + $3, updated_at = NOW()
        WHERE post_id = $4;
      `;

      await db.query(query, [status, sentCount, failedCount, postId]);
    } catch (error) {
      logger.error('Error updating post status:', error);
      throw error;
    }
  }

  /**
   * Update schedule execution
   * @param {string} scheduleId - Schedule UUID
   * @param {string} status - New status
   * @param {Date} nextExecution - Next execution time for recurring
   */
  async updateScheduleExecution(scheduleId, status, nextExecution = null) {
    try {
      const query = `
        UPDATE community_post_schedules
        SET
          status = $1,
          execution_count = execution_count + 1,
          last_executed_at = NOW(),
          next_execution_at = $2,
          updated_at = NOW()
        WHERE schedule_id = $3;
      `;

      await db.query(query, [status, nextExecution, scheduleId]);
    } catch (error) {
      logger.error('Error updating schedule execution:', error);
      throw error;
    }
  }

  /**
   * Get post analytics
   * @param {string} postId - Post UUID
   * @returns {Promise<Object>} Analytics object
   */
  async getPostAnalytics(postId) {
    try {
      const query = `
        SELECT
          (SELECT COUNT(*) FROM community_post_deliveries WHERE post_id = $1 AND status = 'sent') as total_sent,
          (SELECT COUNT(*) FROM community_post_deliveries WHERE post_id = $1 AND status = 'failed') as total_failed,
          (SELECT COUNT(DISTINCT group_id) FROM community_post_deliveries WHERE post_id = $1 AND status = 'sent') as groups_reached,
          (SELECT SUM(COALESCE((button_click_details->>'total')::INT, 0)) FROM community_post_analytics WHERE post_id = $1) as total_clicks
      `;

      const result = await db.query(query, [postId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching post analytics:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled post
   * @param {string} postId - Post UUID
   * @param {string} cancelledBy - Admin ID who cancelled
   * @param {string} reason - Cancellation reason
   */
  async cancelPost(postId, cancelledBy, reason = null) {
    try {
      const query = `
        UPDATE community_posts
        SET status = 'cancelled', updated_at = NOW()
        WHERE post_id = $1;
      `;

      await db.query(query, [postId]);

      const scheduleQuery = `
        UPDATE community_post_schedules
        SET status = 'cancelled'
        WHERE post_id = $1;
      `;

      await db.query(scheduleQuery, [postId]);

      logger.info('Post cancelled', { postId, cancelledBy, reason });
    } catch (error) {
      logger.error('Error cancelling post:', error);
      throw error;
    }
  }

  /**
   * Get button presets
   * @returns {Promise<Array>} Array of button presets
   */
  async getButtonPresets() {
    try {
      const query = `
        SELECT * FROM community_button_presets
        WHERE is_active = true
        ORDER BY button_type ASC
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching button presets:', error);
      throw error;
    }
  }
}

module.exports = new CommunityPostService();
