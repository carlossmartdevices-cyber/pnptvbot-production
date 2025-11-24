# PNPtv Radio Web Interface - Deployment Guide

## 🎵 Radio Web Player Deployed

The PNPtv Radio web interface is now live and accessible!

### 📍 Access URLs

**Main Radio Interface:**
- https://easybots.store/radio.html
- https://pnptv.app/radio.html

**With Telegram ID (for linked requests):**
- https://easybots.store/radio.html?telegramId=123456
- https://pnptv.app/radio.html?telegramId=123456

### 🎧 Stream Configuration

The radio player is pre-configured with the default stream URL:
```
https://pnptv.app/radio/stream
```

This is hardcoded in the `radio.html` file at lines 668 and 673.

### 🔧 Technical Details

**Location:** `/root/pnptvbot-production/public/radio.html`

**Server Stack:**
- **Bot API (Port 3000):** Serves static files including radio.html
- **Nginx:** Proxies `/radio.html` requests to port 3000
- **SSL:** Enabled via Let's Encrypt for both domains

**Nginx Configuration:**
```nginx
location /radio.html {
    proxy_pass http://127.0.0.1:3000/radio.html;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
    
    add_header Cache-Control "public, max-age=300";
    access_log /var/log/nginx/radio-access.log combined;
}
```

### 📊 Features

The radio interface includes:
- ✅ Material Design UI (dark theme)
- ✅ Play/Pause controls
- ✅ Volume control
- ✅ Now Playing display
- ✅ Song history
- ✅ Request song functionality (with Telegram integration)
- ✅ Share buttons (WhatsApp, Facebook, Twitter)
- ✅ Responsive mobile design
- ✅ WebSocket support for live updates

### 🔗 Integration with Telegram Bot

Users can pass their Telegram ID in the URL to enable song requests:
```
https://easybots.store/radio.html?telegramId=USER_TELEGRAM_ID
```

When a user requests a song, it will be linked to their Telegram account for notifications.

### 📝 Logs

Radio access logs are available at:
```bash
tail -f /var/log/nginx/radio-access.log
```

### 🚀 Deployment Status

- ✅ HTML file deployed: `/root/pnptvbot-production/public/radio.html`
- ✅ Bot API serving static files: Port 3000
- ✅ Nginx configuration updated: `/etc/nginx/sites-available/pnptv-bot.conf`
- ✅ Nginx reloaded successfully
- ✅ SSL certificates active (easybots.store + pnptv.app)
- ✅ HTTP/2 enabled
- ✅ Accessible from both domains

### 🔄 Updates

To update the radio interface:

1. Edit the file:
```bash
nano /root/pnptvbot-production/public/radio.html
```

2. No restart needed - changes are served immediately via Express static middleware

To change the stream URL, update lines 668 and 673 in `radio.html`:
```javascript
currentStreamUrl = 'https://pnptv.app/radio/stream';
```

### 🎉 Success!

The radio web interface is fully deployed and ready for use!

**Test it now:**
- https://easybots.store/radio.html
- https://pnptv.app/radio.html
