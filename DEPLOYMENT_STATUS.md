# PNPtv Bot - Production Deployment Status

**Deployment Date:** November 23, 2025
**Environment:** Production
**Status:** ✅ ACTIVE

---

## 🚀 Deployment Details

### Bot Configuration
- **Process Manager:** PM2 (Process ID: 15)
- **Mode:** Webhook (Production)
- **Environment:** NODE_ENV=production
- **Port:** 3000
- **Webhook URL:** https://easybots.store/webhook/telegram
- **Status:** ✅ Online and Running
- **Auto-Restart:** Enabled
- **Memory:** ~114MB (healthy)

### Database
- **PostgreSQL:** ✅ Connected (Port 55432)
- **Redis:** ✅ Connected (Port 6380)
- **Cache:** Prewarmed with 5 subscription plans

---

## 📋 Active Topic Configurations

### 1. 📰 PNPtv News! (Topic ID: 3131)
- **Access Control:** Admin-only posting
- **Media Required:** No
- **Features:**
  - Auto-pins admin messages for 3 days
  - Notifies all members on new post
  - All members can reply and react
- **Status:** ✅ Active

### 2. 🎨 PNPtv Gallery! (Topic ID: 3132)
- **Access Control:** All members can post
- **Media Required:** Yes (photos, videos, animations only)
- **Features:**
  - **Leaderboard enabled** - Tracks top contributors
  - **Auto-mirror enabled** - Mirrors media from general chat
  - Rate limiting: 20 posts/hour, 15-second cooldown
  - Anti-spam and anti-flood enabled
- **Status:** ✅ Active

### 3. 📞 Contacto PNPtv! (Topic ID: 3134)
- **Access Control:** Admin approval required
- **Media Required:** No (all content types allowed)
- **Features:**
  - Approval queue system active
  - Supports text, photos, videos, audio, voice, documents
  - All members can reply to approved posts
- **Status:** ✅ Active

### 4. 🔔 Notifications (Topic ID: 3135)
- **Access Control:** All members can post
- **Media Required:** No
- **Features:**
  - Bot command responses redirected here
  - **Auto-delete enabled** - Messages deleted after 5 minutes
  - Keeps main chat clean
- **Status:** ✅ Active

---

## 🛡️ Active Middleware & Features

### Topic-Specific Middleware
- ✅ **Topic Permissions** - Enforces access control rules
- ✅ **Media-Only Validator** - Validates media-only content in Gallery
- ✅ **Media Mirror** - Auto-mirrors media to Gallery topic
- ✅ **Command Redirection** - Redirects bot responses to Notifications
- ✅ **Auto-Delete** - Cleans up Notifications topic
- ✅ **Approval Queue** - Manages posts in Contacto PNPtv!

### General Middleware
- ✅ **Session Management** - Redis-backed sessions
- ✅ **Rate Limiting** - 30 requests/minute per user
- ✅ **Username Enforcement** - Required for all non-admins
- ✅ **Profile Compliance** - 48-hour compliance deadline
- ✅ **Moderation Filter** - Spam, profanity, links detection
- ✅ **Chat Cleanup** - Auto-deletes commands and bot messages
- ✅ **Allowed Chats** - Restricted to authorized groups only
- ✅ **Activity Tracker** - Tracks user engagement

---

## 📊 Group Menu Behavior

### Private Chat
- `/start` and `/menu` show full interactive menu
- All features accessible directly

### Group Chat
When users click menu buttons in group:
1. Bot posts: `@username I sent you a private message please check it out! 💬`
2. Private message sent with feature link
3. Group message auto-deletes after 30 seconds

**Supported Actions:**
- Subscription Plans
- Profile
- Nearby Users
- Radio
- Support
- Settings
- Admin Panel (admins only)

---

## 🔒 Security & Compliance

### Profile Requirements
- ✅ Username required (@username)
- ✅ 48-hour compliance deadline
- ✅ Automatic removal after deadline
- ✅ Admins exempt from requirements

### Content Moderation
- ✅ 3-warning system (auto-kick on 3rd warning)
- ✅ Global ban list enforcement
- ✅ Spam detection (excessive caps, emojis, punctuation)
- ✅ Link detection and filtering
- ✅ Flood protection (5 messages in 10 seconds)

### Rate Limiting
- ✅ Global: 30 requests/minute per user
- ✅ Gallery topic: 20 posts/hour, 15-second cooldown
- ✅ 60-second block on rate limit exceeded

---

## 📈 Analytics & Tracking

### Leaderboard Tracking (Gallery Topic)
- Total posts count
- Total media shared
- Reactions given/received
- Reply count
- Most liked post tracking
- Last post timestamp

### Violation Tracking
- User violations logged with timestamp
- 24-hour violation count available
- Automatic escalation on threshold

---

## 🔄 PM2 Configuration

### Process Settings
```javascript
{
  name: 'pnptv-bot',
  script: './src/bot/core/bot.js',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  max_memory_restart: '500M',
  env: {
    NODE_ENV: 'production',
    PORT: 3000
  }
}
```

### Management Commands
```bash
# View logs
pm2 logs pnptv-bot

# Restart bot
pm2 restart pnptv-bot

# View status
pm2 status pnptv-bot

# View environment
pm2 env 15
```

---

## 🎯 Important Notes

### Historical Messages
- ⚠️ Telegram API does not allow fetching old messages
- ✅ All rules enforce **from deployment forward**
- ⚠️ Old messages must be manually moderated by admins
- ✅ Leaderboards populate from new activity

### Webhook Status
- Endpoint: https://easybots.store/webhook/telegram
- Status: ✅ Active
- Pending Updates: 0
- Max Connections: 40
- IP Address: 72.60.29.80

---

## ✅ Deployment Checklist

- [x] Bot deployed with PM2
- [x] Production environment configured (NODE_ENV=production)
- [x] Webhook active and verified
- [x] Database tables created
- [x] Topic configurations initialized
- [x] All middleware activated
- [x] Menu behavior updated for groups
- [x] PM2 configuration saved
- [x] PostgreSQL connected
- [x] Redis connected
- [x] All topic rules enforced

---

## 📞 Support

For issues or questions:
- Support Group: @PNPtv_Support
- Admin Commands: Available in bot
- Logs Location: `/root/.pm2/logs/pnptv-bot-*.log`

---

**Last Updated:** November 23, 2025 08:04 UTC
**Deployed By:** Claude Code
**Version:** 1.0.0
