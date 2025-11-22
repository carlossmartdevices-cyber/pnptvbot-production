const { query } = require('../config/postgres');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Default platform-wide emotes available to all users
 */
const DEFAULT_EMOTES = {
  // Emotions
  smile: '😊',
  laugh: '😂',
  love: '❤️',
  heart: '💖',
  fire: '🔥',
  star: '⭐',
  sparkles: '✨',
  cry: '😢',
  angry: '😠',
  shock: '😱',
  thinking: '🤔',
  cool: '😎',
  party: '🎉',

  // Reactions
  clap: '👏',
  thumbsup: '👍',
  thumbsdown: '👎',
  wave: '👋',
  pray: '🙏',
  muscle: '💪',
  ok: '👌',

  // Objects
  mic: '🎤',
  music: '🎵',
  guitar: '🎸',
  game: '🎮',
  camera: '📷',
  gift: '🎁',
  money: '💰',
  trophy: '🏆',

  // Streaming specific
  live: '🔴',
  record: '⏺️',
  play: '▶️',
  pause: '⏸️',
  stream: '📺',
  broadcast: '📡',
};

/**
 * Emote Model for managing default and custom emotes
 */
class EmoteModel {
  /**
   * Get all default emotes
   * @returns {Object} Default emotes map
   */
  static getDefaultEmotes() {
    return { ...DEFAULT_EMOTES };
  }

  /**
   * Get emote list for display
   * @returns {Array} Array of emote objects
   */
  static getDefaultEmoteList() {
    return Object.entries(DEFAULT_EMOTES).map(([code, emoji]) => ({
      code,
      emoji,
      type: 'default',
    }));
  }

  /**
   * Create a custom emote
   * @param {string} streamerId - Streamer user ID
   * @param {string} streamerName - Streamer name
   * @param {string} code - Emote code (e.g., "MyEmote")
   * @param {string} imageUrl - URL to emote image
   * @param {boolean} requiresApproval - Whether emote needs admin approval
   * @returns {Promise<Object>} Created emote
   */
  static async createCustomEmote(streamerId, streamerName, code, imageUrl, requiresApproval = true) {
    try {
      // Validate code format (alphanumeric, 3-20 chars)
      if (!/^[a-zA-Z0-9]{3,20}$/.test(code)) {
        throw new Error('Emote code must be 3-20 alphanumeric characters');
      }

      // Check if code conflicts with default emotes
      if (DEFAULT_EMOTES[code.toLowerCase()]) {
        throw new Error('This emote code is reserved');
      }

      const emoteId = uuidv4();
      const status = requiresApproval ? 'pending' : 'approved';
      const timestamp = new Date();
      const approvedAt = requiresApproval ? null : timestamp;
      const approvedBy = requiresApproval ? null : 'auto';

      await query(
        `INSERT INTO custom_emotes (
          id, user_id, name, emoji, status, usage_count, is_active,
          created_at, updated_at, approved_at, approved_by, streamer_name, image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          emoteId, String(streamerId), code, '', status, 0, true,
          timestamp, timestamp, approvedAt, approvedBy, streamerName, imageUrl
        ]
      );

      logger.info('Custom emote created', { emoteId, streamerId, code });

      return {
        emoteId,
        streamerId: String(streamerId),
        streamerName,
        code,
        imageUrl,
        status,
        usageCount: 0,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        approvedAt,
        approvedBy,
        rejectedAt: null,
        rejectionReason: null,
      };
    } catch (error) {
      logger.error('Error creating custom emote:', error);
      throw error;
    }
  }

  /**
   * Get custom emotes for a streamer
   * @param {string} streamerId - Streamer user ID
   * @param {boolean} activeOnly - Only return active emotes
   * @returns {Promise<Array>} Array of custom emotes
   */
  static async getStreamerEmotes(streamerId, activeOnly = true) {
    try {
      let queryStr = `
        SELECT
          id as "emoteId", user_id as "streamerId", streamer_name as "streamerName",
          name as code, image_url as "imageUrl", status, usage_count as "usageCount",
          is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt",
          approved_at as "approvedAt", approved_by as "approvedBy",
          rejected_at as "rejectedAt", rejection_reason as "rejectionReason"
        FROM custom_emotes
        WHERE user_id = $1 AND status = 'approved'
      `;
      const params = [String(streamerId)];

      if (activeOnly) {
        queryStr += ' AND is_active = true';
      }

      queryStr += ' ORDER BY created_at DESC';

      const result = await query(queryStr, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching streamer emotes:', error);
      return [];
    }
  }

  /**
   * Get all available emotes for a stream (default + custom)
   * @param {string} streamerId - Streamer user ID
   * @returns {Promise<Object>} Object with default and custom emotes
   */
  static async getAvailableEmotes(streamerId) {
    try {
      const customEmotes = await this.getStreamerEmotes(streamerId);

      return {
        default: this.getDefaultEmoteList(),
        custom: customEmotes.map((emote) => ({
          code: emote.code,
          imageUrl: emote.imageUrl,
          type: 'custom',
          emoteId: emote.emoteId,
        })),
      };
    } catch (error) {
      logger.error('Error fetching available emotes:', error);
      return {
        default: this.getDefaultEmoteList(),
        custom: [],
      };
    }
  }

  /**
   * Parse emote codes in text and return formatted text
   * @param {string} text - Text with emote codes
   * @param {string} streamerId - Streamer user ID for custom emotes
   * @returns {Promise<Object>} Parsed text and emote data
   */
  static async parseEmotes(text, streamerId) {
    try {
      const emotePattern = /:([a-zA-Z0-9]+):/g;
      const matches = [...text.matchAll(emotePattern)];

      if (matches.length === 0) {
        return { text, emotes: [] };
      }

      const usedEmotes = [];
      let parsedText = text;

      // Get custom emotes for this streamer
      const customEmotes = await this.getStreamerEmotes(streamerId);
      const customEmoteMap = {};
      customEmotes.forEach((emote) => {
        customEmoteMap[emote.code.toLowerCase()] = emote;
      });

      // Replace emote codes
      for (const match of matches) {
        const code = match[1];
        const fullCode = match[0]; // :code:

        // Check default emotes first
        if (DEFAULT_EMOTES[code.toLowerCase()]) {
          parsedText = parsedText.replace(fullCode, DEFAULT_EMOTES[code.toLowerCase()]);
          usedEmotes.push({
            code,
            type: 'default',
            emoji: DEFAULT_EMOTES[code.toLowerCase()],
          });
        }
        // Check custom emotes
        else if (customEmoteMap[code.toLowerCase()]) {
          const emote = customEmoteMap[code.toLowerCase()];
          // For Telegram, we'll keep the code but track usage
          usedEmotes.push({
            code,
            type: 'custom',
            emoteId: emote.emoteId,
            imageUrl: emote.imageUrl,
          });

          // Increment usage count asynchronously
          this.incrementEmoteUsage(emote.emoteId).catch((err) =>
            logger.error('Error incrementing emote usage:', err)
          );
        }
      }

      return { text: parsedText, emotes: usedEmotes };
    } catch (error) {
      logger.error('Error parsing emotes:', error);
      return { text, emotes: [] };
    }
  }

  /**
   * Increment emote usage count
   * @param {string} emoteId - Emote ID
   */
  static async incrementEmoteUsage(emoteId) {
    try {
      // Update usage count
      await query(
        `UPDATE custom_emotes
         SET usage_count = usage_count + 1, updated_at = $1
         WHERE id = $2`,
        [new Date(), emoteId]
      );

      // Log usage for analytics
      await query(
        `INSERT INTO emote_usage (emote_id, used_at)
         VALUES ($1, $2)`,
        [emoteId, new Date()]
      );
    } catch (error) {
      logger.error('Error incrementing emote usage:', error);
      throw error;
    }
  }

  /**
   * Update custom emote
   * @param {string} emoteId - Emote ID
   * @param {string} streamerId - Streamer ID (for authorization)
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateEmote(emoteId, streamerId, updates) {
    try {
      // Check if emote exists and belongs to streamer
      const result = await query(
        'SELECT user_id FROM custom_emotes WHERE id = $1',
        [emoteId]
      );

      if (result.rows.length === 0) {
        throw new Error('Emote not found');
      }

      if (result.rows[0].user_id !== String(streamerId)) {
        throw new Error('Unauthorized to update this emote');
      }

      const allowedUpdates = { isActive: 'is_active', imageUrl: 'image_url' };
      const updateParts = [];
      const updateValues = [];
      let paramIndex = 1;

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates[key]) {
          updateParts.push(`${allowedUpdates[key]} = $${paramIndex}`);
          updateValues.push(updates[key]);
          paramIndex++;
        }
      });

      if (updateParts.length === 0) {
        return true;
      }

      updateParts.push(`updated_at = $${paramIndex}`);
      updateValues.push(new Date());
      updateValues.push(emoteId);

      await query(
        `UPDATE custom_emotes SET ${updateParts.join(', ')} WHERE id = $${paramIndex + 1}`,
        updateValues
      );

      logger.info('Emote updated', { emoteId, streamerId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating emote:', error);
      throw error;
    }
  }

  /**
   * Delete custom emote
   * @param {string} emoteId - Emote ID
   * @param {string} streamerId - Streamer ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  static async deleteEmote(emoteId, streamerId) {
    try {
      // Check if emote exists and belongs to streamer
      const result = await query(
        'SELECT user_id FROM custom_emotes WHERE id = $1',
        [emoteId]
      );

      if (result.rows.length === 0) {
        throw new Error('Emote not found');
      }

      if (result.rows[0].user_id !== String(streamerId)) {
        throw new Error('Unauthorized to delete this emote');
      }

      await query('DELETE FROM custom_emotes WHERE id = $1', [emoteId]);
      logger.info('Emote deleted', { emoteId, streamerId });

      return true;
    } catch (error) {
      logger.error('Error deleting emote:', error);
      throw error;
    }
  }

  /**
   * Get pending emotes for admin approval
   * @param {number} limit - Max emotes to return
   * @returns {Promise<Array>} Array of pending emotes
   */
  static async getPendingEmotes(limit = 50) {
    try {
      const result = await query(
        `SELECT
          id, user_id as "streamerId", streamer_name as "streamerName",
          name as code, image_url as "imageUrl", status, usage_count as "usageCount",
          is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM custom_emotes
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching pending emotes:', error);
      return [];
    }
  }

  /**
   * Approve custom emote (admin only)
   * @param {string} emoteId - Emote ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<boolean>} Success status
   */
  static async approveEmote(emoteId, adminId) {
    try {
      const result = await query(
        'SELECT id FROM custom_emotes WHERE id = $1',
        [emoteId]
      );

      if (result.rows.length === 0) {
        throw new Error('Emote not found');
      }

      const timestamp = new Date();
      await query(
        `UPDATE custom_emotes
         SET status = 'approved', approved_at = $1, approved_by = $2, updated_at = $3
         WHERE id = $4`,
        [timestamp, String(adminId), timestamp, emoteId]
      );

      logger.info('Emote approved', { emoteId, adminId });
      return true;
    } catch (error) {
      logger.error('Error approving emote:', error);
      throw error;
    }
  }

  /**
   * Reject custom emote (admin only)
   * @param {string} emoteId - Emote ID
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<boolean>} Success status
   */
  static async rejectEmote(emoteId, adminId, reason = 'Inappropriate content') {
    try {
      const result = await query(
        'SELECT id FROM custom_emotes WHERE id = $1',
        [emoteId]
      );

      if (result.rows.length === 0) {
        throw new Error('Emote not found');
      }

      const timestamp = new Date();
      await query(
        `UPDATE custom_emotes
         SET status = 'rejected', rejected_at = $1, rejection_reason = $2, updated_at = $3
         WHERE id = $4`,
        [timestamp, reason, timestamp, emoteId]
      );

      logger.info('Emote rejected', { emoteId, adminId, reason });
      return true;
    } catch (error) {
      logger.error('Error rejecting emote:', error);
      throw error;
    }
  }

  /**
   * Get emote statistics for a streamer
   * @param {string} streamerId - Streamer user ID
   * @returns {Promise<Object>} Emote statistics
   */
  static async getStreamerEmoteStats(streamerId) {
    try {
      const emotes = await this.getStreamerEmotes(streamerId, false);

      const stats = {
        total: emotes.length,
        active: emotes.filter((e) => e.isActive).length,
        pending: emotes.filter((e) => e.status === 'pending').length,
        approved: emotes.filter((e) => e.status === 'approved').length,
        rejected: emotes.filter((e) => e.status === 'rejected').length,
        totalUsage: emotes.reduce((sum, e) => sum + (e.usageCount || 0), 0),
        topEmotes: emotes
          .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
          .slice(0, 5)
          .map((e) => ({
            code: e.code,
            usage: e.usageCount || 0,
          })),
      };

      return stats;
    } catch (error) {
      logger.error('Error fetching emote stats:', error);
      return null;
    }
  }
}

module.exports = EmoteModel;
