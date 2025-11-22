#!/usr/bin/env node

/**
 * Script to set a user's role to superadmin
 * Usage: node scripts/set-admin-role.js <telegram_user_id>
 */

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

async function setAdminRole(userId, role = 'superadmin') {
  try {
    console.log(`\n🔍 Checking user ${userId}...`);

    const userRef = db.collection('users').doc(userId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found in database`);
      console.log(`\n💡 The user needs to start the bot first by sending /start`);
      return;
    }

    const userData = userDoc.data();
    console.log(`\n📋 Current user data:`);
    console.log(`   Name: ${userData.firstName || 'N/A'} ${userData.lastName || ''}`);
    console.log(`   Current Role: ${userData.role || 'user'}`);
    console.log(`   Subscription: ${userData.subscriptionStatus || 'free'}`);

    // Update role
    await userRef.update({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n✅ Successfully updated user ${userId} to role: ${role}`);
    console.log(`\n🎉 You can now use /admin command in the bot!`);

  } catch (error) {
    console.error('\n❌ Error setting admin role:', error);
    throw error;
  }
}

async function checkUserRole(userId) {
  try {
    console.log(`\n🔍 Checking role for user ${userId}...`);

    const userRef = db.collection('users').doc(userId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found in database`);
      return;
    }

    const userData = userDoc.data();
    console.log(`\n📋 User Information:`);
    console.log(`   ID: ${userId}`);
    console.log(`   Name: ${userData.firstName || 'N/A'} ${userData.lastName || ''}`);
    console.log(`   Role: ${userData.role || 'user'}`);
    console.log(`   Subscription: ${userData.subscriptionStatus || 'free'}`);
    console.log(`   Created: ${userData.createdAt?.toDate?.() || 'N/A'}`);

    const isAdmin = ['superadmin', 'admin', 'moderator'].includes(userData.role);
    console.log(`\n${isAdmin ? '✅' : '❌'} Is Admin: ${isAdmin}`);

  } catch (error) {
    console.error('\n❌ Error checking role:', error);
    throw error;
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const userId = args[1];
const role = args[2] || 'superadmin';

if (!command || (command !== '--check' && !userId)) {
  console.log(`
Usage:
  Check user role:
    node scripts/set-admin-role.js --check <telegram_user_id>

  Set user role:
    node scripts/set-admin-role.js --set <telegram_user_id> [role]

  Roles: superadmin, admin, moderator, user
  Default role: superadmin

Examples:
  node scripts/set-admin-role.js --check 8365312597
  node scripts/set-admin-role.js --set 8365312597
  node scripts/set-admin-role.js --set 8365312597 admin
  `);
  process.exit(1);
}

(async () => {
  try {
    if (command === '--check') {
      await checkUserRole(userId);
    } else if (command === '--set') {
      if (!userId) {
        console.error('❌ User ID is required');
        process.exit(1);
      }

      const validRoles = ['superadmin', 'admin', 'moderator', 'user'];
      if (!validRoles.includes(role)) {
        console.error(`❌ Invalid role: ${role}`);
        console.error(`   Valid roles: ${validRoles.join(', ')}`);
        process.exit(1);
      }

      await setAdminRole(userId, role);
    } else {
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();
