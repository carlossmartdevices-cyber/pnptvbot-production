# Video Rooms SSL Setup Guide

This guide explains how to fix the SSL security warning for the video rooms iframe.

## 🔍 The Problem

The iframe URL `https://148.230.80.210/pnptvvideorooms` shows a security warning because:

1. **IP addresses cannot have SSL certificates** - Let's Encrypt and other CAs require a domain name
2. **Browsers warn about insecure content** - Loading content from an IP over HTTPS triggers warnings
3. **Mixed content issues** - Your main site (pnptv.app) is HTTPS, but the iframe content triggers warnings

## ✅ Solutions

### Option 1: You Own the Video Rooms Server (Recommended)

If you control the server at `148.230.80.210`, follow these steps:

#### Step 1: Add DNS Record

Add an A record pointing a subdomain to the video rooms server:

```
A    videorooms.pnptv.app    ->    148.230.80.210
```

Wait for DNS propagation (5-30 minutes typically):
```bash
# Check DNS propagation
dig videorooms.pnptv.app +short
# Should return: 148.230.80.210
```

#### Step 2: Install SSL on Video Rooms Server

**On the video rooms server (148.230.80.210)**, run:

```bash
# Copy the setup script to the video rooms server
scp scripts/setup-videorooms-ssl.sh user@148.230.80.210:~/

# SSH into the video rooms server
ssh user@148.230.80.210

# Run the SSL setup
sudo ./setup-videorooms-ssl.sh videorooms.pnptv.app admin@pnptv.app
```

The script will:
- Install Certbot
- Request SSL certificate for videorooms.pnptv.app
- Set up automatic renewal

#### Step 3: Configure Web Server on Video Rooms Server

**If using Nginx**, create/update config:

```bash
# On the video rooms server
sudo nano /etc/nginx/sites-available/videorooms
```

Add this configuration:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name videorooms.pnptv.app;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name videorooms.pnptv.app;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/videorooms.pnptv.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/videorooms.pnptv.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "ALLOW-FROM https://pnptv.app" always;
    add_header X-Content-Type-Options "nosniff" always;

    # CORS for iframe embedding
    add_header Access-Control-Allow-Origin "https://pnptv.app" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;

    location /pnptvvideorooms {
        # Your video rooms application
        proxy_pass http://localhost:8080;  # Adjust to your actual port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and test:
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/videorooms /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Step 4: Update Landing Page

The legacy iframe landing page (`public/video-rooms.html`) has been removed. If you still embed the video rooms in a page, update that page’s iframe URL:

```html
<!-- Change from: -->
<iframe src="https://148.230.80.210/pnptvvideorooms" ...></iframe>

<!-- To: -->
<iframe src="https://videorooms.pnptv.app/pnptvvideorooms" ...></iframe>
```

#### Step 5: Test

```bash
# Test SSL certificate
curl -I https://videorooms.pnptv.app/pnptvvideorooms

# Test in browser
# Visit: https://pnptv.app/video-rooms (legacy redirect) or your current video rooms page
# The iframe should load without security warnings
```

---

### Option 2: You Don't Control the Video Rooms Server

If you don't own the server at `148.230.80.210`, you have these options:

#### 2A. Contact Server Owner

Contact whoever owns `148.230.80.210` and ask them to:
1. Set up a domain name
2. Install SSL certificate
3. Configure CORS headers to allow embedding

#### 2B. Use Reverse Proxy (Temporary Workaround)

You can proxy the video rooms through your own server:

**Add to nginx config** (`/home/user/pnptvbot-production/nginx/pnptv-app.conf`):

```nginx
location /videorooms-proxy {
    # Proxy to the video rooms server
    proxy_pass https://148.230.80.210/pnptvvideorooms;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # Allow iframe embedding
    proxy_hide_header X-Frame-Options;
    add_header X-Frame-Options "SAMEORIGIN";

    # SSL verification (may need to disable if upstream has self-signed cert)
    proxy_ssl_verify off;
}
```

**Update iframe** in your video rooms landing page (legacy `public/video-rooms.html` no longer exists):

```html
<iframe src="https://pnptv.app/videorooms-proxy" ...></iframe>
```

**Restart nginx**:
```bash
docker-compose restart nginx
```

**⚠️ Warning**: This is a workaround and may not work well for real-time video streaming due to double-proxying.

#### 2C. Self-Host Video Rooms

If the video rooms application is open source or you have the code:

1. Deploy it on your own server or as a Docker container
2. Use a subdomain (e.g., `videorooms.pnptv.app`)
3. Get SSL certificate for the subdomain
4. Update the iframe URL

---

### Option 3: Use Alternative Video Room Service

Consider using established video conferencing services:

- **Jitsi Meet** (open source, self-hostable)
- **Daily.co** (commercial, has free tier)
- **Whereby** (commercial, easy iframe embedding)
- **Agora** (already in your project dependencies)

Example with Jitsi:

```html
<iframe
    allow="camera; microphone; fullscreen; display-capture; autoplay"
    src="https://meet.jit.si/pnptv-video-rooms"
    style="height: 100%; width: 100%; border: 0px;">
</iframe>
```

---

## 🔒 Security Best Practices

### For iframe embedding:

1. **Always use HTTPS** for both parent and iframe
2. **Set proper CSP headers**:
   ```nginx
   add_header Content-Security-Policy "frame-src 'self' https://videorooms.pnptv.app;";
   ```

3. **Configure CORS** on the iframe source:
   ```nginx
   add_header Access-Control-Allow-Origin "https://pnptv.app";
   ```

4. **Use X-Frame-Options** carefully:
   ```nginx
   # On video rooms server, allow embedding from pnptv.app
   add_header X-Frame-Options "ALLOW-FROM https://pnptv.app";
   ```

---

## 🧪 Testing

### Test SSL Certificate
```bash
# Check if certificate is valid
openssl s_client -connect videorooms.pnptv.app:443 -servername videorooms.pnptv.app

# Test with curl
curl -I https://videorooms.pnptv.app/pnptvvideorooms
```

### Test in Browser
1. Open: https://pnptv.app/video-rooms
2. Open browser console (F12)
3. Look for:
   - ✓ No security warnings
   - ✓ No mixed content errors
   - ✓ Iframe loads successfully

### Test iframe embedding
```bash
# Check response headers
curl -I https://videorooms.pnptv.app/pnptvvideorooms

# Look for:
# - X-Frame-Options: ALLOW-FROM https://pnptv.app
# - Access-Control-Allow-Origin: https://pnptv.app
```

---

## 📞 Need Help?

**Quick Checks:**

1. ✓ Is DNS pointing to the correct IP?
   ```bash
   dig videorooms.pnptv.app +short
   ```

2. ✓ Is port 80 and 443 open?
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. ✓ Is the web server running?
   ```bash
   sudo systemctl status nginx
   ```

4. ✓ Is the SSL certificate valid?
   ```bash
   sudo certbot certificates
   ```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| DNS not propagating | Wait 5-30 minutes, check with `dig` |
| Port 80 blocked | Check firewall: `sudo ufw allow 80/tcp` |
| Certificate failed | Check domain points to correct IP |
| Iframe blocked | Check X-Frame-Options and CSP headers |
| CORS error | Add Access-Control-Allow-Origin header |

---

**Last Updated**: 2025-12-16
**Recommended**: Option 1 (Use subdomain with SSL)
