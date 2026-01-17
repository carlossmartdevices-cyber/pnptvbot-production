#!/usr/bin/env node

/**
 * Test script to verify payment notifications are working
 * Tests: Admin notification, user confirmation message
 *
 * Usage: node scripts/test-payment-notifications.js
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const PaymentNotificationService = require('../src/bot/services/paymentNotificationService');
const PaymentService = require('../src/bot/services/paymentService');
const PlanModel = require('../src/models/planModel');
const logger = require('../src/utils/logger');

async function testPaymentNotifications() {
  console.log('🧪 Testing Payment Notification System\n');
  console.log('=' .repeat(50));

  // Check required environment variables
  const adminId = process.env.ADMIN_ID;
  const supportGroupId = process.env.SUPPORT_GROUP_ID;
  const botToken = process.env.BOT_TOKEN;

  console.log('\n📋 Environment Check:');
  console.log(`   ADMIN_ID: ${adminId ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   SUPPORT_GROUP_ID: ${supportGroupId ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   BOT_TOKEN: ${botToken ? '✅ Configured' : '❌ Missing'}`);

  if (!botToken) {
    console.error('\n❌ BOT_TOKEN is required to send test notifications');
    process.exit(1);
  }

  if (!adminId && !supportGroupId) {
    console.error('\n❌ Either ADMIN_ID or SUPPORT_GROUP_ID must be configured');
    process.exit(1);
  }

  const bot = new Telegraf(botToken);

  // Get a real plan from database for realistic test
  let testPlan = { name: 'Test Plan', display_name: 'PRIME Monthly', id: 'test' };
  try {
    const plans = await PlanModel.getAll();
    if (plans && plans.length > 0) {
      testPlan = plans[0];
      console.log(`\n📦 Using real plan: ${testPlan.display_name || testPlan.name}`);
    }
  } catch (e) {
    console.log('\n⚠️  Could not fetch plans, using mock data');
  }

  // Test data
  const testPaymentData = {
    userId: adminId || '123456789',
    planName: testPlan.display_name || testPlan.name,
    amount: 14.99,
    provider: 'Test (ePayco)',
    transactionId: `TEST-${Date.now()}`,
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
  };

  console.log('\n📝 Test Payment Data:');
  console.log(JSON.stringify(testPaymentData, null, 2));

  // Test 1: Admin Notification
  console.log('\n' + '=' .repeat(50));
  console.log('🔔 TEST 1: Admin Payment Notification');
  console.log('=' .repeat(50));

  try {
    const adminResult = await PaymentNotificationService.sendAdminPaymentNotification({
      bot,
      ...testPaymentData,
    });

    if (adminResult) {
      console.log('✅ Admin notification sent successfully!');
      console.log(`   → Check ADMIN_ID (${adminId}) for the message`);
      if (supportGroupId) {
        console.log(`   → Check SUPPORT_GROUP_ID (${supportGroupId}) for the message`);
      }
    } else {
      console.log('⚠️  Admin notification returned false (may have partially succeeded)');
    }
  } catch (error) {
    console.error('❌ Admin notification failed:', error.message);
  }

  // Test 2: User Confirmation (only if we have admin ID to send to)
  if (adminId) {
    console.log('\n' + '=' .repeat(50));
    console.log('🔔 TEST 2: User Payment Confirmation');
    console.log('=' .repeat(50));

    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const userResult = await PaymentService.sendPaymentConfirmationNotification({
        userId: adminId, // Send to admin for testing
        plan: testPlan,
        transactionId: testPaymentData.transactionId,
        amount: testPaymentData.amount,
        expiryDate,
        language: 'es',
      });

      if (userResult) {
        console.log('✅ User confirmation sent successfully!');
        console.log(`   → Check your Telegram (${adminId}) for the PRIME activation message`);
        console.log('   → Should include: plan details, expiry date, PRIME channel invite link');
      } else {
        console.log('⚠️  User confirmation returned false');
      }
    } catch (error) {
      console.error('❌ User confirmation failed:', error.message);
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log('\nCheck your Telegram for:');
  console.log('1. Admin notification with "NUEVA COMPRA COMPLETADA"');
  console.log('2. User confirmation with "¡Pago Confirmado!" and PRIME channel link');
  console.log('\nIf you received both messages, the notification system is working! ✅');

  process.exit(0);
}

// Run test
testPaymentNotifications().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
