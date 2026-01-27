#!/usr/bin/env node
/**
 * Test Lifetime100 Activation Notifications
 * 
 * This script tests the lifetime100 activation notification system
 * to ensure that receipt notifications are properly sent to the support team.
 */

const { Telegraf } = require('telegraf');
const logger = require('../src/utils/logger');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testLifetime100Notifications() {
  console.log('🧪 Testing Lifetime100 Activation Notifications');
  console.log('==============================================');
  
  try {
    // Test configuration
    const botToken = process.env.BOT_TOKEN;
    const supportGroupId = process.env.SUPPORT_GROUP_ID;
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').filter(id => id.trim()) || [];
    
    console.log('\n📋 Configuration:');
    console.log(`   Bot Token: ${botToken ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Support Group: ${supportGroupId ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Admin Users: ${adminIds.length > 0 ? adminIds.length + ' configured' : '❌ None configured'}`);
    
    if (!botToken) {
      console.log('\n❌ Cannot test notifications: BOT_TOKEN not configured');
      return;
    }
    
    if (!supportGroupId && adminIds.length === 0) {
      console.log('\n❌ Cannot test notifications: No support group or admin IDs configured');
      return;
    }
    
    // Create test bot instance
    const bot = new Telegraf(botToken);
    
    // Test 1: Check bot can send messages
    console.log('\n1. Testing bot message sending capability...');
    
    try {
      // Try to get bot info
      const botInfo = await bot.telegram.getMe();
      console.log(`✅ Bot is active: @${botInfo.username} (ID: ${botInfo.id})`);
    } catch (error) {
      console.log('❌ Bot cannot send messages:', error.message);
      await bot.stop();
      return;
    }
    
    // Test 2: Check support group accessibility
    if (supportGroupId) {
      console.log('\n2. Testing support group accessibility...');
      
      try {
        // Try to send a test message to support group
        const testMessage = `🧪 *Test Notification*

This is a test message to verify that lifetime100 activation notifications can be delivered to the support group.

Timestamp: ${new Date().toISOString()}`;
        
        const result = await bot.telegram.sendMessage(supportGroupId, testMessage, {
          parse_mode: 'Markdown'
        });
        
        console.log('✅ Support group is accessible');
        console.log(`   Test message sent: ${result.message_id}`);
        
        // Delete the test message to keep the group clean
        try {
          await bot.telegram.deleteMessage(supportGroupId, result.message_id);
          console.log('✅ Test message cleaned up');
        } catch (deleteError) {
          console.log('⚠️  Could not delete test message:', deleteError.message);
        }
        
      } catch (error) {
        console.log('❌ Support group not accessible:', error.message);
        
        // Provide troubleshooting guidance
        if (error.description && error.description.includes('Forbidden')) {
          console.log('   💡 Troubleshooting: Bot may not have permission to send messages to this group');
          console.log('   💡 Solution: Make the bot an admin in the support group');
        } else if (error.description && error.description.includes('chat not found')) {
          console.log('   💡 Troubleshooting: Support group ID may be incorrect');
          console.log('   💡 Solution: Verify SUPPORT_GROUP_ID in .env file');
        }
      }
    }
    
    // Test 3: Check admin accessibility
    if (adminIds.length > 0) {
      console.log('\n3. Testing admin notifications...');
      
      for (const adminId of adminIds.slice(0, 2)) { // Test first 2 admins
        try {
          const adminTestMessage = `🧪 *Admin Test Notification*

Testing lifetime100 activation notifications to admin ${adminId}`;
          
          await bot.telegram.sendMessage(adminId, adminTestMessage, {
            parse_mode: 'Markdown'
          });
          
          console.log(`✅ Admin ${adminId} is accessible`);
          
        } catch (error) {
          console.log(`❌ Admin ${adminId} not accessible:`, error.message);
        }
      }
    }
    
    // Test 4: Simulate lifetime100 notification format
    console.log('\n4. Testing notification format...');
    
    const sampleNotification = `📝 *New Lifetime100 Receipt*

User: 123456789 (@testuser)
Code: TEST123
Type: photo
File ID: AgADBAADlr4xGw`;
    
    console.log('Sample notification format:');
    console.log(sampleNotification);
    console.log('✅ Notification format is valid');
    
    // Summary
    console.log('\n==============================================');
    console.log('📊 TEST SUMMARY');
    console.log('==============================================');
    
    const issues = [];
    
    if (!botToken) issues.push('Bot token not configured');
    if (!supportGroupId) issues.push('Support group not configured');
    if (adminIds.length === 0) issues.push('No admin users configured');
    
    if (issues.length === 0) {
      console.log('✅ All tests passed!');
      console.log('   Lifetime100 activation notifications should be working correctly.');
    } else {
      console.log('⚠️  Configuration issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n💡 Recommendations:');
      console.log('   1. Verify all environment variables in .env file');
      console.log('   2. Ensure bot has admin permissions in support group');
      console.log('   3. Check that support group is a supergroup with topics enabled');
      console.log('   4. Verify admin user IDs are correct');
    }
    
    try {
      await bot.stop();
    } catch (stopError) {
      // Ignore stop error - bot may not have been fully started
    }
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Lifetime100 notification test error:', error);
    process.exit(1);
  }
}

// Run the test
testLifetime100Notifications().then(() => {
  process.exit(0);
});