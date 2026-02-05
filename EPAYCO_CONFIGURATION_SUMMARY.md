# ePayco Integration - Final Configuration

## ✅ Issues Fixed

1. ✅ Domain separation configured correctly
2. ✅ ePayco webhooks route to easybots.store  
3. ✅ Response URLs route to pnptv.app
4. ✅ Daimo webhooks route to easybots.store
5. ✅ Logo file reference fixed (no more 404)
6. ✅ Fallback domains added for safety

## Environment Variables (.env)

```env
# Telegram Bot Webhook
BOT_WEBHOOK_DOMAIN=https://pnptv.app
BOT_WEBHOOK_PATH=/webhook/telegram

# Payment Checkout Pages
CHECKOUT_DOMAIN=https://easybots.store

# Payment Provider Webhooks  
EPAYCO_WEBHOOK_DOMAIN=https://easybots.store
EPAYCO_WEBHOOK_PATH=/api/webhooks/epayco

DAIMO_WEBHOOK_PATH=/api/webhooks/daimo

# ePayco Credentials
EPAYCO_PUBLIC_KEY=6d5c47f6a632c0bacd5bb31990d4e994
EPAYCO_PRIVATE_KEY=c3b7fa0d75e65dd28804fb9c18989693
EPAYCO_P_CUST_ID=1565511
EPAYCO_P_KEY=4ae1e189c9af6a730b71bc4f15546b78520ad338
EPAYCO_TEST_MODE=false
```

## ePayco Dashboard Configuration

Login to https://dashboard.epayco.co and configure:

### Webhook URLs
- **Confirmation URL:** `https://easybots.store/api/webhooks/epayco`
- **Response URL (Success):** `https://pnptv.app/api/payment-response?status=success`
- **Response URL (Failure):** `https://pnptv.app/api/payment-response?status=failed`

### Test Webhook
Use ePayco's test webhook feature to send a test notification to:
`https://easybots.store/api/webhooks/epayco`

## Files Modified

1. `src/config/daimo.js` - Fixed webhook domain and logo reference
2. `src/bot/services/paymentService.js` - Simplified checkout domain logic
3. `src/bot/api/controllers/paymentController.js` - Fixed response URL routing
4. `.env` - Added EPAYCO_WEBHOOK_DOMAIN configuration
5. `.env.example` - Updated documentation
6. `env.template` - Updated documentation

## How to Deploy

```bash
# 1. Verify configuration
grep -E "WEBHOOK_DOMAIN|CHECKOUT" .env

# 2. Restart the application
pm2 restart pnptvbot

# 3. Check logs
pm2 logs pnptvbot --lines 50

# 4. Test a payment
# Create a test payment from the Telegram bot
# Monitor logs during payment:
pm2 logs pnptvbot | grep -i "epayco\|webhook\|payment"
```

## Verification Checklist

- [ ] Environment variables are set correctly
- [ ] Application restarted
- [ ] ePayco dashboard configured with correct URLs
- [ ] Test payment completes successfully  
- [ ] Webhook notification received and processed
- [ ] PRIME membership activated automatically
- [ ] User receives Telegram notification
- [ ] User sees success page after payment

## Support

If you encounter the "Access Denied" error again:
1. Check browser console (F12) for detailed error
2. Check server logs: `pm2 logs pnptvbot --lines 100`
3. Verify ePayco credentials are active
4. Ensure webhook URL in ePayco dashboard matches exactly
