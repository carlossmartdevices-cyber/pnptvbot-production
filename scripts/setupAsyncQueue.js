/**
 * Setup Async Broadcast Queue
 * Initializes and configures the async queue system
 * Usage: node scripts/setupAsyncQueue.js
 */

require('dotenv').config();
const { getAsyncBroadcastQueue } = require('../src/bot/services/asyncBroadcastQueue');
const { getBroadcastQueueIntegration } = require('../src/bot/services/broadcastQueueIntegration');
const logger = require('../src/utils/logger');

async function setupAsyncQueue() {
  try {
    logger.info('Starting Async Queue Setup...');

    // Step 1: Initialize queue
    logger.info('Step 1: Initializing database tables...');
    const queue = getAsyncBroadcastQueue();
    await queue.initialize();
    logger.info('✓ Database tables initialized');

    // Step 2: Verify tables
    logger.info('Step 2: Verifying database schema...');
    const { getPool } = require('../src/config/postgres');
    const result = await getPool().query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'broadcast_queue_jobs'
    `);

    if (result.rows.length === 0) {
      throw new Error('Failed to create broadcast_queue_jobs table');
    }
    logger.info('✓ Database schema verified');

    // Step 3: Check indexes
    logger.info('Step 3: Checking indexes...');
    const indexResult = await getPool().query(`
      SELECT COUNT(*) as count FROM pg_indexes
      WHERE tablename = 'broadcast_queue_jobs'
    `);
    logger.info(`✓ Found ${indexResult.rows[0].count} indexes on broadcast_queue_jobs`);

    // Step 4: Get initial statistics
    logger.info('Step 4: Getting queue statistics...');
    const stats = await queue.getStatistics();
    logger.info('✓ Queue Statistics:', JSON.stringify(stats, null, 2));

    // Step 5: Test job addition
    logger.info('Step 5: Testing job addition...');
    const testJob = await queue.addJob('test-queue', 'test-type', {
      testData: 'setup-verification',
      timestamp: new Date(),
    });
    logger.info(`✓ Test job created: ${testJob.job_id}`);

    // Step 6: Verify job retrieval
    logger.info('Step 6: Verifying job retrieval...');
    const retrievedJob = await queue.getJob(testJob.job_id);
    if (retrievedJob.status === 'pending') {
      logger.info('✓ Test job verified as pending');
    } else {
      throw new Error(`Test job has unexpected status: ${retrievedJob.status}`);
    }

    // Step 7: Clean up test job
    logger.info('Step 7: Cleaning up test job...');
    await getPool().query('DELETE FROM broadcast_queue_jobs WHERE job_id = $1', [testJob.job_id]);
    logger.info('✓ Test job cleaned up');

    // Step 8: Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('Async Queue Setup Complete!');
    logger.info('='.repeat(60));
    logger.info('\nConfiguration Summary:');
    logger.info('- Database: PostgreSQL');
    logger.info('- Table: broadcast_queue_jobs');
    logger.info('- Status: Ready for production');
    logger.info('\nNext Steps:');
    logger.info('1. Initialize queue in your bot code:');
    logger.info('   const queueIntegration = getBroadcastQueueIntegration();');
    logger.info('   await queueIntegration.initialize(bot);');
    logger.info('');
    logger.info('2. Start queue processor:');
    logger.info('   await queueIntegration.start(2); // 2 concurrent jobs');
    logger.info('');
    logger.info('3. Queue a broadcast:');
    logger.info('   const job = await queueIntegration.queueBroadcast(broadcastId);');
    logger.info('');
    logger.info('4. Monitor queue:');
    logger.info('   const status = await queueIntegration.getStatus();');
    logger.info('');
    logger.info('5. Add API routes:');
    logger.info('   const queueRoutes = require(\'./api/broadcastQueueRoutes\');');
    logger.info('   app.use(\'/api/admin/queue\', queueRoutes);');
    logger.info('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupAsyncQueue().catch((error) => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});
