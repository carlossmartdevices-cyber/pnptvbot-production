# 🎭 Media Popularity System - Setup Guide

## 🚀 Quick Start

Follow these steps to activate the Media Popularity & Rewards System:

```bash
# Step 1: Run database migration
node scripts/run_media_shares_migration.js

# Step 2: Verify migration
node scripts/verify_media_shares_table.js

# Step 3: Restart bot
pm restart

# Step 4: Test manually (optional)
node scripts/test_media_popularity.js
```

## 📋 Detailed Setup Instructions

### Step 1: Database Migration

Run the migration script to create the `media_shares` table:

```bash
cd /root/pnptvbot-production
node scripts/run_media_shares_migration.js
```

**What this does:**
- Creates `media_shares` table
- Adds indexes for performance
- Sets up triggers for automatic timestamps
- Adds documentation comments

**Expected output:**
```
🚀 Starting media_shares table migration...
✅ Migration SQL loaded
✅ Executed: CREATE TABLE IF NOT EXISTS media_shares...
✅ Executed: CREATE INDEX IF NOT EXISTS idx_media_shares_user_id...
✅ Executed: CREATE OR REPLACE FUNCTION update_media_shares_updated_at...
✅ Executed: CREATE TRIGGER trigger_update_media_shares_updated_at...
✅ Executed: COMMENT ON TABLE media_shares IS...
🎉 Migration completed successfully!
✅ media_shares table created
✅ Indexes created
✅ Triggers configured
✅ Comments added
```

### Step 2: Verify Migration

Check that the table was created correctly:

```bash
node scripts/verify_media_shares_table.js
```

**Expected output:**
```
🔍 Verifying media_shares table...
✅ media_shares table exists
✅ Table structure:
   • id (integer)
   • user_id (character varying)
   • media_type (character varying)
   • media_id (character varying)
   • message_id (character varying)
   • share_count (integer)
   • like_count (integer)
   • created_at (timestamp with time zone)
   • updated_at (timestamp with time zone)
   • last_like_at (timestamp with time zone)
✅ Indexes:
   • idx_media_shares_user_id
   • idx_media_shares_media_type
   • idx_media_shares_created_at
   • idx_media_shares_like_count
   • idx_media_shares_share_count
✅ Current records: 0
🎉 media_shares table is properly configured!
✅ Ready to track media popularity
```

### Step 3: Restart the Bot

Restart the bot to activate the media popularity scheduler:

```bash
# If using PM2
pm2 restart pnptv-bot

# If running directly
pm restart
```

**What this does:**
- Initializes the media popularity scheduler
- Sets up daily, weekly, and monthly announcements
- Begins tracking media shares and likes

**Expected log output:**
```
✓ Media popularity scheduler initialized
Daily winner announcement scheduled for [date]
Weekly top sharer announcement scheduled for [date]
Monthly top contributor announcement scheduled for [date]
```

### Step 4: Test the System (Optional)

Create a test script to verify everything works:

```bash
node scripts/test_media_popularity.js
```

This will:
- Test media tracking
- Test congratulatory message generation
- Verify tribe personalization
- Test announcement broadcasting

## 🎯 System Components

### 1. Database Table

**`media_shares`** - Tracks all media shares and likes

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `user_id` | VARCHAR(255) | Telegram user ID |
| `media_type` | VARCHAR(20) | photo/video/document |
| `media_id` | VARCHAR(255) | Telegram file ID (UNIQUE) |
| `message_id` | VARCHAR(255) | Telegram message ID |
| `share_count` | INTEGER | Number of shares |
| `like_count` | INTEGER | Number of likes/reactions |
| `created_at` | TIMESTAMP | When first shared |
| `updated_at` | TIMESTAMP | Last update time |
| `last_like_at` | TIMESTAMP | When last liked |

### 2. Services

**`MediaPopularityService`** - Core functionality
- Tracks media shares and likes
- Generates congratulatory messages
- Handles automated announcements
- Uses user's chosen tribe for personalization

**`MediaPopularityScheduler`** - Automated scheduling
- Daily announcements at 8 PM
- Weekly announcements every Monday at 8 PM
- Monthly announcements on 1st of month at 8 PM
- Manual trigger capabilities for testing

### 3. Integration Points

**Bot Core** (`src/bot/core/bot.js`)
- Initializes scheduler on startup
- Integrates with existing bot infrastructure

**User Model**
- Provides user data including tribe information
- Used for personalization in messages

## 📊 Monitoring & Maintenance

### Check Scheduler Status

```javascript
// In admin panel or via command
const scheduler = new MediaPopularityScheduler(bot);
const status = scheduler.getStatus();
// Returns: { daily: 'scheduled', weekly: 'scheduled', monthly: 'scheduled' }
```

### Manual Announcement Trigger

```javascript
// For testing or special occasions
const scheduler = new MediaPopularityScheduler(bot);
await scheduler.triggerDailyAnnouncement();
await scheduler.triggerWeeklyAnnouncement();
await scheduler.triggerMonthlyAnnouncement();
```

### View Statistics

```javascript
const stats = await MediaPopularityScheduler.getStatistics();
// Returns: { total_media, total_pictures, total_videos, total_likes, total_shares }
```

## 🎓 Troubleshooting

### Migration Issues

**Problem:** Migration fails with table already exists

**Solution:** The migration uses `IF NOT EXISTS`, but if you need to recreate:
```bash
# Backup data first
pg_dump -t media_shares > media_shares_backup.sql

# Drop and recreate
psql -c "DROP TABLE IF EXISTS media_shares;"
node scripts/run_media_shares_migration.js
```

### Scheduler Not Running

**Problem:** No announcements are being made

**Check:**
1. Verify bot is running: `pm2 status`
2. Check logs: `pm2 logs pnptv-bot`
3. Test manually: `node scripts/test_media_popularity.js`

**Solution:**
```bash
# Restart bot
pm2 restart pnptv-bot

# Check scheduler status
# (Add admin command to check scheduler status)
```

### Tribe Not Showing

**Problem:** Messages show "Member" instead of user's tribe

**Check:**
1. Verify user has tribe set in database
2. Check user model returns tribe correctly

**Solution:**
```sql
-- Check user's tribe
SELECT id, first_name, tribe FROM users WHERE id = 'USER_ID';

-- Update tribe if needed
UPDATE users SET tribe = 'Goddess' WHERE id = 'USER_ID';
```

## 🚀 Go Live Checklist

- [ ] Database migration completed
- [ ] Table verification passed
- [ ] Bot restarted successfully
- [ ] Scheduler initialized
- [ ] First daily announcement scheduled
- [ ] Tested with sample data
- [ ] Notified admins
- [ ] Announced to community

## 🎉 Success Metrics

Track these metrics after launch:

- **Media Shares**: Increase in daily media sharing
- **User Engagement**: More likes and reactions
- **Reward Claims**: Number of users claiming prizes
- **Community Growth**: New users attracted by rewards
- **Retention**: Active users staying longer

**Expected Results:**
- 20-30% increase in media sharing
- 15-25% increase in user engagement
- 10-20% increase in premium conversions
- Higher community satisfaction

---

**Need Help?**
- Check logs: `tail -f logs/pm2-out.log`
- Test manually: `node scripts/test_media_popularity.js`
- Contact: @PNPtv_Support

**Documentation:** [MEDIA_POPULARITY_FEATURE.md](MEDIA_POPULARITY_FEATURE.md)

**Status:** ✅ Ready for Production
**Version:** 1.0.0
**Last Updated:** 2026-01-07
