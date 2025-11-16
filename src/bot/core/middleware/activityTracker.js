const GamificationModel = require('../../../models/gamificationModel');
const logger = require('../../../utils/logger');

/**
 * Activity tracker middleware
 * Automatically tracks user activity for gamification
 */
const activityTrackerMiddleware = () => async (ctx, next) => {
  try {
    // Skip if no user
    if (!ctx.from?.id) {
      return next();
    }

    const userId = ctx.from.id;

    // Track different types of activities
    if (ctx.message) {
      // Message sent
      if (ctx.message.text) {
        await GamificationModel.trackActivity(userId, 'message', 1);
      }

      // Photo/video/document shared
      if (ctx.message.photo || ctx.message.video || ctx.message.document) {
        await GamificationModel.trackActivity(userId, 'share', 3);
      }

      // Voice/audio shared
      if (ctx.message.voice || ctx.message.audio) {
        await GamificationModel.trackActivity(userId, 'share', 2);
      }

      // Sticker/animation
      if (ctx.message.sticker || ctx.message.animation) {
        await GamificationModel.trackActivity(userId, 'message', 1);
      }
    }

    // Callback queries (button clicks)
    if (ctx.callbackQuery) {
      await GamificationModel.trackActivity(userId, 'like', 1);
    }

    // Continue to next middleware
    return next();
  } catch (error) {
    logger.error('Error in activity tracker middleware:', error);
    // Don't block the bot if tracking fails
    return next();
  }
};

module.exports = activityTrackerMiddleware;
