/**
 * Script to check and report current user subscriptions status
 * without making any changes
 */

require('dotenv').config();
const { initializeFirebase, getFirestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

const COLLECTION = 'users';

async function checkUserSubscriptions() {
  try {
    logger.info('Checking user subscriptions...');

    // Initialize Firebase
    initializeFirebase();
    const db = getFirestore();

    // Get all users
    const snapshot = await db.collection(COLLECTION).get();

    logger.info(`Checking ${snapshot.size} users`);

    const report = {
      total: snapshot.size,
      byStatus: {},
      byRole: {},
      withoutNewFields: [],
      activeSubscriptions: [],
      expiredSubscriptions: [],
      missingFields: {
        privacy: 0,
        profileViews: 0,
        favorites: 0,
        blocked: 0,
        badges: 0,
      },
    };

    const now = new Date();

    snapshot.forEach((doc) => {
      const userData = doc.data();
      const userId = doc.id;

      // Count by subscription status
      const status = userData.subscriptionStatus || 'unknown';
      report.byStatus[status] = (report.byStatus[status] || 0) + 1;

      // Count by role
      const role = userData.role || 'user';
      report.byRole[role] = (report.byRole[role] || 0) + 1;

      // Check for missing new fields
      if (!userData.privacy) {
        report.missingFields.privacy++;
        report.withoutNewFields.push(userId);
      }
      if (userData.profileViews === undefined) {
        report.missingFields.profileViews++;
      }
      if (!userData.favorites) {
        report.missingFields.favorites++;
      }
      if (!userData.blocked) {
        report.missingFields.blocked++;
      }
      if (!userData.badges) {
        report.missingFields.badges++;
      }

      // Check active subscriptions
      if (userData.subscriptionStatus === 'active') {
        const expiry = userData.planExpiry?.toDate ? userData.planExpiry.toDate() : userData.planExpiry ? new Date(userData.planExpiry) : null;

        if (expiry) {
          if (expiry > now) {
            report.activeSubscriptions.push({
              userId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              planId: userData.planId,
              expiry: expiry.toISOString(),
            });
          } else {
            report.expiredSubscriptions.push({
              userId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              planId: userData.planId,
              expiry: expiry.toISOString(),
            });
          }
        } else {
          report.activeSubscriptions.push({
            userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            planId: userData.planId,
            expiry: 'No expiry date',
          });
        }
      }
    });

    return report;
  } catch (error) {
    logger.error('Check failed:', error);
    throw error;
  }
}

// Run check
if (require.main === module) {
  checkUserSubscriptions()
    .then((report) => {
      console.log('\n📊 USER SUBSCRIPTION REPORT\n');
      console.log('=' .repeat(60));

      console.log('\n📈 TOTAL USERS:', report.total);

      console.log('\n💎 BY SUBSCRIPTION STATUS:');
      Object.entries(report.byStatus).forEach(([status, count]) => {
        const percentage = ((count / report.total) * 100).toFixed(1);
        console.log(`  ${status}: ${count} (${percentage}%)`);
      });

      console.log('\n👥 BY ROLE:');
      Object.entries(report.byRole).forEach(([role, count]) => {
        const percentage = ((count / report.total) * 100).toFixed(1);
        console.log(`  ${role}: ${count} (${percentage}%)`);
      });

      console.log('\n⚠️  MISSING NEW FIELDS:');
      const totalMissing = report.withoutNewFields.length;
      console.log(`  Users without new fields: ${totalMissing}`);
      if (totalMissing > 0) {
        console.log('  Missing field counts:');
        Object.entries(report.missingFields).forEach(([field, count]) => {
          if (count > 0) {
            console.log(`    - ${field}: ${count} users`);
          }
        });
      }

      console.log('\n✅ ACTIVE SUBSCRIPTIONS:', report.activeSubscriptions.length);
      if (report.activeSubscriptions.length > 0) {
        console.log('  Details:');
        report.activeSubscriptions.forEach((sub) => {
          console.log(`    - ${sub.firstName} ${sub.lastName || ''} (${sub.userId})`);
          console.log(`      Plan: ${sub.planId || 'N/A'} | Expiry: ${sub.expiry}`);
        });
      }

      console.log('\n⚠️  EXPIRED SUBSCRIPTIONS:', report.expiredSubscriptions.length);
      if (report.expiredSubscriptions.length > 0) {
        console.log('  Details:');
        report.expiredSubscriptions.forEach((sub) => {
          console.log(`    - ${sub.firstName} ${sub.lastName || ''} (${sub.userId})`);
          console.log(`      Plan: ${sub.planId || 'N/A'} | Expired: ${sub.expiry}`);
        });
      }

      console.log('\n' + '='.repeat(60));

      if (totalMissing > 0) {
        console.log('\n💡 RECOMMENDATION:');
        console.log('   Run migration script to add new fields to existing users:');
        console.log('   npm run migrate:users');
      }

      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkUserSubscriptions };
