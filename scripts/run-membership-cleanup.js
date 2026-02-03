#!/usr/bin/env node
/**
 * Manual Membership Cleanup Script
 * Run this to immediately update member statuses and kick expired users from PRIME channel
 *
 * Usage: node scripts/run-membership-cleanup.js [--dry-run] [--no-kick]
 *
 * Options:
 *   --dry-run   Show what would be done without making changes
 *   --no-kick   Only update statuses, don't kick users from channels
 */

require('dotenv').config({ allowEmptyValues: true });
const { Telegraf } = require('telegraf');
const { initializePostgres } = require('../src/config/postgres');
const MembershipCleanupService = require('../src/bot/services/membershipCleanupService');
const logger = require('../src/utils/logger');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const noKick = args.includes('--no-kick');

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Membership Cleanup Script');
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
    }
    if (noKick) {
      console.log('⚠️  NO-KICK MODE - Users will not be kicked from channels\n');
    }

    // Initialize database
    console.log('Initializing database connection...');
    await initializePostgres();
    console.log('✓ Database connected\n');

    // Initialize bot for channel operations (unless --no-kick)
    if (!noKick && !isDryRun) {
      console.log('Initializing bot...');
      const bot = new Telegraf(process.env.BOT_TOKEN);
      MembershipCleanupService.initialize(bot);
      console.log('✓ Bot initialized\n');
    }

    // Get current stats before cleanup
    console.log('Current membership stats:');
    const statsBefore = await MembershipCleanupService.getStats();
    if (statsBefore?.byStatus) {
      statsBefore.byStatus.forEach(row => {
        console.log(`  ${row.subscription_status}: ${row.count} users (${row.lifetime || 0} lifetime)`);
      });
    }
    console.log('');

    if (isDryRun) {
      // Dry run - show what would be done
      const { query } = require('../src/config/postgres');

      const expiredActive = await query(`
        SELECT id, username, plan_expiry, plan_id
        FROM users
        WHERE subscription_status = 'active'
        AND plan_expiry IS NOT NULL
        AND plan_expiry <= NOW()
      `);
      console.log(`Would update ${expiredActive.rows.length} users from 'active' to 'churned':`);
      expiredActive.rows.forEach(u => {
        console.log(`  - ${u.id} (${u.username || 'no username'}) - expired ${u.plan_expiry}`);
      });

      const expiredStatus = await query(`
        SELECT id, username FROM users WHERE subscription_status = 'expired'
      `);
      console.log(`\nWould update ${expiredStatus.rows.length} users from 'expired' to 'churned'`);

      console.log('\n✓ Dry run complete - no changes made');
    } else {
      // Run actual cleanup
      console.log('Running membership cleanup...\n');

      if (noKick) {
        // Only update statuses
        const statusResults = await MembershipCleanupService.updateAllSubscriptionStatuses();
        console.log('\nStatus update results:');
        console.log(`  Updated to churned: ${statusResults.toChurned}`);
        console.log(`  Errors: ${statusResults.errors}`);
      } else {
        // Full cleanup including kicks
        const results = await MembershipCleanupService.runFullCleanup();
        console.log('\nCleanup results:');
        console.log('  Status updates:');
        console.log(`    - Updated to churned: ${results.statusUpdates.toChurned}`);
        console.log(`    - Errors: ${results.statusUpdates.errors}`);
        console.log('  Channel kicks:');
        console.log(`    - Kicked: ${results.channelKicks.kicked}`);
        console.log(`    - Failed: ${results.channelKicks.failed}`);
        console.log(`    - Skipped: ${results.channelKicks.skipped}`);
      }

      // Get stats after cleanup
      console.log('\nMembership stats after cleanup:');
      const statsAfter = await MembershipCleanupService.getStats();
      if (statsAfter?.byStatus) {
        statsAfter.byStatus.forEach(row => {
          console.log(`  ${row.subscription_status}: ${row.count} users`);
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Cleanup script completed successfully');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Error running cleanup:', error);
    process.exit(1);
  }
}

main();
