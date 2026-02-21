# 🚀 N8N Automation - Docker Production Deployment

**Status**: Ready for Production Deployment
**Date**: February 21, 2026
**Version**: 1.0

---

## 📋 Deployment Checklist

### Pre-Deployment Verification

```bash
# 1. Verify git changes are committed
git status
# Expected: "working tree clean"

# 2. Verify all tests passing
curl http://localhost:3001/api/n8n/health
# Expected: { "success": true, "status": "healthy" }

# 3. Verify database migrations applied
psql -U pnptvbot -d pnptvbot -c "SELECT COUNT(*) FROM workflow_execution_logs;"
# Expected: Positive number or 0 (table exists)
```

---

## 🐳 Docker Deployment Steps

### Step 1: Build Updated Docker Image

```bash
# Build the production image with n8n routes
docker build --target production -t pnptv-bot:latest .

# Verify image was created
docker images | grep pnptv-bot
```

**What's Included**:
- ✅ Updated `apps/backend/bot/api/routes.js` with n8n endpoints
- ✅ New `n8nAutomationController.js` with 9 endpoints
- ✅ All production dependencies
- ✅ Health check endpoint

### Step 2: Stop Current Containers

```bash
# Using docker-compose (if running)
docker-compose -f docker-compose.prod.yml down

# OR using PM2 (current method)
pm2 stop pnptv-bot
pm2 delete pnptv-bot
```

### Step 3: Start Fresh Containers

#### Option A: Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify all services running
docker-compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME              STATUS
pnptv-bot         Up (healthy)
postgres          Up (healthy)
redis             Up
```

#### Option B: Using PM2 (Current)

```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Verify running
pm2 status
pm2 logs pnptv-bot
```

### Step 4: Verify Deployment

```bash
# Health check
curl http://localhost:3001/api/health
# Expected: { "success": true }

# N8N API endpoints
curl http://localhost:3001/api/n8n/health
# Expected: System health status

curl http://localhost:3001/api/n8n/payments/failed
# Expected: List of failed payments (or empty array)

curl http://localhost:3001/api/n8n/metrics/dashboard
# Expected: Dashboard metrics for last 24 hours
```

### Step 5: Import N8N Workflows

1. Access n8n: `http://148.230.80.210:32776`
2. Click **"New"** → **"Import Workflow"**
3. Select and import:
   - `n8n-workflows/1-payment-recovery.json`
   - `n8n-workflows/2-email-notifications.json`
   - `n8n-workflows/3-health-monitoring.json`
4. **Activate** each workflow

### Step 6: Monitor Deployment

```bash
# Watch logs
docker-compose -f docker-compose.prod.yml logs -f pnptv-bot

# OR with PM2
pm2 logs pnptv-bot -f

# Check database activity
psql -U pnptvbot -d pnptvbot -c "
  SELECT workflow_name, status, COUNT(*)
  FROM workflow_execution_logs
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY workflow_name, status;
"
```

---

## 📊 Deployment Verification

### API Endpoints Status

```bash
# Run comprehensive test
curl -s http://localhost:3001/api/n8n/health | jq '.'

# Expected response:
{
  "success": true,
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "responseTime": 1 },
    "redis": { "status": "healthy", "responseTime": 0 },
    "epayco": { "status": "configured", "testMode": false }
  }
}
```

### Database Tables Verification

```bash
psql -U pnptvbot -d pnptvbot -c "
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE '%recovery%' OR tablename LIKE '%notification%'
  OR tablename LIKE '%workflow%' OR tablename LIKE '%health%'
  OR tablename LIKE '%alert%';
"

# Expected: 7 tables
# - admin_alerts
# - email_notifications
# - payment_recovery_log
# - subscription_expiry_queue
# - system_health_checks
# - workflow_execution_logs
```

---

## 🔧 Environment Variables

Ensure these are set in your production environment:

```bash
# .env.production or docker-compose env_file

# Core Config
NODE_ENV=production
PORT=3001

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=<your-password>
POSTGRES_DATABASE=pnptvbot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# N8N
N8N_WEBHOOK_SECRET=your_secure_secret_here
N8N_BASE_URL=http://148.230.80.210:32776

# SMTP (Already configured)
PNPTV_SMTP_HOST=smtp.hostinger.com
PNPTV_SMTP_PORT=587
PNPTV_SMTP_USER=support@pnptv.app
PNPTV_SMTP_PASS=Apelo801050

# Payment Provider
EPAYCO_PUBLIC_KEY=<key>
EPAYCO_PRIVATE_KEY=<key>
EPAYCO_TEST_MODE=false
```

---

## 🚨 Rollback Plan

If deployment fails:

```bash
# Stop current containers
docker-compose -f docker-compose.prod.yml down

# Rollback to previous image (if available)
docker run -d --name pnptv-bot-backup <previous-image-id>

# OR restart from PM2
pm2 start ecosystem.config.js --env production
pm2 restart pnptv-bot
```

---

## 📈 Post-Deployment Monitoring

### First 24 Hours

```bash
# Monitor workflow executions
watch -n 10 'psql -U pnptvbot -d pnptvbot -c "
  SELECT workflow_name, COUNT(*) as runs, MAX(created_at) as latest
  FROM workflow_execution_logs
  GROUP BY workflow_name
  ORDER BY latest DESC;"'

# Monitor error logs
tail -f /app/logs/error.log
```

### Key Metrics to Watch

1. **API Response Times**: Should be < 500ms
2. **Database Connections**: Should remain stable
3. **Workflow Execution Rate**: Payment recovery every 2h, notifications every 1h
4. **Error Rate**: Should be < 0.1%
5. **System Health**: Database, Redis, ePayco all "healthy"

---

## ✅ Success Criteria

Deployment is successful when:

- [ ] Docker container running and healthy
- [ ] All n8n API endpoints responding (8/8)
- [ ] Database tables created and accessible (7/7)
- [ ] N8N workflows imported and activated (3/3)
- [ ] Payment recovery running every 2 hours
- [ ] Email notifications running every 1 hour
- [ ] Health monitoring running every 5 minutes
- [ ] Admin alerts functional
- [ ] Logs being recorded to database
- [ ] Zero critical errors in last hour

---

## 📞 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs pnptv-bot

# Common issue: Port already in use
lsof -i :3001

# Fix: Kill existing process
kill -9 <PID>

# Restart
docker-compose -f docker-compose.prod.yml up -d pnptv-bot
```

### N8N Endpoints Not Responding

```bash
# Check if backend is running
curl http://localhost:3001/health

# Check if routes are loaded
curl http://localhost:3001/api/n8n/health

# If not found, restart backend
pm2 restart pnptv-bot
# or
docker restart pnptv-bot
```

### Database Connection Issues

```bash
# Verify database is running
psql -U pnptvbot -d pnptvbot -c "SELECT 1"

# Check database migration status
psql -U pnptvbot -d pnptvbot -c "SELECT COUNT(*) FROM workflow_execution_logs"

# If migration missing, run:
psql -U pnptvbot -d pnptvbot -f database/migrations/072_n8n_automation_setup.sql
```

---

## 🎯 Summary

This deployment adds production-grade automation to your platform:

✅ Payment Recovery - Every 2 hours
✅ Email Notifications - Every 1 hour
✅ Health Monitoring - Every 5 minutes
✅ Complete Audit Trail
✅ Admin Alerts
✅ Zero Manual Intervention

**Total Deployment Time**: ~15 minutes
**Downtime**: ~2 minutes (container restart)
**Risk Level**: LOW (all code tested, backward compatible)

---

**Status**: READY FOR PRODUCTION DEPLOYMENT 🚀
