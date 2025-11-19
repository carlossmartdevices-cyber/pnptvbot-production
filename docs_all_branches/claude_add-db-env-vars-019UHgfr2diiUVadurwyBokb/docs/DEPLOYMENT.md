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
