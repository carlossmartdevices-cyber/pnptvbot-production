# Troubleshooting Guide

## 502 Error on /video-rooms

### Issue
The `/video-rooms` endpoint returns a 502 Bad Gateway error when accessed through nginx.

### Root Cause
The Node.js application server was not running on port 3000, causing nginx to fail when trying to proxy requests to the backend.

### Solution

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   - Copy `.env.lifetime-pass` to `.env` (or create from `.env.example`)
   - Ensure `PORT=3000` is set (to match nginx configuration)
   - Add required environment variables from `.env.example`:
     ```bash
     MISTRAL_AGENT_ID=
     AGE_VERIFICATION_PROVIDER=azure
     MIN_AGE_REQUIREMENT=18
     AZURE_FACE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com
     AZURE_FACE_API_KEY=your_azure_face_api_key
     FACEPP_API_KEY=your_facepp_api_key
     FACEPP_API_SECRET=your_facepp_api_secret
     ```

3. **Start the Server**
   ```bash
   npm start
   ```

   Or with PM2 for production:
   ```bash
   npx pm2 start ecosystem.config.js
   ```

4. **Verify the Fix**
   ```bash
   # Check if server is running on port 3000
   curl -I http://localhost:3000/video-rooms

   # Should return HTTP 200 OK
   ```

### Dependencies
- **Redis** (optional): Used for caching. Server will run in degraded mode without it.
- **PostgreSQL** (optional): Used for persistent storage. Server will run in degraded mode without it.
- **Firestore**: Required for core functionality (configured via Firebase credentials in .env)

### Nginx Configuration
The nginx configuration in `/etc/nginx/sites-available/pnptv-app.conf` proxies `/video-rooms` to `http://localhost:3000/video-rooms`. Ensure:
- Nginx is running and properly configured
- The proxy_pass points to the correct port (3000)
- SSL certificates are valid (if using HTTPS)

### Monitoring
Check if the Node.js process is running:
```bash
ps aux | grep "node src/bot/core/bot.js"
```

Check if port 3000 is listening:
```bash
lsof -i :3000
```

View application logs:
```bash
tail -f logs/combined.log
```

### Production Deployment
For production, use PM2 to manage the process:
```bash
# Start with PM2
npx pm2 start ecosystem.config.js

# Save process list (will restore on reboot)
npx pm2 save

# Configure auto-start on boot
npx pm2 startup
# This creates a systemd service that will start PM2 on boot

# Check status
npx pm2 status

# View logs
npx pm2 logs pnptv-bot

# Restart
npx pm2 restart pnptv-bot

# Stop
npx pm2 stop pnptv-bot

# Monitor in real-time
npx pm2 monit
```

### Deployment Status Check
After deployment, verify everything is working:
```bash
# 1. Check PM2 status
npx pm2 status
# Should show: status: online

# 2. Test endpoint locally
curl -I http://localhost:3000/video-rooms
# Should return: HTTP/1.1 200 OK

# 3. View recent logs
npx pm2 logs pnptv-bot --lines 20

# 4. Check if PM2 will restart on boot
systemctl status pm2-root
# Should show: active (running)
```
