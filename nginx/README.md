# Nginx Configuration for PNPtv Telegram Bot

## Overview

This directory contains the optimized Nginx configuration for proxying requests to the PNPtv Telegram Bot, with special handling for Telegram webhooks.

## Installation

### 1. Copy Configuration

```bash
sudo cp nginx/pnptv-bot.conf /etc/nginx/sites-available/pnptv-bot.conf
```

### 2. Update Configuration

Edit the configuration file and replace placeholder values:
- `easybots.store` - Replace with your actual domain
- SSL certificate paths - Update to match your Let's Encrypt setup

```bash
sudo nano /etc/nginx/sites-available/pnptv-bot.conf
```

### 3. Test Configuration

```bash
sudo nginx -t
```

### 4. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/pnptv-bot.conf /etc/nginx/sites-enabled/
```

### 5. Reload Nginx

```bash
sudo systemctl reload nginx
```

## SSL Certificate Setup (Let's Encrypt)

### Install Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d easybots.store -d www.easybots.store
```

### Auto-renewal

Certbot automatically sets up a cron job for renewal. Verify it:

```bash
sudo systemctl status certbot.timer
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

## Key Features

### 1. **Telegram Webhook Handling**
- Dedicated `/webhook/telegram` endpoint
- POST-only access
- Request body preservation (critical for webhook processing)
- No buffering to prevent body consumption issues
- Separate logging for debugging

### 2. **Payment Webhook Handling**
- Rate limiting (50 requests/minute per IP)
- Body preservation for signature verification
- Located at `/api/webhooks/*`

### 3. **Security**
- HTTPS enforced (HTTP→HTTPS redirect)
- Modern TLS 1.2/1.3 only
- HSTS enabled
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Rate limiting on API and webhook endpoints
- Hidden file access denied

### 4. **Performance**
- HTTP/2 enabled
- Session caching
- Appropriate timeouts
- Health check logging disabled

### 5. **Monitoring**
- Separate access logs for different endpoints
- Detailed error logging
- Telegram webhook has dedicated log file

## Troubleshooting

### Webhook Returns 404

1. **Check Nginx is running:**
```bash
sudo systemctl status nginx
```

2. **Check Nginx logs:**
```bash
sudo tail -f /var/log/nginx/pnptv-bot-error.log
sudo tail -f /var/log/nginx/telegram-webhook.log
```

3. **Test webhook endpoint:**
```bash
curl -X POST https://pnptv.app/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

4. **Verify bot container is running:**
```bash
docker-compose ps
curl http://localhost:3000/health
```

### Webhook Returns 502 Bad Gateway

The bot container is not responding:

1. **Check bot container status:**
```bash
docker-compose logs bot
docker-compose ps
```

2. **Verify bot is listening on port 3000:**
```bash
curl http://localhost:3000/health
```

3. **Restart bot container:**
```bash
docker-compose restart bot
```

### SSL Certificate Issues

1. **Check certificate validity:**
```bash
sudo certbot certificates
```

2. **Renew certificate manually:**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

3. **Test SSL configuration:**
```bash
sudo nginx -t
openssl s_client -connect pnptv.app:443
```

### Rate Limiting Triggered

If legitimate traffic is being rate-limited:

1. **Adjust rate limits in config:**
```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=100r/m;  # Increase from 50r/m
```

2. **Reload Nginx:**
```bash
sudo systemctl reload nginx
```

## Monitoring

### View Access Logs

```bash
# All access logs
sudo tail -f /var/log/nginx/pnptv-bot-access.log

# Telegram webhook logs only
sudo tail -f /var/log/nginx/telegram-webhook.log
```

### View Error Logs

```bash
sudo tail -f /var/log/nginx/pnptv-bot-error.log
```

### Monitor Real-time Traffic

```bash
# Using GoAccess (install first: sudo apt install goaccess)
sudo goaccess /var/log/nginx/pnptv-bot-access.log -o /var/www/html/report.html --log-format=COMBINED --real-time-html
```

## Testing Checklist

After deploying the configuration:

- [ ] HTTP redirects to HTTPS: `curl -I http://pnptv.app`
- [ ] HTTPS works: `curl -I https://pnptv.app/health`
- [ ] Health endpoint returns 200: `curl https://pnptv.app/health`
- [ ] Webhook endpoint accepts POST: `curl -X POST https://pnptv.app/webhook/telegram -H "Content-Type: application/json" -d '{"test":true}'`
- [ ] Telegram bot receives webhooks: Send message to bot
- [ ] SSL certificate valid: `openssl s_client -connect pnptv.app:443`
- [ ] Security headers present: `curl -I https://pnptv.app`
- [ ] Rate limiting works: Send 60+ requests to webhook endpoint

## Performance Tuning

### For High Traffic

If expecting high traffic (>1000 requests/min):

1. **Increase worker connections:**
```nginx
# In nginx.conf
events {
    worker_connections 4096;
}
```

2. **Increase rate limits:**
```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=200r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=500r/m;
```

3. **Enable caching for static content:**
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
```

## Security Hardening

### Additional Security Measures

1. **Restrict webhook access to Telegram IPs:**
```nginx
# Get latest Telegram IP ranges from: https://core.telegram.org/bots/webhooks#the-short-version
location /webhook/telegram {
    allow 149.154.160.0/20;
    allow 91.108.4.0/22;
    deny all;
    # ... rest of config
}
```

2. **Enable fail2ban:**
```bash
sudo apt install fail2ban
# Configure /etc/fail2ban/jail.local for nginx
```

3. **Enable ModSecurity WAF (optional):**
```bash
sudo apt install libnginx-mod-security
# Configure WAF rules
```

## Related Documentation

- [Main Deployment Guide](../docs/DEPLOYMENT.md)
- [Security Documentation](../docs/SECURITY.md)
- [Telegram Bot API - Webhooks](https://core.telegram.org/bots/webhooks)
- [Nginx Documentation](https://nginx.org/en/docs/)

## Support

For issues related to Nginx configuration:
1. Check logs: `/var/log/nginx/`
2. Test configuration: `sudo nginx -t`
3. Verify bot container: `docker-compose logs bot`
4. Review this README's troubleshooting section

Last Updated: 2025-11-15
