# Quick Reactivation Reference

## TL;DR - Just Do It

```bash
# Step 1: Check what will be reactivated (safe, no changes)
node scripts/analyze-payments-status.js

# Step 2: Preview reactivation without making changes (safe)
node scripts/reactivate-completed-payments.js --dry-run

# Step 3: Actually reactivate all payments (live)
node scripts/reactivate-completed-payments.js

# Step 4: Send confirmations to users (optional)
node scripts/reactivate-completed-payments.js --send-notifications
```

---

## Single Command

Run all three providers at once:

```bash
node scripts/reactivate-completed-payments.js
```

This will:
- ✅ Find all completed ePayco payments
- ✅ Find all completed Daimo payments
- ✅ Activate user subscriptions with correct plans
- ✅ Set expiry dates based on plan duration
- ✅ Create audit logs of changes

---

## By Provider

### Just ePayco

```bash
node scripts/reactivate-completed-payments.js --provider=epayco
```

### Just Daimo

```bash
node scripts/reactivate-completed-payments.js --provider=daimo
```

---

## With Notifications

After reactivation, notify users:

```bash
node scripts/reactivate-completed-payments.js --send-notifications
```

Users will receive Telegram messages with:
- Plan details
- Payment amount
- Expiry date
- Exclusive PRIME channel invite link

---

## Analysis Only (No Changes)

See which payments need reactivation:

```bash
node scripts/analyze-payments-status.js
```

Shows:
- Total completed payments
- How many are already activated
- How many need reactivation
- Details of each inactive payment

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| "User not found" | Skip that payment, check database |
| "Plan not found" | Run `node scripts/initialize-plans.js` |
| "Notifications not sent" | Check BOT_TOKEN in .env |
| "Rollback needed" | See REACTIVATION_GUIDE.md section "Recovery / Reversal" |

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/reactivate-completed-payments.js` | Main reactivation script |
| `scripts/analyze-payments-status.js` | Analyze payment status |
| `REACTIVATION_GUIDE.md` | Complete documentation |
| `logs/application.log` | Detailed operation logs |

---

## Verification

After running, verify success:

```bash
# Check active users increased
psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM users WHERE subscription_status='active';"

# View logs
tail -100 logs/application.log | grep -i "reactivat"
```

---

**Need details?** Read `REACTIVATION_GUIDE.md`

**Questions?** Check the troubleshooting section
