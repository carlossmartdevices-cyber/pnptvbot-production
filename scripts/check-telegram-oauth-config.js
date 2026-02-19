#!/usr/bin/env node

/**
 * Diagnostic script to check Telegram OAuth configuration.
 * Run this to verify the bot is properly configured for OAuth login.
 */

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN || '8571930103:AAHIxAeI2CEqgF3arK4D4dZNHFYxgNa_nt0';
const BOT_USERNAME = process.env.BOT_USERNAME || 'PNPLatinoTV_Bot';
const BOT_DOMAIN = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';

console.log('\n=== TELEGRAM OAUTH CONFIGURATION CHECK ===\n');

console.log('1. Bot Information:');
console.log(`   Token: ${BOT_TOKEN.substring(0, 20)}...${BOT_TOKEN.substring(BOT_TOKEN.length - 5)}`);
console.log(`   Bot ID: ${BOT_TOKEN.split(':')[0]}`);
console.log(`   Username: @${BOT_USERNAME}`);
console.log(`   Domain: ${BOT_DOMAIN}`);

console.log('\n2. Required BotFather Configuration:');
console.log(`   ❌ Step 1: Open @BotFather in Telegram`);
console.log(`   ❌ Step 2: Select /setdomain`);
console.log(`   ❌ Step 3: Choose your bot (@${BOT_USERNAME})`);
console.log(`   ❌ Step 4: Enter domain: ${BOT_DOMAIN.replace('https://', '')}`);
console.log(`   ❌ Step 5: Confirm`);

console.log('\n3. OAuth Flow Testing:');

// Simulate what Telegram would send back
const testAuthDate = Math.floor(Date.now() / 1000);
const testData = {
  id: '123456789',
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  auth_date: testAuthDate.toString(),
};

// Calculate what hash SHOULD be
const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
const checkString = Object.keys(testData)
  .sort()
  .map(k => `${k}=${testData[k]}`)
  .join('\n');

const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

console.log(`   Test data generated:`);
console.log(`   - User ID: ${testData.id}`);
console.log(`   - Auth Date: ${testData.auth_date}`);
console.log(`   - Expected Hash: ${expectedHash.substring(0, 20)}...${expectedHash.substring(expectedHash.length - 5)}`);

console.log('\n4. Testing Hash Verification Logic:');

function verifyTelegramAuth(data) {
  const { hash, ...rest } = data;
  if (!hash) return { valid: false, error: 'No hash provided' };

  const checkStr = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkStr).digest('hex');

  const authDate = parseInt(data.auth_date, 10);
  const timeDiff = Math.floor(Date.now() / 1000) - authDate;

  return {
    valid: calculatedHash === hash && Math.abs(timeDiff) < 86400,
    hashMatch: calculatedHash === hash,
    timeDiff,
    error: !calculatedHash === hash ? 'Hash mismatch' : timeDiff > 86400 ? 'Auth expired' : null,
  };
}

// Test with correct hash
const testWithCorrectHash = {
  ...testData,
  hash: expectedHash,
};

const testWithWrongHash = {
  ...testData,
  hash: 'wronghash123456',
};

const result1 = verifyTelegramAuth(testWithCorrectHash);
const result2 = verifyTelegramAuth(testWithWrongHash);

console.log(`   With correct hash: ${result1.valid ? '✓ PASS' : '✗ FAIL'}`);
if (!result1.valid) console.log(`     Error: ${result1.error}`);

console.log(`   With wrong hash: ${result2.valid ? '✗ UNEXPECTED PASS' : '✓ CORRECTLY REJECTED'}`);
if (!result2.valid) console.log(`     Reason: ${result2.error}`);

console.log('\n5. Common Issues & Solutions:');
console.log(`   ✓ Issue: Hash verification always fails`);
console.log(`     Solution: Domain MUST be set in BotFather via /setdomain`);
console.log(`     Why: Telegram only returns valid hashes to registered domains`);
console.log(`\n   ✓ Issue: "Connection refused" or OAuth page doesn't load`);
console.log(`     Solution: Check that bot's domain resolves to your server IP`);
console.log(`     Test: ping ${BOT_DOMAIN.replace('https://', '')} from your server`);
console.log(`\n   ✓ Issue: Works in development but not in production`);
console.log(`     Solution: Make sure HTTPS is enabled and certificates are valid`);
console.log(`     Test: curl -I ${BOT_DOMAIN}`);

console.log('\n6. Quick Test Links:');
console.log(`   OAuth Button: https://oauth.telegram.org/auth`);
console.log(`   With bot_id: https://oauth.telegram.org/auth?bot_id=${BOT_TOKEN.split(':')[0]}&origin=${encodeURIComponent(BOT_DOMAIN)}&return_to=${encodeURIComponent(BOT_DOMAIN + '/api/webapp/auth/telegram/callback')}`);

console.log('\n=== END OF DIAGNOSTIC CHECK ===\n');
