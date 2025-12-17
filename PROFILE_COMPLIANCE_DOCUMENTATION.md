# Profile Compliance System - Complete Documentation

## Overview

The Profile Compliance System enforces strict profile requirements for all group members:
- ✅ Must have a Telegram @username
- ✅ First and last names must use Latin alphabet ONLY (no Russian, Arabic, Chinese, etc.)

Non-compliant users receive:
1. **Immediate private message** with warning and compliance steps
2. **Public group notification** about the issue
3. **48-hour deadline** to fix their profile
4. **Automatic removal** if deadline passes without compliance

---

## System Components

### 1. Database Table: `profile_compliance`

Tracks compliance status for each user in each group:

```sql
CREATE TABLE profile_compliance (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),              -- User's Telegram ID
  group_id VARCHAR(255),              -- Group ID
  username_valid BOOLEAN,             -- @username present
  name_valid BOOLEAN,                 -- Latin characters only
  compliance_issues TEXT[],           -- Array of issues detected
  warning_sent_at TIMESTAMP,          -- When warning was sent
  warning_count INTEGER,              -- Number of warnings
  purge_deadline TIMESTAMP,           -- Automatic removal date
  purged BOOLEAN,                     -- Was user removed?
  purged_at TIMESTAMP,                -- When removed
  compliance_met_at TIMESTAMP,        -- When user became compliant
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### 2. Middleware: `profileCompliance.js`

Runs on every message in groups:

1. **Check Profile**: Validates username and name
2. **Detect Issues**: Identifies non-compliant profiles
3. **Send Warnings**: First-time detection triggers notification
4. **Block Messages**: Non-compliant users' messages are deleted
5. **Auto-Purge**: After 48 hours, removes non-compliant users

### 3. Admin Commands

#### `/noncompliant`
View all non-compliant users in current group with remaining time until purge.

```
⚠️ **Non-Compliant Users**

📊 **Total:** 5 users

**1.** User ID: 123456789
   ⏰ Warned: 11/22/2025, 2:30 PM
   ⏳ Hours remaining: 42h
   ❌ Issues: no_username, non_latin_characters
```

#### `/sendcompliancewarnings`
Manually broadcast compliance requirements to all members.

```
📋 **Profile Compliance Requirements**

All members must have:
✅ A Telegram username (@username)
✅ Name in Latin alphabet (English characters only)

How to update:
1. Open Telegram Settings
2. Tap "Edit Profile"
3. Set your first name in English
4. Set your username (@username)

⏰ Deadline: 48 hours
```

#### `/purgenoncompliant`
Manually remove all non-compliant users (admin override).

---

## User Experience

### For Regular Users

**Stage 1: Detection (When they send first message)**

📧 **Private Message:**
```
⚠️ **Profile Compliance Warning**

Your profile does not meet requirements in GROUP_NAME:

❌ No Username: You must set a Telegram username (@username)
❌ Invalid Name: Your first/last name contains non-Latin characters

⏰ You have 48 hours to update your profile

How to update:
1. Open Telegram Settings
2. Tap "Edit Profile"
3. Set your first name in English
4. Set your username (@username)
5. Return to the group

After you update, your profile will be re-checked automatically.
```

💬 **Group Notification:**
```
⚠️ **Profile Compliance Warning**

👤 **USERNAME** - Your profile does not meet our requirements.

❌ No Username: You must set a Telegram username (@username)

You have 48 hours to update your profile

Please set:
• A Telegram username (@username)
• Your name in Latin alphabet (English characters)

If not corrected within 48 hours, you will be removed.
```

---

**Stage 2: Message Blocking (During 48-hour period)**
- ❌ User's messages are automatically deleted
- ℹ️ User receives no feedback (prevents spam)
- ✅ User can still see group messages
- ✅ User can still use bot commands

---

**Stage 3: Auto-Purge (After 48 hours if non-compliant)**
```
🚫 **Profile Compliance Purge**

User automatically kicked from group

Admin receives notification:
🚫 **Profile Compliance Purge**

👤 **USERNAME** (ID: 123456789)
Has been automatically removed from the group.

Reason: Non-compliant profile (not corrected within 48 hours)

Issues:
❌ No Username
❌ Invalid Name
```

---

## Compliance Rules

### What Characters Are Allowed?

✅ **Allowed:**
- English letters: A-Z, a-z
- Numbers: 0-9
- Common punctuation: hyphen (-), apostrophe ('), period (.)
- Spaces (but not at start/end)

Examples of **VALID** names:
- John Smith
- Marie-Claude
- O'Brien
- Jean-Paul

❌ **NOT Allowed:**
- Russian: Иван, Сергей, Татьяна
- Arabic: محمد, فاطمة
- Chinese: 王, 李
- Hebrew: יוסף
- Greek: Αλέξανδρος
- Cyrillic: Борис
- Japanese: 太郎

Examples of **INVALID** names:
- Иванов (Russian)
- محمود (Arabic)
- 林小龙 (Chinese)
- Боб (Cyrillic)

### Username Requirements

- Must have exactly ONE username
- Must start with @
- Can be 5-32 characters
- Can contain: a-z, 0-9, underscore (_)
- Examples: @john_smith, @marie2024, @user123

---

## Implementation Details

### Validation Logic

```javascript
function checkCompliance(username, firstName, lastName) {
  const issues = [];
  
  // Check 1: Username required
  if (!username) {
    issues.push('no_username');
  }
  
  // Check 2: Names must be Latin alphabet only
  const fullName = `${firstName} ${lastName}`.trim();
  const latinRegex = /^[a-zA-Z0-9\s\-'.\s]+$/;
  
  if (fullName && !latinRegex.test(fullName)) {
    issues.push('non_latin_characters');
  }
  
  return issues; // Empty if compliant
}
```

### Timeline

```
T+0:00    User sends message (non-compliant)
          ↓
          Detected by middleware
          ↓
          Warning sent (DM + Group notification)
          ↓
          Record created with deadline
          ↓
          User's message deleted

T+0:01    User can still see group (messages deleted though)
to        User needs to update profile within 48 hours
T+48:00   Each message triggers deletion

T+48:00   Deadline passes
          ↓
          Automatic removal check triggers
          ↓
          User kicked from group
          ↓
          Admins notified
          ↓
          Record marked as purged
```

---

## Admin Management

### Daily Tasks

**Check non-compliance status:**
```
/noncompliant
```

**Review users about to be purged:**
```
# Manually purge if needed
/purgenoncompliant
```

### Configuration

No configuration needed! System is automatic with:
- 48-hour warning window (hardcoded)
- Latin alphabet validation (regex-based)
- Auto-purge on deadline (middleware-based)

### Logs

All compliance actions logged to `moderation_logs`:

```
action: 'compliance_warning_sent'
userId: '123456789'
groupId: '-1001234567890'
reason: 'Non-compliant profile'
details: 'no_username, non_latin_characters'

action: 'profile_compliance_purge'
userId: '123456789'
groupId: '-1001234567890'
reason: 'Non-compliant profile after 48-hour deadline'
details: 'Issues: no_username, non_latin_characters'
```

---

## Edge Cases

### Admins and Bots
- ✅ Admins and group creators bypass compliance checks
- ✅ Bots are never checked
- ✅ They can have any name/username

### User Updates Profile During Warning Period
When user updates profile:
1. Next message triggers new check
2. If compliant now → record marked as `compliance_met_at`
3. Message goes through normally
4. No purge happens

### User Updates AFTER Deadline
If deadline passes but user wasn't kicked yet:
1. Automatic removal still triggers
2. User is kicked and marked as purged
3. Cannot rejoin without admin invite

### Rejoining After Purge
- ⚠️ User cannot rejoin group (normal Telegram behavior)
- ✅ Can be manually added back by admin
- ✅ Same compliance check applies if rejoins

---

## Files Modified/Created

### New Files
- ✅ `src/bot/core/middleware/profileCompliance.js` - Enforcement middleware

### Modified Files
- ✅ `database/migrations/missing_tables_schema.sql` - Added `profile_compliance` table
- ✅ `src/bot/core/bot.js` - Registered middleware
- ✅ `src/bot/handlers/moderation/adminCommands.js` - Added 3 commands
- ✅ `src/models/moderationModel.js` - Added compliance methods

---

## Database Migration

Required SQL migration:

```sql
CREATE TABLE profile_compliance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  group_id VARCHAR(255) NOT NULL,
  username_valid BOOLEAN DEFAULT FALSE,
  name_valid BOOLEAN DEFAULT FALSE,
  compliance_issues TEXT[],
  warning_sent_at TIMESTAMP,
  warning_count INTEGER DEFAULT 0,
  purge_deadline TIMESTAMP,
  purged BOOLEAN DEFAULT FALSE,
  purged_at TIMESTAMP,
  compliance_met_at TIMESTAMP,
  last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

CREATE INDEX idx_profile_compliance_user_id ON profile_compliance(user_id);
CREATE INDEX idx_profile_compliance_group_id ON profile_compliance(group_id);
CREATE INDEX idx_profile_compliance_purge_deadline ON profile_compliance(purge_deadline);
CREATE INDEX idx_profile_compliance_purged ON profile_compliance(purged);

CREATE TRIGGER update_profile_compliance_updated_at 
BEFORE UPDATE ON profile_compliance 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Performance Considerations

- ✅ Middleware runs on every message (indexed queries)
- ✅ Single database query per message (efficient)
- ✅ Cached compliance checks (via middleware)
- ✅ Batch processing for deadline checks
- ⚠️ Purge operations may take time with many users

---

## Security Features

✅ **Admin-only commands** - Only group admins can manage
✅ **Logged actions** - All compliance events recorded
✅ **Reversible** - Users can re-join and re-comply
✅ **Graceful failures** - Errors don't block bot
✅ **No bypassing** - Message deletion is automatic
✅ **Audit trail** - Full compliance history tracked

---

## Troubleshooting

### Issue: User profile not being re-checked after update
**Solution:** User must send a message to trigger re-check

### Issue: User not receiving private warning
**Solution:** User may have blocked bot or disabled DMs. Group notification still sent.

### Issue: User not getting kicked after deadline
**Solution:** Check logs. May need manual `/purgenoncompliant` or bot permission issue.

### Issue: Latin alphabet validation too strict
**Solution:** Modify regex in `profileCompliance.js` line 129

### Issue: 48-hour deadline too short/long
**Solution:** Modify deadline calculation in `createComplianceRecord()` function

---

## Future Enhancements

- [ ] Whitelist specific Cyrillic users
- [ ] Grace period extension for special users
- [ ] Bulk compliance report generation
- [ ] Integration with admin appeals system
- [ ] Custom compliance messages per group
- [ ] Gradual enforcement (warnings → blocks → kicks)

---

## Quick Reference

| Command | Purpose | Usage |
|---------|---------|-------|
| `/noncompliant` | View non-compliant users | Groups only, admins only |
| `/sendcompliancewarnings` | Broadcast requirements | Groups only, admins only |
| `/purgenoncompliant` | Manual override removal | Groups only, admins only |

| Event | Action | Notification |
|-------|--------|--------------|
| Detection | Send warnings | Private + Group |
| Message sent | Delete message | Silent (no response) |
| Deadline passed | Kick user | Admin DM |
| Profile fixed | Clear compliance record | Silent |

---

**System Status:** ✅ ACTIVE AND ENFORCING
**Version:** 1.0
**Last Updated:** November 22, 2025
