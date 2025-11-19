# Daimo Pay Integration Guide

## Overview

This project integrates Daimo Pay to accept payments via popular payment apps (Zelle, CashApp, Venmo, Revolut, Wise) and automatically convert them to USDC on the Optimism network.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Daimo Pay Configuration
DAIMO_WEBHOOK_SECRET=your_webhook_secret_here
DAIMO_TREASURY_ADDRESS=0xYourTreasuryAddress  # Where USDC is deposited
DAIMO_REFUND_ADDRESS=0xYourRefundAddress      # Where failed payments are returned (optional, defaults to treasury)
```

### Important Notes

1. **Treasury Address**: This is your Optimism wallet address where all successful USDC payments will be deposited (REQUIRED)
2. **Refund Address**: If a payment fails or bounces, it will be returned to this address (OPTIONAL - defaults to treasury address)
3. **Webhook Secret**: Used to verify that webhook events are coming from Daimo (not a third party)

### Required vs Optional Variables

**REQUIRED:**
- `DAIMO_TREASURY_ADDRESS` - Must be a valid Optimism (Chain ID 10) wallet address
- `DAIMO_WEBHOOK_SECRET` - Provided by Daimo when you register your webhook

**OPTIONAL:**
- `DAIMO_REFUND_ADDRESS` - Defaults to `DAIMO_TREASURY_ADDRESS` if not set
- `DAIMO_API_KEY` - Only needed if using Daimo's API for payment creation (currently not used)

## Webhook Configuration

### Webhook URL

Your Daimo Pay webhook URL is:

```
https://easybots.store/api/daimo
```

This maps to the internal route: `/api/webhooks/daimo`

### How to Configure in Daimo

1. Contact Daimo support at `founders@daimo.com` to register your app
2. Provide your webhook URL: `https://easybots.store/api/daimo`
3. They will provide you with:
   - Webhook secret (add to `DAIMO_WEBHOOK_SECRET`)
   - Any additional configuration needed

## Supported Payment Methods

Users can pay using any of the following apps:

- ✅ **Zelle** - Popular in USA, built into most banking apps
- ✅ **CashApp** - Widely used P2P payment app
- ✅ **Venmo** - PayPal-owned P2P payment app
- ✅ **Revolut** - International digital banking
- ✅ **Wise** - International money transfers

## How It Works

### Payment Flow

1. **User selects a plan** in the Telegram bot
2. **User chooses "Pay with Daimo"**
3. Bot generates a Daimo Pay link with:
   - Amount in USD
   - Payment metadata (userId, planId, chatId)
   - Optimism USDC as destination token
4. **User clicks "Pay Now"** and is redirected to Daimo Pay
5. **User selects their payment app** (Zelle, CashApp, etc.)
6. **User completes payment** in their preferred app
7. **Daimo converts to USDC** and deposits to your treasury address
8. **Daimo sends webhook** to your server
9. **Your server validates** and processes the webhook
10. **Subscription is activated** and user is notified

### Webhook Events

Daimo Pay sends the following webhook events:

#### `payment_unpaid`
Payment link created but not yet paid.

#### `payment_started`
User initiated payment in their app.

#### `payment_completed` ✅
Payment successful! USDC deposited to treasury.

**Action**: Activate user subscription.

#### `payment_bounced` ❌
Payment failed or was returned.

**Action**: Log failure, notify user.

## Webhook Payload Structure

```json
{
  "id": "pay_123abc",
  "status": "payment_completed",
  "source": {
    "payerAddress": "0xabc123...",
    "txHash": "0xdef456...",
    "chainId": 10,
    "amountUnits": "10000000",
    "tokenSymbol": "USDC"
  },
  "destination": {
    "toAddress": "0xYourTreasuryAddress",
    "toChain": 10,
    "toToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
  },
  "metadata": {
    "userId": "12345",
    "chatId": "67890",
    "planId": "premium",
    "amount": "10.00",
    "timestamp": "2025-01-16T10:00:00.000Z"
  }
}
```

## Security

### Webhook Signature Verification

All webhooks are verified using HMAC-SHA256:

```javascript
const signature = req.headers['x-daimo-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha256', DAIMO_WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new InvalidSignatureError();
}
```

### Idempotency

Webhooks are processed idempotently using transaction hash as the unique key:

```javascript
const idempotencyKey = `webhook:daimo:${txHash}`;
const lockAcquired = await cache.acquireLock(idempotencyKey, 120);
```

This prevents:
- Duplicate subscription activations
- Race conditions
- Double-processing webhooks

## Testing

### Local Testing

1. **Use ngrok** to expose your local server:
   ```bash
   ngrok http 3000
   ```

2. **Update webhook URL** in Daimo dashboard:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/daimo
   ```

3. **Create a test payment** and verify:
   - Webhook is received
   - Signature is verified
   - Payment is processed
   - Subscription is activated

### Production Checklist

- [ ] `DAIMO_TREASURY_ADDRESS` is set to your production Optimism wallet (REQUIRED)
- [ ] `DAIMO_REFUND_ADDRESS` is set (OPTIONAL - or defaults to treasury)
- [ ] `DAIMO_WEBHOOK_SECRET` is configured (REQUIRED)
- [ ] `BOT_WEBHOOK_DOMAIN` is set correctly (used to build webhook URL)
- [ ] Webhook URL is registered with Daimo: `https://easybots.store/api/webhooks/daimo`
- [ ] Test a small payment (e.g., $1 USDC) to verify end-to-end flow
- [ ] Verify webhook receives `payment_completed` status correctly
- [ ] Confirm user subscription is activated after payment
- [ ] Monitor logs for any errors or issues
- [ ] Check that welcome message is sent to user after successful payment

## Network Information

- **Blockchain**: Optimism (Layer 2)
- **Chain ID**: 10
- **Token**: USDC
- **Token Address**: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85`
- **Decimals**: 6

## Troubleshooting

### Webhook not received

1. Check webhook URL is correct in Daimo dashboard
2. Verify server is accessible from internet
3. Check firewall/security group allows incoming HTTPS
4. Review server logs for incoming requests

### Invalid signature error

1. Verify `DAIMO_WEBHOOK_SECRET` is correct
2. Check webhook payload is not modified by middleware
3. Ensure body parsing happens before signature verification

### Payment not activating subscription

1. Check webhook was processed successfully (200 response)
2. Review logs for any errors during subscription activation
3. Verify user/plan IDs in metadata match database records
4. Check Firestore connection is working

### Amount mismatch

USDC uses 6 decimals, so amounts are stored as units:
- `10.00 USDC` = `10000000 units`
- To convert: `parseFloat(units) / 1e6`

## Support

For Daimo-specific issues:
- Email: founders@daimo.com
- Docs: https://docs.daimo.com

For integration issues:
- Check server logs: `/logs`
- Review Sentry errors (if configured)
- Contact development team

## Code References

- **Configuration**: `src/config/daimo.js`
- **Payment Service**: `src/bot/services/paymentService.js`
- **Webhook Controller**: `src/bot/api/controllers/webhookController.js`
- **Payment Handlers**: `src/bot/handlers/payments/index.js`
- **Routes**: `src/bot/api/routes.js` (line 112)

## API Reference

### `DaimoConfig.getDaimoConfig()`

Returns current Daimo configuration.

### `DaimoConfig.createPaymentIntent(params)`

Creates a payment intent object for Daimo Pay.

**Parameters:**
- `amount` (number) - Amount in USD
- `userId` (string) - Telegram user ID
- `planId` (string) - Subscription plan ID
- `chatId` (string) - Telegram chat ID
- `description` (string) - Payment description

### `DaimoConfig.generatePaymentLink(paymentIntent)`

Generates a Daimo Pay payment link.

### `DaimoConfig.validateWebhookPayload(payload)`

Validates webhook payload structure.

### `DaimoConfig.mapDaimoStatus(daimoStatus)`

Maps Daimo status to internal payment status.

### `DaimoConfig.formatAmountFromUnits(units)`

Converts USDC units to display amount.

---

**Last Updated**: 2025-01-16
**Version**: 1.0.0
