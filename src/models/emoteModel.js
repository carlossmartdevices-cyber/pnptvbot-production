const { db } = require('../config/firebase');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'emotes';
const CUSTOM_EMOTES_COLLECTION = 'custom_emotes';
const EMOTE_USAGE_COLLECTION = 'emote_usage';

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
      const emote = {
        emoteId,
        streamerId: String(streamerId),
        streamerName,
        code,
        imageUrl,
        status: requiresApproval ? 'pending' : 'approved',
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: requiresApproval ? null : new Date(),
        approvedBy: requiresApproval ? null : 'auto',
        rejectedAt: null,
        rejectionReason: null,
      };

      await db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId).set(emote);
      logger.info('Custom emote created', { emoteId, streamerId, code });

      return emote;
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
      let query = db
        .collection(CUSTOM_EMOTES_COLLECTION)
        .where('streamerId', '==', String(streamerId))
        .where('status', '==', 'approved');

      if (activeOnly) {
        query = query.where('isActive', '==', true);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      const emotes = [];

      snapshot.forEach((doc) => {
        emotes.push({ id: doc.id, ...doc.data() });
      });

      return emotes;
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
      const emoteRef = db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(emoteRef);
        if (!doc.exists) return;

        const currentCount = doc.data().usageCount || 0;
        transaction.update(emoteRef, {
          usageCount: currentCount + 1,
          updatedAt: new Date(),
        });
      });

      // Log usage for analytics
      await db.collection(EMOTE_USAGE_COLLECTION).add({
        emoteId,
        timestamp: new Date(),
      });
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
      const emoteRef = db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId);
      const doc = await emoteRef.get();

      if (!doc.exists) {
        throw new Error('Emote not found');
      }

      const emote = doc.data();
      if (emote.streamerId !== String(streamerId)) {
        throw new Error('Unauthorized to update this emote');
      }

      const allowedUpdates = ['isActive', 'imageUrl'];
      const safeUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          safeUpdates[key] = updates[key];
        }
      });

      safeUpdates.updatedAt = new Date();

      await emoteRef.update(safeUpdates);
      logger.info('Emote updated', { emoteId, streamerId, updates: safeUpdates });

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
      const emoteRef = db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId);
      const doc = await emoteRef.get();

      if (!doc.exists) {
        throw new Error('Emote not found');
      }

      const emote = doc.data();
      if (emote.streamerId !== String(streamerId)) {
        throw new Error('Unauthorized to delete this emote');
      }

      await emoteRef.delete();
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
      const snapshot = await db
        .collection(CUSTOM_EMOTES_COLLECTION)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

      const emotes = [];
      snapshot.forEach((doc) => {
        emotes.push({ id: doc.id, ...doc.data() });
      });

      return emotes;
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
      const emoteRef = db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId);
      const doc = await emoteRef.get();

      if (!doc.exists) {
        throw new Error('Emote not found');
      }

      await emoteRef.update({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: String(adminId),
        updatedAt: new Date(),
      });

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
      const emoteRef = db.collection(CUSTOM_EMOTES_COLLECTION).doc(emoteId);
      const doc = await emoteRef.get();

      if (!doc.exists) {
        throw new Error('Emote not found');
      }

      await emoteRef.update({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      });

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
