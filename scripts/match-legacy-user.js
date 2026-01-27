/**
 * Manual Legacy User Matching Script
 *
 * Usage:
 *   node scripts/match-legacy-user.js <telegram_user_id> <email>
 *
 * Example:
 *   node scripts/match-legacy-user.js 123456789 user@example.com
 */

require('dotenv').config();
const UserService = require('../src/bot/services/userService');
const UserModel = require('../src/models/userModel');

async function matchLegacyUser(telegramId, email) {
  console.log('='.repeat(50));
  console.log('MANUAL LEGACY USER MATCHING');
  console.log('='.repeat(50));
  console.log(`\nTelegram ID: ${telegramId}`);
  console.log(`Email: ${email}`);

  try {
    // Check if user exists
    const existingUser = await UserModel.getById(telegramId);

    if (!existingUser) {
      console.log('\n❌ User not found in database.');
      console.log('   The user needs to start the bot first.');
      return;
    }

    console.log(`\nCurrent user status:`);
    console.log(`  - Username: ${existingUser.username || 'N/A'}`);
    console.log(`  - Name: ${existingUser.firstName} ${existingUser.lastName || ''}`);
    console.log(`  - Email: ${existingUser.email || 'N/A'}`);
    console.log(`  - Subscription: ${existingUser.subscriptionStatus}`);
    console.log(`  - Plan: ${existingUser.planId || 'None'}`);

    // Check for legacy match
    const result = await UserService.checkLegacyAccount(telegramId, email);

    console.log('\n' + '-'.repeat(50));
    console.log('RESULT');
    console.log('-'.repeat(50));

    if (result.merged) {
      console.log(`\n✅ Legacy account merged successfully!`);
      console.log(`   Matched by: ${result.matchedBy}`);
      console.log(`   Plan restored: ${result.legacyPlan}`);
      console.log(`\n   New subscription status: ${result.user.subscriptionStatus}`);
      console.log(`   New plan: ${result.user.planId}`);
    } else {
      console.log(`\n⚠️  ${result.message}`);
    }

    // Show remaining legacy users count
    const { query } = require('../src/config/postgres');
    const countResult = await query(`SELECT COUNT(*) as count FROM users WHERE id LIKE 'legacy_%'`);
    console.log(`\nRemaining legacy users to match: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Parse command line arguments
const telegramId = process.argv[2];
const email = process.argv[3];

if (!telegramId || !email) {
  console.log('Usage: node scripts/match-legacy-user.js <telegram_user_id> <email>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/match-legacy-user.js 123456789 user@example.com');
  process.exit(1);
}

matchLegacyUser(telegramId, email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
