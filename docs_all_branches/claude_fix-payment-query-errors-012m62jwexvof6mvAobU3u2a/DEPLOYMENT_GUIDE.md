# 🚀 Deployment Guide - Redis & Permissions Fix

## Changes Deployed

This deployment includes critical fixes for:
- ✅ Enhanced Redis connection resilience with exponential backoff
- ✅ Fixed Docker file permissions for public directory
- ✅ Improved health checks and network configuration
- ✅ Better DNS resolution handling during startup

## Deployment Options

### Option 1: Automatic CI/CD (Recommended)

Since your changes are pushed to `main` branch, GitHub Actions will automatically:
1. Run tests
2. Build Docker image
3. Deploy to production server

**Check deployment status:**
```bash
# Visit: https://github.com/carlossmartdevices-cyber/pnptvbot-production/actions
```

### Option 2: Manual Docker Deployment

On your production server, run:

```bash
# Navigate to project directory
cd /path/to/pnptvbot-production

# Pull latest changes
git pull origin main

# Run deployment script
./scripts/deploy.sh production
```

The script will:
- Stop existing containers
- Pull latest changes
- Rebuild Docker images
- Start services with health checks
- Verify deployment success

### Option 3: Quick Manual Deployment

```bash
# Stop existing containers
docker-compose down

# Pull and rebuild
git pull origin main
docker-compose build --no-cache

# Start services
docker-compose up -d

# Monitor logs
docker-compose logs -f bot
```

## Verification Steps

After deployment, verify the fixes are working:

### 1. Check Redis Connection
```bash
docker-compose logs bot | grep -i redis
```

**Expected:** No more "getaddrinfo EAI_AGAIN redis" errors
**Expected:** See "Redis connected successfully" message

### 2. Check File Permissions
```bash
curl http://localhost:3000/
```

**Expected:** No "EACCES: permission denied" errors
**Expected:** HTML page loads successfully

### 3. Check Service Health
```bash
curl http://localhost:3000/health | jq .
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T...",
  "dependencies": {
    "redis": "connected",
    "firebase": "connected",
    "postgres": "connected"
  }
}
```

### 4. Monitor Startup Logs
```bash
docker-compose logs -f bot
```

**Look for:**
- ✅ "✓ Redis initialized"
- ✅ "✓ Cache prewarmed successfully"
- ✅ "🚀 PNPtv Telegram Bot is running!"
- ✅ No permission errors

## Rollback (if needed)

If issues occur, rollback to previous version:

```bash
# Stop services
docker-compose down

# Checkout previous commit
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>

# Rebuild and restart
docker-compose build
docker-compose up -d
```

## Support Commands

```bash
# View all logs
docker-compose logs -f

# View bot logs only
docker-compose logs -f bot

# Check container status
docker-compose ps

# Restart bot only
docker-compose restart bot

# Access bot container shell
docker-compose exec bot sh

# Check Redis connection inside container
docker-compose exec bot node -e "require('./src/config/redis').initializeRedis()"
```

## Expected Improvements

After this deployment:
- 🎯 Redis connections establish reliably
- 🎯 No more DNS resolution errors during startup
- 🎯 Public HTML files serve without permission errors
- 🎯 Faster startup with better health check timing
- 🎯 More informative retry logs

---

**Deployment completed by:** Claude AI
**Date:** 2025-11-17
**Commit:** 0af0063 - fix: Improve Redis connection resilience and Docker permissions
