# Payment Webhook Flow - Domain Configuration

## ✅ Yes, this configuration will work correctly!

The domain separation is ONLY for routing - your backend still processes everything the same way.

## How It Works

### 1. User Makes Payment
```
User clicks "Pay"
→ Checkout page loads from easybots.store/payment/{id}
→ ePayco checkout opens
→ User completes payment
```

### 2. ePayco/Daimo Sends Webhook (Server-to-Server)
```
ePayco/Daimo servers
→ POST https://easybots.store/api/webhooks/epayco
   (with payment confirmation data)
→ Your webhook handler processes the payment
→ Activates PRIME membership
→ Updates database
→ Sends confirmation to user via Telegram
```

### 3. User Redirected to Success Page
```
ePayco redirects user's browser
→ https://pnptv.app/api/payment-response?status=success
→ User sees "Payment Successful" page
```

## What You Get From ePayco/Daimo

### ✅ All Payment Attempts
The webhook receives notifications for:
- ✅ **Successful payments** (`x_transaction_state=Aceptada`)
- ✅ **Failed payments** (`x_transaction_state=Rechazada`)
- ✅ **Pending payments** (`x_transaction_state=Pendiente`)

### ✅ Automatic PRIME Activation
When webhook receives successful payment:
1. Verifies signature (security)
2. Updates payment status to 'completed'
3. Activates user subscription
4. Creates unique PRIME channel invite link
5. Sends Telegram notification to user
6. Sends welcome & invoice emails (if email available)

**Code location:** `src/bot/services/paymentService.js:493-779` (processEpaycoWebhook)

## Configuration Summary

```env
# Current .env configuration
BOT_WEBHOOK_DOMAIN=https://pnptv.app           # Telegram bot & API
CHECKOUT_DOMAIN=https://easybots.store         # Checkout pages
EPAYCO_WEBHOOK_DOMAIN=https://easybots.store   # Payment webhooks
```

### ePayco Dashboard Settings
Configure in your ePayco account:
- **Confirmation URL:** `https://easybots.store/api/webhooks/epayco`
- **Response URL:** `https://pnptv.app/api/payment-response`

## Why Two Domains?

**easybots.store** - Payment processing endpoints (webhook callbacks)
- Likely configured in ePayco dashboard already
- Receives server-to-server notifications
- May have specific SSL/firewall rules for payment providers

**pnptv.app** - User-facing pages and Telegram bot
- Hosts the bot webhook
- Serves success/failure pages to users
- Main application backend

## Nothing Breaks!

✅ **Payment webhook processing** - Still works (easybots.store receives webhooks)
✅ **PRIME activation** - Still automatic (webhook handler activates)
✅ **Email notifications** - Still sent (webhook triggers emails)
✅ **Telegram notifications** - Still sent (webhook sends to bot)
✅ **User redirects** - Now work correctly (pnptv.app has the page)

## Test Webhook Routing

Both domains route to your backend:
```bash
# Test ePayco webhook
curl -X POST https://easybots.store/api/webhooks/epayco \
  -d "x_ref_payco=TEST&x_transaction_state=Aceptada" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Test Daimo webhook
curl -X POST https://easybots.store/api/webhooks/daimo \
  -d '{"id":"test","status":"payment_completed"}' \
  -H "Content-Type: application/json"
```

Both should return 400/401 errors (missing valid signature) which means the endpoints exist and are working!

## Next Steps

1. **Update ePayco dashboard** with these URLs (if not already set)
2. **Restart application**: `pm2 restart pnptvbot`
3. **Test a payment** to verify the full flow
4. **Monitor logs**: `pm2 logs pnptvbot | grep -i webhook`
