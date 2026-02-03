# PNPtv Bot - Complete Test Suite

## Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npx jest tests/features/paymentTests.js --testTimeout=20000
npx jest tests/features/twitterTests.js --testTimeout=20000
npx jest tests/features/locationTests.js --testTimeout=20000
npx jest tests/features/groupsChannelsTests.js --testTimeout=20000
npx jest tests/features/mediaTests.js --testTimeout=20000

# Run API health tests
npx jest tests/integration/apiHealth.test.js --testTimeout=20000

# Run all feature tests
npx jest tests/features/ --testTimeout=20000
```

---

## Manual Test Checklist

### 1. Bot Startup & Basic Commands

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Bot starts | Run `pm2 restart pnptv-telegram-bot` | Bot online, no errors | ☐ |
| /start command | Send `/start` to bot | Welcome message, language selection | ☐ |
| /menu command | Send `/menu` to bot | Main menu with buttons | ☐ |
| /admin command | Send `/admin` (as admin) | Admin panel appears | ☐ |
| /support command | Send `/support` | Support options shown | ☐ |

### 2. User Onboarding

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| New user flow | Start bot as new user | Onboarding wizard starts | ☐ |
| Email registration | Enter email | Email saved, verification sent | ☐ |
| Age verification | Upload photo | AI verification processes | ☐ |
| Profile completion | Complete all steps | User marked as onboarded | ☐ |

### 3. Payment System

#### ePayco
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Checkout link | Request PRIME subscription | ePayco checkout URL generated | ☐ |
| Payment webhook | Complete test payment | Webhook received, processed | ☐ |
| Subscription activated | After payment | User has PRIME status | ☐ |
| Channel access | After PRIME activation | User can access PRIME channel | ☐ |

#### Daimo (Crypto)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Daimo checkout | Request crypto payment | Daimo payment link generated | ☐ |
| Payment confirmation | Complete USDC payment | Webhook received | ☐ |
| Subscription activated | After payment | User has PRIME status | ☐ |

### 4. X/Twitter Integration

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| OAuth connect | Click "Connect X Account" | Redirects to X authorization | ☐ |
| OAuth callback | Authorize on X | Account saved, shown in list | ☐ |
| Post now | Create post, click "Send Now" | Post appears on X | ☐ |
| Schedule post | Create post, schedule 1 min | Post published at scheduled time | ☐ |
| View scheduled | Open scheduled posts | List shows pending posts | ☐ |
| Cancel scheduled | Cancel a scheduled post | Post removed from queue | ☐ |
| Post history | Open history | Shows sent/failed posts | ☐ |

### 5. Admin Features

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| User search | Search by Telegram ID | User found, details shown | ☐ |
| Ban user | Click "Ban User" | User cannot use bot | ☐ |
| Unban user | Click "Unban User" | User can use bot again | ☐ |
| Force age verify | Click "Force Age Verify" | User must re-verify | ☐ |
| Extend subscription | Extend user's PRIME | Expiry date updated | ☐ |
| Change plan | Change user's plan | Plan updated | ☐ |
| Broadcast | Send broadcast message | Message sent to users | ☐ |

### 6. Groups & Channels

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| PRIME channel access | PRIME user joins | Access granted | ☐ |
| PRIME channel block | FREE user tries to join | Access denied | ☐ |
| Wall of Fame | User posts in topic | Only bot can post | ☐ |
| Notifications topic | User posts | Only bot/admins can post | ☐ |
| Anti-spam | Spam messages | Messages deleted, user warned | ☐ |
| Anti-flood | Rapid messages | User rate limited | ☐ |

### 7. Location & Nearby

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Share location | Send location to bot | Location saved | ☐ |
| Nearby places | Request nearby | Shows nearby users/places | ☐ |
| Business dashboard | Admin opens dashboard | Business management options | ☐ |
| Location privacy | Toggle sharing off | Location hidden from others | ☐ |

### 8. Media Features

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Live stream start | Model starts stream | Stream created, notifications sent | ☐ |
| Live stream join | User joins stream | Can view stream | ☐ |
| Live stream end | Model ends stream | Stream marked complete | ☐ |
| Radio stream | Open radio | Audio plays | ☐ |
| Hangouts room | Create/join room | Video call works | ☐ |

### 9. Support System

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Contact support | Send support message | Message forwarded to support group | ☐ |
| Support reply | Admin replies in topic | User receives reply | ☐ |
| Ticket tracking | Check ticket status | Status shown | ☐ |

---

## API Endpoint Tests

| Endpoint | Method | Expected Status | Status |
|----------|--------|-----------------|--------|
| `/api/health` | GET | 200, healthy | ☐ |
| `/webhook/telegram` | POST | 200 | ☐ |
| `/api/webhooks/epayco` | POST | 200/400 | ☐ |
| `/api/webhooks/daimo` | POST | 200/400 | ☐ |
| `/api/admin/x/oauth/start` | GET | 200/302 | ☐ |
| `/api/auth/x/callback` | GET | 200/400 | ☐ |
| `/api/admin/queue/stats` | GET | 200 | ☐ |

---

## Environment Variables Check

```bash
# Required variables
BOT_TOKEN=✓
POSTGRES_HOST=✓
REDIS_HOST=✓

# Payment variables
EPAYCO_PUBLIC_KEY=✓
EPAYCO_PRIVATE_KEY=✓
DAIMO_API_KEY=✓

# X/Twitter variables
TWITTER_CLIENT_ID=✓
TWITTER_CLIENT_SECRET=✓
TWITTER_REDIRECT_URI=✓

# Media variables
JAAS_APP_ID=✓
AGORA_APP_ID=✓
```

---

## Test Results Summary

| Category | Total | Passed | Failed |
|----------|-------|--------|--------|
| Bot Commands | 5 | ☐ | ☐ |
| Onboarding | 4 | ☐ | ☐ |
| Payments | 8 | ☐ | ☐ |
| X/Twitter | 7 | ☐ | ☐ |
| Admin | 7 | ☐ | ☐ |
| Groups | 6 | ☐ | ☐ |
| Location | 4 | ☐ | ☐ |
| Media | 5 | ☐ | ☐ |
| Support | 3 | ☐ | ☐ |
| API | 7 | ☐ | ☐ |
| **Total** | **56** | ☐ | ☐ |
