# 🚀 Production Server Deployment

## Server Information
**IP Address**: `72.60.29.80`
**Access**: SSH as root

---

## Quick Deployment (5 Minutes)

### Step 1: SSH into Production Server

```bash
ssh root@72.60.29.80
```

### Step 2: Install Prerequisites (if needed)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PostgreSQL 16 (if not installed)
apt install -y postgresql postgresql-contrib

# Install Redis (if not installed)
apt install -y redis-server

# Install Git (if not installed)
apt install -y git

# Verify installations
node --version  # Should be v18+
npm --version
psql --version  # Should be 16+
redis-cli --version
```

### Step 3: Clone and Setup Repository

```bash
# Clone the repository
cd /opt
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production

# Checkout deployment branch
git checkout claude/database-investigation-01NkixUJAiejjHmfgGoy5bFH

# Copy environment file (it's already configured!)
# The .env file should already be present with all settings

# Make scripts executable
chmod +x deployment/*.sh
```

### Step 4: Run Automated Deployment

```bash
# Run the deployment script
./deployment/deploy.sh
```

The script will:
- ✅ Check all prerequisites
- ✅ Install npm dependencies
- ✅ Verify PostgreSQL and Redis are running
- ✅ Create database `pnptv_bot`
- ✅ Run migrations (create tables)
- ✅ Load 5 subscription plans
- ✅ Let you choose deployment method (PM2 recommended)

### Step 5: Verify Deployment

```bash
# Check status
./deployment/status.sh

# Or manually check:
pm2 status              # If using PM2
pm2 logs pnptv-bot      # View logs

# Test bot
curl http://localhost:3000/health

# Check database
psql -U postgres -d pnptv_bot -c "SELECT * FROM plans;"
```

---

## Manual Deployment (Alternative)

If you prefer manual steps:

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup PostgreSQL

```bash
# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE pnptv_bot;"

# Configure authentication
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

### 3. Setup Redis

```bash
# Start Redis
systemctl start redis
systemctl enable redis

# Test
redis-cli ping  # Should return PONG
```

### 4. Run Database Setup

```bash
# Run migrations
npm run db:migrate

# Load subscription plans
node scripts/update-plans.js
```

### 5. Start Bot with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start bot
pm2 start ecosystem.config.js

# Enable PM2 on system startup
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs pnptv-bot
```

---

## Environment Configuration

Your `.env` file is already configured with:

✅ **Telegram Bot**
- Token: Configured
- Webhook: https://pnptv.app/webhook/telegram
- Channels: All configured

✅ **Database**
- PostgreSQL on localhost:5432
- Database: pnptv_bot
- User: postgres

✅ **Payment Systems**
- Daimo (USDC): Fully configured
- Treasury: 0xcaf17dbbccc0e9ac87dad1af1f2fe3ba3a4d0613

✅ **Services**
- Zoom: Configured
- Mistral AI: Configured
- Sentry Monitoring: Configured

---

## Firewall Configuration

Make sure these ports are open:

```bash
# Allow SSH (if not already open)
ufw allow 22/tcp

# Allow HTTP/HTTPS for webhooks
ufw allow 80/tcp
ufw allow 443/tcp

# Allow bot API (internal)
ufw allow 3000/tcp

# Enable firewall
ufw enable
```

---

## SSL Certificate (for webhook)

If you need HTTPS for webhooks:

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate for pnptv.app
certbot certonly --standalone -d pnptv.app

# Setup nginx reverse proxy (optional)
apt install -y nginx

# Configure nginx to proxy to port 3000
# Certificate will be at: /etc/letsencrypt/live/pnptv.app/
```

---

## Monitoring & Maintenance

### Check Bot Status

```bash
# Quick status check
./deployment/status.sh

# PM2 commands
pm2 status
pm2 logs pnptv-bot
pm2 monit
```

### Database Queries

```bash
# View all plans
psql -U postgres -d pnptv_bot -c "SELECT id, name, price, duration FROM plans;"

# View users
psql -U postgres -d pnptv_bot -c "SELECT COUNT(*) as total_users FROM users;"

# View subscription stats
psql -U postgres -d pnptv_bot -c "
SELECT subscription_status, COUNT(*)
FROM users
GROUP BY subscription_status;
"

# Recent payments
psql -U postgres -d pnptv_bot -c "
SELECT user_id, plan_id, amount, status, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;
"
```

### View Logs

```bash
# PM2 logs
pm2 logs pnptv-bot --lines 100

# Application logs
tail -f /opt/pnptvbot-production/logs/combined-*.log
tail -f /opt/pnptvbot-production/logs/error-*.log

# Sentry dashboard
# Visit: https://sentry.io (configured in .env)
```

### Restart Bot

```bash
# PM2
pm2 restart pnptv-bot

# Or reload (zero downtime)
pm2 reload pnptv-bot
```

### Update Code

```bash
cd /opt/pnptvbot-production
git pull
npm install
npm run db:migrate
node scripts/update-plans.js
pm2 restart pnptv-bot
```

---

## Backup Strategy

### Daily Database Backup

```bash
# Create backup script
cat > /usr/local/bin/backup-pnptv.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/var/backups/pnptv
mkdir -p $BACKUP_DIR
pg_dump -U postgres pnptv_bot | gzip > $BACKUP_DIR/pnptv_bot_$(date +%Y%m%d_%H%M%S).sql.gz
# Keep last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-pnptv.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-pnptv.sh" | crontab -
```

---

## Troubleshooting

### Bot Won't Start

```bash
# Check logs
pm2 logs pnptv-bot --err

# Check PostgreSQL
systemctl status postgresql
pg_isready

# Check Redis
systemctl status redis
redis-cli ping

# Check environment
cd /opt/pnptvbot-production
cat .env | grep BOT_TOKEN
```

### Webhook Issues

```bash
# Test webhook URL
curl https://pnptv.app/webhook/telegram

# Check Telegram webhook status
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# Delete webhook (if needed)
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

### Database Connection Issues

```bash
# Check PostgreSQL is listening
ss -tlnp | grep 5432

# Test connection
psql -U postgres -h localhost -d pnptv_bot

# Check pg_hba.conf
sudo cat /etc/postgresql/16/main/pg_hba.conf
```

---

## Performance Optimization

### PM2 Cluster Mode (for high traffic)

```bash
# Edit ecosystem.config.js, change instances to CPU count
# Then restart:
pm2 restart pnptv-bot
```

### Redis Memory Limit

```bash
# Edit redis.conf
sudo vi /etc/redis/redis.conf

# Add:
maxmemory 256mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis
```

### PostgreSQL Tuning

```bash
# Edit postgresql.conf
sudo vi /etc/postgresql/16/main/postgresql.conf

# Recommended settings:
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
max_connections = 100

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 🎉 You're All Set!

Once deployed, your bot will:

✅ Accept Telegram commands at @PNPtvBot
✅ Process USDC payments via Daimo
✅ Manage 5 subscription tiers
✅ Provide Zoom meeting access
✅ Track all transactions in PostgreSQL
✅ Monitor errors with Sentry

**Next Steps:**
1. Test the bot: Send `/start` to @PNPtvBot
2. Monitor logs: `pm2 logs pnptv-bot`
3. Check metrics: `./deployment/status.sh`

**Support:**
- Repository: https://github.com/carlossmartdevices-cyber/pnptvbot-production
- Branch: claude/database-investigation-01NkixUJAiejjHmfgGoy5bFH
