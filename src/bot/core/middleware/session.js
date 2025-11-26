const { getFirestore, Collections } = require('../../config/firebase');
const logger = require('../../../utils/logger');

/**
 * Simple session middleware using Firestore
 */
class SessionMiddleware {
  constructor() {
    this.db = getFirestore();
    this.sessionsCollection = this.db.collection('sessions');
  }

  /**
   * Get session for user
   */
  async getSession(userId) {
    try {
      const sessionDoc = await this.sessionsCollection.doc(userId.toString()).get();
      if (!sessionDoc.exists) {
        return {};
      }
      return sessionDoc.data();
    } catch (error) {
      logger.error(`Error getting session for user ${userId}:`, error);
      return {};
    }
  }

  /**
   * Update session for user
   */
  async updateSession(userId, data) {
    try {
      await this.sessionsCollection.doc(userId.toString()).set(
        {
          ...data,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (error) {
      logger.error(`Error updating session for user ${userId}:`, error);
    }
  }

  /**
   * Clear session for user
   */
  async clearSession(userId) {
    try {
      await this.sessionsCollection.doc(userId.toString()).delete();
    } catch (error) {
      logger.error(`Error clearing session for user ${userId}:`, error);
    }
  }

  /**
   * Middleware function
   */
  middleware() {
    return async (ctx, next) => {
      const userId = ctx.from?.id;

      if (!userId) {
        return next();
      }

      // Load session
      ctx.session = await this.getSession(userId);

      // Helper to save session
      ctx.saveSession = async (data) => {
        ctx.session = { ...ctx.session, ...data };
        await this.updateSession(userId, ctx.session);
      };

      // Helper to clear session
      ctx.clearSession = async () => {
        ctx.session = {};
        await this.clearSession(userId);
      };

      return next();
    };
  }
}

module.exports = new SessionMiddleware();
