# One-Click Bluesky Setup - Admin & Technical Guide

## Architecture Overview

The one-click Bluesky setup system consists of:

### Backend Services
- **BlueskyAutoSetupService** - Core auto-setup and sync logic
- **PDSProvisioningService** - Extended to auto-trigger Bluesky setup
- **blueskyController** - API endpoints
- **blueskyRoutes** - Route definitions

### Frontend Components
- **BlueskySetupCard** - Dashboard UI component
- **BlueskySuccessModal** - Success confirmation
- **blueskyClient** - API client library

### Database
- **user_pds_mapping** - New Bluesky columns
- **bluesky_profile_syncs** - Sync audit trail
- **bluesky_events** - Webhook events
- **bluesky_connection_requests** - Setup request tracking

---

## Deployment Checklist

### 1. Database Migration
```bash
# Run the migration
psql -U postgres -d pnptv_db -f database/migrations/071_bluesky_one_click_setup.sql

# Verify new columns exist
psql -U postgres -d pnptv_db -c "\d user_pds_mapping" | grep bluesky
```

### 2. Backend Deployment
```bash
# Install/verify dependencies (already present)
npm ls uuid axios

# Backend files created:
# - apps/backend/bot/services/BlueskyAutoSetupService.js
# - apps/backend/bot/api/controllers/blueskyController.js
# - apps/backend/bot/api/routes/blueskyRoutes.js

# Verify routes registered in routes.js
grep "blueskyRoutes" apps/backend/bot/api/routes.js

# Build and restart
npm run build:backend
pm2 restart pnptv-bot
```

### 3. Frontend Deployment
```bash
# Frontend files created:
# - webapps/prime-hub/src/api/blueskyClient.js
# - webapps/prime-hub/src/components/BlueskySetupCard.jsx
# - webapps/prime-hub/src/components/BlueskySuccessModal.jsx

# Build React app
npm run build:prime-hub

# Integrate card into dashboard
# Add to Dashboard.jsx or wherever appropriate:
# import BlueskySetupCard from './BlueskySetupCard';
# <BlueskySetupCard />

# Verify build succeeds
npm run build:prime-hub
```

### 4. Environment Configuration
```bash
# Add to .env or .env.production:

# Bluesky auto-setup feature
BLUESKY_AUTO_SETUP=true
BLUESKY_AUTO_SYNC=true

# Bluesky API configuration
BLUESKY_PDS_URL=https://bsky.social
BLUESKY_HANDLE_DOMAIN=pnptv.app

# Feature flags
FEATURE_BLUESKY_INTEGRATION=true
FEATURE_AUTO_SYNC_PROFILES=true
```

### 5. Health Checks
```bash
# Test auto-setup service
curl -X GET http://localhost:3001/health

# Verify routes are registered
curl -X POST http://localhost:3001/api/bluesky/setup \
  -H "Content-Type: application/json" \
  -c cookies.txt

# Check database migration
psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM user_pds_mapping WHERE bluesky_handle IS NOT NULL;"
```

---

## API Endpoints

### POST /api/bluesky/setup
**One-click Bluesky account creation**

**Authentication**: Required (via session)

**Request Body**: `{}` (no parameters)

**Response**:
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

**Error Cases**:
- `401` - User not logged in
- `400` - User has no PDS provisioned
- `400` - Bluesky handle already taken (rare)
- `500` - Account creation failed

---

### GET /api/bluesky/status
**Check user's Bluesky account status**

**Authentication**: Required

**Response**:
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

### POST /api/bluesky/disconnect
**Disconnect Bluesky account**

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Bluesky account disconnected"
}
```

---

## Service Methods

### BlueskyAutoSetupService

#### `autoSetupBluesky(user, pdsMapping)`
Called automatically during PDS provisioning. Non-blocking.

```javascript
const result = await BlueskyAutoSetupService.autoSetupBluesky(user, pdsMapping);
// {
//   success: true,
//   blueskyHandle: "@user.pnptv.app",
//   blueskyDid: "did:key:...",
//   profile_synced: true
// }
```

#### `createBlueskyAccountOnClick(userId)`
User-initiated account creation.

```javascript
const result = await BlueskyAutoSetupService.createBlueskyAccountOnClick(userId);
```

#### `autoSyncProfileChange(userId, fieldName, oldValue, newValue)`
Called when profile fields change (avatar, bio, username).

```javascript
await BlueskyAutoSetupService.autoSyncProfileChange(
  userId,
  'avatar',
  'old-file-id.webp',
  'new-file-id.webp'
);
```

#### `getBlueskyStatus(userId)`
Get current Bluesky account status.

#### `disconnectBluesky(userId)`
Disconnect Bluesky account.

---

## Database Schema

### user_pds_mapping (new columns)

```sql
bluesky_handle VARCHAR(255) UNIQUE        -- @username.pnptv.app
bluesky_did VARCHAR(255)                  -- Bluesky DID
bluesky_created_at TIMESTAMP              -- When account was created
bluesky_auto_sync BOOLEAN DEFAULT true    -- Enable automatic syncing
bluesky_synced_at TIMESTAMP               -- Last sync timestamp
bluesky_last_error TEXT                   -- Last sync error message
bluesky_status VARCHAR(50)                -- pending, creating, active, error, disconnected
```

### bluesky_profile_syncs

Audit trail of all profile sync operations.

```sql
id UUID PRIMARY KEY
user_id VARCHAR(255)              -- User being synced
pnptv_uuid VARCHAR(255)
sync_type VARCHAR(50)             -- avatar, bio, display_name, all, auto_setup, etc.
field_name VARCHAR(100)
old_value TEXT
new_value TEXT
status VARCHAR(50)                -- success, failed, pending
triggered_by VARCHAR(50)          -- auto, manual, webhook
created_at TIMESTAMP
```

### bluesky_events

Webhook events from Bluesky (for future enhancements).

```sql
id UUID PRIMARY KEY
user_id VARCHAR(255)
event_type VARCHAR(100)           -- profile_updated, account_created, etc.
event_data JSONB
processed BOOLEAN DEFAULT FALSE
created_at TIMESTAMP
```

### bluesky_connection_requests

One-click setup requests (for tracking).

```sql
id UUID PRIMARY KEY
user_id VARCHAR(255)
status VARCHAR(50)                -- pending, processing, completed, failed
requested_handle VARCHAR(255)
bluesky_did VARCHAR(255)
expires_at TIMESTAMP              -- 24 hours from request
created_at TIMESTAMP
```

---

## Monitoring & Debugging

### Check Bluesky Setup Status

```sql
-- See how many users have Bluesky set up
SELECT COUNT(*) as total_bluesky_accounts
FROM user_pds_mapping
WHERE bluesky_handle IS NOT NULL AND bluesky_status = 'active';

-- See failed setups
SELECT user_id, bluesky_handle, bluesky_status, bluesky_last_error
FROM user_pds_mapping
WHERE bluesky_status = 'error'
LIMIT 10;

-- See auto-sync activity
SELECT sync_type, COUNT(*) as count, MAX(created_at) as last_sync
FROM bluesky_profile_syncs
GROUP BY sync_type
ORDER BY last_sync DESC;

-- See sync errors
SELECT user_id, sync_type, field_name, error_message, created_at
FROM bluesky_profile_syncs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Logs

```bash
# Check Bluesky service logs
pm2 logs pnptv-bot | grep "\[Bluesky\]"

# Check auto-setup logs specifically
pm2 logs pnptv-bot | grep "\[Bluesky\] Auto-setup"

# Monitor in real-time
tail -f /var/log/pnptv-bot.log | grep Bluesky
```

### Manual Test

```bash
# Test setup endpoint (need valid session)
curl -X POST http://localhost:3001/api/bluesky/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# Test status endpoint
curl -X GET http://localhost:3001/api/bluesky/status \
  -b cookies.txt

# Test disconnect
curl -X POST http://localhost:3001/api/bluesky/disconnect \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

---

## Troubleshooting

### Issue: "Handle already taken" on setup

**Cause**: Race condition or handle genuinely taken
**Solution**:
1. Check if user already has Bluesky account (status endpoint)
2. Generate alternative handle using random suffix
3. Log for manual review

```sql
-- Check if user already has account
SELECT bluesky_handle FROM user_pds_mapping WHERE user_id = 'user-id';
```

### Issue: Profile not syncing

**Cause**: Auto-sync disabled or PDS not accessible
**Solution**:
```sql
-- Enable auto-sync
UPDATE user_pds_mapping
SET bluesky_auto_sync = true
WHERE user_id = 'user-id';

-- Check PDS endpoint
SELECT pds_endpoint, bluesky_status
FROM user_pds_mapping
WHERE user_id = 'user-id';
```

### Issue: Accounts not showing up in frontend

**Cause**: Stale frontend cache or missing API call
**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh page (Ctrl+Shift+R)
3. Check browser console for API errors
4. Verify /api/bluesky/status returns valid data

---

## Configuration Reference

### Environment Variables

```bash
# Feature Flags
BLUESKY_AUTO_SETUP=true              # Enable auto-setup on login
BLUESKY_AUTO_SYNC=true               # Enable profile auto-sync
FEATURE_BLUESKY_INTEGRATION=true     # Master feature flag

# Bluesky Configuration
BLUESKY_PDS_URL=https://bsky.social  # PDS endpoint
BLUESKY_HANDLE_DOMAIN=pnptv.app      # Handle domain

# Feature Details
FEATURE_AUTO_SYNC_PROFILES=true      # Auto-sync when profile changes
FEATURE_COMBINED_FEED=false          # Don't federate to Bluesky
FEDERATION_BLOCK_ALL_OUTBOUND=true   # Never share data outbound
```

---

## Future Enhancements

### Phase 2: Webhook Support
- Receive Bluesky webhook events
- React to follows, likes, etc.
- Notify users of Bluesky activity

### Phase 3: Cross-Posting
- Optional one-way cross-posting
- Post to pnptv, sync to Bluesky
- Configurable per user

### Phase 4: Bluesky Feed Integration
- Show Bluesky timeline in pnptv dashboard
- View Bluesky posts without leaving pnptv
- Like/repost from pnptv

---

## Support & Escalation

**Level 1** (User-facing):
- Check BlueskySetupCard component
- Look at blueskyClient methods
- Review user documentation

**Level 2** (API/Backend):
- Check blueskyController.js
- Review BlueskyAutoSetupService.js
- Check logs for [Bluesky] errors

**Level 3** (Database/Infrastructure):
- Check database migration applied
- Verify Bluesky PDS is accessible
- Check PDS credentials in .env

**Level 4** (Escalation):
- Contact Bluesky support (if PDS issue)
- Review security logs for blocks
- Check rate limiting if bulk ops

---

## Rollback Plan

If you need to disable Bluesky setup:

### Quick Disable
```bash
# Set env var
BLUESKY_AUTO_SETUP=false
FEATURE_BLUESKY_INTEGRATION=false

# Restart
pm2 restart pnptv-bot
```

### Data Cleanup (optional)
```sql
-- Mark all Bluesky accounts as disconnected
UPDATE user_pds_mapping
SET bluesky_status = 'disconnected', bluesky_handle = NULL
WHERE bluesky_status = 'active';

-- Keep audit trail for future re-enabling
-- Tables are left intact for potential recovery
```

### Uninstall (complete removal)
```bash
# 1. Disable feature flags
# 2. Remove routes from routes.js (3 lines)
# 3. Delete component files (2 files)
# 4. Delete service file (1 file)
# 5. Rebuild
# 6. Database can be left as-is (unused columns)
```

---

## Performance Notes

- **Setup Time**: <5 seconds per user
- **Auto-sync Time**: <1 second per field change
- **Database Queries**: Indexed on user_id, bluesky_handle
- **API Response Time**: <500ms typical
- **Load**: Non-blocking, background jobs

---

**Last Updated**: February 2026
**Version**: 1.0
**Maintainer**: Easy Bots Engineering Team
