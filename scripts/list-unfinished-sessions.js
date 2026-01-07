/**
 * List unfinished Telegraf sessions stored in Redis.
 *
 * "Unfinished" here means the session indicates an in-progress multi-step flow:
 * - any truthy/non-empty `session.temp.*` keys (e.g. `waitingForEmail`)
 * - `session.onboardingStep` present while `session.onboardingComplete` is false
 * - `session.step` present (legacy onboarding handler)
 *
 * Usage:
 *   node scripts/list-unfinished-sessions.js
 *   node scripts/list-unfinished-sessions.js --limit 100 --scan-limit 5000
 *   node scripts/list-unfinished-sessions.js --pattern 'session:*' --json
 *   node scripts/list-unfinished-sessions.js --all   # include "clean" sessions too
 */

require('dotenv').config();

const { cache, getRedis, closeRedis } = require('../src/config/redis');

function parseArgs(argv) {
  const options = {
    pattern: 'session:*',
    limit: 200,
    scanLimit: 5000,
    all: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--all') {
      options.all = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
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

  if (!Number.isFinite(options.limit) || options.limit < 0) options.limit = 200;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const redis = getRedis();

  const keys = await cache.scanKeys(options.pattern, options.scanLimit);
  let printed = 0;
  let scanned = 0;

  if (!options.json) {
    console.log(['key', 'userId', 'ttlSeconds', 'language', 'reasons', 'tempKeys'].join('\t'));
  }

  for (const key of keys) {
    scanned += 1;

    const session = await cache.get(key);
    if (!session) continue;

    const ttlSeconds = await redis.ttl(key);
    const summary = summarizeSession(session);
    const unfinished = summary.reasons.length > 0;

    if (!options.all && !unfinished) continue;

    const record = {
      key,
      userId: summary.userId ?? key.replace(/^session:/, ''),
      ttlSeconds,
      language: summary.language,
      reasons: summary.reasons,
      tempKeys: summary.activeTempKeys,
    };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    } else {
      const row = [
        record.key,
        String(record.userId ?? ''),
        String(record.ttlSeconds ?? ''),
        String(record.language ?? ''),
        record.reasons.join(';'),
        record.tempKeys.join(','),
      ];
      console.log(row.join('\t'));
    }

    printed += 1;
    if (options.limit > 0 && printed >= options.limit) break;
  }

  await closeRedis();
  console.error(`Scanned ${scanned} keys (pattern=${options.pattern}, scanLimit=${options.scanLimit}); printed ${printed} rows.`);
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

