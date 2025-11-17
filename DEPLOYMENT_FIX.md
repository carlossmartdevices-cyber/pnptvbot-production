# 🔧 Port Conflict Fixed - Ready to Deploy

## Issue Resolved
✅ **Port conflict fixed**: Removed Redis (6379) and Postgres (5432) port mappings

## What Changed

The deployment was failing because ports 6379 and 5432 were already in use on your host machine. 

**Solution:** Removed external port exposure since Redis and Postgres only need to be accessible within the Docker network. The bot connects using service names (`redis`, `postgres`) which works perfectly via Docker's internal networking.

### Benefits:
- ✅ No more port conflicts
- ✅ Better security (databases not exposed to host)
- ✅ Simpler configuration

## Deploy Now

On your production server, run ONE of these options:

### Option 1: Full Deployment Script (Recommended)
```bash
cd /path/to/pnptvbot-production
git pull origin main
./scripts/deploy.sh production
```

### Option 2: Quick Docker Deploy
```bash
cd /path/to/pnptvbot-production
git pull origin main

# Stop old containers
docker-compose down

# Remove any orphaned containers
docker-compose rm -f

# Build and start
docker-compose build --no-cache
docker-compose up -d

# Monitor logs
docker-compose logs -f bot
```

### Option 3: Use Feature Branch Directly
```bash
cd /path/to/pnptvbot-production
git fetch origin
git checkout claude/fix-redis-permissions-01HWeZvpAPhwsanvx3zfmjE6
git pull

docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f bot
```

## Verify Deployment

After starting, check:

```bash
# 1. All services running
docker-compose ps

# Should show:
# pnptv-bot       running
# pnptv-redis     running  
# pnptv-postgres  running

# 2. Check logs for success messages
docker-compose logs bot | tail -30

# Look for:
# ✓ Redis initialized
# ✓ Firebase initialized  
# ✓ Cache prewarmed successfully
# 🚀 PNPtv Telegram Bot is running!

# 3. Health check
curl http://localhost:3000/health

# Should return: {"status":"ok"}
```

## Accessing Databases (If Needed)

Since ports are no longer exposed, use Docker exec to access databases:

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Access Postgres
docker-compose exec postgres psql -U pnptv_user -d pnptv

# Or use a database client connected to localhost via Docker port forwarding
docker-compose port postgres 5432  # Find mapped port
```

## Re-enable External Access (Optional)

If you need external database access for management tools, edit `docker-compose.yml`:

```yaml
# For Postgres:
ports:
  - "5433:5432"  # Use 5433 to avoid conflict with host

# For Redis:
ports:
  - "6380:6379"  # Use 6380 to avoid conflict with host
```

Then restart: `docker-compose up -d`

---

**Status:** ✅ Ready to deploy
**Last Updated:** 2025-11-17
**Commit:** 57aaf1c - fix: Remove external port mappings for Redis and Postgres
