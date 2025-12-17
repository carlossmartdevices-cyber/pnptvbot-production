# Profile Compliance System - Quick Start

## What Is It?

Automatic enforcement system that requires all group members to have:
1. ✅ A Telegram **@username**
2. ✅ Names in **Latin alphabet only** (no Russian, Arabic, Chinese, etc.)

Non-compliant users get 48 hours to fix, then auto-removed.

---

## Admin Commands

### View Non-Compliant Users
```
/noncompliant
```

Shows all users not meeting requirements with time until auto-removal.

### Broadcast Compliance Rules
```
/sendcompliancewarnings
```

Send group message with requirements and how to update.

### Force Remove Non-Compliant Users
```
/purgenoncompliant
```

Manually kick all non-compliant users immediately (admin override).

---

## User Requirements

### ✅ Must Have

- **Username**: @yourname (5-32 characters, letters/numbers/underscore)
- **Name**: English letters only (A-Z, a-z, 0-9, spaces, hyphens, apostrophes)

### ✅ Valid Examples

- Username: @john_smith, @user123, @marie_2024
- Name: John Smith, Marie-Claude, O'Brien

### ❌ NOT Allowed

- Username: None (blank)
- Name with: Russian (Иван), Arabic (محمد), Chinese (王), Hebrew, Greek, etc.

---

## Timeline

| When | What Happens |
|------|--------------|
| **User sends message** | System checks profile |
| **Not compliant?** | Warning sent (DM + group) |
| **Next 48 hours** | User's messages deleted automatically |
| **After 48 hours** | User automatically kicked from group |

---

## What Users See

**Private Message:**
```
⚠️ Your profile doesn't meet requirements

You need:
❌ A username (@username)
❌ Name in English only

⏰ You have 48 hours to fix

How:
1. Telegram Settings
2. Edit Profile
3. Set username & English name
4. Return to group
```

**Group Notification:**
```
⚠️ USERNAME - Your profile doesn't meet requirements

You have 48 hours to update

If not fixed: You will be removed
```

---

## What Admins See

When viewing non-compliant users:
```
⚠️ **Non-Compliant Users** (5 total)

1. User ID: 123456789
   ⏰ Warned: 11/22/2025, 2:30 PM
   ⏳ 42 hours remaining
   ❌ Issues: no_username, non_latin_characters

2. User ID: 987654321
   ⏰ Warned: 11/22/2025, 3:15 PM
   ⏳ 40 hours remaining
   ❌ Issues: non_latin_characters
```

---

## Settings

Everything is automatic! No configuration needed:

- ✅ 48-hour deadline (hardcoded)
- ✅ Latin alphabet only (regex validated)
- ✅ Auto-remove on deadline (middleware-based)
- ✅ Auto-warn on detection (immediate)

---

## Special Cases

**Admins and Bots:** Bypass all checks (no compliance required)

**User Fixes Profile:** Next message triggers re-check, becomes compliant

**User Removed:** Cannot rejoin unless invited by admin

---

## Characters Allowed in Names

### ✅ Yes
```
A-Z, a-z, 0-9
Spaces, hyphens (-), apostrophes (')
```

### ❌ No
```
Russian: Иван, сергей
Arabic: محمد, فاطمة
Chinese: 王, 李
Hebrew: יוסף
Greek: Αλέξανδρος
Cyrillic: Борис
Japanese: 太郎
Korean: 김철수
```

---

## Workflow Example

**Admin:** "We need to enforce Latin alphabet only"

**Action:**
```
/sendcompliancewarnings
```

**Result:**
- Compliance broadcast sent to group
- Existing non-compliant users warned
- 48-hour timer starts
- Non-compliant messages auto-deleted

**After 48 hours:**
```
/noncompliant
```

**Result:**
- Shows users still not compliant
- Admin can manually remove with `/purgenoncompliant`
- Or wait for auto-removal to happen

---

## Troubleshooting

**Q: User says they didn't get warning**
A: Check if they have DMs enabled. Group notification still sent.

**Q: User fixed profile but still can't send messages**
A: They need to send one more message to trigger re-check.

**Q: Why was user kicked?**
A: Run `/noncompliant` to check. Likely deadline passed without compliance.

**Q: How to undo a removal?**
A: Admins can manually re-invite user to group.

---

## Key Features

✅ **Automatic** - No manual intervention needed
✅ **Enforcement** - Messages deleted until compliant
✅ **Fair** - 48-hour warning period given
✅ **Reversible** - Users can rejoin if they fix profile
✅ **Audited** - All actions logged
✅ **Admin Control** - Manual override available

---

## Database

System uses PostgreSQL table: `profile_compliance`

Tracks:
- User ID & Group ID
- Compliance status
- Issues found
- Warning date
- Removal date
- Compliance date

---

**Status:** ✅ ACTIVE
**Version:** 1.0
**Last Updated:** November 22, 2025
