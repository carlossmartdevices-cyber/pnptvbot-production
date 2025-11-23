const logger = require('../../utils/logger');
const TopicConfigModel = require('../../models/topicConfigModel');

/**
 * Topic Permissions Middleware
 * Enforces topic-specific posting permissions and content rules
 */
async function topicPermissionsMiddleware(ctx, next) {
  const messageThreadId = ctx.message?.message_thread_id;

  // Skip if not in a topic
  if (!messageThreadId) {
    return next();
  }

  // Skip if message is from bot
  if (ctx.from?.is_bot) {
    return next();
  }

  try {
    // Get topic configuration
    const topicConfig = await TopicConfigModel.getByThreadId(messageThreadId);

    if (!topicConfig) {
      return next(); // No specific config, allow
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const message = ctx.message;

    // Check if user is admin
    const member = await ctx.telegram.getChatMember(chatId, userId);
    const isAdmin = ['creator', 'administrator'].includes(member.status);

    // ===================================
    // ADMIN-ONLY POSTING (PNPtv News!)
    // ===================================
    if (topicConfig.can_post === 'admin_only') {
      // Allow admins to post freely
      if (isAdmin) {
        // Auto-pin if configured
        if (topicConfig.auto_pin_admin_messages && !message.reply_to_message) {
          try {
            await ctx.pinChatMessage(message.message_id, {
              disable_notification: false
            });

            // Schedule unpin after duration
            if (topicConfig.auto_pin_duration > 0) {
              setTimeout(async () => {
                try {
                  await ctx.unpinChatMessage(message.message_id);
                } catch (error) {
                  logger.debug('Could not unpin message:', error.message);
                }
              }, topicConfig.auto_pin_duration * 1000);
            }
          } catch (error) {
            logger.warn('Could not pin message:', error.message);
          }
        }

        // Notify all members if configured
        if (topicConfig.notify_all_on_new_post && !message.reply_to_message) {
          // Telegram doesn't have a direct "notify all" API
          // We rely on pinning to create a notification
          logger.debug('Notification via pin for topic:', messageThreadId);
        }

        return next();
      }

      // Non-admins: Check if it's a reply
      const isReply = !!message.reply_to_message;

      if (topicConfig.allow_replies && isReply) {
        // Allow replies
        return next();
      }

      // Block non-admin, non-reply posts
      await ctx.deleteMessage();

      const lang = ctx.from.language_code === 'es' ? 'es' : 'en';
      const warning = lang === 'es'
        ? `⚠️ **${topicConfig.topic_name}** es solo para publicaciones de administradores.\n\n✅ Puedes responder a las publicaciones existentes.`
        : `⚠️ **${topicConfig.topic_name}** is for admin posts only.\n\n✅ You can reply to existing posts.`;

      try {
        await ctx.telegram.sendMessage(userId, warning, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        // User blocked bot, ignore
      }

      await TopicConfigModel.trackViolation(userId, messageThreadId, 'non_admin_post');
      return; // Stop processing
    }

    // ===================================
    // APPROVAL REQUIRED (Podcasts/Thoughts)
    // ===================================
    if (topicConfig.can_post === 'approval_required' && !isAdmin) {
      // Non-admin posts need approval
      const isReply = !!message.reply_to_message;

      // Allow replies without approval
      if (topicConfig.allow_replies && isReply) {
        return next();
      }

      // Queue message for approval
      await handleApprovalQueue(ctx, topicConfig, message);
      return; // Stop processing
    }

    // Continue to next middleware
    return next();

  } catch (error) {
    logger.error('Error in topic permissions middleware:', error);
    return next(); // Continue on error to avoid breaking bot
  }
}

/**
 * Handle approval queue for user posts
 */
async function handleApprovalQueue(ctx, topicConfig, message) {
  const lang = ctx.from.language_code === 'es' ? 'es' : 'en';

  try {
    // Delete the original message
    const originalMessageId = message.message_id;
    await ctx.deleteMessage();

    // Get admin user IDs
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || [];

    if (adminIds.length === 0) {
      logger.error('No admin users configured for approval queue');
      return;
    }

    // Send message to admins for approval
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const messageText = message.text || message.caption || '[Media content]';

    const approvalRequest = lang === 'es'
      ? `🔔 **Solicitud de Publicación en ${topicConfig.topic_name}**\n\n`
        + `👤 Usuario: ${username}\n`
        + `🆔 ID: ${ctx.from.id}\n\n`
        + `📝 **Contenido:**\n${messageText}\n\n`
        + `¿Aprobar esta publicación?`
      : `🔔 **Post Approval Request for ${topicConfig.topic_name}**\n\n`
        + `👤 User: ${username}\n`
        + `🆔 ID: ${ctx.from.id}\n\n`
        + `📝 **Content:**\n${messageText}\n\n`
        + `Approve this post?`;

    // Create approval buttons
    const { Markup } = require('telegraf');
    const approvalData = {
      userId: ctx.from.id,
      topicId: topicConfig.topic_id,
      groupId: topicConfig.group_id,
      messageText,
      messageType: message.text ? 'text' : message.photo ? 'photo' : message.video ? 'video' : 'other',
      mediaFileId: message.photo?.[message.photo.length - 1]?.file_id || message.video?.file_id || null
    };

    // Store approval data temporarily (would need a proper queue table in production)
    const approvalKey = `approval_${Date.now()}_${ctx.from.id}`;

    for (const adminId of adminIds) {
      try {
        await ctx.telegram.sendMessage(
          adminId.trim(),
          approvalRequest,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Approve', `approve_post:${approvalKey}`),
                Markup.button.callback('❌ Reject', `reject_post:${approvalKey}`)
              ]
            ])
          }
        );
      } catch (error) {
        logger.error('Error sending approval request to admin:', error);
      }
    }

    // Store approval data in session or database
    // For now, we'll use a simple in-memory store (should be Redis or DB in production)
    global.approvalQueue = global.approvalQueue || new Map();
    global.approvalQueue.set(approvalKey, approvalData);

    // Notify user
    const userNotification = lang === 'es'
      ? `📤 Tu publicación en **${topicConfig.topic_name}** ha sido enviada para aprobación.\n\n`
        + `⏳ Un administrador la revisará pronto.\n`
        + `📧 Recibirás una notificación cuando sea aprobada o rechazada.`
      : `📤 Your post to **${topicConfig.topic_name}** has been submitted for approval.\n\n`
        + `⏳ An admin will review it soon.\n`
        + `📧 You'll be notified when it's approved or rejected.`;

    await ctx.reply(userNotification, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error handling approval queue:', error);
  }
}

/**
 * Handle approval/rejection callbacks
 */
function registerApprovalHandlers(bot) {
  // Approve post
  bot.action(/^approve_post:(.+)$/, async (ctx) => {
    const approvalKey = ctx.match[1];
    const approvalQueue = global.approvalQueue || new Map();
    const approvalData = approvalQueue.get(approvalKey);

    if (!approvalData) {
      await ctx.answerCbQuery('❌ Approval request expired or already processed.');
      return;
    }

    try {
      // Post the approved message to the topic
      if (approvalData.messageType === 'photo' && approvalData.mediaFileId) {
        await ctx.telegram.sendPhoto(
          approvalData.groupId,
          approvalData.mediaFileId,
          {
            caption: approvalData.messageText,
            message_thread_id: approvalData.topicId
          }
        );
      } else if (approvalData.messageType === 'video' && approvalData.mediaFileId) {
        await ctx.telegram.sendVideo(
          approvalData.groupId,
          approvalData.mediaFileId,
          {
            caption: approvalData.messageText,
            message_thread_id: approvalData.topicId
          }
        );
      } else {
        await ctx.telegram.sendMessage(
          approvalData.groupId,
          approvalData.messageText,
          {
            message_thread_id: approvalData.topicId
          }
        );
      }

      // Notify user
      await ctx.telegram.sendMessage(
        approvalData.userId,
        '✅ Your post has been approved and published!'
      );

      // Update admin's message
      await ctx.editMessageText(
        `✅ **POST APPROVED**\n\n${ctx.callbackQuery.message.text}\n\n_Approved by ${ctx.from.first_name}_`,
        { parse_mode: 'Markdown' }
      );

      // Remove from queue
      approvalQueue.delete(approvalKey);

      await ctx.answerCbQuery('✅ Post approved and published!');

    } catch (error) {
      logger.error('Error approving post:', error);
      await ctx.answerCbQuery('❌ Error approving post.');
    }
  });

  // Reject post
  bot.action(/^reject_post:(.+)$/, async (ctx) => {
    const approvalKey = ctx.match[1];
    const approvalQueue = global.approvalQueue || new Map();
    const approvalData = approvalQueue.get(approvalKey);

    if (!approvalData) {
      await ctx.answerCbQuery('❌ Approval request expired or already processed.');
      return;
    }

    try {
      // Notify user
      await ctx.telegram.sendMessage(
        approvalData.userId,
        '❌ Your post was not approved.\n\nPlease ensure your content follows community guidelines.'
      );

      // Update admin's message
      await ctx.editMessageText(
        `❌ **POST REJECTED**\n\n${ctx.callbackQuery.message.text}\n\n_Rejected by ${ctx.from.first_name}_`,
        { parse_mode: 'Markdown' }
      );

      // Remove from queue
      approvalQueue.delete(approvalKey);

      await ctx.answerCbQuery('❌ Post rejected.');

    } catch (error) {
      logger.error('Error rejecting post:', error);
      await ctx.answerCbQuery('❌ Error rejecting post.');
    }
  });
}

module.exports = {
  topicPermissionsMiddleware,
  registerApprovalHandlers
};
