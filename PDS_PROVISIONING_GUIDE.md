# PDS (Personal Data Server) Provisioning System

## Overview

Automatic Personal Data Server (PDS) provisioning for pnptv users on Telegram login. Each user gets a unique decentralized identity (DID) and AT Protocol handle for federation with Bluesky and other decentralized networks.

## Architecture

### Core Concepts

- **PDS**: Personal Data Server - decentralized repository for user data
- **DID**: Decentralized Identifier (e.g., `did:web:username.pnptv.app`)
- **AT Protocol Handle**: User's identifier on AT Protocol (e.g., `@username.pnptv.app`)
- **UUID**: pnptv's internal UUID for mapping users to PDS instances
- **Encryption**: AES-256-GCM for all credential storage

### Flow Diagram

```
Telegram Login
    ↓
User authenticates via Telegram
    ↓
TelegramAuthHandler called
    ↓
PDSProvisioningService.createOrLinkPDS() [ASYNC]
    ├→ Check existing PDS mapping
    ├→ If exists: verify accessibility → return
    └→ If new:
        ├→ Generate DID
        ├→ Generate AT Protocol handle
        ├→ Provision PDS instance (local/remote/hybrid)
        ├→ Create AT Protocol account
        ├→ Encrypt & store credentials
        ├→ Log action
        └→ Queue health checks
    ↓
Login succeeds (non-blocking provisioning)
    ↓
User receives session with PDS info
```

## File Structure

### Backend

```
apps/backend/
├── bot/
│   ├── services/
│   │   └── PDSProvisioningService.js          # Core provisioning logic
│   └── api/
│       ├── controllers/
│       │   └── pdsController.js               # API endpoints
│       └── routes/
│           └── pdsRoutes.js                   # Route definitions
├── migrations/
│   └── 064_user_pds_mapping.sql               # Database schema
└── api/handlers/
    └── telegramAuthHandler.js                 # Updated with provisioning call
```

### Frontend

```
webapps/prime-hub/src/
├── pages/
│   └── PDSSetup.jsx                           # Full setup wizard page
├── components/
│   ├── PDSStatus.jsx                          # Status indicator
│   └── DecentralizedIdentity.jsx              # Profile section
└── api/
    └── pdsClient.js                           # API client methods
```

## Installation & Setup

### 1. Environment Configuration

Add to `.env`:

```bash
# PDS Provisioning
PDS_PROVISIONING_ENABLED=true
PDS_MODE=local                          # Options: local, remote, hybrid
PDS_DOMAIN=pnptv.app
PDS_ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)

# Local PDS Configuration
PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000
PDS_ADMIN_DID=did:web:admin.pnptv.app
PDS_ADMIN_PASSWORD=your-secure-admin-password

# Remote PDS Configuration (fallback)
PDS_REMOTE_PROVIDER=https://pds.bluesky.social

# Session Management
SESSION_SECRET=your-session-secret-key
```

### 2. Database Migration

```bash
# Run migration
psql -U postgres -d pnptv_db -f apps/backend/migrations/064_user_pds_mapping.sql

# Verify tables
psql -U postgres -d pnptv_db -c "\dt user_pds_mapping pds_*"
```

Tables created:
- `user_pds_mapping` - User ↔ PDS mappings
- `pds_provisioning_log` - Audit trail
- `pds_health_checks` - Health check history
- `pds_credential_backups` - Encrypted credential backups
- `pds_provisioning_queue` - Async retry queue

### 3. Install Dependencies

```bash
npm install uuid
```

### 4. Run Setup Script

```bash
bash scripts/setup-pds-provisioning.sh
```

### 5. Verify Integration

```bash
# Check that routes are registered
grep "pdsRoutes" apps/backend/bot/api/routes.js

# Check that provisioning is called
grep "PDSProvisioningService" apps/backend/api/handlers/telegramAuthHandler.js

# Verify service file
ls -la apps/backend/bot/services/PDSProvisioningService.js
```

### 6. Restart Application

```bash
pm2 restart pnptv-bot
# or
npm start
```

## API Endpoints

All endpoints require authentication (session cookie) unless specified.

### User Endpoints

#### `GET /api/pds/info`
Get authenticated user's PDS information.

**Response:**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "pds_handle": "@username.pnptv.app",
    "pds_did": "did:web:username-a1b2c3.pnptv.app",
    "pds_endpoint": "http://127.0.0.1:3000",
    "status": "active",
    "verification_status": "accessible",
    "created_at": "2026-02-21T10:30:00Z"
  }
}
```

#### `POST /api/pds/retry-provision`
Manually retry PDS provisioning if it failed.

**Response:**
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

#### `GET /api/pds/health`
Check PDS endpoint accessibility and health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "has_pds": true,
    "pds_handle": "@username.pnptv.app",
    "pds_did": "did:web:...",
    "status": "active",
    "verification_status": "accessible",
    "accessible": true,
    "last_verified_at": "2026-02-21T10:35:00Z"
  }
}
```

#### `GET /api/pds/provisioning-log`
Get user's provisioning action log.

**Query Parameters:**
- `limit`: Number of records (max 100, default 50)
- `offset`: Pagination offset (default 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "action": "created",
      "status": "success",
      "details": {"pds_did": "...", "pds_handle": "..."},
      "error_message": null,
      "created_at": "2026-02-21T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

#### `POST /api/pds/create-backup`
Create manual backup of PDS credentials (30-day expiry).

**Response:**
```json
{
  "success": true,
  "data": {
    "backup_id": 1,
    "created_at": "2026-02-21T10:35:00Z",
    "expires_at": "2026-03-23T10:35:00Z"
  }
}
```

#### `GET /api/pds/health-checks`
Get recent PDS health checks.

**Query Parameters:**
- `limit`: Number of records (max 100, default 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "check_type": "connectivity",
      "status": "success",
      "response_time_ms": 145,
      "details": {"did": "did:web:..."},
      "created_at": "2026-02-21T10:35:00Z"
    }
  ]
}
```

### Admin Endpoints

#### `POST /api/pds/provision` (Admin only)
Manually trigger PDS provisioning for a user.

**Request:**
```json
{
  "userId": "telegram_user_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pnptv_uuid": "...",
    "pds_handle": "...",
    "pds_did": "...",
    "pds_endpoint": "...",
    "status": "active",
    "duration_ms": 2540
  }
}
```

## Database Schema

### `user_pds_mapping`

```sql
id              BIGSERIAL PRIMARY KEY
user_id         VARCHAR(255) UNIQUE FK → users.id
pnptv_uuid      UUID UNIQUE
pds_did         VARCHAR(255) UNIQUE
pds_handle      VARCHAR(255) UNIQUE
pds_endpoint    VARCHAR(500)
pds_public_key  TEXT
pds_private_key_encrypted  TEXT (AES-256-GCM)
pds_private_key_iv         VARCHAR(32)
pds_private_key_auth_tag   VARCHAR(32)
pds_access_token           VARCHAR(1000)
pds_refresh_token          VARCHAR(1000)
status          VARCHAR(50) [pending|active|error|revoked]
error_message   TEXT
last_verified_at TIMESTAMP
verification_status VARCHAR(50) [accessible|inaccessible|unknown]
key_rotation_date TIMESTAMP
next_key_rotation TIMESTAMP DEFAULT CURRENT_TIMESTAMP + 90 days
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP (trigger)
```

### `pds_provisioning_log`

Audit trail of all PDS operations per user.

```sql
id              BIGSERIAL PRIMARY KEY
user_id         VARCHAR(255) FK → users.id
pnptv_uuid      UUID
action          VARCHAR(100) [created|updated|verified|error|revoked|key_rotated|retry|health_check]
status          VARCHAR(50) [success|failed|pending]
details         JSONB
error_code      VARCHAR(100)
error_message   TEXT
created_by      VARCHAR(255) [user_id|'system']
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### `pds_health_checks`

Health check history for monitoring.

```sql
id              BIGSERIAL PRIMARY KEY
user_id         VARCHAR(255) FK → users.id
pnptv_uuid      UUID
pds_endpoint    VARCHAR(500)
check_type      VARCHAR(50) [connectivity|endpoint_reachable|at_protocol|credentials]
status          VARCHAR(50) [success|failed|timeout]
response_time_ms INTEGER
details         JSONB
error_message   TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### `pds_credential_backups`

Encrypted credential backups for recovery.

```sql
id              BIGSERIAL PRIMARY KEY
user_id         VARCHAR(255) FK → users.id
pnptv_uuid      UUID
backup_type     VARCHAR(50) [manual|auto|recovery]
backup_data_encrypted TEXT (AES-256-GCM)
backup_iv       VARCHAR(32)
backup_auth_tag VARCHAR(32)
is_used         BOOLEAN DEFAULT FALSE
used_at         TIMESTAMP
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
expires_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP + 30 days
```

### `pds_provisioning_queue`

Async queue for retry logic.

```sql
id              BIGSERIAL PRIMARY KEY
user_id         VARCHAR(255) FK → users.id
pnptv_uuid      UUID
action          VARCHAR(100) [create|verify|rotate_keys|retry]
attempt_count   INTEGER DEFAULT 0
max_attempts    INTEGER DEFAULT 3
next_retry      TIMESTAMP
error_details   JSONB
status          VARCHAR(50) [pending|processing|completed|failed]
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Security Features

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits
- **IV**: 128-bit random per encryption
- **Auth Tag**: 128-bit for authenticated encryption

### Key Management

- Private keys encrypted before storage
- Never returned in API responses (requires 2FA for access)
- Automatic rotation every 90 days
- Encrypted backups with 30-day expiry

### Credential Backups

- Automatic backup on provisioning
- Manual backup on-demand
- Encrypted with same algorithm as storage
- 30-day retention by default
- Marked as "used" after recovery

### Audit Logging

- All provisioning actions logged
- Error messages and stack traces logged
- Audit trail queryable by user
- Cannot be modified after creation

### Error Handling

- Provisioning failures don't block login
- Automatic retry queue with exponential backoff
- Failed actions logged with full context
- Admin notification of critical failures

## PDS Provisioning Modes

### Mode 1: Local PDS

Run PDS server locally (Docker recommended).

**Configuration:**
```bash
PDS_MODE=local
PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000
PDS_ADMIN_DID=did:web:admin.pnptv.app
PDS_ADMIN_PASSWORD=secure-admin-password
```

**Advantages:**
- Full control
- No external dependencies
- Faster provisioning
- Complete privacy

**Setup:**
```bash
# Run PDS server in Docker
docker run -d \
  -p 3000:3000 \
  -e ADMIN_DID="did:web:admin.pnptv.app" \
  -e ADMIN_PASSWORD="secure-password" \
  bluesky-social/pds:latest
```

### Mode 2: Remote PDS

Use third-party PDS provider (Bluesky's PDS).

**Configuration:**
```bash
PDS_MODE=remote
PDS_REMOTE_PROVIDER=https://pds.bluesky.social
```

**Advantages:**
- No infrastructure needed
- Bluesky compatibility
- Built-in redundancy

**Disadvantages:**
- External dependency
- Rate limiting possible
- Less control

### Mode 3: Hybrid

Mix of local and remote with automatic failover.

**Configuration:**
```bash
PDS_MODE=hybrid
PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000
PDS_REMOTE_PROVIDER=https://pds.bluesky.social
```

**Features:**
- Hash-based round-robin distribution
- Automatic failover if one provider fails
- Load balancing across providers
- Best reliability

## Testing

### Run Test Suite

```bash
bash scripts/test-pds-provisioning.sh
```

### Manual Testing

```bash
# 1. Get user's PDS info
curl -b cookies.txt http://localhost:3001/api/pds/info | jq .

# 2. Check health
curl -b cookies.txt http://localhost:3001/api/pds/health | jq .

# 3. View provisioning log
curl -b cookies.txt 'http://localhost:3001/api/pds/provisioning-log?limit=10' | jq .

# 4. View health checks
curl -b cookies.txt 'http://localhost:3001/api/pds/health-checks' | jq .

# 5. Create backup
curl -X POST -b cookies.txt http://localhost:3001/api/pds/create-backup | jq .

# 6. Admin: Manually provision
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"userId": "123456789"}' \
  http://localhost:3001/api/pds/provision | jq .
```

### Database Testing

```bash
# Check user PDS mapping
psql -U postgres -d pnptv_db -c "SELECT * FROM user_pds_mapping LIMIT 5;"

# View provisioning log
psql -U postgres -d pnptv_db -c "SELECT * FROM pds_provisioning_log ORDER BY created_at DESC LIMIT 10;"

# Check health checks
psql -U postgres -d pnptv_db -c "SELECT * FROM pds_health_checks ORDER BY created_at DESC LIMIT 10;"

# View provisioning queue
psql -U postgres -d pnptv_db -c "SELECT * FROM pds_provisioning_queue WHERE status = 'pending';"

# Count statistics
psql -U postgres -d pnptv_db -c "
  SELECT
    (SELECT COUNT(*) FROM user_pds_mapping) as total_users_with_pds,
    (SELECT COUNT(*) FROM user_pds_mapping WHERE status = 'active') as active_pds,
    (SELECT COUNT(*) FROM user_pds_mapping WHERE status = 'error') as error_pds,
    (SELECT COUNT(*) FROM pds_provisioning_queue WHERE status = 'pending') as pending_retries;
"
```

## Monitoring & Maintenance

### Health Checks

Automatic health checks every 60 minutes:
- Endpoint reachability
- AT Protocol connectivity
- Credential validity

### Key Rotation

Automatic key rotation every 90 days:
- New Ed25519 signing key pair generated
- Old keys retained for grace period
- Audit log updated

### Cleanup Tasks

Automatic scheduled tasks:
- Orphaned backups deleted after 30 days
- Stale queue items purged after 7 days
- Dead PDSs marked as inaccessible after 3 failures

### Troubleshooting

#### User's PDS Status is "Pending"

```bash
# Retry provisioning
curl -X POST -b cookies.txt http://localhost:3001/api/pds/retry-provision

# Check logs
psql -U postgres -d pnptv_db -c "
  SELECT * FROM pds_provisioning_log
  WHERE user_id = 'target_user_id'
  ORDER BY created_at DESC LIMIT 5;
"
```

#### PDS Endpoint Unreachable

```bash
# Check health
curl -b cookies.txt http://localhost:3001/api/pds/health

# Verify local PDS is running
docker ps | grep pds

# Check network connectivity
curl -v http://127.0.0.1:3000/.well-known/atproto-did
```

#### Encryption Errors

```bash
# Verify encryption key is set
echo $PDS_ENCRYPTION_KEY | wc -c

# Check backup is valid
psql -U postgres -d pnptv_db -c "
  SELECT id, is_used, expires_at
  FROM pds_credential_backups
  WHERE user_id = 'target_user_id'
  ORDER BY created_at DESC LIMIT 1;
"
```

## Frontend Integration

### Components

#### PDSSetup Page
Full-featured setup wizard with configuration display.

```jsx
import PDSSetup from './pages/PDSSetup';

<Route path="/pds-setup" element={<PDSSetup />} />
```

#### PDSStatus Component
Compact status indicator for headers/footers.

```jsx
import PDSStatus from './components/PDSStatus';

<PDSStatus userId={user.id} compact={false} />
```

#### DecentralizedIdentity Component
Profile section for settings.

```jsx
import DecentralizedIdentity from './components/DecentralizedIdentity';

<DecentralizedIdentity />
```

### API Client

```jsx
import {
  getPDSInfo,
  retryPDSProvisioning,
  checkPDSHealth,
  getProvisioningLog,
  createPDSBackup,
  getHealthChecks
} from './api/pdsClient';

// Get user's PDS info
const pdsInfo = await getPDSInfo();

// Retry if failed
const result = await retryPDSProvisioning();

// Check health
const health = await checkPDSHealth();
```

## Performance Metrics

### Typical Provisioning Times

- **Local PDS**: 2-5 seconds
- **Remote PDS**: 5-15 seconds
- **Hybrid (success on first)**: 2-5 seconds
- **Hybrid (fallback)**: 15-20 seconds

### Database Impact

- Per-user storage: ~5-8 KB (encrypted credentials)
- Backup storage: ~5-8 KB per backup
- Log entries: ~200 bytes per action
- Query time (user info): <10ms
- Query time (provisioning log): <50ms

### API Response Times

- `GET /api/pds/info`: <10ms
- `POST /api/pds/retry-provision`: 2-20s (async provisioning)
- `GET /api/pds/health`: 5-10s (includes connectivity check)
- `GET /api/pds/provisioning-log`: <50ms

## Future Enhancements

1. **Multi-Signature**: Require admin approval for key rotation
2. **Delegation**: Allow creating sub-DIDs for different services
3. **Export**: Export full PDS configuration for backup/migration
4. **Federation**: Enable sharing PDS data with partner networks
5. **Analytics**: Dashboard of PDS ecosystem health metrics
6. **Recovery Keys**: Generate recovery keys for account recovery
7. **Device Linking**: Link multiple devices to same PDS
8. **Subscription Tiers**: Different storage/features per subscription level

## Support

For issues or questions:

1. Check logs: `pm2 logs pnptv-bot | grep PDS`
2. Run tests: `bash scripts/test-pds-provisioning.sh`
3. Review database: See "Database Testing" section above
4. Check documentation: This file + inline code comments

## License

Proprietary - Easy Bots Inc.
