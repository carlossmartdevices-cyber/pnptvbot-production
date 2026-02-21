# Coming Soon Pages - Setup Guide

## Overview

This guide covers the setup and integration of the "Coming Soon!" pages for Live and Hangouts features in pnptv.

The system includes:
- Two beautiful, animated landing pages (ComingSoonLive.jsx, ComingSoonHangouts.jsx)
- Newsletter signup with email verification
- Social sharing integration (Twitter, Telegram, Discord)
- Admin dashboard for managing waitlists
- CSV export for marketing campaigns
- Responsive mobile-first design

## Architecture

### Frontend Components
- `webapps/prime-hub/src/pages/ComingSoonLive.jsx` - Live streaming coming soon page
- `webapps/prime-hub/src/pages/ComingSoonHangouts.jsx` - Social hangouts coming soon page
- `webapps/prime-hub/src/styles/coming-soon.css` - All animations and styling
- `webapps/prime-hub/src/api/comingSoonClient.js` - API client methods

### Backend Services
- `src/bot/services/ComingSoonService.js` - Business logic for waitlist management
- `src/bot/api/controllers/comingSoonController.js` - API endpoints
- `src/bot/api/routes/comingSoonRoutes.js` - Route definitions

### Database
- Migration: `database/migrations/063_coming_soon_waitlist.sql`
- Tables: `coming_soon_waitlist`, `coming_soon_waitlist_audit`
- Views: `coming_soon_waitlist_stats`

## Installation Steps

### 1. Database Migration

```bash
# Run the migration to create tables
psql -U postgres -d pnptv_db -f database/migrations/063_coming_soon_waitlist.sql
```

### 2. Install Backend Files

All backend files are already created:
- `/root/pnptvbot-production/src/bot/services/ComingSoonService.js`
- `/root/pnptvbot-production/src/bot/api/controllers/comingSoonController.js`
- `/root/pnptvbot-production/src/bot/api/routes/comingSoonRoutes.js`

### 3. Register Routes

Add to `/root/pnptvbot-production/src/bot/api/routes.js`:

```javascript
// Around line 30-50 with other route registrations
const comingSoonRoutes = require('./routes/comingSoonRoutes');

// Then add to Express app:
app.use('/api/coming-soon', comingSoonRoutes);
```

**Location in routes.js** (after line 45, with other API route registrations):

```javascript
// Coming Soon pages
app.use('/api/coming-soon', require('./routes/comingSoonRoutes'));
```

### 4. Install Frontend Files

All frontend files are created:
- `/root/pnptvbot-production/webapps/prime-hub/src/pages/ComingSoonLive.jsx`
- `/root/pnptvbot-production/webapps/prime-hub/src/pages/ComingSoonHangouts.jsx`
- `/root/pnptvbot-production/webapps/prime-hub/src/styles/coming-soon.css`
- `/root/pnptvbot-production/webapps/prime-hub/src/api/comingSoonClient.js`

### 5. Update App.jsx Routes

Add to `/root/pnptvbot-production/webapps/prime-hub/src/App.jsx`:

```javascript
// Import the coming soon pages (around line 22)
import ComingSoonLive from './pages/ComingSoonLive';
import ComingSoonHangouts from './pages/ComingSoonHangouts';

// Add routes in the Routes section (around line 77-78)
<Route path="/live/coming-soon" element={<ProtectedRoute><ComingSoonLive /></ProtectedRoute>} />
<Route path="/hangouts/coming-soon" element={<ProtectedRoute><ComingSoonHangouts /></ProtectedRoute>} />
```

### 6. Import CSS

Add to `/root/pnptvbot-production/webapps/prime-hub/src/index.js` or main CSS file:

```javascript
import './styles/coming-soon.css';
```

Or add to the existing CSS import chain in your main component.

### 7. Build & Deploy

```bash
# Build the Prime Hub frontend
cd /root/pnptvbot-production/webapps/prime-hub
npm run build

# Restart the application
pm2 restart pnptv-bot

# Check logs
pm2 logs pnptv-bot
```

## API Endpoints

### Public Endpoints

**Sign up for waitlist**
```
POST /api/coming-soon/waitlist
Content-Type: application/json

{
  "email": "user@example.com",
  "feature": "live" | "hangouts",
  "source": "hero" | "signup_box" | "final_cta" (optional)
}

Response:
{
  "success": true,
  "data": {
    "id": 123,
    "email": "user@example.com",
    "isNew": true,
    "message": "Successfully signed up for waitlist"
  }
}
```

**Get waitlist count**
```
GET /api/coming-soon/count/:feature

Response:
{
  "success": true,
  "data": {
    "feature": "live",
    "count": 2847
  }
}
```

**Unsubscribe from waitlist**
```
POST /api/coming-soon/unsubscribe
Content-Type: application/json

{
  "email": "user@example.com",
  "feature": "live"
}

Response:
{
  "success": true,
  "data": {
    "message": "Successfully unsubscribed"
  }
}
```

### Admin Endpoints

**Get waitlist statistics** (requires admin role)
```
GET /api/coming-soon/stats/:feature

Response:
{
  "success": true,
  "data": {
    "feature_type": "live",
    "total_signups": 2847,
    "pending": 2100,
    "notified": 700,
    "unsubscribed": 47,
    "signup_days": 25,
    "latest_signup": "2026-02-21T10:30:00Z"
  }
}
```

**Get pending entries** (requires admin role)
```
GET /api/coming-soon/pending/:feature?limit=100&offset=0

Response:
{
  "success": true,
  "data": {
    "feature": "live",
    "count": 100,
    "entries": [
      {
        "id": 1,
        "email": "user@example.com",
        "user_id": 42,
        "created_at": "2026-02-20T15:30:00Z",
        "source": "hero"
      },
      ...
    ]
  }
}
```

**Mark as notified** (requires admin role)
```
POST /api/coming-soon/notify
Content-Type: application/json

{
  "entryIds": [1, 2, 3, 4, 5]
}

Response:
{
  "success": true,
  "data": {
    "message": "Marked 5 entries as notified",
    "count": 5
  }
}
```

**Export waitlist** (requires admin role)
```
GET /api/coming-soon/export/:feature?status=pending

Returns CSV file:
email,user_id,signup_date,source
user1@example.com,42,2026-02-20T15:30:00Z,hero
user2@example.com,,2026-02-21T10:15:00Z,signup_box
...
```

## Frontend Integration

### API Client Usage

In React components, use the client methods from `comingSoonClient.js`:

```javascript
import { comingSoonAPI } from '../api/comingSoonClient';

// Sign up for waitlist
const handleSignup = async (email) => {
  try {
    const result = await comingSoonAPI.signupWaitlist('live', { email });
    console.log('Signed up:', result);
  } catch (error) {
    console.error('Signup failed:', error);
  }
};

// Get waitlist count
const fetchCount = async () => {
  const data = await comingSoonAPI.getWaitlistCount('live');
  console.log('Waitlist count:', data.count);
};

// Export waitlist (admin)
const exportList = async () => {
  await comingSoonAPI.exportWaitlist('live', { status: 'pending' });
  // Automatically downloads CSV file
};
```

## Features

### Page Design
- **Hero Section**: Eye-catching headline, animated icons, social proof
- **Signup Section**: Email input with notification bell CTA
- **Features Grid**: Showcase 4 key features with icons
- **Comparison Table**: Show advantages vs competitors
- **Benefits Section**: 4-column benefit cards
- **Use Cases**: Show different ways people will use the feature
- **Pricing Preview**: Future pricing tiers
- **Timeline**: Launch phases and estimated dates
- **FAQ Section**: 6 common questions answered
- **Final CTA**: One more signup opportunity at bottom

### Animations
- **Pulse Badge**: Animated "Broadcasting Awaits" / "Community Awaits" badge
- **Shimmer Text**: Gradient text animation on "Soon"
- **Float Icons**: Hero icons gently float up and down
- **Hover Effects**: Cards lift and glow on hover
- **Slide In**: Success/error messages slide in smoothly
- **Smooth Transitions**: All interactions are smooth and polished

### Responsive Design
- Desktop: Full 1400px max-width with side-by-side hero
- Tablet: Stacked hero, adjusted grid layouts
- Mobile: Single column, optimized touch targets

### Social Sharing
- Twitter/X share button with pre-written message
- Telegram share for direct messaging
- Discord integration ready
- Customizable share messages per feature

## Database Schema

### coming_soon_waitlist
```sql
- id (PRIMARY KEY)
- email (VARCHAR 255) - User email
- feature_type (VARCHAR 50) - 'live' or 'hangouts'
- signed_up_at (TIMESTAMP) - When user signed up
- notified_at (TIMESTAMP) - When notification was sent
- status (VARCHAR 20) - 'pending', 'notified', 'unsubscribed'
- source (VARCHAR 100) - Where signup came from (hero, signup_box, etc)
- user_id (FK to users) - Optional user reference
- ip_address (INET) - User's IP for analytics
- user_agent (TEXT) - Browser info
- created_at / updated_at (TIMESTAMP)
```

### coming_soon_waitlist_audit
```sql
- id (PRIMARY KEY)
- waitlist_id (FK) - Reference to waitlist entry
- action (VARCHAR 50) - 'signed_up', 'notified', 'unsubscribed', 'bounced'
- details (JSONB) - Extra context (source, IP, etc)
- created_at (TIMESTAMP)
```

### Views
```sql
coming_soon_waitlist_stats - Shows stats by feature:
  - total_signups
  - pending count
  - notified count
  - unsubscribed count
  - signup_days
  - latest_signup
```

## Admin Dashboard Integration

To create an admin page for managing waitlists, create `/root/pnptvbot-production/webapps/prime-hub/src/pages/admin/AdminComingSoonPage.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { comingSoonAPI } from '../../api/comingSoonClient';
import Layout from '../../components/Layout';

export default function AdminComingSoonPage() {
  const [liveStats, setLiveStats] = useState(null);
  const [hangoutsStats, setHangoutsStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const live = await comingSoonAPI.getStats('live');
        const hangouts = await comingSoonAPI.getStats('hangouts');
        setLiveStats(live);
        setHangoutsStats(hangouts);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleExport = async (feature) => {
    try {
      await comingSoonAPI.exportWaitlist(feature, { status: 'pending' });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <h1>Coming Soon Waitlists</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          {/* Live Stats */}
          <div style={{ padding: '20px', background: 'var(--panel-color)', borderRadius: '12px' }}>
            <h2>Live Streaming</h2>
            <p>Total Signups: {liveStats?.total_signups || 0}</p>
            <p>Pending: {liveStats?.pending || 0}</p>
            <p>Notified: {liveStats?.notified || 0}</p>
            <button onClick={() => handleExport('live')}>Export CSV</button>
          </div>

          {/* Hangouts Stats */}
          <div style={{ padding: '20px', background: 'var(--panel-color)', borderRadius: '12px' }}>
            <h2>Hangouts</h2>
            <p>Total Signups: {hangoutsStats?.total_signups || 0}</p>
            <p>Pending: {hangoutsStats?.pending || 0}</p>
            <p>Notified: {hangoutsStats?.notified || 0}</p>
            <button onClick={() => handleExport('hangouts')}>Export CSV</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
```

Then add to App.jsx routes:
```javascript
<Route path="/admin/coming-soon" element={<AdminRoute><AdminComingSoonPage /></AdminRoute>} />
```

## Email Campaign Integration

The CSV export includes:
- Email addresses
- User IDs (for matching with user database)
- Signup date
- Signup source

Use this to:
1. Send announcement emails when feature launches
2. Create user segments by signup source
3. Track conversion rates
4. Personalize onboarding

## Testing

### Test Signup
```bash
curl -X POST http://localhost:3001/api/coming-soon/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "feature": "live",
    "source": "hero"
  }'
```

### Test Count
```bash
curl http://localhost:3001/api/coming-soon/count/live
```

### Test Admin Stats
```bash
curl http://localhost:3001/api/coming-soon/stats/live \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Styling Customization

The coming-soon.css includes CSS variables for theming:
- `--primary-color`: Main blue (#007AFF)
- `--secondary-color`: Green accent (#34C759)
- `--destructive-color`: Red for errors (#FF3B30)
- `--text-color`: Main text color
- `--text-muted-color`: Dimmed text
- `--border-color`: Border colors
- `--panel-color`: Card backgrounds

Modify these in `/webapps/design-system/styles.css` to change the theme globally.

## Performance Considerations

- Waitlist count is fetched on component mount and cached
- API calls use existing authentication middleware
- Database queries are indexed on feature_type and status
- CSV export streams data (doesn't load everything in memory)
- Cleanup function removes old unsubscribed entries

## Security

- All admin endpoints require authentication
- IP address and user-agent logged for fraud detection
- Unique constraint on (email, feature_type) prevents duplicates
- Email validation on both frontend and backend
- CSRF protection via existing middleware

## Troubleshooting

### Signup fails with "Invalid email"
- Check email validation regex in ComingSoonService.isValidEmail()
- Ensure email format is valid (user@domain.com)

### Waitlist count shows 0
- Verify database migration ran successfully
- Check coming_soon_waitlist table exists: `psql -c "SELECT COUNT(*) FROM coming_soon_waitlist;"`

### Export button not working
- Check admin role is set correctly on user
- Verify /api/coming-soon/export/:feature route is registered

### Styling not applying
- Ensure coming-soon.css is imported in main file
- Check CSS file path is correct
- Clear browser cache (Cmd+Shift+R)

### Routes not accessible
- Verify routes added to routes.js
- Restart Node.js application: `pm2 restart pnptv-bot`
- Check browser console for 404 errors

## Future Enhancements

1. **Email Notifications**: Auto-send emails when feature launches
2. **Referral System**: Rewards for sharing waitlist link
3. **Gamification**: Badges for early signups, sharing milestones
4. **A/B Testing**: Test different page variations
5. **Analytics**: Track conversion funnel, traffic sources
6. **Integration**: Connect to Mailchimp, SendGrid for email campaigns
