# ePayco Integration Guide

## Overview

This document describes the ePayco payment integration for PNPtv Bot. ePayco is a Colombian payment gateway that supports credit cards, debit cards, cash payments, and bank transfers in Colombian Pesos (COP).

## Configuration

### Environment Variables

Required environment variables in `.env`:

```bash
# ePayco Configuration
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key
EPAYCO_P_CUST_ID=your_epayco_customer_id
EPAYCO_TEST_MODE=false  # Set to true for testing

# Webhook Domain
BOT_WEBHOOK_DOMAIN=https://easybots.store
```

### Getting ePayco Credentials

1. Create an account at [ePayco](https://dashboard.epayco.com/)
2. Navigate to Settings > API Keys
3. Copy your Public Key and Private Key
4. Copy your Customer ID (P_CUST_ID_CLIENTE)

## Implementation

### Payment Flow

1. **User selects a plan** - User chooses a subscription plan in the bot
2. **Payment creation** - Bot creates a payment record and generates landing page URL
3. **User opens landing page** - User is redirected to PNPtv's payment checkout page at `https://easybots.store/payment/{paymentId}`
4. **User reviews and enters data** - User sees plan summary and enters name, email, document
5. **User clicks "Pay"** - Landing page initiates ePayco checkout using JavaScript SDK
6. **User completes payment** - User enters payment details on ePayco's secure popup
7. **Webhook confirmation** - ePayco sends confirmation to our webhook endpoint
8. **Subscription activation** - Bot activates user's subscription
9. **User redirected back** - User is redirected to success/failure page

**Landing Page Benefits**:
- Professional branded experience with PNPtv design
- Clear plan summary with features and pricing
- Customer data collection (name, email, document)
- Better error handling and validation
- Uses ePayco JavaScript SDK for more robust integration
- Mobile responsive design
- Security indicators

### Landing Page

**File**: `public/payment-checkout.html`

**URL**: `https://easybots.store/payment/{paymentId}`

The landing page:
1. Loads payment info from API: `GET /api/payment/{paymentId}`
2. Displays plan summary with icon, name, price, and features
3. Shows form for customer information (name, email, document type/number)
4. Initializes ePayco SDK with public key
5. On submit, opens ePayco checkout popup with customer data
6. Handles success/error responses

### API Endpoints

**Get Payment Info**:
- **URL**: `GET /api/payment/:paymentId`
- **Controller**: `PaymentController.getPaymentInfo()`
- **Response**:
```json
{
  "success": true,
  "payment": {
    "paymentId": "uuid",
    "paymentRef": "PAY-XXXXXXXX",
    "userId": "telegramId",
    "planId": "planId",
    "status": "pending",
    "amountUSD": 10.00,
    "amountCOP": 40000,
    "plan": {
      "id": "planId",
      "name": "Premium",
      "description": "Suscripción Premium - PNPtv",
      "icon": "💎",
      "duration": 30,
      "features": ["Feature 1", "Feature 2"]
    },
    "epaycoPublicKey": "public_key",
    "testMode": false,
    "confirmationUrl": "https://easybots.store/api/webhooks/epayco",
    "responseUrl": "https://easybots.store/api/payment-response"
  }
}
```

### ePayco SDK Integration

The landing page uses ePayco's JavaScript SDK for a more robust integration:

**SDK Initialization**:
```javascript
const ePaycoHandler = ePayco.checkout.configure({
  key: epaycoPublicKey,
  test: testMode
});
```

**Opening Checkout Popup**:
```javascript
ePaycoHandler.open({
  // Plan info
  name: "Suscripción Premium - PNPtv",
  description: "Suscripción Premium - PNPtv",
  invoice: "PAY-XXXXXXXX",
  currency: "cop",
  amount: "40000",
  tax_base: "0",
  tax: "0",
  country: "co",
  lang: "es",

  // Customer info (from form)
  name_billing: "Juan Pérez",
  email_billing: "juan@ejemplo.com",
  type_doc_billing: "CC",
  number_doc_billing: "123456789",

  // Extra data for webhook
  extra1: userId,        // Telegram ID
  extra2: planId,        // Plan ID
  extra3: paymentId,     // Payment ID

  // URLs
  confirmation: webhookUrl,
  response: responseUrl
});
```

**Advantages over URL parameters**:
- More reliable integration
- Better error handling
- Works on all browsers/devices
- Popup modal instead of full redirect
- Better UX with branded landing page first

### Webhook Endpoint

**URL**: `https://easybots.store/api/webhooks/epayco`

**Method**: POST

**Payload Structure**:

```javascript
{
  x_ref_payco: string,              // ePayco transaction reference
  x_transaction_id: string,         // Transaction ID
  x_transaction_state: string,      // State: 'Aceptada', 'Rechazada', 'Pendiente'
  x_amount: string,                 // Transaction amount
  x_currency_code: string,          // Currency code
  x_signature: string,              // Security signature
  x_approval_code: string,          // Approval code (if approved)
  x_customer_email: string,         // Customer email
  x_customer_name: string,          // Customer name
  x_extra1: string,                 // User ID (Telegram ID)
  x_extra2: string,                 // Plan ID
  x_extra3: string                  // Payment ID
}
```

### Signature Verification

For security, ePayco includes a signature that must be verified:

```javascript
// Signature format: p_cust_id_cliente^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code
const signatureString = `${p_cust_id_cliente}^${p_key}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
const expectedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

if (x_signature !== expectedSignature) {
  // Invalid signature - reject webhook
}
```

## Transaction States

ePayco sends one of the following transaction states:

- **Aceptada** / **Aprobada**: Payment successful - activate subscription
- **Rechazada**: Payment rejected - mark payment as failed
- **Fallida**: Payment failed - mark payment as failed
- **Pendiente**: Payment pending - keep payment in pending state

## Files Modified

### 1. Landing Page (`public/payment-checkout.html`)

**New file** - Professional checkout page with:
- Responsive design with gradient header
- Plan summary display (icon, name, price, features)
- Customer information form (name, email, document)
- ePayco SDK integration
- Loading states and error handling
- Security indicators

### 2. Payment Controller (`src/bot/api/controllers/paymentController.js`)

**New file** - API controller for payment operations:
- `getPaymentInfo(paymentId)`: Retrieves payment and plan details for checkout page
- Validates payment status (must be pending)
- Returns formatted data for frontend

### 3. Payment Service (`src/bot/services/paymentService.js`)

**Added functions**:
- `processEpaycoWebhook(webhookData)`: Processes ePayco webhook confirmations
- `processDaimoWebhook(webhookData)`: Processes Daimo webhook confirmations

**Updated functions**:
- `createPayment()`: Returns URL to landing page instead of direct ePayco URL

### 4. Routes (`src/bot/api/routes.js`)

**Added routes**:
- `GET /payment/:paymentId`: Serves payment checkout landing page
- `GET /api/payment/:paymentId`: API endpoint for payment information

### 5. Webhook Controller (`src/bot/api/controllers/webhookController.js`)

**Updated**:
- `validateEpaycoPayload()`: Updated validation to require only minimum fields

## Testing

### Test Mode

To test the integration:

1. Set `EPAYCO_TEST_MODE=true` in `.env`
2. Use test credentials from ePayco dashboard
3. Use test cards:
   - **Approved**: 4575623182290326
   - **Rejected**: 4151611527583283
   - **Pending**: 4575620007326852

### Testing Checklist

- [ ] Create payment and verify landing page URL is generated
- [ ] Open landing page and verify plan details are displayed correctly
- [ ] Verify payment API returns correct data (`GET /api/payment/:paymentId`)
- [ ] Fill form and click "Pay" button
- [ ] Verify ePayco checkout popup opens
- [ ] Complete payment with approved test card (4575623182290326)
- [ ] Verify webhook is received and processed
- [ ] Verify subscription is activated in database
- [ ] Check user receives confirmation in bot
- [ ] Test payment rejection scenario with test card (4151611527583283)
- [ ] Test payment pending scenario
- [ ] Verify signature validation works
- [ ] Test response page redirection
- [ ] Test mobile responsive design
- [ ] Test error handling (invalid payment ID, expired payment, etc.)

## Error Handling

### Common Errors

1. **Access Denied**:
   - Cause: Incorrect webhook URL or missing configuration
   - Solution: Verify `BOT_WEBHOOK_DOMAIN` is set correctly

2. **Invalid Signature**:
   - Cause: Incorrect private key or signature calculation
   - Solution: Verify `EPAYCO_PRIVATE_KEY` and `EPAYCO_P_CUST_ID`

3. **Missing Required Fields**:
   - Cause: Webhook payload missing required fields
   - Solution: Check ePayco dashboard configuration

## Security Considerations

1. **Always verify signatures**: Never process webhooks without signature verification
2. **Use HTTPS**: Webhook URLs must use HTTPS
3. **Validate amounts**: Always verify payment amounts match expected values
4. **Check payment status**: Verify payment hasn't already been processed (idempotency)
5. **Never log sensitive data**: Don't log API keys, signatures, or card numbers

## Production Deployment

Before going to production:

1. Switch to production credentials in ePayco dashboard
2. Set `EPAYCO_TEST_MODE=false`
3. Test with real payment (small amount)
4. Monitor webhook logs for first few transactions
5. Set up webhook monitoring/alerting

## Support

For ePayco support:
- Documentation: https://docs.epayco.com/
- Support: soporte@epayco.com
- Dashboard: https://dashboard.epayco.com/

## Troubleshooting

### Webhook not being received

1. Check webhook URL is accessible from internet
2. Verify webhook URL in payment creation matches configured endpoint
3. Check server logs for incoming requests
4. Test webhook URL with curl:

```bash
curl -X POST https://easybots.store/api/webhooks/epayco \
  -H "Content-Type: application/json" \
  -d '{
    "x_ref_payco": "test123",
    "x_transaction_state": "Aceptada",
    "x_transaction_id": "123",
    "x_amount": "10000",
    "x_currency_code": "COP"
  }'
```

### Payment stuck in pending

1. Check ePayco dashboard for transaction status
2. Verify webhook was sent by ePayco
3. Check server logs for webhook processing errors
4. Manually trigger subscription activation if needed

## API Reference

### Create Payment

```javascript
const result = await PaymentService.createPayment({
  userId: telegramUserId,
  planId: subscriptionPlanId,
  provider: 'epayco'
});

// Returns:
{
  success: true,
  paymentUrl: 'https://easybots.store/payment/uuid',
  paymentId: 'uuid',
  paymentRef: 'PAY-XXXXXXXX'
}
```

### Get Payment Info

```javascript
const response = await fetch('/api/payment/uuid');
const data = await response.json();

// Returns:
{
  success: true,
  payment: {
    paymentId: 'uuid',
    paymentRef: 'PAY-XXXXXXXX',
    userId: '123456789',
    planId: 'plan-id',
    status: 'pending',
    amountUSD: 10.00,
    amountCOP: 40000,
    plan: { /* plan details */ },
    epaycoPublicKey: 'public_key',
    testMode: false,
    confirmationUrl: 'https://easybots.store/api/webhooks/epayco',
    responseUrl: 'https://easybots.store/api/payment-response'
  }
}
```

### Process Webhook

```javascript
const result = await PaymentService.processEpaycoWebhook(webhookData);

// Returns:
{
  success: true
}
// or
{
  success: false,
  error: 'Error message'
}
```

## Changelog

### 2025-11-19 (v2)
- **Added professional landing page** (`public/payment-checkout.html`)
  - Responsive design with PNPtv branding
  - Plan summary display
  - Customer information form
  - ePayco SDK integration
  - Better UX and error handling
- **Added Payment Controller** for API endpoints
- **Updated payment flow** to use landing page instead of direct ePayco redirect
- **Added API endpoint** `GET /api/payment/:paymentId` for payment info
- Improved integration reliability with SDK approach

### 2025-11-19 (v1)
- Fixed "Access Denied" error by implementing webhook processing functions
- Updated checkout URL parameters to pass data in extra fields
- Corrected webhook URL paths
- Added signature verification
- Updated validation to match ePayco documentation
- Added comprehensive error handling
