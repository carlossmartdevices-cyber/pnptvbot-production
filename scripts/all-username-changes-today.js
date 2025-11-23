#!/usr/bin/env node

/**
 * Show all username changes today with detailed breakdown
 * Provides complete visibility into username change activity
 */

const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function showAllChangesToday() {
  try {
    console.log('='.repeat(80));
    console.log('ALL USERNAME CHANGES TODAY');
    console.log(`Date: ${new Date().toLocaleDateString()}`);
    console.log(`Time: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80));
    console.log('');

    // Get total count for today
    const countResult = await query(`
      SELECT COUNT(*) as total 
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
    `);

    const totalToday = parseInt(countResult.rows[0].total);
    
    console.log(`📊 Total username changes today: ${totalToday}`);
    console.log('');

    if (totalToday === 0) {
      console.log('✅ No username changes recorded today yet.');
      return;
    }

    // Get all changes today
    const changesResult = await query(`
      SELECT 
        user_id,
        old_username,
        new_username,
        group_id,
        changed_at,
        flagged
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY changed_at DESC
    `);

    console.log('📋 CHRONOLOGICAL LIST OF CHANGES:');
    console.log('-'.repeat(80));
    console.log('');

    changesResult.rows.forEach((change, index) => {
      const time = new Date(change.changed_at).toLocaleTimeString();
      const flagged = change.flagged ? ' 🚩' : '';
      
      console.log(`${index + 1}. [${time}]${flagged}`);
      console.log(`   User ID: ${change.user_id}`);
      console.log(`   Change: @${change.old_username || 'none'} → @${change.new_username || 'none'}`);
      console.log(`   Group: ${change.group_id || 'N/A'}`);
      console.log('');
    });

    // Get users grouped by change count
    const userStatsResult = await query(`
      SELECT 
        user_id,
        COUNT(*) as change_count,
        ARRAY_AGG(DISTINCT group_id) FILTER (WHERE group_id IS NOT NULL) as groups
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY user_id 
      ORDER BY change_count DESC
    `);

    console.log('-'.repeat(80));
    console.log('👥 USERS RANKED BY CHANGE COUNT:');
    console.log('-'.repeat(80));
    console.log('');

    userStatsResult.rows.forEach((user, index) => {
      const changeCount = parseInt(user.change_count);
      let indicator = '✅';
      
      if (changeCount > 10) {
        indicator = '🔴';
      } else if (changeCount > 5) {
        indicator = '🟠';
      } else if (changeCount > 3) {
        indicator = '🟡';
      }

      const groupCount = user.groups ? user.groups.length : 0;
      
      console.log(`${index + 1}. ${indicator} User ${user.user_id}: ${changeCount} change(s) in ${groupCount} group(s)`);
    });

    console.log('');
    console.log('-'.repeat(80));
    console.log('📈 STATISTICS:');
    console.log('-'.repeat(80));

    const uniqueUsers = userStatsResult.rows.length;
    const avgChangesPerUser = (totalToday / uniqueUsers).toFixed(2);
    const maxChanges = Math.max(...userStatsResult.rows.map(u => parseInt(u.change_count)));
    
    // Count by severity
    const critical = userStatsResult.rows.filter(u => parseInt(u.change_count) > 10).length;
    const high = userStatsResult.rows.filter(u => parseInt(u.change_count) > 5 && parseInt(u.change_count) <= 10).length;
    const moderate = userStatsResult.rows.filter(u => parseInt(u.change_count) > 3 && parseInt(u.change_count) <= 5).length;
    const normal = userStatsResult.rows.filter(u => parseInt(u.change_count) <= 3).length;

    console.log(`Unique users who changed username: ${uniqueUsers}`);
    console.log(`Average changes per user: ${avgChangesPerUser}`);
    console.log(`Maximum changes by single user: ${maxChanges}`);
    console.log('');
    console.log('Breakdown by activity level:');
    console.log(`  🔴 Critical (>10 changes): ${critical} user(s)`);
    console.log(`  🟠 High (6-10 changes): ${high} user(s)`);
    console.log(`  🟡 Moderate (4-5 changes): ${moderate} user(s)`);
    console.log(`  ✅ Normal (1-3 changes): ${normal} user(s)`);

    // Flagged changes
    const flaggedResult = await query(`
      SELECT COUNT(*) as flagged_count 
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
        AND flagged = true
    `);

    const flaggedCount = parseInt(flaggedResult.rows[0].flagged_count);
    console.log('');
    console.log(`🚩 Flagged changes: ${flaggedCount}/${totalToday} (${((flaggedCount/totalToday)*100).toFixed(1)}%)`);

    // Changes by hour
    console.log('');
    console.log('-'.repeat(80));
    console.log('🕐 CHANGES BY HOUR:');
    console.log('-'.repeat(80));

    const hourlyResult = await query(`
      SELECT 
        EXTRACT(HOUR FROM changed_at) as hour,
        COUNT(*) as count
      FROM username_history 
      WHERE changed_at >= CURRENT_DATE
        AND changed_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY EXTRACT(HOUR FROM changed_at)
      ORDER BY hour
    `);

    hourlyResult.rows.forEach(row => {
      const hour = parseInt(row.hour);
      const count = parseInt(row.count);
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`${hour.toString().padStart(2, '0')}:00 - ${count.toString().padStart(3)} ${bar}`);
    });

    console.log('');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Database connection failed.');
      console.error('');
      console.error('The PostgreSQL database is not running or not accessible.');
      console.error('Make sure POSTGRES_PORT is set correctly in .env (default: 55432)');
    } else {
      console.error('❌ Error generating report:', error.message);
      logger.error('Error in all-changes-today script:', error);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  showAllChangesToday()
    .then(() => {
      console.log('='.repeat(80));
      console.log('✅ Report completed successfully');
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Report failed');
      process.exit(1);
    });
}

module.exports = showAllChangesToday;
