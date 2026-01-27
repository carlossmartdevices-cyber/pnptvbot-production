#!/usr/bin/env node
/**
 * Recover Missed Support Requests Script (Simple Version)
 * 
 * This script checks for any open support topics that might have been missed
 * due to notification failures. Uses only basic columns that should exist.
 */

const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function recoverMissedRequests() {
  console.log('🔍 Recovering Missed Support Requests (Simple Version)');
  console.log('====================================================');
  
  try {
    // Check if support_topics table exists
    const tableCheck = await getPool().query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'support_topics')"
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Support topics table does not exist');
      console.log('   No missed requests to recover');
      return;
    }
    
    // Check table structure to see what columns are available
    const columnsResult = await getPool().query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'support_topics' ORDER BY column_name"
    );
    
    const availableColumns = columnsResult.rows.map(row => row.column_name);
    console.log('📋 Available columns:', availableColumns.join(', '));
    
    // Basic check for open topics
    console.log('\n1. Checking for open support topics...');
    
    let openTopicsQuery = 'SELECT * FROM support_topics WHERE status = $1 ORDER BY last_message_at DESC';
    let openTopicsResult;
    
    try {
      openTopicsResult = await getPool().query(openTopicsQuery, ['open']);
    } catch (error) {
      // Fallback if status column doesn't exist or has different values
      if (error.message.includes('column "status" does not exist')) {
        console.log('   ⚠️  Status column not found, checking all topics...');
        openTopicsResult = await getPool().query('SELECT * FROM support_topics ORDER BY last_message_at DESC');
      } else {
        throw error;
      }
    }
    
    const openTopics = openTopicsResult.rows;
    
    if (openTopics.length > 0) {
      console.log(`⚠️  Found ${openTopics.length} open support topics:`);
      
      openTopics.forEach((topic, index) => {
        const userId = topic.user_id || topic.userId || 'unknown';
        const threadName = topic.thread_name || topic.threadName || 'No name';
        const createdAt = topic.created_at || topic.createdAt || 'unknown';
        const lastMessage = topic.last_message_at || topic.lastMessageAt || 'never';
        
        console.log(`   ${index + 1}. User ${userId}: ${threadName}`);
        console.log(`      Created: ${createdAt}, Last message: ${lastMessage}`);
        
        // Check if topic is old (>24 hours)
        if (lastMessage && lastMessage !== 'never') {
          const lastMessageDate = new Date(lastMessage);
          const hoursSinceLastMessage = (Date.now() - lastMessageDate) / (1000 * 60 * 60);
          
          if (hoursSinceLastMessage > 24) {
            console.log(`      ⚠️  OLD: ${Math.floor(hoursSinceLastMessage)} hours since last message`);
          }
        }
      });
    } else {
      console.log('✅ No open support topics found');
    }
    
    // Check for topics with high message counts (might indicate issues)
    console.log('\n2. Checking for topics with high message activity...');
    
    if (availableColumns.includes('message_count')) {
      const activeTopicsResult = await getPool().query(
        'SELECT * FROM support_topics WHERE message_count > 10 ORDER BY message_count DESC LIMIT 5'
      );
      
      const activeTopics = activeTopicsResult.rows;
      
      if (activeTopics.length > 0) {
        console.log(`⚠️  Found ${activeTopics.length} topics with high message activity:`);
        activeTopics.forEach(topic => {
          console.log(`   - User ${topic.user_id}: ${topic.thread_name} (${topic.message_count} messages)`);
        });
      } else {
        console.log('✅ No topics with unusually high message activity');
      }
    } else {
      console.log('   ⚠️  Message count column not available, skipping this check');
    }
    
    // Basic statistics
    console.log('\n3. Basic Statistics:');
    const totalTopicsResult = await getPool().query('SELECT COUNT(*) as total FROM support_topics');
    const totalTopics = parseInt(totalTopicsResult.rows[0].total);
    
    console.log(`   Total support topics: ${totalTopics}`);
    console.log(`   Open topics: ${openTopics.length}`);
    
    // Summary
    console.log('\n====================================================');
    console.log('📊 RECOVERY SUMMARY');
    console.log('====================================================');
    
    if (openTopics.length > 0) {
      console.log(`⚠️  Found ${openTopics.length} open support topics that may need attention`);
      console.log('\n💡 Recommendations:');
      console.log('   1. Review the open topics listed above');
      console.log('   2. Prioritize topics that haven\'t had recent activity');
      console.log('   3. Check if any topics are waiting for responses');
      console.log('   4. Consider reaching out to users with old open topics');
    } else {
      console.log('✅ No open support topics found');
      console.log('   The support system appears to be up to date');
    }
    
    console.log('\n✅ Recovery check completed successfully');
    
  } catch (error) {
    console.error('❌ Error during recovery process:', error);
    logger.error('Error in recover-missed-requests-simple script:', error);
    process.exit(1);
  }
}

// Run the recovery process
recoverMissedRequests().then(() => {
  process.exit(0);
});