# Real Payment Testing Kit - Complete Guide
**Status**: ✅ READY FOR EXECUTION
**Date**: 2026-02-13
**Objective**: Execute real payment flow with ePayco 3DS

---

## 🚀 Quick Start (5 Minutes)

### **Step 1: Start Real-Time Monitor** (Terminal 1)
```bash
cd /root/pnptvbot-production
./monitor_real_payment.sh
```

This will watch logs for payment events and 3DS responses.

### **Step 2: Trigger Payment** (Telegram)
```
1. Open Telegram → Find pnptvbot
2. Send: /subscribe
3. Select: lifetime-pass (or any plan)
4. Click checkout link
```

### **Step 3: Fill Payment Form**
```
Card Number:  4111111111111111  (Visa - triggers 3DS 1.0)
Expiry:       12/2025
CVC:          123
Name:         Juan Pérez
Email:        juan@example.com
Address:      Bogota
City:         Bogota
Country:      CO
```

### **Step 4: Click PAY**
Watch the monitor for:
```
✅ "TOKEN CREATED"
✅ "CHARGE PROCESSING"
✅ "3DS RESPONSE RECEIVED!" ← THIS IS THE KEY LINE
```

---

## 🔍 What to Look For

### **SUCCESS** ✅
```
3DS RESPONSE RECEIVED!
✅ 3DS 1.0 (Bank Redirect) Detected!
OR
✅ 3DS 2.0 (Cardinal Commerce) Detected!
```

### **FAILURE** ❌
```
Bank URL: null
3DS Data: null
No 3DS response in logs
```

---

## 📊 Test Checklist

```
Before Testing:
□ Monitor script ready (monitor_real_payment.sh)
□ Bot running (pm2 status pnptv-bot → online)
□ Telegram bot accessible
□ Test card ready: 4111111111111111

During Testing:
□ Send /subscribe to bot
□ Fill payment form
□ Click PAY
□ Watch monitor for 3DS events
□ 5-10 seconds wait for response

After Testing:
□ Monitor shows "3DS RESPONSE RECEIVED"
□ Check logs contain bank URL or 3DS 2.0 data
□ Verify no error messages
□ Document results
```

---

## 📈 Detailed Testing Flow

### **Phase 1: Payment Initiation** (30 seconds)
```
Telegram Bot:
  User sends /subscribe
    ↓
  Bot creates payment record
    ↓
  Bot sends checkout link
    ↓
  User clicks link → Payment form loads

Expected Monitor Output:
  No logs yet (waiting for form submission)
```

### **Phase 2: Token Creation** (5 seconds)
```
Payment Form:
  User fills: Card, Expiry, CVC, Name, Email, Address
    ↓
  User clicks PAY
    ↓
  Frontend → Backend: POST /api/payment/tokenized-charge

Expected Monitor Output:
  ✅ TOKEN CREATED
  - tokenId: [unique-id]
  - card[holder_name]: Juan Pérez  ← FIX A
```

### **Phase 3: Charge Processing** (10 seconds)
```
Backend:
  Create token with card[holder_name]  ← FIX A
    ↓
  Create customer in ePayco
    ↓
  Create charge with:
    - three_d_secure: true
    - country: 'CO'  ← FIX D
    - address: 'Calle Principal 123'  ← FIX C

Expected Monitor Output:
  📝 CHARGE PROCESSING
  - estado: "Pendiente"
  - refPayco: [id]
```

### **Phase 4: 3DS Response** (5 seconds) ⭐ CRITICAL
```
ePayco API Response:
  estado: "Pendiente"
    ↓
  Option 1: urlbanco = "https://banco.com/3ds/..."  (3DS 1.0)
    ↓
  Option 2: 3DS.data = {...}  (3DS 2.0)

Expected Monitor Output:
  🎉 3DS RESPONSE RECEIVED!
  ✅ 3DS 1.0 (Bank Redirect) Detected!
     OR
  ✅ 3DS 2.0 (Cardinal Commerce) Detected!
```

---

## 🎯 Success Criteria

### **All Must Be TRUE for SUCCESS** ✅

1. **Token Creation With Holder Name**
   ```
   Logs show: 'card[holder_name]': 'Juan Pérez'
   Status: ✅ PASS
   ```

2. **3DS Bank URL or Cardinal Data Returned**
   ```
   Logs show:
     redirectUrl: "https://banco.com/..." (3DS 1.0)
     OR
     deviceDataCollectionUrl: "https://..." (3DS 2.0)
   Status: ✅ PASS
   ```

3. **Realistic Address Values**
   ```
   Logs show:
     address: "Calle Principal 123" (not "N/A")
     phone: "3101234567" (not "0000000000")
   Status: ✅ PASS
   ```

4. **Country Code Present**
   ```
   Logs show:
     country: "CO"
   Status: ✅ PASS
   ```

5. **No Errors**
   ```
   No "ERROR" or "FAIL" messages in logs
   Status: ✅ PASS
   ```

---

## 🛠️ Troubleshooting

### **Problem: Monitor shows no events**

**Solution**:
```bash
# Check if bot is running
pm2 status pnptv-bot

# If offline, restart
pm2 restart pnptv-bot

# Check logs manually
pm2 logs pnptv-bot | grep -i "payment\|token"

# Verify checkout form loads
curl -X GET https://pnptv.app/api/health
# Should return: {"status": "healthy"}
```

### **Problem: 3DS Response is NULL**

**Solution**:
```bash
# Check what ePayco returned
pm2 logs pnptv-bot | grep -A 5 "ePayco charge result"

# Common reasons:
1. ePayco Dashboard: 3DS not actually enabled
2. Test mode mismatch (TEST vs PROD)
3. Webhook URLs not configured
4. Wrong credentials

# Verify:
# Go to: https://dashboard.epayco.com
# Check: Configuración → Seguridad → 3D Secure → ☑️ Habilitado
```

### **Problem: Card Rejected**

**Solution**:
```bash
# Check for token error
pm2 logs pnptv-bot | grep -i "token.*error"

# Verify card format:
- Number: 4111111111111111 (16 digits)
- Expiry: 12/2025 (MM/YYYY format)
- CVC: 123 (3 digits)
- Name: Must be provided (FIX A requirement)
```

---

## 📝 Test Results Document

### **After Payment Test, Save Results:**

```
═══════════════════════════════════════════════════════════════
REAL PAYMENT TEST RESULTS
═══════════════════════════════════════════════════════════════

Test Date:              2026-02-13
Tester:                 [Your Name]
Payment ID:             [From logs]
Card:                   4111... (last 4 digits)
Status:                 Pending

VERIFICATION RESULTS
═══════════════════════════════════════════════════════════════

FIX A - Card Holder Name
  [ ] ✅ PASS - 'card[holder_name]' in logs
  [ ] ❌ FAIL - Not found in logs

FIX B - 3DS Detection
  [ ] ✅ PASS - 3DS 1.0 URL returned
  [ ] ✅ PASS - 3DS 2.0 data returned
  [ ] ❌ FAIL - Neither returned

FIX C - Realistic Address
  [ ] ✅ PASS - "Calle Principal 123" in logs
  [ ] ❌ FAIL - Still shows "N/A"

FIX D - Country Code
  [ ] ✅ PASS - "CO" in logs
  [ ] ❌ FAIL - Country code missing

Overall Result
  [ ] ✅ ALL PASS - 3DS Working!
  [ ] ⚠️  PARTIAL - Some issues
  [ ] ❌ FAIL - Major issues

Notes:
[Write observations here]
═══════════════════════════════════════════════════════════════
```

---

## 📚 Full Documentation Available

- `REAL_PAYMENT_TEST_GUIDE.md` - Detailed step-by-step guide
- `EPAYCO_FIXES_COMPLETE_REPORT.md` - Implementation details
- `DIAGNOSTIC_3DS_NOT_RETURNING.md` - Troubleshooting guide
- `QATOUCH_QUICK_START.md` - Quick reference

---

## ⏱️ Timeline

```
Start:             T+0 minutes
Monitor Started:   T+1 minute
Payment Initiated: T+2-3 minutes
Token Created:     T+5-10 seconds (after payment initiation)
3DS Response:      T+15-20 seconds (after payment initiation)
Test Complete:     T+5-10 minutes total
```

---

## 🎓 Expected Results

### **If All Fixes Work** ✅
```
✅ Payment form loads without errors
✅ Token created with card[holder_name]
✅ 3DS bank URL or Cardinal data returned
✅ No nulls in critical fields
✅ Payment marked as pending (waiting for 3DS completion)
```

### **If Fixes Fail** ❌
```
❌ urlbanco = null (bank URL not returned)
❌ No card[holder_name] in token
❌ Address shows as "N/A"
❌ Country code missing
❌ Payment stuck without 3DS option
```

---

## ✅ Ready to Test?

1. **Start Monitor**:
   ```bash
   ./monitor_real_payment.sh
   ```

2. **Open Telegram** → Send `/subscribe`

3. **Watch Monitor** → Look for "3DS RESPONSE RECEIVED"

4. **Document Results** → Save what you see

---

**Status**: 🚀 **READY FOR REAL PAYMENT TESTING**
**Expected Outcome**: 3DS URLs should be returned from ePayco
**Timeframe**: ~10 minutes for complete test
