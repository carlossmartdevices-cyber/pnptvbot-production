#!/usr/bin/env node

/**
 * Venezuela Fundraising Broadcast - PostgreSQL Direct
 * Uses PostgreSQL to get users and sends via Telegram API
 */

// Force IPv4 DNS resolution
require('dns').setDefaultResultOrder('ipv4first');

require('dotenv').config();

const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

const DONATION_LINK = 'https://www.paypal.com/donate/?hosted_button_id=JP32JBXXNMYLN';
const PRIVATE_CALL_LINK = 'https://pay.getmeru.com/DxMlZO';

const broadcastMessages = {
  en: `🇻🇪 *Venezuela Fundraising Initiative*

*PNPtv Main Room* will feature **Lex and Santino** tonight in support of fundraising efforts for our families in Venezuela.

This decision was not made lightly. We were hesitant to speak publicly, as we never want to appear opportunistic or insensitive while our loved ones back home are facing fear and uncertainty.

However, many of the individuals who appear in PNPtv content — as well as others who remain behind the scenes — are Venezuelan and are currently seeking ways to support their families. At this time, we are not able to assist everyone on our own.

Due to the seriousness of the situation, we chose to be transparent and open this initiative to the community. We appreciate your understanding and respect in receiving this message.

*How You Can Help*

🔹 **Donate** - Support our fundraising efforts
👉 [Donate via PayPal](${DONATION_LINK})

🔹 **Book a Private Call** - Support the cause by booking a private call
👉 [Book a Private Call](${PRIVATE_CALL_LINK})

All donors will receive clear proof and transparency regarding how their contributions are used.

Thank you for your support, solidarity, and trust.`,

  es: `🇻🇪 *Iniciativa de Recaudación para Venezuela*

*PNPtv Main Room* contará con **Lex y Santino** esta noche en apoyo de los esfuerzos de recaudación para nuestras familias en Venezuela.

Esta decisión no se tomó a la ligera. Nos mostramos reacios a hablar públicamente, ya que nunca queremos parecer oportunistas o insensibles mientras nuestros seres queridos en casa enfrentan miedo e incertidumbre.

Sin embargo, muchas de las personas que aparecen en contenido de PNPtv — así como otros que trabajan detrás de escenas — son venezolanos y actualmente buscan formas de apoyar a sus familias. Por el momento, no podemos ayudar a todos por nuestra cuenta.

Debido a la gravedad de la situación, decidimos ser transparentes y abrir esta iniciativa a la comunidad. Apreciamos su comprensión y respeto al recibir este mensaje.

*¿Cómo Puedes Ayudar?*

🔹 **Donar** - Apoya nuestros esfuerzos de recaudación
👉 [Donar vía PayPal](${DONATION_LINK})

🔹 **Reservar una Llamada Privada** - Apoya la causa reservando una llamada privada
👉 [Reservar Llamada Privada](${PRIVATE_CALL_LINK})

Todos los donantes recibirán prueba clara y transparencia sobre cómo se utilizan sus contribuciones.

Gracias por su apoyo, solidaridad y confianza.`,
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
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN environment variable is not set');
    }

    const bot = new Telegraf(process.env.BOT_TOKEN);
    logger.info('Bot initialized');

    console.log('\n🇻🇪 Venezuela Fundraising Broadcast\n');
    console.log('📢 Message Preview (EN):');
    console.log('-'.repeat(80));
    console.log(broadcastMessages.en);
    console.log('-'.repeat(80));
    console.log('\n📢 Message Preview (ES):');
    console.log('-'.repeat(80));
    console.log(broadcastMessages.es);
    console.log('-'.repeat(80));
    console.log(`\n🔗 Donation Link: ${DONATION_LINK}`);
    console.log(`🔗 Private Call Link: ${PRIVATE_CALL_LINK}\n`);

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

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    logger.error('Broadcast error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  sendBroadcast();
}

module.exports = { sendBroadcast, getActiveUsers };