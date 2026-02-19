# Deployment Configuration Reference

**Last Updated:** 2026-02-14
**Status:** Production - Both apps deployed and running

---

## 🌐 Application Overview

### 1. **EasyBots Webapp** (Frontend Commerce)
- **Type:** Next.js 16.1.6 Application
- **Purpose:** Payment processing, product catalog, checkout
- **Repository:** `/root/Easy_Bots/Webapp`
- **Process Manager:** PM2 (ID: 1, Status: online)

### 2. **PNPtv Bot** (Telegram Bot)
- **Type:** Node.js Bot + API Server
- **Purpose:** Telegram bot interface, user management, broadcasts
- **Repository:** `/root/pnptvbot-sandbox` (local) / `https://github.com/carlossmartdevices-cyber/pnptvbot-production` (remote)
- **Process Manager:** PM2 (ID: 0, Status: online, 3 restarts)

### 3. **PNPtv App** (Production Server)
- **Type:** Docker Container (Telegram Bot + API)
- **Purpose:** Production bot instance on dedicated server
- **Server:** `76.13.26.234` (roadtopnptv.online)
- **Container:** `pnptv-bot` (image: `pnp-app-bot:latest`)

---

## 🔌 Port Allocation

### Local Development/Staging

| Application | Port | Protocol | Bind Address | Status |
|-------------|------|----------|--------------|--------|
| EasyBots Webapp | 3000 | HTTP | 0.0.0.0 | ✅ LISTENING |
| PNPtv Bot API | 3001 | HTTP | 0.0.0.0 | ✅ LISTENING |
| Redis | 6379 | TCP | 127.0.0.1 | ✅ LISTENING |
| PostgreSQL | 5432 | TCP | 127.0.0.1 | ✅ LISTENING |
| Nginx (HTTP) | 80 | HTTP | 0.0.0.0 | ✅ LISTENING |
| Nginx (HTTPS) | 443 | HTTPS | 0.0.0.0 | ✅ LISTENING |

### Production Server (76.13.26.234)

| Application | Port | Protocol | Bind Address | Status |
|-------------|------|----------|--------------|--------|
| PNPtv Bot API | 3002 | HTTP | 0.0.0.0 | ✅ DOCKER |
| Redis | 6379 | TCP | 127.0.0.1 | ✅ SYSTEMD |
| PostgreSQL | 5432 | TCP | 127.0.0.1 | ✅ SYSTEMD |

---

## 🌍 Domain & URL Mapping

### EasyBots Webapp

| Purpose | URL | Port | Destination |
|---------|-----|------|-------------|
| **Public Site** | https://easybots.store | 443 | Nginx → Localhost:3000 |
| **Checkout** | https://easybots.store/checkout | 443 | Nginx → Localhost:3000 |
| **Admin** | https://easybots.store/admin | 443 | Nginx → Localhost:3000 |
| **Payment Webhook** | https://easybots.store/api/payment/webhook/* | 443 | Nginx → Localhost:3000 |
| **API** | https://easybots.store/api/* | 443 | Nginx → Localhost:3000 |

### PNPtv Bot - Local

| Purpose | URL | Port | Destination |
|---------|-----|------|-------------|
| **Bot API** | http://localhost:3001 | 3001 | Direct Node.js |
| **Health Check** | http://localhost:3001/health | 3001 | Direct Node.js |
| **Webhook** | http://localhost:3001/webhook/telegram | 3001 | Direct Node.js |
| **Admin Routes** | http://localhost:3001/api/admin/* | 3001 | Direct Node.js |

### PNPtv Bot - Production (76.13.26.234)

| Purpose | URL | Port | Destination |
|---------|-----|------|-------------|
| **Public Domain** | https://roadtopnptv.online | 443 | Nginx/Reverse Proxy |
| **Bot Webhook** | https://roadtopnptv.online/webhook/telegram | 443 | Docker:3002 |
| **Bot API** | https://roadtopnptv.online:3002 | 3002 | Docker:3002 |
| **Health Check** | https://roadtopnptv.online/health | 443 | Docker:3002 |

---

## 📁 File Locations

### EasyBots

```
/root/Easy_Bots/Webapp/                    # Root directory
├── .env.local                             # Configuration (local only)
├── .next/                                 # Build output
├── .next/standalone/                      # Production server files
└── src/                                   # Source code
```

### PNPtv Bot - Local

```
/root/pnptvbot-sandbox/                    # Local development
├── src/                                   # Source code
├── .env                                   # Local config
├── .env.pnp-app                          # Production config
├── .env.production                        # Fallback config
├── docker-compose.prod.yml                # Docker config
└── Dockerfile                             # Docker image
```

### PNPtv Bot - Production

```
/opt/pnp-app/                              # Production server (76.13.26.234)
├── .env                                   # Active config (copied from .env.pnp-app)
├── docker-compose.prod.yml                # Docker compose
├── src/                                   # Source code
├── logs/                                  # Application logs
└── uploads/                               # User uploads
```

---

## 🔧 Configuration Files

### EasyBots (.env.local)

```env
NEXT_PUBLIC_SITE_URL=https://easybots.store
NEXT_PUBLIC_CURRENCY_DEFAULT=usd
NEXT_PUBLIC_EPAYCO_PUBLIC_KEY=test_public_key_123456789
EPAYCO_PRIVATE_KEY=test_private_key_987654321
PAYMENT_HMAC_SECRET=dev-secret-key-change-in-production
```

**Status:** ⚠️ Using test keys - **NEEDS PRODUCTION KEYS**

### PNPtv Bot (.env.pnp-app)

```env
NODE_ENV=production
PORT=3002
BOT_WEBHOOK_DOMAIN=https://roadtopnptv.online
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
CHECKOUT_DOMAIN=https://easybots.store
```

**Status:** ✅ Production configuration

---

## ⚠️ Port Conflict Prevention Rules

### ❌ DO NOT USE These Ports

| Port | Reserved For | Reason |
|------|--------------|--------|
| 80 | Nginx HTTP | System-level |
| 443 | Nginx HTTPS | System-level |
| 5432 | PostgreSQL | Database service |
| 6379 | Redis | Cache service |

### ✅ AVAILABLE Ports for New Apps

- 3003, 3004, 3005 (Local Node.js apps)
- 3100+, 3200+, 4000+ (Additional ports if needed)
- **Never** use 3000, 3001, 3002 (already allocated)

---

## 🚀 Deployment Pipeline

### Local Development
1. Code changes in `/root/pnptvbot-sandbox`
2. Test locally with `npm run dev` or `PM2`
3. Commit to `refactor/webapps-nearby-wip` branch

### Production Deployment (76.13.26.234)

```bash
# 1. SSH into server
ssh -i ~/.ssh/id_ed25519_pnp_app_deploy root@76.13.26.234

# 2. Navigate to project
cd /opt/pnp-app

# 3. Pull latest changes
git pull origin refactor/webapps-nearby-wip

# 4. Rebuild Docker
docker compose -f docker-compose.prod.yml build --no-cache

# 5. Deploy
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# 6. Verify
docker compose -f docker-compose.prod.yml logs -n 50
```

---

## 🔍 Health Checks

### EasyBots
```bash
curl -I http://localhost:3000
# Expected: HTTP 200 OK with HTML content
```

### PNPtv Bot (Local)
```bash
curl -I http://localhost:3001/health
# Expected: HTTP 200 OK
```

### PNPtv Bot (Production)
```bash
curl -I https://roadtopnptv.online/health
# Expected: HTTP 200 OK
```

---

## 📊 Process Monitoring

### View all processes
```bash
pm2 list
pm2 monit
```

### View logs
```bash
# EasyBots
pm2 logs easybots-webapp

# PNPtv Bot
pm2 logs pnptv-bot
```

### Restart
```bash
# Single app
pm2 restart easybots-webapp
pm2 restart pnptv-bot

# All apps
pm2 restart all
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Restart with PM2
pm2 restart <app-name>
```

### Server Errors
```bash
# Check recent logs
pm2 logs <app-name> --lines 100

# Check error-specific log
tail -f /root/.pm2/logs/<app-name>-error.log
```

### Connection Issues
```bash
# Test database
psql -h localhost -U pnptvbot -d pnptvbot -c "SELECT 1"

# Test Redis
redis-cli ping

# Test Nginx
curl -I http://localhost
```

---

## 📝 Notes

- **EasyBots** serves payment/commerce functionality
- **PNPtv Bot** handles Telegram bot and user management
- Both apps use shared **PostgreSQL** and **Redis**
- **Nginx** acts as reverse proxy for HTTPS/domain routing
- Production server has **Docker** isolation
- All credentials stored in `.env` files (never in git)

---

## 🔐 Security Checklist

- [ ] Production API keys configured (not test keys)
- [ ] HTTPS enabled for all domains
- [ ] Database credentials secured
- [ ] Environment variables not exposed
- [ ] Nginx firewall rules configured
- [ ] Regular backups scheduled
- [ ] Monitoring/alerting set up

---

**Next Steps:**
1. Replace test keys in EasyBots with production keys
2. Set up automated health checks
3. Configure log rotation
4. Document API endpoints for both services
5. Plan disaster recovery procedures
