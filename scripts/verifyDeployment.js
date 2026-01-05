#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Verifies all async queue components are deployed and working correctly
 * Usage: node scripts/verifyDeployment.js
 */

const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/postgres');
const logger = require('../src/utils/logger');

const REQUIRED_FILES = [
  'src/bot/services/asyncBroadcastQueue.js',
  'src/bot/services/broadcastQueueIntegration.js',
  'src/bot/services/initializeQueue.js',
  'src/bot/api/broadcastQueueRoutes.js',
  'tests/integration/asyncBroadcastQueue.test.js',
  'scripts/setupAsyncQueue.js',
  'ASYNC_QUEUE_IMPLEMENTATION.md',
  'DEPLOYMENT_GUIDE.md',
];

const REQUIRED_MODULES = [
  { path: 'src/bot/services/asyncBroadcastQueue.js', exports: ['AsyncBroadcastQueue', 'getAsyncBroadcastQueue'] },
  { path: 'src/bot/services/broadcastQueueIntegration.js', exports: ['BroadcastQueueIntegration', 'getBroadcastQueueIntegration'] },
  { path: 'src/bot/services/initializeQueue.js', exports: ['initializeAsyncBroadcastQueue'] },
];

let checks = {
  passed: 0,
  failed: 0,
};

function logCheckStart(name) {
  console.log(`\n📋 Checking: ${name}`);
}

function logPass(message) {
  console.log(`  ✅ ${message}`);
  checks.passed++;
}

function logFail(message) {
  console.log(`  ❌ ${message}`);
  checks.failed++;
}

function logInfo(message) {
  console.log(`  ℹ️  ${message}`);
}

async function verifyFiles() {
  logCheckStart('Files Exist');

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      logPass(`${file} (${stat.size} bytes)`);
    } else {
      logFail(`${file} - NOT FOUND`);
    }
  }
}

async function verifyModules() {
  logCheckStart('Module Exports');

  for (const module of REQUIRED_MODULES) {
    try {
      const modulePath = path.join(__dirname, '..', module.path);
      const mod = require(modulePath);

      let allExported = true;
      for (const exportName of module.exports) {
        if (mod[exportName]) {
          logPass(`${module.path} - ${exportName} exported`);
        } else {
          logFail(`${module.path} - ${exportName} NOT exported`);
          allExported = false;
        }
      }
    } catch (error) {
      logFail(`${module.path} - Failed to load: ${error.message}`);
    }
  }
}

async function verifyDatabase() {
  logCheckStart('Database Configuration');

  try {
    const result = await getPool().query('SELECT 1');
    logPass('Database connection successful');
  } catch (error) {
    logFail(`Database connection failed: ${error.message}`);
    return;
  }

  // Check if queue tables exist
  logCheckStart('Database Tables');

  try {
    const result = await getPool().query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'broadcast_queue_jobs'
    `);

    if (result.rows.length > 0) {
      logPass('broadcast_queue_jobs table exists');
    } else {
      logFail('broadcast_queue_jobs table NOT found - Run: node scripts/setupAsyncQueue.js');
    }
  } catch (error) {
    logFail(`Failed to check tables: ${error.message}`);
  }

  // Check indexes
  logCheckStart('Database Indexes');

  try {
    const result = await getPool().query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'broadcast_queue_jobs'
    `);

    if (result.rows.length > 0) {
      logPass(`${result.rows.length} indexes found`);
      result.rows.forEach(row => {
        logInfo(`  - ${row.indexname}`);
      });
    } else {
      logFail('No indexes found');
    }
  } catch (error) {
    logFail(`Failed to check indexes: ${error.message}`);
  }
}

async function verifyQueueOperations() {
  logCheckStart('Queue Operations');

  try {
    const { getAsyncBroadcastQueue } = require('../src/bot/services/asyncBroadcastQueue');
    const queue = getAsyncBroadcastQueue();

    // Initialize queue
    await queue.initialize();
    logPass('Queue initialization successful');

    // Test job addition
    const testJob = await queue.addJob('verify-queue', 'test', {
      test: true,
      timestamp: new Date(),
    });

    logPass(`Test job created: ${testJob.job_id}`);

    // Test job retrieval
    const retrievedJob = await queue.getJob(testJob.job_id);
    if (retrievedJob.status === 'pending') {
      logPass('Test job retrieved with correct status');
    } else {
      logFail(`Test job has unexpected status: ${retrievedJob.status}`);
    }

    // Test queue status
    const status = await queue.getQueueStatus('verify-queue');
    logPass(`Queue status retrieved: ${JSON.stringify(status.pending || 0)} pending`);

    // Cleanup
    await getPool().query('DELETE FROM broadcast_queue_jobs WHERE job_id = $1', [testJob.job_id]);
    logPass('Test job cleaned up');
  } catch (error) {
    logFail(`Queue operation failed: ${error.message}`);
  }
}

async function verifyConfiguration() {
  logCheckStart('Configuration');

  try {
    // Check environment
    if (process.env.NODE_ENV) {
      logPass(`NODE_ENV: ${process.env.NODE_ENV}`);
    } else {
      logInfo('NODE_ENV not set');
    }

    // Check database URL
    if (process.env.DATABASE_URL || process.env.DB_HOST) {
      logPass('Database configuration detected');
    } else {
      logFail('Database configuration NOT found');
    }

    // Check log level
    if (process.env.LOG_LEVEL) {
      logPass(`LOG_LEVEL: ${process.env.LOG_LEVEL}`);
    } else {
      logInfo('LOG_LEVEL not set (using default)');
    }
  } catch (error) {
    logFail(`Configuration check failed: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('DEPLOYMENT VERIFICATION REPORT');
  console.log('='.repeat(70));
  console.log(`\nDate: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}`);

  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(70));
  console.log(`\n✅ Passed: ${checks.passed}`);
  console.log(`❌ Failed: ${checks.failed}`);
  console.log(`Total: ${checks.passed + checks.failed}`);

  if (checks.failed === 0) {
    console.log('\n' + '🎉 '.repeat(15));
    console.log('ALL CHECKS PASSED - READY FOR PRODUCTION');
    console.log('🎉 '.repeat(15));
  } else {
    console.log(`\n⚠️  ${checks.failed} check(s) failed`);
    console.log('Please resolve the issues above before deploying to production.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('NEXT STEPS');
  console.log('='.repeat(70));
  console.log(`
1. Review the checks above
2. If database tables not found, run: node scripts/setupAsyncQueue.js
3. Initialize queue in your bot code:
   const queueIntegration = await initializeAsyncBroadcastQueue(bot);
4. Add API routes:
   app.use('/api/admin/queue', broadcastQueueRoutes);
5. Update broadcast sending code to use async queue
6. Deploy to production
7. Monitor queue status: curl http://localhost:3000/api/admin/queue/health
  `);

  console.log('='.repeat(70));
  console.log('For more information, see DEPLOYMENT_GUIDE.md');
  console.log('='.repeat(70) + '\n');

  process.exit(checks.failed === 0 ? 0 : 1);
}

async function runVerification() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('ASYNC BROADCAST QUEUE - DEPLOYMENT VERIFICATION');
    console.log('='.repeat(70));

    await verifyFiles();
    await verifyModules();
    await verifyConfiguration();
    await verifyDatabase();
    await verifyQueueOperations();

    await generateReport();
  } catch (error) {
    console.error('Verification script error:', error);
    process.exit(1);
  }
}

// Run verification
runVerification().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
