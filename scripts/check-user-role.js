/**
 * Script to check a user's role and permissions
 * Usage: node scripts/check-user-role.js <userId>
 */

require('dotenv').config();
const UserModel = require('../src/models/userModel');
const PermissionService = require('../src/bot/services/permissionService');
const logger = require('../src/utils/logger');

async function checkUserRole(userId) {
  try {
    logger.info(`Checking role for user: ${userId}`);

    // Get user
    const user = await UserModel.getById(userId);
    if (!user) {
      logger.error(`User not found: ${userId}`);
      console.log(`\n❌ User ${userId} not found in database`);
      return false;
    }

    // Get role and permissions
    const role = await PermissionService.getUserRole(userId);
    const isAdmin = await PermissionService.isAdmin(userId);
    const isSuperAdmin = await PermissionService.isSuperAdmin(userId);
    const permissions = await PermissionService.getUserPermissions(userId);

    console.log('\n=== User Information ===');
    console.log(`User ID: ${userId}`);
    console.log(`Username: @${user.username || 'N/A'}`);
    console.log(`Name: ${user.first_name || ''} ${user.last_name || ''}`);
    console.log(`Role: ${role}`);
    console.log(`Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
    console.log(`Is Super Admin: ${isSuperAdmin ? '✅ YES' : '❌ NO'}`);
    console.log(`\n=== Permissions (${permissions.length}) ===`);
    permissions.forEach(p => console.log(`  - ${p}`));

    console.log(`\n=== Subscription ===`);
    console.log(`Status: ${user.subscription_status || 'N/A'}`);
    console.log(`Plan ID: ${user.plan_id || 'N/A'}`);
    console.log(`Plan Expiry: ${user.plan_expiry || 'N/A'}`);

    return true;
  } catch (error) {
    logger.error('Error checking user role:', error);
    return false;
  }
}

// Get userId from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/check-user-role.js <userId>');
  console.error('Example: node scripts/check-user-role.js 123456789');
  process.exit(1);
}

// Run the check
checkUserRole(userId)
  .then((success) => {
    if (success) {
      console.log('\n✅ Check completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Check failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
