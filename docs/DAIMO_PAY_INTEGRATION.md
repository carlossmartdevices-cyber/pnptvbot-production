# Daimo Pay Integration Guide

## Overview

This project integrates Daimo Pay to accept payments via popular payment apps (Zelle, CashApp, Venmo, Revolut, Wise) and automatically convert them to USDC on the Optimism network.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# REQUIRED VARIABLES
DAIMO_TREASURY_ADDRESS=0xYourTreasuryWalletAddress   # Required: Optimism wallet where USDC is deposited
DAIMO_WEBHOOK_SECRET=your_webhook_secret_here        # Required: For webhook verification

# OPTIONAL VARIABLES
DAIMO_REFUND_ADDRESS=0xYourRefundWalletAddress      # Optional: Where failed payments are returned (defaults to treasury)
DAIMO_API_KEY=your_api_key_here                      # Optional: Only needed for direct API calls to Daimo API
DAIMO_APP_ID=your_app_id_here                        # Optional: Only needed for SDK integration (contact founders@daimo.com)

# ADVANCED CONFIGURATION (Optional - defaults to Optimism + USDC)
# DAIMO_CHAIN_ID=10                                  # Default: 10 (Optimism)
# DAIMO_TOKEN_ADDRESS=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85  # Default: USDC on Optimism
# DAIMO_TOKEN_SYMBOL=USDC                            # Default: USDC
# DAIMO_TOKEN_DECIMALS=6                             # Default: 6
```

### Variable Breakdown

#### **REQUIRED Variables**

1. **`DAIMO_TREASURY_ADDRESS`** (CRITICAL)
   - Your Optimism wallet address where all successful USDC payments will be deposited
   - Must be a valid Ethereum/Optimism address (0x...)
   - This is where you receive your revenue
   - Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

2. **`DAIMO_WEBHOOK_SECRET`** (CRITICAL)
   - Used to verify that webhook events are coming from Daimo (not a third party)
   - Provided by Daimo when you register your webhook
   - Used for HMAC-SHA256 signature verification
   - Keep this secret and never commit to git

#### **OPTIONAL Variables**

3. **`DAIMO_REFUND_ADDRESS`**
   - Where failed or bounced payments are returned
   - Defaults to `DAIMO_TREASURY_ADDRESS` if not set
   - Usually you can use the same address as treasury

4. **`DAIMO_API_KEY`**
   - Only needed if you're making direct API calls to Daimo's REST API
   - Currently not used (we generate payment links directly)
   - Contact `founders@daimo.com` to get an API key
   - Format: `pay-yourappname-xxxxxxxx`

5. **`DAIMO_APP_ID`**
   - Only needed if using Daimo Pay SDK integration
   - Used for SDK-based implementations (React/Next.js)
   - Contact `founders@daimo.com` to get an App ID
   - For prototyping, you can use `pay-demo`

#### **ADVANCED Configuration** (Rarely Needed)

These variables allow you to use a different blockchain network or token. By default, the system uses Optimism + USDC.

6. **`DAIMO_CHAIN_ID`**
   - Default: `10` (Optimism)
   - Change only if Daimo supports other networks in the future

7. **`DAIMO_TOKEN_ADDRESS`**
   - Default: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` (USDC on Optimism)
   - The token contract address to receive payments in

8. **`DAIMO_TOKEN_SYMBOL`**
   - Default: `USDC`
   - Display symbol for the token

9. **`DAIMO_TOKEN_DECIMALS`**
   - Default: `6` (USDC has 6 decimals)
   - Used for amount conversion (e.g., $10.00 = 10000000 units)

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

#### **Configuration**
- [ ] `DAIMO_TREASURY_ADDRESS` is set to your production Optimism wallet (REQUIRED ✓)
- [ ] `DAIMO_WEBHOOK_SECRET` is configured (REQUIRED ✓)
- [ ] `DAIMO_REFUND_ADDRESS` is set or will use treasury as fallback (OPTIONAL)
- [ ] `DAIMO_API_KEY` is set if using API calls (OPTIONAL)
- [ ] `DAIMO_APP_ID` is set if using SDK integration (OPTIONAL)
- [ ] `BOT_WEBHOOK_DOMAIN` is set correctly (used to build webhook URL)

#### **Daimo Registration**
- [ ] Contact `founders@daimo.com` to register your app
- [ ] Provide webhook URL: `https://easybots.store/api/webhooks/daimo`
- [ ] Receive and configure `DAIMO_WEBHOOK_SECRET` from Daimo
- [ ] (Optional) Request `DAIMO_API_KEY` if using API
- [ ] (Optional) Request `DAIMO_APP_ID` if using SDK

#### **Testing**
- [ ] Test a small payment (e.g., $1 USDC) to verify end-to-end flow
- [ ] Verify webhook receives `payment_completed` status correctly
- [ ] Confirm user subscription is activated after payment
- [ ] Check that welcome message is sent to user after successful payment
- [ ] Verify USDC arrives in your treasury address on Optimism
- [ ] Test with multiple payment apps (Zelle, CashApp, Venmo, etc.)

#### **Monitoring**
- [ ] Monitor logs for any errors or issues
- [ ] Set up alerts for failed webhooks
- [ ] Track payment success/failure rates
- [ ] Monitor treasury balance on Optimism blockchain

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
