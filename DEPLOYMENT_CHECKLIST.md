# Production Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Quality
- ✅ All syntax checks passed
- ✅ No uncommitted changes
- ✅ Latest code pushed to branch: `claude/adapt-integrate-feature-01C8BS68M7rQf6kArNKhnudH`
- ✅ All handlers registered in `src/bot/core/bot.js`

### Recent Changes (Ready for Deployment)
```
e7b439c - feat: enhance Daimo Pay and Private Calls systems
50ed828 - feat: enhance Private Calls with multi-performer and quick scheduling
b6f75ea - feat: add Private 1:1 Call system with payment and scheduling
6f65dbb - feat: integrate Daimo Pay with support for Zelle, CashApp, Venmo, Revolut, Wise
```

---

## 🔧 Environment Configuration

### Critical Environment Variables (MUST SET)

#### **Core Bot Settings**
```bash
BOT_TOKEN=                    # Get from @BotFather
BOT_WEBHOOK_DOMAIN=           # Your production domain (https://yourdomain.com)
BOT_WEBHOOK_PATH=/pnp/webhook/telegram
NODE_ENV=production
PORT=3000
```

#### **Firebase (Database)**
```bash
FIREBASE_PROJECT_ID=          # From Firebase Console
FIREBASE_PRIVATE_KEY=         # From Firebase Service Account JSON
FIREBASE_CLIENT_EMAIL=        # From Firebase Service Account JSON
FIREBASE_DATABASE_URL=        # Firebase Realtime Database URL (optional)
```

#### **Payment Providers - CRITICAL FOR SECURITY**

**ePayco:**
```bash
EPAYCO_PUBLIC_KEY=            # From ePayco dashboard
EPAYCO_PRIVATE_KEY=           # CRITICAL: Required for webhook signature verification
EPAYCO_P_CUST_ID=             # Your customer ID
EPAYCO_TEST_MODE=false        # Set to false for production
```

**Daimo Pay (Zelle, CashApp, Venmo, Revolut, Wise):**
```bash
DAIMO_API_KEY=                        # From Daimo Pay dashboard
DAIMO_WEBHOOK_SECRET=                 # CRITICAL: Required for webhook signature verification
DAIMO_TREASURY_ADDRESS=0x...          # Optimism address where USDC is deposited
DAIMO_REFUND_ADDRESS=0x...            # Optimism address for refunds (optional, defaults to treasury)
```

⚠️ **WARNING:** In production, `EPAYCO_PRIVATE_KEY` and `DAIMO_WEBHOOK_SECRET` are **REQUIRED**. Without them, webhook signature verification will fail and payments won't be processed.

#### **Video Calls (Daily.co)**
```bash
DAILY_API_KEY=                # Sign up at https://www.daily.co/
```

#### **Redis (Caching & Session)**
```bash
REDIS_HOST=                   # Redis server host
REDIS_PORT=6379
REDIS_PASSWORD=               # Set a strong password
REDIS_DB=0
```

#### **Admin Users**
```bash
ADMIN_USER_IDS=123456789,987654321    # Comma-separated Telegram user IDs
```

#### **Security**
```bash
JWT_SECRET=                   # Minimum 32 characters, randomly generated
ENCRYPTION_KEY=               # Minimum 32 characters, randomly generated
```

---

## 📋 Pre-Deployment Steps

### 1. Merge to Main Branch
```bash
# Option A: Via GitHub Pull Request (Recommended)
# 1. Go to GitHub repository
# 2. Create PR from: claude/adapt-integrate-feature-01C8BS68M7rQf6kArNKhnudH
# 3. To: main
# 4. Review changes (12 files changed, 2488+ additions)
# 5. Merge pull request

# Option B: Via Command Line (if you have permissions)
git checkout main
git merge claude/adapt-integrate-feature-01C8BS68M7rQf6kArNKhnudH
git push origin main
```

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Run Tests (if available)
```bash
npm test
```

---

## 🚀 Deployment Process

### Webhook Configuration

**Daimo webhook URL:**
```
https://easybots.store/api/webhooks/daimo
```

**Telegram webhook:**
```
https://easybots.store/pnp/webhook/telegram
```

### Start the Bot

#### Production Mode (Webhook)
```bash
NODE_ENV=production npm start
```

#### Using Process Manager (PM2 - Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start bot
pm2 start src/bot/core/bot.js --name pnptv-bot

# Save process list
pm2 save

# Set up auto-restart on server reboot
pm2 startup
```

---

## 🔍 Post-Deployment Verification

### Test Core Features

#### ✅ User Features
- [ ] `/start` - Bot welcomes user
- [ ] `/payments` - View payment history
- [ ] `/packages` - View call packages
- [ ] `/mycalls` - View scheduled calls
- [ ] Book a private call with payment
- [ ] Reschedule a call
- [ ] Cancel a call (check refund policy)
- [ ] Leave feedback after call

#### ✅ Admin Features  
- [ ] `/analytics` - View dashboard
- [ ] `/available` - Set call availability
- [ ] `/broadcast` - Send availability notification
- [ ] View payment analytics
- [ ] View call analytics

#### ✅ Payment Flow
- [ ] Create Daimo payment link
- [ ] Process webhook after payment
- [ ] Activate subscription/call credits
- [ ] Generate receipt

#### ✅ Automated Systems
- [ ] Call reminders (24h, 1h, 15min before scheduled calls)
- [ ] Auto-complete calls after duration

---

## 🔐 Security Checklist

- [ ] `DAIMO_WEBHOOK_SECRET` configured
- [ ] `EPAYCO_PRIVATE_KEY` configured  
- [ ] All webhooks use HTTPS URLs
- [ ] SSL certificate valid
- [ ] Environment variables not committed to git
- [ ] `ADMIN_USER_IDS` set correctly
- [ ] Rate limiting active
- [ ] Error handling configured

---

## 🐛 Troubleshooting

### Bot Not Responding
```bash
# Check if bot is running
pm2 status

# Check logs
pm2 logs pnptv-bot --lines 100

# Restart bot
pm2 restart pnptv-bot
```

### Webhook Not Receiving Updates
```bash
# Check webhook status
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Reset webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://easybots.store/pnp/webhook/telegram"
```

### Payments Not Processing
1. Verify webhook secrets are set
2. Check webhook URLs in payment provider dashboards
3. Check logs for signature verification errors

---

## 📊 Key Metrics to Monitor

1. **Bot Health:** Uptime, response time, error rate
2. **Payments:** Success rate, revenue, conversion rate
3. **Calls:** Bookings, cancellations, completion rate
4. **System:** Memory, CPU, Redis, Firebase connections

---

## ✨ New Features in This Release

### Payment System
- Payment history and receipts (`/payments`)
- Admin analytics dashboard (`/analytics`)
- Promo code infrastructure
- Revenue tracking

### Private Calls System  
- Automated reminders (24h, 1h, 15min)
- Call rescheduling
- Cancellation with refund policies (100%/50%/0%)
- Post-call feedback (1-5 stars)
- Call packages with bulk pricing:
  * 3-pack: $270 (save $30 - 10% off)
  * 5-pack: $425 (save $75 - 15% off)
  * 10-pack: $800 (save $200 - 20% off)
- Call management interface (`/mycalls`)

---

**Version:** 1.0.0  
**Branch:** claude/adapt-integrate-feature-01C8BS68M7rQf6kArNKhnudH  
**Files Modified:** 4  
**Files Added:** 8  
**Total Changes:** +2,488 lines
