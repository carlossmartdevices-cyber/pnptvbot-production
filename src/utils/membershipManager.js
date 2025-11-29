const { getFirestore } = require('../config/firebase');
const logger = require('./logger');

/**
 * Activate user membership
 * @param {string} userId - User ID
 * @param {string} tier - Membership tier ("Free", "Silver", "Golden")
 * @param {string} activatedBy - Who activated (e.g., "system", "admin", "payment")
 * @param {number} durationDays - Duration in days (0 for Free tier)
 * @param {Object} telegram - Telegram bot instance (optional, for notifications)
 * @returns {Promise<boolean>} Success status
 */
async function activateMembership(userId, tier, activatedBy, durationDays = 0, telegram = null) {
  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId.toString());

    const updates = {
      tier,
      updatedAt: new Date(),
    };

    // Calculate expiry for paid tiers
    if (tier !== 'Free' && durationDays > 0) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + durationDays);
      updates.membershipExpiresAt = expiry;
    } else {
      updates.membershipExpiresAt = null; // Free tier doesn't expire
    }

    await userRef.update(updates);

    logger.info('Membership activated', {
      userId,
      tier,
      activatedBy,
      durationDays,
      expiry: updates.membershipExpiresAt,
    });

    // Send notification if telegram instance provided
    if (telegram) {
      try {
        const tierEmoji = {
          Free: '🆓',
          Silver: '⭐',
          Golden: '👑',
        };
        const message = `${tierEmoji[tier] || '✅'} Your ${tier} membership has been activated!${
          updates.membershipExpiresAt ? `\n\nExpires: ${updates.membershipExpiresAt.toLocaleDateString()}` : ''
        }`;
        await telegram.sendMessage(userId, message);
      } catch (notifError) {
        logger.warn('Failed to send membership notification:', notifError);
      }
    }

    return true;
  } catch (error) {
    logger.error('Error activating membership:', error);
    return false;
  }
}

module.exports = {
  activateMembership,
};
