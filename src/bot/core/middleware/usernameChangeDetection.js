const logger = require('../../../utils/logger');
const { getRedis, cache } = require('../../../config/redis');
const { query } = require('../../../config/postgres');

/**
 * Username/Name Change Detection Middleware
 * Blocks users who change their name or username more than 2 times in 24 hours
 * This helps prevent account takeover and suspicious activity
 */
function usernameChangeDetectionMiddleware() {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      // Only check in private chats to avoid false positives
      if (!userId || ctx.chat?.type !== 'private') {
        return next();
      }

      // Admins bypass all username change detection rules
      const adminIds = (process.env.ADMIN_USER_IDS || process.env.ADMIN_ID || '').split(',').map(id => String(id.trim()));
      const userIdStr = String(userId);
      if (adminIds.includes(userIdStr)) {
        logger.debug('Admin user bypassing username change detection', { userId: userIdStr });
        return next(); // Skip all checks for admins
      }

      const currentUsername = ctx.from.username || null;
      const currentFirstName = ctx.from.first_name || '';
      const currentLastName = ctx.from.last_name || null;
      const currentFullName = `${currentFirstName}${currentLastName ? ' ' + currentLastName : ''}`.trim();

      // Redis keys for tracking
      const usernameChangeKey = `user:${userIdStr}:username_changes:24h`;
      const usernameHistoryKey = `user:${userIdStr}:username_history`;
      const blockedKey = `user:${userIdStr}:blocked_suspicious`;

      // Check if user is already flagged as suspicious
      const isBlockedFlag = await cache.exists(blockedKey);
      if (isBlockedFlag) {
        logger.warn('Blocked suspicious user (excessive name changes)', { userId });
        await ctx.reply(
          '🚫 Your account has been temporarily blocked due to suspicious activity (excessive name/username changes).\n\n' +
          'Please contact support if you believe this is a mistake.'
        );
        return; // Stop processing
      }

      // Get current stored profile from database
      let storedProfile = null;
      try {
        const result = await query(
          'SELECT username, first_name, last_name FROM users WHERE id = $1',
          [userId]
        );
        if (result.rows.length > 0) {
          storedProfile = result.rows[0];
        }
      } catch (error) {
        logger.error('Error fetching user profile:', error);
      }

      // Check if username or name has changed
      let hasChanged = false;
      let changeType = null;

      if (storedProfile) {
        if (storedProfile.username !== currentUsername) {
          hasChanged = true;
          changeType = 'username';
        }

        const storedFullName = `${storedProfile.first_name || ''}${storedProfile.last_name ? ' ' + storedProfile.last_name : ''}`.trim();
        if (storedFullName !== currentFullName) {
          hasChanged = true;
          changeType = changeType ? 'both' : 'name';
        }
      }

      if (hasChanged && changeType) {
        // Increment change counter using Redis
        const redis = getRedis();
        const changeCount = await redis.incr(usernameChangeKey);

        if (changeCount === 1) {
          // First change in 24h window, set expiry
          await redis.expire(usernameChangeKey, 86400); // 24 hours
        }

        // Store change history
        const changeEntry = {
          timestamp: Date.now(),
          type: changeType,
          oldUsername: storedProfile?.username,
          newUsername: currentUsername,
          oldName: storedProfile?.first_name,
          newName: currentFirstName,
          oldLastName: storedProfile?.last_name,
          newLastName: currentLastName,
        };

        try {
          const historyJson = await redis.get(usernameHistoryKey);
          const changes = historyJson ? JSON.parse(historyJson) : [];
          changes.push(changeEntry);
          // Keep only last 10 changes
          const recentChanges = changes.slice(-10);
          await redis.setex(
            usernameHistoryKey,
            604800, // 7 days
            JSON.stringify(recentChanges)
          );
        } catch (error) {
          logger.error('Error storing change history:', error);
        }

        logger.warn('User name/username changed', {
          userId,
          changeType,
          changeCount: parseInt(changeCount) || 0,
          oldUsername: storedProfile?.username,
          newUsername: currentUsername,
          oldName: storedProfile?.first_name,
          newName: currentFirstName,
        });

        // If more than 2 changes in 24 hours, block user
        // Using > 2 means 3 or more changes trigger the block
        const countNum = parseInt(changeCount) || 0;
        if (countNum > 2) {
          logger.error('🚨 User BLOCKED: Excessive name/username changes', {
            userId,
            changeCount: countNum,
            changes24h: countNum,
          });

          // Block for 24 hours
          await redis.setex(blockedKey, 86400, '1');

          // Log to database
          try {
            await query(
              `INSERT INTO user_security_logs (user_id, event_type, details, created_at)
               VALUES ($1, $2, $3, NOW())`,
              [String(userId), 'excessive_name_changes', JSON.stringify({
                changeCount: countNum,
                lastChangeType: changeType,
                changes: changeEntry,
              })]
            );
          } catch (error) {
            logger.error('Error logging security event:', error);
          }

          // Notify user
          await ctx.reply(
            '🚫 Your account has been temporarily blocked due to suspicious activity.\n\n' +
            `Reason: Too many name/username changes (${countNum} in 24 hours)\n\n` +
            'Your account will be unblocked after 24 hours.\n' +
            'Contact support if you believe this is a mistake.'
          );

          return; // Stop processing
        }

        // Warn user if approaching limit
        if (countNum === 2) {
          logger.warn('User approaching name change limit', { userId, changeCount: countNum });
          await ctx.reply(
            '⚠️ Warning: You have changed your name/username 2 times in the last 24 hours.\n\n' +
            'One more change will result in a temporary account block.\n' +
            'Please stop making frequent changes.'
          );
        }
      }

      return next();
    } catch (error) {
      logger.error('Error in username change detection middleware:', error);
      return next(); // Don't block on error
    }
  };
}

/**
 * Get change history for a user
 */
async function getUserChangeHistory(userId) {
  try {
    const redis = getRedis();
    const userIdStr = String(userId);
    const history = await redis.get(`user:${userIdStr}:username_history`);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    logger.error('Error getting user change history:', error);
    return [];
  }
}

/**
 * Get current change count for user
 */
async function getUserChangeCount(userId) {
  try {
    const redis = getRedis();
    const userIdStr = String(userId);
    const count = await redis.get(`user:${userIdStr}:username_changes:24h`);
    return parseInt(count) || 0;
  } catch (error) {
    logger.error('Error getting user change count:', error);
    return 0;
  }
}

/**
 * Check if user is blocked
 */
async function isUserBlocked(userId) {
  try {
    const redis = getRedis();
    const userIdStr = String(userId);
    const blocked = await redis.get(`user:${userIdStr}:blocked_suspicious`);
    return !!blocked;
  } catch (error) {
    logger.error('Error checking user blocked status:', error);
    return false;
  }
}

/**
 * Manually unblock a user (admin function)
 */
async function unblockUser(userId) {
  try {
    const redis = getRedis();
    const userIdStr = String(userId);
    await redis.del(`user:${userIdStr}:blocked_suspicious`);
    await redis.del(`user:${userIdStr}:username_changes:24h`);
    await redis.del(`user:${userIdStr}:username_history`);

    logger.info('User unblocked manually', { userId: userIdStr });
    return true;
  } catch (error) {
    logger.error('Error unblocking user:', error);
    return false;
  }
}

/**
 * Create security logs table
 */
async function initSecurityLogsTable() {
  try {
    // Create table first
    await query(`
      CREATE TABLE IF NOT EXISTS user_security_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes separately
    await query(`CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON user_security_logs(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_security_event_type ON user_security_logs(event_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_security_created_at ON user_security_logs(created_at)`);

    logger.info('Security logs table initialized');
  } catch (error) {
    logger.debug('Security logs table already exists or error:', error.message);
  }
}

module.exports = {
  usernameChangeDetectionMiddleware,
  getUserChangeHistory,
  getUserChangeCount,
  isUserBlocked,
  unblockUser,
  initSecurityLogsTable,
};
