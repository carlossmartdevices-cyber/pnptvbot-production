# Topic Personalization System

Complete guide for the PNPtv Bot topic-specific configuration and personalization system.

---

## Overview

The Topic Personalization System allows fine-grained control over behavior, permissions, and features for each forum topic in your Telegram group. Each topic can have its own:

- **Access control** (admin-only, approval required, public)
- **Content rules** (media-only, text allowed, file types)
- **Moderation settings** (spam filters, rate limits)
- **Auto-features** (mirroring, pinning, deletion)
- **Analytics** (leaderboards, engagement tracking)

---

## Current Topic Configuration

| Topic ID | Name | Key Features |
|----------|------|--------------|
| **3131** | PNPtv News! | Admin-only posts, auto-pin (3 days), notify all |
| **3132** | PNPtv Gallery! | Media-only, auto-mirror from general, leaderboard |
| **3134** | Podcasts & Thoughts | Admin approval required, all media types |
| **3135** | Notifications | Bot command responses, auto-delete (5 min) |

---

## Topic Features in Detail

### 1. **PNPtv News! (Thread ID: 3131)**

**Purpose:** Official news and announcements from the team

**Configuration:**
```javascript
{
  can_post: 'admin_only',              // Only admins can create posts
  can_reply: 'all',                    // Users can reply to news
  auto_pin_admin_messages: true,       // Auto-pin all news posts
  auto_pin_duration: 259200,           // Unpin after 3 days (72 hours)
  notify_all_on_new_post: true         // Notify all members of new posts
}
```

**User Experience:**
- ✅ Admins post news → automatically pinned for 3 days
- ✅ All members notified when news is posted
- ✅ Users can comment on news posts
- ❌ Users cannot create new top-level posts
- ❌ Bot commands disabled

**Middleware:** `topicPermissionsMiddleware`

---

### 2. **PNPtv Gallery! (Thread ID: 3132)**

**Purpose:** Media sharing hub with auto-mirroring and leaderboards

**Configuration:**
```javascript
{
  media_required: true,                // MUST contain photo/video/GIF
  allow_text_only: false,              // Text-only posts blocked
  allow_caption: true,                 // Captions allowed on media
  allowed_media: ['photo', 'video', 'animation'],
  allow_stickers: true,
  allow_replies: true,                 // Text replies to media OK
  allow_text_in_replies: true,

  // Auto-mirror from general chat
  auto_mirror_enabled: true,
  mirror_from_general: true,
  mirror_format: '📸 From: @{username}\n\n{caption}',

  // Rate limiting
  max_posts_per_hour: 20,
  cooldown_between_posts: 15,          // 15 seconds

  // Leaderboard
  enable_leaderboard: true,
  track_reactions: true,
  track_posts: true
}
```

**User Experience:**
- ✅ Users post photos/videos/GIFs with optional captions
- ✅ Users reply to media with text comments
- ✅ All media from general chat auto-mirrors here
- ✅ `/leaderboard` command shows top contributors
- ❌ Text-only messages deleted with warning
- ❌ Limited to 20 media posts per hour per user

**Leaderboard Categories:**
1. 📸 **Top Media Sharers** - Users who post the most photos/videos
2. ❤️ **Most Liked Content** - Users whose content gets the most reactions
3. 👍 **Most Active Reactors** - Users who react to content the most

**Commands:**
- `/leaderboard` - View rankings
- `/ranking` - Alias for leaderboard
- `/top` - Alias for leaderboard

**Middlewares:** `mediaOnlyValidator`, `mediaMirrorMiddleware`

---

### 3. **Podcasts & Thoughts (Thread ID: 3134)**

**Purpose:** Curated content requiring admin approval

**Configuration:**
```javascript
{
  can_post: 'approval_required',       // User posts need admin approval
  can_reply: 'all',                    // Users can reply freely
  allowed_media: ['photo', 'video', 'audio', 'voice', 'document'],
  allow_text_only: true
}
```

**User Experience:**
- ✅ Admins post freely without approval
- ✅ Users can submit content (podcasts, thoughts, videos)
- ✅ Users can reply to approved posts
- ⏳ User submissions go to approval queue
- 📧 Users notified when post approved/rejected

**Approval Workflow:**
1. User submits content → post deleted from topic
2. Admins receive approval request with user info
3. Admin clicks ✅ Approve or ❌ Reject
4. If approved: Post published to topic, user notified
5. If rejected: User notified with reason

**Admin Buttons:**
- ✅ **Approve** - Publish post to topic
- ❌ **Reject** - Deny post and notify user

**Middleware:** `topicPermissionsMiddleware`

---

### 4. **Notifications (Thread ID: 3135)**

**Purpose:** Bot command responses and notifications

**Configuration:**
```javascript
{
  redirect_bot_responses: true,
  auto_delete_enabled: true,
  auto_delete_after: 300,              // 5 minutes
  override_global_deletion: true
}
```

**User Experience:**
- ✅ Users run commands anywhere → responses appear here
- ✅ Redirect notice: "→ Check Notifications topic"
- ✅ Original command deleted after 30 seconds
- ✅ All messages auto-delete after 5 minutes
- ✅ Keeps other topics clean

**Command Flow:**
```
User types /menu in topic A
  ↓
Bot processes command
  ↓
Bot reply appears in Notifications topic
  ↓
User sees redirect: "→ Check Notifications topic"
  ↓
Original command deleted after 30 seconds
  ↓
Bot reply deleted after 5 minutes
```

**Middlewares:** `commandRedirectionMiddleware`, `notificationsAutoDelete`

---

## Database Schema

### `topic_configuration` Table

Main configuration table for all topic settings.

```sql
CREATE TABLE topic_configuration (
  topic_id BIGINT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  topic_name VARCHAR(255) NOT NULL,

  -- Access Control
  can_post VARCHAR(50) DEFAULT 'all',
  can_reply VARCHAR(50) DEFAULT 'all',
  can_react VARCHAR(50) DEFAULT 'all',
  required_role VARCHAR(50) DEFAULT 'user',
  required_subscription VARCHAR(50) DEFAULT 'free',

  -- Content Rules
  media_required BOOLEAN DEFAULT FALSE,
  allow_text_only BOOLEAN DEFAULT TRUE,
  allow_caption BOOLEAN DEFAULT TRUE,
  allowed_media JSONB DEFAULT '["photo","video","animation"]',
  allow_stickers BOOLEAN DEFAULT TRUE,
  allow_documents BOOLEAN DEFAULT FALSE,

  -- Reply Handling
  allow_replies BOOLEAN DEFAULT TRUE,
  reply_must_quote BOOLEAN DEFAULT FALSE,
  allow_text_in_replies BOOLEAN DEFAULT TRUE,

  -- Moderation
  auto_moderate BOOLEAN DEFAULT FALSE,
  anti_spam_enabled BOOLEAN DEFAULT FALSE,
  anti_flood_enabled BOOLEAN DEFAULT FALSE,
  anti_links_enabled BOOLEAN DEFAULT FALSE,
  allow_commands BOOLEAN DEFAULT TRUE,

  -- Rate Limiting
  max_posts_per_hour INTEGER DEFAULT 100,
  max_replies_per_hour INTEGER DEFAULT 100,
  cooldown_between_posts INTEGER DEFAULT 0,

  -- Bot Behavior
  redirect_bot_responses BOOLEAN DEFAULT FALSE,
  auto_delete_enabled BOOLEAN DEFAULT FALSE,
  auto_delete_after INTEGER DEFAULT 300,
  override_global_deletion BOOLEAN DEFAULT FALSE,

  -- Notifications & Features
  notify_all_on_new_post BOOLEAN DEFAULT FALSE,
  auto_pin_admin_messages BOOLEAN DEFAULT FALSE,
  auto_pin_duration INTEGER DEFAULT 172800,

  -- Mirror Settings
  auto_mirror_enabled BOOLEAN DEFAULT FALSE,
  mirror_from_general BOOLEAN DEFAULT FALSE,
  mirror_format TEXT DEFAULT '📸 From: @{username}\n\n{caption}',

  -- Analytics
  enable_leaderboard BOOLEAN DEFAULT FALSE,
  track_reactions BOOLEAN DEFAULT FALSE,
  track_posts BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `topic_analytics` Table

Tracks user engagement for leaderboards.

```sql
CREATE TABLE topic_analytics (
  id SERIAL PRIMARY KEY,
  topic_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username VARCHAR(255),

  -- Post tracking
  total_posts INTEGER DEFAULT 0,
  total_media_shared INTEGER DEFAULT 0,

  -- Engagement tracking
  total_reactions_given INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,

  -- Most liked post
  most_liked_post_id BIGINT,
  most_liked_post_count INTEGER DEFAULT 0,

  last_post_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(topic_id, user_id)
);
```

### `topic_violations` Table

Tracks content rule violations.

```sql
CREATE TABLE topic_violations (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  topic_id BIGINT NOT NULL,
  violation_type VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Setup & Installation

### 1. Initialize Database Tables

```bash
npm run setup-db
```

Or manually:

```javascript
const TopicConfigModel = require('./src/models/topicConfigModel');
await TopicConfigModel.initTables();
```

### 2. Initialize Topic Configurations

```bash
node scripts/init-topic-configurations.js
```

This will:
- ✅ Create all database tables
- ✅ Insert configurations for all 4 topics
- ✅ Display configuration summary

**Output:**
```
═══════════════════════════════════════════════════════
        TOPIC CONFIGURATIONS INITIALIZATION
═══════════════════════════════════════════════════════

📋 Creating topic configuration tables...
✅ Tables created successfully

📝 Inserting topic configurations...

   Configuring: PNPtv News! (ID: 3131)
   ✅ PNPtv News! configured successfully
      - Access: admin_only
      - Media required: false
      - Auto-mirror: false
      - Leaderboard: false
      - Auto-delete: false

   ... (more topics)

═══════════════════════════════════════════════════════
               CONFIGURATION COMPLETE
═══════════════════════════════════════════════════════
```

### 3. Restart Bot

```bash
pm2 restart pnptvbot
```

Or if using npm:

```bash
npm start
```

---

## Middleware Architecture

### Middleware Execution Order

```
1. sessionMiddleware          ← Session management
2. allowedChatsMiddleware     ← Authorized groups only
3. rateLimitMiddleware        ← Global rate limiting
4. chatCleanupMiddleware      ← Base cleanup rules
5. usernameEnforcement        ← Username compliance
6. profileCompliance          ← Profile validation
7. moderationFilter           ← Content moderation
8. activityTrackerMiddleware  ← Activity tracking
9. groupCommandReminder       ← Command reminders

--- TOPIC-SPECIFIC MIDDLEWARES ---

10. notificationsAutoDelete   ← Auto-delete in notifications topic
11. commandRedirectionMiddleware ← Redirect commands to notifications
12. mediaMirrorMiddleware     ← Mirror media to PNPtv Gallery
13. topicPermissionsMiddleware ← Admin-only & approval queue
14. mediaOnlyValidator        ← Media-only validation

--- HANDLERS ---

15. All bot handlers (commands, callbacks, etc.)
```

### Middleware Details

**`topicPermissionsMiddleware.js`**
- Enforces `admin_only` posting (PNPtv News!)
- Handles approval queue (Podcasts & Thoughts)
- Auto-pins admin messages
- Sends violation warnings

**`mediaOnlyValidator.js`**
- Validates media-only requirements (PNPtv Gallery!)
- Allows text in replies
- Tracks violations
- Updates analytics

**`mediaMirrorMiddleware.js`**
- Auto-mirrors media from general chat to PNPtv Gallery!
- Adds user attribution
- Includes PNPtv profile links
- Tracks analytics

**`commandRedirectionMiddleware.js`**
- Redirects bot commands to Notifications topic
- Deletes original command after 30 seconds
- Shows redirect notice to user

**`notificationsAutoDelete.js`**
- Auto-deletes all messages in Notifications topic after 5 minutes
- Overrides global deletion settings

---

## Admin Commands

### Managing Topic Configurations

*Coming soon - admin panel for topic management*

Planned commands:
- `/topic_config <topic_id>` - View topic configuration
- `/topic_edit <topic_id>` - Edit topic settings
- `/topic_stats <topic_id>` - View topic analytics
- `/approval_queue` - View pending approvals

---

## Testing

### Test Media-Only Validation (PNPtv Gallery)

1. Send text-only message in PNPtv Gallery
2. ✅ Message should be deleted
3. ✅ User receives DM warning
4. ✅ Violation tracked

### Test Auto-Mirror

1. Send photo/video in general chat
2. ✅ Media appears in PNPtv Gallery
3. ✅ Caption shows user attribution
4. ✅ Analytics updated

### Test Command Redirection

1. Send `/menu` in PNPtv News!
2. ✅ Command processed
3. ✅ Reply appears in Notifications topic
4. ✅ Redirect notice shown
5. ✅ Original command deleted after 30 seconds
6. ✅ Reply deleted after 5 minutes

### Test Approval Queue

1. Send content in Podcasts & Thoughts (as non-admin)
2. ✅ Message deleted from topic
3. ✅ Admins receive approval request
4. ✅ Admin clicks Approve/Reject
5. ✅ User notified of decision
6. ✅ If approved, post published

### Test Leaderboard

1. Share media in PNPtv Gallery
2. React to others' posts
3. Send `/leaderboard`
4. ✅ Rankings shown
5. ✅ Your stats reflected

---

## Troubleshooting

### Issue: Media mirror not working

**Check:**
- Is `GROUP_ID` set correctly in `.env`?
- Is the topic configuration initialized?
- Is media from general chat (no topic ID)?

```bash
# Verify configuration
node scripts/init-topic-configurations.js
```

### Issue: Commands not redirecting to Notifications

**Check:**
- Is middleware order correct in `bot.js`?
- Is topic ID `3135` correct?
- Is `GROUP_ID` set correctly?

### Issue: Leaderboard empty

**Check:**
- Is `track_posts` and `track_reactions` enabled?
- Have users posted media since enabling?
- Run query to verify:

```sql
SELECT * FROM topic_analytics WHERE topic_id = 3132;
```

### Issue: Approval queue not working

**Check:**
- Are `ADMIN_USER_IDS` set in `.env`?
- Is user actually non-admin?
- Check logs for errors:

```bash
pm2 logs pnptvbot --lines 100
```

---

## Environment Variables

Required environment variables for topic system:

```env
# Group configuration
GROUP_ID=-1003291737499

# Admin users (for approval queue)
ADMIN_USER_IDS=123456789,987654321

# Bot username (for profile links)
BOT_USERNAME=PNPtvBot
```

---

## API Reference

### TopicConfigModel

```javascript
const TopicConfigModel = require('./src/models/topicConfigModel');

// Get topic configuration
const config = await TopicConfigModel.getByThreadId(3132);

// Update configuration
await TopicConfigModel.upsert({
  topic_id: 3132,
  topic_name: 'PNPtv Gallery!',
  media_required: true,
  enable_leaderboard: true
});

// Get leaderboard
const topPosters = await TopicConfigModel.getLeaderboard(3132, 'media', 10);

// Track violation
await TopicConfigModel.trackViolation(userId, topicId, 'text_only');

// Update analytics
await TopicConfigModel.updateAnalytics(topicId, userId, username, {
  posts: 1,
  media: 1
});
```

---

## Future Enhancements

Planned features:
- [ ] Web admin panel for topic management
- [ ] Per-topic AI personality (different Cristina modes)
- [ ] Custom topic commands
- [ ] Advanced content filtering (NSFW detection)
- [ ] Topic-specific welcome messages
- [ ] Scheduled posts
- [ ] Topic templates
- [ ] Cross-topic content aggregation

---

## Contributors

- Carlos Martin (carlossmartdevices-cyber)
- Claude AI Assistant

---

## License

Proprietary - PNPtv Project

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/carlossmartdevices-cyber/pnptvbot-production/issues
- Email: support@pnptv.app
