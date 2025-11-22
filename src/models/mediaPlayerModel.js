const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * MediaPlayer Model - Handles music and video playback, playlists
 * Migrated from Firebase Firestore to PostgreSQL
 */
class MediaPlayerModel {
  /**
   * Create media item (audio or video)
   * @param {Object} mediaData - Media data { title, artist, url, type, duration, coverUrl, category }
   * @returns {Promise<Object|null>} Created media item
   */
  static async createMedia(mediaData) {
    try {
      const id = uuidv4();
      const {
        title,
        artist,
        url,
        type = 'audio',
        duration = 0,
        category = 'general',
        coverUrl,
        description = '',
        uploaderId = null,
        uploaderName = null,
        language = 'es',
        isPublic = true,
        isExplicit = false,
        tags = [],
        metadata = {},
      } = mediaData;

      const result = await query(
        `INSERT INTO media_library 
         (id, title, artist, url, type, duration, category, cover_url, description, uploader_id, uploader_name, language, is_public, is_explicit, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          id,
          title,
          artist,
          url,
          type,
          duration,
          category,
          coverUrl,
          description,
          uploaderId,
          uploaderName,
          language,
          isPublic,
          isExplicit,
          tags,
          JSON.stringify(metadata),
        ],
      );

      // Invalidate cache
      await cache.del('media:library');
      await cache.del(`media:category:${category}`);

      logger.info('Media created', { mediaId: id, title });
      return result.rows[0];
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
          let sql = 'SELECT * FROM media_library WHERE is_public = true';
          const params = [];

          if (type !== 'all') {
            sql += ' AND type = $1';
            params.push(type);
          }

          sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
          params.push(limit);

          const result = await query(sql, params);
          logger.info(`Retrieved ${result.rows.length} media items (type: ${type})`);
          return result.rows;
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
          const result = await query(
            `SELECT * FROM media_library 
             WHERE category = $1 AND is_public = true
             ORDER BY created_at DESC LIMIT $2`,
            [category, limit],
          );
          logger.info(`Retrieved ${result.rows.length} media items for category: ${category}`);
          return result.rows;
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
      const result = await query(
        'SELECT * FROM media_library WHERE id = $1',
        [mediaId],
      );
      return result.rows[0] || null;
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
      const id = uuidv4();
      const {
        name,
        description = '',
        isPublic = false,
        isCollaborative = false,
        coverUrl = null,
      } = playlistData;

      const result = await query(
        `INSERT INTO media_playlists (id, name, owner_id, description, cover_url, is_public, is_collaborative)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, name, userId, description, coverUrl, isPublic, isCollaborative],
      );

      // Invalidate cache
      await cache.del(`playlists:user:${userId}`);

      logger.info('Playlist created', { playlistId: id, name });
      return result.rows[0];
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
      // Get current max position
      const posResult = await query(
        'SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_items WHERE playlist_id = $1',
        [playlistId],
      );
      const position = (posResult.rows[0]?.max_pos || 0) + 1;

      await query(
        `INSERT INTO playlist_items (id, playlist_id, media_id, position)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (playlist_id, media_id) DO NOTHING`,
        [uuidv4(), playlistId, mediaId, position],
      );

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
      await query(
        'DELETE FROM playlist_items WHERE playlist_id = $1 AND media_id = $2',
        [playlistId, mediaId],
      );

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
   * @returns {Promise<Array>} User playlists with media count
   */
  static async getUserPlaylists(userId) {
    try {
      const cacheKey = `playlists:user:${userId}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            `SELECT p.*, COUNT(pi.id) as media_count 
             FROM media_playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             WHERE p.owner_id = $1
             GROUP BY p.id
             ORDER BY p.created_at DESC`,
            [userId],
          );
          logger.info(`Retrieved ${result.rows.length} playlists for user ${userId}`);
          return result.rows;
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
          const result = await query(
            `SELECT p.*, COUNT(pi.id) as media_count 
             FROM media_playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             WHERE p.is_public = true
             GROUP BY p.id
             ORDER BY p.total_plays DESC LIMIT $1`,
            [limit],
          );
          logger.info(`Retrieved ${result.rows.length} public playlists`);
          return result.rows;
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting public playlists:', error);
      return [];
    }
  }

  /**
   * Get playlist with media items
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<Object|null>} Playlist with items
   */
  static async getPlaylistWithItems(playlistId) {
    try {
      const playlistResult = await query(
        'SELECT * FROM media_playlists WHERE id = $1',
        [playlistId],
      );

      if (!playlistResult.rows[0]) {
        return null;
      }

      const playlist = playlistResult.rows[0];

      const itemsResult = await query(
        `SELECT m.* FROM media_library m
         JOIN playlist_items pi ON m.id = pi.media_id
         WHERE pi.playlist_id = $1
         ORDER BY pi.position ASC`,
        [playlistId],
      );

      return {
        ...playlist,
        mediaItems: itemsResult.rows,
        mediaCount: itemsResult.rows.length,
      };
    } catch (error) {
      logger.error('Error getting playlist with items:', error);
      return null;
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
          const result = await query(
            'SELECT * FROM player_states WHERE user_id = $1',
            [userId],
          );

          if (!result.rows[0]) {
            // Return default state
            return {
              userId,
              mediaId: null,
              playlistId: null,
              isPlaying: false,
              currentPosition: 0,
              lastPlayedAt: null,
            };
          }

          return result.rows[0];
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
      const {
        mediaId = null,
        playlistId = null,
        isPlaying = false,
        currentPosition = 0,
      } = updates;

      await query(
        `INSERT INTO player_states (id, user_id, media_id, playlist_id, is_playing, current_position, last_played_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
          media_id = $3,
          playlist_id = $4,
          is_playing = $5,
          current_position = $6,
          last_played_at = NOW(),
          updated_at = NOW()`,
        [uuidv4(), userId, mediaId, playlistId, isPlaying, currentPosition],
      );

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
      await query(
        'UPDATE media_library SET plays = plays + 1 WHERE id = $1',
        [mediaId],
      );

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
   * @param {string} userId - User ID
   * @param {string} mediaId - Media ID
   * @param {boolean} isLike - True to like, false to unlike
   * @returns {Promise<boolean>} Success status
   */
  static async toggleLike(userId, mediaId, isLike) {
    try {
      if (isLike) {
        // Add favorite
        await query(
          `INSERT INTO media_favorites (id, user_id, media_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, media_id) DO NOTHING`,
          [uuidv4(), userId, mediaId],
        );
        // Increment like count
        await query(
          'UPDATE media_library SET likes = likes + 1 WHERE id = $1',
          [mediaId],
        );
      } else {
        // Remove favorite
        await query(
          'DELETE FROM media_favorites WHERE user_id = $1 AND media_id = $2',
          [userId, mediaId],
        );
        // Decrement like count
        await query(
          'UPDATE media_library SET likes = GREATEST(likes - 1, 0) WHERE id = $1',
          [mediaId],
        );
      }

      logger.info(`Media ${isLike ? 'liked' : 'unliked'}`, { mediaId, userId });
      return true;
    } catch (error) {
      logger.error('Error toggling like:', error);
      return false;
    }
  }

  /**
   * Search media
   * @param {string} searchQuery - Search query
   * @param {string} type - Media type filter
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Matching media
   */
  static async searchMedia(searchQuery, type = 'all', limit = 20) {
    try {
      let sql = `SELECT * FROM media_library 
                 WHERE is_public = true 
                 AND (title ILIKE $1 OR artist ILIKE $1)`;
      const params = [`%${searchQuery}%`];

      if (type !== 'all') {
        sql += ' AND type = $2';
        params.push(type);
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await query(sql, params);
      logger.info(`Found ${result.rows.length} media items matching '${searchQuery}'`);
      return result.rows;
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
          let sql = 'SELECT * FROM media_library WHERE is_public = true';
          const params = [];

          if (type !== 'all') {
            sql += ' AND type = $1';
            params.push(type);
          }

          sql += ' ORDER BY plays DESC LIMIT $' + (params.length + 1);
          params.push(limit);

          const result = await query(sql, params);
          logger.info(`Retrieved ${result.rows.length} trending media (type: ${type})`);
          return result.rows;
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
      await query(
        'DELETE FROM media_library WHERE id = $1',
        [mediaId],
      );

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
      await query(
        'DELETE FROM media_playlists WHERE id = $1',
        [playlistId],
      );

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
          const result = await query(
            'SELECT DISTINCT category FROM media_library WHERE category IS NOT NULL ORDER BY category',
          );
          const categories = result.rows.map((row) => row.category);
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

  /**
   * Add media to play history
   * @param {string} userId - User ID
   * @param {string} mediaId - Media ID
   * @param {number} durationPlayed - Duration played in seconds
   * @returns {Promise<boolean>} Success status
   */
  static async addToPlayHistory(userId, mediaId, durationPlayed = 0) {
    try {
      await query(
        `INSERT INTO media_play_history (id, user_id, media_id, duration_played, completed)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), userId, mediaId, durationPlayed, durationPlayed > 0],
      );
      return true;
    } catch (error) {
      logger.error('Error adding to play history:', error);
      return false;
    }
  }

  /**
   * Get user play history
   * @param {string} userId - User ID
   * @param {number} limit - Number of items
   * @returns {Promise<Array>} Play history
   */
  static async getPlayHistory(userId, limit = 50) {
    try {
      const result = await query(
        `SELECT m.*, mph.played_at, mph.duration_played, mph.completed
         FROM media_play_history mph
         JOIN media_library m ON mph.media_id = m.id
         WHERE mph.user_id = $1
         ORDER BY mph.played_at DESC LIMIT $2`,
        [userId, limit],
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting play history:', error);
      return [];
    }
  }
}

module.exports = MediaPlayerModel;
