require('dotenv-safe').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const { query } = require('./src/config/postgres');
const logger = require('./src/utils/logger');

const bot = new Telegraf(process.env.BOT_TOKEN);
const PRIME_CHANNEL_ID = process.env.PRIME_CHANNEL_ID || -1002997324714;

/**
 * Find all expired users across all subscription plans
 * Includes users marked as 'active' with past expiry dates
 * AND users already marked as 'expired' status
 */
async function getExpiredPassUsers() {
  try {
    const result = await query(
      `SELECT
        id,
        username,
        first_name,
        last_name,
        subscription_status,
        plan_id,
        plan_expiry,
        tier
      FROM users
      WHERE (
        (subscription_status = 'active' AND plan_expiry IS NOT NULL AND plan_expiry <= NOW())
        OR subscription_status = 'expired'
      )
      ORDER BY plan_expiry ASC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error fetching expired users:', error);
    throw error;
  }
}

/**
 * Remove user from PRIME channel with retry logic
 */
async function removeUserFromPrimeChannel(userId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.telegram.banChatMember(PRIME_CHANNEL_ID, userId);
      logger.info(`✓ Removed user ${userId} from PRIME channel`);
      return { success: true, userId };
    } catch (error) {
      const errorStr = JSON.stringify(error);

      // Check for permanent errors (not worth retrying)
      if (errorStr.includes('user not found') || errorStr.includes('member not in')) {
        logger.info(`⚠ User ${userId} not in PRIME channel`);
        return { success: true, userId, reason: 'not_found' };
      }

      // Check if it's a timeout/temporary error
      if (errorStr.includes('ETIMEDOUT') || errorStr.includes('ECONNREFUSED') || errorStr.includes('503')) {
        if (attempt < maxRetries) {
          const waitTime = Math.min(5000 * attempt, 15000); // exponential backoff, max 15s
          console.log(`  ⏳ Timeout error (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      logger.error(`✗ Failed to remove user ${userId}:`, error.message);
      return { success: false, userId, error: error.message };
    }
  }
}

/**
 * Update user subscription status to expired (bulk operation)
 */
async function updateUserToExpired(userId) {
  try {
    await query(
      `UPDATE users
       SET subscription_status = 'expired',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    return true;
  } catch (error) {
    logger.error(`Error updating user ${userId} status:`, error);
    return false;
  }
}

/**
 * Bulk update all expired users in database
 */
async function bulkUpdateExpiredUsers(userIds) {
  try {
    if (userIds.length === 0) return 0;

    const result = await query(
      `UPDATE users
       SET subscription_status = 'expired',
           updated_at = NOW()
       WHERE id = ANY($1::text[])`,
      [userIds]
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Error bulk updating users:', error);
    return 0;
  }
}

/**
 * Main cleanup function
 */
async function cleanupExpiredUsers() {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Cleaning up All Expired Subscription Users║');
    console.log('╚════════════════════════════════════════════╝\n');

    // Get expired users
    const expiredUsers = await getExpiredPassUsers();
    console.log(`Found ${expiredUsers.length} expired users across all subscription plans\n`);

    if (expiredUsers.length === 0) {
      console.log('✓ No expired users found. Everything is up to date.\n');
      process.exit(0);
    }

    // Separate users by status
    const activeExpiredUsers = expiredUsers.filter(u => u.subscription_status === 'active');
    const alreadyExpiredUsers = expiredUsers.filter(u => u.subscription_status === 'expired');

    // Process each expired user
    const results = {
      removed: [],
      notFound: [],
      failed: [],
      updated: 0,
      alreadyExpired: 0
    };

    // First, bulk update all active users that are expired
    if (activeExpiredUsers.length > 0) {
      console.log(`\nBulk updating ${activeExpiredUsers.length} active users with expired dates...\n`);
      const updateCount = await bulkUpdateExpiredUsers(activeExpiredUsers.map(u => u.id));
      results.updated = updateCount;
      console.log(`✓ Database updated: ${updateCount} users marked as expired\n`);
    }

    // Skip removing already expired users from channel (they're already processed)
    if (alreadyExpiredUsers.length > 0) {
      results.alreadyExpired = alreadyExpiredUsers.length;
      console.log(`⚠ Skipping ${alreadyExpiredUsers.length} users already marked as expired\n`);
    }

    // Now handle the Telegram removals for all expired users
    console.log(`Removing ${expiredUsers.length} users from PRIME channel...\n`);
    for (const user of expiredUsers) {
      console.log(`Processing: ${user.first_name} ${user.last_name || ''} (@${user.username || user.id})`);
      console.log(`  Plan: ${user.plan_id} | Expired: ${new Date(user.plan_expiry).toLocaleDateString()}`);

      // Remove from PRIME channel
      const removalResult = await removeUserFromPrimeChannel(user.id);

      if (removalResult.success) {
        if (removalResult.reason === 'not_found') {
          results.notFound.push(user.id);
          console.log(`  ⚠ Not in PRIME channel`);
        } else {
          results.removed.push(user.id);
          console.log(`  ✓ Removed from PRIME channel`);
        }
      } else {
        results.failed.push({ userId: user.id, error: removalResult.error });
        console.log(`  ✗ Failed: ${removalResult.error}`);
      }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  CLEANUP SUMMARY                           ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(`✓ Removed from PRIME: ${results.removed.length} users`);
    console.log(`⚠ Not in PRIME channel: ${results.notFound.length} users`);
    console.log(`✗ Failed removals: ${results.failed.length}`);
    console.log(`✓ Database status updated: ${results.updated} users\n`);

    if (results.failed.length > 0) {
      console.log('Failed removals:');
      results.failed.forEach(f => {
        console.log(`  • User ${f.userId}: ${f.error}`);
      });
      console.log('');
    }

    process.exit(results.failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupExpiredUsers().catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});