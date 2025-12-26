# PNPtv Notifications & Reminders System

A comprehensive automated notification system for the PNPtv Telegram bot.

## Features

### ✅ Subscription Expiry Reminders
- **3-day warning** - Sent 3 days before subscription expires
- **1-day warning** - Urgent reminder sent 1 day before expiration
- **Expiration notice** - Sent when subscription expires
- **Bilingual** - Automatic language detection (English/Spanish)
- **Private messages only** - NEVER sent to groups

### ✅ Automated Cron Jobs
- Scheduled tasks run automatically
- Configurable timing
- Health monitoring
- Error handling and logging

## How It Works

### Subscription Reminders

The system automatically:
1. Checks database daily for expiring subscriptions
2. Sends personalized reminders to users via private message
3. Includes expiration date and renewal information
4. Processes expired subscriptions and downgrades to free

**Key Features:**
- Only sends to users who have subscriptions expiring on the target date
- Respects user language preference
- Handles errors gracefully (e.g., user blocked bot)
- Rate-limited to avoid Telegram API limits

### Cron Job Schedule

All times in America/New_York timezone (configurable):

| Job | Schedule | Description |
|-----|----------|-------------|
| **3-Day Reminders** | Daily at 10:00 AM | Sends reminders to users whose subscriptions expire in 3 days |
| **1-Day Reminders** | Daily at 6:00 PM | Urgent reminders for subscriptions expiring tomorrow |
| **Expired Processor** | Daily at midnight | Downgrades expired subscriptions to free |
| **Health Check** | Every hour | Logs cron system status |

## Setup

### 1. Enable Cron Jobs

Add to your `.env` file:
```bash
ENABLE_CRON=true
```

### 2. Configure Timezone (Optional)

Edit `scripts/cron.js` to change timezone:
```javascript
timezone: 'America/Los_Angeles'  // Or your timezone
```

### 3. Customize Schedule (Optional)

Edit `scripts/cron.js` to modify schedule:
```javascript
// 3-day reminders at 10:00 AM
cron.schedule('0 10 * * *', async () => {
  // ...
});

// 1-day reminders at 6:00 PM
cron.schedule('0 18 * * *', async () => {
  // ...
});

// Expired subscriptions at midnight
cron.schedule('0 0 * * *', async () => {
  // ...
});
```

**Cron Format:** `minute hour day month weekday`
- Example: `0 10 * * *` = Every day at 10:00 AM
- Example: `0 18 * * 1` = Every Monday at 6:00 PM
- Example: `*/30 * * * *` = Every 30 minutes

### 4. Restart Bot

```bash
pm2 restart pnptvbot
```

## Message Examples

### 3-Day Reminder (English)

```
⏰ Subscription Reminder

Hey there! Your PNPtv PRIME membership will expire in 3 days.

📅 Expiration date: December 25, 2025

💎 What happens after expiration?
• Limited access to exclusive content
• Only 3 Nearby Member views per day
• No access to full-length videos

✨ Renew now and keep all PRIME benefits:
• Full-length exclusive videos
• Unlimited Nearby Members
• Live performances + private calls
• Premium music & podcasts
• Zero ads, all access

Type /prime to renew your membership.
```

### 1-Day Reminder (English)

```
🚨 Last Chance!

Your PNPtv PRIME membership expires TOMORROW.

📅 Expiration date: December 25, 2025

⚠️ Don't lose access to:
• Full-length exclusive videos from Santino, Lex & the crew
• Unlimited Nearby Members
• Live performances + private Zoom calls
• All premium music & podcasts

💎 Renew now to keep your PRIME access.

Type /prime now to renew.
```

### Expiration Notice (English)

```
😔 Your PRIME membership has expired

Your PNPtv PRIME subscription has ended. You now have free member access.

🎁 Free access:
• Group access
• Free music library
• 3 Nearby Member views per day
• Short video previews

💎 Missing PRIME? Reactivate your membership:
• Full-length exclusive videos
• Unlimited Nearby Members
• Live performances + private calls
• Premium music & podcasts
• Zero ads, all access

Type /prime to reactivate your PRIME membership.
```

## How to Test

### Test 3-Day Reminders

```javascript
// In Node.js console or create a test script
const SubscriptionReminderService = require('./src/bot/services/subscriptionReminderService');
const bot = /* your bot instance */;

SubscriptionReminderService.initialize(bot);
const sent = await SubscriptionReminderService.send3DayReminders();
console.log(`Sent ${sent} reminders`);
```

### Test 1-Day Reminders

```javascript
const sent = await SubscriptionReminderService.send1DayReminders();
console.log(`Sent ${sent} reminders`);
```

### Test Expired Subscriptions

```javascript
const processed = await SubscriptionReminderService.processExpiredSubscriptions();
console.log(`Processed ${processed} expired subscriptions`);
```

### Manual Test with Specific User

```javascript
// Create test user with expiring subscription
const testUser = {
  id: '123456789',
  planExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
  language: 'en'
};

const success = await SubscriptionReminderService.sendReminderToUser(testUser, 3);
console.log(`Reminder sent: ${success}`);
```

## Monitoring

### Check Cron Jobs Status

```bash
pm2 logs pnptvbot --lines 100
```

Look for:
- `🔔 Running 3-day subscription reminder job...`
- `✅ 3-day reminder job completed: X reminders sent`
- `💓 Cron system health check`

### Check Reminder Stats

```bash
pm2 logs pnptvbot | grep "reminder"
```

### Check for Errors

```bash
pm2 logs pnptvbot --err
```

## Troubleshooting

### Reminders Not Sending

**Check if cron is enabled:**
```bash
# Should show ENABLE_CRON=true
cat .env | grep ENABLE_CRON
```

**Check bot logs:**
```bash
pm2 logs pnptvbot --lines 200 | grep -i "cron\|reminder"
```

**Verify service is initialized:**
Look for:
- `✓ Subscription reminder service initialized`
- `✓ Cron jobs started successfully`

### Users Not Receiving Messages

**Possible reasons:**
1. User blocked the bot (error code 403)
2. Chat not found (error code 400)
3. No subscriptions expiring on target dates

**Check logs for specific user:**
```bash
pm2 logs pnptvbot | grep "user_id_here"
```

### Cron Jobs Not Running

**Verify timezone:**
```bash
date
timedatectl  # On Linux
```

**Test cron schedule:**
```javascript
const cron = require('node-cron');

// Test if schedule is valid
cron.validate('0 10 * * *');  // Should return true
```

**Check system time:**
```bash
# Ensure system time is correct
date
```

### Wrong Language Being Sent

**Check user language in database:**
```sql
SELECT id, language FROM users WHERE id = 'user_id_here';
```

**Update user language:**
```sql
UPDATE users SET language = 'es' WHERE id = 'user_id_here';
```

## Configuration

### Subscription Reminder Service

Located in: `src/bot/services/subscriptionReminderService.js`

**Methods:**
- `initialize(bot)` - Initialize with bot instance
- `sendReminders(days)` - Send reminders for subscriptions expiring in N days
- `send3DayReminders()` - Send 3-day reminders
- `send1DayReminders()` - Send 1-day reminders
- `processExpiredSubscriptions()` - Downgrade expired subscriptions
- `sendReminderToUser(user, days)` - Send reminder to specific user
- `sendExpirationNotice(user)` - Send expiration notice to user

### Cron Configuration

Located in: `scripts/cron.js`

**Customizable:**
- Schedule times (cron expressions)
- Timezone
- Which jobs to run
- Rate limiting (delay between messages)

### Message Templates

Located in: `src/bot/services/subscriptionReminderService.js`

**Customize:**
- Message text
- Formatting
- Call-to-action buttons
- Emojis

## Best Practices

1. **Test Before Enabling**
   - Test with your own account first
   - Verify messages look correct in both languages
   - Check timing is appropriate

2. **Monitor Initially**
   - Watch logs closely for first few days
   - Verify correct number of reminders sent
   - Check for any errors

3. **Adjust Timing**
   - Consider your users' timezones
   - Avoid sending during night hours
   - Space out reminders (morning and evening)

4. **Handle Errors Gracefully**
   - Log but don't crash on user errors (blocked bot, etc.)
   - Continue processing remaining users
   - Alert admins on critical errors

5. **Rate Limiting**
   - Include delays between messages (100ms default)
   - Don't overwhelm Telegram API
   - Consider batch size for large user bases

## Architecture

```
src/
├── bot/
│   ├── core/
│   │   └── bot.js                    # Initializes services and cron
│   └── services/
│       └── subscriptionReminderService.js  # Reminder logic
└── scripts/
    └── cron.js                       # Cron job scheduler

Database:
- users table
  - id (user ID)
  - plan_expiry (expiration date)
  - subscription_status (active/free)
  - language (user language preference)
```

## Database Queries

The service uses these UserModel methods:

```javascript
// Get users with subscriptions expiring between dates
UserModel.getSubscriptionsExpiringBetween(startDate, endDate);

// Get all expired subscriptions
UserModel.getExpiredSubscriptions();

// Update subscription status
UserModel.updateSubscription(userId, {
  status: 'free',
  planId: null,
  expiry: null
});
```

## Security & Privacy

- ✅ Messages sent only via private messages
- ✅ Never posted in groups
- ✅ User language preference respected
- ✅ Graceful handling of blocked users
- ✅ No sensitive data in logs
- ✅ Rate-limited to avoid spam

## Support

For issues or questions:
- Check logs: `pm2 logs pnptvbot`
- Review cron schedule in `scripts/cron.js`
- Verify database queries in `src/models/userModel.js`
- Test individual components with test scripts
