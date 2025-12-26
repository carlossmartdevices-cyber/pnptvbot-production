# PNPtv Access Control & Permissions System

A comprehensive access control system for managing topic permissions, user roles, and post approvals.

## Features

### ✅ Topic Permissions Middleware
- Auto-delete unauthorized posts
- Topic-specific access control
- Subscription requirements
- Rate limiting per topic

### ✅ Role System
Four role levels with increasing permissions:
- **USER** (Level 0) - Default role
- **CONTRIBUTOR** (Level 10) - Can post in approval topics
- **PERFORMER** (Level 20) - Can post in approval topics + extras
- **ADMIN** (Level 100) - Full access

### ✅ Topic Configurations

#### Topic 3131: Admin Announcements
- **Access:** ADMIN only
- **Auto-delete:** Yes (5 seconds delay)
- **Notification:** User notified of unauthorized post
- **Rate limit:** None

#### Topic 3134: Podcasts & Thoughts
- **Access:** ADMIN, PERFORMER, CONTRIBUTOR
- **Auto-delete:** No (uses approval system)
- **Approval:** Required for non-admins
- **Rate limit:** 5 posts per hour
- **Notification:** User notified when post pending/approved/rejected

#### Topic 3135: Notifications
- **Access:** All users
- **Auto-delete:** No
- **Rate limit:** 10 posts per 5 minutes

### ✅ Approval System
- Posts in restricted topics require admin approval
- Admins receive DM with approve/reject buttons
- Users notified of approval status
- 24-hour pending timeout
- Full approval history tracking

### ✅ Rate Limiting
- Per-topic rate limits
- In-memory tracking with auto-cleanup
- Configurable limits and windows
- Auto-delete rate-limited posts

### ✅ Subscription Requirements
- Topics can require PRIME subscription
- Auto-delete non-PRIME user posts
- Redirect to /prime command

## Setup

### 1. Initialize Database Tables

```bash
node scripts/initAccessControlTables.js
```

This creates:
- `user_roles` table - Stores user roles
- `approval_queue` table - Stores pending approvals

### 2. Grant Initial Admin Role

After initialization, grant yourself admin role:

```
/grantrole YOUR_USER_ID ADMIN
```

Note: You need to have superadmin in the existing permission system to run this first time, OR you can insert directly into the database:

```sql
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('YOUR_USER_ID', 'ADMIN', 'system');
```

### 3. Configure Topics (Optional)

Edit `src/config/accessControlConfig.js` to customize:
- Topic permissions
- Role levels
- Rate limits
- Auto-delete delays
- Messages

## Role Management Commands

### /grantrole - Grant a role to a user

**Usage:**
```
/grantrole @username ROLE
```
Or reply to user's message:
```
/grantrole ROLE
```

**Available roles:**
- USER
- CONTRIBUTOR
- PERFORMER
- ADMIN

**Example:**
```
/grantrole @john PERFORMER
```

### /revokerole - Revoke a user's role

**Usage:**
```
/revokerole @username
```
Or reply to user's message:
```
/revokerole
```

Resets user to default USER role.

### /checkrole - Check a user's role

**Usage:**
```
/checkrole @username
```
Or check your own role:
```
/checkrole
```

**Output:**
```
👤 Role Information

User: @john
Role: Performer (PERFORMER)
Level: 20
```

### /rolestats - View role statistics

**Admin only**

**Output:**
```
📊 Role Statistics

Total Users with Roles: 45

Breakdown:
• Admins: 3
• Performers: 12
• Contributors: 15
• Users: 15
```

## Approval Management Commands

### /approvalqueue - View pending approvals

**Admin only**

Shows list of posts waiting for approval with:
- Approval ID
- Topic name
- User ID
- Message preview
- Submission timestamp

### /approvalstats - View approval statistics

**Admin only**

**Output:**
```
📊 Approval Statistics

Total Posts: 156

Status Breakdown:
• Pending: 5
• Approved: 120
• Rejected: 31

Approval Rate: 79%
```

## How It Works

### Topic Permissions Flow

1. User posts message in topic
2. Middleware checks topic configuration
3. Checks if user is Telegram admin (bypass all checks)
4. Checks subscription requirement (if configured)
5. Checks rate limit (if configured)
6. Checks user's role vs. required roles

**If unauthorized:**
- **Auto-delete enabled:** Message deleted after 5 seconds with warning
- **Approval required:** Message added to approval queue

**If authorized:**
- Message proceeds normally

### Approval Flow

1. User (CONTRIBUTOR or PERFORMER) posts in Topic 3134
2. Post added to approval queue
3. User notified: "Your post is pending approval"
4. All admins receive DM with:
   - Post preview
   - User info
   - Approve/Reject buttons
5. Admin clicks button:
   - **Approve:** User notified, post stays
   - **Reject:** Post deleted, user notified with reason
6. Approval status saved to database

### Rate Limiting

**In-memory tracking:**
- Stores timestamps of recent posts per user per topic
- Auto-cleans old entries every 10 minutes
- Configurable limits per topic

**Flow:**
1. User posts in rate-limited topic
2. Check recent post count in time window
3. If limit exceeded:
   - Delete message
   - Send warning with wait time
4. If within limit:
   - Add timestamp
   - Allow post

## Configuration

### Topic Permissions

Edit `src/config/accessControlConfig.js`:

```javascript
TOPIC_PERMISSIONS: {
  3131: {
    name: 'Admin Announcements',
    allowedRoles: ['ADMIN'],
    requireSubscription: false,
    autoDelete: true,
    deleteDelay: 5000,
    notifyUser: true,
    rateLimit: null,
  },
}
```

**Options:**
- `name` - Topic display name
- `allowedRoles` - Array of roles that can post
- `requireSubscription` - Require PRIME subscription
- `autoDelete` - Auto-delete unauthorized posts
- `requireApproval` - Use approval system
- `deleteDelay` - Delay before deletion (ms)
- `notifyUser` - Send notification to user
- `rateLimit` - Rate limit config or null

### Role Levels

```javascript
ROLES: {
  USER: 0,
  CONTRIBUTOR: 10,
  PERFORMER: 20,
  ADMIN: 100,
}
```

Higher number = more permissions. Users with level ≥ required level can access.

### Messages

Customize notification messages:

```javascript
MESSAGES: {
  unauthorized: {
    en: '⛔ You do not have permission...',
    es: '⛔ No tienes permiso...',
  },
  // ... more messages
}
```

## Testing

### Test Admin-Only Topic (3131)

1. As non-admin, post in topic 3131
2. Message should be deleted after 5 seconds
3. Warning message should appear

### Test Approval System (3134)

1. Grant CONTRIBUTOR role: `/grantrole @user CONTRIBUTOR`
2. As contributor, post in topic 3134
3. Should see "pending approval" message
4. Admin should receive DM with approve/reject buttons
5. Click approve/reject
6. User should be notified

### Test Rate Limiting (3135)

1. Post 11 messages quickly in topic 3135
2. 11th message should be deleted
3. Rate limit warning should appear

### Test Role Commands

```bash
# Grant role
/grantrole @testuser CONTRIBUTOR

# Check role
/checkrole @testuser

# View stats
/rolestats

# Revoke role
/revokerole @testuser
```

## Monitoring

### Check Role Assignments

```sql
SELECT * FROM user_roles ORDER BY granted_at DESC LIMIT 10;
```

### Check Pending Approvals

```sql
SELECT * FROM approval_queue WHERE status = 'pending';
```

### Check Approval History

```sql
SELECT
  status,
  COUNT(*) as count
FROM approval_queue
GROUP BY status;
```

## Troubleshooting

### Posts Not Being Auto-Deleted

**Check logs:**
```bash
pm2 logs pnptvbot | grep "topicPermissions"
```

**Verify middleware is registered:**
```javascript
// src/bot/core/bot.js
bot.use(topicPermissionsMiddleware());
```

### Approval Buttons Not Working

**Check logs:**
```bash
pm2 logs pnptvbot | grep "approval"
```

**Verify handlers are registered:**
```javascript
// src/bot/core/bot.js
registerApprovalHandlers(bot);
```

### Role Commands Not Working

**Check database:**
```sql
-- Verify tables exist
\dt user_roles
\dt approval_queue

-- Check if user has admin role
SELECT * FROM user_roles WHERE role = 'ADMIN';
```

**Grant initial admin:**
```sql
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('YOUR_USER_ID', 'ADMIN', 'system')
ON CONFLICT (user_id) DO UPDATE SET role = 'ADMIN';
```

### Rate Limiting Not Working

**Check configuration:**
```javascript
// src/config/accessControlConfig.js
TOPIC_PERMISSIONS: {
  3135: {
    rateLimit: {
      maxPosts: 10,
      windowMs: 5 * 60 * 1000,
    },
  },
}
```

**Check in-memory tracker:**
Rate limits are stored in memory and reset on bot restart.

## Architecture

```
src/
├── config/
│   └── accessControlConfig.js       # Configuration
├── services/
│   ├── roleService.js               # Role management
│   └── approvalService.js           # Approval queue
├── bot/
│   ├── core/
│   │   └── middleware/
│   │       └── topicPermissions.js  # Main middleware
│   └── handlers/
│       └── moderation/
│           ├── index.js             # Register handlers
│           └── accessControlCommands.js # Commands
└── scripts/
    └── initAccessControlTables.js   # Database setup

Flow:
Message → topicPermissions middleware → Role check → Rate limit check → Allow/Deny
                                              ↓
                                     Approval Queue (if required)
                                              ↓
                                     Admin notification → Approve/Reject
```

## Database Schema

### `user_roles` Table

| Column | Type | Description |
|--------|------|-------------|
| user_id | VARCHAR(255) | Primary key, Telegram user ID |
| role | VARCHAR(50) | Role name (USER, CONTRIBUTOR, PERFORMER, ADMIN) |
| granted_by | VARCHAR(255) | User ID who granted the role |
| granted_at | TIMESTAMP | When role was granted |

### `approval_queue` Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | VARCHAR(255) | User who posted |
| message_id | BIGINT | Telegram message ID |
| topic_id | INTEGER | Topic ID |
| chat_id | VARCHAR(255) | Chat ID |
| message_text | TEXT | Message content |
| has_media | BOOLEAN | Contains media |
| media_type | VARCHAR(50) | Type of media |
| status | VARCHAR(20) | pending/approved/rejected |
| approved_by | VARCHAR(255) | Admin who approved/rejected |
| approved_at | TIMESTAMP | When approved/rejected |
| rejection_reason | TEXT | Reason for rejection |
| created_at | TIMESTAMP | When submitted |

## Best Practices

### Role Assignment

1. **Start conservative**
   - Grant roles only when needed
   - Review regularly

2. **Document decisions**
   - Keep track of why roles were granted
   - Use notes or external documentation

3. **Regular audits**
   - Use `/rolestats` to monitor
   - Review role assignments monthly

### Approval Management

1. **Respond promptly**
   - Check `/approvalqueue` daily
   - Set up notifications

2. **Be consistent**
   - Develop clear approval criteria
   - Document rejection reasons

3. **Clean up old pending**
   - Posts auto-expire after 24 hours
   - Manual cleanup if needed

### Topic Configuration

1. **Test before deploying**
   - Test with test account first
   - Verify all scenarios

2. **Monitor performance**
   - Check logs for errors
   - Adjust rate limits as needed

3. **User communication**
   - Announce changes to users
   - Provide clear guidelines

## Security Considerations

- ✅ Telegram admins bypass all checks
- ✅ Role-based access control
- ✅ Rate limiting prevents spam
- ✅ Approval system for quality control
- ✅ Auto-delete unauthorized content
- ✅ Full audit trail in database
- ✅ Subscription verification
- ✅ Input validation on all commands

## Support

For issues or questions:
- Check logs: `pm2 logs pnptvbot`
- Review configuration files
- Test with `/checkrole` and `/rolestats`
- Verify database tables exist
- Check middleware is registered
