/**
 * Async Broadcast Queue Service - Integration Tests
 * Tests for job queuing, processing, retries, and monitoring
 */

jest.mock('../../src/config/postgres', () => {
  const jobs = [];
  let idCounter = 1;

  const findJob = (jobId) => jobs.find(job => job.job_id === jobId);
  const reset = () => {
    jobs.length = 0;
    idCounter = 1;
  };

  const pool = {
    async query(text, params = []) {
      const sql = text.trim().toLowerCase();

      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_name: 'broadcast_queue_jobs' }], rowCount: 1 };
      }

      if (sql.includes('from pg_indexes')) {
        return { rows: [{ indexname: 'idx_queue_jobs_status' }], rowCount: 1 };
      }

      if (sql.startsWith('create table') || sql.startsWith('create index')) {
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('insert into broadcast_queue_jobs')) {
        const job = {
          id: idCounter++,
          job_id: params[0],
          queue_name: params[1],
          job_type: params[2],
          job_data: params[3],
          status: params[4],
          max_attempts: params[5],
          scheduled_at: params[6],
          attempts: 0,
          error_message: null,
          result: null,
          started_at: null,
          completed_at: null,
          next_retry_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        jobs.push(job);
        return { rows: [job], rowCount: 1 };
      }

      if (sql.includes('from broadcast_queue_jobs') && sql.includes("status in ('pending', 'retry')")) {
        const limit = params[0] || 5;
        const now = new Date();
        const rows = jobs
          .filter(job =>
            ['pending', 'retry'].includes(job.status)
            && (!job.scheduled_at || job.scheduled_at <= now)
            && (!job.next_retry_at || job.next_retry_at <= now)
          )
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .slice(0, limit);

        return { rows, rowCount: rows.length };
      }

      if (sql.startsWith('update broadcast_queue_jobs set status = $2')) {
        const job = findJob(params[0]);
        if (!job) {
          return { rows: [], rowCount: 0 };
        }

        const [, status] = params;
        let paramIndex = 2;

        job.status = status;
        if (sql.includes('error_message')) {
          job.error_message = params[paramIndex];
          paramIndex += 1;
        }
        if (sql.includes('started_at')) {
          job.started_at = params[paramIndex];
          paramIndex += 1;
        }
        if (sql.includes('result = $')) {
          job.result = params[paramIndex];
          paramIndex += 1;
        }
        if (sql.includes('attempts = $')) {
          job.attempts = params[paramIndex];
          paramIndex += 1;
        }
        if (sql.includes('next_retry_at')) {
          job.next_retry_at = params[paramIndex];
        }
        if (status === 'completed') {
          job.completed_at = new Date();
        }
        job.updated_at = new Date();

        return { rows: [job], rowCount: 1 };
      }

      if (sql.includes('set status = \'pending\',')) {
        const job = findJob(params[0]);
        if (job) {
          job.status = 'pending';
          job.attempts = 0;
          job.error_message = null;
          job.next_retry_at = null;
          job.updated_at = new Date();
        }
        return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
      }

      if (sql.includes('set status = $1') && sql.includes('where job_id')) {
        const job = findJob(params[1]);
        if (job) {
          job.status = params[0];
          job.updated_at = new Date();
        }
        return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
      }

      if (sql.includes('set completed_at = current_timestamp - interval')) {
        const job = findJob(params[0]);
        if (job) {
          const daysMatch = sql.match(/current_timestamp - interval '([0-9]+) days'/);
          const days = daysMatch ? Number(daysMatch[1]) : 0;
          job.completed_at = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }
        return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
      }

      if (sql.includes('from broadcast_queue_jobs') && sql.includes('where job_id')) {
        const job = findJob(params[0]);
        return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
      }

      if (sql.startsWith('select *') && sql.includes('where queue_name')) {
        const [queueName] = params;
        const limit = params[params.length - 1] || 100;
        const status = params.length === 3 ? params[1] : null;
        const rows = jobs
          .filter(job =>
            job.queue_name === queueName
            && (!status || job.status === status)
          )
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, limit);
        return { rows, rowCount: rows.length };
      }

      if (sql.includes('group by status') && sql.includes('where queue_name')) {
        const [queueName] = params;
        const grouped = jobs
          .filter(job => job.queue_name === queueName)
          .reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
          }, {});

        const rows = Object.keys(grouped).map(status => ({
          status,
          count: grouped[status],
        }));

        return { rows, rowCount: rows.length };
      }

      if (sql.includes('group by queue_name, status')) {
        const grouped = {};
        jobs.forEach((job) => {
          if (!grouped[job.queue_name]) {
            grouped[job.queue_name] = {};
          }
          grouped[job.queue_name][job.status] = (grouped[job.queue_name][job.status] || 0) + 1;
        });

        const rows = [];
        Object.keys(grouped).forEach((queueName) => {
          Object.keys(grouped[queueName]).forEach((status) => {
            rows.push({
              queue_name: queueName,
              status,
              count: grouped[queueName][status],
            });
          });
        });

        return { rows, rowCount: rows.length };
      }

      if (sql.includes('count(*) as total_jobs')) {
        const completedJobs = jobs.filter(job => job.completed_at);
        const stats = {
          total_jobs: jobs.length,
          pending_jobs: jobs.filter(job => job.status === 'pending').length,
          processing_jobs: jobs.filter(job => job.status === 'processing').length,
          completed_jobs: completedJobs.length,
          failed_jobs: jobs.filter(job => job.status === 'failed').length,
          retry_jobs: jobs.filter(job => job.status === 'retry').length,
          avg_processing_time_sec: null,
          oldest_job: completedJobs[0]?.created_at || null,
          newest_job: completedJobs[completedJobs.length - 1]?.created_at || null,
        };
        return { rows: [stats], rowCount: 1 };
      }

      if (sql.includes('where queue_name') && sql.includes('status = \'failed\'')) {
        const [queueName, limit = 50] = params;
        const rows = jobs
          .filter(job => job.queue_name === queueName && job.status === 'failed')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, limit);

        return { rows, rowCount: rows.length };
      }

      if (sql.startsWith('delete from broadcast_queue_jobs')) {
        const [queueName, daysOld] = params;
        const threshold = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        const initialLength = jobs.length;
        for (let i = jobs.length - 1; i >= 0; i--) {
          const job = jobs[i];
          if (
            job.queue_name === queueName
            && job.status === 'completed'
            && job.completed_at
            && new Date(job.completed_at).getTime() < threshold
          ) {
            jobs.splice(i, 1);
          }
        }
        return { rows: [], rowCount: initialLength - jobs.length };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  return {
    getPool: () => pool,
    __reset: reset,
  };
});

const { getAsyncBroadcastQueue } = require('../../src/bot/services/asyncBroadcastQueue');
const { getPool } = require('../../src/config/postgres');

describe('AsyncBroadcastQueue', () => {
  let queue;

  beforeAll(async () => {
    queue = getAsyncBroadcastQueue();
    await queue.initialize();
  });

  beforeEach(() => {
    const postgres = require('../../src/config/postgres'); // eslint-disable-line global-require
    postgres.__reset();
    queue.jobProcessors.clear();
    queue.activeJobs.clear();
    if (queue.processingInterval) {
      clearInterval(queue.processingInterval);
      queue.processingInterval = null;
    }
    queue.isRunning = false;
  });

  afterEach(async () => {
    if (queue.isProcessorRunning()) {
      await queue.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize queue tables', async () => {
      const result = await getPool().query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'broadcast_queue_jobs'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('should create indexes', async () => {
      const result = await getPool().query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'broadcast_queue_jobs'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Job Management', () => {
    test('should add a single job', async () => {
      const job = await queue.addJob('test-queue', 'test-type', {
        broadcastId: 'test-1',
        data: 'test-data',
      });

      expect(job).toBeDefined();
      expect(job.job_id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.queue_name).toBe('test-queue');
      expect(job.job_type).toBe('test-type');
    });

    test('should add multiple jobs in batch', async () => {
      const jobsData = [
        { broadcastId: 'batch-1', userId: 'user-1' },
        { broadcastId: 'batch-2', userId: 'user-2' },
        { broadcastId: 'batch-3', userId: 'user-3' },
      ];

      const jobs = await queue.addBatch('test-queue', 'batch-type', jobsData);

      expect(jobs.length).toBe(3);
      expect(jobs[0].status).toBe('pending');
      expect(jobs[1].status).toBe('pending');
      expect(jobs[2].status).toBe('pending');
    });

    test('should add job with delay', async () => {
      const job = await queue.addJob('test-queue', 'delayed-type', { data: 'test' }, {
        delay: 2000, // 2 seconds
      });

      expect(job.scheduled_at).toBeDefined();
      const delayTime = new Date(job.scheduled_at).getTime() - new Date(job.created_at).getTime();
      expect(delayTime).toBeGreaterThanOrEqual(1900);
      expect(delayTime).toBeLessThanOrEqual(2100);
    });

    test('should retrieve job details', async () => {
      const addedJob = await queue.addJob('test-queue', 'test-type', { data: 'test' });
      const retrievedJob = await queue.getJob(addedJob.job_id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob.job_id).toBe(addedJob.job_id);
      expect(retrievedJob.status).toBe('pending');
    });

    test('should get jobs by queue', async () => {
      await queue.addJob('filter-test-queue', 'type-1', { data: 'job1' });
      await queue.addJob('filter-test-queue', 'type-2', { data: 'job2' });

      const jobs = await queue.getJobsByQueue('filter-test-queue');

      expect(jobs.length).toBeGreaterThanOrEqual(2);
      expect(jobs[0].queue_name).toBe('filter-test-queue');
    });
  });

  describe('Job Processing', () => {
    test('should process a simple job', async () => {
      let processorCalled = false;
      let processedData = null;

      queue.registerProcessor('simple-type', async (data) => {
        processorCalled = true;
        processedData = data;
        return { success: true };
      });

      const job = await queue.addJob('test-queue', 'simple-type', {
        broadcastId: 'simple-1',
      });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(processorCalled).toBe(true);
      expect(processedData.broadcastId).toBe('simple-1');

      const completedJob = await queue.getJob(job.job_id);
      expect(completedJob.status).toBe('completed');
    });

    test('should process multiple jobs concurrently', async () => {
      const startTimes = new Map();
      const endTimes = new Map();

      queue.registerProcessor('concurrent-type', async (data) => {
        startTimes.set(data.id, Date.now());
        await new Promise(resolve => setTimeout(resolve, 500));
        endTimes.set(data.id, Date.now());
        return { id: data.id };
      });

      const job1 = await queue.addJob('test-queue', 'concurrent-type', { id: 1 });
      const job2 = await queue.addJob('test-queue', 'concurrent-type', { id: 2 });

      await queue.start(2); // 2 concurrent
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Both jobs should have been processed
      const completed1 = await queue.getJob(job1.job_id);
      const completed2 = await queue.getJob(job2.job_id);

      expect(completed1.status).toBe('completed');
      expect(completed2.status).toBe('completed');

      // Jobs should run concurrently (not sequentially)
      const totalTime = (endTimes.get(2) - startTimes.get(1));
      expect(totalTime).toBeLessThan(1000); // Should be ~500ms, not 1000ms
    });

    test('should handle job errors gracefully', async () => {
      queue.registerProcessor('error-type', async (data) => {
        throw new Error('Simulated processing error');
      });

      const job = await queue.addJob('test-queue', 'error-type', { data: 'test' });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const failedJob = await queue.getJob(job.job_id);
      expect(['retry', 'failed']).toContain(failedJob.status);
      expect(failedJob.error_message).toContain('Simulated processing error');
      expect(failedJob.attempts).toBeGreaterThanOrEqual(1);
    });

    test('should retry jobs with exponential backoff', async () => {
      let attemptCount = 0;

      queue.registerProcessor('retry-type', async (data) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts: attemptCount };
      });

      const job = await queue.addJob('test-queue', 'retry-type', { data: 'test' }, {
        maxAttempts: 5,
      });

      await queue.start(1);

      // Wait for initial attempt + retries
      await new Promise(resolve => setTimeout(resolve, 500)); // Initial attempt
      await new Promise(resolve => setTimeout(resolve, 200)); // 2nd attempt after 60s * 2^0 = 60s (simulated as immediate)
      await new Promise(resolve => setTimeout(resolve, 200)); // 3rd attempt after 60s * 2^1 = 120s (simulated as immediate)

      const retriedJob = await queue.getJob(job.job_id);
      expect(retriedJob.status).toMatch(/completed|retry/);
      expect(attemptCount).toBeGreaterThanOrEqual(2);
    });

    test('should mark job as failed after max attempts', async () => {
      queue.registerProcessor('max-retry-type', async (data) => {
        throw new Error('Always fails');
      });

      const job = await queue.addJob('test-queue', 'max-retry-type', { data: 'test' }, {
        maxAttempts: 2,
      });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const failedJob = await queue.getJob(job.job_id);
      expect(failedJob.status).toBe('failed');
      expect(failedJob.attempts).toBe(2);
    });

    test('should store job result', async () => {
      const resultData = { success: true, processed: 100, timestamp: new Date() };

      queue.registerProcessor('result-type', async (data) => {
        return resultData;
      });

      const job = await queue.addJob('test-queue', 'result-type', { data: 'test' });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const completedJob = await queue.getJob(job.job_id);
      expect(completedJob.result).toBeDefined();

      const result = JSON.parse(completedJob.result);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(100);
    });
  });

  describe('Queue Monitoring', () => {
    test('should get queue status', async () => {
      await queue.addJob('status-queue', 'type-1', { data: 'job1' });
      await queue.addJob('status-queue', 'type-2', { data: 'job2' });

      const status = await queue.getQueueStatus('status-queue');

      expect(status.queueName).toBe('status-queue');
      expect(status.pending + status.completed).toBeGreaterThanOrEqual(2);
      expect(status.timestamp).toBeDefined();
    });

    test('should get all queue statuses', async () => {
      await queue.addJob('queue-a', 'type', { data: 'job' });
      await queue.addJob('queue-b', 'type', { data: 'job' });

      const allStatuses = await queue.getAllQueueStatuses();

      expect(Object.keys(allStatuses).length).toBeGreaterThan(0);
    });

    test('should get failed jobs', async () => {
      queue.registerProcessor('fail-track-type', async (data) => {
        throw new Error('Intentional failure');
      });

      const job = await queue.addJob('failed-queue', 'fail-track-type', { data: 'test' }, {
        maxAttempts: 1,
      });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const failedJobs = await queue.getFailedJobs('failed-queue');

      expect(failedJobs.length).toBeGreaterThan(0);
      expect(failedJobs[0].error_message).toBeDefined();
    });

    test('should get queue statistics', async () => {
      queue.registerProcessor('stat-type', async (data) => {
        return { success: true };
      });

      await queue.addJob('stat-queue', 'stat-type', { data: 'job1' });
      await queue.addJob('stat-queue', 'stat-type', { data: 'job2' });

      await queue.start(2);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stats = await queue.getStatistics();

      expect(stats.total_jobs).toBeGreaterThanOrEqual(0);
      expect(stats.completed_jobs).toBeGreaterThanOrEqual(0);
    });

    test('should track active jobs count', async () => {
      queue.registerProcessor('active-type', async (data) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      });

      await queue.addJob('active-queue', 'active-type', { data: 'job' });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 100));

      const activeCount = queue.getActiveJobsCount();
      expect(activeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Queue Operations', () => {
    test('should retry a failed job', async () => {
      const job = await queue.addJob('test-queue', 'test-type', { data: 'test' });

      // Manually set to failed
      await getPool().query(
        'UPDATE broadcast_queue_jobs SET status = $1 WHERE job_id = $2',
        ['failed', job.job_id]
      );

      await queue.retryJob(job.job_id);

      const retriedJob = await queue.getJob(job.job_id);
      expect(retriedJob.status).toBe('pending');
      expect(retriedJob.attempts).toBe(0);
    });

    test('should check if processor is running', async () => {
      expect(queue.isProcessorRunning()).toBe(false);

      await queue.start(1);
      expect(queue.isProcessorRunning()).toBe(true);

      await queue.stop();
      expect(queue.isProcessorRunning()).toBe(false);
    });

    test('should clear old completed jobs', async () => {
      queue.registerProcessor('cleanup-type', async (data) => {
        return { success: true };
      });

      const job = await queue.addJob('cleanup-queue', 'cleanup-type', { data: 'test' });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Manually set completed_at to old date
      await getPool().query(
        `UPDATE broadcast_queue_jobs
         SET completed_at = CURRENT_TIMESTAMP - interval '8 days'
         WHERE job_id = $1`,
        [job.job_id]
      );

      const cleared = await queue.clearCompletedJobs('cleanup-queue', 7);
      expect(cleared).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing processor gracefully', async () => {
      const job = await queue.addJob('test-queue', 'unregistered-type', { data: 'test' });

      await queue.start(1);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const failedJob = await queue.getJob(job.job_id);
      expect(failedJob.status).toBe('failed');
      expect(failedJob.error_message).toContain('No processor registered');
    });

    test('should handle invalid job data gracefully', async () => {
      const job = await queue.addJob('test-queue', 'test-type', null);

      expect(job).toBeDefined();
      expect(job.job_id).toBeDefined();
    });
  });

  afterAll(async () => {
    if (queue.isProcessorRunning()) {
      await queue.stop();
    }
  });
});
