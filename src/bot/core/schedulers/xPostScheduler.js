const logger = require('../../../utils/logger');
const XPostService = require('../../services/xPostService');

class XPostScheduler {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('X post scheduler already running');
      return;
    }

    this.isRunning = true;
    this.interval = setInterval(() => this.processQueue(), 60 * 1000);
    logger.info('X post scheduler started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      logger.info('X post scheduler stopped');
    }
  }

  async processQueue() {
    try {
      const pendingPosts = await XPostService.getPendingPosts();
      if (!pendingPosts.length) {
        return;
      }

      for (const post of pendingPosts) {
        try {
          await XPostService.updatePostJob(post.post_id, { status: 'sending' });
          await XPostService.publishScheduledPost(post);
        } catch (error) {
          logger.error('Failed to publish scheduled X post', {
            postId: post.post_id,
            error: error.message,
          });

          await XPostService.updatePostJob(post.post_id, {
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Error processing X post queue:', error);
    }
  }
}

module.exports = XPostScheduler;
