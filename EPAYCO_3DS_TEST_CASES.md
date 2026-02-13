# ePayco 3DS Integration - Test Cases
**Reference Hash**: `8645eb8b8e532f65025806f315ba604e244d9397e5d27280b94d6a6cc9b9772f`
**Platform**: qatouch.easybots.qatouch.com
**Date**: 2026-02-13
**Tester**: Claude Code

---

## Test Environment Setup

**Base URL**: `http://localhost:3001` (or `https://pnptv.app` for production)

**Required Headers**:
```json
{
  "Content-Type": "application/json",
  "User-Agent": "Postman-Test/1.0"
}
```

---

## Test Case 1: Audit Log user_id NULL Fix

### TC-001.1: Verify audit log records user_id correctly
**Purpose**: Ensure that `logPaymentEvent()` obtains userId from payment record before logging

**Setup**:
1. Create test user in database:
   ```sql
   INSERT INTO pnp_users (id, telegram_id, email, created_at)
   VALUES ('test-user-001', 123456789, 'test@example.com', NOW())
   RETURNING id;
   ```

2. Create test payment:
   ```sql
   INSERT INTO payments (id, user_id, plan_id, status, amount, created_at)
   VALUES ('pay-test-001', 'test-user-001', 'plan-1', 'pending', 29.99, NOW())
   RETURNING id;
   ```

**Test Steps**:
```
POST /api/payment/tokenized-charge
Content-Type: application/json

{
  "paymentId": "pay-test-001",
  "cardNumber": "4111111111111111",
  "expYear": "2025",
  "expMonth": "12",
  "cvc": "123",
  "name": "Test User",
  "lastName": "Testing",
  "email": "test@example.com",
  "docType": "CC",
  "docNumber": "123456789",
  "city": "Bogota",
  "address": "Test St",
  "phone": "3001234567",
  "dues": "1"
}
```

**Expected Response**:
```json
{
  "success": false,
  "status": "pending" or "failed",
  "error": "..."
}
```

**Verification**:
1. Query audit log:
   ```sql
   SELECT payment_id, user_id, event_type, status, created_at
   FROM payment_audit_log
   WHERE payment_id = 'pay-test-001'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

2. **Assert**: `user_id` = 'test-user-001' (NOT NULL)
3. **Assert**: `event_type` IN ('charge_attempted', 'charge_completed')
4. **Assert**: Timestamp is recent

---

## Test Case 2: Fail Payments Without Bank URL

### TC-002.1: Payment without 3DS bank URL fails immediately
**Purpose**: Ensure payments without `urlbanco` or 3DS 2.0 data fail immediately instead of staying pending

**Precondition**:
- ePayco sandbox configured to return `estado: 'Pendiente'` without bank URL

**Test Steps**:
```
POST /api/payment/tokenized-charge
Content-Type: application/json

{
  "paymentId": "pay-test-002",
  "cardNumber": "4111111111111111",
  "expYear": "2025",
  "expMonth": "12",
  "cvc": "123",
  "name": "No Bank URL Test",
  "lastName": "Test",
  "email": "nobank@example.com",
  "docType": "CC",
  "docNumber": "987654321",
  "city": "Bogota",
  "address": "Test St",
  "phone": "3001234567",
  "dues": "1"
}
```

**Expected Response** (if ePayco returns Pendiente without bank URL):
```json
{
  "success": false,
  "status": "failed",
  "error": "No se pudo procesar el pago. El banco no proporcionó autenticación. Intenta con otra tarjeta o método de pago.",
  "transactionId": "ref_payco_value"
}
```

**Verification**:
1. Query payment status:
   ```sql
   SELECT id, status, metadata
   FROM payments
   WHERE id = 'pay-test-002';
   ```

2. **Assert**: `status` = 'failed'
3. **Assert**: `metadata->>'error'` = 'BANK_URL_MISSING'
4. **Assert**: No polling should occur (payment failed immediately)

---

## Test Case 3: Database NULL Handling

### TC-003.1: Verify user_id nullable in payment_audit_log
**Purpose**: Ensure migration 058 allows NULL user_id without constraint violations

**Test Steps**:
```sql
-- Insert audit log with NULL user_id (should NOT fail)
INSERT INTO payment_audit_log
  (payment_id, user_id, event_type, provider, amount, status, details, created_at)
VALUES
  ('pay-test-003', NULL, 'system_audit', 'epayco', NULL, 'pending', '{}'::jsonb, NOW());

-- Verify insertion succeeded
SELECT COUNT(*) as inserted FROM payment_audit_log
WHERE payment_id = 'pay-test-003' AND user_id IS NULL;
```

**Expected Result**:
```
inserted | 1
```

**Verification**:
1. **Assert**: Insert succeeds (no constraint violation)
2. **Assert**: Row count = 1
3. **Assert**: `user_id` IS NULL in returned row

---

## Test Case 4: 3DS 2.0 with Cardinal Commerce

### TC-004.1: Verify 3DS 2.0 data collection flow works
**Purpose**: Ensure Cardinal Commerce 3DS 2.0 flow returns correct device data collection info

**Test Steps**:
```
POST /api/payment/tokenized-charge
Content-Type: application/json

{
  "paymentId": "pay-test-004",
  "cardNumber": "4111111111111111",
  "expYear": "2025",
  "expMonth": "12",
  "cvc": "123",
  "name": "3DS 2.0 Test",
  "lastName": "Test",
  "email": "3ds2@example.com",
  "docType": "CC",
  "docNumber": "555555555",
  "city": "Bogota",
  "address": "Test St",
  "phone": "3001234567",
  "dues": "1"
}
```

**Expected Response** (if ePayco returns 3DS 2.0 data):
```json
{
  "success": true,
  "status": "pending",
  "threeDSecure": {
    "version": "2.0",
    "provider": "CardinalCommerce",
    "integration": "epayco_api_validate3ds",
    "data": {
      "accessToken": "...",
      "deviceDataCollectionUrl": "...",
      "referenceId": "...",
      "token": "..."
    }
  }
}
```

**Verification**:
1. **Assert**: `threeDSecure.version` = '2.0'
2. **Assert**: `threeDSecure.provider` = 'CardinalCommerce'
3. **Assert**: All required fields present in `data` object

---

## Test Case 5: 3DS 1.0 Bank Redirect

### TC-005.1: Verify 3DS 1.0 bank redirect flow works
**Purpose**: Ensure simple bank redirect (urlbanco) works correctly

**Test Steps**:
```
POST /api/payment/tokenized-charge
Content-Type: application/json

{
  "paymentId": "pay-test-005",
  "cardNumber": "4111111111111111",
  "expYear": "2025",
  "expMonth": "12",
  "cvc": "123",
  "name": "3DS 1.0 Test",
  "lastName": "Test",
  "email": "3ds1@example.com",
  "docType": "CC",
  "docNumber": "666666666",
  "city": "Bogota",
  "address": "Test St",
  "phone": "3001234567",
  "dues": "1"
}
```

**Expected Response** (if ePayco returns urlbanco):
```json
{
  "success": true,
  "status": "pending",
  "redirectUrl": "https://banco.com/3ds/...",
  "transactionId": "ref_payco_value"
}
```

**Verification**:
1. **Assert**: `redirectUrl` is present and valid URL
2. **Assert**: `status` = 'pending' (waiting for webhook)
3. **Assert**: `transactionId` has ePayco reference

---

## Test Case 6: Successful Payment Flow

### TC-006.1: Verify successful payment activation
**Purpose**: Ensure approved payments activate subscription correctly

**Test Steps**:
```
POST /api/payment/tokenized-charge
Content-Type: application/json

{
  "paymentId": "pay-test-006",
  "cardNumber": "4111111111111111",
  "expYear": "2025",
  "expMonth": "12",
  "cvc": "123",
  "name": "Success Test",
  "lastName": "Test",
  "email": "success@example.com",
  "docType": "CC",
  "docNumber": "777777777",
  "city": "Bogota",
  "address": "Test St",
  "phone": "3001234567",
  "dues": "1"
}
```

**Expected Response** (if ePayco approves):
```json
{
  "success": true,
  "status": "approved",
  "transactionId": "ref_payco_value",
  "message": "Pago aprobado exitosamente"
}
```

**Verification**:
1. Query payment:
   ```sql
   SELECT status, metadata->>'reference' as epayco_ref
   FROM payments WHERE id = 'pay-test-006';
   ```

2. **Assert**: `status` = 'completed'
3. **Assert**: User subscription activated with expiry date

---

## Postman Collection

### Import Instructions:
1. Open Postman
2. Create new Collection: "ePayco 3DS Tests"
3. Add requests below

### Request Templates:

**1. Create Test User**
```
POST {{base_url}}/api/users/create
{
  "telegram_id": 123456789,
  "email": "test@example.com"
}
```

**2. Create Test Payment**
```
POST {{base_url}}/api/payments/create
{
  "user_id": "test-user-001",
  "plan_id": "plan-1",
  "amount": 29.99
}
```

**3. Process Tokenized Charge**
```
POST {{base_url}}/api/payment/tokenized-charge
{
  "paymentId": "{{paymentId}}",
  "cardNumber": "{{cardNumber}}",
  ...
}
```

**4. Check Payment Status**
```
GET {{base_url}}/api/payment/{{paymentId}}/status
```

**5. Check Audit Log**
```
GET {{base_url}}/api/audit/payments/{{paymentId}}
```

---

## Test Execution Checklist

- [ ] TC-001.1: Audit log has user_id (not NULL)
- [ ] TC-002.1: Payment without bank URL fails immediately
- [ ] TC-003.1: Database allows NULL user_id
- [ ] TC-004.1: 3DS 2.0 returns Cardinal Commerce data
- [ ] TC-005.1: 3DS 1.0 returns bank redirect URL
- [ ] TC-006.1: Successful payment activates subscription

---

## Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001.1 | ⏳ PENDING | Audit log user_id verification |
| TC-002.1 | ⏳ PENDING | Bank URL missing failure |
| TC-003.1 | ⏳ PENDING | Database NULL handling |
| TC-004.1 | ⏳ PENDING | 3DS 2.0 flow |
| TC-005.1 | ⏳ PENDING | 3DS 1.0 flow |
| TC-006.1 | ⏳ PENDING | Success flow |

---

**Test Date**: 2026-02-13
**Tested By**: QA Team via qatouch.easybots.qatouch.com
**Reference**: Commit 0c2c9d6
