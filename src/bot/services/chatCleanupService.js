const logger = require('../../utils/logger');

/**
 * Chat Cleanup Service
 * Automatically deletes bot messages, commands, and system messages after a delay
 */
class ChatCleanupService {
  /**
   * Scheduled deletions map
   * Key: timeout ID
   * Value: { chatId, messageId, type, scheduledAt }
   */
  static scheduledDeletions = new Map();

  /**
   * Cleanup delay in milliseconds (5 minutes)
   */
  static CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes

  /**
   * Schedule a message for deletion
   * @param {Object} telegram - Telegram bot instance
   * @param {number|string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {string} type - Message type ('bot', 'command', 'system')
   * @param {number} delay - Delay in milliseconds (default: 5 minutes)
   * @returns {number} Timeout ID
   */
  static scheduleDelete(telegram, chatId, messageId, type = 'bot', delay = this.CLEANUP_DELAY) {
    if (!telegram || !chatId || !messageId) {
      logger.warn('Invalid parameters for scheduleDelete', { chatId, messageId, type });
      return null;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await telegram.deleteMessage(chatId, messageId);

        logger.debug('Message deleted successfully', {
          chatId,
          messageId,
          type,
          delay: `${delay / 1000}s`,
        });

        // Remove from scheduled deletions
        this.scheduledDeletions.delete(timeoutId);
      } catch (error) {
        // Message might already be deleted or bot doesn't have permission
        if (error.response?.error_code === 400) {
          logger.debug('Message already deleted or not found', { chatId, messageId });
        } else {
          logger.error('Error deleting message:', {
            error: error.message,
            chatId,
            messageId,
            type,
          });
        }

        // Remove from scheduled deletions even if failed
        this.scheduledDeletions.delete(timeoutId);
      }
    }, delay);

    // Track scheduled deletion
    this.scheduledDeletions.set(timeoutId, {
      chatId,
      messageId,
      type,
      scheduledAt: new Date(),
      deleteAt: new Date(Date.now() + delay),
    });

    logger.debug('Message scheduled for deletion', {
      chatId,
      messageId,
      type,
      delay: `${delay / 1000}s`,
      scheduledCount: this.scheduledDeletions.size,
    });

    return timeoutId;
  }

  /**
   * Cancel a scheduled deletion
   * @param {number} timeoutId - Timeout ID
   * @returns {boolean} Success status
   */
  static cancelDelete(timeoutId) {
    if (!timeoutId) return false;

    const deletion = this.scheduledDeletions.get(timeoutId);

    if (deletion) {
      clearTimeout(timeoutId);
      this.scheduledDeletions.delete(timeoutId);

      logger.debug('Scheduled deletion cancelled', {
        chatId: deletion.chatId,
        messageId: deletion.messageId,
      });

      return true;
    }

    return false;
  }

  /**
   * Schedule deletion of a bot reply
   * @param {Object} telegram - Telegram bot instance
   * @param {Object} message - Sent message object
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  static scheduleBotMessage(telegram, message, delay = this.CLEANUP_DELAY) {
    if (!message || !message.chat || !message.message_id) {
      return null;
    }

    return this.scheduleDelete(
      telegram,
      message.chat.id,
      message.message_id,
      'bot',
      delay,
    );
  }

  /**
   * Schedule deletion of a user command
   * @param {Object} ctx - Telegraf context
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  static scheduleCommand(ctx, delay = this.CLEANUP_DELAY) {
    if (!ctx.message || !ctx.chat) {
      return null;
    }

    return this.scheduleDelete(
      ctx.telegram,
      ctx.chat.id,
      ctx.message.message_id,
      'command',
      delay,
    );
  }

  /**
   * Schedule deletion of a system message
   * @param {Object} telegram - Telegram bot instance
   * @param {number|string} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  static scheduleSystemMessage(telegram, chatId, messageId, delay = this.CLEANUP_DELAY) {
    return this.scheduleDelete(telegram, chatId, messageId, 'system', delay);
  }

  /**
   * Get statistics about scheduled deletions
   * @returns {Object} Statistics
   */
  static getStats() {
    const now = Date.now();
    const deletions = Array.from(this.scheduledDeletions.values());

    const stats = {
      total: deletions.length,
      byType: {
        bot: deletions.filter((d) => d.type === 'bot').length,
        command: deletions.filter((d) => d.type === 'command').length,
        system: deletions.filter((d) => d.type === 'system').length,
      },
      upcoming: {
        next1min: deletions.filter((d) => d.deleteAt - now < 60000).length,
        next5min: deletions.filter((d) => d.deleteAt - now < 300000).length,
      },
    };

    return stats;
  }

  /**
   * Clear all scheduled deletions
   * @returns {number} Number of deletions cancelled
   */
  static clearAll() {
    const count = this.scheduledDeletions.size;

    for (const timeoutId of this.scheduledDeletions.keys()) {
      clearTimeout(timeoutId);
    }

    this.scheduledDeletions.clear();

    logger.info(`Cleared ${count} scheduled deletions`);
    return count;
  }

  /**
   * Cleanup old scheduled deletions (housekeeping)
   * Removes completed deletions from the map
   */
  static cleanup() {
    const before = this.scheduledDeletions.size;
    const now = Date.now();

    // Remove deletions that should have already happened
    for (const [timeoutId, deletion] of this.scheduledDeletions.entries()) {
      if (deletion.deleteAt < now - 60000) { // 1 minute grace period
        this.scheduledDeletions.delete(timeoutId);
      }
    }

    const after = this.scheduledDeletions.size;

    if (before !== after) {
      logger.debug(`Cleanup: removed ${before - after} old scheduled deletions`);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(() => {
  ChatCleanupService.cleanup();
}, 10 * 60 * 1000);

module.exports = ChatCleanupService;
