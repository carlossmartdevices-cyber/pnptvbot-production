# 🔧 Integration Guide - Private Calls System

## How to Integrate Private Calls System into Existing Bot

### Step 1: Initialize Database Tables

Run the migration to create all necessary tables:

```bash
cd /root/pnptvbot-production
psql -U pnptvbot -d pnptvbot -f database/migrations/004_create_models_system.sql
```

Or programmatically in your bot initialization:

```javascript
const ModelManagementModel = require('./src/models/modelManagementModel');

// In your bot startup
await ModelManagementModel.initTables();
```

### Step 2: Register Handlers in Bot Core

Edit `src/bot/core/bot.js` to add the new handlers:

```javascript
// Add these imports at the top
const registerPrivateCallsBookingHandlers = require('../handlers/user/privateCallsBooking');
const registerModelManagementHandlers = require('../handlers/admin/modelManagement');
const integratePrivateCallsToMenu = require('../handlers/user/mainMenuIntegration');

// In the bot initialization section (after other handlers)
registerPrivateCallsBookingHandlers(bot);
registerModelManagementHandlers(bot);
integratePrivateCallsToMenu(bot);

logger.info('✓ Private calls system initialized');
```

### Step 3: Update Main Menu

If you have an existing main menu handler in `src/bot/handlers/user/menu.js`:

Find the `menu_main` action and update the keyboard to include:

```javascript
// In the menu keyboard array, add:
[{
  text: lang === 'es' ? '📞 Llamadas Privadas' : '📞 Private Calls',
  callback_data: 'book_private_call'
}]
```

Example location in menu.js (around line 300-400):

```javascript
bot.action('menu_main', async (ctx) => {
  const keyboard = [
    // ... existing options ...
    [{
      text: '📞 Private Calls',
      callback_data: 'book_private_call'
    }],
    // ... more options ...
  ];

  await ctx.editMessageText('Main Menu', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});
```

### Step 4: Update Admin Menu

In `src/bot/handlers/admin/` (wherever your admin menu is), add:

```javascript
bot.action('admin_main_menu', async (ctx) => {
  const keyboard = [
    // ... existing options ...
    [{
      text: '👥 Models Management',
      callback_data: 'admin_models'
    }],
    // ... more options ...
  ];

  await ctx.editMessageText('Admin Menu', {
    reply_markup: { inline_keyboard: keyboard }
  });
});
```

### Step 5: Setup Payment Processing

Update webhook handlers in `src/bot/api/routes.js` to handle booking payment confirmations:

```javascript
// Stripe webhook for bookings
app.post('/api/webhooks/stripe-bookings', async (req, res) => {
  try {
    const event = req.body;

    if (event.type === 'payment_intent.succeeded') {
      const bookingId = event.data.object.metadata.booking_id;
      const transactionId = event.data.object.id;

      await BookingPaymentService.processPaymentSuccess(
        bookingId,
        transactionId,
        'stripe'
      );
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).send('Webhook error');
  }
});

// ePayco webhook for bookings
app.post('/api/webhooks/epayco-bookings', async (req, res) => {
  try {
    const bookingId = req.body.booking_id;
    const transactionId = req.body.x_id;

    if (req.body.x_cod_response === '1') { // Success
      await BookingPaymentService.processPaymentSuccess(
        bookingId,
        transactionId,
        'epayco'
      );
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).send('Webhook error');
  }
});
```

### Step 6: Setup Cron Jobs (Optional)

Add scheduled tasks for booking management:

```javascript
// In src/scripts/cron.js or similar
const cron = require('node-cron');
const BookingPaymentService = require('../bot/services/bookingPaymentService');

// Check for bookings to activate (every minute)
cron.schedule('* * * * *', async () => {
  try {
    await BookingPaymentService.checkAndActivateBookings();
  } catch (error) {
    logger.error('Cron error:', error);
  }
});
```

### Step 7: Environment Variables

Add to your `.env` file:

```env
# Video Platform
JITSI_DOMAIN=meet.jit.si
JITSI_MUC_DOMAIN=conference.jit.si

# Commission (percentage taken by platform)
COMMISSION_PERCENTAGE=30

# Default model availability times (for new models)
DEFAULT_AVAILABILITY_START=09:00
DEFAULT_AVAILABILITY_END=22:00

# Booking timeout (minutes, how long before unpaid booking expires)
BOOKING_TIMEOUT=30
```

## Testing the Integration

### 1. Test Database Connection

```bash
psql -U pnptvbot -d pnptvbot -c "SELECT COUNT(*) FROM models;"
```

Should return: `(1 row) count = 0` initially

### 2. Test Model Creation via Admin

1. Start bot
2. Send `/admin_models`
3. Click "➕ Add New Model"
4. Fill in the 7-step wizard
5. Check database: `SELECT * FROM models;`

### 3. Test Booking Flow

1. Send `/menu`
2. Click "📞 Private Calls"
3. Select model
4. Select date, time, duration
5. Choose payment method
6. Verify booking created: `SELECT * FROM model_bookings;`

### 4. Test Status Toggle

1. `/admin_models`
2. Click "View All Models"
3. Select model
4. Toggle Status
5. Check status updated: `SELECT * FROM model_status;`

## Troubleshooting Integration

### Issue: "Module not found: modelManagementModel"

**Solution**: Ensure the file exists:
```bash
ls -la src/models/modelManagementModel.js
```

If not, create it from the code provided above.

### Issue: "PostgreSQL table doesn't exist"

**Solution**: Run the migration:
```bash
psql -U pnptvbot -d pnptvbot -f database/migrations/004_create_models_system.sql
```

Or check if it ran successfully:
```sql
\dt models
```

### Issue: Handler not responding

**Solution**: Verify registration in bot.js:
```bash
grep -n "privateCallsBooking\|modelManagement" src/bot/core/bot.js
```

Should show both imports and registrations.

### Issue: Admin models button not showing

**Solution**: Ensure admin_main_menu has the button added. Check:
```bash
grep -n "admin_models" src/bot/handlers/admin/*.js
```

### Issue: Payment webhook not processing

**Solution**:
1. Verify webhook URL in payment provider dashboard
2. Check webhook logs: `tail -f logs/error-*.log`
3. Test webhook manually: `curl -X POST http://localhost:3000/api/webhooks/stripe-bookings -H "Content-Type: application/json" -d '{...}'`

## Database Queries for Debugging

```sql
-- See all models
SELECT * FROM models;

-- See model status
SELECT * FROM model_status;

-- See all bookings
SELECT * FROM model_bookings;

-- See available models right now
SELECT * FROM models m
WHERE m.is_active = true
AND (SELECT status FROM model_status ms WHERE ms.model_id = m.model_id) = 'online';

-- See today's bookings
SELECT * FROM model_bookings
WHERE scheduled_date = CURRENT_DATE
ORDER BY start_time;

-- Model earnings
SELECT
  m.display_name,
  COUNT(b.id) as total_bookings,
  SUM(me.model_earnings) as total_earnings,
  SUM(me.amount * 0.3) as platform_commission
FROM models m
LEFT JOIN model_bookings b ON m.model_id = b.model_id
LEFT JOIN model_earnings me ON b.id = me.booking_id
WHERE b.status = 'completed'
GROUP BY m.model_id, m.display_name;
```

## File Structure After Integration

```
src/
├── models/
│   ├── modelManagementModel.js          ← NEW
│   └── ... (existing models)
│
├── bot/
│   ├── handlers/
│   │   ├── user/
│   │   │   ├── privateCallsBooking.js   ← NEW
│   │   │   ├── mainMenuIntegration.js   ← NEW
│   │   │   └── ... (existing)
│   │   │
│   │   ├── admin/
│   │   │   ├── modelManagement.js       ← NEW
│   │   │   └── ... (existing)
│   │   │
│   │   └── index.js                     ← NEW (optional)
│   │
│   ├── services/
│   │   ├── bookingPaymentService.js     ← NEW
│   │   └── ... (existing)
│   │
│   ├── core/
│   │   └── bot.js                       ← MODIFIED (add handlers)
│   │
│   └── api/
│       └── routes.js                    ← MODIFIED (add webhooks)
│
└── config/
    └── ... (existing)

database/migrations/
├── 004_create_models_system.sql         ← NEW
└── ... (existing)
```

## Next Steps

1. **Test Everything**: Run through all user flows
2. **Monitor Logs**: Watch `logs/` for errors during testing
3. **Load Test**: Try multiple concurrent bookings
4. **Payment Testing**: Test with payment provider sandbox
5. **Go Live**: Deploy to production

## Support & Debugging

Enable debug logging by adding to bot.js:

```javascript
// Set log level to debug
logger.setLevel('debug');
```

Then monitor detailed logs:

```bash
tail -f logs/combined-*.log | grep -i "models\|booking\|payment"
```

---

**Documentation Last Updated**: 2026-01-18
**System Version**: 1.0.0
**Status**: Ready for Integration
