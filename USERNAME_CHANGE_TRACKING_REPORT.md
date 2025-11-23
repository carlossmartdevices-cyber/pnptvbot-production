# Username Change Tracking Report
**Generated:** November 23, 2025  
**System:** PNPtv Bot - Telegram Moderation Bot

---

## Executive Summary

The PNPtv Bot has a comprehensive **username change tracking system** implemented to monitor, log, and flag suspicious username changes across all groups where the bot operates. This system helps identify potential ban evasion, impersonation, or other malicious activities.

---

## System Architecture

### 1. **Detection & Enforcement Middleware**
**File:** `src/bot/core/middleware/usernameEnforcement.js`

This middleware automatically:
- Detects username changes in real-time when users interact in groups
- Compares current username with last known username from database
- Records all changes to the `username_history` table
- Enforces username requirements (non-admins must have a username)
- Blocks messages from users without usernames
- Notifies support group of suspicious changes

**Key Features:**
```javascript
// Automatic detection on every message
if (lastKnownUsername !== currentUsername) {
  await handleUsernameChange(ctx, userId, lastKnownUsername, currentUsername, groupId);
  await UserModel.updateProfile(userId, { username: currentUsername || '' });
}
```

---

### 2. **Database Schema**
**Table:** `username_history`

```sql
CREATE TABLE IF NOT EXISTS username_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username VARCHAR(255),          -- Previous username (null if first time)
  new_username VARCHAR(255),          -- New username (null if removed)
  group_id VARCHAR(255),              -- Group where change was detected
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  flagged BOOLEAN DEFAULT FALSE,      -- Marked as suspicious
  flagged_by VARCHAR(255),            -- Admin who flagged it
  flagged_at TIMESTAMP,               -- When it was flagged
  flag_reason TEXT                    -- Reason for flagging
);
```

**Indexes for Performance:**
- `idx_username_history_user_id` - Fast user lookup
- `idx_username_history_group_id` - Fast group lookup
- `idx_username_history_changed_at` - Time-based queries
- `idx_username_history_flagged` - Quick flagged records access

---

### 3. **Recording & Storage**
**File:** `src/models/moderationModel.js`

**Method:** `recordUsernameChange(userId, oldUsername, newUsername, groupId)`

```javascript
static async recordUsernameChange(userId, oldUsername, newUsername, groupId = null) {
  // Records change to username_history table
  // Also logs to moderation_logs table
  // Returns record ID for reference
}
```

**Additional Methods:**
- `getUsernameHistory(userId, limit)` - Get all changes for a specific user
- `getRecentUsernameChanges(groupId, limit)` - Get recent changes in a group
- `hasRecentUsernameChange(userId, hours)` - Check for changes within timeframe
- `flagUsernameChange(recordId, flaggedBy, reason)` - Flag suspicious changes

---

## Detection & Alert System

### Suspicious Activity Detection

The system automatically flags users who:
1. **Change username multiple times within 24 hours**
2. **Rapidly switch between usernames** (potential evasion)
3. **Remove and re-add usernames repeatedly**

### Admin Notification

When suspicious activity is detected:
```javascript
// Sends alert to support group
🚨 **Suspicious Username Change**

👤 **User:** John Doe (ID: 123456789)
👥 **Group:** PNPtv Main
📝 **Old:** @oldusername
📝 **New:** @newusername
📅 **When:** 11/23/2025, 9:00 AM

⚠️ This user has changed their username multiple times in the last 24 hours.
This could indicate evasion attempts.

Use /userhistory 123456789 to see full history.
```

---

## Admin Commands

### `/usernamechanges [limit]`
**Usage:** `/usernamechanges 20`  
**Description:** View recent username changes in the current group  
**Permission:** Group administrators only  
**File:** `src/bot/handlers/moderation/adminCommands.js`

**Output Example:**
```
📋 **Recent Username Changes**

📊 Last 20 changes:

**1.** User ID: 123456789
   11/20/2025: @john_old → @john_new

**2.** User ID: 987654321
   11/21/2025: @alice123 → @alice_new
   🚩 FLAGGED

**3.** User ID: 555555555
   11/22/2025: none → @newuser

Use /userhistory <user_id> to see full history for a specific user.
```

### `/userhistory <user_id>`
**Usage:** `/userhistory 123456789`  
**Description:** View complete username change history for a specific user  
**Permission:** Group administrators only

**Output includes:**
- All username changes chronologically
- Dates and times of each change
- Groups where changes were detected
- Flagged status and reasons
- Total change count and frequency

---

## Use Cases & Benefits

### 1. **Ban Evasion Detection**
When a banned user:
- Gets banned → Changes username → Rejoins group
- System tracks: `@bad_user` → `null` → `@good_user`
- Admins can see the pattern and take action

### 2. **Impersonation Prevention**
When someone tries to impersonate:
- Changes from `@john123` → `@admin_john` (looks like admin)
- System alerts admins of the suspicious change
- Can cross-reference with actual admin usernames

### 3. **Spam/Scam Account Detection**
Scammers often:
- Rapidly change usernames to avoid detection
- Use temporary usernames for spam campaigns
- System flags accounts with frequent changes (>3 in 24h)

### 4. **Historical Analysis**
Admins can:
- Review user behavior patterns over time
- Identify coordinated attacks (multiple users changing at same time)
- Build reputation profiles based on username stability

### 5. **Compliance & Audit Trail**
- Complete audit trail of all username changes
- Helps with dispute resolution
- Provides evidence for appeals/bans

---

## Integration Points

### Automatic Tracking Happens On:
1. **Every group message** - Middleware checks username
2. **User joins group** - Initial username recorded
3. **Profile updates** - Manual detection
4. **Bot interactions** - Any command execution

### Data Flow:
```
User sends message 
  → usernameEnforcement middleware
  → Compare with database
  → If changed: Record to username_history
  → Update users table
  → Check for suspicious patterns
  → Notify admins if flagged
```

---

## Statistics & Metrics

### Trackable Metrics:
- Total username changes system-wide
- Changes per user (frequency)
- Changes per group (activity level)
- Flagged changes percentage
- Changes in last 24h/7d/30d
- Most active users (frequent changers)
- Peak times for changes

### Example Query for Stats:
```sql
-- Users with most changes
SELECT user_id, COUNT(*) as change_count
FROM username_history
GROUP BY user_id
ORDER BY change_count DESC
LIMIT 10;

-- Changes in last 24 hours
SELECT COUNT(*) FROM username_history
WHERE changed_at > NOW() - INTERVAL '24 hours';

-- Flagged changes ratio
SELECT 
  COUNT(*) FILTER (WHERE flagged = true) as flagged,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE flagged = true) * 100.0 / COUNT(*)) as percentage
FROM username_history;
```

---

## Configuration

### Environment Variables:
```bash
SUPPORT_GROUP_ID="-100xxxxxxxxxx"  # Where to send suspicious change alerts
```

### Username Enforcement Rules:
- ✅ Admins: Can have no username
- ❌ Regular users: Must have username in groups
- ⚠️ Messages deleted if no username
- 📨 Private warning sent to user

---

## Technical Implementation Details

### Performance Optimizations:
1. **In-memory cache** - Reduces database queries for repeated checks
2. **Indexed queries** - Fast lookups by user_id, group_id, timestamp
3. **Batch processing** - Efficient handling of multiple changes
4. **Async operations** - Non-blocking detection and recording

### Error Handling:
- Graceful degradation if database unavailable
- Allows messages through on middleware errors
- Logs all errors for debugging
- Retry logic for failed recordings

### Privacy & Data Retention:
- Only usernames are stored (no message content)
- Linked to user_id for tracking
- Cascade delete when user deleted
- Can implement retention policies (e.g., 90 days)

---

## Running the Report Script

### Manual Report Generation:
```bash
# Generate full username change report
node scripts/username-change-report.js

# The script provides:
# - Total changes count
# - Recent changes (last 50)
# - Users with multiple changes
# - Changes by time period (24h, 7d, 30d)
# - Flagged changes statistics
# - Changes by group breakdown
```

### Report Output Includes:
- 📊 Total changes recorded
- 📋 Recent changes list with details
- 🔄 Users with multiple changes (top 20)
- 🕐 Time-based breakdowns
- 🚩 Flagged changes analysis
- 👥 Changes by group ranking
- 📈 Summary statistics

---

## Future Enhancements

### Potential Features:
1. **Machine Learning Detection** - AI-powered suspicious pattern detection
2. **Automated Responses** - Auto-flag/warn based on change frequency
3. **Cross-Group Analysis** - Detect users changing across multiple groups
4. **Username History API** - REST endpoint for external tools
5. **Export Functionality** - CSV/JSON exports for analysis
6. **Real-time Dashboard** - Web interface for monitoring
7. **Webhook Notifications** - External system integration

---

## Conclusion

The username change tracking system provides:
- ✅ **Comprehensive monitoring** of all username changes
- ✅ **Automatic detection** in real-time
- ✅ **Suspicious pattern identification**
- ✅ **Complete audit trail** for compliance
- ✅ **Admin tools** for investigation
- ✅ **Scalable architecture** for growth

This system is actively protecting all groups where the PNPtv Bot operates, providing a critical layer of security and moderation capability.

---

## Support & Documentation

**Related Files:**
- `src/bot/core/middleware/usernameEnforcement.js` - Detection logic
- `src/models/moderationModel.js` - Database operations
- `src/bot/handlers/moderation/adminCommands.js` - Admin commands
- `database/migrations/missing_tables_schema.sql` - Database schema

**Admin Commands:**
- `/usernamechanges` - View recent changes
- `/userhistory <id>` - View user history
- `/flag <record_id> <reason>` - Flag a change as suspicious

**For Questions:** Contact system administrators or review the codebase documentation.

---

*Report generated by automated analysis of PNPtv Bot codebase*
