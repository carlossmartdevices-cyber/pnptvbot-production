# 🔒 Group & Channel Security Enforcement

**Status:** ✅ ACTIVE  
**Effective Date:** November 23, 2025  
**Implementation:** Production Environment

---

## Overview

The bot now enforces **strict whitelist-based access control** for groups and channels. The bot will **automatically leave** any group or channel that is not explicitly authorized in the environment configuration.

---

## Authorization Whitelist

### Authorized Chats (from .env)

| Chat Type | Chat ID | Purpose |
|-----------|---------|---------|
| **Channel** | `-1002997324714` | PRIME_CHANNEL_ID (Prime Content) |
| **Group** | `-1003291737499` | GROUP_ID (Main Support Group) |
| **Group** | `-1003365565562` | SUPPORT_GROUP_ID (Customer Service) |

---

## Security Rules

### ✅ ALLOWED
- Bot in **private chats** (1-on-1 messages) - Always allowed
- Bot in **whitelisted groups/channels** - From .env configuration
- Admin adding bot to authorized chats - Full access granted

### ❌ BLOCKED
- Bot added to **any unauthorized group** - Auto-leaves immediately
- Bot added to **any unauthorized channel** - Auto-leaves immediately
- Bot added to **any new group/supergroup** - Must be in whitelist
- Bot added to **any new channel** - Must be in whitelist

---

## Security Enforcement Layers

### 1. Middleware Layer (`groupSecurityEnforcementMiddleware`)
- Runs on **every message** from groups/channels
- Checks if chat ID is in whitelist
- Immediately stops processing if unauthorized
- **Zero tolerance** - no warnings, instant block

### 2. Chat Member Handler (`my_chat_member`)
- Triggered when bot is **added/removed** from group
- Verifies authorization **before** bot starts operating
- Auto-leaves if unauthorized
- Sends security notice before leaving

### 3. Chat Creation Handlers
- `group_chat_created` - New group detection
- `supergroup_chat_created` - New supergroup detection
- `channel_chat_created` - New channel detection
- Verifies whitelist for **all new chats**

---

## Behavior When Bot is Added to Unauthorized Group

### Step 1: Detection
Bot detects it was added to unauthorized group via `my_chat_member` update

### Step 2: Verification
Bot checks group ID against whitelist from `.env`

### Step 3: Security Notice (Attempted)
```
❌ Security Policy Violation

This bot can only be added to authorized groups and channels.
Adding it to other chats is not permitted.

Bot is leaving this chat now.
```

### Step 4: Bot Leaves
Bot leaves the unauthorized group/channel **immediately**

### Step 5: Logging
Full security event logged with:
- Chat ID
- Chat Title
- Chat Type (group/supergroup/channel)
- User who added bot
- Timestamp

---

## Authorized Chat Details

### 1. Prime Channel (`-1002997324714`)
- Type: Channel
- Purpose: Premium content distribution
- Status: ✅ Authorized
- Bot Access: Full

### 2. Main Support Group (`-1003291737499`)
- Type: Supergroup
- Purpose: Primary support and community
- Status: ✅ Authorized
- Bot Access: Full (topic-based permissions apply)

### 3. Support Group (`-1003365565562`)
- Type: Supergroup
- Purpose: Customer service
- Status: ✅ Authorized
- Bot Access: Full

---

## Admin Operations

### To Add a New Authorized Chat

Edit `.env` and add new chat ID to one of these variables:

```bash
# For channels
PRIME_CHANNEL_ID=-NEW_CHANNEL_ID

# For groups/supergroups
GROUP_ID=-NEW_GROUP_ID
SUPPORT_GROUP_ID=-NEW_GROUP_ID
```

Then restart bot:
```bash
pm2 restart pnptv-bot --update-env
```

### To Find Chat ID

When bot is added to a chat:
```javascript
// Logs will show:
// "Unauthorized group/channel access attempt"
// Chat ID will be displayed in logs
```

---

## Log Messages

### Authorization Successful
```
[info]: Authorized chat access
{
  chatId: "-1003291737499",
  chatTitle: "PNPtv! Support Team!",
  chatType: "supergroup"
}
```

### Authorization Failed (Leaving)
```
[error]: 🚨 Bot added to UNAUTHORIZED chat - LEAVING IMMEDIATELY
{
  chatId: "-1234567890",
  chatTitle: "Unauthorized Group",
  chatType: "group",
  authorizedChats: ["-1002997324714", "-1003291737499", "-1003365565562"]
}
```

---

## Security Benefits

✅ **Prevents Spam/Harassment** - Bot cannot be added to random groups  
✅ **Reduces Load** - Bot only operates in authorized channels  
✅ **Data Protection** - User data confined to authorized spaces  
✅ **Compliance** - Enforces access policies automatically  
✅ **Audit Trail** - All unauthorized attempts logged  
✅ **Zero Configuration** - Works automatically via .env  

---

## Testing

### Test: Bot Leaves Unauthorized Group

1. Get a friend to add bot to a random private group
2. Watch logs for: `"🚨 Bot added to UNAUTHORIZED chat - LEAVING IMMEDIATELY"`
3. Bot should leave the group within seconds
4. Friend should see the bot as having left

### Test: Bot Stays in Authorized Group

1. Bot is already in authorized groups (visible in .env)
2. Send messages - bot processes normally
3. No security warnings should appear

---

## Monitoring

### Check Active Authorizations
```bash
# View authorized chats from .env
grep -E "PRIME_CHANNEL_ID|GROUP_ID|SUPPORT_GROUP_ID" /root/pnptvbot-production/.env
```

### Monitor Unauthorized Attempts
```bash
# Watch for security violations in real-time
pm2 logs pnptv-bot | grep "UNAUTHORIZED"
```

### View Logs
```bash
# Last 100 security-related logs
pm2 logs pnptv-bot --lines 100 | grep -E "Unauthorized|security|leaving"
```

---

## FAQ

**Q: Can I add the bot to my private group?**
A: Yes, but only authorized groups. Contact admin with group ID to add to whitelist.

**Q: What if I accidentally add bot to wrong group?**
A: Bot leaves automatically within seconds. No action needed.

**Q: Can users turn off this security?**
A: No. This is enforced at all levels and cannot be disabled by users.

**Q: Will bot send message before leaving?**
A: Bot will attempt to send a security notice, but this may fail if it doesn't have message permissions. Either way, bot leaves immediately.

**Q: How do I add a new authorized group?**
A: Edit `.env`, add new group ID to appropriate variable, then `pm2 restart pnptv-bot --update-env`

---

## Status Dashboard

| Component | Status | Last Check |
|-----------|--------|------------|
| Middleware | ✅ ACTIVE | 2025-11-23 13:44:27 |
| Handlers | ✅ ACTIVE | 2025-11-23 13:44:27 |
| Enforcement | ✅ ACTIVE | Continuous |
| Logging | ✅ ACTIVE | Real-time |

---

**Document Updated:** 2025-11-23 13:44:27 UTC  
**Security Level:** 🔴 CRITICAL  
**Audit Trail:** ✅ ENABLED
