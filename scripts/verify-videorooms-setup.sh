#!/bin/bash

###############################################################################
# Video Rooms Setup Verification Script
#
# This script verifies that the SSL setup is working correctly.
# Run this after the deploy-videorooms-ssl.sh script completes.
#
# Usage: ./verify-videorooms-setup.sh [subdomain]
# Example: ./verify-videorooms-setup.sh videorooms.pnptv.app
#
###############################################################################

# Color codes
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
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

SUBDOMAIN="${1:-videorooms.pnptv.app}"

log_info "================================================"
log_info "Video Rooms Setup Verification"
log_info "================================================"
log_info ""

# Test 1: DNS Resolution
log_info "Test 1: DNS Resolution"
if dig "$SUBDOMAIN" +short | grep -q "148\.230\.80\.210"; then
    log_success "DNS resolves to 148.230.80.210"
else
    log_error "DNS does not resolve to 148.230.80.210"
    echo "  Result: $(dig $SUBDOMAIN +short)"
fi
echo ""

# Test 2: SSL Certificate
log_info "Test 2: SSL Certificate"
if [ -f "/etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem" ]; then
    log_success "SSL certificate exists"

    # Check expiration
    EXPIRY=$(openssl x509 -in "/etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem" -noout -enddate | cut -d= -f2)
    log_info "  Certificate expires: $EXPIRY"

    # Check validity
    if openssl x509 -in "/etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem" -noout -text | grep -q "Issuer: C=US.*Let's Encrypt"; then
        log_success "Certificate issued by Let's Encrypt"
    fi
else
    log_error "SSL certificate not found"
fi
echo ""

# Test 3: Nginx Configuration
log_info "Test 3: Nginx Configuration"
if nginx -t 2>&1 | grep -q "successful"; then
    log_success "Nginx configuration is valid"
else
    log_error "Nginx configuration has errors"
    nginx -t
fi
echo ""

# Test 4: Nginx Status
log_info "Test 4: Nginx Service Status"
if systemctl is-active --quiet nginx; then
    log_success "Nginx is running"
else
    log_error "Nginx is not running"
fi
echo ""

# Test 5: Port Accessibility
log_info "Test 5: Port Accessibility"
if netstat -tuln 2>/dev/null | grep -q ":443 " || ss -tuln 2>/dev/null | grep -q ":443 "; then
    log_success "Port 443 (HTTPS) is listening"
else
    log_error "Port 443 (HTTPS) is not listening"
fi

if netstat -tuln 2>/dev/null | grep -q ":80 " || ss -tuln 2>/dev/null | grep -q ":80 "; then
    log_success "Port 80 (HTTP) is listening"
else
    log_error "Port 80 (HTTP) is not listening"
fi
echo ""

# Test 6: HTTPS Connectivity
log_info "Test 6: HTTPS Connectivity"
if curl -s -I --insecure https://"$SUBDOMAIN"/health 2>/dev/null | head -n1 | grep -q "200\|301\|404"; then
    log_success "HTTPS endpoint is reachable"
    HTTP_CODE=$(curl -s -I --insecure https://"$SUBDOMAIN"/health 2>/dev/null | head -n1)
    log_info "  Response: $HTTP_CODE"
else
    log_warning "HTTPS endpoint not reachable (app may not be running)"
    log_info "  Check if video rooms app is running on localhost:8080"
fi
echo ""

# Test 7: CORS Headers
log_info "Test 7: CORS Headers"
CORS_HEADER=$(curl -s -I --insecure https://"$SUBDOMAIN"/pnptvvideorooms 2>/dev/null | grep -i "Access-Control-Allow-Origin" | cut -d' ' -f2-)
if [ -n "$CORS_HEADER" ]; then
    log_success "CORS headers present"
    log_info "  Access-Control-Allow-Origin: $CORS_HEADER"
else
    log_warning "CORS headers not detected"
fi
echo ""

# Test 8: Certificate Chain
log_info "Test 8: Certificate Chain"
if openssl s_client -connect "$SUBDOMAIN:443" -servername "$SUBDOMAIN" </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
    log_success "Certificate chain is valid"
else
    log_warning "Could not verify certificate chain (may be due to system configuration)"
fi
echo ""

# Summary
log_info "================================================"
log_info "Verification Summary"
log_info "================================================"
log_info ""
log_info "If all tests passed:"
log_info "  ✓ DNS is configured correctly"
log_info "  ✓ SSL certificate is valid"
log_info "  ✓ Nginx is properly configured"
log_info "  ✓ HTTPS is accessible"
log_info ""
log_info "You can now:"
log_info "  1. Access: https://$SUBDOMAIN/pnptvvideorooms"
log_info "  2. Test iframe from: https://pnptv.app/video-rooms"
log_info ""
log_info "If tests failed:"
log_info "  1. Check DNS: dig $SUBDOMAIN +short"
log_info "  2. Check firewall: sudo ufw status"
log_info "  3. Check Nginx: sudo systemctl status nginx"
log_info "  4. Check logs: sudo tail -f /var/log/nginx/error.log"
log_info ""
