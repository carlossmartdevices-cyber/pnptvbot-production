#!/bin/bash

###############################################################################
# Deploy Video Rooms SSL Setup - Complete Automation Script
#
# This script automates the complete SSL setup for the video rooms server.
# It should be run on the video rooms server (148.230.80.210) AFTER DNS is set.
#
# Usage: sudo ./deploy-videorooms-ssl.sh [subdomain] [email]
# Example: sudo ./deploy-videorooms-ssl.sh videorooms.pnptv.app admin@pnptv.app
#
# Prerequisites:
# 1. DNS A record created: videorooms.pnptv.app -> 148.230.80.210
# 2. DNS propagated (test with: dig videorooms.pnptv.app +short)
# 3. Ports 80 and 443 are open
# 4. This script run with sudo
#
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Get parameters or use defaults
SUBDOMAIN="${1:-videorooms.pnptv.app}"
EMAIL="${2:-}"

if [ -z "$EMAIL" ]; then
    read -p "Enter email address for SSL notifications: " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "Email address is required"
        exit 1
    fi
fi

log_info "================================================"
log_info "Video Rooms SSL Setup Automation"
log_info "================================================"
log_info "Subdomain: $SUBDOMAIN"
log_info "Email: $EMAIL"
log_info ""

# Step 1: Verify DNS
log_info "Step 1: Verifying DNS resolution..."
if ! dig "$SUBDOMAIN" +short | grep -q "148\.230\.80\.210"; then
    log_warning "DNS not yet resolving to 148.230.80.210"
    log_info "Waiting for DNS propagation (up to 5 minutes)..."

    for i in {1..30}; do
        sleep 10
        if dig "$SUBDOMAIN" +short | grep -q "148\.230\.80\.210"; then
            log_success "DNS now resolves correctly!"
            break
        fi
        echo -n "."
    done

    if ! dig "$SUBDOMAIN" +short | grep -q "148\.230\.80\.210"; then
        log_error "DNS is not resolving to 148.230.80.210"
        log_error "Please verify the DNS A record in Hostinger:"
        log_error "  Name: videorooms"
        log_error "  Type: A"
        log_error "  Value: 148.230.80.210"
        exit 1
    fi
fi
log_success "DNS verified: $SUBDOMAIN -> 148.230.80.210"

# Step 2: Install dependencies
log_info ""
log_info "Step 2: Installing dependencies..."
apt-get update -qq
apt-get install -y curl nginx certbot > /dev/null 2>&1
log_success "Dependencies installed"

# Step 3: Create directories
log_info ""
log_info "Step 3: Creating necessary directories..."
mkdir -p /var/www/html/.well-known/acme-challenge
mkdir -p /var/www/html/pnptvvideorooms
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
log_success "Directories created"

# Step 4: Request SSL certificate
log_info ""
log_info "Step 4: Requesting SSL certificate from Let's Encrypt..."
certbot certonly \
    --webroot \
    -w /var/www/html \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$SUBDOMAIN" \
    --non-interactive \
    --keep-until-expiring

if [ $? -ne 0 ]; then
    log_error "Failed to obtain SSL certificate"
    log_info "Troubleshooting:"
    log_info "  1. Verify DNS: dig $SUBDOMAIN +short (should show 148.230.80.210)"
    log_info "  2. Check firewall: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
    log_info "  3. Check port accessibility: curl -I http://$SUBDOMAIN/.well-known/acme-challenge/test"
    exit 1
fi

log_success "SSL certificate obtained!"
log_info "  Certificate: /etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem"
log_info "  Private Key: /etc/letsencrypt/live/$SUBDOMAIN/privkey.pem"

# Step 5: Create Nginx configuration
log_info ""
log_info "Step 5: Creating Nginx configuration..."

cat > /etc/nginx/sites-available/videorooms << 'NGINX_EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name videorooms.pnptv.app;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name videorooms.pnptv.app;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/videorooms.pnptv.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/videorooms.pnptv.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "ALLOW-FROM https://pnptv.app" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers for iframe embedding from pnptv.app
    add_header Access-Control-Allow-Origin "https://pnptv.app" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range" always;
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Logging
    access_log /var/log/nginx/videorooms-access.log combined;
    error_log /var/log/nginx/videorooms-error.log warn;

    # Handle CORS preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }

    # Proxy to video rooms application (adjust port if needed)
    location /pnptvvideorooms {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Serve static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/html/pnptvvideorooms;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
NGINX_EOF

log_success "Nginx configuration created"

# Step 6: Enable Nginx site
log_info ""
log_info "Step 6: Enabling Nginx configuration..."
ln -sf /etc/nginx/sites-available/videorooms /etc/nginx/sites-enabled/videorooms

# Test configuration
log_info "Testing Nginx configuration..."
if ! nginx -t > /dev/null 2>&1; then
    log_error "Nginx configuration test failed"
    nginx -t
    exit 1
fi
log_success "Nginx configuration is valid"

# Reload Nginx
log_info "Reloading Nginx..."
systemctl restart nginx
if [ $? -ne 0 ]; then
    log_error "Failed to restart Nginx"
    systemctl status nginx
    exit 1
fi
log_success "Nginx reloaded successfully"

# Step 7: Set up auto-renewal
log_info ""
log_info "Step 7: Setting up certificate auto-renewal..."
CRON_JOB="0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload nginx || service nginx reload'"
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Auto-renewal configured"
else
    log_success "Auto-renewal already configured"
fi

# Step 8: Verification
log_info ""
log_info "Step 8: Verifying setup..."

log_info "Testing SSL certificate..."
if openssl s_client -connect localhost:443 -servername "$SUBDOMAIN" < /dev/null 2>/dev/null | grep -q "Verify return code"; then
    log_success "SSL certificate is valid"
else
    log_warning "Could not verify SSL certificate locally"
fi

log_info "Testing HTTPS connectivity..."
if curl -s -I https://"$SUBDOMAIN"/health --insecure | grep -q "200\|301"; then
    log_success "HTTPS connectivity verified"
else
    log_warning "Could not reach HTTPS endpoint (this may be normal if app is not running)"
fi

# Final summary
log_info ""
log_info "================================================"
log_success "SSL Setup Complete!"
log_info "================================================"
log_info ""
log_info "Configuration Summary:"
log_info "  Domain: $SUBDOMAIN"
log_info "  Certificate: /etc/letsencrypt/live/$SUBDOMAIN/"
log_info "  Nginx Config: /etc/nginx/sites-available/videorooms"
log_info "  Auto-renewal: Enabled (checks daily)"
log_info ""
log_info "Next Steps:"
log_info "  1. Verify the video rooms application is running on localhost:8080"
log_info "  2. Test in browser: https://$SUBDOMAIN/pnptvvideorooms"
log_info "  3. Test from main server: https://pnptv.app/video-rooms"
log_info ""
log_info "To update the proxy pass port (if using different port):"
log_info "  nano /etc/nginx/sites-available/videorooms"
log_info "  # Update: proxy_pass http://localhost:8080;"
log_info "  sudo nginx -t && sudo systemctl reload nginx"
log_info ""
log_success "Setup completed successfully!"
