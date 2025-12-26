#!/usr/bin/env node

/**
 * Send Video Room Broadcast - Non-interactive version
 */

// Load environment variables explicitly
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

const bot = new Telegraf(process.env.BOT_TOKEN);

const VIDEO_ROOM_LINK = 'https://meet.jit.si/pnptv-main-room-1#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=Username';

const broadcastMessages = {
  en: `🎥 *New Video Rooms Available!*\n\nWe're excited to announce that video rooms are now available on PNPTV!\n\n✨ *Features:*\n• Direct video conferencing\n• No downloads required\n• Works on all devices\n• Secure and private\n\n📺 Join our main room now and connect with the community!`,
  es: `🎥 *¡Nuevas Salas de Video Disponibles!*\n\n¡Nos complace anunciar que las salas de video ya están disponibles en PNPTV!\n\n✨ *Características:*\n• Videoconferencias directas\n• Sin descargas requeridas\n• Funciona en todos los dispositivos\n• Seguro y privado\n\n📺 ¡Únete a nuestra sala principal ahora y conéctate con la comunidad!`,
};

function createPool() {
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'pnptvbot',
    user: process.env.POSTGRES_USER || 'pnptvbot',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: false,
  };

  return new Pool(config);
}

async function getActiveUsers() {
  let pool = null;
  try {
    pool = createPool();

    const query = `
      SELECT id as user_id, language
      FROM users
      WHERE is_active = true
      AND id IS NOT NULL
      ORDER BY id
    `;

    const result = await pool.query(query);
    logger.info(`Found ${result.rows.length} active users`);

    await pool.end();
    return result.rows;
  } catch (error) {
    logger.error('Error fetching active users:', error);
    if (pool) {
      await pool.end().catch(() => {});
    }
    throw error;
  }
}

async function sendBroadcast() {
  try {
    const users = await getActiveUsers();

    if (users.length === 0) {
      console.log('ℹ️  No active users found');
      return { sent: 0, failed: 0, total: 0 };
    }

    let sent = 0;
    let failed = 0;
    const delayBetweenMessages = 50;

    console.log(`\n📤 Starting broadcast to ${users.length} users...`);
    console.log(`⏱️  Using ${delayBetweenMessages}ms delay between messages\n`);

    const startTime = Date.now();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const lang = user.language === 'es' ? 'es' : 'en';
      const msg = broadcastMessages[lang];

      try {
        await bot.telegram.sendMessage(
          user.user_id,
          msg,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('🎥 Join Video Room', VIDEO_ROOM_LINK)],
            ]),
          }
        );

        sent++;

        if ((i + 1) % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
          console.log(`✓ ${i + 1}/${users.length} (${Math.round((i + 1) / users.length * 100)}%) - ${elapsed}s elapsed - ${rate} msg/sec`);
        }

        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
      } catch (error) {
        failed++;
        // Log detailed error only for first few failures to not spam logs
        if (failed <= 10) {
          logger.error(`Failed to send to user ${user.user_id}:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (users.length / ((Date.now() - startTime) / 1000)).toFixed(1);

    const result = {
      sent,
      failed,
      total: users.length,
      timestamp: new Date().toISOString(),
      duration: totalTime,
      avgRate,
    };

    console.log(`\n✅ Broadcast Complete!`);
    console.log(`📊 Results:`);
    console.log(`   ✓ Sent: ${result.sent}`);
    console.log(`   ✗ Failed: ${result.failed}`);
    console.log(`   📈 Total: ${result.total}`);
    console.log(`   ⏱️  Duration: ${result.duration}s`);
    console.log(`   📤 Rate: ${result.avgRate} msg/sec`);
    console.log(`   📅 Timestamp: ${result.timestamp}\n`);

    return result;
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('\n🎥 Video Room Broadcast - Non-interactive Mode\n');
    console.log('📢 Announcement (EN):');
    console.log('-'.repeat(60));
    console.log(broadcastMessages.en);
    console.log('-'.repeat(60));
    console.log('\n📢 Announcement (ES):');
    console.log('-'.repeat(60));
    console.log(broadcastMessages.es);
    console.log('-'.repeat(60));
    console.log(`\n🔗 Video Room Link: ${VIDEO_ROOM_LINK}\n`);

    await sendBroadcast();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { sendBroadcast, getActiveUsers };
