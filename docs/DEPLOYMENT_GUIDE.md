# 🚀 COMPREHENSIVE DEPLOYMENT GUIDE

**Project**: PNPtv Geolocation System (Phase 1-4)
**Status**: Production Ready
**Last Updated**: February 13, 2026

---

## 📋 TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Post-Deployment Validation](#post-deployment-validation)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
6. [Rollback Procedures](#rollback-procedures)

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Code Quality
- [ ] All code committed to git
- [ ] No console.log() statements left (except intentional logging)
- [ ] No hardcoded credentials in code
- [ ] All FIXME/TODO comments resolved
- [ ] Code follows project standards

### Testing
- [ ] All unit tests passing: `npm run test:unit`
- [ ] All E2E tests passing: `npm run test:e2e`
- [ ] Load tests executed: `bash run-all-load-tests.sh`
- [ ] Performance targets met:
  - [ ] p95 response time < 500ms
  - [ ] Error rate < 1%
  - [ ] Throughput > 100 RPS
  - [ ] Redis queries < 50ms
  - [ ] PostgreSQL queries < 200ms

### Dependencies
- [ ] All npm packages up to date: `npm audit`
- [ ] No critical vulnerabilities
- [ ] package-lock.json committed
- [ ] All optional dependencies installed

### Configuration
- [ ] .env file configured with all required variables
- [ ] Database URL verified
- [ ] Redis connection tested
- [ ] Telegram bot token configured
- [ ] All API keys valid and accessible
- [ ] SSL certificates ready (production)
- [ ] JWT secret secure (32+ characters)

### Database
- [ ] Database migrations tested: `npm run migrate`
- [ ] PostGIS extension installed: `CREATE EXTENSION postgis;`
- [ ] Spatial indices created
- [ ] Connection pooling configured
- [ ] Backup created: `pg_dump pnptvbot > backup_$(date +%s).sql`

### Documentation
- [ ] README.md updated
- [ ] API documentation complete
- [ ] Deployment guide (this file) reviewed
- [ ] Troubleshooting guide prepared
- [ ] Runbooks created for ops team

### Security
- [ ] All secrets in .env (not in code)
- [ ] HTTPS/TLS configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF tokens configured

### Performance
- [ ] Database indices optimized
- [ ] Query plans reviewed with EXPLAIN ANALYZE
- [ ] Connection pools sized appropriately
- [ ] Caching strategy verified
- [ ] CDN configuration (if applicable)

---

## 🟦 STAGING DEPLOYMENT

### Stage 1: Prepare Staging Environment

```bash
# 1. Clone production database to staging
pg_dump -h prod-db.example.com -U admin pnptvbot | \
  psql -h staging-db.example.com -U admin pnptvbot_staging

# 2. Create staging Redis instance
redis-cli -h staging-redis.example.com FLUSHALL
redis-cli -h staging-redis.example.com CONFIG SET appendonly yes

# 3. Verify connectivity
psql -h staging-db.example.com -U admin -d pnptvbot_staging -c "SELECT 1;"
redis-cli -h staging-redis.example.com PING
```

### Stage 2: Deploy Code to Staging

```bash
# 1. SSH into staging server
ssh deploy@staging.example.com

# 2. Clone repository
cd /opt/pnptv
git clone https://github.com/yourorg/pnptv.git
cd pnptv

# 3. Install dependencies
npm install --production

# 4. Setup environment
cp .env.staging .env
# Edit .env with staging values

# 5. Run migrations
npm run migrate

# 6. Build frontend
cd webapps/nearby
npm install
npm run build
cd ../..
```

### Stage 3: Start Services in Staging

```bash
# 1. Start backend with PM2
pm2 start npm --name "pnptv-bot" -- run dev:bot

# 2. Start monitoring
pm2 monit

# 3. Verify health endpoint
curl http://staging.example.com:3001/health

# 4. Check logs
pm2 logs pnptv-bot
```

### Stage 4: Run Full Test Suite in Staging

```bash
# 1. Run all tests
npm run test

# 2. Run E2E tests
npm run test:e2e

# 3. Run load tests
bash run-all-load-tests.sh

# 4. Performance baseline
curl http://staging.example.com:3001/api/nearby/stats
```

### Stage 5: Manual Testing

Execute testing checklist from: TELEGRAM_INTEGRATION_TESTING.md

```bash
# 1. 8 manual test scenarios
# 2. Error handling verification
# 3. Rate limiting validation
# 4. Privacy feature check
# 5. Telegram integration test
```

### Stage 6: Performance Validation

```bash
# 1. Monitor resources during testing
watch -n 1 'ps aux | grep node'

# 2. Check database performance
psql -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. Monitor Redis memory
redis-cli INFO memory

# 4. Verify no memory leaks
# Run for 1 hour and monitor heap usage
node --expose-gc src/bot/core/bot.js
```

### Stage 7: Staging Sign-Off

- [ ] All tests passing
- [ ] Performance targets met
- [ ] No errors in logs
- [ ] Manual testing complete
- [ ] Security review passed
- [ ] Team sign-off obtained

**Staging is ready for production promotion.**

---

## 🟩 PRODUCTION DEPLOYMENT

### Phase 1: Pre-Production Backup

```bash
# 1. Backup production database
pg_dump -h prod-db.example.com -U admin pnptvbot | \
  gzip > /backups/pnptvbot_pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Backup Redis data
redis-cli -h prod-redis.example.com BGSAVE
redis-cli -h prod-redis.example.com LASTSAVE

# 3. Record current version
git log -1 --oneline > /backups/deployed_version.txt

# 4. Verify backups
ls -lah /backups/pnptvbot_pre_deploy_*
```

### Phase 2: Blue-Green Deployment

**Option A: Zero-Downtime Deployment**

```bash
# 1. Start new version on blue environment
ENVIRONMENT=blue npm run start &

# 2. Run smoke tests against blue
curl http://blue.example.com:3001/health

# 3. Switch load balancer to blue
nginx -s reload  # or update load balancer config

# 4. Monitor metrics
watch -n 5 'curl http://prod.example.com:3001/api/nearby/stats'

# 5. If issues, switch back to green
# Update load balancer back to green
```

**Option B: Rolling Deployment**

```bash
# 1. Deploy to server 1 (25% traffic)
ssh deploy@prod1.example.com
cd /opt/pnptv && git pull origin main
npm install --production
npm run migrate
pm2 restart pnptv-bot

# 2. Monitor and verify
# Check logs and metrics for 5 minutes

# 3. Deploy to server 2 (25% traffic)
ssh deploy@prod2.example.com
# (repeat steps above)

# 4. Deploy to server 3 (25% traffic)
ssh deploy@prod3.example.com
# (repeat steps above)

# 5. Deploy to server 4 (25% traffic)
ssh deploy@prod4.example.com
# (repeat steps above)
```

### Phase 3: Database Migrations

```bash
# 1. Run migrations on production
npm run migrate -- --env production

# 2. Verify schema changes
psql -h prod-db.example.com -U admin -d pnptvbot -c "\dt"

# 3. Check for errors
psql -h prod-db.example.com -U admin -d pnptvbot -c "SELECT * FROM pg_stat_statements WHERE query LIKE '%ERROR%';"
```

### Phase 4: Service Verification

```bash
# 1. Verify all services up
pm2 status

# 2. Check health endpoints
curl https://api.example.com/health
curl https://api.example.com/api/nearby/stats

# 3. Monitor logs for errors
pm2 logs pnptv-bot | grep -i "error\|exception"

# 4. Verify external integrations
# Check Telegram webhook
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

# Check payment webhooks
curl https://api.example.com/api/webhooks/epayco -X OPTIONS
```

### Phase 5: Production Monitoring (First 24 Hours)

```bash
# 1. Enable detailed monitoring
export LOG_LEVEL=debug
pm2 restart pnptv-bot

# 2. Monitor key metrics every 5 minutes
watch -n 300 'curl https://api.example.com/api/nearby/stats'

# 3. Watch error logs
tail -f /var/log/pnptv/error.log

# 4. Monitor system resources
watch -n 10 'free -h && df -h && ps aux | grep node'

# 5. Check database connections
watch -n 10 'psql -h prod-db.example.com -U admin -d pnptvbot -c "SELECT count(*) FROM pg_stat_activity;"'

# 6. Monitor Redis memory
watch -n 10 'redis-cli INFO memory'
```

---

## ✅ POST-DEPLOYMENT VALIDATION

### Immediate (0-30 minutes)

- [ ] All services running: `pm2 status`
- [ ] Health endpoints responding
- [ ] No errors in logs: `pm2 logs`
- [ ] Database connections normal
- [ ] Redis memory stable
- [ ] API response times < 500ms
- [ ] Error rate < 0.1%

### Short-term (30 minutes - 2 hours)

- [ ] Sustained traffic handling normal
- [ ] No memory leaks detected
- [ ] Database query performance normal
- [ ] Rate limiting working correctly
- [ ] Telegram webhooks receiving events
- [ ] Email notifications sending
- [ ] Payment webhooks processing

### Medium-term (2-12 hours)

- [ ] All features tested manually
- [ ] Performance baseline met
- [ ] No resource exhaustion
- [ ] Backup jobs running
- [ ] Monitoring alerts configured
- [ ] Team notified of successful deployment
- [ ] Rollback plan reviewed (if needed)

### Long-term (12-24 hours)

- [ ] System stable under normal load
- [ ] No gradual degradation
- [ ] All cron jobs executing
- [ ] Database maintenance jobs running
- [ ] Logs archived properly
- [ ] Metrics collected completely
- [ ] Business metrics (KPIs) tracked

---

## 🔍 MONITORING & TROUBLESHOOTING

### Key Metrics to Monitor

```bash
# Response Time
curl https://api.example.com/api/nearby/stats | jq '.response_time'

# Error Rate
curl https://api.example.com/api/nearby/stats | jq '.error_rate'

# Active Users
redis-cli ZCARD geo:users:online

# Database Connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state='active';"

# Memory Usage
free -h | grep Mem

# CPU Usage
top -bn1 | grep "Cpu(s)"
```

### Common Issues & Solutions

#### Issue 1: High Response Times
```bash
# 1. Check database performance
EXPLAIN ANALYZE SELECT * FROM user_locations WHERE id = 'xxx';

# 2. Add missing index
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);

# 3. Restart database
psql -c "VACUUM ANALYZE;"

# 4. Scale horizontally
# Add more application servers
```

#### Issue 2: Memory Leak
```bash
# 1. Monitor memory trend
watch -n 5 'ps aux | grep node | grep -v grep | awk "{print \$6}"'

# 2. Restart service with garbage collection
node --max_old_space_size=4096 src/bot/core/bot.js

# 3. Enable memory profiling
npm install --save-dev clinic

# 4. Run clinic
clinic doctor -- node src/bot/core/bot.js
```

#### Issue 3: Database Locked
```bash
# 1. Check for long-running queries
SELECT * FROM pg_stat_activity WHERE state != 'idle';

# 2. Kill long-running query (careful!)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > '00:30:00';

# 3. Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

#### Issue 4: Rate Limiting Not Working
```bash
# 1. Verify rate limit middleware
grep -r "rate.*limit" src/

# 2. Test rate limiting
for i in {1..10}; do
  curl -X POST https://api.example.com/api/nearby/update-location \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"latitude":40.7,"longitude":-74.0,"accuracy":25}'
  sleep 0.5
done

# 3. Check should get 429 on attempts > 1 per 5 seconds
```

#### Issue 5: Telegram Webhook Not Receiving
```bash
# 1. Check webhook status
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

# 2. Verify webhook URL is accessible
curl https://api.example.com/webhook/telegram

# 3. Re-register webhook
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -d "url=https://api.example.com/webhook/telegram"

# 4. Check logs
tail -f /var/log/pnptv/telegram-webhook.log
```

---

## 🔄 ROLLBACK PROCEDURES

### Immediate Rollback (If Critical Issue)

```bash
# 1. Stop current version
pm2 stop pnptv-bot

# 2. Revert code to previous version
git revert HEAD
# OR
git checkout previous_tag

# 3. Reinstall dependencies
npm install --production

# 4. Start previous version
pm2 start pnptv-bot

# 5. Verify health
curl https://api.example.com/health

# 6. Monitor logs
pm2 logs pnptv-bot
```

### Database Rollback

```bash
# 1. Identify affected transactions
SELECT * FROM pg_stat_database WHERE datname = 'pnptvbot';

# 2. Restore from backup (if data corrupted)
dropdb -h prod-db.example.com pnptvbot
psql -h prod-db.example.com < /backups/pnptvbot_pre_deploy_*.sql.gz

# 3. Restart services
pm2 restart pnptv-bot

# 4. Verify data integrity
psql -c "SELECT COUNT(*) FROM users;"
psql -c "SELECT COUNT(*) FROM user_locations;"
```

### Blue-Green Rollback

```bash
# 1. Switch load balancer back to green
# Update nginx/load balancer config

# 2. Verify traffic on green
curl http://green.example.com:3001/health

# 3. Monitor metrics
watch -n 5 'curl http://prod.example.com/api/nearby/stats'

# 4. Keep blue for investigation
# Don't immediately destroy blue environment
```

### Communication

```bash
# 1. Notify stakeholders
echo "Deployment rollback in progress due to [ISSUE]" | mail -s "Deployment Rollback" team@example.com

# 2. Update status page
# curl https://status.example.com/api/incident -X POST -d "Investigating deployment issue"

# 3. Document incident
# Create incident report in wiki/docs

# 4. Schedule post-mortem
# Schedule team meeting to discuss root cause
```

---

## 📞 SUPPORT & ESCALATION

### Deployment Issues
- **Level 1**: Check logs, restart service
- **Level 2**: Check database, verify connections
- **Level 3**: Rollback deployment
- **Level 4**: Contact platform team

### On-Call Contacts
- **Backend**: [Name] ([slack](slack))
- **DevOps**: [Name] ([slack](slack))
- **Database**: [Name] ([slack](slack))

### Incident Response
1. **Identify** the issue (logs, metrics, alerts)
2. **Isolate** the affected component
3. **Mitigate** immediately (restart, rollback)
4. **Resolve** the root cause
5. **Verify** system stability
6. **Document** the incident

---

## ✅ DEPLOYMENT SIGN-OFF CHECKLIST

Before marking deployment as complete:

- [ ] All tests passing
- [ ] Performance targets met
- [ ] No errors in logs
- [ ] All services healthy
- [ ] Monitoring configured
- [ ] Backups verified
- [ ] Team notified
- [ ] Documentation updated
- [ ] Post-mortem scheduled (if issues)
- [ ] Deployment log archived

---

## 🎉 DEPLOYMENT COMPLETE

Your PNPtv Geolocation system is now deployed to production!

**Key Information**:
- **Deploy Date**: [INSERT DATE]
- **Deployed Version**: [INSERT GIT SHA]
- **Deployed By**: [INSERT NAME]
- **Backup Location**: /backups/pnptvbot_pre_deploy_*.sql.gz
- **Rollback Procedure**: See section above
- **Monitoring URL**: [INSERT DASHBOARD URL]

---

**For Support**: Contact DevOps team or see TROUBLESHOOTING.md

