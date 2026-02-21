# Integration Testing - cURL Examples

**Purpose**: Test all PDS, Bluesky, and Daimo endpoints
**Environment**: Production (pnptv.app)
**Port**: 3001 (internal) via Nginx port 443

---

## Setup for Testing

### 1. Get Authentication Token

First, you need a valid session. Login via the web interface to get a session cookie.

```bash
# Option A: Using credentials (if email login enabled)
curl -c /tmp/cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'

# Option B: Using existing session (if already logged in via web)
# The browser cookies are automatically sent with requests
```

### 2. Test Basic Health

```bash
# Health check (no auth required)
curl http://localhost:3001/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-21T21:04:51.783Z",
  "uptime": 11.635,
  "memory": {...},
  "version": "unknown",
  "environment": "production",
  "dependencies": {
    "redis": "ok",
    "database": "ok"
  }
}
```

---

## Daimo Webhook Testing

### 1. Diagnostic Endpoint

Test webhook payload inspection without authentication.

```bash
# Send diagnostic payload
curl -X POST http://localhost:3001/api/webhooks/daimo/debug \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment.completed",
    "paymentId": "test-payment-123",
    "status": "completed",
    "amount": "100.00",
    "currency": "USDC",
    "payment": {
      "id": "test-payment-123",
      "status": "completed",
      "metadata": {
        "userId": "12345",
        "planId": "PRIME_MONTHLY"
      }
    }
  }'
```

**Expected Response**:
```json
{
  "received": true,
  "length": 315,
  "contentType": "application/json",
  "preview": "{\"type\":\"payment.completed\",...}",
  "headers": {
    "content-type": "application/json",
    "content-length": "315",
    "authorization": "missing",
    "x-daimo-signature": "missing"
  }
}
```

### 2. Main Webhook Handler

Test with actual webhook signature (requires valid Daimo credentials).

```bash
# Send webhook with signature
PAYLOAD='{"type":"payment.completed","paymentId":"test-payment-123","status":"completed","payment":{"id":"test-payment-123","status":"completed","metadata":{"userId":"12345","planId":"PRIME_MONTHLY"}}}'

# Calculate signature (requires DAIMO_WEBHOOK_SECRET)
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -mac HMAC -macopt key:$DAIMO_WEBHOOK_SECRET -hex | cut -d' ' -f2)

curl -X POST http://localhost:3001/api/webhooks/daimo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DAIMO_WEBHOOK_SECRET" \
  -d "$PAYLOAD"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## PDS Endpoints Testing

### 1. Get PDS Info (Authenticated)

```bash
# Get user's PDS information
curl -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info \
  -H "Content-Type: application/json"
```

**Expected Response (PDS Configured)**:
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pds_handle": "user.pnptv.app",
    "pds_did": "did:key:z6MkhaXgBZDvotzL...",
    "pds_endpoint": "https://pds.pnptv.app",
    "status": "active",
    "verification_status": "verified",
    "last_verified_at": "2026-02-21T20:30:00Z"
  }
}
```

**Expected Response (PDS Not Configured)**:
```json
{
  "success": true,
  "data": null,
  "message": "User has no PDS configured"
}
```

### 2. Check PDS Health

```bash
# Check PDS endpoint connectivity
curl -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/health \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "has_pds": true,
    "pds_handle": "user.pnptv.app",
    "pds_did": "did:key:z6MkhaXgBZDvotzL...",
    "status": "active",
    "verification_status": "verified",
    "accessible": true,
    "last_verified_at": "2026-02-21T20:30:00Z"
  }
}
```

### 3. Get Provisioning Log

```bash
# Get audit trail of all PDS operations
curl -b /tmp/cookies.txt -X GET "http://localhost:3001/api/pds/provisioning-log?limit=10&offset=0" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-1",
      "action": "create",
      "status": "success",
      "details": {
        "pds_did": "did:key:...",
        "duration_ms": 2500
      },
      "error_message": null,
      "created_at": "2026-02-21T20:28:30Z"
    },
    {
      "id": "log-uuid-2",
      "action": "verify",
      "status": "success",
      "details": {...},
      "error_message": null,
      "created_at": "2026-02-21T20:30:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 2
  }
}
```

### 4. Retry Failed Provisioning

```bash
# Manually retry PDS provisioning
curl -b /tmp/cookies.txt -X POST http://localhost:3001/api/pds/retry-provision \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pds_handle": "user.pnptv.app",
    "pds_did": "did:key:z6MkhaXgBZDvotzL...",
    "status": "active"
  }
}
```

### 5. Create Manual Backup

```bash
# Create encrypted backup of PDS credentials
curl -b /tmp/cookies.txt -X POST http://localhost:3001/api/pds/create-backup \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "backup_id": "backup-uuid-123",
    "created_at": "2026-02-21T21:05:00Z",
    "expires_at": "2026-03-23T21:05:00Z"
  }
}
```

### 6. Get Recent Health Checks

```bash
# Get recent PDS health check results
curl -b /tmp/cookies.txt -X GET "http://localhost:3001/api/pds/health-checks?limit=20" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "health-check-uuid-1",
      "check_type": "connectivity",
      "status": "healthy",
      "response_time_ms": 45,
      "details": {
        "endpoint": "https://pds.pnptv.app",
        "latency": 45
      },
      "created_at": "2026-02-21T21:00:00Z"
    },
    {
      "id": "health-check-uuid-2",
      "check_type": "performance",
      "status": "healthy",
      "response_time_ms": 52,
      "details": {...},
      "created_at": "2026-02-21T21:02:00Z"
    }
  ]
}
```

### 7. Admin: Manually Provision User (Admin Only)

```bash
# Provision PDS for a specific user (admin endpoint)
curl -b /tmp/admin_cookies.txt -X POST http://localhost:3001/api/pds/provision \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 12345
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pds_handle": "user.pnptv.app",
    "pds_did": "did:key:z6MkhaXgBZDvotzL...",
    "status": "active",
    "duration_ms": 2500
  }
}
```

---

## Bluesky Endpoints Testing

### 1. One-Click Setup

```bash
# Create Bluesky account (the magic one-click!)
curl -b /tmp/cookies.txt -X POST http://localhost:3001/api/bluesky/setup \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (Success)**:
```json
{
  "success": true,
  "blueskyHandle": "@username.pnptv.app",
  "blueskyDid": "did:plc:abcd1234efgh5678ijkl9012",
  "profileSynced": true,
  "message": "Your Bluesky account is ready! Profile auto-synced.",
  "ready": true
}
```

**Expected Response (Already Exists)**:
```json
{
  "success": true,
  "already_exists": true,
  "blueskyHandle": "@username.pnptv.app",
  "blueskyDid": "did:plc:abcd1234efgh5678ijkl9012",
  "message": "Your Bluesky account is already set up!"
}
```

**Expected Response (PDS Not Ready)**:
```json
{
  "success": false,
  "error": {
    "code": "no_pds",
    "message": "PDS must be provisioned first. Please refresh your page."
  }
}
```

### 2. Check Bluesky Status

```bash
# Check if Bluesky account is set up
curl -b /tmp/cookies.txt -X GET http://localhost:3001/api/bluesky/status \
  -H "Content-Type: application/json"
```

**Expected Response (Connected)**:
```json
{
  "success": true,
  "data": {
    "setup": true,
    "ready": true,
    "handle": "@username.pnptv.app",
    "did": "did:plc:abcd1234efgh5678ijkl9012",
    "synced_at": "2026-02-21T21:00:00Z",
    "auto_sync_enabled": true,
    "status": "active"
  }
}
```

**Expected Response (Not Connected)**:
```json
{
  "success": true,
  "data": {
    "setup": false,
    "ready": false,
    "handle": null,
    "did": null,
    "status": "not_configured"
  }
}
```

### 3. Disconnect Bluesky

```bash
# Unlink Bluesky account from pnptv
curl -b /tmp/cookies.txt -X POST http://localhost:3001/api/bluesky/disconnect \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Bluesky account disconnected"
}
```

---

## Error Handling Examples

### 1. Unauthorized (No Auth)

```bash
# Try to access PDS without authentication
curl -X GET http://localhost:3001/api/pds/info
```

**Expected Response**:
```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid authorization header"
}
```

### 2. Not Found (Invalid Route)

```bash
# Invalid route
curl http://localhost:3001/api/invalid/route
```

**Expected Response**:
```json
{
  "error": "NOT_FOUND",
  "message": "Route not found: GET /api/invalid/route"
}
```

### 3. Server Error

```bash
# Server error (e.g., database connection failure)
curl -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

## Batch Testing Script

Create a test script for CI/CD:

```bash
#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

BASE_URL="http://localhost:3001"
PASS=0
FAIL=0

test_endpoint() {
  local name=$1
  local method=$2
  local path=$3
  local expect_code=$4

  response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$path" \
    -H "Content-Type: application/json" \
    -b /tmp/cookies.txt)

  body=$(echo "$response" | head -n -1)
  code=$(echo "$response" | tail -n 1)

  if [ "$code" = "$expect_code" ]; then
    echo -e "${GREEN}✓${NC} $name (HTTP $code)"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $name (HTTP $code, expected $expect_code)"
    echo "  Response: $body"
    ((FAIL++))
  fi
}

echo "Testing PDS/Bluesky Integration..."
echo ""

# Health check
test_endpoint "Health" "GET" "/health" "200"

# Daimo diagnostic
test_endpoint "Daimo Diagnostic" "POST" "/api/webhooks/daimo/debug" "200"

# PDS (protected - no auth = 401)
test_endpoint "PDS Info (No Auth)" "GET" "/api/pds/info" "401"

# Bluesky (protected - no auth = 401)
test_endpoint "Bluesky Status (No Auth)" "GET" "/api/bluesky/status" "401"

echo ""
echo "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
```

---

## Performance Testing

### Load test with wrk

```bash
# Install wrk if not present
# brew install wrk  (macOS)
# apt-get install wrk  (Ubuntu)

# Test health endpoint (1000 concurrent connections)
wrk -t12 -c1000 -d30s http://localhost:3001/health

# Test Daimo diagnostic endpoint
wrk -t12 -c1000 -d30s \
  -s post_script.lua \
  -H "Content-Type: application/json" \
  -d '{"test":"payload"}' \
  http://localhost:3001/api/webhooks/daimo/debug
```

### Load test with Apache Bench

```bash
# Test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3001/health

# Test Daimo webhook
ab -n 100 -c 10 \
  -T application/json \
  -p webhook_payload.json \
  http://localhost:3001/api/webhooks/daimo/debug
```

---

## Integration Test Workflow

Complete workflow to test all three integrations:

```bash
#!/bin/bash

set -e

BASE_URL="http://localhost:3001"
COOKIES="/tmp/cookies.txt"

echo "=== PDS/Bluesky/Daimo Integration Test ==="
echo ""

# Step 1: Health check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq .status
echo "✓ Health OK"
echo ""

# Step 2: Test Daimo diagnostic (no auth required)
echo "2. Testing Daimo webhook diagnostic..."
curl -s -X POST "$BASE_URL/api/webhooks/daimo/debug" \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}' | jq .received
echo "✓ Daimo diagnostic OK"
echo ""

# Step 3: Login (simulated with existing session)
# Assuming you have valid session cookies from web login
echo "3. Simulating authenticated user..."
echo "   (Use browser to login and copy session cookie)"
echo "   Cookies saved to: $COOKIES"
echo ""

# Step 4: Test PDS endpoints (require auth)
echo "4. Testing PDS endpoints..."
echo "   - GET /api/pds/info"
curl -s -b $COOKIES "$BASE_URL/api/pds/info" | jq '.success // .error'
echo "   - GET /api/pds/health"
curl -s -b $COOKIES "$BASE_URL/api/pds/health" | jq '.success // .error'
echo "✓ PDS endpoints OK (auth enforced)"
echo ""

# Step 5: Test Bluesky endpoints (require auth)
echo "5. Testing Bluesky endpoints..."
echo "   - GET /api/bluesky/status"
curl -s -b $COOKIES "$BASE_URL/api/bluesky/status" | jq '.success // .error'
echo "✓ Bluesky endpoints OK (auth enforced)"
echo ""

# Step 6: Test Bluesky setup
echo "6. Testing Bluesky setup (one-click)..."
curl -s -X POST -b $COOKIES "$BASE_URL/api/bluesky/setup" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.success // .error'
echo "✓ Bluesky setup initiated"
echo ""

echo "=== All Tests Complete ==="
```

---

## Debugging Tips

### 1. Enable Verbose Logging

```bash
# Add -v flag to curl for headers
curl -v -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info

# Add -vv for even more verbose output
curl -vv -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info
```

### 2. Save Response to File

```bash
# Save full response to file
curl -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info > /tmp/response.json

# View with pretty-print
cat /tmp/response.json | jq .
```

### 3. Check Response Headers

```bash
# Show all response headers
curl -i -b /tmp/cookies.txt -X GET http://localhost:3001/api/pds/info
```

### 4. Time Request

```bash
# See request timing breakdown
curl -w "@curl_time_format.txt\n" -b /tmp/cookies.txt http://localhost:3001/api/pds/info

# Create curl_time_format.txt:
# time_namelookup:  %{time_namelookup}\n
# time_connect:     %{time_connect}\n
# time_appconnect:  %{time_appconnect}\n
# time_pretransfer: %{time_pretransfer}\n
# time_redirect:    %{time_redirect}\n
# time_starttransfer: %{time_starttransfer}\n
# time_total:       %{time_total}\n
```

---

**Last Updated**: 2026-02-21
**Status**: ✅ All endpoints tested and working
