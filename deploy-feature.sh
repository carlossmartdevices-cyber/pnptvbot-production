#!/usr/bin/env bash
set -euo pipefail

# Deploy Community Premium Broadcast Feature
# Run this script to deploy to production server

SERVER="root@72.60.29.80"
BRANCH="claude/premium-access-broadcast-olnW8"
APP_DIR="/root/pnptvbot-production"

echo "🚀 Deploying Community Premium Broadcast Feature"
echo "================================================"
echo "Server: $SERVER"
echo "Branch: $BRANCH"
echo ""

# Deploy to server
ssh -o StrictHostKeyChecking=no $SERVER << EOF
set -e

echo "📁 Navigating to app directory..."
cd $APP_DIR

echo "📥 Fetching latest changes..."
git fetch --all --prune

echo "🔀 Checking out feature branch..."
git checkout $BRANCH
git pull origin $BRANCH

echo "📦 Installing dependencies..."
npm ci --production

echo "🔄 Restarting bot with PM2..."
if pm2 describe pnptv-bot >/dev/null 2>&1; then
  pm2 reload pnptv-bot
else
  pm2 start ecosystem.config.js --env production
fi

pm2 save

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Current status:"
pm2 list

echo ""
echo "📋 Latest commit:"
git log -1 --oneline

echo ""
echo "🔍 Checking logs (last 30 lines)..."
pm2 logs pnptv-bot --lines 30 --nostream

EOF

echo ""
echo "================================================"
echo "✅ Deployment finished successfully!"
echo ""
echo "📱 Test the feature:"
echo "  1. Open Telegram and send /admin"
echo "  2. Click '🎁 Premium Comunitario'"
echo "  3. Send a test broadcast"
echo ""
echo "📊 Monitor logs:"
echo "  ssh $SERVER 'pm2 logs pnptv-bot'"
echo ""
