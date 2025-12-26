# PNPtv Deployment Guide

Complete deployment guide for pnptv.app with SSL/TLS certificates and security hardening.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deployment](#quick-deployment)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Security Configuration](#security-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## ✅ Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 2GB minimum (4GB recommended)
- **CPU**: 2 cores minimum
- **Storage**: 20GB minimum
- **Network**: Public IP address

### Software Requirements

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Install Git
sudo apt install git -y
```

### Domain Configuration

1. Point your domain `pnptv.app` to your server's IP address
2. Add DNS A records:
   ```
   A    pnptv.app          -> YOUR_SERVER_IP
   A    www.pnptv.app      -> YOUR_SERVER_IP
   ```
3. Wait for DNS propagation (can take up to 24 hours)

Verify DNS propagation:
```bash
dig pnptv.app +short
dig www.pnptv.app +short
```

## 🚀 Quick Deployment

For experienced users who want to deploy quickly:

```bash
# 1. Clone repository
cd /home/user
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production

# 2. Checkout deployment branch
git checkout claude/create-pnptv-landing-page-013FFARMn68woKkCvGCwZTQc

# 3. Configure environment
cp .env.example .env
nano .env  # Edit with your configuration

# 4. Run security setup
sudo ./scripts/setup-security.sh pnptv.app admin@pnptv.app

# 5. Install SSL certificates
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app

# 6. Deploy with Docker
docker-compose up -d

# 7. Verify deployment
curl -I https://pnptv.app/health
```

## 📖 Step-by-Step Deployment

### Step 1: Clone Repository

```bash
# Navigate to deployment directory
cd /home/user

# Clone the repository
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production

# Checkout the deployment branch
git checkout claude/create-pnptv-landing-page-013FFARMn68woKkCvGCwZTQc
```

### Step 2: Configure Environment Variables

Create `.env` file with your configuration:

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables**:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pnptv
REDIS_HOST=redis
REDIS_PORT=6379

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token_here

# Payment Providers
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Agora (Video/Audio)
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_CERTIFICATE=your_agora_certificate

# Security
SESSION_SECRET=generate_random_string_here
JWT_SECRET=generate_random_string_here
```

**Generate random secrets**:
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### Step 3: Security Setup

Run the comprehensive security setup:

```bash
# Make scripts executable (if not already)
chmod +x scripts/*.sh

# Run complete security setup
sudo ./scripts/setup-security.sh pnptv.app admin@pnptv.app
```

This script will:
- ✓ Update system packages
- ✓ Install security tools (UFW, fail2ban)
- ✓ Configure firewall
- ✓ Set up intrusion prevention
- ✓ Enable automatic security updates
- ✓ Harden SSH configuration
- ✓ Apply kernel security settings

**Expected Output**:
```
[SUCCESS] Security Setup Complete!
  ✓ System packages updated
  ✓ UFW firewall configured and enabled
  ✓ Fail2ban intrusion prevention active
  ✓ Automatic security updates enabled
  ✓ SSH hardened (root login disabled)
  ✓ Kernel security settings applied
```

### Step 4: SSL Certificate Setup

Install Let's Encrypt SSL certificates:

```bash
# Install SSL certificates for pnptv.app
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app
```

This script will:
- ✓ Install Certbot
- ✓ Request SSL certificate from Let's Encrypt
- ✓ Configure automatic renewal (twice daily)
- ✓ Set up renewal cron job

**Expected Output**:
```
[SUCCESS] SSL Certificate Setup Complete!
  Domain: pnptv.app
  Certificate valid for: 90 days
  Auto-renewal: Enabled (runs twice daily)
  Certificate location: /etc/letsencrypt/live/pnptv.app/
```

**Verify Certificate**:
```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

### Step 5: Deploy Application

Deploy all services using Docker Compose:

```bash
# Build and start all containers
docker-compose up -d

# Expected services:
# - nginx: Reverse proxy with SSL/TLS
# - certbot: SSL certificate auto-renewal
# - bot: Telegram bot and Express API
# - redis: Caching and session storage
```

**Check Service Status**:
```bash
# View all containers
docker-compose ps

# Expected output:
# pnptv-nginx    ... Up      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# pnptv-certbot  ... Up
# pnptv-bot      ... Up      3000/tcp
# pnptv-redis    ... Up      6379/tcp
```

**View Logs**:
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f nginx
docker-compose logs -f bot
docker-compose logs -f redis
```

### Step 6: Verify Deployment

Check that all services are running correctly:

```bash
# 1. Check health endpoint
curl -I https://pnptv.app/health
# Expected: HTTP/2 200

# 2. Check video rooms landing page
curl -I https://pnptv.app/video-rooms
# Expected: HTTP/2 200

# 3. Check SSL certificate
openssl s_client -connect pnptv.app:443 -tls1_3 < /dev/null
# Expected: Connected with TLSv1.3

# 4. Check Docker containers
docker-compose ps
# Expected: All containers "Up"

# 5. Test SSL configuration
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=pnptv.app
# Expected: Grade A or A+
```

## 🔒 SSL Certificate Setup

### Initial Certificate Installation

```bash
# Run SSL setup script
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app
```

### Manual Certificate Installation

If you prefer to install certificates manually:

```bash
# Stop nginx temporarily
docker-compose stop nginx

# Request certificate using standalone mode
sudo certbot certonly --standalone \
  --preferred-challenges http \
  --email admin@pnptv.app \
  --agree-tos \
  --no-eff-email \
  -d pnptv.app \
  -d www.pnptv.app

# Copy certificates to Docker volumes
sudo docker cp /etc/letsencrypt/live/pnptv.app pnptv-nginx:/etc/letsencrypt/live/
sudo docker cp /etc/letsencrypt/archive/pnptv.app pnptv-nginx:/etc/letsencrypt/archive/

# Restart nginx
docker-compose start nginx
```

### Certificate Renewal

Automatic renewal is configured via cron:

```bash
# View renewal cron job
crontab -l | grep certbot

# Manual renewal
sudo certbot renew

# Test renewal (dry-run)
sudo certbot renew --dry-run

# Force renewal (if certificate expires in <30 days)
sudo certbot renew --force-renewal

# Restart nginx after renewal
docker-compose restart nginx
```

## 🛡️ Security Configuration

### Firewall Status

```bash
# Check firewall status
sudo ufw status verbose

# View allowed services
sudo ufw status numbered

# Add custom rule (if needed)
sudo ufw allow 8080/tcp

# Remove rule
sudo ufw delete [rule_number]
```

### Fail2ban Monitoring

```bash
# Check fail2ban status
sudo fail2ban-client status

# Check specific jail
sudo fail2ban-client status sshd
sudo fail2ban-client status pnptv-api

# View banned IPs
sudo fail2ban-client status | grep "Banned"

# Unban IP
sudo fail2ban-client set sshd unbanip 1.2.3.4

# View fail2ban logs
sudo tail -f /var/log/fail2ban.log
```

### Security Logs

```bash
# Nginx access logs
sudo tail -f /var/log/nginx/pnptv-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/pnptv-error.log

# UFW firewall logs
sudo tail -f /var/log/ufw.log

# System authentication logs
sudo tail -f /var/log/auth.log
```

## ✅ Verification

### 1. Health Check

```bash
# API health check
curl https://pnptv.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-12-16T...",
  "uptime": 12345,
  "dependencies": {
    "redis": "ok",
    "firestore": "ok",
    "database": "ok"
  }
}
```

### 2. Video Rooms Page

```bash
# Check video rooms landing page
curl -I https://pnptv.app/video-rooms

# Expected: HTTP/2 200 OK
```

Visit in browser: https://pnptv.app/video-rooms

### 3. SSL Certificate

```bash
# Check certificate details
openssl s_client -connect pnptv.app:443 -servername pnptv.app < /dev/null | grep -A 5 "Certificate chain"

# Test TLS versions
openssl s_client -connect pnptv.app:443 -tls1_2 < /dev/null
openssl s_client -connect pnptv.app:443 -tls1_3 < /dev/null
```

### 4. Security Headers

```bash
# Check security headers
curl -I https://pnptv.app

# Expected headers:
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: ...
```

### 5. Rate Limiting

```bash
# Test API rate limiting (should get 429 after 100 requests)
for i in {1..110}; do curl -I https://pnptv.app/api/stats 2>/dev/null | grep HTTP; done
```

## 🔧 Troubleshooting

### Issue: SSL Certificate Not Found

**Symptom**: Nginx fails to start with "certificate not found"

**Solution**:
```bash
# 1. Check if certificate exists
sudo ls -la /etc/letsencrypt/live/pnptv.app/

# 2. If not exists, run SSL setup
sudo ./scripts/setup-ssl.sh pnptv.app admin@pnptv.app

# 3. Restart nginx
docker-compose restart nginx
```

### Issue: Port 80/443 Already in Use

**Symptom**: "port is already allocated" error

**Solution**:
```bash
# 1. Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# 2. Stop conflicting service
sudo systemctl stop apache2  # or nginx, if installed outside Docker

# 3. Restart Docker Compose
docker-compose down
docker-compose up -d
```

### Issue: Cannot Access Site

**Symptom**: "Connection refused" or "Cannot connect"

**Solution**:
```bash
# 1. Check firewall
sudo ufw status verbose
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 2. Check Docker containers
docker-compose ps

# 3. Check nginx logs
docker-compose logs nginx

# 4. Test locally
curl -I http://localhost
```

### Issue: Database Connection Failed

**Symptom**: "Cannot connect to database" in logs

**Solution**:
```bash
# 1. Check .env configuration
cat .env | grep DATABASE_URL

# 2. Test database connection
psql $DATABASE_URL

# 3. Restart application
docker-compose restart bot
```

### Issue: Redis Connection Failed

**Symptom**: "Redis connection timeout"

**Solution**:
```bash
# 1. Check Redis container
docker-compose ps redis

# 2. Check Redis logs
docker-compose logs redis

# 3. Test Redis connection
docker exec -it pnptv-redis redis-cli ping
# Expected: PONG

# 4. Restart Redis
docker-compose restart redis
```

## 🔄 Updates and Maintenance

### Update Application

```bash
# 1. Pull latest changes
git pull origin claude/create-pnptv-landing-page-013FFARMn68woKkCvGCwZTQc

# 2. Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 3. Verify deployment
curl -I https://pnptv.app/health
```

### Update System

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart services if needed
docker-compose restart
```

### Backup

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Backup environment
cp .env .env.backup

# Backup SSL certificates
sudo tar -czf letsencrypt_backup.tar.gz /etc/letsencrypt
```

## 📞 Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Review this guide
3. Check security documentation: `security/README.md`
4. Create an issue on GitHub

## 📚 Additional Resources

- [Security Documentation](security/README.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Deployment Branch**: `claude/create-pnptv-landing-page-013FFARMn68woKkCvGCwZTQc`
**Last Updated**: 2025-12-16
