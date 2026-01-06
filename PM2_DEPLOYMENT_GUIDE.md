# PNPtv PM2 Deployment Guide

Complete deployment guide using PM2 process manager for production deployment.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Step-by-Step PM2 Deployment](#step-by-step-pm2-deployment)
- [Service Management](#service-management)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)
- [Updates and Maintenance](#updates-and-maintenance)

## ✅ Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 2GB minimum (4GB recommended)
- **CPU**: 2 cores minimum
- **Storage**: 20GB minimum
- **Node.js**: v16+ (LTS recommended)
- **PM2**: v5+ (will be installed)

### Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NVM recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts

# Install PM2 globally
npm install -g pm2

# Install build tools
sudo apt install -y build-essential git

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Install Redis server (or connect to remote)
sudo apt install -y redis-server
```

### Install Dependencies

```bash
# Navigate to project directory
cd /path/to/pnptvbot-production

# Install npm dependencies
npm install --production

# If you need development dependencies
npm install
```

## 🚀 Step-by-Step PM2 Deployment

### Step 1: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables for PM2 Deployment:**

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=pnptvbot
POSTGRES_USER=pnptvbot
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token_here

# Payment Providers
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Agora (Video/Audio)
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_CERTIFICATE=your_agora_certificate

# Security
SESSION_SECRET=generate_random_string_here
JWT_SECRET=generate_random_string_here
```

**Generate random secrets:**
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### Step 2: Set Up Database Services

#### PostgreSQL Setup

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database user
sudo -u postgres psql -c "CREATE USER pnptvbot WITH PASSWORD 'your_secure_password';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE pnptvbot OWNER pnptvbot;"

# Apply database schema
psql -h localhost -U pnptvbot -d pnptvbot -f src/config/database-schema.sql
```

#### Redis Setup

```bash
# Install Redis
sudo apt install -y redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli ping
# Expected: PONG
```

### Step 3: Start Application with PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Save the process list
pm2 save

# Set PM2 to start on boot
pm2 startup
pm2 save
```

**Expected Output:**
```
[PM2] Spawning PM2 daemon with pm2_home=/home/user/.pm2
[PM2] PM2 Successfully daemonized
[PM2] Starting /root/pnptvbot-production/src/bot/core/bot.js in fork_mode (1 instance)
[PM2] Done.
┌────────────────────┬────┬─────────┬───────┬─────────┬────────┬────────┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┐
│ App name            │ id │ version │ mode  │ pid     │ status │ restart │ uptime   │ cpu    │ mem      │ user     │ watching │
├────────────────────┼────┼─────────┼───────┼─────────┼────────┼────────┼──────────┼────────┼──────────┼──────────┼──────────┼──────────┤
│ pnptv-bot           │ 0  │ 1.0.0   │ fork  │ 12345   │ online │ 0       │ 5s       │ 0%     │ 150.2 MB │ user     │ disabled │
└────────────────────┴────┴─────────┴───────┴─────────┴────────┴────────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┘
```

### Step 4: Verify Deployment

```bash
# Check application status
pm2 status

# Check logs
pm2 logs

# Check application health
curl -I http://localhost:3000/health

# Test Telegram bot connection
# Send a message to your bot and check response
```

## 🎛️ Service Management

### PM2 Commands

```bash
# List all running processes
pm2 list

# View detailed status
pm2 status

# View logs in real-time
pm2 logs

# View logs for specific app
pm2 logs pnptv-bot

# Restart application
pm2 restart pnptv-bot

# Reload application (zero-downtime)
pm2 reload pnptv-bot

# Stop application
pm2 stop pnptv-bot

# Delete application from PM2
pm2 delete pnptv-bot

# Show application metrics
pm2 monit

# Show dashboard
pm2 dashboard
```

### Database Management

```bash
# Connect to PostgreSQL
psql -h localhost -U pnptvbot -d pnptvbot

# Check Redis status
redis-cli info

# Monitor Redis in real-time
redis-cli monitor
```

## 📊 Monitoring and Logging

### PM2 Monitoring

```bash
# View real-time metrics
pm2 monit

# View dashboard (web interface)
pm2 dashboard

# View application metrics
pm2 show pnptv-bot
```

### Log Management

```bash
# View application logs
pm2 logs pnptv-bot

# View error logs only
pm2 logs pnptv-bot --err

# View output logs only
pm2 logs pnptv-bot --out

# Clear logs
pm2 flush

# View log files directly
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

### Custom Monitoring

```bash
# Check memory usage
pm2 show pnptv-bot | grep memory

# Check CPU usage
pm2 show pnptv-bot | grep cpu

# Check uptime
pm2 show pnptv-bot | grep uptime
```

## 🔧 Troubleshooting

### Issue: Application Fails to Start

**Symptom**: PM2 shows "errored" status

**Solution:**
```bash
# 1. Check logs
pm2 logs pnptv-bot

# 2. Check environment variables
pm2 env pnptv-bot

# 3. Test manual start
NODE_ENV=production node src/bot/core/bot.js

# 4. Check dependencies
npm list --depth=0
```

### Issue: Database Connection Failed

**Symptom**: "Cannot connect to database" in logs

**Solution:**
```bash
# 1. Check PostgreSQL status
sudo systemctl status postgresql

# 2. Test database connection
psql -h localhost -U pnptvbot -d pnptvbot

# 3. Check .env configuration
cat .env | grep POSTGRES

# 4. Restart application
pm2 restart pnptv-bot
```

### Issue: Redis Connection Failed

**Symptom**: "Redis connection timeout" in logs

**Solution:**
```bash
# 1. Check Redis status
sudo systemctl status redis-server

# 2. Test Redis connection
redis-cli ping

# 3. Check .env configuration
cat .env | grep REDIS

# 4. Restart Redis
sudo systemctl restart redis-server

# 5. Restart application
pm2 restart pnptv-bot
```

### Issue: Port Already in Use

**Symptom**: "Address already in use" error

**Solution:**
```bash
# 1. Check what's using the port
sudo lsof -i :3000

# 2. Kill the process
sudo kill -9 <PID>

# 3. Restart application
pm2 restart pnptv-bot
```

## 🔄 Updates and Maintenance

### Update Application

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install new dependencies
npm install --production

# 3. Restart application
pm2 restart pnptv-bot
```

### Update Dependencies

```bash
# Update npm packages
npm update --production

# Or for major updates
npm install --production

# Restart application
pm2 restart pnptv-bot
```

### Backup

```bash
# Backup database
pg_dump -h localhost -U pnptvbot -d pnptvbot > backup_$(date +%Y%m%d).sql

# Backup environment
cp .env .env.backup

# Backup logs
cp -r logs logs_backup_$(date +%Y%m%d)
```

## 🛡️ Security Best Practices

### Secure PM2

```bash
# Enable PM2 key metrics
pm2 install pm2-server-monit

# Set up PM2 access control
pm2 plus
pm2 plus set-access <username> <password>
```

### Secure Environment

```bash
# Set proper permissions
chmod 600 .env
chmod 700 logs/

# Use PM2 ecosystem file for sensitive data
# Instead of .env, use ecosystem.config.js env section
```

### Monitoring

```bash
# Set up PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 10

# Set up alerts
pm2 install pm2-sysmonit
pm2 set pm2-sysmonit:memory_limit 1G
pm2 set pm2-sysmonit:cpu_limit 80%
```

## 📞 Support

For issues or questions:

1. Check logs: `pm2 logs pnptv-bot`
2. Review this guide
3. Check PM2 documentation: `pm2 help`
4. Create an issue on GitHub

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Node.js Production Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

---