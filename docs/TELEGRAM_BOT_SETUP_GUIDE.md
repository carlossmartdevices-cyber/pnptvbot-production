# 🤖 Telegram Test Bot Setup Guide

**Purpose**: Create a dedicated test bot for Nearby feature integration testing
**Time**: ~10 minutes
**Status**: Step-by-step instructions provided

---

## 📋 STEP 1: Create Test Bot with @BotFather

### 1.1 Open Telegram
- Search for **@BotFather** (official Telegram Bot Factory)
- Click **Start**

### 1.2 Create New Bot
Send the command:
```
/newbot
```

### 1.3 Choose Bot Name
**Question**: What should your bot be called?

**Answer**:
```
PNPtv Nearby Test Bot
```

(Can be anything, this is the display name)

### 1.4 Choose Bot Username
**Question**: Alright! If the bot is going to be public, users will be able to find your bot by username. What username do you want to give your bot?

**Answer**:
```
pnptv_nearby_test_bot
```

⚠️ **Important**: Username must:
- Be unique (not taken by another bot)
- End with `_bot`
- Contain only letters, numbers, and underscores
- Be lowercase

### 1.5 Receive Token
BotFather will respond with:
```
🎉 Done! Congratulations on your new bot!

Here are your bot's details:

Name: PNPtv Nearby Test Bot
@pnptv_nearby_test_bot
Token: 123456789:ABCDEFGHIJKLMNOPQRSTuvwxyz

You can now add a description, about section and profile picture for your bot,
see /help for a list of commands.

Keep your token secure and store it safely!
```

---

## 📝 STEP 2: Store Token in .env

### 2.1 Copy Bot Token
From BotFather message, copy the token:
```
123456789:ABCDEFGHIJKLMNOPQRSTuvwxyz
```

### 2.2 Add to .env
```bash
cat >> /root/pnptvbot-sandbox/.env << 'EOF'

# ========== TELEGRAM TEST BOT ==========
TELEGRAM_TEST_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTuvwxyz
TELEGRAM_TEST_BOT_USERNAME=pnptv_nearby_test_bot
EOF
```

### 2.3 Verify
```bash
grep "TELEGRAM_TEST_BOT" /root/pnptvbot-sandbox/.env
```

Expected output:
```
TELEGRAM_TEST_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTuvwxyz
TELEGRAM_TEST_BOT_USERNAME=pnptv_nearby_test_bot
```

---

## 👥 STEP 3: Create Test Users

You need **3 test Telegram accounts** to simulate real users.

### 3.1 Create Test Account 1
1. Download Telegram (if not already)
2. Create new account:
   - **Phone Number**: +1234567890 (test number, or use real)
   - **Name**: Test User 1
   - **Username**: test_user_1_nearby
3. Open bot: **@pnptv_nearby_test_bot**
4. Click **Start**
5. Get your **User ID** by sending `/start` to any bot that shows your ID
   - Or check your Telegram profile settings

**Record User ID 1**: `_______________`

### 3.2 Create Test Account 2
Repeat process:
- **Name**: Test User 2
- **Username**: test_user_2_nearby

**Record User ID 2**: `_______________`

### 3.3 Create Test Account 3
Repeat process:
- **Name**: Test User 3
- **Username**: test_user_3_nearby

**Record User ID 3**: `_______________`

### 3.4 Add to .env
```bash
cat >> /root/pnptvbot-sandbox/.env << 'EOF'

# ========== TELEGRAM TEST USERS ==========
TEST_USER_ID_1=<user_id_1>
TEST_USER_ID_2=<user_id_2>
TEST_USER_ID_3=<user_id_3>
TEST_USER_USERNAME_1=test_user_1_nearby
TEST_USER_USERNAME_2=test_user_2_nearby
TEST_USER_USERNAME_3=test_user_3_nearby
EOF
```

---

## 🎯 STEP 4: Configure Bot Features

### 4.1 Set Bot Commands
In BotFather chat, send:
```
/setcommands
```

Choose bot: `@pnptv_nearby_test_bot`

Send commands list:
```
nearby - Find users nearby
hangout - Join community hangout
premium - Upgrade to Premium
help - Get help
start - Start bot
```

### 4.2 Set Bot Description
Send to BotFather:
```
/setdescription
```

Choose bot, send description:
```
🗺️ Find nearby PNPtv users in real-time!

✨ Features:
• Real-time geolocation
• Privacy-first design
• Find nearby users instantly
• Update your location

🚀 Get started with /nearby
```

### 4.3 Set Bot About Text
Send to BotFather:
```
/setabouttext
```

Choose bot, send:
```
PNPtv Nearby Feature Test Bot

Version: 1.0
Testing: Geolocation & Integration

Support: @pnptv_support
```

### 4.4 Set Bot Picture
Send to BotFather:
```
/setuserpic
```

Choose bot, upload image (optional)

---

## 🔧 STEP 5: Configure Webhooks (Optional)

### 5.1 Set Webhook
If you want to receive updates in real-time instead of polling:

```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/webhook/telegram" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"web_app_info\"]"

# Verify webhook
curl -X GET "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 5.2 Remove Webhook (for local development)
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

---

## ✅ STEP 6: Verify Bot Works

### 6.1 Start Using Bot
1. Open Telegram
2. Search: **@pnptv_nearby_test_bot**
3. Click **Start**
4. You should see bot welcome message

### 6.2 Test Commands
Send these commands to verify:
```
/start     - Should show welcome message
/help      - Should show available commands
/nearby    - Should show location options
```

### 6.3 Check Bot Logs
Run bot and check for connection:
```bash
npm run dev:bot 2>&1 | grep -i "webhook\|bot\|telegram"
```

---

## 📊 STEP 7: Setup Test Channels (Optional)

### 7.1 Create Test Prime Channel
1. In Telegram, create new **Private Supergroup** (Invite Only)
2. Name: **PNPtv Premium Test**
3. Add test bot as admin with permissions:
   - ✅ Add members
   - ✅ Delete messages
   - ✅ Pin messages
   - ✅ Change group info
4. Get channel ID:
   - From group link: `https://t.me/+CXXXXXXXXXx`
   - Or use: `-100123456789` format

**Record Channel ID**: `_______________`

### 7.2 Create Test Group
1. Create new **Public Group**
2. Name: **PNPtv Test Group**
3. Add test bot as member
4. Get group ID: `@pnptv_test_group`

**Record Group ID**: `_______________`

### 7.3 Add to .env
```bash
cat >> /root/pnptvbot-sandbox/.env << 'EOF'

# ========== TELEGRAM TEST CHANNELS ==========
TEST_PRIME_CHANNEL_ID=-100123456789
TEST_GROUP_ID=-1001234567890
EOF
```

---

## 🚀 STEP 8: Ready for Testing

Your bot is now ready for:

✅ **E2E Testing**
- Launch web app from bot
- Test location capture
- Verify nearby search

✅ **Integration Testing**
- Test Telegram signature verification
- Test user creation flow
- Test Prime channel membership sync

✅ **Load Testing**
- Simulate multiple users
- Test rate limiting
- Verify performance

---

## 📝 Quick Reference

### Bot Token
```
TELEGRAM_TEST_BOT_TOKEN=<paste_token_here>
```

### Test Users
| User | ID | Username |
|------|----|---------  |
| 1 | `TEST_USER_ID_1` | test_user_1_nearby |
| 2 | `TEST_USER_ID_2` | test_user_2_nearby |
| 3 | `TEST_USER_ID_3` | test_user_3_nearby |

### Channels
| Channel | ID |
|---------|-----|
| Premium | `TEST_PRIME_CHANNEL_ID` |
| Group | `TEST_GROUP_ID` |

---

## 🐛 Troubleshooting

### Issue: Bot doesn't respond
```bash
# Check bot is running
ps aux | grep "bot"

# Check token is correct
echo $TELEGRAM_TEST_BOT_TOKEN

# Restart bot
npm run dev:bot
```

### Issue: Can't find bot
```bash
# Verify bot exists in BotFather
# Send /mybots to BotFather
# Should see: PNPtv Nearby Test Bot

# Check username
# Bot username MUST end with _bot
```

### Issue: User ID not found
```bash
# Get your User ID:
# 1. Send message to any bot
# 2. Check @userinfobot
# 3. Or: curl https://api.telegram.org/bot<TOKEN>/getMe
```

### Issue: Webhook not working
```bash
# Check webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# If stuck, delete webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Restart bot with polling
npm run dev:bot
```

---

## ✨ Testing Checklist

- [ ] Bot created with @BotFather
- [ ] Bot token saved in .env
- [ ] 3 test user accounts created
- [ ] Test user IDs in .env
- [ ] Bot commands configured
- [ ] Bot description set
- [ ] Bot picture (optional)
- [ ] Test bot responds to /start
- [ ] Test channels created (optional)
- [ ] Channel IDs in .env
- [ ] Ready for integration testing

---

## 🎓 Next Steps

1. **Run Integration Tests**
   - Follow: TELEGRAM_INTEGRATION_TESTING.md
   - Execute 8 test scenarios
   - Verify all pass

2. **Run Load Tests**
   - Execute: bash run-all-load-tests.sh
   - Review performance reports
   - Compare against targets

3. **Deploy to Staging**
   - Create staging environment
   - Deploy code
   - Run full test suite
   - Monitor for 24 hours

4. **Deploy to Production**
   - Update production bot token
   - Update production channels
   - Deploy code
   - Monitor closely

---

**Bot Setup Complete!** ✅

Your test bot is ready for integration and load testing.

Proceed to: TELEGRAM_INTEGRATION_TESTING.md

