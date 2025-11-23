/**
 * Script to update legacy user memberships by email
 * Parsed from user-provided data
 */

require('dotenv').config();

const UserModel = require('../src/models/userModel');

// Plan durations in days
const PLAN_DURATIONS = {
  'lifetime_pass': null, // No expiry
  'diamond_member': 365,
  'pnp_member': 30,
  'trial_week': 7,
};

// Users to update (parsed from provided data)
const usersToUpdate = [
  { email: 'ssbbpp@gmail.com', plan: 'lifetime_pass' },
  { email: 'jarche67@gmail.com', plan: 'lifetime_pass' },
  { email: 'sirdan1989@gmail.com', plan: 'trial_week' },
  { email: 'eric.74.oleary@icloud.com', plan: 'lifetime_pass' },
  { email: 'elvindelrio1@gmail.com', plan: 'trial_week' },
  { email: 'romeoshafi_99@yahoo.com', plan: 'trial_week' },
  { email: 'koelndream@gmail.com', plan: 'lifetime_pass' },
  { email: 'mnaf1893@gmail.com', plan: 'trial_week' },
  { email: 'viennanouvelle@gmail.com', plan: 'trial_week' },
  { email: 'latinman8869@gmail.com', plan: 'diamond_member' },
  { email: 'dp052601@gmail.com', plan: 'trial_week' },
  { email: 'britohumberto@yahoo.com', plan: 'trial_week' },
  { email: 'drvivekns@gmail.com', plan: 'trial_week' },
];

async function updateMemberships() {
  console.log(`\nUpdating ${usersToUpdate.length} user memberships\n`);

  const results = {
    success: 0,
    notFound: 0,
    failed: 0,
    details: [],
  };

  for (const userData of usersToUpdate) {
    try {
      // Find user by email using search
      const users = await UserModel.search(userData.email);
      // Find exact email match
      const user = users.find(u => u.email && u.email.toLowerCase() === userData.email.toLowerCase());

      if (!user) {
        console.log(`⚠️  User not found: ${userData.email}`);
        results.notFound++;
        results.details.push({
          email: userData.email,
          status: 'not_found',
          suggestedPlan: userData.plan,
        });
        continue;
      }

      // Calculate expiry date
      let expiry = null;
      const duration = PLAN_DURATIONS[userData.plan];
      if (duration) {
        expiry = new Date();
        expiry.setDate(expiry.getDate() + duration);
      }

      // Update subscription
      const subscription = {
        status: 'active',
        planId: userData.plan,
        expiry: expiry,
      };

      const success = await UserModel.updateSubscription(user.id, subscription);

      if (success) {
        console.log(`✅ ${userData.email} (ID: ${user.id}, @${user.username || 'N/A'}): → ${userData.plan}`);
        results.success++;
        results.details.push({
          email: userData.email,
          userId: user.id,
          username: user.username,
          status: 'success',
          plan: userData.plan,
          expiry: expiry ? expiry.toISOString() : 'never',
        });
      } else {
        console.log(`❌ Failed to update ${userData.email}`);
        results.failed++;
        results.details.push({
          email: userData.email,
          status: 'failed',
          reason: 'Update failed',
        });
      }

    } catch (error) {
      console.log(`❌ Error processing ${userData.email}: ${error.message}`);
      results.failed++;
      results.details.push({
        email: userData.email,
        status: 'failed',
        reason: error.message,
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('UPDATE SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${results.success}`);
  console.log(`⚠️  Not found: ${results.notFound}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));

  return results;
}

// Run update
updateMemberships()
  .then((results) => {
    if (results.failed === 0 && results.notFound === 0) {
      console.log('\n✅ All updates completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Update completed with some issues');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error.message);
    process.exit(1);
  });
