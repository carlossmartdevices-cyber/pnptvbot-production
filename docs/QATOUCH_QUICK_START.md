# QAtouch Testing - Quick Start Guide
**Status**: READY TO EXECUTE
**Platform**: qatouch.easybots.qatouch.com
**Duration**: 30-45 minutes for full suite

---

## ⚡ 5-Minute Setup

### 1. Access QAtouch
```
URL: https://qatouch.easybots.qatouch.com
Project: pnptvbot-production
Module: Payment Processing
Feature: ePayco 3DS Integration
```

### 2. Create Test Environment
```
Base URL: https://pnptv.app
API Version: v1
Auth: Token [from API keys]
Timeout: 30 seconds
```

### 3. Test Cards
```
VISA (3DS 1.0):       4111111111111111
MasterCard (3DS 2.0): 5555555555554444
Expiry:               12/2025
CVC:                  123
```

---

## 📋 8 Tests to Execute

| # | Test | Expected | Time |
|---|------|----------|------|
| 1 | Create Payment | Payment ID generated | 1 min |
| 2 | Card Holder Name | Token includes name | 1 min |
| 3 | 3DS 1.0 Bank Redirect | redirectUrl returned | 2 min |
| 4 | 3DS 2.0 Cardinal | threeDSecure.data returned | 2 min |
| 5 | Realistic Address Values | No "N/A" or "0000000000" | 2 min |
| 6 | Country Code | "CO" in charge data | 1 min |
| 7 | Log Sequence | No errors in flow | 5 min |
| 8 | Database Audit Logs | user_id not null | 5 min |
| | **TOTAL** | | **19 min** |

---

## 🚀 Test 1: Create Payment

**Endpoint**: `POST /api/payment/create`

**Request**:
```json
{
  "userId": "8304222924",
  "planId": "lifetime-pass"
}
```

**Expected**:
```json
{
  "success": true,
  "paymentId": "[SAVE_THIS]",
  "amount": 249.99,
  "status": "pending"
}
```

**✅ PASS If**: paymentId returned, not null

---

## 🚀 Test 2 & 3: 3DS 1.0 (Bank Redirect)

**Endpoint**: `POST /api/payment/tokenized-charge`

**Request**:
```json
{
  "paymentId": "[FROM_TEST_1]",
  "cardNumber": "4111111111111111",
  "expMonth": "12",
  "expYear": "2025",
  "cvc": "123",
  "name": "Juan Pérez",
  "email": "juan@example.com"
}
```

**Expected Response** ✅:
```json
{
  "success": true,
  "status": "pending",
  "redirectUrl": "https://banco.com/3ds/...",
  "transactionId": "334861819"
}
```

**✅ PASS If**:
- `redirectUrl` is NOT null
- URL starts with `https://`
- `transactionId` present

---

## 🚀 Test 4: 3DS 2.0 (Cardinal Commerce)

**Endpoint**: `POST /api/payment/tokenized-charge`

**Request**:
```json
{
  "paymentId": "[CREATE_NEW_PAYMENT]",
  "cardNumber": "5555555555554444",
  "expMonth": "12",
  "expYear": "2025",
  "cvc": "123",
  "name": "María García",
  "email": "maria@example.com"
}
```

**Expected Response** ✅:
```json
{
  "success": true,
  "status": "pending",
  "threeDSecure": {
    "version": "2.0",
    "provider": "CardinalCommerce",
    "data": {
      "deviceDataCollectionUrl": "https://centinelapistag...",
      "accessToken": "eyJhbGc...",
      "referenceId": "5f3a4b2c..."
    }
  }
}
```

**✅ PASS If**:
- `threeDSecure` object exists
- `version` is "2.0"
- `provider` is "CardinalCommerce"
- `deviceDataCollectionUrl` NOT null

---

## 🚀 Test 5: Verify Fixes Applied

**Method**: Check logs
```
Run in terminal:
pm2 logs pnptv-bot | grep "Creating ePayco" -A 30
```

**Look For** ✅:
```
address: "Calle Principal 123"  (NOT "N/A")
phone: "3101234567"             (NOT "0000000000")
country: "CO"                   (NEW FIELD)
three_d_secure: true            (ENABLED)
```

**✅ PASS If**: All values present, no placeholders

---

## 🚀 Tests 6-8: Advanced Verification

### Test 6: Full Log Sequence
```bash
pm2 logs pnptv-bot | grep -i "token\|charge\|3ds" | tail -50
```

**Expected Sequence**:
```
✅ ePayco token created
✅ ePayco customer created
✅ ePayco charge result
✅ 3DS bank redirect URL obtained
   OR
✅ Cardinal Commerce 3DS 2.0 device data
```

### Test 7: Payment Status
```bash
curl https://pnptv.app/api/payment/[ID]/status | jq '.'
```

**Expected**:
```json
{
  "success": true,
  "status": "pending",
  "metadata": {
    "three_d_secure": true,
    "bank_url_available": true
  }
}
```

### Test 8: Database Audit Logs
```sql
SELECT user_id, event_type FROM payment_audit_log
WHERE payment_id = '[TEST_PAYMENT_ID]'
LIMIT 5;
```

**Expected**: user_id is NOT null ✅

---

## 📊 Results Template

```
QAtouch Execution - ePayco 3DS Integration
==========================================

Date: _______________
Tester: _____________
Duration: ___________

Test 1: Create Payment        [ ] PASS [ ] FAIL
Test 2: 3DS 1.0 URL          [ ] PASS [ ] FAIL
Test 3: 3DS 2.0 Data         [ ] PASS [ ] FAIL
Test 4: Address Values        [ ] PASS [ ] FAIL
Test 5: Country Code          [ ] PASS [ ] FAIL
Test 6: Log Sequence          [ ] PASS [ ] FAIL
Test 7: Payment Status        [ ] PASS [ ] FAIL
Test 8: Audit Logs            [ ] PASS [ ] FAIL

OVERALL: [ ] ALL PASS [ ] SOME FAIL

Issues Found:
_________________________________

Notes:
_________________________________
```

---

## ✅ Success Criteria

**ALL 8 TESTS MUST PASS**

If all pass: ✅ **3DS Integration is WORKING**
If any fail: ❌ Check logs and diagnostic docs

---

## 🆘 Quick Troubleshooting

### If 3DS URL is NULL:
```bash
# Check ePayco response
pm2 logs pnptv-bot | grep "ePayco charge result" -A 10

# Verify Dashboard 3DS enabled
# Dashboard → Seguridad → 3D Secure → ☑️ Enabled
```

### If Address Values Wrong:
```bash
# Restart bot with new code
pm2 restart pnptv-bot

# Verify fix applied
grep "Calle Principal 123" src/bot/services/paymentService.js
```

### If Tests Timeout:
```bash
# Check bot status
pm2 status pnptv-bot

# Check logs for errors
pm2 logs pnptv-bot | grep ERROR | tail -20

# Restart if needed
pm2 restart pnptv-bot
```

---

## 📞 Resources

- **Full Test Plan**: `EPAYCO_3DS_QATOUCH_TEST_PLAN.md`
- **Deployment Report**: `EPAYCO_FIXES_COMPLETE_REPORT.md`
- **Troubleshooting**: `DIAGNOSTIC_3DS_NOT_RETURNING.md`
- **ePayco Docs**: `ENABLE_3DS_GUIDE.md`
- **Response Formats**: `EPAYCO_3DS_REAL_RESPONSE_FORMAT.md`

---

## 🎯 Goal

✅ Verify that all 4 ePayco 3DS fixes are working correctly in production:
1. Card holder name included in token
2. 3DS URLs properly returned (1.0 and 2.0)
3. Realistic address values used
4. Country code included

**Expected Outcome**: 3DS authentication flow works end-to-end

---

**Status**: READY FOR QATOUCH EXECUTION
**Commit**: f0e0864
**Date**: 2026-02-13
