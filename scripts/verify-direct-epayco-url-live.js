#!/usr/bin/env node
/**
 * Live verification for direct ePayco checkout URL generation.
 *
 * It executes the same service path the bot uses:
 *   PaymentService.createPayment({ userId, planId, provider: 'epayco' })
 * and confirms that generated URL is /payment/<paymentId> (for one-time plans).
 *
 * Usage:
 *   node scripts/verify-direct-epayco-url-live.js --user 7994165609 --plan monthly-pass
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { closePool } = require('../src/config/postgres');
const { cache } = require('../src/config/redis');
const PaymentModel = require('../src/models/paymentModel');
const PaymentService = require('../src/bot/services/paymentService');

function loadEnv() {
  const candidates = [
    process.env.ENV_FILE,
    '.env',
    '.env.production',
    '.env.development',
  ].filter(Boolean);

  for (const file of candidates) {
    const resolved = path.resolve(process.cwd(), file);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved });
      return resolved;
    }
  }

  dotenv.config();
  return null;
}

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

async function closeInfra() {
  try {
    await closePool();
  } catch (_) {
    // ignore
  }
  try {
    if (cache && typeof cache.quit === 'function') {
      await cache.quit();
    }
  } catch (_) {
    // ignore
  }
}

async function main() {
  const envPath = loadEnv();
  if (envPath) {
    console.log(`Loaded env from ${envPath}`);
  }

  const userId = getArg('--user');
  const planId = getArg('--plan', 'monthly-pass');

  if (!userId) {
    throw new Error('Missing --user <telegram_user_id>');
  }

  const result = await PaymentService.createPayment({
    userId: String(userId),
    planId,
    provider: 'epayco',
  });

  const payment = await PaymentModel.getById(result.paymentId);
  const generatedUrl = result.paymentUrl;
  const persistedUrl = payment?.paymentUrl || null;

  console.log('\nLive verification result:');
  console.log(`- paymentId: ${result.paymentId}`);
  console.log(`- generated paymentUrl: ${generatedUrl}`);
  console.log(`- persisted payment_url: ${persistedUrl}`);

  const expectedPath = `/payment/${result.paymentId}`;
  const generatedOk = typeof generatedUrl === 'string' && generatedUrl.includes(expectedPath);
  const persistedOk = typeof persistedUrl === 'string' && persistedUrl.includes(expectedPath);

  if (generatedOk && persistedOk) {
    console.log('\nPASS: ePayco one-time payment URL is direct /payment/<id>.');
  } else {
    console.log('\nFAIL: URL is not direct /payment/<id>.');
    process.exitCode = 1;
  }
}

main()
  .catch(async (error) => {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeInfra();
  });

