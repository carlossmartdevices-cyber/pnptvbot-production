#!/usr/bin/env node
/**
 * Recover Missed Support Requests Script
 * 
 * This script checks for any open support topics that might have been missed
 * due to notification failures and ensures they get proper attention.
 */

const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');
const SupportTopicModel = require('../src/models/supportTopicModel');

async function recoverMissedRequests() {
  console.log('🔍 Recovering Missed Support Requests');
  console.log('=====================================');
  
  try {
    // 1. Check for open topics without first response
    console.log('\n1. Checking for topics needing first response...');
    const topicsNeedingFirstResponse = await SupportTopicModel.getTopicsNeedingFirstResponse();
    
    if (topicsNeedingFirstResponse.length > 0) {
      console.log(`⚠️  Found ${topicsNeedingFirstResponse.length} topics waiting for first response:`);
      topicsNeedingFirstResponse.forEach(topic => {
        console.log(`   - User ${topic.user_id}: ${topic.thread_name} (created ${topic.created_at})`);
      });
    } else {
      console.log('✅ No topics waiting for first response');
    }
    
    // 2. Check for high priority topics
    console.log('\n2. Checking for high/critical priority topics...');
    const highPriorityTopics = await SupportTopicModel.getTopicsByPriority('high');
    const criticalPriorityTopics = await SupportTopicModel.getTopicsByPriority('critical');
    
    const urgentTopics = [...highPriorityTopics, ...criticalPriorityTopics];
    
    if (urgentTopics.length > 0) {
      console.log(`⚠️  Found ${urgentTopics.length} urgent topics:`);
      urgentTopics.forEach(topic => {
        console.log(`   - [${topic.priority}] User ${topic.user_id}: ${topic.thread_name}`);
      });
    } else {
      console.log('✅ No urgent priority topics');
    }
    
    // 3. Check for SLA breaches
    console.log('\n3. Checking for SLA breaches...');
    const slaBreachedTopics = await SupportTopicModel.getSlaBreachedTopics();
    
    if (slaBreachedTopics.length > 0) {
      console.log(`⚠️  Found ${slaBreachedTopics.length} topics with SLA breaches:`);
      slaBreachedTopics.forEach(topic => {
        console.log(`   - User ${topic.user_id}: ${topic.thread_name} (created ${topic.created_at})`);
      });
    } else {
      console.log('✅ No SLA breaches detected');
    }
    
    // 4. Check for old open topics
    console.log('\n4. Checking for old open topics (>24 hours)...');
    const oldTopicsQuery = `
      SELECT * FROM support_topics
      WHERE status = 'open'
      AND created_at < NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
    `;
    
    const oldTopicsResult = await getPool().query(oldTopicsQuery);
    const oldOpenTopics = oldTopicsResult.rows;
    
    if (oldOpenTopics.length > 0) {
      console.log(`⚠️  Found ${oldOpenTopics.length} topics open for more than 24 hours:`);
      oldOpenTopics.forEach(topic => {
        const createdDate = new Date(topic.created_at);
        const hoursOpen = Math.floor((Date.now() - createdDate) / (1000 * 60 * 60));
        console.log(`   - User ${topic.user_id}: ${topic.thread_name} (${hoursOpen} hours open)`);
      });
    } else {
      console.log('✅ No old open topics');
    }
    
    // 5. Get statistics
    console.log('\n5. Support Topic Statistics:');
    const stats = await SupportTopicModel.getStatistics();
    
    console.log(`   Total topics: ${stats.total_topics || 0}`);
    console.log(`   Open topics: ${stats.open_topics || 0}`);
    console.log(`   Resolved topics: ${stats.resolved_topics || 0}`);
    console.log(`   Closed topics: ${stats.closed_topics || 0}`);
    console.log(`   High priority: ${stats.high_priority || 0}`);
    console.log(`   Critical priority: ${stats.critical_priority || 0}`);
    console.log(`   SLA breaches: ${stats.sla_breaches || 0}`);
    
    // Summary
    const totalIssues = topicsNeedingFirstResponse.length + urgentTopics.length + slaBreachedTopics.length + oldOpenTopics.length;
    
    console.log('\n=====================================');
    console.log('📊 RECOVERY SUMMARY');
    console.log('=====================================');
    console.log(`Total issues found: ${totalIssues}`);
    
    if (totalIssues > 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   1. Review the topics listed above');
      console.log('   2. Respond to topics needing first response');
      console.log('   3. Address urgent/high priority topics');
      console.log('   4. Handle SLA breaches promptly');
      console.log('   5. Follow up on old open topics');
      
      console.log('\n💡 Recommendations:');
      if (topicsNeedingFirstResponse.length > 0) {
        console.log(`   - Assign ${topicsNeedingFirstResponse.length} topics needing first response to available agents`);
      }
      if (urgentTopics.length > 0) {
        console.log(`   - Prioritize ${urgentTopics.length} urgent topics immediately`);
      }
      if (slaBreachedTopics.length > 0) {
        console.log(`   - Address ${slaBreachedTopics.length} SLA breaches and notify customers`);
      }
      if (oldOpenTopics.length > 0) {
        console.log(`   - Review ${oldOpenTopics.length} old topics for resolution or escalation`);
      }
    } else {
      console.log('✅ No missed requests detected! All topics are being handled appropriately.');
    }
    
    console.log('\n✅ Recovery check completed successfully');
    
  } catch (error) {
    console.error('❌ Error during recovery process:', error);
    logger.error('Error in recover-missed-requests script:', error);
    process.exit(1);
  }
}

// Run the recovery process
recoverMissedRequests().then(() => {
  process.exit(0);
});