# Payment Reactivation Guide

## Overview

This guide explains how to reactivate all completed payments from ePayco and Daimo payment providers. The reactivation script ensures that users who have completed payments are properly activated with their respective subscription plans.

## What Gets Reactivated

The script reactivates payments by:

1. ✅ Finding all payments with status `completed` from specified providers
2. ✅ Fetching the associated plan details
3. ✅ Calculating the subscription expiry date (current date + plan duration)
4. ✅ Updating user subscription status to `active`
5. ✅ Optionally sending payment confirmation messages to users
6. ✅ Optionally sending confirmation notifications via Telegram

## Quick Start

### Basic Usage (Dry-Run - Preview Changes)

```bash
# Preview all ePayco and Daimo reactivations without making changes
node scripts/reactivate-completed-payments.js --dry-run
```

### Basic Usage (Live - Make Changes)

```bash
# Reactivate all completed ePayco and Daimo payments
node scripts/reactivate-completed-payments.js
```

### With Notifications

```bash
# Reactivate and send Telegram confirmations to users
node scripts/reactivate-completed-payments.js --send-notifications
```

## Advanced Usage

### Reactivate Only ePayco Payments

```bash
# Preview only ePayco reactivations
node scripts/reactivate-completed-payments.js --provider=epayco --dry-run

# Actually reactivate ePayco payments
node scripts/reactivate-completed-payments.js --provider=epayco
```

### Reactivate Only Daimo Payments

```bash
# Preview only Daimo reactivations
node scripts/reactivate-completed-payments.js --provider=daimo --dry-run

# Actually reactivate Daimo payments
node scripts/reactivate-completed-payments.js --provider=daimo
```

### Full Reactivation with Notifications

```bash
# This is the complete workflow:
# 1. Find all completed ePayco and Daimo payments
# 2. Activate user subscriptions
# 3. Send Telegram payment confirmations to each user
node scripts/reactivate-completed-payments.js --send-notifications
```

## Script Options

| Option | Description | Example |
|--------|-------------|---------|
| `--provider=PROVIDER` | Limit to specific provider: `epayco`, `daimo`, or `all` (default) | `--provider=epayco` |
| `--dry-run` | Preview changes without making them | `--dry-run` |
| `--send-notifications` | Send Telegram payment confirmations to users | `--send-notifications` |

## Output Examples

### Dry-Run Mode

```
🔄 Reactivating Completed Payments
📦 Providers: EPAYCO, DAIMO
🔍 DRY-RUN MODE
🤫 No notifications
────────────────────────────────────────────────────

📍 Processing EPAYCO payments...
   Found 5 completed payments

📋 [DRY-RUN] Would reactivate payment:
   Payment ID: 550e8400-e29b-41d4-a716-446655440000
   User ID: 123456789 (@username)
   Plan: PNP Member (30 days)
   Amount: $24.99 USD
   Provider: EPAYCO
   Expiry: 2025-01-26

[... more payments ...]

────────────────────────────────────────────────────
📊 Summary:
   Total processed: 5
   ✅ Successful: 5
   ❌ Failed: 0

🔍 DRY-RUN COMPLETE - No changes were made
```

### Live Mode

```
🔄 Reactivating Completed Payments
📦 Providers: EPAYCO, DAIMO
⚙️  LIVE MODE
🤫 No notifications
────────────────────────────────────────────────────

📍 Processing EPAYCO payments...
   Found 5 completed payments

[Processing 5 payments...]

📍 Processing DAIMO payments...
   Found 3 completed payments

[Processing 3 payments...]

────────────────────────────────────────────────────
📊 Summary:
   Total processed: 8
   ✅ Successful: 8
   ❌ Failed: 0

✅ Reactivation complete!
```

### With Notifications

```
📨 Will send notifications

[... reactivation messages ...]

   ✅ Notification sent to user 123456789
   ✅ Notification sent to user 987654321
```

## What Happens During Reactivation

### For Each Payment:

1. **Payment Lookup**: Find payment record in database
2. **Plan Lookup**: Get plan details (name, duration, features)
3. **Expiry Calculation**: `current_date + plan.duration_days`
4. **User Update**: Set user subscription_status to `active` with new plan and expiry
5. **Optional Notification**: Send Telegram message to user

### Telegram Notification Sent

Users will receive a message like:

```
🎉 ¡Pago Confirmado!

✅ Tu suscripción ha sido activada exitosamente.

📋 Detalles de la Compra:
💎 Plan: PNP Member
💵 Monto: $24.99 USD
📅 Válido hasta: 26 de enero de 2025
🔖 ID de Transacción: 320358448

🌟 ¡Bienvenido a PRIME!

👉 Accede al canal exclusivo aquí:
[🔗 Ingresar a PRIME](unique_invite_link)

💎 Disfruta de todo el contenido premium y beneficios exclusivos.

¡Gracias por tu suscripción! 🙏
```

## Best Practices

### 1. Always Start with Dry-Run

```bash
# Preview what will happen
node scripts/reactivate-completed-payments.js --dry-run

# Review the output carefully
# Then run the actual reactivation
node scripts/reactivate-completed-payments.js
```

### 2. Use Provider-Specific Reactivation

```bash
# Reactivate one provider at a time for better control
node scripts/reactivate-completed-payments.js --provider=epayco --dry-run
node scripts/reactivate-completed-payments.js --provider=epayco

# Then handle Daimo
node scripts/reactivate-completed-payments.js --provider=daimo --dry-run
node scripts/reactivate-completed-payments.js --provider=daimo
```

### 3. Monitor Logs

The script logs everything to the application logger:

```bash
# Watch logs in real-time
tail -f logs/application.log | grep "reactivat"
```

### 4. Notify Users

Send notifications only after verifying reactivation worked:

```bash
# First reactivate
node scripts/reactivate-completed-payments.js

# Then send notifications
node scripts/reactivate-completed-payments.js --send-notifications
```

## Troubleshooting

### Issue: "User not found"

This means the payment record has a user_id that doesn't exist in the database.

**Solution**: Check if the user still exists or if there's a data inconsistency:

```bash
# Check the problematic payment
node scripts/find-payment-by-reference.js <payment_id>

# Manually verify the user exists
```

### Issue: "Plan not found"

The payment is linked to a plan_id that doesn't exist.

**Solution**: Verify plans are initialized:

```bash
# Initialize default plans
node scripts/initialize-plans.js
```

### Issue: Notifications not sending

The bot token might be invalid or the user might have blocked the bot.

**Solution**:
1. Verify BOT_TOKEN in .env
2. Check if user has started the bot with `/start`
3. Review logs for specific errors

### Issue: Only some payments processed

The script stops processing if it encounters an error in a batch.

**Solution**:
1. Review the error message
2. Fix the underlying issue (e.g., missing plan)
3. Re-run the script (it won't reprocess already-activated users)

## Database Impact

### Before Reactivation

```sql
-- User subscription is inactive
SELECT id, subscription_status, plan_id, plan_expiry
FROM users WHERE id = '123456789';

-- Result:
-- id       | subscription_status | plan_id      | plan_expiry
-- 123456789| free               | NULL         | NULL
```

### After Reactivation

```sql
-- User subscription is now active
SELECT id, subscription_status, plan_id, plan_expiry
FROM users WHERE id = '123456789';

-- Result:
-- id       | subscription_status | plan_id        | plan_expiry
-- 123456789| active             | pnp_member     | 2025-01-26
```

## Verification

### Check if Reactivation Worked

```bash
# Query users by subscription status
psql -U postgres -d pnptv_db -c "
  SELECT COUNT(*) as active_users
  FROM users
  WHERE subscription_status = 'active';"

# Check specific user
psql -U postgres -d pnptv_db -c "
  SELECT id, username, subscription_status, plan_id, plan_expiry
  FROM users
  WHERE id = '123456789';"
```

### Check Logs

```bash
# View reactivation logs
grep "reactivated\|Subscription activated" logs/application.log | tail -20
```

## Recovery / Reversal

If something goes wrong, you can manually revert:

```sql
-- Set user back to free subscription
UPDATE users
SET subscription_status = 'free', plan_id = NULL, plan_expiry = NULL
WHERE id = '123456789';
```

Or create a reversal script if needed.

## Environment Requirements

Ensure these are set in your `.env` file:

```bash
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgresql://user:pass@localhost/pnptv_db
LOG_LEVEL=info
```

## Performance

- **Processing Speed**: ~100-200 payments per minute (with 100ms delay between each)
- **Notification Speed**: ~10-20 notifications per minute
- **Database Impact**: Minimal - uses indexed queries on `status` and `provider`

## Support

For issues or questions:

1. Check logs: `logs/application.log`
2. Review this guide
3. Run with `--dry-run` first
4. Contact the development team with:
   - Error messages from logs
   - Number of payments to reactivate
   - Which providers are affected

---

**Last Updated**: 2025-12-27
**Script Location**: `scripts/reactivate-completed-payments.js`
**Version**: 1.0
