#!/usr/bin/env node

/**
 * Script to fix tier capitalization inconsistencies
 *
 * PROBLEM: Inconsistent capitalization in tier field (e.g., "free" vs "Free")
 * SOLUTION: Normalize all tier values to use proper capitalization
 */

const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isDryRun = process.argv.includes('--dry-run');

// Standard tier capitalization
const TIER_NORMALIZATION = {
  'free': 'Free',
  'Free': 'Free',
  'basic': 'Basic',
  'Basic': 'Basic',
  'premium': 'Premium',
  'Premium': 'Premium',
  'crystal': 'Crystal',
  'Crystal': 'Crystal',
  'diamond': 'Diamond',
  'Diamond': 'Diamond',
  'pnp': 'PNP',
  'PNP': 'PNP',
  'Pnp': 'PNP'
};

async function fixTierCapitalization() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 FIX TIER CAPITALIZATION');
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

    // Get current tier distribution
    const tierDistributionResult = await query(`
      SELECT tier, COUNT(*) as count
      FROM users
      GROUP BY tier
      ORDER BY tier
    `);

    console.log('\nCurrent tier distribution:');
    console.log('='.repeat(70));
    tierDistributionResult.rows.forEach(row => {
      const normalized = TIER_NORMALIZATION[row.tier] || row.tier;
      const needsFix = normalized !== row.tier;
      console.log(`  ${row.tier}: ${row.count} users ${needsFix ? `→ will change to "${normalized}"` : '✓'}`);
    });
    console.log();

    // Find users with incorrect capitalization
    const usersToFix = [];
    for (const [incorrectTier, correctTier] of Object.entries(TIER_NORMALIZATION)) {
      if (incorrectTier !== correctTier) {
        const result = await query(
          'SELECT id, username, tier FROM users WHERE tier = $1',
          [incorrectTier]
        );

        result.rows.forEach(user => {
          usersToFix.push({
            ...user,
            correct_tier: correctTier
          });
        });
      }
    }

    console.log('='.repeat(70));
    console.log(`\nFound ${usersToFix.length} users with incorrect tier capitalization\n`);

    if (usersToFix.length === 0) {
      console.log('✅ No users need tier capitalization fixes!');
      process.exit(0);
    }

    // Group by tier change
    const changeGroups = {};
    usersToFix.forEach(user => {
      const key = `${user.tier} → ${user.correct_tier}`;
      if (!changeGroups[key]) {
        changeGroups[key] = [];
      }
      changeGroups[key].push(user);
    });

    console.log('Changes to be made:');
    console.log('='.repeat(70));
    Object.entries(changeGroups).forEach(([change, users]) => {
      console.log(`  ${change}: ${users.length} users`);
    });
    console.log();

    if (!isDryRun) {
      console.log('⏳ Applying changes...\n');
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of usersToFix) {
      if (!isDryRun) {
        try {
          await query(
            'UPDATE users SET tier = $1, updated_at = $2 WHERE id = $3',
            [user.correct_tier, new Date(), user.id]
          );
          updatedCount++;

          if (updatedCount % 50 === 0) {
            console.log(`  Progress: ${updatedCount}/${usersToFix.length} users updated`);
          }
        } catch (error) {
          errorCount++;
          console.error(`  ❌ Error updating user ${user.id}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CAPITALIZATION FIX COMPLETE!');
    console.log('='.repeat(70));
    console.log(`\nTotal users affected: ${usersToFix.length}`);

    if (!isDryRun) {
      console.log(`Successfully updated: ${updatedCount}`);
      console.log(`Failed: ${errorCount}`);

      // Show new distribution
      const newDistributionResult = await query(`
        SELECT tier, COUNT(*) as count
        FROM users
        GROUP BY tier
        ORDER BY tier
      `);

      console.log('\nNew tier distribution:');
      console.log('='.repeat(70));
      newDistributionResult.rows.forEach(row => {
        console.log(`  ${row.tier}: ${row.count} users`);
      });
    } else {
      console.log('\n💡 Run without --dry-run to apply changes:');
      console.log('   node scripts/fix-tier-capitalization.js');
    }
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fix failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixTierCapitalization();
