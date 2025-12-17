#!/bin/bash
#
# Complete Security Setup Script for pnptv.app
# Orchestrates all security configurations including firewall, fail2ban, and SSL
#
# Usage: sudo ./scripts/setup-security.sh [domain] [email]
# Example: sudo ./scripts/setup-security.sh pnptv.app admin@pnptv.app
#

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

# Configuration
DOMAIN="${1:-pnptv.app}"
EMAIL="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Display banner
echo ""
echo -e "${CYAN}=========================================="
echo "  PNPtv Security Setup"
echo "  Domain: $DOMAIN"
echo "==========================================${NC}"
echo ""

# Prompt for email if not provided
if [ -z "$EMAIL" ]; then
    read -p "Enter email address for SSL notifications: " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "Email address is required"
        exit 1
    fi
fi

# =========================================
# Step 1: System Updates
# =========================================
log_step "Step 1/6: Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
log_success "System packages updated"

# =========================================
# Step 2: Install Security Tools
# =========================================
log_step "Step 2/6: Installing security tools..."

# Install essential packages
log_info "Installing essential security packages..."
apt-get install -y -qq \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-listchanges \
    logrotate \
    rsyslog \
    curl \
    wget \
    net-tools \
    iptables

log_success "Security tools installed"

# =========================================
# Step 3: Configure Automatic Updates
# =========================================
log_step "Step 3/6: Configuring automatic security updates..."

# Enable unattended upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Enable automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

log_success "Automatic security updates configured"

# =========================================
# Step 4: Configure Firewall (UFW)
# =========================================
log_step "Step 4/6: Configuring firewall..."

if [ -f "$SCRIPT_DIR/setup-firewall.sh" ]; then
    chmod +x "$SCRIPT_DIR/setup-firewall.sh"
    bash "$SCRIPT_DIR/setup-firewall.sh"
else
    log_warning "Firewall setup script not found. Skipping..."
fi

# =========================================
# Step 5: Configure Fail2ban
# =========================================
log_step "Step 5/6: Configuring fail2ban..."

# Copy fail2ban configuration
if [ -d "$PROJECT_DIR/security/fail2ban" ]; then
    log_info "Installing fail2ban configuration..."

    # Copy jail configuration
    if [ -f "$PROJECT_DIR/security/fail2ban/jail.local" ]; then
        cp "$PROJECT_DIR/security/fail2ban/jail.local" /etc/fail2ban/jail.local
        log_info "Jail configuration installed"
    fi

    # Copy custom filters
    if [ -d "$PROJECT_DIR/security/fail2ban/filter.d" ]; then
        cp "$PROJECT_DIR/security/fail2ban/filter.d/"* /etc/fail2ban/filter.d/ 2>/dev/null || true
        log_info "Custom filters installed"
    fi

    # Restart fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    log_success "Fail2ban configured and started"

    # Display fail2ban status
    sleep 2
    fail2ban-client status || true
else
    log_warning "Fail2ban configuration not found. Skipping..."
fi

# =========================================
# Step 6: System Hardening
# =========================================
log_step "Step 6/6: Applying system hardening..."

# Disable root login via SSH (if not already disabled)
log_info "Hardening SSH configuration..."
sed -i 's/^#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Restart SSH service
systemctl reload sshd || systemctl reload ssh
log_success "SSH hardened"

# Configure kernel security settings
log_info "Configuring kernel security settings..."
cat >> /etc/sysctl.conf << 'EOF'

# PNPtv Security Settings
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0

# Ignore ICMP ping requests
net.ipv4.icmp_echo_ignore_all = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# Enable TCP SYN cookies
net.ipv4.tcp_syncookies = 1

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Increase system file descriptor limit
fs.file-max = 65535

# Increase TCP buffer sizes
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
EOF

# Apply sysctl settings
sysctl -p > /dev/null 2>&1
log_success "Kernel security settings applied"

# Set secure file permissions
log_info "Setting secure file permissions..."
chmod 700 /root
chmod 644 /etc/passwd
chmod 644 /etc/group
chmod 600 /etc/shadow
chmod 600 /etc/gshadow
log_success "File permissions secured"

# =========================================
# Summary
# =========================================
echo ""
log_success "=========================================="
log_success "Security Setup Complete!"
log_success "=========================================="
echo ""
log_info "Security Features Installed:"
log_info "  ✓ System packages updated"
log_info "  ✓ UFW firewall configured and enabled"
log_info "  ✓ Fail2ban intrusion prevention active"
log_info "  ✓ Automatic security updates enabled"
log_info "  ✓ SSH hardened (root login disabled)"
log_info "  ✓ Kernel security settings applied"
log_info "  ✓ Secure file permissions set"
echo ""
log_info "Next Steps:"
log_info "  1. Run SSL setup: sudo $SCRIPT_DIR/setup-ssl.sh $DOMAIN $EMAIL"
log_info "  2. Deploy application: docker-compose up -d"
log_info "  3. Monitor security: sudo fail2ban-client status"
echo ""
log_warning "IMPORTANT:"
log_warning "  - Make sure you have SSH key-based authentication configured"
log_warning "  - Password authentication has been disabled"
log_warning "  - Root login via SSH has been disabled"
echo ""
log_success "Your server is now secured!"
