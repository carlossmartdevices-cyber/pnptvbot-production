# Deployment Guide - Async Broadcast Queue System

## Overview
This guide walks through deploying the async broadcast queue system to production.

## Prerequisites
- PostgreSQL database running
- Node.js 18+
- Bot instance initialized
- All async queue files in place

## Deployment Steps

### Step 1: Database Setup

Initialize the database tables for the queue:

```bash
node scripts/setupAsyncQueue.js
```

### Step 2: Update Bot Initialization

Add to your bot startup:

```javascript
const { initializeAsyncBroadcastQueue } = require('./services/initializeQueue');

const queueIntegration = await initializeAsyncBroadcastQueue(bot, {
  concurrency: 2,
  maxAttempts: 3,
  autoStart: true,
});
```

### Step 3: Add API Routes

```javascript
const broadcastQueueRoutes = require('./api/broadcastQueueRoutes');
app.use('/api/admin/queue', broadcastQueueRoutes);
```

### Step 4: Update Broadcast Calls

Instead of:
```javascript
const result = await broadcastService.sendBroadcast(bot, broadcastId);
```

Use:
```javascript
const job = await queueIntegration.queueBroadcast(broadcastId);
res.json({ success: true, jobId: job.job_id });
```

### Step 5: Verify Deployment

```bash
# Test health endpoint
curl http://localhost:3000/api/admin/queue/health

# Check queue status
curl http://localhost:3000/api/admin/queue/status
```

## Testing

### Test 1: Queue Single Broadcast
```javascript
const job = await queueIntegration.queueBroadcast('test-id');
// Wait 3 seconds
const jobDetails = await queueIntegration.getJobDetails(job.job_id);
console.log(jobDetails.status); // Should be 'completed'
```

### Test 2: Queue Batch
```javascript
const broadcasts = [
  { broadcast_id: 'id1' },
  { broadcast_id: 'id2' },
];
const jobs = await queueIntegration.queueBroadcastBatch(broadcasts);
```

## Deployment Checklist

- [ ] Run setup script
- [ ] Verify database tables
- [ ] Add initialization to bot
- [ ] Add API routes
- [ ] Update broadcast code
- [ ] Test with sample broadcast
- [ ] Verify API endpoints
- [ ] Set up monitoring
- [ ] Deploy to production
- [ ] Monitor for 24 hours

## Production Configuration

### High Volume
```javascript
await queueIntegration.start(10);
```

### Normal
```javascript
await queueIntegration.start(2);
```

### High Reliability
```javascript
await queueIntegration.queueBroadcast(id, {
  maxAttempts: 5,
});
```

## Monitoring

### Queue Status
```bash
curl http://localhost:3000/api/admin/queue/status
```

### Failed Jobs
```bash
curl http://localhost:3000/api/admin/queue/broadcasts/failed
```

### Health Check
```bash
curl http://localhost:3000/api/admin/queue/health
```

## Troubleshooting

### Queue not processing
1. Check health: `curl http://localhost:3000/api/admin/queue/health`
2. Verify database exists
3. Check logs

### High failure rate
1. Check failed jobs: `/api/admin/queue/broadcasts/failed`
2. Review error messages
3. Check broadcast service

### Memory growing
1. Check active jobs count
2. Reduce concurrency
3. Run cleanup

## Rollback

If issues occur:

```javascript
// Stop queue
const queueIntegration = getBroadcastQueueIntegration();
await queueIntegration.stop();

// Return to synchronous
const result = await broadcastService.sendBroadcast(bot, broadcastId);
```

## Support

- See: ASYNC_QUEUE_IMPLEMENTATION.md
- See: BROADCAST_ENHANCEMENTS.md
- See: DEPLOYMENT_GUIDE.md (this file)

---
**Version**: 1.0
**Status**: Ready for Production
