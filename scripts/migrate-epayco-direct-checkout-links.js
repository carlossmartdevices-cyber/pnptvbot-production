#!/usr/bin/env node
/**
 * Rewrite legacy ePayco pending checkout links from:
 *   https://<domain>/checkout/pnp?paymentId=<uuid>[&...]
 * to:
 *   https://<domain>/payment/<uuid>[&...without paymentId]
 *
 * Usage:
 *   node scripts/migrate-epayco-direct-checkout-links.js --dry-run
 *   node scripts/migrate-epayco-direct-checkout-links.js --apply
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getPool, closePool } = require('../src/config/postgres');

function loadEnv() {
  const explicitFile = process.env.ENV_FILE;
  const candidates = [
    explicitFile,
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

function toDirectCheckoutUrl(rawUrl, rowPaymentId) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { changed: false, reason: 'empty_url' };
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(rawUrl);
  const isAbsolutePath = rawUrl.startsWith('/');
  if (!hasScheme && !isAbsolutePath) {
    return { changed: false, reason: 'unsupported_url_format' };
  }

  let parsed;
  try {
    parsed = hasScheme
      ? new URL(rawUrl)
      : new URL(`https://placeholder.local${rawUrl}`);
  } catch (error) {
    return { changed: false, reason: 'invalid_url' };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/checkout/pnp') {
    return { changed: false, reason: 'not_legacy_checkout_path' };
  }

  const paymentIdInQuery = parsed.searchParams.get('paymentId');
  if (paymentIdInQuery && paymentIdInQuery !== rowPaymentId) {
    return { changed: false, reason: 'payment_id_mismatch' };
  }

  const effectivePaymentId = paymentIdInQuery || rowPaymentId;
  if (!effectivePaymentId) {
    return { changed: false, reason: 'missing_payment_id' };
  }

  parsed.pathname = `/payment/${effectivePaymentId}`;
  parsed.searchParams.delete('paymentId');

  const nextUrl = hasScheme
    ? parsed.toString()
    : `${parsed.pathname}${parsed.search}${parsed.hash}`;

  if (nextUrl === rawUrl) {
    return { changed: false, reason: 'already_migrated' };
  }

  return { changed: true, nextUrl };
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply;
  const loadedEnv = loadEnv();

  if (loadedEnv) {
    console.log(`Loaded environment from ${loadedEnv}`);
  } else {
    console.log('Loaded environment from process env/default .env resolution');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const selectResult = await client.query(
      `SELECT id, payment_url
       FROM payments
       WHERE provider = 'epayco'
         AND status = 'pending'
         AND payment_url IS NOT NULL
         AND payment_url ILIKE '%/checkout/pnp%'
       ORDER BY created_at DESC`
    );

    const candidates = selectResult.rows;
    const rewrites = [];
    const skippedByReason = {};

    for (const row of candidates) {
      const rewrite = toDirectCheckoutUrl(row.payment_url, row.id);
      if (rewrite.changed) {
        rewrites.push({
          id: row.id,
          from: row.payment_url,
          to: rewrite.nextUrl,
        });
      } else {
        skippedByReason[rewrite.reason] = (skippedByReason[rewrite.reason] || 0) + 1;
      }
    }

    console.log(`\nFound ${candidates.length} pending ePayco URLs matching legacy pattern.`);
    console.log(`Eligible rewrites: ${rewrites.length}`);
    if (Object.keys(skippedByReason).length > 0) {
      console.log('Skipped rows:');
      for (const [reason, count] of Object.entries(skippedByReason)) {
        console.log(`  - ${reason}: ${count}`);
      }
    }

    if (rewrites.length > 0) {
      console.log('\nPreview (first 10):');
      for (const row of rewrites.slice(0, 10)) {
        console.log(`- ${row.id}`);
        console.log(`  from: ${row.from}`);
        console.log(`  to:   ${row.to}`);
      }
    }

    if (isDryRun) {
      console.log('\nDry run complete. Re-run with --apply to persist changes.');
      return;
    }

    if (rewrites.length === 0) {
      console.log('\nNothing to update.');
      return;
    }

    await client.query('BEGIN');
    for (const row of rewrites) {
      await client.query(
        `UPDATE payments
         SET payment_url = $1,
             updated_at = NOW()
         WHERE id = $2::uuid`,
        [row.to, row.id]
      );
    }
    await client.query('COMMIT');

    console.log(`\nApplied ${rewrites.length} payment_url updates successfully.`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failures
    }
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(async (error) => {
  console.error('Unhandled migration error:', error.message);
  try {
    await closePool();
  } catch (_) {
    // ignore cleanup failures
  }
  process.exit(1);
});

