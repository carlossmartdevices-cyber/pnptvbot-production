#!/usr/bin/env node

/**
 * Script to restore Premium users who were downgraded during migration
 *
 * PROBLEM IDENTIFIED:
 * - 70 users have tier="Premium" but subscription_status="free"
 * - These users should have subscription_status="active"
 * - The bot checks subscription_status to grant premium features, not tier
 *
 * SOLUTION:
 * - Update users with tier IN ('Premium', 'Crystal', 'Diamond', 'PNP')
 * - Set subscription_status to 'active'
 * - Assign appropriate plan_id based on their tier
 * - Set a reasonable plan_expiry (1 year from now, or ask for lifetime)
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isDryRun = process.argv.includes('--dry-run');
const setLifetime = process.argv.includes('--lifetime');

async function restorePremiumUsers() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 RESTORE PREMIUM USERS');
  console.log('='.repeat(70));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('\n⚠️  LIVE MODE - Changes will be applied!\n');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Initialize PostgreSQL
    initializePostgres();

    // Get affected users
    const affectedUsersResult = await query(`
      SELECT id, username, tier, subscription_status, plan_id, plan_expiry
      FROM users
      WHERE tier IN ('Premium', 'Crystal', 'Diamond', 'PNP', 'Basic')
      AND subscription_status IN ('free', 'inactive')
      ORDER BY tier, id
    `);

    console.log(`\nFound ${affectedUsersResult.rows.length} users to restore:\n`);

    // Group by tier
    const usersByTier = {};
    affectedUsersResult.rows.forEach(user => {
      const tier = user.tier || 'Unknown';
      if (!usersByTier[tier]) {
        usersByTier[tier] = [];
      }
      usersByTier[tier].push(user);
    });

    // Display summary
    console.log('Users by tier:');
    Object.keys(usersByTier).forEach(tier => {
      console.log(`  ${tier}: ${usersByTier[tier].length} users`);
    });
    console.log();

    if (affectedUsersResult.rows.length === 0) {
      console.log('✅ No users need to be restored!');
      process.exit(0);
    }

    // Ask for confirmation
    console.log('='.repeat(70));
    console.log('\nThe following actions will be performed:\n');
    console.log('1. Set subscription_status = "active" for all affected users');
    console.log('2. Assign plan_id based on tier:');
    console.log('   - Premium tier → "lifetime-pass" plan');
    console.log('   - Crystal tier → "crystal-member" plan');
    console.log('   - Diamond tier → "diamond-member" plan');
    console.log('   - PNP tier → "pnp-member" plan');
    console.log('   - Basic tier → "trial-week" plan');

    if (setLifetime) {
      console.log('3. Set plan_expiry = NULL (lifetime access)');
    } else {
      console.log('3. Set plan_expiry = 1 year from now');
    }
    console.log();
    console.log('='.repeat(70));
    console.log();

    if (!isDryRun) {
      console.log('⏳ Applying changes...\n');
    }

    let updatedCount = 0;
    const planExpiry = setLifetime ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    for (const user of affectedUsersResult.rows) {
      // Determine plan_id based on tier
      let planId;
      switch (user.tier) {
        case 'Premium':
          planId = 'lifetime-pass';
          break;
        case 'Crystal':
          planId = 'crystal-member';
          break;
        case 'Diamond':
          planId = 'diamond-member';
          break;
        case 'PNP':
          planId = 'pnp-member';
          break;
        case 'Basic':
          planId = 'trial-week';
          break;
        default:
          console.log(`⚠️  Unknown tier "${user.tier}" for user ${user.id}, skipping`);
          continue;
      }

      console.log(`  Restoring user ${user.id} (@${user.username || 'no-username'}): tier=${user.tier}, plan=${planId}`);

      if (!isDryRun) {
        try {
          await query(
            `UPDATE users
             SET subscription_status = $1,
                 plan_id = $2,
                 plan_expiry = $3,
                 updated_at = $4
             WHERE id = $5`,
            ['active', planId, planExpiry, new Date(), user.id]
          );
          updatedCount++;
        } catch (error) {
          console.error(`  ❌ Error updating user ${user.id}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ RESTORATION COMPLETE!');
    console.log('='.repeat(70));
    console.log(`\nTotal users affected: ${affectedUsersResult.rows.length}`);

    if (!isDryRun) {
      console.log(`Successfully updated: ${updatedCount}`);
      console.log(`Failed: ${affectedUsersResult.rows.length - updatedCount}`);
    } else {
      console.log('\n💡 Run without --dry-run to apply changes:');
      console.log('   node scripts/restore-premium-users.js');
      console.log('\nOr with --lifetime flag for lifetime access:');
      console.log('   node scripts/restore-premium-users.js --lifetime');
    }
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Restoration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

restorePremiumUsers();
