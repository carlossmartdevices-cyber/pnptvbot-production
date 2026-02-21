# PDS Bluesky Integration - Quick Reference Guide

**For**: Developers, DevOps, QA
**Time to Deploy**: 15 minutes
**Files Changed**: 5 core files + 13 new files

## TL;DR

PDS Bluesky integration lets pnptv users link their Bluesky profiles and view their feeds. Privacy is enforced at middleware level - zero data from pnptv goes to external services.

## Quick Start

### 1. Apply Database Migration
```bash
bash scripts/setup-pds-bluesky-integration.sh production
```

### 2. Update Routes (in `apps/backend/bot/api/routes.js`)
```javascript
// Add at top (after other imports)
const FederationPrivacyMiddleware = require('./middleware/federationPrivacyMiddleware');

// Register BEFORE other routes (around line 20)
app.use(new FederationPrivacyMiddleware(pool).middleware());

// Add in route registration section (around line 1700)
const externalProfileRoutes = require('./routes/externalProfileRoutes');
router.use('/api/webapp/profile', externalProfileRoutes(pool));
router.use('/api/webapp/feed', externalProfileRoutes(pool));
```

### 3. Build & Deploy
```bash
npm run build:prime-hub
pm2 restart pnptv-bot
```

### 4. Verify
```bash
bash scripts/test-pds-bluesky-integration.sh http://localhost:3001 <token>
```

## API Endpoints

### Link Profile
```bash
POST /api/webapp/profile/external/link
{
  "handle": "alice.bsky.social",
  "serviceType": "bluesky"
}
# Returns: verificationId, challenge, profileId
```

### Verify Ownership
```bash
POST /api/webapp/profile/external/{profileId}/verify
{
  "signedChallenge": "signature-from-bluesky"
}
# Returns: isVerified = true
```

### Get Linked Profiles
```bash
GET /api/webapp/profile/external
# Returns: array of linked profiles
```

### Update Privacy Settings
```bash
PATCH /api/webapp/profile/external/{profileId}
{
  "showOnProfile": true,
  "showFollowerCount": true,
  "publicLinking": false
}
```

### Get Bluesky Feed
```bash
GET /api/webapp/feed/bluesky?limit=20&offset=0
# Returns: cached posts from linked Bluesky users
```

### Mute/Block Users
```bash
POST /api/webapp/feed/mute
{"externalUserId": "did:plc:...", "mute": true}

POST /api/webapp/feed/block
{"externalUserId": "did:plc:...", "block": true}
```

## Configuration

### Required Environment Variables
```bash
FEDERATION_ENCRYPTION_KEY=<64-char hex from openssl rand -hex 32>
FEDERATION_PRIVACY_ENABLED=true
BLUESKY_PDS_URL=https://bsky.social
BLUESKY_ATPROTO_URL=https://api.bsky.app/xrpc
```

### Optional Variables
```bash
BLUESKY_API_KEY=<if required>
FEDERATION_LOG_LEVEL=info
FEDERATION_AUDIT_LOGGING=true
```

## Database Tables (9 Total)

### User-Facing
- `external_profiles` - User's linked accounts
- `pds_posts` - Cached posts from Bluesky
- `pds_feed_preferences` - Feed settings

### Verification
- `external_profile_verification` - Ownership proofs

### Element (Phase 2)
- `element_rooms` - Rooms user can join
- `element_room_membership` - Active room memberships

### Audit & Forensics
- `federated_access_log` - All external data access
- `outbound_federation_blocks` - Blocked attempts
- `federation_encryption_keys` - Key rotation tracking

## Privacy Enforcement

### What Gets Blocked
- ✅ POST/PUT/PATCH/DELETE to any external domain
- ✅ Headers with federation tokens
- ✅ Privilege escalation attempts
- ✅ Malformed webhook signatures

### What's Allowed
- ✅ GET requests to whitelisted Bluesky endpoints
- ✅ Profile linking/unlinking
- ✅ Preference management
- ✅ Post caching for display

### Blocked Response
```json
HTTP 403 Forbidden
{
  "success": false,
  "error": {
    "code": "OUTBOUND_DOMAIN_BLOCKED",
    "message": "Request to blocked external domain"
  }
}
```

## Common Tasks

### Link a Profile (End-to-End Flow)
```bash
# 1. User provides handle
curl -X POST http://localhost:3001/api/webapp/profile/external/link \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"handle":"alice.bsky.social"}'

# Response contains: profileId, challenge, expiresAt
# 2. User signs challenge with Bluesky client
# 3. User submits signed challenge
curl -X POST http://localhost:3001/api/webapp/profile/external/{profileId}/verify \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"signedChallenge":"signature..."}'

# Response: isVerified = true
```

### Check Blocked Requests
```sql
SELECT block_reason, COUNT(*)
FROM outbound_federation_blocks
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY block_reason;
```

### View External Data Access
```sql
SELECT pnptv_user_id, action, COUNT(*)
FROM federated_access_log
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY pnptv_user_id, action;
```

### Delete Old Cached Posts
```sql
DELETE FROM pds_posts WHERE expires_at < NOW();
-- Runs automatically via cron (not implemented yet)
```

## Testing

### Run Integration Tests
```bash
bash scripts/test-pds-bluesky-integration.sh http://localhost:3001 <token>
# 30+ test cases covering endpoints, privacy, validation
```

### Test Privacy Blocking
```bash
# This should return 403
curl -X POST http://localhost:3001/api/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"webhook_url":"https://bsky.social/xrpc/post"}'
```

### Test Profile Linking
```bash
# 1. Get profiles (should be empty initially)
curl -X GET http://localhost:3001/api/webapp/profile/external \
  -H "Authorization: Bearer $TOKEN"

# 2. Link profile
curl -X POST http://localhost:3001/api/webapp/profile/external/link \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"handle":"alice.bsky.social"}'

# 3. Verify (needs signed challenge, use dummy for testing)
curl -X POST http://localhost:3001/api/webapp/profile/external/{profileId}/verify \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"signedChallenge":"test"}'

# 4. Check linked profiles
curl -X GET http://localhost:3001/api/webapp/profile/external \
  -H "Authorization: Bearer $TOKEN"
```

## Monitoring

### Key Metrics to Watch
```sql
-- Blocked requests (should be 0 if all legitimate)
SELECT COUNT(*) FROM outbound_federation_blocks WHERE created_at > NOW() - INTERVAL '1 hour';

-- External API calls (watch for anomalies)
SELECT COUNT(*) FROM federated_access_log WHERE created_at > NOW() - INTERVAL '1 hour';

-- Cache expiry (monitor TTL health)
SELECT COUNT(*) FROM pds_posts WHERE expires_at < NOW() + INTERVAL '1 hour';
```

### Alerts to Set Up
- **CRITICAL**: Any POST to external domain (block_reason = OUTBOUND_DOMAIN_BLOCKED)
- **HIGH**: >100 blocks per hour
- **MEDIUM**: Verification failure spike
- **LOW**: Cache hit rate <80%

## Troubleshooting

### Migration Fails
```bash
# Check PostgreSQL connection
psql -U postgres -d pnptv_db -c "SELECT 1;"

# Check password special chars (quote if needed)
# Review /tmp/migration.log
```

### Privacy Middleware Not Blocking
```bash
# Verify middleware is registered in routes.js (before all routes)
grep -n "FederationPrivacyMiddleware" apps/backend/bot/api/routes.js

# Should appear before other route definitions
# If not, add this near line 20:
# app.use(new FederationPrivacyMiddleware(pool).middleware());
```

### Encryption Key Mismatch
```bash
# All processes must use same FEDERATION_ENCRYPTION_KEY
# Check all files:
grep -r "FEDERATION_ENCRYPTION_KEY" .env*
ecosystem.config.js
docker-compose.yml

# If mismatch, regenerate and update all:
openssl rand -hex 32
```

### Token Decryption Fails
```bash
# Verify token format: iv:authTag:encrypted
# Check encryption key hasn't rotated
# Delete old tokens and re-authenticate
DELETE FROM external_profiles WHERE access_token_encrypted IS NOT NULL;
```

### Feed Preferences Not Saving
```bash
# Check pds_feed_preferences table exists
psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM pds_feed_preferences;"

# Check preferences are being created
SELECT * FROM pds_feed_preferences WHERE pnptv_user_id = 'user-id';
```

## Files to Review

### Critical
- `database/migrations/070_pds_bluesky_element_integration.sql` - Schema
- `apps/backend/bot/middleware/federationPrivacyMiddleware.js` - Privacy!
- `apps/backend/bot/services/BlueskyService.js` - API client

### Important
- `apps/backend/bot/api/routes.js` - Integration point
- `apps/backend/bot/api/controllers/externalProfileController.js` - Endpoints
- `ecosystem.config.js` - Configuration

### Reference
- `PDS_BLUESKY_ELEMENT_INTEGRATION.md` - Full documentation
- `.env.pds-bluesky.example` - Configuration template

## Rollback

If critical issue:
```bash
# 1. Stop app
pm2 stop pnptv-bot

# 2. Revert code
git revert <commit-hash>
npm run build:prime-hub

# 3. Restart (DB stays, data is safe)
pm2 start pnptv-bot

# 4. Verify
curl http://localhost:3001/health
```

Time to rollback: <5 minutes

## Phases

### Phase 1 (COMPLETE ✅)
- Bluesky profile linking
- Profile verification
- Feed preferences
- Privacy enforcement

### Phase 2 (TODO)
- Element/Matrix integration
- Real-time notifications
- Message syncing

### Phase 3 (TODO)
- Combined feed aggregation
- Activity notifications
- Cross-platform discovery

## Key Contacts

- **Questions**: #engineering Slack
- **Issues**: GitHub issues with label `federation`
- **Security concerns**: security@pnptv.app
- **On-Call**: Check Slack #pnptv-oncall

## Useful Commands

```bash
# Check migration status
psql -U postgres -d pnptv_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" | grep -i federation

# Count external profiles
psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM external_profiles;"

# Check blocked requests
psql -U postgres -d pnptv_db -c "SELECT block_reason, COUNT(*) FROM outbound_federation_blocks GROUP BY block_reason;"

# View access logs
tail -f /root/pnptvbot-production/logs/federation/*.log

# Restart with clean slate
pm2 restart pnptv-bot
pm2 logs pnptv-bot
```

## Remember

1. **Privacy first**: If unsure, block outbound access
2. **Always log**: Every external access is logged
3. **Token safety**: Never log, always encrypt
4. **Fail secure**: Errors default to blocking
5. **Database backups**: Before any production work

---

**Last Updated**: 2026-02-21
**Status**: Production Ready
