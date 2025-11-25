# PNPtv Web Apps Deployment Guide

This guide covers deploying all three PNPtv web applications to pnptv.app.

## 📦 Applications

1. **Hangouts** (`/hangouts`) - Video conferencing
2. **Radio** (`/radio`) - Audio streaming
3. **Live** (`/live`) - Live broadcasting

## 🚀 Quick Deploy

### Option 1: Netlify (Recommended)

Each app can be deployed separately or as a monorepo.

#### Deploy Individual Apps

1. **Hangouts**
   ```bash
   cd webapps/hangouts
   npm install
   npm run build
   netlify deploy --prod --dir=dist
   ```

2. **Radio**
   ```bash
   cd webapps/radio
   npm install
   npm run build
   netlify deploy --prod --dir=dist
   ```

3. **Live**
   ```bash
   cd webapps/live
   npm install
   npm run build
   netlify deploy --prod --dir=dist
   ```

#### Netlify Configuration

For each app, configure:
- **Base directory**: `webapps/hangouts` (or radio/live)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Custom domain**: Set up routes at pnptv.app

### Option 2: Vercel

Similar to Netlify:

```bash
cd webapps/hangouts
npm install
vercel --prod
```

### Option 3: Traditional Web Server (nginx)

Build all apps and deploy to your web server:

```bash
# Build all apps
cd webapps
for app in hangouts radio live; do
  cd $app
  npm install
  npm run build
  cd ..
done

# Copy to web server
sudo cp -r hangouts/dist /var/www/pnptv.app/hangouts
sudo cp -r radio/dist /var/www/pnptv.app/radio
sudo cp -r live/dist /var/www/pnptv.app/live
```

#### nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name pnptv.app;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/pnptv.app;

    # Hangouts App
    location /hangouts {
        alias /var/www/pnptv.app/hangouts;
        try_files $uri $uri/ /hangouts/index.html;
    }

    # Radio App
    location /radio {
        alias /var/www/pnptv.app/radio;
        try_files $uri $uri/ /radio/index.html;
    }

    # Live App
    location /live {
        alias /var/www/pnptv.app/live;
        try_files $uri $uri/ /live/index.html;
    }
}
```

## 🔧 Environment Configuration

### Update Bot Handlers

Update your `.env` file with the deployed URLs:

```bash
# Web App URLs
HANGOUTS_WEB_URL=https://pnptv.app/hangouts
RADIO_WEB_URL=https://pnptv.app/radio
LIVE_WEB_URL=https://pnptv.app/live

# Agora Configuration (already set)
AGORA_APP_ID=b68ab7b61ea44eabab7f242171311c5e
AGORA_CERTIFICATE=your_agora_certificate_here
```

### Agora Configuration

Make sure you have:
1. ✅ Agora App ID: `b68ab7b61ea44eabab7f242171311c5e`
2. ❌ Agora Certificate: Get from https://console.agora.io
   - Go to Projects → Your Project → Edit
   - Enable "App Certificate"
   - Copy the certificate
   - Add to `.env` as `AGORA_CERTIFICATE=xxx`

## 📋 Pre-Deployment Checklist

- [ ] All apps build successfully (`npm run build`)
- [ ] Agora App ID configured
- [ ] Agora Certificate obtained and added to `.env`
- [ ] Database migration run (`database/migrations/hangouts_radio_schema.sql`)
- [ ] Bot handlers updated with correct URLs
- [ ] SSL certificates configured for pnptv.app
- [ ] CORS configured if needed

## 🧪 Testing

After deployment, test each feature:

### Hangouts
1. Open Telegram bot
2. Go to Hangouts menu
3. Join main room or create private call
4. Click link → should open https://pnptv.app/hangouts
5. Verify video/audio works

### Radio
1. Open Telegram bot
2. Go to Radio menu
3. Click "Listen Now"
4. Should open https://pnptv.app/radio
5. Verify audio streaming works

### Live
1. Open Telegram bot (as admin/lifetime pass holder)
2. Go to Live menu
3. Start broadcast
4. Should open https://pnptv.app/live
5. Verify video broadcast works

## 🐛 Troubleshooting

### Camera/Microphone Not Working
- Check browser permissions
- Ensure HTTPS is enabled (required for media devices)
- Verify Agora credentials

### Token Errors
- Verify Agora Certificate is correct
- Check token generation in `agoraTokenService.js`
- Tokens expire after 24 hours by default

### Connection Failed
- Check Agora App ID
- Verify network allows WebRTC
- Check firewall settings

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📊 Monitoring

Monitor your deployments:
- Netlify: https://app.netlify.com
- Vercel: https://vercel.com/dashboard
- Server logs: `sudo tail -f /var/log/nginx/access.log`

## 🔄 Updates

To update after code changes:

```bash
cd webapps/[app-name]
git pull
npm install
npm run build
# Then redeploy using your chosen method
```

## 🎯 Next Steps

After deployment:
1. Add AI agents (see `AI_AGENT_INTEGRATION.md`)
2. Configure analytics
3. Set up monitoring/alerts
4. Test with real users
5. Gather feedback and iterate

## 📞 Support

For issues:
- Check bot logs: `pm2 logs pnptvbot`
- Check Agora dashboard: https://console.agora.io
- Review deployment logs
- Test locally first: `npm run dev`
