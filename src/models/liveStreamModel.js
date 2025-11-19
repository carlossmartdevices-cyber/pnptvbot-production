/**
 * Live Stream Model
 * Handles live streaming with Agora integration
 */

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { query } = require('../config/postgres');
const logger = require('../utils/logger');
const { cache, getRedis } = require('../config/redis');

const COLLECTION = 'live_streams';
const VIEWERS_COLLECTION = 'stream_viewers';
const COMMENTS_COLLECTION = 'stream_comments';
const NOTIFICATIONS_COLLECTION = 'stream_notifications';
const BANNED_USERS_COLLECTION = 'stream_banned_users';
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
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const channelName = `live_${streamId.replace(/[^a-zA-Z0-9]/g, '')}`;
      const tokens = this.generateAgoraTokens(channelName, hostId);
      const stream = {
        streamId,
        channelName,
        hostId: String(hostId),
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
        createdAt: new Date(),
        updatedAt: new Date(),
        tokens,
      };
      await query(`INSERT INTO live_streams (id, channel_name, host_id, host_name, title, description, is_paid, price, max_viewers, scheduled_for, category, tags, thumbnail_url, allow_comments, record_stream, language, created_at, updated_at, tokens) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [streamId, channelName, hostId, hostName, title, description, isPaid, price, maxViewers, scheduledFor, category, JSON.stringify(tags), thumbnailUrl, allowComments, recordStream, language, stream.createdAt, stream.updatedAt, JSON.stringify(tokens)]);
      static async update(streamId, updates) {
        try {
          const fields = Object.keys(updates);
          const values = Object.values(updates);
          const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
          values.push(new Date());
          await query(`UPDATE live_streams SET ${setClause}, updated_at = $${fields.length + 1} WHERE id = $${fields.length + 2}`, [...values, streamId]);
          logger.info('Live stream updated', { streamId, updates });
          return true;
        } catch (error) {
          logger.error('Error updating live stream:', error);
          return false;
        }
      }
          totalWatchTime: 0,
          engagementRate: 0,
          shareCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection(COLLECTION).doc(streamId).set(stream);

      logger.info('Live stream created', { streamId, hostId, title, category });

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
      const _role = RtcRole.PUBLISHER; // Reserved for future use
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
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(streamId).get();

      if (!doc.exists) {
        return null;
      }

      const stream = doc.data();

      // Convert Firestore timestamps
      if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
      if (stream.endedAt?.toDate) stream.endedAt = stream.endedAt.toDate();
      if (stream.scheduledFor?.toDate) stream.scheduledFor = stream.scheduledFor.toDate();
      if (stream.createdAt?.toDate) stream.createdAt = stream.createdAt.toDate();
      if (stream.updatedAt?.toDate) stream.updatedAt = stream.updatedAt.toDate();

      return stream;
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
         WHERE status = 'live'
         ORDER BY started_at DESC
         LIMIT $1`,
        [limit]
      );

      const streams = result.rows.map(stream => ({
        id: stream.id,
        hostId: stream.host_id,
        title: stream.title,
        description: stream.description,
        category: stream.category,
        streamUrl: stream.stream_url,
        thumbnailUrl: stream.thumbnail_url,
        status: stream.status,
        isPublic: stream.is_public,
        scheduledAt: stream.scheduled_at,
        startedAt: stream.started_at,
        endedAt: stream.ended_at,
        viewersCount: stream.viewers_count,
        maxViewers: stream.max_viewers,
        createdAt: stream.created_at,
        updatedAt: stream.updated_at,
      }));

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
      const db = getFirestore();
      const snapshot = await db
        .collection(COLLECTION)
        .where('hostId', '==', String(hostId))
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const streams = [];
      snapshot.forEach((doc) => {
        const stream = doc.data();

        // Convert timestamps
        if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
        if (stream.endedAt?.toDate) stream.endedAt = stream.endedAt.toDate();
        if (stream.scheduledFor?.toDate) stream.scheduledFor = stream.scheduledFor.toDate();
        if (stream.createdAt?.toDate) stream.createdAt = stream.createdAt.toDate();
        if (stream.updatedAt?.toDate) stream.updatedAt = stream.updatedAt.toDate();

        streams.push(stream);
      });

      return streams;
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
    try {
      const db = getFirestore();
      const streamRef = db.collection(COLLECTION).doc(streamId);
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status !== 'active') {
        throw new Error('Stream is not active');
      }

      // Check if stream has reached max viewers
      if (stream.maxViewers && stream.currentViewers >= stream.maxViewers) {
        throw new Error('Stream has reached maximum viewers');
      }

      // Check if viewer is already in stream
      const isAlreadyViewing = stream.viewers.some((v) => v.viewerId === String(viewerId));

      if (!isAlreadyViewing) {
        const newViewerCount = stream.currentViewers + 1;

        // Add viewer and update peak viewers if necessary
        await streamRef.update({
          currentViewers: newViewerCount,
          totalViews: stream.totalViews + 1,
          peakViewers: Math.max(stream.peakViewers || 0, newViewerCount),
          viewers: [
            ...stream.viewers,
            {
              viewerId: String(viewerId),
              viewerName,
              joinedAt: new Date(),
            },
          ],
          updatedAt: new Date(),
        });

        // Track viewer in separate collection for analytics
        await db.collection(VIEWERS_COLLECTION).add({
          streamId,
          viewerId: String(viewerId),
          viewerName,
          joinedAt: new Date(),
          leftAt: null,
        });
      }

      // Generate viewer token
      const tokens = this.generateAgoraTokens(stream.channelName, viewerId);

      logger.info('User joined stream', { streamId, viewerId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');

      return {
        stream,
        viewerToken: tokens.viewerToken,
      };
    } catch (error) {
      logger.error('Error joining stream:', error);
      throw error;
    }
  }

  /**
   * Leave a stream
   * @param {string} streamId - Stream ID
   * @param {string} viewerId - Viewer user ID
   * @returns {Promise<void>}
   */
  static async leaveStream(streamId, viewerId) {
    try {
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        return;
      }

      // Remove viewer from active viewers list
      const updatedViewers = stream.viewers.filter((v) => v.viewerId !== String(viewerId));
      const viewerLeft = stream.viewers.length > updatedViewers.length;

      if (viewerLeft) {
        await db.collection(COLLECTION).doc(streamId).update({
          currentViewers: Math.max(0, stream.currentViewers - 1),
          viewers: updatedViewers,
          updatedAt: new Date(),
        });

        // Update viewer record
        const viewerSnapshot = await db
          .collection(VIEWERS_COLLECTION)
          .where('streamId', '==', streamId)
          .where('viewerId', '==', String(viewerId))
          .where('leftAt', '==', null)
          .limit(1)
          .get();

        if (!viewerSnapshot.empty) {
          await viewerSnapshot.docs[0].ref.update({
            leftAt: new Date(),
          });
        }

        logger.info('User left stream', { streamId, viewerId });

        // Invalidate cache
        await cache.delPattern('active_streams:*');
      }
    } catch (error) {
      logger.error('Error leaving stream:', error);
      throw error;
    }
  }

  /**
   * End a stream
   * @param {string} streamId - Stream ID
   * @param {string} hostId - Host user ID (for verification)
   * @returns {Promise<void>}
   */
  static async endStream(streamId, hostId) {
    try {
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.hostId !== String(hostId)) {
        throw new Error('Only the host can end the stream');
      }

      if (stream.status === 'ended') {
        throw new Error('Stream already ended');
      }

      // Calculate stream duration in minutes
      const endTime = new Date();
      const startTime = stream.startedAt;
      const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));

      await db.collection(COLLECTION).doc(streamId).update({
        status: 'ended',
        endedAt: endTime,
        duration: durationMinutes,
        updatedAt: endTime,
      });

      // Update all active viewers
      const activeViewersSnapshot = await db
        .collection(VIEWERS_COLLECTION)
        .where('streamId', '==', streamId)
        .where('leftAt', '==', null)
        .get();

      const batch = db.batch();
      activeViewersSnapshot.forEach((doc) => {
        batch.update(doc.ref, { leftAt: new Date() });
      });
      await batch.commit();

      logger.info('Stream ended', { streamId, hostId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      logger.error('Error ending stream:', error);
      throw error;
    }
  }

  /**
   * Like a stream
   * @param {string} streamId - Stream ID
   * @returns {Promise<void>}
   */
  static async likeStream(streamId) {
    try {
      const db = getFirestore();
      const streamRef = db.collection(COLLECTION).doc(streamId);

      await streamRef.update({
        likes: require('firebase-admin').firestore.FieldValue.increment(1),
        updatedAt: new Date(),
      });

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
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      // Check if comments are allowed
      if (!stream.allowComments) {
        throw new Error('Comments are disabled for this stream');
      }

      // Check if user is banned
      if (stream.bannedUsers && stream.bannedUsers.includes(String(userId))) {
        throw new Error('You are banned from commenting on this stream');
      }

      // Check slow mode
      if (stream.chatSettings?.slowMode) {
        const recentComment = await db
          .collection(COMMENTS_COLLECTION)
          .where('streamId', '==', streamId)
          .where('userId', '==', String(userId))
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!recentComment.empty) {
          const lastComment = recentComment.docs[0].data();
          const timeSinceLastComment = (Date.now() - lastComment.timestamp.toDate().getTime()) / 1000;

          if (timeSinceLastComment < stream.chatSettings.slowModeDelay) {
            throw new Error(`Please wait ${Math.ceil(stream.chatSettings.slowModeDelay - timeSinceLastComment)} seconds before commenting again`);
          }
        }
      }

      // Create comment document
      const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const comment = {
        commentId,
        streamId,
        userId: String(userId),
        userName,
        text,
        timestamp: new Date(),
        likes: 0,
        isPinned: false,
        isDeleted: false,
      };

      await db.collection(COMMENTS_COLLECTION).doc(commentId).set(comment);

      // Update stream comment count
      await db.collection(COLLECTION).doc(streamId).update({
        totalComments: require('firebase-admin').firestore.FieldValue.increment(1),
        updatedAt: new Date(),
      });

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
      const db = getFirestore();
      let query = db
        .collection(COMMENTS_COLLECTION)
        .where('streamId', '==', streamId)
        .where('isDeleted', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (beforeTimestamp) {
        query = query.where('timestamp', '<', beforeTimestamp);
      }

      const snapshot = await query.get();
      const comments = [];

      snapshot.forEach((doc) => {
        const comment = doc.data();
        if (comment.timestamp?.toDate) {
          comment.timestamp = comment.timestamp.toDate();
        }
        comments.push(comment);
      });

      return comments.reverse(); // Return in chronological order
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
      const db = getFirestore();
      const commentDoc = await db.collection(COMMENTS_COLLECTION).doc(commentId).get();

      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }

      const comment = commentDoc.data();
      const stream = await this.getById(comment.streamId);

      // Check if requester is comment owner, host, or moderator
      const isOwner = comment.userId === String(requesterId);
      const isModerator = stream.moderators && stream.moderators.includes(String(requesterId));

      if (!isOwner && !isModerator) {
        throw new Error('Unauthorized to delete this comment');
      }

      // Soft delete
      await commentDoc.ref.update({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: String(requesterId),
      });

      logger.info('Comment deleted', { commentId, streamId: comment.streamId, deletedBy: requesterId });
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
   * @returns {Promise<void>}
   */
  static async banUser(streamId, userId, moderatorId) {
    try {
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      // Check if requester is host or moderator
      const isModerator = stream.moderators && stream.moderators.includes(String(moderatorId));
      if (!isModerator) {
        throw new Error('Unauthorized to ban users');
      }

      // Add to banned users
      await db.collection(COLLECTION).doc(streamId).update({
        bannedUsers: require('firebase-admin').firestore.FieldValue.arrayUnion(String(userId)),
        updatedAt: new Date(),
      });

      // Record the ban
      await db.collection(BANNED_USERS_COLLECTION).add({
        streamId,
        userId: String(userId),
        bannedBy: String(moderatorId),
        bannedAt: new Date(),
      });

      // Remove user from stream if currently viewing
      await this.leaveStream(streamId, userId);

      logger.info('User banned from stream', { streamId, userId, bannedBy: moderatorId });
    } catch (error) {
      logger.error('Error banning user:', error);
      throw error;
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
    try {
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      // Check if requester is host or moderator
      const isModerator = stream.moderators && stream.moderators.includes(String(moderatorId));
      if (!isModerator) {
        throw new Error('Unauthorized to unban users');
      }

      // Remove from banned users
      await db.collection(COLLECTION).doc(streamId).update({
        bannedUsers: require('firebase-admin').firestore.FieldValue.arrayRemove(String(userId)),
        updatedAt: new Date(),
      });

      logger.info('User unbanned from stream', { streamId, userId, unbannedBy: moderatorId });
    } catch (error) {
      logger.error('Error unbanning user:', error);
      throw error;
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
      const db = getFirestore();
      const snapshot = await db
        .collection(COLLECTION)
        .where('status', '==', 'active')
        .where('category', '==', category)
        .orderBy('currentViewers', 'desc')
        .limit(limit)
        .get();

      const streams = [];
      snapshot.forEach((doc) => {
        const stream = doc.data();
        if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
        streams.push(stream);
      });

      return streams;
    } catch (error) {
      logger.error('Error getting streams by category:', error);
      throw error;
    }
  }

  /**
   * Search streams by title or tags
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching streams
   */
  static async searchStreams(query, limit = 20) {
    try {
      const db = getFirestore();
      const searchQuery = query.toLowerCase();

      // Get all active streams (Firestore doesn't support full-text search natively)
      const snapshot = await db
        .collection(COLLECTION)
        .where('status', '==', 'active')
        .limit(100)
        .get();

      const streams = [];
      snapshot.forEach((doc) => {
        const stream = doc.data();
        const titleMatch = stream.title.toLowerCase().includes(searchQuery);
        const tagMatch = stream.tags && stream.tags.some(tag => tag.toLowerCase().includes(searchQuery));
        const descMatch = stream.description && stream.description.toLowerCase().includes(searchQuery);

        if (titleMatch || tagMatch || descMatch) {
          if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
          streams.push(stream);
        }
      });

      // Sort by relevance (viewers count) and limit
      return streams
        .sort((a, b) => b.currentViewers - a.currentViewers)
        .slice(0, limit);
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
      const db = getFirestore();

      await db.collection(NOTIFICATIONS_COLLECTION).add({
        userId: String(userId),
        streamerId: String(streamerId),
        subscribedAt: new Date(),
        notificationsEnabled: true,
      });

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
      const db = getFirestore();
      const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where('streamerId', '==', String(streamerId))
        .where('notificationsEnabled', '==', true)
        .get();

      const subscribers = [];
      snapshot.forEach((doc) => {
        subscribers.push(doc.data().userId);
      });

      return subscribers;
    } catch (error) {
      logger.error('Error getting stream subscribers:', error);
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
      const db = getFirestore();
      const updateData = {};

      if (analytics.shareCount !== undefined) {
        // TODO: Implement analytics increment using PostgreSQL
      }

      if (analytics.avgWatchTime !== undefined) {
        updateData['analytics.avgWatchTime'] = analytics.avgWatchTime;
      }

      if (analytics.totalWatchTime !== undefined) {
        updateData['analytics.totalWatchTime'] = analytics.totalWatchTime;
      }

      if (analytics.engagementRate !== undefined) {
        updateData['analytics.engagementRate'] = analytics.engagementRate;
      }

      updateData.updatedAt = new Date();

      await db.collection(COLLECTION).doc(streamId).update(updateData);

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
      const db = getFirestore();
      const stream = await this.getById(streamId);

      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.hostId !== String(hostId)) {
        throw new Error('Only the host can update chat settings');
      }

      const updateData = { updatedAt: new Date() };

      if (settings.slowMode !== undefined) {
        updateData['chatSettings.slowMode'] = settings.slowMode;
      }

      if (settings.slowModeDelay !== undefined) {
        updateData['chatSettings.slowModeDelay'] = settings.slowModeDelay;
      }

      if (settings.subscribersOnly !== undefined) {
        updateData['chatSettings.subscribersOnly'] = settings.subscribersOnly;
      }

      if (settings.allowComments !== undefined) {
        updateData.allowComments = settings.allowComments;
      }

      await db.collection(COLLECTION).doc(streamId).update(updateData);

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
      const db = getFirestore();

      await db.collection(COLLECTION).doc(streamId).update({
        recordingUrl,
        updatedAt: new Date(),
      });

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
      const db = getFirestore();
      const { category, hostId, minDuration = 0 } = filters;

      let query = db
        .collection(COLLECTION)
        .where('status', '==', 'ended')
        .where('recordStream', '==', true)
        .orderBy('endedAt', 'desc')
        .limit(limit);

      if (category) {
        query = query.where('category', '==', category);
      }

      if (hostId) {
        query = query.where('hostId', '==', String(hostId));
      }

      const snapshot = await query.get();
      const vods = [];

      snapshot.forEach((doc) => {
        const stream = doc.data();

        // Filter by minimum duration if specified
        if (minDuration && stream.duration < minDuration) {
          return;
        }

        // Only include streams with recording URL
        if (stream.recordingUrl) {
          if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
          if (stream.endedAt?.toDate) stream.endedAt = stream.endedAt.toDate();
          vods.push(stream);
        }
      });

      return vods;
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
      const db = getFirestore();

      await db.collection(COLLECTION).doc(streamId).update({
        thumbnailUrl,
        updatedAt: new Date(),
      });

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
   * Check if user is subscribed to streamer
   * @param {string} userId - User ID
   * @param {string} streamerId - Streamer ID
   * @returns {Promise<boolean>} True if subscribed
   */
  static async isSubscribedToStreamer(userId, streamerId) {
    try {
      const db = getFirestore();
      const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where('userId', '==', String(userId))
        .where('streamerId', '==', String(streamerId))
        .where('notificationsEnabled', '==', true)
        .limit(1)
        .get();

      return !snapshot.empty;
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
      const db = getFirestore();

      const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where('userId', '==', String(userId))
        .where('streamerId', '==', String(streamerId))
        .get();

      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { notificationsEnabled: false });
      });
      await batch.commit();

      logger.info('User unsubscribed from streamer', { userId, streamerId });
    } catch (error) {
      logger.error('Error unsubscribing from streamer:', error);
      throw error;
    }
  }

  /**
   * Get stream statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics() {
    try {
      const db = getFirestore();

      // Get all streams
      const snapshot = await db.collection(COLLECTION).get();

      const stats = {
        total: snapshot.size,
        active: 0,
        scheduled: 0,
        ended: 0,
        totalViewers: 0,
        totalLikes: 0,
      };

      snapshot.forEach((doc) => {
        const stream = doc.data();

        if (stream.status === 'active') stats.active++;
        else if (stream.status === 'scheduled') stats.scheduled++;
        else if (stream.status === 'ended') stats.ended++;

        stats.totalViewers += stream.totalViews || 0;
        stats.totalLikes += stream.likes || 0;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting stream statistics:', error);
      throw error;
    }
  }

  /**
   * Delete stream
   * @param {string} streamId - Stream ID
   * @returns {Promise<void>}
   */
  static async delete(streamId) {
    try {
      const db = getFirestore();

      // Delete stream
      await db.collection(COLLECTION).doc(streamId).delete();

      // Delete viewer records
      const viewersSnapshot = await db
        .collection(VIEWERS_COLLECTION)
        .where('streamId', '==', streamId)
        .get();

      const batch = db.batch();
      viewersSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      logger.info('Stream deleted', { streamId });

      // Invalidate cache
      await cache.delPattern('active_streams:*');
    } catch (error) {
      logger.error('Error deleting stream:', error);
      throw error;
    }
  }
}

// Export model and constants
module.exports = LiveStreamModel;
module.exports.CATEGORIES = CATEGORIES;
