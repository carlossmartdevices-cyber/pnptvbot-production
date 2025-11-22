#!/usr/bin/env node

/**
 * Script to set a user's role (PostgreSQL version)
 * Usage: node scripts/set-user-role.js <command> <userId> [role]
 */

require('dotenv').config();
const { query } = require('../src/config/postgres');
const { cache } = require('../src/config/redis');
const logger = require('../src/utils/logger');

const VALID_ROLES = ['superadmin', 'admin', 'moderator', 'user'];

async function checkUserRole(userId) {
  try {
    console.log(`\n🔍 Checking role for user ${userId}...`);

    const result = await query('SELECT * FROM users WHERE id = $1', [userId.toString()]);

    if (result.rows.length === 0) {
      console.log(`\n❌ User ${userId} not found in database`);
      console.log(`💡 The user needs to start the bot first by sending /start`);
      return false;
    }

    const user = result.rows[0];
    console.log(`\n📋 User Information:`);
    console.log(`   ID: ${userId}`);
    console.log(`   Username: @${user.username || 'N/A'}`);
    console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || ''}`);
    console.log(`   Role: ${user.role || 'user'}`);
    console.log(`   Subscription: ${user.subscription_status || 'free'}`);
    console.log(`   Plan: ${user.plan_id || 'N/A'}`);
    console.log(`   Created: ${user.created_at || 'N/A'}`);

    const isAdmin = ['superadmin', 'admin', 'moderator'].includes(user.role);
    console.log(`\n${isAdmin ? '✅' : '❌'} Is Admin: ${isAdmin}`);

    return true;
  } catch (error) {
    console.error('\n❌ Error checking role:', error.message);
    return false;
  }
}

async function setUserRole(userId, role) {
  try {
    console.log(`\n🔍 Setting role for user ${userId}...`);

    // Check if user exists
    const result = await query('SELECT * FROM users WHERE id = $1', [userId.toString()]);

    if (result.rows.length === 0) {
      console.log(`\n❌ User ${userId} not found in database`);
      console.log(`💡 The user needs to start the bot first by sending /start`);
      return false;
    }

    const user = result.rows[0];
    console.log(`\n📋 Current user data:`);
    console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || ''}`);
    console.log(`   Username: @${user.username || 'N/A'}`);
    console.log(`   Current Role: ${user.role || 'user'}`);
    console.log(`   Subscription: ${user.subscription_status || 'free'}`);

    // Update role
    await query(
      'UPDATE users SET role = $1, updated_at = $2 WHERE id = $3',
      [role, new Date(), userId.toString()]
    );

    // Invalidate cache
    await cache.del(`user:${userId}`);

    console.log(`\n✅ Successfully updated user ${userId} to role: ${role}`);
    console.log(`\n🎉 You can now use /admin command in the bot!`);

    logger.info(`Role updated via script: ${userId} -> ${role}`);
    return true;
  } catch (error) {
    console.error('\n❌ Error setting role:', error.message);
    return false;
  }
}

async function listAdmins() {
  try {
    console.log(`\n👥 Listing all admin users...`);

    const result = await query(
      'SELECT id, username, first_name, last_name, role, subscription_status FROM users WHERE role IN ($1, $2, $3) ORDER BY role, username',
      ['superadmin', 'admin', 'moderator']
    );

    if (result.rows.length === 0) {
      console.log(`\n⚠️  No admin users found`);
      return;
    }

    console.log(`\n📋 Found ${result.rows.length} admin user(s):\n`);

    const groups = {
      superadmin: [],
      admin: [],
      moderator: []
    };

    result.rows.forEach(user => {
      groups[user.role].push(user);
    });

    if (groups.superadmin.length > 0) {
      console.log('🔴 SUPER ADMINS:');
      groups.superadmin.forEach(user => {
        console.log(`   - ${user.id} | @${user.username || 'N/A'} | ${user.first_name || ''} ${user.last_name || ''} | ${user.subscription_status || 'free'}`);
      });
      console.log('');
    }

    if (groups.admin.length > 0) {
      console.log('🟡 ADMINS:');
      groups.admin.forEach(user => {
        console.log(`   - ${user.id} | @${user.username || 'N/A'} | ${user.first_name || ''} ${user.last_name || ''} | ${user.subscription_status || 'free'}`);
      });
      console.log('');
    }

    if (groups.moderator.length > 0) {
      console.log('🟢 MODERATORS:');
      groups.moderator.forEach(user => {
        console.log(`   - ${user.id} | @${user.username || 'N/A'} | ${user.first_name || ''} ${user.last_name || ''} | ${user.subscription_status || 'free'}`);
      });
      console.log('');
    }

    return true;
  } catch (error) {
    console.error('\n❌ Error listing admins:', error.message);
    return false;
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const userId = args[1];
const role = args[2] || 'superadmin';

if (!command) {
  console.log(`
📝 User Role Management Script (PostgreSQL)

Usage:
  Check user role:
    node scripts/set-user-role.js --check <telegram_user_id>

  Set user role:
    node scripts/set-user-role.js --set <telegram_user_id> [role]

  List all admins:
    node scripts/set-user-role.js --list

  Roles: superadmin, admin, moderator, user
  Default role: superadmin

Examples:
  node scripts/set-user-role.js --check 8365312597
  node scripts/set-user-role.js --set 8365312597
  node scripts/set-user-role.js --set 8365312597 admin
  node scripts/set-user-role.js --list
  `);
  process.exit(1);
}

(async () => {
  try {
    let success = false;

    if (command === '--check') {
      if (!userId) {
        console.error('❌ User ID is required');
        process.exit(1);
      }
      success = await checkUserRole(userId);
    } else if (command === '--set') {
      if (!userId) {
        console.error('❌ User ID is required');
        process.exit(1);
      }

      if (!VALID_ROLES.includes(role)) {
        console.error(`❌ Invalid role: ${role}`);
        console.error(`   Valid roles: ${VALID_ROLES.join(', ')}`);
        process.exit(1);
      }

      success = await setUserRole(userId, role);
    } else if (command === '--list') {
      success = await listAdmins();
    } else {
      console.error(`❌ Unknown command: ${command}`);
      console.error(`   Valid commands: --check, --set, --list`);
      process.exit(1);
    }

    if (success) {
      console.log('\n✅ Operation completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Operation failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();
