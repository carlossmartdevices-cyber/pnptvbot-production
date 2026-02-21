# Coming Soon Pages - Test Commands

## Local Testing

### Start the application

```bash
cd /root/pnptvbot-production

# Start with PM2
pm2 start ecosystem.config.js --env production

# Or with npm
npm start

# Watch logs
pm2 logs pnptv-bot
```

### Access the pages

Open in browser:
- http://localhost:3001/prime-hub/live/coming-soon
- http://localhost:3001/prime-hub/hangouts/coming-soon

## API Testing

### 1. Sign up for Live waitlist

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "feature": "live",
    "source": "hero"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "creator@example.com",
    "isNew": true,
    "message": "Successfully signed up for waitlist"
  }
}
```

### 2. Sign up for Hangouts waitlist

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "feature": "hangouts",
    "source": "signup_box"
  }'
```

### 3. Try duplicate signup (should return isNew: false)

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "feature": "live"
  }'
```

Expected:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "message": "Email already on waitlist",
    "isNew": false
  }
}
```

### 4. Get waitlist count for Live

```bash
curl http://localhost:3001/api/coming-soon/count/live
```

Expected:
```json
{
  "success": true,
  "data": {
    "feature": "live",
    "count": 1
  }
}
```

### 5. Get waitlist count for Hangouts

```bash
curl http://localhost:3001/api/coming-soon/count/hangouts
```

### 6. Test invalid email

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "feature": "live"
  }'
```

Expected error:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "Invalid email address"
  }
}
```

### 7. Test invalid feature type

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "feature": "invalid"
  }'
```

Expected error:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Email and feature are required"
  }
}
```

### 8. Unsubscribe from waitlist

```bash
curl -X POST http://localhost:3001/api/coming-soon/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "feature": "live"
  }'
```

Expected:
```json
{
  "success": true,
  "data": {
    "message": "Successfully unsubscribed"
  }
}
```

### 9. Try to unsubscribe non-existent email

```bash
curl -X POST http://localhost:3001/api/coming-soon/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "feature": "live"
  }'
```

Expected 404:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Email not found on waitlist"
  }
}
```

## Admin API Testing

First, get an admin JWT token:

```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pnptv.app",
    "password": "admin_password"
  }'

# Save the token from response
TOKEN="eyJhbGc..."
```

### 10. Get waitlist statistics (admin)

```bash
TOKEN="your_admin_jwt_token"

curl -X GET http://localhost:3001/api/coming-soon/stats/live \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
```json
{
  "success": true,
  "data": {
    "feature_type": "live",
    "total_signups": 2,
    "pending": 1,
    "notified": 0,
    "unsubscribed": 1,
    "signup_days": 1,
    "latest_signup": "2026-02-21T10:30:00Z"
  }
}
```

### 11. Get pending entries (admin)

```bash
curl -X GET "http://localhost:3001/api/coming-soon/pending/live?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
```json
{
  "success": true,
  "data": {
    "feature": "live",
    "count": 1,
    "entries": [
      {
        "id": 2,
        "email": "user@example.com",
        "user_id": null,
        "created_at": "2026-02-21T10:15:00Z",
        "source": "signup_box"
      }
    ]
  }
}
```

### 12. Mark entries as notified (admin)

```bash
curl -X POST http://localhost:3001/api/coming-soon/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "entryIds": [2]
  }'
```

Expected:
```json
{
  "success": true,
  "data": {
    "message": "Marked 1 entries as notified",
    "count": 1
  }
}
```

### 13. Export waitlist as CSV (admin)

```bash
curl -X GET "http://localhost:3001/api/coming-soon/export/live?status=pending" \
  -H "Authorization: Bearer $TOKEN" \
  -o waitlist_live.csv

cat waitlist_live.csv
```

Expected CSV:
```
email,user_id,signup_date,source
user@example.com,,2026-02-21T10:15:00Z,signup_box
```

### 14. Test admin-only access without token

```bash
curl -X GET http://localhost:3001/api/coming-soon/stats/live
```

Expected 403:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

## Frontend Testing

### Test email signup flow

1. Navigate to http://localhost:3001/prime-hub/live/coming-soon
2. Scroll to "Get Early Access" section
3. Enter email: `test@example.com`
4. Click "Notify Me"
5. Verify success message appears
6. Check database: `psql -U postgres -d pnptv_db -c "SELECT * FROM coming_soon_waitlist WHERE email = 'test@example.com';"`

### Test social sharing

1. Click Twitter share button
2. Verify Twitter web intent opens
3. Click Telegram share button
4. Verify Telegram share dialog opens
5. Click Discord share button
6. Verify Discord integration prompt

### Test responsive design

1. Open browser DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Test on mobile, tablet, desktop sizes
4. Verify all sections are readable
5. Verify buttons are clickable
6. Test form submission on mobile

### Test animations

1. Observe hero section
   - Badge pulses every 2 seconds
   - Icons float up and down gently
   - Text shimmer animation on "Soon"
2. Scroll down slowly
   - Cards appear and slide in
3. Hover over feature cards
   - Card lifts up
   - Icon rotates and scales
   - Border color changes to primary
4. Hover over buttons
   - Shadow increases
   - Position lifts slightly
5. Submit form
   - Loading spinner appears
   - Success message slides in

### Test links and navigation

1. Test all CTAs navigate correctly
2. Test feature comparison table is readable
3. Test FAQ items are accessible
4. Test timeline indicators work
5. Test navigation back via header

## Database Testing

### Check migration ran successfully

```bash
psql -U postgres -d pnptv_db

-- List tables
\dt | grep coming_soon

-- Check table structure
\d coming_soon_waitlist

-- View sample data
SELECT * FROM coming_soon_waitlist LIMIT 5;

-- Check audit log
SELECT * FROM coming_soon_waitlist_audit LIMIT 5;

-- View statistics
SELECT * FROM coming_soon_waitlist_stats;
```

### Test database constraints

```bash
-- Try inserting duplicate (should fail)
INSERT INTO coming_soon_waitlist (email, feature_type, status)
VALUES ('test@example.com', 'live', 'pending');

-- Try inserting without feature_type (should fail)
INSERT INTO coming_soon_waitlist (email, status)
VALUES ('test2@example.com', 'pending');

-- Check created_at and updated_at are set
SELECT created_at, updated_at FROM coming_soon_waitlist LIMIT 1;
```

## Performance Testing

### Load test with many signups

```bash
#!/bin/bash
for i in {1..100}; do
  email="test${i}@example.com"
  curl -X POST http://localhost:3001/api/coming-soon/waitlist \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"feature\": \"live\"}" \
    -s &
done
wait
echo "100 signups completed"
```

### Check response times

```bash
time curl http://localhost:3001/api/coming-soon/count/live

# Should complete in < 100ms
```

### Monitor database

```bash
# Watch active queries
psql -U postgres -d pnptv_db -c "SELECT pid, query, query_start FROM pg_stat_activity WHERE query NOT LIKE '%pg_stat_activity%' ORDER BY query_start;"
```

## Error Scenario Testing

### 1. Test with missing fields

```bash
# Missing email
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{"feature": "live"}'

# Missing feature
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 2. Test with malformed JSON

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

### 3. Test with special characters in email

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test+tag@example.com", "feature": "live"}'
```

### 4. Test with SQL injection attempts

```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com\"; DROP TABLE coming_soon_waitlist; --", "feature": "live"}'
```

Should safely escape and return as invalid email or successful signup.

## Browser Console Testing

Test in browser DevTools console:

```javascript
// Test API client methods
import { comingSoonAPI } from './api/comingSoonClient';

// Sign up
await comingSoonAPI.signupWaitlist('live', { email: 'test@example.com' });

// Get count
const count = await comingSoonAPI.getWaitlistCount('live');
console.log('Waitlist count:', count);

// Get stats (requires admin)
const stats = await comingSoonAPI.getStats('live');
console.log('Stats:', stats);

// Export (requires admin)
await comingSoonAPI.exportWaitlist('live', { status: 'pending' });
```

## Checklist

- [ ] Database migration runs without errors
- [ ] All backend files present and no syntax errors
- [ ] All frontend files present and no syntax errors
- [ ] Routes registered in routes.js
- [ ] App.jsx updated with new routes
- [ ] CSS imported and animations working
- [ ] Sign up works on both pages
- [ ] Waitlist count updates correctly
- [ ] Social share buttons open correct platforms
- [ ] Admin stats endpoint works with auth
- [ ] Export CSV downloads correctly
- [ ] Responsive design works on mobile
- [ ] Error messages display correctly
- [ ] No console errors on page load
- [ ] Database audit log records activities
- [ ] Duplicate signups handled correctly
- [ ] Unsubscribe functionality works
- [ ] Performance is acceptable (< 200ms API response)
