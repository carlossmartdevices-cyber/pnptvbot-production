# PDS Provisioning API Examples

Complete curl examples for testing and integrating with the PDS API.

## Prerequisites

```bash
# Start server
npm start

# In another terminal, save session cookies
curl -c cookies.txt http://localhost:3001/api/health
```

All endpoints use `-b cookies.txt` to include session authentication.

---

## User Endpoints

### 1. Get PDS Info

Get the authenticated user's PDS configuration.

```bash
curl -s -b cookies.txt \
  http://localhost:3001/api/pds/info | jq .
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "pds_handle": "@johndoe.pnptv.app",
    "pds_did": "did:web:johndoe-a1b2c3.pnptv.app",
    "pds_endpoint": "http://127.0.0.1:3000",
    "status": "active",
    "verification_status": "accessible",
    "created_at": "2026-02-21T10:30:00.000Z"
  }
}
```

**If no PDS (pending setup):**
```json
{
  "success": true,
  "data": null,
  "message": "User has no PDS configured"
}
```

---

### 2. Check PDS Health

Verify the PDS endpoint is accessible and working.

```bash
curl -s -b cookies.txt \
  http://localhost:3001/api/pds/health | jq .
```

**Response:**
```json
{
  "success": true,
  "data": {
    "has_pds": true,
    "pds_handle": "@johndoe.pnptv.app",
    "pds_did": "did:web:johndoe-a1b2c3.pnptv.app",
    "status": "active",
    "verification_status": "accessible",
    "accessible": true,
    "last_verified_at": "2026-02-21T10:35:00.000Z"
  }
}
```

---

### 3. Retry PDS Provisioning

If PDS provisioning failed, retry it.

```bash
curl -s -X POST -b cookies.txt \
  http://localhost:3001/api/pds/retry-provision | jq .
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "pds_handle": "@johndoe.pnptv.app",
    "pds_did": "did:web:johndoe-a1b2c3.pnptv.app",
    "status": "active"
  }
}
```

**If provisioning failed:**
```json
{
  "success": false,
  "error": "Failed to provision PDS: endpoint unreachable"
}
```

---

### 4. Get Provisioning Log

View history of all PDS provisioning actions.

```bash
# Get last 10 actions
curl -s -b cookies.txt \
  'http://localhost:3001/api/pds/provisioning-log?limit=10&offset=0' | jq .

# Get with pagination
curl -s -b cookies.txt \
  'http://localhost:3001/api/pds/provisioning-log?limit=20&offset=20' | jq .
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "action": "verified",
      "status": "success",
      "details": {
        "accessible": true,
        "response_time_ms": 145
      },
      "error_message": null,
      "created_at": "2026-02-21T10:35:00.000Z"
    },
    {
      "id": 4,
      "action": "created",
      "status": "success",
      "details": {
        "pds_did": "did:web:johndoe-a1b2c3.pnptv.app",
        "pds_handle": "@johndoe.pnptv.app",
        "pds_endpoint": "http://127.0.0.1:3000"
      },
      "error_message": null,
      "created_at": "2026-02-21T10:30:00.000Z"
    },
    {
      "id": 3,
      "action": "error",
      "status": "failed",
      "details": {
        "error": "PDS endpoint unreachable",
        "attempt": 1
      },
      "error_message": "Connection timeout",
      "created_at": "2026-02-21T10:25:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 5
  }
}
```

---

### 5. Create Backup

Create a manual backup of PDS credentials (30-day retention).

```bash
curl -s -X POST -b cookies.txt \
  http://localhost:3001/api/pds/create-backup | jq .
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backup_id": 1,
    "created_at": "2026-02-21T10:40:00.000Z",
    "expires_at": "2026-03-23T10:40:00.000Z"
  }
}
```

---

### 6. Get Health Checks

View recent PDS health check history.

```bash
# Last 10 health checks
curl -s -b cookies.txt \
  'http://localhost:3001/api/pds/health-checks?limit=10' | jq .

# Format for monitoring
curl -s -b cookies.txt \
  'http://localhost:3001/api/pds/health-checks?limit=20' | jq '.data[] | {check_type, status, response_time_ms, created_at}'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "check_type": "connectivity",
      "status": "success",
      "response_time_ms": 145,
      "details": {
        "did": "did:web:johndoe-a1b2c3.pnptv.app"
      },
      "created_at": "2026-02-21T10:35:00.000Z"
    },
    {
      "id": 41,
      "check_type": "connectivity",
      "status": "success",
      "response_time_ms": 152,
      "details": {
        "did": "did:web:johndoe-a1b2c3.pnptv.app"
      },
      "created_at": "2026-02-21T09:35:00.000Z"
    }
  ]
}
```

---

### 7. Verify 2FA for Credential Access

Check if user has 2FA verified for accessing sensitive credentials.

```bash
curl -s -b cookies.txt \
  http://localhost:3001/api/pds/verify-2fa | jq .
```

**Response (when 2FA not yet verified):**
```json
{
  "success": true,
  "data": {
    "has_2fa_verified": false,
    "can_access_credentials": false
  }
}
```

**Response (when 2FA verified):**
```json
{
  "success": true,
  "data": {
    "has_2fa_verified": true,
    "can_access_credentials": true
  }
}
```

---

## Admin Endpoints

### 1. Manually Provision PDS

Trigger PDS provisioning for a specific user (admin only).

```bash
curl -s -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"userId": "123456789"}' \
  http://localhost:3001/api/pds/provision | jq .
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "pds_handle": "@johndoe.pnptv.app",
    "pds_did": "did:web:johndoe-a1b2c3.pnptv.app",
    "pds_endpoint": "http://127.0.0.1:3000",
    "status": "active",
    "duration_ms": 2540
  }
}
```

**If user not found:**
```json
{
  "success": false,
  "error": "User not found"
}
```

**If not admin:**
```json
{
  "success": false,
  "error": "Admin access required"
}
```

---

## Error Handling

### Unauthorized Access (No Session)

```bash
# Try without cookies
curl -s http://localhost:3001/api/pds/info | jq .
```

**Response:**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### Invalid Request

```bash
curl -s -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3001/api/pds/provision | jq .
```

**Response:**
```json
{
  "success": false,
  "error": "userId is required"
}
```

### Provisioning Already In Progress

```bash
curl -s -X POST -b cookies.txt \
  http://localhost:3001/api/pds/retry-provision | jq .
```

**Response (if already active):**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "...",
    "pds_handle": "...",
    "pds_did": "...",
    "status": "active"
  }
}
```

---

## Advanced Testing

### Monitor PDS Status in Real-time

```bash
# Check health every 10 seconds
watch -n 10 'curl -s -b cookies.txt http://localhost:3001/api/pds/health | jq ".data | {status, accessible, last_verified_at}"'
```

### Export Provisioning Log to CSV

```bash
curl -s -b cookies.txt \
  'http://localhost:3001/api/pds/provisioning-log?limit=100' | \
  jq -r '.data[] | [.id, .action, .status, .created_at] | @csv' > pds_log.csv
```

### Check Multiple Users' PDS Status (requires admin access)

```bash
# Create a script to check multiple users
USERS=("user1" "user2" "user3")

for user in "${USERS[@]}"; do
  echo "User: $user"
  curl -s -b cookies.txt \
    "http://localhost:3001/api/pds/info?userId=$user" | jq '.data.status'
done
```

### Simulate Provisioning Monitoring Dashboard

```bash
# Get stats every 30 seconds
watch -n 30 'echo "=== PDS Status ==="; curl -s -b cookies.txt http://localhost:3001/api/pds/health | jq ".data | {pds_handle, status, accessible, last_verified_at}"; echo ""; echo "=== Recent Actions ==="; curl -s -b cookies.txt "http://localhost:3001/api/pds/provisioning-log?limit=5" | jq ".data[] | {action, status, created_at}"'
```

### Backup Rotation Testing

```bash
# Create multiple backups
for i in {1..3}; do
  echo "Creating backup $i..."
  curl -s -X POST -b cookies.txt \
    http://localhost:3001/api/pds/create-backup | jq '.data.backup_id'
  sleep 2
done

# List all backups
echo ""
echo "All backups created"
```

---

## Load Testing

### Single Endpoint Load Test

```bash
# Test with Apache Bench (if available)
ab -n 100 -c 10 -b cookies.txt http://localhost:3001/api/pds/health

# Or with curl loop
for i in {1..100}; do
  curl -s -b cookies.txt http://localhost:3001/api/pds/info > /dev/null &
done
wait
echo "100 requests completed"
```

### Multiple Endpoint Load Test

```bash
# Create test script
cat > /tmp/pds_load_test.sh << 'EOF'
#!/bin/bash
for i in {1..20}; do
  (
    curl -s -b cookies.txt http://localhost:3001/api/pds/info > /dev/null
    curl -s -b cookies.txt http://localhost:3001/api/pds/health > /dev/null
    curl -s -b cookies.txt 'http://localhost:3001/api/pds/provisioning-log?limit=10' > /dev/null
  ) &
done
wait
echo "Load test complete"
EOF

chmod +x /tmp/pds_load_test.sh
/tmp/pds_load_test.sh
```

---

## Integration Examples

### React Component Example

```javascript
import { useEffect, useState } from 'react';

function PDSStatus() {
  const [pds, setPds] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pds/info', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setPds(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!pds) return <div>PDS not configured</div>;

  return (
    <div>
      <p>Handle: {pds.pds_handle}</p>
      <p>Status: {pds.status}</p>
      <p>DID: {pds.pds_did}</p>
    </div>
  );
}
```

### Node.js/Express Example

```javascript
const axios = require('axios');

async function getPDSInfo(sessionCookie) {
  const response = await axios.get('http://localhost:3001/api/pds/info', {
    headers: {
      Cookie: sessionCookie
    }
  });
  return response.data.data;
}

// Usage
const pds = await getPDSInfo('__pnptv_sid=...');
console.log(pds);
```

### Python Example

```python
import requests

session = requests.Session()
# Set cookies first via login

response = session.get('http://localhost:3001/api/pds/info')
pds_info = response.json()['data']

print(f"Handle: {pds_info['pds_handle']}")
print(f"Status: {pds_info['status']}")
print(f"DID: {pds_info['pds_did']}")
```

---

## Troubleshooting

### Test If API Server is Running

```bash
curl -v http://localhost:3001/health
```

### Test With Authentication

```bash
# Make sure session is saved
curl -c cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"telegramUser": {...}}' \
  http://localhost:3001/api/auth/telegram-callback

# Then use session
curl -b cookies.txt http://localhost:3001/api/pds/info
```

### Check Error Logs

```bash
# Monitor logs in real-time
pm2 logs pnptv-bot | grep PDS

# Check specific errors
pm2 logs pnptv-bot | grep "ERROR\|Error"
```

### Database Query Examples

```bash
# Check if user has PDS
psql -U postgres -d pnptv_db -c \
  "SELECT * FROM user_pds_mapping WHERE user_id = 'target_user';"

# View provisioning errors
psql -U postgres -d pnptv_db -c \
  "SELECT * FROM pds_provisioning_log WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;"

# Check health issues
psql -U postgres -d pnptv_db -c \
  "SELECT * FROM pds_health_checks WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;"
```
