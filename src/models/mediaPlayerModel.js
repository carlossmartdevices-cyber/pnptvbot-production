const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const MEDIA_COLLECTION = 'media_library';
const PLAYLISTS_COLLECTION = 'media_playlists';
const PLAYER_STATE_COLLECTION = 'player_states';

/**
 * MediaPlayer Model - Handles music and video playback, playlists
 */
class MediaPlayerModel {
  /**
   * Create media item (audio or video)
   * @param {Object} mediaData - Media data { title, artist, url, type, duration, coverUrl, category }
   * @returns {Promise<Object|null>} Created media item
   */
  static async createMedia(mediaData) {
    try {
      const db = getFirestore();
      const mediaRef = db.collection(MEDIA_COLLECTION).doc();

      const data = {
        ...mediaData,
        type: mediaData.type || 'audio', // 'audio' or 'video'
        category: mediaData.category || 'general',
        plays: 0,
        likes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: mediaRef.id,
      };

      await mediaRef.set(data);

      // Invalidate cache
      await cache.del('media:library');
      await cache.del(`media:category:${data.category}`);

      logger.info('Media created', { mediaId: mediaRef.id, title: mediaData.title });
      return data;
    } catch (error) {
      logger.error('Error creating media:', error);
      return null;
    }
  }

  /**
   * Get all media items
   * @param {string} type - Filter by type ('all', 'audio', 'video')
   * @param {number} limit - Number of items to return
   * @returns {Promise<Array>} Media items
   */
  static async getMediaLibrary(type = 'all', limit = 50) {
    try {
      const cacheKey = `media:library:${type}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          let query = db.collection(MEDIA_COLLECTION);

          if (type !== 'all') {
            query = query.where('type', '==', type);
          }

          const snapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

          const media = [];
          snapshot.forEach((doc) => {
            media.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${media.length} media items (type: ${type})`);
          return media;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting media library:', error);
      return [];
    }
  }

  /**
   * Get media by category
   * @param {string} category - Category name
   * @param {number} limit - Number of items to return
   * @returns {Promise<Array>} Media items
   */
  static async getMediaByCategory(category, limit = 20) {
    try {
      const cacheKey = `media:category:${category}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(MEDIA_COLLECTION)
            .where('category', '==', category)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

          const media = [];
          snapshot.forEach((doc) => {
            media.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${media.length} media items for category: ${category}`);
          return media;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting media by category:', error);
      return [];
    }
  }

  /**
   * Get media item by ID
   * @param {string} mediaId - Media ID
   * @returns {Promise<Object|null>} Media item
   */
  static async getMediaById(mediaId) {
    try {
      const db = getFirestore();
      const doc = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting media by ID:', error);
      return null;
    }
  }

  /**
   * Create playlist
   * @param {string} userId - User ID
   * @param {Object} playlistData - Playlist data { name, description, isPublic }
   * @returns {Promise<Object|null>} Created playlist
   */
  static async createPlaylist(userId, playlistData) {
    try {
      const db = getFirestore();
      const playlistRef = db.collection(PLAYLISTS_COLLECTION).doc();

      const data = {
        ...playlistData,
        userId: userId.toString(),
        mediaItems: [],
        plays: 0,
        followers: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: playlistRef.id,
      };

      await playlistRef.set(data);

      // Invalidate cache
      await cache.del(`playlists:user:${userId}`);

      logger.info('Playlist created', { playlistId: playlistRef.id, name: playlistData.name });
      return data;
    } catch (error) {
      logger.error('Error creating playlist:', error);
      return null;
    }
  }

  /**
   * Add media to playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} mediaId - Media ID
   * @returns {Promise<boolean>} Success status
   */
  static async addToPlaylist(playlistId, mediaId) {
    try {
      const db = getFirestore();
      const { FieldValue } = require('firebase-admin').firestore;
      const playlistRef = db.collection(PLAYLISTS_COLLECTION).doc(playlistId);

      await playlistRef.update({
        mediaItems: FieldValue.arrayUnion(mediaId),
        updatedAt: new Date(),
      });

      logger.info('Media added to playlist', { playlistId, mediaId });
      return true;
    } catch (error) {
      logger.error('Error adding to playlist:', error);
      return false;
    }
  }

  /**
   * Remove media from playlist
   * @param {string} playlistId - Playlist ID
   * @param {string} mediaId - Media ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromPlaylist(playlistId, mediaId) {
    try {
      const db = getFirestore();
      const { FieldValue } = require('firebase-admin').firestore;
      const playlistRef = db.collection(PLAYLISTS_COLLECTION).doc(playlistId);

      await playlistRef.update({
        mediaItems: FieldValue.arrayRemove(mediaId),
        updatedAt: new Date(),
      });

      logger.info('Media removed from playlist', { playlistId, mediaId });
      return true;
    } catch (error) {
      logger.error('Error removing from playlist:', error);
      return false;
    }
  }

  /**
   * Get user playlists
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User playlists
   */
  static async getUserPlaylists(userId) {
    try {
      const cacheKey = `playlists:user:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(PLAYLISTS_COLLECTION)
            .where('userId', '==', userId.toString())
            .orderBy('createdAt', 'desc')
            .get();

          const playlists = [];
          snapshot.forEach((doc) => {
            playlists.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${playlists.length} playlists for user ${userId}`);
          return playlists;
        },
        180, // Cache for 3 minutes
      );
    } catch (error) {
      logger.error('Error getting user playlists:', error);
      return [];
    }
  }

  /**
   * Get public playlists
   * @param {number} limit - Number of playlists to return
   * @returns {Promise<Array>} Public playlists
   */
  static async getPublicPlaylists(limit = 20) {
    try {
      const cacheKey = 'playlists:public';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(PLAYLISTS_COLLECTION)
            .where('isPublic', '==', true)
            .orderBy('followers', 'desc')
            .limit(limit)
            .get();

          const playlists = [];
          snapshot.forEach((doc) => {
            playlists.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${playlists.length} public playlists`);
          return playlists;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting public playlists:', error);
      return [];
    }
  }

  /**
   * Get player state for user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Player state
   */
  static async getPlayerState(userId) {
    try {
      const cacheKey = `player:state:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const doc = await db.collection(PLAYER_STATE_COLLECTION).doc(userId.toString()).get();

          if (!doc.exists) {
            // Return default state
            return {
              currentMedia: null,
              currentPlaylist: null,
              isPlaying: false,
              volume: 100,
              repeat: false,
              shuffle: false,
              queue: [],
              position: 0,
            };
          }

          return { id: doc.id, ...doc.data() };
        },
        30, // Cache for 30 seconds
      );
    } catch (error) {
      logger.error('Error getting player state:', error);
      return null;
    }
  }

  /**
   * Update player state
   * @param {string} userId - User ID
   * @param {Object} updates - State updates
   * @returns {Promise<boolean>} Success status
   */
  static async updatePlayerState(userId, updates) {
    try {
      const db = getFirestore();
      const stateRef = db.collection(PLAYER_STATE_COLLECTION).doc(userId.toString());

      await stateRef.set({
        ...updates,
        userId: userId.toString(),
        updatedAt: new Date(),
      }, { merge: true });

      // Invalidate cache
      await cache.del(`player:state:${userId}`);

      logger.info('Player state updated', { userId });
      return true;
    } catch (error) {
      logger.error('Error updating player state:', error);
      return false;
    }
  }

  /**
   * Increment media play count
   * @param {string} mediaId - Media ID
   * @returns {Promise<boolean>} Success status
   */
  static async incrementPlayCount(mediaId) {
    try {
      const db = getFirestore();
      const { FieldValue } = require('firebase-admin').firestore;
      const mediaRef = db.collection(MEDIA_COLLECTION).doc(mediaId);

      await mediaRef.update({
        plays: FieldValue.increment(1),
        updatedAt: new Date(),
      });

      // Invalidate cache
      await cache.del('media:library');

      logger.info('Play count incremented', { mediaId });
      return true;
    } catch (error) {
      logger.error('Error incrementing play count:', error);
      return false;
    }
  }

  /**
   * Like/Unlike media
   * @param {string} mediaId - Media ID
   * @param {boolean} isLike - True to like, false to unlike
   * @returns {Promise<boolean>} Success status
   */
  static async toggleLike(mediaId, isLike) {
    try {
      const db = getFirestore();
      const { FieldValue } = require('firebase-admin').firestore;
      const mediaRef = db.collection(MEDIA_COLLECTION).doc(mediaId);

      await mediaRef.update({
        likes: FieldValue.increment(isLike ? 1 : -1),
        updatedAt: new Date(),
      });

      logger.info(`Media ${isLike ? 'liked' : 'unliked'}`, { mediaId });
      return true;
    } catch (error) {
      logger.error('Error toggling like:', error);
      return false;
    }
  }

  /**
   * Search media
   * @param {string} query - Search query
   * @param {string} type - Media type filter
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Matching media
   */
  static async searchMedia(query, type = 'all', limit = 20) {
    try {
      const db = getFirestore();
      const lowerQuery = query.toLowerCase();

      let queryRef = db.collection(MEDIA_COLLECTION);
      if (type !== 'all') {
        queryRef = queryRef.where('type', '==', type);
      }

      const snapshot = await queryRef
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const results = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const title = (data.title || '').toLowerCase();
        const artist = (data.artist || '').toLowerCase();

        if (title.includes(lowerQuery) || artist.includes(lowerQuery)) {
          results.push({ id: doc.id, ...data });
        }
      });

      return results.slice(0, limit);
    } catch (error) {
      logger.error('Error searching media:', error);
      return [];
    }
  }

  /**
   * Get trending media (most played)
   * @param {string} type - Media type filter
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Trending media
   */
  static async getTrendingMedia(type = 'all', limit = 10) {
    try {
      const cacheKey = `media:trending:${type}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          let query = db.collection(MEDIA_COLLECTION);

          if (type !== 'all') {
            query = query.where('type', '==', type);
          }

          const snapshot = await query
            .orderBy('plays', 'desc')
            .limit(limit)
            .get();

          const media = [];
          snapshot.forEach((doc) => {
            media.push({ id: doc.id, ...doc.data() });
          });

          logger.info(`Retrieved ${media.length} trending media (type: ${type})`);
          return media;
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting trending media:', error);
      return [];
    }
  }

  /**
   * Delete media
   * @param {string} mediaId - Media ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteMedia(mediaId) {
    try {
      const db = getFirestore();
      await db.collection(MEDIA_COLLECTION).doc(mediaId).delete();

      // Invalidate cache
      await cache.del('media:library');

      logger.info('Media deleted', { mediaId });
      return true;
    } catch (error) {
      logger.error('Error deleting media:', error);
      return false;
    }
  }

  /**
   * Delete playlist
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<boolean>} Success status
   */
  static async deletePlaylist(playlistId) {
    try {
      const db = getFirestore();
      await db.collection(PLAYLISTS_COLLECTION).doc(playlistId).delete();

      logger.info('Playlist deleted', { playlistId });
      return true;
    } catch (error) {
      logger.error('Error deleting playlist:', error);
      return false;
    }
  }

  /**
   * Get categories list
   * @returns {Promise<Array>} List of categories
   */
  static async getCategories() {
    try {
      const cacheKey = 'media:categories';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const db = getFirestore();
          const snapshot = await db.collection(MEDIA_COLLECTION).get();

          const categoriesSet = new Set();
          snapshot.forEach((doc) => {
            const category = doc.data().category;
            if (category) {
              categoriesSet.add(category);
            }
          });

          const categories = Array.from(categoriesSet);
          logger.info(`Retrieved ${categories.length} categories`);
          return categories;
        },
        600, // Cache for 10 minutes
      );
    } catch (error) {
      logger.error('Error getting categories:', error);
      return ['general', 'music', 'podcasts', 'radio'];
    }
  }
}

module.exports = MediaPlayerModel;
