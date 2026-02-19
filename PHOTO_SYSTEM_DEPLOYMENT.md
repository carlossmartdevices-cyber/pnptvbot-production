# Photo System - Deployment Checklist

## ✅ Implementation Complete

All components have been implemented and tested. This document guides deployment to production.

## Pre-Deployment Verification

### 1. Files Created ✓
```bash
# Backend
✓ src/bot/services/PhotoService.js                      # Photo operations (350+ LOC)
✓ src/bot/api/controllers/photoController.js           # API endpoints (200+ LOC)
✓ src/bot/api/routes/photoRoutes.js                    # Route definitions
✓ database/migrations/060_photo_system.sql             # Database schema

# Frontend
✓ webapps/prime-hub/src/pages/admin/AdminPhotoPage.jsx
✓ webapps/prime-hub/src/components/PhotoUploadButton.jsx
✓ webapps/prime-hub/src/components/PhotoPreview.jsx
✓ webapps/prime-hub/src/components/PhotoGalleryInPost.jsx

# Configuration & Documentation
✓ PHOTO_SYSTEM_README.md                                # Comprehensive guide
✓ PHOTO_SYSTEM_SETUP.md                                 # Setup instructions
✓ PHOTO_SYSTEM_CURL_EXAMPLES.md                         # API testing
✓ scripts/setup-photo-system.sh                         # Automated setup
✓ scripts/test-photo-system.sh                          # Integration tests
```

### 2. Code Integration ✓
```bash
# Routes added to main router
✓ src/bot/api/routes.js:44                # Photo routes import
✓ src/bot/api/routes.js:1628              # Photo routes registration

# Frontend integration
✓ webapps/prime-hub/src/App.jsx:19        # Import AdminPhotoPage
✓ webapps/prime-hub/src/App.jsx:87        # Admin photo route
✓ webapps/prime-hub/src/pages/admin/AdminDashboardPage.jsx:5  # Image icon import
✓ webapps/prime-hub/src/pages/admin/AdminDashboardPage.jsx:142 # Photo gallery link

# API client methods
✓ webapps/prime-hub/src/api/client.js     # 15 new methods added
```

## Deployment Steps

### Step 1: Prepare Environment (5 minutes)
```bash
cd /root/pnptvbot-production

# Verify Node.js and npm
node --version  # v18+
npm --version   # v9+

# Verify PostgreSQL
psql --version  # PostgreSQL 12+
psql -U postgres -d pnptv_db -c "SELECT version();"

# Verify Redis
redis-cli ping  # Should return PONG
```

### Step 2: Install Dependencies (2 minutes)
```bash
# Verify required packages
npm ls sharp uuid fs-extra

# If missing, install:
npm install sharp uuid fs-extra
```

### Step 3: Run Database Migration (3 minutes)
```bash
# Using the setup script (recommended)
sudo bash /root/pnptvbot-production/scripts/setup-photo-system.sh

# OR manually
psql -U postgres -d pnptv_db -f /root/pnptvbot-production/database/migrations/060_photo_system.sql

# Verify migration
psql -U postgres -d pnptv_db -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('photos', 'photo_categories', 'photo_activity_log', 'user_photo_stats', 'photo_storage_limits');
"
```

### Step 4: Verify Directory Structure (2 minutes)
```bash
# Directories created automatically by setup script:
ls -lh /root/pnptvbot-production/public/photos/

# Should have:
# - admin/originals/
# - admin/thumbnails/
# - user-posts/originals/
# - user-posts/thumbnails/

# Set correct permissions:
chmod -R 755 /root/pnptvbot-production/public/photos/
```

### Step 5: Start Application (5 minutes)
```bash
# Option A: Using npm
cd /root/pnptvbot-production
npm start

# Option B: Using PM2
pm2 start ecosystem.config.js

# Monitor
pm2 logs bot

# Verify app is running
curl http://localhost:3001/api/health
```

### Step 6: Verify Frontend Build (5 minutes)
```bash
# Build admin interface
npm run build:prime-hub

# Check for errors
ls -lh public/prime-hub/index.html
```

### Step 7: Test API Endpoints (10 minutes)
```bash
# Run integration test suite
bash /root/pnptvbot-production/scripts/test-photo-system.sh

# Expected output:
# ✓ All tests passed!
```

### Step 8: Test Admin UI (5 minutes)
```bash
# Access admin panel
# Browser: http://localhost:3001/prime-hub/admin/photos
# (Requires admin login)

# Verify:
# 1. Page loads without errors
# 2. Upload button is visible
# 3. Can drag-drop test image
# 4. Grid/list view toggle works
# 5. Statistics display correctly
```

## Production Configuration

### Environment Variables (.env.production)
```bash
# Essential (should already be set)
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SESSION_SECRET=...

# Photo system (optional, defaults shown)
PHOTO_ADMIN_MAX_SIZE=50
PHOTO_USER_MAX_SIZE=10
PHOTO_THUMBNAIL_SIZE=200
PHOTO_COMPRESSION_QUALITY=80
```

### Database Limits (Optional Customization)
```sql
-- Increase limits for creators (default 25MB max file)
UPDATE photo_storage_limits
SET max_file_size_mb = 50
WHERE role = 'creator';

-- Increase monthly quota for models (default 100/month)
UPDATE photo_storage_limits
SET max_files_per_month = 200
WHERE role = 'model';
```

### Nginx Configuration (Optional)
Add caching headers for thumbnails:
```nginx
# In your Nginx config
location ~ /photos/(admin|user-posts)/thumbnails/ {
  expires 30d;
  add_header Cache-Control "public, immutable";
}

# Original photos - shorter cache
location ~ /photos/(admin|user-posts)/originals/ {
  expires 7d;
  add_header Cache-Control "public";
}
```

## Monitoring Setup

### Log Monitoring
```bash
# Real-time logs
pm2 logs bot

# Watch for photo operations
tail -f /var/log/pnptv/photo-operations.log
```

### Database Monitoring
```bash
# Check storage usage
psql -c "SELECT pg_size_pretty(pg_database_size('pnptv_db'));"

# Monitor uploads
psql -c "
  SELECT DATE(created_at), COUNT(*) as uploads
  FROM photos
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY DATE(created_at)
  ORDER BY DATE DESC;
"

# Check storage quotas
psql -c "SELECT * FROM user_photo_stats ORDER BY last_upload_at DESC LIMIT 10;"
```

### Disk Monitoring
```bash
# Watch storage
du -sh /root/pnptvbot-production/public/photos/
df -h /root/pnptvbot-production/

# Alert if > 80% full
alert_threshold=80
current=$(df /root/pnptvbot-production/ | awk 'NR==2 {print $5}' | cut -d'%' -f1)
if [ $current -gt $alert_threshold ]; then
  echo "Disk usage alert: ${current}%"
fi
```

## Backup Strategy

### Daily Backups
```bash
#!/bin/bash
# backup-photos.sh

BACKUP_DIR="/backup/photos"
DATE=$(date +%Y%m%d)

# Backup photos directory
tar -czf "$BACKUP_DIR/photos_$DATE.tar.gz" /root/pnptvbot-production/public/photos/

# Backup photos metadata (database)
pg_dump -U postgres -d pnptv_db -t photos -t photo_activity_log > "$BACKUP_DIR/photos_db_$DATE.sql"

# Keep last 30 days
find "$BACKUP_DIR" -name "photos_*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "photos_db_*.sql" -mtime +30 -delete
```

Schedule with cron:
```bash
# Add to crontab
0 2 * * * bash /root/pnptvbot-production/scripts/backup-photos.sh
```

## Cleanup Policy

### Archive Old Photos
```sql
-- Soft-delete photos older than 6 months
UPDATE photos
SET deleted_at = NOW()
WHERE created_at < NOW() - INTERVAL '180 days'
AND deleted_at IS NULL;

-- Hard-delete after 90 days soft-delete
DELETE FROM photos
WHERE deleted_at < NOW() - INTERVAL '90 days'
AND deleted_at IS NOT NULL;
```

### Cleanup Activity Logs
```sql
-- Keep activity logs for 1 year
DELETE FROM photo_activity_log
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Performance Optimization

### Database Indexes
All indexes are created automatically by migration. Verify:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'photos';
```

### Query Performance
Monitor slow queries:
```sql
-- In postgresql.conf
log_min_duration_statement = 1000  -- Log queries > 1 second

-- Check slow query log
tail -f /var/log/postgresql/postgresql.log | grep "duration:"
```

### Caching
Redis is used for session management. For production:
```bash
# Monitor Redis memory
redis-cli INFO memory

# Set max memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Troubleshooting Checklist

| Issue | Check | Fix |
|-------|-------|-----|
| Photos not uploading | File sizes, permissions | `chmod 755 public/photos/` |
| Thumbnails not generating | Sharp installation, Node memory | `npm ls sharp`, increase memory |
| High disk usage | Old photos, logs | Run cleanup scripts |
| Slow uploads | Network, CPU, disk I/O | Check system resources |
| API errors | Logs, database connection | `pm2 logs`, check DB connection |
| Storage quota not enforced | User role, limits table | Verify `user_photo_stats` updates |

## Rollback Plan

If issues occur:

### Immediate Rollback
```bash
# Stop application
pm2 stop bot

# Restore from backup
tar -xzf /backup/photos/photos_20260219.tar.gz -C /

# Restore database
psql -d pnptv_db -f /backup/photos/photos_db_20260219.sql

# Restart
pm2 start bot
```

### Database Rollback
```bash
-- Drop photo system tables (WARNING: deletes all photos)
DROP TABLE IF EXISTS photo_activity_log;
DROP TABLE IF EXISTS user_photo_stats;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS photo_storage_limits;
DROP TABLE IF EXISTS photo_categories;

-- If only reverting schema changes:
-- Restore from SQL backup and apply changes carefully
```

## Post-Deployment Testing

### Smoke Tests
```bash
# Test basic endpoints
curl -s http://localhost:3001/api/health

# Test admin upload (requires auth)
curl -s -X GET http://localhost:3001/api/admin/photos/list

# Test user endpoints
curl -s -X GET http://localhost:3001/api/photos/stats
```

### User Acceptance Testing
1. [ ] Admin can upload photos
2. [ ] Photos appear in grid/list view
3. [ ] Search and filters work
4. [ ] Edit metadata updates correctly
5. [ ] Delete removes photos
6. [ ] Batch delete works
7. [ ] Statistics display correctly
8. [ ] User photos have quota enforcement
9. [ ] Photos display in posts correctly
10. [ ] Thumbnails load quickly

## Success Criteria

✅ System is production-ready when:
- All endpoints return correct status codes
- Photos upload and display without errors
- Storage quotas are enforced
- Database audit trail is logging operations
- Admin panel is fully functional
- No errors in pm2 logs
- Disk space monitoring shows normal levels
- Performance benchmarks are within limits

## Support

For issues or questions:
1. Check logs: `pm2 logs bot`
2. Review: `PHOTO_SYSTEM_README.md`
3. Test API: `PHOTO_SYSTEM_CURL_EXAMPLES.md`
4. Debug: Check `photo_activity_log` for audit trail

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Status**: ✓ Ready for Production
