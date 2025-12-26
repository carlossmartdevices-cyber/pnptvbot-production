# Video Rooms SSL Upgrade - Implementation Package

**Status**: ✅ Ready for Deployment
**Date**: December 23, 2025
**Target**: Upgrade video rooms from IP-based to domain-based HTTPS

---

## 🎯 Quick Start

### What's Done ✅
- Main server (72.60.29.80) fully configured
- Reverse proxy added to pnptv.app
- CSP headers updated
- Automation scripts created
- Complete documentation provided

### What You Need to Do 📋
1. Add DNS record in Hostinger (5-30 min including wait)
2. Run deployment script on video rooms server (5-10 min)
3. Run verification script (2-5 min)
4. Test in browser (5 min)

**Total Time**: 30-60 minutes (mostly DNS propagation waiting)

---

## 📚 Documentation Files

### Main Documentation
- **`VIDEOROOMS_SSL_DEPLOYMENT.md`** - Complete step-by-step guide with troubleshooting
- **`/tmp/quick-reference.txt`** - Quick reference card with commands
- **`/tmp/implementation-guide.md`** - Detailed implementation guide

### Automation Scripts
- **`scripts/deploy-videorooms-ssl.sh`** - Automated SSL deployment (run on video rooms server)
- **`scripts/verify-videorooms-setup.sh`** - Verification script (run on video rooms server)

---

## 🚀 Quick Start Steps

### Step 1: Add DNS Record (Manual)

In Hostinger control panel:
```
1. Go to: Domains → pnptv.app → DNS Zone
2. Add Record:
   Type:  A
   Name:  videorooms
   Value: 148.230.80.210
   TTL:   3600
3. Save and wait 5-30 minutes for propagation
4. Verify: dig videorooms.pnptv.app +short
```

### Step 2: Deploy SSL (Automated)

On the video rooms server (148.230.80.210):
```bash
# Copy script
scp /root/pnptvbot-production/scripts/deploy-videorooms-ssl.sh user@148.230.80.210:~/

# SSH into video rooms server
ssh user@148.230.80.210

# Run deployment
sudo ~/deploy-videorooms-ssl.sh videorooms.pnptv.app admin@pnptv.app

# Wait for completion (2-5 minutes)
```

### Step 3: Verify Setup

Still on video rooms server:
```bash
# Copy verification script
scp /root/pnptvbot-production/scripts/verify-videorooms-setup.sh user@148.230.80.210:~/

# Run verification
chmod +x ~/verify-videorooms-setup.sh
./verify-videorooms-setup.sh videorooms.pnptv.app

# All checks should pass ✓
```

### Step 4: Test Everything

Back on main server:
```bash
# Test SSL certificate
curl -I https://videorooms.pnptv.app/pnptvvideorooms

# Test reverse proxy
curl -I https://pnptv.app/videorooms-api/external_api.js
```

### Step 5: Test in Browser

Open browser and test:
```
https://pnptv.app/video-rooms

Check for:
✓ No security warnings
✓ No mixed content errors
✓ No CSP violations
✓ Video room loads properly
```

---

## 📋 Files Modified/Created

### Main Server (72.60.29.80) - Already Done
| File | Change | Status |
|------|--------|--------|
| `nginx/pnptv-app.conf` | Added reverse proxy + updated CSP | ✅ Complete |
| `public/video-rooms.html` | Already using reverse proxy | ✅ Ready |

### Video Rooms Server (148.230.80.210) - After Deployment
| File | Purpose |
|------|---------|
| `/etc/nginx/sites-available/videorooms` | Nginx SSL configuration |
| `/etc/nginx/sites-enabled/videorooms` | Nginx site symlink |
| `/etc/letsencrypt/live/videorooms.pnptv.app/` | SSL certificates |
| `/var/log/nginx/videorooms-*` | Nginx logs |

---

## 🔍 Configuration Details

### Reverse Proxy (Main Server)
```nginx
location /videorooms-api {
    proxy_pass https://videorooms.pnptv.app/pnptvvideorooms;
    # WebSocket support, CORS headers, etc. configured
}
```

### CSP Header (Main Server)
```
frame-src 'self' https://videorooms.pnptv.app;
```

### SSL Certificate (Video Rooms Server)
- Domain: `videorooms.pnptv.app`
- Provider: Let's Encrypt
- Auto-renewal: Enabled (daily checks)

---

## ✅ Success Criteria

All of these should be true after setup:

1. ✅ DNS resolves: `dig videorooms.pnptv.app +short` → `148.230.80.210`
2. ✅ HTTPS accessible: `curl -I https://videorooms.pnptv.app/` → 200
3. ✅ SSL valid: No browser security warnings
4. ✅ Reverse proxy works: `curl -I https://pnptv.app/videorooms-api/` → 200
5. ✅ Iframe loads: https://pnptv.app/video-rooms works without errors
6. ✅ No CSP violations: Browser console is clean
7. ✅ CORS headers present: Proper Access-Control-Allow-Origin header

---

## 🛠️ Troubleshooting

### DNS Not Resolving
```bash
# Check DNS
dig videorooms.pnptv.app +short

# Use public DNS
dig @8.8.8.8 videorooms.pnptv.app +short

# Wait and retry (may take 5-30 minutes)
```

### SSL Certificate Issues
```bash
# On video rooms server
sudo certbot certificates

# Check certificate
openssl s_client -connect videorooms.pnptv.app:443
```

### Nginx Problems
```bash
# Test configuration
sudo nginx -t

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

### Iframe Not Loading
```bash
# Check console (F12)
# Look for CSP violations
# Check reverse proxy: curl -I https://pnptv.app/videorooms-api/
```

---

## 🔄 Rollback (If Needed)

To revert to previous state:

```bash
# On main server
nano /root/pnptvbot-production/nginx/pnptv-app.conf
# Remove lines 114-151 (videorooms-api proxy)
# Optionally change CSP header back

sudo nginx -t
sudo systemctl reload nginx

# On video rooms server
sudo rm /etc/nginx/sites-enabled/videorooms
sudo systemctl reload nginx
```

---

## 📞 Support Files

For more detailed information, refer to:

1. **VIDEOROOMS_SSL_DEPLOYMENT.md** - Full step-by-step with all options
2. **scripts/deploy-videorooms-ssl.sh** - Automated deployment script
3. **scripts/verify-videorooms-setup.sh** - Verification script
4. **docs/VIDEO_ROOMS_SSL_SETUP.md** - Original setup options

---

## 🎓 Architecture Overview

```
User Browser
    ↓
https://pnptv.app/video-rooms
    ↓
Main Server (72.60.29.80)
    ├─ Serves HTML: public/video-rooms.html
    ├─ Reverse Proxy: /videorooms-api → videorooms.pnptv.app
    └─ CSP Header: frame-src 'self' https://videorooms.pnptv.app
    ↓
Video Rooms Server (148.230.80.210)
    ├─ Domain: videorooms.pnptv.app
    ├─ SSL: Let's Encrypt certificate
    ├─ Nginx: SSL termination + CORS headers
    └─ App: Jitsi Meet on localhost:8080
    ↓
HTTPS Response
    ↓
Browser Displays Iframe (No warnings!)
```

---

## 📊 Key Features

✅ **HTTPS Everywhere** - All connections encrypted
✅ **Valid SSL Certificate** - Let's Encrypt, trusted by all browsers
✅ **Auto-Renewal** - No manual intervention needed
✅ **CORS Configured** - Proper iframe embedding support
✅ **Security Headers** - HSTS, X-Frame-Options, etc.
✅ **No IP-Based URLs** - No more browser warnings
✅ **Reverse Proxy** - Hides internal IP address
✅ **Automatic Fallback** - Already configured reverse proxy

---

## ⏱️ Timeline

| Task | Time | Status |
|------|------|--------|
| Main server config | ✓ 30 min | Complete |
| DNS addition | 5-30 min | Pending |
| SSL deployment | 5-10 min | Pending |
| Verification | 2-5 min | Pending |
| Testing | 10 min | Pending |
| **Total** | **30-60 min** | **Ready** |

---

## 🎯 Next Steps

1. Read `VIDEOROOMS_SSL_DEPLOYMENT.md` for detailed instructions
2. Add DNS record in Hostinger (Task 1)
3. Copy and run `scripts/deploy-videorooms-ssl.sh` (Task 2)
4. Run `scripts/verify-videorooms-setup.sh` (Task 3)
5. Test with curl commands (Task 4)
6. Test in browser (Task 5)

---

## ✨ Benefits After Setup

- ✅ No browser security warnings
- ✅ Proper HTTPS certificates
- ✅ Automatic certificate renewal
- ✅ Better SEO (HTTPS is preferred)
- ✅ More secure for users
- ✅ Professional domain-based setup
- ✅ Reduced attack surface (no IP exposure)

---

**Implementation Date**: December 23, 2025
**Status**: ✅ READY FOR DEPLOYMENT
**Estimated Setup Time**: 30-60 minutes
**Difficulty**: Low (mostly automated)

---

For questions or issues, see the troubleshooting section in `VIDEOROOMS_SSL_DEPLOYMENT.md`.
