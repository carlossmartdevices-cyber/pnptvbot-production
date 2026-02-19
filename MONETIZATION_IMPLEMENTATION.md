# Monetization System Implementation Guide

## Overview

Complete authentication, payment, and monetization system for admins and models on PNPtv platform.

## Components Implemented

### 1. Database Migration
- **File**: `/database/migrations/058_auth_payments_monetization.sql`
- Tables created:
  - `subscription_plans` - Plan definitions
  - `user_subscriptions` - User subscriptions
  - `paid_content` - Model paid content
  - `content_purchases` - Content purchase records
  - `live_streams` - Live streaming history
  - `stream_views` - Stream viewer analytics
  - `model_earnings` - Earnings tracking
  - `withdrawals` - Payout requests
  - `withdrawal_audit_log` - Withdrawal audit trail
  - `session_tokens` - Session management

### 2. Database Models
- **`subscriptionModel.js`** - Subscription plan and user subscription operations
- **`paidContentModel.js`** - Paid content and content purchase management
- **`modelEarningsModel.js`** - Earnings tracking and statistics
- **`withdrawalModel.js`** - Withdrawal request processing and audit trail

### 3. Services
- **`subscriptionService.js`**
  - Initialize default plans
  - Subscribe users to plans
  - Check active subscriptions
  - Feature access validation
  - Stream limit checking
  - Subscription renewal/expiration handling

- **`modelMonetizationService.js`**
  - Process content sales and earnings
  - Generate dashboard statistics
  - Content analytics
  - Revenue trends
  - Top performing content
  - Earnings by type
  - Upload limit validation

- **`withdrawalService.js`**
  - Create withdrawal requests
  - Approve/reject withdrawals
  - Process withdrawals
  - Withdrawal history
  - Audit logging
  - Statistics generation

### 4. Middleware
- **`authGuard.js`** - Requires authentication
- **`roleGuard.js`** - Role-based access control (admin, model, superadmin)

### 5. Controllers
- **`authController.js`**
  - Admin login
  - Model login/registration
  - Logout
  - Auth status checks
  - Admin/model status verification

- **`subscriptionPaymentController.js`**
  - Get subscription plans
  - Get user subscription
  - Create checkout
  - Cancel subscription
  - Payment history
  - Feature access checks

- **`modelController.js`**
  - Dashboard statistics
  - Content upload/management
  - Content deletion
  - Earnings tracking
  - Withdrawal requests
  - Profile updates
  - Content analytics
  - Stream limit checks

### 6. Routes
- **`authRoutes.js`** - `/api/auth/*` endpoints
- **`subscriptionRoutes.js`** - `/api/subscriptions/*` endpoints
- **`modelRoutes.js`** - `/api/model/*` endpoints

## Installation Steps

### 1. Apply Database Migration

```bash
cd /root/pnptvbot-production

# Run migration
psql -U postgres -d pnptv_db -f database/migrations/058_auth_payments_monetization.sql

# Verify tables created
psql -U postgres -d pnptv_db -c "\dt" | grep -E "(subscription_plans|user_subscriptions|paid_content|model_earnings|withdrawals)"
```

### 2. Install Dependencies

All packages required are already in `package.json`:
- `bcryptjs` - Password hashing
- `uuid` - ID generation
- `express` - Already installed
- `express-session` - Already installed

If missing, install:
```bash
npm install bcryptjs uuid
```

### 3. Environment Variables

Add to `.env.production`:

```env
# Authentication
SESSION_SECRET=your-secure-random-key-here

# Database
DATABASE_URL=postgresql://app_user:password@localhost:5432/pnptv_db
POSTGRES_PASSWORD="Apelo801050#"

# Payment Processors
EPAYCO_PUBLIC_KEY=your_epayco_public_key
EPAYCO_PRIVATE_KEY=your_epayco_private_key
EPAYCO_TEST_MODE=false

DAIMO_API_KEY=your_daimo_api_key
DAIMO_API_SECRET=your_daimo_api_secret

# Monetization
MIN_WITHDRAWAL_USD=10
DEFAULT_REVENUE_SPLIT_PERCENTAGE=80
```

### 4. Initialize Default Plans

After migration and deployment, run initialization:

```bash
# Create a setup script to initialize plans
cat > scripts/initialize-plans.js << 'EOF'
const SubscriptionService = require('./src/bot/services/subscriptionService');

(async () => {
  try {
    const plans = await SubscriptionService.initializeDefaultPlans();
    console.log('Plans initialized:', plans.map(p => p.name));
    process.exit(0);
  } catch (error) {
    console.error('Error initializing plans:', error);
    process.exit(1);
  }
})();
EOF

node scripts/initialize-plans.js
```

## API Endpoints

### Authentication

```bash
# Admin Login
POST /api/auth/admin-login
{
  "email": "admin@example.com",
  "password": "securepassword",
  "rememberMe": true
}

# Model Login
POST /api/auth/model-login
{
  "email": "model@example.com",
  "password": "securepassword"
}
# OR
{
  "telegramId": "123456789"
}

# Register Model
POST /api/auth/register-model
{
  "email": "newmodel@example.com",
  "password": "securepassword",
  "username": "modelusername"
}

# Check Auth Status
GET /api/auth/status

# Check Admin Status
GET /api/auth/admin-check

# Check Model Status
GET /api/auth/model-check

# Logout
POST /api/auth/logout
```

### Subscriptions

```bash
# Get Plans
GET /api/subscriptions/plans?role=user
GET /api/subscriptions/plans?role=model

# Get User Subscription
GET /api/subscriptions/my-subscription

# Create Checkout
POST /api/subscriptions/checkout
{
  "planId": "uuid-here",
  "paymentMethod": "epayco"
}

# Cancel Subscription
POST /api/subscriptions/cancel

# Get Payment History
GET /api/subscriptions/history

# Check Feature Access
GET /api/subscriptions/feature-access?feature=unlimitedStreams
```

### Model Operations

```bash
# Get Dashboard
GET /api/model/dashboard

# Upload Content
POST /api/model/content/upload
{
  "title": "My Exclusive Video",
  "description": "Description here",
  "contentType": "video",
  "contentUrl": "https://example.com/video.mp4",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "priceUsd": 9.99,
  "priceCop": 49950,
  "isExclusive": true
}

# Get My Content
GET /api/model/content

# Delete Content
DELETE /api/model/content/{contentId}

# Get Content Analytics
GET /api/model/content/{contentId}/analytics

# Get Earnings
GET /api/model/earnings

# Request Withdrawal
POST /api/model/withdrawal/request
{
  "method": "bank_transfer"
}

# Get Withdrawal History
GET /api/model/withdrawal/history?status=pending

# Get Withdrawable Amount
GET /api/model/withdrawal/available

# Check Streaming Limits
GET /api/model/streaming/limits

# Update Profile
PUT /api/model/profile
{
  "bio": "My bio",
  "avatarUrl": "https://example.com/avatar.jpg",
  "bankAccountOwner": "John Doe",
  "bankAccountNumber": "1234567890",
  "bankCode": "001"
}
```

## Default Subscription Plans

### User Plans

**PRIME ($9.99/month)**
- Unlimited streams access
- Exclusive content
- No ads
- Priority chat
- Revenue split: 20%

### Model Plans

**Creator Starter ($5/month)**
- 1 stream per week
- Content page
- Basic stats
- Monetization enabled
- Revenue split: 75%

**Creator Pro ($15/month)**
- Unlimited streams
- Premium content page
- Advanced stats
- Higher revenue split
- Analytics API
- Revenue split: 80%

**Creator Elite ($50/month)**
- Unlimited streams
- Premium features
- Priority support
- Featured placement
- Custom branding
- Revenue split: 85%

## Database Schema Highlights

### Subscription Plans
```sql
id, name, slug, role, description, price_usd, price_cop,
billing_cycle, features (JSONB), revenue_split_percentage,
max_streams_per_week, max_content_uploads, priority_featured,
priority_support, is_active, created_at, updated_at
```

### User Subscriptions
```sql
id, user_id, plan_id, status, started_at, expires_at,
auto_renew, payment_method, external_subscription_id,
external_provider, metadata (JSONB), created_at, updated_at
```

### Model Earnings
```sql
id, model_id, earnings_type (subscription|content_sale|tip),
source_id, source_type, amount_usd, amount_cop,
platform_fee_usd, status, period_start, period_end,
created_at, updated_at
```

### Withdrawals
```sql
id, model_id, amount_usd, amount_cop, method,
status (pending|approved|processing|completed|failed|cancelled),
reason, response_code, response_message, transaction_id,
external_reference, requested_at, approved_at, processed_at,
created_at, updated_at
```

## Payment Integration

### ePayco Integration
1. Checkout creates payment record
2. Redirects to ePayco gateway
3. ePayco returns webhook confirmation
4. Payment status updated to 'completed'
5. Earnings recorded for models
6. Subscription activated for users

### Daimo Integration (Crypto)
1. Create USDC payment request
2. User scans QR or clicks link
3. Daimo wallet confirms transaction
4. Webhook updates payment status
5. Convert USDC to COP rate
6. Process same as ePayco flow

## Withdrawal Processing

1. **Create Request**
   - Model requests withdrawal
   - Validates bank details
   - Creates withdrawal record with status='pending'

2. **Approve** (Admin)
   - Admin reviews request
   - Approves or rejects
   - Status changes to 'approved' or 'cancelled'

3. **Process** (Scheduled or Manual)
   - Initiate payment to bank account
   - Status changes to 'processing'
   - On success: status='completed', mark earnings as paid
   - On failure: status='failed'

4. **Audit Trail**
   - All status changes logged
   - Admin actions recorded
   - Withdrawal history maintained

## Revenue Split Example

If Creator Pro model receives $100 payment:
- Platform receives: $20 (20%)
- Model receives: $80 (80%)

When model withdraws $80:
- All $80 transferred to bank account
- Earnings marked as 'paid'
- Withdrawal marked as 'completed'

## Frontend Integration

### Login Pages
- `/admin-login` - Admin login form
- `/model-login` - Model login form

### Model Dashboard
- `/model-dashboard` - Main model dashboard
- `/model/premium-upload` - Upload paid content
- `/model/streams` - Manage live streams
- `/model/earnings` - View earnings
- `/model/withdrawals` - Request payouts

### Subscription Pages
- `/subscriptions` - Plan comparison
- `/checkout` - Payment gateway
- `/account/subscription` - Active subscription

## Monitoring & Logging

All operations are logged with:
- User ID
- Action timestamp
- Amount/details
- Success/failure status
- Error messages if applicable

View logs:
```bash
# Recent auth logs
tail -f logs/app.log | grep "login\|logout\|auth"

# Payment processing
tail -f logs/app.log | grep "payment\|earnings\|withdrawal"

# Database operations
tail -f logs/app.log | grep "subscription\|content"
```

## Testing

### Test Authentication
```bash
curl -X POST http://localhost:3001/api/auth/model-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Subscription
```bash
curl -X GET http://localhost:3001/api/subscriptions/plans?role=user \
  -H "Cookie: connect.sid=your-session-id"
```

### Test Model Operations
```bash
curl -X GET http://localhost:3001/api/model/dashboard \
  -H "Cookie: connect.sid=your-session-id"
```

## Troubleshooting

### Password Hashing Error
- Ensure `bcryptjs` is installed
- Check Node version >= 14

### Database Connection
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Verify app_user permissions

### Session Issues
- Ensure Redis is running
- Check SESSION_SECRET is set
- Verify cookie settings in .env

### Payment Processing
- Check ePayco/Daimo credentials
- Verify webhook URLs are configured
- Check payment webhook signatures

## Security Considerations

1. **Authentication**
   - Passwords hashed with bcryptjs
   - Session tokens stored in Redis
   - CSRF protection via session cookies

2. **Authorization**
   - Role-based access control (RBAC)
   - Route-level protection
   - Resource ownership validation

3. **Data Protection**
   - Sensitive data logged securely
   - Bank details encrypted in transit
   - Withdrawal audit trail maintained

4. **Payment Security**
   - Webhook signature verification
   - Idempotent payment processing
   - Transaction state validation

## Next Steps

1. Deploy migration to production
2. Initialize subscription plans
3. Configure payment gateways
4. Set up admin user accounts
5. Create model registration flow
6. Deploy frontend SPA with new pages
7. Configure email notifications
8. Set up withdrawal processing cron
9. Monitor logs and metrics
10. Gather feedback and iterate

## Support

For issues or questions, check:
- `/src/bot/services/` for business logic
- `/src/bot/api/controllers/` for endpoints
- `/src/models/` for database operations
- Environment variables in `.env.production`
