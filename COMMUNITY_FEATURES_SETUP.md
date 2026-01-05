# Community Features Setup Guide

This document outlines the recent moderation, group cleanup, and Wall of Fame features added to the PNPtv bot.

## 1. Auto-Moderation Filters (ENABLED)

All auto-moderation filters are now **ENABLED by default** and actively monitoring group messages.

### Enabled Filters:

#### A. **Spam Detection**
- Detects excessive uppercase letters (>70% of text)
- Detects excessive emojis (>10 emojis in a message)
- Detects repeated characters (same character 5+ times)
- Detects excessive punctuation (4+ consecutive ! or ?)
- **Action:** Warning + message deletion

#### B. **Flood Detection**
- Detects when users send more than 10 messages in 30 seconds
- **Action:** Warning only (message not deleted)

#### C. **Link Filtering**
- Blocks all external URLs/links in groups
- Supports domain whitelist for approved URLs
- **Action:** Warning + message deletion
- **Exceptions:** Admins can post links

#### D. **Profanity Filter** (Severe Content Only)
Only the following words are banned (adult community friendly):
- **Rape-related:** rape, raped, rapist, violación, violador
- **Pedophilia-related:** pedophile, pedophilia, pedofilia, pedófilo, pedo
- **Zoophilia-related:** zoophilia, zoophile, zoofilia, zoófilo
- **Related terms:** child sex, child abuse, animal abuse
- **Action:** Warning + message deletion

#### E. **Username Enforcement**
- Minimum length: 3 characters
- Maximum length: 32 characters
- Blacklisted names: admin, moderator, pnptv, official, support
- **Action:** Message deletion + user notification

### Configuration File:
- **Location:** `src/config/moderationConfig.js`
- **Enable/Disable:** Set `FILTERS.*.enabled: true/false`

### Warning System:
- **Max Warnings:** 3 per user per group
- **Warning Expiration:** 30 days
- **Escalation:**
  - 1st warning: ⚠️ Warning issued
  - 2nd warning: 🔇 User muted for 24 hours
  - 3rd warning: 🚫 User banned from group

---

## 2. Group Command Restriction

**Only `/menu` command is allowed in groups.** All other commands are automatically:
1. Deleted immediately
2. Bot sends reply: "Only /menu command is allowed in this group."
3. Reply is auto-deleted after 30 seconds

### Implementation:
- **File:** `src/bot/core/middleware/groupCommandRestriction.js`
- **Behavior:**
  - User sends `/start`, `/help`, `/admin`, etc. in group
  - Message is deleted
  - Bot replies with the restriction message
  - Both messages are cleaned up automatically

---

## 3. Community Group Cleanup Command

**Admin-only command** to delete all previous bot messages in the community group and keep only the most current one.

### Usage:
```
/cleanupcommunity
```

### Requirements:
- User must be an admin (checked via PermissionService)
- Command works in any chat but targets the GROUP_ID

### Deletion Rules & Exceptions:

#### What Gets Deleted:
✅ All previous bot messages in the group
- Bot replies to commands
- Bot notifications
- Bot status messages

#### What Gets KEPT:
✨ **Most recent message** (the one from the cleanup command)
- This is the status message showing cleanup results

#### What is NEVER Deleted (Permanent):
♾️ **Wall of Fame photos/videos in Wall of Fame channel**
- All photos/videos posted to Wall of Fame are PERMANENT
- They survive all cleanup commands
- Wall of Fame messages are tracked separately
- Messages in WALL_OF_FAME_CHANNEL are protected

♾️ **Original group messages**
- User messages are not affected
- Only bot messages are cleaned up

### What It Does:
1. Sends status message: "🧹 Cleaning bot messages in community..."
2. Displays the deletion rules and exceptions
3. Deletes all tracked bot messages in the group EXCEPT:
   - Wall of Fame channel messages (protected)
   - The current status message (kept as most recent)
4. Updates the status message with results
5. Sends confirmation to admin with detailed deletion statistics

### Configuration:
- **Group ID:** Set in `.env` as `GROUP_ID=-1003291737499`
- **Wall of Fame Channel:** Set in `.env` as `WALL_OF_FAME_CHANNEL_ID=-1001234567890`
- **File:** `src/bot/handlers/admin/index.js`

### Example Output:

**Status Message:**
```
✅ Cleanup completed

📊 Statistics:
• Bot messages deleted: 47
• Current message: ✨ Kept (most recent)

🛡️ Exceptions:
• Wall of Fame: NEVER deleted ♾️
• Photos/Videos: Permanent on Wall ♾️
• Only previous bot messages: Deleted
```

**Admin Confirmation:**
```
✅ Cleanup completed successfully

📊 Messages deleted: 47

🔐 Deletion Rule:
✅ Deleted: All previous bot messages
✨ Kept: Only the most recent message
♾️ NEVER deleted: Wall of Fame photos/videos
```

---

## 4. Wall of Fame Feature

Automatically posts member photos/videos to a dedicated "Wall of Fame" **TOPIC** within the community group with their profile information.

### IMPORTANT: Permanent Storage Policy

**Wall of Fame messages are PERMANENT and NEVER deleted under ANY circumstances:**
- ♾️ All photos/videos posted to Wall of Fame topic survive forever
- ♾️ The `/cleanupcommunity` cleanup command does NOT affect Wall of Fame topic
- ♾️ Wall of Fame messages are separately tracked and protected
- ♾️ Even if cleanup commands run, Wall of Fame topic remains untouched
- ♾️ This is a permanent archive of member contributions in a dedicated topic

### Functionality:

#### When Members Post Photos/Videos in Group:
1. Photo/video is automatically posted to Wall of Fame **TOPIC**
2. Member's profile information is included (name, username, bio, social media)
3. **Original message is deleted from main group** (prevents duplicates in general chat)
4. **Message in Wall of Fame topic is marked as PERMANENT**
5. Member receives a private DM confirmation

#### Wall of Fame Topic Properties:
- **Location**: Dedicated topic within the community GROUP_ID
- **Messages are PERMANENT** - they are never deleted
- **Never affected by cleanup commands** - protected from /cleanupcommunity
- **Separate storage** - tracked independently from main group bot messages
- **Topic ID**: Set in `.env` as `WALL_OF_FAME_TOPIC_ID`
- **Default**: `3132` (your actual Wall of Fame topic ID)

#### Member Info Displayed:
- Name (First + Last name)
- Username (@handle)
- Bio
- Social media links (if available):
  - Instagram
  - Twitter
  - TikTok
  - YouTube
  - Telegram

### Configuration:

#### Environment Variables:
```env
GROUP_ID=-1003291737499              # Community group (required)
WALL_OF_FAME_TOPIC_ID=3132          # Wall of Fame topic ID (within the group)
```

#### Database Migration (Required):
Run the migration to add social media fields to the users table:
```sql
-- File: src/migrations/add_social_media_to_users.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS youtube VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram VARCHAR(255);
```

### Files Modified/Created:

1. **Created:** `src/bot/handlers/group/wallOfFame.js`
   - Main handler for photo/video detection
   - Builds member info captions
   - Handles forwarding and deletion logic

2. **Updated:** `src/models/userModel.js`
   - Added mapping for social media fields
   - instagram, twitter, tiktok, youtube, telegram

3. **Updated:** `src/bot/core/bot.js`
   - Registered Wall of Fame handler

4. **Created:** `src/migrations/add_social_media_to_users.sql`
   - Migration script for database schema

### Usage Flow:

```
Member in Group:
    ↓
Member posts photo/video
    ↓
Bot detects it (via 'photo' or 'video' event)
    ↓
Bot fetches member profile info
    ↓
Bot forwards to Wall of Fame with caption
    ↓
Bot deletes original message from group
    ↓
Bot sends DM confirmation to member
```

### Example Wall of Fame Caption:

```
👑 Featured Member

Name: John Doe
Username: @johndoe
Bio: Digital creator & photographer 📸

Social Media:
📸 Instagram | 𝕏 Twitter | 🎵 TikTok | ▶️ YouTube | ✈️ Telegram

✨ Featured on Wall of Fame
```

---

## 5. Implementation Checklist

- [x] Enable auto-moderation filters (Spam, Flood, Links, Profanity)
- [x] Add profanity filter with only rape/pedophilia/zoophilia words
- [x] Update group command restriction middleware
- [x] Create group cleanup command (`/cleanupcommunity`)
- [x] Create Wall of Fame handler
- [x] Add social media fields to user model
- [x] Create database migration for social media fields
- [x] Register handlers in main bot file

---

## 6. Environment Variables to Set

```env
# Community Group
GROUP_ID=-1003291737499

# Wall of Fame Channel (IMPORTANT: Must be set!)
WALL_OF_FAME_CHANNEL_ID=-1001234567890

# Optional: Support group for issues
SUPPORT_GROUP_ID=-1003365565562
```

---

## 7. Database Migration

Before using Wall of Fame feature, apply the migration:

```bash
# Using your database tool:
psql -U postgres -d pnptvbot -f src/migrations/add_social_media_to_users.sql
```

Or manually run:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS youtube VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram VARCHAR(255);
```

---

## 8. Troubleshooting

### Wall of Fame Not Working
- Check `WALL_OF_FAME_CHANNEL_ID` is set in `.env`
- Verify bot has permission to post in that channel
- Ensure database migration was applied
- Check logs: `Bot Error posting to Wall of Fame`

### Cleanup Command Not Working
- Verify user is admin: `PermissionService.isAdmin(userId)`
- Check `GROUP_ID` is set in `.env`
- Verify bot has permission to delete messages in group
- Check logs: `Group cleanup completed`

### Filters Not Working
- Verify filters are enabled: `FILTERS.*.enabled: true`
- Check if user is admin (admins bypass all filters)
- Look for errors in moderation middleware logs

### Social Media Links Not Showing
- User needs to have set their social media in profile
- Currently must be manually added to database
- Fields: instagram, twitter, tiktok, youtube, telegram

---

## 9. Future Enhancements

1. **Add social media edit in user profile**
   - Let users update their Instagram, Twitter, TikTok handles
   - Add profile settings UI

2. **Wall of Fame leaderboard**
   - Track how many times members are featured
   - Monthly/weekly rankings

3. **Moderation dashboard**
   - View warnings per user
   - Manage banned words per group
   - Statistics on filter triggers

4. **Custom moderation rules**
   - Allow admins to set custom banned words
   - Configure filter sensitivity per group
   - Whitelist specific users from certain rules

---

## 10. Support

For issues or questions about these features:
1. Check the logs: `src/utils/logger.js`
2. Review the implementation files
3. Contact the development team

---

Last Updated: January 5, 2026
