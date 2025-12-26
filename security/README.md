# PNPtv Security Configuration

This directory contains security configurations and scripts for the PNPtv platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Security Features](#security-features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## 🔒 Overview

The PNPtv security setup includes:

- **SSL/TLS Encryption** - Let's Encrypt certificates with auto-renewal
- **Web Application Firewall** - UFW with secure default policies
- **Intrusion Prevention** - Fail2ban with custom rules
- **Security Headers** - HSTS, CSP, and other protective headers
- **Rate Limiting** - Nginx rate limiting for API and webhooks
- **Automatic Updates** - Unattended security updates

## 🚀 Quick Start

### Complete Security Setup

Run the comprehensive security setup script:

```bash
# Navigate to project directory
cd /home/user/pnptvbot-production

# Run complete security setup
sudo ./scripts/setup-security.sh pnptv.app admin@pnptv.app

# Install SSL certificates
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app
```

### Deploy with Docker

```bash
# Start all services (nginx, certbot, bot, redis)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🛡️ Security Features

### 1. SSL/TLS Encryption

**Configuration**: `/nginx/pnptv-app.conf`

Features:
- TLS 1.2 and 1.3 only
- Modern cipher suites (Mozilla Intermediate profile)
- OCSP stapling
- HTTP to HTTPS redirect
- Auto-renewal via Certbot

**Certificate Locations**:
- Certificate: `/etc/letsencrypt/live/pnptv.app/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/pnptv.app/privkey.pem`

**Renewal**:
Automatic renewal runs twice daily via cron:
```bash
# View renewal status
sudo certbot certificates

# Manual renewal
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### 2. Firewall (UFW)

**Script**: `/scripts/setup-firewall.sh`

Allowed Ports:
- **22/tcp** - SSH (with rate limiting)
- **80/tcp** - HTTP (redirects to HTTPS)
- **443/tcp** - HTTPS

**Commands**:
```bash
# Check firewall status
sudo ufw status verbose

# View firewall logs
sudo tail -f /var/log/ufw.log

# Reload firewall
sudo ufw reload
```

### 3. Intrusion Prevention (Fail2ban)

**Configuration**: `/security/fail2ban/jail.local`

Protected Services:
- SSH (3 attempts, 24h ban)
- Nginx HTTP Auth
- API abuse (100 req/10min)
- Webhook abuse (20 req/5min)
- DoS attacks (300 req/1min)

**Custom Filters**:
- `pnptv-webhook.conf` - Telegram webhook protection
- `pnptv-api.conf` - API abuse prevention
- `nginx-dos.conf` - DoS attack mitigation

**Commands**:
```bash
# Check fail2ban status
sudo fail2ban-client status

# Check specific jail
sudo fail2ban-client status sshd
sudo fail2ban-client status pnptv-api

# Unban an IP
sudo fail2ban-client set sshd unbanip 1.2.3.4

# View banned IPs
sudo fail2ban-client status | grep "Banned"
```

### 4. Security Headers

**Implemented in**: `/nginx/pnptv-app.conf`

Headers:
- `Strict-Transport-Security` - Force HTTPS
- `X-Frame-Options` - Prevent clickjacking
- `X-Content-Type-Options` - Prevent MIME sniffing
- `X-XSS-Protection` - XSS protection
- `Referrer-Policy` - Control referrer information
- `Content-Security-Policy` - Restrict resource loading
- `Permissions-Policy` - Feature permissions

### 5. Rate Limiting

**Configuration**: Nginx rate limiting zones

Limits:
- Webhooks: 50 requests/minute
- API: 100 requests/minute
- Video Rooms: 30 requests/minute

**Zones**:
```nginx
limit_req_zone $binary_remote_addr zone=pnptv_webhook_limit:10m rate=50r/m;
limit_req_zone $binary_remote_addr zone=pnptv_api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=pnptv_video_limit:10m rate=30r/m;
```

## 🔧 Installation

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Domain name pointing to server IP
- Docker and Docker Compose installed

### Step-by-Step Installation

#### 1. Clone Repository

```bash
cd /home/user
git clone https://github.com/yourusername/pnptvbot-production.git
cd pnptvbot-production
```

#### 2. Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

#### 3. Run Security Setup

```bash
# Complete security setup (firewall, fail2ban, hardening)
sudo ./scripts/setup-security.sh pnptv.app admin@pnptv.app
```

#### 4. Install SSL Certificates

```bash
# Install Let's Encrypt SSL certificates
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app
```

#### 5. Deploy Application

```bash
# Start Docker containers
docker-compose up -d

# Verify deployment
docker-compose ps
curl -I https://pnptv.app/health
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost/pnptv
REDIS_HOST=redis

# Telegram
BOT_TOKEN=your_bot_token

# Payment Providers
EPAYCO_PUBLIC_KEY=your_key
EPAYCO_PRIVATE_KEY=your_key

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_key
```

### Nginx Configuration

Edit `/nginx/pnptv-app.conf` to customize:

- Server name
- SSL certificate paths
- Rate limiting
- Security headers
- Proxy settings

### Fail2ban Configuration

Edit `/security/fail2ban/jail.local` to customize:

- Ban time
- Max retry attempts
- Find time window
- Email notifications

## 📊 Monitoring

### Check Service Status

```bash
# Docker services
docker-compose ps

# Nginx
docker-compose logs nginx

# Certbot
docker-compose logs certbot

# Application
docker-compose logs bot
```

### Security Monitoring

```bash
# Firewall status
sudo ufw status verbose

# Fail2ban status
sudo fail2ban-client status

# SSL certificate status
sudo certbot certificates

# View fail2ban logs
sudo tail -f /var/log/fail2ban.log

# View nginx access logs
sudo tail -f /var/log/nginx/pnptv-access.log

# View nginx error logs
sudo tail -f /var/log/nginx/pnptv-error.log
```

### SSL/TLS Testing

Test SSL configuration:
```bash
# Using SSL Labs
https://www.ssllabs.com/ssltest/analyze.html?d=pnptv.app

# Using testssl.sh
./testssl.sh pnptv.app

# Using OpenSSL
openssl s_client -connect pnptv.app:443 -tls1_2
```

## 🔍 Troubleshooting

### SSL Certificate Issues

**Problem**: Certificate not found

```bash
# Check certificate exists
sudo ls -la /etc/letsencrypt/live/pnptv.app/

# Re-run SSL setup
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

**Problem**: Certificate renewal fails

```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Check nginx configuration
sudo nginx -t
```

### Firewall Issues

**Problem**: Can't access service

```bash
# Check if port is allowed
sudo ufw status

# Allow specific port
sudo ufw allow 443/tcp

# Check if UFW is enabled
sudo ufw status verbose
```

### Fail2ban Issues

**Problem**: Service not starting

```bash
# Check fail2ban status
sudo systemctl status fail2ban

# Test configuration
sudo fail2ban-client -t

# View fail2ban logs
sudo tail -f /var/log/fail2ban.log
```

**Problem**: IP wrongly banned

```bash
# Unban specific IP
sudo fail2ban-client set sshd unbanip 1.2.3.4

# Check banned IPs
sudo fail2ban-client status sshd
```

### Nginx Issues

**Problem**: Nginx not starting

```bash
# Test nginx configuration
docker exec pnptv-nginx nginx -t

# Check nginx logs
docker-compose logs nginx

# Restart nginx
docker-compose restart nginx
```

## 📝 Maintenance

### Regular Tasks

**Daily**:
- Monitor fail2ban logs
- Check application logs

**Weekly**:
- Review nginx access logs
- Check for unusual traffic patterns
- Verify SSL certificate status

**Monthly**:
- Update Docker images
- Review and update security policies
- Test SSL certificate renewal

### Update Commands

```bash
# Update Docker images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d

# Update system packages
sudo apt update && sudo apt upgrade -y
```

## 🆘 Support

For security issues or questions:

1. Check logs: `docker-compose logs -f`
2. Review this documentation
3. Check fail2ban status: `sudo fail2ban-client status`
4. Verify firewall rules: `sudo ufw status verbose`
5. Test SSL: `sudo certbot certificates`

## 📚 Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Security Guide](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [UFW Documentation](https://help.ubuntu.com/community/UFW)
- [Fail2ban Manual](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

## 🔐 Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Keep software updated** - Enable automatic security updates
3. **Use strong passwords** - For database and admin accounts
4. **Enable 2FA** - For critical services
5. **Regular backups** - Backup databases and configurations
6. **Monitor logs** - Set up log monitoring and alerts
7. **Principle of least privilege** - Limit access and permissions
8. **Regular security audits** - Review and test security measures

---

**Last Updated**: 2025-12-16
**Maintained by**: PNPtv Team
