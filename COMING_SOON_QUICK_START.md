# Coming Soon Pages - Quick Start Guide

## 60-Second Setup

```bash
# 1. Run database migration
PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d pnptv_db -f database/migrations/063_coming_soon_waitlist.sql

# 2. Edit routes.js and App.jsx (see below)

# 3. Build & restart
cd webapps/prime-hub && npm run build
pm2 restart pnptv-bot
```

## Code Changes Required

### 1. Add to `/src/bot/api/routes.js` (line ~45)
```javascript
app.use('/api/coming-soon', require('./routes/comingSoonRoutes'));
```

### 2. Add to `/webapps/prime-hub/src/App.jsx` (line ~22)
```javascript
import ComingSoonLive from './pages/ComingSoonLive';
import ComingSoonHangouts from './pages/ComingSoonHangouts';
```

### 3. Add to `/webapps/prime-hub/src/App.jsx` (line ~77)
```javascript
<Route path="/live/coming-soon" element={<ProtectedRoute><ComingSoonLive /></ProtectedRoute>} />
<Route path="/hangouts/coming-soon" element={<ProtectedRoute><ComingSoonHangouts /></ProtectedRoute>} />
```

### 4. Import CSS (top of App.jsx or main file)
```javascript
import './styles/coming-soon.css';
```

## Verify Installation

```bash
# Check database tables exist
psql -U postgres -d pnptv_db -c "SELECT * FROM coming_soon_waitlist LIMIT 1;"

# Test signup API
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","feature":"live"}'

# Check pages load
# Open browser to: http://localhost:3001/prime-hub/live/coming-soon
```

## Files Created

```
✓ webapps/prime-hub/src/pages/ComingSoonLive.jsx
✓ webapps/prime-hub/src/pages/ComingSoonHangouts.jsx
✓ webapps/prime-hub/src/styles/coming-soon.css
✓ webapps/prime-hub/src/api/comingSoonClient.js
✓ src/bot/services/ComingSoonService.js
✓ src/bot/api/controllers/comingSoonController.js
✓ src/bot/api/routes/comingSoonRoutes.js
✓ database/migrations/063_coming_soon_waitlist.sql
✓ scripts/setup-coming-soon.sh
```

## Page URLs

- Live: `/prime-hub/live/coming-soon`
- Hangouts: `/prime-hub/hangouts/coming-soon`

## API Quick Reference

### Signup (Public)
```bash
POST /api/coming-soon/waitlist
{"email":"user@example.com","feature":"live"}
```

### Count (Public)
```bash
GET /api/coming-soon/count/live
```

### Stats (Admin)
```bash
GET /api/coming-soon/stats/live
# Header: Authorization: Bearer $TOKEN
```

### Export (Admin)
```bash
GET /api/coming-soon/export/live
# Header: Authorization: Bearer $TOKEN
# Returns CSV file
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Routes not found | Check routes.js import added |
| Pages not loading | Check App.jsx imports and routes |
| Styling broken | Verify coming-soon.css imported |
| Signup fails | Check database migration ran |
| Admin endpoints 403 | Verify admin JWT token in header |

## Database Query Examples

```sql
-- Check signups
SELECT COUNT(*) FROM coming_soon_waitlist WHERE feature_type = 'live';

-- Get pending entries
SELECT email, source, created_at FROM coming_soon_waitlist
WHERE status = 'pending' LIMIT 10;

-- View stats
SELECT * FROM coming_soon_waitlist_stats;

-- Check audit log
SELECT * FROM coming_soon_waitlist_audit WHERE action = 'signed_up';
```

## Features Included

- Beautiful landing pages for Live & Hangouts
- Email signup with validation
- Social sharing (Twitter, Telegram, Discord)
- Waitlist management
- Admin dashboard endpoints
- CSV export for marketing
- Audit logging
- Responsive design
- Smooth animations

## Documentation

- **Setup Guide:** `COMING_SOON_SETUP.md`
- **Test Cases:** `COMING_SOON_TEST.md`
- **Implementation:** `COMING_SOON_IMPLEMENTATION.md`
- **Overview:** `COMING_SOON_OVERVIEW.md`

## Support

For detailed instructions, see corresponding documentation files.

Common issues answered in COMING_SOON_SETUP.md troubleshooting section.

Test examples provided in COMING_SOON_TEST.md.
