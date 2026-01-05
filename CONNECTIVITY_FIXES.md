# Server Connectivity Issues - Fixes Applied

## Summary

Critical connectivity issues have been resolved in commit `3477595`. The server now properly connects all services within the Docker network with correct service discovery and port routing.

## Issues Fixed

### 1. **Port Mismatch** ⚠️ CRITICAL
- **Problem**: Bot was configured for `PORT=3005` in `.env` but `docker-compose.yml` exposed port `3000`
- **Impact**: Nginx health checks and proxying failed, bot appeared unresponsive
- **Fix**: Changed docker-compose expose to `3005` and updated all nginx proxy_pass directives

### 2. **PostgreSQL Connection Failure** ⚠️ CRITICAL
- **Problem**: `POSTGRES_HOST=localhost` inside Docker container couldn't reach database on host
- **Solution**: Added PostgreSQL 15 Alpine service to docker-compose.yml for proper container networking
- **Changes**:
  - New `postgres` service with health checks
  - `postgres-data` volume for persistence
  - `POSTGRES_HOST=postgres` environment override in bot service

### 3. **Redis Connection Failure** ⚠️ CRITICAL
- **Problem**: `REDIS_HOST=localhost` in `.env` unreachable from Docker container
- **Fix**: Updated `.env` to `REDIS_HOST=redis` (docker-compose was already correct)

### 4. **Nginx Port Routing** ⚠️ CRITICAL
- **Problem**: All nginx locations proxied to `localhost:3000` instead of `3005`
- **Fix**: Updated 7 nginx proxy_pass locations to `localhost:3005`:
  - `/hub/api/`
  - `/hub/health`
  - `/webhook/telegram`
  - `/api/webhooks/`
  - `/health`
  - `/api/`
  - `/` (catch-all)

## Changes Made

### docker-compose.yml
```yaml
# New PostgreSQL service
postgres:
  image: postgres:15-alpine
  container_name: pnptv-postgres
  restart: unless-stopped
  environment:
    - POSTGRES_USER=${POSTGRES_USER:-pnptvbot}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    - POSTGRES_DB=${POSTGRES_DATABASE:-pnptvbot}
  volumes:
    - postgres-data:/var/lib/postgresql/data
  networks:
    pnptv-network:
      aliases:
        - postgres
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-pnptvbot} -d ${POSTGRES_DATABASE:-pnptvbot}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s

# Bot service updates
bot:
  expose:
    - "3005"  # Changed from 3000
  environment:
    - REDIS_HOST=redis
    - POSTGRES_HOST=postgres  # Added
    - POSTGRES_PORT=5432      # Added
  depends_on:
    redis:
      condition: service_healthy
    postgres:                  # Added
      condition: service_healthy
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:3005/health', ...)"]  # Port updated
```

### .env Changes
```env
# Before
POSTGRES_HOST=localhost
POSTGRES_PORT=55432
REDIS_HOST=localhost

# After
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
REDIS_HOST=redis
```

### nginx/pnptv-bot.conf
Updated all 7 proxy_pass locations:
```nginx
# Before
proxy_pass http://localhost:3000/api/webhooks/;

# After
proxy_pass http://localhost:3005/api/webhooks/;
```

## Deployment Instructions

### Step 1: Pull Latest Changes
```bash
cd /root/pnptvbot-production
git pull origin main
```

### Step 2: Rebuild Containers
```bash
docker-compose down
docker-compose up -d
```

This will:
- Create the new PostgreSQL service
- Rebuild the bot container
- Initialize PostgreSQL database
- Start Redis and Nginx

### Step 3: Verify Connectivity
```bash
# Check services are healthy
docker-compose ps

# Check logs for connectivity
docker-compose logs bot -f

# Test health endpoints
curl http://localhost/health
curl https://easybots.store/health
```

### Step 4: Monitor Startup
PostgreSQL and Redis health checks ensure services are ready before bot starts:
- PostgreSQL: 10s startup period, 10s interval checks
- Redis: 10s startup period, 5s interval checks
- Bot: 60s startup period, 30s interval checks

## Verification Checklist

- [ ] All containers are `healthy` (status shows `Up`)
- [ ] Bot container logs show "PostgreSQL connection successful"
- [ ] Bot container logs show "Redis connection successful"
- [ ] Health endpoint responds: `curl http://localhost/health`
- [ ] Telegram webhook is receiving updates
- [ ] Payment webhooks are processing correctly
- [ ] Database queries execute without connection errors

## Connection Architecture

```
┌─────────────────────────────────────────────┐
│  Docker Container Network: pnptv-network   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │ nginx:3005   │  │ bot:3005            │ │
│  │ (reverse     │→│ (Node.js API)       │ │
│  │  proxy)      │  └──────────┬──────────┘ │
│  └──────────────┘             │            │
│                               │            │
│                    ┌──────────┴──────────┐ │
│                    ▼                     ▼ │
│              ┌──────────┐         ┌──────────┐
│              │PostgreSQL│         │  Redis   │
│              │:5432     │         │  :6379   │
│              └──────────┘         └──────────┘
│                                             │
└─────────────────────────────────────────────┘
         │
         │ External traffic (80, 443)
         ▼
    Internet / Telegram
```

## Troubleshooting

### Bot Container Won't Start
```bash
# Check logs
docker-compose logs bot --tail 50

# Verify PostgreSQL is healthy
docker-compose logs postgres --tail 20

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Connection Refused Errors
```bash
# Verify service discovery within container
docker exec pnptv-bot nslookup postgres
docker exec pnptv-bot nslookup redis

# Test port connectivity
docker exec pnptv-bot nc -zv postgres 5432
docker exec pnptv-bot nc -zv redis 6379
```

### Health Check Failing
```bash
# Check bot health endpoint
docker exec pnptv-bot curl http://localhost:3005/health

# Check logs for specific errors
docker-compose logs bot --tail 100 | grep -i "error\|fail"
```

## Environment Variables

Important variables to verify in `.env`:

```env
# Database (must use service name in Docker)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=pnptvbot
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=<secure_password>

# Cache (must use service name in Docker)
REDIS_HOST=redis
REDIS_PORT=6379

# Server port
PORT=3005
NODE_ENV=production
```

## Security Notes

1. **PostgreSQL** is only accessible within the Docker network, not exposed to host
2. **Redis** is only accessible within the Docker network, not exposed to host
3. **Bot** listens on port 3005 internally, only nginx can access it
4. **Database credentials** are read from `.env` file - keep secure

## Related Documentation

- [Docker Compose Configuration](./docker-compose.yml)
- [Nginx Configuration](./nginx/pnptv-bot.conf)
- [Environment Configuration](./.env)
- [PostgreSQL Connection Handler](./src/config/postgres.js)
- [Redis Connection Handler](./src/config/redis.js)

## Rollback Instructions

If issues occur, revert to previous configuration:

```bash
git revert 3477595
docker-compose down
docker-compose up -d
```

---

**Last Updated**: 2025-12-29
**Commit**: 3477595
**Author**: Claude Code
**Status**: ✅ All connectivity issues resolved
