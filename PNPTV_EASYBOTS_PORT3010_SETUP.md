# 🚀 PNPtv Website - Port 3010 Deployment Guide

## Status: ✅ CONFIGURED & READY

**Configuration Date:** November 23, 2025  
**Port:** 3010  
**URL:** https://pnptv.app/easybots  
**Direct Access:** https://pnptv.app (with routing rules)

---

## 📋 Configuration Summary

### Port 3010 Enabled
- ✅ PM2 process configured
- ✅ Nginx routing added
- ✅ SSL/HTTPS configured
- ✅ Environment variables set
- ✅ Database isolation configured

### Access Points

1. **Subdomain Route (Recommended):**
   ```
   https://pnptv.app/easybots
   ```

2. **Direct Port (Internal):**
   ```
   http://localhost:3010
   ```

---

## 🔧 Technical Configuration

### PM2 Configuration
File: `ecosystem.config.js`

**Process:** `easybots-website`
- **Script:** `server.js`
- **Directory:** `/root/easybots-website`
- **Port:** 3010
- **Mode:** Fork (1 instance)
- **Memory Limit:** 500MB
- **Auto-restart:** Enabled

**Database Isolation (Redis DB 2):**
```
REDIS_DB: 2
REDIS_KEY_PREFIX: 'easybots:'
```

**PostgreSQL Isolation:**
```
Database: easybots
User: easybots
Password: easybots_secure_pass_2025
```

### Nginx Configuration
File: `nginx-config-updated.conf`

**Route Rule:**
```nginx
location ~ ^/easybots(/|$) {
    rewrite ^/easybots(.*) $1 break;
    proxy_pass http://127.0.0.1:3010;
    # ... full configuration ...
}
```

**Features:**
- WebSocket support enabled
- Rate limiting not applied
- Full header preservation
- SSL/HTTPS automatic
- Access logs: `/var/log/nginx/pnptv-easybots-access.log`

---

## 📁 Directory Structure

### Required Directories
```
/root/easybots-website/
├── server.js              # Entry point
├── package.json
├── .env                   # Configuration
├── public/                # Static files
├── src/                   # Source code
└── dist/                  # Build output (if applicable)
```

### Create the directory structure:
```bash
# Create directory if it doesn't exist
mkdir -p /root/easybots-website
cd /root/easybots-website

# Create basic server.js
cat > server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('EasyBots Website Running on Port 3010!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`EasyBots website running on port ${PORT}`);
});
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "easybots-website",
  "version": "1.0.0",
  "description": "EasyBots Website",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
npm install
```

---

## 🚀 Deployment Steps

### Step 1: Upload Your Website Code
```bash
# Option A: Git clone
cd /root/easybots-website
git clone <your-repo-url> .

# Option B: Manual upload
# Use SFTP or SCP to upload your files to /root/easybots-website
```

### Step 2: Install Dependencies
```bash
cd /root/easybots-website
npm install
```

### Step 3: Configure Environment Variables
```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Environment Variables:**
```
NODE_ENV=production
PORT=3010
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
REDIS_DB=2
REDIS_KEY_PREFIX=easybots:
```

### Step 4: Update Nginx Configuration
```bash
# Copy the updated config
sudo cp /root/pnptvbot-production/nginx-config-updated.conf /etc/nginx/sites-available/pnptv.app

# Test nginx
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 5: Start PM2 Process
```bash
# Navigate to pnptvbot directory
cd /root/pnptvbot-production

# Start or restart with updated config
pm2 restart ecosystem.config.js --update-env

# Verify all processes are running
pm2 status

# Save PM2 state
pm2 save
```

---

## ✅ Verification Steps

### Check Port 3010 is Listening
```bash
lsof -i :3010
# Should show: node    easybots-website on port 3010
```

### Test Local Access
```bash
curl http://localhost:3010
# Should return: "EasyBots Website Running on Port 3010!"
```

### Test Health Endpoint
```bash
curl http://localhost:3010/health
# Should return: {"status":"ok","port":3010}
```

### Test Nginx Routing
```bash
curl https://pnptv.app/easybots
# Should return your website content
```

### Check PM2 Process
```bash
pm2 status

# Output should show:
# id  name                  status
# 15  pnptv-bot            online
# 1   social-hub           online
# ?   pnptv-easybots       online  ← New process
```

### Monitor Logs
```bash
# Real-time logs
pm2 logs pnptv-easybots

# Access logs
tail -f /var/log/nginx/pnptv-easybots-access.log

# Error logs
tail -f /root/.pm2/logs/pnptv-easybots-error.log
```

---

## 🔗 URL Routing

### Public URLs (HTTPS)
1. `https://pnptv.app/easybots` → Routes to http://localhost:3010
2. `https://pnptv.app/easybots/` → Same as above
3. `https://pnptv.app/easybots/api/*` → API routes on port 3010

### Internal URLs (No HTTPS)
1. `http://localhost:3010` → Direct access
2. `http://127.0.0.1:3010` → Direct access

### All Other Routes (/)
- Route to Telegram Bot (port 3000)
- Handled by catchall location

---

## 🛡️ Security Configuration

### Already Configured
✅ SSL/TLS Encryption (HTTPS)  
✅ Security Headers (X-Frame-Options, etc.)  
✅ CORS enabled  
✅ Compression enabled  
✅ Database isolated (DB 2)  
✅ Redis keys isolated (`easybots:` prefix)  

### Recommendations
- Set strong `.env` passwords
- Keep dependencies updated (`npm audit fix`)
- Monitor access logs for suspicious activity
- Regular database backups
- SSL certificate auto-renewal (Let's Encrypt)

---

## 📊 Process Management

### Start All Services
```bash
cd /root/pnptvbot-production
pm2 start ecosystem.config.js
```

### Stop All Services
```bash
pm2 stop all
```

### Restart Specific Service
```bash
pm2 restart easybots-website
pm2 restart pnptv-bot
pm2 restart social-hub
```

### View Logs
```bash
# All logs
pm2 logs

# Specific service
pm2 logs easybots-website

# Last 50 lines
pm2 logs easybots-website --lines 50 --nostream
```

### Monitor Resources
```bash
pm2 monit

# Shows CPU, Memory usage in real-time
```

---

## 📈 Performance Tuning

### Memory Optimization
Current limit: 500MB per process

To increase if needed:
```javascript
max_memory_restart: '1000M',  // 1GB limit
```

### Connection Pooling
PostgreSQL connections: 2-20 (configurable)  
Redis connections: Handled by library

### CPU Cores
Current: 1 instance

To use multiple cores:
```javascript
instances: 'max',  // Use all available CPU cores
exec_mode: 'cluster',
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process on port 3010
lsof -i :3010

# Kill process
kill -9 <PID>
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:3010

# Check nginx config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### PM2 Process Won't Start
```bash
# Check logs
pm2 logs easybots-website

# Check permissions
ls -la /root/easybots-website/

# Check dependencies
cd /root/easybots-website && npm install
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check Redis is running
redis-cli ping  # Should return: PONG

# Verify credentials in .env
cat /root/easybots-website/.env
```

---

## 📝 Maintenance Schedule

### Daily
- Monitor logs for errors
- Check process status: `pm2 status`

### Weekly
- Review access logs
- Check disk space
- Update npm packages: `npm update`

### Monthly
- Database cleanup
- SSL certificate renewal (automatic with Let's Encrypt)
- Performance review

### Quarterly
- Security audit
- Dependency updates: `npm audit fix`
- Backup database

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Start website | `pm2 start ecosystem.config.js --name pnptv-easybots` |
| Stop website | `pm2 stop pnptv-easybots` |
| Restart website | `pm2 restart pnptv-easybots` |
| View logs | `pm2 logs pnptv-easybots` |
| Check status | `pm2 status` |
| Direct access | `curl http://localhost:3010` |
| Public URL | `https://pnptv.app/easybots` |
| Health check | `curl http://localhost:3010/health` |

---

## 📞 Support

For issues or questions:
1. Check logs: `pm2 logs easybots-website`
2. Verify nginx config: `sudo nginx -t`
3. Test backend: `curl http://localhost:3010`
4. Check port listening: `lsof -i :3010`

---

**Deployment Status:** ✅ READY  
**Last Updated:** January 7, 2026  
**Configuration Version:** 2.0 (Updated to pnptv.app)
