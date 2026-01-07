/**
 * Delete Telegraf sessions stored in Redis.
 *
 * Default is DRY RUN (no deletion). Use --execute to actually delete.
 *
 * Usage:
 *   node scripts/cleanup-sessions.js                 # dry run (shows counts)
 *   node scripts/cleanup-sessions.js --execute       # deletes keys
 *   node scripts/cleanup-sessions.js --pattern 'session:*'
 *   node scripts/cleanup-sessions.js --pattern 'session:*' --scan-limit 20000 --execute
 */

require('dotenv').config();

const { cache, getRedis, closeRedis } = require('../src/config/redis');

function parseArgs(argv) {
  const options = {
    pattern: 'session:*',
    scanLimit: 20000,
    execute: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--execute' || arg === '--yes') {
      options.execute = true;
      continue;
    }

    if (arg === '--pattern' && argv[i + 1]) {
      options.pattern = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--pattern=')) {
      options.pattern = arg.slice('--pattern='.length);
      continue;
    }

    if (arg === '--scan-limit' && argv[i + 1]) {
      options.scanLimit = parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg.startsWith('--scan-limit=')) {
      options.scanLimit = parseInt(arg.slice('--scan-limit='.length), 10);
      continue;
    }
  }

  if (!Number.isFinite(options.scanLimit) || options.scanLimit < 0) options.scanLimit = 20000;
  if (!options.pattern) options.pattern = 'session:*';

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const redis = getRedis();

  const keys = await cache.scanKeys(options.pattern, options.scanLimit);
  const totalFound = keys.length;

  if (!options.execute) {
    console.log(`DRY RUN: would delete ${totalFound} keys matching ${options.pattern} (scanLimit=${options.scanLimit}).`);
    if (totalFound > 0) {
      console.log(`Example keys: ${keys.slice(0, 10).join(', ')}`);
    }
    console.log('Re-run with --execute to delete.');
    await closeRedis();
    return;
  }

  const deleted = await cache.delPattern(options.pattern);
  const remaining = await cache.scanKeys(options.pattern, Math.min(options.scanLimit, 1000));

  console.log(`Deleted ${deleted} keys matching ${options.pattern}.`);
  console.log(`Remaining (sample up to 1000 scan results): ${remaining.length}`);

  await redis.quit();
}

main().catch(async (err) => {
  try {
    await closeRedis();
  } catch (_e) {
    // ignore
  }
  console.error(err);
  process.exitCode = 1;
});

