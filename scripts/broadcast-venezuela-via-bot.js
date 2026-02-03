#!/usr/bin/env node

/**
 * Venezuela Fundraising Broadcast - Via Bot Handler
 * Triggers broadcast through the bot's built-in broadcast service
 */

require('dotenv').config({ allowEmptyValues: true });

const { Telegraf } = require('telegraf');
const { initializeFirebase } = require('../src/config/firebase');
const logger = require('../src/utils/logger');
const adminService = require('../src/bot/services/adminService');

const DONATION_LINK = 'https://www.paypal.com/donate/?hosted_button_id=JP32JBXXNMYLN';
const PRIVATE_CALL_LINK = 'https://pay.getmeru.com/8nADxy';
const ADMIN_ID = process.env.ADMIN_ID || '8365312597';

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

async function sendBroadcast() {
  try {
    // Initialize Firebase
    logger.info('Initializing Firebase...');
    initializeFirebase();

    // Initialize bot
    const bot = new Telegraf(process.env.BOT_TOKEN);
    logger.info('Bot initialized');

    // Prepare combined message (will be sent in user's preferred language by userService)
    const message = broadcastMessages.en;

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

    console.log('📤 Starting broadcast via bot handler...\n');

    // Send broadcast using adminService
    const results = await adminService.sendBroadcast(bot, ADMIN_ID, message);

    console.log(`\n✅ Broadcast Complete!`);
    console.log(`📊 Results:`);
    console.log(`   ✓ Sent: ${results.sent}`);
    console.log(`   ✗ Failed: ${results.failed}`);
    console.log(`   📈 Total: ${results.total}`);
    console.log(`   🤖 Skipped Bots: ${results.skippedBots || 0}\n`);

    if (results.errors && results.errors.length > 0 && results.errors.length <= 10) {
      console.log('⚠️  Sample Errors:');
      results.errors.slice(0, 10).forEach(err => {
        console.log(`   • User ${err.userId}: ${err.error}`);
      });
      console.log();
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    logger.error('Broadcast error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  sendBroadcast();
}

module.exports = { sendBroadcast };
