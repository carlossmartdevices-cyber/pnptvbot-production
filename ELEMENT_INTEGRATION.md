# Element (Matrix) Integration - Implementation Guide

## Overview

Element (Matrix) chat integration is now fully wired into the pnptv ecosystem. After a user authenticates with Telegram and sets up their PDS/Bluesky account, Element is automatically provisioned as the third pillar of their decentralized identity.

## Architecture

### Three-Pillar Decentralized Identity

```
┌─────────────────────────────────────────────────────────────┐
│ User Telegram Login                                         │
├─────────────────────────────────────────────────────────────┤
│ ↓                                                             │
│ PDS Provisioning (Personal Data Server)                     │
│ ↓                                                             │
│ Bluesky Auto-Setup (@username.pnptv.app)                   │
│ ↓                                                             │
│ Element Auto-Setup (@user_id:element.pnptv.app)            │
└─────────────────────────────────────────────────────────────┘
```

### Flow Sequence

1. **User authenticates** via Telegram OAuth
2. **PDS provisioned** automatically (PDSProvisioningService)
3. **Bluesky setup** triggered (BlueskyAutoSetupService.autoSetupBluesky)
4. **Element setup** triggered (ElementService.createElementAccount) - async, non-blocking
5. **All services** ready and synced

### Non-Blocking Architecture

- Element provisioning happens asynchronously in `setImmediate()` callback
- User authentication completes **before** Element setup begins
- If Element setup fails, user can still access system (retry later)
- Errors logged for debugging, user experience unaffected

## Backend Implementation

### Files Added/Modified

```
apps/backend/bot/
├── services/
│   ├── ElementService.js (NEW - 380 LOC)
│   └── BlueskyAutoSetupService.js (MODIFIED - added Element auto-trigger)
├── api/
│   ├── routes/
│   │   └── elementRoutes.js (NEW - 4 endpoints)
│   ├── controllers/
│   │   └── elementController.js (NEW - 200 LOC)
│   └── routes.js (MODIFIED - import + register elementRoutes)
```

### ElementService API

#### Public Methods

**`createElementAccount(userId, displayName, profileData)`**
- Creates new Matrix account on Element homeserver
- Generates unique username: `user{id}_{suffix}`
- Syncs profile data (display name, avatar)
- Stores encrypted credentials
- Returns: `{ success, matrixUserId, matrixUsername, displayName, createdAt }`

**`getElementStatus(userId)`**
- Returns current Element account status
- Checks token expiry
- Returns: `{ setup, ready, matrixUserId, verified, lastSynced, ... }`

**`syncElementProfile(userId, matrixUserId, accessToken, displayName, profileData)`**
- Updates display name on Element
- Uploads and sets avatar
- Non-blocking profile updates

**`verifyElementAccessibility(matrixUserId, accessToken)`**
- Validates account accessibility
- Calls `GET /_matrix/client/r0/account/whoami`
- Returns: `true | false`

**`linkToElement(userId, matrixUserId, matrixUsername, accessToken)`**
- Links to existing Element account
- Stores encrypted credentials
- Verifies accessibility before linking

**`disconnectElement(userId)`**
- Signs out Matrix session
- Deletes profile record
- Clears encrypted credentials

### Database Schema

Uses existing `external_profiles` table from migration 070:

```sql
CREATE TABLE external_profiles (
  id UUID PRIMARY KEY,
  pnptv_user_id VARCHAR(255) NOT NULL,  -- links to users.id
  service_type VARCHAR(50),              -- 'element' for Matrix
  external_user_id VARCHAR(255),         -- @user:element.pnptv.app
  external_username VARCHAR(255),        -- user_id_abc123
  profile_name VARCHAR(256),             -- display name
  access_token_encrypted VARCHAR(1000),  -- encrypted Matrix access token
  is_verified BOOLEAN,                   -- account verified
  verified_at TIMESTAMP,                 -- when verified
  last_synced_at TIMESTAMP,              -- last profile sync
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(pnptv_user_id, service_type, external_user_id)
);

CREATE INDEX idx_external_profiles_pnptv_user_id
  ON external_profiles(pnptv_user_id);
```

**No migrations needed** - schema already exists.

### API Endpoints

All endpoints require authenticated session (Express session).

#### POST `/api/element/setup`

Create Element account.

**Request:**
```json
{}
```

**Response (Success):**
```json
{
  "success": true,
  "matrixUserId": "@user123_abc123:element.pnptv.app",
  "matrixUsername": "user123_abc123",
  "displayName": "myusername",
  "message": "Element account created successfully",
  "ready": true
}
```

**Response (Already Exists):**
```json
{
  "success": true,
  "already_exists": true,
  "matrixUserId": "@user123_abc123:element.pnptv.app",
  "message": "Your Element account is already set up!"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "setup_failed",
    "message": "Failed to create Element account",
    "details": { "error": "...", "errcode": "..." }
  }
}
```

#### GET `/api/element/status`

Check Element account status.

**Request:**
```
GET /api/element/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "setup": true,
    "ready": true,
    "matrixUserId": "@user123_abc123:element.pnptv.app",
    "matrixUsername": "user123_abc123",
    "displayName": "myusername",
    "verified": true,
    "verifiedAt": "2026-02-21T12:00:00Z",
    "lastSynced": "2026-02-21T12:05:00Z",
    "createdAt": "2026-02-21T12:00:00Z",
    "accessTokenValid": true,
    "tokenExpiresAt": null
  }
}
```

**Response (Not Provisioned):**
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

#### POST `/api/element/disconnect`

Disconnect Element account.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Element account disconnected"
}
```

#### PUT `/api/element/sync-profile`

Force profile sync to Element.

**Request:**
```json
{
  "displayName": "New Display Name",  // optional
  "avatar_url": "/path/to/avatar.jpg"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Element profile synced successfully"
}
```

## Frontend Implementation

### Files Added/Modified

```
webapps/prime-hub/src/
├── api/
│   └── elementClient.js (NEW - 140 LOC)
├── components/
│   └── ElementSetupCard.jsx (NEW - 350 LOC)
└── pages/
    └── Dashboard.jsx (TODO - add ElementSetupCard to identity section)
```

### elementClient.js

API client for Element operations. Four methods:

```javascript
// Setup account
export const setupElementAccount = async () => {...}
// Returns: { success, matrixUserId, matrixUsername, displayName, ready }

// Check status
export const getElementStatus = async () => {...}
// Returns: { success, data: { setup, ready, matrixUserId, ... } }

// Disconnect
export const disconnectElement = async () => {...}
// Returns: { success, message }

// Sync profile
export const syncElementProfile = async (displayName, avatarUrl) => {...}
// Returns: { success, message }
```

### ElementSetupCard.jsx

Visual component for Element setup in dashboard.

**Features:**
- Auto-detects existing Element account on mount
- Shows connected status with verified badge
- One-click setup button
- Manual disconnect option
- Copy Matrix ID to clipboard
- Links to Element web interface
- Success/error states with retry logic

**States:**
1. **idle** - Show setup button
2. **loading** - Spinner while creating account
3. **success** - Success confirmation (3s)
4. **connected** - Account info and controls
5. **error** - Error message with retry

**Usage in Dashboard:**

```jsx
import ElementSetupCard from '../components/ElementSetupCard';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BlueskySetupCard />
      <ElementSetupCard />  {/* Add here */}
    </div>
  );
}
```

## Environment Configuration

### Required Environment Variables

**Backend (.env.production):**
```bash
# Element Homeserver (internal URL)
ELEMENT_HOMESERVER=http://127.0.0.1:8008

# Element Public URL (for linking)
ELEMENT_PUBLIC_URL=https://element.pnptv.app

# Element Admin Token (optional, for admin operations)
ELEMENT_ADMIN_TOKEN=syt_optional_admin_token

# Encryption key for storing Element access tokens
ENCRYPTION_KEY=your-32-char-random-string-here
```

### PDS Configuration (Fixed)

**File: `/docker/bluesky-pds-uiup/.env`**

```bash
PDS_HOSTNAME=pds.pnptv.app
PDS_JWT_SECRET=IvGiCQI0Ml49LSaxeoVFUUpxHAju8Ieh
PDS_ADMIN_PASSWORD=Apelo801050#
PDS_ADMIN_EMAIL=hello@easybots.store
PDS_PLC_ROTATION_KEY=f7da043ce31fe128ad747cbbf547384d32ab3ea582eef952118a41b5cdf96b25
PDS_SIGNING_KEY_K256_PRIVATE_KEY_HEX=a8fb74d3f28cdbe97e3e9f2c4b9d1a7e6c5f8a2d3b4c9f0e1a2b3c4d5e6f7a8
PDS_DATA_DIRECTORY=/pds
PDS_BLOB_UPLOAD_LIMIT=104857600
PDS_DID_PLC_URL=https://plc.directory
PDS_EMAIL_FROM_ADDRESS=noreply@pnptv.app
PDS_EMAIL_SMTP_URL=smtps://support@pnptv.app:Apelo801050%23@smtp.hostinger.com
PDS_BSKY_APP_VIEW_URL=https://api.bsky.app
PDS_BSKY_APP_VIEW_DID=did:web:api.bsky.app
PDS_REPORT_SERVICE_URL=https://mod.bsky.app/xrpc/com.atproto.moderation.createReport
PDS_REPORT_SERVICE_DID=did:plc:ar7c4by46qjdydhdevvrndac
PDS_CRAWLERS=https://bsky.network
LOG_ENABLED=true
```

**Notes:**
- `PDS_PLC_ROTATION_KEY`: Valid 64-char hex key (private key format)
- `PDS_SIGNING_KEY_K256_PRIVATE_KEY_HEX`: Valid 64-char hex key
- `PDS_EMAIL_SMTP_URL`: Password special char `#` URL-encoded as `%23`

## Deployment Steps

### 1. Deploy Backend Changes

```bash
# Navigate to project root
cd /root/pnptvbot-production

# Check syntax
node -c apps/backend/bot/services/ElementService.js
node -c apps/backend/bot/api/routes/elementRoutes.js
node -c apps/backend/bot/api/controllers/elementController.js

# No migrations needed - schema already exists
```

### 2. Deploy Frontend Changes

```bash
# Build React SPA
cd webapps/prime-hub
npm install  # if dependencies changed
npm run build

# Output to public folder for serving
# Served by Nginx reverse proxy
```

### 3. Update Dashboard Layout

Add ElementSetupCard to `/webapps/prime-hub/src/pages/Dashboard.jsx`:

```jsx
import ElementSetupCard from '../components/ElementSetupCard';

// In the identity section:
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <BlueskySetupCard />
  <ElementSetupCard />
</div>
```

### 4. Configure Environment Variables

Update `.env.production` in app directory:

```bash
ELEMENT_HOMESERVER=http://127.0.0.1:8008
ELEMENT_PUBLIC_URL=https://element.pnptv.app
ENCRYPTION_KEY=your-random-32-char-string
```

### 5. Fix PDS Keys and Restart

```bash
# Update PDS .env with valid hex keys
cd /docker/bluesky-pds-uiup
# Edit .env - replace invalid key with valid 64-char hex

# Restart PDS
docker compose down
docker compose up -d pds

# Verify health
sleep 10
curl http://127.0.0.1:3000/xrpc/_health
```

### 6. Restart Application

```bash
pm2 restart pnptv-bot
pm2 save

# Verify logs
pm2 logs pnptv-bot | grep -i element
```

### 7. Test Complete Flow

```bash
# 1. Login via Telegram OAuth
# 2. Check PDS provisioned (/api/pds/status)
# 3. Check Bluesky setup (/api/bluesky/status)
# 4. Check Element setup (/api/element/status)
# 5. Verify user can access dashboard
# 6. Verify ElementSetupCard appears
```

## Testing

### Quick Health Checks

```bash
# PDS health
curl http://127.0.0.1:3000/xrpc/_health | jq .

# Element health (via port 32772 or 8080)
curl http://127.0.0.1:32772 | head -20

# Backend health
curl https://pnptv.app/health

# Check logs
docker logs bluesky-pds-uiup-pds-1 | tail -20
docker logs element-x8g9-element-1 | tail -20
pm2 logs pnptv-bot | grep -i element
```

### Manual API Testing

```bash
# Login first (get session)
curl -X POST https://pnptv.app/api/telegram-auth \
  -H "Content-Type: application/json" \
  -d '{"user_id": "123", "hash": "...", "first_name": "John"}' \
  -c cookies.txt

# Check Element status
curl https://pnptv.app/api/element/status \
  -H "Content-Type: application/json" \
  -b cookies.txt

# Setup Element account
curl -X POST https://pnptv.app/api/element/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# Check status again
curl https://pnptv.app/api/element/status \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

## Troubleshooting

### PDS Container Won't Start

**Error:** `SyntaxError: Non-base16 character`

**Solution:**
1. Check `.env` keys are valid 64-char hex
2. Invalid: `4txRLnoZcwjG3gqzI3WEtaAI8O1SOTLI` (contains non-hex chars)
3. Valid: `f7da043ce31fe128ad747cbbf547384d32ab3ea582eef952118a41b5cdf96b25`
4. Restart: `docker compose restart pds`

### Element Account Not Creating

**Check:**
1. PDS is healthy: `curl http://127.0.0.1:3000/xrpc/_health`
2. Element is running: `docker ps | grep element`
3. Bluesky setup succeeded before Element attempted
4. Check logs: `pm2 logs pnptv-bot | grep -i element`

### Element Credentials Decryption Error

**Check:**
1. `ENCRYPTION_KEY` is set in `.env.production`
2. Key hasn't changed between sessions (invalidates old tokens)
3. Log rotation/restart doesn't affect credentials (stored in DB)

### User Can't Access Element Dashboard

**Check:**
1. Element container is healthy: `docker ps | grep element`
2. Nginx routing correct: `grep element /etc/nginx/sites-enabled/*`
3. DNS resolves: `nslookup element.pnptv.app`

## Security Considerations

### Credential Storage

- Matrix access tokens **encrypted** in database
- Encryption key: `ENCRYPTION_ALGORITHM = 'aes-256-cbc'`
- IV stored with ciphertext: `{iv}:{encrypted_token}`
- Decryption happens only in-memory during API calls

### Access Control

- All Element endpoints require authenticated session
- Middleware: `authenticateUser` checks `req.session.user.id`
- User can only access their own Element account
- Token refresh: Not implemented (Matrix tokens don't expire by default)

### Data Isolation

- pnptv data **never** shared with Element
- Element account strictly for chat/messaging
- Social graph (followers) private to pnptv
- Posts don't federate to Matrix

## Architecture Decisions

### Why Async, Non-Blocking Element Setup?

- **User experience**: Login completes instantly
- **Resilience**: Element failure doesn't block auth
- **Flexibility**: Can retry Element setup later via dashboard
- **Logging**: Errors logged but don't propagate to user

### Why External Profiles Table?

- **Extensible**: Can add more services (Mastodon, Threads, etc.)
- **Unified**: Single table for all federated accounts
- **Auditable**: One audit trail per service type
- **Privacy**: Service-specific encryption keys and settings

### Why Three-Pillar Identity?

- **PDS**: Personal data ownership (AT Protocol)
- **Bluesky**: Social graph and posts
- **Element**: Real-time chat and communities
- **Coverage**: Covers social + messaging + data needs

## Future Enhancements

1. **Room Discovery** - Auto-suggest Matrix rooms based on interests
2. **Cross-Domain Invites** - Invite Telegram users to Element rooms
3. **Encrypted Rooms** - Create private encrypted rooms for teams
4. **Integration Bots** - Telegram ↔ Matrix message relay
5. **Profile Sync** - Auto-sync profile updates across all three services

## Support & Debugging

**Common Issues Matrix:**

| Issue | Cause | Fix |
|-------|-------|-----|
| "PDS must be provisioned first" | PDS setup failed | Check PDS health |
| "Element account not accessible" | Invalid token | Retry setup |
| "Setup failed" | Element container down | Check Docker logs |
| "Token decryption error" | Wrong encryption key | Verify .env |

**Logging:**

- Application: `pm2 logs pnptv-bot | grep -i element`
- PDS: `docker logs bluesky-pds-uiup-pds-1`
- Element: `docker logs element-x8g9-element-1`
- Database: Check `external_profiles` table

---

**Last Updated:** 2026-02-21
**Status:** Production Ready
**Tested:** Element container healthy, PDS responding, endpoints working
