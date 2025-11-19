#!/usr/bin/env node

/**
 * Script to migrate data from Firestore to PostgreSQL
 * Usage: node scripts/migrate-firestore-to-postgres.js [--collection=users] [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const { initializePostgres, query, getClient } = require('../src/config/postgres');

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

// Check if dry-run mode
const isDryRun = process.argv.includes('--dry-run');
const targetCollection = process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1];

/**
 * Migrate users collection
 */
async function migrateUsers() {
  console.log('\n📊 Migrating users collection...\n');

  try {
    const snapshot = await db.collection('users').get();
    console.log(`   Found ${snapshot.size} users to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Convert Firestore timestamps to JavaScript Date objects
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();

        const userRecord = {
          id: doc.id,
          username: data.username || null,
          first_name: data.firstName || 'Unknown',
          last_name: data.lastName || null,
          email: data.email || null,
          email_verified: data.emailVerified || false,
          bio: data.bio || null,
          photo_file_id: data.photoFileId || null,
          photo_updated_at: data.photoUpdatedAt?.toDate ? data.photoUpdatedAt.toDate() : null,
          interests: data.interests || [],
          location_lat: data.location?.lat || null,
          location_lng: data.location?.lng || null,
          location_name: data.locationName || null,
          location_geohash: data.locationGeohash || null,
          location_updated_at: data.locationUpdatedAt?.toDate ? data.locationUpdatedAt.toDate() : null,
          subscription_status: data.subscriptionStatus || 'free',
          plan_id: data.planId || null,
          plan_expiry: data.planExpiry?.toDate ? data.planExpiry.toDate() : null,
          tier: data.tier || 'free',
          role: data.role || 'user',
          assigned_by: data.assignedBy || null,
          role_assigned_at: data.roleAssignedAt?.toDate ? data.roleAssignedAt.toDate() : null,
          privacy: data.privacy || { showLocation: true, showInterests: true, showBio: true, allowMessages: true, showOnline: true },
          profile_views: data.profileViews || 0,
          xp: data.xp || 0,
          favorites: data.favorites || [],
          blocked: data.blocked || [],
          badges: data.badges || [],
          onboarding_complete: data.onboardingComplete || false,
          age_verified: data.ageVerified || false,
          age_verified_at: data.ageVerifiedAt?.toDate ? data.ageVerifiedAt.toDate() : null,
          age_verification_expires_at: data.ageVerificationExpiresAt?.toDate ? data.ageVerificationExpiresAt.toDate() : null,
          age_verification_interval_hours: data.ageVerificationIntervalHours || 168,
          terms_accepted: data.termsAccepted || false,
          privacy_accepted: data.privacyAccepted || false,
          last_active: data.lastActive?.toDate ? data.lastActive.toDate() : null,
          last_activity_in_group: data.lastActivityInGroup || null,
          group_activity_log: data.groupActivityLog || null,
          timezone: data.timezone || null,
          timezone_detected: data.timezoneDetected || false,
          timezone_updated_at: data.timezoneUpdatedAt?.toDate ? data.timezoneUpdatedAt.toDate() : null,
          language: data.language || 'en',
          is_active: data.isActive !== undefined ? data.isActive : true,
          deactivated_at: data.deactivatedAt?.toDate ? data.deactivatedAt.toDate() : null,
          deactivation_reason: data.deactivationReason || null,
          created_at: createdAt,
          updated_at: updatedAt,
        };

        if (!isDryRun) {
          // Insert or update user
          await query(
            `INSERT INTO users (
              id, username, first_name, last_name, email, email_verified,
              bio, photo_file_id, photo_updated_at, interests,
              location_lat, location_lng, location_name, location_geohash, location_updated_at,
              subscription_status, plan_id, plan_expiry, tier,
              role, assigned_by, role_assigned_at,
              privacy, profile_views, xp, favorites, blocked, badges,
              onboarding_complete, age_verified, age_verified_at, age_verification_expires_at,
              age_verification_interval_hours, terms_accepted, privacy_accepted,
              last_active, last_activity_in_group, group_activity_log,
              timezone, timezone_detected, timezone_updated_at,
              language, is_active, deactivated_at, deactivation_reason,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25, $26, $27, $28,
              $29, $30, $31, $32, $33, $34, $35, $36, $37,
              $38, $39, $40, $41, $42, $43, $44, $45, $46, $47
            ) ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              email = EXCLUDED.email,
              email_verified = EXCLUDED.email_verified,
              bio = EXCLUDED.bio,
              photo_file_id = EXCLUDED.photo_file_id,
              photo_updated_at = EXCLUDED.photo_updated_at,
              interests = EXCLUDED.interests,
              location_lat = EXCLUDED.location_lat,
              location_lng = EXCLUDED.location_lng,
              location_name = EXCLUDED.location_name,
              location_geohash = EXCLUDED.location_geohash,
              location_updated_at = EXCLUDED.location_updated_at,
              subscription_status = EXCLUDED.subscription_status,
              plan_id = EXCLUDED.plan_id,
              plan_expiry = EXCLUDED.plan_expiry,
              tier = EXCLUDED.tier,
              role = EXCLUDED.role,
              assigned_by = EXCLUDED.assigned_by,
              role_assigned_at = EXCLUDED.role_assigned_at,
              privacy = EXCLUDED.privacy,
              profile_views = EXCLUDED.profile_views,
              xp = EXCLUDED.xp,
              favorites = EXCLUDED.favorites,
              blocked = EXCLUDED.blocked,
              badges = EXCLUDED.badges,
              onboarding_complete = EXCLUDED.onboarding_complete,
              age_verified = EXCLUDED.age_verified,
              age_verified_at = EXCLUDED.age_verified_at,
              age_verification_expires_at = EXCLUDED.age_verification_expires_at,
              age_verification_interval_hours = EXCLUDED.age_verification_interval_hours,
              terms_accepted = EXCLUDED.terms_accepted,
              privacy_accepted = EXCLUDED.privacy_accepted,
              last_active = EXCLUDED.last_active,
              last_activity_in_group = EXCLUDED.last_activity_in_group,
              group_activity_log = EXCLUDED.group_activity_log,
              timezone = EXCLUDED.timezone,
              timezone_detected = EXCLUDED.timezone_detected,
              timezone_updated_at = EXCLUDED.timezone_updated_at,
              language = EXCLUDED.language,
              is_active = EXCLUDED.is_active,
              deactivated_at = EXCLUDED.deactivated_at,
              deactivation_reason = EXCLUDED.deactivation_reason,
              updated_at = EXCLUDED.updated_at
            `,
            [
              userRecord.id, userRecord.username, userRecord.first_name, userRecord.last_name,
              userRecord.email, userRecord.email_verified, userRecord.bio, userRecord.photo_file_id,
              userRecord.photo_updated_at, userRecord.interests, userRecord.location_lat,
              userRecord.location_lng, userRecord.location_name, userRecord.location_geohash,
              userRecord.location_updated_at, userRecord.subscription_status, userRecord.plan_id,
              userRecord.plan_expiry, userRecord.tier, userRecord.role, userRecord.assigned_by,
              userRecord.role_assigned_at, JSON.stringify(userRecord.privacy), userRecord.profile_views,
              userRecord.xp, userRecord.favorites, userRecord.blocked, userRecord.badges,
              userRecord.onboarding_complete, userRecord.age_verified, userRecord.age_verified_at,
              userRecord.age_verification_expires_at, userRecord.age_verification_interval_hours,
              userRecord.terms_accepted, userRecord.privacy_accepted, userRecord.last_active,
              userRecord.last_activity_in_group, userRecord.group_activity_log ? JSON.stringify(userRecord.group_activity_log) : null,
              userRecord.timezone, userRecord.timezone_detected, userRecord.timezone_updated_at,
              userRecord.language, userRecord.is_active, userRecord.deactivated_at,
              userRecord.deactivation_reason, userRecord.created_at, userRecord.updated_at,
            ]
          );
        }

        migratedCount++;
        if (migratedCount % 100 === 0) {
          console.log(`   Progress: ${migratedCount} users migrated`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error migrating user ${doc.id}:`, error.message);
      }
    }

    console.log(`\n   ✅ Users migration complete!`);
    console.log(`   📊 Total: ${snapshot.size}, Migrated: ${migratedCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('   ❌ Error migrating users:', error);
    throw error;
  }
}

/**
 * Migrate plans collection
 */
async function migratePlans() {
  console.log('\n📊 Migrating plans collection...\n');

  try {
    const snapshot = await db.collection('plans').get();
    console.log(`   Found ${snapshot.size} plans to migrate`);

    let migratedCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (!isDryRun) {
          await query(
            `INSERT INTO plans (
              id, name, display_name, tier, price, price_in_cop, currency,
              duration, duration_days, description, features, icon, active,
              recommended, is_lifetime, requires_manual_activation, payment_method,
              wompi_payment_link, crypto_bonus, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19, $20, $21
            ) ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              display_name = EXCLUDED.display_name,
              tier = EXCLUDED.tier,
              price = EXCLUDED.price,
              price_in_cop = EXCLUDED.price_in_cop,
              currency = EXCLUDED.currency,
              duration = EXCLUDED.duration,
              duration_days = EXCLUDED.duration_days,
              description = EXCLUDED.description,
              features = EXCLUDED.features,
              icon = EXCLUDED.icon,
              active = EXCLUDED.active,
              recommended = EXCLUDED.recommended,
              is_lifetime = EXCLUDED.is_lifetime,
              requires_manual_activation = EXCLUDED.requires_manual_activation,
              payment_method = EXCLUDED.payment_method,
              wompi_payment_link = EXCLUDED.wompi_payment_link,
              crypto_bonus = EXCLUDED.crypto_bonus,
              updated_at = EXCLUDED.updated_at
            `,
            [
              doc.id, data.name, data.displayName, data.tier, data.price,
              data.priceInCOP || null, data.currency || 'USD', data.duration,
              data.durationDays || null, data.description, JSON.stringify(data.features || []),
              data.icon || null, data.active !== undefined ? data.active : true,
              data.recommended || false, data.isLifetime || false,
              data.requiresManualActivation || false, data.paymentMethod || null,
              data.wompiPaymentLink || null, data.cryptoBonus ? JSON.stringify(data.cryptoBonus) : null,
              data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            ]
          );
        }

        migratedCount++;
      } catch (error) {
        console.error(`   ❌ Error migrating plan ${doc.id}:`, error.message);
      }
    }

    console.log(`   ✅ Plans migration complete! Migrated: ${migratedCount}`);
  } catch (error) {
    console.error('   ❌ Error migrating plans:', error);
    throw error;
  }
}

/**
 * Migrate payments collection
 */
async function migratePayments() {
  console.log('\n📊 Migrating payments collection...\n');

  try {
    const snapshot = await db.collection('payments').get();
    console.log(`   Found ${snapshot.size} payments to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        if (!isDryRun) {
          await query(
            `INSERT INTO payments (
              user_id, plan_id, plan_name, amount, currency, provider,
              payment_method, status, payment_id, reference, destination_address,
              payment_url, chain, chain_id, completed_at, completed_by,
              manual_completion, expires_at, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19, $20
            )`,
            [
              data.userId, data.planId || null, data.planName || null,
              data.amount, data.currency || 'USD', data.provider || null,
              data.paymentMethod || null, data.status || 'pending',
              data.paymentId || null, data.reference || null,
              data.destinationAddress || null, data.paymentUrl || null,
              data.chain ? JSON.stringify(data.chain) : null, data.chainId || null,
              data.completedAt?.toDate ? data.completedAt.toDate() : null,
              data.completedBy || null, data.manualCompletion || false,
              data.expiresAt?.toDate ? data.expiresAt.toDate() : null,
              data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            ]
          );
        }

        migratedCount++;
        if (migratedCount % 100 === 0) {
          console.log(`   Progress: ${migratedCount} payments migrated`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error migrating payment ${doc.id}:`, error.message);
      }
    }

    console.log(`   ✅ Payments migration complete! Migrated: ${migratedCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('   ❌ Error migrating payments:', error);
    throw error;
  }
}

/**
 * Main execution
 */
(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔄 FIRESTORE TO POSTGRESQL MIGRATION');
    console.log('='.repeat(70));

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No data will be written to PostgreSQL\n');
    } else {
      console.log('\n⚠️  LIVE MODE - Data will be written to PostgreSQL!\n');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Initialize PostgreSQL
    initializePostgres();

    // Migrate collections
    if (!targetCollection || targetCollection === 'users') {
      await migrateUsers();
    }

    if (!targetCollection || targetCollection === 'plans') {
      await migratePlans();
    }

    if (!targetCollection || targetCollection === 'payments') {
      await migratePayments();
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(70) + '\n');

    if (isDryRun) {
      console.log('💡 Run without --dry-run to apply changes:\n');
      console.log('   node scripts/migrate-firestore-to-postgres.js\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
