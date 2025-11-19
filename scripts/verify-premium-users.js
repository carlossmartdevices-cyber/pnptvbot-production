#!/usr/bin/env node

/**
 * Script to verify Premium users data in Firebase vs PostgreSQL
 * This will help identify what data was lost during migration
 */

const admin = require('firebase-admin');
const path = require('path');
const { initializePostgres, query } = require('../src/config/postgres');

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

async function verifyPremiumUsers() {
  console.log('\n📊 Verifying Premium Users Data\n');
  console.log('='.repeat(70));

  try {
    // Initialize PostgreSQL
    initializePostgres();

    // Get users with Premium tier from PostgreSQL
    const pgResult = await query(
      `SELECT id, username, tier, subscription_status, plan_id, plan_expiry
       FROM users
       WHERE tier = 'Premium' OR tier = 'premium'
       ORDER BY id`
    );

    console.log(`\nFound ${pgResult.rows.length} Premium users in PostgreSQL\n`);

    const issues = {
      missingSubscriptionStatus: [],
      missingPlanId: [],
      missingPlanExpiry: [],
      dataComparison: []
    };

    // Check each user in Firebase
    for (const pgUser of pgResult.rows) {
      try {
        const fbDoc = await db.collection('users').doc(pgUser.id).get();

        if (!fbDoc.exists) {
          console.log(`⚠️  User ${pgUser.id} (${pgUser.username}) not found in Firebase`);
          continue;
        }

        const fbData = fbDoc.data();

        // Compare data
        const comparison = {
          userId: pgUser.id,
          username: pgUser.username,
          firebase: {
            tier: fbData.tier,
            subscriptionStatus: fbData.subscriptionStatus,
            planId: fbData.planId,
            planExpiry: fbData.planExpiry ? new Date(fbData.planExpiry.toDate()) : null,
          },
          postgres: {
            tier: pgUser.tier,
            subscriptionStatus: pgUser.subscription_status,
            planId: pgUser.plan_id,
            planExpiry: pgUser.plan_expiry ? new Date(pgUser.plan_expiry) : null,
          }
        };

        // Identify issues
        if (fbData.subscriptionStatus && fbData.subscriptionStatus !== pgUser.subscription_status) {
          issues.missingSubscriptionStatus.push(comparison);
        }

        if (fbData.planId && fbData.planId !== pgUser.plan_id) {
          issues.missingPlanId.push(comparison);
        }

        if (fbData.planExpiry && !pgUser.plan_expiry) {
          issues.missingPlanExpiry.push(comparison);
        }

        issues.dataComparison.push(comparison);

      } catch (error) {
        console.error(`❌ Error checking user ${pgUser.id}:`, error.message);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 SUMMARY OF ISSUES\n');
    console.log(`Total Premium users checked: ${pgResult.rows.length}`);
    console.log(`Users with missing/wrong subscription_status: ${issues.missingSubscriptionStatus.length}`);
    console.log(`Users with missing/wrong plan_id: ${issues.missingPlanId.length}`);
    console.log(`Users with missing plan_expiry: ${issues.missingPlanExpiry.length}`);

    // Show detailed issues
    if (issues.missingSubscriptionStatus.length > 0) {
      console.log('\n⚠️  Users with subscription_status issues:');
      console.log('='.repeat(70));
      issues.missingSubscriptionStatus.slice(0, 10).forEach(user => {
        console.log(`\nUser: ${user.userId} (@${user.username})`);
        console.log(`  Firebase: subscriptionStatus="${user.firebase.subscriptionStatus}", planId="${user.firebase.planId}"`);
        console.log(`  Postgres: subscriptionStatus="${user.postgres.subscriptionStatus}", planId="${user.postgres.planId}"`);
      });
      if (issues.missingSubscriptionStatus.length > 10) {
        console.log(`\n... and ${issues.missingSubscriptionStatus.length - 10} more users`);
      }
    }

    // Save full report to file
    const fs = require('fs');
    const reportPath = path.join(__dirname, 'premium-users-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
    console.log(`\n✅ Full report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyPremiumUsers();
