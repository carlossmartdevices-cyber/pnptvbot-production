const { getFirestore } = require('../config/firebase');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const NOW_PLAYING_COLLECTION = 'radio_now_playing';
const REQUESTS_COLLECTION = 'radio_requests';
const HISTORY_COLLECTION = 'radio_history';
const SCHEDULE_COLLECTION = 'radio_schedule';

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
          const db = getFirestore();
          const snapshot = await db.collection(NOW_PLAYING_COLLECTION)
            .orderBy('startedAt', 'desc')
            .limit(1)
            .get();

          if (snapshot.empty) {
            return null;
          }

          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() };
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
      const db = getFirestore();
      const nowPlayingRef = db.collection(NOW_PLAYING_COLLECTION).doc();

      const data = {
        ...songData,
        startedAt: new Date(),
        id: nowPlayingRef.id,
      };

      await nowPlayingRef.set(data);

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
      const db = getFirestore();
      const requestRef = db.collection(REQUESTS_COLLECTION).doc();

      const data = {
        userId: userId.toString(),
        songName,
        status: 'pending',
        requestedAt: new Date(),
        id: requestRef.id,
      };

      await requestRef.set(data);

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
          const db = getFirestore();
          const snapshot = await db.collection(REQUESTS_COLLECTION)
            .where('status', '==', 'pending')
            .orderBy('requestedAt', 'asc')
            .limit(limit)
            .get();

          const requests = [];
          snapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() });
          });

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
      const db = getFirestore();
      const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);

      await requestRef.update({
        status,
        updatedAt: new Date(),
      });

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
      const db = getFirestore();
      const historyRef = db.collection(HISTORY_COLLECTION).doc();

      const data = {
        ...songData,
        playedAt: new Date(),
        id: historyRef.id,
      };

      await historyRef.set(data);

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
          const db = getFirestore();
          const snapshot = await db.collection(HISTORY_COLLECTION)
            .orderBy('playedAt', 'desc')
            .limit(limit)
            .get();

          const history = [];
          snapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() });
          });

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
      const db = getFirestore();
      const { dayOfWeek, timeSlot } = scheduleData;

      // Find existing schedule for this day/time
      const snapshot = await db.collection(SCHEDULE_COLLECTION)
        .where('dayOfWeek', '==', dayOfWeek)
        .where('timeSlot', '==', timeSlot)
        .limit(1)
        .get();

      let scheduleRef;
      if (!snapshot.empty) {
        scheduleRef = snapshot.docs[0].ref;
      } else {
        scheduleRef = db.collection(SCHEDULE_COLLECTION).doc();
      }

      const data = {
        ...scheduleData,
        updatedAt: new Date(),
        id: scheduleRef.id,
      };

      if (snapshot.empty) {
        data.createdAt = new Date();
      }

      await scheduleRef.set(data, { merge: true });

      // Invalidate cache
      await cache.del('radio:schedule');

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
          const db = getFirestore();
          const snapshot = await db.collection(SCHEDULE_COLLECTION)
            .orderBy('dayOfWeek', 'asc')
            .orderBy('timeSlot', 'asc')
            .get();

          const schedule = [];
          snapshot.forEach((doc) => {
            schedule.push({ id: doc.id, ...doc.data() });
          });

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
      const db = getFirestore();
      await db.collection(SCHEDULE_COLLECTION).doc(scheduleId).delete();

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
      const db = getFirestore();

      // Get counts
      const [requestsSnapshot, historySnapshot] = await Promise.all([
        db.collection(REQUESTS_COLLECTION).count().get(),
        db.collection(HISTORY_COLLECTION).count().get(),
      ]);

      // Get pending requests count
      const pendingSnapshot = await db.collection(REQUESTS_COLLECTION)
        .where('status', '==', 'pending')
        .count()
        .get();

      const stats = {
        totalRequests: requestsSnapshot.data().count,
        totalSongsPlayed: historySnapshot.data().count,
        pendingRequests: pendingSnapshot.data().count,
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
      const db = getFirestore();
      const snapshot = await db.collection(REQUESTS_COLLECTION)
        .where('userId', '==', userId.toString())
        .count()
        .get();

      return snapshot.data().count;
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
}

module.exports = RadioModel;
