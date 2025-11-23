/**
 * Script to import legacy users from CSV and map old plan names to new ones
 * Usage: node scripts/import-legacy-users.js <csv-file-path>
 *
 * CSV format expected:
 * Timestamp, Email Address, Telegram User name, What PRIME plan are you subscribed to?
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const UserModel = require('../src/models/userModel');
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

// Plan name mapping from old to new
const PLAN_MAPPING = {
  'PRIME Lifetime Pass': 'lifetime_pass',
  'PRIME Yearly Pass': 'diamond_member',
  'PRIME Monthly Subscription': 'pnp_member',
  'Week Trial': 'trial_week',
  // Alternative variations
  'Lifetime Pass': 'lifetime_pass',
  'Yearly Pass': 'diamond_member',
  'Monthly Subscription': 'pnp_member',
  'Monthly Pass': 'pnp_member',
  'Trial Week': 'trial_week',
};

// Plan durations in days
const PLAN_DURATIONS = {
  'lifetime_pass': null, // No expiry
  'diamond_member': 365,
  'pnp_member': 30,
  'trial_week': 7,
};

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= 4) {
      records.push({
        timestamp: values[0],
        email: values[1],
        username: values[2].replace('@', ''), // Remove @ if present
        oldPlanName: values[3],
      });
    }
  }

  return records;
}

async function importUsers(csvPath) {
  try {
    // Read CSV file
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(content);

    console.log(`\nFound ${records.length} records to import\n`);

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const record of records) {
      try {
        // Map old plan name to new plan ID
        const newPlanId = PLAN_MAPPING[record.oldPlanName];

        if (!newPlanId) {
          console.log(`⚠️  Unknown plan "${record.oldPlanName}" for user @${record.username}`);
          results.skipped++;
          results.details.push({
            username: record.username,
            status: 'skipped',
            reason: `Unknown plan: ${record.oldPlanName}`,
          });
          continue;
        }

        // Try to find user by username (exact match, case insensitive)
        const cleanUsername = record.username.replace(/^@/, '').trim();
        let result = await query(
          'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
          [cleanUsername]
        );

        let user = result.rows.length > 0 ? result.rows[0] : null;
        let matchedBy = 'username';

        // If not found by username, try to find by email
        if (!user && record.email) {
          const emailResult = await query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [record.email.trim()]
          );
          if (emailResult.rows.length > 0) {
            user = emailResult.rows[0];
            matchedBy = 'email';
          }
        }

        if (!user) {
          console.log(`⚠️  User not found: @${record.username} (${record.email})`);
          results.skipped++;
          results.details.push({
            username: record.username,
            email: record.email,
            status: 'skipped',
            reason: 'User not found in database',
            suggestedPlan: newPlanId,
          });
          continue;
        }

        // Calculate expiry date
        let expiry = null;
        const duration = PLAN_DURATIONS[newPlanId];
        if (duration) {
          expiry = new Date();
          expiry.setDate(expiry.getDate() + duration);
        }

        // Update subscription
        const subscription = {
          status: 'active',
          planId: newPlanId,
          expiry: expiry,
        };

        const success = await UserModel.updateSubscription(user.id, subscription);

        if (success) {
          const matchInfo = matchedBy === 'email' ? ` (matched by email: ${record.email})` : '';
          console.log(`✅ ${user.username || record.username}: ${record.oldPlanName} → ${newPlanId}${matchInfo}`);
          results.success++;
          results.details.push({
            username: user.username || record.username,
            userId: user.id,
            status: 'success',
            oldPlan: record.oldPlanName,
            newPlan: newPlanId,
            matchedBy: matchedBy,
          });
        } else {
          console.log(`❌ Failed to update @${record.username}`);
          results.failed++;
          results.details.push({
            username: record.username,
            status: 'failed',
            reason: 'Update failed',
          });
        }

      } catch (error) {
        console.log(`❌ Error processing @${record.username}: ${error.message}`);
        results.failed++;
        results.details.push({
          username: record.username,
          status: 'failed',
          reason: error.message,
        });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Skipped: ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log('='.repeat(50));

    // Save detailed results to file
    const resultsPath = path.join(__dirname, 'import-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results saved to: ${resultsPath}`);

    return results;

  } catch (error) {
    logger.error('Import failed:', error);
    throw error;
  }
}

// Get CSV path from command line
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node scripts/import-legacy-users.js <csv-file-path>');
  console.error('\nExpected CSV format:');
  console.error('Timestamp, Email Address, Telegram User name, What PRIME plan are you subscribed to?');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

// Run import
importUsers(csvPath)
  .then((results) => {
    if (results.failed === 0) {
      console.log('\n✅ Import completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Import completed with some failures');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  });
