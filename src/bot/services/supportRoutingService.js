const logger = require('../../utils/logger');
const SupportTopicModel = require('../../models/supportTopicModel');

/**
 * Support Routing Service
 * Manages forum topic creation and message routing between users and support group
 */
class SupportRoutingService {
  constructor() {
    this.telegram = null;
    this.supportGroupId = null;
  }

  /**
   * Initialize the service with bot telegram instance
   * @param {Object} telegram - Telegraf telegram instance
   */
  initialize(telegram) {
    this.telegram = telegram;
    this.supportGroupId = process.env.SUPPORT_GROUP_ID;

    if (!this.supportGroupId) {
      logger.warn('SUPPORT_GROUP_ID not configured. Support routing will not work.');
    } else {
      logger.info('Support routing service initialized', { supportGroupId: this.supportGroupId });
    }
  }

  /**
   * Get or create a forum topic for a user in the support group
   * @param {Object} user - Telegram user object (from, id, first_name, username, etc.)
   * @param {string} requestType - Type of request ('support', 'activation', 'escalation')
   * @returns {Promise<Object>} Support topic data with thread_id
   */
  async getOrCreateUserTopic(user, requestType = 'support') {
    if (!this.telegram || !this.supportGroupId) {
      throw new Error('Support routing service not initialized');
    }

    const userId = String(user.id);
    const firstName = user.first_name || 'User';
    const username = user.username ? `@${user.username}` : '';

    // Check if user already has a topic
    let supportTopic = await SupportTopicModel.getByUserId(userId);

    if (supportTopic) {
      // Update last message and reopen if closed
      await SupportTopicModel.updateLastMessage(userId);
      if (supportTopic.status !== 'open') {
        await SupportTopicModel.updateStatus(userId, 'open');
      }
      logger.info('Using existing support topic', { userId, threadId: supportTopic.thread_id });
      return supportTopic;
    }

    // Create new forum topic in support group
    const topicName = `${userId}`;
    const iconColor = this.getIconColor(requestType);

    try {
      // Create forum topic using Telegram API
      const topic = await this.telegram.createForumTopic(
        this.supportGroupId,
        topicName,
        { icon_color: iconColor }
      );

      const threadId = topic.message_thread_id;

      // Save to database
      supportTopic = await SupportTopicModel.create({
        userId,
        threadId,
        threadName: topicName,
      });

      // Send initial info message in the topic
      const infoEmoji = this.getRequestEmoji(requestType);
      const requestLabel = this.getRequestLabel(requestType);
      const infoMessage = `${infoEmoji} *${requestLabel}*

👤 *Usuario:* ${firstName} ${username}
🆔 *User ID:* \`${userId}\`
📅 *Creado:* ${new Date().toLocaleString('es-ES')}

_Responde en este topic para enviar mensajes al usuario._`;

      await this.telegram.sendMessage(this.supportGroupId, infoMessage, {
        message_thread_id: threadId,
        parse_mode: 'Markdown',
      });

      logger.info('Created new support topic', { userId, threadId, topicName });
      return supportTopic;

    } catch (error) {
      // If topic creation fails (e.g., group is not a forum), fall back to regular messages
      logger.error('Failed to create forum topic, using fallback:', error.message);

      // Create entry with pseudo thread_id (timestamp-based)
      const fallbackThreadId = Date.now();
      supportTopic = await SupportTopicModel.create({
        userId,
        threadId: fallbackThreadId,
        threadName: topicName,
      });

      return supportTopic;
    }
  }

  /**
   * Send a user message to their support topic
   * @param {Object} ctx - Telegraf context
   * @param {string} messageType - Type of message ('text', 'photo', 'document', etc.)
   * @param {string} requestType - Type of request ('support', 'activation')
   */
  async forwardUserMessage(ctx, messageType = 'text', requestType = 'support') {
    logger.info('forwardUserMessage called', { messageType, requestType, userId: ctx.from?.id });

    if (!this.telegram || !this.supportGroupId) {
      logger.warn('Support routing not configured');
      return null;
    }

    const user = ctx.from;
    const userId = String(user.id);
    const firstName = user.first_name || 'Unknown';
    const username = user.username ? user.username.replace(/@/g, '\\@') : 'No username';

    try {
      // Get or create user's support topic
      const supportTopic = await this.getOrCreateUserTopic(user, requestType);
      const threadId = supportTopic.thread_id;

      // Build message header
      const requestEmoji = this.getRequestEmoji(requestType);
      const header = `${requestEmoji} *${firstName}* (@${username}):\n\n`;

      // Send based on message type
      if (messageType === 'text' && ctx.message?.text) {
        await this.telegram.sendMessage(
          this.supportGroupId,
          header + ctx.message.text,
          {
            message_thread_id: threadId,
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'photo' && ctx.message?.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await this.telegram.sendPhoto(
          this.supportGroupId,
          photo.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'document' && ctx.message?.document) {
        await this.telegram.sendDocument(
          this.supportGroupId,
          ctx.message.document.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'video' && ctx.message?.video) {
        await this.telegram.sendVideo(
          this.supportGroupId,
          ctx.message.video.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'voice' && ctx.message?.voice) {
        await this.telegram.sendVoice(
          this.supportGroupId,
          ctx.message.voice.file_id,
          {
            message_thread_id: threadId,
            caption: header,
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'sticker' && ctx.message?.sticker) {
        // Send header first, then sticker
        await this.telegram.sendMessage(
          this.supportGroupId,
          header.trim(),
          { message_thread_id: threadId, parse_mode: 'Markdown' }
        );
        await this.telegram.sendSticker(
          this.supportGroupId,
          ctx.message.sticker.file_id,
          { message_thread_id: threadId }
        );
      } else {
        // Forward the original message as fallback
        await this.telegram.forwardMessage(
          this.supportGroupId,
          ctx.chat.id,
          ctx.message.message_id,
          { message_thread_id: threadId }
        );
      }

      // Update message count
      await SupportTopicModel.updateLastMessage(userId);

      logger.info('User message forwarded to support topic', { userId, threadId, messageType });
      return supportTopic;

    } catch (error) {
      logger.error('Failed to forward user message to support:', error);
      throw error;
    }
  }

  /**
   * Send admin reply from support topic to user
   * @param {number} threadId - Forum topic thread ID
   * @param {Object} ctx - Telegraf context with admin message
   * @returns {Promise<boolean>} Success status
   */
  async sendReplyToUser(threadId, ctx) {
    if (!this.telegram) {
      logger.warn('Support routing not initialized');
      return false;
    }

    try {
      // Get user ID from thread ID
      const supportTopic = await SupportTopicModel.getByThreadId(threadId);

      if (!supportTopic) {
        logger.warn('No user found for thread ID:', threadId);
        return false;
      }

      const userId = supportTopic.user_id;
      const adminName = ctx.from.first_name || 'Support';

      // Reply instructions in both languages
      const replyInstructions = `\n\n💡 _Para responder: Mantén presionado este mensaje y selecciona "Responder"._\n💡 _To reply: Tap and hold this message and select "Reply"._`;

      // Determine message type and send accordingly
      const message = ctx.message;

      if (message.text) {
        await this.telegram.sendMessage(
          userId,
          `💬 *${adminName} (Soporte):*\n\n${message.text}${replyInstructions}`,
          { parse_mode: 'Markdown' }
        );
      } else if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        await this.telegram.sendPhoto(
          userId,
          photo.file_id,
          {
            caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
            parse_mode: 'Markdown',
          }
        );
      } else if (message.document) {
        await this.telegram.sendDocument(
          userId,
          message.document.file_id,
          {
            caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
            parse_mode: 'Markdown',
          }
        );
      } else if (message.video) {
        await this.telegram.sendVideo(
          userId,
          message.video.file_id,
          {
            caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
            parse_mode: 'Markdown',
          }
        );
      } else if (message.voice) {
        // Send voice with a text header including instructions
        await this.telegram.sendMessage(
          userId,
          `💬 *${adminName} (Soporte):*${replyInstructions}`,
          { parse_mode: 'Markdown' }
        );
        await this.telegram.sendVoice(userId, message.voice.file_id);
      } else if (message.sticker) {
        await this.telegram.sendMessage(
          userId,
          `💬 *${adminName} (Soporte):*${replyInstructions}`,
          { parse_mode: 'Markdown' }
        );
        await this.telegram.sendSticker(userId, message.sticker.file_id);
      } else if (message.animation) {
        await this.telegram.sendAnimation(
          userId,
          message.animation.file_id,
          {
            caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
            parse_mode: 'Markdown',
          }
        );
      } else {
        // Forward as-is for other types, send instructions separately
        await this.telegram.forwardMessage(userId, ctx.chat.id, message.message_id);
        await this.telegram.sendMessage(userId, replyInstructions.trim(), { parse_mode: 'Markdown' });
      }

      logger.info('Admin reply sent to user', { userId, threadId, adminId: ctx.from.id });
      return true;

    } catch (error) {
      logger.error('Failed to send reply to user:', error);

      // Check if user blocked the bot
      if (error.description?.includes('bot was blocked') ||
          error.description?.includes('user is deactivated') ||
          error.description?.includes('chat not found')) {
        logger.warn('User has blocked the bot or is deactivated');
        // Notify in the topic that the user can't receive messages
        try {
          await this.telegram.sendMessage(
            ctx.chat.id,
            '⚠️ *No se pudo enviar el mensaje*\n\nEl usuario ha bloqueado el bot o su cuenta está desactivada.',
            {
              message_thread_id: threadId,
              parse_mode: 'Markdown',
            }
          );
        } catch (notifyError) {
          logger.error('Failed to send notification in topic:', notifyError);
        }
      }

      return false;
    }
  }

  /**
   * Close a support topic
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async closeUserTopic(userId) {
    try {
      const supportTopic = await SupportTopicModel.getByUserId(userId);

      if (!supportTopic) {
        return false;
      }

      // Update status to closed
      await SupportTopicModel.updateStatus(userId, 'closed');

      // Try to close the forum topic (optional)
      if (this.telegram && this.supportGroupId) {
        try {
          await this.telegram.closeForumTopic(this.supportGroupId, supportTopic.thread_id);
          logger.info('Forum topic closed', { userId, threadId: supportTopic.thread_id });
        } catch (closeError) {
          // Topic might already be closed or doesn't exist
          logger.warn('Could not close forum topic:', closeError.message);
        }
      }

      return true;
    } catch (error) {
      logger.error('Error closing user topic:', error);
      return false;
    }
  }

  /**
   * Get icon color based on request type
   * @param {string} requestType - Type of request
   * @returns {number} Telegram icon color ID
   */
  getIconColor(requestType) {
    const colors = {
      support: 0x6FB9F0,     // Blue
      activation: 0xFFD67E,  // Yellow/Gold
      escalation: 0xFF93B2,  // Pink/Red
      default: 0x8EEE98,     // Green
    };
    return colors[requestType] || colors.default;
  }

  /**
   * Get emoji based on request type
   * @param {string} requestType - Type of request
   * @returns {string} Emoji
   */
  getRequestEmoji(requestType) {
    const emojis = {
      support: '📬',
      activation: '🎁',
      escalation: '🚨',
      default: '💬',
    };
    return emojis[requestType] || emojis.default;
  }

  /**
   * Get label based on request type
   * @param {string} requestType - Type of request
   * @returns {string} Label
   */
  getRequestLabel(requestType) {
    const labels = {
      support: 'SOLICITUD DE SOPORTE',
      activation: 'SOLICITUD DE ACTIVACIÓN',
      escalation: 'AUTO-ESCALACIÓN',
      default: 'NUEVO MENSAJE',
    };
    return labels[requestType] || labels.default;
  }

  /**
   * Send a message directly to the support group (centralized method)
   * @param {string} message - Message text
   * @param {string} requestType - Type of request ('support', 'activation', 'escalation')
   * @param {Object} user - User information
   * @param {string} messageType - Type of message ('text', 'photo', 'document', etc.)
   * @param {Object} ctx - Telegraf context (optional, for media messages)
   * @returns {Promise<Object>} Support topic data
   */
  async sendToSupportGroup(message, requestType, user, messageType = 'text', ctx = null) {
    if (!this.telegram || !this.supportGroupId) {
      logger.warn('Support routing service not initialized');
      throw new Error('Support routing not configured');
    }

    try {
      // Get or create user's support topic
      const supportTopic = await this.getOrCreateUserTopic(user, requestType);
      const threadId = supportTopic.thread_id;

      // Build message header
      const requestEmoji = this.getRequestEmoji(requestType);
      const requestLabel = this.getRequestLabel(requestType);
      const firstName = user.first_name || 'Unknown';
      const username = user.username ? `@${user.username}` : 'No username';

      const header = `${requestEmoji} *${requestLabel}*

👤 *Usuario:* ${firstName} ${username}
🆔 *User ID:* \`${user.id}\`
📅 *Fecha:* ${new Date().toLocaleString('es-ES')}

`;

      // Send based on message type
      if (messageType === 'text') {
        await this.telegram.sendMessage(
          this.supportGroupId,
          header + message,
          {
            message_thread_id: threadId,
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'photo' && ctx?.message?.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await this.telegram.sendPhoto(
          this.supportGroupId,
          photo.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'document' && ctx?.message?.document) {
        await this.telegram.sendDocument(
          this.supportGroupId,
          ctx.message.document.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'video' && ctx?.message?.video) {
        await this.telegram.sendVideo(
          this.supportGroupId,
          ctx.message.video.file_id,
          {
            message_thread_id: threadId,
            caption: header + (ctx.message.caption || ''),
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'voice' && ctx?.message?.voice) {
        await this.telegram.sendVoice(
          this.supportGroupId,
          ctx.message.voice.file_id,
          {
            message_thread_id: threadId,
            caption: header,
            parse_mode: 'Markdown',
          }
        );
      } else if (messageType === 'sticker' && ctx?.message?.sticker) {
        // Send header first, then sticker
        await this.telegram.sendMessage(
          this.supportGroupId,
          header.trim(),
          { message_thread_id: threadId, parse_mode: 'Markdown' }
        );
        await this.telegram.sendSticker(
          this.supportGroupId,
          ctx.message.sticker.file_id,
          { message_thread_id: threadId }
        );
      } else {
        // Fallback to text message
        await this.telegram.sendMessage(
          this.supportGroupId,
          header + message,
          {
            message_thread_id: threadId,
            parse_mode: 'Markdown',
          }
        );
      }

      // Update message count
      await SupportTopicModel.updateLastMessage(user.id);

      logger.info('Message sent to support group', { userId: user.id, threadId, messageType });
      return supportTopic;

    } catch (error) {
      logger.error('Failed to send message to support group:', error);
      throw error;
    }
  }
}

// Export singleton instance
const supportRoutingService = new SupportRoutingService();
module.exports = supportRoutingService;
