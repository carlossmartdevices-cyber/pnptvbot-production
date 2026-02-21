# ⚡ N8N Automation - Quick Start (5 Minutes)

## ✅ What's Already Done

- ✅ Database tables created (7 new tables for logging/tracking)
- ✅ Backend API controller built (`n8nAutomationController.js`)
- ✅ API routes registered (9 endpoints)
- ✅ 3 Production-ready workflows created (JSON files ready to import)

## 🚀 Deploy in 5 Steps

### Step 1: Verify Backend is Running
```bash
curl http://localhost:3001/api/n8n/health
# Should return: { "success": true, "status": "healthy", "checks": {...} }
```

### Step 2: Set Environment Variable
```bash
# Add to your .env.production or Docker environment
N8N_WEBHOOK_SECRET=your_secure_secret_here_change_this_123456
```

### Step 3: Access n8n
Navigate to: **http://148.230.80.210:32776**

### Step 4: Import 3 Workflows
1. **New → Import Workflow**
2. Choose file: `n8n-workflows/1-payment-recovery.json`
3. **Create** → **Save** → **Activate**
4. Repeat for workflows 2 and 3

### Step 5: Verify All Working
```bash
# Check payment recovery API
curl http://localhost:3001/api/n8n/payments/failed

# Check expiry notifications API
curl http://localhost:3001/api/n8n/subscriptions/expiry?daysAhead=7

# Check dashboard metrics
curl http://localhost:3001/api/n8n/metrics/dashboard
```

## 📊 3 Workflows You're Getting

| # | Name | Trigger | Does |
|---|------|---------|------|
| 1 | 💳 Payment Recovery | Every 2 hours | Check failed payments, update status, retry, notify users |
| 2 | 📧 Email Notifications | Every 1 hour | Send subscription reminders (7-day, 1-day before expiry) |
| 3 | 🏥 Health Monitoring | Every 5 minutes | Check API/DB/Redis health, alert admins if degraded |

## 📈 Monitor Workflows

**In n8n UI**: Click **"Executions"** tab to see all workflow runs

**In Database**:
```sql
SELECT workflow_name, status, COUNT(*)
FROM workflow_execution_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY workflow_name, status;
```

## 🛑 Troubleshooting

**Workflows not running?**
- Check if they're set to **Active** in n8n UI
- Check if n8n container is running: `docker ps | grep n8n`

**API returning errors?**
- Check backend is running: `curl http://localhost:3001/api/health`
- Check database: `psql -U pnptvbot -d pnptvbot -c "SELECT COUNT(*) FROM workflow_execution_logs;"`

**Emails not sending?**
- Verify SMTP creds in n8n email node
- Check: `PNPTV_SMTP_USER=support@pnptv.app`, `PNPTV_SMTP_PASS=Apelo801050`

## 📚 Full Guide

See **`N8N_AUTOMATION_SETUP.md`** for complete documentation

---

**That's it! You now have production-grade automation.** 🎉
