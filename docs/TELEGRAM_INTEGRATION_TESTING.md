# 🤖 Telegram Bot Integration Testing Guide

**Date**: February 13, 2026
**Purpose**: End-to-end testing with real Telegram bot
**Duration**: ~2 hours for full testing cycle

---

## 📋 PREREQUISITES

### 1. Create Test Bot
1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Follow prompts:
   - Name: `PNPtv Nearby Test Bot`
   - Username: `pnptv_nearby_test_bot`
5. Copy the **API Token** (you'll need this)

### 2. Setup Test Environment
```bash
# Store bot token in .env
echo "TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE" >> .env

# Install Telegram SDK (if not already installed)
npm install telegraf axios
```

### 3. Prepare Test Accounts
- Create 3-5 test Telegram accounts
- Record their User IDs (can be found with `/start` command to bot)
- Join bot's group chat (for webhook testing)

---

## 🧪 TESTING SCENARIOS

### Test 1: Bot Initialization
**Objective**: Verify bot responds to basic commands

**Steps**:
```bash
# 1. Start bot
npm run dev:bot

# 2. Open Telegram
# 3. Search for your bot and click /start
# 4. Verify bot responds with welcome message
```

**Expected Output**:
```
👋 Welcome to PNPtv Nearby!

Commands:
/hangout   - Join community hangout
/videorama - Start video call
/nearby    - Find users nearby
/premium   - Upgrade to Premium
```

**Pass Criteria**: ✅ Bot responds within 2 seconds

---

### Test 2: Web App Integration
**Objective**: Launch Nearby web app from Telegram bot

**Steps**:
```bash
# 1. Send /nearby to bot
# 2. Bot sends message with "🗺️ Open Nearby Map" button
# 3. Click button → web app opens in WebView
# 4. Verify you see LocationCapture component
```

**Expected Output**:
```
Web App loads:
- LocationCapture component visible
- "📍 Enable Location" button clickable
- GPS permission requested
```

**Pass Criteria**:
- ✅ Web app loads within 3 seconds
- ✅ GPS permission prompt appears
- ✅ Location capture works

---

### Test 3: Telegram Signature Verification
**Objective**: Verify initData signature is valid

**Implementation**:
```javascript
// In telegramWebAppAuth.js
const { createHmac } = require('crypto');

function verifyTelegramInitData(initData, botToken) {
  const data = new URLSearchParams(initData);
  const signature = data.get('hash');
  data.delete('hash');

  // Create check string
  const checkString = Array.from(data.entries())
    .sort()
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Calculate hash
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return hash === signature;
}

// Test
const isValid = verifyTelegramInitData(window.Telegram.WebApp.initData, BOT_TOKEN);
console.log(isValid ? '✅ Valid signature' : '❌ Invalid signature');
```

**Test Case**:
```bash
# 1. Open web app from bot
# 2. Check browser console
# 3. Should see: ✅ Valid signature
```

**Pass Criteria**: ✅ Signature verification succeeds

---

### Test 4: Location Update Flow
**Objective**: Update location and verify it appears in search

**Steps**:
```bash
# 1. User 1 opens /nearby in bot
# 2. Clicks "Enable Location"
# 3. Grants permission
# 4. Location is sent to backend
# 5. User 2 opens /nearby in different location
# 6. User 2 searches for nearby users
# 7. User 1 appears in results
```

**Expected Behavior**:
```
User 1:
✅ GPS coordinates captured
✅ Location sent to /api/nearby/update-location
✅ Response: { success: true, user_id: "...", timestamp: "..." }

User 2:
✅ Search returns User 1 in results
✅ Distance calculated correctly
✅ Coordinates obfuscated for privacy
```

**Test Command**:
```javascript
// In browser console (for manual testing)
LocationService.setAuthToken(authToken);
LocationService.updateLocation(40.7128, -74.0060, 25)
  .then(r => console.log('✅ Update:', r))
  .catch(e => console.error('❌ Error:', e));

LocationService.searchNearby({ latitude: 40.7128, longitude: -74.0060, radius: 5 })
  .then(r => console.log('✅ Search:', r))
  .catch(e => console.error('❌ Error:', e));
```

**Pass Criteria**:
- ✅ Location updated successfully
- ✅ Appears in search results within 5 seconds
- ✅ Distance calculation correct

---

### Test 5: Privacy & Blocking
**Objective**: Verify blocked users don't appear in search

**Steps**:
```bash
# 1. User 1 blocks User 2 (/block @username)
# 2. User 2 updates location
# 3. User 1 searches nearby
# 4. User 2 should NOT appear
```

**Implementation**:
```javascript
// Backend endpoint needed
POST /api/users/block/:userId
  Headers: Authorization: Bearer {token}
  Response: { success: true, blocked_user_id: "..." }
```

**Test Case**:
```bash
# Terminal 1: User 1
/block user2_username

# Terminal 2: User 2
# Send location update

# Terminal 1: User 1
/nearby
# Verify User 2 NOT in results
```

**Pass Criteria**:
- ✅ Block command accepted
- ✅ Blocked user filtered from search results

---

### Test 6: Prime Channel Membership
**Objective**: Verify Prime users added to private channel

**Setup**:
```bash
# 1. Create private channel: "PNPtv Premium"
# 2. Add bot as admin with add member permissions
# 3. Get channel ID: @pnptv_premium_test
```

**Steps**:
```bash
# 1. User upgrades to Premium (via payment)
# 2. Bot receives webhook confirmation
# 3. Bot adds user to private channel
# 4. User receives notification
```

**Expected Behavior**:
```
User:
✅ Completes payment
✅ Sees "Upgrading to Premium..." message
✅ Receives "Welcome to Premium!" notification
✅ Private channel appears in chat list

Bot:
✅ Receives payment webhook
✅ Updates user tier to PRIME
✅ Calls Telegram Bot API: /addChatMember
✅ Logs membership change
```

**Test Implementation**:
```javascript
// Simulate payment webhook
const webhook = {
  transaction_id: 'TEST_' + Date.now(),
  user_id: 'test_user_123',
  amount: 99900,
  currency: 'COP',
  status: 'success'
};

// Send webhook
axios.post('https://your-api.com/api/webhooks/payment', webhook)
  .then(() => console.log('✅ Webhook processed'))
  .catch(e => console.error('❌ Error:', e));
```

**Pass Criteria**:
- ✅ User added to private channel within 5 seconds
- ✅ User sees channel in chat list
- ✅ User can view premium content

---

### Test 7: Rate Limiting
**Objective**: Verify rate limiting works end-to-end

**Steps**:
```bash
# 1. Rapidly send location updates (/nearby, enable, wait 1s, update location)
# 2. Attempt to send 10 updates in 10 seconds
# 3. Verify rate limiting kicks in
```

**Expected Behavior**:
```
Request 1: ✅ Success (200)
Request 2: ✅ Success (200)
Request 3: ⏳ Queued
Request 4: ⏳ Queued
...
Requests 6-10: ❌ 429 (Too Many Requests)

Response:
{
  error: "Too many location updates",
  retry_after: 3,
  message: "Please wait 3s before updating again"
}
```

**Pass Criteria**:
- ✅ Rate limit enforced after 1st update
- ✅ Receives 429 response
- ✅ retry_after header present
- ✅ Can retry after wait period

---

### Test 8: Error Recovery
**Objective**: Verify graceful error handling

**Test Cases**:

#### Case 1: No Internet
```bash
# 1. Open web app
# 2. Disconnect internet (airplane mode)
# 3. Try to update location
# 4. Should see error message
```
Expected: Error message displayed, can retry when online ✅

#### Case 2: Invalid Coordinates
```bash
# 1. Manually send request with invalid lat/lon
curl -X POST https://api/nearby/update-location \
  -H "Authorization: Bearer {token}" \
  -d '{"latitude": 999, "longitude": -74, "accuracy": 25}'
# Response: 400 Bad Request
```
Expected: 400 error with clear message ✅

#### Case 3: Expired Token
```bash
# 1. Wait for JWT token to expire (7 days or mock)
# 2. Try to send location update
# Response: 401 Unauthorized
```
Expected: 401 error, need re-authentication ✅

---

## 🔍 MANUAL TESTING CHECKLIST

- [ ] Bot /start responds with welcome
- [ ] Bot /help shows all commands
- [ ] /nearby opens web app
- [ ] LocationCapture requests GPS permission
- [ ] Coordinates display correctly
- [ ] Accuracy indicator shows appropriate level
- [ ] Search finds nearby users
- [ ] Obfuscated coordinates (3 decimals max)
- [ ] Blocked users filtered from results
- [ ] Rate limiting enforced (429 response)
- [ ] Error messages are clear
- [ ] Premium users added to channel
- [ ] No console errors in browser
- [ ] App works offline (graceful degradation)
- [ ] Response times < 500ms

---

## 📝 LOGGING & DEBUGGING

### Enable Debug Logging
```bash
# In .env
DEBUG=nearby:*,telegram:*,bot:*

# Run bot
npm run dev:bot 2>&1 | tee bot-debug.log
```

### Check API Logs
```bash
# Watch API requests in real-time
tail -f logs/api.log | grep nearby

# Search for errors
grep "ERROR\|❌" logs/api.log
```

### Browser Console Debugging
```javascript
// In LocationCapture component
console.log('📍 Location:', location);
console.log('🔄 Rate limit:', rateLimitStatus);
console.log('📤 Sending to:', updateUrl);
console.log('📊 Response:', response);
```

---

## 🚀 TESTING COMMAND REFERENCE

```bash
# Create test user
curl -X POST https://api.example.com/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 123456789, "first_name": "Test"}'

# Update test location
curl -X POST https://api.example.com/api/nearby/update-location \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 25
  }'

# Search nearby
curl https://api.example.com/api/nearby/search \
  '?latitude=40.7128&longitude=-74.0060&radius=5' \
  -H "Authorization: Bearer {token}"

# Get stats
curl https://api.example.com/api/nearby/stats \
  -H "Authorization: Bearer {token}"
```

---

## ✅ SUCCESS CRITERIA

All tests pass when:
- ✅ Bot initialization succeeds
- ✅ Web app launches from bot
- ✅ Telegram signature verification passes
- ✅ Location updates successfully
- ✅ Nearby search works correctly
- ✅ Blocked users filtered properly
- ✅ Premium channel membership synced
- ✅ Rate limiting enforced
- ✅ Errors handled gracefully
- ✅ Response times < 500ms
- ✅ No security issues found

---

## 📱 TEST USER ACCOUNTS

Record your test users here:

| User ID | Telegram Username | Role | Status |
|---------|------------------|------|--------|
| 123456789 | @testuser1 | Standard | ✅ |
| 987654321 | @testuser2 | Premium | ✅ |
| 555555555 | @testuser3 | Standard | ✅ |

---

## 🎓 ADDITIONAL RESOURCES

- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [Telegram Web Apps](https://core.telegram.org/bots/webapps)
- [Testing Telegram Bots](https://core.telegram.org/bots/testing)

