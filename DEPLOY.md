# PNPtv Telegram Bot - Deployment Guide

## ✅ Pre-Deployment Checklist

Everything is ready for deployment:

- ✅ PostgreSQL database configured and migrated
- ✅ Redis configured for caching
- ✅ 5 subscription plans loaded (Trial Week to Lifetime Pass)
- ✅ All dependencies installed
- ✅ Environment variables configured
- ✅ Telegram bot token configured
- ✅ Payment systems configured (Daimo USDC)
- ✅ Zoom integration configured
- ✅ Mistral AI configured
- ✅ Sentry monitoring configured

---

## 🚀 Quick Start (Production Server)

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production

# Checkout the deployment branch
git checkout claude/database-investigation-01NkixUJAiejjHmfgGoy5bFH

# Install dependencies
npm install
```

### Step 2: Database Setup

```bash
# Ensure PostgreSQL is running
sudo systemctl start postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE pnptv_bot;"

# Run migrations
npm run db:migrate

# Load subscription plans
node scripts/update-plans.js
```

### Step 3: Start Services

```bash
# Start Redis
sudo systemctl start redis

# Verify services
pg_isready -h localhost -p 5432
redis-cli ping
```

### Step 4: Configure Environment

Ensure `.env` file has correct settings:
```bash
NODE_ENV=production
DB_HOST=localhost
REDIS_HOST=localhost
```

### Step 5: Run the Bot

**Option A: Direct Start (Development/Testing)**
```bash
npm start
```

**Option B: PM2 (Recommended for Production)**
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start src/bot/core/bot.js --name pnptv-bot

# Enable auto-start on reboot
pm2 startup
pm2 save

# Monitor the bot
pm2 logs pnptv-bot
pm2 status
```

**Option C: Systemd Service**
```bash
# Create service file
sudo cp deployment/pnptv-bot.service /etc/systemd/system/

# Enable and start
sudo systemctl enable pnptv-bot
sudo systemctl start pnptv-bot

# Check status
sudo systemctl status pnptv-bot
```

---

## 🗄️ Database Information

### Current Subscription Plans

| ID | Name | Price | Duration | Zoom Access |
|----|------|-------|----------|-------------|
| trial_week | Trial Week | $14.99 | 7 days | 1/week |
| pnp_member | PNP Member | $24.99 | 30 days | 3/month |
| crystal_member | Crystal Member | $49.99 | 120 days | 5/month |
| diamond_member | Diamond Member | $99.99 | 365 days | 5/month |
| lifetime_pass | Lifetime Pass | $249.99 | Lifetime | 5/month |

### Database Tables

```sql
-- View all plans
SELECT id, name, price, duration FROM plans ORDER BY price;

-- View users
SELECT id, username, subscription_status FROM users;

-- View payments
SELECT id, user_id, plan_id, amount, status FROM payments ORDER BY created_at DESC;

-- Check subscription stats
SELECT subscription_status, COUNT(*) FROM users GROUP BY subscription_status;
```

---

## 🔧 Configuration Details

### Telegram Bot
- **Token**: Configured ✅
- **Username**: @PNPtvBot
- **Webhook**: https://pnptv.app/webhook/telegram
- **Channels**: Premium, Free channel, Free group configured

### Payment Systems
- **Daimo Pay (USDC)**: Fully configured
  - App ID: pay-televisionlatina
  - Treasury Address: 0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613
  - Network: Base (Chain ID: 8453)
- **ePayco**: Configuration available (credentials needed)

### Video Conferencing
- **Zoom**: Credentials configured
  - Account ID, Client ID, Client Secret set
  - Meeting limits enforced per plan

### AI Support
- **Mistral AI**: API key configured
- **OpenAI**: Available (key needed)

### Monitoring
- **Sentry**: Error tracking configured
  - DSN: Configured
  - Environment tracking enabled

---

## 📊 Monitoring & Logs

### Check Bot Status

```bash
# PM2 status
pm2 status pnptv-bot
pm2 logs pnptv-bot --lines 100

# Systemd status
sudo systemctl status pnptv-bot
sudo journalctl -u pnptv-bot -f

# Application logs
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

### Health Check

```bash
# API health endpoint
curl http://localhost:3000/health

# Check bot connectivity
curl http://localhost:3000/api/stats
```

### Database Connection

```bash
# PostgreSQL
psql -U postgres -d pnptv_bot -c "SELECT COUNT(*) FROM users;"

# Redis
redis-cli INFO stats
redis-cli KEYS "user:*" | wc -l
```

---

## 🔐 Security Checklist

- ✅ Database password configured
- ✅ JWT secret generated
- ✅ Webhook signature verification enabled
- ✅ Rate limiting configured
- ✅ Admin user IDs set
- ✅ CORS configured
- ✅ Helmet security headers enabled

---

## 🐳 Docker Deployment (Alternative)

If you prefer Docker:

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose exec bot npm run db:migrate

# Load plans
docker-compose exec bot node scripts/update-plans.js

# Check logs
docker-compose logs -f bot

# Stop services
docker-compose down
```

---

## 🔄 Updates & Maintenance

### Update Subscription Plans

```bash
# Edit scripts/update-plans.js with new plan details
# Then run:
node scripts/update-plans.js
```

### Database Backup

```bash
# Backup PostgreSQL
pg_dump -U postgres pnptv_bot > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres pnptv_bot < backup_YYYYMMDD.sql
```

### Update Code

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Run new migrations
npm run db:migrate

# Restart bot
pm2 restart pnptv-bot
```

---

## 🐛 Troubleshooting

### Bot Won't Start

1. **Check PostgreSQL**:
   ```bash
   pg_isready -h localhost -p 5432
   sudo systemctl status postgresql
   ```

2. **Check Redis**:
   ```bash
   redis-cli ping
   sudo systemctl status redis
   ```

3. **Check Environment Variables**:
   ```bash
   grep BOT_TOKEN .env
   grep DB_HOST .env
   ```

4. **Check Logs**:
   ```bash
   pm2 logs pnptv-bot --err
   tail -f logs/error-*.log
   ```

### Database Connection Errors

```bash
# Test connection
psql -U postgres -h localhost -d pnptv_bot

# Check pg_hba.conf allows localhost
sudo vim /etc/postgresql/16/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Payment Issues

1. Check webhook URLs are publicly accessible
2. Verify payment provider credentials
3. Check webhook signature validation
4. Review payment logs in database

---

## 📞 Support

- **Repository**: https://github.com/carlossmartdevices-cyber/pnptvbot-production
- **Branch**: claude/database-investigation-01NkixUJAiejjHmfgGoy5bFH
- **Admin Telegram**: User ID 8365312597

---

## ✅ Deployment Verification

After deployment, verify everything works:

```bash
# 1. Check bot is running
pm2 status pnptv-bot

# 2. Check database
psql -U postgres -d pnptv_bot -c "SELECT COUNT(*) FROM plans;"

# 3. Check Redis
redis-cli ping

# 4. Check API
curl http://localhost:3000/health

# 5. Test Telegram bot
# Send /start to @PNPtvBot on Telegram

# 6. Check logs for errors
pm2 logs pnptv-bot --lines 50 | grep error
```

---

**🎉 Your PNPtv Bot is Ready for Deployment!**
