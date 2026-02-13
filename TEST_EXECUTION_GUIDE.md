# ePayco 3DS Test Execution Guide

**Reference Hash**: `8645eb8b8e532f65025806f315ba604e244d9397e5d27280b94d6a6cc9b9772f`
**Platform**: qatouch.easybots.qatouch.com
**Date**: 2026-02-13
**Commit**: 0c2c9d6

---

## Quick Start

### 1. Import Postman Collection

#### Method A: Direct File Import
```bash
# The collection file is located at:
/root/pnptvbot-production/EPAYCO_3DS_TEST.postman_collection.json

# Steps:
1. Open Postman
2. Click "Import" (top left)
3. Select "Upload Files"
4. Choose EPAYCO_3DS_TEST.postman_collection.json
5. Click "Import"
```

#### Method B: Manual Import
1. Open Postman
2. Create new Collection: "ePayco 3DS Tests"
3. Add 8 requests from EPAYCO_3DS_TEST.postman_collection.json

### 2. Set Environment Variables

In Postman, create new Environment: "ePayco Tests"

```json
{
  "base_url": "http://localhost:3001",
  "paymentId": "pay-test-001"
}
```

Or for production:
```json
{
  "base_url": "https://pnptv.app",
  "paymentId": "pay-test-001"
}
```

### 3. Execute Tests

Run tests in order:

1. **Health Check** - Verify API is up
   ```
   GET {{base_url}}/api/health

   Expected: {"status":"ok","dependencies":{"redis":"ok","database":"ok"}}
   ```

2. **TC-001.1** - Audit log user_id (FIX 1)
   ```
   POST {{base_url}}/api/payment/tokenized-charge

   Expected: Payment created with audit log having user_id
   ```

3. **TC-002.1** - Bank URL missing (FIX 2)
   ```
   POST {{base_url}}/api/payment/tokenized-charge

   Expected: {"success":false,"status":"failed","error":"BANK_URL_MISSING"}
   ```

4. **TC-003.1** - NULL user_id handling (FIX 3)
   ```
   POST {{base_url}}/api/payment/tokenized-charge

   Expected: Works without constraint violations
   ```

5. **TC-004.1 - TC-006.1** - 3DS flows
   ```
   POST {{base_url}}/api/payment/tokenized-charge

   Expected: Pending with 3DS data or redirect URL
   ```

---

## Manual Database Verification

After running Postman tests, verify data was written correctly:

### Verify FIX 1: Audit Log user_id

```sql
-- Connect to database
psql postgresql://pnptvbot:password@localhost:5432/pnptvbot

-- Check audit logs
SELECT payment_id, user_id, event_type, status, created_at
FROM payment_audit_log
WHERE payment_id LIKE 'pay-test-%'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: user_id should be populated (not NULL for actual payments)
```

### Verify FIX 2: Failed Payments

```sql
-- Check failed payments
SELECT id, status, metadata->>'error' as error_code, created_at
FROM payments
WHERE id LIKE 'pay-test-%' AND status = 'failed'
ORDER BY created_at DESC;

-- Expected: error_code = 'BANK_URL_MISSING' for relevant payments
```

### Verify FIX 3: NULL user_id Allowed

```sql
-- Check if NULL user_id is allowed
INSERT INTO payment_audit_log
  (payment_id, user_id, event_type, provider, amount, status, details, created_at)
VALUES
  ('pay-test-manual', NULL, 'manual_test', 'epayco', NULL, 'pending', '{}'::jsonb, NOW());

-- Should succeed (no constraint violation)
SELECT COUNT(*) FROM payment_audit_log
WHERE payment_id = 'pay-test-manual' AND user_id IS NULL;

-- Expected: 1 row returned
```

---

## Test Results Template

After executing all tests, fill in this template:

```markdown
# Test Results - ePayco 3DS Fixes

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: [localhost|production]
**Commit**: 0c2c9d6

## Test Execution Summary

| Test | Status | Details |
|------|--------|---------|
| Health Check | ✅ PASS / ❌ FAIL | [Details] |
| TC-001.1: Audit user_id | ✅ PASS / ❌ FAIL | user_id recorded: YES/NO |
| TC-002.1: Bank URL fail | ✅ PASS / ❌ FAIL | Status: failed, Error: BANK_URL_MISSING |
| TC-003.1: NULL handling | ✅ PASS / ❌ FAIL | No constraint violations |
| TC-004.1: 3DS 2.0 | ✅ PASS / ❌ FAIL | Cardinal Commerce data returned |
| TC-005.1: 3DS 1.0 | ✅ PASS / ❌ FAIL | Bank redirect URL returned |
| TC-006.1: Success | ✅ PASS / ❌ FAIL | Payment approved, subscription active |

## Issues Found

[List any issues discovered during testing]

## Recommendations

[Any improvements or follow-ups needed]

## Signed Off

- Tester: ________________________
- Date: ________________________
```

---

## Troubleshooting

### Issue: "Connection refused" to localhost:3001

**Solution**:
```bash
# Check if bot is running
pm2 status pnptv-bot

# If not running, start it
pm2 start /root/pnptvbot-production/src/index.js --name pnptv-bot

# Wait 5 seconds for startup
sleep 5

# Verify health endpoint
curl http://localhost:3001/api/health
```

### Issue: Database errors

**Solution**:
```bash
# Check database connection
psql postgresql://pnptvbot:password@localhost:5432/pnptvbot -c "SELECT 1"

# Check if migrations are applied
psql postgresql://pnptvbot:password@localhost:5432/pnptvbot -c \
  "SELECT * FROM information_schema.columns \
   WHERE table_name = 'payment_audit_log' AND column_name = 'user_id';"

# Expected: is_nullable = YES
```

### Issue: Payment creation fails

**Solution**:
```bash
# Check if user exists in database
psql postgresql://pnptvbot:password@localhost:5432/pnptvbot -c \
  "SELECT id FROM pnp_users WHERE email = 'test@example.com';"

# If no results, create user first:
psql postgresql://pnptvbot:password@localhost:5432/pnptvbot -c \
  "INSERT INTO pnp_users (id, email, created_at) \
   VALUES ('test-user-001', 'test@example.com', NOW());"
```

---

## Postman Variables Reference

```
{{base_url}}          → http://localhost:3001 (or production URL)
{{paymentId}}         → pay-test-001, pay-test-002, etc
```

## Test Files Location

```
/root/pnptvbot-production/
├── EPAYCO_3DS_TEST.postman_collection.json    ← Import this into Postman
├── EPAYCO_3DS_TEST_CASES.md                   ← Detailed test specifications
├── TEST_EXECUTION_GUIDE.md                    ← This file
└── src/
    ├── bot/api/controllers/paymentController.js
    └── bot/services/paymentService.js
```

---

## Next Steps

After all tests pass:

1. ✅ Run tests in qatouch.easybots.qatouch.com
2. ✅ Document results in this guide
3. ✅ Approve for production
4. ✅ Deploy to live environment

---

**Reference Hash**: `8645eb8b8e532f65025806f315ba604e244d9397e5d27280b94d6a6cc9b9772f`
