# Global Ban System Documentation

## Overview
The global ban system allows administrators to ban users from all groups and channels managed by the bot simultaneously.

## Features

### 1. **Global Ban a User**
**Command:** `/globalban [reason]`

**Usage:**
- Reply to a user's message in a group with `/globalban Suspicious activity`

**Effect:**
- User is instantly removed from the current group
- User is added to the global ban list (using special group ID: `GLOBAL`)
- User cannot send messages in any group managed by this bot
- All messages from globally banned users are automatically deleted

**Example:**
```
Admin replies to user's message: /globalban Multiple username changes - evasion attempt
```

**Result:**
```
🌍 **Username** has been **GLOBALLY BANNED**.

Reason: Multiple username changes - evasion attempt

⚠️ This user is now blocked from all groups and channels using this bot.
```

---

### 2. **Unban a Globally Banned User**
**Command:** `/globalunban`

**Usage:**
- Reply to a user's message in a group with `/globalunban`

**Effect:**
- User is removed from the global ban list
- User can now participate in groups again

**Example:**
```
Admin replies to banned user's message: /globalunban
```

**Result:**
```
✅ **Username** has been **GLOBALLY UNBANNED**.

This user can now access all groups and channels again.
```

---

### 3. **View All Globally Banned Users**
**Command:** `/globalbans`

**Usage:**
- Type `/globalbans` in any group where you're an admin

**Effect:**
- Shows list of all globally banned users
- Displays ban reason, date, and admin who applied the ban

**Result:**
```
🌍 **Globally Banned Users**

📊 **Total:** 5 users

**1.** User ID: 6214060483
   📅 Banned: 11/22/2025, 1:17:51 PM
   📝 Reason: Multiple username changes - evasion attempt
   👤 By: Admin ID 123456

**2.** User ID: 987654321
   📅 Banned: 11/21/2025, 2:45:30 PM
   📝 Reason: Spam and harassment
   👤 By: Admin ID 123456
```

---

## How It Works

### Database Implementation
- **Table:** `banned_users`
- **Special Group ID:** `GLOBAL` is used to mark records as globally banned
- **Structure:**
  ```sql
  user_id        VARCHAR(255)    - User's Telegram ID
  group_id       VARCHAR(255)    - 'GLOBAL' for global bans, or specific group ID
  reason         TEXT            - Ban reason
  banned_by      VARCHAR(255)    - Admin who applied the ban
  banned_at      TIMESTAMP       - When the ban was applied
  ```

### Enforcement Process
1. **Message Check:** When a user sends a message in any group:
   - The `moderationFilter` middleware checks if user is globally banned
   - Query: `SELECT 1 FROM banned_users WHERE user_id = $1 AND group_id = 'GLOBAL'`
   
2. **Automatic Action:** If globally banned:
   - Message is deleted
   - User is kicked from the group
   - No further processing occurs

3. **Admin Override:** Administrators can still use commands but cannot send regular messages if globally banned

---

## Admin Case Study: User 6214060483 (Xavi)

### Alert Details
```
🚨 Suspicious Username Change

👤 User: Xavi (ID: 6214060483)
📝 Old: @Anonymous
📝 New: @none
📅 When: 11/22/2025, 1:17:51 PM

⚠️ This user has changed their username multiple times in the last 24 hours.
This could indicate evasion attempts.
```

### Recommended Action
```bash
# 1. Review user history
/userhistory 6214060483

# 2. If suspicious activity confirmed, globally ban
/globalban Suspicious activity - Multiple username changes indicating evasion attempt

# 3. View result in global bans list
/globalbans
```

### Result
```
🌍 **Xavi** has been **GLOBALLY BANNED**.

Reason: Suspicious activity - Multiple username changes indicating evasion attempt

⚠️ This user is now blocked from all groups and channels using this bot.
```

---

## Technical Details

### Files Modified
1. **src/bot/handlers/moderation/adminCommands.js**
   - Added: `handleGlobalBan()`
   - Added: `handleGlobalUnban()`
   - Added: `handleViewGlobalBans()`
   - Registered commands: `/globalban`, `/globalunban`, `/globalbans`

2. **src/bot/core/middleware/moderationFilter.js**
   - Added global ban check before regular message processing
   - Automatically removes globally banned users from groups

### Models Used
- `ModerationModel.banUser()` - Creates ban record
- `ModerationModel.unbanUser()` - Removes ban record
- `ModerationModel.isUserBanned()` - Checks if user is banned
- `ModerationModel.getBannedUsers()` - Lists all banned users

---

## Usage Restrictions

### Who Can Use?
- ✅ Group creators
- ✅ Group administrators
- ❌ Regular members
- ❌ Bots

### Where?
- ✅ Groups
- ✅ Supergroups
- ❌ Private chats
- ❌ Channels (not directly, but affects group behavior)

### Limitations
- Cannot be used in private chats
- Requires admin privileges in the current group
- Must reply to a user's message or provide user ID
- User must have sent at least one message to be visible in the group

---

## Security Features
- Only admins can execute global ban commands
- Actions are logged with admin ID and timestamp
- Global bans are persistent (stored in database)
- Cannot be revoked by the banned user
- Applies instantly across all groups

---

## Monitoring & Logs
All global ban actions are logged:
```javascript
logger.info('User globally banned by admin', {
  adminId: 123456789,
  targetUserId: 6214060483,
  reason: 'Suspicious activity - Multiple username changes indicating evasion attempt',
});

logger.info('User globally unbanned by admin', {
  adminId: 123456789,
  targetUserId: 6214060483,
});
```

---

## Future Enhancements
1. **Appeals System** - Allow banned users to appeal through bot DM
2. **Temporary Bans** - Ban for specific duration (24h, 7d, 30d)
3. **Ban Levels** - Different ban severity levels
4. **Ban Statistics** - Dashboard showing ban trends
5. **Automatic Ban** - Based on flagged username changes or other criteria
