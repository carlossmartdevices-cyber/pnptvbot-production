/**
 * Unified Users Export Script
 *
 * Consolidates all users from:
 * - PostgreSQL database (primary)
 * - Legacy CSV imports (migrated from other server/Firestore)
 *
 * Uses placeholders for blank/missing fields
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/postgres');

const PLACEHOLDER = '---';

// Plan name mapping from legacy to new
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
      records.push({
        timestamp: values[0] || null,
        email: values[1]?.toLowerCase().trim() || null,
        username: values[2]?.replace(/^@/, '').trim() || null,
        legacyPlan: values[3] || null,
        planId: PLAN_MAPPING[values[3]] || null,
      });
    }
  }
  return records;
}

function applyPlaceholder(value) {
  if (value === null || value === undefined || value === '') {
    return PLACEHOLDER;
  }
  if (Array.isArray(value) && value.length === 0) {
    return PLACEHOLDER;
  }
  return value;
}

function formatUser(user, source = 'database') {
  return {
    // Identifiers
    id: applyPlaceholder(user.id),
    telegram_id: applyPlaceholder(user.telegram_id || user.id),
    username: applyPlaceholder(user.username),

    // Basic Info
    first_name: applyPlaceholder(user.first_name || user.firstName),
    last_name: applyPlaceholder(user.last_name || user.lastName),
    email: applyPlaceholder(user.email),
    email_verified: user.email_verified || false,

    // Profile
    bio: applyPlaceholder(user.bio),
    photo_file_id: applyPlaceholder(user.photo_file_id),
    interests: applyPlaceholder(user.interests),
    looking_for: applyPlaceholder(user.looking_for),
    tribe: applyPlaceholder(user.tribe),

    // Location
    location_lat: applyPlaceholder(user.location_lat),
    location_lng: applyPlaceholder(user.location_lng),
    location_name: applyPlaceholder(user.location_name),
    location_sharing_enabled: user.location_sharing_enabled !== false,

    // Subscription
    subscription_status: applyPlaceholder(user.subscription_status),
    plan_id: applyPlaceholder(user.plan_id || user.planId),
    plan_expiry: applyPlaceholder(user.plan_expiry),
    tier: applyPlaceholder(user.tier),
    auto_renew: user.auto_renew || false,
    subscription_type: applyPlaceholder(user.subscription_type),

    // Social Media
    instagram: applyPlaceholder(user.instagram),
    twitter: applyPlaceholder(user.twitter),
    tiktok: applyPlaceholder(user.tiktok),
    youtube: applyPlaceholder(user.youtube),
    telegram: applyPlaceholder(user.telegram),

    // Account Status
    role: applyPlaceholder(user.role),
    is_active: user.is_active !== false,
    onboarding_complete: user.onboarding_complete || false,
    age_verified: user.age_verified || false,
    terms_accepted: user.terms_accepted || false,

    // Engagement
    profile_views: user.profile_views || 0,
    xp: user.xp || 0,
    favorites: applyPlaceholder(user.favorites),
    badges: applyPlaceholder(user.badges),

    // Timestamps
    created_at: applyPlaceholder(user.created_at),
    updated_at: applyPlaceholder(user.updated_at),
    last_active: applyPlaceholder(user.last_active),

    // Meta
    language: applyPlaceholder(user.language),
    source: source,
    legacy_plan: applyPlaceholder(user.legacyPlan),
    legacy_import_date: applyPlaceholder(user.timestamp),
  };
}

async function exportUnifiedUsers() {
  console.log('='.repeat(60));
  console.log('UNIFIED USERS EXPORT');
  console.log('='.repeat(60));

  try {
    // 1. Get all users from PostgreSQL
    console.log('\n[1/4] Fetching users from PostgreSQL...');
    const dbResult = await query(`
      SELECT * FROM users
      ORDER BY created_at DESC
    `);
    const dbUsers = dbResult.rows;
    console.log(`   Found ${dbUsers.length} users in database`);

    // Create lookup maps
    const emailMap = new Map();
    const usernameMap = new Map();

    dbUsers.forEach(user => {
      if (user.email) {
        emailMap.set(user.email.toLowerCase().trim(), user);
      }
      if (user.username) {
        usernameMap.set(user.username.toLowerCase().trim(), user);
      }
    });

    // 2. Load legacy users from CSV
    console.log('\n[2/4] Loading legacy users from CSV...');
    const csvPath = path.join(__dirname, 'legacy-users.csv');
    let legacyUsers = [];

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      legacyUsers = parseCSV(csvContent);
      console.log(`   Found ${legacyUsers.length} legacy users in CSV`);
    } else {
      console.log('   No legacy CSV file found');
    }

    // 3. Match and merge legacy users
    console.log('\n[3/4] Matching legacy users...');
    const unifiedUsers = [];
    const matchedLegacy = new Set();
    const unmatchedLegacy = [];

    // Process database users
    dbUsers.forEach(user => {
      const formatted = formatUser(user, 'database');

      // Check if this user has legacy data
      const legacyMatch = legacyUsers.find(legacy => {
        if (legacy.email && user.email &&
            legacy.email.toLowerCase() === user.email.toLowerCase()) {
          return true;
        }
        if (legacy.username && user.username) {
          const cleanLegacy = legacy.username.toLowerCase().replace(/\s+/g, '');
          const cleanDb = user.username.toLowerCase().replace(/\s+/g, '');
          if (cleanLegacy === cleanDb) return true;
        }
        return false;
      });

      if (legacyMatch) {
        matchedLegacy.add(legacyMatch.email?.toLowerCase() || legacyMatch.username?.toLowerCase());
        formatted.source = 'database+legacy';
        formatted.legacy_plan = legacyMatch.legacyPlan || PLACEHOLDER;
        formatted.legacy_import_date = legacyMatch.timestamp || PLACEHOLDER;

        // If DB user doesn't have subscription but legacy does, note it
        if (formatted.plan_id === PLACEHOLDER && legacyMatch.planId) {
          formatted.plan_id = legacyMatch.planId;
          formatted.subscription_status = 'active';
        }
      }

      unifiedUsers.push(formatted);
    });

    // Add unmatched legacy users
    legacyUsers.forEach(legacy => {
      const key = legacy.email?.toLowerCase() || legacy.username?.toLowerCase();
      if (!matchedLegacy.has(key)) {
        const formatted = formatUser({
          id: `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          username: legacy.username,
          email: legacy.email,
          planId: legacy.planId,
          subscription_status: legacy.planId ? 'active' : 'free',
          legacyPlan: legacy.legacyPlan,
          timestamp: legacy.timestamp,
        }, 'legacy_unmatched');

        unifiedUsers.push(formatted);
        unmatchedLegacy.push(legacy);
      }
    });

    // 4. Generate reports
    console.log('\n[4/4] Generating export files...');

    // Summary stats
    const stats = {
      total_users: unifiedUsers.length,
      from_database: dbUsers.length,
      from_legacy_csv: legacyUsers.length,
      matched_legacy: matchedLegacy.size,
      unmatched_legacy: unmatchedLegacy.length,
      by_source: {
        database: unifiedUsers.filter(u => u.source === 'database').length,
        'database+legacy': unifiedUsers.filter(u => u.source === 'database+legacy').length,
        legacy_unmatched: unifiedUsers.filter(u => u.source === 'legacy_unmatched').length,
      },
      by_subscription_status: {},
      by_plan: {},
      with_email: unifiedUsers.filter(u => u.email !== PLACEHOLDER).length,
      with_username: unifiedUsers.filter(u => u.username !== PLACEHOLDER).length,
      onboarding_complete: unifiedUsers.filter(u => u.onboarding_complete).length,
      age_verified: unifiedUsers.filter(u => u.age_verified).length,
    };

    // Count by subscription status
    unifiedUsers.forEach(u => {
      const status = u.subscription_status === PLACEHOLDER ? 'unknown' : u.subscription_status;
      stats.by_subscription_status[status] = (stats.by_subscription_status[status] || 0) + 1;

      const plan = u.plan_id === PLACEHOLDER ? 'none' : u.plan_id;
      stats.by_plan[plan] = (stats.by_plan[plan] || 0) + 1;
    });

    // Save JSON export
    const jsonPath = path.join(__dirname, 'unified-users-export.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      exported_at: new Date().toISOString(),
      placeholder: PLACEHOLDER,
      stats,
      users: unifiedUsers,
    }, null, 2));

    // Save CSV export
    const csvExportPath = path.join(__dirname, 'unified-users-export.csv');
    const headers = Object.keys(unifiedUsers[0] || {});
    const csvLines = [
      headers.join(','),
      ...unifiedUsers.map(u =>
        headers.map(h => {
          const val = u[h];
          if (typeof val === 'object') return JSON.stringify(val);
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      )
    ];
    fs.writeFileSync(csvExportPath, csvLines.join('\n'));

    // Save unmatched legacy users for review
    if (unmatchedLegacy.length > 0) {
      const unmatchedPath = path.join(__dirname, 'unmatched-legacy-users.json');
      fs.writeFileSync(unmatchedPath, JSON.stringify({
        count: unmatchedLegacy.length,
        users: unmatchedLegacy,
      }, null, 2));
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('EXPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal unified users: ${stats.total_users}`);
    console.log(`\nSources:`);
    console.log(`  - Database only:     ${stats.by_source.database}`);
    console.log(`  - Database + Legacy: ${stats.by_source['database+legacy']}`);
    console.log(`  - Legacy unmatched:  ${stats.by_source.legacy_unmatched}`);
    console.log(`\nSubscription Status:`);
    Object.entries(stats.by_subscription_status).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });
    console.log(`\nPlan Distribution:`);
    Object.entries(stats.by_plan).sort((a, b) => b[1] - a[1]).forEach(([plan, count]) => {
      console.log(`  - ${plan}: ${count}`);
    });
    console.log(`\nData Completeness:`);
    console.log(`  - With email:            ${stats.with_email} (${(stats.with_email/stats.total_users*100).toFixed(1)}%)`);
    console.log(`  - With username:         ${stats.with_username} (${(stats.with_username/stats.total_users*100).toFixed(1)}%)`);
    console.log(`  - Onboarding complete:   ${stats.onboarding_complete} (${(stats.onboarding_complete/stats.total_users*100).toFixed(1)}%)`);
    console.log(`  - Age verified:          ${stats.age_verified} (${(stats.age_verified/stats.total_users*100).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(60));
    console.log('OUTPUT FILES');
    console.log('='.repeat(60));
    console.log(`\n  JSON: ${jsonPath}`);
    console.log(`  CSV:  ${csvExportPath}`);
    if (unmatchedLegacy.length > 0) {
      console.log(`  Unmatched: ${path.join(__dirname, 'unmatched-legacy-users.json')}`);
    }
    console.log('\n');

    return { stats, unifiedUsers };

  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

// Run export
if (require.main === module) {
  exportUnifiedUsers()
    .then(() => {
      console.log('Export completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Export failed:', error.message);
      process.exit(1);
    });
}

module.exports = { exportUnifiedUsers };
