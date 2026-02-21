# One-Click Bluesky Setup - CURL Test Examples

Quick reference for testing the Bluesky API endpoints.

## Setup

### Prerequisites
- Application running on localhost:3001
- User logged in (have session cookie)

### Get Session Cookie
```bash
# After login, grab the session cookie from your browser
# Or use authentication endpoint to get a session

# Save it as an environment variable
export SESSION_COOKIE="pnptv_session=your_session_id_here"
```

### Environment Variables
```bash
# API base URL
export API_URL="http://localhost:3001"

# Or for production
export API_URL="https://pnptv.app"

# Session cookie (from browser or auth)
export SESSION_COOKIE="pnptv_session=your_session_id"

# User ID for testing (optional)
export USER_ID="your-user-id"
```

---

## Test 1: Check Bluesky Status (No Account Yet)

Test that the status endpoint works and shows no account.

```bash
curl -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}"
```

**Expected Response** (no Bluesky account):
```json
{
  "success": true,
  "data": {
    "setup": false,
    "ready": false
  }
}
```

**Expected Response** (with Bluesky account):
```json
{
  "success": true,
  "data": {
    "setup": true,
    "ready": true,
    "handle": "@alice.pnptv.app",
    "did": "did:key:z...",
    "synced_at": "2026-02-21T15:30:00Z",
    "auto_sync_enabled": true,
    "status": "active"
  }
}
```

---

## Test 2: Create Bluesky Account (One-Click!)

This is the magic endpoint - creates account in ~5 seconds.

```bash
curl -X POST "${API_URL}/api/bluesky/setup" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}'
```

**Expected Response** (success):
```json
{
  "success": true,
  "blueskyHandle": "@alice.pnptv.app",
  "blueskyDid": "did:key:z...",
  "profileSynced": true,
  "message": "Welcome to Bluesky! Your account is ready.",
  "ready": true
}
```

**Expected Response** (already exists):
```json
{
  "success": true,
  "already_exists": true,
  "blueskyHandle": "@alice.pnptv.app",
  "blueskyDid": "did:key:z...",
  "message": "Your Bluesky account is already set up!"
}
```

**Error Responses**:

No PDS provisioned:
```json
{
  "success": false,
  "error": {
    "code": "no_pds",
    "message": "PDS must be provisioned first. Please refresh your page."
  }
}
```

Handle taken:
```json
{
  "success": false,
  "error": {
    "code": "setup_failed",
    "message": "Handle @alice.pnptv.app is already taken. Try a different username in settings."
  }
}
```

Not authenticated:
```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Please login first"
  }
}
```

---

## Test 3: Verify Setup Worked

After creating account, check status again.

```bash
curl -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "setup": true,
    "ready": true,
    "handle": "@alice.pnptv.app",
    "did": "did:key:z...",
    "synced_at": "2026-02-21T15:30:05Z",
    "auto_sync_enabled": true,
    "status": "active"
  }
}
```

---

## Test 4: Disconnect Bluesky Account

Remove the Bluesky link (account stays on Bluesky).

```bash
curl -X POST "${API_URL}/api/bluesky/disconnect" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}'
```

**Expected Response** (success):
```json
{
  "success": true,
  "message": "Bluesky account disconnected"
}
```

**Error Response** (no account linked):
```json
{
  "success": false,
  "error": {
    "code": "no_bluesky_account",
    "message": "No Bluesky account linked"
  }
}
```

---

## Test 5: Full Setup Flow (Automated)

Complete test of the setup flow.

```bash
#!/bin/bash

echo "=== Bluesky Setup Flow Test ==="
echo ""

# Step 1: Check initial status
echo "Step 1: Check initial status..."
curl -s -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" | jq '.'
echo ""

# Step 2: Create account
echo "Step 2: Create Bluesky account..."
curl -s -X POST "${API_URL}/api/bluesky/setup" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}' | jq '.'
echo ""

# Wait a moment
sleep 2

# Step 3: Verify setup
echo "Step 3: Verify setup..."
curl -s -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" | jq '.'
echo ""

# Step 4: Disconnect
echo "Step 4: Disconnect account..."
curl -s -X POST "${API_URL}/api/bluesky/disconnect" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}' | jq '.'
echo ""

# Step 5: Verify disconnected
echo "Step 5: Verify disconnected..."
curl -s -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" | jq '.'
echo ""

echo "=== Test Complete ==="
```

Save as `test-bluesky-flow.sh` and run:
```bash
chmod +x test-bluesky-flow.sh
./test-bluesky-flow.sh
```

---

## Test 6: Error Scenarios

### Not Authenticated
```bash
curl -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Please login first"
  }
}
```

### Invalid Session
```bash
curl -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "pnptv_session=invalid"
```

Response: 401 Unauthorized or similar

### Server Error
If Bluesky API is unavailable:
```bash
curl -X POST "${API_URL}/api/bluesky/setup" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}'
```

Response:
```json
{
  "success": false,
  "error": {
    "code": "internal_error",
    "message": "Failed to create Bluesky account"
  }
}
```

---

## Test 7: Database Verification

Verify data in database after operations.

```bash
# Check user has Bluesky account
psql -U postgres -d pnptv_db -c "
SELECT user_id, bluesky_handle, bluesky_status, bluesky_synced_at
FROM user_pds_mapping
WHERE bluesky_handle IS NOT NULL
LIMIT 5;
"

# Check sync operations
psql -U postgres -d pnptv_db -c "
SELECT user_id, sync_type, status, created_at
FROM bluesky_profile_syncs
ORDER BY created_at DESC
LIMIT 10;
"

# Check errors (if any)
psql -U postgres -d pnptv_db -c "
SELECT user_id, bluesky_status, bluesky_last_error
FROM user_pds_mapping
WHERE bluesky_status = 'error';
"
```

---

## Test 8: Concurrent Setup (Load Test)

Test multiple users setting up simultaneously.

```bash
#!/bin/bash

# Setup multiple users in parallel
for i in {1..5}; do
  (
    echo "User $i: Starting setup..."

    # Get session for user $i
    SESSION=$(curl -s -X POST "${API_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\": \"user$i\", \"password\": \"pass$i\"}" \
      -c - | grep "pnptv_session" | awk '{print $7}')

    # Setup Bluesky
    curl -s -X POST "${API_URL}/api/bluesky/setup" \
      -H "Content-Type: application/json" \
      -b "pnptv_session=$SESSION" \
      -d '{}' | jq '.success'

    echo "User $i: Complete"
  ) &
done

wait
echo "All users complete"
```

---

## Test 9: Performance Monitoring

Measure performance of endpoints.

```bash
#!/bin/bash

echo "=== Bluesky API Performance Test ==="
echo ""

# Test 1: Status endpoint (GET)
echo "Status endpoint (GET):"
time curl -s -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" > /dev/null
echo ""

# Test 2: Setup endpoint (POST)
echo "Setup endpoint (POST):"
time curl -s -X POST "${API_URL}/api/bluesky/setup" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}' > /dev/null
echo ""

# Test 3: Disconnect endpoint (POST)
echo "Disconnect endpoint (POST):"
time curl -s -X POST "${API_URL}/api/bluesky/disconnect" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}" \
  -d '{}' > /dev/null
echo ""

echo "=== Performance Test Complete ==="
```

---

## Test 10: Response Headers

Check response headers for proper configuration.

```bash
# Check response headers
curl -I -X GET "${API_URL}/api/bluesky/status" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}"
```

Expected headers:
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 123
Cache-Control: no-cache
Set-Cookie: pnptv_session=...; HttpOnly; Secure
```

---

## Useful Bash Functions

Add these to your `.bashrc` for easy testing:

```bash
# Setup Bluesky account
bluesky_setup() {
  curl -s -X POST "${API_URL:-http://localhost:3001}/api/bluesky/setup" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}" \
    -d '{}' | jq '.'
}

# Check Bluesky status
bluesky_status() {
  curl -s -X GET "${API_URL:-http://localhost:3001}/api/bluesky/status" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}" | jq '.data'
}

# Disconnect Bluesky
bluesky_disconnect() {
  curl -s -X POST "${API_URL:-http://localhost:3001}/api/bluesky/disconnect" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}" \
    -d '{}' | jq '.'
}

# Run setup flow test
bluesky_test_flow() {
  echo "=== Setup ===" && bluesky_setup && \
  echo -e "\n=== Status ===" && bluesky_status && \
  echo -e "\n=== Disconnect ===" && bluesky_disconnect
}
```

Usage:
```bash
bluesky_setup        # Create account
bluesky_status       # Check status
bluesky_disconnect   # Disconnect
bluesky_test_flow    # Run full test
```

---

## Common Issues & Solutions

### "401 Unauthorized"
```
Cause: Invalid or missing session cookie
Solution: Make sure to login first and include -b flag with session
```

### "Connection refused"
```
Cause: Application not running
Solution: Start with pm2 restart pnptv-bot
```

### "no_pds" error
```
Cause: User has no PDS provisioned
Solution: PDS is created on login, try refreshing page
```

### Slow responses
```
Cause: Database or PDS connection slow
Solution: Check logs: pm2 logs pnptv-bot | grep Bluesky
```

### Empty response
```
Cause: API returned no content
Solution: Check status code with curl -i
```

---

## Tips & Tricks

### Pretty Print JSON
```bash
# Add | jq '.' to any curl command
curl -s ... | jq '.'

# Pretty print with color
curl -s ... | jq -C '.'
```

### Save Response to File
```bash
curl -s ... > response.json
cat response.json | jq '.'
```

### Extract Specific Field
```bash
curl -s ... | jq '.data.handle'
curl -s ... | jq '.error.message'
```

### Loop Until Success
```bash
for i in {1..10}; do
  RESULT=$(curl -s ... | jq '.success')
  [ "$RESULT" = "true" ] && break
  echo "Attempt $i failed, retrying..."
  sleep 1
done
```

### Debug Request/Response
```bash
# Show request headers and response
curl -v ... 2>&1 | grep -E "^>|^<|^{|^\\["

# Show verbose output
curl -v ...
```

---

## Testing Checklist

Before deployment, test:

- [ ] Status endpoint returns proper format
- [ ] Setup endpoint creates account in <5 seconds
- [ ] Setup endpoint shows error if handle taken
- [ ] Status endpoint shows account after setup
- [ ] Disconnect removes Bluesky link
- [ ] Setup works again after disconnect
- [ ] Responses have proper HTTP status codes
- [ ] Error responses include error details
- [ ] Concurrent requests work correctly
- [ ] Performance is <500ms per request
- [ ] Database records are created
- [ ] Logs show [Bluesky] messages

---

## More Information

See:
- **BLUESKY_ADMIN_GUIDE.md** - Full API documentation
- **BLUESKY_SIMPLE_SETUP.md** - User guide
- **BLUESKY_ONECLICK_IMPLEMENTATION.md** - Implementation details

---

**Happy Testing! 🦋**
