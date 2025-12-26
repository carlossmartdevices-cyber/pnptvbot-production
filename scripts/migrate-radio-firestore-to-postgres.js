#!/usr/bin/env node

/**
 * Radio Feature Migration Script
 * Migrates radio data from Firestore to PostgreSQL
 *
 * Usage:
 *   node scripts/migrate-radio-firestore-to-postgres.js [--dry-run] [--skip-history]
 *
 * Options:
 *   --dry-run       Show what would be migrated without making changes
 *   --skip-history  Skip migrating history (it's large and can be rebuilt)
 */

const admin = require('firebase-admin');
const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');
const skipHistory = process.argv.includes('--skip-history');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'firebase-admin-key.json'));

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  logger.error('Firebase already initialized or error:', error.message);
}

const db = admin.firestore();

// ==========================================
// MIGRATION FUNCTIONS
// ==========================================

/**
 * Migrate radio_now_playing collection
 */
async function migrateNowPlaying() {
  console.log('\n📻 Migrating radio_now_playing...\n');

  try {
    const snapshot = await db
      .collection('radio_now_playing')
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('   No current song found, skipping');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (isDryRun) {
      console.log('   [DRY RUN] Would update now playing:', data.title);
      return;
    }

    await query(
      `UPDATE radio_now_playing
       SET title = $1, artist = $2, duration = $3, cover_url = $4,
           started_at = $5, updated_at = NOW()
       WHERE id = 1`,
      [
        data.title || 'Unknown',
        data.artist || 'Unknown Artist',
        data.duration || '3:00',
        data.coverUrl || null,
        data.startedAt?.toDate ? data.startedAt.toDate() : new Date(),
      ],
    );

    console.log('   ✅ Migrated now playing:', data.title);
  } catch (error) {
    console.error('   ❌ Error migrating now playing:', error.message);
  }
}

/**
 * Migrate radio_requests collection
 */
async function migrateRequests() {
  console.log('\n📝 Migrating radio_requests...\n');

  try {
    const snapshot = await db.collection('radio_requests').get();
    console.log(`   Found ${snapshot.size} requests to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (isDryRun) {
          console.log(`   [DRY RUN] Would migrate request:`, data.songName);
          migratedCount++;
          continue;
        }

        await query(
          `INSERT INTO radio_requests
           (id, user_id, song_name, status, artist, duration,
            requested_at, updated_at, played_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            doc.id,
            data.userId?.toString() || 'unknown',
            data.songName,
            data.status || 'pending',
            data.artist || null,
            data.duration || null,
            data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date(),
            data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            data.playedAt?.toDate ? data.playedAt.toDate() : null,
          ],
        );

        migratedCount++;

        if (migratedCount % 50 === 0) {
          console.log(`   Progress: ${migratedCount}/${snapshot.size}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   Error migrating request ${doc.id}:`, error.message);
      }
    }

    console.log(`   ✅ Migrated ${migratedCount} requests (${errorCount} errors)`);
  } catch (error) {
    console.error('   ❌ Error migrating requests:', error.message);
  }
}

/**
 * Migrate radio_history collection
 */
async function migrateHistory() {
  if (skipHistory) {
    console.log('\n📜 Skipping radio_history (--skip-history flag)\n');
    return;
  }

  console.log('\n📜 Migrating radio_history...\n');

  try {
    const snapshot = await db
      .collection('radio_history')
      .orderBy('playedAt', 'desc')
      .limit(1000)
      .get();

    console.log(`   Found ${snapshot.size} history entries to migrate (limit: 1000)`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (isDryRun) {
          console.log(`   [DRY RUN] Would migrate history:`, data.title);
          migratedCount++;
          continue;
        }

        await query(
          `INSERT INTO radio_history
           (id, title, artist, duration, cover_url, played_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            doc.id,
            data.title || 'Unknown',
            data.artist || null,
            data.duration || null,
            data.coverUrl || null,
            data.playedAt?.toDate ? data.playedAt.toDate() : new Date(),
          ],
        );

        migratedCount++;

        if (migratedCount % 100 === 0) {
          console.log(`   Progress: ${migratedCount}/${snapshot.size}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   Error migrating history ${doc.id}:`, error.message);
      }
    }

    console.log(`   ✅ Migrated ${migratedCount} history entries (${errorCount} errors)`);
  } catch (error) {
    console.error('   ❌ Error migrating history:', error.message);
  }
}

/**
 * Migrate radio_schedule collection
 */
async function migrateSchedule() {
  console.log('\n📅 Migrating radio_schedule...\n');

  try {
    const snapshot = await db.collection('radio_schedule').get();
    console.log(`   Found ${snapshot.size} schedule entries to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (isDryRun) {
          console.log(`   [DRY RUN] Would migrate schedule:`, data.programName);
          migratedCount++;
          continue;
        }

        await query(
          `INSERT INTO radio_schedule
           (id, day_of_week, time_slot, program_name, description,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (day_of_week, time_slot) DO UPDATE SET
             program_name = EXCLUDED.program_name,
             description = EXCLUDED.description,
             updated_at = EXCLUDED.updated_at`,
          [
            doc.id,
            data.dayOfWeek,
            data.timeSlot,
            data.programName,
            data.description || null,
            data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          ],
        );

        migratedCount++;
      } catch (error) {
        errorCount++;
        console.error(`   Error migrating schedule ${doc.id}:`, error.message);
      }
    }

    console.log(`   ✅ Migrated ${migratedCount} schedule entries (${errorCount} errors)`);
  } catch (error) {
    console.error('   ❌ Error migrating schedule:', error.message);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Radio Feature Migration from Firestore to PostgreSQL\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  try {
    // Initialize PostgreSQL
    await initializePostgres();
    console.log('✅ PostgreSQL connected\n');

    // Run migrations in sequence
    await migrateNowPlaying();
    await migrateRequests();
    await migrateHistory();
    await migrateSchedule();

    console.log('\n✅ Radio migration completed!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
main();
