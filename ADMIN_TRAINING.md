# 👨‍💼 Admin Training Guide - Jitsi Moderator Bot

**Purpose:** Train admins on how to use the Jitsi Moderator Bot
**Target Audience:** Telegram bot admins
**Time Required:** 15 minutes
**Required:** Telegram app on phone or desktop

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Menu Buttons](#menu-buttons)
4. [Common Tasks](#common-tasks)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

---

## Overview

The **Jitsi Moderator Bot** lets you control Jitsi meeting rooms directly from Telegram without logging into the video conferencing platform.

### What You Can Do
✅ Mute all participants or specific users
✅ Kick disruptive participants from rooms
✅ Lock rooms (prevent new joins)
✅ Send announcements to the room
✅ Monitor who's in the room and violations
✅ Get room statistics and status

### Who Can Use It
🔒 **Only admins** can access moderator commands
- Your Telegram ID: `8365312597`
- Command: `/jitsimod`

### No Technical Skills Required
- Just click buttons
- No coding needed
- Simple, user-friendly interface

---

## Getting Started

### Step 1: Open the Moderator Panel

Send this message to the PNPtv bot:

```
/jitsimod
```

### Step 2: You'll See This Menu

```
🤖 Jitsi Moderator Bot

Control and moderate your Jitsi meetings automatically.
```

With 6 buttons below it.

### Step 3: Click Any Button

You're ready to start moderating!

---

## Menu Buttons

Each button has a specific purpose. Here's what each one does:

### Button 1: 📊 Room Status

**Purpose:** See what rooms the bot is in

**What You'll See:**
- Connection status (Connected or Not Connected)
- Number of active rooms
- List of room names
- Number of times bot tried to reconnect

**When to Use:**
- Before you start moderating
- To check if bot is working
- If you're not sure where the bot is

**Example Output:**
```
📊 Moderator Bot Status

Connected: ✅ Yes
Active Rooms: 1

Rooms:
• pnptv-main-1 (5 members)

Reconnect Attempts: 0
```

---

### Button 2: ➕ Join Room

**Purpose:** Make the bot join a Jitsi room so you can moderate it

**How It Works:**
1. Click the button
2. You'll get a message asking for the room name
3. Type the room name (e.g., `pnptv-main-1`)
4. Send the message
5. Bot joins the room ✅

**What to Enter:**
- Room name from Jitsi (not the full URL)
- Just the room name part
- Example: `pnptv-main-1`
- NOT: `https://meet.jit.si/pnptv-main-1`

**Example:**
```
📝 Join Room

Send the room name to join (e.g., pnptv-meeting-1)

[Me] pnptv-main-1
[Bot] ✅ Bot joined room: pnptv-main-1
```

---

### Button 3: 🔇 Mute All

**Purpose:** Silence all participants in the current room at once

**What It Does:**
- Mutes everyone's microphone
- People can still hear and see
- They can unmute themselves later
- Useful when you have background noise

**When to Use:**
- Announcements (mute everyone, you talk)
- Too much noise
- Someone has loud background noise
- Starting a presentation

**Result:**
```
✅ All participants muted
```

**Important:**
- Make sure bot is in the room first (click "Join Room")
- Participants can unmute themselves

---

### Button 4: 👥 Participants

**Purpose:** See everyone in the room

**What You'll See:**
- Names of all participants
- When they joined
- How many violations they have (if any)

**When to Use:**
- Before taking action (to see who's there)
- Checking if someone joined
- Monitoring troublemakers
- Counting attendees

**Example Output:**
```
👥 Participants in pnptv-main-1

Total: 5

1. Alice
   Joined: 02:45:30 PM

2. Bob
   Joined: 02:46:15 PM
   ⚠️ Violations: 2

3. Charlie
   Joined: 02:50:00 PM
```

**Red Flags:**
- If someone has 3+ violations, consider muting them
- If someone has 5+ violations, consider kicking them

---

### Button 5: ⚙️ Settings

**Purpose:** Access advanced moderation tools

**What You Can Do:**
- Send messages to the room
- Lock the room (prevent new joins)
- View current settings

**Sub-buttons You'll See:**
- 💬 Send Message
- 🔒 Lock Room
- ← Back

**When to Use Settings:**
- Need to announce something specific
- Want to prevent more people from joining
- Need to access other moderation tools

**Example:**
```
⚙️ Moderator Settings

Room: pnptv-main-1
Auto-Moderation: ✅ On
Mute Threshold: 3 violations
Kick Threshold: 5 violations
```

---

#### Sub-Button: 💬 Send Message

**Purpose:** Send an announcement to everyone in the room

**How It Works:**
1. Click "Send Message"
2. Type your message
3. Send it
4. Everyone in room sees it

**What to Send:**
- Rules reminders
- Announcements
- Meeting info
- Requests to mute/unmute

**Good Examples:**
- "Please mute when not speaking"
- "Meeting starts in 5 minutes"
- "Follow community guidelines"
- "Welcome to PNPtv!"

---

#### Sub-Button: 🔒 Lock Room

**Purpose:** Prevent new people from joining

**What It Does:**
- No new participants can join
- Current participants stay
- Useful to prevent disruptions

**When to Use:**
- Meeting already in progress
- Too many people
- Someone is causing trouble
- Sensitive discussion

**Result:**
```
🔒 Room locked
```

**Remember:** You can unlock it later by clicking the button again

---

### Button 6: 🚪 Leave Room

**Purpose:** Make the bot exit the room

**What It Does:**
- Bot leaves the room
- Stops moderating
- You can join a different room

**When to Use:**
- Meeting is over
- You need to moderate a different room
- Bot is no longer needed

**Result:**
```
✅ Left room: pnptv-main-1
```

---

## Common Tasks

### Task 1: Moderate a Meeting

**Step-by-Step:**

1. **Open the menu**
   ```
   /jitsimod
   ```

2. **Join the room**
   - Click: `➕ Join Room`
   - Type: Room name (e.g., `pnptv-main-1`)
   - Send

3. **Monitor participants**
   - Click: `👥 Participants`
   - Watch for violations
   - Refresh by clicking again

4. **Mute if needed**
   - Click: `🔇 Mute All` (for everyone)
   - Or go to `⚙️ Settings` for specific controls

5. **When done**
   - Click: `🚪 Leave Room`

---

### Task 2: Deal with Disruptive User

**When Someone is Causing Problems:**

1. **Click:** `👥 Participants`
   - Identify the troublemaker
   - Note their name

2. **Check violations**
   - See how many violations they have
   - 3+ = should be muted
   - 5+ = should be kicked

3. **Take action**
   - At 3 violations: Bot auto-mutes them
   - At 5 violations: Bot auto-kicks them
   - OR manually kick from settings

---

### Task 3: Make an Announcement

**To Tell Everyone Something:**

1. **Open menu:** `/jitsimod`

2. **Go to settings:** Click `⚙️ Settings`

3. **Send message:** Click `💬 Send Message`

4. **Type:** Your announcement
   - Example: "Please mute when not speaking"

5. **Send:** Everyone in room sees it

---

### Task 4: Start a Serious Meeting

**To Prevent Interruptions:**

1. **Join room:** `➕ Join Room`
   - Type room name

2. **Mute everyone:** `🔇 Mute All`
   - Prevents background noise
   - You can speak clearly

3. **Lock room:** `⚙️ Settings` → `🔒 Lock Room`
   - No new people can join
   - Can't miss announcements

4. **Unlock when done:** Click lock button again

---

## Best Practices

### ✅ DO

- ✅ **Check participant list** before taking action
- ✅ **Warn users** (send message) before muting all
- ✅ **Use violations** as a guide (3+ = mute, 5+ = kick)
- ✅ **Monitor actively** during important meetings
- ✅ **Leave room** when meeting ends
- ✅ **Test** with a test room first
- ✅ **Give time** for users to react to warnings

### ❌ DON'T

- ❌ **Mute everyone** without warning
- ❌ **Kick first, ask questions later**
- ❌ **Leave bot in room** when not moderating
- ❌ **Ignore violations** - they indicate problems
- ❌ **Use for harassment** - only for legitimate moderation
- ❌ **Forget to unlock** rooms after locking

---

## Troubleshooting

### Problem 1: `/jitsimod` Command Doesn't Appear

**Cause:** You're not an admin

**Solution:**
- Check your Telegram ID
- Verify it matches ADMIN_ID in bot config
- Ask the bot owner if you should be an admin

**How to Get Your ID:**
- Message `@userinfobot` on Telegram
- It replies with your ID
- Share it with the bot owner

---

### Problem 2: "Bot Not in Room" Error

**Cause:** Bot hasn't joined the room yet

**Solution:**
1. Click `➕ Join Room`
2. Type the room name
3. Wait for confirmation
4. Try your action again

---

### Problem 3: Buttons Don't Respond

**Cause:** Bot is not responding

**Solution:**
1. Wait a few seconds
2. Click again
3. If still stuck, restart the bot (ask owner)
4. Try opening menu again: `/jitsimod`

---

### Problem 4: Wrong Room Name

**Cause:** You typed the wrong Jitsi room name

**Solution:**
1. Leave the room: `🚪 Leave Room`
2. Join again: `➕ Join Room`
3. Type correct room name this time

**Get Room Name:**
- Look at Jitsi URL: `https://meet.jit.si/YOUR-ROOM-NAME`
- Copy the room name part only
- Paste it when joining

---

### Problem 5: Participants List is Empty

**Cause:** Nobody is in the room yet

**Solution:**
- Wait for people to join
- Check that you're in the right room
- Ask people to join the meeting

---

## Advanced Usage

### Feature: Auto-Moderation

The bot **automatically** takes action based on violations:

```
Violation 1-2: Tracked (no action)
Violation 3: AUTO-MUTED (by bot)
Violation 4: Continues muted
Violation 5: AUTO-KICKED (by bot)
```

**You don't need to do anything!** The bot handles it.

---

### Feature: Real-Time Monitoring

```
/jitsimod → 👥 Participants → 🔄 Refresh
```

Click "Refresh" to see live updates of who's in the room.

---

### Feature: Event Logging

Every action is logged:
- When people join/leave
- When violations are recorded
- When muting/kicking happens
- All timestamps recorded

**For debugging:** Ask bot owner to check logs

---

## Quick Reference Card

Print this and keep at your desk:

```
────────────────────────────────────
JITSI MODERATOR BOT - QUICK GUIDE
────────────────────────────────────

OPEN:           /jitsimod

BUTTONS:
📊 Status       → See active rooms
➕ Join         → Bot joins room
🔇 Mute All     → Silence everyone
👥 Participants → See who's here
⚙️ Settings     → Announce, lock room
🚪 Leave        → Bot exits room

VIOLATIONS:
3+ violations   → Auto-muted
5+ violations   → Auto-kicked

TIPS:
• Always join room first
• Refresh participants to see updates
• Warn before muting all
• Lock room to prevent joins
• Leave when done

HELP:
Read: JITSI_MODERATOR_QUICK_REF.md
────────────────────────────────────
```

---

## Key Reminders

### Remember These 3 Things:

1. **Join First**
   - Must click `➕ Join Room` before other commands work

2. **Check First**
   - Click `👥 Participants` before taking action

3. **Leave Last**
   - Click `🚪 Leave Room` when meeting ends

### The 3 Main Actions:

1. **Mute** - `🔇 Mute All`
2. **Monitor** - `👥 Participants`
3. **Lock** - `⚙️ Settings` → `🔒 Lock Room`

---

## FAQ (Frequently Asked Questions)

**Q: Can I mute just one person?**
A: The current version mutes everyone. In future, specific user muting will be available.

**Q: Can I see violations on a specific user?**
A: Yes, click `👥 Participants` and look for "Violations: X" next to their name.

**Q: What happens if I lock the room?**
A: No new people can join, but current participants stay.

**Q: Can I undo a lock?**
A: Yes, click the lock button again to unlock.

**Q: What if someone leaves and comes back?**
A: They start with 0 violations again.

**Q: Does the bot work in my phone's Telegram app?**
A: Yes! All buttons work on phone and desktop.

**Q: Who else can see the moderator menu?**
A: Only the admin (you). Others won't see `/jitsimod`.

**Q: What if the bot stops responding?**
A: Restart the bot (ask the owner) and try again.

---

## Support Resources

**For Quick Reference:**
- 📋 [JITSI_MODERATOR_QUICK_REF.md](JITSI_MODERATOR_QUICK_REF.md)

**For Full Details:**
- 📖 [JITSI_MODERATOR_README.md](JITSI_MODERATOR_README.md)

**For Technical Info:**
- 💻 [JITSI_MODERATOR_BOT.md](JITSI_MODERATOR_BOT.md)

**For Code Examples:**
- 📝 [examples/jitsi-moderator-examples.js](examples/jitsi-moderator-examples.js)

---

## Practice Exercises

### Exercise 1: Open the Menu
- Send `/jitsimod`
- Expected: Menu appears with 6 buttons
- ✅ Success!

### Exercise 2: Join a Test Room
- Click `➕ Join Room`
- Type: `test-room`
- Expected: Confirmation message
- ✅ Success!

### Exercise 3: View Participants
- Click `👥 Participants`
- Expected: Participant list (may be empty)
- Click `🔄 Refresh` to update
- ✅ Success!

### Exercise 4: Leave the Room
- Click `🚪 Leave Room`
- Expected: Confirmation message
- ✅ Success!

---

## Certification

After completing this training, you should be able to:

- ✅ Open the moderator menu with `/jitsimod`
- ✅ Join a Jitsi room
- ✅ View participants list
- ✅ Mute all participants
- ✅ Send announcements
- ✅ Lock/unlock rooms
- ✅ Leave a room
- ✅ Handle common issues
- ✅ Know when to take action
- ✅ Refer to help docs

**Great Job!** You're now trained on the Jitsi Moderator Bot! 🎉

---

## Next Steps

1. **Practice** with the exercises above
2. **Bookmark** the quick reference guide
3. **Read** the full documentation for details
4. **Start moderating** your Jitsi meetings!

---

**Questions?** Check [JITSI_MODERATOR_BOT.md](JITSI_MODERATOR_BOT.md) → Troubleshooting

**Ready?** Start with: `/jitsimod`

**Happy Moderating! 🎉**

---

**Document Version:** 1.0
**Last Updated:** January 2024
**For:** PNPtv Bot Admins