# 🚀 PNPtv Production Deployment Plan — Final Refactor (Sprint 1-4)

**Date**: February 21, 2026
**Version**: 1.0
**Status**: READY FOR EXECUTION
**Risk Level**: LOW (all changes backward-compatible, zero-downtime deployment possible)

---

## 📋 Pre-Deployment Checklist

### Phase 1: Git & Code Verification (LOCAL MACHINE)

- [ ] **1.1 Check git status**
  ```bash
  git status  # Verify uncommitted changes
  git log -5  # Show recent commits
  ```

- [ ] **1.2 Pull latest from origin**
  ```bash
  git fetch origin
  git pull origin main  # Resolve any merge conflicts if present
  ```

- [ ] **1.3 Stage all new/modified files**
  ```bash
  git add -A
  git status  # Verify everything staged
  ```

- [ ] **1.4 Create deployment commit**
  ```bash
  git commit -m "chore: Deploy Sprint 1-4 final refactor with security, design, infrastructure, and payment improvements"
  ```

- [ ] **1.5 Push to origin**
  ```bash
  git push origin main
  ```

- [ ] **1.6 Verify push succeeded**
  ```bash
  git log --oneline -3
  git status  # Should show "Your branch is up to date with 'origin/main'"
  ```

### Phase 2: Docker Build & Registry Push

**Prerequisites**: Docker installed, Docker Hub account with credentials

- [ ] **2.1 Login to Docker Hub**
  ```bash
  docker login
  # Enter username and password when prompted
  ```

- [ ] **2.2 Build Docker image for backend**
  ```bash
  docker build -f Dockerfile -t pnptv-bot:latest .
  docker tag pnptv-bot:latest <DOCKER_HUB_USERNAME>/pnptv-bot:latest
  docker tag pnptv-bot:latest <DOCKER_HUB_USERNAME>/pnptv-bot:v1.0.0-sprint-final
  ```

- [ ] **2.3 Push to Docker Hub**
  ```bash
  docker push <DOCKER_HUB_USERNAME>/pnptv-bot:latest
  docker push <DOCKER_HUB_USERNAME>/pnptv-bot:v1.0.0-sprint-final
  ```

- [ ] **2.4 Verify image on Docker Hub**
  - Visit: https://hub.docker.com/r/<DOCKER_HUB_USERNAME>/pnptv-bot
  - Confirm `latest` and `v1.0.0-sprint-final` tags present

### Phase 3: VPS Preparation (SSH to pnptv.app)

- [ ] **3.1 Create deployment backup**
  ```bash
  # On VPS:
  cd /root/pnptvbot-production
  sudo cp -r . backups/deployment_backup_$(date +%Y%m%d_%H%M%S)/
  sudo chmod -R 755 backups/
  ```

- [ ] **3.2 Backup critical files**
  ```bash
  sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup-sprint-final
  sudo cp ecosystem.config.js ecosystem.config.js.backup-sprint-final
  ```

- [ ] **3.3 Verify database connectivity**
  ```bash
  npm run test:db  # If test script exists
  # OR manually:
  psql -U postgres -h localhost -d pnptv_db -c "SELECT 1;"
  redis-cli ping  # Should return PONG
  ```

### Phase 4: Code Deployment (VPS)

- [ ] **4.1 Pull latest code**
  ```bash
  cd /root/pnptvbot-production
  git fetch origin
  git pull origin main
  ```

- [ ] **4.2 Install/update dependencies**
  ```bash
  npm ci  # Clean install (respects package-lock.json)
  # Or if npm ci fails:
  rm -rf node_modules
  npm install
  ```

- [ ] **4.3 Build all applications**
  ```bash
  npm run build
  # Expected: All webapps build successfully (~7-8 min total)
  ```

- [ ] **4.4 Verify build artifacts**
  ```bash
  ls -lah public/hub/assets/
  ls -lah public/hangouts/assets/
  # Should see .js and .css files (hash-named, e.g., index-XXXXX.js)
  ```

### Phase 5: Database Migrations

- [ ] **5.1 Create database backup BEFORE migrations**
  ```bash
  pg_dump -U postgres pnptv_db > /tmp/pnptv_db_backup_$(date +%Y%m%d_%H%M%S).sql
  chmod 600 /tmp/pnptv_db_backup_*.sql
  ```

- [ ] **5.2 Review migration files**
  ```bash
  cat database/migrations/20260221_alter_location_sharing_default.sql
  cat database/migrations/20260221_reduce_geolocation_precision.sql
  ```

- [ ] **5.3 Apply migrations**
  ```bash
  psql -U postgres -h localhost -d pnptv_db -f database/migrations/20260221_alter_location_sharing_default.sql
  psql -U postgres -h localhost -d pnptv_db -f database/migrations/20260221_reduce_geolocation_precision.sql
  ```

- [ ] **5.4 Verify migrations applied**
  ```bash
  psql -U postgres -h localhost -d pnptv_db -c "
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'location_sharing_enabled';
  "
  # Should show: location_sharing_enabled | false
  ```

### Phase 6: Environment Variables & Configuration

- [ ] **6.1 Update .env.production with new secrets**
  ```bash
  # Add these new variables:
  SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
  HEALTH_SECRET="random-32-char-secret"
  REDIS_KEY_PREFIX="pnptv:"
  POSTGRES_POOL_MAX="20"
  POSTGRES_POOL_MIN="2"
  SESSION_SECRET="random-secret-different-from-jwt"
  # Verify no plaintext secrets in ecosystem.config.js
  ```

- [ ] **6.2 Update ecosystem.config.js**
  ```bash
  # Verify these settings:
  # - kill_timeout: 30000 (30s graceful shutdown)
  # - wait_ready: true
  # - env_production includes POSTGRES_POOL_MAX, SENTRY_DSN, etc.
  ```

- [ ] **6.3 Validate environment**
  ```bash
  echo "SESSION_SECRET: $SESSION_SECRET"
  echo "SENTRY_DSN: ${SENTRY_DSN:0:40}..." # Show first 40 chars only
  echo "REDIS_KEY_PREFIX: $REDIS_KEY_PREFIX"
  ```

### Phase 7: Nginx Configuration Update

- [ ] **7.1 Test current Nginx syntax**
  ```bash
  sudo nginx -t
  # Should output: syntax is ok, test successful
  ```

- [ ] **7.2 Verify Nginx changes (HTTP/2, Gzip)**
  ```bash
  grep -n "http2" /etc/nginx/sites-available/pnptv-bot
  grep -n "gzip on" /etc/nginx/nginx.conf
  # Should find both
  ```

- [ ] **7.3 Check OCSP stapling**
  ```bash
  grep -n "ssl_stapling" /etc/nginx/sites-available/pnptv-bot
  ```

- [ ] **7.4 Reload Nginx (zero-downtime)**
  ```bash
  sudo systemctl reload nginx
  # Should complete in <5 seconds
  ```

### Phase 8: Application Deployment

- [ ] **8.1 Stop current PM2 application**
  ```bash
  pm2 stop pnptv-bot
  pm2 delete pnptv-bot
  ```

- [ ] **8.2 Update PM2 ecosystem config**
  ```bash
  cp ecosystem.config.js ecosystem.config.js.active
  ```

- [ ] **8.3 Start PM2 with new config**
  ```bash
  pm2 start ecosystem.config.js
  pm2 save
  ```

- [ ] **8.4 Verify PM2 status**
  ```bash
  pm2 status
  # Should show pnptv-bot with status "online" or "0|online"
  pm2 logs pnptv-bot --lines 50  # Show recent logs
  ```

### Phase 9: Post-Deployment Validation

- [ ] **9.1 Health check endpoint**
  ```bash
  curl -s https://pnptv.app/health | jq .
  # Expected: { "status": "ok", "timestamp": "2026-02-21T..." }
  ```

- [ ] **9.2 Check CORS headers (internal only)**
  ```bash
  curl -s -H "Origin: https://evil.com" https://pnptv.app/api/webapp/profile
  # Should NOT include Access-Control-Allow-Origin header

  curl -s -H "Origin: https://pnptv.app" https://pnptv.app/api/webapp/profile
  # Should include Access-Control-Allow-Origin: https://pnptv.app
  ```

- [ ] **9.3 Verify HTTP/2**
  ```bash
  curl -I https://pnptv.app/hub/ | grep -i "HTTP"
  # Expected: HTTP/2 200
  ```

- [ ] **9.4 Verify Gzip compression**
  ```bash
  curl -I https://pnptv.app/hub/assets/*.js | grep -i "content-encoding"
  # Expected: content-encoding: gzip
  ```

- [ ] **9.5 Test rate limiting (auth endpoints)**
  ```bash
  # Rapidly hit login endpoint 11+ times
  for i in {1..15}; do
    curl -s -X POST https://pnptv.app/api/webapp/auth/email/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"wrong"}' \
      | grep -o "Too many\|error\|invalid" | head -1
  done
  # Should see "Too many requests" after 10 attempts
  ```

- [ ] **9.6 Test real login flow**
  ```bash
  # Test with valid credentials:
  # 1. Go to https://pnptv.app/auth/ in browser
  # 2. Login with test account
  # 3. Verify redirect to /hub/
  # 4. Check session cookie (__pnptv_sid) is set
  ```

- [ ] **9.7 Verify Sentry integration**
  ```bash
  # Check Sentry dashboard: https://sentry.io/
  # Should see recent events from production
  # Manually trigger error to verify:
  # - Go to API endpoint that throws error
  # - Should appear in Sentry within 30 seconds
  ```

- [ ] **9.8 Check Nginx logs for errors**
  ```bash
  sudo tail -50 /var/log/nginx/error.log
  # Should have no obvious errors
  ```

- [ ] **9.9 Monitor CPU/Memory**
  ```bash
  top -n 1 | head -20
  free -h
  df -h /
  # Verify no resource exhaustion
  ```

- [ ] **9.10 Test key features**
  - [ ] Login with email/password
  - [ ] Login with Telegram
  - [ ] Access /hub/ (protected route)
  - [ ] Access /media/live (protected route)
  - [ ] Create a post/comment
  - [ ] Upload an image
  - [ ] Subscribe to plan
  - [ ] Check geolocation feature (verify ~111m precision)

---

## 🔄 Rollback Procedure (If Needed)

### Instant Rollback (< 5 minutes)

```bash
# 1. Stop current application
pm2 stop pnptv-bot

# 2. Restore from git
git checkout HEAD~1  # Go back 1 commit
git reset --hard HEAD~1

# 3. Restore Nginx config
sudo cp /etc/nginx/nginx.conf.backup-sprint-final /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx

# 4. Restore database (if migrations were problematic)
psql -U postgres pnptv_db < /tmp/pnptv_db_backup_YYYYMMDD_HHMMSS.sql

# 5. Rebuild and restart
npm install
npm run build
pm2 start ecosystem.config.js

# 6. Verify rollback
curl https://pnptv.app/health
```

### Partial Rollback (Specific Components)

- **Frontend only**: Rebuild with previous commit, redeploy public/ assets
- **Backend only**: Restore ecosystem.config.js.backup, run `pm2 reload`
- **Nginx only**: `sudo cp /etc/nginx/nginx.conf.backup-sprint-final /etc/nginx/nginx.conf && sudo nginx -t && sudo systemctl reload nginx`

---

## 📊 Deployment Timeline

| Phase | Task | Estimated Time | Notes |
|-------|------|-----------------|-------|
| 1 | Git verification & commit | 5 min | Local machine |
| 2 | Docker build & push | 10-15 min | Local machine |
| 3 | VPS preparation & backup | 5 min | SSH to VPS |
| 4 | Code deployment | 10 min | npm install + build |
| 5 | Database migrations | 2 min | Apply 2 SQL scripts |
| 6 | Environment & config | 3 min | Update secrets |
| 7 | Nginx reload | 1 min | Zero-downtime |
| 8 | PM2 restart | 2 min | Application starts |
| 9 | Validation & testing | 10 min | Health checks + feature tests |
| **TOTAL** | | **~50 minutes** | End-to-end deployment |

---

## ⚠️ Critical Warnings

1. **DATABASE MIGRATIONS ARE NOT REVERSIBLE** - Have backup ready
2. **DEPLOY DURING LOW TRAFFIC** - Early morning recommended
3. **MONITOR LOGS** - Watch for errors in first 30 minutes
4. **TEST IN STAGING FIRST** - If you have staging environment
5. **HAVE ROLLBACK PLAN READY** - Keep backup commands nearby
6. **COORDINATE WITH TEAM** - Notify users of maintenance window if needed

---

## 📞 Support & Documentation

- Detailed Sprint 1-4 guides: See `SPRINT_*.md` files
- Architecture docs: See `SYSTEM_ARCHITECTURE.md`
- Code changes: See `CODE_CHANGES_DETAILED.md`
- Test scenarios: See `TEST_SCENARIOS.md`

---

**Start deployment by following Phase 1 checklist above.**

**Question**: Are you ready to begin Phase 1 (Git verification)?
