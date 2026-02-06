#!/usr/bin/env node

/**
 * Test script for Daimo Pay webhook
 * This script sends a mock webhook payload to test the integration
 *
 * Usage:
 *   node scripts/test-daimo-webhook.js
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Mock webhook payload (mimics Daimo Pay webhook format)
const mockWebhookPayload = {
  id: 'pay_test_123abc',
  status: 'payment_completed',
  source: {
    payerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    chainId: 10, // Optimism
    amountUnits: '10000000', // 10 USDC (6 decimals)
    tokenSymbol: 'USDC',
  },
  destination: {
    toAddress: process.env.DAIMO_TREASURY_ADDRESS || '0xYourTreasuryAddress',
    toChain: 10,
    toToken: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
  },
  metadata: {
    userId: '123456789',
    chatId: '123456789',
    planId: 'test_plan',
    amount: '10.00',
    timestamp: new Date().toISOString(),
  },
};

/**
 * Generate webhook signature
 * @param {Object} payload - Webhook payload
 * @returns {string} HMAC signature
 */
function generateSignature(payload) {
  const secret = process.env.DAIMO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('DAIMO_WEBHOOK_SECRET not configured in .env');
  }

  const { signature, ...data } = payload;
  const payloadString = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return hmac.digest('hex');
}

/**
 * Send test webhook to local server
 */
async function testWebhook() {
  try {
    console.log('🧪 Testing Daimo Pay Webhook Integration\n');

    // Validate environment
    console.log('📋 Checking environment variables...');
    const requiredVars = [
      'DAIMO_WEBHOOK_SECRET',
      'DAIMO_TREASURY_ADDRESS',
      'BOT_WEBHOOK_DOMAIN',
    ];

    const missingVars = requiredVars.filter((v) => !process.env[v]);
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach((v) => console.error(`   - ${v}`));
      process.exit(1);
    }
    console.log('✅ Environment variables configured\n');

    // Generate signature
    console.log('🔐 Generating webhook signature...');
    const signature = generateSignature(mockWebhookPayload);
    const payloadWithSignature = {
      ...mockWebhookPayload,
      signature,
    };
    console.log(`✅ Signature: ${signature.substring(0, 16)}...\n`);

    // Determine webhook URL
    const webhookUrl = process.env.BOT_WEBHOOK_DOMAIN
      ? `${process.env.BOT_WEBHOOK_DOMAIN}/api/webhooks/daimo`
      : 'http://localhost:3000/api/webhooks/daimo';

    console.log(`📡 Sending webhook to: ${webhookUrl}`);
    console.log('📦 Payload:');
    console.log(JSON.stringify(mockWebhookPayload, null, 2));
    console.log('');

    // Send webhook
    const response = await axios.post(webhookUrl, payloadWithSignature, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Daimo-Webhook-Test/1.0',
        'Authorization': `Basic ${process.env.DAIMO_WEBHOOK_SECRET}`,
      },
      timeout: 10000,
    });

    console.log(`✅ Webhook sent successfully!`);
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📄 Response data:`, response.data);
    console.log('');

    if (response.status === 200 && response.data.success) {
      console.log('✅ Webhook processed successfully!\n');
      console.log('🎉 Integration test PASSED\n');
      console.log('Next steps:');
      console.log('1. Check your database to verify payment record was created/updated');
      console.log('2. Check logs for detailed processing information');
      console.log('3. Verify subscription was activated (if using real user/plan IDs)');
    } else {
      console.log('⚠️  Webhook was received but processing may have failed');
      console.log('Check server logs for more details\n');
    }
  } catch (error) {
    console.error('❌ Webhook test failed!\n');

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Make sure your server is running on', process.env.BOT_WEBHOOK_DOMAIN || 'http://localhost:3000');
    } else {
      console.error('Error:', error.message);
    }

    console.error('\nTroubleshooting:');
    console.error('1. Ensure server is running: npm start');
    console.error('2. Check BOT_WEBHOOK_DOMAIN in .env is correct');
    console.error('3. Verify firewall allows connections');
    console.error('4. Review server logs for errors\n');

    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testWebhook();
}

module.exports = { testWebhook, generateSignature };
