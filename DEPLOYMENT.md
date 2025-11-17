# PNPtv Bot - Deployment Guide

## Quick Start (Fastest Way)

### 1. Prerequisites
- Node.js 18+
- PM2 installed globally: `npm install -g pm2`
- Redis server running: `redis-server --daemonize yes`

### 2. Deploy
```bash
cd /home/user/pnptvbot-production

# Install dependencies
npm install --production

# Start bot with PM2
pm2 start ecosystem.config.js

# Auto-start on server reboot
pm2 save
pm2 startup
```

### 3. Verify
```bash
# Check status
pm2 status

# View logs
pm2 logs pnptv-bot

# Test health endpoint
curl http://localhost:3000/health
```

## Configuration

Edit `.env` file with required variables:
- `BOT_TOKEN` - Telegram bot token from @BotFather
- `FIREBASE_*` - Firebase credentials
- `REDIS_HOST` - Redis server (default: localhost)
- `PORT` - Server port (default: 3000)

## Common Commands

```bash
# View live logs
pm2 logs pnptv-bot

# Restart bot
pm2 restart pnptv-bot

# Stop bot
pm2 stop pnptv-bot

# Full status info
pm2 show pnptv-bot

# Remove from PM2
pm2 delete pnptv-bot
```

## Monitoring

```bash
# Real-time monitoring dashboard
pm2 monit
```

## Logs

Logs are stored in:
- `logs/out.log` - Standard output
- `logs/error.log` - Error output

## Environment

The bot runs in production mode with:
- Auto-restart on crash
- Memory limit: 500MB
- Graceful shutdown on signals
- Automatic restart delay: 4 seconds

No Docker needed!
