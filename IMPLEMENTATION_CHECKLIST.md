# Implementation Checklist - Monetization System

## Phase 1: Core Infrastructure ✅

- [x] Database migration (10 new tables)
- [x] Data models (4 files)
- [x] Services layer (3 files)
- [x] Controllers (3 files)
- [x] Middleware (2 files)
- [x] Route definitions (3 files)
- [x] Configuration management
- [x] Documentation
- [x] Setup scripts
- [x] Testing scripts

## Phase 2: Integration Points

### Database Integration
- [x] Create migration file
- [ ] Run migration on staging
- [ ] Run migration on production
- [ ] Verify all tables created
- [ ] Test data operations

### Route Registration
- [x] Add route imports to routes.js
- [x] Register auth routes
- [x] Register subscription routes
- [x] Register model routes
- [ ] Test all endpoints accessible

### Session Management
- [x] Session middleware already in place
- [x] Redis store configured
- [ ] Verify session persistence
- [ ] Test token expiration

## Phase 3: Dependencies

### Required Packages
- [ ] bcryptjs - `npm install bcryptjs`
- [ ] uuid - `npm install uuid`
- [ ] Both already in package.json? Verify with `npm list bcryptjs uuid`

### Optional Enhancements
- [ ] Email notifications (nodemailer)
- [ ] SMS notifications (twilio)
- [ ] Crypto conversion (cryptocompare API)
- [ ] File uploads (aws-sdk)

## Phase 4: Environment Configuration

### .env.production
- [ ] `SESSION_SECRET` - Generated random key
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `POSTGRES_PASSWORD` - DB password (quoted)
- [ ] `EPAYCO_PUBLIC_KEY` - ePayco API key
- [ ] `EPAYCO_PRIVATE_KEY` - ePayco secret key
- [ ] `EPAYCO_TEST_MODE` - true/false
- [ ] `DAIMO_API_KEY` - Daimo API key
- [ ] `DAIMO_API_SECRET` - Daimo secret
- [ ] `MIN_WITHDRAWAL_USD` - Default: 10
- [ ] `DEFAULT_REVENUE_SPLIT_PERCENTAGE` - Default: 80
- [ ] `USD_TO_COP_RATE` - Exchange rate (default: 4000)

### ecosystem.config.js
- [ ] Add all ENV variables to env_production section
- [ ] Verify database credentials match
- [ ] Set correct PORT (3001)

## Phase 5: Admin Setup

### Create Admin User
```sql
INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'admin',
  '$2a$10$...',  -- bcryptjs hash of password
  'admin',
  NOW(),
  NOW()
);
```

- [ ] Create at least one admin account
- [ ] Test admin login at `/admin-login`
- [ ] Verify admin can access `/api/admin/*` endpoints

### Initialize Subscription Plans
```bash
node scripts/temp-init-plans.js
# or
./scripts/setup-monetization.sh
```

- [ ] Run initialization script
- [ ] Verify plans created in database
- [ ] Check plan IDs for checkout

## Phase 6: Payment Gateway Setup

### ePayco Integration
- [ ] Get API keys from ePayco dashboard
- [ ] Add credentials to .env
- [ ] Set test mode to true for staging
- [ ] Configure webhook URL: `https://yourdomain.com/api/payments/epayco-webhook`
- [ ] Test with test card: 4111111111111111
- [ ] Verify webhook signatures

### Daimo Integration
- [ ] Get API credentials
- [ ] Add to .env
- [ ] Set up wallet for testing
- [ ] Configure webhook URL: `https://yourdomain.com/api/payments/daimo-webhook`
- [ ] Test USDC transfer

## Phase 7: Frontend Integration

### Pages to Create/Update
- [ ] `/admin-login` - Admin login form
- [ ] `/model-login` - Model login form
- [ ] `/model-dashboard` - Main dashboard
- [ ] `/model/premium-upload` - Content upload
- [ ] `/model/earnings` - Earnings view
- [ ] `/model/withdrawals` - Withdrawal requests
- [ ] `/subscriptions` - Plan listing
- [ ] `/checkout` - Payment checkout

### Frontend Components
- [ ] Login forms with validation
- [ ] Subscription plan cards
- [ ] Dashboard widgets
- [ ] Content management table
- [ ] Earnings chart
- [ ] Withdrawal request form
- [ ] Profile update form

## Phase 8: Testing

### API Testing
```bash
./scripts/test-monetization-api.sh
```

- [ ] Run automated tests
- [ ] All endpoints respond
- [ ] Auth flows work
- [ ] Data persistence verified

### Manual Testing (cURL)
- [ ] Test admin login: `CURL_EXAMPLES.md`
- [ ] Test model registration
- [ ] Test subscription checkout
- [ ] Test content upload
- [ ] Test earnings view
- [ ] Test withdrawal request
- [ ] Test all error cases

### Database Testing
- [ ] Connect to database directly
- [ ] Verify data in subscription_plans
- [ ] Verify data in user_subscriptions
- [ ] Verify data in model_earnings
- [ ] Verify data in withdrawals

### Payment Testing
- [ ] Test ePayco sandbox payment
- [ ] Verify webhook received
- [ ] Verify payment status updated
- [ ] Verify subscription activated
- [ ] Test Daimo sandbox transfer
- [ ] Verify crypto conversion

## Phase 9: Security Hardening

- [ ] Enable HTTPS on all payment endpoints
- [ ] Verify webhook signature verification
- [ ] Check password hashing (bcryptjs cost factor >= 10)
- [ ] Enable CSRF protection
- [ ] Test SQL injection prevention (parameterized queries)
- [ ] Test XSS prevention (input sanitization)
- [ ] Enable rate limiting on auth endpoints
- [ ] Test unauthorized access attempts
- [ ] Review audit logs

## Phase 10: Monitoring & Logging

- [ ] Set up application logging to file
- [ ] Configure log rotation
- [ ] Monitor database queries
- [ ] Set up error alerting
- [ ] Configure payment webhook retries
- [ ] Set up withdrawal processing cron
- [ ] Monitor subscription expiration
- [ ] Track revenue metrics

## Phase 11: Deployment

### Staging Deployment
- [ ] Deploy migration
- [ ] Deploy code changes
- [ ] Initialize plans
- [ ] Run full test suite
- [ ] Verify webhooks
- [ ] Load test with dummy data

### Production Deployment
- [ ] Database backup before migration
- [ ] Run migration in maintenance window
- [ ] Deploy code
- [ ] Initialize production plans
- [ ] Smoke test all endpoints
- [ ] Monitor error logs
- [ ] Enable new features gradually

## Phase 12: Go-Live Checklist

- [ ] All endpoints tested
- [ ] Admin users created
- [ ] Payment gateways configured
- [ ] Email notifications working
- [ ] Withdrawal processing configured
- [ ] Documentation complete
- [ ] Support team trained
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place
- [ ] Rollback plan documented

## Post-Launch

- [ ] Monitor error rates
- [ ] Track payment success rates
- [ ] Monitor withdrawal processing
- [ ] Gather user feedback
- [ ] Fix any issues
- [ ] Optimize performance
- [ ] Expand to new payment methods
- [ ] Add advanced features

---

## File Inventory

### Database (1 file)
```
database/migrations/
  └── 058_auth_payments_monetization.sql
```

### Models (4 files)
```
src/models/
  ├── subscriptionModel.js
  ├── paidContentModel.js
  ├── modelEarningsModel.js
  └── withdrawalModel.js
```

### Services (3 files)
```
src/bot/services/
  ├── subscriptionService.js
  ├── modelMonetizationService.js
  └── withdrawalService.js
```

### Controllers (3 files)
```
src/bot/api/controllers/
  ├── authController.js
  ├── subscriptionPaymentController.js
  └── modelController.js
```

### Middleware (2 files)
```
src/bot/api/middleware/
  ├── authGuard.js
  └── roleGuard.js
```

### Routes (3 files)
```
src/bot/api/routes/
  ├── authRoutes.js
  ├── subscriptionRoutes.js
  └── modelRoutes.js
```

### Config (1 file)
```
src/config/
  └── monetizationConfig.js
```

### Documentation (4 files)
```
MONETIZATION_IMPLEMENTATION.md
MONETIZATION_SUMMARY.md
CURL_EXAMPLES.md
IMPLEMENTATION_CHECKLIST.md (this file)
```

### Scripts (2 files)
```
scripts/
  ├── setup-monetization.sh
  └── test-monetization-api.sh
```

---

## Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Core Infrastructure | ✅ Complete | P0 |
| Database Integration | 1-2 hours | P0 |
| Route Registration | ✅ Complete | P0 |
| Environment Config | 30 mins | P0 |
| Admin Setup | 1 hour | P1 |
| Payment Gateways | 2-3 hours | P0 |
| Frontend Integration | 3-5 days | P1 |
| Testing & QA | 2-3 days | P0 |
| Security Hardening | 1 day | P0 |
| Monitoring Setup | 2 hours | P1 |
| Staging Deployment | 1 day | P0 |
| Production Deployment | 1 day | P0 |

**Total Estimated: 2-3 weeks for full production launch**

---

## Quick Start Command

```bash
# Complete setup
./scripts/setup-monetization.sh

# Run tests
./scripts/test-monetization-api.sh

# View documentation
cat MONETIZATION_IMPLEMENTATION.md

# Check curl examples
cat CURL_EXAMPLES.md
```

---

## Support Resources

- **Setup Guide**: `MONETIZATION_IMPLEMENTATION.md`
- **API Examples**: `CURL_EXAMPLES.md`
- **Configuration**: `src/config/monetizationConfig.js`
- **Source Code**: `src/bot/services/`, `src/bot/api/`
- **Database**: `database/migrations/058_auth_payments_monetization.sql`

