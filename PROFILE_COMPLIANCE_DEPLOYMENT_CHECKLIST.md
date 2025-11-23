# Profile Compliance System - Deployment Checklist

## Pre-Deployment

- [ ] Backup current database: `pg_dump pnptv_bot > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Stop bot: `systemctl stop pnptv-bot` or `pm2 stop pnptvbot`
- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install` (if needed)

## Database Setup

- [ ] Execute migration - Option A (auto):
  ```bash
  psql -U postgres -d pnptv_bot < database/migrations/missing_tables_schema.sql
  ```

- [ ] Or manually verify tables exist:
  ```sql
  psql -U postgres -d pnptv_bot
  \dt profile_compliance
  \di | grep profile_compliance
  SELECT count(*) FROM profile_compliance;
  ```

## Code Verification

- [ ] Check middleware exists: `ls src/bot/core/middleware/profileCompliance.js`
- [ ] Check bot.js includes middleware: `grep profileCompliance src/bot/core/bot.js`
- [ ] Check admin commands added: `grep -c "/noncompliant" src/bot/handlers/moderation/adminCommands.js`
- [ ] Check no syntax errors: `node -c src/bot/core/middleware/profileCompliance.js`

## Deployment

- [ ] Start bot: `systemctl start pnptv-bot` or `pm2 start pnptvbot --update-env`
- [ ] Wait 30 seconds for initialization
- [ ] Check status: `systemctl status pnptv-bot`
- [ ] Check logs: `tail -f /var/log/pnptv-bot.log` (or `pm2 logs pnptvbot`)

## Post-Deployment Testing

- [ ] Join test group as admin
- [ ] Run `/noncompliant` - should return empty or existing data
- [ ] Run `/sendcompliancewarnings` - should send group message
- [ ] Create test account with:
  - No username (just first name)
  - Russian name or Arabic name
- [ ] Have test account send message
- [ ] Verify: Private DM warning received
- [ ] Verify: Group notification sent
- [ ] Verify: Message deleted
- [ ] Check logs: `tail -f /var/log/pnptv-bot.log | grep compliance`

## Production Verification

- [ ] No error messages in logs
- [ ] Middleware loading without issues: `grep "profileCompliance" logs`
- [ ] Database connection working: Check for DB errors
- [ ] Admin commands responsive: Test `/noncompliant`
- [ ] Performance normal: Check response times in logs
- [ ] No user complaints: Monitor for issues

## Rollback Plan (If Needed)

### Option 1: Quick Stop (disable enforcement)
```bash
systemctl stop pnptv-bot
git revert HEAD
npm install
systemctl start pnptv-bot
```

### Option 2: Remove Compliance Data
```sql
DELETE FROM profile_compliance;
DELETE FROM moderation_logs WHERE action LIKE '%compliance%';
```

### Option 3: Restore from Backup
```bash
pg_restore -d pnptv_bot backup_20251122_HHMMSS.sql
```

## Post-Launch Monitoring

### Daily Tasks
- [ ] Check `/noncompliant` for users about to be purged
- [ ] Monitor logs for compliance warnings
- [ ] Verify auto-purge working at deadline times

### Weekly Tasks
- [ ] Review compliance statistics: `SELECT COUNT(*) FROM profile_compliance WHERE compliance_met_at IS NOT NULL;`
- [ ] Check for errors: `grep ERROR /var/log/pnptv-bot.log | grep compliance`
- [ ] Verify admin commands working

### Monthly Tasks
- [ ] Archive compliance logs
- [ ] Review compliance patterns
- [ ] Adjust deadline if needed (edit source code)

## Configuration Reference

**Deadline:** 48 hours (hardcoded in profileCompliance.js line 246)
**Name Validation:** Latin alphabet regex (line 129)
**Message Deletion:** Silent (no notification sent)

To customize: Edit `src/bot/core/middleware/profileCompliance.js`

## Support Commands

| Scenario | Command |
|----------|---------|
| View non-compliant users | `/noncompliant` |
| Send compliance broadcast | `/sendcompliancewarnings` |
| Force remove all non-compliant | `/purgenoncompliant` |
| Check database directly | `SELECT * FROM profile_compliance;` |
| View compliance logs | `SELECT * FROM moderation_logs WHERE action LIKE '%compliance%';` |

## Success Indicators

✅ Bot starts without errors
✅ Middleware loading: `grep "Register middleware" logs`
✅ Admin commands work: `/noncompliant` returns data or "no users"
✅ Non-compliant users warned: Messages received within seconds
✅ Messages deleted: Users' messages disappear
✅ Auto-purge working: Users kicked after deadline (manual test: change deadline to 1 minute for testing)

## Issues & Solutions

| Issue | Solution |
|-------|----------|
| Module not found error | Check `src/bot/core/middleware/profileCompliance.js` exists |
| Database table error | Run migration SQL or manually create table |
| Warnings not sent | Check bot permissions, user DM settings |
| Messages not deleted | Verify bot has message delete permission |
| Auto-purge not working | Check logs, verify deadline calculation correct |

## Emergency Contact

If critical issues:
1. Stop bot immediately: `systemctl stop pnptv-bot`
2. Rollback: `git revert HEAD && systemctl start pnptv-bot`
3. Check backup: `pg_restore -d pnptv_bot backup_file.sql`
4. Review logs: `tail -100 /var/log/pnptv-bot.log`

## Documentation

- Full docs: `PROFILE_COMPLIANCE_DOCUMENTATION.md`
- Quick start: `PROFILE_COMPLIANCE_QUICK_START.md`
- Implementation: `PROFILE_COMPLIANCE_IMPLEMENTATION.txt`
- Admin guide: `PROFILE_COMPLIANCE_IMPLEMENTATION.txt` (Admin Commands section)

---

**Ready to Deploy:** Yes ✅
**Status:** Production Ready
**Date:** November 22, 2025
