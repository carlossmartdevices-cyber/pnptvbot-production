# 🤖 BOT GROUP BEHAVIOR & MODERATION ANALYSIS

## 📋 Overview

The PNPtv bot implements a **comprehensive moderation and anti-spam system** for group management. The system operates through three main components:

1. **Moderation Filter Middleware** - Active message processing
2. **Moderation Service** - Content detection and analysis
3. **Group Cleanup Service** - Scheduled spam removal

---

## 🛡️ MODERATION LAYERS

### Layer 1: Global Ban Check (First)
**Priority:** 🔴 HIGHEST  
**Runs:** On every message before any other moderation

```
Message arrives → Check if user globally banned (group_id='GLOBAL')
                ↓
                YES → Delete message + Kick user + Log
                ↓
                NO → Continue to next layer
```

**Actions if triggered:**
- 🚫 Message deleted immediately
- 👢 User kicked from group
- 📝 Action logged

**Location:** `src/bot/core/middleware/moderationFilter.js` (lines 35-44)

---

### Layer 2: Message Content Analysis
**Priority:** 🟡 HIGH  
**Runs:** After admin bypass check

Checks messages against moderation rules in this order:

#### A. **Anti-Links** (Unauthorized URLs)
```javascript
✓ Detects: Links via multiple patterns
  - Full URLs (http/https)
  - URLs without protocol (www.example.com)
  - Common domains (.com, .net, .org, .io, .co, .tv, .me, .gg, .xyz, .app, .dev, .tech)
  - Short URLs (bit.ly, t.me, tinyurl.com, goo.gl, ow.ly, buff.ly)
  - Telegram links (@username, t.me/channel)

✓ Whitelist support: Configurable allowed domains

✓ Default: ENABLED

⚠️ Action: warn_and_delete
   → Delete message
   → Send warning (shown 10 seconds)
   → Send private DM to user
```

**Settings:**
- `antiLinksEnabled`: true (default)
- `allowedDomains`: [] (configurable per group)

---

#### B. **Anti-Spam Detection**
```javascript
Triggers on ANY of these:
  1. Excessive CAPS (>70% uppercase letters)
  2. Excessive emojis (>10 emojis)
  3. Repeated characters (same char 5+ times: "HEEEEELP")
  4. Excessive punctuation (4+ consecutive ! or ?)

✓ Default: ENABLED

⚠️ Action: warn_and_delete
```

**Settings:**
- `antiSpamEnabled`: true (default)
- `bannedWords`: [] (custom words list)

---

#### C. **Anti-Flood (Rate Limiting)**
```javascript
Triggers when: User sends >5 messages in 10 seconds

✓ In-memory tracking (fast, no DB calls)
✓ Window: 10 seconds
✓ Limit: 5 messages per window
✓ Default: ENABLED

⚠️ Action: warn (doesn't delete, just warns)
```

**Settings:**
- `antiFloodEnabled`: true (default)
- `floodLimit`: 5 messages
- `floodWindow`: 10 seconds

---

#### D. **Profanity Filter**
```javascript
✓ Default banned words: 'spam', 'scam', 'fake'
✓ Custom banned words support per group
✓ Default: DISABLED (can be enabled per group)

⚠️ Action: warn_and_delete
```

**Settings:**
- `profanityFilterEnabled`: false (default)
- `bannedWords`: ['spam', 'scam', 'fake'] + custom

---

### Layer 3: Username Enforcement
**Priority:** 🟠 MEDIUM  
**Status:** ACTIVE

Users **must have a Telegram username** (@username) to participate in groups.

**Actions if no username:**
- 🚫 Message deleted
- ⚠️ Warning sent with instructions (shown 30 seconds)
- User can rejoin once username is set

**Location:** `src/bot/core/middleware/usernameEnforcement.js`

---

## ⚠️ WARNING SYSTEM

### How Warnings Work

1. **First violation:** 1 warning (2 remaining)
2. **Second violation:** 2 warnings (1 remaining)
3. **Third violation:** REMOVED from group (automatic kick)

```
3 warnings → Automatic removal
Maximum warnings: 3 (configurable per group)
```

### Warning Notifications

**Group notification:**
```
⚠️ Warning
👤 [Username]
📋 [Reason]
⚠️ Warning X of 3
```
(Auto-deleted after 10 seconds)

**Private DM to user:**
```
⚠️ Warning
You received a warning in [Group Name]
📋 Reason: [Violation Type]
⚠️ Warning X of 3
```

**On reaching max warnings:**
```
🚫 User Eliminated
👤 [Username] has been removed from the group
📋 Reason: [Last Violation]
⚠️ Maximum warnings (3) reached
```
(Shown 30 seconds, then deleted)

---

## 🎯 MODERATION ACTIONS

### Action Types & Behaviors

| Action | Behavior | Warning? | Delete? | Kick? |
|--------|----------|----------|---------|-------|
| `delete` | Banned user detected | ❌ | ✅ | ✅ |
| `warn` | Flooding detected | ✅ | ❌ | ⚠️ (if max) |
| `warn_and_delete` | Links/Spam/Profanity | ✅ | ✅ | ⚠️ (if max) |

---

## 🔐 ADMIN BYPASS

**Admins and group creators bypass ALL moderation.**

Check performed in middleware:
```javascript
const chatMember = await ctx.getChatMember(userId);
const isAdmin = ['creator', 'administrator'].includes(chatMember.status);
if (isAdmin) return next(); // Skip all moderation
```

**Location:** `src/bot/core/middleware/moderationFilter.js` (lines 46-56)

---

## 📊 GROUP SETTINGS (Per-Group Configuration)

### Default Settings (Auto-Created for New Groups)

```javascript
{
  antiLinksEnabled: true,
  antiSpamEnabled: true,
  antiFloodEnabled: true,
  profanityFilterEnabled: false,
  maxWarnings: 3,
  floodLimit: 5,              // messages
  floodWindow: 10,            // seconds
  muteDuration: 3600,         // seconds (1 hour)
  allowedDomains: [],         // whitelist
  bannedWords: [],            // custom banned words
}
```

### Admin Commands to Configure

```bash
/moderation on                  # Enable all checks
/moderation off                 # Disable all checks
/moderation status              # Show current settings

/setlinks <policy>              # Configure link policy
  • strict  → Delete all links immediately
  • warn    → Warn users before deleting (default)
  • allow   → Allow all links

/ban @user [reason]             # Ban user (permanent in DB)
/unban @user                    # Unban user

/globalban [reason]             # Ban from ALL groups
/globalunban                    # Remove global ban
/globalbans                      # View all global bans

/clearwarnings @user            # Clear user's warnings
/warnings @user                 # View user's warnings

/modlogs [limit]                # View moderation logs
/modstats                        # View moderation statistics
/rules                           # Display group rules
```

---

## 🧹 SCHEDULED CLEANUP SERVICE

### What It Does

Automatically removes flagged spam messages from groups at **scheduled times**.

**Schedule:**
- 🕐 12:00 UTC (Noon)
- 🕐 00:00 UTC (Midnight)

### Message Flagging Criteria

Tracked messages are flagged if they contain:

1. **Unauthorized commands**
   - Anything except: `/menu`, `/start`, `/help`

2. **Non-English/Spanish text**
   - Any message >10 chars that isn't English or Spanish

3. **Excessive URLs**
   - More than 2 URLs in one message

4. **Too many special characters**
   - >30% special character ratio in message

5. **All caps messages (SHOUTING)**
   - >70% uppercase letters with >10 letters total

### Cleanup Process

```
Message detected as spam
        ↓
Added to memory tracker (with timestamp)
        ↓
[After 12 hours]
        ↓
Scheduled cleanup checks all tracked messages
        ↓
Deletes messages older than 12 hours
        ↓
Cleans up memory tracker (keeps 48-hour history)
        ↓
Logs deletion statistics
```

**Configuration:**
- Environment variable: `ENABLE_GROUP_CLEANUP` (default: true)
- Cleanup delay: 12 hours before deletion
- Memory retention: 48 hours

**Location:** `src/bot/services/groupCleanupService.js`

---

## 👥 GROUP WELCOME & RULES

### New Member Welcome

When users join a group:

1. ✅ Username enforcement check
2. 📋 Display welcome message
3. 🎯 Badge selection ("Which vibe are you?")
4. 🎊 Congratulations message
5. 📢 Action buttons (Subscribe + Book Call)
6. 📖 Rules menu with inline button

### Community Rules Displayed

**English:**
```
📋 Community Rules

1. Respect - Treat all members with respect and courtesy
2. No Spam - Avoid spam, unauthorized advertising, repetitive content
3. Privacy - Don't share personal info without consent
4. Appropriate Content - Keep content family-friendly
5. No Harassment - No bullying or hostile behavior
6. Bot Usage - Use bot privately for personal features

⚠️ Breaking rules may result in warnings, restrictions, or removal.
```

**Spanish:**
```
📋 Reglas de la Comunidad PNPtv

1. Respeto - Trata a todos los miembros con respeto y cortesía
2. No Spam - Evita el spam, publicidad no autorizada o contenido repetitivo
3. Privacidad - No compartas información personal sin consentimiento
4. Contenido Apropiado - El contenido debe ser apropiado
5. No Acoso - No se tolerará acoso o comportamiento hostil
6. Uso del Bot - Usa el bot en privado para funciones personales

⚠️ Romper estas reglas puede resultar en advertencias, restricciones o expulsión.
```

---

## 📝 LOGGING & MONITORING

### What Gets Logged

All moderation actions are logged:
- User warnings (with count and reason)
- User bans (with reason and admin ID)
- User unbans (with admin ID)
- Global bans/unbans
- Warnings cleared
- Group settings changes
- Message deletions
- User kicks

### Moderation Statistics Available

- Warning count per user
- Ban history per user
- Global ban count
- Recent moderation logs (up to 50)
- Per-group moderation activity

**Admin Commands:**
```bash
/modlogs [limit]   # View moderation action logs
/modstats          # View moderation statistics
```

---

## 🔄 MESSAGE PROCESSING FLOW

```
Message Sent
    ↓
┌─────────────────────────────────────────┐
│  moderationFilter Middleware Activates  │
└─────────────────────────────────────────┘
    ↓
[1] Is it a group? 
    NO → Allow message, proceed
    YES ↓
[2] Check Global Ban (group_id='GLOBAL')
    YES → Delete + Kick + Return (STOP)
    NO ↓
[3] Is user an admin/creator?
    YES → Allow message, proceed (SKIP MODERATION)
    NO ↓
[4] Run ModerationService.processMessage()
    ↓
    ├─ Check Anti-Links
    ├─ Check Anti-Spam
    ├─ Check Anti-Flood
    └─ Check Profanity
    ↓
[5] Should Moderate?
    NO → Allow message (next middleware)
    YES ↓
[6] Apply Action
    ├─ Delete: Remove message (banned users)
    ├─ Warn: Add warning, notify user
    └─ Warn & Delete: Delete + Warn
    ↓
[7] Check if user exceeded max warnings?
    YES → Kick user from group
    NO → Allow user to stay
    ↓
┌─────────────────────────────────────────┐
│  Message Processing Complete            │
│  Don't call next() - User is blocked   │
└─────────────────────────────────────────┘
```

---

## ⚙️ TECHNICAL IMPLEMENTATION

### Files Involved

| File | Purpose |
|------|---------|
| `src/bot/core/middleware/moderationFilter.js` | Main message filtering |
| `src/bot/services/moderationService.js` | Detection logic |
| `src/bot/services/groupCleanupService.js` | Scheduled cleanup |
| `src/models/moderationModel.js` | Database operations |
| `src/bot/core/middleware/usernameEnforcement.js` | Username validation |
| `src/bot/handlers/moderation/adminCommands.js` | Admin commands |
| `src/bot/handlers/moderation/index.js` | Rules display |

### Database Tables

**group_settings**
- `group_id`, `anti_links_enabled`, `anti_spam_enabled`, `anti_flood_enabled`
- `profanity_filter_enabled`, `max_warnings`, `flood_limit`, `flood_window`
- `mute_duration`, `allowed_domains`, `banned_words`

**user_warnings**
- `user_id`, `group_id`, `warning_count`, `reasons` (array)

**banned_users**
- `user_id`, `group_id` (or 'GLOBAL' for global bans)
- `reason`, `banned_by`, `banned_at`

**moderation_logs**
- `action`, `user_id`, `group_id`, `reason`, `details`, `moderator_id`, `timestamp`

---

## 🚀 QUICK REFERENCE

### Most Common Actions

| Violation | Detection | Action | Warning? | Delete? |
|-----------|-----------|--------|----------|---------|
| 5+ msgs/10s | Flood check | Warn | ✅ | ❌ |
| Any link | Link detection | Warn & Delete | ✅ | ✅ |
| EXCESSIVE CAPS | Spam detection | Warn & Delete | ✅ | ✅ |
| >10 emojis | Spam detection | Warn & Delete | ✅ | ✅ |
| No username | User check | Delete message | ✅ | ❌ |
| Banned user | Ban check | Delete | ❌ | ✅ |
| Global banned | Global ban check | Delete + Kick | ❌ | ✅ |

### Warning Thresholds

- **Flood:** Immediate warning (doesn't count toward ban threshold)
- **Content violations:** Counted toward 3-warning limit
- **3 warnings total:** Automatic removal from group

---

## 📊 CURRENT BEHAVIOR SUMMARY

✅ **Actively Enforced:**
- Global bans (immediate across all groups)
- Username requirement (enforced)
- Anti-links (by default)
- Anti-spam (by default)
- Anti-flood (by default)
- 3-warning system (automatic removal)
- Automatic scheduled cleanup (12:00 and 00:00 UTC)
- Admin bypass (admins skip all checks)

⚙️ **Configurable Per Group:**
- Anti-links policy (strict/warn/allow)
- Whitelisted domains
- Profanity filter (disabled by default)
- Custom banned words
- Max warnings (default 3)
- Flood limits (default 5 msgs/10s)

❌ **Not Currently Enforced:**
- Mute (warnings given, but user not silenced)
- Message edit moderation (only tracks message creation)
- Spam account patterns (new account detection not implemented)

---

## 🔔 NOTIFICATIONS SENT

### To Group (Auto-deleted)
- Warning messages (10 seconds)
- Kick notifications (30 seconds)
- Rules display (stays until clicked)

### To User (Private DM)
- Warning details
- Rules on join
- Unban notifications

---

## 💡 KEY INSIGHTS

1. **Global bans are nuclear option** - Instant removal across all groups via `group_id='GLOBAL'`
2. **Admin bypass is complete** - Admins don't trigger any moderation
3. **Warnings are per-group** - Same user can have different warning counts in different groups
4. **Cleanup is passive** - Only happens at scheduled times, not real-time
5. **No muting** - Users are warned but can continue messaging until kicked
6. **Language detection** - Cleanup service removes non-English/Spanish messages

