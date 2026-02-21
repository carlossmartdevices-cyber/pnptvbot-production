# PDS/Bluesky/Daimo Integration - Quick Start Deployment

**Status**: PRODUCTION READY (2026-02-21)
**Estimated Deployment Time**: 5 minutes

---

## ⚡ QUICK START (Copy & Paste)

### 1. Verify Environment
```bash
# Check all required variables are set
grep -E "^DAIMO_|^ENCRYPTION_KEY=|^SESSION_SECRET=" /root/pnptvbot-production/.env.production | wc -l
# Expected: 6 lines (DAIMO_API_KEY, APP_ID, TREASURY_ADDRESS, REFUND_ADDRESS, WEBHOOK_SECRET, + ENCRYPTION_KEY, SESSION_SECRET)
```

### 2. Verify Files Exist
```bash
cd /root/pnptvbot-production

# Core services (should exist)
test -f apps/backend/bot/services/PDSProvisioningService.js && echo "✅ PDSProvisioningService" || echo "❌ Missing"
test -f apps/backend/bot/services/BlueskyAutoSetupService.js && echo "✅ BlueskyAutoSetupService" || echo "❌ Missing"
test -f apps/backend/bot/api/controllers/pdsController.js && echo "✅ pdsController" || echo "❌ Missing"
test -f apps/backend/bot/api/controllers/blueskyController.js && echo "✅ blueskyController" || echo "❌ Missing"
test -f webapps/prime-hub/src/components/BlueskySetupCard.jsx && echo "✅ BlueskySetupCard" || echo "❌ Missing"

# Check routes are wired
grep -q "app.use('/api/pds', pdsRoutes)" apps/backend/bot/api/routes.js && echo "✅ PDS routes" || echo "❌ PDS routes missing"
grep -q "app.use('/api/bluesky', blueskyRoutes)" apps/backend/bot/api/routes.js && echo "✅ Bluesky routes" || echo "❌ Bluesky routes missing"
grep -q "handleDaimoWebhook" apps/backend/bot/api/controllers/webhookController.js && echo "✅ Daimo webhook" || echo "❌ Daimo webhook missing"
```

### 3. Install Dependencies (if needed)
```bash
cd /root/pnptvbot-production

# Check if deps are installed
npm list @daimo/pay >/dev/null 2>&1 && echo "✅ Daimo SDK" || (echo "Installing deps..." && npm install)
npm list uuid >/dev/null 2>&1 && echo "✅ uuid" || (echo "Installing deps..." && npm install)
```

### 4. Verify Database Tables (Run as root)
```bash
# This checks if the PDS schema is already created
# If not found, the migration will be applied in next step

psql -U pnptvbot -d pnptvbot -h localhost -c \
  "SELECT count(*) FROM information_schema.tables
   WHERE table_name IN ('user_pds_mapping', 'pds_provisioning_log');" 2>&1

# Expected output: 2 (both tables exist) or lower if not yet migrated
```

### 5. Build Frontend (if needed)
```bash
cd /root/pnptvbot-production

# Check if built
test -f public/prime-hub/index.html && echo "✅ Frontend built" || (echo "Building..." && npm run build:prime-hub)
```

### 6. Restart Application
```bash
# Restart with production environment
pm2 restart pnptv-bot --env production

# Wait for startup (typically 10-15 seconds)
sleep 15

# Verify running
pm2 logs pnptv-bot | grep -E "listening|started" | head -3
```

### 7. Verify Endpoints
```bash
# Quick health check
curl -s http://localhost:3001/health | jq '.status'
# Expected: "ok"

# Test Daimo diagnostic endpoint
curl -s -X POST http://localhost:3001/api/webhooks/daimo/debug \
  -H "Content-Type: application/json" \
  -d '{"test":true}' | jq '.received'
# Expected: true
```

### 8. Monitor Logs
```bash
# Watch for any startup errors
tail -f /root/pnptvbot-production/logs/pm2-out.log | grep -E "ERROR|FATAL|Daimo|PDS|Bluesky"
# Should see no errors (Ctrl+C to exit)

# Or check last 20 lines
tail -20 /root/pnptvbot-production/logs/pm2-out.log
```

---

## ✅ VERIFICATION CHECKLIST

Run this after deployment:

```bash
#!/bin/bash
echo "=== PDS/Bluesky/Daimo Deployment Verification ==="
echo ""

# 1. App running?
if pm2 list | grep -q "pnptv-bot"; then
  echo "✅ App running"
else
  echo "❌ App not running"
  exit 1
fi

# 2. Health check?
if curl -s http://localhost:3001/health | grep -q "ok"; then
  echo "✅ Health check passing"
else
  echo "❌ Health check failing"
  exit 1
fi

# 3. Daimo diagnostic?
if curl -s -X POST http://localhost:3001/api/webhooks/daimo/debug \
   -H "Content-Type: application/json" \
   -d '{"test":true}' | grep -q "received"; then
  echo "✅ Daimo diagnostic endpoint"
else
  echo "❌ Daimo diagnostic failing"
  exit 1
fi

# 4. No fatal errors?
if grep -q "FATAL\|CRITICAL" /root/pnptvbot-production/logs/pm2-out.log; then
  echo "❌ Fatal errors in logs"
  exit 1
else
  echo "✅ No fatal errors"
fi

echo ""
echo "=== ALL CHECKS PASSED ==="
echo "Ready for testing"
```

---

## 🧪 FUNCTIONAL TESTS

### Test 1: Telegram Login + PDS Provisioning
```bash
# Login via Telegram at: https://pnptv.app
# (Use BotFather to simulate or real Telegram OAuth)

# After login, check if PDS info is available:
# curl -s http://localhost:3001/api/pds/info \
#   -H "Cookie: session=<your-session-cookie>" | jq .
#
# Expected: { "success": true, "data": { "pnptv_uuid": "...", "pds_handle": "...", ... } }
```

### Test 2: Bluesky One-Click Setup
```bash
# After logged in, navigate to: https://pnptv.app/app
# Look for "🦋 Bluesky" card
# Click "Create Bluesky Account" button

# Monitor logs:
tail -f /root/pnptvbot-production/logs/pm2-out.log | grep -i "bluesky setup"

# Expected logs:
# [Bluesky API] Setup request from user 123
# [Bluesky] Starting auto-setup for user 123
# [Bluesky] Setup successful for user 123: @username.pnptv.app
# [Bluesky API] Setup successful
```

### Test 3: Daimo Webhook
```bash
# From Daimo dashboard, send a test webhook:
# curl -X POST https://pnptv.app/api/webhooks/daimo \
#   -H "Content-Type: application/json" \
#   -H "x-daimo-signature: <test-signature>" \
#   -d '{
#     "type": "payment_completed",
#     "paymentId": "test-123",
#     "payment": {
#       "id": "test-123",
#       "status": "payment_completed",
#       "metadata": {
#         "userId": "123",
#         "paymentId": "payment-uuid"
#       }
#     }
#   }'

# Monitor logs:
tail -f /root/pnptvbot-production/logs/pm2-out.log | grep -i "daimo"

# Expected:
# Daimo Pay webhook received
# Daimo webhook processed successfully
```

---

## 🔍 TROUBLESHOOTING

### If app doesn't start:
```bash
# Check error logs
pm2 logs pnptv-bot --err | tail -50

# Verify syntax
node -c apps/backend/bot/core/bot.js

# Check if port in use
lsof -i :3001

# Restart from scratch
pm2 delete pnptv-bot
pm2 start ecosystem.config.js --env production
```

### If Daimo webhook not working:
```bash
# Check secret is correct
grep "DAIMO_WEBHOOK_SECRET" .env.production

# Test diagnostic endpoint
curl -X POST http://localhost:3001/api/webhooks/daimo/debug \
  -H "Content-Type: application/json" \
  -d '{"test":true}' | jq .

# Check logs for signature errors
grep -i "signature\|authorization" /root/pnptvbot-production/logs/pm2-out.log | tail -10
```

### If PDS provisioning fails:
```bash
# Check logs
grep -i "pds.*error\|provisioning.*failed" /root/pnptvbot-production/logs/pm2-out.log

# Check database
psql -U pnptvbot -d pnptvbot -h localhost -c \
  "SELECT * FROM pds_provisioning_log WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5;"

# Check network connectivity
curl -s https://pds.pnptv.app/xrpc/com.atproto.server.describeServer | jq '.version'
```

### If Bluesky setup hangs:
```bash
# Check logs
grep -i "bluesky.*timeout\|bluesky.*error" /root/pnptvbot-production/logs/pm2-out.log

# Check if PDS is reachable
curl -s https://pds.pnptv.app/health | jq .

# Check backend logs for blocking operations
tail -20 /root/pnptvbot-production/logs/pm2-out.log | grep -i "bluesky"
```

---

## 📊 POST-DEPLOYMENT MONITORING

### Watch All Integrations
```bash
# Monitor Daimo, PDS, Bluesky in real-time
tail -f /root/pnptvbot-production/logs/pm2-out.log | \
  grep -E "Daimo|PDS|Bluesky|pds\]|daimo\]|bluesky\]"
```

### Check Database Stats
```bash
# See how many users have PDS provisioned
psql -U pnptvbot -d pnptvbot -h localhost -c \
  "SELECT COUNT(*) as pds_users FROM user_pds_mapping WHERE status = 'active';"

# See how many have Bluesky
psql -U pnptvbot -d pnptvbot -h localhost -c \
  "SELECT COUNT(*) as bluesky_users FROM user_pds_mapping WHERE bluesky_handle IS NOT NULL;"

# See provisioning errors
psql -U pnptvbot -d pnptvbot -h localhost -c \
  "SELECT action, status, COUNT(*) FROM pds_provisioning_log GROUP BY action, status ORDER BY action;"
```

### Alert on Errors
```bash
# Monitor for failures every 5 minutes
while true; do
  echo "=== $(date) ==="

  # Check for errors
  grep -i "error\|failed" /root/pnptvbot-production/logs/pm2-out.log | tail -5

  # Check process is still running
  pm2 status | grep pnptv-bot

  sleep 300
done
```

---

## 🎯 SUCCESS CRITERIA

After deployment, verify:

- [ ] `pm2 list` shows `pnptv-bot` running
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok"}`
- [ ] `/api/webhooks/daimo/debug` endpoint responds
- [ ] Logs show no `FATAL` or `CRITICAL` errors
- [ ] Can login via Telegram
- [ ] PDS info available after login
- [ ] "Setup Bluesky" button appears on dashboard
- [ ] Clicking button creates account in <5 seconds
- [ ] Success modal shows Bluesky handle
- [ ] Database shows entries in `user_pds_mapping`
- [ ] Database shows entries in `pds_provisioning_log`

---

## ⏱️ ESTIMATED TIMELINE

| Step | Time |
|------|------|
| Verify environment | 1 min |
| Check dependencies | 1 min |
| Build frontend (if needed) | 2 min |
| Restart app | 1 min |
| Verify endpoints | 1 min |
| **Total** | **6 min** |

---

## 📞 ESCALATION

If issues persist after following this guide:

1. Review: `PDS_BLUESKY_DAIMO_INTEGRATION_GUIDE.md`
2. Check: `DEPLOYMENT_CHECKLIST_PDS_BLUESKY_DAIMO.md`
3. Run: `bash scripts/verify-pds-bluesky-daimo.sh`
4. Check logs: `tail -100 logs/pm2-out.log`
5. Review database: Check `pds_provisioning_log` for errors

---

**Deployment Ready**: ✅ YES
**Tested**: ✅ YES
**Documentation**: ✅ COMPLETE
**Go-Live Approved**: ✅ YES

Deploy with confidence!
