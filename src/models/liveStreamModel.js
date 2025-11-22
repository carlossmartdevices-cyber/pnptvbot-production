/**
 * Live Stream Model
 * Handles live streaming with Agora integration
 * Migrated to PostgreSQL from Firestore
 */

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { query, getClient } = require('../config/postgres');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

const CACHE_TTL = 30; // 30 seconds for active streams

// Stream categories
const CATEGORIES = {
  MUSIC: 'music',
  GAMING: 'gaming',
  TALK_SHOW: 'talk_show',
  EDUCATION: 'education',
  ENTERTAINMENT: 'entertainment',
  SPORTS: 'sports',
  NEWS: 'news',
  OTHER: 'other',
};

class LiveStreamModel {
  /**
   * Create a new live stream
   * @param {Object} streamData - Stream configuration data
   * @returns {Promise<Object>} Created stream with tokens
   */
  static async create(streamData) {
    try {
      const {
        hostId,
        hostName,
        title,
        description = '',
        isPaid = false,
        price = 0,
        maxViewers = 1000,
        scheduledFor = null,
        category = CATEGORIES.OTHER,
        tags = [],
        thumbnailUrl = null,
        allowComments = true,
        recordStream = false,
        language = 'en',
      } = streamData;

      if (!hostId || !hostName || !title) {
        throw new Error('Missing required fields: hostId, hostName, or title');
      }

      const streamId = uuidv4();
      const channelName = `live_${streamId.replace(/-/g, '')}`;
      const tokens = this.generateAgoraTokens(channelName, hostId);

      const now = new Date();

      // Initialize analytics and chat_settings as JSONB
      const analytics = {
        avgWatchTime: 0,
        totalWatchTime: 0,
        engagementRate: 0,
        shareCount: 0,
      };

      const chatSettings = {
        slowMode: false,
        slowModeDelay: 0,
        subscribersOnly: false,
      };

      const result = await query(
        `INSERT INTO live_streams (
          id, channel_name, host_id, host_name, title, description,
          is_paid, price, max_viewers, scheduled_for, category, tags,
          thumbnail_url, allow_comments, record_stream, language,
          status, current_viewers, total_views, peak_viewers, likes, total_comments,
          viewers, banned_users, moderators, tokens, analytics, chat_settings,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          'scheduled', 0, 0, 0, 0, 0,
          '[]'::jsonb, ARRAY[]::text[], ARRAY[$3]::text[], $17, $18, $19,
          $20, $20
        ) RETURNING *`,
        [
          streamId,
          channelName,
          String(hostId),
          hostName,
          title,
          description,
          isPaid,
          price,
          maxViewers,
          scheduledFor,
          category,
          tags,
          thumbnailUrl,
          allowComments,
          recordStream,
          language,
          JSON.stringify(tokens),
          JSON.stringify(analytics),
          JSON.stringify(chatSettings),
          now,
        ]
      );

      const stream = this._mapStreamFromDb(result.rows[0]);

      logger.info('Live stream created', { streamId, hostId, title, category });

      // Invalidate active streams cache
      await cache.delPattern('active_streams:*');

      return {
        ...stream,
        hostToken: tokens.hostToken,
        viewerToken: tokens.viewerToken,
      };
    } catch (error) {
      logger.error('Error creating live stream:', error);
      throw error;
    }
  }

  /**
   * Update stream data
   * @param {string} streamId - Stream ID
   * @param {Object} updates - Fields to update (camelCase)
   * @returns {Promise<boolean>} Success status
   */
  static async update(streamId, updates) {
    try {
      // Convert camelCase to snake_case for database
      const fieldMapping = {
        hostId: 'host_id',
        hostName: 'host_name',
        isPaid: 'is_paid',
        maxViewers: 'max_viewers',
        scheduledFor: 'scheduled_for',
        thumbnailUrl: 'thumbnail_url',
        allowComments: 'allow_comments',
        recordStream: 'record_stream',
        currentViewers: 'current_viewers',
        totalViews: 'total_views',
        peakViewers: 'peak_viewers',
        totalComments: 'total_comments',
        recordingUrl: 'recording_url',
        startedAt: 'started_at',
        endedAt: 'ended_at',
      };

      const dbUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        const dbKey = fieldMapping[key] || key;
        dbUpdates[dbKey] = value;
      }

      const fields = Object.keys(dbUpdates);
      const values = Object.values(dbUpdates);

      if (fields.length === 0) {
        return true;
      }

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(new Date(), streamId);

      await query(
        `UPDATE live_streams
         SET ${setClause}, updated_at = $${fields.length + 1}
         WHERE id = $${fields.length + 2}`,
        values
      );

      logger.info('Live stream updated', { streamId, updates: fields });

      // Invalidate cache
      await cache.delPattern('active_streams:*');

      return true;
    } catch (error) {
      logger.error('Error updating live stream:', error);
      return false;
    }
  }

  /**
   * Generate Agora tokens for host and viewers
   * @param {string} channelName - Agora channel name
   * @param {string} _userId - User ID
   * @returns {Object} Tokens for host and viewer
   */
  static generateAgoraTokens(channelName, _userId) {
    try {
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!appId || !appCertificate) {
        logger.warn('Agora credentials not configured, using mock tokens');
        return {
          hostToken: `mock_host_token_${Date.now()}`,
          viewerToken: `mock_viewer_token_${Date.now()}`,
        };
      }

      const uid = 0; // 0 means any user can join
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      // Host token (can publish and subscribe)
      const hostToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
      );

      // Viewer token (can only subscribe)
      const viewerToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        RtcRole.SUBSCRIBER,
        privilegeExpiredTs,
      );

      return { hostToken, viewerToken };
    } catch (error) {
      logger.error('Error generating Agora tokens:', error);
      // Return mock tokens as fallback
      return {
        hostToken: `mock_host_token_${Date.now()}`,
        viewerToken: `mock_viewer_token_${Date.now()}`,
      };
    }
  }

  /**
   * Get stream by ID
   * @param {string} streamId - Stream ID
   * @returns {Promise<Object|null>} Stream data or null
   */
  static async getById(streamId) {
    try {
      const result = await query(
        'SELECT * FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this._mapStreamFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error getting stream:', error);
      throw error;
    }
  }

  /**
   * Get all active streams
   * @param {number} limit - Maximum number of streams to return
   * @returns {Promise<Array>} Active streams
   */
  static async getActiveStreams(limit = 50) {
    try {
      // Check cache first
      const cacheKey = `active_streams:${limit}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      // Query from PostgreSQL
      const result = await query(
        `SELECT * FROM live_streams
         WHERE status = 'live' OR status = 'active'
         ORDER BY started_at DESC
         LIMIT $1`,
        [limit]
      );

      const streams = result.rows.map(row => this._mapStreamFromDb(row));

      // Cache for 30 seconds
      await cache.set(cacheKey, streams, CACHE_TTL);

      return streams;
    } catch (error) {
      logger.error('Error getting active streams:', error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get streams by host ID
   * @param {string} hostId - Host user ID
   * @param {number} limit - Maximum number of streams
   * @returns {Promise<Array>} User's streams
   */
  static async getByHostId(hostId, limit = 20) {
    try {
      const result = await query(
        `SELECT * FROM live_streams
         WHERE host_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [String(hostId), limit]
      );

      return result.rows.map(row => this._mapStreamFromDb(row));
    } catch (error) {
      logger.error('Error getting streams by host:', error);
      throw error;
    }
  }

  /**
   * Join a stream as viewer
   * @param {string} streamId - Stream ID
   * @param {string} viewerId - Viewer user ID
   * @param {string} viewerName - Viewer name
   * @returns {Promise<Object>} Viewer token and stream info
   */
  static async joinStream(streamId, viewerId, viewerName) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get stream with row lock
      const streamResult = await client.query(
        'SELECT * FROM live_streams WHERE id = $1 FOR UPDATE',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const streamRow = streamResult.rows[0];

      if (streamRow.status !== 'active' && streamRow.status !== 'live') {
        throw new Error('Stream is not active');
      }

      // Check if stream has reached max viewers
      if (streamRow.max_viewers && streamRow.current_viewers >= streamRow.max_viewers) {
        throw new Error('Stream has reached maximum viewers');
      }

      // Check if viewer is already in stream (check stream_viewers table)
      const existingViewer = await client.query(
        `SELECT id FROM stream_viewers
         WHERE stream_id = $1 AND viewer_id = $2 AND left_at IS NULL`,
        [streamId, String(viewerId)]
      );

      const isAlreadyViewing = existingViewer.rows.length > 0;

      if (!isAlreadyViewing) {
        // Add viewer to stream_viewers table
        await client.query(
          `INSERT INTO stream_viewers (stream_id, viewer_id, viewer_name, joined_at)
           VALUES ($1, $2, $3, $4)`,
          [streamId, String(viewerId), viewerName, new Date()]
        );

        // Update stream counts
        await client.query(
          `UPDATE live_streams
           SET current_viewers = current_viewers + 1,
               total_views = total_views + 1,
               peak_viewers = GREATEST(peak_viewers, current_viewers + 1),
               updated_at = $2
           WHERE id = $1`,
          [streamId, new Date()]
        );

        logger.info('User joined stream', { streamId, viewerId });
      }

      await client.query('COMMIT');

      // Get updated stream
      const stream = this._mapStreamFromDb(streamRow);

      // Generate viewer token
      const tokens = this.generateAgoraTokens(stream.channelName, viewerId);

      // Invalidate cache
      await cache.delPattern('active_streams:*');

      return {
        stream,
        viewerToken: tokens.viewerToken,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error joining stream:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Leave a stream
   * @param {string} streamId - Stream ID
   * @param {string} viewerId - Viewer user ID
   * @returns {Promise<void>}
   */
  static async leaveStream(streamId, viewerId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update viewer record to set left_at
      const viewerResult = await client.query(
        `UPDATE stream_viewers
         SET left_at = $3
         WHERE stream_id = $1 AND viewer_id = $2 AND left_at IS NULL
         RETURNING id`,
        [streamId, String(viewerId), new Date()]
      );

      const viewerLeft = viewerResult.rows.length > 0;

      if (viewerLeft) {
        // Decrement current viewers count
        await client.query(
          `UPDATE live_streams
           SET current_viewers = GREATEST(0, current_viewers - 1),
               updated_at = $2
           WHERE id = $1`,
          [streamId, new Date()]
        );

        logger.info('User left stream', { streamId, viewerId });
      }

      await client.query('COMMIT');

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error leaving stream:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * End a stream
   * @param {string} streamId - Stream ID
   * @param {string} hostId - Host user ID (for verification)
   * @returns {Promise<void>}
   */
  static async endStream(streamId, hostId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get stream
      const streamResult = await client.query(
        'SELECT * FROM live_streams WHERE id = $1 FOR UPDATE',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      if (stream.host_id !== String(hostId)) {
        throw new Error('Only the host can end the stream');
      }

      if (stream.status === 'ended') {
        throw new Error('Stream already ended');
      }

      // Calculate stream duration in minutes
      const endTime = new Date();
      const startTime = stream.started_at ? new Date(stream.started_at) : new Date();
      const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));

      // Update stream status
      await client.query(
        `UPDATE live_streams
         SET status = 'ended',
             ended_at = $2,
             duration = $3,
             updated_at = $2
         WHERE id = $1`,
        [streamId, endTime, durationMinutes]
      );

      // Update all active viewers to mark them as left
      await client.query(
        `UPDATE stream_viewers
         SET left_at = $2
         WHERE stream_id = $1 AND left_at IS NULL`,
        [streamId, endTime]
      );

      await client.query('COMMIT');

      logger.info('Stream ended', { streamId, hostId, duration: durationMinutes });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error ending stream:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Like a stream
   * @param {string} streamId - Stream ID
   * @returns {Promise<void>}
   */
  static async likeStream(streamId) {
    try {
      await query(
        `UPDATE live_streams
         SET likes = likes + 1,
             updated_at = $2
         WHERE id = $1`,
        [streamId, new Date()]
      );

      logger.info('Stream liked', { streamId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      logger.error('Error liking stream:', error);
      throw error;
    }
  }

  /**
   * Add comment to stream (improved with moderation)
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @param {string} userName - User name
   * @param {string} text - Comment text
   * @returns {Promise<Object>} Created comment
   */
  static async addComment(streamId, userId, userName, text) {
    try {
      // Get stream
      const streamResult = await query(
        'SELECT * FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      // Check if comments are allowed
      if (!stream.allow_comments) {
        throw new Error('Comments are disabled for this stream');
      }

      // Check if user is banned (check stream_banned_users table)
      const banResult = await query(
        'SELECT id FROM stream_banned_users WHERE stream_id = $1 AND user_id = $2',
        [streamId, String(userId)]
      );

      if (banResult.rows.length > 0) {
        throw new Error('You are banned from commenting on this stream');
      }

      // Check slow mode
      const chatSettings = stream.chat_settings || {};
      if (chatSettings.slowMode) {
        const recentComment = await query(
          `SELECT timestamp FROM stream_comments
           WHERE stream_id = $1 AND user_id = $2 AND is_deleted = false
           ORDER BY timestamp DESC
           LIMIT 1`,
          [streamId, String(userId)]
        );

        if (recentComment.rows.length > 0) {
          const lastComment = recentComment.rows[0];
          const timeSinceLastComment = (Date.now() - new Date(lastComment.timestamp).getTime()) / 1000;

          if (timeSinceLastComment < chatSettings.slowModeDelay) {
            throw new Error(
              `Please wait ${Math.ceil(chatSettings.slowModeDelay - timeSinceLastComment)} seconds before commenting again`
            );
          }
        }
      }

      // Create comment
      const commentId = uuidv4();
      const timestamp = new Date();

      const result = await query(
        `INSERT INTO stream_comments (
          id, stream_id, user_id, user_name, text, timestamp, likes, is_pinned, is_deleted
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, false, false)
        RETURNING *`,
        [commentId, streamId, String(userId), userName, text, timestamp]
      );

      // Update stream comment count
      await query(
        `UPDATE live_streams
         SET total_comments = total_comments + 1,
             updated_at = $2
         WHERE id = $1`,
        [streamId, new Date()]
      );

      const comment = this._mapCommentFromDb(result.rows[0]);

      logger.info('Comment added to stream', { streamId, userId, commentId });

      return comment;
    } catch (error) {
      logger.error('Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Get stream comments (paginated)
   * @param {string} streamId - Stream ID
   * @param {number} limit - Number of comments to fetch
   * @param {Date} beforeTimestamp - Fetch comments before this timestamp (for pagination)
   * @returns {Promise<Array>} Comments
   */
  static async getComments(streamId, limit = 50, beforeTimestamp = null) {
    try {
      let sql = `
        SELECT * FROM stream_comments
        WHERE stream_id = $1 AND is_deleted = false
      `;
      const params = [streamId];

      if (beforeTimestamp) {
        sql += ` AND timestamp < $2`;
        params.push(beforeTimestamp);
        sql += ` ORDER BY timestamp DESC LIMIT $3`;
        params.push(limit);
      } else {
        sql += ` ORDER BY timestamp DESC LIMIT $2`;
        params.push(limit);
      }

      const result = await query(sql, params);

      // Return in chronological order (oldest first)
      return result.rows.map(row => this._mapCommentFromDb(row)).reverse();
    } catch (error) {
      logger.error('Error getting comments:', error);
      throw error;
    }
  }

  /**
   * Delete comment
   * @param {string} commentId - Comment ID
   * @param {string} requesterId - User requesting deletion (must be host or moderator)
   * @returns {Promise<void>}
   */
  static async deleteComment(commentId, requesterId) {
    try {
      // Get comment
      const commentResult = await query(
        'SELECT * FROM stream_comments WHERE id = $1',
        [commentId]
      );

      if (commentResult.rows.length === 0) {
        throw new Error('Comment not found');
      }

      const comment = commentResult.rows[0];

      // Get stream
      const streamResult = await query(
        'SELECT * FROM live_streams WHERE id = $1',
        [comment.stream_id]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      // Check if requester is comment owner, host, or moderator
      const isOwner = comment.user_id === String(requesterId);
      const isHost = stream.host_id === String(requesterId);
      const isModerator = stream.moderators && stream.moderators.includes(String(requesterId));

      if (!isOwner && !isHost && !isModerator) {
        throw new Error('Unauthorized to delete this comment');
      }

      // Soft delete
      await query(
        `UPDATE stream_comments
         SET is_deleted = true,
             deleted_at = $2,
             deleted_by = $3
         WHERE id = $1`,
        [commentId, new Date(), String(requesterId)]
      );

      logger.info('Comment deleted', { commentId, streamId: comment.stream_id, deletedBy: requesterId });
    } catch (error) {
      logger.error('Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Ban user from stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID to ban
   * @param {string} moderatorId - Moderator performing the ban
   * @param {string} reason - Reason for ban
   * @returns {Promise<void>}
   */
  static async banUser(streamId, userId, moderatorId, reason = null) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get stream
      const streamResult = await client.query(
        'SELECT * FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      // Check if requester is host or moderator
      const isHost = stream.host_id === String(moderatorId);
      const isModerator = stream.moderators && stream.moderators.includes(String(moderatorId));

      if (!isHost && !isModerator) {
        throw new Error('Unauthorized to ban users');
      }

      // Check if already banned
      const existingBan = await client.query(
        'SELECT id FROM stream_banned_users WHERE stream_id = $1 AND user_id = $2',
        [streamId, String(userId)]
      );

      if (existingBan.rows.length === 0) {
        // Add to stream_banned_users table
        await client.query(
          `INSERT INTO stream_banned_users (stream_id, user_id, banned_by, banned_at, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [streamId, String(userId), String(moderatorId), new Date(), reason]
        );

        // Also add to banned_users array in live_streams for quick lookup
        await client.query(
          `UPDATE live_streams
           SET banned_users = array_append(banned_users, $2),
               updated_at = $3
           WHERE id = $1 AND NOT ($2 = ANY(banned_users))`,
          [streamId, String(userId), new Date()]
        );
      }

      await client.query('COMMIT');

      // Remove user from stream if currently viewing
      await this.leaveStream(streamId, userId);

      logger.info('User banned from stream', { streamId, userId, bannedBy: moderatorId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error banning user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unban user from stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID to unban
   * @param {string} moderatorId - Moderator performing the unban
   * @returns {Promise<void>}
   */
  static async unbanUser(streamId, userId, moderatorId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get stream
      const streamResult = await client.query(
        'SELECT * FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      // Check if requester is host or moderator
      const isHost = stream.host_id === String(moderatorId);
      const isModerator = stream.moderators && stream.moderators.includes(String(moderatorId));

      if (!isHost && !isModerator) {
        throw new Error('Unauthorized to unban users');
      }

      // Remove from stream_banned_users table
      await client.query(
        'DELETE FROM stream_banned_users WHERE stream_id = $1 AND user_id = $2',
        [streamId, String(userId)]
      );

      // Remove from banned_users array
      await client.query(
        `UPDATE live_streams
         SET banned_users = array_remove(banned_users, $2),
             updated_at = $3
         WHERE id = $1`,
        [streamId, String(userId), new Date()]
      );

      await client.query('COMMIT');

      logger.info('User unbanned from stream', { streamId, userId, unbannedBy: moderatorId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error unbanning user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get streams by category
   * @param {string} category - Category to filter by
   * @param {number} limit - Maximum number of streams
   * @returns {Promise<Array>} Streams in category
   */
  static async getByCategory(category, limit = 20) {
    try {
      const result = await query(
        `SELECT * FROM live_streams
         WHERE (status = 'active' OR status = 'live') AND category = $1
         ORDER BY current_viewers DESC, started_at DESC
         LIMIT $2`,
        [category, limit]
      );

      return result.rows.map(row => this._mapStreamFromDb(row));
    } catch (error) {
      logger.error('Error getting streams by category:', error);
      throw error;
    }
  }

  /**
   * Search streams by title or tags
   * @param {string} searchQuery - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching streams
   */
  static async searchStreams(searchQuery, limit = 20) {
    try {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;

      const result = await query(
        `SELECT * FROM live_streams
         WHERE (status = 'active' OR status = 'live')
           AND (
             LOWER(title) LIKE $1
             OR LOWER(description) LIKE $1
             OR EXISTS (
               SELECT 1 FROM unnest(tags) AS tag
               WHERE LOWER(tag) LIKE $1
             )
           )
         ORDER BY current_viewers DESC, started_at DESC
         LIMIT $2`,
        [searchPattern, limit]
      );

      return result.rows.map(row => this._mapStreamFromDb(row));
    } catch (error) {
      logger.error('Error searching streams:', error);
      throw error;
    }
  }

  /**
   * Subscribe to stream notifications
   * @param {string} userId - User ID subscribing
   * @param {string} streamerId - Streamer to follow
   * @returns {Promise<void>}
   */
  static async subscribeToStreamer(userId, streamerId) {
    try {
      // Use INSERT ... ON CONFLICT to handle duplicates
      await query(
        `INSERT INTO stream_notifications (user_id, streamer_id, subscribed_at, notifications_enabled)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, streamer_id)
         DO UPDATE SET notifications_enabled = true, subscribed_at = $3`,
        [String(userId), String(streamerId), new Date()]
      );

      logger.info('User subscribed to streamer', { userId, streamerId });
    } catch (error) {
      logger.error('Error subscribing to streamer:', error);
      throw error;
    }
  }

  /**
   * Get subscribers of a streamer
   * @param {string} streamerId - Streamer ID
   * @returns {Promise<Array>} Subscriber user IDs
   */
  static async getStreamSubscribers(streamerId) {
    try {
      const result = await query(
        `SELECT user_id FROM stream_notifications
         WHERE streamer_id = $1 AND notifications_enabled = true`,
        [String(streamerId)]
      );

      return result.rows.map(row => row.user_id);
    } catch (error) {
      logger.error('Error getting stream subscribers:', error);
      throw error;
    }
  }

  /**
   * Check if user is subscribed to streamer
   * @param {string} userId - User ID
   * @param {string} streamerId - Streamer ID
   * @returns {Promise<boolean>} True if subscribed
   */
  static async isSubscribedToStreamer(userId, streamerId) {
    try {
      const result = await query(
        `SELECT id FROM stream_notifications
         WHERE user_id = $1 AND streamer_id = $2 AND notifications_enabled = true
         LIMIT 1`,
        [String(userId), String(streamerId)]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking subscription:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from streamer
   * @param {string} userId - User ID
   * @param {string} streamerId - Streamer ID
   * @returns {Promise<void>}
   */
  static async unsubscribeFromStreamer(userId, streamerId) {
    try {
      await query(
        `UPDATE stream_notifications
         SET notifications_enabled = false
         WHERE user_id = $1 AND streamer_id = $2`,
        [String(userId), String(streamerId)]
      );

      logger.info('User unsubscribed from streamer', { userId, streamerId });
    } catch (error) {
      logger.error('Error unsubscribing from streamer:', error);
      throw error;
    }
  }

  /**
   * Update stream analytics
   * @param {string} streamId - Stream ID
   * @param {Object} analytics - Analytics data to update
   * @returns {Promise<void>}
   */
  static async updateAnalytics(streamId, analytics) {
    try {
      const updateParts = [];
      const values = [streamId];
      let paramCount = 2;

      if (analytics.shareCount !== undefined) {
        updateParts.push(`analytics = jsonb_set(analytics, '{shareCount}', to_jsonb((COALESCE((analytics->>'shareCount')::int, 0) + $${paramCount})::int))`);
        values.push(analytics.shareCount);
        paramCount++;
      }

      if (analytics.avgWatchTime !== undefined) {
        updateParts.push(`analytics = jsonb_set(analytics, '{avgWatchTime}', to_jsonb($${paramCount}::numeric))`);
        values.push(analytics.avgWatchTime);
        paramCount++;
      }

      if (analytics.totalWatchTime !== undefined) {
        updateParts.push(`analytics = jsonb_set(analytics, '{totalWatchTime}', to_jsonb($${paramCount}::numeric))`);
        values.push(analytics.totalWatchTime);
        paramCount++;
      }

      if (analytics.engagementRate !== undefined) {
        updateParts.push(`analytics = jsonb_set(analytics, '{engagementRate}', to_jsonb($${paramCount}::numeric))`);
        values.push(analytics.engagementRate);
        paramCount++;
      }

      if (updateParts.length === 0) {
        return;
      }

      values.push(new Date());

      await query(
        `UPDATE live_streams
         SET ${updateParts.join(', ')}, updated_at = $${paramCount}
         WHERE id = $1`,
        values
      );

      logger.info('Stream analytics updated', { streamId, analytics });
    } catch (error) {
      logger.error('Error updating stream analytics:', error);
      throw error;
    }
  }

  /**
   * Toggle chat settings
   * @param {string} streamId - Stream ID
   * @param {string} hostId - Host user ID (for authorization)
   * @param {Object} settings - Chat settings to update
   * @returns {Promise<void>}
   */
  static async updateChatSettings(streamId, hostId, settings) {
    try {
      // Get stream to verify host
      const streamResult = await query(
        'SELECT host_id FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      if (streamResult.rows[0].host_id !== String(hostId)) {
        throw new Error('Only the host can update chat settings');
      }

      const updateParts = [];
      const values = [streamId];
      let paramCount = 2;

      if (settings.slowMode !== undefined) {
        updateParts.push(`chat_settings = jsonb_set(chat_settings, '{slowMode}', to_jsonb($${paramCount}::boolean))`);
        values.push(settings.slowMode);
        paramCount++;
      }

      if (settings.slowModeDelay !== undefined) {
        updateParts.push(`chat_settings = jsonb_set(chat_settings, '{slowModeDelay}', to_jsonb($${paramCount}::int))`);
        values.push(settings.slowModeDelay);
        paramCount++;
      }

      if (settings.subscribersOnly !== undefined) {
        updateParts.push(`chat_settings = jsonb_set(chat_settings, '{subscribersOnly}', to_jsonb($${paramCount}::boolean))`);
        values.push(settings.subscribersOnly);
        paramCount++;
      }

      if (settings.allowComments !== undefined) {
        updateParts.push(`allow_comments = $${paramCount}`);
        values.push(settings.allowComments);
        paramCount++;
      }

      if (updateParts.length === 0) {
        return;
      }

      values.push(new Date());

      await query(
        `UPDATE live_streams
         SET ${updateParts.join(', ')}, updated_at = $${paramCount}
         WHERE id = $1`,
        values
      );

      logger.info('Chat settings updated', { streamId, settings });
    } catch (error) {
      logger.error('Error updating chat settings:', error);
      throw error;
    }
  }

  /**
   * Set recording URL for VOD (Video on Demand)
   * @param {string} streamId - Stream ID
   * @param {string} recordingUrl - URL of the recorded stream
   * @returns {Promise<void>}
   */
  static async setRecordingUrl(streamId, recordingUrl) {
    try {
      await query(
        `UPDATE live_streams
         SET recording_url = $2,
             updated_at = $3
         WHERE id = $1`,
        [streamId, recordingUrl, new Date()]
      );

      logger.info('Recording URL set for stream', { streamId, recordingUrl });
    } catch (error) {
      logger.error('Error setting recording URL:', error);
      throw error;
    }
  }

  /**
   * Get available VODs (recorded streams)
   * @param {Object} filters - Filter options
   * @param {number} limit - Maximum number of VODs
   * @returns {Promise<Array>} VOD streams
   */
  static async getVODs(filters = {}, limit = 50) {
    try {
      const { category, hostId, minDuration = 0 } = filters;

      let sql = `
        SELECT * FROM live_streams
        WHERE status = 'ended'
          AND record_stream = true
          AND recording_url IS NOT NULL
      `;
      const params = [];
      let paramCount = 1;

      if (category) {
        sql += ` AND category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }

      if (hostId) {
        sql += ` AND host_id = $${paramCount}`;
        params.push(String(hostId));
        paramCount++;
      }

      if (minDuration > 0) {
        sql += ` AND duration >= $${paramCount}`;
        params.push(minDuration);
        paramCount++;
      }

      sql += ` ORDER BY ended_at DESC LIMIT $${paramCount}`;
      params.push(limit);

      const result = await query(sql, params);

      return result.rows.map(row => this._mapStreamFromDb(row));
    } catch (error) {
      logger.error('Error getting VODs:', error);
      throw error;
    }
  }

  /**
   * Set thumbnail for stream
   * @param {string} streamId - Stream ID
   * @param {string} thumbnailUrl - Thumbnail URL
   * @returns {Promise<void>}
   */
  static async setThumbnail(streamId, thumbnailUrl) {
    try {
      await query(
        `UPDATE live_streams
         SET thumbnail_url = $2,
             updated_at = $3
         WHERE id = $1`,
        [streamId, thumbnailUrl, new Date()]
      );

      logger.info('Thumbnail set for stream', { streamId, thumbnailUrl });
    } catch (error) {
      logger.error('Error setting thumbnail:', error);
      throw error;
    }
  }

  /**
   * Increment share count
   * @param {string} streamId - Stream ID
   * @returns {Promise<void>}
   */
  static async incrementShareCount(streamId) {
    try {
      await this.updateAnalytics(streamId, { shareCount: 1 });
      logger.info('Share count incremented', { streamId });
    } catch (error) {
      logger.error('Error incrementing share count:', error);
      throw error;
    }
  }

  /**
   * Generate shareable link
   * @param {string} streamId - Stream ID
   * @param {string} botUsername - Bot username
   * @returns {string} Shareable deep link
   */
  static generateShareLink(streamId, botUsername) {
    return `https://t.me/${botUsername}?start=stream_${streamId}`;
  }

  /**
   * Notify followers when stream starts
   * @param {string} streamerId - Streamer user ID
   * @param {Object} streamInfo - Stream information
   * @param {Function} sendNotification - Function to send Telegram message
   * @returns {Promise<number>} Number of notifications sent
   */
  static async notifyFollowers(streamerId, streamInfo, sendNotification) {
    try {
      const subscribers = await this.getStreamSubscribers(streamerId);

      let notificationsSent = 0;

      for (const subscriberId of subscribers) {
        try {
          await sendNotification(
            subscriberId,
            `🔴 ${streamInfo.hostName} is now live!\n\n` +
            `🎤 ${streamInfo.title}\n` +
            `${this.getCategoryEmoji(streamInfo.category)} ${streamInfo.category}\n\n` +
            `Tap below to join the stream!`,
            streamInfo.streamId
          );
          notificationsSent++;
        } catch (notifyError) {
          logger.warn('Failed to notify subscriber', { subscriberId, error: notifyError.message });
        }
      }

      logger.info('Followers notified', { streamerId, notificationsSent });
      return notificationsSent;
    } catch (error) {
      logger.error('Error notifying followers:', error);
      throw error;
    }
  }

  /**
   * Get category emoji
   * @param {string} category - Category name
   * @returns {string} Category emoji
   */
  static getCategoryEmoji(category) {
    const emojiMap = {
      music: '🎵',
      gaming: '🎮',
      talk_show: '🎙',
      education: '📚',
      entertainment: '🎭',
      sports: '⚽',
      news: '📰',
      other: '📁',
    };
    return emojiMap[category] || '📁';
  }

  /**
   * Get stream statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active' OR status = 'live') as active,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'ended') as ended,
          COALESCE(SUM(total_views), 0) as total_viewers,
          COALESCE(SUM(likes), 0) as total_likes
        FROM live_streams
      `);

      const row = result.rows[0];

      return {
        total: parseInt(row.total),
        active: parseInt(row.active),
        scheduled: parseInt(row.scheduled),
        ended: parseInt(row.ended),
        totalViewers: parseInt(row.total_viewers),
        totalLikes: parseInt(row.total_likes),
      };
    } catch (error) {
      logger.error('Error getting stream statistics:', error);
      throw error;
    }
  }

  /**
   * Delete stream and related data
   * @param {string} streamId - Stream ID
   * @returns {Promise<void>}
   */
  static async delete(streamId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Delete related records (cascading should handle this, but being explicit)
      await client.query('DELETE FROM stream_viewers WHERE stream_id = $1', [streamId]);
      await client.query('DELETE FROM stream_comments WHERE stream_id = $1', [streamId]);
      await client.query('DELETE FROM stream_banned_users WHERE stream_id = $1', [streamId]);

      // Delete stream
      await client.query('DELETE FROM live_streams WHERE id = $1', [streamId]);

      await client.query('COMMIT');

      logger.info('Stream deleted', { streamId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting stream:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start a stream (update status from scheduled to active/live)
   * @param {string} streamId - Stream ID
   * @param {string} hostId - Host user ID (for verification)
   * @returns {Promise<void>}
   */
  static async startStream(streamId, hostId) {
    try {
      const streamResult = await query(
        'SELECT host_id, status FROM live_streams WHERE id = $1',
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        throw new Error('Stream not found');
      }

      const stream = streamResult.rows[0];

      if (stream.host_id !== String(hostId)) {
        throw new Error('Only the host can start the stream');
      }

      if (stream.status === 'live' || stream.status === 'active') {
        throw new Error('Stream is already live');
      }

      await query(
        `UPDATE live_streams
         SET status = 'live',
             started_at = $2,
             updated_at = $2
         WHERE id = $1`,
        [streamId, new Date()]
      );

      logger.info('Stream started', { streamId, hostId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      logger.error('Error starting stream:', error);
      throw error;
    }
  }

  /**
   * Map database row to stream object (snake_case to camelCase)
   * @param {Object} row - Database row
   * @returns {Object} Mapped stream object
   * @private
   */
  static _mapStreamFromDb(row) {
    return {
      streamId: row.id,
      channelName: row.channel_name,
      hostId: row.host_id,
      hostName: row.host_name,
      title: row.title,
      description: row.description,
      isPaid: row.is_paid,
      price: row.price,
      maxViewers: row.max_viewers,
      scheduledFor: row.scheduled_for,
      category: row.category,
      tags: row.tags || [],
      thumbnailUrl: row.thumbnail_url,
      allowComments: row.allow_comments,
      recordStream: row.record_stream,
      language: row.language,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      duration: row.duration,
      currentViewers: row.current_viewers || 0,
      totalViews: row.total_views || 0,
      peakViewers: row.peak_viewers || 0,
      likes: row.likes || 0,
      totalComments: row.total_comments || 0,
      viewers: row.viewers || [],
      bannedUsers: row.banned_users || [],
      moderators: row.moderators || [],
      tokens: row.tokens || {},
      recordingUrl: row.recording_url,
      analytics: row.analytics || {},
      chatSettings: row.chat_settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to comment object (snake_case to camelCase)
   * @param {Object} row - Database row
   * @returns {Object} Mapped comment object
   * @private
   */
  static _mapCommentFromDb(row) {
    return {
      commentId: row.id,
      streamId: row.stream_id,
      userId: row.user_id,
      userName: row.user_name,
      text: row.text,
      timestamp: row.timestamp,
      likes: row.likes || 0,
      isPinned: row.is_pinned || false,
      isDeleted: row.is_deleted || false,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}

// Export model and constants
module.exports = LiveStreamModel;
module.exports.CATEGORIES = CATEGORIES;
