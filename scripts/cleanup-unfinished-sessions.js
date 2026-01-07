/**
 * Clean up unfinished Telegraf sessions stored in Redis.
 * 
 * This script identifies and removes sessions that are stuck in incomplete multi-step flows.
 * It's useful for cleaning up after bot crashes or when users abandon onboarding flows.
 * 
 * Usage:
 *   node scripts/cleanup-unfinished-sessions.js
 *   node scripts/cleanup-unfinished-sessions.js --dry-run   # show what would be deleted
 *   node scripts/cleanup-unfinished-sessions.js --pattern 'session:*' --limit 100
 *   node scripts/cleanup-unfinished-sessions.js --force   # skip confirmation
 */

require('dotenv').config();

const { cache, getRedis, closeRedis } = require('../src/config/redis');
const readline = require('readline');

function parseArgs(argv) {
  const options = {
    pattern: 'session:*',
    limit: 1000,
    scanLimit: 5000,
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
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

    if (arg === '--limit' && argv[i + 1]) {
      options.limit = parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.slice('--limit='.length), 10);
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

  if (!Number.isFinite(options.limit) || options.limit < 0) options.limit = 1000;
  if (!Number.isFinite(options.scanLimit) || options.scanLimit < 0) options.scanLimit = 5000;
  if (!options.pattern) options.pattern = 'session:*';

  return options;
}

function isTruthyNonEmpty(value) {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value);
}

function summarizeSession(session) {
  const temp = session && typeof session === 'object' ? session.temp : null;
  const activeTempKeys = temp && typeof temp === 'object'
    ? Object.entries(temp)
      .filter(([, value]) => isTruthyNonEmpty(value))
      .map(([key]) => key)
    : [];

  const onboardingStep = session?.onboardingStep || null;
  const onboardingComplete = session?.onboardingComplete;
  const legacyStep = session?.step || null;

  const reasons = [];
  if (onboardingStep && onboardingComplete === false) reasons.push(`onboardingStep=${onboardingStep}`);
  if (legacyStep) reasons.push(`step=${legacyStep}`);
  if (activeTempKeys.length > 0) reasons.push(`temp=${activeTempKeys.join(',')}`);

  return {
    userId: session?.userId ?? null,
    language: session?.language ?? null,
    onboardingStep,
    onboardingComplete,
    legacyStep,
    activeTempKeys,
    reasons,
  };
}

async function confirmDeletion(count) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`About to delete ${count} unfinished sessions. Continue? (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const redis = getRedis();

  console.log(`Scanning for unfinished sessions...`);
  console.log(`Pattern: ${options.pattern}`);
  console.log(`Scan limit: ${options.scanLimit}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`Force: ${options.force}`);
  console.log('');

  const keys = await cache.scanKeys(options.pattern, options.scanLimit);
  const unfinishedSessions = [];
  let scanned = 0;

  for (const key of keys) {
    scanned += 1;
    if (scanned > options.limit) break;

    const session = await cache.get(key);
    if (!session) continue;

    const summary = summarizeSession(session);
    const unfinished = summary.reasons.length > 0;

    if (unfinished) {
      unfinishedSessions.push({
        key,
        userId: summary.userId ?? key.replace(/^session:/, ''),
        ttlSeconds: await redis.ttl(key),
        language: summary.language,
        reasons: summary.reasons,
        tempKeys: summary.activeTempKeys,
      });
    }
  }

  console.log(`Found ${unfinishedSessions.length} unfinished sessions out of ${scanned} scanned:`);
  console.log('');

  unfinishedSessions.forEach((session, index) => {
    console.log(`${index + 1}. User ${session.userId} (${session.language})`);
    console.log(`   Key: ${session.key}`);
    console.log(`   TTL: ${session.ttlSeconds} seconds`);
    console.log(`   Reasons: ${session.reasons.join('; ')}`);
    console.log(`   Temp keys: ${session.tempKeys.join(', ')}`);
    console.log('');
  });

  if (unfinishedSessions.length === 0) {
    console.log('No unfinished sessions found.');
    await closeRedis();
    return;
  }

  if (!options.force && !options.dryRun) {
    const confirmed = await confirmDeletion(unfinishedSessions.length);
    if (!confirmed) {
      console.log('Operation cancelled.');
      await closeRedis();
      return;
    }
  }

  if (options.dryRun) {
    console.log(`DRY RUN: Would delete ${unfinishedSessions.length} sessions.`);
    await closeRedis();
    return;
  }

  console.log(`Deleting ${unfinishedSessions.length} unfinished sessions...`);
  let deletedCount = 0;

  for (const session of unfinishedSessions) {
    try {
      await redis.del(session.key);
      deletedCount += 1;
      console.log(`✓ Deleted ${session.key}`);
    } catch (error) {
      console.error(`✗ Failed to delete ${session.key}: ${error.message}`);
    }
  }

  console.log(`\nDeleted ${deletedCount}/${unfinishedSessions.length} unfinished sessions.`);
  await closeRedis();
}

main().catch(async (err) => {
  try {
    await closeRedis();
  } catch (_e) {
    // ignore
  }
  console.error('Error:', err);
  process.exitCode = 1;
});