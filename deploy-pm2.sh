#!/usr/bin/env bash
set -euo pipefail

# deploy-pm2.sh
# Idempotent deployment script for PM2 + Node.js apps using `ecosystem.config.js`.
# Usage:
#   On the server, cd to the app directory and run:
#     sudo ./deploy-pm2.sh
#   Or from your workstation:
#     ssh root@72.60.29.80 'bash -s' < ./deploy-pm2.sh

APP_DIR="${APP_DIR:-$(pwd)}"
BRANCH="${BRANCH:-main}"
ENV="${ENV:-production}"

echo "Deploying application in $APP_DIR (branch: $BRANCH, env: $ENV)"
cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "No git repository found in $APP_DIR"
  exit 1
fi

echo "Fetching latest from origin/$BRANCH"
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ -f package-lock.json ]; then
  echo "Installing npm dependencies (npm ci)"
  npm ci --production
else
  echo "Installing npm dependencies (npm install)"
  npm install --production
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found — installing pm2 globally"
  npm install -g pm2
fi

# Try graceful reload; if process not found, start it.
APP_NAME="pnptv-bot"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "Reloading $APP_NAME via pm2"
  pm2 reload ecosystem.config.js --env "$ENV" || pm2 restart "$APP_NAME"
else
  echo "Starting $APP_NAME via pm2"
  pm2 start ecosystem.config.js --env "$ENV"
fi

echo "Saving pm2 process list"
pm2 save

# Setup pm2 startup (only when running as root will the generated unit be installed correctly)
if [ "$(id -u)" -eq 0 ]; then
  echo "Installing pm2 startup (systemd) for root"
  pm2 startup systemd -u root --hp /root || true
fi

echo "Deployment finished. Check logs with: pm2 logs $APP_NAME"
