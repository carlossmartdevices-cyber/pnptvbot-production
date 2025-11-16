/**
 * Live Stream Model
 * Handles live streaming with Agora integration
 */

const { getFirestore } = require('../config/firebase');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const logger = require('../utils/logger');
const redisClient = require('../config/redis');

const COLLECTION = 'live_streams';
const VIEWERS_COLLECTION = 'stream_viewers';
const CACHE_TTL = 30; // 30 seconds for active streams

class LiveStreamModel {
  /**
   * Create a new live stream
   * @param {Object} streamData - Stream data
   * @returns {Promise<Object>} Created stream
   */
  static async create(streamData) {
    try {
      const db = getFirestore();
      const {
        hostId,
        hostName,
        title,
        description = '',
        isPaid = false,
        price = 0,
        maxViewers = 1000,
        scheduledFor = null,
      } = streamData;

      // Validate required fields
      if (!hostId || !hostName || !title) {
        throw new Error('Missing required fields: hostId, hostName, or title');
      }

      // Generate unique stream ID
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate Agora channel name (alphanumeric only)
      const channelName = `live_${streamId.replace(/[^a-zA-Z0-9]/g, '')}`;

      // Generate Agora tokens
      const tokens = this.generateAgoraTokens(channelName, hostId);

      const stream = {
        streamId,
        channelName,
        hostId: String(hostId),
        hostName,
        title,
        description,
        isPaid,
        price: isPaid ? parseFloat(price) : 0,
        maxViewers,
        currentViewers: 0,
        totalViews: 0,
        status: scheduledFor ? 'scheduled' : 'active',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        startedAt: scheduledFor ? null : new Date(),
        endedAt: null,
        thumbnailUrl: null,
        viewers: [],
        likes: 0,
        comments: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection(COLLECTION).doc(streamId).set(stream);

      logger.info('Live stream created', { streamId, hostId, title });

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
   * @param {string} userId - User ID
   * @returns {Object} Tokens for host and viewer
   */
  static generateAgoraTokens(channelName, userId) {
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
      const role = RtcRole.PUBLISHER;
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
        privilegeExpiredTs
      );

      // Viewer token (can only subscribe)
      const viewerToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        RtcRole.SUBSCRIBER,
        privilegeExpiredTs
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
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const db = getFirestore();
      const snapshot = await db
        .collection(COLLECTION)
        .where('status', '==', 'active')
        .orderBy('startedAt', 'desc')
        .limit(limit)
        .get();

      const streams = [];
      snapshot.forEach((doc) => {
        const stream = doc.data();

        // Convert timestamps
        if (stream.startedAt?.toDate) stream.startedAt = stream.startedAt.toDate();
        if (stream.createdAt?.toDate) stream.createdAt = stream.createdAt.toDate();
        if (stream.updatedAt?.toDate) stream.updatedAt = stream.updatedAt.toDate();

        streams.push(stream);
      });

      // Cache for 30 seconds
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(streams));

      return streams;
    } catch (error) {
      logger.error('Error getting active streams:', error);
      throw error;
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
      const isAlreadyViewing = stream.viewers.some(v => v.viewerId === String(viewerId));

      if (!isAlreadyViewing) {
        // Add viewer
        await streamRef.update({
          currentViewers: stream.currentViewers + 1,
          totalViews: stream.totalViews + 1,
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
      await redisClient.del(`active_streams:*`);

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
      const updatedViewers = stream.viewers.filter(v => v.viewerId !== String(viewerId));
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
        await redisClient.del(`active_streams:*`);
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

      await db.collection(COLLECTION).doc(streamId).update({
        status: 'ended',
        endedAt: new Date(),
        updatedAt: new Date(),
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
      await redisClient.del(`active_streams:*`);
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
      await redisClient.del(`active_streams:*`);
    } catch (error) {
      logger.error('Error liking stream:', error);
      throw error;
    }
  }

  /**
   * Add comment to stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @param {string} userName - User name
   * @param {string} text - Comment text
   * @returns {Promise<void>}
   */
  static async addComment(streamId, userId, userName, text) {
    try {
      const db = getFirestore();
      const streamRef = db.collection(COLLECTION).doc(streamId);

      const comment = {
        userId: String(userId),
        userName,
        text,
        timestamp: new Date(),
      };

      await streamRef.update({
        comments: require('firebase-admin').firestore.FieldValue.arrayUnion(comment),
        updatedAt: new Date(),
      });

      logger.info('Comment added to stream', { streamId, userId });
    } catch (error) {
      logger.error('Error adding comment:', error);
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
      await redisClient.del(`active_streams:*`);
    } catch (error) {
      logger.error('Error deleting stream:', error);
      throw error;
    }
  }
}

module.exports = LiveStreamModel;
