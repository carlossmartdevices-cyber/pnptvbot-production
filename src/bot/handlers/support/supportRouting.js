const logger = require('../../../utils/logger');
const supportRoutingService = require('../../services/supportRoutingService');
const SupportTopicModel = require('../../../models/supportTopicModel');
const { getLanguage } = require('../../utils/helpers');

/**
 * Support Routing Handlers
 * Handles message routing between users and the support group
 */
const registerSupportRoutingHandlers = (bot) => {
  const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID;
  const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];

  if (!SUPPORT_GROUP_ID) {
    logger.warn('SUPPORT_GROUP_ID not configured. Support routing handlers will not work.');
    return;
  }

  /**
   * Extract user ID from message text
   * Looks for patterns like "User ID: 123456789" or "🔢 *User ID:* `123456789`"
   */
  const extractUserIdFromText = (text) => {
    if (!text) return null;

    // Pattern 1: User ID: 123456789 or User ID: `123456789`
    const pattern1 = /User ID[:\s]*`?(\d{6,15})`?/i;
    // Pattern 2: 🔢 *User ID:* `123456789`
    const pattern2 = /User ID[:\s]*\*?`?(\d{6,15})`?\*?/i;
    // Pattern 3: ID: 123456789
    const pattern3 = /\bID[:\s]*`?(\d{6,15})`?/i;
    // Pattern 4: from=123456789 or from User 123456789
    const pattern4 = /from[=\s]+(?:User\s+)?(\d{6,15})/i;

    for (const pattern of [pattern1, pattern2, pattern3, pattern4]) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  /**
   * Handler for messages in support group topics
   * Routes admin replies to users
   */
  bot.on('message', async (ctx, next) => {
    // Only process messages in the support group
    if (String(ctx.chat?.id) !== String(SUPPORT_GROUP_ID)) {
      return next();
    }

    // Skip bot's own messages
    if (ctx.from?.is_bot) {
      return next();
    }

    // Skip messages that start with / (commands)
    if (ctx.message?.text?.startsWith('/')) {
      return next();
    }

    const threadId = ctx.message?.message_thread_id;

    try {
      // CASE 1: Message is in a support topic (has threadId)
      if (threadId) {
        const supportTopic = await SupportTopicModel.getByThreadId(threadId);

        if (supportTopic) {
          // Send the admin's reply to the user
          const sent = await supportRoutingService.sendReplyToUser(threadId, ctx);

          if (sent) {
            try {
              await ctx.react('👍');
            } catch (reactError) {
              logger.debug('Could not add reaction:', reactError.message);
            }
          }
          return;
        }
      }

      // CASE 2: Message is a reply to an old message (no topic, but has reply_to_message)
      const replyToMessage = ctx.message?.reply_to_message;
      if (replyToMessage) {
        let targetUserId = null;

        // Try to extract user ID from the replied message text
        const replyText = replyToMessage.text || replyToMessage.caption || '';
        targetUserId = extractUserIdFromText(replyText);

        // Also check if the replied message was forwarded from a user
        if (!targetUserId && replyToMessage.forward_from) {
          targetUserId = String(replyToMessage.forward_from.id);
        }

        // Check forward_sender_name for hidden forwards
        if (!targetUserId && replyToMessage.forward_sender_name) {
          // Try to extract from the message text itself
          targetUserId = extractUserIdFromText(replyText);
        }

        if (targetUserId) {
          logger.info('Extracted user ID from reply', { targetUserId, adminId: ctx.from.id });

          // Send the reply to the user
          const adminName = ctx.from.first_name || 'Soporte';
          const message = ctx.message;

          // Reply instructions in both languages
          const replyInstructions = `\n\n💡 _Para responder: Mantén presionado este mensaje y selecciona "Responder"._\n💡 _To reply: Tap and hold this message and select "Reply"._`;

          try {
            if (message.text) {
              await ctx.telegram.sendMessage(
                targetUserId,
                `💬 *${adminName} (Soporte):*\n\n${message.text}${replyInstructions}`,
                { parse_mode: 'Markdown' }
              );
            } else if (message.photo) {
              const photo = message.photo[message.photo.length - 1];
              await ctx.telegram.sendPhoto(
                targetUserId,
                photo.file_id,
                {
                  caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
                  parse_mode: 'Markdown',
                }
              );
            } else if (message.document) {
              await ctx.telegram.sendDocument(
                targetUserId,
                message.document.file_id,
                {
                  caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
                  parse_mode: 'Markdown',
                }
              );
            } else if (message.voice) {
              await ctx.telegram.sendMessage(targetUserId, `💬 *${adminName} (Soporte):*${replyInstructions}`, { parse_mode: 'Markdown' });
              await ctx.telegram.sendVoice(targetUserId, message.voice.file_id);
            } else if (message.video) {
              await ctx.telegram.sendVideo(
                targetUserId,
                message.video.file_id,
                {
                  caption: `💬 *${adminName} (Soporte):*\n\n${message.caption || ''}${replyInstructions}`,
                  parse_mode: 'Markdown',
                }
              );
            } else if (message.sticker) {
              await ctx.telegram.sendMessage(targetUserId, `💬 *${adminName} (Soporte):*${replyInstructions}`, { parse_mode: 'Markdown' });
              await ctx.telegram.sendSticker(targetUserId, message.sticker.file_id);
            } else {
              // Forward as-is for other types
              await ctx.telegram.forwardMessage(targetUserId, ctx.chat.id, message.message_id);
              await ctx.telegram.sendMessage(targetUserId, replyInstructions.trim(), { parse_mode: 'Markdown' });
            }

            // React with checkmark
            try {
              await ctx.react('👍');
            } catch (reactError) {
              logger.debug('Could not add reaction:', reactError.message);
            }

            logger.info('Reply sent to user from old message', { targetUserId, adminId: ctx.from.id });

            // Create topic for future conversations if it doesn't exist
            try {
              const existingTopic = await SupportTopicModel.getByUserId(targetUserId);
              if (!existingTopic) {
                // Create a topic for this user
                const userInfo = await ctx.telegram.getChat(targetUserId).catch(() => null);
                if (userInfo) {
                  await supportRoutingService.getOrCreateUserTopic(userInfo, 'support');
                  logger.info('Created topic for user from old message reply', { targetUserId });
                }
              }
            } catch (topicError) {
              logger.warn('Could not create topic for user:', topicError.message);
            }

            return;
          } catch (sendError) {
            logger.error('Failed to send reply to user:', sendError);

            if (sendError.description?.includes('bot was blocked')) {
              await ctx.reply('⚠️ No se pudo enviar: El usuario ha bloqueado el bot.', { reply_to_message_id: ctx.message.message_id });
            } else if (sendError.description?.includes('chat not found')) {
              await ctx.reply('⚠️ No se pudo enviar: Usuario no encontrado o nunca inició el bot.', { reply_to_message_id: ctx.message.message_id });
            }
            return;
          }
        }
      }

      // Not a support-related message, let other handlers process
      return next();

    } catch (error) {
      logger.error('Error processing support group message:', error);
      return next();
    }
  });

  /**
   * Command to close a support ticket
   * Usage: /close (in support topic) or /close USER_ID (anywhere in support group)
   */
  bot.command('close', async (ctx) => {
    // Only in support group
    if (String(ctx.chat?.id) !== String(SUPPORT_GROUP_ID)) {
      return;
    }

    const threadId = ctx.message?.message_thread_id;
    const args = ctx.message?.text?.split(' ').slice(1) || [];

    try {
      let userId = null;
      let supportTopic = null;

      // If in a topic, close that topic
      if (threadId) {
        supportTopic = await SupportTopicModel.getByThreadId(threadId);
        if (supportTopic) {
          userId = supportTopic.user_id;
        }
      }

      // If user ID provided as argument, use that
      if (args.length > 0) {
        userId = args[0];
        supportTopic = await SupportTopicModel.getByUserId(userId);
      }

      if (!userId || !supportTopic) {
        await ctx.reply('❌ No se encontró el ticket de soporte.\n\nUso: /close (en el topic) o /close USER_ID');
        return;
      }

      // Close the topic
      const closed = await supportRoutingService.closeUserTopic(userId);

      if (closed) {
        await ctx.reply(`✅ Ticket cerrado para usuario ${userId}.\n\nEl topic se ha marcado como resuelto.`, {
          message_thread_id: threadId || supportTopic.thread_id,
        });

        // Notify user that their ticket was closed
        try {
          await ctx.telegram.sendMessage(
            userId,
            '✅ *Ticket Cerrado*\n\nTu solicitud de soporte ha sido resuelta. Si necesitas más ayuda, puedes abrir un nuevo ticket desde el menú de soporte.',
            { parse_mode: 'Markdown' }
          );
        } catch (notifyError) {
          logger.warn('Could not notify user about ticket closure:', notifyError.message);
        }
      } else {
        await ctx.reply('❌ No se pudo cerrar el ticket.');
      }

    } catch (error) {
      logger.error('Error closing support ticket:', error);
      await ctx.reply('❌ Error al cerrar el ticket: ' + error.message);
    }
  });

  /**
   * Command to reopen a support ticket
   * Usage: /reopen (in support topic) or /reopen USER_ID
   */
  bot.command('reopen', async (ctx) => {
    // Only in support group
    if (String(ctx.chat?.id) !== String(SUPPORT_GROUP_ID)) {
      return;
    }

    const threadId = ctx.message?.message_thread_id;
    const args = ctx.message?.text?.split(' ').slice(1) || [];

    try {
      let userId = null;
      let supportTopic = null;

      if (threadId) {
        supportTopic = await SupportTopicModel.getByThreadId(threadId);
        if (supportTopic) {
          userId = supportTopic.user_id;
        }
      }

      if (args.length > 0) {
        userId = args[0];
      }

      if (!userId) {
        await ctx.reply('❌ No se encontró el ticket.\n\nUso: /reopen (en el topic) o /reopen USER_ID');
        return;
      }

      await SupportTopicModel.updateStatus(userId, 'open');

      // Reopen the forum topic if possible
      if (supportTopic && ctx.telegram) {
        try {
          await ctx.telegram.reopenForumTopic(SUPPORT_GROUP_ID, supportTopic.thread_id);
        } catch (reopenError) {
          logger.warn('Could not reopen forum topic:', reopenError.message);
        }
      }

      await ctx.reply(`✅ Ticket reabierto para usuario ${userId}.`, {
        message_thread_id: threadId || (supportTopic?.thread_id),
      });

    } catch (error) {
      logger.error('Error reopening support ticket:', error);
      await ctx.reply('❌ Error al reabrir el ticket: ' + error.message);
    }
  });

  /**
   * Command to get support statistics
   * Usage: /supportstats
   */
  bot.command('supportstats', async (ctx) => {
    // Only in support group or from admins
    const isInSupportGroup = String(ctx.chat?.id) === String(SUPPORT_GROUP_ID);
    const isAdmin = ADMIN_USER_IDS.includes(String(ctx.from?.id));

    if (!isInSupportGroup && !isAdmin) {
      return;
    }

    try {
      const stats = await SupportTopicModel.getStatistics();

      const message = `📊 *Estadísticas de Soporte*

📋 Total de tickets: ${stats.total_topics || 0}
🟢 Abiertos: ${stats.open_topics || 0}
✅ Resueltos: ${stats.resolved_topics || 0}
🔒 Cerrados: ${stats.closed_topics || 0}

💬 Total de mensajes: ${stats.total_messages || 0}
📝 Promedio msgs/ticket: ${Math.round(stats.avg_messages_per_topic || 0)}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error getting support stats:', error);
      await ctx.reply('❌ Error al obtener estadísticas: ' + error.message);
    }
  });

  /**
   * Command to list open tickets
   * Usage: /opentickets
   */
  bot.command('opentickets', async (ctx) => {
    // Only in support group
    if (String(ctx.chat?.id) !== String(SUPPORT_GROUP_ID)) {
      return;
    }

    try {
      const openTopics = await SupportTopicModel.getOpenTopics();

      if (openTopics.length === 0) {
        await ctx.reply('✅ No hay tickets abiertos.');
        return;
      }

      let message = `📋 *Tickets Abiertos (${openTopics.length})*\n\n`;

      for (const topic of openTopics.slice(0, 20)) { // Limit to 20
        const lastMsg = topic.last_message_at ? new Date(topic.last_message_at).toLocaleString('es-ES') : 'N/A';
        message += `• **${topic.user_id}** - ${topic.message_count || 0} msgs\n  _Último:_ ${lastMsg}\n`;
      }

      if (openTopics.length > 20) {
        message += `\n_...y ${openTopics.length - 20} más_`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error listing open tickets:', error);
      await ctx.reply('❌ Error al listar tickets: ' + error.message);
    }
  });

  /**
   * Command to send a message to a user
   * Usage: /msg USER_ID message text
   */
  bot.command('msg', async (ctx) => {
    // Only in support group or from admins
    const isInSupportGroup = String(ctx.chat?.id) === String(SUPPORT_GROUP_ID);
    const isAdmin = ADMIN_USER_IDS.includes(String(ctx.from?.id));

    if (!isInSupportGroup && !isAdmin) {
      return;
    }

    const args = ctx.message?.text?.split(' ').slice(1) || [];

    if (args.length < 2) {
      await ctx.reply('❌ Uso: /msg USER_ID mensaje\n\nEjemplo: /msg 123456789 Hola, tu cuenta ha sido activada!');
      return;
    }

    const targetUserId = args[0];
    const messageText = args.slice(1).join(' ');
    const adminName = ctx.from.first_name || 'Soporte';

    try {
      await ctx.telegram.sendMessage(
        targetUserId,
        `💬 *${adminName} (Soporte):*\n\n${messageText}`,
        { parse_mode: 'Markdown' }
      );

      await ctx.reply(`✅ Mensaje enviado a usuario ${targetUserId}`);

      // Create/update support topic for tracking
      try {
        let supportTopic = await SupportTopicModel.getByUserId(targetUserId);
        if (supportTopic) {
          await SupportTopicModel.updateLastMessage(targetUserId);
        }
      } catch (dbError) {
        logger.warn('Could not update support topic:', dbError.message);
      }

    } catch (error) {
      logger.error('Error sending message to user:', error);

      if (error.description?.includes('bot was blocked')) {
        await ctx.reply('❌ No se pudo enviar el mensaje: El usuario ha bloqueado el bot.');
      } else if (error.description?.includes('chat not found')) {
        await ctx.reply('❌ No se pudo enviar el mensaje: Usuario no encontrado o nunca inició el bot.');
      } else {
        await ctx.reply('❌ Error al enviar mensaje: ' + error.message);
      }
    }
  });

  logger.info('✓ Support routing handlers registered');
};

module.exports = registerSupportRoutingHandlers;
