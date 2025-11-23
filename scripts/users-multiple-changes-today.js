#!/usr/bin/env node

/**
 * Find users with more than 5 username changes today
 * Helps identify suspicious behavior and potential ban evasion
 */

const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function findUsersWithMultipleChangesToday() {
  try {
    console.log('='.repeat(80));
    console.log('USERS WITH MULTIPLE USERNAME CHANGES TODAY');
    console.log(`Date: ${new Date().toLocaleDateString()}`);
    console.log(`Time: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80));
    console.log('');

    // Get users with more than 5 changes today
    const result = await query(`
      SELECT 
        user_id,
        COUNT(*) as change_count,
        MIN(changed_at) as first_change,
        MAX(changed_at) as last_change,
        ARRAY_AGG(old_username ORDER BY changed_at) as old_usernames,
        ARRAY_AGG(new_username ORDER BY changed_at) as new_usernames,
        ARRAY_AGG(group_id ORDER BY changed_at) as group_ids,
        ARRAY_AGG(flagged ORDER BY changed_at) as flagged_status
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY user_id 
      HAVING COUNT(*) > 5
      ORDER BY change_count DESC
    `);

    if (result.rows.length === 0) {
      console.log('✅ No users found with more than 5 username changes today.');
      console.log('');
      console.log('This is a good sign - no suspicious username change activity detected.');
      return;
    }

    console.log(`🚨 Found ${result.rows.length} user(s) with suspicious activity:\n`);

    result.rows.forEach((user, index) => {
      const firstChange = new Date(user.first_change);
      const lastChange = new Date(user.last_change);
      const timeDiff = (lastChange - firstChange) / 1000 / 60; // minutes
      const changeRate = timeDiff > 0 ? (user.change_count / timeDiff).toFixed(2) : 'N/A';

      console.log(`${'='.repeat(80)}`);
      console.log(`${index + 1}. 🚩 User ID: ${user.user_id}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📊 Total changes today: ${user.change_count}`);
      console.log(`⏰ First change: ${firstChange.toLocaleTimeString()}`);
      console.log(`⏰ Last change: ${lastChange.toLocaleTimeString()}`);
      console.log(`⏱️  Time span: ${timeDiff.toFixed(1)} minutes`);
      console.log(`📈 Change rate: ${changeRate} changes/minute`);
      console.log('');

      // Show username progression
      console.log('📝 Username Change Timeline:');
      console.log('-'.repeat(80));
      
      for (let i = 0; i < user.change_count; i++) {
        const old = user.old_usernames[i] || 'none';
        const newU = user.new_usernames[i] || 'none';
        const flagged = user.flagged_status[i] ? ' 🚩 FLAGGED' : '';
        const groupId = user.group_ids[i] || 'N/A';
        
        console.log(`   ${i + 1}. @${old} → @${newU} (Group: ${groupId})${flagged}`);
      }
      
      console.log('');

      // Determine severity
      let severity = '⚠️  MODERATE';
      if (user.change_count > 10) {
        severity = '🔴 CRITICAL';
      } else if (user.change_count > 7) {
        severity = '🟠 HIGH';
      }

      console.log(`⚡ Threat Level: ${severity}`);
      console.log('');

      // Get unique groups
      const uniqueGroups = [...new Set(user.group_ids.filter(g => g))];
      console.log(`👥 Active in ${uniqueGroups.length} group(s): ${uniqueGroups.join(', ')}`);
      console.log('');

      // Check if any changes were flagged
      const flaggedCount = user.flagged_status.filter(f => f).length;
      if (flaggedCount > 0) {
        console.log(`🚩 ${flaggedCount}/${user.change_count} changes already flagged by system`);
        console.log('');
      }
    });

    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    
    const totalChanges = result.rows.reduce((sum, user) => sum + parseInt(user.change_count), 0);
    const avgChanges = (totalChanges / result.rows.length).toFixed(2);
    const maxChanges = Math.max(...result.rows.map(u => parseInt(u.change_count)));
    
    console.log(`Total suspicious users: ${result.rows.length}`);
    console.log(`Total changes by these users: ${totalChanges}`);
    console.log(`Average changes per user: ${avgChanges}`);
    console.log(`Maximum changes by single user: ${maxChanges}`);
    console.log('');

    // Recommendations
    console.log('='.repeat(80));
    console.log('🎯 RECOMMENDED ACTIONS');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. Review each user\'s activity with: /userhistory <user_id>');
    console.log('2. Check if users are in multiple groups (potential spam network)');
    console.log('3. Consider temporary restrictions for users with 10+ changes');
    console.log('4. Flag suspicious patterns for admin review');
    console.log('5. Monitor these users for next 24 hours for continued activity');
    console.log('');
    console.log('💡 TIP: Users changing usernames frequently may be:');
    console.log('   • Evading bans');
    console.log('   • Testing spam accounts');
    console.log('   • Attempting impersonation');
    console.log('   • Part of a coordinated attack');
    console.log('');

    // Get all changes today for context
    const totalTodayResult = await query(`
      SELECT COUNT(*) as total 
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
    `);

    const totalToday = parseInt(totalTodayResult.rows[0].total);
    const suspiciousPercentage = ((totalChanges / totalToday) * 100).toFixed(2);

    console.log('='.repeat(80));
    console.log('📊 CONTEXT');
    console.log('='.repeat(80));
    console.log(`Total username changes today: ${totalToday}`);
    console.log(`Changes from suspicious users: ${totalChanges} (${suspiciousPercentage}%)`);
    console.log(`Changes from normal users: ${totalToday - totalChanges}`);
    console.log('');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Database connection failed.');
      console.error('');
      console.error('The PostgreSQL database is not running or not accessible.');
      console.error('');
      console.error('To start the database:');
      console.error('  docker-compose up -d postgres');
      console.error('');
      console.error('Or check your .env file for correct database credentials.');
    } else {
      console.error('❌ Error finding users with multiple changes:', error.message);
      logger.error('Error in users-multiple-changes-today script:', error);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  findUsersWithMultipleChangesToday()
    .then(() => {
      console.log('✅ Report completed successfully');
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Report failed');
      process.exit(1);
    });
}

module.exports = findUsersWithMultipleChangesToday;
