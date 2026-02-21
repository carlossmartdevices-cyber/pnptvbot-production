# PDS Provisioning Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] All backend files created and reviewed
  - [ ] `PDSProvisioningService.js`
  - [ ] `pdsController.js`
  - [ ] `pdsRoutes.js`
  - [ ] Updated `telegramAuthHandler.js`
  - [ ] Updated `routes.js`
- [ ] All frontend files created and reviewed
  - [ ] `PDSSetup.jsx`
  - [ ] `PDSStatus.jsx`
  - [ ] `DecentralizedIdentity.jsx`
  - [ ] `pdsClient.js`
- [ ] All documentation reviewed
  - [ ] `PDS_PROVISIONING_GUIDE.md`
  - [ ] `PDS_API_EXAMPLES.md`
  - [ ] `.env.pds.example`

### Dependency Check
- [ ] `uuid` package installed: `npm ls uuid`
- [ ] All imports resolve correctly
- [ ] No syntax errors: `npm run lint` (if configured)
- [ ] No missing dependencies

### Database
- [ ] Backup existing database: `pg_dump pnptv_db > backup_$(date +%s).sql`
- [ ] Migration file reviewed: `064_user_pds_mapping.sql`
- [ ] No conflicts with existing schema

### Environment Setup
- [ ] Copy `.env.pds.example` to `.env`
- [ ] Generate encryption key: `head -c 32 /dev/urandom | base64`
- [ ] Set all required variables:
  - [ ] `PDS_PROVISIONING_ENABLED=true`
  - [ ] `PDS_MODE=local|remote|hybrid`
  - [ ] `PDS_DOMAIN=pnptv.app`
  - [ ] `PDS_ENCRYPTION_KEY=<32-byte-base64>`
  - [ ] `PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000` (if local)
  - [ ] `PDS_ADMIN_DID=did:web:admin.pnptv.app` (if local)
  - [ ] `PDS_ADMIN_PASSWORD=<secure-password>` (if local)
  - [ ] `SESSION_SECRET=<unique-secret>`
- [ ] Environment variables are **not** committed to git
- [ ] Variables are safely stored in deployment system

---

## Staging Deployment

### Code Deployment
- [ ] Pull latest code from main branch
- [ ] Install dependencies: `npm install`
- [ ] Build frontend: `npm run build:prime-hub` (if needed)
- [ ] No build errors

### Database Migration
- [ ] Stop application: `pm2 stop pnptv-bot`
- [ ] Run migration: `psql -U postgres -d pnptv_db -f apps/backend/migrations/064_user_pds_mapping.sql`
- [ ] Verify tables created:
  ```bash
  psql -U postgres -d pnptv_db -c "\dt user_pds_mapping pds_*"
  ```
- [ ] All 5 tables present and indexed
- [ ] No migration errors in logs

### Configuration
- [ ] `.env` updated with all PDS variables
- [ ] Encryption key is strong and unique
- [ ] Paths are absolute and correct
- [ ] No hardcoded values in code

### PDS Infrastructure (if local mode)
- [ ] Local PDS server running/accessible
  ```bash
  curl -v http://127.0.0.1:3000/.well-known/atproto-did
  ```
- [ ] PDS server responding to requests
- [ ] Admin credentials working
- [ ] Network connectivity verified
- [ ] Firewall rules allow app ↔ PDS communication

### Application Start
- [ ] Start application: `npm start` or `pm2 start ecosystem.config.js`
- [ ] Check logs for errors: `pm2 logs pnptv-bot | head -50`
- [ ] Health check passes: `curl http://localhost:3001/health`
- [ ] No PDS-related errors in logs

### Initial Testing
- [ ] Run test suite: `bash scripts/test-pds-provisioning.sh`
- [ ] All tests pass
- [ ] No database connection errors
- [ ] Routes registered correctly

### Manual Testing
- [ ] Authenticate with test account
- [ ] GET `/api/pds/info` returns correct format
- [ ] GET `/api/pds/health` works
- [ ] Check database for records created
- [ ] View logs for PDS provisioning messages

### Load Testing
- [ ] Test with 5 concurrent users
- [ ] Test with 20 concurrent requests
- [ ] Monitor CPU/memory usage
- [ ] No database connection pool exhaustion
- [ ] Response times acceptable

### Monitoring Setup
- [ ] PDS logs being captured
- [ ] Error alerts configured
- [ ] Database metrics monitored
- [ ] Sentry/monitoring integrated (if used)

---

## Production Deployment

### Pre-Production Review
- [ ] Security audit completed
  - [ ] No credentials in logs
  - [ ] Encryption working correctly
  - [ ] SQL injection protections in place
  - [ ] Rate limiting configured
- [ ] Performance testing passed
  - [ ] Response times <1s typical
  - [ ] No memory leaks
  - [ ] Database queries optimized
- [ ] Documentation complete and accurate

### Backup & Rollback Plan
- [ ] Full database backup taken
  ```bash
  pg_dump -U postgres pnptv_db > pnptv_prod_backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Backup verified: `pg_restore -l <backup_file> | head`
- [ ] Rollback procedure documented
- [ ] Rollback script prepared
- [ ] Team trained on rollback

### Production Database Migration
- [ ] Scheduled during maintenance window
- [ ] Database backups verified
- [ ] Migration command ready:
  ```bash
  psql -U postgres -d pnptv_db -f apps/backend/migrations/064_user_pds_mapping.sql
  ```
- [ ] Post-migration verification queries ready
- [ ] Support team on standby

### Code Deployment to Production
- [ ] Code tagged with version: `git tag -a v1.0.0-pds`
- [ ] Tag pushed to repository
- [ ] Deployment script prepared
- [ ] Staging environment passes all tests
- [ ] Production environment prepared
- [ ] No uncommitted changes

### Configuration Management
- [ ] `.env` updated with production values
- [ ] Encryption key is production-grade and unique
- [ ] PDS mode set appropriately (local/remote/hybrid)
- [ ] Health check interval set to 60 minutes
- [ ] Alert thresholds configured
- [ ] Configuration NOT in version control
- [ ] Configuration backed up securely

### PDS Infrastructure (Production)
- [ ] PDS server(s) deployed and healthy
- [ ] Network connectivity verified
- [ ] Firewall rules allowing traffic
- [ ] SSL/TLS certificates valid (if using)
- [ ] Load balancer configured (if applicable)
- [ ] Redundancy/failover setup complete

### Application Deployment
- [ ] Application code deployed
- [ ] Dependencies installed
- [ ] Frontend rebuilt: `npm run build:prime-hub`
- [ ] Application started: `pm2 start ecosystem.config.js --env production`
- [ ] No startup errors in logs

### Post-Deployment Verification
- [ ] Health endpoint responding: `curl https://pnptv.app/health`
- [ ] Telegram login working
- [ ] PDS provisioning happening in background
- [ ] No errors in application logs
- [ ] Database queries executing normally
- [ ] PDS endpoints accessible

### Monitoring & Alerts
- [ ] PDS health checks running
- [ ] Error logs being monitored
- [ ] Database performance monitored
- [ ] Alert notifications working
- [ ] Team receives alerts
- [ ] Dashboard showing PDS metrics

### User Communication
- [ ] Release notes published
- [ ] Users notified of new PDS feature
- [ ] Documentation available on website
- [ ] Support team trained
- [ ] FAQ updated
- [ ] No unexpected breaks for users

---

## Post-Deployment (24 Hours)

### Monitoring
- [ ] Zero critical errors in logs
- [ ] PDS provisioning succeeding for all new users
- [ ] Health checks passing
- [ ] Response times normal
- [ ] Database size normal (not growing unexpectedly)
- [ ] CPU/memory usage normal

### Data Quality
- [ ] Users have PDS mapping created
  ```bash
  psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM user_pds_mapping;"
  ```
- [ ] Provisioning log entries exist
  ```bash
  psql -U postgres -d pnptv_db -c "SELECT COUNT(*) FROM pds_provisioning_log;"
  ```
- [ ] No corrupted data
- [ ] No orphaned records

### User Feedback
- [ ] No user complaints
- [ ] Support tickets reviewed
- [ ] No widespread issues reported
- [ ] Feature being used as expected

### Performance Review
- [ ] Response times still acceptable
- [ ] No database slowdowns
- [ ] Memory usage stable
- [ ] Disk usage normal
- [ ] Network bandwidth normal

---

## Post-Deployment (7 Days)

### Extended Monitoring
- [ ] 7-day success rate >99%
- [ ] No recurring errors
- [ ] All health checks passing
- [ ] PDS encryption working reliably
- [ ] Backup/retention working correctly
- [ ] Key rotation logic sound

### Optimization
- [ ] Database query performance reviewed
- [ ] Indexes being used effectively
- [ ] Cache hit rates acceptable
- [ ] Connection pool size appropriate
- [ ] Any slow queries optimized

### Documentation
- [ ] Documentation updated with learnings
- [ ] Team knowledge base updated
- [ ] Runbook created for common issues
- [ ] Troubleshooting guide enhanced

### Feature Completeness
- [ ] All promised features working
- [ ] Frontend components displaying correctly
- [ ] All API endpoints functional
- [ ] Error messages clear and helpful

### Security Review
- [ ] Encryption verified working
- [ ] Credentials not exposed in logs
- [ ] Audit trail intact
- [ ] Access controls working
- [ ] No security incidents

---

## Post-Deployment (30 Days)

### Full System Review
- [ ] 30-day uptime >99.9%
- [ ] Zero security incidents
- [ ] Performance baselines established
- [ ] Cost of infrastructure measured
- [ ] Scalability verified

### Feature Adoption
- [ ] % of users with active PDS
- [ ] PDS feature usage metrics
- [ ] User satisfaction measured
- [ ] Feedback incorporated

### Maintenance Plan
- [ ] Health check interval appropriate
- [ ] Key rotation process working
- [ ] Backup retention working
- [ ] Audit log cleanup running
- [ ] Database maintenance scheduled

### Future Planning
- [ ] Next features identified
- [ ] Known limitations documented
- [ ] Technical debt addressed
- [ ] Infrastructure improvements planned

---

## Rollback Procedure (If Needed)

### Decision Point
- [ ] Critical error identified: _______________
- [ ] Severity Level: CRITICAL / HIGH / MEDIUM
- [ ] Approval to rollback obtained from: _______________
- [ ] Time to initiate rollback: _______________

### Rollback Steps
1. [ ] Stop application: `pm2 stop pnptv-bot`
2. [ ] Revert code to previous version
3. [ ] Update `.env` with previous configuration
4. [ ] Restore database from backup:
   ```bash
   dropdb pnptv_db
   createdb pnptv_db
   pg_restore -d pnptv_db <backup_file>
   ```
5. [ ] Verify database integrity
6. [ ] Start application: `npm start`
7. [ ] Run health checks
8. [ ] Notify team and users
9. [ ] Document incident: _______________

### Post-Rollback Analysis
- [ ] Root cause identified
- [ ] Fix prepared and tested
- [ ] Timeline for re-deployment: _______________
- [ ] Lessons learned documented

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps Lead | _____________ | _____________ | _____________ |
| Backend Lead | _____________ | _____________ | _____________ |
| QA Lead | _____________ | _____________ | _____________ |
| Product Manager | _____________ | _____________ | _____________ |

---

## Notes & Issues

```
Space for deployment notes, issues encountered, and resolutions:


```

---

## Related Documents

- [PDS Provisioning Guide](./PDS_PROVISIONING_GUIDE.md)
- [API Examples](./PDS_API_EXAMPLES.md)
- [Environment Variables](./. env.pds.example)
- [Database Migration](./apps/backend/migrations/064_user_pds_mapping.sql)
