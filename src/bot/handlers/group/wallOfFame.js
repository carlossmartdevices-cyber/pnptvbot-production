const { Markup } = require('telegraf');
const UserModel = require('../../../models/userModel');
const logger = require('../../../utils/logger');
const { getLanguage } = require('../../utils/helpers');
const SubscriptionService = require('../../services/subscriptionService');

// Track daily legend selection
let lastLegendSelectionDate = null;
let todayLegendUserId = null;

/**
 * Wall of Fame Handler - "PNPtv Legend of the Day"
 * Automatically posts photos/videos to Wall of Fame TOPIC with member info
 * Selects one daily "Legend" to feature and rewards them with 1 day PRIME access
 * Deletes the original message from the group to avoid duplicates
 *
 * IMPORTANT RULES:
 * - Wall of Fame is a TOPIC in the GROUP (not a separate channel)
 * - Photos/videos posted to Wall of Fame topic are PERMANENT (NEVER deleted)
 * - Original user messages in general group are deleted (to avoid duplicates)
 * - Wall of Fame messages are excluded from /cleanupcommunity command
 * - Only bot messages in main GROUP are deleted, not Wall of Fame topic
 * - One "Legend of the Day" is selected daily and rewarded with 1 day PRIME
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
 * Check if user should be today's Legend of the Day and select if so
 * @param {string} userId - User ID
 * @returns {Object} { isLegend: boolean, isFirstSelection: boolean }
 */
async function checkAndSelectLegendOfTheDay(userId) {
  try {
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Reset legend selection if it's a new day
    if (lastLegendSelectionDate !== todayKey) {
      lastLegendSelectionDate = todayKey;
      todayLegendUserId = null;
    }

    // If we already have a legend for today and it's a DIFFERENT user, they can't be legend
    if (todayLegendUserId && todayLegendUserId !== userId) {
      return { isLegend: false, isFirstSelection: false };
    }

    // If this user is ALREADY today's legend, return true but don't reward again
    if (todayLegendUserId === userId) {
      logger.debug('User is already today\'s legend, skipping reward', { userId });
      return { isLegend: true, isFirstSelection: false };
    }

    // Select this user as today's legend (FIRST TIME)
    todayLegendUserId = userId;

    // Reward the user with 1 day of PRIME access (only on first selection)
    try {
      const result = await SubscriptionService.addFreeTrial(userId, 1, 'legend_of_the_day');
      if (result.success) {
        logger.info('PNPtv Legend of the Day rewarded with 1 day PRIME', {
          userId,
          trialDays: 1,
          reason: 'legend_of_the_day'
        });
      }
    } catch (rewardError) {
      logger.error('Error rewarding PNPtv Legend of the Day:', {
        userId,
        error: rewardError.message
      });
    }

    // Add PNPtv Legend badge to user profile (only on first selection)
    try {
      await UserModel.addBadge(userId, 'pnptv_legend');
      logger.info('PNPtv Legend badge added to user profile', {
        userId,
        badge: 'pnptv_legend'
      });
    } catch (badgeError) {
      logger.error('Error adding PNPtv Legend badge:', {
        userId,
        error: badgeError.message
      });
    }

    return { isLegend: true, isFirstSelection: true };
  } catch (error) {
    logger.error('Error in checkAndSelectLegendOfTheDay:', error);
    return { isLegend: false, isFirstSelection: false };
  }
}

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

      // CRITICAL: Only process photos/videos from the TARGET group
      const chatIdStr = ctx.chat?.id?.toString();
      if (chatIdStr !== GROUP_ID) {
        return; // Not our target group, skip
      }

      // Skip if photo/video is already in Wall of Fame topic (prevent re-posting)
      const messageThreadId = ctx.message?.message_thread_id;
      if (messageThreadId && Number(messageThreadId) === WALL_OF_FAME_TOPIC_ID) {
        return; // Already in Wall of Fame, skip
      }

      // Skip if it's a forwarded message or reply
      if (ctx.message.forward_from || ctx.message.reply_to_message) {
        return;
      }

      const userId = ctx.from.id;
      const lang = getLanguage(ctx);

      // Get user info
      const user = await UserModel.getById(userId);
      if (!user) {
        logger.warn('User not found for wall of fame', { userId });
        return;
      }

      // Check if this user should be today's Legend of the Day
      const legendResult = await checkAndSelectLegendOfTheDay(userId);
      const isLegendOfTheDay = legendResult.isLegend;
      const isFirstLegendSelection = legendResult.isFirstSelection;

      // Build member info caption (show legend badge if they are the legend)
      const caption = buildMemberInfoCaption(user, lang, isLegendOfTheDay);
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
          let confirmMsg;
          if (isFirstLegendSelection) {
            // First time selected as Legend of the Day - full congratulations with reward info
            confirmMsg = lang === 'es'
              ? `🎉 ¡FELICIDADES! ¡ERES LA LEYENDA PNPtv DEL DÍA! 🎉

🏆 Tu foto/video ha sido seleccionado como el MEJOR del día
💎 Has ganado 1 DÍA GRATIS de acceso PRIME
👑 Has recibido la insignia exclusiva PNPtv LEGEND
🔥 Disfruta de todos los beneficios exclusivos

👑 ${user.name || user.username}

📢 Tu logro ha sido anunciado en el Muro de la Fama
💫 ¡Revisa tu perfil para ver tu nueva insignia!`
              : `🎉 CONGRATULATIONS! YOU ARE THE PNPtv LEGEND OF THE DAY! 🎉

🏆 Your photo/video has been selected as the BEST of the day
💎 You have earned 1 FREE DAY of PRIME access
👑 You have received the exclusive PNPtv LEGEND badge
🔥 Enjoy all exclusive benefits

👑 ${user.name || user.username}

📢 Your achievement has been announced on the Wall of Fame
💫 Check your profile to see your new badge!`;
          } else if (isLegendOfTheDay) {
            // Already today's legend, posting again - simpler message
            confirmMsg = lang === 'es'
              ? `✨ Tu foto/video ha sido publicado en el Muro de la Fama!\n\n🏆 ${user.name || user.username} - LEYENDA DEL DÍA\n\n💫 ¡Sigue compartiendo contenido increíble!`
              : `✨ Your photo/video has been posted to the Wall of Fame!\n\n🏆 ${user.name || user.username} - LEGEND OF THE DAY\n\n💫 Keep sharing amazing content!`;
          } else {
            // Not the legend - encourage them
            confirmMsg = lang === 'es'
              ? `✨ Tu foto/video ha sido publicado en el Muro de la Fama!\n\n👑 ${user.name || user.username}\n\n💡 ¿Quieres ser la próxima LEYENDA PNPtv DEL DÍA? ¡Sube más contenido de calidad!`
              : `✨ Your photo/video has been posted to the Wall of Fame!\n\n👑 ${user.name || user.username}\n\n💡 Want to be the next PNPtv LEGEND OF THE DAY? Upload more quality content!`;
          }

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
 * @param {boolean} isLegendOfTheDay - Whether this user is today's legend
 * @returns {string} HTML formatted caption
 */
function buildMemberInfoCaption(user, lang, isLegendOfTheDay = false) {
  const label = isLegendOfTheDay
    ? (lang === 'es' ? '🏆 LEYENDA PNPtv DEL DÍA 🏆' : '🏆 PNPtv LEGEND OF THE DAY 🏆')
    : (lang === 'es' ? '👑 Miembro Destacado' : '👑 Featured Member');
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

  // Add Legend of the Day reward info
  if (isLegendOfTheDay) {
    const rewardText = lang === 'es'
      ? '\n\n🎁 ¡FELICIDADES! Eres la LEYENDA PNPtv DEL DÍA' +
        '\n💎 Has ganado 1 DÍA GRATIS de acceso PRIME' +
        '\n👑 Has recibido la insignia exclusiva PNPtv LEGEND' +
        '\n🔥 Tu membresía ha sido actualizada automáticamente' +
        '\n📅 Disfruta de todos los beneficios PRIME por 24 horas'
      : '\n\n🎁 CONGRATULATIONS! You are the PNPtv LEGEND OF THE DAY' +
        '\n💎 You have earned 1 FREE DAY of PRIME access' +
        '\n👑 You have received the exclusive PNPtv LEGEND badge' +
        '\n🔥 Your membership has been automatically upgraded' +
        '\n📅 Enjoy all PRIME benefits for 24 hours';
    
    caption += rewardText;
  }

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
