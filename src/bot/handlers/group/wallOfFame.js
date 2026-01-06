const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');

/**
 * Wall of Fame Handler
 * Automatically posts photos/videos to Wall of Fame TOPIC with member info
 * Deletes the original message from the group to avoid duplicates
 *
 * IMPORTANT RULES:
 * - Wall of Fame is a TOPIC in the GROUP (not a separate channel)
 * - Photos/videos posted to Wall of Fame topic are PERMANENT (NEVER deleted)
 * - Original user messages in general group are deleted (to avoid duplicates)
 * - Wall of Fame messages are excluded from /cleanupcommunity command
 * - Only bot messages in main GROUP are deleted, not Wall of Fame topic
 */

// Wall of Fame Topic ID in the group
// This is a topic within GROUP_ID where photos/videos are posted permanently
// Default: 3132 (from the community group structure)
const WALL_OF_FAME_TOPIC_ID = parseInt(process.env.WALL_OF_FAME_TOPIC_ID || '3132');
const GROUP_ID = process.env.GROUP_ID || '-1003291737499';

/**
 * Track Wall of Fame message IDs to exclude from cleanup
 * Maps: topicId => Set of message IDs that should NEVER be deleted
 * These are protected from /cleanupcommunity cleanup command
 */
const wallOfFameMessageIds = new Map();

/**
 * Register wall of fame handlers
 * @param {Telegraf} bot - Bot instance
 */
const registerWallOfFameHandlers = (bot) => {
  // Listen for photos/videos in groups
  bot.on(['photo', 'video'], async (ctx) => {
    try {
      // Only apply in groups
      if (!['group', 'supergroup'].includes(ctx.chat?.type)) {
        return;
      }

      // Skip if it's a forwarded message or reply
      if (ctx.message.forward_from || ctx.message.reply_to_message) {
        return;
      }

      const userId = ctx.from.id;
      const lang = getLanguage(ctx);

      // Get user info
      const user = await UserModel.getUserById(userId);
      if (!user) {
        logger.warn('User not found for wall of fame', { userId });
        return;
      }

      // Build member info caption
      const caption = buildMemberInfoCaption(user, lang);
      const inlineKeyboard = buildMemberInlineKeyboard(user, userId, lang);

      // Prepare to forward to Wall of Fame
      const isPhoto = ctx.message.photo;
      const isVideo = ctx.message.video;

      try {
        if (isPhoto) {
          // Get the largest photo size
          const photo = ctx.message.photo[ctx.message.photo.length - 1];
          const fileId = photo.file_id;

          // Send photo to Wall of Fame TOPIC with member info
          const sentMessage = await ctx.telegram.sendPhoto(
            GROUP_ID,
            fileId,
            {
              caption,
              parse_mode: 'HTML',
              disable_notification: false,
              message_thread_id: WALL_OF_FAME_TOPIC_ID, // Post to the specific topic
              ...(inlineKeyboard ? inlineKeyboard : {}),
            }
          );

          // Track this Wall of Fame message so it's NEVER deleted
          trackWallOfFameMessage(WALL_OF_FAME_TOPIC_ID, sentMessage.message_id);

          logger.info('Photo posted to Wall of Fame TOPIC (PERMANENT)', {
            userId,
            username: user.username,
            groupId: ctx.chat.id,
            topicId: WALL_OF_FAME_TOPIC_ID,
            wallOfFameMessageId: sentMessage.message_id,
          });
        } else if (isVideo) {
          const video = ctx.message.video;
          const fileId = video.file_id;

          // Send video to Wall of Fame TOPIC with member info
          const sentMessage = await ctx.telegram.sendVideo(
            GROUP_ID,
            fileId,
            {
              caption,
              parse_mode: 'HTML',
              disable_notification: false,
              duration: video.duration,
              message_thread_id: WALL_OF_FAME_TOPIC_ID, // Post to the specific topic
              ...(inlineKeyboard ? inlineKeyboard : {}),
            }
          );

          // Track this Wall of Fame message so it's NEVER deleted
          trackWallOfFameMessage(WALL_OF_FAME_TOPIC_ID, sentMessage.message_id);

          logger.info('Video posted to Wall of Fame TOPIC (PERMANENT)', {
            userId,
            username: user.username,
            groupId: ctx.chat.id,
            topicId: WALL_OF_FAME_TOPIC_ID,
            wallOfFameMessageId: sentMessage.message_id,
          });
        }

        // Delete the original message from the group to avoid duplicates
        try {
          await ctx.deleteMessage();
          logger.info('Original message deleted from group', {
            userId,
            messageId: ctx.message.message_id,
            groupId: ctx.chat.id,
          });
        } catch (deleteError) {
          logger.warn('Failed to delete original message', {
            userId,
            messageId: ctx.message.message_id,
            error: deleteError.message,
          });
        }

        // Send confirmation to user in private chat
        try {
          const confirmMsg = lang === 'es'
            ? `✨ Tu foto/video ha sido publicado en el Muro de la Fama!\n\n👑 ${user.name || user.username}`
            : `✨ Your photo/video has been posted to the Wall of Fame!\n\n👑 ${user.name || user.username}`;

          await ctx.telegram.sendMessage(userId, confirmMsg);
        } catch (dmError) {
          logger.debug('Could not send DM confirmation', { userId, error: dmError.message });
        }
      } catch (postError) {
        logger.error('Error posting to Wall of Fame', {
          userId,
          error: postError.message,
        });

        // Try to notify user of the error
        try {
          const errorMsg = lang === 'es'
            ? '❌ Hubo un error al publicar en el Muro de la Fama'
            : '❌ There was an error posting to the Wall of Fame';
          await ctx.telegram.sendMessage(userId, errorMsg);
        } catch (dmError) {
          logger.debug('Could not send error DM', { userId });
        }
      }
    } catch (error) {
      logger.error('Error in wallOfFame handler:', error);
    }
  });
};

/**
 * Build member information caption for Wall of Fame
 * @param {Object} user - User object
 * @param {string} lang - Language code
 * @returns {string} HTML formatted caption
 */
function buildMemberInfoCaption(user, lang) {
  const label = lang === 'es' ? '👑 Miembro Destacado' : '👑 Featured Member';
  const nameLabel = lang === 'es' ? 'Nombre:' : 'Name:';
  const usernameLabel = lang === 'es' ? 'Usuario:' : 'Username:';
  const bioLabel = lang === 'es' ? 'Bio:' : 'Bio:';
  const lookingForLabel = lang === 'es' ? 'Buscando:' : 'Looking for:';
  const interestsLabel = lang === 'es' ? 'Intereses:' : 'Interests:';
  const socialLabel = lang === 'es' ? 'Redes Sociales:' : 'Social Media:';

  let caption = `<b>${label}</b>\n\n`;

  // Display name (firstName + lastName if available, fallback to username)
  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.username || 'Member';

  caption += `<b>${nameLabel}</b> ${displayName}\n`;

  if (user.username) {
    caption += `<b>${usernameLabel}</b> @${user.username}\n`;
  }

  if (user.bio) {
    caption += `<b>${bioLabel}</b> ${escapeHtml(user.bio)}\n`;
  }

  if (user.looking_for) {
    caption += `<b>${lookingForLabel}</b> ${escapeHtml(user.looking_for)}\n`;
  }

  if (Array.isArray(user.interests) && user.interests.length > 0) {
    const interests = user.interests.filter(Boolean).slice(0, 8).map((i) => escapeHtml(String(i)));
    if (interests.length > 0) {
      caption += `<b>${interestsLabel}</b> ${interests.join(', ')}\n`;
    }
  }

  // Add social media links if available
  const socialLinks = [];

  if (user.instagram) {
    socialLinks.push(`<a href="https://instagram.com/${escapeHtml(String(user.instagram).replace(/^@/, ''))}">📸 Instagram</a>`);
  }

  if (user.twitter) {
    socialLinks.push(`<a href="https://x.com/${escapeHtml(String(user.twitter).replace(/^@/, ''))}">𝕏 X</a>`);
  }

  if (user.tiktok) {
    socialLinks.push(`<a href="https://www.tiktok.com/@${escapeHtml(String(user.tiktok).replace(/^@/, ''))}">🎵 TikTok</a>`);
  }

  if (user.youtube) {
    const youtubeValue = String(user.youtube).trim();
    const youtubeUrl = youtubeValue.startsWith('http') ? youtubeValue : `https://www.youtube.com/@${youtubeValue.replace(/^@/, '')}`;
    socialLinks.push(`<a href="${escapeHtml(youtubeUrl)}">▶️ YouTube</a>`);
  }

  if (user.telegram) {
    socialLinks.push(`<a href="https://t.me/${escapeHtml(String(user.telegram).replace(/^@/, ''))}">✈️ Telegram</a>`);
  }

  if (socialLinks.length > 0) {
    caption += `\n<b>${socialLabel}</b>\n${socialLinks.join(' | ')}\n`;
  }

  caption += `\n✨ <i>${lang === 'es' ? 'Destacado en el Muro de la Fama' : 'Featured on Wall of Fame'}</i>`;

  return caption;
}

function buildMemberInlineKeyboard(user, userId, lang) {
  try {
    const keyboard = [];

    // Interests as callback buttons (shows alert)
    if (Array.isArray(user.interests) && user.interests.length > 0) {
      const interestButtons = user.interests
        .map((interest, index) => ({ interest, index }))
        .filter(({ interest }) => Boolean(interest))
        .slice(0, 6)
        .map(({ interest, index }) => Markup.button.callback(String(interest).slice(0, 24), `profile_interest_${userId}_${index}`));

      for (let i = 0; i < interestButtons.length; i += 2) {
        keyboard.push(interestButtons.slice(i, i + 2));
      }
    }

    const normalizeHandle = (value) => String(value || '').trim().replace(/^@/, '');
    const socialButtons = [];

    if (user.instagram) {
      socialButtons.push(Markup.button.url('Instagram', `https://instagram.com/${encodeURIComponent(normalizeHandle(user.instagram))}`));
    }
    if (user.twitter) {
      socialButtons.push(Markup.button.url('X', `https://x.com/${encodeURIComponent(normalizeHandle(user.twitter))}`));
    }
    if (user.tiktok) {
      socialButtons.push(Markup.button.url('TikTok', `https://www.tiktok.com/@${encodeURIComponent(normalizeHandle(user.tiktok))}`));
    }
    if (user.youtube) {
      const youtubeValue = String(user.youtube).trim();
      const youtubeUrl = youtubeValue.startsWith('http') ? youtubeValue : `https://www.youtube.com/@${encodeURIComponent(normalizeHandle(youtubeValue))}`;
      socialButtons.push(Markup.button.url('YouTube', youtubeUrl));
    }
    if (user.telegram) {
      socialButtons.push(Markup.button.url('Telegram', `https://t.me/${encodeURIComponent(normalizeHandle(user.telegram))}`));
    }

    for (let i = 0; i < socialButtons.length; i += 2) {
      keyboard.push(socialButtons.slice(i, i + 2));
    }

    if (keyboard.length === 0) return null;
    return Markup.inlineKeyboard(keyboard);
  } catch (error) {
    logger.error('Error building Wall of Fame inline keyboard:', error);
    return null;
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Track a Wall of Fame message as permanent (NEVER to be deleted)
 * @param {string} channelId - Wall of Fame channel ID
 * @param {number} messageId - Message ID to track
 */
function trackWallOfFameMessage(channelId, messageId) {
  if (!wallOfFameMessageIds.has(channelId)) {
    wallOfFameMessageIds.set(channelId, new Set());
  }
  wallOfFameMessageIds.get(channelId).add(messageId);
  logger.debug('Wall of Fame message tracked (PERMANENT)', { channelId, messageId });
}

/**
 * Check if a message is a Wall of Fame message (should never be deleted)
 * @param {string} channelId - Channel ID
 * @param {number} messageId - Message ID
 * @returns {boolean} True if this is a Wall of Fame message
 */
function isWallOfFameMessage(channelId, messageId) {
  const fameMessages = wallOfFameMessageIds.get(channelId);
  return fameMessages ? fameMessages.has(messageId) : false;
}

/**
 * Get all tracked Wall of Fame messages
 * @returns {Map} Map of channel IDs to message ID sets
 */
function getWallOfFameMessages() {
  return wallOfFameMessageIds;
}

module.exports = {
  registerWallOfFameHandlers,
  buildMemberInfoCaption,
  trackWallOfFameMessage,
  isWallOfFameMessage,
  getWallOfFameMessages,
};
