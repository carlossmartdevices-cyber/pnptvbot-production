# Share Post to Community Group Feature

## Overview

A complete admin panel feature that allows administrators to create, format, and schedule posts to community groups with media support, interactive buttons, recurring scheduling, and multi-schedule support (up to 12 posts into the future).

## Feature Highlights

✅ **Media Support** - Photo and video uploads with S3 integration
✅ **Bilingual Content** - Full EN/ES support for all text
✅ **Interactive Buttons** - 7 preset button types + custom URLs
✅ **Multiple Templates** - Standard, Featured, Announcement, Event
✅ **Recurring Posts** - Daily, Weekly, Monthly patterns
✅ **Multi-Schedule** - Schedule same post 1-12 times into future
✅ **Group Targeting** - Send to single or multiple community groups
✅ **Analytics** - Track deliveries and engagement
✅ **UI/UX** - 9-step wizard with validation and preview

## Implementation Files

### 1. Database Migration
**File:** `/database/migrations/community_posts_schema.sql`

Creates 7 tables:
- `community_groups` - Community group configuration
- `community_posts` - Main post records
- `community_post_buttons` - Button definitions per post
- `community_post_schedules` - Scheduling configuration
- `community_post_deliveries` - Delivery tracking per group
- `community_post_analytics` - Engagement metrics
- `community_button_presets` - Predefined button types

**Seeded Data:**
- 6 community groups (📍 Nearby, 👤 Profile, 🎯 Main Room, 🎉 Hangouts, 🤖 Cristina AI, 🎬 Videorama)
- 7 button presets (Nearby, Profile, Main Room, Hangouts, Cristina AI, Videorama, Custom)

### 2. Service Layer
**File:** `/src/bot/services/communityPostService.js`

Core business logic:
- `createCommunityPost()` - Create new post record
- `getCommunityGroups()` - Fetch active groups
- `addButtonsToPost()` - Add buttons to post
- `schedulePost()` - Create schedules
- `getPendingPosts()` - Fetch posts ready for execution
- `getPostWithDetails()` - Fetch complete post with all details
- `formatMessage()` - Apply template formatting
- `buildButtonKeyboard()` - Create Telegram inline keyboard
- `sendPostToGroup()` - Send to single group
- `sendPostToGroups()` - Batch send to multiple groups
- `logDelivery()` - Track delivery success/failure
- `updatePostStatus()` - Update post status and counts
- `updateScheduleExecution()` - Update schedule run state
- `getPostAnalytics()` - Fetch engagement metrics
- `cancelPost()` - Cancel scheduled post
- `getButtonPresets()` - Fetch button configuration

### 3. Admin Handler
**File:** `/src/bot/handlers/admin/sharePostToCommunityGroup.js`

9-step interactive wizard:

**Step 1:** Select Target Groups
- Multi-select from available community groups
- Select all / clear selection helpers
- Shows selected count

**Step 2:** Upload Media (Optional)
- Photo or video upload to S3
- Auto-detects file type
- Skip option for text-only posts
- Max 50 MB

**Step 3:** Write Post Text
- Bilingual input (EN then ES)
- Markdown support (*bold*, _italic_)
- Character count validation
- Max 1024 characters per language

**Step 4:** Select Buttons
- Multi-select from 7 button types
- Add/remove buttons dynamically
- Customizable button labels
- Support for custom URLs

**Step 5:** Choose Template
- Standard - Clean, simple format
- Featured - Highlighted with borders
- Announcement - Important notice format
- Event - Event-specific format

**Step 6:** Set Recurrence
- One-time option
- Daily pattern
- Weekly pattern
- Monthly pattern

**Step 7:** Select Schedule Count
- Choose 1-12 scheduling slots
- Allows staggered post delivery

**Step 8:** Enter Schedule Dates/Times
- UTC format: YYYY-MM-DD HH:MM
- Multiple date/time entries
- Future date validation
- Interactive prompts for each schedule

**Step 9:** Preview & Confirm
- Shows formatted preview (EN + ES)
- Displays all configuration
- Final confirmation before saving
- Success message with Post ID

### 4. Scheduler
**File:** `/src/bot/core/schedulers/communityPostScheduler.js`

Automatic post execution:
- Runs every 60 seconds
- Fetches posts ready for execution
- Sends to all target groups
- Handles recurring post recalculation
- Tracks execution success/failure
- Auto-calculates next execution for recurring posts
- Respects max occurrences limit
- Provides scheduler statistics

**Methods:**
- `start()` - Start scheduler loop
- `stop()` - Stop scheduler
- `checkAndExecutePendingPosts()` - Main execution loop
- `executePost()` - Execute single post
- `calculateNextExecution()` - Calculate recurrence next time
- `updateScheduleStatus()` - Update schedule state
- `updateScheduleNextExecution()` - Set next run time
- `checkAndUpdatePostStatus()` - Sync post overall status
- `getStatistics()` - Fetch scheduler metrics
- `retryFailedDelivery()` - Retry failed sends

### 5. Admin Panel Integration
**File:** `/src/bot/handlers/admin/index.js`

Changes:
- Imported `registerCommunityPostHandlers`
- Registered handler in `registerAdminHandlers()`
- Added button to admin panel: "📤 Compartir Publicación" / "📤 Share Post"
- Button triggers `admin_share_post_to_groups` action

### 6. Bot Core Integration
**File:** `/src/bot/core/bot.js`

Changes:
- Imported `CommunityPostScheduler`
- Initialized scheduler after broadcast queue setup
- Started scheduler on bot launch
- Made scheduler available globally: `global.communityPostScheduler`

## Usage Flow

### For Admins

1. **Access Feature**
   ```
   /admin command → "📤 Compartir Publicación" button
   ```

2. **Create Post**
   - Select target group(s)
   - Upload optional media
   - Write bilingual text
   - Select buttons
   - Choose template
   - Set recurrence (optional)
   - Select schedule count (1-12)
   - Enter dates/times
   - Preview
   - Confirm

3. **Automatic Delivery**
   - Scheduler checks every 60 seconds
   - Sends posts to all target groups at scheduled times
   - For recurring posts, automatically schedules next execution
   - Tracks success/failure in database

### Data Model

**Community Post Record:**
```javascript
{
  post_id: UUID,
  admin_id: STRING,
  admin_username: STRING,
  title: STRING,
  message_en: TEXT,
  message_es: TEXT,
  media_type: 'photo' | 'video' | NULL,
  media_url: STRING,
  s3_key: STRING,
  s3_bucket: STRING,
  target_group_ids: UUID[],
  template_type: 'standard' | 'featured' | 'announcement' | 'event',
  is_recurring: BOOLEAN,
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | NULL,
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled',
  scheduled_count: INT (1-12),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

**Button Definition:**
```javascript
{
  button_type: STRING ('nearby', 'profile', 'main_room', etc.),
  button_label: STRING,
  target_url: STRING (optional),
  icon_emoji: STRING,
  button_order: INT
}
```

**Schedule Record:**
```javascript
{
  schedule_id: UUID,
  post_id: UUID,
  scheduled_for: TIMESTAMP,
  is_recurring: BOOLEAN,
  recurrence_pattern: STRING,
  next_execution_at: TIMESTAMP,
  status: 'scheduled' | 'executing' | 'completed' | 'failed',
  execution_order: INT (1-12),
  execution_count: INT,
  last_executed_at: TIMESTAMP
}
```

## Button Types

| Button | Icon | Type | Description |
|--------|------|------|-------------|
| Nearby | 📍 | nearby | Geolocation-based feature |
| Profile | 👤 | profile | User profile viewing |
| Main Room | 🎯 | main_room | PNPtv Main Group Channel |
| Hangouts | 🎉 | hangouts | PNPtv Hangout Group |
| Cristina AI | 🤖 | cristina_ai | AI Assistant |
| Videorama | 🎬 | videorama | Video Section |
| Custom | 🔗 | custom | User-provided URL |

## Template Examples

### Standard
```
[MEDIA]

Message text here

[BUTTONS]
```

### Featured
```
━━━━━━━━━━━━━━━━━
✨ Featured Header
━━━━━━━━━━━━━━━━━

[MEDIA]

*Message text here*

[BUTTONS]

━━━━━━━━━━━━━━━━━
```

### Announcement
```
📢 **ANNOUNCEMENT**

[MEDIA]

*Message text here*

[BUTTONS]
```

### Event
```
🎪 **EVENT**

[MEDIA]

**Title**: Message text here

[BUTTONS]
```

## Recurrence Patterns

- **One-time**: Send once at specified date/time
- **Daily**: Repeat every 24 hours
- **Weekly**: Repeat every 7 days
- **Monthly**: Repeat every month on same date
- **Max Occurrences**: Limit total sends (optional)
- **End Date**: Stop recurring on specific date (optional)

## Multi-Schedule Feature

Allows scheduling the same post content 1-12 separate times:

**Example:**
- Schedule 1: 2025-01-10 09:00 (Morning)
- Schedule 2: 2025-01-10 14:00 (Afternoon)
- Schedule 3: 2025-01-10 18:00 (Evening)

Each schedule is independent and can have different recurrence settings.

## Analytics & Tracking

**Tracked Metrics:**
- Total posts sent
- Groups reached
- Delivery failures
- Button click counts
- User interactions

**Retrieval:**
```javascript
const analytics = await communityPostService.getPostAnalytics(postId);
// Returns: {
//   total_sent: INT,
//   total_failed: INT,
//   groups_reached: INT,
//   total_clicks: INT
// }
```

## Error Handling

### Validation
- Admin role check
- Group selection required
- Bilingual text required
- Future date validation
- File size limits
- Character limits

### Delivery Failures
- Automatic retry on failed sends
- Error logging with specific error codes
- Status tracking for manual review
- Failed delivery logged in delivery table

### Recurring Post Failures
- Individual schedule status tracking
- Post status reflects overall state
- Failed schedules don't block future ones
- Manual retry available via service

## Database Optimization

**Indexes:**
- `idx_community_posts_status` - Fast status queries
- `idx_community_posts_admin_id` - Admin post lookup
- `idx_community_posts_scheduled_at` - Scheduler queries
- `idx_community_post_schedules_scheduled_for` - Next execution
- `idx_community_post_schedules_status` - Pending/failed filters
- `idx_community_post_deliveries_status` - Delivery tracking

**Performance Considerations:**
- Batch inserts for multiple schedules
- Indexed schedule queries for scheduler
- Separate delivery tracking for analytics
- Compiled analytics views possible

## Configuration

### Button Configuration
Predefined in database table `community_button_presets`:
```javascript
{
  button_type: VARCHAR(50),
  button_label: VARCHAR(255),
  default_label: VARCHAR(255),
  icon_emoji: VARCHAR(10),
  target_url: TEXT,
  allow_custom_url: BOOLEAN
}
```

Can be modified via direct SQL:
```sql
UPDATE community_button_presets
SET button_label = 'New Label', target_url = 'https://...'
WHERE button_type = 'main_room';
```

### Group Configuration
Predefined in database table `community_groups`:
```javascript
{
  group_id: UUID,
  name: VARCHAR(255),
  telegram_group_id: VARCHAR(255),
  icon: VARCHAR(20),
  display_order: INT,
  is_active: BOOLEAN
}
```

Can be enabled/disabled without code changes:
```sql
UPDATE community_groups SET is_active = false WHERE name = 'Nearby';
```

## Scheduler Statistics

Get live statistics:
```javascript
const stats = await global.communityPostScheduler.getStatistics();
// Returns: {
//   scheduled_posts: INT,
//   sent_posts: INT,
//   failed_posts: INT,
//   pending_schedules: INT,
//   executing_schedules: INT,
//   total_deliveries: INT,
//   avg_execution_delay_seconds: FLOAT
// }
```

## Future Enhancements

Potential additions:
1. Custom cron expressions for complex schedules
2. Post drafts and versioning
3. Scheduled post editing before execution
4. Post cloning/duplication
5. Advanced analytics dashboard
6. A/B testing support
7. Conditional scheduling based on user segments
8. Post interaction tracking (opens, clicks, replies)
9. Failed delivery retry UI with manual controls
10. Bulk post operations (create multiple at once)

## Troubleshooting

### Post Not Sending
1. Check scheduler is running: `global.communityPostScheduler.isRunning`
2. Verify group is active in database
3. Check post status in database
4. Review error message in schedule record

### Media Not Uploading
1. Check S3 credentials are configured
2. Verify file size < 50 MB
3. Check S3 bucket permissions
4. Review upload error in logs

### Recurring Post Not Continuing
1. Check max_occurrences not reached
2. Verify recurrence_pattern is set
3. Check recurrence_end_date not passed
4. Review calculation in scheduler

## Testing Checklist

- [ ] Create post with photo + text (EN/ES)
- [ ] Create post with video
- [ ] Create text-only post
- [ ] Select multiple groups
- [ ] Select single group
- [ ] Add multiple buttons
- [ ] Test all template types
- [ ] Schedule single post
- [ ] Schedule post 5 times
- [ ] Schedule post 12 times
- [ ] Set recurring pattern
- [ ] Verify post sends at scheduled time
- [ ] Verify recurring post repeats
- [ ] Check buttons work in group
- [ ] Verify media displays correctly
- [ ] Test bilingual display
- [ ] Check analytics data
- [ ] Test cancel functionality
- [ ] Verify error handling
- [ ] Check database constraints

## Admin Commands

**Enter admin panel:**
```
/admin
```

**Access feature:**
- Click "📤 Compartir Publicación" in admin menu

**Check scheduler status:**
```javascript
// In any handler
const stats = global.communityPostScheduler.getStatistics();
```

**Stop scheduler (for maintenance):**
```javascript
global.communityPostScheduler.stop();
```

**Restart scheduler:**
```javascript
global.communityPostScheduler.start();
```

## Support

For issues or enhancements, refer to:
- Database schema: `/database/migrations/community_posts_schema.sql`
- Service: `/src/bot/services/communityPostService.js`
- Handler: `/src/bot/handlers/admin/sharePostToCommunityGroup.js`
- Scheduler: `/src/bot/core/schedulers/communityPostScheduler.js`

---

**Version:** 1.0.0
**Date:** 2025-01-05
**Status:** Production Ready
