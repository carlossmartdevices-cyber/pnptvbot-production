# Payment History System - Complete Guide

## Overview

The PNPtv payment history system provides comprehensive tracking of all payments across all payment methods (ePayco, Daimo, Meru, Lifetime100, etc.) with analytics, reporting, and automated engagement tools.

## Architecture

```
Payment Methods → PaymentHistoryService → payment_history table
                                       → users.last_payment_* fields
                                       ↓
                        MembershipCleanupService (churn analysis)
                        AdminDashboardService (statistics)
                        RevenueReportService (detailed reports)
                        SubscriptionReminderEmailService (automation)
```

## Core Services

### 1. PaymentHistoryService
**Location**: `src/services/paymentHistoryService.js`

Records all payments and provides lookup/analytics:

```javascript
// Record a payment
await PaymentHistoryService.recordPayment({
  userId: user.id,
  paymentMethod: 'epayco',  // or 'daimo', 'meru', 'lifetime100', etc.
  amount: 50,
  currency: 'USD',
  planId: 'lifetime_pass',
  planName: 'Lifetime Pass',
  product: 'lifetime-pass',
  paymentReference: 'x_ref_payco_12345',  // Required: unique payment ID
  providerTransactionId: 'txn_xyz',       // Optional: provider-specific ID
  webhookData: webhookPayload,            // Optional: full webhook for audit
  ipAddress: req.ip,
  metadata: { promo_code: 'SUMMER50' }
});

// Get user's payment history
const history = await PaymentHistoryService.getUserPaymentHistory(userId, 20);

// Get last payment
const lastPayment = await PaymentHistoryService.getLastPayment(userId);

// Get user stats
const stats = await PaymentHistoryService.getUserPaymentStats(userId);
// Returns: { total_payments, total_amount, methods_used, first_payment, last_payment }

// Get by payment reference
const payment = await PaymentHistoryService.getByReference('x_ref_payco_12345');

// Get by method
const epaycoPayments = await PaymentHistoryService.getByMethod('epayco', 100);

// Check if user has paid
const hasPaid = await PaymentHistoryService.hasUserPaid(userId);

// Get days since last payment
const days = await PaymentHistoryService.getDaysSinceLastPayment(userId);
```

### 2. MembershipCleanupService
**Location**: `src/bot/services/membershipCleanupService.js`

Analyzes churn and identifies users for re-engagement:

```javascript
// Get users churned for 30+ days
const churnedUsers = await MembershipCleanupService.getInactiveChurnedUsers(30, 100);

// Get users expiring in 7-14 days
const expiringUsers = await MembershipCleanupService.getUsersForReEngagement();

// Get churn analysis by payment method
const churnAnalysis = await MembershipCleanupService.getChurnAnalysis();
// Returns breakdown of churned users by payment method with retention metrics

// Get renewal statistics
const stats = await MembershipCleanupService.getRenewalStats(startDate, endDate);
```

### 3. AdminDashboardService
**Location**: `src/services/adminDashboardService.js`

Comprehensive dashboard statistics:

```javascript
// Get complete dashboard overview
const dashboard = await AdminDashboardService.getDashboardOverview();
// Returns: {
//   timestamp, payments, revenue, membership, churn, topMethods, recentTransactions
// }

// Get payment overview
const paymentStats = await AdminDashboardService.getPaymentOverview();
// Returns: total_payments, unique_payers, completed/pending/failed, total_revenue, etc.

// Get revenue for last 30 days
const revenue = await AdminDashboardService.getRevenueOverview();
// Returns: daily breakdown and monthly totals

// Get payment method performance
const methods = await AdminDashboardService.getTopPaymentMethods();

// Get conversion metrics
const conversions = await AdminDashboardService.getConversionMetrics();

// Get customer lifetime value
const clv = await AdminDashboardService.getCustomerLifetimeValue();

// Generate admin report text
const report = await AdminDashboardService.generateAdminReport();
// Formatted for Telegram with emojis and markdown
```

### 4. RevenueReportService
**Location**: `src/services/revenueReportService.js`

Detailed revenue analysis and reporting:

```javascript
// Revenue by date range, grouped by day/week/month/method
const report = await RevenueReportService.getRevenueReport(startDate, endDate, 'day');
// Returns: { period, groupedBy, data[], totals }

// Revenue breakdown by payment method
const byMethod = await RevenueReportService.getRevenueByMethod(startDate, endDate);

// Revenue breakdown by product
const byProduct = await RevenueReportService.getRevenueByProduct(startDate, endDate);

// Month-over-month comparison
const mom = await RevenueReportService.getMonthOverMonthComparison();
// Returns: currentMonth data, previousMonth data, growth percentages

// Top spenders
const topSpenders = await RevenueReportService.getTopSpenders(10, startDate, endDate);

// Revenue by currency
const byCurrency = await RevenueReportService.getRevenueByGurrency(startDate, endDate);

// Customer lifetime value statistics
const clvStats = await RevenueReportService.getCustomerLifetimeValueStats();
// Returns: averages, minimums, maximums, percentiles (p50, p75, p90)

// Payment method performance metrics
const methodPerf = await RevenueReportService.getPaymentMethodPerformance();

// Comprehensive report (all data combined)
const comprehensive = await RevenueReportService.generateComprehensiveReport(startDate, endDate);

// Format for Telegram
const telegramReport = await RevenueReportService.formatReportForTelegram(startDate, endDate);

// Generate CSV export
const csv = RevenueReportService.generateCSV(data, ['column1', 'column2', 'column3']);
```

### 5. SubscriptionReminderEmailService
**Location**: `src/services/subscriptionReminderEmailService.js`

Automated reminder emails for subscriptions:

```javascript
// Send renewal reminders to users expiring in 7-14 days
const results = await SubscriptionReminderEmailService.sendExpiryReminders();
// Returns: { sent, failed, skipped, errors[] }

// Send re-engagement emails to users inactive 30+ days
const results = await SubscriptionReminderEmailService.sendReEngagementEmails();

// Send payment confirmation email
const sent = await SubscriptionReminderEmailService.sendPaymentConfirmationEmail(userId, {
  planName: 'Lifetime Pass',
  amount: 50,
  currency: 'USD',
  paymentMethod: 'epayco',
  language: 'es'
});
```

## Database Schema

### payment_history table
```sql
id (UUID)                    -- Primary key
user_id (VARCHAR)           -- References users.id
payment_method (VARCHAR)     -- 'epayco', 'daimo', 'meru', 'lifetime100', etc.
amount (DECIMAL)            -- Amount paid
currency (VARCHAR)          -- 'USD', 'COP', etc.
plan_id (VARCHAR)           -- Plan identifier
plan_name (VARCHAR)         -- Human-readable plan name
product (VARCHAR)           -- 'lifetime-pass', 'monthly', etc.
payment_reference (VARCHAR) -- Unique payment ID (UNIQUE constraint)
provider_transaction_id     -- Provider-specific transaction ID
provider_payment_id         -- Provider-specific payment ID
webhook_data (JSONB)        -- Full webhook payload for audit
status (VARCHAR)            -- 'completed', 'pending', 'failed', 'refunded'
payment_date (TIMESTAMP)    -- When payment occurred
processed_at (TIMESTAMP)    -- When we processed it
ip_address (INET)           -- User's IP address
user_agent (TEXT)           -- User agent string
metadata (JSONB)            -- Flexible additional data
```

Indexes:
- `idx_payment_history_user_id` - Fast user lookups
- `idx_payment_history_payment_date` - Fast date range queries
- `idx_payment_history_method` - Fast method filtering
- `idx_payment_history_reference` - Fast reference lookups
- `idx_payment_history_status` - Fast status filtering
- `idx_payment_history_user_id_payment_date` - Composite for user history

### users table (added fields)
```sql
last_payment_date (TIMESTAMP)      -- Most recent payment
last_payment_amount (DECIMAL)      -- Amount of last payment
last_payment_method (VARCHAR)      -- Method used for last payment
last_payment_reference (VARCHAR)   -- Reference of last payment
```

**Note**: These fields are automatically updated by a database trigger when records are inserted into `payment_history`.

## Integration Points

### Payment Handlers

All payment handlers call `PaymentHistoryService.recordPayment()` after successful activation:

1. **ePayco** (`src/bot/services/paymentService.js:processEpaycoWebhook()`)
   ```javascript
   await PaymentHistoryService.recordPayment({
     userId: user.id,
     paymentMethod: 'epayco',
     amount: payment.amount,
     currency: payment.currency,
     planId: payment.plan_id,
     paymentReference: x_ref_payco,
     providerTransactionId: x_transaction_id,
     webhookData: req.body,
     metadata: { renewal_status: renewal }
   });
   ```

2. **Daimo** (`src/bot/services/paymentService.js:processDaimoWebhook()`)
   ```javascript
   await PaymentHistoryService.recordPayment({
     userId: payment.user_id,
     paymentMethod: 'daimo',
     amount: payment.amount,
     currency: 'USD',
     planId: payment.plan_id,
     paymentReference: txHash,
     providerTransactionId: txHash,
     metadata: { chain_id: chainId, payer: payer }
   });
   ```

3. **Lifetime100** (`src/bot/handlers/payments/activation.js:activate_lifetime100 handler`)
   ```javascript
   await PaymentHistoryService.recordPayment({
     userId: targetUserId,
     paymentMethod: 'lifetime100',
     amount: 100,
     currency: 'USD',
     planId: 'lifetime100_promo',
     paymentReference: code,
     metadata: { activated_by: adminId, manual_activation: true }
   });
   ```

4. **Meru** (`src/bot/handlers/user/onboarding.js`)
   ```javascript
   await PaymentHistoryService.recordPayment({
     userId: ctx.from.id,
     paymentMethod: 'meru',
     amount: 50,
     currency: 'USD',
     planId: 'lifetime_pass',
     paymentReference: meruCode,
     metadata: { verification_method: 'puppeteer' }
   });
   ```

## Usage Examples

### Admin Commands

```javascript
// In admin handlers (src/bot/handlers/admin/*)

// Show dashboard
bot.hears(/^\/dashboard$/i, async (ctx) => {
  const dashboard = await AdminDashboardService.getDashboardOverview();
  const report = await AdminDashboardService.generateAdminReport();
  await ctx.reply(report, { parse_mode: 'Markdown' });
});

// Show revenue report
bot.hears(/^\/revenue\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})$/i, async (ctx) => {
  const [, start, end] = ctx.match;
  const report = await RevenueReportService.formatReportForTelegram(
    new Date(start),
    new Date(end)
  );
  await ctx.reply(report, { parse_mode: 'Markdown' });
});

// Check user payment history
bot.hears(/^\/userpayments\s+(\d+)$/i, async (ctx) => {
  const userId = ctx.match[1];
  const history = await PaymentHistoryService.getUserPaymentHistory(userId, 10);
  const stats = await PaymentHistoryService.getUserPaymentStats(userId);

  const message = `
User: ${userId}
Total Payments: ${stats.total_payments}
Total Amount: $${stats.total_amount}
Last Payment: ${stats.last_payment}
Payment Methods: ${stats.methods_used}
  `;

  await ctx.reply(message);
});
```

### Scheduled Tasks (cron)

```javascript
// In scripts/cron.js

// Send expiry reminders daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    const results = await SubscriptionReminderEmailService.sendExpiryReminders();
    logger.info('Expiry reminders sent', results);
  } catch (error) {
    logger.error('Failed to send expiry reminders', error);
  }
});

// Send re-engagement emails weekly on Monday
cron.schedule('0 10 * * 1', async () => {
  try {
    const results = await SubscriptionReminderEmailService.sendReEngagementEmails();
    logger.info('Re-engagement emails sent', results);
  } catch (error) {
    logger.error('Failed to send re-engagement emails', error);
  }
});
```

### Web API Routes

```javascript
// In webapps/api/routes/payments.js

// Get payment history for logged-in user
router.get('/api/payments/history', authenticate, async (req, res) => {
  const history = await PaymentHistoryService.getUserPaymentHistory(req.user.id, 50);
  const stats = await PaymentHistoryService.getUserPaymentStats(req.user.id);
  res.json({ history, stats });
});

// Admin: Get revenue report
router.get('/api/admin/reports/revenue', adminOnly, async (req, res) => {
  const { start, end } = req.query;
  const report = await RevenueReportService.generateComprehensiveReport(
    new Date(start),
    new Date(end)
  );
  res.json(report);
});

// Admin: Get dashboard
router.get('/api/admin/dashboard', adminOnly, async (req, res) => {
  const dashboard = await AdminDashboardService.getDashboardOverview();
  res.json(dashboard);
});

// Admin: Export revenue as CSV
router.get('/api/admin/reports/revenue.csv', adminOnly, async (req, res) => {
  const { start, end } = req.query;
  const report = await RevenueReportService.generateComprehensiveReport(
    new Date(start),
    new Date(end)
  );

  const csv = RevenueReportService.generateCSV(report.byMethod, [
    'payment_method',
    'transaction_count',
    'unique_users',
    'total_revenue',
    'success_rate'
  ]);

  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename=revenue_report.csv');
  res.send(csv);
});
```

## Key Features

✅ **Complete Payment Tracking**: Every payment recorded with full audit trail
✅ **Multiple Payment Methods**: ePayco, Daimo, Meru, Lifetime100, plus extensible for Stripe, PayPal, etc.
✅ **Last Payment Tracking**: users.last_payment_* fields auto-updated via database trigger
✅ **Churn Analysis**: Identify users who haven't paid in 30+ days
✅ **Revenue Analytics**: Detailed breakdowns by method, product, date range, currency
✅ **Admin Dashboard**: Real-time statistics and metrics
✅ **Automated Engagement**: Email reminders for expiring and churned users
✅ **CSV Export**: Generate reports for external analysis
✅ **Non-Blocking Recording**: Payment failures don't break main payment flow

## Performance Considerations

- **Indexes**: All frequently queried columns are indexed
- **Composite Index**: (user_id, payment_date DESC) for fast user history queries
- **Trigger**: Database trigger for auto-updating users table eliminates race conditions
- **Query Limits**: Large queries use LIMIT and pagination to avoid timeouts
- **Async Recording**: PaymentHistoryService.recordPayment() runs in background and doesn't block

## Migration Notes

- Migration 046 creates `payment_history` table and adds fields to `users`
- Migration runs automatically on bot startup via `meruLinkInitializer.initialize()`
- No manual SQL execution needed
- All existing payments are recorded going forward

## Troubleshooting

**Issue**: Payment records not appearing in history
- Check: Does webhook actually call PaymentHistoryService.recordPayment()?
- Check: payment_reference must be unique (avoid duplicates)
- Check: Check logs for "Error recording payment" warnings

**Issue**: users.last_payment_date not updating
- Check: Database trigger update_user_last_payment() exists
- Check: Payment status must be 'completed'
- Check: Run `SELECT * FROM payment_history WHERE user_id = 'xyz'` to verify records

**Issue**: Revenue reports showing zero
- Check: All payments have status='completed'
- Check: payment_date is within requested date range
- Check: Run raw query to verify data exists

## Next Steps

1. **Integrate Admin Commands**: Add /dashboard, /revenue, /userpayments handlers
2. **Schedule Email Reminders**: Add cron jobs for automated emails
3. **Create Web Dashboard**: Build React component using AdminDashboardService
4. **Test All Methods**: Verify payment recording works for all 4 methods
5. **Monitor Reports**: Check AdminDashboardService weekly for trends
