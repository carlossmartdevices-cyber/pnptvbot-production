/**
 * Migration script to update existing users with new profile features
 * while preserving their existing subscriptions and data
 */

require('dotenv').config();
const { initializeFirebase, getFirestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

const COLLECTION = 'users';

async function migrateExistingUsers() {
  try {
    logger.info('Starting user migration...');

    // Initialize Firebase
    initializeFirebase();
    const db = getFirestore();

    // Get all users
    const snapshot = await db.collection(COLLECTION).get();

    logger.info(`Found ${snapshot.size} users to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const userData = doc.data();
        const userId = doc.id;

        // Check if user needs migration
        const needsMigration = !userData.privacy ||
                               userData.profileViews === undefined ||
                               !userData.favorites ||
                               !userData.blocked ||
                               !userData.badges;

        if (!needsMigration) {
          logger.info(`User ${userId} already migrated, skipping`);
          skippedCount++;
          continue;
        }

        // Prepare update data with new fields while preserving existing data
        const updateData = {
          updatedAt: new Date(),
        };

        // Add privacy settings if missing
        if (!userData.privacy) {
          updateData.privacy = {
            showLocation: true,
            showInterests: true,
            showBio: true,
            allowMessages: true,
            showOnline: true,
          };
        }

        // Add profileViews if missing
        if (userData.profileViews === undefined) {
          updateData.profileViews = 0;
        }

        // Add favorites array if missing
        if (!userData.favorites) {
          updateData.favorites = [];
        }

        // Add blocked array if missing
        if (!userData.blocked) {
          updateData.blocked = [];
        }

        // Add badges array if missing
        if (!userData.badges) {
          updateData.badges = [];
        }

        // IMPORTANT: Preserve existing subscription status
        // Don't modify: subscriptionStatus, planId, planExpiry, role

        // Update user with merge to preserve existing data
        await doc.ref.update(updateData);

        logger.info(`Migrated user ${userId}`, {
          subscriptionStatus: userData.subscriptionStatus,
          role: userData.role,
          addedFields: Object.keys(updateData),
        });

        migratedCount++;
      } catch (error) {
        logger.error(`Error migrating user ${doc.id}:`, error);
        errorCount++;
      }
    }

    logger.info('Migration completed!', {
      total: snapshot.size,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
    });

    // Show summary by subscription status
    const statusSnapshot = await db.collection(COLLECTION).get();
    const statusCounts = {};

    statusSnapshot.forEach((doc) => {
      const status = doc.data().subscriptionStatus || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    logger.info('Users by subscription status:', statusCounts);

    return {
      total: snapshot.size,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
      statusCounts,
    };
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  migrateExistingUsers()
    .then((result) => {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nSummary:');
      console.log(`Total users: ${result.total}`);
      console.log(`Migrated: ${result.migrated}`);
      console.log(`Skipped (already migrated): ${result.skipped}`);
      console.log(`Errors: ${result.errors}`);
      console.log('\nUsers by subscription status:');
      Object.entries(result.statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingUsers };
