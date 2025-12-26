# PNPtv Telegram Bot - Complete Codebase Architecture

**Last Updated**: November 2024  
**Bot Type**: Telegram Bot (Telegraf.js)  
**Stack**: Node.js + Firebase Firestore + Redis + Express.js  

---

## TABLE OF CONTENTS
1. [Bot Structure & Entry Point](#1-bot-structure--entry-point)
2. [Message Handlers Architecture](#2-message-handlers-architecture)
3. [Existing Moderation Features](#3-existing-moderation-features)
4. [Database/Storage System](#4-databasestorage-system)
5. [Permissions & Group Administration](#5-permissions--group-administration)
6. [Middleware & Security](#6-middleware--security-architecture)
7. [Implementation Guide](#7-recommended-moderation-implementation)

---

## 1. BOT STRUCTURE & ENTRY POINT

### Entry Point: `src/bot/core/bot.js`

The bot initialization follows this sequence:

1. **Environment Validation** (Lines 27-36)
   - Checks for critical variables: BOT_TOKEN, FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
   - Exits with error if any are missing

2. **Service Initialization** (Lines 41-76)
   - Firebase Admin SDK initialization
   - Redis connection (with graceful fallback)
   - Cache prewarming with critical data
   - Sentry error tracking setup

3. **Middleware Registration** (Lines 80-82)
   - Session Middleware: Load/save user state
   - Rate Limiting Middleware: Enforce request limits

4. **Handler Registration** (Lines 85-88)
   ```javascript
   registerUserHandlers(bot);      // User features
   registerAdminHandlers(bot);     // Admin panel
   registerPaymentHandlers(bot);   // Payment flows
   registerMediaHandlers(bot);     // Media (radio, zoom, live)
   ```

5. **Bot Launch** (Lines 94-128)
   - **Production**: Sets webhook URL, registers callback handler
   - **Development**: Uses polling mode

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Telegraf.js | 4.15.0 |
| Database | Firebase Firestore | 7.1.0 |
| Cache/Session | Redis/IORedis | 5.3.2 |
| API Server | Express.js | 4.18.2 |
| Language | Node.js | 18.x+ |
| Logging | Winston | 3.11.0 |
| Error Tracking | Sentry | 7.99.0 |
| Rate Limiting | rate-limiter-flexible | 5.0.0 |

---

## 2. MESSAGE HANDLERS ARCHITECTURE

### Handler Organization

```
src/bot/handlers/
├── user/
│   ├── index.js              ← Entry point, registers all user handlers
│   ├── onboarding.js         ← Multi-step signup flow
│   ├── menu.js               ← Main menu with buttons
│   ├── profile.js            ← Profile management (edit, photo, bio, location)
│   ├── nearby.js             ← Geolocation-based user discovery
│   └── settings.js           ← User preferences
│
├── admin/
│   └── index.js              ← Admin panel, user mgmt, broadcasts (397 lines)
│
├── payments/
│   └── index.js              ← Payment flows, subscription selection
│
└── media/
    ├── index.js              ← Entry point
    ├── radio.js              ← Radio streaming
    ├── zoom.js               ← Video conference rooms
    ├── live.js               ← Live streaming
    └── support.js            ← AI chat with Cristina, FAQ
```

### Handler Registration Pattern

Each handler module exports a registration function:

```javascript
// Example from user/index.js
const registerUserHandlers = (bot) => {
  onboardingHandlers(bot);
  menuHandlers(bot);
  profileHandlers(bot);
  // ... etc
};

module.exports = registerUserHandlers;
```

### Handler Types & Patterns

#### 1. Command Handlers
```javascript
bot.command('menu', async (ctx) => {
  // Triggered by /menu
});
```

#### 2. Action Handlers (Button Callbacks)
```javascript
bot.action('show_subscription_plans', async (ctx) => {
  // Triggered by inline button with callback_data: 'show_subscription_plans'
});
```

#### 3. Text Message Handlers
```javascript
bot.on('text', async (ctx, next) => {
  if (ctx.session.temp?.adminSearchingUser) {
    // Handle admin user search
    return;
  }
  
  return next(); // Pass to next handler
});
```

### Message Flow Diagram

```
User Action (Text/Button)
    ↓
Telegraf Router (matches command/action/text pattern)
    ↓
Middleware Stack
    ├─ sessionMiddleware() ← Load session from Redis
    ├─ rateLimitMiddleware() ← Check rate limits
    └─ errorHandler wrapper
    ↓
Handler Function
    ├─ Permission check (if admin required)
    ├─ Session state manipulation
    ├─ Service/Model calls
    └─ Response: ctx.reply() or ctx.editMessageText()
    ↓
Middleware finally block
    └─ ctx.saveSession() ← Persist to Redis
    ↓
Response sent to Telegram
```

### Multi-Step Flow Pattern

Users can navigate through multiple steps using session state:

```javascript
// Step 1: User clicks button
bot.action('start_search', async (ctx) => {
  ctx.session.temp.adminSearchingUser = true;
  await ctx.saveSession();
  await ctx.reply('Send user ID to search');
});

// Step 2: User sends text
bot.on('text', async (ctx, next) => {
  if (ctx.session.temp?.adminSearchingUser) {
    const userId = ctx.message.text;
    // Process search
    ctx.session.temp.adminSearchingUser = false;
    await ctx.saveSession();
  }
  return next();
});
```

---

## 3. EXISTING MODERATION FEATURES

### ✅ EXISTING SECURITY MEASURES

#### 3.1 Rate Limiting
**File**: `src/bot/core/middleware/rateLimit.js`

- **Type**: User-level request throttling
- **Storage**: Redis (RateLimiterRedis)
- **Config**:
  - Default: 30 requests per 60 seconds
  - Configurable via: `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`
  - Block duration: 60 seconds if exceeded
- **Response**: User receives warning message with retry time
- **Behavior**: Prevents spam/DoS from single users

```javascript
// From middleware/rateLimit.js
const limiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000,
  blockDuration: 60,
});
```

#### 3.2 Input Validation & Sanitization
**File**: `src/utils/validation.js`

- Sanitizes user inputs (text, bio, username)
- Schema validation using Joi
- Max text length: 500 characters
- Removes/escapes dangerous characters

```javascript
// From helpers.js
const validateUserInput = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed.substring(0, maxLength);
};
```

#### 3.3 Admin Permission Checks
**File**: `src/bot/services/userService.js` (Lines 166-169)

```javascript
static isAdmin(userId) {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(userId.toString());
}
```

**Usage**: Hard-coded in every admin action handler

```javascript
if (!UserService.isAdmin(ctx.from.id)) {
  await ctx.reply(t('unauthorized', getLanguage(ctx)));
  return;
}
```

**Configuration**:
```env
ADMIN_USER_IDS=123456789,987654321
```

#### 3.4 Session Security
**File**: `src/bot/core/middleware/session.js`

- **Storage**: Redis (primary) with in-memory fallback
- **Session Key Format**: `session:{userId}`
- **TTL**: 24 hours (configurable via `SESSION_TTL`)
- **Auto-Save**: Session saved in middleware finally block
- **Scope**: Per-user state, multi-step flow support

```javascript
ctx.saveSession();  // Explicitly save
ctx.clearSession(); // Clear session data
```

#### 3.5 API Security
**File**: `src/bot/api/routes.js`

- **Helmet.js**: HTTP header security
- **CORS**: Cross-origin restrictions
- **Compression**: Response compression
- **API Rate Limiting**: 100 req/15min
- **Webhook Rate Limiting**: 50 req/5min (stricter)
- **Body Parsing**: JSON/URL-encoded with size limits

#### 3.6 Subscription-Based Access Control
**File**: `src/bot/services/userService.js` (Lines 132-159)

```javascript
static async hasActiveSubscription(userId) {
  const user = await UserModel.getById(userId);
  if (!user || user.subscriptionStatus !== 'active') return false;
  
  // Check expiry date
  if (user.planExpiry) {
    const expiry = user.planExpiry.toDate?.() || new Date(user.planExpiry);
    if (expiry < new Date()) return false;
  }
  return true;
}
```

---

### ❌ MISSING MODERATION FEATURES

| Feature | Status | Impact |
|---------|--------|--------|
| User blocking/banning | NOT IMPLEMENTED | Users can't prevent unwanted contact |
| Message filtering (spam/profanity) | NOT IMPLEMENTED | No content moderation |
| Content reporting mechanism | NOT IMPLEMENTED | Users have no way to report violations |
| Moderation logs/audit trail | NOT IMPLEMENTED | No accountability or history tracking |
| Group chat moderation | NOT IMPLEMENTED | Bot doesn't work in groups |
| Keyword/pattern-based filtering | NOT IMPLEMENTED | Can't block specific content types |
| User reputation/trust system | NOT IMPLEMENTED | No way to identify problematic users |
| Content deletion/editing controls | NOT IMPLEMENTED | Admin can't remove user content |
| Warned user tracking | NOT IMPLEMENTED | No escalation system |
| Appeal/review process | NOT IMPLEMENTED | Bans are permanent with no recourse |

---

## 4. DATABASE/STORAGE SYSTEM

### Primary Database: Firebase Firestore (NoSQL)

#### Collections Schema

```
firestore/
├── users/
│   └── {userId}
│       ├── userId (number) - Telegram user ID
│       ├── username (string) - @username
│       ├── firstName (string)
│       ├── lastName (string)
│       ├── email (string, optional)
│       ├── language (string) - 'en' or 'es'
│       ├── subscriptionStatus (string) - 'free'|'active'|'expired'|'deactivated'
│       ├── planId (string) - Reference to plan
│       ├── planExpiry (timestamp)
│       ├── location (object)
│       │   ├── lat (number)
│       │   ├── lng (number)
│       │   └── address (string, optional)
│       ├── interests (array) - User interests/hobbies
│       ├── bio (string) - User description
│       ├── photoUrl (string) - Profile picture URL
│       ├── createdAt (timestamp)
│       └── updatedAt (timestamp)
│
├── plans/
│   └── {planId}
│       ├── id (string)
│       ├── name (string)
│       ├── nameEs (string)
│       ├── price (number)
│       ├── features (array)
│       ├── featuresEs (array)
│       ├── active (boolean)
│       └── createdAt (timestamp)
│
├── payments/
│   └── {paymentId}
│       ├── userId (string)
│       ├── planId (string)
│       ├── provider (string) - 'epayco'|'daimo'
│       ├── status (string) - 'pending'|'completed'|'failed'
│       ├── amount (number)
│       ├── currency (string)
│       ├── paymentUrl (string)
│       ├── transactionId (string)
│       ├── createdAt (timestamp)
│       └── updatedAt (timestamp)
│
└── liveStreams/
    └── {streamId}
        ├── userId (string)
        ├── title (string)
        ├── description (string)
        ├── streamUrl (string)
        ├── status (string) - 'active'|'ended'
        ├── createdAt (timestamp)
        └── updatedAt (timestamp)
```

### Cache Layer: Redis

**Used For**:
- User sessions (key: `session:{userId}`)
- User data caching (key: `user:{userId}`)
- Nearby users queries (key: `nearby:{lat},{lng}:{radius}`)
- Statistics caching (key: `stats:users`)
- Rate limiter counters (key: `ratelimit:*`)

**Default TTLs**:
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `session:*` | 24 hours | User session state |
| `user:*` | 10 minutes | User profile cache |
| `nearby:*` | 5 minutes | Geolocation queries |
| `stats:*` | 1 minute | Statistics (updates frequently) |
| `plan:*` | 1 hour | Subscription plan data |

### Database Indexes (Firestore)

Required for efficient queries:

```
Index 1: users collection
  Fields: subscriptionStatus (ASC), planExpiry (ASC)
  Use: Expired subscription detection

Index 2: users collection
  Fields: location.lat (ASC), location.lng (ASC)
  Use: Nearby user searches

Index 3: users collection
  Fields: interests (ARRAY_CONTAINS), subscriptionStatus (ASC)
  Use: User discovery by interests

Index 4: payments collection
  Fields: userId (ASC), createdAt (DESC)
  Use: User payment history

Index 5: liveStreams collection
  Fields: status (ASC), createdAt (DESC)
  Use: Active streams listing
```

**Deploy Indexes**:
```bash
npm run validate:indexes
```

---

## 5. PERMISSIONS & GROUP ADMINISTRATION

### Current Permission System

#### Admin-Only Access

**Source**: `src/bot/services/userService.js` (Lines 166-169)

```javascript
static isAdmin(userId) {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(userId.toString());
}
```

**Configuration**:
```env
ADMIN_USER_IDS=123456789,987654321
```

**Usage Pattern**:
```javascript
bot.action('admin_users', async (ctx) => {
  if (!UserService.isAdmin(ctx.from.id)) {
    await ctx.reply(t('unauthorized', getLanguage(ctx)));
    return;
  }
  // Admin-only logic
});
```

**Admin Capabilities**:
- `/admin` - Admin panel access
- `/stats` - Real-time statistics (users, revenue)
- User management:
  - Search users by ID
  - Extend subscriptions
  - Deactivate accounts
- Broadcast messages:
  - To all users
  - To premium users only
  - To free users only
- Plan management:
  - View active plans
  - Add/edit plans
- Analytics:
  - User metrics
  - Revenue tracking
  - Conversion rates

#### Subscription-Based Access

Some features require active subscription:

```javascript
// Check if user can access premium feature
const hasSubscription = await UserService.hasActiveSubscription(userId);
if (!hasSubscription) {
  await ctx.reply('This feature requires PRIME subscription');
  return;
}
```

**Premium Features**:
- Live streaming
- Ad-free radio
- Premium content

### MISSING GROUP/CHANNEL Features

Current implementation is **DM-only**. No support for:

- Group chat moderation
- Channel administration
- Group-specific permissions
- Moderator roles
- Message approval workflows
- Group rules enforcement
- Group member restrictions
- Pinned messages moderation
- Invite link management
- Group statistics

**Note**: `ctx.chat?.id` is available in middleware, but handlers don't check `ctx.chat.type` for group vs. DM distinction.

---

## 6. MIDDLEWARE & SECURITY ARCHITECTURE

### Middleware Stack

**Order of Execution**:

1. **Session Middleware** (`src/bot/core/middleware/session.js`)
   - Loads session from Redis or in-memory store
   - Attaches to `ctx.session`
   - Provides `ctx.saveSession()` and `ctx.clearSession()`

2. **Rate Limit Middleware** (`src/bot/core/middleware/rateLimit.js`)
   - Checks per-user request quota
   - Uses Redis RateLimiterRedis
   - Blocks if exceeded

3. **Handler Layer**
   - Matching command/action/text handler executes
   - Error handling via try/catch
   - Response sent to user

4. **Auto-Save** (in finally block)
   - Session data persisted to Redis
   - Happens automatically after each update

### Request Lifecycle

```
┌─────────────────────────────────────┐
│  User sends message/presses button  │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  sessionMiddleware()                │
│  - Load Redis/in-memory session     │
│  - Attach ctx.session               │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  rateLimitMiddleware()               │
│  - Check request quota               │
│  - Block if exceeded                 │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Handler Matching & Execution       │
│  - bot.command/action/on('text')    │
│  - Permission checks                │
│  - Service/Model calls              │
│  - Error handling                   │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Response to User                   │
│  - ctx.reply() or editMessageText()  │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  finally block auto-save            │
│  - ctx.saveSession() to Redis       │
└─────────────────────────────────────┘
```

### Express API Security

**File**: `src/bot/api/routes.js`

```javascript
// Security middleware stack
app.use(helmet());                  // HTTP headers
app.use(cors());                    // Cross-origin
app.use(compression());             // Response compression
app.use(express.json());            // Body parsing
app.use(express.urlencoded({extended: true}));

// Rate limiting for API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,         // 15 minutes
  max: 100,                          // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter webhook rate limiting
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,          // 5 minutes
  max: 50,                           // 50 requests
});
```

---

## 7. RECOMMENDED MODERATION IMPLEMENTATION

### Implementation Phases

#### Phase 1: Moderation Data Model

**Create**: `src/models/moderationModel.js`

**New Firestore Collections**:

```
moderation/
├── blocked_users/
│   └── {relationshipId}
│       ├── blockerId (string)
│       ├── blockedUserId (string)
│       ├── reason (string)
│       ├── createdAt (timestamp)
│       └── expiresAt (timestamp, optional)
│
├── reports/
│   └── {reportId}
│       ├── reporterId (string)
│       ├── reportedUserId (string)
│       ├── type (string) - 'spam'|'harassment'|'fraud'|'content'
│       ├── reason (string)
│       ├── evidence (array) - messageIds or screenshots
│       ├── status (string) - 'new'|'reviewing'|'resolved'|'dismissed'
│       ├── resolution (string, optional)
│       ├── createdAt (timestamp)
│       └── resolvedAt (timestamp, optional)
│
├── moderation_logs/
│   └── {logId}
│       ├── action (string) - 'warn'|'ban'|'unban'|'filter'
│       ├── targetUserId (string)
│       ├── moderatorId (string)
│       ├── reason (string)
│       ├── duration (number, optional - minutes)
│       ├── previousStatus (string)
│       ├── newStatus (string)
│       ├── createdAt (timestamp)
│       └── metadata (object)
│
├── filter_rules/
│   └── {ruleId}
│       ├── type (string) - 'keyword'|'pattern'|'url'
│       ├── pattern (string/regex)
│       ├── action (string) - 'warn'|'delete'|'block'
│       ├── severity (string) - 'low'|'medium'|'high'
│       ├── active (boolean)
│       ├── description (string)
│       └── createdAt (timestamp)
│
└── user_status/
    └── {userId}
        ├── warnings (number)
        ├── status (string) - 'active'|'muted'|'banned'
        ├── muteUntil (timestamp, optional)
        ├── banReason (string, optional)
        ├── lastWarning (timestamp, optional)
        └── updatedAt (timestamp)
```

#### Phase 2: Moderation Service

**Create**: `src/bot/services/moderationService.js`

**Key Methods**:

```javascript
class ModerationService {
  // User blocking
  static async blockUser(blockerId, blockedUserId, reason, duration)
  static async unblockUser(blockerId, blockedUserId)
  static async isUserBlocked(userId, targetUserId)
  
  // Reporting
  static async reportUser(reporterId, reportedUserId, type, reason, evidence)
  static async getReports(status, limit, offset)
  static async resolveReport(reportId, action, reason)
  
  // Warnings & Bans
  static async warnUser(userId, moderatorId, reason)
  static async banUser(userId, moderatorId, reason, duration)
  static async unbanUser(userId, moderatorId, reason)
  static async muteUser(userId, moderatorId, reason, duration)
  
  // Message filtering
  static async filterMessage(message, userId)
  static async getFilterRules()
  static async addFilterRule(type, pattern, action, severity)
  
  // Logging
  static async logAction(action, targetUserId, moderatorId, reason, metadata)
  static async getModerationLog(userId, limit)
}
```

#### Phase 3: Message Filter Middleware

**Create**: `src/bot/core/middleware/messageFilter.js`

```javascript
const messageFilterMiddleware = () => {
  return async (ctx, next) => {
    // Check if user is blocked
    if (await isUserBlocked(ctx.from.id)) {
      await ctx.reply('Your account has been blocked');
      return;
    }
    
    // Filter text messages
    if (ctx.message?.text) {
      const filterResult = await ModerationService.filterMessage(
        ctx.message.text,
        ctx.from.id
      );
      
      if (filterResult.blocked) {
        await logAction('filter_triggered', ctx.from.id);
        await ctx.reply('Your message contains prohibited content');
        return;
      }
    }
    
    return next();
  };
};
```

#### Phase 4: User-Facing Moderation Handlers

**Create**: `src/bot/handlers/moderation/index.js`

```javascript
bot.command('report', async (ctx) => {
  // Start report flow
});

bot.command('block', async (ctx) => {
  // Block user
});

bot.command('unblock', async (ctx) => {
  // Unblock user
});
```

#### Phase 5: Admin Moderation Panel

**Modify**: `src/bot/handlers/admin/index.js`

```javascript
// Add to admin panel menu
bot.action('admin_moderation', async (ctx) => {
  // Show moderation dashboard
});

bot.action('view_reports', async (ctx) => {
  // List pending reports
});

bot.action('moderation_logs', async (ctx) => {
  // View moderation history
});
```

### Implementation Checklist

```
Phase 1: Data Model
[ ] Create moderationModel.js with all collections
[ ] Add Firestore indexes for moderation queries
[ ] Add cache keys for blocked users

Phase 2: Service Layer
[ ] Implement ModerationService class
[ ] Add all core methods (block, report, ban, filter)
[ ] Add logging functionality

Phase 3: Middleware
[ ] Create messageFilter middleware
[ ] Integrate into bot.js middleware stack
[ ] Test with blocked users

Phase 4: User Handlers
[ ] Create /report command
[ ] Create /block command
[ ] Create /unblock command
[ ] Add to user menu

Phase 5: Admin Panel
[ ] Add moderation section to admin panel
[ ] Create reports dashboard
[ ] Create logs viewer
[ ] Create filter rules manager

Phase 6: Testing & Docs
[ ] Unit tests for all services
[ ] Integration tests for handlers
[ ] Update API documentation
[ ] Add moderation guide
```

---

## QUICK FILE REFERENCE

### Entry Points
- `src/bot/core/bot.js` - Bot initialization
- `src/bot/api/routes.js` - API routes
- `package.json` - Dependencies & scripts

### Handler Files
- `src/bot/handlers/user/index.js` - User features
- `src/bot/handlers/admin/index.js` - Admin panel
- `src/bot/handlers/payments/index.js` - Payments
- `src/bot/handlers/media/index.js` - Media features

### Models
- `src/models/userModel.js` - User data
- `src/models/paymentModel.js` - Payments
- `src/models/planModel.js` - Subscription plans

### Services
- `src/bot/services/userService.js` - User business logic
- `src/bot/services/paymentService.js` - Payment logic
- `src/bot/services/cacheService.js` - Cache operations

### Middleware
- `src/bot/core/middleware/session.js` - Session management
- `src/bot/core/middleware/rateLimit.js` - Rate limiting
- `src/bot/core/middleware/errorHandler.js` - Error handling

### Configuration
- `src/config/firebase.js` - Firebase setup
- `src/config/redis.js` - Redis setup
- `.env.example` - Environment variables

### Utilities
- `src/bot/utils/helpers.js` - Helper functions
- `src/utils/i18n.js` - Translations (en/es)
- `src/utils/validation.js` - Input validation
- `src/utils/logger.js` - Logging

---

## KEY ENVIRONMENT VARIABLES

```env
# Bot
BOT_TOKEN=xxxxx
BOT_WEBHOOK_DOMAIN=https://yourdomain.com
NODE_ENV=production

# Database
FIREBASE_PROJECT_ID=xxxxx
FIREBASE_PRIVATE_KEY=xxxxx
FIREBASE_CLIENT_EMAIL=xxxxx

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Admin
ADMIN_USER_IDS=123456789,987654321

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=30
RATE_LIMIT_WINDOW_MS=60000

# Session
SESSION_TTL=86400
```

---

## NEXT STEPS FOR MODERATION FEATURES

1. **Review** this architecture document
2. **Create** `src/models/moderationModel.js` with Firestore schema
3. **Implement** `src/bot/services/moderationService.js` with core logic
4. **Integrate** message filter middleware into bot initialization
5. **Add** moderation handlers and admin panel
6. **Test** with sample data and user flows
7. **Document** moderation rules and processes

---

**Questions?** Review the file paths and code sections above to understand how the system works!
