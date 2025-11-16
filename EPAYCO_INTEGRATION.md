# ePayco Payment Integration - PNPtv

This document describes the ePayco payment integration for PNPtv subscriptions, including embedded checkout with popup functionality.

## Features

- ✅ Embedded checkout with popup (no page redirect)
- ✅ Dual currency display (USD and COP)
- ✅ Automatic currency conversion using live exchange rates
- ✅ Telegram ID integration for subscribers
- ✅ Secure webhook handling with signature verification
- ✅ Firestore integration for subscriber management
- ✅ Beautiful responsive UI

## Architecture

### Components

1. **Backend API** (`src/bot/api/controllers/subscriptionController.js`)
   - Handles checkout session creation
   - Processes ePayco webhooks
   - Manages subscriber data

2. **Subscriber Model** (`src/models/subscriberModel.js`)
   - Manages subscriber data in Firestore
   - Includes telegramId for Telegram bot integration

3. **Currency Converter** (`src/utils/currencyConverter.js`)
   - Converts between USD and COP
   - Caches exchange rates for 1 hour
   - Provides fallback rates

4. **Frontend** (`public/checkout.html`)
   - Beautiful responsive checkout page
   - Loads plans dynamically
   - Opens ePayco popup for payment

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```env
# ePayco Configuration
EPAYCO_PUBLIC_KEY=your_public_key_here
EPAYCO_PRIVATE_KEY=your_private_key_here
EPAYCO_TEST_MODE=true  # Set to false in production

# Webhook Domain
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
```

### 2. Firebase Collections

The integration creates a new Firestore collection:

**Collection: `subscribers`**
```
{
  email: string (document ID)
  name: string
  telegramId: string (optional)
  plan: string (planId)
  subscriptionId: string (ePayco subscription ID)
  provider: string ('epayco')
  status: string ('active', 'inactive', 'cancelled')
  createdAt: timestamp
  updatedAt: timestamp
  lastPaymentAt: timestamp
}
```

### 3. Create Firestore Indexes

Run the following command to create necessary indexes:

```bash
npm run validate:indexes
```

## API Endpoints

### Get Subscription Plans
```
GET /api/subscription/plans
```

Response:
```json
{
  "success": true,
  "plans": [
    {
      "id": "basic",
      "name": "Basic Plan",
      "priceUSD": 9.99,
      "priceCOP": 40959,
      "exchangeRate": 4100,
      "features": ["Feature 1", "Feature 2"]
    }
  ]
}
```

### Create Checkout Session
```
POST /api/subscription/create-checkout
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "telegramId": "123456789",
  "planId": "premium"
}
```

Response:
```json
{
  "success": true,
  "checkout": {
    "planId": "premium",
    "planName": "Premium Plan",
    "amountUSD": 24.99,
    "amountCOP": 102459,
    "publicKey": "xxx",
    "confirmationUrl": "https://yourdomain.com/api/subscription/epayco/confirmation",
    "responseUrl": "https://yourdomain.com/api/subscription/payment-response"
  }
}
```

### Get Subscriber Info
```
GET /api/subscription/subscriber/{identifier}?type=email
GET /api/subscription/subscriber/{identifier}?type=telegram
```

Response:
```json
{
  "success": true,
  "subscriber": {
    "email": "user@example.com",
    "name": "John Doe",
    "telegramId": "123456789",
    "plan": "premium",
    "status": "active",
    "subscriptionId": "xxx",
    "createdAt": "2025-01-15T10:00:00Z",
    "lastPaymentAt": "2025-01-15T10:00:00Z"
  }
}
```

### Get Subscription Statistics
```
GET /api/subscription/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "active": 120,
    "inactive": 30,
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

## Frontend Usage

### Basic Implementation

1. **Direct Link:**
```html
<a href="/checkout.html">Subscribe Now</a>
```

2. **With Telegram ID:**
```html
<a href="/checkout.html?telegramId=123456789">Subscribe Now</a>
```

3. **Embedded in Telegram Bot:**
```javascript
// In your Telegram bot
bot.action('subscribe', async (ctx) => {
  const telegramId = ctx.from.id;
  const checkoutUrl = `${process.env.BOT_WEBHOOK_DOMAIN}/checkout.html?telegramId=${telegramId}`;

  await ctx.reply(
    'Choose your subscription plan:',
    Markup.inlineKeyboard([
      [Markup.button.url('💎 Subscribe', checkoutUrl)]
    ])
  );
});
```

### Custom Integration

You can integrate the checkout into your own page:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://checkout.epayco.co/checkout.js"></script>
</head>
<body>
  <button onclick="openCheckout()">Subscribe</button>

  <script>
    async function openCheckout() {
      // Get checkout session
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          name: 'John Doe',
          telegramId: '123456789',
          planId: 'premium'
        })
      });

      const data = await response.json();
      const checkout = data.checkout;

      // Configure ePayco
      const handler = ePayco.checkout.configure({
        key: checkout.publicKey,
        test: checkout.test
      });

      // Open popup
      handler.open({
        name: checkout.planName,
        description: checkout.description,
        invoice: `INV-${Date.now()}`,
        currency: 'cop',
        amount: checkout.amountCOP.toString(),
        tax_base: '0',
        tax: '0',
        country: 'co',
        lang: 'es',
        external: 'false', // Popup mode
        response: checkout.responseUrl,
        confirmation: checkout.confirmationUrl,
        name_billing: 'John Doe',
        email_billing: 'user@example.com',
        extra1: 'user@example.com',
        extra2: '123456789',
        extra3: 'premium'
      });
    }
  </script>
</body>
</html>
```

## Webhook Handling

The integration automatically handles ePayco webhooks at:
```
POST /api/subscription/epayco/confirmation
```

When a payment is successful:
1. Creates or updates subscriber in Firestore
2. Updates user subscription status (if telegramId provided)
3. Sends confirmation (can be extended to send emails/notifications)

### Webhook Security

The webhook handler verifies the ePayco signature using `EPAYCO_PRIVATE_KEY`. In production, ensure this is set correctly.

## Testing

### Test Mode

Set `EPAYCO_TEST_MODE=true` in your environment variables.

### Test Cards

Use these test card numbers provided by ePayco:
- **Visa:** 4575623182290326
- **MasterCard:** 5254133511172636
- **Amex:** 373118856457642

**CVV:** Any 3-digit number
**Expiration:** Any future date

### Testing Flow

1. Open `/checkout.html` in your browser
2. Select a plan
3. Fill in test information
4. Click "Proceed to Payment"
5. Use a test card number
6. Complete the payment
7. Check Firestore for the new subscriber record

## Currency Conversion

The integration uses the ExchangeRate-API for live USD to COP conversion.

### Fallback Rate

If the API is unavailable, it uses a default rate of 4,100 COP per USD (update this in `src/utils/currencyConverter.js` as needed).

### Caching

Exchange rates are cached for 1 hour to reduce API calls and improve performance.

## Security Considerations

1. **Environment Variables:** Never commit `.env` file or expose API keys
2. **Webhook Signatures:** Always verify ePayco signatures in production
3. **HTTPS:** Use HTTPS in production for all endpoints
4. **Rate Limiting:** Webhooks are rate-limited (50 requests per 5 minutes)
5. **Input Validation:** All user inputs are validated before processing

## Troubleshooting

### Checkout Popup Not Opening

- Check browser console for errors
- Verify `EPAYCO_PUBLIC_KEY` is correct
- Ensure ePayco script is loaded: `https://checkout.epayco.co/checkout.js`

### Webhook Not Received

- Verify `BOT_WEBHOOK_DOMAIN` is correct and accessible
- Check firewall/security group settings
- Test webhook URL manually
- Review server logs for errors

### Currency Conversion Failed

- Check internet connection
- Verify ExchangeRate-API is accessible
- Review fallback rate in `currencyConverter.js`

### Subscriber Not Created

- Check Firestore permissions
- Review server logs for errors
- Verify webhook signature validation
- Ensure required fields are provided

## Production Checklist

- [ ] Set `EPAYCO_TEST_MODE=false`
- [ ] Use production ePayco keys
- [ ] Set correct `BOT_WEBHOOK_DOMAIN`
- [ ] Enable HTTPS
- [ ] Configure Firestore security rules
- [ ] Set up monitoring/alerts
- [ ] Test webhook handling
- [ ] Update default exchange rate
- [ ] Configure email notifications (optional)
- [ ] Set up backup/recovery procedures

## Support

For ePayco-specific issues, refer to:
- [ePayco Documentation](https://docs.epayco.co/)
- [ePayco GitHub](https://github.com/epayco/epayco-node)

For integration issues, check the server logs:
```bash
npm run logs
```

## License

MIT
