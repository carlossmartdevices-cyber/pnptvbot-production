# Quick Server Deployment Guide

Since direct SSH connection from this environment is not possible, follow these steps to deploy on your server at `72.60.29.80`.

## Method 1: Automated Deployment Script (Recommended)

### Step 1: Connect to Your Server

```bash
ssh root@72.60.29.80
# Use password: Apelo801050#
```

### Step 2: Download and Run the Deployment Script

```bash
# Download the deployment script
curl -o deploy.sh https://raw.githubusercontent.com/carlossmartdevices-cyber/pnptvbot-production/claude/termux-deployment-guide-01C6w5sQE7SAwoQkPZLy7g11/deploy-server.sh

# Make it executable
chmod +x deploy.sh

# Run the deployment script
bash deploy.sh
```

The script will automatically:
- ✓ Update system packages
- ✓ Install Node.js 18.x
- ✓ Install and configure PostgreSQL
- ✓ Install and configure Redis
- ✓ Clone the repository to `/opt/pnptvbot-production`
- ✓ Install all dependencies
- ✓ Create and configure `.env` file
- ✓ Install PM2 process manager
- ✓ Start the bot

### Step 3: Configure Your Bot Token

After the script completes, you must add your Telegram bot token:

```bash
# Edit the environment file
nano /opt/pnptvbot-production/.env
```

Find and update these required variables:
```env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_USER_IDS=your_telegram_user_id
```

Optional services (add if needed):
```env
# Payment Providers
EPAYCO_PUBLIC_KEY=your_key
DAIMO_API_KEY=your_key

# AI Support
MISTRAL_API_KEY=your_key
```

Save: `Ctrl+X`, then `Y`, then `Enter`

### Step 4: Restart the Bot

```bash
pm2 restart pnptvbot
```

### Step 5: Verify It's Running

```bash
# Check bot status
pm2 status

# View logs
pm2 logs pnptvbot

# Test the bot on Telegram
# Send /start to your bot
```

---

## Method 2: Manual Step-by-Step Deployment

If you prefer to run commands manually:

### 1. Update System

```bash
apt-get update && apt-get upgrade -y
```

### 2. Install Node.js 18.x

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v  # Should show v18.x.x or higher
```

### 3. Install PostgreSQL

```bash
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### 4. Install Redis

```bash
apt-get install -y redis-server
systemctl start redis-server
systemctl enable redis-server
```

### 5. Setup Database

```bash
# Generate a secure password
DB_PASSWORD="PnpTv_$(openssl rand -base64 12)"
echo "Your DB Password: $DB_PASSWORD"  # Save this!

# Create database and user
sudo -u postgres psql << EOF
CREATE USER pnptv_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE pnptv_bot OWNER pnptv_user;
GRANT ALL PRIVILEGES ON DATABASE pnptv_bot TO pnptv_user;
\q
EOF
```

### 6. Clone Repository

```bash
apt-get install -y git
cd /opt
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production
```

### 7. Install Dependencies

```bash
npm install --production
```

### 8. Configure Environment

```bash
cp .env.example .env

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Edit .env file
nano .env
```

Update these in `.env`:
```env
BOT_TOKEN=your_bot_token_here
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=pnptv_bot
DB_USER=pnptv_user
DB_PASSWORD=<the password from step 5>

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=<generated above>
ENCRYPTION_KEY=<generated above>

ADMIN_USER_IDS=your_telegram_user_id
```

### 9. Install PM2

```bash
npm install -g pm2
```

### 10. Start Bot

```bash
cd /opt/pnptvbot-production
pm2 start src/bot/core/bot.js --name pnptvbot --time
pm2 save
pm2 startup systemd -u root --hp /root
```

---

## Post-Deployment

### Check Status

```bash
# Bot status
pm2 status

# View logs
pm2 logs pnptvbot

# Real-time monitoring
pm2 monit
```

### Useful Commands

```bash
# Restart bot
pm2 restart pnptvbot

# Stop bot
pm2 stop pnptvbot

# View errors only
pm2 logs pnptvbot --err

# Clear logs
pm2 flush pnptvbot
```

### Update Bot Code

```bash
cd /opt/pnptvbot-production
git pull
npm install
pm2 restart pnptvbot
```

### Database Backup

```bash
# Create backup
pg_dump -U pnptv_user pnptv_bot > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U pnptv_user pnptv_bot < backup_20250101.sql
```

---

## Troubleshooting

### Bot Not Starting

```bash
# Check logs for errors
pm2 logs pnptvbot --lines 50

# Validate environment
cd /opt/pnptvbot-production
npm run validate:env

# Check if PostgreSQL is running
systemctl status postgresql

# Check if Redis is running
systemctl status redis-server
```

### Database Connection Issues

```bash
# Test database connection
psql -h localhost -U pnptv_user -d pnptv_bot

# Restart PostgreSQL
systemctl restart postgresql
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Or use netstat
netstat -tuln | grep 3000

# Kill the process
kill -9 <PID>
```

### Memory Issues

```bash
# Check memory usage
free -h

# Start with memory limit
pm2 delete pnptvbot
pm2 start src/bot/core/bot.js --name pnptvbot --max-memory-restart 1G
```

---

## Security Recommendations

1. **Change Default SSH Port**
```bash
nano /etc/ssh/sshd_config
# Change Port 22 to something else
systemctl restart sshd
```

2. **Setup Firewall**
```bash
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable
```

3. **Disable Root Login** (after creating a sudo user)
```bash
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

4. **Regular Updates**
```bash
# Add to crontab
crontab -e
# Add: 0 2 * * * apt-get update && apt-get upgrade -y
```

---

## Getting Your Telegram Bot Token

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the bot token provided
5. Add it to your `.env` file

## Getting Your Telegram User ID

1. Search for @userinfobot on Telegram
2. Send `/start`
3. Copy your user ID
4. Add it to `ADMIN_USER_IDS` in `.env`

---

## Need Help?

- Check logs: `pm2 logs pnptvbot`
- Review environment: `cat /opt/pnptvbot-production/.env`
- Test database: `psql -U pnptv_user -d pnptv_bot`
- Test Redis: `redis-cli ping`

---

**Deployment Location**: `/opt/pnptvbot-production`
**PM2 Process Name**: `pnptvbot`
**Log Location**: `~/.pm2/logs/`
