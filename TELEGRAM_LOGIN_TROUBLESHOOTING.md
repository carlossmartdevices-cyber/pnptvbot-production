# Telegram Login Troubleshooting Guide

## Problem
Users see error: **"La autenticación falló. Por favor intenta de nuevo"** (Authentication failed) when clicking "Continuar con Telegram"

## Root Cause
The Telegram OAuth flow requires that the bot's domain is registered with BotFather. Without this, Telegram will not provide a valid hash to verify, causing hash verification to always fail.

## Solution: Set Domain in BotFather

### Steps

1. **Open BotFather**
   - Message `@BotFather` in Telegram
   - If you haven't done this before, find @BotFather in the app or search for it

2. **Select Your Bot**
   - Reply with `/start` to see the list of your bots
   - Select **PNPLatinoTV_Bot** (or your bot's username)

3. **Set Domain**
   - Type `/setdomain`
   - Follow the prompts to select your bot
   - Enter the domain: **pnptv.app** (without https://)
   - Confirm the change

4. **Verify the Domain**
   - Wait 30 seconds for the change to propagate
   - Try the login flow again

### Visual Steps (Text Format)

```
You → @BotFather
BotFather → [list of bots]

You → /setdomain
BotFather → Which bot?
You → PNPLatinoTV_Bot
BotFather → Enter domain name
You → pnptv.app
BotFather → ✓ Domain set successfully
```

## Verification

### Check if Domain is Properly Configured

Run the diagnostic script:
```bash
node /root/pnptvbot-production/scripts/check-telegram-oauth-config.js
```

This will show:
- Your bot information
- Required BotFather configuration steps
- Test results for hash verification

### Quick Manual Test

1. Go to: `https://pnptv.app/login`
2. Click "Continuar con Telegram" button
3. You should be redirected to Telegram OAuth page
4. After authentication, you should be redirected back and logged in

## How It Works

### Telegram OAuth Flow

```
User clicks "Continuar con Telegram"
    ↓
Redirects to: https://oauth.telegram.org/auth
    - Includes: bot_id, origin (domain), callback URL
    ↓
Telegram verifies domain matches registered domain in BotFather
    ↓
User authenticates with Telegram
    ↓
Telegram redirects back with user data + hash
    ↓
Server verifies hash using SHA256(BOT_TOKEN)
    ↓
Hash matches → User created/logged in
Hash doesn't match → Error (domain not registered)
```

### Why Hash Verification Matters

The hash proves that:
1. The data came from Telegram (not a malicious actor)
2. The user actually authenticated
3. The domain is authorized

**The hash will ONLY be valid if:**
- The domain is registered in BotFather
- The request comes from the registered domain
- The hash is calculated using the correct BOT_TOKEN

## Symptoms

| Symptom | Cause | Solution |
|---------|-------|----------|
| Always get "auth_failed" | Domain not set in BotFather | Run BotFather /setdomain |
| OAuth page loads but redirects to error | Domain mismatch | Verify domain in BotFather matches pnptv.app |
| Works sometimes, fails other times | Cache issues | Clear browser cache, try incognito |
| Works locally, fails on production | HTTPS certificate issue | Verify SSL cert is valid |

## Technical Details

### Environment Variables
- `BOT_TOKEN`: `8571930103:AAHIxAeI2CEqgF3arK4D4dZNHFYxgNa_nt0`
- `BOT_USERNAME`: `PNPLatinoTV_Bot`
- `BOT_WEBHOOK_DOMAIN`: `https://pnptv.app`

### Code Location
- Auth controller: `/root/pnptvbot-production/src/bot/api/controllers/webAppController.js`
- Callback endpoint: `GET /api/webapp/auth/telegram/callback`
- Hash verification function: `verifyTelegramAuth(data)` (lines 77-132)

### Hash Verification Algorithm

```javascript
1. Receive all query params from Telegram (id, first_name, auth_date, hash, etc.)
2. Extract hash, sort other params alphabetically
3. Build check string: "id=123\nfirst_name=John\n..."
4. Create secret key: SHA256(BOT_TOKEN)
5. Calculate HMAC: HMAC-SHA256(secret_key, check_string)
6. Compare: calculated_hash === received_hash
7. Also verify auth_date is within 24 hours
```

## Debugging

### Enable Debug Logging

To see detailed logs when authentication fails:

```bash
tail -f /root/pnptvbot-production/logs/combined-2026-02-19.log | grep -E "TELEGRAM|Hash|verification"
```

Look for entries like:
```
=== TELEGRAM CALLBACK RECEIVED ===
  hasId: true
  hasHash: true
  ...

Telegram auth verification debug:
  botToken: 8571930103:***
  dataKeys: ["auth_date", "first_name", "id", ...]
  ...

Hash comparison:
  calculated: 1a2b3c4d...
  received: 1a2b3c4d...
  match: true
```

### Force Test (Development Only)

If you need to test without proper domain setup:

```bash
# Set in .env.development only:
SKIP_TELEGRAM_HASH_VERIFICATION=true
```

**WARNING:** Never set this in production. It's a security bypass.

## Additional Resources

- [Telegram Bot OAuth Documentation](https://core.telegram.org/widgets/login)
- [BotFather Commands Reference](https://t.me/botfather/help)
- [pnptv.app Login Page](https://pnptv.app/login)

## Still Having Issues?

If the domain is properly set and it still doesn't work:

1. **Clear your browser cache** - Sometimes cached errors persist
2. **Try incognito/private window** - Avoids cache issues
3. **Wait 5 minutes** - BotFather changes can take time to propagate
4. **Check HTTPS works** - Run: `curl -I https://pnptv.app`
5. **Verify domain resolves** - Run: `nslookup pnptv.app`
6. **Check server time** - If server time is >24h off, auth_date check fails

Contact support if the issue persists after trying these steps.
