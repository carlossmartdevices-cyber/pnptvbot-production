# 🚀 PNPtv Production Deployment — VPS Quick Start

**Status**: ✅ Code committed and pushed to `origin/main`
**Target**: pnptv.app (VPS)
**Date**: February 21, 2026

---

## 📋 Pre-Deployment (Your Local Machine)

✅ **ALREADY DONE:**
- [x] Sprint 1-4 implementations completed by specialized agents
- [x] All code committed to git
- [x] Changes pushed to `origin/main`
- [x] DEPLOY.sh automation script created

---

## 🎬 VPS Deployment (SSH to pnptv.app)

### Step 1: SSH to Your VPS

```bash
ssh root@pnptv.app
# or
ssh -i /path/to/key.pem root@your.vps.ip
```

### Step 2: Navigate to Project Directory

```bash
cd /root/pnptvbot-production
```

### Step 3: Execute Automated Deployment

```bash
sudo bash DEPLOY.sh
```

**What this script does:**
- ✅ Pre-flight checks (git, node, npm, postgres, redis, nginx)
- ✅ Creates full backups (DB, configs, code snapshot)
- ✅ Pulls latest code from origin/main
- ✅ Installs dependencies (npm ci)
- ✅ Builds all applications
- ✅ Applies database migrations
- ✅ Tests Nginx syntax and reloads
- ✅ Restarts PM2 application
- ✅ Runs post-deployment validation checks
- ✅ Reports deployment status

**Duration**: ~10-15 minutes (depends on npm build time)

---

## 🔍 What Gets Deployed

### Backend Security (Sprint 1 & 4)
- ✅ CORS whitelist (no more open CORS)
- ✅ Protected unauthenticated routes
- ✅ Real rate limiting (brute force protection)
- ✅ Session security improvements
- ✅ Geolocation privacy (3-decimal precision)
- ✅ Audit logger IP fix
- ✅ Real listener counts (no more fake data)
- ✅ PCI DSS frontend tokenization
- ✅ SHA-256 payment signatures
- ✅ Email verification enforcement

### Frontend Design System (Sprint 2)
- ✅ Unified design tokens (200+ CSS variables)
- ✅ Skeleton loading screens
- ✅ Global error boundary
- ✅ Real user photos in PostCard
- ✅ Font loading (Inter + Outfit)
- ✅ Route transition animations
- ✅ Error handling with toasts

### Infrastructure (Sprint 3)
- ✅ Nginx HTTP/2
- ✅ Gzip compression (60-70% size reduction)
- ✅ Upstream keepalive
- ✅ Sentry error tracking
- ✅ PM2 graceful shutdown
- ✅ PostgreSQL pool optimization (10→20)
- ✅ Redis key prefix

---

## 📊 Deployment Output Example

```
[INFO] === PHASE 1: Pre-flight Checks ===
[INFO] Checking prerequisites...
[✓] All prerequisites found
[✓] PostgreSQL connected
[✓] Redis connected

[INFO] === PHASE 2: Backup Current State ===
[✓] Database backup created
[✓] Configuration backups created
[✓] Code snapshot created

[INFO] === PHASE 3: Pull Latest Code ===
[✓] Code pulled successfully

[INFO] === PHASE 4: Install Dependencies ===
[✓] Dependencies installed

[INFO] === PHASE 5: Build Applications ===
[✓] Build successful

[INFO] === PHASE 6: Database Migrations ===
[✓] Migration 1 applied
[✓] Migration 2 applied

[✓] === DEPLOYMENT COMPLETE ===
Commit: d421379 feat: Deploy Sprint 1-4 final refactor...
Status: App running
```

---

## ✅ Post-Deployment Verification

After deployment completes, verify everything works:

```bash
# 1. Check app status
pm2 status

# 2. View recent logs
pm2 logs pnptv-bot --lines 50

# 3. Health check
curl https://pnptv.app/health | jq .

# 4. Verify HTTP/2
curl -I https://pnptv.app/hub/ | grep HTTP

# 5. Check Gzip
curl -I https://pnptv.app/hub/assets/*.js | grep content-encoding

# 6. Monitor in browser
# Go to: https://pnptv.app
# Login and test features
```

---

## 🔄 Rollback Procedure (If Needed)

If something goes wrong, rollback is instant:

```bash
# Stop application
pm2 stop pnptv-bot
pm2 delete pnptv-bot

# Restore previous commit
cd /root/pnptvbot-production
git reset --hard HEAD~1

# Restore Nginx config
sudo cp backups/deployment_*/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx

# Restore database (optional)
# gunzip < backups/deployment_*/pnptv_db_*.sql.gz | psql -U postgres pnptv_db

# Restart application
npm install
npm run build
pm2 start ecosystem.config.js
```

---

## 📞 Troubleshooting

### Problem: "npm ci failed"
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: "Build failed"
```bash
# Check build output for errors
npm run build 2>&1 | tail -50

# Common fix: clear cache
npm cache clean --force
npm install
npm run build
```

### Problem: "Nginx syntax error"
```bash
# Review error
sudo nginx -t

# Restore backup
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Problem: "Health check failed"
```bash
# Check app logs
pm2 logs pnptv-bot

# Check PostgreSQL
psql -U postgres -h localhost -d pnptv_db -c "SELECT 1;"

# Check Redis
redis-cli ping
```

---

## 📋 Deployment Checklist

Use this to track deployment progress:

- [ ] SSH to VPS and navigate to project directory
- [ ] Run `sudo bash DEPLOY.sh`
- [ ] Monitor script output
- [ ] Verify health check passes
- [ ] Test login at https://pnptv.app/auth/
- [ ] Test protected routes (/hub/, /media/*)
- [ ] Verify geolocation feature works
- [ ] Test payment flow
- [ ] Check Sentry dashboard for errors
- [ ] Monitor PM2 logs for 30 minutes
- [ ] Inform team that deployment is live

---

## 📚 Documentation

For more details, see:
- `PRODUCTION_DEPLOYMENT_PLAN.md` - Complete 9-phase plan with detailed checklists
- `IMPLEMENTATION_SUMMARY_SPRINT_1_4.md` - What changed and why
- `CODE_CHANGES_DETAILED.md` - Exact before/after code
- `TEST_SCENARIOS.md` - 25+ test cases to validate deployment

---

## 🎉 Summary

Your production deployment is automated and ready to go!

1. **Local**: ✅ Code committed and pushed to GitHub
2. **VPS**: Execute `sudo bash DEPLOY.sh`
3. **Validate**: Run health checks and feature tests
4. **Monitor**: Watch PM2 logs for 30 minutes
5. **Complete**: Deployment successful! 🚀

---

**Questions?** Check the detailed guides or review deployment logs at `backups/deployment_YYYYMMDD_HHMMSS/`

---

**Created**: February 21, 2026
**Sprint**: 1-4 Final Refactor (Security, Design, Infrastructure, Payments)
**Status**: ✅ Ready for Production
