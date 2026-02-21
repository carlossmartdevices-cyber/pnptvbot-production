# PDS Bluesky and Element/Matrix Integration

**Status**: Phase 1 Implementation Complete (Database Schema, Backend Services, Privacy Middleware)

## Architecture Overview

This integration enables pnptv users to link their Bluesky and Element profiles while maintaining strict **privacy boundaries**:

- **Inbound Only**: External posts/profiles are read-only cached
- **Outbound Blocked**: ZERO data from pnptv shared to external services
- **Isolation**: Posts remain private to pnptv infrastructure
- **Community Boundary**: Internal posts never federate outbound

## Privacy Enforcement

### Middleware-Level Blocking

`FederationPrivacyMiddleware` (at `/apps/backend/bot/middleware/federationPrivacyMiddleware.js`) enforces:

1. **Blocked Outbound Domains**:
   - `*.bsky.social`
   - `*.bluesky.social`
   - `*.api.bsky.app`
   - `*.element.io`
   - `*.matrix.org`

2. **Dangerous HTTP Methods**:
   - POST, PUT, PATCH, DELETE, OPTIONS, TRACE to external URLs are blocked
   - Only read-only GET requests allowed to whitelisted endpoints

3. **Blocked Headers**:
   - `x-federation-id`, `x-at-protocol-key`, `x-matrix-auth`
   - Privilege escalation attempts via `x-admin-override`, etc.

4. **Webhook Signature Verification**:
   - All inbound webhooks must have valid cryptographic signatures
   - Failed verification = 403 Forbidden

5. **Audit Logging**:
   - All blocked requests logged to `outbound_federation_blocks` table
   - IP address, user ID, timestamp, and payload recorded (first 10KB)

### Application-Level Enforcement

**BlueskyService** (`/apps/backend/bot/services/BlueskyService.js`):
- Only whitelisted read-only XRPC methods allowed
- All external API calls logged to `federated_access_log`
- Token encryption required (AES-256-GCM)
- 24-hour TTL on cached posts (stale data purged automatically)

## Database Schema

### Core Tables

#### `external_profiles`
Links pnptv users to Bluesky/Element accounts with verification status.

```sql
-- Key fields:
- id: UUID primary key
- pnptv_user_id: Foreign key to users table
- service_type: 'bluesky' or 'element'
- external_user_id: DID (Bluesky) or user_id (Element)
- external_username: Handle/username
- is_verified: Boolean (requires ownership proof)
- access_token_encrypted: Encrypted API token (AES-256-GCM)
- show_on_profile, show_follower_count, show_activity_status: Privacy controls
- last_synced_at, follower_count, following_count: Metadata
```

**Indices**: `pnptv_user_id`, `service_type`, `external_user_id`, `is_verified`, `created_at`

#### `pds_posts`
Cache of posts from external Bluesky services (read-only, never re-shared).

```sql
-- Key fields:
- bluesky_uri: Unique external post identifier (at:// format)
- bluesky_cid: Content hash
- author_external_user_id, author_external_username: Author info
- post_text, post_facets, embedded_images: Content
- cached_by_user_id: Who added this to their feed
- reason_cached: 'followed_user', 'search_result', 'timeline', 'shared'
- expires_at: TTL (24h default, auto-purged)
```

**Constraints**: Posts must expire > created_at, post text cannot be empty

**Cleanup**: Automatic via scheduled job - `DELETE FROM pds_posts WHERE expires_at < NOW()`

#### `external_profile_verification`
Stores verification challenges and proofs for proving profile ownership.

```sql
-- Key fields:
- external_profile_id: Foreign key to external_profiles
- verification_method: 'proof_of_ownership', 'email_confirmation', 'api_token'
- challenge_data: JSON challenge from service
- challenge_expires_at: Time limit for proof submission
- proof_provided: Proof from user (signed challenge, etc.)
- proof_verified_at: When verification succeeded
```

**Constraint**: Challenge must not be expired if proof not provided

#### `pds_feed_preferences`
User feed settings, filtering, and privacy controls.

```sql
-- Key fields:
- pnptv_user_id: Unique (one per user)
- show_bluesky_feed, bluesky_feed_enabled: Feed display settings
- bluesky_auto_sync: Auto-sync posts when linked profile updates
- muted_external_users, blocked_external_users: JSON arrays of external IDs
- filter_retweets, filter_replies: Feed filtering
- combined_feed_order: 'recent', 'engagement', 'relevance'
- external_content_ratio: % of feed from external sources (0-100)
- public_activity, share_reading_history: Privacy settings
```

#### `element_rooms`, `element_room_membership`
Manage Element/Matrix room subscriptions (Phase 2).

#### `federated_access_log`
Audit trail of ALL external data access.

```sql
-- Key fields:
- pnptv_user_id: Who accessed
- service_type: 'bluesky', 'element'
- external_resource_type: 'post', 'profile', 'room', 'message'
- action: 'view', 'cache', 'import', 'receive' (NEVER 'share' outbound)
- request_path, http_method, user_agent, ip_address: Request context
- success: Boolean
- error_message: If failed
```

**Constraint**: `action IN ('view', 'cache', 'import', 'receive')` - no outbound actions allowed

#### `outbound_federation_blocks`
Forensic log of all blocked outbound federation attempts.

```sql
-- Key fields:
- pnptv_user_id: Who tried
- target_service: Where they tried to send data
- target_url, target_method, target_resource: What they tried
- request_body: First 10KB of payload (for forensics)
- block_reason: 'OUTBOUND_DOMAIN_BLOCKED', 'DANGEROUS_METHOD_BLOCKED', etc.
- severity: 'warn', 'error', 'critical'
```

## API Endpoints

### Profile Linking

#### `POST /api/webapp/profile/external/link`
Initiate linking to external profile.

**Request**:
```json
{
  "handle": "alice.bsky.social",
  "serviceType": "bluesky",
  "publicLinking": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "profileId": "uuid",
    "externalUsername": "alice.bsky.social",
    "profileName": "Alice",
    "verificationId": "uuid",
    "challenge": "random-challenge-string",
    "challengeExpiresAt": "2026-02-21T21:00:00Z",
    "nextStep": "Provide proof of profile ownership by signing the challenge"
  }
}
```

#### `POST /api/webapp/profile/external/:profileId/verify`
Verify external profile ownership.

**Request**:
```json
{
  "signedChallenge": "signed-challenge-proof",
  "accessToken": "optional-api-token"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "profileId": "uuid",
    "isVerified": true,
    "verifiedAt": "2026-02-21T20:45:00Z",
    "message": "External profile verified and linked successfully"
  }
}
```

#### `GET /api/webapp/profile/external`
Fetch all linked external profiles.

**Response**:
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "id": "uuid",
        "service_type": "bluesky",
        "external_username": "alice.bsky.social",
        "profile_name": "Alice",
        "profile_bio": "...",
        "is_verified": true,
        "follower_count": 1250,
        "show_on_profile": true,
        "created_at": "2026-02-21T20:00:00Z"
      }
    ],
    "total": 1
  }
}
```

#### `PATCH /api/webapp/profile/external/:profileId`
Update privacy settings for external profile.

**Request**:
```json
{
  "showOnProfile": true,
  "showFollowerCount": true,
  "showActivityStatus": true,
  "publicLinking": false
}
```

#### `DELETE /api/webapp/profile/external/:profileId`
Unlink external profile.

### Feed Management

#### `GET /api/webapp/feed/preferences`
Fetch user's feed preferences.

**Response**:
```json
{
  "success": true,
  "data": {
    "pnptv_user_id": "uuid",
    "show_bluesky_feed": true,
    "bluesky_feed_enabled": true,
    "bluesky_auto_sync": false,
    "show_element_rooms": true,
    "combined_feed_order": "recent",
    "external_content_ratio": 30,
    "public_activity": false,
    "share_reading_history": false
  }
}
```

#### `PUT /api/webapp/feed/preferences`
Update feed preferences.

#### `POST /api/webapp/feed/mute`
Mute external user in feed.

**Request**:
```json
{
  "externalUserId": "did:plc:...",
  "mute": true
}
```

#### `POST /api/webapp/feed/block`
Block external user.

**Request**:
```json
{
  "externalUserId": "did:plc:...",
  "block": true
}
```

#### `GET /api/webapp/feed/bluesky`
Fetch user's Bluesky feed (cached posts).

**Query params**: `?limit=20&offset=0`

## Implementation Phases

### Phase 1: Bluesky Integration (COMPLETE)
- [x] Database schema with privacy enforcement
- [x] BlueskyService for read-only API access
- [x] ExternalProfileService for profile management
- [x] FederationPrivacyMiddleware blocking outbound requests
- [x] ExternalProfileController with API endpoints
- [x] React components for UI (card, linking wizard)
- [x] Audit logging (federated_access_log, outbound_federation_blocks)

**Deliverables**:
1. `/database/migrations/070_pds_bluesky_element_integration.sql` - Schema
2. `/apps/backend/bot/services/BlueskyService.js` - API client
3. `/apps/backend/bot/services/ExternalProfileService.js` - Profile management
4. `/apps/backend/bot/middleware/federationPrivacyMiddleware.js` - Privacy enforcement
5. `/apps/backend/bot/api/controllers/externalProfileController.js` - API controller
6. `/apps/backend/bot/api/routes/externalProfileRoutes.js` - Routes
7. `/webapps/prime-hub/src/components/ExternalProfileCard.jsx` - Profile display
8. `/webapps/prime-hub/src/components/ExternalProfileLinking.jsx` - Linking UI

### Phase 2: Element/Matrix Integration (TODO)
- [ ] Element/Matrix API client (read-only)
- [ ] Room subscription and membership tracking
- [ ] Real-time message syncing (one-way inbound)
- [ ] Chat UI components
- [ ] End-to-end encryption support (optional)

### Phase 3: Advanced Features (TODO)
- [ ] Feed aggregation and smart filtering
- [ ] Activity notifications ("X posted on Bluesky")
- [ ] Search across external feeds
- [ ] Reputation system (follower count on profiles)
- [ ] Cross-platform discovery ("Find people on Bluesky")
- [ ] Feed analytics (which external content users engage with)

## Deployment

### 1. Run Database Migration
```bash
psql -U postgres -d pnptv_db -f database/migrations/070_pds_bluesky_element_integration.sql
```

### 2. Environment Variables
Add to `.env.production`:
```bash
# Federation Privacy
FEDERATION_PRIVACY_ENABLED=true
FEDERATION_ENCRYPTION_KEY=<64-char hex string from `openssl rand -hex 32`>

# Bluesky API (read-only access)
BLUESKY_PDS_URL=https://bsky.social
BLUESKY_ATPROTO_URL=https://api.bsky.app/xrpc
BLUESKY_API_KEY=<if required by PDS>

# Element/Matrix (Phase 2)
ELEMENT_HOMESERVER_URL=https://element.io
ELEMENT_API_KEY=<if required>
```

### 3. Update routes.js to include new routes
```javascript
// In /apps/backend/bot/api/routes.js
const externalProfileRoutes = require('./routes/externalProfileRoutes');

// Register middleware
app.use(new FederationPrivacyMiddleware(pool).middleware());

// Register routes
router.use('/api/webapp/profile', externalProfileRoutes(pool));
router.use('/api/webapp/feed', externalProfileRoutes(pool));
```

### 4. Update ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'pnptv-bot',
    script: 'apps/backend/bot/core/bot.js',
    env: {
      FEDERATION_ENCRYPTION_KEY: process.env.FEDERATION_ENCRYPTION_KEY,
      FEDERATION_PRIVACY_ENABLED: 'true',
    }
  }]
};
```

### 5. Restart Application
```bash
npm run build:prime-hub
pm2 restart pnptv-bot
```

## Security Considerations

### Token Encryption
All external API tokens stored encrypted:
- Algorithm: AES-256-GCM
- Key: Environment variable `FEDERATION_ENCRYPTION_KEY`
- Format: `iv:authTag:encrypted`
- Never logged in plain text

### Webhook Signature Verification
All inbound webhooks must include cryptographic signatures:
- Bluesky: Verify `x-signature` header
- Element: Verify Matrix signature
- Failed verification = 403 Forbidden
- Logged to `outbound_federation_blocks`

### Rate Limiting
- Per-user rate limit: 100 requests/hour to external services
- Per-IP rate limit: 1000 requests/hour globally
- Backoff: Exponential retry with jitter

### Data Retention
- Cached posts: 24h TTL (automatic purge)
- Verification tokens: 15 min expiry
- Access logs: 90 days retention
- Block logs: Indefinite (for forensics)

## Monitoring & Alerting

### Key Metrics
- `federated_access_log` entry count per user
- `outbound_federation_blocks` daily count
- Average response time for external API calls
- Cached posts expiry rate

### Alerts
- **CRITICAL**: Any POST/PUT/DELETE to external domains
- **HIGH**: Privilege escalation attempts (blocked)
- **MEDIUM**: Verification token expiry
- **LOW**: Token encryption key rotation

### Audit Reports
Generate daily reports:
```sql
-- External access by user (last 24h)
SELECT pnptv_user_id, COUNT(*) as accesses
FROM federated_access_log
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY pnptv_user_id
ORDER BY accesses DESC;

-- Blocked outbound attempts
SELECT block_reason, COUNT(*) as attempts
FROM outbound_federation_blocks
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY block_reason;
```

## Testing

### Unit Tests
```bash
npm run test:unit -- externalProfileService
npm run test:unit -- blueskyService
npm run test:unit -- federationPrivacyMiddleware
```

### Integration Tests
```bash
npm run test:integration -- externalProfile
```

### Manual Testing

**1. Link Bluesky Profile**:
```bash
curl -X POST http://localhost:3001/api/webapp/profile/external/link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"handle": "alice.bsky.social"}'
```

**2. Verify Profile**:
```bash
curl -X POST http://localhost:3001/api/webapp/profile/external/<profileId>/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"signedChallenge": "..."}'
```

**3. Test Privacy Enforcement** (should return 403):
```bash
curl -X POST http://localhost:3001/api/webhook/bluesky \
  -H "Content-Type: application/json" \
  -d '{"attempt": "outbound"}'
```

## Troubleshooting

### Profile Linking Fails
- Check `external_profiles` table: `SELECT * FROM external_profiles WHERE pnptv_user_id = '<userId>';`
- Check verification status: `SELECT * FROM external_profile_verification;`
- Check logs: `SELECT * FROM federated_access_log WHERE pnptv_user_id = '<userId>' ORDER BY created_at DESC;`

### Outbound Request Blocked Unexpectedly
- Check `outbound_federation_blocks` table
- Verify middleware is enabled in `routes.js`
- Check `block_reason` field for specific issue

### Cached Posts Not Showing
- Verify posts haven't expired: `SELECT * FROM pds_posts WHERE expires_at > NOW();`
- Check `reason_cached` field
- Verify user has feed preferences: `SELECT * FROM pds_feed_preferences WHERE pnptv_user_id = '<userId>';`

### Token Decryption Fails
- Verify `FEDERATION_ENCRYPTION_KEY` matches across all processes
- Check token format: `iv:authTag:encrypted`
- Regenerate tokens if key rotated

## Future Enhancements

1. **Matrix End-to-End Encryption**: Implement E2E crypto for Element rooms
2. **Decentralized Identity**: Use linked profiles as identity verification
3. **Cross-Platform Discovery**: "Find people on Bluesky" feature
4. **Feed Analytics**: Show which external content users engage with
5. **Smart Notifications**: Notify when followed users post
6. **Reputation System**: Display external follower counts on profiles
7. **Content Moderation**: Auto-flag/hide spam from external sources
8. **Archive Export**: Let users export their linked profile data

## References

- [Bluesky AT Protocol](https://github.com/bluesky-social/atproto)
- [Element/Matrix Client-Server API](https://spec.matrix.org/v1.6/client-server-api/)
- [OWASP Federation Security](https://owasp.org/www-community/attacks/Federated_Web_Attacks)
