#!/bin/bash
#
# Firewall Setup Script for pnptv.app
# Configures UFW (Uncomplicated Firewall) with secure defaults
#
# Usage: sudo ./scripts/setup-firewall.sh
#

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

log_info "Starting firewall configuration..."

# Install UFW if not already installed
if ! command -v ufw &> /dev/null; then
    log_info "Installing UFW..."

    # Detect OS
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y ufw
    elif [ -f /etc/redhat-release ]; then
        yum install -y ufw
    else
        log_error "Unsupported operating system"
        exit 1
    fi

    log_success "UFW installed successfully"
else
    log_info "UFW is already installed"
fi

# Disable UFW first to avoid lockout during configuration
log_info "Disabling UFW temporarily for configuration..."
ufw --force disable

# Reset UFW to defaults
log_info "Resetting UFW to defaults..."
ufw --force reset

# Set default policies
log_info "Setting default policies..."
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed

log_success "Default policies set: deny incoming, allow outgoing"

# Allow SSH (CRITICAL - prevents lockout)
log_info "Allowing SSH access..."
ufw allow 22/tcp comment 'SSH'
log_success "SSH access allowed on port 22"

# Allow HTTP and HTTPS
log_info "Allowing HTTP and HTTPS..."
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
log_success "HTTP (80) and HTTPS (443) allowed"

# Allow Docker subnet (for container communication)
log_info "Allowing Docker subnet..."
ufw allow from 172.16.0.0/12 comment 'Docker subnet'
log_success "Docker subnet allowed"

# Rate limiting for SSH (prevent brute force)
log_info "Enabling rate limiting for SSH..."
ufw limit 22/tcp comment 'SSH rate limit'
log_success "SSH rate limiting enabled"

# Advanced security rules
log_info "Configuring advanced security rules..."

# Block common attack vectors
ufw deny from 0.0.0.0/8 comment 'Block invalid source'
ufw deny from 127.0.0.0/8 comment 'Block localhost as source'
ufw deny from 224.0.0.0/4 comment 'Block multicast'
ufw deny from 240.0.0.0/5 comment 'Block reserved'

# Allow localhost connections
ufw allow from 127.0.0.1 comment 'Allow localhost'
ufw allow from ::1 comment 'Allow localhost IPv6'

log_success "Advanced security rules configured"

# Enable UFW
log_info "Enabling UFW..."
ufw --force enable

# Display status
log_info "Current firewall status:"
ufw status verbose

# Enable UFW logging
log_info "Enabling UFW logging..."
ufw logging on

# Configure log rotation
log_info "Configuring log rotation..."
cat > /etc/logrotate.d/ufw << 'EOF'
/var/log/ufw.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
    postrotate
        service rsyslog reload > /dev/null 2>&1 || true
    endscript
}
EOF

log_success "Log rotation configured"

# Display summary
echo ""
log_success "=========================================="
log_success "Firewall Configuration Complete!"
log_success "=========================================="
log_info "Firewall Status: ENABLED"
log_info "Default Policy: DENY incoming"
log_info "Allowed Services:"
log_info "  - SSH (port 22) with rate limiting"
log_info "  - HTTP (port 80)"
log_info "  - HTTPS (port 443)"
log_info "  - Docker subnet (172.16.0.0/12)"
echo ""
log_info "Check firewall status: sudo ufw status verbose"
log_info "View firewall logs: sudo tail -f /var/log/ufw.log"
echo ""
log_warning "IMPORTANT: Make sure you can access SSH before logging out!"
log_success "Firewall setup complete!"
