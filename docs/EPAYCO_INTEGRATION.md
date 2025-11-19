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
2. **Payment creation** - Bot creates a payment record and generates ePayco checkout URL
3. **User redirected to ePayco** - User is redirected to ePayco's secure checkout page
4. **User completes payment** - User enters payment details on ePayco
5. **Webhook confirmation** - ePayco sends confirmation to our webhook endpoint
6. **Subscription activation** - Bot activates user's subscription
7. **User redirected back** - User is redirected to success/failure page

### Checkout URL Parameters

The checkout URL includes the following parameters:

```javascript
{
  key: epaycoPublicKey,              // Public API key
  external: 'true',                  // External checkout mode
  name: description,                 // Payment description
  description: description,          // Detailed description
  invoice: paymentRef,               // Unique payment reference
  currency: 'cop',                   // Currency (Colombian Pesos)
  amount: priceInCOP,                // Amount in COP
  tax_base: '0',                     // Tax base
  tax: '0',                          // Tax amount
  country: 'co',                     // Country code
  lang: 'es',                        // Language
  extra1: userId,                    // User ID (Telegram ID)
  extra2: planId,                    // Plan ID
  extra3: paymentId,                 // Payment ID
  confirmation: webhookUrl,          // Webhook URL for confirmation
  response: responseUrl,             // URL to redirect user after payment
  test: 'false',                     // Test mode flag
  autoclick: 'false'                 // Auto-submit form
}
```

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

### 1. Payment Service (`src/bot/services/paymentService.js`)

**Added functions**:
- `processEpaycoWebhook(webhookData)`: Processes ePayco webhook confirmations
- `processDaimoWebhook(webhookData)`: Processes Daimo webhook confirmations

**Updated functions**:
- `createPayment()`: Updated to pass correct data in extra fields and webhook URLs

### 2. Webhook Controller (`src/bot/api/controllers/webhookController.js`)

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

- [ ] Create payment and verify checkout URL is generated
- [ ] Complete payment with approved test card
- [ ] Verify webhook is received and processed
- [ ] Verify subscription is activated
- [ ] Test payment rejection scenario
- [ ] Test payment pending scenario
- [ ] Verify signature validation works
- [ ] Test response page redirection

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
  paymentUrl: 'https://checkout.epayco.co/checkout.html?...',
  paymentId: 'uuid',
  paymentRef: 'PAY-XXXXXXXX'
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

### 2025-11-19
- Fixed "Access Denied" error by implementing webhook processing functions
- Updated checkout URL parameters to pass data in extra fields
- Corrected webhook URL paths
- Added signature verification
- Updated validation to match ePayco documentation
- Added comprehensive error handling
