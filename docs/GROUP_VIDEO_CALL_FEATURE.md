# Group Video Call Feature - `/startgroupcall`

## Overview

The `/startgroupcall` command allows group members to start native Telegram video chats in the configured community group. This feature leverages Telegram's built-in video chat infrastructure, providing a seamless experience without requiring external services.

**Implementation:** `src/bot/handlers/group/videoCall.js`

## Features

- 🎥 Native Telegram video chat integration
- 👥 Open access - any group member can start a call
- 📌 Auto-pins announcement messages for visibility
- 📊 Interactive buttons for participant and call info
- 🔒 Restricted to configured community group only
- ⚡ No external dependencies required

## How It Works

### Command Flow

1. **User triggers command:** Member types `/startgroupcall` in the group
2. **Validation:** Bot checks if command is used in the configured community group
3. **Video chat start:** Bot uses Telegram API to start native video chat
4. **Announcement:** Bot sends formatted message with call details
5. **Message pinning:** Announcement is auto-pinned (silent notification)

### Technical Implementation

```javascript
// Core functionality (src/bot/handlers/group/videoCall.js:54)
await ctx.telegram.requestVideoChatStart(communityGroupId);
```

**Key Steps:**
- Calls `ctx.telegram.requestVideoChatStart()` - Telegram Bot API method
- Waits 500ms for video chat initialization
- Sends announcement with inline keyboard buttons
- Pins message with `disable_notification: true`

## Configuration

### Required Environment Variables

```bash
# Bot authentication token
BOT_TOKEN=your_telegram_bot_token

# Target community group ID (negative number for groups)
GROUP_ID=-1003159260496

# Example valid group IDs:
# -1001234567890 (supergroup)
# -1003159260496 (group)
```

### Bot Permissions Required

The bot must have these permissions in the target group:

- ✅ **Can manage video chats** - Start video calls
- ✅ **Can send messages** - Post announcements
- ✅ **Can pin messages** - Pin call notifications

### Setup Instructions

1. **Add bot to group:**
   ```
   1. Open your Telegram group
   2. Click group name → "Add Members"
   3. Search for your bot (@your_bot_username)
   4. Add the bot as member
   ```

2. **Promote bot to admin:**
   ```
   1. Click group name → "Administrators"
   2. Add your bot
   3. Enable permissions:
      - Manage video chats
      - Send messages
      - Pin messages
   ```

3. **Get Group ID:**
   ```bash
   # Method 1: Use @RawDataBot
   # Forward any message from the group to @RawDataBot
   # Look for "chat": { "id": -1234567890 }

   # Method 2: Check bot logs
   # The bot logs the chat ID when receiving messages
   ```

4. **Configure .env:**
   ```bash
   GROUP_ID=-1003159260496  # Your group ID
   ```

## Usage

### Starting a Call

**In the community group, type:**
```
/startgroupcall
```

**Expected Result:**
- Native Telegram video chat starts immediately
- Announcement message appears with:
  - Host username
  - Start timestamp
  - Interactive buttons
- Message is auto-pinned to top of group

### Announcement Message Format

```markdown
🎥 GROUP VIDEO CALL STARTED

📱 Host: @username
👥 Community Video Call

🔴 Video call is now LIVE!

Tap the video call icon above to join directly 📲

⏱️ Started at: 2:30:45 PM
```

**Inline Buttons:**
- 👥 Participants - View group member count
- 📊 Call Info - Display room details

## Access Control

### Group Restriction

**Location:** `src/bot/handlers/group/videoCall.js:36-44`

```javascript
// Only allow command from the community group
if (ctx.chat.id !== communityGroupId) {
  await ctx.reply('❌ This command only works in the community group');
  return;
}
```

- ✅ Works ONLY in group matching `GROUP_ID`
- ❌ Returns error in other groups/chats
- ℹ️  Logs warning with chat IDs for debugging

### User Permissions

**Any group member can start calls** (no admin restriction)

```javascript
// Allow any group member to start calls (line 46-48)
const hostId = ctx.from.id;
const hostName = ctx.from.first_name || 'Member';
```

**Why open access?**
- Encourages community engagement
- Reduces friction for spontaneous calls
- Trust-based model for community groups

### Middleware Whitelisting

**Location:** `src/bot/core/middleware/groupCommandReminder.js:24`

```javascript
// Exceptions - these commands can work in groups
const allowedCommands = ['menu', 'start', 'help', 'startgroupcall'];
```

Most bot commands redirect users to private chat. `/startgroupcall` is explicitly whitelisted to work in groups.

## Related Commands

### `/inviteall` - Mass Invite

**Purpose:** Send call invites to all group members

**Usage:**
```
/inviteall [room_code]
```

**Restrictions:**
- ⚠️  Only group admins/creators can use
- Works in any group/supergroup
- Generates shareable join link

**Implementation:** `src/bot/handlers/group/videoCall.js:201-250`

### `/join_group_call` - Join from Private Chat

**Purpose:** Join an ongoing call from private message

**Usage:**
```
/join_group_call [room_code]
```

**Implementation:** `src/bot/handlers/group/videoCall.js:255-287`

### `/leavecall` - Exit Video Chat

**Purpose:** Leave the current video call

**Usage:**
```
/leavecall
```

**Implementation:** `src/bot/handlers/group/videoCall.js:292-313`

## Interactive Actions

### Button Handlers

**1. Show Participants** - Pattern: `group_call_participants_*`

```javascript
// Displays group member count
bot.action(/^group_call_participants_(.+)$/, async (ctx) => {
  const members = await ctx.getChatMembersCount();
  // Shows total member count and room status
});
```

**2. Show Call Info** - Pattern: `group_call_info_*`

```javascript
// Displays room code, status, and tips
bot.action(/^group_call_info_(.+)$/, async (ctx) => {
  // Shows room details and helpful tips
});
```

**3. End Call** - Pattern: `end_group_call_*`

```javascript
// Ends the call and updates message
bot.action(/^end_group_call_(.+)$/, async (ctx) => {
  await ctx.editMessageText(endMessage);
});
```

## Error Handling

### Common Errors

**1. GROUP_ID Not Configured**
```
Error: GROUP_ID environment variable not set
Response: ❌ Community group not configured
```

**Solution:** Set `GROUP_ID` in `.env` file

**2. Wrong Group**
```
Warning: Command used outside community group
Response: ❌ This command only works in the community group
```

**Solution:** Use command in the configured group

**3. Video Chat Start Failed**
```
Error: Failed to start video call
Response: ❌ Failed to start video call. Please try again.
```

**Possible causes:**
- Bot lacks "Manage video chats" permission
- Telegram API temporary issue
- Group restrictions on video calls

**Solution:** Check bot permissions and retry

**4. Pin Message Failed**
```
Warning: Could not pin message
```

**Impact:** Non-critical - call still works, just not pinned

**Solution:** Grant "Pin messages" permission to bot

### Logging

All operations are logged with context:

```javascript
logger.info('📱 /startgroupcall command received', {
  chatId: ctx.chat?.id,
  chatType: ctx.chat?.type,
  chatTitle: ctx.chat?.title,
  userId: ctx.from?.id,
  username: ctx.from?.username,
});
```

**Log levels:**
- **INFO** - Successful operations
- **WARN** - Non-critical issues (wrong group, pin failed)
- **ERROR** - Critical failures (API errors, missing config)

## Testing

### Development Environment Setup

**Prerequisites:**
- Node.js 18+
- Redis (for session management)
- PostgreSQL (for user/plan data)
- Valid `BOT_TOKEN`
- Configured `GROUP_ID`

**Start Bot:**
```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Edit .env and set:
# - BOT_TOKEN
# - GROUP_ID

# Start Redis
redis-server --daemonize yes

# Run in development mode
npm run dev
```

### Testing Checklist

- [ ] Bot starts without errors
- [ ] Command works in configured group
- [ ] Command rejected in other groups
- [ ] Video chat starts successfully
- [ ] Announcement message posted
- [ ] Message auto-pinned
- [ ] Participants button shows member count
- [ ] Call info button displays details
- [ ] Non-admin members can start calls
- [ ] Logging captures all events

### Manual Test Procedure

1. **Start bot in development:**
   ```bash
   npm run dev
   ```

2. **In Telegram group:**
   - Type `/startgroupcall`
   - Verify video chat starts
   - Check announcement appears
   - Confirm message is pinned
   - Click "Participants" button
   - Click "Call Info" button

3. **Test restrictions:**
   - Try command in different group (should fail)
   - Try as non-member (should fail)
   - Verify error messages are user-friendly

## Architecture Decisions

### Why Native Telegram?

**Chosen:** Telegram's built-in video chat API
**Alternatives considered:**
- Zoom integration
- Agora live streaming
- Custom WebRTC solution

**Rationale:**
- ✅ No external API costs
- ✅ Seamless user experience
- ✅ No additional authentication
- ✅ Telegram handles all infrastructure
- ✅ Better integration with group features

### Why Open Access?

**Chosen:** Any member can start calls
**Alternative:** Admin-only restriction

**Rationale:**
- Encourages community engagement
- Reduces friction for spontaneous calls
- Trust-based model works for community groups
- Admins can still moderate (remove members if abused)

### Why Auto-Pin?

**Chosen:** Silent pin (`disable_notification: true`)
**Alternative:** No pinning, or loud notifications

**Rationale:**
- High visibility for ongoing calls
- Silent to avoid notification spam
- Easy for members to find and join

## Code Structure

```
src/bot/handlers/group/videoCall.js
├── registerGroupVideoCallHandlers()
│   ├── /startgroupcall command handler
│   │   ├── Validate GROUP_ID exists
│   │   ├── Check correct group
│   │   ├── Start Telegram video chat
│   │   ├── Send announcement message
│   │   └── Pin message
│   ├── end_group_call_* action
│   ├── group_call_info_* action
│   ├── group_call_participants_* action
│   ├── /inviteall command handler
│   ├── /join_group_call command handler
│   └── /leavecall command handler
```

**Total Lines:** 317
**Dependencies:**
- `telegraf` - Telegram Bot Framework
- `logger` - Winston logging utility
- `i18n` - Internationalization (imported but not used)

## Security Considerations

### Input Validation

- Group ID validation (must match `GROUP_ID`)
- User ID logging for audit trail
- No sensitive data in messages

### Permission Checks

- Bot requires specific admin permissions
- Command restricted to one group
- User info logged (not stored)

### Privacy

- No call content stored
- No participant tracking beyond Telegram's native features
- User IDs logged for debugging only

## Performance

### Resource Usage

- **CPU:** Minimal - single API call per command
- **Memory:** Negligible - no call data stored
- **Network:** Low - announcement message only
- **Database:** None - no persistence required

### Scalability

- **Single group limitation:** One `GROUP_ID` per bot instance
- **Concurrent calls:** Limited by Telegram (1 per group)
- **Call duration:** No limit imposed by bot

### Optimization Opportunities

- [ ] Support multiple groups (array of `GROUP_ID`s)
- [ ] Track call analytics (duration, participants)
- [ ] Schedule recurring calls
- [ ] Integration with calendar

## Monitoring

### Key Metrics to Track

- Command invocations per day
- Success/failure rate
- Average calls per user
- Peak usage times
- Error frequency by type

### Recommended Logging

```javascript
// Add to analytics service
analytics.track('group_call_started', {
  group_id: ctx.chat.id,
  host_id: ctx.from.id,
  timestamp: new Date(),
});
```

## Future Enhancements

### Planned Features

- [ ] Multi-group support
- [ ] Call scheduling
- [ ] Participant notifications (via DM)
- [ ] Call recording integration
- [ ] Analytics dashboard
- [ ] Recurring call templates

### Community Requests

- Screen sharing detection/notification
- Auto-record to cloud storage
- Call summaries with AI
- Integration with calendar apps

## Troubleshooting

### Bot doesn't respond to command

**Check:**
1. Bot is running (`npm run dev` shows no errors)
2. Bot is member of group
3. GROUP_ID matches current group
4. No middleware blocking command

### Video chat doesn't start

**Check:**
1. Bot has "Manage video chats" permission
2. Group allows video calls (check group settings)
3. Telegram API status (check @BotNews)

### Message not pinned

**Check:**
1. Bot has "Pin messages" permission
2. Check bot logs for pin errors
3. Non-critical - call still works

### Wrong group error

**Check:**
1. Verify `GROUP_ID` in `.env` matches target group
2. Get correct group ID from @RawDataBot
3. Negative number required for groups

## Support

### Documentation
- Main docs: `/docs`
- API reference: `/docs/API.md`
- Deployment guide: `DEPLOYMENT_GUIDE.md`

### Contact
- Issues: GitHub Issues
- Support group: Set via `SUPPORT_GROUP_ID`
- Email: `support@pnptv.app`

## License

MIT License - See LICENSE file for details

---

**Last Updated:** 2025-11-23
**Version:** 1.0.0
**Maintained By:** PNPtv Development Team
