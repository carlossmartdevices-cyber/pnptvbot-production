# PNPtv Bot - Termux Deployment Guide

Complete step-by-step guide to deploy the PNPtv Telegram bot on Android using Termux.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Termux Setup](#initial-termux-setup)
3. [Install Required Software](#install-required-software)
4. [Database Setup](#database-setup)
5. [Clone and Configure Bot](#clone-and-configure-bot)
6. [Environment Configuration](#environment-configuration)
7. [Run the Bot](#run-the-bot)
8. [Keep Bot Running in Background](#keep-bot-running-in-background)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You'll Need

- Android device (Android 7.0 or higher recommended)
- Stable internet connection
- At least 2GB of free storage space
- Termux app installed from F-Droid (NOT Google Play Store)
- Basic understanding of Linux commands
- Your Telegram bot token from @BotFather

### Important Notes

- **Install Termux from F-Droid only**: The Google Play version is outdated and incompatible
- Download F-Droid: https://f-droid.org/
- Then install Termux from F-Droid

---

## Initial Termux Setup

### Step 1: Update Termux Packages

Open Termux and run:

```bash
# Update package lists
pkg update

# Upgrade all installed packages
pkg upgrade
```

When prompted, press `Y` and `Enter` to confirm.

### Step 2: Grant Storage Permission

Allow Termux to access your device storage:

```bash
termux-setup-storage
```

A permission dialog will appear - tap "Allow".

### Step 3: Install Essential Tools

```bash
# Install essential utilities
pkg install -y git curl wget nano openssh termux-services
```

---

## Install Required Software

### Step 4: Install Node.js

```bash
# Install Node.js (version 18 or higher)
pkg install -y nodejs

# Verify installation
node --version
npm --version
```

Expected output: Node.js v18.x.x or higher

### Step 5: Install PostgreSQL

```bash
# Install PostgreSQL
pkg install -y postgresql

# Initialize PostgreSQL database cluster
mkdir -p $PREFIX/var/lib/postgresql
initdb $PREFIX/var/lib/postgresql

# Start PostgreSQL service
pg_ctl -D $PREFIX/var/lib/postgresql start

# Create a database user
createuser -s pnptv_user

# Create the database
createdb pnptv_bot -O pnptv_user
```

**Alternative: Use Remote PostgreSQL Database**

If you prefer using a cloud database (recommended for better stability):

- ElephantSQL (free tier available): https://www.elephantsql.com/
- Supabase (free tier available): https://supabase.com/
- Neon (free tier available): https://neon.tech/

Skip PostgreSQL installation and use the remote database URL in your `.env` file.

### Step 6: Install Redis

```bash
# Install Redis
pkg install -y redis

# Start Redis server
redis-server --daemonize yes

# Verify Redis is running
redis-cli ping
```

Expected output: `PONG`

**Alternative: Use Remote Redis**

Remote Redis services (recommended for production):

- Redis Labs (free tier): https://redis.com/try-free/
- Upstash (free tier): https://upstash.com/

---

## Database Setup

### Step 7: Setup PostgreSQL Database

If using local PostgreSQL:

```bash
# Connect to PostgreSQL
psql -d pnptv_bot

# Set password for pnptv_user (run inside psql)
ALTER USER pnptv_user WITH PASSWORD 'your_secure_password_here';

# Exit psql
\q
```

### Step 8: Configure PostgreSQL to Start on Boot (Optional)

```bash
# Enable PostgreSQL service
sv-enable postgres
```

---

## Clone and Configure Bot

### Step 9: Clone the Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository
git clone https://github.com/yourusername/pnptvbot-production.git

# Navigate into project directory
cd pnptvbot-production
```

### Step 10: Install Project Dependencies

```bash
# Install all npm dependencies
npm install

# This may take 5-15 minutes depending on your internet speed
```

**If you encounter errors with native modules** (like `sharp`, `bcrypt`):

```bash
# Install build tools
pkg install -y python clang make

# Try installing again
npm install
```

---

## Environment Configuration

### Step 11: Create Environment File

```bash
# Copy example environment file
cp .env.example .env

# Edit the environment file
nano .env
```

### Step 12: Configure Essential Variables

Update the following in your `.env` file:

#### Required Configuration

```env
# Bot Configuration
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
BOT_USERNAME=YourBotUsername

# Environment
NODE_ENV=production
PORT=3000

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pnptv_bot
DB_USER=pnptv_user
DB_PASSWORD=your_secure_password_here
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300

# Admin Users (Your Telegram user ID)
ADMIN_USER_IDS=YOUR_TELEGRAM_USER_ID

# Security - Generate unique secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

#### Optional Configuration (Configure as needed)

```env
# Firebase (if using Firebase/Firestore)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_DATABASE_URL=your_database_url

# Payment Providers
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key
DAIMO_API_KEY=your_daimo_api_key

# AI Configuration (for customer support)
MISTRAL_API_KEY=your_mistral_api_key

# Age Verification
AGE_VERIFICATION_PROVIDER=azure
AZURE_FACE_ENDPOINT=your_azure_endpoint
AZURE_FACE_API_KEY=your_azure_key
```

**To save in nano**: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 13: Generate Security Keys

```bash
# Install openssl if not available
pkg install -y openssl

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Generate encryption key
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"

# Copy these values to your .env file
```

### Step 14: Get Your Telegram User ID

To find your Telegram user ID:

1. Message @userinfobot on Telegram
2. It will reply with your user ID
3. Add this ID to `ADMIN_USER_IDS` in `.env`

---

## Run the Bot

### Step 15: Validate Environment Configuration

```bash
# Validate all required environment variables
npm run validate:env
```

Fix any errors before proceeding.

### Step 16: Database Migration (if applicable)

```bash
# Run database migrations
npm run migrate

# Seed initial data (subscription plans, etc.)
npm run seed
```

### Step 17: Start the Bot

```bash
# Start the bot
npm start
```

If successful, you should see:
```
Bot started successfully in polling mode
Connected to PostgreSQL database
Connected to Redis
```

**Test your bot**: Send `/start` to your bot on Telegram

---

## Keep Bot Running in Background

The bot needs to keep running even when you close Termux. Here are three methods:

### Method 1: Using PM2 (Recommended)

PM2 is a process manager that keeps your bot running and auto-restarts on crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
pm2 start src/bot/core/bot.js --name pnptvbot

# Save PM2 process list
pm2 save

# Setup PM2 to start on Termux startup
pm2 startup
```

**PM2 Commands**:

```bash
# View bot status
pm2 status

# View bot logs
pm2 logs pnptvbot

# Restart bot
pm2 restart pnptvbot

# Stop bot
pm2 stop pnptvbot

# Remove from PM2
pm2 delete pnptvbot
```

### Method 2: Using Termux:Boot (Auto-start on Device Boot)

1. Install Termux:Boot app from F-Droid

2. Create boot script:

```bash
# Create boot directory
mkdir -p ~/.termux/boot

# Create startup script
nano ~/.termux/boot/start-pnptvbot.sh
```

Add this content:

```bash
#!/data/data/com.termux/files/usr/bin/bash

# Start PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql start

# Start Redis
redis-server --daemonize yes

# Wait for services to start
sleep 5

# Navigate to bot directory and start with PM2
cd ~/pnptvbot-production
pm2 start src/bot/core/bot.js --name pnptvbot
```

Make it executable:

```bash
chmod +x ~/.termux/boot/start-pnptvbot.sh
```

Reboot your device to test.

### Method 3: Using nohup (Simple Background Process)

```bash
# Start bot in background
nohup npm start > bot.log 2>&1 &

# View logs
tail -f bot.log

# Stop bot (find process ID first)
ps aux | grep node
kill <process_id>
```

---

## Monitoring and Maintenance

### View Logs

```bash
# Application logs (if using PM2)
pm2 logs pnptvbot

# Application logs (file-based)
tail -f logs/combined-$(date +%Y-%m-%d).log

# Error logs only
tail -f logs/error-$(date +%Y-%m-%d).log
```

### Check Bot Status

```bash
# PM2 status
pm2 status

# Check if bot is responding
curl http://localhost:3000/health
```

### Database Maintenance

```bash
# Connect to database
psql -d pnptv_bot

# View tables
\dt

# Check user count
SELECT COUNT(*) FROM users;

# Exit
\q
```

### Update Bot Code

```bash
# Navigate to bot directory
cd ~/pnptvbot-production

# Stop bot
pm2 stop pnptvbot

# Pull latest changes
git pull

# Install new dependencies
npm install

# Run migrations if needed
npm run migrate

# Restart bot
pm2 restart pnptvbot
```

---

## Troubleshooting

### Problem: Bot Not Starting

**Check logs**:
```bash
pm2 logs pnptvbot --lines 50
```

**Common fixes**:
1. Verify `.env` file is configured correctly
2. Check if PostgreSQL is running: `pg_ctl -D $PREFIX/var/lib/postgresql status`
3. Check if Redis is running: `redis-cli ping`
4. Validate environment: `npm run validate:env`

### Problem: Database Connection Failed

```bash
# Restart PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql restart

# Check if PostgreSQL is listening
netstat -tuln | grep 5432

# Test connection
psql -h localhost -U pnptv_user -d pnptv_bot
```

### Problem: Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Restart Redis
pkill redis-server
redis-server --daemonize yes
```

### Problem: Out of Memory Errors

```bash
# Check memory usage
free -h

# Restart bot with memory limit (PM2)
pm2 delete pnptvbot
pm2 start src/bot/core/bot.js --name pnptvbot --max-memory-restart 300M
```

### Problem: Native Module Build Failures

```bash
# Install build tools
pkg install -y python clang make libjpeg-turbo libpng

# Rebuild native modules
npm rebuild
```

### Problem: Permission Denied Errors

```bash
# Fix directory permissions
chmod -R 755 ~/pnptvbot-production
chmod 755 ~/.termux/boot/*.sh
```

### Problem: Termux Keeps Getting Killed (Android Battery Optimization)

1. Go to Android Settings → Apps → Termux
2. Disable "Battery Optimization" for Termux
3. Enable "Allow Background Activity"
4. Lock Termux in Recent Apps (prevents Android from killing it)

### Problem: Bot Stops When Screen Locks

**Acquire wakelock**:

```bash
# Install Termux:API from F-Droid
pkg install termux-api

# Acquire wakelock
termux-wake-lock
```

Add to your boot script:

```bash
termux-wake-lock
```

### Problem: Can't Find Telegram User ID

Send `/start` to @userinfobot on Telegram to get your user ID.

---

## Performance Optimization

### Reduce Memory Usage

```bash
# Limit Node.js memory
export NODE_OPTIONS="--max-old-space-size=512"

# Start bot with memory limit
pm2 start src/bot/core/bot.js --name pnptvbot --max-memory-restart 300M --node-args="--max-old-space-size=512"
```

### Enable PostgreSQL Query Optimization

```bash
psql -d pnptv_bot

# Create indexes (run once)
npm run validate:indexes
```

### Use Remote Services (Recommended)

For better stability and performance on mobile:

- **Database**: Use ElephantSQL, Supabase, or Neon
- **Redis**: Use Upstash or Redis Labs
- **File Storage**: Use AWS S3 or Cloudinary for uploads

This offloads resource-intensive services from your Android device.

---

## Security Best Practices

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Use strong passwords** - For database and API keys
3. **Regularly update packages**: `npm update`
4. **Monitor logs** - Check for suspicious activity
5. **Backup database regularly**:

```bash
# Backup database
pg_dump pnptv_bot > backup_$(date +%Y%m%d).sql

# Restore database
psql pnptv_bot < backup_20250101.sql
```

---

## Useful Commands Reference

### Termux Management
```bash
pkg update && pkg upgrade        # Update packages
termux-wake-lock                 # Prevent device sleep
termux-wake-unlock               # Release wakelock
```

### PostgreSQL
```bash
pg_ctl -D $PREFIX/var/lib/postgresql start    # Start
pg_ctl -D $PREFIX/var/lib/postgresql stop     # Stop
pg_ctl -D $PREFIX/var/lib/postgresql status   # Status
psql -d pnptv_bot                              # Connect
```

### Redis
```bash
redis-server --daemonize yes     # Start in background
redis-cli ping                   # Check if running
redis-cli shutdown               # Stop
```

### PM2
```bash
pm2 start <script>               # Start process
pm2 stop <name>                  # Stop process
pm2 restart <name>               # Restart process
pm2 logs <name>                  # View logs
pm2 status                       # List all processes
pm2 save                         # Save process list
pm2 resurrect                    # Restore saved processes
```

---

## FAQ

### Q: How much battery does this use?
**A**: With proper configuration, minimal impact. Use wakelock and disable battery optimization.

### Q: Can I run this 24/7?
**A**: Yes, but recommended to use cloud database/Redis for better stability.

### Q: What if my phone restarts?
**A**: Use Termux:Boot to auto-start services on device boot.

### Q: How do I stop the bot?
**A**: `pm2 stop pnptvbot` or `pm2 delete pnptvbot`

### Q: Can I deploy multiple bots?
**A**: Yes, clone to different directories and use different ports.

---

## Additional Resources

- **Termux Wiki**: https://wiki.termux.com/
- **Node.js Docs**: https://nodejs.org/docs/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **PM2 Docs**: https://pm2.keymetrics.io/
- **Telegraf.js Docs**: https://telegraf.js.org/

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs: `pm2 logs pnptvbot`
3. Verify environment configuration
4. Check GitHub Issues for similar problems

---

**Built with ❤️ for PNPtv**

Last Updated: 2025-01-08
