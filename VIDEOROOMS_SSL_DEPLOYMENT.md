# Video Rooms SSL Deployment Guide

**Status**: Ready for Deployment
**Date**: December 23, 2025
**Target**: Convert from IP-based to domain-based HTTPS

---

## Overview

This guide provides step-by-step instructions to deploy the Video Rooms SSL upgrade from IP-based (`https://148.230.80.210`) to domain-based (`https://videorooms.pnptv.app`) with proper SSL certificates.

**Main Server**: 72.60.29.80 (pnptv.app)
**Video Rooms Server**: 148.230.80.210 (will use videorooms.pnptv.app)
**Note**: The legacy `public/video-rooms.html` page has been removed; `/video-rooms` and `/videorama` now redirect to `/videorama-app/`.

---

## ✅ Completed Tasks

The following steps have already been automated and completed on the main server:

### 1. ✅ Updated iframe URL Configuration
- **Legacy File**: `public/video-rooms.html` (removed)
- **Current Page**: `public/videorama-app/` (served at `/videorama-app/`)
- **Action**: If you still use an iframe-based video rooms page elsewhere, update its URL to use the reverse proxy / domain.

### 2. ✅ Updated CSP Security Headers
- **File**: `nginx/pnptv-app.conf` (Line 63)
- **Change**: `frame-src 'self' https://videorooms.pnptv.app;`
- **Status**: ✓ Applied and tested

### 3. ✅ Added Reverse Proxy Configuration
- **File**: `nginx/pnptv-app.conf` (Lines 114-151)
- **Purpose**: Proxy `/videorooms-api` from main server to video rooms server
- **Status**: ✓ Configured and nginx reloaded

### 4. ✅ Nginx Reload
- **Status**: ✓ Configuration tested and reloaded successfully

---

## 📋 Remaining Tasks

### Task 1: Add DNS Record (Manual - 5-30 min wait)

**Location**: Hostinger Control Panel

1. Log in to: https://hpanel.hostinger.com
2. Go to: **Domains** → **pnptv.app** → **DNS Zone**
3. Click: **Add Record**
4. Fill in:
   - **Type**: A
   - **Name**: videorooms
   - **Value**: 148.230.80.210
   - **TTL**: 3600
5. Click: **Save**

**Verify DNS Propagation** (wait 5-30 minutes):
```bash
dig videorooms.pnptv.app +short
# Expected: 148.230.80.210
```

**⚠️ Do not proceed to Task 2 until DNS resolves!**

---

### Task 2: Deploy SSL on Video Rooms Server

Once DNS is propagated, SSH into the video rooms server and run the automated deployment script.

#### Step 1: Copy Script to Video Rooms Server

From your local machine or main server:

```bash
# Option A: From main server (72.60.29.80)
scp /root/pnptvbot-production/scripts/deploy-videorooms-ssl.sh user@148.230.80.210:~/

# Option B: From local machine
scp deploy-videorooms-ssl.sh user@148.230.80.210:~/
```

#### Step 2: SSH into Video Rooms Server

```bash
ssh user@148.230.80.210
# Or: ssh username@148.230.80.210 -p 22
```

#### Step 3: Run Deployment Script

```bash
# Make executable (if needed)
chmod +x ~/deploy-videorooms-ssl.sh

# Run with sudo
sudo ~/deploy-videorooms-ssl.sh videorooms.pnptv.app admin@pnptv.app
```

**Expected Output**:
```
[INFO] ================================================
[INFO] Video Rooms SSL Setup Automation
[INFO] ================================================
[INFO] Subdomain: videorooms.pnptv.app
[INFO] Email: admin@pnptv.app

[INFO] Step 1: Verifying DNS resolution...
[SUCCESS] DNS verified: videorooms.pnptv.app -> 148.230.80.210

[INFO] Step 2: Installing dependencies...
[SUCCESS] Dependencies installed

[INFO] Step 3: Creating necessary directories...
[SUCCESS] Directories created

[INFO] Step 4: Requesting SSL certificate from Let's Encrypt...
[SUCCESS] SSL certificate obtained!

[INFO] Step 5: Creating Nginx configuration...
[SUCCESS] Nginx configuration created

[INFO] Step 6: Enabling Nginx configuration...
[SUCCESS] Nginx configuration is valid

[SUCCESS] Nginx reloaded successfully

[INFO] Step 7: Setting up certificate auto-renewal...
[SUCCESS] Auto-renewal configured

[INFO] Step 8: Verifying setup...
[SUCCESS] SSL Setup Complete!
```

**What the script does**:
- ✅ Verifies DNS is set correctly
- ✅ Installs Certbot and Nginx
- ✅ Requests SSL certificate from Let's Encrypt
- ✅ Configures Nginx with SSL
- ✅ Sets up automatic certificate renewal
- ✅ Enables CORS headers for iframe embedding
- ✅ Configures security headers

---

### Task 3: Verify Deployment

Still on the video rooms server, run the verification script:

```bash
# Copy verification script if not already there
scp /root/pnptvbot-production/scripts/verify-videorooms-setup.sh user@148.230.80.210:~/

# Run verification
chmod +x ~/verify-videorooms-setup.sh
./verify-videorooms-setup.sh videorooms.pnptv.app
```

**Expected Output**:
```
[INFO] ================================================
[INFO] Video Rooms Setup Verification
[INFO] ================================================

[✓] DNS resolves to 148.230.80.210
[✓] SSL certificate exists
[✓] Certificate issued by Let's Encrypt
[✓] Nginx configuration is valid
[✓] Nginx is running
[✓] Port 443 (HTTPS) is listening
[✓] Port 80 (HTTP) is listening
[✓] HTTPS endpoint is reachable
[✓] CORS headers present
[✓] Certificate chain is valid
```

---

### Task 4: Test from Main Server

Back on the main server (or your local machine):

#### Test 1: DNS Resolution
```bash
dig videorooms.pnptv.app +short
# Expected: 148.230.80.210
```

#### Test 2: SSL Certificate
```bash
curl -I https://videorooms.pnptv.app/pnptvvideorooms
# Expected: HTTP 200/301 with no SSL warnings
```

#### Test 3: CORS Headers
```bash
curl -I https://videorooms.pnptv.app/pnptvvideorooms | grep -i Access-Control

# Expected:
# Access-Control-Allow-Origin: https://pnptv.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

#### Test 4: Reverse Proxy (Main Server)
```bash
curl -I https://pnptv.app/videorooms-api/external_api.js
# Expected: HTTP 200
```

---

### Task 5: Test Video Rooms in Browser

1. Open browser and go to: https://pnptv.app/video-rooms
2. Open Developer Console (F12)
3. Check for:
   - ✅ No security warnings
   - ✅ No mixed content errors
   - ✅ No CSP violations
   - ✅ Iframe loads successfully
   - ✅ Video room initializes

**Troubleshoot if issues**:
- Clear browser cache: Ctrl+Shift+Delete
- Check console for specific errors (F12)
- Verify all tasks completed in order

---

## 📊 Configuration Summary

### DNS Record
```
Type: A
Name: videorooms
Value: 148.230.80.210
TTL: 3600
```

### SSL Certificate
- **Provider**: Let's Encrypt
- **Domain**: videorooms.pnptv.app
- **Auto-renewal**: Enabled (daily checks)
- **Location**: `/etc/letsencrypt/live/videorooms.pnptv.app/`

### Main Server Changes
| File | Change | Status |
|------|--------|--------|
| `public/videorama-app/` | Videorama React app (legacy `public/video-rooms.html` removed) | ✓ Ready |
| `nginx/pnptv-app.conf` line 63 | CSP: `frame-src 'self' https://videorooms.pnptv.app;` | ✓ Applied |
| `nginx/pnptv-app.conf` lines 114-151 | Added `/videorooms-api` reverse proxy | ✓ Applied |

### Video Rooms Server Changes
| Component | Configuration |
|-----------|---|
| SSL Cert | `/etc/letsencrypt/live/videorooms.pnptv.app/` |
| Nginx Config | `/etc/nginx/sites-available/videorooms` |
| Nginx Enabled | `/etc/nginx/sites-enabled/videorooms` |
| Auto-renewal | Cron: `0 0,12 * * * certbot renew` |
| Proxy Target | `http://localhost:8080/pnptvvideorooms` |

---

## 🔒 Security Features

✅ **HTTPS Only** - All traffic encrypted with Let's Encrypt certificates
✅ **Auto-Renewal** - Certificates automatically renewed before expiry
✅ **HSTS Headers** - Prevents downgrade attacks
✅ **CORS Configured** - Proper cross-origin headers for iframe embedding
✅ **Security Headers** - X-Frame-Options, X-Content-Type-Options, etc.
✅ **No Browser Warnings** - Proper domain-based SSL (no IP-based warnings)

---

## ⚠️ Troubleshooting

### DNS Not Resolving

**Symptoms**:
```
dig videorooms.pnptv.app +short
# Returns nothing or different IP
```

**Solutions**:
1. Wait 5-30 minutes for DNS propagation
2. Clear DNS cache: `sudo systemctl restart systemd-resolved`
3. Verify DNS record in Hostinger (correct IP: 148.230.80.210)
4. Check with public DNS: `dig @8.8.8.8 videorooms.pnptv.app +short`

### SSL Certificate Request Fails

**Symptoms**:
```
[ERROR] Failed to obtain SSL certificate
```

**Solutions**:
1. Verify DNS is working: `dig videorooms.pnptv.app +short`
2. Check port 80 is open: `sudo ufw allow 80/tcp`
3. Test ACME challenge: `curl -I http://videorooms.pnptv.app/.well-known/acme-challenge/test`
4. Check firewall is not blocking: `sudo ufw status`

### Nginx Won't Reload

**Symptoms**:
```
systemctl status nginx
# Shows error
```

**Solutions**:
1. Test configuration: `sudo nginx -t`
2. Check error log: `sudo tail -f /var/log/nginx/error.log`
3. Fix any syntax errors in config file
4. Retry reload: `sudo systemctl reload nginx`

### Video Rooms Iframe Still Shows Warnings

**Symptoms**:
- Security warnings in browser console
- Mixed content errors

**Solutions**:
1. Verify CSP header: `curl -I https://pnptv.app/video-rooms | grep -i csp`
2. Verify iframe src: Check browser console for actual iframe source
3. Clear browser cache: Ctrl+Shift+Delete
4. Check reverse proxy is working: `curl -I https://pnptv.app/videorooms-api/external_api.js`

### Video Rooms App Not Responding

**Symptoms**:
- HTTP 502/503 errors
- Connection refused

**Solutions**:
1. Verify app is running on video rooms server
2. Check running port (currently `localhost:8080`)
3. Update Nginx config if using different port: `nano /etc/nginx/sites-available/videorooms`
4. Reload Nginx after changes: `sudo systemctl reload nginx`

---

## 📝 Post-Deployment Checklist

- [ ] DNS record added in Hostinger
- [ ] DNS propagation verified: `dig videorooms.pnptv.app +short`
- [ ] Deployment script run on video rooms server
- [ ] Verification script passed all tests
- [ ] HTTPS connectivity confirmed: `curl -I https://videorooms.pnptv.app/pnptvvideorooms`
- [ ] Browser test passed: https://pnptv.app/video-rooms
- [ ] No console errors in browser (F12)
- [ ] Certificate auto-renewal verified
- [ ] Reverse proxy working: `curl -I https://pnptv.app/videorooms-api/external_api.js`

---

## 🔄 Rollback Plan

If anything goes wrong and you need to revert:

### On Main Server
```bash
# Revert CSP header (temporary, if needed)
nano /root/pnptvbot-production/nginx/pnptv-app.conf

# Remove the /videorooms-api proxy block (lines 114-151) if needed
# Keep iframe URL as-is (it already uses the proxy)

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### On Video Rooms Server
```bash
# Disable Nginx site
sudo rm /etc/nginx/sites-enabled/videorooms
sudo systemctl reload nginx

# Certificate is still valid, can be re-enabled anytime
```

The system will automatically fall back to using the old IP address if the proxy is removed.

---

## 📞 Support Resources

**Let's Encrypt Docs**: https://letsencrypt.org/docs/
**Nginx Docs**: https://nginx.org/en/docs/
**Certbot Docs**: https://certbot.eff.org/docs/

---

## Timeline

**Phase 1**: Manual DNS setup (5-30 minutes)
**Phase 2**: SSL deployment (5-10 minutes)
**Phase 3**: Verification (2-5 minutes)
**Phase 4**: Testing (5 minutes)

**Total Time**: ~30-50 minutes

---

## Files Reference

### Main Server Scripts
- `scripts/deploy-videorooms-ssl.sh` - Automated deployment (run on video rooms server)
- `scripts/verify-videorooms-setup.sh` - Verification script (run on video rooms server)

### Configuration Files
- `nginx/pnptv-app.conf` - Main server reverse proxy and CSP configuration
- `public/videorama-app/` - Videorama React app (replaces legacy video-rooms.html)

### Documentation
- `docs/VIDEO_ROOMS_SSL_SETUP.md` - Original setup guide
- `VIDEOROOMS_SSL_DEPLOYMENT.md` - This file

---

## Next Steps

1. **Add DNS record** in Hostinger (Task 1)
2. **Deploy SSL** using `deploy-videorooms-ssl.sh` (Task 2)
3. **Verify setup** using `verify-videorooms-setup.sh` (Task 3)
4. **Test from main server** with curl commands (Task 4)
5. **Test in browser** at https://pnptv.app/video-rooms (Task 5)

---

**Ready to begin? Start with Task 1: Add DNS Record**

Last Updated: December 23, 2025
Status: Ready for Deployment ✓
