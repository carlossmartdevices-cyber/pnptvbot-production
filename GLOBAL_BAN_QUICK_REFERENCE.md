# Global Ban System - Quick Reference

## 🚀 Quick Commands

### Ban a User Globally
```
Reply to user's message:
/globalban Reason for banning this user
```

### Unban a User
```
Reply to banned user's message:
/globalunban
```

### View All Global Bans
```
/globalbans
```

---

## 📋 Use Cases

### Case 1: Suspicious Username Changes (User 6214060483 - Xavi)
```bash
# 1. Check history
/userhistory 6214060483

# 2. If suspicious, ban globally
/globalban Multiple username changes in 24 hours - Possible evasion

# 3. Confirm in ban list
/globalbans
```

### Case 2: Spam/Abuse
```
/globalban Persistent spam and harassment
```

### Case 3: Permanently Banned User Appeals
```
# If appeal approved:
/globalunban
```

---

## ✅ What Gets Blocked

Users who are globally banned:
- ❌ Cannot send messages (auto-deleted)
- ❌ Are auto-kicked from groups (immediately)
- ❌ Cannot access any group with this bot
- ❌ Ban persists even if they rejoin

---

## 🔧 Technical Details

**Database Storage:**
- Table: `banned_users`
- Special ID: `group_id = 'GLOBAL'` marks global bans

**Enforcement:**
- Middleware: `moderationFilter.js` (runs first)
- Check happens on every message
- User kicked + message deleted automatically

---

## 👤 Admin Requirements

✅ Must be group creator or admin
✅ Must reply to user's message
✅ Can unban anytime
✅ All actions are logged

---

## 🔍 Example: Complete Workflow

**Scenario:** User 6214060483 (Xavi) has suspicious activity

### Step 1: View History
```
/userhistory 6214060483
```
**Output:**
```
1. 11/22/2025 1:17:51 PM
   From: @Anonymous
   To: @none
   
2. 11/22/2025 12:45:00 PM
   From: @SomeUser
   To: @Anonymous
```

### Step 2: Global Ban
```
/globalban Multiple suspicious username changes - likely evasion attempt
```
**Output:**
```
🌍 **Xavi** has been **GLOBALLY BANNED**.

Reason: Multiple suspicious username changes - likely evasion attempt

⚠️ This user is now blocked from all groups and channels using this bot.
```

### Step 3: Verify
```
/globalbans
```
**Output:**
```
🌍 **Globally Banned Users**

📊 **Total:** 1 user

**1.** User ID: 6214060483
   📅 Banned: 11/22/2025, 1:17:51 PM
   📝 Reason: Multiple suspicious username changes - likely evasion attempt
   👤 By: Admin ID 123456
```

---

## 🛡️ Security Features

✅ **Admin-only** - Regular users cannot use commands
✅ **Logged** - All bans recorded with timestamp and admin
✅ **Persistent** - Bans survive bot restarts
✅ **Reversible** - Can be undone with `/globalunban`
✅ **Automatic** - No need to ban in each group separately

---

## 📊 Monitoring

View bans anytime with:
```
/globalbans
```

Check individual user history:
```
/userhistory <user_id>
```

---

## ⚡ Key Points

1. **One Command = Global Effect** - Ban in one group, applies to all
2. **Instant Enforcement** - User blocked immediately
3. **Cannot Be Bypassed** - Even if user rejoins
4. **Easily Reversible** - One command to unban
5. **Fully Logged** - Complete audit trail

---

## 🎯 When to Use Global Ban

✅ Do use for:
- Repeated evasion attempts
- Multi-group harassment
- Spam networks
- Ban evaders
- Suspicious patterns

❌ Don't use for:
- Minor infractions (use regular ban)
- First offense (issue warning first)
- Temporary issues (use timeout)

---

## 📞 Support

For issues or questions, check:
- `GLOBAL_BAN_DOCUMENTATION.md` - Full guide
- `GLOBAL_BAN_IMPLEMENTATION_SUMMARY.md` - Technical details
- Bot logs - See all ban actions

---

**Last Updated:** November 22, 2025
**System Status:** ✅ ACTIVE
**Version:** 1.0
