/**
 * Import Unmatched Legacy Users
 *
 * Imports legacy users who haven't joined the bot yet.
 * Creates placeholder records that can be matched when they join.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/postgres');
const crypto = require('crypto');

// Plan name mapping
const PLAN_MAPPING = {
  'PRIME Lifetime Pass': 'lifetime_pass',
  'PRIME Yearly Pass': 'diamond_member',
  'PRIME Monthly Subscription': 'pnp_member',
  'Week Trial': 'trial_week',
  'Lifetime Pass': 'lifetime_pass',
  'Yearly Pass': 'diamond_member',
  'Monthly Subscription': 'pnp_member',
  'Monthly Pass': 'pnp_member',
  'Trial Week': 'trial_week',
};

// Plan durations in days (null = lifetime)
const PLAN_DURATIONS = {
  'lifetime_pass': null,
  'diamond_member': 365,
  'pnp_member': 30,
  'trial_week': 7,
};

function generatePlaceholderId(email, username) {
  const input = email || username || Date.now().toString();
  const hash = crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
  return `legacy_${hash}`;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
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
      const legacyPlan = values[3];
      const planId = PLAN_MAPPING[legacyPlan];

      records.push({
        timestamp: values[0] || null,
        email: values[1]?.toLowerCase().trim() || null,
        username: values[2]?.replace(/^@/, '').trim() || null,
        legacyPlan: legacyPlan,
        planId: planId || null,
      });
    }
  }
  return records;
}

async function importUnmatchedLegacyUsers() {
  console.log('='.repeat(60));
  console.log('IMPORT UNMATCHED LEGACY USERS');
  console.log('='.repeat(60));

  try {
    // Load unmatched users
    const unmatchedPath = path.join(__dirname, 'unmatched-legacy-users.json');

    if (!fs.existsSync(unmatchedPath)) {
      console.log('\nNo unmatched-legacy-users.json found.');
      console.log('Run export-unified-users.js first to identify unmatched users.');
      process.exit(1);
    }

    const unmatchedData = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8'));
    const legacyUsers = unmatchedData.users;

    console.log(`\nFound ${legacyUsers.length} unmatched legacy users to import\n`);

    // Check for existing emails/usernames to avoid duplicates
    const existingEmails = new Set();
    const existingUsernames = new Set();

    const emailResult = await query(`
      SELECT LOWER(email) as email FROM users WHERE email IS NOT NULL AND email != ''
    `);
    emailResult.rows.forEach(r => existingEmails.add(r.email));

    const usernameResult = await query(`
      SELECT LOWER(username) as username FROM users WHERE username IS NOT NULL AND username != ''
    `);
    usernameResult.rows.forEach(r => existingUsernames.add(r.username));

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const user of legacyUsers) {
      try {
        // Check if already exists
        if (user.email && existingEmails.has(user.email.toLowerCase())) {
          console.log(`⚠️  Skipping ${user.email} - email already exists`);
          results.skipped++;
          results.details.push({ ...user, status: 'skipped', reason: 'email exists' });
          continue;
        }

        if (user.username && existingUsernames.has(user.username.toLowerCase())) {
          console.log(`⚠️  Skipping @${user.username} - username already exists`);
          results.skipped++;
          results.details.push({ ...user, status: 'skipped', reason: 'username exists' });
          continue;
        }

        // Generate placeholder ID
        const placeholderId = generatePlaceholderId(user.email, user.username);

        // Calculate plan expiry
        let planExpiry = null;
        if (user.planId && PLAN_DURATIONS[user.planId]) {
          planExpiry = new Date();
          planExpiry.setDate(planExpiry.getDate() + PLAN_DURATIONS[user.planId]);
        }

        // Determine tier based on plan
        let tier = 'Free';
        if (user.planId === 'lifetime_pass') tier = 'Prime';
        else if (user.planId === 'diamond_member') tier = 'Prime';
        else if (user.planId === 'pnp_member') tier = 'Prime';
        else if (user.planId === 'trial_week') tier = 'Prime';

        // Insert user
        const sql = `
          INSERT INTO users (
            id, username, first_name, last_name, email, email_verified,
            subscription_status, plan_id, plan_expiry, tier, role,
            privacy, profile_views, xp, favorites, blocked, badges,
            onboarding_complete, age_verified, terms_accepted, privacy_accepted,
            language, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21,
            $22, $23, $24, $25
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;

        // Extract first name from username if available
        const firstName = user.username ?
          user.username.replace(/[_\d]+/g, ' ').trim().split(' ')[0] || 'Legacy User' :
          'Legacy User';

        const values = [
          placeholderId,                                    // id
          user.username || null,                            // username
          firstName,                                        // first_name
          null,                                             // last_name
          user.email || null,                               // email
          false,                                            // email_verified
          user.planId ? 'active' : 'free',                  // subscription_status
          user.planId || null,                              // plan_id
          planExpiry,                                       // plan_expiry
          tier,                                             // tier
          'user',                                           // role
          JSON.stringify({                                  // privacy
            showLocation: true,
            showInterests: true,
            showBio: true,
            allowMessages: true,
            showOnline: true
          }),
          0,                                                // profile_views
          0,                                                // xp
          [],                                               // favorites
          [],                                               // blocked
          ['legacy_member'],                                // badges - mark as legacy
          false,                                            // onboarding_complete
          false,                                            // age_verified
          false,                                            // terms_accepted
          false,                                            // privacy_accepted
          'en',                                             // language
          true,                                             // is_active
          new Date(),                                       // created_at
          new Date(),                                       // updated_at
        ];

        const result = await query(sql, values);

        if (result.rows.length > 0) {
          console.log(`✅ Imported: ${user.email || user.username} → ${placeholderId} (${user.planId || 'free'})`);
          results.imported++;
          results.details.push({ ...user, status: 'imported', id: placeholderId });

          // Track to prevent duplicates in this run
          if (user.email) existingEmails.add(user.email.toLowerCase());
          if (user.username) existingUsernames.add(user.username.toLowerCase());
        } else {
          console.log(`⚠️  Skipped: ${user.email || user.username} - ID conflict`);
          results.skipped++;
          results.details.push({ ...user, status: 'skipped', reason: 'id conflict' });
        }

      } catch (error) {
        console.log(`❌ Failed: ${user.email || user.username} - ${error.message}`);
        results.failed++;
        results.details.push({ ...user, status: 'failed', error: error.message });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${results.imported}`);
    console.log(`⚠️  Skipped:  ${results.skipped}`);
    console.log(`❌ Failed:   ${results.failed}`);
    console.log('='.repeat(60));

    // Save results
    const resultsPath = path.join(__dirname, 'legacy-import-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);

    // Show plan breakdown
    const planCounts = {};
    results.details
      .filter(d => d.status === 'imported')
      .forEach(d => {
        const plan = d.planId || 'none';
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });

    if (Object.keys(planCounts).length > 0) {
      console.log('\nImported by plan:');
      Object.entries(planCounts).sort((a, b) => b[1] - a[1]).forEach(([plan, count]) => {
        console.log(`  - ${plan}: ${count}`);
      });
    }

    return results;

  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
}

// Run import
if (require.main === module) {
  importUnmatchedLegacyUsers()
    .then((results) => {
      console.log('\nImport completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\nImport failed:', error.message);
      process.exit(1);
    });
}

module.exports = { importUnmatchedLegacyUsers };
