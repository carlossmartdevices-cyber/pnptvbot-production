#!/bin/bash
#
# SSL/TLS Certificate Setup Script for pnptv.app
# This script sets up Let's Encrypt SSL certificates using Certbot
#
# Usage: sudo ./scripts/setup-ssl.sh [domain] [email]
# Example: sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DOMAIN="${1:-pnptv.app}"
EMAIL="${2:-}"
STAGING="${3:-0}"  # Use staging server for testing (0=production, 1=staging)

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

# Prompt for email if not provided
if [ -z "$EMAIL" ]; then
    read -p "Enter email address for Let's Encrypt notifications: " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "Email address is required"
        exit 1
    fi
fi

log_info "Starting SSL certificate setup for $DOMAIN"
log_info "Email: $EMAIL"

# Create required directories
log_info "Creating required directories..."
mkdir -p /var/www/certbot
mkdir -p /etc/letsencrypt/live
mkdir -p /etc/letsencrypt/archive

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    log_info "Installing Certbot..."

    # Detect OS
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS
        yum install -y certbot python3-certbot-nginx
    else
        log_error "Unsupported operating system. Please install certbot manually."
        exit 1
    fi

    log_success "Certbot installed successfully"
else
    log_info "Certbot is already installed"
fi

# Determine certbot command
CERTBOT_CMD="certbot certonly --webroot -w /var/www/certbot"

# Add staging flag if requested
if [ "$STAGING" = "1" ]; then
    log_warning "Using Let's Encrypt STAGING server (for testing)"
    CERTBOT_CMD="$CERTBOT_CMD --staging"
fi

# Request certificate
log_info "Requesting SSL certificate for $DOMAIN and www.$DOMAIN..."

$CERTBOT_CMD \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --keep-until-expiring \
    --quiet

if [ $? -eq 0 ]; then
    log_success "SSL certificate obtained successfully!"
else
    log_error "Failed to obtain SSL certificate"
    log_info "Make sure:"
    log_info "  1. Your domain points to this server's IP"
    log_info "  2. Ports 80 and 443 are open"
    log_info "  3. Nginx is running and serving .well-known/acme-challenge"
    exit 1
fi

# Set up automatic renewal
log_info "Setting up automatic certificate renewal..."

# Create renewal cron job
CRON_JOB="0 0,12 * * * certbot renew --quiet --post-hook 'docker-compose -f /home/user/pnptvbot-production/docker-compose.yml restart nginx'"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Automatic renewal cron job added"
else
    log_info "Automatic renewal cron job already exists"
fi

# Test certificate renewal (dry-run)
log_info "Testing certificate renewal..."
certbot renew --dry-run --quiet

if [ $? -eq 0 ]; then
    log_success "Certificate renewal test passed!"
else
    log_warning "Certificate renewal test failed. Check certbot configuration."
fi

# Display certificate information
log_info "Certificate information:"
certbot certificates

# Copy certificates to Docker volumes (if using Docker)
if command -v docker &> /dev/null; then
    log_info "Copying certificates to Docker volumes..."

    # Create backup of current certificates
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        docker cp "/etc/letsencrypt/live/$DOMAIN" pnptv-nginx:/etc/letsencrypt/live/ 2>/dev/null || true
        docker cp "/etc/letsencrypt/archive/$DOMAIN" pnptv-nginx:/etc/letsencrypt/archive/ 2>/dev/null || true
        log_success "Certificates copied to Docker container"
    fi
fi

# Reload Nginx
log_info "Reloading Nginx..."
if command -v docker &> /dev/null && docker ps | grep -q pnptv-nginx; then
    docker-compose -f /home/user/pnptvbot-production/docker-compose.yml restart nginx
    log_success "Nginx reloaded successfully"
elif systemctl is-active --quiet nginx; then
    systemctl reload nginx
    log_success "Nginx reloaded successfully"
else
    log_warning "Could not reload Nginx. Please reload manually."
fi

# Final summary
echo ""
log_success "=========================================="
log_success "SSL Certificate Setup Complete!"
log_success "=========================================="
log_info "Domain: $DOMAIN"
log_info "Certificate valid for: 90 days"
log_info "Auto-renewal: Enabled (runs twice daily)"
log_info "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
echo ""
log_info "Test your SSL configuration at:"
log_info "  https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
log_success "Your site is now secured with HTTPS!"
