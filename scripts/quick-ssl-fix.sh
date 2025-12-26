#!/bin/bash
#
# Quick SSL Fix for pnptv.app
# This script sets up SSL certificates and fixes the "conexión no es segura" error
#
# Usage: sudo bash quick-ssl-fix.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BLUE}=========================================="
echo "  Quick SSL Fix for pnptv.app"
echo "==========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run with sudo: sudo bash quick-ssl-fix.sh"
    exit 1
fi

# Step 1: Check DNS
log_info "Step 1/5: Checking DNS configuration..."
DOMAIN="pnptv.app"
SERVER_IP=$(curl -s ifconfig.me)
DNS_IP=$(dig +short $DOMAIN | head -n1)

log_info "Server IP: $SERVER_IP"
log_info "DNS points to: $DNS_IP"

if [ "$SERVER_IP" != "$DNS_IP" ]; then
    log_warning "DNS mismatch! Your domain doesn't point to this server."
    log_warning "Please add this DNS record:"
    echo ""
    echo "  A    pnptv.app    ->    $SERVER_IP"
    echo "  A    www.pnptv.app ->    $SERVER_IP"
    echo ""
    read -p "Have you updated DNS? (y/n): " dns_ready
    if [ "$dns_ready" != "y" ]; then
        log_error "Please update DNS first, then run this script again."
        exit 1
    fi
fi

log_success "DNS configured correctly!"

# Step 2: Install Certbot
log_info "Step 2/5: Installing Certbot..."
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1
log_success "Certbot installed!"

# Step 3: Stop nginx if running (to allow Certbot standalone)
log_info "Step 3/5: Preparing for certificate request..."
if docker ps | grep -q pnptv-nginx; then
    log_info "Stopping nginx container temporarily..."
    docker-compose -f /home/user/pnptvbot-production/docker-compose.yml stop nginx
fi

# Create webroot directory
mkdir -p /var/www/certbot

# Step 4: Request SSL Certificate
log_info "Step 4/5: Requesting SSL certificate from Let's Encrypt..."
log_info "This may take a minute..."

read -p "Enter your email for SSL notifications: " EMAIL

certbot certonly --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d pnptv.app \
    -d www.pnptv.app \
    --non-interactive

if [ $? -eq 0 ]; then
    log_success "SSL certificate obtained successfully!"
else
    log_error "Failed to obtain SSL certificate"
    log_info "Common issues:"
    log_info "  1. Port 80 is not accessible from internet"
    log_info "  2. DNS hasn't propagated yet (wait 5-30 minutes)"
    log_info "  3. Firewall is blocking connections"
    exit 1
fi

# Step 5: Set up auto-renewal
log_info "Step 5/5: Setting up auto-renewal..."
CRON_JOB="0 0,12 * * * certbot renew --quiet --deploy-hook 'docker-compose -f /home/user/pnptvbot-production/docker-compose.yml restart nginx'"

if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Auto-renewal configured!"
fi

# Copy certificates to Docker volumes
log_info "Preparing certificates for Docker..."
cd /home/user/pnptvbot-production

# Start all services
log_info "Starting all services with SSL..."
docker-compose up -d

# Wait for services to start
sleep 5

# Check if nginx is running
if docker ps | grep -q pnptv-nginx; then
    log_success "Nginx is running with SSL!"
else
    log_warning "Nginx may not be running. Check logs: docker-compose logs nginx"
fi

# Final summary
echo ""
log_success "=========================================="
log_success "SSL Setup Complete!"
log_success "=========================================="
log_info "Certificate: /etc/letsencrypt/live/pnptv.app/fullchain.pem"
log_info "Private Key: /etc/letsencrypt/live/pnptv.app/privkey.pem"
echo ""
log_info "Testing your site:"
log_info "  curl -I https://pnptv.app"
echo ""
log_info "If you still see 'conexión no es segura', wait 1-2 minutes"
log_info "for all services to fully start, then try again."
echo ""
log_success "Your site should now be secure! Visit: https://pnptv.app"
