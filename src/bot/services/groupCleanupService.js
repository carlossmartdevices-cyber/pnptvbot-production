const logger = require('../../utils/logger');

/**
 * Group Cleanup Service
 */
class GroupCleanupService {
  constructor(bot) {
    this.bot = bot;
    this.messageTracker = new Map();
    this.isEnabled = false;
  }

  /**
   * Initialize the cleanup service
   */
  initialize() {
    // Group cleanup service has been disabled
    logger.info('Group cleanup service is disabled');
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return {
      trackedMessages: 0,
      isEnabled: false,
    };
  }
}

module.exports = GroupCleanupService;
