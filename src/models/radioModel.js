const { query, getClient } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Radio Model - Handles radio streaming, requests, and scheduling
 * PostgreSQL implementation
 */
class RadioModel {
  // ==========================================
  // HELPER METHODS - Row Mapping
  // ==========================================

  static mapRowToNowPlaying(row) {
    if (!row) return null;
    return {
      id: row.id.toString(),
      title: row.title,
      artist: row.artist,
      duration: row.duration,
      coverUrl: row.cover_url,
      startedAt: row.started_at,
    };
  }

  static mapRowToRequest(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      songName: row.song_name,
      status: row.status,
      artist: row.artist,
      duration: row.duration,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
      playedAt: row.played_at,
    };
  }

  static mapRowToHistory(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      duration: row.duration,
      coverUrl: row.cover_url,
      playedAt: row.played_at,
    };
  }

  static mapRowToSchedule(row) {
    if (!row) return null;
    return {
      id: row.id,
      dayOfWeek: row.day_of_week,
      timeSlot: row.time_slot,
      programName: row.program_name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==========================================
  // NOW PLAYING OPERATIONS
  // ==========================================

  /**
   * Get current playing song
   * @returns {Promise<Object|null>} Currently playing song
   */
  static async getNowPlaying() {
    try {
      const cacheKey = 'radio:now_playing';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query('SELECT * FROM radio_now_playing WHERE id = 1');
          if (result.rows.length === 0) return null;
          return this.mapRowToNowPlaying(result.rows[0]);
        },
        30, // Cache for 30 seconds
      );
    } catch (error) {
      logger.error('Error getting now playing:', error);
      return null;
    }
  }

  /**
   * Set now playing song
   * @param {Object} songData - Song data { title, artist, duration, coverUrl }
   * @returns {Promise<Object|null>} Created now playing record
   */
  static async setNowPlaying(songData) {
    try {
      // Update singleton record
      const result = await query(
        `UPDATE radio_now_playing
         SET title = $1, artist = $2, duration = $3, cover_url = $4,
             started_at = NOW(), updated_at = NOW()
         WHERE id = 1
         RETURNING *`,
        [
          songData.title,
          songData.artist || 'Unknown Artist',
          songData.duration || '3:00',
          songData.coverUrl || null,
        ],
      );

      // Add to history
      await this.addToHistory(songData);

      // Invalidate caches
      await cache.del('radio:now_playing');
      await cache.del('radio:history');

      logger.info('Now playing updated', { song: songData.title });
      return this.mapRowToNowPlaying(result.rows[0]);
    } catch (error) {
      logger.error('Error setting now playing:', error);
      return null;
    }
  }

  // ==========================================
  // REQUEST OPERATIONS
  // ==========================================

  /**
   * Request a song
   * @param {number|string} userId - User ID
   * @param {string} songName - Song name/title
   * @returns {Promise<Object|null>} Created request
   */
  static async requestSong(userId, songName) {
    try {
      const result = await query(
        `INSERT INTO radio_requests (user_id, song_name, status, requested_at)
         VALUES ($1, $2, 'pending', NOW())
         RETURNING *`,
        [userId.toString(), songName],
      );

      // Invalidate cache
      await cache.del('radio:requests:pending');

      logger.info('Song requested', { userId, songName });
      return this.mapRowToRequest(result.rows[0]);
    } catch (error) {
      logger.error('Error requesting song:', error);
      return null;
    }
  }

  /**
   * Get pending song requests
   * @param {number} limit - Number of requests to return
   * @returns {Promise<Array>} Pending requests
   */
  static async getPendingRequests(limit = 20) {
    try {
      const cacheKey = 'radio:requests:pending';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            `SELECT * FROM radio_requests
             WHERE status = 'pending'
             ORDER BY requested_at ASC
             LIMIT $1`,
            [limit],
          );

          logger.info(`Retrieved ${result.rows.length} pending requests`);
          return result.rows.map((row) => this.mapRowToRequest(row));
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Update request status
   * @param {string} requestId - Request ID
   * @param {string} status - New status (pending, approved, rejected, played)
   * @returns {Promise<boolean>} Success status
   */
  static async updateRequestStatus(requestId, status) {
    try {
      await query(
        `UPDATE radio_requests
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [status, requestId],
      );

      // Invalidate cache
      await cache.del('radio:requests:pending');

      logger.info('Request status updated', { requestId, status });
      return true;
    } catch (error) {
      logger.error('Error updating request status:', error);
      return false;
    }
  }

  /**
   * Get user's request count
   * @param {number|string} userId - User ID
   * @returns {Promise<number>} Number of requests by user
   */
  static async getUserRequestCount(userId) {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM radio_requests
         WHERE user_id = $1`,
        [userId.toString()],
      );

      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Error getting user request count:', error);
      return 0;
    }
  }

  /**
   * Get all requests (not just pending)
   * @param {string} status - Status filter (all, pending, approved, rejected, played)
   * @param {number} limit - Number of requests to return
   * @returns {Promise<Array>} Requests
   */
  static async getRequestsByStatus(status = 'all', limit = 50) {
    try {
      let sql = `SELECT * FROM radio_requests `;
      let params = [];

      if (status !== 'all') {
        sql += `WHERE status = $1 `;
        params.push(status);
      }

      sql += `ORDER BY requested_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await query(sql, params);

      logger.info(`Retrieved ${result.rows.length} requests with status: ${status}`);
      return result.rows.map((row) => this.mapRowToRequest(row));
    } catch (error) {
      logger.error('Error getting requests by status:', error);
      return [];
    }
  }

  /**
   * Get top requested songs
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Top requested songs
   */
  static async getTopRequests(limit = 10) {
    try {
      const result = await query(
        `SELECT song_name, COUNT(*) as count
         FROM radio_requests
         WHERE status = 'played'
         GROUP BY LOWER(song_name)
         ORDER BY count DESC
         LIMIT $1`,
        [limit],
      );

      const topSongs = result.rows.map((row) => ({
        songName: row.song_name,
        count: parseInt(row.count),
      }));

      logger.info(`Retrieved top ${topSongs.length} requested songs`);
      return topSongs;
    } catch (error) {
      logger.error('Error getting top requests:', error);
      return [];
    }
  }

  // ==========================================
  // HISTORY OPERATIONS
  // ==========================================

  /**
   * Add song to history
   * @param {Object} songData - Song data
   * @returns {Promise<boolean>} Success status
   */
  static async addToHistory(songData) {
    try {
      await query(
        `INSERT INTO radio_history (title, artist, duration, cover_url, played_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          songData.title || 'Unknown',
          songData.artist || null,
          songData.duration || null,
          songData.coverUrl || null,
        ],
      );

      // Invalidate cache
      await cache.del('radio:history');

      logger.info('Song added to history', { song: songData.title });
      return true;
    } catch (error) {
      logger.error('Error adding to history:', error);
      return false;
    }
  }

  /**
   * Get song history
   * @param {number} limit - Number of songs to return
   * @returns {Promise<Array>} Recent songs
   */
  static async getHistory(limit = 10) {
    try {
      const cacheKey = 'radio:history';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            `SELECT * FROM radio_history
             ORDER BY played_at DESC
             LIMIT $1`,
            [limit],
          );

          logger.info(`Retrieved ${result.rows.length} songs from history`);
          return result.rows.map((row) => this.mapRowToHistory(row));
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting history:', error);
      return [];
    }
  }

  /**
   * Search history by song title or artist
   * @param {string} queryStr - Search query
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Matching songs
   */
  static async searchHistory(queryStr, limit = 10) {
    try {
      const searchPattern = `%${queryStr.toLowerCase()}%`;

      const result = await query(
        `SELECT * FROM radio_history
         WHERE LOWER(title) LIKE $1 OR LOWER(artist) LIKE $1
         ORDER BY played_at DESC
         LIMIT $2`,
        [searchPattern, limit],
      );

      return result.rows.map((row) => this.mapRowToHistory(row));
    } catch (error) {
      logger.error('Error searching history:', error);
      return [];
    }
  }

  // ==========================================
  // SCHEDULE OPERATIONS
  // ==========================================

  /**
   * Create or update schedule (upsert)
   * @param {Object} scheduleData - Schedule data { dayOfWeek, timeSlot, programName, description }
   * @returns {Promise<Object|null>} Created/updated schedule
   */
  static async createOrUpdateSchedule(scheduleData) {
    try {
      const result = await query(
        `INSERT INTO radio_schedule
         (day_of_week, time_slot, program_name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (day_of_week, time_slot) DO UPDATE SET
           program_name = EXCLUDED.program_name,
           description = EXCLUDED.description,
           updated_at = NOW()
         RETURNING *`,
        [
          scheduleData.dayOfWeek,
          scheduleData.timeSlot,
          scheduleData.programName,
          scheduleData.description || null,
        ],
      );

      // Invalidate cache
      await cache.del('radio:schedule');

      logger.info('Schedule created/updated', {
        dayOfWeek: scheduleData.dayOfWeek,
        timeSlot: scheduleData.timeSlot,
      });
      return this.mapRowToSchedule(result.rows[0]);
    } catch (error) {
      logger.error('Error creating/updating schedule:', error);
      return null;
    }
  }

  /**
   * Update schedule entry
   * @param {string} scheduleId - Schedule ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateSchedule(scheduleId, updates) {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.programName !== undefined) {
        updateFields.push(`program_name = $${paramIndex++}`);
        values.push(updates.programName);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.dayOfWeek !== undefined) {
        updateFields.push(`day_of_week = $${paramIndex++}`);
        values.push(updates.dayOfWeek);
      }

      if (updates.timeSlot !== undefined) {
        updateFields.push(`time_slot = $${paramIndex++}`);
        values.push(updates.timeSlot);
      }

      if (updateFields.length === 0) return true;

      updateFields.push(`updated_at = NOW()`);
      values.push(scheduleId);

      await query(
        `UPDATE radio_schedule
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}`,
        values,
      );

      // Invalidate cache
      await cache.del('radio:schedule');

      logger.info('Schedule updated', { scheduleId });
      return true;
    } catch (error) {
      logger.error('Error updating schedule:', error);
      return false;
    }
  }

  /**
   * Get radio schedule
   * @returns {Promise<Array>} Schedule entries
   */
  static async getSchedule() {
    try {
      const cacheKey = 'radio:schedule';

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const result = await query(
            `SELECT * FROM radio_schedule
             ORDER BY day_of_week ASC, time_slot ASC`,
          );

          logger.info(`Retrieved ${result.rows.length} schedule entries`);
          return result.rows.map((row) => this.mapRowToSchedule(row));
        },
        300, // Cache for 5 minutes
      );
    } catch (error) {
      logger.error('Error getting schedule:', error);
      return [];
    }
  }

  /**
   * Delete schedule entry
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteSchedule(scheduleId) {
    try {
      await query('DELETE FROM radio_schedule WHERE id = $1', [scheduleId]);

      // Invalidate cache
      await cache.del('radio:schedule');

      logger.info('Schedule deleted', { scheduleId });
      return true;
    } catch (error) {
      logger.error('Error deleting schedule:', error);
      return false;
    }
  }

  /**
   * Get current program from schedule
   * @returns {Promise<Object|null>} Current program
   */
  static async getCurrentProgram() {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();

      const schedule = await this.getSchedule();

      // Find program for current day and hour
      const currentProgram = schedule.find((entry) => {
        if (entry.dayOfWeek !== dayOfWeek) return false;

        // Parse time slot (e.g., "14:00-16:00")
        const [start, end] = entry.timeSlot.split('-');
        const startHour = parseInt(start.split(':')[0], 10);
        const endHour = parseInt(end.split(':')[0], 10);

        return hour >= startHour && hour < endHour;
      });

      return currentProgram || null;
    } catch (error) {
      logger.error('Error getting current program:', error);
      return null;
    }
  }

  // ==========================================
  // STATISTICS OPERATIONS
  // ==========================================

  /**
   * Get statistics
   * @returns {Promise<Object>} Radio statistics
   */
  static async getStatistics() {
    try {
      const result = await query(
        `SELECT
           COUNT(*) as total_requests,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
           (SELECT COUNT(*) FROM radio_history) as total_songs_played
         FROM radio_requests`,
      );

      const row = result.rows[0];
      const stats = {
        totalRequests: parseInt(row.total_requests) || 0,
        totalSongsPlayed: parseInt(row.total_songs_played) || 0,
        pendingRequests: parseInt(row.pending_requests) || 0,
      };

      logger.info('Radio statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Error getting radio statistics:', error);
      return {
        totalRequests: 0,
        totalSongsPlayed: 0,
        pendingRequests: 0,
      };
    }
  }

  /**
   * Get detailed statistics with time ranges
   * @returns {Promise<Object>} Detailed statistics
   */
  static async getDetailedStatistics() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await query(
        `SELECT
           COUNT(*) as total_requests,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
           COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
           COUNT(*) FILTER (WHERE status = 'rejected') as rejected_requests,
           COUNT(*) FILTER (WHERE requested_at >= $1) as today_requests,
           COUNT(*) FILTER (WHERE requested_at >= $2) as week_requests,
           (SELECT COUNT(*) FROM radio_history) as total_songs_played
         FROM radio_requests`,
        [today, thisWeek],
      );

      const row = result.rows[0];
      const totalRequests = parseInt(row.total_requests) || 0;
      const approvedRequests = parseInt(row.approved_requests) || 0;

      const stats = {
        totalRequests,
        totalSongsPlayed: parseInt(row.total_songs_played) || 0,
        pendingRequests: parseInt(row.pending_requests) || 0,
        approvedRequests,
        rejectedRequests: parseInt(row.rejected_requests) || 0,
        todayRequests: parseInt(row.today_requests) || 0,
        weekRequests: parseInt(row.week_requests) || 0,
        approvalRate:
          totalRequests > 0 ? ((approvedRequests / totalRequests) * 100).toFixed(2) : 0,
      };

      logger.info('Detailed radio statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Error getting detailed statistics:', error);
      return {
        totalRequests: 0,
        totalSongsPlayed: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        todayRequests: 0,
        weekRequests: 0,
        approvalRate: 0,
      };
    }
  }

  // ==========================================
  // COMPLEX OPERATIONS
  // ==========================================

  /**
   * Mark request as played and add to now playing
   * @param {string} requestId - Request ID
   * @returns {Promise<boolean>} Success status
   */
  static async playRequest(requestId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get request details
      const requestResult = await client.query(
        'SELECT * FROM radio_requests WHERE id = $1',
        [requestId],
      );

      if (requestResult.rows.length === 0) {
        logger.warn('Request not found for playing', { requestId });
        await client.query('ROLLBACK');
        return false;
      }

      const requestData = this.mapRowToRequest(requestResult.rows[0]);

      // Set as now playing
      await client.query(
        `UPDATE radio_now_playing
         SET title = $1, artist = $2, duration = $3,
             started_at = NOW(), updated_at = NOW()
         WHERE id = 1`,
        [
          requestData.songName,
          requestData.artist || 'Unknown Artist',
          requestData.duration || '3:00',
        ],
      );

      // Update request status
      await client.query(
        `UPDATE radio_requests
         SET status = 'played', played_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );

      // Add to history
      await client.query(
        `INSERT INTO radio_history (title, artist, duration, played_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          requestData.songName,
          requestData.artist || 'Unknown Artist',
          requestData.duration || '3:00',
        ],
      );

      await client.query('COMMIT');

      // Invalidate caches
      await cache.del('radio:requests:pending');
      await cache.del('radio:now_playing');
      await cache.del('radio:history');

      logger.info('Request marked as played', { requestId });
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error playing request:', error);
      return false;
    } finally {
      client.release();
    }
  }
}

module.exports = RadioModel;
