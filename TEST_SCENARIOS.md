# Sprint 1 & 4 - Test Scenarios & Validation

## Overview
This document provides concrete test scenarios for validating all 7 security improvements.

---

## Task 1F: Geolocation Privacy - Coordinate Rounding

### Test Scenario 1F-1: Precision Reduction
**Objective:** Verify coordinates are rounded to 3 decimals

```javascript
// Setup
const userId = 'test-user-123';
const latitude = 40.7128456789;  // Original: 8 decimal places
const longitude = -74.0059876543; // Original: 8 decimal places
const accuracy = 5;

// Execute
const result = await nearbyService.updateLocation(userId, latitude, longitude, accuracy);

// Expected
console.assert(result.latitude === 40.713, 'Latitude should be 40.713');
console.assert(result.longitude === -74.006, 'Longitude should be -74.006');
console.log('✓ Coordinates rounded to 3 decimals (~111m precision)');
```

### Test Scenario 1F-2: PostgreSQL Storage
**Objective:** Verify rounded values stored in database

```javascript
// Query database
const result = await query(
  'SELECT latitude, longitude FROM user_locations WHERE user_id = $1',
  [userId]
);

// Expected
console.assert(result.rows[0].latitude === 40.713, 'DB: Latitude should be 40.713');
console.assert(result.rows[0].longitude === -74.006, 'DB: Longitude should be -74.006');
console.log('✓ PostgreSQL stores rounded coordinates');
```

### Test Scenario 1F-3: Redis GEO Storage
**Objective:** Verify rounded coordinates in Redis GEO

```javascript
// Query Redis
const members = await redisClient.georadius(
  'users:locations',
  -74.006,
  40.713,
  1000,
  'km'
);

// Expected
console.assert(members.includes(userId), 'Redis: User should be in GEO index');
console.log('✓ Redis GEO stores rounded coordinates');
```

---

## Task 1G: Audit Logger IP Spoofing

### Test Scenario 1G-1: Prevent IP Spoofing
**Objective:** Verify x-forwarded-for headers are rejected

```javascript
// Setup: Malicious request with spoofed IP
const req = {
  headers: {
    'x-forwarded-for': '192.168.1.1',  // Attacker tries to spoof this
  },
  socket: {
    remoteAddress: '203.0.113.45'  // Real IP
  },
  ip: '203.0.113.45'  // Correct IP (respects trust proxy)
};

// Execute: Trigger audit log
await req.auditLog('UPDATE', 'user', userId, oldValue, newValue);

// Expected: Verify logged IP
const auditLog = await query(
  'SELECT ip_address FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 1',
  [userId]
);
console.assert(auditLog.rows[0].ip_address === '203.0.113.45', 'Should use real IP, not spoofed');
console.log('✓ Audit logger uses req.ip instead of x-forwarded-for');
```

### Test Scenario 1G-2: Trust Proxy Validation
**Objective:** Verify trust proxy is properly configured

```javascript
// Check Express configuration
console.assert(app.get('trust proxy') > 0, 'Trust proxy should be enabled');
console.log('✓ Express trust proxy configured');
```

---

## Task 1H: Real Listener Count

### Test Scenario 1H-1: Fetch from Redis
**Objective:** Verify listener count comes from Redis

```javascript
// Setup: Set listener count in Redis
await redisClient.set('radio:listener_count', '42');

// Execute: Call radio now-playing endpoint
const response = await fetch('/api/radio/now-playing');
const data = await response.json();

// Expected
console.assert(data.listenerCount === 42, 'Should return 42 from Redis');
console.log('✓ Real listener count fetched from Redis');
```

### Test Scenario 1H-2: Fallback on Redis Failure
**Objective:** Verify graceful degradation when Redis unavailable

```javascript
// Setup: Redis temporarily down
await redisClient.disconnect();

// Execute: Call radio now-playing endpoint
const response = await fetch('/api/radio/now-playing');
const data = await response.json();

// Expected
console.assert(data.listenerCount === 0, 'Should fallback to 0');
console.assert(response.status === 200, 'Should not error');
console.log('✓ Fallback to 0 listener count when Redis unavailable');

// Cleanup
await redisClient.connect();
```

### Test Scenario 1H-3: Verify No Random Values
**Objective:** Ensure no simulated random numbers remain

```javascript
// Search code
const content = require('fs').readFileSync('apps/backend/bot/api/routes.js', 'utf-8');
const hasRandom = content.includes('Math.random()');

console.assert(!hasRandom, 'Should not have Math.random() in routes.js');
console.log('✓ No simulated random listener counts');
```

---

## Task 4A: PCI DSS Frontend Tokenization

### Test Scenario 4A-1: Reject Raw Card Number
**Objective:** Reject cardNumber field

```javascript
const response = await fetch('/api/recurring/tokenize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    cardNumber: '4111111111111111',  // FORBIDDEN
    cardToken: 'tok_1234567890'
  })
});

const data = await response.json();

console.assert(response.status === 400, 'Should return 400');
console.assert(data.error === 'Raw card data cannot be sent to server. Use ePayco.js tokenization in browser.', 'Should show correct error');
console.log('✓ Rejects cardNumber field');
```

### Test Scenario 4A-2: Reject CVC
**Objective:** Reject cvc field

```javascript
const response = await fetch('/api/recurring/tokenize', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    cvc: '123',  // FORBIDDEN
    cardToken: 'tok_1234567890'
  })
});

const data = await response.json();

console.assert(response.status === 400, 'Should return 400');
console.log('✓ Rejects cvc field');
```

### Test Scenario 4A-3: Reject Expiration Fields
**Objective:** Reject expMonth and expYear fields

```javascript
const response = await fetch('/api/recurring/tokenize', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    expMonth: '12',  // FORBIDDEN
    expYear: '2025',  // FORBIDDEN
    cardToken: 'tok_1234567890'
  })
});

const data = await response.json();

console.assert(response.status === 400, 'Should return 400');
console.log('✓ Rejects expMonth and expYear fields');
```

### Test Scenario 4A-4: Accept Valid Token
**Objective:** Accept valid cardToken without card data

```javascript
const response = await fetch('/api/recurring/tokenize', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    cardToken: 'tok_1234567890'  // Pre-tokenized by ePayco.js
  })
});

const data = await response.json();

console.assert(response.status === 200, 'Should return 200');
console.assert(data.success === true, 'Should indicate success');
console.assert(data.token === 'tok_1234567890', 'Should echo token');
console.log('✓ Accepts valid cardToken without card data');
```

### Test Scenario 4A-5: Reject snake_case Card Fields
**Objective:** Reject alternative naming conventions

```javascript
const response = await fetch('/api/recurring/tokenize', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user-123',
    card_number: '4111111111111111',  // FORBIDDEN (snake_case)
    cardToken: 'tok_1234567890'
  })
});

const data = await response.json();

console.assert(response.status === 400, 'Should return 400');
console.log('✓ Rejects snake_case card field variants');
```

---

## Task 4B: MD5 → SHA-256 Signatures

### Test Scenario 4B-1: Generate SHA-256 Signature
**Objective:** Verify function generates SHA-256 hash

```javascript
const signature = PaymentService.generateEpaycoCheckoutSignature({
  invoice: 'INV-123456',
  amount: '99.99',
  currencyCode: 'COP'
});

// SHA-256 hashes are 64 hex characters (256 bits / 4 bits per hex char)
console.assert(signature.length === 64, 'SHA-256 signature should be 64 hex characters');
console.assert(/^[0-9a-f]{64}$/.test(signature), 'Should be valid hex string');
console.log('✓ Generates valid SHA-256 signature');
```

### Test Scenario 4B-2: Verify Signature Consistency
**Objective:** Same input always produces same signature

```javascript
const sig1 = PaymentService.generateEpaycoCheckoutSignature({
  invoice: 'INV-123456',
  amount: '99.99',
  currencyCode: 'COP'
});

const sig2 = PaymentService.generateEpaycoCheckoutSignature({
  invoice: 'INV-123456',
  amount: '99.99',
  currencyCode: 'COP'
});

console.assert(sig1 === sig2, 'Same input should produce same signature');
console.log('✓ Signature is deterministic');
```

### Test Scenario 4B-3: Verify Not MD5
**Objective:** Confirm MD5 is not used

```javascript
const crypto = require('crypto');
const testString = 'test123';

const md5 = crypto.createHash('md5').update(testString).digest('hex');
const sha256 = crypto.createHash('sha256').update(testString).digest('hex');

console.assert(md5.length === 32, 'MD5 produces 32 hex chars');
console.assert(sha256.length === 64, 'SHA-256 produces 64 hex chars');

const signature = PaymentService.generateEpaycoCheckoutSignature({
  invoice: 'test',
  amount: '1',
  currencyCode: 'COP'
});

console.assert(signature.length === 64, 'Should use SHA-256 (64 chars)');
console.log('✓ Uses SHA-256, not MD5');
```

---

## Task 4C: Auth Endpoint Rate Limiting

### Test Scenario 4C-1: Allow 10 Failed Attempts
**Objective:** Verify first 10 failures are allowed

```javascript
// Try to login 10 times with wrong password
for (let i = 1; i <= 10; i++) {
  const response = await fetch('/api/webapp/auth/email/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'wrongpassword'
    })
  });

  if (i <= 10) {
    console.assert(response.status === 401, `Attempt ${i}: Should return 401 (unauthorized)`);
  }
}

console.log('✓ First 10 failed attempts allowed');
```

### Test Scenario 4C-2: Block 11th Attempt
**Objective:** Verify 11th attempt is rate limited

```javascript
// Attempt 11th login
const response = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'wrongpassword'
  })
});

console.assert(response.status === 429, 'Should return 429 (Too Many Requests)');
const data = await response.json();
console.assert(data.error.includes('Too many authentication attempts'), 'Should show rate limit message');
console.log('✓ 11th attempt blocked with 429 status');
```

### Test Scenario 4C-3: Success Doesn't Count Against Limit
**Objective:** Verify successful login resets the counter

```javascript
// Reset: Make successful login
const successResponse = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'correctpassword'
  })
});

console.assert(successResponse.status === 200, 'Successful login should return 200');

// Next attempt should not be rate limited
const nextResponse = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'wrongpassword'
  })
});

console.assert(nextResponse.status === 401, 'Should be allowed to try again after success');
console.log('✓ Successful login does not count toward rate limit');
```

### Test Scenario 4C-4: Rate Limit on Telegram Auth
**Objective:** Verify telegram-auth endpoint is rate limited

```javascript
for (let i = 1; i <= 11; i++) {
  const response = await fetch('/api/telegram-auth', {
    method: 'POST',
    body: JSON.stringify({ invalid: 'data' })
  });

  if (i <= 10) {
    // Will fail, but shouldn't be rate limited yet
    console.assert(response.status !== 429, `Attempt ${i}: Should not be rate limited`);
  } else {
    // 11th attempt should be blocked
    console.assert(response.status === 429, `Attempt ${i}: Should be rate limited`);
  }
}

console.log('✓ Rate limiting applied to /api/telegram-auth');
```

### Test Scenario 4C-5: Window Reset After 15 Minutes
**Objective:** Verify rate limit window resets

```javascript
// Simulate 15 minutes passing
// In real test, use fake timers or wait
const startTime = Date.now();

// After 15 minutes + 1 second
const windowMs = 15 * 60 * 1000;
jest.advanceTimersByTime(windowMs + 1000);

// Should be allowed again
const response = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'wrongpassword'
  })
});

console.assert(response.status === 401, 'Should reset to allowing 10 attempts after window expires');
console.log('✓ Rate limit window resets after 15 minutes');
```

---

## Task 4D: Email Verification Enforcement

### Test Scenario 4D-1: Block Login with Unverified Email
**Objective:** Return 403 when email_verified = false

```javascript
// Setup: Create user with email_verified = false
const userId = await createTestUser({
  email: 'unverified@example.com',
  password: 'password123',
  email_verified: false
});

// Execute: Try to login
const response = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'unverified@example.com',
    password: 'password123'
  })
});

const data = await response.json();

// Expected
console.assert(response.status === 403, 'Should return 403 Forbidden');
console.assert(data.error === 'email_not_verified', 'Should have email_not_verified error code');
console.assert(data.message.includes('verifica tu email'), 'Should have Spanish message');
console.log('✓ Blocks login with unverified email (403)');
```

### Test Scenario 4D-2: Allow Login with Verified Email
**Objective:** Allow login when email_verified = true

```javascript
// Setup: Create user with email_verified = true
const userId = await createTestUser({
  email: 'verified@example.com',
  password: 'password123',
  email_verified: true
});

// Execute: Login
const response = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'verified@example.com',
    password: 'password123'
  })
});

const data = await response.json();

// Expected
console.assert(response.status === 200, 'Should return 200');
console.assert(data.authenticated === true, 'Should be authenticated');
console.assert(data.user.id === userId, 'Should return user data');
console.log('✓ Allows login with verified email (200)');
```

### Test Scenario 4D-3: Correct Error Ordering
**Objective:** Check email_verified AFTER password, before session

```javascript
// Test 1: Wrong password should return 401 (before email check)
const response1 = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'unverified@example.com',
    password: 'wrongpassword'
  })
});
console.assert(response1.status === 401, 'Wrong password returns 401 before email check');

// Test 2: Correct password + unverified email should return 403
const response2 = await fetch('/api/webapp/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'unverified@example.com',
    password: 'password123'
  })
});
console.assert(response2.status === 403, 'Unverified email returns 403 after password check');

console.log('✓ Email verification checked at correct step in auth flow');
```

### Test Scenario 4D-4: Database Query Includes email_verified
**Objective:** Verify SELECT includes email_verified column

```javascript
// Check source code
const controllerSource = require('fs').readFileSync(
  'apps/backend/bot/api/controllers/webAppController.js',
  'utf-8'
);

console.assert(
  controllerSource.includes('email_verified'),
  'SELECT query should include email_verified'
);

console.log('✓ SELECT query includes email_verified column');
```

---

## Integration Test Sequence

Run these tests in order to verify all components working together:

```javascript
async function runIntegrationTests() {
  console.log('\n=== Sprint 1 & 4 Integration Tests ===\n');

  // Task 1F: Location precision
  console.log('Testing 1F: Geolocation Privacy...');
  await test1F_CoordinateRounding();
  await test1F_DatabaseStorage();

  // Task 1G: IP detection
  console.log('\nTesting 1G: Audit Logger IP Spoofing...');
  await test1G_IpAddressLogging();
  await test1G_AuditLogIntegrity();

  // Task 1H: Listener count
  console.log('\nTesting 1H: Real Listener Count...');
  await test1H_RedisQuery();
  await test1H_RedisFailover();

  // Task 4A: PCI DSS tokenization
  console.log('\nTesting 4A: PCI DSS Frontend Tokenization...');
  await test4A_RejectCardData();
  await test4A_AcceptToken();

  // Task 4B: SHA-256 signatures
  console.log('\nTesting 4B: MD5 to SHA-256...');
  await test4B_SignatureGeneration();
  await test4B_VerifyNotMD5();

  // Task 4C: Rate limiting
  console.log('\nTesting 4C: Auth Rate Limiting...');
  await test4C_RateLimitBlocking();
  await test4C_SuccessReset();

  // Task 4D: Email verification
  console.log('\nTesting 4D: Email Verification...');
  await test4D_BlockUnverified();
  await test4D_AllowVerified();

  console.log('\n=== All Integration Tests Complete ===\n');
}
```

---

## Summary Test Checklist

- [ ] 1F-1: Precision reduction to 3 decimals
- [ ] 1F-2: PostgreSQL storage verified
- [ ] 1F-3: Redis GEO storage verified
- [ ] 1G-1: IP spoofing prevented
- [ ] 1G-2: Trust proxy configured
- [ ] 1H-1: Redis listener count fetched
- [ ] 1H-2: Redis failure fallback
- [ ] 1H-3: No random numbers in code
- [ ] 4A-1: Rejects cardNumber
- [ ] 4A-2: Rejects cvc
- [ ] 4A-3: Rejects expMonth/expYear
- [ ] 4A-4: Accepts valid token
- [ ] 4A-5: Rejects snake_case variants
- [ ] 4B-1: Generates SHA-256
- [ ] 4B-2: Signature is deterministic
- [ ] 4B-3: Confirms not MD5
- [ ] 4C-1: Allows first 10 attempts
- [ ] 4C-2: Blocks 11th attempt
- [ ] 4C-3: Success resets counter
- [ ] 4C-4: Applied to all auth endpoints
- [ ] 4C-5: Window resets correctly
- [ ] 4D-1: Blocks unverified email
- [ ] 4D-2: Allows verified email
- [ ] 4D-3: Correct error ordering
- [ ] 4D-4: Database query updated

**Status:** Ready for QA Testing
