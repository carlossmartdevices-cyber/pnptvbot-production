const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Media Player Model - Handles media library, playlists, and player state using PostgreSQL
 */
class MediaPlayerModel {
  /**
   * Initialize database tables
   * Run this once to create required tables
   */
  static async initializeTables() {
    try {
      // Media library table
      await query(`
        CREATE TABLE IF NOT EXISTS media_library (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          artist VARCHAR(255),
          album VARCHAR(255),
          duration INTEGER,
          url TEXT NOT NULL,
          thumbnail_url TEXT,
          type VARCHAR(20) DEFAULT 'audio',
          category VARCHAR(100),
          play_count INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Playlists table
      await query(`
        CREATE TABLE IF NOT EXISTS media_playlists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Playlist items table (junction table)
      await query(`
        CREATE TABLE IF NOT EXISTS playlist_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          playlist_id UUID REFERENCES media_playlists(id) ON DELETE CASCADE,
          media_id UUID REFERENCES media_library(id) ON DELETE CASCADE,
          position INTEGER,
          added_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(playlist_id, media_id)
        )
      `);

      // Player states table
      await query(`
        CREATE TABLE IF NOT EXISTS player_states (
          user_id VARCHAR(50) PRIMARY KEY,
          current_media_id UUID REFERENCES media_library(id),
          current_playlist_id UUID REFERENCES media_playlists(id),
          position INTEGER DEFAULT 0,
          is_playing BOOLEAN DEFAULT false,
          volume INTEGER DEFAULT 100,
          repeat_mode VARCHAR(20) DEFAULT 'none',
          shuffle BOOLEAN DEFAULT false,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // User likes table
      await query(`
        CREATE TABLE IF NOT EXISTS media_likes (
          user_id VARCHAR(50) NOT NULL,
          media_id UUID REFERENCES media_library(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (user_id, media_id)
        )
      `);

      // Create indexes
      await query('CREATE INDEX IF NOT EXISTS idx_media_category ON media_library(category)');
      await query('CREATE INDEX IF NOT EXISTS idx_media_play_count ON media_library(play_count DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_playlists_user ON media_playlists(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id)');

      logger.info('Media player tables initialized successfully');
      return true;
    } catch (error) {
      logger.error('Error initializing media player tables:', error);
      throw error;
    }
  }

  // ==================== Media Library ====================

  /**
   * Create a new media entry
   */
  static async createMedia(mediaData) {
    try {
      const result = await query(
        `INSERT INTO media_library (title, artist, album, duration, url, thumbnail_url, type, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          mediaData.title,
          mediaData.artist || null,
          mediaData.album || null,
          mediaData.duration || 0,
          mediaData.url,
          mediaData.thumbnailUrl || null,
          mediaData.type || 'audio',
          mediaData.category || null,
        ]
      );

      await cache.del('media:library:*');
      logger.info('Media created', { id: result.rows[0].id, title: mediaData.title });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating media:', error);
      return null;
    }
  }

  /**
   * Get media by ID
   */
  static async getMediaById(mediaId) {
    try {
      const cacheKey = `media:${mediaId}`;
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query('SELECT * FROM media_library WHERE id = $1', [mediaId]);
          return result.rows[0] || null;
        },
        300
      );
    } catch (error) {
      logger.error('Error getting media:', error);
      return null;
    }
  }

  /**
   * Get media library with optional filters
   */
  static async getMediaLibrary(options = {}) {
    try {
      const { category, type, limit = 50, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;
      const cacheKey = `media:library:${category || 'all'}:${type || 'all'}:${offset}:${limit}`;

      return await cache.getOrSet(
        cacheKey,
        async () => {
          let sql = 'SELECT * FROM media_library WHERE 1=1';
          const params = [];
          let paramIndex = 1;

          if (category) {
            sql += ` AND category = $${paramIndex++}`;
            params.push(category);
          }
          if (type) {
            sql += ` AND type = $${paramIndex++}`;
            params.push(type);
          }

          sql += ` ORDER BY ${orderBy} ${order} LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
          params.push(limit, offset);

          const result = await query(sql, params);
          return result.rows;
        },
        60
      );
    } catch (error) {
      logger.error('Error getting media library:', error);
      return [];
    }
  }

  /**
   * Search media
   */
  static async searchMedia(searchQuery, limit = 20) {
    try {
      const result = await query(
        `SELECT * FROM media_library
         WHERE title ILIKE $1 OR artist ILIKE $1 OR album ILIKE $1
         ORDER BY play_count DESC
         LIMIT $2`,
        [`%${searchQuery}%`, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error searching media:', error);
      return [];
    }
  }

  /**
   * Get trending media (most played)
   */
  static async getTrendingMedia(limit = 20) {
    try {
      const cacheKey = `media:trending:${limit}`;
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            'SELECT * FROM media_library ORDER BY play_count DESC LIMIT $1',
            [limit]
          );
          return result.rows;
        },
        300
      );
    } catch (error) {
      logger.error('Error getting trending media:', error);
      return [];
    }
  }

  /**
   * Increment play count
   */
  static async incrementPlayCount(mediaId) {
    try {
      await query(
        'UPDATE media_library SET play_count = play_count + 1, updated_at = NOW() WHERE id = $1',
        [mediaId]
      );
      await cache.del(`media:${mediaId}`);
      await cache.del('media:trending:*');
      return true;
    } catch (error) {
      logger.error('Error incrementing play count:', error);
      return false;
    }
  }

  /**
   * Get categories
   */
  static async getCategories() {
    try {
      const cacheKey = 'media:categories';
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            'SELECT DISTINCT category FROM media_library WHERE category IS NOT NULL ORDER BY category'
          );
          return result.rows.map(row => row.category);
        },
        600
      );
    } catch (error) {
      logger.error('Error getting categories:', error);
      return [];
    }
  }

  // ==================== Playlists ====================

  /**
   * Create a playlist
   * @param {string|number} userId - User ID
   * @param {Object} playlistData - Playlist data { name, description, isPublic }
   */
  static async createPlaylist(userId, playlistData) {
    try {
      const { name, description = '', isPublic = false } = playlistData;

      const result = await query(
        `INSERT INTO media_playlists (user_id, name, description, is_public)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId.toString(), name, description, isPublic]
      );

      await cache.del(`playlists:user:${userId}`);
      logger.info('Playlist created', { userId, name });
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating playlist:', error);
      return null;
    }
  }

  /**
   * Get user playlists
   */
  static async getUserPlaylists(userId) {
    try {
      const cacheKey = `playlists:user:${userId}`;
      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            `SELECT p.*,
              (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count
             FROM media_playlists p
             WHERE p.user_id = $1
             ORDER BY p.updated_at DESC`,
            [userId.toString()]
          );
          return result.rows;
        },
        300
      );
    } catch (error) {
      logger.error('Error getting user playlists:', error);
      return [];
    }
  }

  /**
   * Get playlist by ID with items
   */
  static async getPlaylistById(playlistId) {
    try {
      const playlistResult = await query(
        'SELECT * FROM media_playlists WHERE id = $1',
        [playlistId]
      );

      if (!playlistResult.rows[0]) return null;

      const itemsResult = await query(
        `SELECT m.*, pi.position, pi.added_at
         FROM playlist_items pi
         JOIN media_library m ON pi.media_id = m.id
         WHERE pi.playlist_id = $1
         ORDER BY pi.position`,
        [playlistId]
      );

      return {
        ...playlistResult.rows[0],
        items: itemsResult.rows,
      };
    } catch (error) {
      logger.error('Error getting playlist:', error);
      return null;
    }
  }

  /**
   * Add media to playlist
   */
  static async addToPlaylist(playlistId, mediaId) {
    try {
      // Get next position
      const posResult = await query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM playlist_items WHERE playlist_id = $1',
        [playlistId]
      );

      await query(
        `INSERT INTO playlist_items (playlist_id, media_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (playlist_id, media_id) DO NOTHING`,
        [playlistId, mediaId, posResult.rows[0].next_pos]
      );

      await query('UPDATE media_playlists SET updated_at = NOW() WHERE id = $1', [playlistId]);

      // Invalidate caches
      const playlist = await query('SELECT user_id FROM media_playlists WHERE id = $1', [playlistId]);
      if (playlist.rows[0]) {
        await cache.del(`playlists:user:${playlist.rows[0].user_id}`);
      }

      logger.info('Media added to playlist', { playlistId, mediaId });
      return true;
    } catch (error) {
      logger.error('Error adding to playlist:', error);
      return false;
    }
  }

  /**
   * Remove media from playlist
   */
  static async removeFromPlaylist(playlistId, mediaId) {
    try {
      await query(
        'DELETE FROM playlist_items WHERE playlist_id = $1 AND media_id = $2',
        [playlistId, mediaId]
      );

      await query('UPDATE media_playlists SET updated_at = NOW() WHERE id = $1', [playlistId]);

      // Invalidate caches
      const playlist = await query('SELECT user_id FROM media_playlists WHERE id = $1', [playlistId]);
      if (playlist.rows[0]) {
        await cache.del(`playlists:user:${playlist.rows[0].user_id}`);
      }

      logger.info('Media removed from playlist', { playlistId, mediaId });
      return true;
    } catch (error) {
      logger.error('Error removing from playlist:', error);
      return false;
    }
  }

  /**
   * Delete playlist
   */
  static async deletePlaylist(playlistId) {
    try {
      const playlist = await query('SELECT user_id FROM media_playlists WHERE id = $1', [playlistId]);

      await query('DELETE FROM media_playlists WHERE id = $1', [playlistId]);

      if (playlist.rows[0]) {
        await cache.del(`playlists:user:${playlist.rows[0].user_id}`);
      }

      logger.info('Playlist deleted', { playlistId });
      return true;
    } catch (error) {
      logger.error('Error deleting playlist:', error);
      return false;
    }
  }

  /**
   * Update playlist
   */
  static async updatePlaylist(playlistId, updates) {
    try {
      const setClauses = [];
      const params = [];
      let paramIndex = 1;

      if (updates.name) {
        setClauses.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }
      if (updates.isPublic !== undefined) {
        setClauses.push(`is_public = $${paramIndex++}`);
        params.push(updates.isPublic);
      }

      if (setClauses.length === 0) return true;

      setClauses.push('updated_at = NOW()');
      params.push(playlistId);

      await query(
        `UPDATE media_playlists SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        params
      );

      const playlist = await query('SELECT user_id FROM media_playlists WHERE id = $1', [playlistId]);
      if (playlist.rows[0]) {
        await cache.del(`playlists:user:${playlist.rows[0].user_id}`);
      }

      return true;
    } catch (error) {
      logger.error('Error updating playlist:', error);
      return false;
    }
  }

  // ==================== Player State ====================

  /**
   * Get player state
   */
  static async getPlayerState(userId) {
    try {
      const result = await query(
        `SELECT ps.*, m.title, m.artist, m.thumbnail_url, m.url, m.duration
         FROM player_states ps
         LEFT JOIN media_library m ON ps.current_media_id = m.id
         WHERE ps.user_id = $1`,
        [userId.toString()]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting player state:', error);
      return null;
    }
  }

  /**
   * Update player state
   */
  static async updatePlayerState(userId, updates) {
    try {
      const result = await query(
        `INSERT INTO player_states (user_id, current_media_id, current_playlist_id, position, is_playing, volume, repeat_mode, shuffle)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           current_media_id = COALESCE($2, player_states.current_media_id),
           current_playlist_id = COALESCE($3, player_states.current_playlist_id),
           position = COALESCE($4, player_states.position),
           is_playing = COALESCE($5, player_states.is_playing),
           volume = COALESCE($6, player_states.volume),
           repeat_mode = COALESCE($7, player_states.repeat_mode),
           shuffle = COALESCE($8, player_states.shuffle),
           updated_at = NOW()
         RETURNING *`,
        [
          userId.toString(),
          updates.currentMediaId || null,
          updates.currentPlaylistId || null,
          updates.position !== undefined ? updates.position : null,
          updates.isPlaying !== undefined ? updates.isPlaying : null,
          updates.volume !== undefined ? updates.volume : null,
          updates.repeatMode || null,
          updates.shuffle !== undefined ? updates.shuffle : null,
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating player state:', error);
      return null;
    }
  }

  // ==================== Likes ====================

  /**
   * Toggle like on media
   */
  static async toggleLike(userId, mediaId) {
    try {
      // Check if already liked
      const existing = await query(
        'SELECT 1 FROM media_likes WHERE user_id = $1 AND media_id = $2',
        [userId.toString(), mediaId]
      );

      if (existing.rows.length > 0) {
        // Unlike
        await query(
          'DELETE FROM media_likes WHERE user_id = $1 AND media_id = $2',
          [userId.toString(), mediaId]
        );
        await query(
          'UPDATE media_library SET likes = likes - 1 WHERE id = $1',
          [mediaId]
        );
        await cache.del(`media:${mediaId}`);
        return { liked: false };
      } else {
        // Like
        await query(
          'INSERT INTO media_likes (user_id, media_id) VALUES ($1, $2)',
          [userId.toString(), mediaId]
        );
        await query(
          'UPDATE media_library SET likes = likes + 1 WHERE id = $1',
          [mediaId]
        );
        await cache.del(`media:${mediaId}`);
        return { liked: true };
      }
    } catch (error) {
      logger.error('Error toggling like:', error);
      return null;
    }
  }

  /**
   * Check if user liked media
   */
  static async isLiked(userId, mediaId) {
    try {
      const result = await query(
        'SELECT 1 FROM media_likes WHERE user_id = $1 AND media_id = $2',
        [userId.toString(), mediaId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking like:', error);
      return false;
    }
  }

  /**
   * Get user's liked media
   */
  static async getLikedMedia(userId, limit = 50) {
    try {
      const result = await query(
        `SELECT m.* FROM media_library m
         JOIN media_likes l ON m.id = l.media_id
         WHERE l.user_id = $1
         ORDER BY l.created_at DESC
         LIMIT $2`,
        [userId.toString(), limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting liked media:', error);
      return [];
    }
  }

  // ==================== Statistics ====================

  /**
   * Get media statistics
   */
  static async getStatistics() {
    try {
      const [totalMedia, totalPlaylists, totalPlays] = await Promise.all([
        query('SELECT COUNT(*) as count FROM media_library'),
        query('SELECT COUNT(*) as count FROM media_playlists'),
        query('SELECT SUM(play_count) as total FROM media_library'),
      ]);

      return {
        totalMedia: parseInt(totalMedia.rows[0].count),
        totalPlaylists: parseInt(totalPlaylists.rows[0].count),
        totalPlays: parseInt(totalPlays.rows[0].total) || 0,
      };
    } catch (error) {
      logger.error('Error getting statistics:', error);
      return { totalMedia: 0, totalPlaylists: 0, totalPlays: 0 };
    }
  }
}

module.exports = MediaPlayerModel;
