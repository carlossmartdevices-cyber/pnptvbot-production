#!/usr/bin/env node
/**
 * Notify Support Team About Missed Requests
 * 
 * This script sends notifications to the support team about missed requests
 * and creates a recovery mechanism to prevent future issues.
 */

const { Telegraf } = require('telegraf');
const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function notifyMissedRequests() {
  console.log('📢 Notifying Support Team About Missed Requests');
  console.log('==============================================');
  
  try {
    // Get missed requests
    const missedRequests = await getMissedRequests();
    
    if (missedRequests.length === 0) {
      console.log('✅ No missed requests found');
      return;
    }
    
    console.log(`⚠️  Found ${missedRequests.length} missed requests that need attention`);
    
    // Prepare notification message
    const notificationMessage = prepareNotificationMessage(missedRequests);
    
    console.log('\n📋 Notification Message:');
    console.log(notificationMessage);
    
    // Check if we can send to Telegram
    const botToken = process.env.BOT_TOKEN;
    const supportGroupId = process.env.SUPPORT_GROUP_ID;
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || [];
    
    if (botToken && supportGroupId) {
      try {
        const bot = new Telegraf(botToken);
        
        // Send to support group
        await bot.telegram.sendMessage(supportGroupId, notificationMessage, {
          parse_mode: 'Markdown'
        });
        
        console.log(`✅ Notification sent to support group ${supportGroupId}`);
        
        // Also send to admins as backup
        for (const adminId of adminIds) {
          try {
            await bot.telegram.sendMessage(adminId.trim(), 
              `🚨 *URGENT: Missed Support Requests Detected*\n\n` + notificationMessage, {
                parse_mode: 'Markdown'
              }
            );
            console.log(`✅ Notification sent to admin ${adminId}`);
          } catch (error) {
            console.error(`❌ Failed to send to admin ${adminId}:`, error.message);
          }
        }
        
        // Stop the bot
        await bot.stop();
        
      } catch (error) {
        console.error('❌ Failed to send Telegram notifications:', error.message);
        console.log('   Fallback: Manual notification required');
      }
    } else {
      console.log('⚠️  Telegram bot not configured for automatic notifications');
      console.log('   Please manually notify the support team using the message above');
    }
    
    console.log('\n✅ Notification process completed');
    
  } catch (error) {
    console.error('❌ Error in notification process:', error);
    logger.error('Error in notify-missed-requests script:', error);
    process.exit(1);
  }
}

async function getMissedRequests() {
  // Get all open topics
  const query = `
    SELECT * FROM support_topics 
    WHERE status = 'open'
    ORDER BY 
      CASE 
        WHEN last_message_at < NOW() - INTERVAL '24 hours' THEN 1 
        ELSE 2 
      END, 
      last_message_at ASC
  `;
  
  const result = await getPool().query(query);
  return result.rows;
}

function prepareNotificationMessage(requests) {
  const now = new Date();
  const urgentRequests = [];
  const recentRequests = [];
  
  // Categorize requests
  requests.forEach(request => {
    if (request.last_message_at) {
      const lastMessageDate = new Date(request.last_message_at);
      const hoursSinceLastMessage = (now - lastMessageDate) / (1000 * 60 * 60);
      
      if (hoursSinceLastMessage > 24) {
        urgentRequests.push(request);
      } else {
        recentRequests.push(request);
      }
    } else {
      urgentRequests.push(request); // No last message means it's urgent
    }
  });
  
  // Build message
  let message = `🚨 *URGENT: Missed Support Requests Detected* 🚨\n\n`;
  message += `*Total missed requests:* ${requests.length}\n\n`;
  
  if (urgentRequests.length > 0) {
    message += `🔴 *URGENT REQUESTS (${urgentRequests.length})* 🔴\n`;
    message += 'These requests have not had activity in over 24 hours:\n\n';
    
    urgentRequests.forEach((request, index) => {
      const userId = request.user_id || 'unknown';
      const threadName = request.thread_name || 'No name';
      const lastMessageDate = request.last_message_at ? new Date(request.last_message_at) : null;
      
      if (lastMessageDate) {
        const hoursSinceLastMessage = Math.floor((now - lastMessageDate) / (1000 * 60 * 60));
        message += `${index + 1}. *User ${userId}*: ${threadName}\n`;
        message += `   🕒 *Last activity:* ${hoursSinceLastMessage} hours ago\n`;
        message += `   🆔 *Thread ID:* ${request.thread_id}\n\n`;
      } else {
        message += `${index + 1}. *User ${userId}*: ${threadName}\n`;
        message += `   ⚠️ *No responses yet*\n`;
        message += `   🆔 *Thread ID:* ${request.thread_id}\n\n`;
      }
    });
  }
  
  if (recentRequests.length > 0) {
    message += `🟡 *RECENT REQUESTS (${recentRequests.length})* 🟡\n`;
    message += 'These requests have recent activity but should be monitored:\n\n';
    
    recentRequests.forEach((request, index) => {
      const userId = request.user_id || 'unknown';
      const threadName = request.thread_name || 'No name';
      
      message += `${index + 1}. *User ${userId}*: ${threadName}\n`;
      message += `   🆔 *Thread ID:* ${request.thread_id}\n\n`;
    });
  }
  
  message += `💡 *Action Required*:\n`;
  message += `- Immediately respond to ${urgentRequests.length} urgent requests\n`;
  message += `- Review and monitor ${recentRequests.length} recent requests\n`;
  message += `- Check support group forum topics for these thread IDs\n`;
  message += `- Update customers on resolution timelines\n\n`;
  
  message += `🔧 *Prevention*:\n`;
  message += `- This notification indicates a support system issue\n`;
  message += `- Please investigate why notifications weren't delivered\n`;
  message += `- Check bot permissions in the support group\n`;
  message += `- Verify support group is configured as a forum\n`;
  
  return message;
}

// Run the notification process
notifyMissedRequests().then(() => {
  process.exit(0);
});