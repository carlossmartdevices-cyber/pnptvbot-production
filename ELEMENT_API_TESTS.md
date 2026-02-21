# Element API Test Examples

Quick reference for testing Element endpoints. These examples assume:
- Session authenticated with valid user (cookies.txt)
- API running at https://pnptv.app
- Element homeserver at http://127.0.0.1:8008

## Prerequisites

### 1. Get Valid Session

First, authenticate with Telegram OAuth to get a session cookie:

```bash
# Login with Telegram (replace with real Telegram OAuth data)
curl -X POST https://pnptv.app/api/telegram-auth \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123456789",
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "photo_url": "https://example.com/photo.jpg",
    "auth_date": 1708540800,
    "hash": "ABCD1234567890EFGHIJ"
  }' \
  -c cookies.txt -b cookies.txt

# Verify session works
curl https://pnptv.app/health \
  -b cookies.txt
```

### 2. Verify PDS is Set Up

```bash
# Check PDS status (should return setup: true after login)
curl https://pnptv.app/api/pds/status \
  -H "Content-Type: application/json" \
  -b cookies.txt | jq .
```

### 3. Verify Bluesky is Set Up

```bash
# Check Bluesky status (should return setup: true)
curl https://pnptv.app/api/bluesky/status \
  -H "Content-Type: application/json" \
  -b cookies.txt | jq .
```

---

## Element API Tests

### Test 1: Get Element Status

**Endpoint:** `GET /api/element/status`

**Purpose:** Check if Element account is provisioned and active

**Command:**
```bash
curl https://pnptv.app/api/element/status \
  -H "Content-Type: application/json" \
  -b cookies.txt | jq .
```

**Expected Response (Not Set Up):**
```json
{
  "success": true,
  "data": {
    "setup": false,
    "ready": false,
    "message": "Element account not provisioned"
  }
}
```

**Expected Response (Set Up):**
```json
{
  "success": true,
  "data": {
    "setup": true,
    "ready": true,
    "matrixUserId": "@user123_abc456:element.pnptv.app",
    "matrixUsername": "user123_abc456",
    "displayName": "johndoe",
    "verified": true,
    "verifiedAt": "2026-02-21T14:30:00.000Z",
    "lastSynced": "2026-02-21T14:30:05.000Z",
    "createdAt": "2026-02-21T14:30:00.000Z",
    "accessTokenValid": true,
    "tokenExpiresAt": null
  }
}
```

---

### Test 2: Setup Element Account

**Endpoint:** `POST /api/element/setup`

**Purpose:** Create Element account (auto-called after Bluesky, can be called manually)

**Command:**
```bash
curl -X POST https://pnptv.app/api/element/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

**Expected Response (New Account):**
```json
{
  "success": true,
  "matrixUserId": "@user123_abc456:element.pnptv.app",
  "matrixUsername": "user123_abc456",
  "displayName": "johndoe",
  "message": "Element account created successfully",
  "ready": true
}
```

**Expected Response (Already Exists):**
```json
{
  "success": true,
  "already_exists": true,
  "matrixUserId": "@user123_abc456:element.pnptv.app",
  "message": "Your Element account is already set up!"
}
```

**Expected Response (PDS Required):**
```json
{
  "success": false,
  "error": {
    "code": "no_pds",
    "message": "PDS must be provisioned first"
  }
}
```

---

### Test 3: Sync Element Profile

**Endpoint:** `PUT /api/element/sync-profile`

**Purpose:** Update display name and/or avatar on Element

**Command:**
```bash
curl -X PUT https://pnptv.app/api/element/sync-profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "displayName": "John Doe",
    "avatar_url": "/public/uploads/avatars/user123-avatar.webp"
  }'
```

**Minimal Command (Display Name Only):**
```bash
curl -X PUT https://pnptv.app/api/element/sync-profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "displayName": "New Display Name"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Element profile synced successfully"
}
```

**Expected Response (Not Set Up):**
```json
{
  "success": false,
  "error": {
    "code": "no_element_account",
    "message": "Element account not provisioned"
  }
}
```

---

### Test 4: Disconnect Element Account

**Endpoint:** `POST /api/element/disconnect`

**Purpose:** Remove Element link and logout all sessions

**Command:**
```bash
curl -X POST https://pnptv.app/api/element/disconnect \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Element account disconnected"
}
```

**Verification (Check Status After Disconnect):**
```bash
# Should return setup: false after disconnect
curl https://pnptv.app/api/element/status \
  -H "Content-Type: application/json" \
  -b cookies.txt | jq .data.setup
# Output: false
```

---

## Full Integration Test Flow

Test the complete flow from login through Element provisioning:

```bash
#!/bin/bash

echo "=== Element Integration Flow Test ==="

# 1. Login (requires valid Telegram OAuth data)
echo "1. Logging in..."
curl -X POST https://pnptv.app/api/telegram-auth \
  -H "Content-Type: application/json" \
  -d '{...}' \
  -c cookies.txt -b cookies.txt

# 2. Check PDS
echo "2. Checking PDS..."
curl https://pnptv.app/api/pds/status \
  -b cookies.txt | jq .data.setup

# 3. Check Bluesky
echo "3. Checking Bluesky..."
curl https://pnptv.app/api/bluesky/status \
  -b cookies.txt | jq .data.setup

# 4. Wait for async Element setup (should happen automatically)
echo "4. Waiting 5 seconds for Element auto-setup..."
sleep 5

# 5. Check Element
echo "5. Checking Element..."
curl https://pnptv.app/api/element/status \
  -b cookies.txt | jq '.data | {setup, ready, matrixUserId}'

# 6. Sync profile
echo "6. Syncing Element profile..."
curl -X PUT https://pnptv.app/api/element/sync-profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"displayName": "Full Name"}'

# 7. Final status check
echo "7. Final status check..."
curl https://pnptv.app/api/element/status \
  -b cookies.txt | jq '.data'

echo "=== Test Complete ==="
```

---

## Error Scenarios

### Error 1: Unauthorized (No Session)

**Cause:** Missing or invalid session

**Command:**
```bash
curl https://pnptv.app/api/element/status
# (no -b cookies.txt)
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Please login first"
  }
}
```

**Fix:** Authenticate first with Telegram OAuth

---

### Error 2: PDS Not Provisioned

**Cause:** User hasn't completed PDS setup yet

**Command:**
```bash
curl -X POST https://pnptv.app/api/element/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "no_pds",
    "message": "PDS must be provisioned first"
  }
}
```

**Fix:** Wait for PDS provisioning to complete (should be automatic on login)

---

### Error 3: Element Homeserver Down

**Cause:** Matrix homeserver not responding

**Command:**
```bash
curl -X POST https://pnptv.app/api/element/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "setup_failed",
    "message": "Failed to create Element account",
    "details": {
      "error": "connect ECONNREFUSED 127.0.0.1:8008"
    }
  }
}
```

**Fix:**
```bash
# Check Element container is running
docker ps | grep element

# Check health
curl http://127.0.0.1:32772/
```

---

## Response Status Codes

| Status Code | Meaning | Example |
|------------|---------|---------|
| 200 | Success | Account created, status retrieved |
| 400 | Bad Request | Missing PDS, invalid input |
| 401 | Unauthorized | Session expired or missing |
| 404 | Not Found | User not found |
| 500 | Server Error | Element homeserver down, decrypt error |

---

## Performance Notes

| Operation | Expected Time |
|-----------|----------------|
| Get status | < 100ms |
| Create account | 3-5 seconds |
| Sync profile | 1-2 seconds |
| Disconnect | < 500ms |

---

## Debugging

### Check Application Logs

```bash
# Watch Element-related logs
pm2 logs pnptv-bot | grep -i element

# Follow in real-time
pm2 logs pnptv-bot --lines 50 --follow | grep -i element
```

### Check Element Homeserver Health

```bash
# Get Element health
curl http://127.0.0.1:32772/

# Check server info
curl http://127.0.0.1:8008/_matrix/client/r0/sync \
  -H "Authorization: Bearer invalid_token" | jq .

# List users (admin only)
curl http://127.0.0.1:8008/_synapse/admin/v2/users \
  -H "Authorization: Bearer $ELEMENT_ADMIN_TOKEN" | jq .
```

### Check Database

```bash
# Connect to PostgreSQL
psql -U pnptvbot -d pnptv_db

# Query Element profiles
SELECT pnptv_user_id, external_user_id, service_type, verified_at
FROM external_profiles
WHERE service_type = 'element'
ORDER BY created_at DESC;

# Count by user
SELECT pnptv_user_id, COUNT(*) as account_count
FROM external_profiles
GROUP BY pnptv_user_id;
```

---

## Monitoring

### Status Dashboard

Create a monitoring script:

```bash
#!/bin/bash

while true; do
  clear
  echo "=== Element Integration Status ==="
  echo ""

  # Check containers
  docker ps | grep -E "element|pds" | awk '{print $NF, $7}'

  echo ""
  echo "=== PDS Health ==="
  PDS_PORT=$(docker ps | grep pds | grep -oP '\d+(?=->3000)' | head -1)
  curl -s http://127.0.0.1:$PDS_PORT/xrpc/_health | jq .

  echo ""
  echo "=== Element Health ==="
  ELEM_PORT=$(docker ps | grep element | grep -oP '\d+(?=->80)' | head -1)
  curl -s http://127.0.0.1:$ELEM_PORT/ | head -5

  echo ""
  echo "=== App Health ==="
  curl -s https://pnptv.app/health | jq .

  echo ""
  echo "Last updated: $(date)"
  echo "Press Ctrl+C to exit"

  sleep 30
done
```

---

## Curl Session Tips

### Save Session
```bash
# Save cookies to file
curl https://pnptv.app/api/element/status \
  -b cookies.txt -c cookies.txt | jq .
```

### Use Session Variable
```bash
SESSION="session=abc123def456..."
curl https://pnptv.app/api/element/status \
  -H "Cookie: $SESSION" | jq .
```

### Pretty Print Response
```bash
curl https://pnptv.app/api/element/status \
  -b cookies.txt | jq '.'

# With colors
curl https://pnptv.app/api/element/status \
  -b cookies.txt | jq -C '.'
```

### Save to File
```bash
curl https://pnptv.app/api/element/status \
  -b cookies.txt > response.json

cat response.json | jq .
```

---

**Last Updated:** 2026-02-21
**API Version:** Element Integration v1.0
**Status:** Ready for Testing
