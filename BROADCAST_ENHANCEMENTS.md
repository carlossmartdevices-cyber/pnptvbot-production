# Broadcast System Enhancements

This document describes the advanced features added to the PNPtv broadcast system, including user preferences, segmentation, analytics, A/B testing, and retry mechanisms.

## Overview

The broadcast enhancement system extends the core `BroadcastService` with sophisticated targeting, engagement tracking, and quality assurance features. All enhancements are integrated through the `EnhancedBroadcastService` which wraps the original service and adds new capabilities without breaking backward compatibility.

## Architecture

### Core Components

1. **BroadcastEnhancements** (`src/bot/services/broadcastEnhancements.js`)
   - User preference management
   - Audience segmentation
   - Engagement tracking
   - A/B testing framework
   - Pause/resume functionality
   - Retry queue management

2. **EnhancedBroadcastService** (`src/bot/services/enhancedBroadcastService.js`)
   - Integration layer between BroadcastService and BroadcastEnhancements
   - Unified broadcast sending with all features enabled
   - Segment-based broadcasting
   - Retry queue processing

3. **Database Schema** (`database/migrations/broadcast_enhancements_schema.sql`)
   - 7 new tables for enhancement features
   - 4 analytics views
   - Optimized indexes for performance
   - Automatic timestamp triggers

## Features

### 1. User Broadcast Preferences

Users can opt out of broadcasts or set frequency limits to prevent message fatigue.

**Table:** `user_broadcast_preferences`

**Key Features:**
- Opt-out management with timestamp tracking
- Weekly/monthly frequency limits
- Preferred send times (hour and day of week)
- Category-based preferences (JSON)
- Status tracking (active, inactive, blocked, opted_out)

**Methods:**
```javascript
// Check if user opted out
const isOptedOut = await enhancements.isUserOptedOut(userId);

// Set user preference
await enhancements.setUserBroadcastPreference(userId, true, 'Too frequent');

// Get frequency preference
const freq = await enhancements.getUserBroadcastFrequency(userId);
// Returns: { max_per_week: 7, received_this_week: 2 }

// Check if user exceeds frequency limit
const exceeds = await enhancements.exceedsFrequencyLimit(userId);
```

### 2. Advanced User Segmentation

Create and manage user segments based on multiple criteria for targeted broadcasting.

**Table:** `user_segments` + `segment_membership`

**Supported Filters:**
- Activity level (active, inactive, dormant)
- Subscription tier (free, premium, churned)
- Geographic location
- Registration date range
- Language preference
- Last active within N days

**Methods:**
```javascript
// Create segment
const segment = await enhancements.createUserSegment({
  name: 'Active Premium Users',
  created_by: 'admin_id',
  filters: {
    subscription_tier: 'premium',
    activity_level: 'active',
    registration_date_from: '2024-01-01',
    last_active_days: 7
  }
});

// Get users in segment
const users = await enhancements.getUsersInSegment(segmentId);

// Get segment performance
const stats = await db.query('SELECT * FROM segment_performance WHERE segment_id = $1', [segmentId]);
```

### 3. Broadcast Engagement Tracking

Track detailed user interactions with broadcast messages to measure effectiveness.

**Table:** `broadcast_engagement`

**Tracked Events:**
- Message sent timestamp
- Message opened (first view)
- Link clicked
- User replied to broadcast
- Custom interaction types

**Metrics Captured:**
- Delivery status
- Open rate
- Click rate
- Reply rate
- Reply sentiment (if analyzed)

**Methods:**
```javascript
// Record engagement event
await enhancements.recordEngagementEvent(broadcastId, userId, 'opened', {
  messageId: 123456,
  timestamp: new Date()
});

// Get broadcast analytics
const analytics = await enhancements.getBroadcastAnalytics(broadcastId);
// Returns: {
//   total_recipients: 1000,
//   delivered: 998,
//   opened: 450,
//   clicked: 120,
//   replied: 45,
//   open_rate: 45.09,
//   click_rate: 12.02,
//   reply_rate: 4.50
// }

// Get top performing broadcasts
const topBroadcasts = await enhancements.getTopPerformingBroadcasts(10);
```

### 4. A/B Testing Framework

Run controlled experiments to optimize broadcast performance.

**Tables:** `broadcast_ab_tests` + `ab_test_assignments`

**Supported Test Types:**
- Subject/title variations
- Content variations
- Media variations
- Send time variations
- Call-to-action variations

**Features:**
- Automatic user assignment to variants
- Real-time engagement tracking per variant
- Statistical significance testing (95% confidence by default)
- Winner detection with p-value calculation

**Methods:**
```javascript
// Create A/B test
const abTest = await enhancements.createABTest(broadcastId, {
  test_name: 'Subject Line Optimization',
  test_type: 'subject',
  variant_a: {
    name: 'Short Subject',
    message_en: 'Join us!',
    message_es: '¡Únete a nosotros!',
    sample_size: 500
  },
  variant_b: {
    name: 'Long Subject',
    message_en: 'You are invited to join our exclusive community!',
    message_es: '¡Te invitamos a unirse a nuestra comunidad exclusiva!',
    sample_size: 500
  }
});

// Get test results
const results = await enhancements.getABTestResults(abTestId);
// Returns:
// {
//   test_name: 'Subject Line Optimization',
//   variant_a: { open_rate: 35.2, click_rate: 8.5, ... },
//   variant_b: { open_rate: 42.1, click_rate: 11.2, ... },
//   is_statistically_significant: true,
//   winner_variant: 'B',
//   p_value: 0.00234
// }
```

### 5. Pause/Resume Functionality

Pause an in-progress broadcast and resume from where it left off.

**Methods:**
```javascript
// Pause broadcast
await enhancements.pauseBroadcast(broadcastId);

// Resume paused broadcast
await enhancements.resumeBroadcast(broadcastId);
```

**Use Cases:**
- Stop broadcast if issues are discovered mid-send
- Resume during off-peak hours for better user experience
- Avoid rate limiting by pacing delivery

### 6. Automatic Retry with Exponential Backoff

Failed deliveries are automatically queued for retry with exponential backoff.

**Table:** `broadcast_retry_queue`

**Features:**
- Exponential backoff algorithm (configurable multiplier)
- Error tracking with history
- Max attempt limits (configurable)
- Automatic status management
- Per-attempt delay calculation

**Configuration:**
```javascript
{
  maxRetries: 5,           // Maximum retry attempts
  initialDelay: 60,        // Initial delay in seconds
  backoffMultiplier: 2.0   // Multiply delay by this each attempt
}
```

**Example Retry Schedule:**
- Attempt 1: Fail immediately
- Attempt 2: Retry after 60 seconds
- Attempt 3: Retry after 120 seconds (60 × 2)
- Attempt 4: Retry after 240 seconds (60 × 2²)
- Attempt 5: Retry after 480 seconds (60 × 2³)
- Attempt 6: Retry after 960 seconds (60 × 2⁴)

**Methods:**
```javascript
// Queue for retry (called automatically on failure)
await enhancements.queueForRetry(broadcastId, userId, error, {
  maxRetries: 5,
  initialDelay: 60,
  backoffMultiplier: 2.0
});

// Get retries due for processing
const retries = await enhancements.getRetriesDue();

// Mark retry successful
await enhancements.markRetrySuccessful(retryId);

// Mark retry failed and schedule next attempt
await enhancements.markRetryFailed(retryId, errorMessage, nextAttempt, nextDelay);
```

## Usage

### Basic Enhanced Broadcast

```javascript
const { getEnhancedBroadcastService } = require('./services/enhancedBroadcastService');

const broadcastService = getEnhancedBroadcastService();

// Send broadcast with all enhancements
const result = await broadcastService.sendBroadcastWithEnhancements(bot, broadcastId);

// Returns:
// {
//   total: 1000,
//   sent: 995,
//   failed: 5,
//   opted_out: 2,
//   frequency_limited: 3,
//   analytics: { ... }
// }
```

### Segment-Based Broadcast

```javascript
// Send to specific segment
const segmentResult = await broadcastService.sendBroadcastToSegment(
  bot,
  broadcastId,
  segmentId
);

// Returns:
// {
//   total: 250,
//   sent: 248,
//   failed: 2,
//   segment_id: 'segment-uuid'
// }
```

### Manage Retry Queue

```javascript
// Process all pending retries
const retryStats = await broadcastService.processRetryQueue(bot);

// Returns:
// {
//   processed: 45,
//   succeeded: 42,
//   failed: 3
// }
```

### A/B Testing

```javascript
// Setup A/B test
const abTest = await broadcastService.setupABTest(broadcastId, {
  test_name: 'CTA Button Color',
  test_type: 'call_to_action',
  variant_a: { name: 'Blue Button', ... },
  variant_b: { name: 'Green Button', ... }
});

// Wait for test duration...

// Get results
const testResults = await broadcastService.getABTestResults(abTest.ab_test_id);
if (testResults.is_statistically_significant) {
  console.log(`Winner: Variant ${testResults.winner_variant}`);
}
```

## Database Setup

Apply the migration to create all enhancement tables:

```bash
psql -U postgres -d pnptv_db -f database/migrations/broadcast_enhancements_schema.sql
```

**Tables Created:**
1. `user_broadcast_preferences` - User opt-out and frequency settings
2. `user_segments` - Audience segment definitions
3. `segment_membership` - Many-to-many user-segment relationship
4. `broadcast_engagement` - Message interaction tracking
5. `broadcast_ab_tests` - A/B test configurations
6. `ab_test_assignments` - User variant assignments
7. `broadcast_retry_queue` - Failed message retry queue

**Views Created:**
1. `broadcast_engagement_summary` - Engagement analytics
2. `segment_performance` - Segment performance metrics
3. `ab_test_results_summary` - A/B test results
4. `retry_queue_status` - Retry queue status monitoring

## Analytics Queries

### Get Broadcast Performance

```sql
SELECT * FROM broadcast_engagement_summary
WHERE broadcast_id = 'uuid-here'
ORDER BY last_updated_at DESC;
```

### Segment Performance

```sql
SELECT * FROM segment_performance
WHERE is_active = true
ORDER BY avg_open_rate DESC;
```

### A/B Test Results

```sql
SELECT * FROM ab_test_results_summary
WHERE status = 'completed'
ORDER BY created_at DESC;
```

### Retry Queue Status

```sql
SELECT * FROM retry_queue_status;
```

## Error Handling

### Retriable Errors
The system automatically retries on:
- Telegram API timeouts
- Rate limiting (429 Too Many Requests)
- Temporary network failures
- Bot connection issues

### Non-Retriable Errors
No retry for:
- User deactivated/deleted
- Chat not found
- Invalid chat ID
- Bot blocked by user

## Performance Considerations

### Indexing
All tables include optimized indexes on:
- Primary lookup columns
- Foreign keys
- Frequently queried filters
- Sort columns

### Query Optimization
- Segment membership uses UNIQUE constraints to prevent duplicates
- Engagement tracking uses UUID for distributed ID generation
- Retry queue is processed in batches of 100
- Analytics views use materialized aggregations

### Scaling
For large user bases:
- Process retries asynchronously in background jobs
- Archive old engagement data monthly
- Use Segment ID for targeted sends instead of recalculating filters
- Implement engagement event batching

## Configuration

### Frequency Limits

Default user preferences can be set when creating users:

```javascript
{
  max_broadcasts_per_week: 7,
  max_broadcasts_per_month: 30,
  preferred_send_hour: 18,        // 6 PM
  preferred_send_day: 'saturday'
}
```

### Retry Configuration

Customize retry behavior per broadcast type:

```javascript
const customRetryConfig = {
  maxRetries: 3,
  initialDelay: 30,        // 30 seconds
  backoffMultiplier: 2.5   // Larger multiplier = longer gaps
};

await enhancements.queueForRetry(broadcastId, userId, error, customRetryConfig);
```

### A/B Test Confidence

Adjust statistical significance threshold:

```javascript
// Default 95% confidence
const results = await enhancements.getABTestResults(abTestId);

// For higher confidence: results.p_value < 0.01
// For lower confidence: results.p_value < 0.1
```

## Monitoring

### Key Metrics to Track

1. **Delivery Quality**
   - Opt-out rate
   - Frequency-limited rate
   - Successful delivery rate

2. **Engagement**
   - Open rate (%) = (opened / sent) × 100
   - Click rate (%) = (clicked / sent) × 100
   - Reply rate (%) = (replied / sent) × 100

3. **Retry Effectiveness**
   - Retry success rate
   - Average attempts before success
   - Permanent failure rate

4. **A/B Test Impact**
   - Confidence intervals
   - Lift percentage
   - Sample size adequacy

### Alert Thresholds

Consider alerts for:
- Open rate < 20%
- Click rate < 5%
- Retry success rate < 70%
- A/B test p-value anomalies

## Migration Guide

### From Basic to Enhanced

Existing broadcasts continue to work. To use enhancements:

1. **Update broadcast creation code:**
   ```javascript
   // Old
   const result = await broadcastService.sendBroadcast(bot, broadcastId);

   // New
   const result = await enhancedBroadcastService.sendBroadcastWithEnhancements(bot, broadcastId);
   ```

2. **Initialize user preferences:**
   ```javascript
   // For new users
   await enhancements.setUserBroadcastPreference(userId, false, null);
   ```

3. **Enable retry processing:**
   ```javascript
   // Add to cron/scheduler
   setInterval(async () => {
     await enhancedBroadcastService.processRetryQueue(bot);
   }, 5 * 60 * 1000); // Every 5 minutes
   ```

## API Integration

The enhancements can be exposed through REST APIs:

### Create Segment
```
POST /api/admin/segments
Body: {
  name: "Segment Name",
  filters: { ... }
}
```

### Send to Segment
```
POST /api/admin/broadcasts/:id/send-segment
Body: { segment_id: "uuid" }
```

### Get Analytics
```
GET /api/admin/broadcasts/:id/analytics
Returns: { open_rate, click_rate, reply_rate, ... }
```

### Run A/B Test
```
POST /api/admin/broadcasts/:id/ab-test
Body: { test_name, test_type, variant_a, variant_b }
```

## Troubleshooting

### High Failure Rate
- Check network connectivity
- Verify bot token is valid
- Review error logs in retry_queue table
- Check user deactivation rates

### Low Engagement
- Review segment filters (targeting right users?)
- Check message content and relevance
- Compare with A/B test results
- Monitor preferred send times

### Retry Queue Growing
- Increase retry processing frequency
- Check for permanent failures (should stop retrying)
- Verify user IDs are still valid
- Monitor system resources (may be rate limiting)

## Future Enhancements

Potential additions:
- Machine learning-based send time optimization
- Automatic content variation suggestions
- Predictive engagement scoring
- Multi-channel broadcasts (email, SMS)
- Advanced fraud detection for engagement events
- Detailed user journey tracking
- Integration with analytics dashboards

---

**Version:** 1.0
**Last Updated:** 2025-12-29
**Maintained by:** PNPtv Development Team
