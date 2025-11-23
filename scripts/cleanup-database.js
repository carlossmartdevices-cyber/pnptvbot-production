#!/usr/bin/env node

/**
 * Script to clean up unused and redundant database fields
 * Usage: node scripts/cleanup-database.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Check if dry-run mode
const isDryRun = process.argv.includes('--dry-run');

/**
 * Fields to remove from users collection
 * These are either duplicates, obsolete, or very rarely used
 */
const USERS_FIELDS_TO_REMOVE = [
  'isAdmin',              // Obsolete - replaced by 'role' field
  'subscriptionActive',   // Duplicate of subscriptionStatus
  'membershipIsPremium',  // Duplicate of tier field
  'badge',                // Singular version - we use 'badges' array
  'privacySettings',      // Duplicate of 'privacy'
  'photoUrl',             // Obsolete - replaced by photoFileId
  'adsOptOut',            // Barely used (1%)
  'membershipExpiredAt',  // Duplicate of planExpiry
  'subscriptionEnd',      // Duplicate of planExpiry
  'subscriptionStart',    // Not consistently used
  'credits',              // Feature not implemented
  'lastPaymentId',        // Not used in code
];

/**
 * Fields to migrate/consolidate
 */
const FIELDS_TO_MIGRATE = {
  // If badge exists but badges is empty, move badge to badges array
  badge_to_badges: true,
  // Consolidate privacy fields
  privacySettings_to_privacy: true,
};

/**
 * Clean up users collection
 */
async function cleanupUsers() {
  console.log('\n🧹 Cleaning up users collection...\n');

  try {
    // Get all users in batches
    let processedCount = 0;
    let updatedCount = 0;
    let lastDoc = null;
    const batchSize = 100;

    while (true) {
      let query = db.collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        break;
      }

      // Process each user
      for (const doc of snapshot.docs) {
        processedCount++;
        const data = doc.data();
        const updates = {};
        let needsUpdate = false;

        // Migrate badge -> badges
        if (data.badge && (!data.badges || data.badges.length === 0)) {
          updates.badges = [data.badge];
          needsUpdate = true;
          console.log(`   Migrating badge to badges for user ${doc.id}`);
        }

        // Migrate privacySettings -> privacy
        if (data.privacySettings && typeof data.privacySettings === 'object') {
          updates.privacy = { ...data.privacy, ...data.privacySettings };
          needsUpdate = true;
          console.log(`   Consolidating privacy settings for user ${doc.id}`);
        }

        // Remove obsolete fields
        const fieldsToDelete = {};
        USERS_FIELDS_TO_REMOVE.forEach(field => {
          if (data.hasOwnProperty(field)) {
            fieldsToDelete[field] = FieldValue.delete();
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          const finalUpdates = { ...updates, ...fieldsToDelete };

          if (isDryRun) {
            console.log(`   [DRY RUN] Would update user ${doc.id}:`, Object.keys(finalUpdates));
          } else {
            await doc.ref.update(finalUpdates);
            updatedCount++;
            console.log(`   ✓ Updated user ${doc.id}`);
          }
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`   Progress: ${processedCount} users processed, ${updatedCount} updated`);
    }

    console.log(`\n   ✅ Users cleanup complete!`);
    console.log(`   📊 Total processed: ${processedCount}`);
    console.log(`   📝 Total updated: ${updatedCount}`);

  } catch (error) {
    console.error('   ❌ Error cleaning up users:', error);
    throw error;
  }
}

/**
 * Clean up payments collection
 */
async function cleanupPayments() {
  console.log('\n🧹 Cleaning up payments collection...\n');

  try {
    const PAYMENTS_FIELDS_TO_REMOVE = [
      'activatedAt',      // Rarely used, duplicates completedAt
      'activatedBy',      // Rarely used, duplicates completedBy
    ];

    let processedCount = 0;
    let updatedCount = 0;
    let lastDoc = null;
    const batchSize = 100;

    while (true) {
      let query = db.collection('payments')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        break;
      }

      for (const doc of snapshot.docs) {
        processedCount++;
        const data = doc.data();
        const fieldsToDelete = {};
        let needsUpdate = false;

        PAYMENTS_FIELDS_TO_REMOVE.forEach(field => {
          if (data.hasOwnProperty(field)) {
            fieldsToDelete[field] = FieldValue.delete();
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          if (isDryRun) {
            console.log(`   [DRY RUN] Would update payment ${doc.id}:`, Object.keys(fieldsToDelete));
          } else {
            await doc.ref.update(fieldsToDelete);
            updatedCount++;
            console.log(`   ✓ Updated payment ${doc.id}`);
          }
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      console.log(`   Progress: ${processedCount} payments processed, ${updatedCount} updated`);
    }

    console.log(`\n   ✅ Payments cleanup complete!`);
    console.log(`   📊 Total processed: ${processedCount}`);
    console.log(`   📝 Total updated: ${updatedCount}`);

  } catch (error) {
    console.error('   ❌ Error cleaning up payments:', error);
    throw error;
  }
}

/**
 * Remove duplicate users (by username)
 */
async function removeDuplicateUsers() {
  console.log('\n🔍 Checking for duplicate users...\n');

  try {
    const snapshot = await db.collection('users').get();
    const usersByUsername = {};
    const duplicates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const username = data.username;

      if (username) {
        if (!usersByUsername[username]) {
          usersByUsername[username] = [];
        }
        usersByUsername[username].push({ id: doc.id, ...data });
      }
    });

    // Find duplicates
    Object.entries(usersByUsername).forEach(([username, users]) => {
      if (users.length > 1) {
        // Sort by createdAt, keep the oldest
        users.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateA - dateB;
        });

        // All except the first are duplicates
        const dupes = users.slice(1);
        duplicates.push({ username, keep: users[0].id, remove: dupes.map(u => u.id) });
      }
    });

    if (duplicates.length === 0) {
      console.log('   ✅ No duplicate users found!');
      return;
    }

    console.log(`   ⚠️  Found ${duplicates.length} duplicate username(s):\n`);

    for (const dup of duplicates) {
      console.log(`   Username: ${dup.username}`);
      console.log(`   Keeping: ${dup.keep}`);
      console.log(`   Would remove: ${dup.remove.join(', ')}\n`);

      if (!isDryRun) {
        // Note: Don't actually delete users automatically - too risky
        console.log(`   ⚠️  Automatic deletion disabled for safety. Please review and delete manually if needed.`);
      }
    }

  } catch (error) {
    console.error('   ❌ Error checking duplicates:', error);
    throw error;
  }
}

/**
 * Main execution
 */
(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🗑️  DATABASE CLEANUP UTILITY');
    console.log('='.repeat(70));

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('\n⚠️  LIVE MODE - Database will be modified!\n');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('📋 Actions to perform:');
    console.log('   1. Remove obsolete/duplicate fields from users');
    console.log('   2. Migrate badge -> badges array');
    console.log('   3. Consolidate privacy settings');
    console.log('   4. Clean up payments collection');
    console.log('   5. Identify duplicate users\n');

    // Run cleanup tasks
    await cleanupUsers();
    await cleanupPayments();
    await removeDuplicateUsers();

    console.log('\n' + '='.repeat(70));
    console.log('✅ DATABASE CLEANUP COMPLETE!');
    console.log('='.repeat(70) + '\n');

    if (isDryRun) {
      console.log('💡 Run without --dry-run to apply changes:\n');
      console.log('   node scripts/cleanup-database.js\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
