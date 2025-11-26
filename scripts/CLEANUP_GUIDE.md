# Group Message Cleanup Guide

This guide explains how to clean up text messages from your Telegram group while preserving media messages.

## 🎯 Goal

Delete all **text-only messages** from the group, EXCEPT:
- ✅ Messages sent today
- ✅ All media messages (photos, videos, documents, etc.)

---

## 📋 Available Methods

### Method 1: Python Script with Telethon (RECOMMENDED)

This is the most reliable method as it has full access to message history.

#### Prerequisites

```bash
# Install Python dependencies
pip install telethon python-dotenv
```

#### Setup

1. Get Telegram API credentials from https://my.telegram.org
   - Login with your phone number
   - Go to "API development tools"
   - Create an application
   - Copy your `api_id` and `api_hash`

2. Add to your `.env` file:
   ```bash
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE=+1234567890  # Your phone number (optional)
   GROUP_ID=-1001234567890  # Your group ID
   ```

#### Run the Script

```bash
python scripts/cleanup-text-messages.py
```

The script will:
1. Ask you to login with your phone number (if not in .env)
2. Send you a verification code
3. Show you which messages will be deleted
4. Ask for confirmation
5. Delete messages in batches of 100

#### What it does:

- ✅ Preserves all media messages (photos, videos, stickers, documents, audio)
- ✅ Preserves all text messages from today
- ❌ Deletes all other text-only messages
- 📊 Shows detailed progress and summary

---

### Method 2: Manual Cleanup (Telegram Desktop)

If you prefer not to use scripts:

1. Open Telegram Desktop
2. Navigate to your group
3. Click the three dots menu → "Select messages"
4. Click the first message to delete
5. Hold **Shift** and click the last message (selects range)
6. Click **Delete**
7. Repeat as needed

**Note:** This method:
- ✅ Simple and visual
- ❌ Cannot filter by message type (text vs media)
- ❌ Time-consuming for large groups
- ❌ No automation

---

### Method 3: Bot API Script (LIMITED)

The included Node.js scripts have limitations:

```bash
node scripts/bulk-delete-text-messages.js <group_id> <start_id> <end_id>
```

**Limitations:**
- ❌ Cannot check message type before deleting
- ❌ Cannot access message history
- ❌ Will try to delete ALL messages in range
- ⚠️  May delete media messages too

**Use this only if:**
- You know the exact message ID range
- You're okay with potentially deleting everything in that range

---

## 🔐 Security Notes

### Python Script (Telethon)
- Uses your personal Telegram account
- Requires API credentials from my.telegram.org
- Session is stored locally in `cleanup_session.session`
- You can delete the session file after cleanup
- Never share your API credentials or session file

### Bot Script
- Uses bot token from .env
- More limited but doesn't require personal account
- Bot must be admin with "Delete messages" permission

---

## 📊 Example Output

```
🧹 Group Text Message Cleanup

✅ Logged in successfully
📍 Target Group ID: -1001234567890
✅ Found group: My Test Group

⚠️  WARNING: This will delete all text-only messages except from today!
   Media messages will be preserved.

Type "yes" to continue: yes

🔍 Scanning messages...

🗑️  Will delete: [2024-11-20 14:23] Hello everyone...
🗑️  Will delete: [2024-11-19 09:15] Check this out...

✅ Deleted batch 1 (100 messages)
✅ Deleted batch 2 (50 messages)

📊 Cleanup Summary:
──────────────────────────────────────────────────
   ✅ Total checked: 1250
   🗑️  Deleted: 850
   📸 Kept (media): 300
   📅 Kept (today): 100
   ❌ Errors: 0
──────────────────────────────────────────────────

✅ Cleanup complete!
```

---

## ⚠️ Important Warnings

1. **Irreversible**: Deleted messages cannot be recovered
2. **Backup First**: Consider backing up important messages before running
3. **Test First**: Try on a test group first if possible
4. **Admin Rights**: You must have delete message permissions
5. **Rate Limits**: Script includes delays to avoid hitting Telegram rate limits

---

## 🛠️ Troubleshooting

### "Could not find group"
- Check that GROUP_ID is correct and includes the leading dash (-)
- Make sure your account is a member of the group

### "Permission denied"
- Your account must have admin rights to delete messages
- Bot must be admin with "Delete messages" permission

### "API ID/Hash not found"
- Get credentials from https://my.telegram.org
- Add them to your .env file

### "Too many requests"
- Script includes rate limiting
- If you still hit limits, increase delays in the script

---

## 📞 Support

If you encounter issues:
1. Check the error message
2. Verify all prerequisites are met
3. Ensure you have proper permissions
4. Try the manual method as fallback

---

## 📝 Files Created

- `cleanup-text-messages.py` - Main Python script (RECOMMENDED)
- `cleanup-text-messages.js` - Node.js framework script
- `bulk-delete-text-messages.js` - Bot API deletion script (limited)
- `cleanup-group-messages-userbot.js` - Instructions for userbot method
- `CLEANUP_GUIDE.md` - This guide
