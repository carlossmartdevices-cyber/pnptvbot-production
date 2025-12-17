# PNPtv Subscription Notifications - Setup Guide

This guide explains how to set up and configure the complete subscription notification system for PNPtv bot, including payment confirmations, reminders, and expiration handling.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The PNPtv subscription notification system provides automated communication with users throughout their subscription lifecycle:

1. **Payment Confirmation** - Instant notification when payment is successful
2. **3-Day Reminder** - Sent 3 days before subscription expires
3. **1-Day Reminder** - Sent 1 day before subscription expires
4. **Expiration Handling** - Automatic removal from PRIME channels and farewell message

All notifications are sent via:
- **Telegram Bot Messages** (with inline action buttons)
- **Email** (HTML templates with responsive design)

---

## Features

### ✅ Payment Confirmation
- **One-time use invite links** to PRIME channels (expires in 7 days)
- Detailed subscription information (plan, amount, next payment date)
- Sent via bot and email immediately after payment
- Automatic reminder schedule notification

### ⏰ Subscription Reminders
- **3-day reminder** - Sent daily at 10 AM for users expiring in 3 days
- **1-day reminder** - Sent daily at 10 AM for users expiring tomorrow
- Both bot and email notifications
- "Renovar Suscripción" button with direct link to plans

### 💔 Expiration Handling
- Runs daily at midnight (12:00 AM)
- **Automatic removal** from all PRIME channels
- Farewell message via bot with "Volver a PRIME" button
- Farewell email with re-subscribe call-to-action
- User status updated to "expired" in database

---

## Prerequisites

### Required:
- ✅ PostgreSQL database (user and payment tables)
- ✅ Redis (for caching)
- ✅ Telegram Bot Token with admin access to PRIME channels
- ✅ Node.js 16+ and npm/yarn
- ✅ PM2 or similar process manager

### Optional but Recommended:
- ⚠️ SendGrid API key or SMTP credentials (for emails)
- ⚠️ Domain with SSL (for webhook callbacks)

### Bot Permissions Required:
The bot must be an **administrator** in all PRIME channels with these permissions:
- ✅ Can invite users
- ✅ Can restrict members (ban/unban)
- ✅ Can delete messages (for cleanup)

---

## Installation

### Step 1: Install Dependencies

All required packages are already in `package.json`. If starting fresh:

```bash
npm install
```

Key dependencies:
- `telegraf` - Telegram Bot API
- `nodemailer` - Email sending
- `node-cron` - Scheduled jobs
- `pg` - PostgreSQL client

### Step 2: Database Setup

Ensure your PostgreSQL database has the required schema. The system uses:

**Tables:**
- `users` - User profiles and subscription data
- `payments` - Payment transactions
- `plans` - Subscription plans
- `subscribers` - Email-based subscriber records

**Required Fields in `users` table:**
```sql
id TEXT PRIMARY KEY
first_name TEXT
last_name TEXT
email TEXT
subscription_status TEXT  -- 'free', 'active', 'expired'
plan_id TEXT
plan_expiry TIMESTAMP
language TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Step 3: File Structure

The notification system consists of these files:

```
src/
├── bot/
│   └── services/
│       ├── paymentService.js              # Payment webhooks & confirmations
│       ├── subscriptionReminderService.js # Reminder logic (NEW)
│       └── userService.js                 # Expiration handler (ENHANCED)
├── services/
│   └── emailService.js                    # Email templates (ENHANCED)
├── models/
│   └── userModel.js                       # Database queries (ENHANCED)
└── scripts/
    └── cron.js                            # Cron job scheduler (ENHANCED)

docs/
├── NOTIFICATION_TEMPLATES.md              # All message templates (NEW)
└── SUBSCRIPTION_NOTIFICATIONS_SETUP.md    # This file (NEW)
```

---

## Configuration

### Step 1: Environment Variables

Add these to your `.env` file:

```bash
# ============================================
# SUBSCRIPTION NOTIFICATIONS CONFIG
# ============================================

# Email Configuration (Choose ONE method)
# Method 1: SendGrid (Recommended)
EMAIL_FROM=noreply@easybots.store
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here

# Method 2: SMTP (Alternative)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_SECURE=false

# Bot Configuration
BOT_TOKEN=your_telegram_bot_token
BOT_WEBHOOK_DOMAIN=https://easybots.store

# PRIME Channel IDs (comma-separated, no spaces)
PRIME_CHANNEL_ID=-1001947636543,-1002997324714

# Cron Job Schedules (cron format)
ENABLE_CRON=true
SUBSCRIPTION_CHECK_CRON=0 0 * * *      # Expiration check: Daily at midnight
REMINDER_3DAY_CRON=0 10 * * *          # 3-day reminder: Daily at 10 AM
REMINDER_1DAY_CRON=0 10 * * *          # 1-day reminder: Daily at 10 AM

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=pnptvbot
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
```

### Step 2: Cron Schedule Explanation

The cron format: `minute hour day month weekday`

**Current Configuration:**
- `0 0 * * *` = Midnight every day (00:00)
- `0 10 * * *` = 10 AM every day

**Examples for customization:**
```bash
# Run at 9 AM every day
REMINDER_3DAY_CRON=0 9 * * *

# Run at 6 PM every day
REMINDER_1DAY_CRON=0 18 * * *

# Run every 6 hours
SUBSCRIPTION_CHECK_CRON=0 */6 * * *

# Run at 8 AM on weekdays only
REMINDER_3DAY_CRON=0 8 * * 1-5
```

### Step 3: Email Setup

#### Option A: SendGrid (Recommended)

1. Sign up at https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Add to `.env`:
   ```bash
   SENDGRID_API_KEY=SG.xxxxxxxxxxxx
   EMAIL_FROM=noreply@easybots.store
   ```
4. Verify sender domain (optional but recommended)

#### Option B: SMTP (Gmail, Outlook, etc.)

1. Enable 2FA on your email account
2. Generate an "App Password"
3. Add to `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_SECURE=false
   EMAIL_FROM=your-email@gmail.com
   ```

#### Option C: No Email (Bot Only)

If you don't configure email:
- Bot notifications will still work
- Email methods will log instead of sending
- Users without Telegram access won't receive notifications

### Step 4: Bot Admin Setup

Make your bot an admin in PRIME channels:

1. Open each PRIME channel in Telegram
2. Go to channel info → Administrators → Add Administrator
3. Select your bot
4. Grant permissions:
   - ✅ Add Members
   - ✅ Ban Users
   - ✅ Delete Messages

### Step 5: Start Cron Jobs

The cron jobs are configured to start automatically with the main application.

**Using PM2:**
```bash
# Start cron process
pm2 start scripts/cron.js --name pnptv-cron

# View logs
pm2 logs pnptv-cron

# Restart
pm2 restart pnptv-cron
```

**Using Node directly:**
```bash
# Set environment
export ENABLE_CRON=true

# Start cron
node scripts/cron.js
```

**Verify cron is running:**
Check logs for:
```
✓ Cron jobs started successfully
  - Subscription expiry check: Daily at midnight
  - 3-day reminders: Daily at 10 AM
  - 1-day reminders: Daily at 10 AM
```

---

## Testing

### Test 1: Payment Confirmation

**Manual Testing:**

1. Create a test payment in your database:
```sql
INSERT INTO users (id, first_name, email, subscription_status, plan_id, plan_expiry)
VALUES ('123456789', 'Test User', 'test@example.com', 'active', 'pnp-member', NOW() + INTERVAL '30 days');
```

2. Trigger webhook manually (or use a test payment with ePayco/Daimo sandbox)

3. **Expected Results:**
   - ✅ Bot message sent to user 123456789
   - ✅ Email sent to test@example.com
   - ✅ One-time invite links generated
   - ✅ Links expire in 7 days

### Test 2: 3-Day Reminders

**Manual Testing:**

1. Create a user expiring in 3 days:
```sql
UPDATE users
SET subscription_status = 'active',
    plan_expiry = NOW() + INTERVAL '3 days'
WHERE id = 'YOUR_TEST_USER_ID';
```

2. Run reminder manually:
```bash
node -e "
const ReminderService = require('./src/bot/services/subscriptionReminderService');
ReminderService.send3DayReminders().then(count => {
  console.log(\`Sent \${count} reminders\`);
});
"
```

3. **Expected Results:**
   - ✅ Bot message with "⏰ Recordatorio de Suscripción"
   - ✅ Email with orange warning color
   - ✅ "Renovar Suscripción" button visible

### Test 3: 1-Day Reminders

Same as Test 2, but:
- Set `plan_expiry = NOW() + INTERVAL '1 day'`
- Run `ReminderService.send1DayReminders()`
- Expect red alert color and "🚨 ¡ÚLTIMO RECORDATORIO!"

### Test 4: Expiration & Removal

**Manual Testing:**

1. Create an expired user:
```sql
UPDATE users
SET subscription_status = 'active',
    plan_expiry = NOW() - INTERVAL '1 day'
WHERE id = 'YOUR_TEST_USER_ID';
```

2. Ensure user is in PRIME channel

3. Run expiration handler:
```bash
node -e "
const UserService = require('./src/bot/services/userService');
UserService.processExpiredSubscriptions().then(count => {
  console.log(\`Processed \${count} expirations\`);
});
"
```

4. **Expected Results:**
   - ✅ User status changed to "expired"
   - ✅ User removed from PRIME channels
   - ✅ Bot farewell message sent
   - ✅ Email farewell sent
   - ✅ User can rejoin if they resubscribe (unban applied)

### Test 5: Email Verification

Test email sending:

```bash
node -e "
const EmailService = require('./src/services/emailService');
EmailService.send({
  to: 'your-email@example.com',
  subject: 'PNPtv Email Test',
  html: '<h1>Test successful!</h1><p>Emails are working.</p>'
}).then(result => {
  console.log('Email sent:', result);
}).catch(err => {
  console.error('Email failed:', err);
});
"
```

---

## Monitoring

### Log Files

Monitor these logs for notification activity:

```bash
# Cron job logs
pm2 logs pnptv-cron

# Application logs
tail -f logs/combined.log | grep -i "reminder\|expir\|payment"

# Error logs
tail -f logs/error.log
```

### Key Log Messages

**Successful Payment:**
```
User subscription activated via webhook { userId: '123', planId: 'pnp-member', expiryDate: '2025-02-19' }
Sent payment confirmation email { userId: '123', email: 'user@example.com' }
```

**Successful Reminders:**
```
Running 3-day subscription reminder check...
Sent 3-day reminder bot message { userId: '123' }
Sent 3-day reminder email { userId: '123', email: 'user@example.com' }
Sent 5 3-day reminders
```

**Successful Expiration:**
```
Running subscription expiry check...
Subscription expired { userId: '123' }
User removed from PRIME channel { userId: '123', channelId: '-1001947636543' }
Sent farewell bot message { userId: '123' }
Sent farewell email { userId: '123', email: 'user@example.com' }
Processed 1 expired subscriptions
```

### Database Monitoring

Check notification statistics:

```sql
-- Users expiring in next 3 days
SELECT COUNT(*) as expiring_soon
FROM users
WHERE subscription_status = 'active'
  AND plan_expiry BETWEEN NOW() AND NOW() + INTERVAL '3 days';

-- Recently expired users
SELECT id, first_name, email, plan_expiry
FROM users
WHERE subscription_status = 'expired'
  AND plan_expiry >= NOW() - INTERVAL '7 days'
ORDER BY plan_expiry DESC;

-- Active subscriptions
SELECT
  plan_id,
  COUNT(*) as active_count,
  MIN(plan_expiry) as next_expiry
FROM users
WHERE subscription_status = 'active'
GROUP BY plan_id;
```

### Health Check Script

Create a health check script:

```bash
#!/bin/bash
# scripts/health-check.sh

echo "=== PNPtv Notification System Health Check ==="
echo ""

# Check if cron is running
if pm2 list | grep -q "pnptv-cron.*online"; then
  echo "✅ Cron jobs: RUNNING"
else
  echo "❌ Cron jobs: STOPPED"
fi

# Check recent cron activity
RECENT_LOGS=$(pm2 logs pnptv-cron --lines 100 --nostream | grep -c "reminder\|expiry")
echo "✅ Recent cron activity: $RECENT_LOGS events"

# Check database connection
psql -U $POSTGRES_USER -d $POSTGRES_DATABASE -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Database: CONNECTED"
else
  echo "❌ Database: DISCONNECTED"
fi

# Check Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Redis: CONNECTED"
else
  echo "❌ Redis: DISCONNECTED"
fi

echo ""
echo "=== End Health Check ==="
```

Run with: `bash scripts/health-check.sh`

---

## Troubleshooting

### Issue: Reminders Not Sending

**Symptoms:**
- No reminder logs at scheduled times
- Users not receiving 3-day or 1-day reminders

**Solutions:**

1. **Check cron is enabled:**
   ```bash
   grep ENABLE_CRON .env
   # Should show: ENABLE_CRON=true
   ```

2. **Verify cron is running:**
   ```bash
   pm2 list | grep cron
   # Should show status: online
   ```

3. **Check cron schedule:**
   ```bash
   pm2 logs pnptv-cron --lines 50 | grep "Cron jobs started"
   # Should show the schedule configuration
   ```

4. **Test manually:**
   ```bash
   node -e "require('./src/bot/services/subscriptionReminderService').send3DayReminders()"
   ```

5. **Check for users in date range:**
   ```sql
   SELECT COUNT(*) FROM users
   WHERE subscription_status = 'active'
     AND plan_expiry BETWEEN NOW() + INTERVAL '3 days' - INTERVAL '12 hours'
                         AND NOW() + INTERVAL '3 days' + INTERVAL '12 hours';
   ```

### Issue: Users Not Removed from PRIME

**Symptoms:**
- Expired users still in PRIME channels
- Ban errors in logs

**Solutions:**

1. **Check bot permissions:**
   - Bot must be admin in channels
   - Must have "Ban users" permission

2. **Verify channel IDs:**
   ```bash
   echo $PRIME_CHANNEL_ID
   # Should match actual channel IDs (negative numbers)
   ```

3. **Test bot access:**
   ```bash
   node -e "
   const { Telegraf } = require('telegraf');
   const bot = new Telegraf(process.env.BOT_TOKEN);
   bot.telegram.getChat(process.env.PRIME_CHANNEL_ID.split(',')[0])
     .then(chat => console.log('Bot has access:', chat.title))
     .catch(err => console.error('No access:', err.message));
   "
   ```

4. **Check user is actually in channel:**
   - User must have joined the channel
   - Bot can only remove members who are present

### Issue: Emails Not Sending

**Symptoms:**
- Bot messages work but no emails received
- "Email would be sent (no transporter configured)" in logs

**Solutions:**

1. **Check email configuration:**
   ```bash
   node -e "
   const EmailService = require('./src/services/emailService');
   EmailService.verifyConnection()
     .then(valid => console.log('Email configured:', valid))
     .catch(err => console.error('Email error:', err));
   "
   ```

2. **Verify SendGrid API key:**
   ```bash
   curl -X POST https://api.sendgrid.com/v3/mail/send \
     -H "Authorization: Bearer $SENDGRID_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"noreply@easybots.store"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
   ```

3. **Check email field in database:**
   ```sql
   SELECT id, first_name, email FROM users WHERE email IS NOT NULL LIMIT 10;
   ```

4. **Test email directly:**
   ```bash
   node -e "
   const EmailService = require('./src/services/emailService');
   EmailService.send({
     to: 'your-email@example.com',
     subject: 'Test',
     html: '<p>Test</p>'
   }).then(console.log).catch(console.error);
   "
   ```

### Issue: Invite Links Not Working

**Symptoms:**
- "Invite link is invalid or expired" error
- Users can't join PRIME channels

**Solutions:**

1. **Check bot is admin:**
   - Bot needs "Invite users via link" permission

2. **Verify link creation:**
   ```bash
   node -e "
   const { Telegraf } = require('telegraf');
   const bot = new Telegraf(process.env.BOT_TOKEN);
   const channelId = process.env.PRIME_CHANNEL_ID.split(',')[0];
   bot.telegram.createChatInviteLink(channelId, { member_limit: 1 })
     .then(link => console.log('Link created:', link.invite_link))
     .catch(err => console.error('Error:', err.message));
   "
   ```

3. **Check expiry settings:**
   - Links expire in 7 days
   - member_limit is set to 1 (one-time use)
   - If user doesn't join within 7 days, they need a new link

4. **Fallback to static link:**
   - If dynamic links fail, system falls back to `https://t.me/PNPTV_PRIME`
   - Check logs for "Error creating invite link"

### Issue: Wrong Date/Time for Notifications

**Symptoms:**
- Reminders sent at wrong time
- Timezone mismatches

**Solutions:**

1. **Check server timezone:**
   ```bash
   timedatectl
   date
   ```

2. **Set timezone in environment:**
   ```bash
   export TZ='America/Bogota'  # Colombia
   # Or add to .env: TZ=America/Bogota
   ```

3. **Adjust cron schedule:**
   ```bash
   # If server is UTC, adjust times accordingly
   # For 10 AM Bogota (UTC-5):
   REMINDER_3DAY_CRON=0 15 * * *  # 3 PM UTC = 10 AM COT
   ```

4. **Use date-fns or moment-timezone:**
   ```javascript
   const { utcToZonedTime } = require('date-fns-tz');
   const colombia = utcToZonedTime(new Date(), 'America/Bogota');
   ```

---

## Advanced Configuration

### Custom Notification Schedules

You can add more reminders by editing `scripts/cron.js`:

```javascript
// Add 7-day reminder
cron.schedule('0 10 * * *', async () => {
  const sent = await SubscriptionReminderService.sendReminders(7);
  logger.info(`Sent ${sent} 7-day reminders`);
});

// Add 12-hour reminder
cron.schedule('0 0,12 * * *', async () => {
  // Runs at midnight and noon
  const sent = await SubscriptionReminderService.sendReminders(0.5);
  logger.info(`Sent ${sent} 12-hour reminders`);
});
```

### Localization

To add English support:

1. Detect user language:
   ```javascript
   const lang = user.language || 'es';
   ```

2. Update template methods to accept language parameter

3. Create English versions of all messages

4. Pass language to email/bot methods

### Custom Email Templates

To customize email appearance:

1. Edit methods in `src/services/emailService.js`
2. Modify inline styles in template methods
3. Add your logo/branding
4. Test with various email clients

### Webhook vs Polling

Current setup uses webhooks for payments. To add polling:

```javascript
// In bot main file
bot.launch({
  webhook: {
    domain: process.env.BOT_WEBHOOK_DOMAIN,
    port: process.env.PORT
  }
});

// Or for polling:
bot.launch();
```

---

## Performance Optimization

### Database Indexing

Add indexes for better query performance:

```sql
CREATE INDEX idx_users_subscription_expiry
  ON users(subscription_status, plan_expiry);

CREATE INDEX idx_users_email
  ON users(email) WHERE email IS NOT NULL;
```

### Batch Processing

For large user bases, process in batches:

```javascript
const BATCH_SIZE = 100;
let offset = 0;

while (true) {
  const batch = await query(
    'SELECT * FROM users WHERE ... LIMIT $1 OFFSET $2',
    [BATCH_SIZE, offset]
  );

  if (batch.rows.length === 0) break;

  await Promise.all(batch.rows.map(user => processUser(user)));

  offset += BATCH_SIZE;
}
```

### Rate Limiting

Telegram bot API limits: 30 messages/second per bot

```javascript
const pLimit = require('p-limit');
const limit = pLimit(30); // Max 30 concurrent

const promises = users.map(user =>
  limit(() => bot.telegram.sendMessage(user.id, message))
);

await Promise.all(promises);
```

---

## Security Considerations

1. **Environment Variables:**
   - Never commit `.env` to git
   - Use `.env.example` for templates
   - Rotate API keys regularly

2. **Email Sending:**
   - Use authenticated SMTP or SendGrid
   - Don't expose email addresses in logs
   - Implement rate limiting

3. **Channel Access:**
   - Use one-time invite links
   - Set expiration on links
   - Monitor for unauthorized access

4. **Database:**
   - Use parameterized queries (already implemented)
   - Encrypt sensitive data at rest
   - Regular backups

---

## Support & Resources

### Documentation:
- [Notification Templates](./NOTIFICATION_TEMPLATES.md)
- [Bot API Documentation](https://core.telegram.org/bots/api)
- [Node Cron Syntax](https://www.npmjs.com/package/node-cron)
- [SendGrid Docs](https://docs.sendgrid.com/)

### Contact:
- **Email:** support@easybots.store
- **Repository:** https://github.com/carlossmartdevices-cyber/pnptvbot-production

### Monitoring:
```bash
# Quick status check
pm2 status

# Logs
pm2 logs pnptv-cron --lines 100

# Restart if needed
pm2 restart pnptv-cron
```

---

**Version:** 1.0.0
**Last Updated:** 2025-01-19
**Author:** PNPtv Development Team
