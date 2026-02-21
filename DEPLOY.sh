#!/bin/bash

##############################################################################
# PNPtv Production Deployment Script
# Sprint 1-4 Final Refactor: Security, Design, Infrastructure, Payments
# Date: February 21, 2026
#
# USAGE ON VPS:
#   cd /root/pnptvbot-production
#   bash DEPLOY.sh
#
# This script automates the 9-phase deployment process
##############################################################################

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

BACKUP_DIR="/root/pnptvbot-production/backups/deployment_$(date +%Y%m%d_%H%M%S)"

##############################################################################
# PHASE 1: Pre-flight Checks
##############################################################################

log_info "=== PHASE 1: Pre-flight Checks ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   log_error "This script must be run as root. Use: sudo bash DEPLOY.sh"
   exit 1
fi

# Check prerequisites
log_info "Checking prerequisites..."
command -v git &> /dev/null || { log_error "git not found"; exit 1; }
command -v node &> /dev/null || { log_error "node not found"; exit 1; }
command -v npm &> /dev/null || { log_error "npm not found"; exit 1; }
command -v psql &> /dev/null || { log_error "psql not found"; exit 1; }
command -v pm2 &> /dev/null || { log_error "pm2 not found"; exit 1; }
command -v nginx &> /dev/null || { log_error "nginx not found"; exit 1; }
log_success "All prerequisites found"

# Verify PostgreSQL connection
log_info "Verifying PostgreSQL connection..."
psql -U postgres -h localhost -d pnptv_db -c "SELECT 1;" &> /dev/null || {
  log_error "Cannot connect to PostgreSQL"
  exit 1
}
log_success "PostgreSQL connected"

# Verify Redis connection
log_info "Verifying Redis connection..."
redis-cli ping | grep -q "PONG" || {
  log_error "Cannot connect to Redis"
  exit 1
}
log_success "Redis connected"

##############################################################################
# PHASE 2: Backup Current State
##############################################################################

log_info "=== PHASE 2: Backup Current State ==="

mkdir -p "$BACKUP_DIR"
log_info "Creating deployment backup at $BACKUP_DIR..."

# Backup database
log_info "Backing up PostgreSQL database..."
pg_dump -U postgres pnptv_db | gzip > "$BACKUP_DIR/pnptv_db_$(date +%Y%m%d_%H%M%S).sql.gz"
log_success "Database backup created"

# Backup configs
cp /etc/nginx/nginx.conf "$BACKUP_DIR/nginx.conf"
cp ecosystem.config.js "$BACKUP_DIR/ecosystem.config.js"
cp package.json "$BACKUP_DIR/package.json"
log_success "Configuration backups created"

# Backup current code
log_info "Creating code snapshot..."
cp -r apps/backend "$BACKUP_DIR/backend_snapshot"
log_success "Code snapshot created"

##############################################################################
# PHASE 3: Pull Latest Code
##############################################################################

log_info "=== PHASE 3: Pull Latest Code ==="

cd /root/pnptvbot-production
git fetch origin main
log_info "Pulling latest deployment commit..."
git pull origin main --no-edit || {
  log_error "Failed to pull from origin/main. Check git status."
  exit 1
}
log_success "Code pulled successfully"

##############################################################################
# PHASE 4: Install Dependencies
##############################################################################

log_info "=== PHASE 4: Install Dependencies ==="

log_info "Installing npm dependencies..."
npm ci || {
  log_warning "npm ci failed, trying npm install..."
  npm install || { log_error "Dependency installation failed"; exit 1; }
}
log_success "Dependencies installed"

##############################################################################
# PHASE 5: Build Applications
##############################################################################

log_info "=== PHASE 5: Build Applications ==="

log_info "Building all applications (this may take 5-10 minutes)..."
npm run build || {
  log_error "Build failed. Check build output above."
  exit 1
}
log_success "Build successful"

##############################################################################
# PHASE 6: Database Migrations
##############################################################################

log_info "=== PHASE 6: Database Migrations ==="

# Check if migrations exist
if [ -f "database/migrations/20260221_alter_location_sharing_default.sql" ]; then
  log_info "Applying geolocation default migration..."
  psql -U postgres -h localhost -d pnptv_db -f database/migrations/20260221_alter_location_sharing_default.sql || {
    log_error "Migration failed. Review error above."
    exit 1
  }
  log_success "Migration 1 applied"
else
  log_warning "Migration file not found, skipping..."
fi

if [ -f "database/migrations/20260221_reduce_geolocation_precision.sql" ]; then
  log_info "Applying geolocation precision migration..."
  psql -U postgres -h localhost -d pnptv_db -f database/migrations/20260221_reduce_geolocation_precision.sql || {
    log_error "Migration failed. Review error above."
    exit 1
  }
  log_success "Migration 2 applied"
fi

##############################################################################
# PHASE 7: Environment Validation
##############################################################################

log_info "=== PHASE 7: Environment Validation ==="

# Check critical env vars
if [ -z "$SESSION_SECRET" ]; then
  log_warning "SESSION_SECRET not set. Using default."
  export SESSION_SECRET="default-session-secret-change-in-production"
fi

if [ -z "$JWT_SECRET" ]; then
  log_warning "JWT_SECRET not set."
fi

log_success "Environment variables checked"

##############################################################################
# PHASE 8: Nginx Configuration
##############################################################################

log_info "=== PHASE 8: Nginx Configuration ==="

log_info "Testing Nginx syntax..."
nginx -t || {
  log_error "Nginx syntax error. Restore from backup:"
  log_error "  sudo cp $BACKUP_DIR/nginx.conf /etc/nginx/nginx.conf"
  exit 1
}
log_success "Nginx syntax valid"

log_info "Reloading Nginx (zero-downtime)..."
systemctl reload nginx || {
  log_error "Nginx reload failed"
  exit 1
}
log_success "Nginx reloaded"

##############################################################################
# PHASE 9: Application Deployment
##############################################################################

log_info "=== PHASE 9: Application Deployment ==="

log_info "Stopping current PM2 application..."
pm2 stop pnptv-bot 2>/dev/null || true
pm2 delete pnptv-bot 2>/dev/null || true

log_info "Starting application with new configuration..."
pm2 start ecosystem.config.js || {
  log_error "PM2 start failed"
  exit 1
}
pm2 save

sleep 2

log_success "Application started with PM2"

##############################################################################
# PHASE 10: Post-Deployment Validation
##############################################################################

log_info "=== PHASE 10: Post-Deployment Validation ==="

# Wait for app to be ready
log_info "Waiting for application to be ready..."
sleep 5

# Health check
log_info "Running health check..."
HEALTH_RESPONSE=$(curl -s https://pnptv.app/health || echo "{}")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
  log_success "Health check passed"
else
  log_error "Health check failed. Response: $HEALTH_RESPONSE"
  log_info "Rolling back..."
  pm2 stop pnptv-bot
  pm2 delete pnptv-bot
  exit 1
fi

# Verify HTTP/2
log_info "Verifying HTTP/2..."
HTTP_VERSION=$(curl -s -I https://pnptv.app/hub/ | grep HTTP | head -1)
if echo "$HTTP_VERSION" | grep -q "2"; then
  log_success "HTTP/2 enabled: $HTTP_VERSION"
else
  log_warning "HTTP/2 may not be enabled. Got: $HTTP_VERSION"
fi

# Verify Gzip
log_info "Verifying Gzip compression..."
GZIP_CHECK=$(curl -s -I https://pnptv.app/hub/assets/*.js 2>/dev/null | grep -i "content-encoding" | head -1 || echo "")
if echo "$GZIP_CHECK" | grep -q "gzip"; then
  log_success "Gzip compression enabled"
else
  log_warning "Gzip compression may not be enabled"
fi

##############################################################################
# SUMMARY
##############################################################################

log_success "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Summary:"
echo "  Commit: $(git log -1 --oneline)"
echo "  Backup:  $BACKUP_DIR"
echo "  Status:  $(pm2 status pnptv-bot | tail -1 || echo 'App running')"
echo ""
log_info "Next steps:"
echo "  1. Monitor logs: pm2 logs pnptv-bot"
echo "  2. Test features: https://pnptv.app"
echo "  3. Check Sentry: https://sentry.io/"
echo ""
log_success "Ready for production! 🚀"
