#!/usr/bin/env node
/**
 * Support Request Monitoring System
 * 
 * Continuous monitoring for support requests to prevent missed requests
 * and ensure timely responses. Can be run as a cron job or scheduled task.
 */

const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');
const { Telegraf } = require('telegraf');

// Configuration
const MONITOR_INTERVAL = process.env.SUPPORT_MONITOR_INTERVAL || '1h'; // How often to check
const URGENT_THRESHOLD = process.env.URGENT_THRESHOLD || '24h'; // When to consider urgent
const WARN_THRESHOLD = process.env.WARN_THRESHOLD || '12h'; // When to warn

async function monitorSupportRequests() {
  console.log('🔍 Monitoring Support Requests');
  console.log('==============================');
  console.log(`Interval: ${MONITOR_INTERVAL}, Urgent: ${URGENT_THRESHOLD}, Warn: ${WARN_THRESHOLD}`);
  
  try {
    // Get current support request status
    const status = await getSupportRequestStatus();
    
    // Analyze and take action
    await analyzeAndAlert(status);
    
    console.log('✅ Monitoring cycle completed');
    
  } catch (error) {
    console.error('❌ Monitoring error:', error);
    logger.error('Support monitoring error:', error);
  }
}

async function getSupportRequestStatus() {
  const status = {
    totalOpen: 0,
    urgent: [],
    warning: [],
    normal: [],
    activationRequests: [],
    stats: {}
  };
  
  // Get all open topics with detailed info
  const query = `
    SELECT 
      user_id, thread_id, thread_name, 
      created_at, last_message_at, message_count,
      status, priority, category
    FROM support_topics
    WHERE status = 'open'
    ORDER BY 
      CASE 
        WHEN last_message_at < NOW() - INTERVAL '24 hours' THEN 1
        WHEN last_message_at < NOW() - INTERVAL '12 hours' THEN 2
        ELSE 3
      END,
      last_message_at ASC
  `;
  
  const result = await getPool().query(query);
  const topics = result.rows;
  
  status.totalOpen = topics.length;
  
  const now = new Date();
  
  topics.forEach(topic => {
    const topicInfo = {
      userId: topic.user_id,
      threadId: topic.thread_id,
      threadName: topic.thread_name,
      createdAt: topic.created_at,
      lastMessageAt: topic.last_message_at,
      messageCount: topic.message_count,
      priority: topic.priority,
      category: topic.category
    };
    
    // Categorize by age
    if (topic.last_message_at) {
      const lastMessageDate = new Date(topic.last_message_at);
      const hoursSinceLastMessage = (now - lastMessageDate) / (1000 * 60 * 60);
      
      if (hoursSinceLastMessage > 24) {
        status.urgent.push(topicInfo);
      } else if (hoursSinceLastMessage > 12) {
        status.warning.push(topicInfo);
      } else {
        status.normal.push(topicInfo);
      }
    } else {
      // No responses yet - consider urgent
      status.urgent.push(topicInfo);
    }
    
    // Track activation requests
    if (topic.thread_name && topic.thread_name.includes('🎁')) {
      status.activationRequests.push(topicInfo);
    }
  });
  
  // Get statistics
  status.stats = await getStatistics();
  
  return status;
}

async function getStatistics() {
  const statsQuery = `
    SELECT
      COUNT(*) as total_topics,
      COUNT(*) FILTER (WHERE status = 'open') as open_topics,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_topics,
      COUNT(*) FILTER (WHERE status = 'closed') as closed_topics,
      SUM(message_count) as total_messages,
      AVG(message_count) as avg_messages_per_topic
    FROM support_topics
  `;
  
  const result = await getPool().query(statsQuery);
  return result.rows[0];
}

async function analyzeAndAlert(status) {
  console.log(`\n📊 Current Status:`);
  console.log(`   Total open: ${status.totalOpen}`);
  console.log(`   Urgent: ${status.urgent.length}`);
  console.log(`   Warning: ${status.warning.length}`);
  console.log(`   Normal: ${status.normal.length}`);
  console.log(`   Activation requests: ${status.activationRequests.length}`);
  
  // Determine alert level
  let alertLevel = 'normal';
  let alertMessage = '';
  
  if (status.urgent.length > 0) {
    alertLevel = 'critical';
    alertMessage += `🔴 *CRITICAL: ${status.urgent.length} urgent requests need immediate attention*\n\n`;
    
    status.urgent.forEach((request, index) => {
      const hoursOld = request.lastMessageAt 
        ? Math.floor((Date.now() - new Date(request.lastMessageAt)) / (1000 * 60 * 60))
        : 'unknown';
      
      alertMessage += `${index + 1}. *User ${request.userId}*: ${request.threadName}\n`;
      alertMessage += `   🕒 *Age:* ${hoursOld} hours\n`;
      alertMessage += `   🆔 *Thread:* ${request.threadId}\n\n`;
    });
  } else if (status.warning.length > 0) {
    alertLevel = 'warning';
    alertMessage += `🟡 *WARNING: ${status.warning.length} requests approaching urgent status*\n\n`;
    
    status.warning.forEach((request, index) => {
      const hoursOld = request.lastMessageAt 
        ? Math.floor((Date.now() - new Date(request.lastMessageAt)) / (1000 * 60 * 60))
        : 'unknown';
      
      alertMessage += `${index + 1}. *User ${request.userId}*: ${request.threadName}\n`;
      alertMessage += `   🕒 *Age:* ${hoursOld} hours\n`;
      alertMessage += `   🆔 *Thread:* ${request.threadId}\n\n`;
    });
  } else {
    alertMessage = `✅ *All requests up to date*\n\n`;
    alertMessage += `📊 *Statistics:*\n`;
    alertMessage += `- Total topics: ${status.stats.total_topics || 0}\n`;
    alertMessage += `- Open: ${status.stats.open_topics || 0}\n`;
    alertMessage += `- Resolved: ${status.stats.resolved_topics || 0}\n`;
    alertMessage += `- Closed: ${status.stats.closed_topics || 0}\n`;
  }
  
  // Add activation request summary if any
  if (status.activationRequests.length > 0) {
    alertMessage += `\n🎁 *Activation Requests (${status.activationRequests.length})*\n`;
    status.activationRequests.forEach(request => {
      alertMessage += `- User ${request.userId}: ${request.threadName}\n`;
    });
  }
  
  // Send alerts based on level
  await sendAlert(alertLevel, alertMessage);
  
  // Log to console
  console.log(`\n📢 Alert Level: ${alertLevel.toUpperCase()}`);
  console.log('Alert message prepared (see above)');
}

async function sendAlert(level, message) {
  const botToken = process.env.BOT_TOKEN;
  const supportGroupId = process.env.SUPPORT_GROUP_ID;
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || [];
  
  if (!botToken || !supportGroupId) {
    console.log('⚠️  Telegram not configured for alerts');
    return;
  }
  
  try {
    const bot = new Telegraf(botToken);
    
    // Always send to support group
    await bot.telegram.sendMessage(supportGroupId, message, {
      parse_mode: 'Markdown'
    });
    
    console.log(`✅ Alert sent to support group`);
    
    // Send to admins for critical alerts
    if (level === 'critical' && adminIds.length > 0) {
      for (const adminId of adminIds) {
        try {
          const adminMessage = `🚨 *CRITICAL ALERT* 🚨\n\n${message}`;
          await bot.telegram.sendMessage(adminId.trim(), adminMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`✅ Critical alert sent to admin ${adminId}`);
        } catch (error) {
          console.error(`❌ Failed to send to admin ${adminId}:`, error.message);
        }
      }
    }
    
    await bot.stop();
    
  } catch (error) {
    console.error('❌ Failed to send Telegram alert:', error.message);
    logger.error('Failed to send support alert:', error);
  }
}

// Run monitoring
monitorSupportRequests().then(() => {
  process.exit(0);
});

// Export for use in other scripts
module.exports = {
  monitorSupportRequests,
  getSupportRequestStatus,
  analyzeAndAlert
};