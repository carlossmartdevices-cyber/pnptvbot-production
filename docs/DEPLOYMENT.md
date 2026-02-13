# Deployment Guide

## Prerequisites

Before deploying the PNPtv Telegram Bot, ensure you have:

1. ✅ Node.js 18.x or higher installed
2. ✅ Redis server (local or cloud)
3. ✅ Firebase project set up
4. ✅ Telegram bot token from @BotFather
5. ✅ Domain with SSL certificate (for production webhooks)
6. ✅ (Optional) Docker and Docker Compose

## Development Deployment

### Local Development

1. **Install Dependencies**

```bash
npm install
```

2. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Seed Database**

```bash
npm run seed
```

4. **Start Development Server**

```bash
npm run dev
```

The bot will run in polling mode (suitable for development).

## Production Deployment

### Option 1: Docker Deployment (Recommended)

1. **Prepare Environment**

```bash
# Create production .env file
cp .env.example .env
# Set NODE_ENV=production and configure all required variables
```

2. **Build and Run**

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f bot

# Check status
docker-compose ps
```

3. **Set Webhook**

The bot automatically sets the webhook when `BOT_WEBHOOK_DOMAIN` is configured and `NODE_ENV=production`.

4. **Verify Deployment**

```bash
curl https://yourdomain.com/health
```

### Option 2: PM2 Deployment

1. **Install PM2**

```bash
npm install -g pm2
```

2. **Start Bot**

```bash
pm2 start src/bot/core/bot.js --name pnptv-bot

# Enable startup script
pm2 startup
pm2 save
```

3. **Manage Process**

```bash
# View logs
pm2 logs pnptv-bot

# Restart
pm2 restart pnptv-bot

# Stop
pm2 stop pnptv-bot

# Monitor
pm2 monit
```

### Option 3: Systemd Service

1. **Create Service File**

```bash
sudo nano /etc/systemd/system/pnptv-bot.service
```

Add:

```ini
[Unit]
Description=PNPtv Telegram Bot
After=network.target redis.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/pnptv-bot
ExecStart=/usr/bin/node src/bot/core/bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. **Enable and Start**

```bash
sudo systemctl daemon-reload
sudo systemctl enable pnptv-bot
sudo systemctl start pnptv-bot

# Check status
sudo systemctl status pnptv-bot
```

## Cloud Platform Deployment

### Deploy to Heroku

1. **Create Heroku App**

```bash
heroku create pnptv-bot
```

2. **Add Redis Add-on**

```bash
heroku addons:create heroku-redis:hobby-dev
```

3. **Set Environment Variables**

```bash
heroku config:set BOT_TOKEN=your_token
heroku config:set NODE_ENV=production
# Set all other required variables
```

4. **Deploy**

```bash
git push heroku main
```

5. **Scale Dynos**

```bash
heroku ps:scale web=1
```

### Deploy to AWS ECS

1. **Build Docker Image**

```bash
docker build -t pnptv-bot .
```

2. **Push to ECR**

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker tag pnptv-bot:latest your-account.dkr.ecr.us-east-1.amazonaws.com/pnptv-bot:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/pnptv-bot:latest
```

3. **Create ECS Task Definition** (use AWS Console or CLI)

4. **Create ECS Service**

5. **Configure ALB and Target Group**

### Deploy to Google Cloud Run

1. **Build and Push**

```bash
gcloud builds submit --tag gcr.io/your-project/pnptv-bot
```

2. **Deploy**

```bash
gcloud run deploy pnptv-bot \
  --image gcr.io/your-project/pnptv-bot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. **Set Environment Variables**

```bash
gcloud run services update pnptv-bot \
  --set-env-vars BOT_TOKEN=your_token,NODE_ENV=production
```

## Advanced Deployment and Hardening

This section provides additional details and best practices for securing and maintaining your PNPtv Bot deployment, particularly when using a Docker-based setup with Nginx and Let's Encrypt.

### Detailed SSL Certificate Setup

#### Initial Certificate Installation

To install Let's Encrypt SSL certificates using a helper script:

```bash
# Ensure scripts are executable
chmod +x scripts/*.sh

# Run SSL setup script with your domain and admin email
sudo ./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

This script typically:
- Installs Certbot.
- Requests an SSL certificate from Let's Encrypt.
- Configures automatic renewal.
- Sets up a renewal cron job.

#### Manual Certificate Installation

If you prefer to install certificates manually, for example, if Certbot needs to run in standalone mode:

```bash
# Stop nginx temporarily to free up port 80/443
docker-compose stop nginx

# Request certificate using standalone mode
sudo certbot certonly --standalone \
  --preferred-challenges http \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com

# Copy certificates to Docker volumes used by Nginx (adjust service name if different)
# Replace 'pnptv-nginx' with your actual Nginx service name if applicable
sudo docker cp /etc/letsencrypt/live/yourdomain.com/. pnptv-nginx:/etc/letsencrypt/live/
sudo docker cp /etc/letsencrypt/archive/yourdomain.com/. pnptv-nginx:/etc/letsencrypt/archive/

# Restart nginx
docker-compose start nginx
```
*Note: Ensure the Nginx container is configured to mount these certificate paths.*

#### Certificate Renewal

Automatic renewal is configured via cron job by the `setup-ssl.sh` script. You can manage it with:

```bash
# View renewal cron job
crontab -l | grep certbot

# Manual renewal
sudo certbot renew

# Test renewal (dry-run)
sudo certbot renew --dry-run

# Force renewal (if certificate expires in <30 days)
sudo certbot renew --force-renewal

# Restart Nginx after successful renewal
docker-compose restart nginx
```

### Advanced Security Configuration

#### Firewall Status (UFW)

Check and manage your Uncomplicated Firewall (UFW) status:

```bash
# Check firewall status
sudo ufw status verbose

# View allowed services
sudo ufw status numbered

# Add custom rule (e.g., for port 8080)
sudo ufw allow 8080/tcp

# Remove rule by number
sudo ufw delete [rule_number]
```

#### Intrusion Prevention (Fail2ban Monitoring)

Monitor and manage Fail2ban to protect against brute-force attacks:

```bash
# Check fail2ban status
sudo fail2ban-client status

# Check a specific jail (e.g., sshd, pnptv-api)
sudo fail2ban-client status sshd
sudo fail2ban-client status pnptv-api

# View currently banned IPs
sudo fail2ban-client status | grep "Banned"

# Unban an IP address
sudo fail2ban-client set sshd unbanip 1.2.3.4

# View fail2ban logs
sudo tail -f /var/log/fail2ban.log
```

#### Security Logs

Review various security-related logs:

```bash
# Nginx access logs (adjust path if different)
sudo tail -f /var/log/nginx/pnptv-access.log

# Nginx error logs (adjust path if different)
sudo tail -f /var/log/nginx/pnptv-error.log

# UFW firewall logs
sudo tail -f /var/log/ufw.log

# System authentication logs
sudo tail -f /var/log/auth.log
```

### Enhanced Verification Steps

In addition to the standard verification, ensure these security aspects:

#### Security Headers

Check that your application is serving appropriate security headers:

```bash
curl -I https://yourdomain.com
```

Expected headers might include:
- `Strict-Transport-Security: max-age=...`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: ...`

#### Rate Limiting Verification

Verify API rate limiting is active and configured correctly. For example, to test an `/api/stats` endpoint:

```bash
# This command sends 110 requests, expecting a 429 "Too Many Requests" after the limit is hit
for i in {1..110}; do curl -I https://yourdomain.com/api/stats 2>/dev/null | grep HTTP; done
```

### Advanced Troubleshooting

#### Issue: SSL Certificate Not Found

**Symptom**: Nginx fails to start with "certificate not found" error in logs.

**Solution**:
1. Verify certificate existence:
   ```bash
   sudo ls -la /etc/letsencrypt/live/yourdomain.com/
   ```
2. If certificates are missing, re-run the SSL setup script:
   ```bash
   sudo ./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
   ```
3. Restart Nginx:
   ```bash
   docker-compose restart nginx
   ```

#### Issue: Port 80/443 Already in Use

**Symptom**: Docker Compose or Nginx reports "port is already allocated" or similar error.

**Solution**:
1. Identify the process using the ports:
   ```bash
   sudo lsof -i :80
   sudo lsof -i :443
   ```
2. Stop the conflicting service (e.g., Apache, another Nginx instance):
   ```bash
   sudo systemctl stop apache2 # or nginx
   ```
3. Restart Docker Compose to reclaim ports:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Updates and Maintenance

#### Update Application (Docker)

To update your Docker-based application to the latest version from your Git repository:

```bash
# 1. Pull latest changes from your desired branch
git pull origin your_deployment_branch # e.g., main or production

# 2. Rebuild and restart all Docker services to apply changes
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 3. Verify deployment health
curl -I https://yourdomain.com/health
```

## Firebase Configuration

### 1. Create Firestore Indexes

Run the index creation script:

```bash
npm run migrate
```

Or manually create these indexes in Firebase Console:

- Collection: `users`
  - Fields: `subscriptionStatus` (ASC), `planExpiry` (ASC)
  - Fields: `location.lat` (ASC), `location.lng` (ASC)
  - Fields: `interests` (ARRAY), `subscriptionStatus` (ASC)

- Collection: `payments`
  - Fields: `userId` (ASC), `createdAt` (DESC)

- Collection: `liveStreams`
  - Fields: `status` (ASC), `createdAt` (DESC)

### 2. Set Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /payments/{paymentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if false;
    }

    match /plans/{planId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## Nginx Configuration

If using Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

### Set Up Sentry

1. Create Sentry project
2. Get DSN
3. Add to `.env`:

```env
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production
```

### Set Up Logging

Logs are automatically rotated and stored in `logs/` directory. For production:

1. Consider using log aggregation (Loggly, DataDog, CloudWatch)
2. Set up alerts for errors
3. Monitor disk usage for log files

### Health Checks

Configure health check endpoint in your load balancer:

- **Path**: `/health`
- **Port**: 3000 (or your configured port)
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Healthy threshold**: 2
- **Unhealthy threshold**: 3

## Cron Jobs

Enable cron jobs for automated tasks:

```env
ENABLE_CRON=true
SUBSCRIPTION_CHECK_CRON=0 0 * * *
```

Cron jobs handle:
- Subscription expiry checks
- Automated notifications
- Data cleanup

## Scaling

### Horizontal Scaling

1. **Multiple Bot Instances**
   - Use webhook mode (not polling)
   - Configure load balancer
   - Ensure Redis is shared across instances

2. **Redis Cluster**
   - Set up Redis cluster for high availability
   - Configure sentinel for failover

3. **Database Optimization**
   - Use Firestore indexes
   - Implement pagination
   - Cache frequently accessed data

### Vertical Scaling

Adjust resources based on load:

**Docker:**
```yaml
services:
  bot:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Backup Strategy

### Database Backups

1. **Firestore**: Enable automatic backups in Firebase Console
2. **Redis**: Configure RDB or AOF persistence

### Code Backups

1. Use Git for version control
2. Tag releases: `git tag -a v1.0.0 -m "Release v1.0.0"`
3. Push tags: `git push --tags`

## Security Checklist

- [ ] All environment variables configured
- [ ] Firestore security rules set
- [ ] SSL certificate installed
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] Sentry configured
- [ ] Admin user IDs set
- [ ] Payment webhook secrets configured
- [ ] Secrets not committed to Git

## Post-Deployment Verification

1. **Test Bot Commands**
   - /start
   - /menu
   - User onboarding flow

2. **Test Features**
   - Profile management
   - Subscription flow
   - Payment webhooks
   - Admin panel

3. **Monitor Logs**
   ```bash
   docker-compose logs -f bot
   # or
   pm2 logs pnptv-bot
   ```

4. **Check Error Tracking**
   - Verify Sentry is receiving errors
   - Set up alerts

5. **Performance Testing**
   - Load test critical endpoints
   - Monitor response times
   - Check Redis cache performance

## Troubleshooting

### Bot Not Starting

1. Check logs for errors
2. Verify all required env variables are set
3. Test Redis connection
4. Check Firebase credentials

### Webhook Not Working

1. Verify HTTPS is configured
2. Check webhook URL in Telegram
3. Test webhook endpoint: `curl -X POST https://yourdomain.com/pnp/webhook/telegram`
4. Review Nginx/load balancer logs

### High Memory Usage

1. Check for memory leaks
2. Monitor Redis memory usage
3. Review session TTL settings
4. Implement pagination for large queries

## Rollback Procedure

If deployment fails:

**Docker:**
```bash
docker-compose down
docker-compose up -d --force-recreate
```

**PM2:**
```bash
pm2 stop pnptv-bot
# Deploy previous version
pm2 start pnptv-bot
```

**Git:**
```bash
git revert HEAD
git push origin main
```

## Support

For deployment issues:
- Check logs first
- Review documentation
- Contact support: support@pnptv.com
