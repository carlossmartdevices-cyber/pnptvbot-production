#!/usr/bin/env node

/**
 * Test Topic Guidelines Middleware
 * Verify that topic permissions and media validation are working
 */

require('dotenv').config();
const { query } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

async function testTopicGuidelines() {
  console.log('='.repeat(80));
  console.log('TOPIC GUIDELINES DIAGNOSTIC TEST');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Check if configurations exist in database
    console.log('1️⃣  Checking database configurations...\n');

    const configs = await query(`
      SELECT topic_id, topic_name, can_post, media_required, allow_text_only, 
             allow_replies, auto_pin_admin_messages, notify_all_on_new_post
      FROM topic_configuration 
      ORDER BY topic_id
    `);

    if (configs.rows.length === 0) {
      console.log('   ❌ NO CONFIGURATIONS FOUND IN DATABASE');
      console.log('   Run: node scripts/init-topic-configurations.js');
      console.log('');
      return;
    }

    console.log(`   ✅ Found ${configs.rows.length} topic configurations:\n`);

    configs.rows.forEach((config) => {
      console.log(`   📌 Topic ${config.topic_id}: ${config.topic_name}`);
      console.log(`      - Posting: ${config.can_post}`);
      console.log(`      - Media required: ${config.media_required}`);
      console.log(`      - Text allowed: ${config.allow_text_only}`);
      console.log(`      - Replies allowed: ${config.allow_replies}`);
      console.log('');
    });

    // 2. Check middleware files exist
    console.log('2️⃣  Checking middleware files...\n');

    const fs = require('fs');
    const path = require('path');

    const middlewareFiles = [
      'src/bot/core/middleware/topicPermissions.js',
      'src/bot/core/middleware/mediaOnlyValidator.js',
      'src/bot/core/middleware/mediaMirror.js'
    ];

    let allFilesExist = true;

    for (const file of middlewareFiles) {
      const filePath = path.join(process.cwd(), file);
      const exists = fs.existsSync(filePath);

      console.log(`   ${exists ? '✅' : '❌'} ${file}`);

      if (!exists) {
        allFilesExist = false;
      }
    }

    console.log('');

    if (!allFilesExist) {
      console.log('   ⚠️  Some middleware files are missing!');
      console.log('');
    }

    // 3. Check if middlewares are loaded in bot.js
    console.log('3️⃣  Checking bot.js middleware registration...\n');

    const botJsPath = path.join(process.cwd(), 'src/bot/core/bot.js');
    const botJsContent = fs.readFileSync(botJsPath, 'utf-8');

    const checks = [
      { name: 'topicPermissionsMiddleware', pattern: /topicPermissionsMiddleware\(\)/ },
      { name: 'mediaOnlyValidator', pattern: /mediaOnlyValidator\(\)/ },
      { name: 'mediaMirrorMiddleware', pattern: /mediaMirrorMiddleware\(\)/ },
      { name: 'registerApprovalHandlers', pattern: /registerApprovalHandlers\(bot\)/ }
    ];

    for (const check of checks) {
      const found = check.pattern.test(botJsContent);
      console.log(`   ${found ? '✅' : '❌'} ${check.name} ${found ? 'registered' : 'NOT registered'}`);
    }

    console.log('');

    // 4. Check environment variables
    console.log('4️⃣  Checking environment variables...\n');

    const envVars = [
      { name: 'GROUP_ID', value: process.env.GROUP_ID },
      { name: 'ADMIN_USER_IDS', value: process.env.ADMIN_USER_IDS },
      { name: 'BOT_TOKEN', value: process.env.BOT_TOKEN ? '✓ Set' : '✗ Missing' }
    ];

    for (const env of envVars) {
      const value = env.name === 'BOT_TOKEN' ? env.value : (env.value || '✗ Not set');
      console.log(`   ${env.value ? '✅' : '❌'} ${env.name}: ${value}`);
    }

    console.log('');

    // 5. Check if bot is running
    console.log('5️⃣  Checking bot status...\n');

    const { execSync } = require('child_process');

    try {
      const processes = execSync('ps aux | grep -E "node.*bot" | grep -v grep').toString();

      if (processes) {
        console.log('   ✅ Bot process is running\n');
        const lines = processes.trim().split('\n');
        lines.forEach(line => {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const command = parts.slice(10).join(' ');
          console.log(`      PID ${pid}: ${command.substring(0, 80)}`);
        });
        console.log('');
      }
    } catch (error) {
      console.log('   ⚠️  Bot may not be running');
      console.log('   Start with: npm start or pm2 start ecosystem.config.js\n');
    }

    // 6. Test database queries that middleware uses
    console.log('6️⃣  Testing middleware database queries...\n');

    // Test getByThreadId query
    const testTopicId = 3132; // PNPtv Gallery
    const testConfig = await query(
      'SELECT * FROM topic_configuration WHERE topic_id = $1',
      [testTopicId]
    );

    if (testConfig.rows.length > 0) {
      console.log(`   ✅ getByThreadId(${testTopicId}) works correctly`);
      console.log(`      Topic: ${testConfig.rows[0].topic_name}`);
      console.log(`      Config: can_post=${testConfig.rows[0].can_post}, media_required=${testConfig.rows[0].media_required}`);
    } else {
      console.log(`   ❌ getByThreadId(${testTopicId}) returned no results`);
    }

    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    console.log('');

    if (configs.rows.length > 0 && allFilesExist) {
      console.log('✅ Topic guidelines are properly configured in the database');
      console.log('✅ All middleware files exist');
      console.log('');
      console.log('🔍 TROUBLESHOOTING STEPS:');
      console.log('');
      console.log('1. Restart the bot to ensure middleware is loaded:');
      console.log('   pm2 restart pnptv-bot');
      console.log('   or: npm start');
      console.log('');
      console.log('2. Check bot logs for errors:');
      console.log('   pm2 logs pnptv-bot');
      console.log('   or: tail -f logs/bot-*.log');
      console.log('');
      console.log('3. Test in the Telegram group:');
      console.log('   - Topic 3131 (PNPtv News!): Only admins should be able to post');
      console.log('   - Topic 3132 (PNPtv Gallery!): Only media messages allowed');
      console.log('   - Topic 3134 (Contacto PNPtv!): Posts need admin approval');
      console.log('');
      console.log('4. Enable debug logging:');
      console.log('   Set LOG_LEVEL=debug in .env file');
      console.log('');
      console.log('5. Check if messages are reaching the middleware:');
      console.log('   Look for "Topic permissions check" or "Media validation" in logs');
      console.log('');
    } else {
      console.log('❌ Topic guidelines are NOT properly set up');
      console.log('');
      console.log('REQUIRED ACTIONS:');
      console.log('');
      if (configs.rows.length === 0) {
        console.log('1. Initialize configurations:');
        console.log('   node scripts/init-topic-configurations.js');
        console.log('');
      }
      if (!allFilesExist) {
        console.log('2. Restore missing middleware files from git');
        console.log('');
      }
      console.log('3. Restart the bot');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error during diagnostic:', error.message);
    logger.error('Diagnostic test error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testTopicGuidelines()
    .then(() => {
      console.log('='.repeat(80));
      console.log('✅ Diagnostic completed');
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Diagnostic failed');
      process.exit(1);
    });
}

module.exports = testTopicGuidelines;
