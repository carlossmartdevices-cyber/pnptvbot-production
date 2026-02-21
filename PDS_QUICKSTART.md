# PDS Provisioning - Quick Start Guide

Get PDS (Personal Data Server) provisioning running in 5 minutes.

## 1. Configure Environment (1 min)

```bash
# Copy template
cp .env.pds.example .env

# Generate encryption key
echo "PDS_ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)" >> .env

# Edit .env with your values
nano .env
```

**Minimal required variables:**
```bash
PDS_PROVISIONING_ENABLED=true
PDS_MODE=remote
PDS_DOMAIN=pnptv.app
PDS_ENCRYPTION_KEY=<generated-above>
SESSION_SECRET=<unique-secret>
```

## 2. Run Database Migration (1 min)

```bash
# Backup first
pg_dump -U postgres pnptv_db > backup_$(date +%s).sql

# Run migration
psql -U postgres -d pnptv_db -f apps/backend/migrations/064_user_pds_mapping.sql

# Verify
psql -U postgres -d pnptv_db -c "\dt user_pds_mapping pds_*"
```

## 3. Install & Deploy (2 min)

```bash
# Install dependency
npm install uuid

# Build
npm run build:prime-hub

# Stop and restart
pm2 stop pnptv-bot
npm start
```

## 4. Verify (1 min)

```bash
# Run test suite
bash scripts/test-pds-provisioning.sh

# Test manually
curl -b cookies.txt http://localhost:3001/api/pds/info | jq .
```

---

## Next: Full Documentation

- **Complete Guide**: [PDS_PROVISIONING_GUIDE.md](./PDS_PROVISIONING_GUIDE.md)
- **API Examples**: [PDS_API_EXAMPLES.md](./PDS_API_EXAMPLES.md)
- **Deployment**: [PDS_DEPLOYMENT_CHECKLIST.md](./PDS_DEPLOYMENT_CHECKLIST.md)

---

## Common Scenarios

### Scenario 1: Test with Remote PDS (Bluesky)

```bash
# .env
PDS_MODE=remote
PDS_REMOTE_PROVIDER=https://pds.bluesky.social
```

No local PDS needed. Users provision on Bluesky's infrastructure.

### Scenario 2: Run Local PDS

```bash
# Start PDS server
docker run -d -p 3000:3000 \
  -e ADMIN_DID="did:web:admin.pnptv.app" \
  -e ADMIN_PASSWORD="secure-password" \
  bluesky-social/pds:latest

# .env
PDS_MODE=local
PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000
PDS_ADMIN_DID=did:web:admin.pnptv.app
PDS_ADMIN_PASSWORD=secure-password
```

Full control. PDS runs locally on your infrastructure.

### Scenario 3: Hybrid Mode (Local + Fallback)

```bash
# .env
PDS_MODE=hybrid
PDS_LOCAL_ENDPOINT=http://127.0.0.1:3000
PDS_REMOTE_PROVIDER=https://pds.bluesky.social
```

Try local first, fallback to Bluesky if needed.

---

## Quick Checks

### Check if working

```bash
# Server running?
curl http://localhost:3001/health

# Database migrated?
psql -U postgres -d pnptv_db -c "SELECT 1 FROM user_pds_mapping LIMIT 1;"

# Routes registered?
grep "pdsRoutes" apps/backend/bot/api/routes.js

# User can login and get PDS info?
# (Login via Telegram, then:)
curl -b cookies.txt http://localhost:3001/api/pds/info | jq .
```

### Check logs

```bash
# Follow logs
pm2 logs pnptv-bot | grep PDS

# Find errors
pm2 logs pnptv-bot | grep ERROR

# Count successful provisions
psql -U postgres -d pnptv_db -c \
  "SELECT COUNT(*) FROM user_pds_mapping WHERE status = 'active';"
```

---

## Troubleshooting

### "Migration failed"
```bash
# Check if already applied
psql -U postgres -d pnptv_db -c "\dt user_pds_mapping"

# Check for errors
psql -U postgres -d pnptv_db -f apps/backend/migrations/064_user_pds_mapping.sql 2>&1 | head -20
```

### "Provisioning not happening"
```bash
# Check logs
pm2 logs pnptv-bot | grep -i "pds\|provision"

# Check if service is being called
grep "PDSProvisioningService" apps/backend/api/handlers/telegramAuthHandler.js

# Check if routes registered
grep "pdsRoutes" apps/backend/bot/api/routes.js
```

### "Health checks failing"
```bash
# Check if local PDS is running (if local mode)
docker ps | grep pds
curl -v http://127.0.0.1:3000/.well-known/atproto-did

# Check if remote PDS is accessible (if remote mode)
curl -v https://pds.bluesky.social/.well-known/atproto-did
```

---

## What Happens on Login

1. User logs in via Telegram
2. Session created with user data
3. **In background (async):**
   - PDS generated for user
   - Credentials encrypted and stored
   - Health check scheduled
4. Login completes immediately (non-blocking)
5. User sees "PDS Ready" in profile

---

## Admin Tasks

### Manually provision a user

```bash
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"userId": "telegram_id_here"}' \
  http://localhost:3001/api/pds/provision | jq .
```

### View user's PDS info

```bash
psql -U postgres -d pnptv_db -c \
  "SELECT pds_handle, pds_did, status, created_at FROM user_pds_mapping WHERE user_id = 'user_id';"
```

### Check health history

```bash
psql -U postgres -d pnptv_db -c \
  "SELECT check_type, status, response_time_ms FROM pds_health_checks ORDER BY created_at DESC LIMIT 10;"
```

---

## Frontend Integration

Add PDS sections to your UI:

```jsx
// View full PDS setup page
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PDSSetup from './pages/PDSSetup';

<Route path="/pds-setup" element={<PDSSetup />} />

// Show PDS status in profile
import DecentralizedIdentity from './components/DecentralizedIdentity';

<DecentralizedIdentity />

// Show compact indicator in header
import PDSStatus from './components/PDSStatus';

<PDSStatus compact={true} />
```

---

## Environment Checklist

- [ ] `PDS_PROVISIONING_ENABLED=true`
- [ ] `PDS_MODE` set (local/remote/hybrid)
- [ ] `PDS_DOMAIN` set
- [ ] `PDS_ENCRYPTION_KEY` generated (32 bytes)
- [ ] `SESSION_SECRET` set (unique)
- [ ] If local: `PDS_LOCAL_ENDPOINT`, `PDS_ADMIN_DID`, `PDS_ADMIN_PASSWORD`
- [ ] If remote: `PDS_REMOTE_PROVIDER` (optional)

---

## File Locations

**Backend:**
```
apps/backend/bot/services/PDSProvisioningService.js
apps/backend/bot/api/controllers/pdsController.js
apps/backend/bot/api/routes/pdsRoutes.js
apps/backend/migrations/064_user_pds_mapping.sql
```

**Frontend:**
```
webapps/prime-hub/src/pages/PDSSetup.jsx
webapps/prime-hub/src/components/PDSStatus.jsx
webapps/prime-hub/src/components/DecentralizedIdentity.jsx
webapps/prime-hub/src/api/pdsClient.js
```

**Scripts:**
```
scripts/setup-pds-provisioning.sh
scripts/test-pds-provisioning.sh
```

**Docs:**
```
PDS_PROVISIONING_GUIDE.md       (comprehensive)
PDS_API_EXAMPLES.md             (endpoint examples)
PDS_DEPLOYMENT_CHECKLIST.md     (deployment steps)
PDS_IMPLEMENTATION_SUMMARY.md   (what was built)
.env.pds.example                (configuration template)
```

---

## Next Steps

1. ✅ Run quick start above
2. 📖 Read [PDS_PROVISIONING_GUIDE.md](./PDS_PROVISIONING_GUIDE.md) for details
3. 🧪 Run `bash scripts/test-pds-provisioning.sh` to verify
4. 🚀 Deploy with [PDS_DEPLOYMENT_CHECKLIST.md](./PDS_DEPLOYMENT_CHECKLIST.md)
5. 📊 Monitor via dashboard or CLI queries

---

## Support

**Logs:**
```bash
pm2 logs pnptv-bot | grep PDS
```

**Database Debug:**
```bash
# View all users with PDS
psql -U postgres -d pnptv_db -c \
  "SELECT user_id, pds_handle, status FROM user_pds_mapping;"

# View recent actions
psql -U postgres -d pnptv_db -c \
  "SELECT user_id, action, status FROM pds_provisioning_log ORDER BY created_at DESC LIMIT 20;"
```

**Tests:**
```bash
bash scripts/test-pds-provisioning.sh
```

---

**Ready? Start with Step 1 above!**
