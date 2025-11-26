/**
 * Radio Stream Manager
 * Manages 24/7 audio streaming with Agora
 */

const RadioModel = require('../../models/radioModel');
const agoraTokenService = require('../agora/agoraTokenService');
const logger = require('../../utils/logger');
const { query } = require('../../config/postgres');

class RadioStreamManager {
  constructor() {
    this.channelName = process.env.RADIO_CHANNEL_NAME || 'pnptv_radio_247';
    this.isPlaying = false;
    this.currentTrackId = null;
    this.playlistQueue = [];
    this.playbackInterval = null;
  }

  /**
   * Initialize and start radio streaming
   */
  async initialize() {
    try {
      logger.info('Initializing PNPtv Radio stream manager');

      // Load initial playlist
      await this.loadPlaylist();

      // Start playback loop
      this.startPlayback();

      logger.info('Radio stream manager initialized successfully');
    } catch (error) {
      logger.error('Error initializing radio stream manager:', error);
      throw error;
    }
  }

  /**
   * Load playlist from database
   */
  async loadPlaylist() {
    try {
      // Get active tracks from new radio_tracks table
      const result = await query(
        `SELECT * FROM radio_tracks
         WHERE is_active = true
         ORDER BY play_order ASC NULLS LAST, created_at ASC
         LIMIT 1000`
      );

      if (result.rows.length === 0) {
        logger.warn('No tracks in playlist - radio will be silent');
        this.playlistQueue = [];
        return;
      }

      this.playlistQueue = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        audioUrl: row.audio_url,
        durationSeconds: row.duration_seconds,
        type: row.type,
        thumbnailUrl: row.thumbnail_url,
      }));

      logger.info(`Loaded ${this.playlistQueue.length} tracks into playlist`);
    } catch (error) {
      logger.error('Error loading playlist:', error);
      this.playlistQueue = [];
    }
  }

  /**
   * Start playback loop
   */
  startPlayback() {
    if (this.isPlaying) {
      logger.warn('Playback already started');
      return;
    }

    this.isPlaying = true;
    this.playNext();
  }

  /**
   * Play next track in queue
   */
  async playNext() {
    try {
      // Reload playlist if empty
      if (this.playlistQueue.length === 0) {
        await this.loadPlaylist();

        if (this.playlistQueue.length === 0) {
          logger.warn('Playlist is empty - waiting 60 seconds before retry');
          setTimeout(() => this.playNext(), 60000);
          return;
        }
      }

      // Get next track (circular queue)
      const track = this.playlistQueue.shift();
      this.playlistQueue.push(track); // Add back to end of queue

      this.currentTrackId = track.id;

      // Update now playing in database (using new schema)
      await query(
        `UPDATE radio_now_playing
         SET track_id = $1,
             started_at = NOW(),
             ends_at = NOW() + INTERVAL '${track.durationSeconds} seconds',
             listener_count = 0,
             updated_at = NOW()
         WHERE id = 1`,
        [track.id]
      );

      logger.info(`Now playing: ${track.title} by ${track.artist || 'Unknown'} (${track.durationSeconds}s)`);

      // Notify subscribers
      await this.notifySubscribers(track);

      // Schedule next track
      const nextPlayTime = track.durationSeconds * 1000;
      this.playbackInterval = setTimeout(() => {
        this.playNext();
      }, nextPlayTime);

    } catch (error) {
      logger.error('Error playing next track:', error);

      // Retry after 10 seconds
      setTimeout(() => this.playNext(), 10000);
    }
  }

  /**
   * Stop playback
   */
  stopPlayback() {
    this.isPlaying = false;

    if (this.playbackInterval) {
      clearTimeout(this.playbackInterval);
      this.playbackInterval = null;
    }

    logger.info('Radio playback stopped');
  }

  /**
   * Get now playing info
   */
  async getNowPlaying() {
    try {
      const result = await query(
        `SELECT np.*, rt.*
         FROM radio_now_playing np
         LEFT JOIN radio_tracks rt ON np.track_id = rt.id
         WHERE np.id = 1`
      );

      if (result.rows.length === 0 || !result.rows[0].track_id) {
        return null;
      }

      const row = result.rows[0];

      const now = new Date();
      const startedAt = new Date(row.started_at);
      const endsAt = new Date(row.ends_at);
      const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));

      return {
        track: {
          id: row.id,
          title: row.title,
          artist: row.artist,
          album: row.album,
          thumbnailUrl: row.thumbnail_url,
          durationSeconds: row.duration_seconds,
          type: row.type,
        },
        startedAt,
        endsAt,
        remaining,
        listenerCount: row.listener_count || 0,
      };
    } catch (error) {
      logger.error('Error getting now playing:', error);
      return null;
    }
  }

  /**
   * Generate listener token for joining radio
   */
  async generateListenerToken(userId) {
    try {
      const tokens = agoraTokenService.generateRadioTokens(this.channelName, userId);

      // Increment listener count
      await query(
        `UPDATE radio_now_playing
         SET listener_count = listener_count + 1,
             updated_at = NOW()
         WHERE id = 1`
      );

      // Add to listen history
      const nowPlaying = await this.getNowPlaying();
      if (nowPlaying && nowPlaying.track) {
        await query(
          `INSERT INTO radio_listen_history (user_id, track_id, session_id, device_type)
           VALUES ($1, $2, gen_random_uuid(), 'telegram')
           ON CONFLICT DO NOTHING`,
          [userId, nowPlaying.track.id]
        );
      }

      logger.info('Generated radio listener token', { userId });

      return tokens;
    } catch (error) {
      logger.error('Error generating listener token:', error);
      throw error;
    }
  }

  /**
   * Handle listener disconnect
   */
  async handleListenerDisconnect(userId) {
    try {
      // Decrement listener count
      await query(
        `UPDATE radio_now_playing
         SET listener_count = GREATEST(0, listener_count - 1),
             updated_at = NOW()
         WHERE id = 1`
      );

      logger.info('Listener disconnected', { userId });
    } catch (error) {
      logger.error('Error handling listener disconnect:', error);
    }
  }

  /**
   * Notify subscribers of now playing
   */
  async notifySubscribers(track) {
    try {
      // Get subscribers who want notifications for this track type
      const result = await query(
        `SELECT user_id
         FROM radio_subscribers
         WHERE notify_now_playing = true
           AND $1 = ANY(notify_track_types)`,
        [track.type]
      );

      const subscriberIds = result.rows.map(row => row.user_id);

      if (subscriberIds.length === 0) {
        return;
      }

      logger.info(`Notifying ${subscriberIds.length} subscribers of now playing`);

      // Return subscriber list for bot to send notifications
      return {
        subscribers: subscriberIds,
        track,
      };
    } catch (error) {
      logger.error('Error notifying subscribers:', error);
      return null;
    }
  }

  /**
   * Skip to next track (admin/DJ function)
   */
  async skipTrack() {
    if (this.playbackInterval) {
      clearTimeout(this.playbackInterval);
    }

    logger.info('Skipping current track');
    await this.playNext();
  }

  /**
   * Switch playlist mode (music/podcast/talkshow)
   */
  async switchMode(mode) {
    try {
      // Reload playlist with specific type
      const result = await query(
        `SELECT * FROM radio_tracks
         WHERE is_active = true AND type = $1
         ORDER BY play_order ASC NULLS LAST, created_at ASC
         LIMIT 1000`,
        [mode]
      );

      this.playlistQueue = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        audioUrl: row.audio_url,
        durationSeconds: row.duration_seconds,
        type: row.type,
        thumbnailUrl: row.thumbnail_url,
      }));

      logger.info(`Switched to ${mode} mode with ${this.playlistQueue.length} tracks`);

      // Skip current track to start new mode
      await this.skipTrack();
    } catch (error) {
      logger.error('Error switching mode:', error);
      throw error;
    }
  }

  /**
   * Get channel info
   */
  getChannelInfo() {
    return {
      channelName: this.channelName,
      isPlaying: this.isPlaying,
      currentTrackId: this.currentTrackId,
      queueLength: this.playlistQueue.length,
    };
  }
}

// Export singleton instance
module.exports = new RadioStreamManager();
