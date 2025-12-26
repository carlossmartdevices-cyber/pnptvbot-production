#!/bin/bash
#
# SSL Setup for Video Rooms Server (148.230.80.210)
# This script should be run ON THE VIDEO ROOMS SERVER (148.230.80.210)
#
# Usage: sudo ./setup-videorooms-ssl.sh [subdomain] [email]
# Example: sudo ./setup-videorooms-ssl.sh videorooms.pnptv.app admin@pnptv.app
#

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

SUBDOMAIN="${1:-videorooms.pnptv.app}"
EMAIL="${2:-}"

if [ -z "$EMAIL" ]; then
    read -p "Enter email address for SSL notifications: " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "Email address is required"
        exit 1
    fi
fi

log_info "Setting up SSL for $SUBDOMAIN on this server (148.230.80.210)"

# Install Certbot
if ! command -v certbot &> /dev/null; then
    log_info "Installing Certbot..."
    apt-get update
    apt-get install -y certbot
    log_success "Certbot installed"
fi

# Create webroot directory for ACME challenge
mkdir -p /var/www/html/.well-known/acme-challenge

# Request certificate
log_info "Requesting SSL certificate..."
certbot certonly --webroot \
    -w /var/www/html \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$SUBDOMAIN" \
    --non-interactive \
    --keep-until-expiring

if [ $? -eq 0 ]; then
    log_success "SSL certificate obtained!"
    log_info "Certificate: /etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem"
    log_info "Private Key: /etc/letsencrypt/live/$SUBDOMAIN/privkey.pem"

    # Set up auto-renewal
    CRON_JOB="0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload nginx || service nginx reload'"
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        log_success "Auto-renewal configured"
    fi

    log_success "SSL setup complete!"
    log_info "Next: Configure your web server to use these certificates"
else
    log_error "Failed to obtain SSL certificate"
    log_info "Make sure:"
    log_info "  1. DNS points $SUBDOMAIN to 148.230.80.210"
    log_info "  2. Port 80 is open and accessible"
    log_info "  3. Web server is serving .well-known/acme-challenge"
    exit 1
fi
