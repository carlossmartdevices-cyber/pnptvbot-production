# PDS Bluesky and Element Integration Implementation Checklist

## Phase 1: Bluesky Integration (CURRENT - In Development)

### Database & Schema
- [x] Migration file created: `database/migrations/070_pds_bluesky_element_integration.sql`
- [x] External profiles table with verification support
- [x] PDS posts cache table with 24h TTL
- [x] Feed preferences table
- [x] Element room tables (structure only)
- [x] Federated access log table (audit trail)
- [x] Outbound federation blocks table (forensics)
- [x] Encryption key management table
- [ ] Run migration on development DB
- [ ] Run migration on staging DB
- [ ] Run migration on production DB

### Backend Services
- [x] BlueskyService (`apps/backend/bot/services/BlueskyService.js`)
  - [x] Read-only XRPC method validation
  - [x] Handle resolution (handle → DID)
  - [x] Profile fetching with caching
  - [x] Feed ingestion
  - [x] Post search
  - [x] Post caching with TTL
  - [x] Verification challenge generation
  - [x] Access logging
  - [ ] Redis caching integration
  - [ ] Bluesky signature verification

- [x] ExternalProfileService (`apps/backend/bot/services/ExternalProfileService.js`)
  - [x] Link profiles
  - [x] Fetch linked profiles
  - [x] Profile metadata sync
  - [x] Privacy settings management
  - [x] Profile unlinking
  - [x] Feed preferences management
  - [x] Mute/block users
  - [x] Get user's feed

- [x] FederationPrivacyMiddleware (`apps/backend/bot/middleware/federationPrivacyMiddleware.js`)
  - [x] Blocked domain list
  - [x] Dangerous HTTP method blocking
  - [x] Federation header detection
  - [x] Privilege escalation detection
  - [x] Webhook signature validation (skeleton)
  - [x] Outbound block logging
  - [ ] Test with real requests

### API Endpoints
- [x] ExternalProfileController (`apps/backend/bot/api/controllers/externalProfileController.js`)
  - [x] GET /api/webapp/profile/external
  - [x] POST /api/webapp/profile/external/link
  - [x] POST /api/webapp/profile/external/:id/verify
  - [x] PATCH /api/webapp/profile/external/:id
  - [x] DELETE /api/webapp/profile/external/:id
  - [x] GET /api/webapp/feed/preferences
  - [x] PUT /api/webapp/feed/preferences
  - [x] POST /api/webapp/feed/mute
  - [x] POST /api/webapp/feed/block
  - [x] GET /api/webapp/feed/bluesky

- [x] ExternalProfileRoutes (`apps/backend/bot/api/routes/externalProfileRoutes.js`)
  - [x] All route definitions
  - [x] Authentication middleware
  - [ ] Integration with main routes.js

### Frontend Components
- [x] ExternalProfileCard (`webapps/prime-hub/src/components/ExternalProfileCard.jsx`)
  - [x] Profile display
  - [x] Privacy settings UI
  - [x] Unlink button
  - [x] Service-specific styling

- [x] ExternalProfileLinking (`webapps/prime-hub/src/components/ExternalProfileLinking.jsx`)
  - [x] Two-step linking flow
  - [x] Profile search
  - [x] Verification challenge display
  - [x] Signed challenge submission
  - [ ] Bluesky OAuth integration (Phase 1.5)

- [ ] Profile card integration (show linked profiles)
- [ ] Feed components (display Bluesky posts)
- [ ] Settings page (privacy controls)

### Integration & Wiring
- [ ] Update `apps/backend/bot/api/routes.js`:
  - [ ] Import FederationPrivacyMiddleware
  - [ ] Register middleware before other routes
  - [ ] Import externalProfileRoutes
  - [ ] Register profile routes
  - [ ] Register feed routes

- [ ] Update `ecosystem.config.js`:
  - [ ] Add FEDERATION_ENCRYPTION_KEY to env
  - [ ] Add FEDERATION_PRIVACY_ENABLED flag
  - [ ] Add Bluesky API URLs

- [ ] Update `package.json` dependencies:
  - [x] All required packages already installed

### Testing
- [x] Setup script: `scripts/setup-pds-bluesky-integration.sh`
- [x] Test script: `scripts/test-pds-bluesky-integration.sh`
- [ ] Run setup script on development
- [ ] Run unit tests: `npm run test:unit -- externalProfileService`
- [ ] Run integration tests: `npm run test:integration -- externalProfile`
- [ ] Manual testing with curl
- [ ] Postman collection creation
- [ ] Load testing (100 concurrent profile links)

### Documentation
- [x] Main documentation: `PDS_BLUESKY_ELEMENT_INTEGRATION.md`
- [x] API documentation (in main doc)
- [x] Environment variables example: `.env.pds-bluesky.example`
- [x] Deployment guide (in main doc)
- [x] Security considerations (in main doc)
- [x] Troubleshooting guide (in main doc)
- [x] This checklist

### Security Audit
- [ ] Review middleware for bypass vulnerabilities
- [ ] Test encryption key rotation
- [ ] Verify token encryption/decryption
- [ ] Test webhook signature verification
- [ ] Load test rate limiting
- [ ] SQL injection testing on federated_access_log
- [ ] XSRF/CSRF protection
- [ ] Privilege escalation attempts
- [ ] Data exfiltration attempts

### Performance
- [ ] Benchmark external profile fetch (target: <2s)
- [ ] Benchmark post caching (target: <500ms for 50 posts)
- [ ] Benchmark feed preferences update (target: <100ms)
- [ ] Memory usage with 1000 cached posts
- [ ] Database query optimization
- [ ] Redis caching impact

---

## Phase 2: Element/Matrix Integration

### Database & Schema
- [ ] Element rooms table (columns, indices, constraints)
- [ ] Element room membership table
- [ ] Message cache table (for chat history)
- [ ] Element sync state table (token tracking)

### Backend Services
- [ ] ElementService (read-only Matrix client)
  - [ ] Room list fetching
  - [ ] Room join/leave management
  - [ ] Message fetching
  - [ ] User presence tracking
  - [ ] Sync token management
  - [ ] E2E encryption support (optional)

### API Endpoints
- [ ] GET /api/webapp/rooms/element
- [ ] POST /api/webapp/rooms/element/join
- [ ] DELETE /api/webapp/rooms/element/:roomId/leave
- [ ] GET /api/webapp/rooms/element/:roomId/messages
- [ ] POST /api/webapp/rooms/element/:roomId/message (inbound only)

### Frontend Components
- [ ] ElementRoomCard
- [ ] ElementChatView
- [ ] ElementRoomBrowser
- [ ] Message display component

### WebSocket Integration
- [ ] Real-time message sync
- [ ] Presence updates
- [ ] Typing indicators

---

## Phase 3: Advanced Features

### Feed Aggregation
- [ ] Combined feed with Bluesky + pnptv posts
- [ ] Smart ordering algorithms
- [ ] Trending topic detection
- [ ] Recommendation engine

### Notifications
- [ ] "X posted on Bluesky" notifications
- [ ] New follower notifications (from external)
- [ ] Mention notifications
- [ ] Element room activity notifications

### Analytics
- [ ] Track engagement with external content
- [ ] Most viewed Bluesky posts
- [ ] User engagement heatmap
- [ ] Feed performance metrics

### Discovery
- [ ] "Find people on Bluesky" feature
- [ ] Cross-platform reputation
- [ ] Trending Bluesky posts in pnptv
- [ ] Hashtag federation

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] All code reviewed and approved
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security audit completed
- [ ] Load testing completed (acceptable performance)
- [ ] Documentation complete and reviewed
- [ ] Rollback plan documented

### Deployment Steps
1. [ ] Run migration on production DB
2. [ ] Deploy code update
3. [ ] Verify middleware is active
4. [ ] Verify routes are registered
5. [ ] Monitor for errors (first 30 minutes)
6. [ ] Test endpoints with real users
7. [ ] Monitor database performance
8. [ ] Monitor API response times
9. [ ] Check audit logs for unexpected activity

### Post-Deployment
- [ ] User communication (what's new)
- [ ] Documentation published
- [ ] Support team trained
- [ ] Monitoring dashboards created
- [ ] Weekly security audit scheduled
- [ ] Monthly performance review

---

## Known Issues & TODOs

### BlueskyService
- [ ] TODO: Implement Redis caching (lines marked in code)
- [ ] TODO: Implement Bluesky signature verification
- [ ] TODO: Handle pagination for large result sets
- [ ] TODO: Add retry logic with exponential backoff
- [ ] ISSUE: Profile fetch may fail if handle doesn't exist (needs better error handling)

### ExternalProfileService
- [ ] TODO: Add user quotas (max profiles per user)
- [ ] TODO: Implement auto-sync of profile metadata
- [ ] TODO: Add cleanup job for expired verification tokens

### FederationPrivacyMiddleware
- [ ] TODO: Implement webhook signature verification
- [ ] TODO: Add IP-based rate limiting
- [ ] TODO: Handle request body streaming

### Frontend Components
- [ ] TODO: Add error boundary
- [ ] TODO: Add loading skeleton
- [ ] TODO: Optimize re-renders
- [ ] TODO: Add keyboard navigation

---

## Sign-Off

- [ ] Code review completed by: ___________________ Date: ___________
- [ ] Security audit completed by: ___________________ Date: ___________
- [ ] Testing completed by: ___________________ Date: ___________
- [ ] Documentation approved by: ___________________ Date: ___________
- [ ] Production deployed by: ___________________ Date: ___________

---

## Deployment History

| Date | Environment | Version | Status | Notes |
|------|-------------|---------|--------|-------|
|      | Development | 1.0     |        |       |
|      | Staging     | 1.0     |        |       |
|      | Production  | 1.0     |        |       |

---

## Rollback Instructions

If deployment fails or issues arise:

```bash
# 1. Stop the application
pm2 stop pnptv-bot

# 2. Rollback code to previous version
git revert <commit-hash>

# 3. Downgrade database (if migration has rollback)
psql -U postgres -d pnptv_db -c "BEGIN; ROLLBACK;" # Manual rollback needed

# 4. Restart application
pm2 start pnptv-bot

# 5. Notify team and review logs
```

Note: Database rollback must be implemented manually as needed. Consider backup restore if migration is not reversible.

---

## Contact & Escalation

- **Primary**: Engineering Lead
- **Secondary**: DevOps Engineer
- **Escalation**: VP Engineering
- **On-Call**: Check Slack #pnptv-oncall

---

**Last Updated**: 2026-02-21
**Next Review**: 2026-03-21
