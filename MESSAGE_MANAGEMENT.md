# PNPtv Message Management System

A comprehensive message management system to keep the group chat clean, organized, and secure.

## Features

### ✅ Chat Cleanup Middleware
**Auto-delete commands and bot messages after 90 seconds**

- Automatically removes user commands (messages starting with `/`)
- Removes bot responses to commands
- Keeps the group chat clutter-free
- Configurable delay (default: 90 seconds)

### ✅ Personal Information Filter
**Protect users by filtering personal data**

Detects and removes messages containing:
- Phone numbers
- Email addresses
- Credit card numbers
- Social security numbers
- Home addresses
- Personal contact information

**Protection Features:**
- Deletes message immediately
- Sends warning in group (auto-deletes after 60 seconds)
- Sends detailed safety tips via private message
- Educates users about online privacy
- Bilingual support (English/Spanish)

### ✅ Group Cleanup Service
**Scheduled cleanup of old messages every 7 days**

- Runs automatically every 7 days at 3:00 AM
- Deletes non-media messages older than 7 days
- Preserves all media files (photos, videos, documents, stickers, etc.)
- Tracks messages in memory for efficient cleanup
- Rate-limited deletion to avoid API limits

## Setup

### 1. Enable Chat Cleanup

Chat cleanup middleware is **enabled by default** and runs automatically.

**Customize delay:**
```javascript
// src/bot/core/bot.js
bot.use(chatCleanupMiddleware(120 * 1000)); // 2 minutes instead of 90 seconds
```

### 2. Enable Group Cleanup Service

Add to your `.env` file:
```bash
ENABLE_GROUP_CLEANUP=true
```

**Configure settings:**
Edit `src/bot/services/groupCleanupService.js`:
```javascript
const CLEANUP_INTERVAL_DAYS = 7;  // Run every 7 days
const MESSAGE_RETENTION_DAYS = 7;  // Delete messages older than 7 days
```

**Change schedule:**
```javascript
// Run every 3 days instead of 7
this.cronJob = cron.schedule('0 3 */3 * *', ...)

// Run weekly on Sunday at 3 AM
this.cronJob = cron.schedule('0 3 * * 0', ...)

// Run daily at midnight
this.cronJob = cron.schedule('0 0 * * *', ...)
```

### 3. Restart Bot

```bash
pm2 restart pnptvbot
```

## How It Works

### Chat Cleanup Middleware

**Flow:**
1. User sends command: `/menu`
2. Bot processes command and replies
3. Middleware schedules deletion after 90 seconds
4. After 90 seconds, both command and bot reply are deleted

**What gets deleted:**
- User commands (any message starting with `/`)
- Bot replies to commands
- Bot messages sent via `scheduleMessageDeletion()` helper

**What's preserved:**
- Regular user messages
- Media messages
- Messages in private chats

**Example usage in code:**
```javascript
const { scheduleMessageDeletion } = require('./middleware/chatCleanup');

// Send a temporary bot message
const sentMessage = await ctx.reply('This will be deleted in 90 seconds');

// Schedule deletion
scheduleMessageDeletion(ctx.telegram, sentMessage, 90000);
```

### Personal Information Filter

**Detection patterns:**
- **Phone numbers:** `+1-555-123-4567`, `(555) 123-4567`, `555-123-4567`
- **Email addresses:** `user@example.com`
- **Credit cards:** `1234 5678 9012 3456`, `1234-5678-9012-3456`
- **SSN:** `123-45-6789`, `123 45 6789`
- **Addresses:** `123 Main Street`, `456 Oak Avenue`
- **Keywords:** "my phone", "email me", "call me at", etc.

**Flow:**
1. User posts message with phone number
2. Middleware detects personal information
3. Message is immediately deleted
4. Warning posted in group (60-second auto-delete)
5. Detailed safety tips sent via private message

**Example warning (Group):**
```
⚠️ @username, your message was removed for your safety.

🔒 We detected personal information:
• phone number
• email address

For your protection:
• Never share personal information in public groups
• Use private messages for sensitive info

📨 Send me a private message: @PNPtvBot
```

**Example warning (Private Message):**
```
🔒 Personal Information Detected

Hey username, your message in PNPtv was removed because it contained personal information.

Types detected:
• phone number
• email address

Safety tips:
• Never share phone numbers in public groups
• Don't post email addresses publicly
• Keep financial information private
• Use private messages for sensitive info
```

**Exemptions:**
- Admin messages are not filtered
- Private messages are not filtered
- Only works in configured GROUP_ID

### Group Cleanup Service

**Message tracking:**
```javascript
// Each message is tracked with:
{
  timestamp: 1234567890,      // When message was sent
  hasMedia: false,            // Whether message contains media
  chatId: -1001234567890,     // Group chat ID
  userId: 123456789           // User ID
}
```

**Cleanup process:**
1. Cron job runs every 7 days at 3:00 AM
2. Checks all tracked messages
3. Identifies messages older than 7 days
4. Skips messages with media
5. Deletes non-media messages
6. Removes entries from tracker

**What gets deleted:**
- Text messages older than 7 days
- Command messages older than 7 days
- Bot responses older than 7 days

**What's preserved:**
- All media messages (photos, videos, documents, GIFs, stickers, voice, audio)
- Messages newer than 7 days
- Pinned messages (if applicable)

**Statistics tracking:**
```javascript
const stats = groupCleanupService.getStats();
console.log(stats);
// {
//   isEnabled: true,
//   trackedMessages: 5000,
//   eligibleForDeletion: 1200,
//   mediaMessages: 800,
//   recentMessages: 3000,
//   retentionDays: 7,
//   cleanupIntervalDays: 7
// }
```

## Testing

### Test Chat Cleanup

```javascript
// Send a command
/menu

// Wait 90 seconds
// Command and bot reply should be auto-deleted
```

### Test Personal Info Filter

```javascript
// Try sending in group (as non-admin):
My phone is 555-123-4567
Email me at test@example.com

// Message should be deleted immediately
// Warning should appear in group
// DM should be sent with safety tips
```

### Test Group Cleanup Service

**Manual trigger:**
```javascript
const GroupCleanupService = require('./src/bot/services/groupCleanupService');
const service = new GroupCleanupService(bot);
service.initialize();

// Trigger manual cleanup
await service.manualCleanup();
```

**Check stats:**
```javascript
const stats = groupCleanupService.getStats();
console.log(JSON.stringify(stats, null, 2));
```

## Monitoring

### Chat Cleanup Logs

```bash
# See cleanup activity
pm2 logs pnptvbot | grep "Auto-deleted\|Scheduled.*deletion"

# Example output:
# Auto-deleted command message { messageId: 123, command: '/menu' }
# Scheduled message deletion { messageId: 456, delayMs: 90000 }
```

### Personal Info Filter Logs

```bash
# See filtered messages
pm2 logs pnptvbot | grep "personal info"

# Example output:
# Deleted message with personal info { userId: 123, types: ['phone number', 'email'] }
# Sent personal info warning to user via DM { userId: 123 }
```

### Group Cleanup Logs

```bash
# See cleanup jobs
pm2 logs pnptvbot | grep "cleanup"

# Example output:
# 🧹 Starting group cleanup job...
# Found 1200 messages to delete
# ✅ Group cleanup job completed:
#   • Deleted: 1150 messages
#   • Skipped (media): 800 messages
#   • Errors: 50
#   • Tracked messages: 3000
```

## Troubleshooting

### Commands Not Being Deleted

**Check logs:**
```bash
pm2 logs pnptvbot --lines 100 | grep "chatCleanup"
```

**Verify middleware is enabled:**
Look for: `bot.use(chatCleanupMiddleware());` in `src/bot/core/bot.js`

**Check GROUP_ID:**
```bash
echo $GROUP_ID
```

### Personal Info Not Being Filtered

**Test detection:**
```javascript
const { detectPersonalInfo } = require('./src/bot/core/middleware/personalInfoFilter');

const result = detectPersonalInfo('Call me at 555-123-4567');
console.log(result);
// { detected: true, types: ['phone number'] }
```

**Check if user is admin:**
Admins are exempt from personal info filtering

### Group Cleanup Not Running

**Verify enabled:**
```bash
cat .env | grep ENABLE_GROUP_CLEANUP
# Should show: ENABLE_GROUP_CLEANUP=true
```

**Check GROUP_ID:**
```bash
cat .env | grep GROUP_ID
```

**Verify cron job:**
```bash
pm2 logs pnptvbot | grep "Group cleanup service"
# Should show: ✓ Group cleanup service initialized
```

**Manual trigger for testing:**
```javascript
await groupCleanupService.manualCleanup();
```

## Configuration

### Chat Cleanup Delay

**Global default:**
```javascript
// src/bot/core/middleware/chatCleanup.js
const CLEANUP_DELAY = 90 * 1000; // 90 seconds
```

**Per-middleware:**
```javascript
// src/bot/core/bot.js
bot.use(chatCleanupMiddleware(120 * 1000)); // 2 minutes
```

**Helper function:**
```javascript
scheduleMessageDeletion(telegram, message, 60000); // 1 minute
```

### Personal Info Patterns

**Add custom patterns:**
```javascript
// src/bot/core/middleware/personalInfoFilter.js
const PATTERNS = {
  // Add new pattern
  customPattern: /your-regex-here/g,
};

// Update detection function
if (PATTERNS.customPattern.test(text)) {
  detectedTypes.push('custom pattern');
}
```

**Disable specific detections:**
```javascript
// Comment out patterns you don't want to detect
// if (PATTERNS.phone.test(text)) {
//   detectedTypes.push('phone number');
// }
```

### Group Cleanup Settings

**Retention period:**
```javascript
const MESSAGE_RETENTION_DAYS = 7;  // Change to 14, 30, etc.
```

**Cleanup interval:**
```javascript
const CLEANUP_INTERVAL_DAYS = 7;  // Change to 3, 14, etc.
```

**Cleanup schedule:**
```javascript
// Every 7 days at 3 AM
cron.schedule('0 3 */7 * *', ...)

// Daily at midnight
cron.schedule('0 0 * * *', ...)

// Weekly on Sunday at 2 AM
cron.schedule('0 2 * * 0', ...)
```

**Rate limiting:**
```javascript
// Delay between message deletions (default: 100ms)
await new Promise(resolve => setTimeout(resolve, 100));
```

## Best Practices

### Chat Cleanup

1. **Don't overuse auto-delete**
   - Only use for temporary messages
   - Let important messages stay
   - Consider user experience

2. **Adjust delay appropriately**
   - 90 seconds for most commands
   - Longer for complex responses
   - Shorter for simple confirmations

3. **Use helper function**
   - Always use `scheduleMessageDeletion()`
   - Don't manually set timeouts
   - Consistent logging

### Personal Info Filter

1. **Test patterns thoroughly**
   - Avoid false positives
   - Balance safety vs. usability
   - Monitor logs for issues

2. **Update warning messages**
   - Keep messages friendly
   - Educate, don't scold
   - Provide clear alternatives

3. **Maintain exemptions**
   - Admins should be exempt
   - Private chats don't need filtering
   - Consider trusted users

### Group Cleanup

1. **Choose appropriate retention**
   - Too short: users lose history
   - Too long: bloated chat
   - 7 days is a good default

2. **Monitor performance**
   - Check deletion counts
   - Watch for errors
   - Adjust rate limits if needed

3. **Preserve important content**
   - Always preserve media
   - Consider pinned messages
   - Archive before deleting

## Architecture

```
src/
├── bot/
│   ├── core/
│   │   ├── middleware/
│   │   │   ├── chatCleanup.js          # Auto-delete middleware
│   │   │   └── personalInfoFilter.js   # Personal info detection
│   │   └── bot.js                       # Register middlewares
│   └── services/
│       └── groupCleanupService.js       # Scheduled cleanup

Flow:
Message → chatCleanup → personalInfoFilter → [other middleware]
                                              ↓
                                    Group Cleanup Service
                                    (runs every 7 days)
```

## Security & Privacy

### Chat Cleanup
- ✅ Only deletes in configured group
- ✅ Preserves user privacy
- ✅ No message content stored
- ✅ Graceful error handling

### Personal Info Filter
- ✅ Immediate deletion of sensitive data
- ✅ User education via DM
- ✅ No storage of detected info
- ✅ Comprehensive pattern matching
- ✅ Admin exemptions

### Group Cleanup
- ✅ Only stores message IDs and metadata
- ✅ No message content stored
- ✅ Media files preserved
- ✅ Automatic memory cleanup
- ✅ Rate-limited operations

## Support

For issues or questions:
- Check logs: `pm2 logs pnptvbot`
- Review configuration files
- Test individual components
- Verify environment variables
- Monitor cleanup jobs
