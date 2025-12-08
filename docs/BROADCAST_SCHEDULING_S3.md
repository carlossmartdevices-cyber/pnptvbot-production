# Broadcast Scheduling & AWS S3 Integration

## Overview

This document describes the new broadcast scheduling and AWS S3 media storage features added to the PNPtv Telegram Bot.

## Features

### 1. **Broadcast Scheduling**
- Schedule broadcasts for future dates and times
- UTC timezone support
- Automatic execution via cron jobs
- Track scheduled, pending, and completed broadcasts

### 2. **AWS S3 Media Storage**
- Persistent media storage in AWS S3
- Automatic upload from Telegram files
- Support for all media types: photos, videos, documents, audio, voice
- Pre-signed URLs for secure access
- File metadata tracking

### 3. **Enhanced Broadcast Management**
- PostgreSQL-based broadcast tracking
- Detailed delivery statistics
- Recipient-level tracking
- Broadcast history and analytics
- Cancellation support for scheduled broadcasts

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Broadcast System                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐      ┌──────────────┐           │
│  │  Admin UI    │─────▶│ Broadcast    │           │
│  │  (Telegram)  │      │ Service      │           │
│  └──────────────┘      └──────┬───────┘           │
│                               │                    │
│                               ▼                    │
│                        ┌──────────────┐            │
│                        │  PostgreSQL  │            │
│                        │  Database    │            │
│                        └──────────────┘            │
│                                                     │
│  ┌──────────────┐      ┌──────────────┐           │
│  │  Media       │─────▶│  S3 Service  │           │
│  │  Upload      │      │              │           │
│  └──────────────┘      └──────┬───────┘           │
│                               │                    │
│                               ▼                    │
│                        ┌──────────────┐            │
│                        │   AWS S3     │            │
│                        │   Storage    │            │
│                        └──────────────┘            │
│                                                     │
│  ┌──────────────┐      ┌──────────────┐           │
│  │  Cron Job    │─────▶│  Broadcast   │           │
│  │  (Every min) │      │  Scheduler   │           │
│  └──────────────┘      └──────────────┘           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Database Schema

### Main Tables

#### 1. `broadcasts`
Stores broadcast configuration and status.

```sql
CREATE TABLE broadcasts (
  broadcast_id UUID PRIMARY KEY,
  admin_id VARCHAR(255),
  admin_username VARCHAR(255),
  title VARCHAR(500),
  message_en TEXT NOT NULL,
  message_es TEXT NOT NULL,
  media_type VARCHAR(50),
  media_url TEXT,
  s3_key TEXT,
  target_type VARCHAR(50),
  scheduled_at TIMESTAMP,
  status VARCHAR(50),
  total_recipients INTEGER,
  sent_count INTEGER,
  failed_count INTEGER,
  created_at TIMESTAMP
);
```

#### 2. `broadcast_recipients`
Tracks delivery status for each recipient.

```sql
CREATE TABLE broadcast_recipients (
  broadcast_id UUID,
  user_id VARCHAR(255),
  status VARCHAR(50),
  message_id VARCHAR(500),
  sent_at TIMESTAMP,
  error_message TEXT
);
```

#### 3. `broadcast_media`
Stores S3 media metadata.

```sql
CREATE TABLE broadcast_media (
  media_id UUID PRIMARY KEY,
  broadcast_id UUID,
  s3_bucket VARCHAR(255),
  s3_key TEXT,
  s3_url TEXT,
  media_type VARCHAR(50),
  file_size BIGINT,
  created_at TIMESTAMP
);
```

## Setup Instructions

### 1. Database Migration

Run the broadcast schema migration:

```bash
# Connect to PostgreSQL
psql -U your_user -d your_database

# Run migration
\i database/migrations/broadcast_scheduling_schema.sql
```

### 2. Environment Configuration

Add the following to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Broadcast Scheduler (optional, defaults to enabled)
ENABLE_CRON=true
```

### 3. Install Dependencies

```bash
npm install aws-sdk
```

### 4. Restart the Bot

```bash
npm start
# or
pm2 restart pnptv-bot
```

## Usage Guide

### For Admins: Creating a Broadcast

1. **Open Admin Panel**
   - Send `/admin` command in private chat
   - Click on "📢 Difusión" (Broadcast)

2. **Select Target Audience**
   - 👥 All Users
   - 💎 Premium Only
   - 🆓 Free Users
   - ↩️ Churned (Ex-Premium)

3. **Upload Media (Optional)**
   - Send a photo, video, document, audio, or voice note
   - Or skip to send text-only

4. **Enter Message Text**
   - Step 2: English text
   - Step 3: Spanish text
   - Character limits:
     - Text-only: 4000 characters
     - With media: 1020 characters

5. **Schedule or Send**
   - **Send Now**: Immediate delivery
   - **Schedule**: Set date/time for future delivery
     - Format: `YYYY-MM-DD HH:MM`
     - Example: `2025-12-25 09:00`
     - Timezone: UTC

6. **Track Progress**
   - View real-time delivery statistics
   - See sent/failed/blocked counts
   - Get broadcast ID for reference

### For Developers: Using the Broadcast Service

#### Create and Send Immediate Broadcast

```javascript
const broadcastService = require('./src/bot/services/broadcastService');

// Create broadcast
const broadcast = await broadcastService.createBroadcast({
  adminId: '123456789',
  adminUsername: 'admin',
  title: 'New Feature Announcement',
  messageEn: 'We have a new feature!',
  messageEs: '¡Tenemos una nueva característica!',
  targetType: 'all',
  mediaType: null,
  mediaUrl: null,
  scheduledAt: null, // Immediate
});

// Send broadcast
const results = await broadcastService.sendBroadcast(bot, broadcast.broadcast_id);

console.log(`Sent: ${results.sent}, Failed: ${results.failed}`);
```

#### Schedule Broadcast for Later

```javascript
// Schedule for December 25, 2025 at 9:00 AM UTC
const scheduledDate = new Date('2025-12-25T09:00:00Z');

const broadcast = await broadcastService.createBroadcast({
  adminId: '123456789',
  adminUsername: 'admin',
  title: 'Holiday Greeting',
  messageEn: 'Happy Holidays!',
  messageEs: '¡Felices Fiestas!',
  targetType: 'premium',
  scheduledAt: scheduledDate,
  timezone: 'UTC',
});

// Broadcast will be sent automatically at scheduled time
```

#### Upload Media to S3

```javascript
const s3Service = require('./src/utils/s3Service');

// Upload Telegram file to S3
const uploadResult = await s3Service.uploadTelegramFileToS3(
  bot,
  telegramFileId,
  'photo', // or 'video', 'document', 'audio', 'voice'
  {
    folder: 'broadcasts',
    metadata: {
      admin_id: '123456789',
    },
  }
);

console.log('S3 URL:', uploadResult.s3Url);
console.log('S3 Key:', uploadResult.s3Key);
```

#### Get Broadcast Statistics

```javascript
const stats = await broadcastService.getBroadcastStats(broadcastId);

console.log({
  total: stats.total_recipients,
  sent: stats.sent_count,
  failed: stats.failed_count,
  blocked: stats.blocked_count,
  status: stats.status,
});
```

#### Cancel Scheduled Broadcast

```javascript
await broadcastService.cancelBroadcast(
  broadcastId,
  'admin_user_id',
  'Changed marketing strategy'
);
```

## API Reference

### Broadcast Service

#### `createBroadcast(broadcastData)`
Create a new broadcast record.

**Parameters:**
- `adminId`: Admin user ID
- `adminUsername`: Admin username
- `title`: Broadcast title
- `messageEn`: English message
- `messageEs`: Spanish message
- `targetType`: 'all', 'premium', 'free', or 'churned'
- `mediaType`: 'photo', 'video', 'document', 'audio', 'voice', or null
- `mediaUrl`: S3 URL or Telegram file_id
- `scheduledAt`: Date object or null for immediate
- `timezone`: Timezone string (default: 'UTC')

**Returns:** Broadcast object

#### `sendBroadcast(bot, broadcastId)`
Send a broadcast to target users.

**Parameters:**
- `bot`: Telegraf bot instance
- `broadcastId`: UUID of broadcast to send

**Returns:** Statistics object with sent/failed/blocked counts

#### `uploadBroadcastMedia(bot, fileId, mediaType, broadcastId)`
Upload Telegram media to S3 and create database record.

**Parameters:**
- `bot`: Telegraf bot instance
- `fileId`: Telegram file ID
- `mediaType`: Media type
- `broadcastId`: Associated broadcast ID (optional)

**Returns:** Upload result with S3 metadata

#### `getBroadcastStats(broadcastId)`
Get detailed statistics for a broadcast.

**Parameters:**
- `broadcastId`: Broadcast UUID

**Returns:** Statistics object

#### `cancelBroadcast(broadcastId, cancelledBy, reason)`
Cancel a scheduled broadcast.

**Parameters:**
- `broadcastId`: Broadcast UUID
- `cancelledBy`: User ID who cancelled
- `reason`: Cancellation reason (optional)

**Returns:** Updated broadcast object

### S3 Service

#### `uploadTelegramFileToS3(bot, fileId, mediaType, options)`
Upload a Telegram file to S3.

**Parameters:**
- `bot`: Telegraf bot instance
- `fileId`: Telegram file ID
- `mediaType`: Media type
- `options`: Upload options
  - `folder`: S3 folder path
  - `bucket`: S3 bucket name
  - `acl`: Access control ('private' or 'public-read')
  - `metadata`: Additional metadata object

**Returns:** Upload result with S3 URL, key, bucket, etc.

#### `getPresignedUrl(s3Key, options)`
Generate a presigned URL for temporary access.

**Parameters:**
- `s3Key`: S3 object key
- `options`: Options
  - `bucket`: S3 bucket name
  - `expiresIn`: URL expiration in seconds (default: 3600)

**Returns:** Presigned URL string

#### `deleteFile(s3Key, bucket)`
Delete a file from S3.

**Parameters:**
- `s3Key`: S3 object key
- `bucket`: S3 bucket name

**Returns:** Boolean success status

### Broadcast Scheduler

#### `initialize(bot)`
Initialize the scheduler with bot instance.

#### `start()`
Start the scheduler (checks every minute for pending broadcasts).

#### `stop()`
Stop the scheduler.

#### `executeBroadcast(broadcastId)`
Execute a broadcast immediately.

#### `scheduleAt(broadcastId, scheduledDate)`
Schedule a broadcast for a specific date/time.

#### `getStatus()`
Get scheduler status and scheduled broadcasts.

## Monitoring & Analytics

### View Broadcast Statistics

```sql
-- Get all broadcasts with stats
SELECT * FROM broadcast_stats ORDER BY created_at DESC LIMIT 10;

-- Get pending scheduled broadcasts
SELECT * FROM pending_scheduled_broadcasts;

-- Get delivery statistics for a broadcast
SELECT
  status,
  COUNT(*) as count
FROM broadcast_recipients
WHERE broadcast_id = 'your-broadcast-id'
GROUP BY status;
```

### Common Queries

```sql
-- Get total broadcasts sent today
SELECT COUNT(*) FROM broadcasts
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'completed';

-- Get average success rate
SELECT
  AVG(CASE
    WHEN total_recipients > 0
    THEN (sent_count::FLOAT / total_recipients * 100)
    ELSE 0
  END) as avg_success_rate
FROM broadcasts
WHERE status = 'completed';

-- Get failed deliveries by error type
SELECT
  error_code,
  COUNT(*) as count
FROM broadcast_recipients
WHERE status = 'failed'
GROUP BY error_code
ORDER BY count DESC;
```

## Troubleshooting

### S3 Upload Fails

**Error:** `S3 bucket not configured`

**Solution:** Ensure AWS credentials are set in `.env`:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket
```

### Scheduled Broadcasts Not Sending

**Issue:** Broadcasts remain in 'scheduled' status past their time.

**Solutions:**
1. Check if broadcast scheduler is running:
   ```bash
   # Check logs
   pm2 logs pnptv-bot | grep "Broadcast scheduler"
   ```

2. Verify `ENABLE_CRON=true` in `.env`

3. Manually trigger pending broadcasts:
   ```javascript
   const scheduler = require('./src/services/broadcastScheduler');
   await scheduler.processPendingBroadcasts();
   ```

### High Failure Rate

**Issue:** Many broadcasts failing to deliver.

**Common Causes:**
1. **Users blocked bot** - Expected, tracked as 'blocked'
2. **Users deactivated account** - Expected, tracked as 'deactivated'
3. **Message too long** - Check character limits
4. **Rate limiting** - System automatically handles with 50ms delay

**Analysis:**
```sql
SELECT
  status,
  error_code,
  COUNT(*) as count
FROM broadcast_recipients
WHERE broadcast_id = 'your-broadcast-id'
GROUP BY status, error_code;
```

## Security Considerations

### S3 Permissions

Set appropriate S3 bucket permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT:user/pnptv-bot"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket/broadcasts/*"
    }
  ]
}
```

### Admin-Only Access

Broadcasts can only be created by users with admin role. This is enforced in:
- `PermissionService.isAdmin(userId)`
- Admin handler authorization checks

### Data Privacy

- Broadcast recipient data is stored securely in PostgreSQL
- S3 files use private ACL by default
- Presigned URLs expire after 1 hour
- User blocking/deactivation is respected automatically

## Performance Optimization

### Rate Limiting

- Default: 50ms delay between sends
- Prevents Telegram API rate limits
- Can be adjusted in `broadcastService.js`

### Batch Processing

For large broadcasts (>10,000 users):
- Consider splitting into smaller batches
- Monitor server resources
- Use scheduled broadcasts to distribute load

### Caching

- S3 URLs can be cached for frequently accessed media
- Consider CloudFront CDN for media delivery
- Cache broadcast statistics for analytics

## Future Enhancements

Planned features:
- [ ] Recurring broadcasts (daily, weekly, monthly)
- [ ] A/B testing support
- [ ] Rich media carousel support
- [ ] Broadcast templates
- [ ] Advanced filtering (by location, registration date, etc.)
- [ ] Delivery reports via email
- [ ] CloudFront integration for faster media delivery

## Support

For issues or questions:
- Check logs: `pm2 logs pnptv-bot`
- Database queries: See "Monitoring & Analytics" section
- GitHub Issues: Report bugs or request features

---

**Last Updated:** 2025-12-08
**Version:** 1.0.0
