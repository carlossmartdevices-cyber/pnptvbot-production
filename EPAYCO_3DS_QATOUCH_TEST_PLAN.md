# ePayco 3DS Integration - QAtouch Test Plan
**Date**: 2026-02-13
**Platform**: qatouch.easybots.qatouch.com
**Objective**: Verify 4 critical ePayco 3DS fixes are working in production
**Status**: READY FOR EXECUTION

---

## 🎯 Test Summary

| Test ID | Name | Type | Status | Expected |
|---------|------|------|--------|----------|
| QA-001 | Create Test Payment | Setup | Ready | Payment ID created |
| QA-002 | Verify Card Holder Name in Token | Unit | Ready | Token with holder_name |
| QA-003 | Test 3DS 1.0 Flow (Bank Redirect) | Integration | Ready | redirectUrl returned |
| QA-004 | Test 3DS 2.0 Flow (Cardinal Commerce) | Integration | Ready | threeDSecure.data returned |
| QA-005 | Verify Realistic Address Values | Unit | Ready | No "N/A" or "0000000000" |
| QA-006 | Monitor Log Sequence | Monitoring | Ready | Proper 3DS flow logs |
| QA-007 | Verify No Stuck Payments | Data | Ready | Failed payments marked as such |

---

## 📋 Test Execution Steps

### STEP 1: Create Test Payment
**API Endpoint**: `POST /api/payment/create`
**Purpose**: Generate a new payment to test with

**Request**:
```bash
curl -X POST https://pnptv.app/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "8304222924",
    "planId": "lifetime-pass"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "paymentId": "[SAVE_THIS_ID]",
  "amount": 249.99,
  "currency": "USD",
  "status": "pending"
}
```

**Action**: ✅ Copy the `paymentId` for next tests

---

### STEP 2: Test Tokenized Charge with Visa 4111... (3DS 1.0)
**API Endpoint**: `POST /api/payment/tokenized-charge`
**Purpose**: Process payment with card that triggers 3DS 1.0 (bank redirect)
**Test Card**: 4111111111111111 (triggers 3DS 1.0)

**Request**:
```bash
curl -X POST https://pnptv.app/api/payment/tokenized-charge \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "[PAYMENT_ID_FROM_STEP_1]",
    "cardNumber": "4111111111111111",
    "expMonth": "12",
    "expYear": "2025",
    "cvc": "123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "address": "Calle Principal 123",
    "city": "Bogota",
    "country": "CO"
  }'
```

**Expected Response** ✅:
```json
{
  "success": true,
  "status": "pending",
  "redirectUrl": "https://banco.com/3ds/challenge?token=xyz...",
  "transactionId": "334861819",
  "message": "El pago está pendiente de confirmación en el banco"
}
```

**Verify**:
- [ ] `redirectUrl` is NOT null (FIX A working)
- [ ] URL starts with `https://`
- [ ] Response contains `transactionId`
- [ ] Status is `pending`

**Assertion**:
```
redirectUrl !== null && redirectUrl.startsWith('https://') && transactionId !== null
```

---

### STEP 3: Test Tokenized Charge with MasterCard 5555... (3DS 2.0)
**API Endpoint**: `POST /api/payment/tokenized-charge`
**Purpose**: Process payment with card that triggers 3DS 2.0 (Cardinal Commerce)
**Test Card**: 5555555555554444 (triggers 3DS 2.0)

**Request**:
```bash
curl -X POST https://pnptv.app/api/payment/tokenized-charge \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "[NEW_PAYMENT_ID]",
    "cardNumber": "5555555555554444",
    "expMonth": "12",
    "expYear": "2025",
    "cvc": "123",
    "name": "María García",
    "email": "maria@example.com",
    "address": "Avenida Principal 456",
    "city": "Medellin",
    "country": "CO"
  }'
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
      "deviceDataCollectionUrl": "https://centinelapistag.cardinalcommerce.com/...",
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "referenceId": "5f3a4b2c-1234-5678-9abc...",
      "token": "DCF645D2A..."
    }
  },
  "transactionId": "334861820"
}
```

**Verify**:
- [ ] `threeDSecure` object present (FIX B working)
- [ ] `version` is `"2.0"`
- [ ] `provider` is `"CardinalCommerce"`
- [ ] `deviceDataCollectionUrl` is NOT null
- [ ] `accessToken` is NOT null

**Assertion**:
```
threeDSecure !== null &&
threeDSecure.version === '2.0' &&
threeDSecure.provider === 'CardinalCommerce' &&
threeDSecure.data.deviceDataCollectionUrl !== null
```

---

### STEP 4: Verify Realistic Address Values (FIX C)
**Purpose**: Confirm that realistic defaults are being used
**Method**: Inspect raw API logs

**Check**:
```bash
pm2 logs pnptv-bot | grep "Creating ePayco tokenized charge" -A 30
```

**Expected to Find** ✅:
```
address: "Calle Principal 123" (not "N/A")
phone: "3101234567" (not "0000000000")
country: "CO"
```

**Verify**:
- [ ] No "N/A" values in address field
- [ ] No "0000000000" phone values
- [ ] Country code present (CO)

---

### STEP 5: Verify Country Code in Charge (FIX D)
**Purpose**: Confirm country field is being sent
**Method**: Inspect API logs

**Check**:
```bash
pm2 logs pnptv-bot | grep "ePayco charge result" -B 5 -A 10
```

**Expected to Find** ✅:
```
country: "CO"
```

**Verify**:
- [ ] Country code present in charge data
- [ ] Defaults to "CO" if not provided

---

### STEP 6: Monitor Complete Log Sequence
**Purpose**: Verify entire 3DS flow completes without errors

**Check**:
```bash
pm2 logs pnptv-bot | grep -E "token|charge|3DS|Cardinal|urlbanco" | tail -50
```

**Expected Sequence** ✅:
```
1. ePayco token response received
   ✅ tokenId created

2. ePayco customer created
   ✅ customerId obtained

3. Creating ePayco tokenized charge
   ✅ Includes: three_d_secure=true
   ✅ Includes: country=CO
   ✅ Includes: holder_name=Juan (etc)

4. ePayco charge result
   ✅ estado: "Pendiente"

5. 3DS bank redirect URL obtained from ePayco
   ✅ redirectUrl = https://banco.com/...
   OR
5. Cardinal Commerce 3DS 2.0 device data collection
   ✅ deviceDataCollectionUrl = https://centinelapistag...

6. Sending 3DS URL/data to frontend
   ✅ response sent
```

**Verify**:
- [ ] No ERROR logs in sequence
- [ ] All steps complete successfully
- [ ] Either urlbanco OR 3DS 2.0 data present (not both missing)

---

### STEP 7: Verify Payment Status Updates
**API Endpoint**: `GET /api/payment/{id}/status`
**Purpose**: Check payment status after 3DS processing

**Request**:
```bash
curl -X GET https://pnptv.app/api/payment/[PAYMENT_ID]/status
```

**Expected Response**:
```json
{
  "success": true,
  "status": "pending",
  "metadata": {
    "three_d_secure": true,
    "three_ds_version": "1.0",
    "bank_url_available": true,
    "epayco_ref": "334861819"
  }
}
```

**Verify**:
- [ ] Status is `"pending"` (not stuck, not failed)
- [ ] `three_d_secure` is `true`
- [ ] `bank_url_available` is `true` OR 3DS data available

---

### STEP 8: Verify Database Audit Logs
**Purpose**: Confirm user_id is properly logged (FIX 1 from before)

**Check**:
```sql
SELECT
  id,
  user_id,
  event_type,
  details,
  created_at
FROM payment_audit_log
WHERE payment_id = '[PAYMENT_ID]'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results** ✅:
- [ ] `user_id` is NOT null
- [ ] `user_id` matches the payment's user_id
- [ ] Event types include: `charge_attempted`, `3ds_initiated`, etc.
- [ ] No constraint violations

---

## 🔍 Negative Test Cases

### Negative Test 1: Payment Without Holder Name (Should Still Work)
**Purpose**: Verify backward compatibility if holder_name not in request

**Request** (omit name):
```json
{
  "paymentId": "[ID]",
  "cardNumber": "4111111111111111",
  "expMonth": "12",
  "expYear": "2025",
  "cvc": "123",
  "email": "test@example.com"
}
```

**Expected**:
- Code falls back to `customer.name`
- Payment still processes
- No error thrown

---

### Negative Test 2: Invalid Card
**Purpose**: Verify error handling

**Request**:
```json
{
  "cardNumber": "0000000000000000",
  "expMonth": "12",
  "expYear": "2025",
  "cvc": "123"
}
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Error al tokenizar la tarjeta...",
  "errorCode": "A001"
}
```

---

## 📊 Test Results Template

```
TEST EXECUTION RESULTS
======================

Date: 2026-02-13
Tester: [Name]
Environment: Production

QA-001: Create Test Payment
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

QA-002: Card Holder Name in Token
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

QA-003: 3DS 1.0 Bank Redirect
Status: [ ] PASS [ ] FAIL [ ] SKIP
redirectUrl: [captured_url]
Notes:

QA-004: 3DS 2.0 Cardinal Commerce
Status: [ ] PASS [ ] FAIL [ ] SKIP
deviceDataCollectionUrl: [captured_url]
Notes:

QA-005: Realistic Address Values
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

QA-006: Log Sequence
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

QA-007: Payment Status
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

QA-008: Database Audit Logs
Status: [ ] PASS [ ] FAIL [ ] SKIP
Notes:

OVERALL RESULT: [ ] ALL PASS [ ] SOME FAIL [ ] MULTIPLE FAIL

Summary:
[Write summary of findings]

Issues Found:
[List any issues]

Recommendations:
[Recommendations]
```

---

## 🚀 Running Tests in qatouch

### 1. Import Test Cases
```
Platform: qatouch.easybots.qatouch.com
Project: pnptvbot-production
Test Suite: ePayco 3DS Integration
Tests: 8 (as defined above)
```

### 2. Configure Environment
```
Base URL: https://pnptv.app
Auth: [Token from API keys]
Payment IDs: [Create fresh for each run]
Test Cards:
  - 4111111111111111 (3DS 1.0)
  - 5555555555554444 (3DS 2.0)
```

### 3. Execute Tests
```
Run Mode: Sequential (3DS flows must complete in order)
Parallel: No (same payment can't be tested twice)
Retry: 1 (on timeout)
Timeout: 30 seconds per request
```

### 4. Generate Report
- Capture all responses
- Log timestamps
- Note any errors or warnings
- Screenshot successful redirects

---

## ✅ Success Criteria

**All 8 tests must PASS**:
- [x] Payment created
- [x] 3DS 1.0 URL returned (not null)
- [x] 3DS 2.0 data returned (not null)
- [x] Realistic address values used
- [x] Country code present
- [x] Log sequence complete
- [x] Payment status correct
- [x] Audit logs have user_id

**If ANY test fails**:
1. Check logs for specific error
2. Verify ePayco Dashboard config
3. Review fix implementation
4. Contact support if needed

---

## 📞 Support Contacts

### If Tests Fail:
1. **Check Logs**: `pm2 logs pnptv-bot | grep ERROR`
2. **Review ePayco Dashboard**: 3DS enabled?
3. **Verify Credentials**: env vars correct?
4. **Contact ePayco**: soporte@epayco.com

### Success Metrics to Track:
- 3DS Success Rate: Expected 80-90%
- Average Response Time: Expected < 2 seconds
- Bank Redirect Clicks: Expected > 90% (users follow link)
- Completed Payments: Expected based on traffic

---

**Status**: READY FOR QATOUCH EXECUTION
**Commit**: f0e0864
**Fixes Applied**: 4 (card[holder_name], 3DS detection, address values, country code)
