# Daimo Payment Apps Troubleshooting Guide

## Issue: Daimo Not Showing CashApp, Venmo, Wise, or Zelle

If the Daimo payment interface is not showing all expected payment apps (CashApp, Venmo, Wise, Zelle), follow this troubleshooting guide.

## Expected Behavior

The Daimo payment system should show these payment options:
- ✅ **Venmo** - Most popular in US
- ✅ **CashApp** - Popular digital wallet
- ✅ **Zelle** - Bank-to-bank transfers
- ✅ **Revolut** - International users
- ✅ **Wise** - International transfers

## Root Cause Analysis

### 1. **Configuration Check** ✅

The system is correctly configured in `src/bot/services/daimoService.js`:

```javascript
// Supported payment apps (prioritized in UI)
this.supportedPaymentApps = ['Venmo', 'CashApp', 'Zelle', 'Revolut', 'Wise'];
```

And the payment intent includes them:

```javascript
paymentOptions: this.supportedPaymentApps,
```

### 2. **Common Issues** ⚠️

#### **Issue A: Daimo API Not Configured**

**Symptoms**:
- Daimo payments fall back to checkout page
- Error logs show: `"DAIMO_TREASURY_ADDRESS not configured"`
- Payment link generation fails

**Solution**:
```bash
# Set these environment variables:
export DAIMO_TREASURY_ADDRESS="0xYourTreasuryAddress"
export DAIMO_REFUND_ADDRESS="0xYourRefundAddress"
export DAIMO_API_KEY="your_daimo_api_key"
```

#### **Issue B: Invalid Ethereum Addresses**

**Symptoms**:
- Error: `"Address is invalid"`
- Error: `"Address must be a hex value of 20 bytes (40 hex characters)"`
- Payment link generation fails

**Solution**:
- Use valid Ethereum addresses (42 characters starting with 0x)
- Example: `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`
- Test addresses with: `web3.utils.isAddress(address)`

#### **Issue C: Daimo API Connection Issues**

**Symptoms**:
- Payment link generation fails silently
- No error in logs, but fallback checkout page is used
- Network timeout errors

**Solution**:
```javascript
// Test Daimo API connectivity
const axios = require('axios');
try {
  const response = await axios.get('https://api.daimo.com/health');
  console.log('Daimo API status:', response.data);
} catch (error) {
  console.error('Daimo API connection failed:', error.message);
}
```

#### **Issue D: Payment Intent Format Issues**

**Symptoms**:
- Payment link is generated but apps don't show
- Daimo interface shows loading spinner indefinitely
- No payment options appear

**Solution**:
The payment intent format should be:
```javascript
{
  toAddress: "0x...",           // Valid Ethereum address
  toChain: 10,                   // Optimism chain ID
  toToken: "0x...",            // USDC token address
  toUnits: "10000000",          // USDC units (6 decimals)
  intent: "Payment description",
  refundAddress: "0x...",       // Valid Ethereum address
  metadata: {},                  // Custom metadata
  paymentOptions: ["Venmo", "CashApp", "Zelle", "Revolut", "Wise"]
}
```

### 3. **Daimo Interface Issues** 🌐

#### **Issue E: Browser Compatibility**

**Symptoms**:
- Payment page loads but shows blank
- "Unsupported browser" message
- Payment apps don't render

**Solution**:
- Use Chrome, Firefox, or Safari (latest versions)
- Enable JavaScript
- Clear browser cache
- Try incognito/private browsing mode

#### **Issue F: Mobile Device Issues**

**Symptoms**:
- Payment apps don't show on mobile
- Interface is broken on small screens
- Touch targets don't work

**Solution**:
- Use desktop browser for best experience
- Try landscape mode on mobile
- Update to latest mobile browser version

#### **Issue G: Ad Blockers / Extensions**

**Symptoms**:
- Payment interface doesn't load
- Blank screen where apps should be
- JavaScript errors in console

**Solution**:
- Disable ad blockers (uBlock, AdBlock Plus)
- Disable privacy extensions temporarily
- Whitelist pay.daimo.com domain

### 4. **Geographic Restrictions** 🌍

#### **Issue H: Unsupported Country**

**Symptoms**:
- "Service not available in your country"
- No payment apps appear
- Geographic restriction message

**Solution**:
- Daimo currently supports: US, UK, EU, Canada
- Use VPN to supported country (if allowed by terms)
- Contact support for country-specific help

#### **Issue I: App-Specific Restrictions**

**Symptoms**:
- Only some apps appear (e.g., only Venmo)
- "App not available" messages
- Regional app restrictions

**Solution**:
- **Venmo**: US only
- **CashApp**: US only
- **Zelle**: US only
- **Wise**: International
- **Revolut**: UK/EU

### 5. **Account-Specific Issues** 👤

#### **Issue J: Daimo Account Not Linked**

**Symptoms**:
- Payment apps show but can't complete payment
- "Link account" or "Connect" buttons appear
- Payment fails at final step

**Solution**:
1. Open the payment app (Venmo/CashApp/etc.)
2. Complete any required verification
3. Ensure app has sufficient funds
4. Try linking account again

#### **Issue K: Insufficient Funds**

**Symptoms**:
- Payment app shows but transaction fails
- "Insufficient balance" error
- Payment rejected by app

**Solution**:
- Add funds to your payment app
- Try different payment app
- Use different payment method

#### **Issue L: App Verification Required**

**Symptoms**:
- "Account verification needed"
- "Complete KYC" message
- Payment app requires additional info

**Solution**:
- Complete app verification process
- Provide required identification
- Wait for verification approval

## Troubleshooting Steps

### Step 1: Check Configuration
```bash
# Verify environment variables
echo "DAIMO_TREASURY_ADDRESS: $DAIMO_TREASURY_ADDRESS"
echo "DAIMO_REFUND_ADDRESS: $DAIMO_REFUND_ADDRESS"
echo "DAIMO_API_KEY: ${DAIMO_API_KEY:0:5}..."
```

### Step 2: Test Payment Link Generation
```javascript
// Test payment link generation
const DaimoService = require('./src/bot/services/daimoService');
try {
  const paymentLink = DaimoService.generatePaymentLink({
    userId: 'test_user',
    chatId: 'test_chat',
    planId: 'test_plan',
    amount: 10.00,
    paymentId: 'test_payment'
  });
  console.log('Payment link:', paymentLink);
} catch (error) {
  console.error('Payment link generation failed:', error);
}
```

### Step 3: Check Browser Console
1. Open browser developer tools (F12)
2. Go to "Console" tab
3. Look for JavaScript errors
4. Check "Network" tab for failed API calls

### Step 4: Test with Different Browsers
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Step 5: Check Daimo Status
- Visit: https://status.daimo.com
- Check: @DaimoPay on Twitter
- Contact: support@daimo.com

## Solutions

### ✅ Quick Fixes

1. **Use Fallback Checkout Page**
   - If Daimo apps don't show, use the fallback checkout
   - System automatically falls back when Daimo API fails

2. **Try Different Payment Method**
   - Use ePayco or PayPal if Daimo apps unavailable
   - All payment methods provide same access

3. **Clear Cache and Cookies**
   - Browser cache can cause rendering issues
   - Clear cache and reload payment page

### 🔧 Technical Solutions

1. **Update Daimo Configuration**
```javascript
// Ensure correct configuration
this.supportedPaymentApps = ['Venmo', 'CashApp', 'Zelle', 'Revolut', 'Wise'];
```

2. **Add Error Handling**
```javascript
// Enhance error handling in generatePaymentLink
try {
  // Existing code
} catch (error) {
  logger.error('Daimo payment error:', {
    error: error.message,
    userId,
    amount,
    paymentOptions: this.supportedPaymentApps
  });
  // Fallback to checkout page
  return `${process.env.BOT_WEBHOOK_DOMAIN}/daimo-checkout/${paymentId}`;
}
```

3. **Add User Notification**
```javascript
// Notify user when falling back
await bot.telegram.sendMessage(userId, `
⚠️ *Daimo Payment Apps Temporarily Unavailable*

Estamos experimentando problemas técnicos con Daimo Pay.

🔄 *Qué hacer*:
1. Usa el enlace de pago alternativo
2. Prueba con otro método (ePayco/PayPal)
3. Intenta más tarde

💡 *Los apps disponibles*:
• Venmo (US)
• CashApp (US)
• Zelle (US)
• Wise (Internacional)
• Revolut (UK/EU)

🔗 *Enlace alternativo*: [link]
`);
```

### 📋 Prevention

1. **Monitor Daimo API Status**
   - Set up alerts for Daimo API outages
   - Monitor error rates in logs

2. **Implement Circuit Breaker**
   - Automatically switch to fallback when errors exceed threshold
   - Prevent user frustration

3. **Add Health Checks**
   - Regularly test Daimo API connectivity
   - Proactively notify when issues detected

## Support Resources

### User Support Message
```
Hola [Usuario],

Lamentamos los inconvenientes con los métodos de pago de Daimo.

🔍 *Problema identificado*:
- Los apps de pago (Venmo/CashApp/Zelle/Wise/Revolut) no se muestran
- Esto puede deberse a problemas técnicos temporales

💡 *Soluciones*:
1. **Usa el enlace de pago alternativo** que te proporcionamos
2. **Prueba con otro método** de pago (ePayco o PayPal)
3. **Espera 1-2 horas** y vuelve a intentar

📞 *Soporte*:
Si el problema persiste, contáctanos:
- Telegram: @PNPTV_Support
- Email: support@pnptv.app

🙏 *Disculpa las molestias* y gracias por tu paciencia.
```

### Admin Support Guide

1. **Check System Logs**
```bash
# Search for Daimo errors
grep -i "daimo" /var/log/pnptvbot/pnptvbot.log

# Check recent payment attempts
grep -i "payment.*daimo" /var/log/pnptvbot/pnptvbot.log
```

2. **Test Daimo API**
```bash
# Test API connectivity
curl -v https://api.daimo.com/health

# Test with specific payment intent
curl -X POST https://api.daimo.com/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DAIMO_API_KEY" \
  -d '{"intent": "test", "amount": "1000000"}'
```

3. **Verify Configuration**
```bash
# Check environment variables
env | grep DAIMO

# Test address validation
node -e "console.log(require('web3-utils').isAddress(process.env.DAIMO_TREASURY_ADDRESS))"
```

## Summary

**If Daimo payment apps are not showing**, follow these steps:

1. ✅ **Check configuration** - Ensure DAIMO_* environment variables are set
2. ✅ **Test payment link** - Verify link generation works
3. ✅ **Try different browser** - Chrome/Firefox recommended
4. ✅ **Use fallback checkout** - System provides alternative payment page
5. ✅ **Try later** - May be temporary API issue
6. ✅ **Use alternative method** - ePayco or PayPal work reliably

**Most common cause**: Daimo API configuration issues or temporary service outages. The system has fallback mechanisms to ensure users can still complete payments.

**No immediate action required** - The system safely falls back to checkout pages when Daimo apps are unavailable, ensuring users can still complete their subscriptions.

**For permanent fix**: Ensure proper Daimo API configuration and monitor service status.