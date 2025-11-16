# Quick Reference: Key Files & Locations

## ENTRY POINTS & INITIALIZATION
- **Main Entry**: `/home/user/pnptvbot-production/src/bot/core/bot.js` (166 lines)
- **API Routes**: `/home/user/pnptvbot-production/src/bot/api/routes.js` (102 lines)
- **Package Config**: `/home/user/pnptvbot-production/package.json`

## HANDLER FILES
- **User Handlers** (Main): `/home/user/pnptvbot-production/src/bot/handlers/user/index.js`
  - Onboarding: `user/onboarding.js`
  - Menu: `user/menu.js`
  - Profile: `user/profile.js`
  - Nearby: `user/nearby.js`
  - Settings: `user/settings.js`

- **Admin Handlers**: `/home/user/pnptvbot-production/src/bot/handlers/admin/index.js` (397 lines)
  - Admin check: line 18, 42, 102, 144, 166, 227, 249, 341, 372

- **Payment Handlers**: `/home/user/pnptvbot-production/src/bot/handlers/payments/index.js`

- **Media Handlers**: `/home/user/pnptvbot-production/src/bot/handlers/media/index.js`
  - Radio: `media/radio.js`
  - Zoom: `media/zoom.js`
  - Live: `media/live.js`
  - Support: `media/support.js` (224 lines - includes AI chat)

## MODELS (DATABASE LAYER)
- **User Model**: `/home/user/pnptvbot-production/src/models/userModel.js` (390 lines)
  - Methods: createOrUpdate, getById, updateProfile, updateSubscription, getNearby, delete, getStatistics
  
- **Payment Model**: `/home/user/pnptvbot-production/src/models/paymentModel.js` (155+ lines)
  - Methods: create, getById, updateStatus, getByUser, getByProvider
  
- **Plan Model**: `/home/user/pnptvbot-production/src/models/planModel.js` (130+ lines)
  - Methods: getAll, getById, createOrUpdate, prewarmCache

## SERVICES (BUSINESS LOGIC)
- **User Service**: `/home/user/pnptvbot-production/src/bot/services/userService.js` (224 lines)
  - Key: `isAdmin(userId)` at line 166-169
  - Methods: getOrCreateFromContext, updateProfile, hasActiveSubscription, getStatistics

- **Payment Service**: `/home/user/pnptvbot-production/src/bot/services/paymentService.js`

- **Cache Service**: `/home/user/pnptvbot-production/src/bot/services/cacheService.js`

## MIDDLEWARE
- **Session Middleware**: `/home/user/pnptvbot-production/src/bot/core/middleware/session.js` (102 lines)
  - Redis-backed with fallback to in-memory
  - Session key: `session:{userId}`
  - TTL: 86400 seconds (configurable via SESSION_TTL)

- **Rate Limit Middleware**: `/home/user/pnptvbot-production/src/bot/core/middleware/rateLimit.js` (68 lines)
  - Default: 30 requests per 60 seconds
  - Configurable: RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS
  - Blocks for 60 seconds if exceeded

- **Error Handler**: `/home/user/pnptvbot-production/src/bot/core/middleware/errorHandler.js` (50 lines)
  - Integrates with Sentry
  - Sends user-friendly error messages

## CONFIGURATION
- **Firebase**: `/home/user/pnptvbot-production/src/config/firebase.js` (113 lines)
  - Functions: initializeFirebase, getFirestore, getAdmin, createIndexes
  
- **Redis**: `/home/user/pnptvbot-production/src/config/redis.js`

## UTILITIES
- **Helpers**: `/home/user/pnptvbot-production/src/bot/utils/helpers.js` (133 lines)
  - Functions: getLanguage, safeHandler, validateUserInput, isSessionExpired, setSessionState, getSessionState, clearSessionState

- **i18n**: `/home/user/pnptvbot-production/src/utils/i18n.js`
  - Supports English ('en') and Spanish ('es')
  - Function: `t(key, language, params)`

- **Validation**: `/home/user/pnptvbot-production/src/utils/validation.js`
  - Schema validation using Joi
  - Sanitization functions

- **Logger**: `/home/user/pnptvbot-production/src/utils/logger.js`
  - Winston logger with daily rotation
  - Log levels: info, warn, error, debug

## ENVIRONMENT VARIABLES
**File**: `/home/user/pnptvbot-production/.env.example` (105 lines)

**Critical Variables**:
- `BOT_TOKEN` - Telegram bot token
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- `ADMIN_USER_IDS` - Comma-separated admin user IDs (e.g., "123456789,987654321")

**Rate Limiting**:
- `RATE_LIMIT_MAX_REQUESTS=30` (default)
- `RATE_LIMIT_WINDOW_MS=60000` (default)

**Session**:
- `SESSION_TTL=86400` (24 hours default)

## PERMISSION CHECKS

### Admin Check Pattern
```javascript
if (!UserService.isAdmin(ctx.from.id)) {
  await ctx.reply(t('unauthorized', getLanguage(ctx)));
  return;
}
```

Found in these handlers:
- admin/index.js: Lines 18, 42, 102, 144, 166, 227, 249, 341, 372

### Subscription Check Pattern
```javascript
const hasSubscription = await UserService.hasActiveSubscription(userId);
```

## DATABASE SCHEMA

### Users Collection Fields
```javascript
{
  userId: number,
  username: string,
  firstName: string,
  lastName: string,
  email: string (optional),
  language: 'en' | 'es',
  subscriptionStatus: 'free' | 'active' | 'expired' | 'deactivated',
  planId: string,
  planExpiry: timestamp,
  location: { lat: number, lng: number, address: string },
  interests: string[],
  bio: string,
  photoUrl: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Firestore Indexes
Location: `src/config/firebase.js` lines 65-102
- Index 1: users(subscriptionStatus, planExpiry)
- Index 2: users(location.lat, location.lng)
- Index 3: users(interests, subscriptionStatus)
- Index 4: payments(userId, createdAt)
- Index 5: liveStreams(status, createdAt)

## API ENDPOINTS
- **Health Check**: `GET /health`
- **Webhook (Telegram)**: `POST /webhook/telegram`
- **Stats**: `GET /api/stats`
- **Webhooks**:
  - `POST /api/webhooks/epayco`
  - `POST /api/webhooks/daimo`
- **Payment Response**: `GET /api/payment-response`

## SECURITY FEATURES

### Existing
1. Rate limiting (30 req/60s per user)
2. Input validation & sanitization
3. Admin permission checks
4. Session security (Redis + TTL)
5. Helmet.js for HTTP security
6. CORS protection
7. Sentry error tracking

### Missing
1. Message filtering/spam detection
2. User blocking/banning
3. Content moderation
4. Report system
5. Moderation audit logs
6. Group moderation

## STRUCTURE FOR ADDING MODERATION

### New Files Needed
```
src/models/
└── moderationModel.js (NEW)

src/bot/services/
└── moderationService.js (NEW)

src/bot/handlers/moderation/
├── index.js (NEW)
└── (specific handlers as needed)

src/bot/core/middleware/
└── messageFilter.js (NEW)
```

### Files to Modify
```
src/bot/handlers/admin/index.js (add moderation panel)
src/bot/core/bot.js (register new handlers)
src/utils/i18n.js (add moderation translations)
```

