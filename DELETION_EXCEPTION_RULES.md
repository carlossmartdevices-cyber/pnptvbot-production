# Deletion Exception Rules - Community Features

## Overview

This document defines the complete deletion and persistence rules for the PNPtv bot community features.

---

## Core Principle

**The bot maintains a clean community group while preserving a permanent Wall of Fame archive.**

---

## Deletion Rules by Feature

### 1. Group Cleanup Command (`/cleanupcommunity`)

#### What Gets Deleted ✅
- All bot messages sent in the **GROUP** prior to the cleanup command
- Bot replies to commands
- Bot notifications
- Bot status messages
- Bot warnings and moderation messages

#### What Gets Kept ✨
- **Most Recent Message** - The cleanup status message itself
  - Shows statistics about what was deleted
  - Shows deletion rules and exceptions
  - Persists as the newest bot message in the group

#### What is NEVER Deleted (Exceptions) ♾️

**1. Wall of Fame Topic Messages (PERMANENT)**
- All photos/videos posted to Wall of Fame **TOPIC** are PROTECTED
- Messages in `WALL_OF_FAME_TOPIC_ID` (topic 3132) are tracked separately
- The `/cleanupcommunity` command operates ONLY in the main GROUP chat
- Wall of Fame topic is completely excluded from cleanup
- Topic is within the same GROUP, but messages are protected separately

**2. User Messages in Group**
- Original member messages are NOT deleted
- Only bot messages are affected
- User posts remain untouched

**3. Original Photo/Video Posts**
- When a member posts a photo/video in the main group:
  - It's copied to Wall of Fame topic (marked as PERMANENT)
  - Original in main group is deleted (prevents duplicate)
  - Wall of Fame topic copy survives forever in the dedicated topic

---

### 2. Wall of Fame Feature (TOPIC 3132)

#### Permanent Storage Rules ♾️

**All photos/videos in Wall of Fame TOPIC are PERMANENT:**
- Never deleted by cleanup commands
- Never deleted by any automated process
- Never deleted even if bot is reset
- Never deleted under any circumstances
- Stored in dedicated WALL_OF_FAME_TOPIC_ID topic within the group
- Topic messages are tracked separately from main group

#### Tracking System

**Wall of Fame messages are tracked separately:**
```javascript
// File: src/bot/handlers/group/wallOfFame.js
const wallOfFameMessageIds = new Map();
// topicId => Set<messageId>
// Example: 3132 => Set<messageId1, messageId2, ...>
```

**Each message gets tagged:**
- `trackWallOfFameMessage(topicId, messageId)` - Marks as permanent
- `isWallOfFameMessage(topicId, messageId)` - Checks if protected
- `getWallOfFameMessages()` - Returns all protected messages

#### What Happens When User Posts Photo/Video:

```
1. User posts photo/video in main GROUP topic
                ↓
2. Bot detects (via 'photo'/'video' event)
                ↓
3. Bot posts to Wall of Fame TOPIC (3132) with member info
                ↓
4. Message in Wall of Fame topic is TRACKED as permanent ♾️
                ↓
5. Bot deletes ORIGINAL in main GROUP (prevents duplicate)
                ↓
6. Bot sends DM confirmation to member
                ↓
7. Wall of Fame topic copy SURVIVES FOREVER in topic 3132
```

---

### 3. Group Command Restriction

#### What Gets Deleted ✅
- All non-`/menu` commands in group chat
- User messages containing `/start`, `/help`, `/admin`, etc.

#### What Gets Deleted (Bot Response) ✅
- Bot's restriction reply: "Only /menu command is allowed in this group."
- Auto-deleted after 30 seconds

#### What Survives ✨
- `/menu` command and responses
- User regular messages (non-commands)

---

### 4. Auto-Moderation Filters

#### What Gets Deleted ✅
- Messages with spam content (if SPAM filter enabled)
- Messages with profanity (if PROFANITY filter enabled)
- Messages with unauthorized links (if LINKS filter enabled)
- Command messages (if restriction enabled)

#### Warnings Issued
- User receives warning before ban
- Warnings logged in moderation system
- 3 strikes = user ban

---

## Implementation Files

### Core Files Modified:

1. **`src/bot/handlers/admin/index.js`**
   - `/cleanupcommunity` command
   - Detailed deletion reporting
   - Exception handling

2. **`src/bot/handlers/group/wallOfFame.js`**
   - Wall of Fame posting
   - Message tracking (permanent)
   - DM confirmations

3. **`src/bot/core/middleware/groupCommandRestriction.js`**
   - Group command filtering
   - Auto-reply with 30-second auto-delete

4. **`src/config/moderationConfig.js`**
   - Auto-moderation filter configuration
   - Profanity blacklist

---

## Visual Deletion Map

```
COMMUNITY GROUP:
├─ User Messages
│  └─ NOT deleted ✓
├─ Photos/Videos from Users
│  ├─ Forwarded to Wall of Fame (marked PERMANENT)
│  └─ Original deleted (prevents duplicate) ✓
├─ Bot Messages
│  ├─ Before cleanup: ALL deleted ✓
│  ├─ After cleanup: ONLY most recent kept ✨
│  └─ Exception: Wall of Fame links never deleted ♾️
└─ Commands in Group
   ├─ /menu: Allowed ✓
   └─ Others: Deleted ✓

WALL OF FAME CHANNEL:
├─ Photos/Videos with Member Info
│  └─ NEVER deleted - PERMANENT ♾️
├─ Message Metadata
│  ├─ trackWallOfFameMessage() - Marks as permanent
│  ├─ isWallOfFameMessage() - Checks protection
│  └─ getWallOfFameMessages() - Lists protected messages
└─ Protection Level
   └─ Survives ALL cleanup commands ♾️
```

---

## Cleanup Command Behavior

### Command: `/cleanupcommunity`

**Example Output:**

```
Status Message (in group):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 Cleaning bot messages in community...

⚠️ Note: Only bot messages are deleted
✨ Wall of Fame photos and videos are NEVER deleted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(After completion)

✅ Cleanup completed

📊 Statistics:
• Bot messages deleted: 47
• Current message: ✨ Kept (most recent)

🛡️ Exceptions:
• Wall of Fame: NEVER deleted ♾️
• Photos/Videos: Permanent on Wall ♾️
• Only previous bot messages: Deleted
```

---

## Database Schema

### Wall of Fame Tracking Table (Optional - Currently In-Memory)

If implemented in database:

```sql
CREATE TABLE wall_of_fame_messages (
  id SERIAL PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username VARCHAR(255),
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletion_protected BOOLEAN DEFAULT TRUE,
  UNIQUE(channel_id, message_id)
);

CREATE INDEX idx_wof_channel ON wall_of_fame_messages(channel_id);
CREATE INDEX idx_wof_protected ON wall_of_fame_messages(deletion_protected);
```

Current implementation uses in-memory tracking:
```javascript
// src/bot/handlers/group/wallOfFame.js
const wallOfFameMessageIds = new Map();
// Resets on bot restart
// For persistence, migrate to database if needed
```

---

## Safety Features

### Protection Mechanisms

1. **Separate Tracking Systems**
   - Wall of Fame messages tracked in `wallOfFameMessageIds`
   - Group bot messages tracked in `ChatCleanupService`
   - No overlap or confusion

2. **Explicit Protection**
   - `trackWallOfFameMessage()` called for each Wall of Fame post
   - Check `isWallOfFameMessage()` before deletion

3. **Logging**
   - All deletions logged with reason
   - Wall of Fame posts marked as "(PERMANENT)"
   - Cleanup operations logged with full statistics

4. **Exceptions Documented**
   - Code comments explain why messages are kept
   - Logs show deletion exceptions
   - Admin gets detailed feedback

---

## Configuration

### Environment Variables Required

```env
# Community Group
GROUP_ID=-1003291737499

# Wall of Fame Channel (CRITICAL: Must be different from GROUP_ID)
WALL_OF_FAME_CHANNEL_ID=-1001234567890

# Support Group (optional)
SUPPORT_GROUP_ID=-1003365565562
```

### Important: Channel IDs Must Be Different

- `GROUP_ID` = Community group for discussions
- `WALL_OF_FAME_CHANNEL_ID` = Separate channel for photos/videos
- They MUST be different channels!

---

## Testing Checklist

- [ ] `/cleanupcommunity` deletes old bot messages
- [ ] `/cleanupcommunity` keeps only most recent message
- [ ] Wall of Fame photos are not affected by cleanup
- [ ] User posts photo → appears in Wall of Fame
- [ ] Original photo deleted from group (no duplicate)
- [ ] Wall of Fame shows member profile info
- [ ] Member receives DM confirmation
- [ ] Non-`/menu` commands deleted in group
- [ ] Only `/menu` command works in group
- [ ] Spam/profanity/flood filters work correctly

---

## FAQ

**Q: What happens to Wall of Fame if bot restarts?**
A: Currently in-memory. On restart, tracking is lost. Migrate to database for persistence.

**Q: Can admins still delete Wall of Fame messages?**
A: Technicallyyes, but code prevents bot from deleting them. Manual admin deletion is possible.

**Q: What if /cleanupcommunity is run repeatedly?**
A: First run deletes all old messages except most recent. Subsequent runs have fewer messages to delete.

**Q: Do Wall of Fame messages get moved?**
A: No, they stay in their original location in the Wall of Fame channel.

**Q: What about edited messages in Wall of Fame?**
A: Edits are allowed. The message itself is never deleted.

---

## Future Enhancements

1. **Database Persistence**
   - Store Wall of Fame tracking in database
   - Survive bot restarts

2. **Wall of Fame Leaderboard**
   - Track most featured members
   - Monthly/yearly rankings

3. **Member Profile Updates**
   - Let users edit social media links
   - Update Wall of Fame captions

4. **Archival System**
   - Option to archive old Wall of Fame messages
   - Keep searchable but hidden

---

Last Updated: January 5, 2026
Version: 1.0 (Final with Deletion Exceptions)
