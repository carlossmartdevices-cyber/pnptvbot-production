# ⚡ QUICK START - Redeploy Commands

## 🚀 One-Liner Redeploy (Full Clean Install)

```bash
cd /root/pnptvbot-production && npm cache clean --force && rm -rf node_modules package-lock.json && npm install && npm test && pm2 start ecosystem.config.js && pm2 logs pnptvbot
```

## 📋 Step-by-Step Quick Reference

### 1️⃣  Clean Everything
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
```

### 2️⃣  Fresh Install
```bash
npm install
```

### 3️⃣  Test
```bash
npm test
# Expected: 244 passed, 244 total ✅
```

### 4️⃣  Deploy
```bash
pm2 start ecosystem.config.js
```

### 5️⃣  Monitor
```bash
pm2 logs pnptvbot
```

---

## 🔍 Verification Commands

### Health Check
```bash
curl https://pnptv.app/health
```

### Database Check
```bash
PGPASSWORD='Apelo801050#' psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "SELECT version();"
```

### Active Processes
```bash
pm2 status
pm2 monit
```

### Recent Logs
```bash
pm2 logs pnptvbot --lines 50
```

---

## 🛑 Stop/Restart Commands

### Stop Bot
```bash
pm2 stop pnptvbot
```

### Restart Bot
```bash
pm2 restart pnptvbot
```

### Delete from PM2
```bash
pm2 delete pnptvbot
```

### Full Reset
```bash
pm2 stop pnptvbot
pm2 delete pnptvbot
rm -rf ~/.pm2
pm2 start ecosystem.config.js
```

---

## 🧪 Test Verification

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- tests/integration/database/postgres.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="Daimo"
```

---

## 📊 Environment Variables

### View Key Variables
```bash
grep -E "DAIMO_|POSTGRES_|REDIS_" .env
```

### Update Credentials (if needed)
```bash
# Edit .env file
nano .env

# Key variables to verify:
POSTGRES_PORT=55432
DAIMO_TREASURY_ADDRESS=0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613
DAIMO_WEBHOOK_SECRET=0x9af864a...
```

---

## 🔐 Security Checks

### Verify Database SSL
```bash
PGPASSWORD='Apelo801050#' psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "SHOW ssl;"
```

### Check Webhook Handlers
```bash
grep -r "processDaimoWebhook\|processEpaycoWebhook" src/
```

### Verify Environment Secrets
```bash
# Check no secrets in logs
grep -i "password\|secret" ~/.pm2/logs/pnptvbot-*.log | head -5
```

---

## 🆘 Troubleshooting

### npm install fails
```bash
npm cache verify && npm install --no-optional
```

### Tests fail after install
```bash
# Make sure PostgreSQL is running
pg_isready -h localhost -p 55432

# Verify credentials
PGPASSWORD='Apelo801050#' psql -h localhost -p 55432 -U pnptvbot -d postgres -c "\du"
```

### Port 3000 in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Bot won't start
```bash
pm2 logs pnptvbot --lines 100
# Check for specific errors in output
```

---

## 📈 Performance Check

### Memory Usage
```bash
pm2 monit
# Expected: 150-200 MB after startup
```

### Response Time
```bash
time curl https://pnptv.app/health
# Expected: <100ms
```

### Database Connections
```bash
PGPASSWORD='Apelo801050#' psql -h localhost -p 55432 -U pnptvbot -d pnptvbot -c "SELECT count(*) FROM pg_stat_activity;"
# Expected: 2-10 connections
```

---

## 📝 Log Files

### View Bot Logs
```bash
pm2 logs pnptvbot
```

### View Errors
```bash
tail -100 ~/.pm2/logs/pnptvbot-error.log
```

### Follow Logs in Real-time
```bash
pm2 logs pnptvbot --follow
```

### Save Logs to File
```bash
pm2 logs pnptvbot > bot_logs_$(date +%Y%m%d_%H%M%S).txt
```

---

## ✅ Final Checklist Before Deploying

- [ ] Cache cleaned (`npm cache clean --force`)
- [ ] Dependencies removed (`rm -rf node_modules package-lock.json`)
- [ ] Fresh install completed (`npm install`)
- [ ] All tests passing (`npm test` → 244/244)
- [ ] PostgreSQL verified (`pg_isready`)
- [ ] Environment variables set (`.env` check)
- [ ] PM2 ecosystem.config.js present
- [ ] Previous bot process stopped (`pm2 stop pnptvbot`)

---

## 🎯 Expected After Deployment

✅ Bot Status: Online (pm2 status)
✅ Health Endpoint: 200 OK
✅ Database: Connected
✅ Memory: 150-200 MB
✅ CPU: <5%
✅ Telegram: Receiving messages
✅ Webhooks: Listening
✅ No errors in logs

---

## 📞 Emergency Commands

### If Something Goes Wrong
```bash
# Stop immediately
pm2 stop pnptvbot

# Check what went wrong
pm2 logs pnptvbot --lines 200

# Rollback
git status
git log --oneline | head -5
git revert <commit>

# Restart fresh
npm cache clean --force
rm -rf node_modules
npm install
pm2 restart pnptvbot
```

---

**Quick Deploy:** < 5 minutes  
**Status:** ✅ Ready  
**Tests:** 244/244 passing  
**Date:** Nov 26, 2025
