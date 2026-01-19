# Visa Cybersource Integration Guide

## 🚀 Overview

This guide explains how to integrate Visa Cybersource for recurring payment processing in the PNPtv bot, specifically for **Monthly Crystal** and **Monthly Diamond** subscription plans.

## 📋 Features Implemented

### 1. **Recurring Payment Processing**
- Automatic monthly billing for supported plans
- Secure payment processing via Visa Cybersource API
- Webhook notifications for real-time updates

### 2. **Supported Plans**
- 💎 **Monthly Crystal Plan**
- 💎 **Monthly Diamond Plan**

### 3. **Key Components**

#### Configuration (`config/payment.config.js`)
```javascript
visaCybersource: {
  merchantId: process.env.VISA_CYBERSOURCE_MERCHANT_ID,
  apiKey: process.env.VISA_CYBERSOURCE_API_KEY,
  sharedSecret: process.env.VISA_CYBERSOURCE_SHARED_SECRET,
  endpoint: process.env.VISA_CYBERSOURCE_ENDPOINT,
  webhookSecret: process.env.VISA_CYBERSOURCE_WEBHOOK_SECRET,
  recurringPayment: true,
  supportedPlans: ['monthly_crystal', 'monthly_diamond'],
}
```

#### Service Layer (`src/bot/services/visaCybersourceService.js`)
- `createRecurringSubscription()` - Create new recurring subscriptions
- `processRecurringPayment()` - Process monthly payments
- `cancelRecurringSubscription()` - Cancel subscriptions
- `handleWebhook()` - Process webhook notifications

#### API Endpoints
- **POST** `/api/webhooks/visa-cybersource` - Webhook endpoint
- **GET** `/api/webhooks/visa-cybersource/health` - Health check

#### Payment Service Integration (`src/bot/services/paymentService.js`)
- `createVisaCybersourceSubscription()`
- `processVisaCybersourcePayment()`
- `cancelVisaCybersourceSubscription()`
- `handleVisaCybersourceWebhook()`
- `isVisaCybersourceSupported()`

## 🔧 Setup Instructions

### 1. Environment Variables

Add the following variables to your `.env` file:

```env
# Visa Cybersource Configuration
VISA_CYBERSOURCE_MERCHANT_ID=your_merchant_id
VISA_CYBERSOURCE_API_KEY=your_api_key
VISA_CYBERSOURCE_SHARED_SECRET=your_shared_secret
VISA_CYBERSOURCE_ENDPOINT=https://api.cybersource.com
VISA_CYBERSOURCE_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Database Schema

The integration uses existing database tables:
- `payments` - Stores payment records
- `subscribers` - Stores subscriber information
- `users` - Stores user subscription status

### 3. Webhook Configuration

Configure Visa Cybersource to send webhook notifications to:
```
https://your-domain.com/api/webhooks/visa-cybersource
```

### 4. Supported Events

The webhook handler processes these event types:
- `payment.success` - Payment completed successfully
- `payment.failed` - Payment failed
- `subscription.created` - New subscription created
- `subscription.cancelled` - Subscription cancelled
- `subscription.updated` - Subscription updated

## 📖 Usage Examples

### Creating a Recurring Subscription

```javascript
const result = await PaymentService.createVisaCybersourceSubscription({
  userId: '123456789',
  planId: 'monthly_crystal',
  paymentMethod: {
    token: 'visa_token',
    cardType: 'visa',
    last4: '4242',
  },
  email: 'customer@example.com'
});
```

### Processing a Recurring Payment

```javascript
const result = await PaymentService.processVisaCybersourcePayment({
  subscriptionId: 'sub_123456789',
  amount: 9.99
});
```

### Cancelling a Subscription

```javascript
const result = await PaymentService.cancelVisaCybersourceSubscription(
  'sub_123456789'
);
```

### Checking Plan Support

```javascript
const isSupported = PaymentService.isVisaCybersourceSupported('monthly_crystal');
// Returns: true
```

## 🔒 Security Considerations

### 1. Webhook Signature Verification
- All webhook requests are verified using HMAC-SHA256
- Invalid signatures are rejected with 400 status

### 2. API Authentication
- All API calls include merchant ID and API key
- HTTPS is required for all communications

### 3. Data Protection
- Payment method tokens are not stored in the database
- Sensitive data is handled according to PCI DSS standards

## 📊 Monitoring and Logging

### Log Events
- Subscription creation: `Visa Cybersource recurring subscription created`
- Payment processing: `Visa Cybersource recurring payment processed`
- Subscription cancellation: `Visa Cybersource recurring subscription cancelled`
- Webhook processing: `Visa Cybersource webhook processed successfully`

### Error Handling
- Comprehensive error logging for all operations
- Graceful degradation when API calls fail
- Automatic retry logic for transient failures

## 🚀 Deployment

### 1. Restart the Bot
```bash
pm2 restart pnptv-bot
```

### 2. Test the Integration
```bash
# Health check
curl https://your-domain.com/api/webhooks/visa-cybersource/health

# Should return:
# {
#   "success": true,
#   "message": "Visa Cybersource webhook is healthy",
#   "supportedPlans": ["monthly_crystal", "monthly_diamond"],
#   "recurringPayment": true
# }
```

### 3. Verify in Production
- Monitor logs for successful webhook processing
- Check that recurring payments are processed correctly
- Verify that subscription statuses are updated appropriately

## 📚 API Reference

### Visa Cybersource API Endpoints

#### Create Subscription
```
POST /createSubscription
{
  "merchantId": "your_merchant_id",
  "planId": "monthly_crystal",
  "userId": "123456789",
  "email": "customer@example.com",
  "amount": 9.99,
  "currency": "USD",
  "paymentMethod": { ... }
}
```

#### Process Payment
```
POST /processPayment
{
  "subscriptionId": "sub_123456789",
  "amount": 9.99,
  "currency": "USD"
}
```

#### Cancel Subscription
```
POST /cancelSubscription
{
  "subscriptionId": "sub_123456789"
}
```

## 🎓 Troubleshooting

### Common Issues

#### 1. Webhook Signature Mismatch
- **Cause**: Incorrect webhook secret in configuration
- **Solution**: Verify `VISA_CYBERSOURCE_WEBHOOK_SECRET` matches Visa Cybersource settings

#### 2. Plan Not Supported
- **Cause**: Trying to use Visa Cybersource with unsupported plan
- **Solution**: Use only `monthly_crystal` or `monthly_diamond` plans

#### 3. API Connection Failed
- **Cause**: Network issues or incorrect endpoint
- **Solution**: Check `VISA_CYBERSOURCE_ENDPOINT` and network connectivity

#### 4. Payment Processing Failed
- **Cause**: Invalid payment method or insufficient funds
- **Solution**: Verify payment method with customer and retry

## 📞 Support

For issues with Visa Cybersource integration:
1. Check logs for detailed error information
2. Verify configuration settings
3. Test with Visa Cybersource sandbox environment
4. Contact Visa Cybersource support if API issues persist

## 📝 Changelog

### Version 1.0.0 (Current)
- Initial implementation of Visa Cybersource integration
- Support for recurring payments on monthly plans
- Webhook notification handling
- Comprehensive error handling and logging

## 🔗 Related Documentation

- [Visa Cybersource API Documentation](https://developer.cybersource.com/)
- [ePayco Integration Guide](https://docs.epayco.com/)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)

---

**Last Updated**: 2026-01-19
**Status**: ✅ Production Ready