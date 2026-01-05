# Jitsi Moderator Bot - Deployment Checklist

Complete this checklist to successfully deploy the Jitsi Moderator Bot to your Telegram bot.

## Pre-Deployment

### ✅ Files Verification

- [ ] `/src/bot/services/jitsiModeratorBot.js` exists (core service)
- [ ] `/src/bot/handlers/moderation/jitsiModerator.js` exists (telegram handler)
- [ ] `JITSI_MODERATOR_README.md` exists (main docs)
- [ ] `JITSI_MODERATOR_BOT.md` exists (full docs)
- [ ] `JITSI_MODERATOR_INTEGRATION.md` exists (setup guide)
- [ ] `JITSI_MODERATOR_QUICK_REF.md` exists (quick ref)
- [ ] `examples/jitsi-moderator-examples.js` exists (examples)

### ✅ Code Review

- [ ] Reviewed `jitsiModeratorBot.js` service code
- [ ] Reviewed `jitsiModerator.js` handler code
- [ ] Checked for security issues
- [ ] Verified error handling
- [ ] Checked logging statements

### ✅ Environment Setup

- [ ] Created or updated `.env` file
- [ ] Set `JITSI_DOMAIN=meet.jit.si`
- [ ] Set `JITSI_MUC_DOMAIN=conference.jit.si`
- [ ] Set `JITSI_BOT_PASSWORD` (if needed)
- [ ] Set `ADMIN_ID` to your Telegram ID
- [ ] Verified all vars are correct

### ✅ Get Your Telegram ID

- [ ] Message `@userinfobot` on Telegram
- [ ] Received your ID number
- [ ] Set it in `.env` as `ADMIN_ID`

## Integration Steps

### ✅ Step 1: Update `/src/bot/core/bot.js`

#### Import Handler (Line ~33)
- [ ] Found handler import section
- [ ] Added: `const registerJitsiModeratorHandlers = require('../handlers/moderation/jitsiModerator');`
- [ ] Line matches format of other imports

#### Register Handler (Line ~173)
- [ ] Found handler registration section
- [ ] Added: `registerJitsiModeratorHandlers(bot);`
- [ ] Line is after other handlers are registered
- [ ] Syntax is correct (no typos)

### ✅ Step 2: Verify Integration

- [ ] Saved all changes
- [ ] No syntax errors in bot.js
- [ ] All imports are correct
- [ ] All registrations are present

## Testing

### ✅ Pre-Test Setup

- [ ] Stopped any running bot instance
- [ ] Cleared any error logs
- [ ] Verified network connectivity
- [ ] Have a test Jitsi room ready

### ✅ Start Bot

```bash
npm start
```

- [ ] Bot starts without errors
- [ ] No critical errors in logs
- [ ] Look for: "✓ Jitsi Moderator handlers registered"

### ✅ Test Command

Send to your Telegram bot:
```
/jitsimod
```

Expected response:
- [ ] Menu appears with 6 buttons
- [ ] Text says "🤖 *Jitsi Moderator Bot*"
- [ ] Buttons are clickable

### ✅ Test Join Room

1. Click **"➕ Join Room"** button
2. Send a test room name (e.g., `test-room-123`)

Expected:
- [ ] Get confirmation message
- [ ] Message says "✅ Bot joined room: test-room-123"
- [ ] Ready for moderation message appears

### ✅ Test Participants

1. Click **"👥 Participants"** button

Expected:
- [ ] Shows participant list (may be empty or show participants if room exists)
- [ ] Format is correct
- [ ] Can refresh with "🔄 Refresh" button

### ✅ Test Room Status

1. Click **"📊 Room Status"** button

Expected:
- [ ] Shows connection status
- [ ] Lists active rooms
- [ ] Can refresh

### ✅ Test Leave Room

1. Click **"🚪 Leave Room"** button

Expected:
- [ ] Get confirmation
- [ ] Message says "✅ Left room: test-room-123"

### ✅ Test Back Navigation

- [ ] Click "← Back" button from any menu
- [ ] Returns to main menu
- [ ] Can navigate to different sections

## Development Testing

### ✅ Test Error Handling

- [ ] Try invalid room name
- [ ] Try commands when not in room
- [ ] Check error messages are helpful

### ✅ Test Events

Check logs for event messages:
- [ ] "Bot event: Joined room X"
- [ ] "Bot event: X joined room Y"
- [ ] "Bot action: Muted X in room Y"

### ✅ Test Auto-Moderation (Optional)

```javascript
// In development, you can manually test:
const moderatorBot = require('./src/bot/services/jitsiModeratorBot');

(async () => {
    const bot = new moderatorBot();
    await bot.joinRoom('test');
    bot.addParticipant('test', { id: 'u1', name: 'Test' });

    // Record violations
    for (let i = 0; i < 6; i++) {
        await bot.recordViolation('test', 'u1', 'spam');
    }
})();
```

- [ ] Violations are recorded
- [ ] Auto-mute triggers at threshold
- [ ] Auto-kick triggers at threshold
- [ ] Events are logged

## Production Deployment

### ✅ Pre-Production Checklist

- [ ] All tests passed
- [ ] No error logs
- [ ] Moderator commands working
- [ ] All buttons responsive
- [ ] Admin access verified

### ✅ Production Environment

- [ ] Set all production env vars
- [ ] Using production database
- [ ] Using production Jitsi server (if different)
- [ ] Using webhook mode (not polling)

### ✅ Deploy

Choose your deployment method:

**Docker:**
- [ ] Updated Dockerfile if needed
- [ ] Rebuilt image
- [ ] Deployed new image
- [ ] Verified bot is running

**Manual:**
- [ ] Pulled latest code
- [ ] Ran `npm install`
- [ ] Ran `npm start`
- [ ] Verified bot is running

**PM2:**
- [ ] Updated ecosystem.config.js
- [ ] Ran `pm2 restart all`
- [ ] Verified processes are running

### ✅ Verify Deployment

- [ ] Bot is responding to `/jitsimod`
- [ ] No error logs in production
- [ ] All features working
- [ ] Moderator actions executing

## Post-Deployment

### ✅ Admin Training

- [ ] Show admin how to use `/jitsimod`
- [ ] Explain each button function
- [ ] Demonstrate muting/kicking
- [ ] Show participant list
- [ ] Explain room status

### ✅ Documentation

- [ ] Provide link to `JITSI_MODERATOR_README.md`
- [ ] Share quick reference: `JITSI_MODERATOR_QUICK_REF.md`
- [ ] Link to full docs: `JITSI_MODERATOR_BOT.md`
- [ ] Share examples file

### ✅ Monitoring

Set up monitoring for:
- [ ] Bot uptime
- [ ] Error logs
- [ ] Command usage
- [ ] Room moderation actions

### ✅ Maintenance Plan

- [ ] Regular log review
- [ ] Monitor for errors
- [ ] Update thresholds if needed
- [ ] Gather admin feedback
- [ ] Plan improvements

## Troubleshooting Checklist

### If Bot Doesn't Start

- [ ] Check all imports are correct in bot.js
- [ ] Verify syntax (no typos)
- [ ] Check error message in logs
- [ ] Verify environment variables
- [ ] Try: `npm run validate:env`

### If `/jitsimod` Doesn't Work

- [ ] Verify you set `ADMIN_ID` to your Telegram ID
- [ ] Check handler is registered in bot.js
- [ ] Restart bot: `npm start`
- [ ] Try again after 10 seconds
- [ ] Check logs for errors

### If Buttons Don't Work

- [ ] Make sure handler is registered
- [ ] Check bot logs for errors
- [ ] Verify Jitsi configuration
- [ ] Try joining a room first

### If Join Room Fails

- [ ] Check Jitsi room name is correct
- [ ] Verify room exists
- [ ] Check `JITSI_DOMAIN` is correct
- [ ] Check network connectivity
- [ ] Review error message

## Rollback Plan

If something goes wrong:

1. Stop bot: `npm stop` or `Ctrl+C`
2. Remove handler from bot.js:
   - Delete import line
   - Delete registration line
3. Restart bot: `npm start`
4. Bot will work as before without moderator

## Success Criteria

✅ **Bot starts successfully** - No critical errors
✅ **`/jitsimod` command works** - Menu appears
✅ **Can join rooms** - Bot joins when commanded
✅ **Can view participants** - List displays correctly
✅ **Navigation works** - All buttons functional
✅ **Logging works** - Actions appear in logs
✅ **Error handling works** - Helpful error messages
✅ **Admin verified** - Only admin can use

## Final Verification

- [ ] Bot is running: `npm start`
- [ ] `/jitsimod` command works
- [ ] Admin can join a room
- [ ] Room status displays
- [ ] Participants list shows
- [ ] Navigation buttons work
- [ ] Leave room works
- [ ] No error logs
- [ ] Documentation is accessible
- [ ] Admin is trained

## Sign-Off

- [ ] Developer: Verified code quality
- [ ] Tester: All features tested
- [ ] Admin: Commands work as expected
- [ ] Ready for production ✅

---

## Quick Reference

**Files to modify:**
1. `.env` - Add environment variables
2. `/src/bot/core/bot.js` - Import and register handler

**Files created:**
1. `/src/bot/services/jitsiModeratorBot.js`
2. `/src/bot/handlers/moderation/jitsiModerator.js`
3. `JITSI_MODERATOR_README.md`
4. `JITSI_MODERATOR_BOT.md`
5. `JITSI_MODERATOR_INTEGRATION.md`
6. `JITSI_MODERATOR_QUICK_REF.md`
7. `examples/jitsi-moderator-examples.js`

**Test command:**
```
/jitsimod
```

**Expected result:**
Menu with 6 buttons appears

---

Date Completed: _______________
Completed By: _______________
Notes: _______________

---

✅ Ready to go live!
