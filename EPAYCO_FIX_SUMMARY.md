# ePayco Integration Fix Summary

## Issues Identified and Fixed

### 1. Missing EPAYCO_WEBHOOK_DOMAIN Environment Variable
**Problem:** The `EPAYCO_WEBHOOK_DOMAIN` was not set, causing webhook callbacks to use an incorrect domain.

**Fix:**
- Added `EPAYCO_WEBHOOK_DOMAIN=https://easybots.store` to `.env`
- Updated `.env.example` and `env.template` to include this variable
- Modified `paymentController.js` to use fallback domain if not set

**Location:**
- `.env` (line added)
- `.env.example` (updated)
- `env.template` (updated)
- `src/bot/api/controllers/paymentController.js:82-83`

### 2. Missing Logo File Reference
**Problem:** Daimo configuration referenced `${BOT_WEBHOOK_DOMAIN}/logo.png` which doesn't exist, potentially causing 404 errors.

**Fix:**
- Updated `src/config/daimo.js` to use optional `DAIMO_APP_ICON` environment variable
- Removed hardcoded logo path reference
- Logo icon now defaults to `null` if not configured

**Location:** `src/config/daimo.js:80-84`

### 3. Checkout Domain Configuration
**Problem:** Multiple fallback chains for checkout domain causing confusion.

**Fix:**
- Simplified checkout domain logic in `paymentService.js`
- Now uses `CHECKOUT_DOMAIN` directly with fallback to `https://easybots.store`
- Removed complex fallback chain

**Location:** `src/bot/services/paymentService.js:156`

### 4. Webhook Domain Fallback
**Problem:** Missing fallback for `BOT_WEBHOOK_DOMAIN` in payment controller.

**Fix:**
- Added fallback to `https://pnptv.app` if `BOT_WEBHOOK_DOMAIN` is not set
- Ensures webhook callbacks always have a valid URL

**Location:** `src/bot/api/controllers/paymentController.js:82`

## ePayco Configuration Requirements

### Required Environment Variables:
```env
# ePayco Credentials
EPAYCO_PUBLIC_KEY=6d5c47f6a632c0bacd5bb31990d4e994
EPAYCO_PRIVATE_KEY=c3b7fa0d75e65dd28804fb9c18989693
EPAYCO_P_CUST_ID=1565511
EPAYCO_P_KEY=4ae1e189c9af6a730b71bc4f15546b78520ad338
EPAYCO_TEST_MODE=false

# Domain Configuration
BOT_WEBHOOK_DOMAIN=https://pnptv.app
CHECKOUT_DOMAIN=https://easybots.store
EPAYCO_WEBHOOK_DOMAIN=https://easybots.store  # Added for webhook callbacks
```

### ePayco Webhook Configuration:
- **Webhook URL:** `https://easybots.store/api/webhooks/epayco`
- **Confirmation URL:** Same as webhook URL
- **Response URL:** `https://easybots.store/api/payment-response`

## Webhook Endpoint Status
✅ **easybots.store webhook:** Working (HTTP 405 on GET - accepts POST only)
❌ **pnptv.app webhook:** Not configured (HTTP 404)

## Signature Generation

The ePayco integration uses MD5 signature for checkout:
```
MD5(p_cust_id^p_key^invoice^amount^currency_code)
```

Example:
```
String: 1565511^4ae1...338^PAY-12345^120000^COP
MD5: d7a7c72bb03be6f9af1de3ecb1837773
```

## About the "Access Denied" XML Error

The XML "Access Denied" error is likely due to:

1. **ePayco API credentials** - Verify your credentials in the ePayco dashboard
2. **Webhook URL configuration** - Ensure ePayco has `https://easybots.store/api/webhooks/epayco`
3. **CORS/Asset loading** - Payment pages trying to load missing resources
4. **Test mode mismatch** - Check if EPAYCO_TEST_MODE matches your dashboard settings

## Debugging Steps

1. **Check webhook configuration in ePayco dashboard:**
   - Login to ePayco dashboard
   - Verify webhook URL is set to: `https://easybots.store/api/webhooks/epayco`
   - Verify credentials match your .env file

2. **Test a payment:**
   - Create a test payment from the bot
   - Open browser developer tools (F12)
   - Check Console and Network tabs for errors
   - Look for XML responses in the Network tab

3. **Monitor server logs:**
   ```bash
   pm2 logs pnptvbot --lines 100 | grep -i epayco
   ```

4. **Test webhook endpoint:**
   ```bash
   curl -X POST https://easybots.store/api/webhooks/epayco \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "x_ref_payco=test&x_transaction_state=Pendiente"
   ```

## Files Modified
1. `src/config/daimo.js` - Fixed logo reference
2. `src/bot/services/paymentService.js` - Simplified checkout domain
3. `src/bot/api/controllers/paymentController.js` - Added webhook domain fallback
4. `.env` - Added EPAYCO_WEBHOOK_DOMAIN
5. `.env.example` - Added documentation
6. `env.template` - Added documentation

## Next Steps

1. ✅ Configuration fixes applied
2. 🔄 **Restart the application** (required for .env changes)
3. 🔍 Test payment flow and check browser console
4. 📋 Share the exact error message/screenshot if issue persists

To restart:
```bash
pm2 restart pnptvbot
```
