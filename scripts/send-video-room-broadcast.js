#!/usr/bin/env node

/**
 * Send Video Room Broadcast Announcement
 * Script to announce new video rooms with Jitsi Meet link
 */

// Load environment variables explicitly
const fs = require('fs');
const path = require('path');

// Parse .env file manually
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

/**
 * Create database pool
 */
function createPool() {
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'pnptvbot',
    user: process.env.POSTGRES_USER || 'pnptvbot',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: false,
  };

  console.log('Database config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password ? '***' : 'empty',
  });

  return new Pool(config);
}

/**
 * Get all active users from database
 */
async function getActiveUsers() {
  let pool = null;
  try {
    pool = createPool();

    const query = `
      SELECT user_id, language_preference
      FROM users
      WHERE is_active = true
      AND user_id IS NOT NULL
      ORDER BY user_id
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

/**
 * Send broadcast to users
 */
async function sendBroadcast() {
  try {
    const users = await getActiveUsers();

    if (users.length === 0) {
      logger.info('No active users found');
      return { sent: 0, failed: 0, total: 0 };
    }

    let sent = 0;
    let failed = 0;
    const delayBetweenMessages = 50; // 50ms delay to avoid rate limiting

    console.log(`\n📤 Starting broadcast to ${users.length} users...`);
    console.log(`⏱️  Using ${delayBetweenMessages}ms delay between messages\n`);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const lang = user.language_preference === 'es' ? 'es' : 'en';
      const message = broadcastMessages[lang];

      try {
        await bot.telegram.sendMessage(
          user.user_id,
          message,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('🎥 Join Video Room', VIDEO_ROOM_LINK)],
            ]),
          }
        );

        sent++;

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`✓ Progress: ${i + 1}/${users.length} (${Math.round((i + 1) / users.length * 100)}%)`);
        }

        // Delay to respect Telegram rate limits
        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
      } catch (error) {
        failed++;
        logger.error(`Failed to send to user ${user.user_id}:`, error.message);

        // Still delay on errors to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
      }
    }

    const result = {
      sent,
      failed,
      total: users.length,
      timestamp: new Date().toISOString(),
    };

    console.log(`\n✅ Broadcast Complete!`);
    console.log(`📊 Results:`);
    console.log(`   ✓ Sent: ${result.sent}`);
    console.log(`   ✗ Failed: ${result.failed}`);
    console.log(`   📈 Total: ${result.total}`);
    console.log(`   📅 Timestamp: ${result.timestamp}\n`);

    return result;
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🎥 Video Room Broadcast Script\n');

    // Test database connection first
    console.log('🔍 Testing database connection...');
    try {
      let testPool = createPool();
      const result = await testPool.query('SELECT NOW()');
      await testPool.end();
      console.log('✅ Database connection successful\n');
    } catch (err) {
      console.error('❌ Failed to connect to database:', err.message);
      process.exit(1);
    }

    console.log('📢 Announcement:');
    console.log('-'.repeat(60));
    console.log(broadcastMessages.en);
    console.log('-'.repeat(60));
    console.log(`\n🔗 Video Room Link: ${VIDEO_ROOM_LINK}\n`);

    // Confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('⚠️  Ready to send broadcast to all active users? (yes/no): ', async (answer) => {
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Broadcast cancelled');
        process.exit(0);
      }

      try {
        await sendBroadcast();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendBroadcast, getActiveUsers };
