#!/bin/bash

# PNPtv Bot Deployment Script
# Deployment simple con PM2 (sin Docker)

set -e

ENVIRONMENT=${1:-production}

echo "🚀 Deploying PNPtv Bot to: $ENVIRONMENT"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check .env exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ .env file found${NC}"

# Install dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
npm install --production

# Ensure logs directory exists
mkdir -p logs
echo -e "${GREEN}✓ Logs directory ready${NC}"

# Start/restart bot with PM2
echo ""
echo "🤖 Starting bot with PM2..."
pm2 start ecosystem.config.js --force || pm2 restart pnptv-bot
pm2 save

# Wait for startup
sleep 3

# Check status
echo ""
echo "📊 Bot Status:"
pm2 status

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 logs pnptv-bot          - View live logs"
echo "  pm2 restart pnptv-bot       - Restart bot"
echo "  pm2 stop pnptv-bot          - Stop bot"
echo "  pm2 delete pnptv-bot        - Remove from PM2"
