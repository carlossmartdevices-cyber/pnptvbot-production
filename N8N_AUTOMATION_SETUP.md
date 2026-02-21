# 🚀 N8N Production Automation Suite - Complete Setup Guide

**Status**: ✅ **PRODUCTION READY**
**Date**: February 21, 2026
**Workflows**: 3 Complete
**Automation Coverage**: Payment Recovery, Email Notifications, System Monitoring

---

## 📋 Quick Summary

This setup automates:
- ✅ **Payment Recovery**: Auto-check & retry failed payments every 2 hours
- ✅ **Email Notifications**: Send subscription reminders (7-day, 1-day before expiry)
- ✅ **System Monitoring**: Health checks every 5 minutes with automated alerts
- ✅ **Logging & Tracking**: Full audit trail of all automation activities

---

## 🔧 Step 1: Database Setup (ONE TIME)

Run the database migration to create logging tables:

```bash
# Option A: Using psql directly
psql -U pnptvbot -d pnptvbot -h localhost -f database/migrations/072_n8n_automation_setup.sql

# Option B: Using the app's migration runner (if configured)
npm run migrate
```

Verify tables were created:
```bash
psql -U pnptvbot -d pnptvbot -h localhost -c "
  SELECT tablename FROM pg_tables
  WHERE tablename LIKE '%recovery%' OR tablename LIKE '%email%' OR tablename LIKE '%workflow%'
  OR tablename LIKE '%health%' OR tablename LIKE '%admin%' ORDER BY tablename;
"
```

**Expected output**:
```
admin_alerts
email_notifications
payment_recovery_log
subscription_expiry_queue
system_health_checks
workflow_execution_logs
```

---

## 🌐 Step 2: Backend API Setup (ONE TIME)

The n8n automation controller is already in place:
- **File**: `apps/backend/bot/api/controllers/n8nAutomationController.js`
- **Routes**: Added to `apps/backend/bot/api/routes.js`

Verify the routes are working:

```bash
# Health check endpoint
curl -s http://localhost:3001/api/n8n/health | jq '.'

# Failed payments endpoint
curl -s http://localhost:3001/api/n8n/payments/failed | jq '.'

# Dashboard metrics
curl -s http://localhost:3001/api/n8n/metrics/dashboard | jq '.'
```

**All should return 200 OK with JSON data**

---

## 🎯 Step 3: N8N Workflow Import (CRITICAL)

### Access n8n
- **URL**: http://148.230.80.210:32776
- **Login** with your n8n credentials

### Import Workflows

**A. Payment Recovery & Status Sync (Every 2 Hours)**
1. Click **"New"** → **"Import Workflow"**
2. Select file: `n8n-workflows/1-payment-recovery.json`
3. Configure credentials:
   - **SMTP**: Use existing PNPTV SMTP credentials
   - **HTTP Auth**: Use API key (see Step 4 below)
4. Click **"Save"**
5. Enable the workflow (toggle to **Active**)

**B. Smart Email Notifications (Hourly + Daily)**
1. Click **"New"** → **"Import Workflow"**
2. Select file: `n8n-workflows/2-email-notifications.json`
3. Configure credentials (same as above)
4. Click **"Save"** & enable

**C. System Health & Monitoring (Every 5 Minutes)**
1. Click **"New"** → **"Import Workflow"**
2. Select file: `n8n-workflows/3-health-monitoring.json`
3. Click **"Save"** & enable

---

## 🔐 Step 4: Environment Variables (CRITICAL)

Add these to your `.env.production` or Docker environment:

```bash
# N8N Configuration
N8N_WEBHOOK_SECRET=your_secure_webhook_secret_here
N8N_BASE_URL=http://148.230.80.210:32776

# SMTP (Already configured, but verify)
PNPTV_SMTP_HOST=smtp.hostinger.com
PNPTV_SMTP_PORT=587
PNPTV_SMTP_USER=support@pnptv.app
PNPTV_SMTP_PASS=Apelo801050
PNPTV_FROM_EMAIL=noreply@pnptv.app

EASYBOTS_SMTP_HOST=smtp.hostinger.com
EASYBOTS_SMTP_PORT=587
EASYBOTS_SMTP_USER=hello@easybots.store
EASYBOTS_SMTP_PASS=Apelo801050
EASYBOTS_FROM_EMAIL=noreply@easybots.store

# Admin notifications
ADMIN_USER_IDS=8370209084
```

**For Docker deployment** (in docker-compose.yml):
```yaml
environment:
  - N8N_WEBHOOK_SECRET=your_secure_webhook_secret_here
  - N8N_BASE_URL=http://148.230.80.210:32776
```

---

## 📡 Step 5: Test All Workflows

### Test Payment Recovery Workflow
```bash
# Manually trigger (simulates failed payment check)
curl -X GET "http://localhost:3001/api/n8n/payments/failed" \
  -H "X-N8N-SECRET: $N8N_WEBHOOK_SECRET"
```

**Expected**: Returns list of pending payments (might be empty if no failures)

### Test Email Notification Workflow
```bash
# Get subscriptions expiring soon
curl -X GET "http://localhost:3001/api/n8n/subscriptions/expiry?daysAhead=7" \
  -H "X-N8N-SECRET: $N8N_WEBHOOK_SECRET"
```

**Expected**: Returns subscribers with expiring subscriptions

### Test Health Check Workflow
```bash
# Check system health
curl -X GET "http://localhost:3001/api/n8n/health" \
  -H "X-N8N-SECRET: $N8N_WEBHOOK_SECRET"
```

**Expected**: Returns health status of all components

---

## 📊 Step 6: Monitoring & Dashboards

### View Workflow Logs
```sql
-- Check all workflow executions (last 24 hours)
SELECT
  workflow_name,
  status,
  COUNT(*) as count,
  ROUND(AVG(execution_time_ms), 2) as avg_time_ms,
  MAX(created_at) as last_run
FROM workflow_execution_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY workflow_name, status
ORDER BY last_run DESC;
```

### View Payment Recovery Logs
```sql
-- Check payment recovery attempts
SELECT
  payment_id,
  action,
  status,
  error_message,
  created_at
FROM payment_recovery_log
ORDER BY created_at DESC
LIMIT 20;
```

### View Email Notifications
```sql
-- Check email delivery status
SELECT
  recipient_email,
  notification_type,
  status,
  sent_at,
  error_message
FROM email_notifications
ORDER BY created_at DESC
LIMIT 20;
```

### View Admin Alerts
```sql
-- Check active unacknowledged alerts
SELECT
  alert_type,
  severity,
  title,
  message,
  created_at
FROM admin_alerts
WHERE acknowledged = FALSE
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🚨 Step 7: Monitoring & Alerts

### Dashboard in n8n
1. In n8n, click **"Executions"** tab
2. You'll see all workflow runs with:
   - Status (Success/Failed)
   - Execution time
   - Error messages
   - Retry counts

### Email Alerts
Admin alerts are automatically sent to `ADMIN_USER_IDS` email addresses when:
- ⚠️ System health is degraded
- ❌ Multiple errors detected in last hour
- 🔄 Payment recovery succeeds/fails
- 📧 Email notification issues

### Database Alerts
Create custom alerts based on logs:
```sql
-- Alert: Payment recovery failing
SELECT COUNT(*) as failed_recoveries
FROM payment_recovery_log
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '1 hour'
HAVING COUNT(*) > 5;
```

---

## 🔄 Step 8: Maintenance & Troubleshooting

### Check Workflow Execution Status
```bash
# In n8n UI: Executions tab
# Or via API:
curl -s http://localhost:3001/api/n8n/metrics/dashboard | jq '.'
```

### Debug Failed Workflows
```sql
-- Find failed workflow executions
SELECT
  workflow_name,
  status,
  error_message,
  error_details,
  created_at
FROM workflow_execution_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

### Reset Workflow State (if stuck)
```sql
-- Mark pending emails as failed (older than 24 hours)
UPDATE email_notifications
SET status = 'abandoned', error_message = 'Stuck for 24+ hours'
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '24 hours';

-- Cleanup old logs (keep 30 days)
DELETE FROM workflow_execution_logs
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Restart a Workflow
In n8n UI:
1. Go to the workflow
2. Click **"Test"** to run once
3. Or wait for the next scheduled trigger

---

## 📈 Production Checklist

- [ ] Database migration 072 applied
- [ ] Backend API controller deployed
- [ ] Routes registered in Express app
- [ ] All 3 workflows imported into n8n
- [ ] Environment variables set (N8N_WEBHOOK_SECRET)
- [ ] Workflows tested manually (curl requests)
- [ ] Workflows set to Active in n8n
- [ ] Admin email addresses verified
- [ ] SMTP credentials confirmed working
- [ ] Monitoring setup (database queries saved)
- [ ] Error alerting configured
- [ ] Logs retention policy set (30 days)

---

## 🎯 Automation Summary

| Workflow | Trigger | Frequency | Purpose |
|----------|---------|-----------|---------|
| **Payment Recovery** | Cron | Every 2 hours | Check failed payments, update status, retry, notify users |
| **Email Notifications** | Cron | Every 1 hour | Send subscription reminders (7-day, 1-day before expiry) |
| **Health Monitoring** | Cron | Every 5 minutes | Check API, DB, Redis, ePayco; alert admins if degraded |

---

## 💪 Advanced Configuration

### Custom Email Templates
Edit email body in n8n workflow:
- Open **"Send Status Email"** node
- Customize HTML template
- Use variables like `{{ $node["Loop Each Payment"].json.first_name }}`

### Change Monitoring Interval
In n8n workflow:
- **Payment Recovery**: Change `cronExpression` from `0 */2 * * *` (every 2h) to desired interval
- **Email Notifications**: Change from `0 * * * *` (hourly) to desired interval
- **Health Monitoring**: Change from `*/5 * * * *` (every 5m) to desired interval

Cron format: `minute hour day month weekday`
Examples:
- `0 0 * * *` = Daily at midnight
- `0 * * * *` = Every hour
- `*/15 * * * *` = Every 15 minutes

### Add Custom Notifications
In n8n workflow, add new nodes:
1. **HTTP Request** → Call your API
2. **Email Send** or **Slack** → Send custom message
3. **Log** → Track in database

---

## 🆘 Support & Debugging

**n8n Logs**: Check `/var/lib/docker/volumes/.../n8n/...` or n8n UI
**API Logs**: Check application logs (Sentry/console)
**Database**: Check `workflow_execution_logs` table

Common issues:
- ❌ **"Cannot reach API"**: Check port 3001 is open, API is running
- ❌ **"SMTP auth failed"**: Verify credentials in n8n
- ❌ **"No data returned"**: Check database has data to process

---

## 📞 Contact & Updates

- **Production Ready**: Yes ✅
- **Last Updated**: February 21, 2026
- **Version**: 1.0
- **Support**: Check logs → Database → Admin Alerts

**Next Steps**:
1. Run database migration
2. Deploy backend code
3. Import 3 workflows
4. Test and enable
5. Monitor via dashboards

---

**🎉 You're all set! Your n8n automation suite is now production-ready.**
