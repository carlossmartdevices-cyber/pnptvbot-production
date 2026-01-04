#!/bin/bash

# Check PNPtv Bot Status

echo "🔍 Checking PNPtv Bot Status..."
echo ""

cd /home/user/pnptvbot-production

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status
echo ""

# Check if bot process is in PM2
if pm2 describe pnptv-bot > /dev/null 2>&1; then
    echo "✅ Bot found in PM2"
    echo ""

    # Show detailed info
    echo "📋 Bot Details:"
    pm2 describe pnptv-bot
    echo ""

    # Show recent logs
    echo "📜 Recent Logs (last 30 lines):"
    pm2 logs pnptv-bot --lines 30 --nostream
else
    echo "❌ Bot NOT found in PM2"
    echo ""
    echo "To start the bot, run:"
    echo "  cd /home/user/pnptvbot-production"
    echo "  pm2 start ecosystem.config.js"
    echo "  pm2 save"
fi

echo ""
echo "💡 Useful commands:"
echo "  pm2 restart pnptv-bot    # Restart the bot"
echo "  pm2 logs pnptv-bot       # View live logs"
echo "  pm2 stop pnptv-bot       # Stop the bot"
echo "  pm2 delete pnptv-bot     # Remove from PM2"
