#!/usr/bin/env node

/**
 * Username Change Tracking Report
 * Generates a comprehensive report of all username changes in the system
 */

const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function generateUsernameChangeReport() {
  try {
    console.log('='.repeat(80));
    console.log('USERNAME CHANGE TRACKING REPORT');
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));
    console.log('');

    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM username_history');
    const total = parseInt(countResult.rows[0].total);
    
    console.log(`📊 Total username changes recorded: ${total}`);
    console.log('');
    
    if (total === 0) {
      console.log('✅ No username changes have been recorded yet.');
      console.log('');
      console.log('The system is tracking username changes through:');
      console.log('  • usernameEnforcement middleware');
      console.log('  • Automatic detection when users interact in groups');
      console.log('  • Recording in the username_history table');
      return;
    }
    
    // Get recent changes
    console.log('📋 RECENT USERNAME CHANGES (Last 50):');
    console.log('-'.repeat(80));
    
    const recentResult = await query(`
      SELECT 
        user_id,
        old_username,
        new_username,
        group_id,
        changed_at,
        flagged,
        flag_reason
      FROM username_history 
      ORDER BY changed_at DESC 
      LIMIT 50
    `);
    
    if (recentResult.rows.length === 0) {
      console.log('No recent changes found.');
    } else {
      recentResult.rows.forEach((row, index) => {
        const date = new Date(row.changed_at);
        console.log(`${index + 1}. User ID: ${row.user_id}`);
        console.log(`   📅 Date: ${date.toLocaleString()}`);
        console.log(`   📝 Change: @${row.old_username || 'none'} → @${row.new_username || 'none'}`);
        console.log(`   👥 Group ID: ${row.group_id || 'N/A'}`);
        if (row.flagged) {
          console.log(`   🚩 FLAGGED${row.flag_reason ? ': ' + row.flag_reason : ''}`);
        }
        console.log('');
      });
    }
    
    // Get users with multiple changes
    console.log('');
    console.log('🔄 USERS WITH MULTIPLE USERNAME CHANGES:');
    console.log('-'.repeat(80));
    
    const multipleResult = await query(`
      SELECT 
        user_id,
        COUNT(*) as change_count,
        MIN(changed_at) as first_change,
        MAX(changed_at) as last_change
      FROM username_history 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
      ORDER BY change_count DESC
      LIMIT 20
    `);
    
    if (multipleResult.rows.length === 0) {
      console.log('No users with multiple changes found.');
    } else {
      multipleResult.rows.forEach((row, index) => {
        const first = new Date(row.first_change);
        const last = new Date(row.last_change);
        const daysDiff = Math.round((last - first) / (1000 * 60 * 60 * 24));
        
        console.log(`${index + 1}. User ID: ${row.user_id}`);
        console.log(`   🔢 Total changes: ${row.change_count}`);
        console.log(`   📅 First change: ${first.toLocaleString()}`);
        console.log(`   📅 Last change: ${last.toLocaleString()}`);
        console.log(`   ⏱️  Period: ${daysDiff} days`);
        console.log('');
      });
    }
    
    // Get changes in last 24 hours
    console.log('');
    console.log('🕐 CHANGES IN LAST 24 HOURS:');
    console.log('-'.repeat(80));
    
    const last24hResult = await query(`
      SELECT COUNT(*) as count_24h
      FROM username_history 
      WHERE changed_at > NOW() - INTERVAL '24 hours'
    `);
    
    const count24h = parseInt(last24hResult.rows[0].count_24h);
    console.log(`Changes in last 24 hours: ${count24h}`);
    
    // Get changes in last 7 days
    const last7dResult = await query(`
      SELECT COUNT(*) as count_7d
      FROM username_history 
      WHERE changed_at > NOW() - INTERVAL '7 days'
    `);
    
    const count7d = parseInt(last7dResult.rows[0].count_7d);
    console.log(`Changes in last 7 days: ${count7d}`);
    
    // Get changes in last 30 days
    const last30dResult = await query(`
      SELECT COUNT(*) as count_30d
      FROM username_history 
      WHERE changed_at > NOW() - INTERVAL '30 days'
    `);
    
    const count30d = parseInt(last30dResult.rows[0].count_30d);
    console.log(`Changes in last 30 days: ${count30d}`);
    
    // Get flagged changes
    console.log('');
    console.log('🚩 FLAGGED CHANGES:');
    console.log('-'.repeat(80));
    
    const flaggedResult = await query(`
      SELECT COUNT(*) as flagged_count 
      FROM username_history 
      WHERE flagged = true
    `);
    
    const flaggedCount = parseInt(flaggedResult.rows[0].flagged_count);
    console.log(`Total flagged changes: ${flaggedCount}`);
    console.log(`Flagged percentage: ${total > 0 ? ((flaggedCount / total) * 100).toFixed(2) + '%' : '0%'}`);
    
    // Get changes by group
    console.log('');
    console.log('👥 CHANGES BY GROUP:');
    console.log('-'.repeat(80));
    
    const byGroupResult = await query(`
      SELECT 
        group_id,
        COUNT(*) as change_count
      FROM username_history 
      WHERE group_id IS NOT NULL
      GROUP BY group_id 
      ORDER BY change_count DESC
      LIMIT 10
    `);
    
    if (byGroupResult.rows.length === 0) {
      console.log('No group-specific changes recorded.');
    } else {
      byGroupResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. Group ID: ${row.group_id} - ${row.change_count} changes`);
      });
    }
    
    // Summary statistics
    console.log('');
    console.log('📈 SUMMARY STATISTICS:');
    console.log('-'.repeat(80));
    console.log(`Total unique users with changes: ${multipleResult.rowCount + (recentResult.rows.length - multipleResult.rows.length)}`);
    console.log(`Average changes per user: ${total > 0 ? (total / Math.max(multipleResult.rowCount, 1)).toFixed(2) : '0'}`);
    console.log(`Most active period: Last 30 days with ${count30d} changes`);
    
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Report generated successfully');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error generating username change report:', error);
    logger.error('Error in username change report:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateUsernameChangeReport()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate report:', error.message);
      process.exit(1);
    });
}

module.exports = generateUsernameChangeReport;
