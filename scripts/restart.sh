#!/bin/bash

# Quick restart script for PNPtv Bot

echo "🔄 Restarting PNPtv Bot..."

cd /home/user/pnptvbot-production

# Check if PM2 is managing the bot
if pm2 describe pnptv-bot > /dev/null 2>&1; then
    echo "Restarting with PM2..."
    pm2 restart pnptv-bot --update-env
    echo ""
    pm2 status
    echo ""
    echo "✅ Bot restarted!"
    echo "📊 View logs: pm2 logs pnptv-bot"
else
    echo "❌ Bot not found in PM2. Starting fresh..."
    pm2 start ecosystem.config.js
    pm2 save
    echo ""
    pm2 status
    echo ""
    echo "✅ Bot started!"
fi

# Show recent logs
echo ""
echo "📋 Recent logs:"
pm2 logs pnptv-bot --lines 20 --nostream
