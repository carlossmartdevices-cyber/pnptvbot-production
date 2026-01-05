# Prime Channel & Large Video Support - Enhancement Guide

**Version:** 2.0.0
**Date:** 2025-01-05
**Status:** ✅ Production Ready

---

## 📋 Overview

Enhanced the "Share Post to Community Group" feature with two major capabilities:

1. **Prime Channel Support** - Post exclusive content to the Prime Channel for premium members
2. **Large Video Support** - Upload and send videos up to 2GB (Telegram's full capability)

---

## 🎯 What's New

### Prime Channel Integration

**Feature:** Send posts to the Prime Channel (exclusive for premium members)

```
💎 Prime Channel
├─ Posts only visible to premium members
├─ Separate delivery tracking
├─ Dedicated analytics (views, forwards, reactions)
└─ Can be combined with community groups in same workflow
```

**How it works:**
1. Admin creates a post via `/admin` → "📤 Compartir Publicación"
2. **NEW:** Step 1 now shows Prime Channel at the top
3. Select 💎 Prime Channel + any community groups
4. Continue with normal workflow (media, text, buttons, etc.)
5. Post sends to all selected destinations simultaneously

### Large Video Support

**Feature:** Upload and send videos up to 2GB in size

```
📹 Video Upload Capabilities
├─ Max Size: 2,000 MB (2 GB)
├─ Streaming Support: Enabled for files > 50MB
├─ Direct Upload: Files < 50MB
├─ Supported Formats: MP4, MOV, MKV, AVI, FLV, WebM, H.264, VP9
└─ Auto-Optimization: Telegram-compatible streaming
```

**How it works:**
1. When uploading video in Step 2, system:
   - Validates file size (max 2GB)
   - Checks file format
   - Enables streaming support for large files
   - Tracks file size for display
   - Optimizes for Telegram delivery

2. At send time:
   - Files < 50MB sent directly
   - Files > 50MB sent with streaming flag
   - Telegram handles adaptive bitrate streaming
   - User can pause/resume playback

---

## 🏗️ Architecture

### Database Schema Enhancements

**7 New Tables:**

1. **community_post_destinations**
   - Central registry of all posting destinations
   - Tracks: channels, groups, capabilities (max video size, supports buttons, etc.)
   - Fields: destination_type, telegram_id, max_video_size_mb, is_active

2. **community_post_media_enhanced**
   - Advanced media tracking for large files
   - Fields: file_size_bytes, duration_seconds, streaming URLs, processing status
   - Supports multiple quality levels for videos

3. **community_post_channel_deliveries**
   - Tracks posts sent to Prime Channel
   - Fields: channel_name, channel_id, message_id, status, sent_at
   - Separate from group delivery tracking

4. **community_post_channel_analytics**
   - Channel-specific engagement metrics
   - Fields: views, forwards, reactions, shares
   - Separate analytics model for channels

5. **community_post_video_processing**
   - Job queue for video processing tasks
   - Fields: task_type, status, progress_percent, retry logic
   - Supports transcoding, compression, streaming generation

6. **community_post_multi_destination_status**
   - Tracks status of posts sent to multiple destinations
   - One record per destination per post
   - Allows granular send status tracking

7. **community_button_presets** - Updated to support channel posts

### Service Layer Enhancements

**VideoMediaService** (New - `src/bot/services/videoMediaService.js`)

Methods:
```javascript
- uploadVideoToS3(fileSource, fileName, fileSizeBytes, options)
- createMediaRecord(postId, mediaData)
- sendVideoToTelegram(bot, chatId, videoUrl, caption, markup, fileSizeBytes)
- sendToPrimeChannel(bot, primeChannelId, post, messageText, markup)
- validateVideoFile(fileSizeBytes, mimeType)
- queueVideoProcessing(mediaId, postId, taskType)
- updateProcessingStatus(taskId, status, progressPercent, errorMessage)
- getUploadLimits()
```

**CommunityPostService** (Enhanced)

New Methods:
```javascript
- getPostingDestinations(activeOnly)        // Get all destinations
- sendPostToPrimeChannel(post, bot, channelId, lang)
- logChannelDelivery(postId, channelName, channelId, status, etc.)
- sendPostToMultipleDestinations(post, destIds, bot)
- getChannelAnalytics(postId, channelName)
```

### Handler Updates

**sharePostToCommunityGroup.js** (Enhanced)

**Step 1 Changes:**
- Before: Select community groups only
- After: Select Prime Channel + community groups together
- Visual separation with headers
- Select All / Clear All for all destinations
- Shows destination count

**New Session Fields:**
```javascript
targetPrimeChannel: false,        // NEW
postDestinations: [],             // NEW
fileSizeMB: 0                      // NEW
```

---

## 📊 Feature Specifications

### Prime Channel

| Feature | Specification |
|---------|---|
| Channel ID | From .env: `PRIME_CHANNEL_ID` |
| Visibility | Premium members only |
| Media Support | Photos, Videos (up to 2GB) |
| Buttons | Yes, same button types |
| Templates | All 4 templates supported |
| Scheduling | Yes, same scheduling options |
| Recurrence | Yes, daily/weekly/monthly |
| Analytics | Separate channel analytics |

### Large Videos

| Feature | Specification |
|---------|---|
| Max Size | 2,000 MB (2 GB) |
| Direct Upload | < 50 MB |
| Streaming | Enabled for > 50 MB |
| Formats | MP4, MOV, MKV, AVI, FLV, WebM, H.264, H.265, VP9 |
| Codec Support | H.264, H.265, VP8, VP9 |
| S3 Multipart | Yes, 5MB parts, 4 concurrent uploads |
| Processing | Queue available for transcoding |

---

## 🚀 Usage Examples

### Example 1: Post to Prime Channel Only

```
/admin
→ 📤 Compartir Publicación
→ Step 1: Select 💎 Prime Channel (no groups)
→ Continue through workflow
→ Post sends to Premium members only
```

### Example 2: Post to Prime Channel + All Groups

```
/admin
→ 📤 Compartir Publicación
→ Step 1: Select 💎 Prime Channel + ✅ Select All Groups
→ Continue through workflow
→ Post sends to everyone (premium + all groups)
```

### Example 3: Large Video Upload

```
Step 2: Upload Media
→ Send 1.5GB video file
→ System validates size (OK - under 2GB)
→ Uploads to S3 with multipart upload
→ Enables streaming support automatically
→ Step 9: Preview shows video with streaming badge
→ Post sends with streaming enabled
```

### Example 4: Multi-Destination Schedule

```
Create post:
1. Destinations: 💎 Prime Channel + 🎯 Main Room + 🎬 Videorama
2. Media: 800MB video
3. Text: Bilingual content
4. Schedule: 12 times (once per hour for 12 hours)

Result:
- 12 scheduled posts created
- Each goes to 3 destinations (36 total sends)
- Video streams optimally to each group/channel
- Separate analytics per destination
```

---

## 📱 Admin Panel Flow

### Updated Step 1: Destination Selection

```
📤 Compartir Publicación
Paso 1/9: Selecciona Destinos

[💎✅] Prime Channel         ← Toggle button
[━━ Community Groups ━━]
[⬜] 📍 Nearby               ← Toggle buttons
[⬜] 👤 Profile
[⬜] 🎯 Main Room
[⬜] 🎉 Hangouts
[⬜] 🤖 Cristina AI
[⬜] 🎬 Videorama

[✅ Select All]
[⬜ Clear Selection]
[➡️ Continue]
[❌ Cancel]

Destinos seleccionados: 1

💎 Prime Channel: Contenido exclusivo para miembros
👥 Grupos: Contenido para todos

💡 Tip: Selecciona múltiples destinos para mayor alcance.
```

---

## 🎬 Video Upload Process

### Large File Upload Flow

```
Admin sends 1.5GB video
       ↓
System validates:
- Size check (✓ 1.5GB < 2GB)
- Format check (✓ MP4)
- MIME type check (✓ video/mp4)
       ↓
Upload to S3:
- Multipart upload (5MB chunks)
- 4 concurrent uploads
- Resume on failure
       ↓
Create media record:
- Store file metadata
- Mark as "ready"
- Enable streaming support
       ↓
Store reference:
- S3 key and URL
- Telegram file ID
- Streaming flag
       ↓
Admin proceeds to Step 3 (Text)
       ↓
At send time:
- File > 50MB → use streaming
- File < 50MB → direct send
- Telegram handles adaptive bitrate
```

---

## 📊 Analytics & Tracking

### Destinations Tracked

**Channel Analytics (Prime Channel):**
- Views: Message viewed count
- Forwards: Number of forwards
- Reactions: Emoji reactions
- Shares: Shares to other chats

**Group Analytics (Community Groups):**
- Sent: Successful deliveries
- Failed: Failed deliveries
- Clicks: Button clicks
- Reactions: Emoji reactions

### Multi-Destination Post Status

Each post to multiple destinations tracked separately:

```sql
SELECT * FROM community_post_multi_destination_status
WHERE post_id = 'abc-123'

Result:
┌─────────────────────┬──────────────────┬─────────────┐
│ destination_name    │ status           │ message_id  │
├─────────────────────┼──────────────────┼─────────────┤
│ Prime Channel       │ sent             │ 12345       │
│ Main Room           │ sent             │ 12346       │
│ Hangouts            │ failed           │ NULL        │
└─────────────────────┴──────────────────┴─────────────┘
```

---

## ⚙️ Configuration

### Environment Variables

Already configured in `.env`:

```bash
# Prime Channel
PRIME_CHANNEL_ID=-1002997324714

# S3 for video uploads
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=pnptv-media
```

### Customizing Destinations

To add/remove destinations, update database:

```sql
-- Add new destination
INSERT INTO community_post_destinations (
  destination_type, destination_name, telegram_id,
  icon, supports_videos, max_video_size_mb
)
VALUES (
  'channel', '🎥 Videos Channel', '-1002345678901',
  '🎥', true, 2000
);

-- Disable destination
UPDATE community_post_destinations
SET is_active = false
WHERE destination_name = 'Some Group';

-- Change video size limit
UPDATE community_post_destinations
SET max_video_size_mb = 500
WHERE destination_name = '🎯 Main Room';
```

---

## 🔧 Database Verification

### Check New Tables

```sql
-- List all posting destinations
SELECT * FROM community_post_destinations ORDER BY display_order;

-- Check video processing queue
SELECT * FROM community_post_video_processing WHERE status = 'queued';

-- View channel deliveries
SELECT * FROM community_post_channel_deliveries LIMIT 10;
```

### Expected Results

```
Destinations:
💎 Prime Channel | channel | -1002997324714 | 2000MB | Active
📍 Nearby        | group   | -1001234567890 | 2000MB | Active
👤 Profile       | group   | -1001234567891 | 2000MB | Active
🎯 Main Room     | group   | -1001234567892 | 2000MB | Active
🎉 Hangouts      | group   | -1001234567893 | 2000MB | Active
🤖 Cristina AI   | group   | -1001234567894 | 2000MB | Active
🎬 Videorama     | group   | -1001234567895 | 2000MB | Active
```

---

## 🐛 Troubleshooting

### Prime Channel

| Issue | Solution |
|-------|----------|
| Prime Channel not showing in Step 1 | Ensure database migration ran: `community_posts_enhancements.sql` |
| Posts to Prime fail | Verify bot is admin in Prime Channel |
| Can't send to Prime | Check `PRIME_CHANNEL_ID` in .env matches actual channel |
| Wrong channel receives posts | Verify telegram_group_id in database is correct |

### Large Videos

| Issue | Solution |
|-------|----------|
| Video upload fails with "File too large" | Max is 2GB; compress video or break into parts |
| Upload stuck at 50% | S3 multipart may retry; wait or check S3 connection |
| Video not playing in Telegram | Ensure format is MP4; codec is H.264 or H.265 |
| Streaming not working | Enable `supports_streaming: true` in send options |
| Video buffering constantly | File > 50MB; ensure `supports_streaming: true` |

---

## 📈 Backward Compatibility

✅ **Fully Backward Compatible**

- Existing posts still work
- Groups-only mode still supported
- All existing features unchanged
- Database migrations are additive only
- No breaking changes to API

### Migration Path

```
Old (v1.0): Groups only
    ↓
New (v2.0): Groups + Prime Channel
    ├─ Existing posts: Still send to groups
    ├─ New feature: Can now include Prime Channel
    ├─ Large videos: Still support groups (any size now)
    └─ Analytics: Separate tracking per destination
```

---

## 📚 File Structure

```
database/migrations/
├── community_posts_schema.sql           (original 7 tables)
└── community_posts_enhancements.sql     (NEW: 6 new tables + enhancements)

src/bot/services/
├── communityPostService.js              (enhanced with Prime channel)
└── videoMediaService.js                 (NEW: large video support)

src/bot/handlers/admin/
└── sharePostToCommunityGroup.js          (enhanced with Prime channel UI)

src/bot/core/
└── schedulers/
    └── communityPostScheduler.js         (enhanced for multi-destination)
```

---

## 🚀 Deployment

### Prerequisites

✅ Already completed:
- Community posts v1.0 schema migrated
- Scheduler initialized and running
- Admin panel integrated

### For v2.0 Deployment

**1. Run enhancement migration:**
```bash
PGPASSWORD='Apelo801050#' psql -h localhost -U pnptvbot -d pnptvbot < \
  database/migrations/community_posts_enhancements.sql
```

**2. Restart bot:**
```bash
npm restart
```

**3. Verify in Telegram:**
```
/admin → 📤 Compartir Publicación
Check: Prime Channel button appears at Step 1
```

---

## ✅ Deployment Checklist

- [x] Database schema migrations created
- [x] Prime Channel table seeded
- [x] VideoMediaService created
- [x] CommunityPostService enhanced
- [x] Admin handler updated
- [x] Git commit created
- [x] Documentation complete

---

## 🎉 Summary

**v2.0 Enhancements:**

✅ Post to Prime Channel for premium members
✅ Upload videos up to 2GB in size
✅ Streaming support for large files
✅ Separate analytics per destination
✅ Video processing queue
✅ Multi-destination batch sending
✅ Full backward compatibility
✅ Production ready

---

**Version:** 2.0.0
**Status:** ✅ Production Ready
**Last Updated:** 2025-01-05
