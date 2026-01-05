# 🔍 Monitoring & Debugging Guide - Jitsi Moderator Bot

**Purpose:** Monitor bot health and debug issues
**Target Audience:** Developers and DevOps engineers

---

## 🔍 Viewing Logs

### Development Mode (Real-time Logs)

```bash
npm run dev
```

Shows live logs as they happen.

### Production Mode (File Logs)

```bash
tail -f logs/combined.log
```

### Filter by Moderator Bot

```bash
tail -f logs/combined.log | grep -i jitsi
```

### Search Logs

```bash
# Find errors
grep "ERROR\|error" logs/combined.log

# Find violations
grep "violation" logs/combined.log

# Find specific user
grep "user123" logs/combined.log
```

---

## ⚡ Monitoring Health

### Check Bot Status

```bash
# Is bot running?
ps aux | grep "npm start"

# Using PM2
pm2 list

# Using Docker
docker ps | grep pnptvbot
```

### Check Moderator Handler Registration

On bot startup, look for:
```
✓ Jitsi Moderator handlers registered
```

### Monitor Active Rooms

```bash
# Listen for room joins
tail -f logs/combined.log | grep "room:joined"

# Listen for room exits
tail -f logs/combined.log | grep "room:left"
```

### Track Violations

```bash
# All violations
tail -f logs/combined.log | grep "violation"

# High violation users
tail -f logs/combined.log | grep "violation" | grep " 5\| 6\| 7"
```

---

## 🔧 Debugging Issues

### Issue: Bot Not Starting

```bash
npm start 2>&1 | head -20
```

**Look for:**
- Missing environment variables
- PostgreSQL connection failed
- Syntax errors

**Debug:**
```bash
npm run validate:env
node --version
```

---

### Issue: Moderator Command Not Working

**Check handler registration:**
```bash
grep "registerJitsiModeratorHandlers" src/bot/core/bot.js
```

Should show 2 lines (import + registration).

**Check logs:**
```bash
tail -f logs/combined.log | grep -i "moderator"
```

**Check admin ID:**
```bash
grep "ADMIN_ID" .env
```

---

### Issue: Buttons Not Responding

**Check bot is running:**
```bash
ps aux | grep "npm start"
```

**Check for errors:**
```bash
tail -f logs/combined.log | grep -i "error"
```

---

### Issue: Room Join Fails

**Check Jitsi configuration:**
```bash
grep "JITSI_DOMAIN\|JITSI_MUC_DOMAIN" .env
```

**Check network:**
```bash
curl -I https://meet.jit.si
```

---

## 📊 Performance Metrics

### CPU Usage

```bash
# Watch CPU
watch -n 1 'ps aux | grep "npm start"'

# Expected: < 5% CPU when idle
```

### Memory Usage

```bash
free -h
# Expected: ~200MB at startup, +5MB per active room
```

### Response Time

```bash
# Expected: < 100ms for commands
```

---

## 🚨 Alert Setup

### Setup Health Check Script

Create `check_health.sh`:
```bash
#!/bin/bash

# Check if bot is running
if ! ps aux | grep -q "npm start"; then
  echo "ERROR: Bot is not running!"
  exit 1
fi

echo "Health check passed"
```

Run periodically:
```bash
# Every 5 minutes
*/5 * * * * /path/to/check_health.sh
```

---

## 🔬 Debugging Checklist

When something breaks:

- [ ] Bot is running: `ps aux | grep "npm start"`
- [ ] Handler registered: Check bot.js
- [ ] Logs show startup: `tail logs/combined.log`
- [ ] Admin ID correct: Check .env
- [ ] Jitsi domain correct: Check .env
- [ ] Restart bot: `npm start`

---

## 📝 Common Commands

### View All Jitsi Logs

```bash
grep -i "jitsi\|moderator" logs/combined.log
```

### Count Events

```bash
# Count room joins
grep "room:joined" logs/combined.log | wc -l

# Count violations
grep "violation" logs/combined.log | wc -l

# Count kicks
grep "action:kick" logs/combined.log | wc -l
```

### Tail Specific User Activity

```bash
USER="user123"
tail -f logs/combined.log | grep "$USER"
```

---

## 📊 Metrics to Track

| Metric | Good Range |
|--------|-----------|
| Bot uptime | > 99% |
| Response time | < 100ms |
| CPU usage | < 20% |
| Memory usage | < 300MB |
| Active rooms | < 20 |

---

**Document Version:** 1.0
**Last Updated:** January 2024
