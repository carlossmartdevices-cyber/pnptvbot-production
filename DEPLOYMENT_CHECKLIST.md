# 🚀 Deployment Checklist

## Pre-Deployment

### 1️⃣ Code Review
- [x] All tests passing (42/42 ✅)
- [x] Docker build successful
- [x] No merge conflicts
- [x] Code reviewed and approved
- [ ] Security review completed
- [ ] Performance review completed

### 2️⃣ Environment Setup
- [ ] Production `.env` file configured
- [ ] All required variables set:
  - [ ] `BOT_TOKEN`
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `FIREBASE_PRIVATE_KEY`
  - [ ] `FIREBASE_CLIENT_EMAIL`
  - [ ] `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - [ ] `REDIS_HOST`, `REDIS_PORT`
  - [ ] `EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY` ⚠️ CRITICAL
  - [ ] `DAIMO_API_KEY`, `DAIMO_WEBHOOK_SECRET` ⚠️ CRITICAL
  - [ ] `SENTRY_DSN` (for error tracking)

### 3️⃣ Infrastructure
- [ ] PostgreSQL 15+ server ready
- [ ] Redis 7+ server ready
- [ ] Firewall rules configured
- [ ] Backup system in place
- [ ] Monitoring tools configured

### 4️⃣ DNS & SSL
- [ ] Domain configured (`BOT_WEBHOOK_DOMAIN`)
- [ ] SSL certificate valid
- [ ] Webhook URLs accessible from internet

## Deployment Steps

### Step 1: Merge to Production Branch

```bash
# Switch to base branch
git checkout claude/pnptv-telegram-bot-production-01HqjZJ4WHxosMdUWvbHNX97

# Pull latest changes
git pull origin claude/pnptv-telegram-bot-production-01HqjZJ4WHxosMdUWvbHNX97

# Merge the feature branch
git merge claude/payment-tests-docker-optimization-01JaJZrVUNbiSLqkykGsVoEv

# Push merged changes
git push origin claude/pnptv-telegram-bot-production-01HqjZJ4WHxosMdUWvbHNX97
```

**Checklist:**
- [ ] Merge completed without conflicts
- [ ] All commits included
- [ ] Branch pushed to remote

### Step 2: Pre-Deployment Tests

```bash
# Run all tests
npm run test:all

# Build Docker images locally
docker-compose build

# Test locally
docker-compose up -d
curl http://localhost:3000/health
```

**Checklist:**
- [ ] All tests pass
- [ ] Docker build successful
- [ ] Local services start correctly
- [ ] Health check returns 200

### Step 3: Deploy to Production

```bash
# Option 1: Using deployment script
./scripts/deploy.sh production

# Option 2: Manual deployment
docker-compose down
git pull origin <production-branch>
docker-compose build
docker-compose up -d
```

**Checklist:**
- [ ] Services stopped gracefully
- [ ] Latest code pulled
- [ ] Images built successfully
- [ ] Services started

### Step 4: Verify Deployment

```bash
# Check service status
docker-compose ps

# Check logs
docker-compose logs bot
docker-compose logs postgres
docker-compose logs redis

# Test health endpoint
curl https://your-domain.com/health | jq

# Test webhook endpoints
curl -X POST https://your-domain.com/api/webhooks/epayco \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Checklist:**
- [ ] All containers running
- [ ] All containers healthy
- [ ] No errors in logs
- [ ] Health check returns 200
- [ ] Webhook endpoints accessible

## Post-Deployment

### 1️⃣ Monitoring

```bash
# Watch logs in real-time
docker-compose logs -f bot

# Monitor resource usage
docker stats

# Check database connections
docker-compose exec postgres psql -U pnptv_user -d pnptv -c "SELECT count(*) FROM pg_stat_activity;"
```

**Checklist:**
- [ ] No errors in logs (first 5 minutes)
- [ ] CPU usage normal (<50%)
- [ ] Memory usage normal (<70%)
- [ ] Database connections established

### 2️⃣ Functional Testing

**Test Payment Flow:**
- [ ] Create test payment (ePayco)
- [ ] Create test payment (Daimo)
- [ ] Verify webhook reception
- [ ] Verify signature validation
- [ ] Verify subscription activation

**Test Error Handling:**
- [ ] Invalid payment provider
- [ ] Invalid signature
- [ ] Missing required fields
- [ ] Rate limiting

### 3️⃣ Performance Testing

```bash
# Load test webhooks
ab -n 100 -c 10 https://your-domain.com/health

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/health
```

**Checklist:**
- [ ] Response time < 200ms (health check)
- [ ] Response time < 500ms (webhooks)
- [ ] No 5xx errors under load
- [ ] Rate limiting working

### 4️⃣ Security Verification

- [ ] Webhook signatures verified
- [ ] Rate limiting active
- [ ] Non-root user in containers
- [ ] No secrets in logs
- [ ] HTTPS only (no HTTP)

### 5️⃣ Backup & Recovery

```bash
# Create database backup
docker-compose exec postgres pg_dump -U pnptv_user pnptv > backup_$(date +%Y%m%d).sql

# Test restore process (on separate instance)
cat backup_20251115.sql | docker-compose exec -T postgres psql -U pnptv_user pnptv
```

**Checklist:**
- [ ] Database backup successful
- [ ] Backup stored securely
- [ ] Restore process tested
- [ ] Backup schedule configured

## Rollback Plan

If deployment fails:

```bash
# 1. Stop current services
docker-compose down

# 2. Revert to previous version
git checkout <previous-commit-hash>

# 3. Rebuild and redeploy
docker-compose build
docker-compose up -d

# 4. Verify rollback
curl https://your-domain.com/health
```

**Emergency Contacts:**
- DevOps Lead: [Contact]
- Database Admin: [Contact]
- On-Call Engineer: [Contact]

## Metrics to Monitor

### First Hour
- [ ] Request rate stable
- [ ] Error rate < 0.1%
- [ ] Response time < 500ms
- [ ] No memory leaks
- [ ] No database connection issues

### First Day
- [ ] All payments processing correctly
- [ ] Webhooks functioning (100% success rate)
- [ ] No unexpected errors
- [ ] User satisfaction maintained

### First Week
- [ ] Performance metrics stable
- [ ] No new bugs reported
- [ ] Database size growing as expected
- [ ] Backup system working

## Documentation

- [ ] Update deployment docs
- [ ] Document any issues encountered
- [ ] Update runbook if needed
- [ ] Share knowledge with team

## Sign-Off

- [ ] Deployment Lead: _______________ Date: ___/___/___
- [ ] QA Lead: _______________ Date: ___/___/___
- [ ] Product Owner: _______________ Date: ___/___/___

---

## Quick Reference

### Service Ports
- Bot API: 3000
- PostgreSQL: 5432
- Redis: 6379

### Key Endpoints
- Health: `GET /health`
- ePayco Webhook: `POST /api/webhooks/epayco`
- Daimo Webhook: `POST /api/webhooks/daimo`
- Payment Response: `GET /api/payment-response`

### Logs Location
- Application: `docker-compose logs bot`
- PostgreSQL: `docker-compose logs postgres`
- Redis: `docker-compose logs redis`

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Container won't start | Check `.env` variables, view logs |
| Health check fails | Verify Redis/PostgreSQL connectivity |
| Webhook signature fails | Verify `EPAYCO_PRIVATE_KEY` and `DAIMO_WEBHOOK_SECRET` |
| Database connection error | Check PostgreSQL container health |
| Memory leak | Restart bot container, check logs |

---

**Last Updated**: 2025-11-15
**Version**: 1.0.0
**Branch**: `claude/payment-tests-docker-optimization-01JaJZrVUNbiSLqkykGsVoEv`
