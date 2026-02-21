# 🔐 Production Permissions Configuration

**Last Updated:** February 21, 2026
**Critical for:** Nginx reverse proxy + Express.js application

## Required Permissions

### 1. Root Home Directory
**Issue:** Nginx (running as www-data) cannot traverse `/root` to reach `/root/pnptvbot-production/public`

```bash
# FIX: Allow group and others to execute (traverse) /root
sudo chmod o+x /root
sudo chmod g+x /root

# Verify
ls -ld /root
# Expected: drwx--x--x (755 for others/group execute bit)
```

**Why:** Nginx worker processes (www-data user) need execute permission on parent directories to access nested file paths. Without this, Nginx returns "Permission denied" errors.

### 2. Public Web Root
**Issue:** Nginx cannot read files from `/root/pnptvbot-production/public`

```bash
# FIX: Set proper ownership and permissions
sudo chmod -R 755 /root/pnptvbot-production/public
sudo chown -R www-data:www-data /root/pnptvbot-production/public

# Verify
ls -ld /root/pnptvbot-production/public
# Expected: drwxr-xr-x www-data www-data

ls -ld /root/pnptvbot-production/public/auth/
# Expected: drwxr-xr-x www-data www-data
```

**Why:**
- Files must be readable by www-data (Nginx user)
- Directories need execute permission for Nginx to traverse them
- Ownership ensures www-data can serve static assets

### 3. Nginx Configuration
**File:** `/etc/nginx/sites-available/pnptv-production`

```nginx
# Auth routes use 'alias' which requires proper permissions
location /auth/ {
    alias /root/pnptvbot-production/public/auth/;
    try_files $uri /index.html;
}

# Static assets with caching
location ~* \.(js|css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$ {
    root /root/pnptvbot-production/public;
    expires 365d;
    add_header Cache-Control "public, immutable";
}
```

## Deployment Checklist

After deploying to production, run:

```bash
# 1. Fix traversal permissions
sudo chmod o+x /root && sudo chmod g+x /root

# 2. Fix public folder ownership and permissions
sudo chmod -R 755 /root/pnptvbot-production/public
sudo chown -R www-data:www-data /root/pnptvbot-production/public

# 3. Reload Nginx to apply changes
sudo systemctl reload nginx

# 4. Verify permissions
ls -ld /root
ls -ld /root/pnptvbot-production/public
ls -ld /root/pnptvbot-production/public/auth

# 5. Test routes
curl -sI https://pnptv.app/auth/ | head -1  # Should be HTTP/2 200
curl -sI https://pnptv.app/hub/  | head -1  # Should be HTTP/2 302 (redirect to auth)
```

## Error Indicators

If these permissions are not set, you'll see:

```
[crit] stat() "/root/pnptvbot-production/public/auth/" failed (13: Permission denied)
[error] rewrite or internal redirection cycle while internally redirecting to "/index.html"
```

In Nginx error log: `/var/log/nginx/pnptv-error.log`

## Critical Routes Affected

These routes require proper permissions to function:

| Route | Type | Requires |
|-------|------|----------|
| `/auth/` | Public SPA | Read access to /public/auth/ |
| `/` | Public SPA | Read access to /public/ |
| `/hub/` | Protected SPA | Read access to /public/hub/ (after auth) |
| `/media/*` | Protected SPA | Read access to /public/media/ (after auth) |
| `/hangouts/` | Protected SPA | Read access to /public/hangouts/ (after auth) |
| `/health` | Public API | No file system access |

## Automation

Add to deployment scripts:

```bash
#!/bin/bash
# Fix production permissions
echo "Fixing Nginx permissions..."
sudo chmod o+x /root && sudo chmod g+x /root
sudo chmod -R 755 /root/pnptvbot-production/public
sudo chown -R www-data:www-data /root/pnptvbot-production/public
sudo systemctl reload nginx
echo "✓ Permissions fixed"
```

## Related Documentation

- `/etc/nginx/sites-available/pnptv-production` - Nginx configuration
- `DEPLOY.sh` - Deployment automation script
- `NGINX_SETUP_WITH_SSL.md` - SSL/Nginx setup guide

---

**Note:** These permissions are system-level configurations and must be applied after each deployment to ensure Nginx can serve static files properly.
