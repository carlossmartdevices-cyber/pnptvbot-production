const { query } = require('../config/postgres');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Radio Model - Handles radio streaming, requests, and scheduling
 */
class RadioModel {
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
          const result = await query(
            'SELECT * FROM radio_now_playing ORDER BY started_at DESC LIMIT 1',
            []
          );

          if (result.rows.length === 0) {
            return null;
          }

          const row = result.rows[0];
          return {
            id: row.id.toString(),
            title: row.title,
            artist: row.artist,
            duration: row.duration,
            coverUrl: row.cover_url,
            startedAt: row.started_at,
          };
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
      const startedAt = new Date();

      const result = await query(
        `INSERT INTO radio_now_playing (title, artist, duration, cover_url, started_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [songData.title, songData.artist || null, songData.duration || null, songData.coverUrl || null, startedAt]
      );

      const data = {
        id: result.rows[0].id.toString(),
        ...songData,
        startedAt,
      };

      // Add to history
      await this.addToHistory(songData);

      // Invalidate cache
      await cache.del('radio:now_playing');
      await cache.del('radio:history');

      logger.info('Now playing updated', { song: songData.title });
      return data;
    } catch (error) {
      logger.error('Error setting now playing:', error);
      return null;
    }
  }

  /**
   * Request a song
   * @param {number|string} userId - User ID
   * @param {string} songName - Song name/title
   * @returns {Promise<Object|null>} Created request
   */
  static async requestSong(userId, songName) {
    try {
      const requestedAt = new Date();

      const result = await query(
        `INSERT INTO radio_requests (user_id, song_name, status, requested_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId.toString(), songName, 'pending', requestedAt]
      );

      const data = {
        id: result.rows[0].id.toString(),
        userId: userId.toString(),
        songName,
        status: 'pending',
        requestedAt,
      };

      // Invalidate cache
      await cache.del('radio:requests:pending');

      logger.info('Song requested', { userId, songName });
      return data;
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
             WHERE status = $1
             ORDER BY requested_at ASC
             LIMIT $2`,
            ['pending', limit]
          );

          const requests = result.rows.map(row => ({
            id: row.id.toString(),
            userId: row.user_id,
            songName: row.song_name,
            artist: row.artist,
            duration: row.duration,
            status: row.status,
            requestedAt: row.requested_at,
            playedAt: row.played_at,
            updatedAt: row.updated_at,
          }));

          logger.info(`Retrieved ${requests.length} pending requests`);
          return requests;
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
        'UPDATE radio_requests SET status = $1, updated_at = $2 WHERE id = $3',
        [status, new Date(), requestId]
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
   * Add song to history
   * @param {Object} songData - Song data
   * @returns {Promise<boolean>} Success status
   */
  static async addToHistory(songData) {
    try {
      await query(
        `INSERT INTO radio_history (title, artist, duration, cover_url, played_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [songData.title, songData.artist || null, songData.duration || null, songData.coverUrl || null, new Date()]
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
            'SELECT * FROM radio_history ORDER BY played_at DESC LIMIT $1',
            [limit]
          );

          const history = result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            artist: row.artist,
            duration: row.duration,
            coverUrl: row.cover_url,
            playedAt: row.played_at,
          }));

          logger.info(`Retrieved ${history.length} songs from history`);
          return history;
        },
        60, // Cache for 1 minute
      );
    } catch (error) {
      logger.error('Error getting history:', error);
      return [];
    }
  }

  /**
   * Create or update schedule
   * @param {Object} scheduleData - Schedule data { dayOfWeek, timeSlot, programName, description }
   * @returns {Promise<Object|null>} Created/updated schedule
   */
  static async createOrUpdateSchedule(scheduleData) {
    try {
      const { dayOfWeek, timeSlot } = scheduleData;

      // Check if schedule exists for this day/time
      const existing = await query(
        'SELECT id FROM radio_schedule WHERE day_of_week = $1 AND time_slot = $2',
        [dayOfWeek, timeSlot]
      );

      let result;
      if (existing.rows.length > 0) {
        // Update existing
        result = await query(
          `UPDATE radio_schedule
           SET program_name = $1, description = $2, updated_at = $3
           WHERE day_of_week = $4 AND time_slot = $5
           RETURNING id`,
          [scheduleData.programName, scheduleData.description || null, new Date(), dayOfWeek, timeSlot]
        );
      } else {
        // Create new
        result = await query(
          `INSERT INTO radio_schedule (day_of_week, time_slot, program_name, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [dayOfWeek, timeSlot, scheduleData.programName, scheduleData.description || null, new Date(), new Date()]
        );
      }

      // Invalidate cache
      await cache.del('radio:schedule');

      const data = {
        id: result.rows[0].id.toString(),
        ...scheduleData,
        updatedAt: new Date(),
      };

      logger.info('Schedule created/updated', { dayOfWeek, timeSlot });
      return data;
    } catch (error) {
      logger.error('Error creating/updating schedule:', error);
      return null;
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
            'SELECT * FROM radio_schedule ORDER BY day_of_week ASC, time_slot ASC',
            []
          );

          const schedule = result.rows.map(row => ({
            id: row.id.toString(),
            dayOfWeek: row.day_of_week,
            timeSlot: row.time_slot,
            programName: row.program_name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          logger.info(`Retrieved ${schedule.length} schedule entries`);
          return schedule;
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
   * Get statistics
   * @returns {Promise<Object>} Radio statistics
   */
  static async getStatistics() {
    try {
      const [requestsResult, historyResult, pendingResult] = await Promise.all([
        query('SELECT COUNT(*) as total FROM radio_requests', []),
        query('SELECT COUNT(*) as total FROM radio_history', []),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE status = $1', ['pending']),
      ]);

      const stats = {
        totalRequests: parseInt(requestsResult.rows[0].total),
        totalSongsPlayed: parseInt(historyResult.rows[0].total),
        pendingRequests: parseInt(pendingResult.rows[0].total),
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
   * Get user's request count
   * @param {number|string} userId - User ID
   * @returns {Promise<number>} Number of requests by user
   */
  static async getUserRequestCount(userId) {
    try {
      const result = await query(
        'SELECT COUNT(*) as total FROM radio_requests WHERE user_id = $1',
        [userId.toString()]
      );

      return parseInt(result.rows[0].total);
    } catch (error) {
      logger.error('Error getting user request count:', error);
      return 0;
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

  /**
   * Get all requests (not just pending)
   * @param {string} status - Status filter (all, pending, approved, rejected, played)
   * @param {number} limit - Number of requests to return
   * @returns {Promise<Array>} Requests
   */
  static async getRequestsByStatus(status = 'all', limit = 50) {
    try {
      let sql = 'SELECT * FROM radio_requests';
      const params = [];

      if (status !== 'all') {
        sql += ' WHERE status = $1';
        params.push(status);
      }

      sql += ' ORDER BY requested_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await query(sql, params);

      const requests = result.rows.map(row => ({
        id: row.id.toString(),
        userId: row.user_id,
        songName: row.song_name,
        artist: row.artist,
        duration: row.duration,
        status: row.status,
        requestedAt: row.requested_at,
        playedAt: row.played_at,
        updatedAt: row.updated_at,
      }));

      logger.info(`Retrieved ${requests.length} requests with status: ${status}`);
      return requests;
    } catch (error) {
      logger.error('Error getting requests by status:', error);
      return [];
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
      const fieldMap = {
        dayOfWeek: 'day_of_week',
        timeSlot: 'time_slot',
        programName: 'program_name',
        description: 'description',
      };

      const dbFields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach((key) => {
        const dbField = fieldMap[key] || key;
        dbFields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      });

      if (dbFields.length === 0) {
        return true;
      }

      dbFields.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      values.push(scheduleId);

      await query(
        `UPDATE radio_schedule SET ${dbFields.join(', ')} WHERE id = $${paramIndex}`,
        values
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
   * Search history by song title or artist
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Matching songs
   */
  static async searchHistory(searchQuery, limit = 10) {
    try {
      const result = await query(
        `SELECT * FROM radio_history
         WHERE LOWER(title) LIKE $1 OR LOWER(artist) LIKE $1
         ORDER BY played_at DESC
         LIMIT $2`,
        [`%${searchQuery.toLowerCase()}%`, limit]
      );

      const results = result.rows.map(row => ({
        id: row.id.toString(),
        title: row.title,
        artist: row.artist,
        duration: row.duration,
        coverUrl: row.cover_url,
        playedAt: row.played_at,
      }));

      return results;
    } catch (error) {
      logger.error('Error searching history:', error);
      return [];
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

      const [
        totalRequests,
        totalHistory,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        todayRequests,
        weekRequests,
      ] = await Promise.all([
        query('SELECT COUNT(*) as total FROM radio_requests', []),
        query('SELECT COUNT(*) as total FROM radio_history', []),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE status = $1', ['pending']),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE status = $1', ['approved']),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE status = $1', ['rejected']),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE requested_at >= $1', [today]),
        query('SELECT COUNT(*) as total FROM radio_requests WHERE requested_at >= $1', [thisWeek]),
      ]);

      const totalReq = parseInt(totalRequests.rows[0].total);
      const approved = parseInt(approvedRequests.rows[0].total);

      const stats = {
        totalRequests: totalReq,
        totalSongsPlayed: parseInt(totalHistory.rows[0].total),
        pendingRequests: parseInt(pendingRequests.rows[0].total),
        approvedRequests: approved,
        rejectedRequests: parseInt(rejectedRequests.rows[0].total),
        todayRequests: parseInt(todayRequests.rows[0].total),
        weekRequests: parseInt(weekRequests.rows[0].total),
        approvalRate: totalReq > 0 ? ((approved / totalReq) * 100).toFixed(2) : 0,
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

  /**
   * Mark request as played and add to now playing
   * @param {string} requestId - Request ID
   * @returns {Promise<boolean>} Success status
   */
  static async playRequest(requestId) {
    try {
      const requestResult = await query(
        'SELECT * FROM radio_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        logger.warn('Request not found for playing', { requestId });
        return false;
      }

      const requestData = requestResult.rows[0];

      // Set as now playing
      await this.setNowPlaying({
        title: requestData.song_name,
        artist: requestData.artist || 'Unknown Artist',
        duration: requestData.duration || '3:00',
      });

      // Update request status
      await query(
        'UPDATE radio_requests SET status = $1, played_at = $2, updated_at = $3 WHERE id = $4',
        ['played', new Date(), new Date(), requestId]
      );

      // Invalidate caches
      await cache.del('radio:requests:pending');

      logger.info('Request marked as played', { requestId });
      return true;
    } catch (error) {
      logger.error('Error playing request:', error);
      return false;
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
         WHERE status = $1
         GROUP BY song_name
         ORDER BY count DESC
         LIMIT $2`,
        ['played', limit]
      );

      const topSongs = result.rows.map(row => ({
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
}

module.exports = RadioModel;
