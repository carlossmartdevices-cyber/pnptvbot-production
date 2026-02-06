/**
 * One-off script: Send PRIME main menu to all active PRIME members
 */
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const { t } = require('../src/utils/i18n');

const bot = new Telegraf(process.env.BOT_TOKEN);

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const sanitizeMarkdown = (text) => {
  if (!text) return '';
  return text.replace(/`\n/g, '` \n').replace(/\n`/g, '\n `');
};

const buildPrimeMenuButtons = (lang) => ([
  [
    Markup.button.url(
      lang === 'es' ? 'PNP Latino TV | Ver ahora' : 'PNP Latino TV | Watch now',
      'https://t.me/+GDD0AAVbvGM3MGEx'
    ),
  ],
  [
    Markup.button.callback(
      lang === 'es' ? 'PNP Live | Hombres Latinos en Webcam' : 'PNP Live | Latino Men on Webcam',
      'PNP_LIVE_START'
    ),
  ],
  [
    Markup.button.callback(
      lang === 'es' ? 'PNP tv App | Área PRIME' : 'PNP tv App | PRIME area',
      'menu_pnp_tv_app'
    ),
  ],
  [
    Markup.button.callback(lang === 'es' ? '👤 Mi Perfil' : '👤 My Profile', 'show_profile'),
    Markup.button.callback(lang === 'es' ? '🆘 Ayuda y Soporte' : '🆘 Help & Support', 'show_support'),
  ],
]);

async function main() {
  const { rows } = await pool.query(`
    SELECT id, language FROM users
    WHERE subscription_status = 'active' AND tier = 'Prime' AND id NOT LIKE 'legacy_%'
    ORDER BY id
  `);

  console.log(`Sending PRIME menu to ${rows.length} users...`);

  let sent = 0;
  let failed = 0;

  for (const user of rows) {
    const lang = user.language || 'es';
    const menuText = `💎 *${lang === 'es' ? 'Membresía' : 'Membership'}: PRIME*\n\n` +
      t('pnpLatinoPrimeMenu', lang);
    const buttons = buildPrimeMenuButtons(lang);
    const keyboard = Markup.inlineKeyboard(buttons);

    try {
      await bot.telegram.sendMessage(user.id, sanitizeMarkdown(menuText), {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      sent++;
      console.log(`✅ Sent to ${user.id} (${lang})`);
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
      console.log(`❌ Failed ${user.id}: ${err.message}`);
    }
  }

  console.log(`\nDone! Sent: ${sent}, Failed: ${failed}`);
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
