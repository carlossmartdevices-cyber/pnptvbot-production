# Real Payment Test - ePayco 3DS Integration
**Date**: 2026-02-13
**Objective**: Test actual payment flow with real ePayco API
**Status**: READY FOR EXECUTION

---

## 🎯 Real Payment Test Plan

This guide walks through testing a REAL payment using the Telegram bot to verify all 4 ePayco 3DS fixes are working.

---

## 📋 Step-by-Step Instructions

### **STEP 1: Start Real-Time Log Monitoring**

Open a terminal and run this to watch all payment events:

```bash
# Terminal 1: Watch for 3DS events
pm2 logs pnptv-bot | grep -i "3ds\|token\|charge\|urlbanco\|cardinal" --color=always
```

Open another terminal for error monitoring:

```bash
# Terminal 2: Watch for errors
pm2 logs pnptv-bot | grep -i "error\|fail" --color=always
```

---

### **STEP 2: Trigger Real Payment via Telegram**

1. **Open Telegram**
   - Find the PNPtv Telegram bot
   - Or search: `@pnptvbot` (if public)

2. **Send Command**
   ```
   /subscribe
   ```

3. **Select Plan**
   - Choose: `lifetime-pass` or any plan
   - Amount should be visible (e.g., $249.99)

4. **Get Payment Link**
   - Bot responds with checkout link
   - Click the link

---

### **STEP 3: Test 3DS 1.0 (Bank Redirect)**

**Payment Form**:
```
Card Number:  4111111111111111
Expiry:       12/2025
CVC:          123
Name:         Juan Pérez
Email:        juan@example.com
Address:      Bogota
City:         Bogota
Country:      CO
```

**Click**: PAY

---

### **STEP 4: Monitor Logs in Real-Time**

**Expected Log Sequence** (appears in Terminal 1):

```
1. "ePayco token response received"
   ✅ Should show: tokenId created

2. "ePayco token created"
   ✅ Should show: tokenId value

3. "ePayco customer created"
   ✅ Should show: customerId

4. "Creating ePayco tokenized charge"
   ✅ Should include:
      - 'card[holder_name]': 'Juan Pérez'  ← FIX A
      - 'country': 'CO'                     ← FIX D
      - address: 'Calle Principal 123'     ← FIX C (or actual)
      - three_d_secure: true

5. "ePayco charge result"
   ✅ Should show: estado: "Pendiente"

6. "3DS bank redirect URL obtained from ePayco"  ← THIS IS THE KEY LINE
   ✅ Should show: redirectUrl with actual bank URL
      OR
   "Cardinal Commerce 3DS 2.0 device data collection"
   ✅ Should show: deviceDataCollectionUrl
```

---

### **STEP 5: Verify 3DS Response**

**If you see**:
```
✅ "3DS bank redirect URL obtained from ePayco"
   redirectUrl: "https://banco.com/3ds/challenge?token=xyz..."
```

**Status**: ✅ **3DS 1.0 WORKING!**
- User would be redirected to bank
- Bank would verify identity (OTP, PIN, etc)
- Payment completes after bank approval

---

**If you see**:
```
✅ "Cardinal Commerce 3DS 2.0 device data collection"
   deviceDataCollectionUrl: "https://centinelapistag.cardinalcommerce.com/..."
```

**Status**: ✅ **3DS 2.0 WORKING!**
- User would see Cardinal Commerce challenge
- Device fingerprinting occurs
- Payment completes after verification

---

### **STEP 6: Check Database Audit Logs**

```sql
-- Verify the payment was recorded with user_id
SELECT
  id,
  user_id,
  status,
  metadata->>'epayco_ref' as epayco_ref,
  metadata->>'bank_url_available' as has_bank_url,
  created_at
FROM payments
WHERE provider = 'epayco'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results**:
```
id                      | user_id      | status   | epayco_ref | has_bank_url | created_at
─────────────────────────┼──────────────┼──────────┼────────────┼──────────────┼─────────────
[payment-id]            | 8304222924   | pending  | 334861819  | true         | 2026-02-13
```

---

### **STEP 7: Verify Audit Log User ID**

```sql
-- Verify audit logs have proper user_id (FIX 1)
SELECT
  id,
  user_id,
  event_type,
  details
FROM payment_audit_log
WHERE payment_id = '[payment-id-from-step-6]'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**:
- ✅ `user_id` should NOT be null
- ✅ Should match the payment's user_id (8304222924)

---

## 📊 Success Criteria - All Must Be TRUE

### ✅ Fix A: Card Holder Name
```
Logs contain:
  'card[holder_name]': 'Juan Pérez'  ← MUST BE PRESENT
```

### ✅ Fix B: 3DS Detection
```
Either:
  "3DS bank redirect URL obtained" (3DS 1.0)
  OR
  "Cardinal Commerce 3DS 2.0 device data" (3DS 2.0)
```

### ✅ Fix C: Realistic Address Values
```
Logs contain:
  address: 'Calle Principal 123' OR actual user address
  NOT 'N/A'
```

### ✅ Fix D: Country Code
```
Logs contain:
  country: 'CO' OR user's country
```

### ✅ Fix 1: Audit Log user_id (from earlier)
```
Database shows:
  payment_audit_log.user_id = 8304222924
  NOT NULL
```

---

## 🚨 If Something Goes Wrong

### **Problem: No logs appear**
```bash
# Check if bot is running
pm2 status pnptv-bot

# Should show: online
# If offline: pm2 restart pnptv-bot
```

### **Problem: Bank URL is NULL**
```bash
# Check for specific errors
pm2 logs pnptv-bot | grep -i "urlbanco\|bank_url" | tail -20

# Possible causes:
1. ePayco 3DS not actually enabled in Dashboard
2. TEST vs PROD mode mismatch
3. Credentials incorrect
4. Webhook URLs not configured

# Solution:
- Verify Dashboard at: https://dashboard.epayco.com
- Check: Configuración → Seguridad → 3D Secure → ☑️ Enabled
```

### **Problem: Error in audit logs**
```bash
# Check for constraint violations
pm2 logs pnptv-bot | grep "null value in column user_id"

# If you see this: Migration 058 not applied
# Run: psql $DATABASE_URL -f database/migrations/058_make_audit_user_id_nullable.sql
```

### **Problem: Token creation failed**
```bash
# Check for token errors
pm2 logs pnptv-bot | grep -i "token.*error\|tokenize" | tail -10

# Verify:
1. Card number format (16 digits)
2. Expiry format (MM/YYYY)
3. CVC (3-4 digits)
4. Holder name included (FIX A)
```

---

## 📈 Real Payment Test Metrics

| Metric | Expected | Status |
|--------|----------|--------|
| Token Creation | Success | ⏳ Testing |
| 3DS Bank URL | Not NULL | ⏳ Testing |
| 3DS 2.0 Data | Received | ⏳ Testing |
| Audit Log user_id | Not NULL | ⏳ Testing |
| Card Holder Name | In token | ⏳ Testing |
| Country Code | Present | ⏳ Testing |
| Address Values | Realistic | ⏳ Testing |

---

## 📝 Real Payment Test Results Template

```
╔════════════════════════════════════════════════════════════════╗
║  Real Payment Test Results                                     ║
║  Date: ____________________                                    ║
╚════════════════════════════════════════════════════════════════╝

PAYMENT INFORMATION
═══════════════════
Payment ID:          _________________________________
User ID:             _________________________________
Amount:              _________________________________
Card Last 4:         _________________________________
Test Time:           _________________________________

TEST RESULTS
═════════════
□ Token created with holder_name (FIX A)     [ ] PASS [ ] FAIL
□ 3DS bank URL returned (3DS 1.0)            [ ] PASS [ ] FAIL
□ 3DS 2.0 Cardinal data returned (3DS 2.0)   [ ] PASS [ ] FAIL
□ Realistic address values sent (FIX C)      [ ] PASS [ ] FAIL
□ Country code present (FIX D)                [ ] PASS [ ] FAIL
□ Audit log has user_id (FIX 1)              [ ] PASS [ ] FAIL

PAYMENT STATUS
═══════════════
ePayco Response Estado:    ___________________________________
Bank URL Available:        □ YES   □ NO
3DS Version:               □ 1.0   □ 2.0   □ NONE
Transaction ID:            ___________________________________

LOG EVIDENCE
═════════════
[Paste relevant log lines here]
...

OVERALL RESULT
═══════════════
[ ] ALL PASS - 3DS Integration Working! ✅
[ ] SOME FAIL - Issues to investigate
[ ] CRITICAL FAIL - Contact support

Notes:
_________________________________________________________________
_________________________________________________________________

Recommendations:
_________________________________________________________________
_________________________________________________________________
```

---

## 🎯 Expected Outcome After Real Payment Test

### **If ALL Tests Pass** ✅
```
✅ 3DS authentication flow works end-to-end
✅ Bank URL returned from ePayco (or 3DS 2.0 data)
✅ User can complete 3DS authentication
✅ All 4 fixes verified in real scenario
✅ Payment can proceed after 3DS verification
```

### **If Some Tests Fail** ⚠️
```
Check specific failure:
- urlbanco NULL → ePayco Dashboard config issue
- No token_id → ePayco credentials issue
- user_id NULL → Database migration issue
- No card[holder_name] → Code not updated
```

---

## 🔄 Complete Test Flow

```
START
  │
  ├─→ User sends /subscribe to Telegram bot
  │
  ├─→ Bot creates payment record
  │
  ├─→ User clicks checkout link
  │
  ├─→ User fills payment form with test card
  │
  ├─→ User clicks PAY
  │     │
  │     ├─→ POST /api/payment/tokenized-charge
  │     │     ├─→ Card tokenized (includes holder_name) ← FIX A
  │     │     ├─→ Customer created
  │     │     └─→ Charge sent to ePayco
  │     │
  │     ├─→ ePayco Response (estado: "Pendiente")
  │     │     ├─→ urlbanco returned (3DS 1.0) ← KEY TEST
  │     │     │   OR
  │     │     └─→ 3DS 2.0 data returned ← KEY TEST
  │     │
  │     ├─→ Frontend receives response
  │     │     ├─→ Redirects to bank (3DS 1.0)
  │     │     │   OR
  │     │     └─→ Shows Cardinal Commerce form (3DS 2.0)
  │     │
  │     └─→ Audit log created with user_id ← FIX 1
  │
  ├─→ User completes 3DS authentication at bank
  │
  ├─→ Bank sends confirmation webhook to ePayco
  │
  ├─→ ePayco sends webhook to /checkout/pnp
  │
  ├─→ Payment marked as "completed"
  │
  ├─→ Subscription activated
  │
  └─→ END: User has access ✅
```

---

## 🚀 Ready to Test!

**Everything is set up. Now:**

1. **Open Telegram** → Send `/subscribe` to bot
2. **Click checkout link** → Fill payment form
3. **Use test card**: `4111111111111111` (Visa - 3DS 1.0)
4. **Monitor logs** → Watch for "3DS bank redirect URL obtained"
5. **Document results** → Use test template above

---

## 📞 Support

If you encounter issues:

1. Check logs: `pm2 logs pnptv-bot | grep -i error`
2. Verify ePayco Dashboard 3DS is enabled
3. Check webhook URLs are configured
4. Review troubleshooting guides in DIAGNOSTIC_3DS_NOT_RETURNING.md

---

**Status**: ✅ **READY FOR REAL PAYMENT TESTING**
**Test Date**: [To be filled by tester]
**Expected Result**: 3DS URLs should be returned from ePayco
