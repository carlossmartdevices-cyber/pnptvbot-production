const logger = require('../../../utils/logger');
const TopicConfigModel = require('../../../models/topicConfigModel');
const { getRedis } = require('../../../config/redis');
const UserModel = require('../../../models/userModel');

/**
 * Topic Permissions Middleware
 * Enforces topic-specific posting permissions and content rules
 */
function topicPermissionsMiddleware() {
  return async (ctx, next) => {
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
    const lang = ctx.from.language_code === 'es' ? 'es' : 'en';

    // Check if user is admin
    const member = await ctx.telegram.getChatMember(chatId, userId);
    const isAdmin = ['creator', 'administrator'].includes(member.status);

    // ===================================
    // COMMAND BLOCKING
    // ===================================
    if (!topicConfig.allow_commands && message.text?.startsWith('/')) {
      // Allow admins to use commands
      if (!isAdmin) {
        await ctx.deleteMessage();
        const warning = lang === 'es'
          ? `⚠️ Los comandos no están permitidos en **${topicConfig.topic_name}**.`
          : `⚠️ Commands are not allowed in **${topicConfig.topic_name}**.`;
        try {
          await ctx.telegram.sendMessage(userId, warning, { parse_mode: 'Markdown' });
        } catch (error) { /* User blocked bot */ }
        await TopicConfigModel.trackViolation(userId, messageThreadId, 'command_in_restricted_topic');
        return;
      }
    }

    // ===================================
    // REQUIRED ROLE/SUBSCRIPTION CHECK
    // ===================================
    if (!isAdmin && (topicConfig.required_role !== 'user' || topicConfig.required_subscription !== 'free')) {
      const hasAccess = await checkUserAccess(userId, topicConfig);
      if (!hasAccess) {
        await ctx.deleteMessage();
        const warning = lang === 'es'
          ? `🔒 No tienes acceso a **${topicConfig.topic_name}**.\n\n`
            + `Requiere: ${topicConfig.required_subscription !== 'free' ? `Suscripción ${topicConfig.required_subscription}` : `Rol ${topicConfig.required_role}`}`
          : `🔒 You don't have access to **${topicConfig.topic_name}**.\n\n`
            + `Requires: ${topicConfig.required_subscription !== 'free' ? `${topicConfig.required_subscription} subscription` : `${topicConfig.required_role} role`}`;
        try {
          await ctx.telegram.sendMessage(userId, warning, { parse_mode: 'Markdown' });
        } catch (error) { /* User blocked bot */ }
        await TopicConfigModel.trackViolation(userId, messageThreadId, 'insufficient_access');
        return;
      }
    }

    // ===================================
    // RATE LIMITING PER TOPIC
    // ===================================
    if (!isAdmin) {
      const rateLimited = await checkRateLimit(userId, messageThreadId, topicConfig, message);
      if (rateLimited) {
        await ctx.deleteMessage();
        const warning = lang === 'es'
          ? `⏱️ Estás publicando demasiado rápido en **${topicConfig.topic_name}**.\n\nPor favor espera antes de publicar de nuevo.`
          : `⏱️ You're posting too fast in **${topicConfig.topic_name}**.\n\nPlease wait before posting again.`;
        try {
          await ctx.telegram.sendMessage(userId, warning, { parse_mode: 'Markdown' });
        } catch (error) { /* User blocked bot */ }
        await TopicConfigModel.trackViolation(userId, messageThreadId, 'rate_limit_exceeded');
        return;
      }
    }

    // ===================================
    // AUTO-MUTE CHECK (3-strike system)
    // ===================================
    const isMuted = await checkAutoMute(userId, messageThreadId, ctx);
    if (isMuted) {
      await ctx.deleteMessage();
      return; // User is muted, silently delete
    }

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
  };
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

    // Store approval data in Redis (with fallback to in-memory)
    const queue = await getApprovalQueue();
    await queue.set(approvalKey, approvalData);

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
    const queue = await getApprovalQueue();
    const approvalData = await queue.get(approvalKey);

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
      await queue.delete(approvalKey);

      await ctx.answerCbQuery('✅ Post approved and published!');

    } catch (error) {
      logger.error('Error approving post:', error);
      await ctx.answerCbQuery('❌ Error approving post.');
    }
  });

  // Reject post
  bot.action(/^reject_post:(.+)$/, async (ctx) => {
    const approvalKey = ctx.match[1];
    const queue = await getApprovalQueue();
    const approvalData = await queue.get(approvalKey);

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
      await queue.delete(approvalKey);

      await ctx.answerCbQuery('❌ Post rejected.');

    } catch (error) {
      logger.error('Error rejecting post:', error);
      await ctx.answerCbQuery('❌ Error rejecting post.');
    }
  });
}

/**
 * Check if user has required role/subscription access
 */
async function checkUserAccess(userId, topicConfig) {
  try {
    // Get user subscription info
    const user = await UserModel.findByTelegramId(userId);
    if (!user) return false;

    // Check subscription requirement
    if (topicConfig.required_subscription && topicConfig.required_subscription !== 'free') {
      const subscriptionLevels = { 'free': 0, 'basic': 1, 'premium': 2, 'vip': 3 };
      const userLevel = subscriptionLevels[user.subscription_type?.toLowerCase()] || 0;
      const requiredLevel = subscriptionLevels[topicConfig.required_subscription.toLowerCase()] || 0;

      if (userLevel < requiredLevel) {
        return false;
      }
    }

    // Check role requirement (from env for admins)
    if (topicConfig.required_role && topicConfig.required_role !== 'user') {
      const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const superAdminId = process.env.ADMIN_ID;

      if (topicConfig.required_role === 'admin' || topicConfig.required_role === 'superadmin') {
        if (!adminIds.includes(String(userId)) && String(userId) !== superAdminId) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    logger.error('Error checking user access:', error);
    return true; // Allow on error to avoid breaking
  }
}

/**
 * Check rate limiting for topic posts
 */
async function checkRateLimit(userId, topicId, topicConfig, message) {
  try {
    const redis = getRedis();
    if (!redis) return false; // No Redis, skip rate limiting

    const isReply = !!message.reply_to_message;
    const maxPerHour = isReply ? topicConfig.max_replies_per_hour : topicConfig.max_posts_per_hour;
    const cooldown = topicConfig.cooldown_between_posts || 0;

    // Check cooldown between posts
    if (cooldown > 0) {
      const lastPostKey = `topic:${topicId}:user:${userId}:lastpost`;
      const lastPost = await redis.get(lastPostKey);

      if (lastPost) {
        const elapsed = Date.now() - parseInt(lastPost);
        if (elapsed < cooldown * 1000) {
          return true; // Still in cooldown
        }
      }

      // Update last post time
      await redis.set(lastPostKey, Date.now(), 'EX', 3600);
    }

    // Check hourly rate limit
    if (maxPerHour && maxPerHour < 100) {
      const hourlyKey = `topic:${topicId}:user:${userId}:${isReply ? 'replies' : 'posts'}:hourly`;
      const current = await redis.incr(hourlyKey);

      if (current === 1) {
        await redis.expire(hourlyKey, 3600); // 1 hour expiry
      }

      if (current > maxPerHour) {
        return true; // Rate limited
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    return false; // Allow on error
  }
}

/**
 * Check if user is auto-muted due to violations (3-strike system)
 */
async function checkAutoMute(userId, topicId, ctx) {
  try {
    const redis = getRedis();
    if (!redis) return false;

    const muteKey = `topic:${topicId}:user:${userId}:muted`;
    const isMuted = await redis.get(muteKey);

    if (isMuted) {
      return true;
    }

    // Check violation count in last 24 hours
    const { query } = require('../../../config/postgres');
    const countSql = `
      SELECT COUNT(*) as count
      FROM topic_violations
      WHERE user_id = $1 AND topic_id = $2
      AND timestamp > NOW() - INTERVAL '24 hours'
    `;

    const result = await query(countSql, [userId, topicId]);
    const violations = parseInt(result.rows[0].count);

    // Auto-mute on 3+ violations
    if (violations >= 3) {
      // Mute for 1 hour
      await redis.set(muteKey, '1', 'EX', 3600);

      // Notify user
      const lang = ctx.from?.language_code === 'es' ? 'es' : 'en';
      const muteNotice = lang === 'es'
        ? `🔇 Has sido silenciado temporalmente en este tema por múltiples violaciones.\n\nDuración: 1 hora`
        : `🔇 You've been temporarily muted in this topic due to multiple violations.\n\nDuration: 1 hour`;

      try {
        await ctx.telegram.sendMessage(userId, muteNotice, { parse_mode: 'Markdown' });
      } catch (error) { /* User blocked bot */ }

      logger.warn(`User ${userId} auto-muted in topic ${topicId} for violations`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking auto-mute:', error);
    return false;
  }
}

/**
 * Get approval queue from Redis
 */
async function getApprovalQueue() {
  try {
    const redis = getRedis();
    if (redis) {
      return {
        get: async (key) => {
          const data = await redis.get(`approval:${key}`);
          return data ? JSON.parse(data) : null;
        },
        set: async (key, data) => {
          await redis.set(`approval:${key}`, JSON.stringify(data), 'EX', 86400); // 24h expiry
        },
        delete: async (key) => {
          await redis.del(`approval:${key}`);
        }
      };
    }
  } catch (error) {
    logger.debug('Redis not available for approval queue');
  }

  // Fallback to in-memory
  global.approvalQueue = global.approvalQueue || new Map();
  return {
    get: async (key) => global.approvalQueue.get(key),
    set: async (key, data) => global.approvalQueue.set(key, data),
    delete: async (key) => global.approvalQueue.delete(key)
  };
}

module.exports = {
  topicPermissionsMiddleware,
  registerApprovalHandlers
};
