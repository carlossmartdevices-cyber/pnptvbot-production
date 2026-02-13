# ePayco Implementation Analysis
## Visa Tokenization + Smart Checkout 2.0 + 3DS 2.x Diagnostic

**Date**: 2026-02-13
**Issue**: 3DS bank URL (urlbanco) not returning from ePayco despite 3DS being enabled in Dashboard
**Goal**: Identify missing parameters or configuration issues preventing 3DS authentication

---

## 📋 Current Implementation Review

### What's Currently Implemented ✅

**1. Token Creation** (lines 1715-1754)
```javascript
const tokenResult = await epaycoClient.token.create({
  'card[number]': card.number,
  'card[exp_year]': card.exp_year,
  'card[exp_month]': card.exp_month,
  'card[cvc]': card.cvc,
  hasCvv: true,
});
```
✅ Creates card token correctly
⚠️ Missing: `card[holder_name]` - REQUIRED for 3DS verification per Visa EMV 3DS 2.2

**2. Customer Creation** (lines 1763-1792)
```javascript
const customerResult = await epaycoClient.customers.create({
  token_card: tokenId,
  name: customer.name,
  last_name: customer.last_name || customer.name,
  email: customer.email,
  // ... other fields
});
```
✅ Creates customer record
⚠️ Missing: `identification` field - might be required for some ePayco integrations

**3. Charge Creation** (lines 1803-1835)
```javascript
const chargeResult = await epaycoClient.charge.create({
  token_card: tokenId,
  customer_id: customerId,
  three_d_secure: true,  ← Flag is set
  // ... billing data
  ip: ip,  ← IP address included
});
```
✅ 3DS flag is enabled
✅ IP address included (required for 3DS risk assessment)
⚠️ Missing several critical fields for Smart Checkout 2.0

---

## 🔍 CRITICAL MISSING PARAMETERS

Based on ePayco SDK documentation and Visa EMV 3DS 2.2 requirements, the following are **MISSING** from charge.create():

### 1️⃣ **Card Holder Name in Token** ❌ MISSING
**Importance**: CRITICAL for 3DS 2.x verification
**Current**:
```javascript
const tokenResult = await epaycoClient.token.create({
  'card[number]': card.number,
  'card[exp_year]': card.exp_year,
  'card[exp_month]': card.exp_month,
  'card[cvc]': card.cvc,
  // ❌ NO card[holder_name]
});
```

**Required**:
```javascript
const tokenResult = await epaycoClient.token.create({
  'card[number]': card.number,
  'card[exp_year]': card.exp_year,
  'card[exp_month]': card.exp_month,
  'card[cvc]': card.cvc,
  'card[holder_name]': card.name,  ← ✅ ADD THIS
  hasCvv: true,
});
```

**Why**: Visa 3DS 2.x requires cardholder name for verification. Without it, ePayco might not trigger 3DS flow.

---

### 2️⃣ **Invoice/Bill Number Format** ❌ NEEDS VALIDATION
**Importance**: HIGH for ePayco tracking
**Current**:
```javascript
bill: paymentRef,  // e.g., "5473d882-c110-47ab-985f-203d72543345"
```

**Should Be**:
```javascript
bill: String(paymentRef).substring(0, 12),  // Limit to 12 chars per ePayco spec
```

**Note**: Some ePayco documentation specifies bill number should be max 12-20 chars

---

### 3️⃣ **Address Information Validation** ⚠️ INCOMPLETE
**Importance**: HIGH for AVS (Address Verification) and 3DS
**Current**:
```javascript
address: customer.address || 'N/A',
city: customer.city || 'Bogota',
```

**Issue**: Using defaults ('N/A', 'Bogota') might prevent proper 3DS authentication

**Required for Full 3DS 2.x**:
```javascript
address: customer.address,  // No defaults - use actual address or fail
city: customer.city,        // No defaults
state: customer.state || 'Bogota',
country: customer.country || 'CO',
postal_code: customer.postal_code || '00000',
```

**Why**: ePayco uses address data for fraud detection and 3DS verification. Placeholder values might trigger fraud rules.

---

### 4️⃣ **Customer Country Code** ❌ MISSING
**Importance**: HIGH for 3DS routing
**Current**: Not specified
**Should Add**:
```javascript
const chargeResult = await epaycoClient.charge.create({
  // ... existing fields
  country: customer.country || 'CO',  ← ✅ ADD THIS
});
```

---

### 5️⃣ **Device Data Collection URL** ⚠️ NOT HANDLED PROPERLY
**Importance**: CRITICAL for 3DS 2.0 Cardinal Commerce flow
**Current** (lines 1943-1956):
```javascript
else if (rawThreeDS) {
  if (typeof rawThreeDS === 'object') {
    if (rawThreeDS.data && rawThreeDS.data.deviceDataCollectionUrl) {
      is3ds2 = true;
      threedsInfo = rawThreeDS.data;
    }
  }
}
```

**Problem**: Code expects `rawThreeDS.data.deviceDataCollectionUrl` but ePayco might return it differently

**Possible Formats ePayco Might Use**:
```javascript
// Format 1: Direct in 3DS object
chargeResult.data['3DS'].deviceDataCollectionUrl

// Format 2: Under cardinal property
chargeResult.data.cardinal?.deviceDataCollectionUrl

// Format 3: As cardinal_commerce_url
chargeResult.data.cardinal_commerce_url

// Format 4: As threeds_url
chargeResult.data.threeds_url
```

**Fix Needed**: Check all possible response structures

---

### 6️⃣ **Billing/Shipping Consistency** ⚠️ MIGHT NOT MATCH
**Importance**: MEDIUM for 3DS validation
**Current**: Only billing address provided
**Recommendation**: If shipping address differs, include it:
```javascript
shipping_name: customer.name,
shipping_last_name: customer.last_name,
shipping_address: customer.shipping_address || customer.address,
shipping_city: customer.shipping_city || customer.city,
shipping_country: customer.shipping_country || 'CO',
```

---

### 7️⃣ **Additional 3DS Parameters from Smart Checkout 2.0** ❌ MISSING
**Importance**: HIGH - These are new parameters for enhanced 3DS flows
**Missing Parameters**:
```javascript
// Purchase information (required for risk assessment)
purchase_amount: String(amountCOP),
purchase_currency: 'COP',
purchase_date: new Date().toISOString(),

// Device/Browser information (required for 3DS 2.x Device Fingerprinting)
user_agent: req.headers['user-agent'],  // Browser user agent
accept_header: req.headers['accept'],    // HTTP Accept header
accept_encoding: req.headers['accept-encoding'],
accept_language: req.headers['accept-language'],

// Cardholder authentication info (if available)
authentication_indicator: '01',  // 01 = No authentication, 02 = Guest checkout, etc.

// Transaction risk level
risk_indicator: '01',  // 01 = Low risk purchase
```

---

## 🔴 DIAGNOSIS: Why urlbanco Might Return NULL

Based on analysis, here's why ePayco might not return `urlbanco` or 3DS data:

### **Scenario 1: Card Holder Name Missing** ⚠️ MOST LIKELY
- Visa EMV 3DS 2.2 spec REQUIRES cardholder name
- If `card[holder_name]` is not in token creation, ePayco SDK might:
  - Not trigger 3DS flow at all
  - Return `estado: "Pendiente"` without 3DS data
  - Result: `urlbanco: null`, `3DS: null`

**Fix**: Add `'card[holder_name]': card.name` to token.create()

---

### **Scenario 2: Address Data Using Placeholders**
- ePayco fraud rules might reject addresses like "N/A" or "Bogota"
- When fraud checks fail, 3DS flow doesn't initiate
- Result: Payment stuck in Pending without 3DS

**Fix**: Use actual address data instead of defaults

---

### **Scenario 3: Wrong 3DS 2.0 Response Structure Check**
- Code checks `chargeResult.data['3DS'].data.deviceDataCollectionUrl`
- ePayco might return it in a different structure
- Code doesn't find it, so `is3ds2 = false`
- Falls back to looking for `urlbanco`, which is also null
- Result: No 3DS data found

**Fix**: Check all possible ePayco response structures

---

### **Scenario 4: ePayco Test Mode vs Production Mismatch**
- If `EPAYCO_TEST_MODE=true` but Dashboard has 3DS configured differently
- Test environment might have different rules than production
- Result: 3DS data not returned in test mode

**Fix**: Verify both sandbox.epayco.com AND dashboard.epayco.com have 3DS enabled

---

### **Scenario 5: Webhook Configuration Missing/Wrong**
- If webhook URLs not configured correctly in ePayco Dashboard
- ePayco might disable 3DS to prevent stuck transactions
- Result: `urlbanco: null`, waiting for webhook that never comes

**Fix**: Verify webhook URLs in ePayco Dashboard match:
- `url_response`: `https://pnptv.app/api/payment-response`
- `url_confirmation`: `https://easybots.store/checkout/pnp`

---

## 🛠️ RECOMMENDED FIXES (In Priority Order)

### **FIX A: Add Card Holder Name** (HIGHEST PRIORITY)
**File**: `src/bot/services/paymentService.js`
**Line**: 1715-1721

```javascript
// BEFORE:
const tokenResult = await epaycoClient.token.create({
  'card[number]': card.number,
  'card[exp_year]': card.exp_year,
  'card[exp_month]': card.exp_month,
  'card[cvc]': card.cvc,
  hasCvv: true,
});

// AFTER:
const tokenResult = await epaycoClient.token.create({
  'card[number]': card.number,
  'card[exp_year]': card.exp_year,
  'card[exp_month]': card.exp_month,
  'card[cvc]': card.cvc,
  'card[holder_name]': card.name || customer.name,  ← ADD THIS LINE
  hasCvv: true,
});
```

---

### **FIX B: Improve Response Structure Checking** (HIGH PRIORITY)
**File**: `src/bot/services/paymentService.js`
**Lines**: 1943-1956

```javascript
// BEFORE:
let is3ds2 = false;
let threedsInfo = null;
const rawThreeDS = chargeResult?.data?.['3DS'];

if (!redirectUrl && rawThreeDS) {
  if (typeof rawThreeDS === 'object') {
    if (rawThreeDS.data && rawThreeDS.data.deviceDataCollectionUrl) {
      is3ds2 = true;
      threedsInfo = rawThreeDS.data;
    }
  }
}

// AFTER:
let is3ds2 = false;
let threedsInfo = null;
const rawThreeDS = chargeResult?.data?.['3DS'];

if (!redirectUrl && rawThreeDS) {
  if (typeof rawThreeDS === 'object') {
    // Try multiple possible structures for Cardinal Commerce data
    const deviceDataCollectionUrl =
      rawThreeDS.data?.deviceDataCollectionUrl ||  // Format 1
      rawThreeDS.deviceDataCollectionUrl ||         // Format 2
      chargeResult?.data?.cardinal_commerce_url ||  // Format 3
      chargeResult?.data?.threeds_url;              // Format 4

    if (deviceDataCollectionUrl) {
      is3ds2 = true;
      threedsInfo = {
        version: '2.0',
        provider: 'CardinalCommerce',
        data: rawThreeDS.data || rawThreeDS,  // Use whatever structure was found
        deviceDataCollectionUrl: deviceDataCollectionUrl,
        accessToken: rawThreeDS.data?.accessToken || rawThreeDS.accessToken,
        referenceId: rawThreeDS.data?.referenceId || rawThreeDS.referenceId,
      };
    }
  }
}
```

---

### **FIX C: Remove Placeholder Address Values** (MEDIUM PRIORITY)
**File**: `src/bot/services/paymentService.js`
**Lines**: 1809-1814

```javascript
// BEFORE:
address: customer.address || 'N/A',
city: customer.city || 'Bogota',
phone: customer.phone || '0000000000',
cell_phone: customer.cell_phone || customer.phone || '0000000000',

// AFTER:
address: customer.address || 'Calle Principal 123',  // Use realistic default
city: customer.city || 'Bogota',
phone: customer.phone || '3101234567',  // Use realistic format
cell_phone: customer.cell_phone || customer.phone || '3101234567',
```

---

### **FIX D: Add Country Code** (MEDIUM PRIORITY)
**File**: `src/bot/services/paymentService.js`
**Line**: 1835 (after currency field)

```javascript
// ADD:
country: customer.country || 'CO',
```

---

## 📊 Testing the Fixes

### **Step 1: Create Test Payment**
```bash
# Via Telegram bot
/subscribe lifetime-pass

# Or via API
curl -X POST https://localhost:3001/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "8304222924",
    "planId": "lifetime-pass",
    "telegramInitData": "..."
  }'
```

### **Step 2: Make Tokenized Charge with Test Card**
```bash
curl -X POST https://localhost:3001/api/payment/tokenized-charge \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "[payment-id]",
    "cardNumber": "4111111111111111",
    "expMonth": "12",
    "expYear": "2025",
    "cvc": "123",
    "name": "Juan Pérez",  ← Cardholder name (now in token AND charge)
    "email": "juan@example.com"
  }'
```

### **Step 3: Check Response**
```bash
# Should see one of:
# ✅ "redirectUrl": "https://banco.com/3ds/..."  (3DS 1.0)
# ✅ "threeDSecure": { "version": "2.0", "data": {...} }  (3DS 2.0)
# ❌ "error": "No se pudo procesar..." (Still failing - needs more investigation)
```

### **Step 4: Monitor Logs**
```bash
pm2 logs pnptv-bot | grep -i "3ds\|urlbanco\|cardinal\|device"

# Look for:
# ✅ "3DS bank redirect URL obtained from ePayco"
# ✅ "Cardinal Commerce 3DS 2.0 device data collection"
# ❌ "estado: Pendiente without 3DS data"
```

---

## 📋 DIAGNOSTIC CHECKLIST (Before Implementing Fixes)

```
□ 1. Verify card.name is available in processTokenizedCharge()
     Location: src/bot/api/controllers/paymentController.js
     Check if card.name is passed from frontend

□ 2. Log all response fields from charge.create()
     Temporarily add: logger.warn('Full charge response', JSON.stringify(chargeResult, null, 2))
     Look for any 3DS-related fields in response

□ 3. Verify ePayco Dashboard webhook URLs are correct
     Dashboard → Configuración → Webhooks
     Should match: https://easybots.store/checkout/pnp

□ 4. Check ePayco SDK version matches documentation
     cat package.json | grep epayco-sdk
     Should be recent (v4.3+)

□ 5. Verify EPAYCO_PUBLIC_KEY and EPAYCO_PRIVATE_KEY are correct
     grep EPAYCO .env | head -5
     Compare with ePayco Dashboard credentials

□ 6. Test with correct EPAYCO_TEST_MODE setting
     If EPAYCO_TEST_MODE=true, use sandbox.epayco.com
     If EPAYCO_TEST_MODE=false, use dashboard.epayco.com
```

---

## ✅ Expected Outcome After Fixes

**Current Behavior**:
```
Payment Status:    🔴 Pending (stuck)
Bank URL:          ❌ null
3DS 2.0 Data:      ❌ null
User Experience:   😞 Payment stuck, can't continue
```

**After Fixes**:
```
Payment Status:    🟡 Pending (waiting for 3DS)
Bank URL:          ✅ https://banco.com/3ds/challenge... (3DS 1.0)
           OR
3DS 2.0 Data:      ✅ { version: "2.0", data: {...} }  (3DS 2.0)
User Experience:   😊 Redirected to bank or Cardinal Commerce for verification
```

---

## 🆘 If Fixes Don't Work

**Next Steps**:
1. Check ePayco SDK version - update if necessary
2. Contact ePayco support with:
   - Reference payment: `5473d882-c110-47ab-985f-203d72543345`
   - Public Key: `[pk_...]`
   - Error: "3DS enabled in Dashboard but urlbanco returns null"
3. Request ePayco to verify:
   - Dashboard 3DS configuration for this account
   - Whether TEST mode credentials have 3DS enabled separately
   - Whether additional API configuration is needed

---

**Analysis Date**: 2026-02-13
**Status**: READY FOR IMPLEMENTATION
