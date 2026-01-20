#!/usr/bin/env node
/**
 * Send Promo Broadcast to Users with Failed/Cancelled Payments
 * Target: Users who had epayco or daimo payments that were cancelled or failed
 * Promo: $10/month or $5/week - valid for 6 hours only
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Telegraf } = require('telegraf');
const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');
const { v4: uuidv4 } = require('uuid');
const PaymentModel = require('../src/models/paymentModel');
const DaimoConfig = require('../src/config/daimo');

// Promo configuration
const PROMO_MONTH_PRICE = 10.00; // USD
const PROMO_WEEK_PRICE = 5.00;   // USD
const PROMO_DURATION_HOURS = 6;
const PROMO_EXPIRY = new Date(Date.now() + PROMO_DURATION_HOURS * 60 * 60 * 1000);

// Promo plan IDs
const PROMO_MONTH_PLAN_ID = 'promo-monthly-10';
const PROMO_WEEK_PLAN_ID = 'promo-weekly-5';

/**
 * Create or update promo plans in the database
 */
async function ensurePromoPlansExist() {
  const pool = getPool();

  const promoPlans = [
    {
      id: PROMO_MONTH_PLAN_ID,
      sku: 'EASYBOTS-PROMO-030',
      name: 'PROMO Monthly Pass',
      name_es: 'PROMO Pase Mensual',
      price: PROMO_MONTH_PRICE,
      currency: 'USD',
      duration_days: 30,
      features: ['Full PRIME access', 'Exclusive content', 'All premium features'],
      features_es: ['Acceso completo a PRIME', 'Contenido exclusivo', 'Todas las funciones premium'],
      active: true,
    },
    {
      id: PROMO_WEEK_PLAN_ID,
      sku: 'EASYBOTS-PROMO-007',
      name: 'PROMO Weekly Pass',
      name_es: 'PROMO Pase Semanal',
      price: PROMO_WEEK_PRICE,
      currency: 'USD',
      duration_days: 7,
      features: ['Full PRIME access', 'Exclusive content', 'All premium features'],
      features_es: ['Acceso completo a PRIME', 'Contenido exclusivo', 'Todas las funciones premium'],
      active: true,
    },
  ];

  for (const plan of promoPlans) {
    // First check if plan exists
    const checkQuery = 'SELECT id FROM plans WHERE id = $1';
    const existingPlan = await pool.query(checkQuery, [plan.id]);

    if (existingPlan.rows.length > 0) {
      // Update existing plan
      const updateQuery = `
        UPDATE plans SET
          price = $1,
          active = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      try {
        await pool.query(updateQuery, [plan.price, plan.active, plan.id]);
        console.log(`Promo plan updated: ${plan.id} - $${plan.price}`);
      } catch (error) {
        console.error(`Error updating promo plan ${plan.id}:`, error.message);
      }
    } else {
      // Insert new plan - use explicit array syntax
      const insertQuery = `
        INSERT INTO plans (id, sku, name, name_es, price, currency, duration_days, features, features_es, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10, NOW(), NOW())
        RETURNING *
      `;
      try {
        await pool.query(insertQuery, [
          plan.id, plan.sku, plan.name, plan.name_es, plan.price, plan.currency,
          plan.duration_days, plan.features, plan.features_es, plan.active
        ]);
        console.log(`Promo plan created: ${plan.id} - $${plan.price}`);
      } catch (error) {
        console.error(`Error creating promo plan ${plan.id}:`, error.message);
      }
    }
  }
}

/**
 * Query users with failed/cancelled payments from epayco or daimo
 */
async function getFailedPaymentUsers() {
  const pool = getPool();

  const query = `
    SELECT DISTINCT p.user_id, u.language, u.first_name, u.username
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id::text
    WHERE p.provider IN ('epayco', 'daimo')
      AND p.status IN ('failed', 'cancelled', 'pending')
      AND p.created_at > NOW() - INTERVAL '90 days'
      AND p.user_id IS NOT NULL
      AND p.user_id != ''
    ORDER BY p.user_id
  `;

  try {
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} users with failed/cancelled payments`);
    return result.rows;
  } catch (error) {
    console.error('Error querying failed payment users:', error);
    throw error;
  }
}

/**
 * Create Daimo promo payment record and get payment URL
 */
async function createDaimoPromoPayment(userId, planId, amount, description) {
  try {
    const paymentId = uuidv4();
    const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';

    // Create payment record
    await PaymentModel.create({
      paymentId,
      userId,
      planId,
      provider: 'daimo',
      amount,
      currency: 'USD',
      status: 'pending',
    });

    // Create Daimo payment link with custom promo amount
    const daimoResult = await DaimoConfig.createDaimoPayment({
      amount,
      userId,
      planId,
      chatId: userId,
      paymentId,
      description,
    });

    if (daimoResult.success && daimoResult.paymentUrl) {
      await PaymentModel.updateStatus(paymentId, 'pending', {
        paymentUrl: daimoResult.paymentUrl,
        provider: 'daimo',
      });
      return daimoResult.paymentUrl;
    }

    // Fallback to checkout page
    return `${webhookDomain}/daimo-checkout/${paymentId}`;
  } catch (error) {
    console.error('Error creating Daimo promo payment:', error);
    return null;
  }
}

/**
 * Create ePayco promo payment record and get payment URL
 */
async function createEpaycoPromoPayment(userId, planId, amount, description) {
  try {
    const paymentId = uuidv4();
    const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';

    // Create payment record
    await PaymentModel.create({
      paymentId,
      userId,
      planId,
      provider: 'epayco',
      amount,
      currency: 'USD',
      status: 'pending',
    });

    // ePayco uses checkout page
    const paymentUrl = `${webhookDomain}/checkout/${paymentId}`;
    await PaymentModel.updateStatus(paymentId, 'pending', {
      paymentUrl,
      provider: 'epayco',
    });

    return paymentUrl;
  } catch (error) {
    console.error('Error creating ePayco promo payment:', error);
    return null;
  }
}

/**
 * Build promo message for users
 */
function buildPromoMessage(language, expiryTime) {
  const expiryStr = expiryTime.toLocaleString(language === 'es' ? 'es-ES' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  if (language === 'es') {
    return `🔥 *¡OFERTA ESPECIAL SOLO PARA TI!* 🔥

Notamos que tu pago anterior no se completó. *¡Hemos solucionado los problemas de checkout!* 🛠️✅

💎 *PROMO EXCLUSIVA - Solo 6 horas:*

🗓️ *$10 USD/mes* (Regular: $24.99)
    ➡️ ¡Ahorra $14.99!

📅 *$5 USD/semana* (Regular: $14.99)
    ➡️ ¡Ahorra $9.99!

⏰ *Esta oferta expira a las ${expiryStr}*

✅ Acceso completo a PRIME
✅ Contenido exclusivo
✅ Todas las funciones premium
✅ Paga con Venmo, CashApp, Zelle, Wise o tarjeta

👇 *Elige tu plan y paga ahora:*`;
  }

  return `🔥 *SPECIAL OFFER JUST FOR YOU!* 🔥

We noticed your previous payment didn't go through. *We've fixed the checkout issues!* 🛠️✅

💎 *EXCLUSIVE PROMO - Only 6 hours:*

🗓️ *$10 USD/month* (Regular: $24.99)
    ➡️ Save $14.99!

📅 *$5 USD/week* (Regular: $14.99)
    ➡️ Save $9.99!

⏰ *This offer expires at ${expiryStr}*

✅ Full access to PRIME
✅ Exclusive content
✅ All premium features
✅ Pay with Venmo, CashApp, Zelle, Wise or card

👇 *Choose your plan and pay now:*`;
}

/**
 * Send broadcast to a single user
 */
async function sendToUser(bot, user, paymentUrls) {
  const language = user.language || 'en';
  const message = buildPromoMessage(language, PROMO_EXPIRY);

  // Build inline keyboard with payment buttons for both ePayco (card) and Daimo (apps)
  const keyboard = {
    inline_keyboard: [
      // Monthly plan - Card option
      [
        {
          text: language === 'es' ? '💳 $10/mes - Tarjeta' : '💳 $10/month - Card',
          url: paymentUrls.monthlyEpayco,
        },
        {
          text: language === 'es' ? '📱 $10/mes - Apps' : '📱 $10/month - Apps',
          url: paymentUrls.monthlyDaimo,
        }
      ],
      // Weekly plan - Card option
      [
        {
          text: language === 'es' ? '💳 $5/sem - Tarjeta' : '💳 $5/week - Card',
          url: paymentUrls.weeklyEpayco,
        },
        {
          text: language === 'es' ? '📱 $5/sem - Apps' : '📱 $5/week - Apps',
          url: paymentUrls.weeklyDaimo,
        }
      ],
    ],
  };

  try {
    await bot.telegram.sendMessage(user.user_id, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    return { success: true };
  } catch (error) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('blocked') || errorMsg.includes('deactivated')) {
      return { success: false, reason: 'blocked' };
    }
    return { success: false, reason: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Failed Payment Promo Broadcast');
  console.log('='.repeat(60));
  console.log(`Promo: $${PROMO_MONTH_PRICE}/month or $${PROMO_WEEK_PRICE}/week`);
  console.log(`Promo expires: ${PROMO_EXPIRY.toISOString()}`);
  console.log('='.repeat(60));

  // Initialize bot
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Create promo plans in database
  console.log('\nCreating promo plans...');
  await ensurePromoPlansExist();

  // Get target users
  const users = await getFailedPaymentUsers();

  if (users.length === 0) {
    console.log('No users found with failed/cancelled payments from epayco or daimo');
    process.exit(0);
  }

  console.log(`\nSending broadcast to ${users.length} users...\n`);

  const stats = {
    total: users.length,
    sent: 0,
    blocked: 0,
    failed: 0,
  };

  // Pre-create generic promo payment URLs for each user
  // These will create individual payment records per user
  const webhookDomain = process.env.BOT_WEBHOOK_DOMAIN || 'https://pnptv.app';

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;

    try {
      // Create payment URLs for both ePayco (card) and Daimo (apps) for each plan
      const monthlyDaimo = await createDaimoPromoPayment(
        user.user_id,
        PROMO_MONTH_PLAN_ID,
        PROMO_MONTH_PRICE,
        'PNPtv PROMO - Monthly Pass ($10)'
      );

      const monthlyEpayco = await createEpaycoPromoPayment(
        user.user_id,
        PROMO_MONTH_PLAN_ID,
        PROMO_MONTH_PRICE,
        'PNPtv PROMO - Monthly Pass ($10)'
      );

      const weeklyDaimo = await createDaimoPromoPayment(
        user.user_id,
        PROMO_WEEK_PLAN_ID,
        PROMO_WEEK_PRICE,
        'PNPtv PROMO - Weekly Pass ($5)'
      );

      const weeklyEpayco = await createEpaycoPromoPayment(
        user.user_id,
        PROMO_WEEK_PLAN_ID,
        PROMO_WEEK_PRICE,
        'PNPtv PROMO - Weekly Pass ($5)'
      );

      if (!monthlyDaimo || !monthlyEpayco || !weeklyDaimo || !weeklyEpayco) {
        console.log(`${progress} SKIP: Could not create payment URLs for user ${user.user_id}`);
        stats.failed++;
        continue;
      }

      const paymentUrls = {
        monthlyDaimo,
        monthlyEpayco,
        weeklyDaimo,
        weeklyEpayco,
      };

      const result = await sendToUser(bot, user, paymentUrls);

      if (result.success) {
        console.log(`${progress} SENT: User ${user.user_id} (${user.username || 'no username'})`);
        stats.sent++;
      } else if (result.reason === 'blocked') {
        console.log(`${progress} BLOCKED: User ${user.user_id}`);
        stats.blocked++;
      } else {
        console.log(`${progress} FAILED: User ${user.user_id} - ${result.reason}`);
        stats.failed++;
      }

      // Rate limiting - wait 100ms between sends
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`${progress} ERROR: User ${user.user_id} - ${error.message}`);
      stats.failed++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('BROADCAST COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total users targeted: ${stats.total}`);
  console.log(`Successfully sent: ${stats.sent}`);
  console.log(`Blocked/Deactivated: ${stats.blocked}`);
  console.log(`Failed: ${stats.failed}`);
  console.log('='.repeat(60));

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
