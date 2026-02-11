# ePayco Payment Recovery and Cleanup Fixes - Implementation Summary

## Implementation Status: ✓ COMPLETE

All three fixes have been successfully implemented and tested.

---

## Fix A: Automated Payment Recovery (Every 2 Hours)

**Files Modified:**
- `src/bot/services/paymentRecoveryService.js` (NEW)
- `scripts/cron.js` (updated)

**What it does:**
- Runs every 2 hours (configurable via `PAYMENT_RECOVERY_CRON` env var)
- Queries payments stuck in "pending" status for > 10 minutes
- Only processes payments from the last 24 hours (avoids very old orphaned records)
- Uses existing `PaymentService.checkEpaycoTransactionStatus()` to check ePayco API
- If payment was completed at ePayco but webhook was lost, replays webhook via `recoverStuckPendingPayment()`
- Prevents indefinite "waiting for 3DS" state

**Recovery Flow:**
```
Query stuck payments (pending > 10min, < 24h old)
    ↓
For each payment:
  - Check status at ePayco API
  - If completed: replay webhook to activate subscription
  - If still pending: log for manual review
  - If failed: mark as failed
    ↓
Log results to audit trail
```

**Key Methods:**
- `PaymentRecoveryService.processStuckPayments()` - Main recovery process
- Uses Redis lock to prevent duplicate runs
- Rate limiting: 100ms delay between payments

**Testing:**
```bash
node -e "require('./src/bot/services/paymentRecoveryService').processStuckPayments()"
```

---

## Fix B: Abandoned Payment Cleanup (Daily at Midnight)

**Files Modified:**
- `src/bot/services/paymentRecoveryService.js` (NEW)
- `scripts/cron.js` (updated)

**What it does:**
- Runs daily at midnight (configurable via `PAYMENT_CLEANUP_CRON` env var)
- Finds all payments pending > 24 hours
- Marks them as "abandoned" with reason "3DS_TIMEOUT" in metadata
- Prevents indefinite pending payments from accumulating

**Cleanup Impact:**
- Payments are marked with timestamp when abandoned
- No ePayco API calls needed - purely local database cleanup
- Safe operation: only changes status, doesn't delete data

**Key Methods:**
- `PaymentRecoveryService.cleanupAbandonedPayments()` - Cleanup process
- `PaymentRecoveryService.getStats()` - Get recovery statistics

**Testing:**
```bash
node -e "require('./src/bot/services/paymentRecoveryService').cleanupAbandonedPayments()"
```

---

## Fix C: Email Fallback Chain

**Files Modified:**
- `src/bot/services/paymentService.js` (lines 628-650 in webhook handler)

**What it does:**
- When ePayco webhook lacks `x_customer_email`, tries fallback sources
- Fallback priority: `x_customer_email` → `user.email` → `subscriber.email`
- Ensures invoice/welcome emails are sent even with incomplete webhook data
- Also applies to admin notifications

**Email Fallback Implementation:**
```javascript
// At the start of webhook processing (line 628-650)
let customerEmail = x_customer_email;
if (!customerEmail && userId) {
  // Try user email
  const user = await UserModel.getById(userId);
  customerEmail = user?.email;

  // Try subscriber email
  if (!customerEmail) {
    const subscriber = await SubscriberModel.getByTelegramId(userId);
    customerEmail = subscriber?.email;
  }
}

// Use customerEmail for:
// - Invoice email (line 832)
// - Welcome email (line 857)
// - Subscriber mapping (line 678)
// - Admin notification (line 759)
```

**Email Sent:**
- Invoice email: Contains payment details and invoice number
- Welcome email: Contains plan details and access information
- Admin notification: Contains payment info for business tracking

**Testing:**
1. Create webhook without `x_customer_email` field
2. Ensure user/subscriber has email in database
3. Verify emails are sent using fallback email
4. Check logs for "Using fallback email from subscriber/user" messages

---

## Environment Variables Added

```env
# Recovery job - runs every 2 hours (default)
PAYMENT_RECOVERY_CRON=0 */2 * * *

# Cleanup job - runs daily at midnight (default)
PAYMENT_CLEANUP_CRON=0 0 * * *
```

**Usage:**
```bash
# Override recovery frequency (every hour instead of 2)
PAYMENT_RECOVERY_CRON="0 * * * *" npm start

# Override cleanup time (noon instead of midnight)
PAYMENT_CLEANUP_CRON="0 12 * * *" npm start
```

---

## Database Queries

### Fix A: Query stuck payments
```sql
SELECT id, reference, metadata->>'epayco_ref' as epayco_ref,
       user_id, plan_id, created_at
FROM payments
WHERE status = 'pending'
  AND provider = 'epayco'
  AND metadata->>'epayco_ref' IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
  AND created_at < NOW() - INTERVAL '10 minutes'
ORDER BY created_at ASC
LIMIT 100
```

### Fix B: Mark abandoned payments
```sql
UPDATE payments
SET status = 'abandoned',
    metadata = metadata || '{"abandoned_at": "timestamp", "reason": "3DS_TIMEOUT"}'::jsonb
WHERE status = 'pending'
  AND provider = 'epayco'
  AND created_at < NOW() - INTERVAL '24 hours'
RETURNING id, user_id, reference
```

### Fix C: Email fallback sources
```sql
-- User email
SELECT email FROM users WHERE id = $1

-- Subscriber email
SELECT email FROM subscribers WHERE telegram_id = $1
```

---

## ePayco SDK Methods Used

**No new SDK methods** - All fixes use existing, documented SDK methods:

### Fix A - Status Check
```javascript
const statusResult = await epaycoClient.charge.get(refPayco);
// Returns: x_transaction_state, x_ref_payco, etc.
```

### Fix B - Database only
No SDK calls needed.

### Fix C - Webhook Processing
```javascript
// ePayco webhook fields (x_-prefixed)
x_customer_email, x_transaction_state, x_ref_payco, etc.
```

---

## Logging and Audit Trail

**Fix A - Recovery Logs:**
```
[INFO] Starting payment recovery process...
[INFO] Found X stuck payments to process
[INFO] Processing stuck payment { paymentId, refPayco, createdAt }
[INFO] Payment recovered and webhook replayed { paymentId, refPayco }
[WARN] Payment still pending at ePayco { refPayco, message }
[INFO] Payment recovery process completed { duration, checked, recovered, stillPending, failed }
```

**Fix B - Cleanup Logs:**
```
[INFO] Starting abandoned payment cleanup...
[INFO] Marked X payments as abandoned { count }
[INFO] Payment marked as abandoned { paymentId, userId, reference }
[INFO] Abandoned payment cleanup completed { duration, cleaned }
```

**Fix C - Email Fallback Logs:**
```
[INFO] Using fallback email from subscriber { userId, refPayco }
[INFO] Invoice email sent successfully { to, refPayco }
[INFO] Welcome email sent successfully { to, planId, language }
```

---

## Verification Checklist

- ✓ `PaymentRecoveryService.js` created with correct imports
- ✓ `processStuckPayments()` method implemented
- ✓ `cleanupAbandonedPayments()` method implemented
- ✓ `getStats()` method for monitoring
- ✓ Redis lock mechanism for preventing duplicate runs
- ✓ Cron jobs added to `cron.js`
- ✓ Email fallback chain integrated into webhook handler
- ✓ Environment variables added to `.env.example`
- ✓ All syntax checks pass (node -c)
- ✓ Test script passes (`scripts/test-payment-recovery.js`)
- ✓ Existing PaymentService methods work with recovery
- ✓ No breaking changes to existing functionality

---

## Risk Assessment

**Low Risk:**
- All fixes use existing, tested code paths
- No new external API integrations
- No database schema changes
- Backward compatible with existing payments
- Idempotent operations (safe to run multiple times)

**Observable:**
- Detailed logging for all operations
- Optional: Query payment stats via `getStats()`
- Admin can verify via payment status changes
- Webhook replays are logged for audit trail

---

## Manual Testing Steps

### Test Fix A (Recovery):
```bash
# 1. Create a stuck pending payment manually
INSERT INTO payments (id, user_id, plan_id, status, provider, amount, currency, metadata, created_at)
VALUES (gen_random_uuid(), 123456, 'week_pass', 'pending', 'epayco',
        9.99, 'USD', '{"epayco_ref": "123456789"}', NOW() - INTERVAL '15 minutes');

# 2. Wait 10+ minutes
sleep 600

# 3. Trigger recovery
node -e "require('./src/bot/services/paymentRecoveryService').processStuckPayments()"

# 4. Check payment status changed or recovery logged
```

### Test Fix B (Cleanup):
```bash
# 1. Create old pending payment
INSERT INTO payments (id, user_id, plan_id, status, provider, amount, currency, metadata, created_at)
VALUES (gen_random_uuid(), 123456, 'week_pass', 'pending', 'epayco',
        9.99, 'USD', '{"epayco_ref": "123456789"}', NOW() - INTERVAL '25 hours');

# 2. Run cleanup
node -e "require('./src/bot/services/paymentRecoveryService').cleanupAbandonedPayments()"

# 3. Verify status = 'abandoned'
SELECT status FROM payments WHERE id = '...'
```

### Test Fix C (Email Fallback):
```bash
# 1. Create webhook without x_customer_email:
{
  x_ref_payco: "123456789",
  x_transaction_state: "Aceptada",
  x_extra1: "123456",  // userId
  x_extra3: "payment-id",
  x_amount: "9.99"
  // Note: x_customer_email is missing
}

# 2. Ensure user has email in database
UPDATE users SET email = 'test@example.com' WHERE id = 123456

# 3. Process webhook
# Webhook handler will use fallback email for invoice/welcome emails

# 4. Verify emails were sent to fallback email address
```

---

## Rollback Plan

If issues arise, rollback is straightforward:

```bash
# 1. Remove cron jobs from cron.js (lines added for recovery/cleanup)
# 2. Delete paymentRecoveryService.js (optional - doesn't run if cron removed)
# 3. Revert paymentService.js webhook handler (or just remove email fallback fix)
# 4. Remove env vars from .env

# No database migrations or schema changes needed - fully reversible
```

---

## Future Enhancements

1. **Payment Recovery Dashboard**
   - Display recovery statistics
   - Manual trigger button for one-off recovery
   - Historical audit trail of recovered payments

2. **Enhanced Notifications**
   - Notify user when payment is recovered
   - Alert admin if recovery attempts exceed threshold

3. **Advanced Fallbacks**
   - Add phone number fallback
   - SMS notifications for failed email delivery

4. **ePayco Webhook Reliability**
   - Implement webhook retry mechanism
   - Webhook signing verification
   - Dead letter queue for failed webhooks

---

## References

- PaymentService: `src/bot/services/paymentService.js`
- PaymentRecoveryService: `src/bot/services/paymentRecoveryService.js`
- Cron Jobs: `scripts/cron.js`
- MembershipCleanupService pattern: `src/bot/services/membershipCleanupService.js`
- ePayco SDK: https://github.com/epayco/epayco-node

---

**Implementation Date:** 2026-02-11
**Status:** Complete and Tested ✓
