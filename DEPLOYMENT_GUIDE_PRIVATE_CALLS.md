# 🚀 Private 1:1 Calls Feature - Deployment Guide

## 📋 Overview

This guide provides step-by-step instructions for deploying the **Private 1:1 Calls** feature to your PNPtv Bot production environment.

## 🎯 Prerequisites

Before deploying, ensure you have:

- ✅ Access to the server where PNPtv Bot is hosted
- ✅ Database credentials with migration permissions
- ✅ Payment provider API keys (Daimo)
- ✅ Admin user IDs for alert notifications
- ✅ Backup of current production database

## 📦 Deployment Steps

### 1. 📁 Apply Database Migration

```bash
# Connect to your PostgreSQL database
psql -U your_db_user -d pnptvbot_production -h your_db_host

# Run the migration
\i database/migrations/036_add_performers_and_enhanced_calls.sql

# Verify tables were created
\dt performers
\dt call_bookings
\dt call_availability_slots
\dt call_moderation_logs
```

### 2. 🔧 Configure Environment Variables

Add these to your `.env` file:

```env
# Daily.co API Key (for video rooms)
DAILY_API_KEY=your_daily_co_api_key

# Payment Provider Keys
DAIMO_API_KEY=your_daimo_key

# Admin Alerts (comma-separated Telegram user IDs)
ADMIN_USER_IDS=admin1_id,admin2_id,admin3_id

# Feature Flags
FEATURE_PRIVATE_CALLS_ENABLED=true
PRIVATE_CALLS_BASE_PRICE=100
```

### 3. 📂 Deploy Code Changes

```bash
# Pull the latest changes
cd /path/to/pnptvbot-production
git pull origin main

# Install dependencies
npm install

# Build the project
npm run build

# Restart the bot service
pm2 restart pnptv-bot
# or
systemctl restart pnptv-bot
```

### 4. 🧪 Run Tests (Optional but Recommended)

```bash
# Run the comprehensive test suite
node scripts/test-private-calls-flow.js

# Check for any errors and resolve them before proceeding
```

### 5. 🔄 Initialize Default Performers

```bash
# You can manually add performers or use this script
node scripts/initialize-default-performers.js
```

### 6. 📊 Verify Deployment

1. **Test Menu Access**:
   - Open the bot and check that "📞 Private 1:1 Calls" appears in the menu
   - Verify visibility rules (PRIME users see it, FREE users see upgrade prompt)

2. **Test Booking Flow**:
   - Go through the complete booking process as a test user
   - Verify performer selection, time slots, rules confirmation, and payment

3. **Test Admin Dashboard**:
   - Access the admin panel and check the new "📞 Private Calls" section
   - Verify statistics, performer management, and call monitoring

4. **Test Moderation Features**:
   - Simulate a no-show scenario
   - Test incident reporting
   - Verify admin alerts are sent

## 🎭 Post-Deployment Tasks

### 1. 👥 Add Performers

```sql
-- Add performers manually or through admin interface
INSERT INTO performers (display_name, bio, base_price, status, is_available, created_by, updated_by)
VALUES 
  ('Santino', 'Experienced performer with great personality', 100.00, 'active', true, 'admin', 'admin'),
  ('Lex Boy', 'Charismatic and engaging performer', 100.00, 'active', true, 'admin', 'admin');
```

### 2. 📅 Set Availability Slots

```javascript
// Use the admin interface or this example
const PerformerModel = require('./src/models/performerModel');

// Get performer
const performer = await PerformerModel.getByDisplayName('Santino');

// Add availability slots (next 7 days, 9AM-5PM)
const slots = [];
for (let i = 0; i < 7; i++) {
  const date = new Date();
  date.setDate(date.getDate() + i);
  
  slots.push({
    date: date.toISOString().split('T')[0],
    startTime: '09:00:00',
    endTime: '17:00:00',
    timezone: 'UTC',
  });
}

await PerformerModel.createAvailabilitySlots(performer.id, slots);
```

### 3. 💰 Configure Payment Webhooks

Set up webhooks for payment providers:

- **Stripe**: `https://your-bot-domain.com/api/webhooks/stripe`
- **Daimo**: `https://your-bot-domain.com/api/webhooks/daimo`

### 4. 📈 Monitor Performance

```bash
# Check bot logs for any errors
pm2 logs pnptv-bot

# Monitor database performance
# Check for slow queries related to the new tables
```

## 🚨 Troubleshooting

### Common Issues and Solutions

**Issue: Menu option not appearing**
- ✅ Check that user is PRIME
- ✅ Verify menu configuration in `src/config/menuConfig.js`
- ✅ Restart bot service

**Issue: Payment failing**
- ✅ Check payment provider API keys
- ✅ Verify webhook URLs
- ✅ Test with sandbox/staging environment first

**Issue: Call rooms not creating**
- ✅ Verify Daily.co API key
- ✅ Check fallback URL configuration
- ✅ Test Daily.co API separately

**Issue: No performers available**
- ✅ Check database for performer records
- ✅ Verify performer availability status
- ✅ Ensure performers have availability slots

## 📚 Documentation

### Admin Commands

```
/admin_private_calls - Access private calls dashboard
/admin_manage_performers - Manage performers
/admin_view_all_calls - View all bookings
/admin_detailed_stats - View statistics
```

### User Commands

```
/book_private_call - Start booking a private call
/my_private_calls - View my bookings
```

## 🎯 Feature Configuration

### Pricing

```javascript
// Configure in src/bot/services/privateCallService.js
const PRICING = {
  base: 100.00,      // Base price for 30 minutes
  per_15_min: 50.00, // Additional for each 15 minutes
  max_duration: 60,  // Maximum call duration (minutes)
};
```

### Availability

```javascript
// Configure in performer records
const AVAILABILITY = {
  buffer_before: 15, // Minutes before call (preparation)
  buffer_after: 15,  // Minutes after call (wrap-up)
  max_booking_window: 30, // Days in advance users can book
};
```

### Moderation

```javascript
// Configure in src/bot/services/privateCallModerationService.js
const MODERATION = {
  no_show_threshold: 15, // Minutes to wait before marking no-show
  performer_flag_threshold: 3, // No-shows before auto-flagging performer
  call_timeout_grace: 2, // Minutes grace period for call duration
};
```

## 📊 Analytics and Reporting

### Key Metrics to Monitor

```
- Total bookings per day/week/month
- Conversion rate (views → bookings)
- Completion rate (bookings → completed calls)
- Cancellation rate and reasons
- Average call duration
- Revenue per performer
- User satisfaction ratings
```

### SQL Queries for Reporting

```sql
-- Daily bookings
SELECT 
  DATE(scheduled_at) as date,
  COUNT(*) as total_bookings,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
FROM call_bookings
GROUP BY DATE(scheduled_at)
ORDER BY date DESC
LIMIT 30;

-- Performer performance
SELECT 
  p.display_name,
  COUNT(*) as total_calls,
  SUM(c.amount) as total_revenue,
  AVG(c.duration) as avg_duration,
  COUNT(DISTINCT c.user_id) as unique_users
FROM performers p
JOIN call_bookings c ON p.id = c.performer_id
WHERE c.status = 'completed'
GROUP BY p.display_name
ORDER BY total_revenue DESC;

-- User satisfaction
SELECT 
  performer_id,
  AVG(user_rating) as avg_rating,
  COUNT(*) as total_ratings
FROM call_bookings
WHERE user_rating IS NOT NULL
GROUP BY performer_id;
```

## 🔒 Security Considerations

### Data Protection

```
- ✅ No call content is stored or recorded
- ✅ Payment data handled by PCI-compliant providers
- ✅ User data encrypted in transit and at rest
- ✅ Regular security audits recommended
```

### Access Control

```
- ✅ Admin roles required for dashboard access
- ✅ Performer eligibility checks before booking
- ✅ User verification (age, terms, subscription)
- ✅ Rate limiting on booking endpoints
```

## 🚀 Rollback Procedure

In case of issues:

```bash
# Revert to previous commit
git revert HEAD

# Restart bot service
pm2 restart pnptv-bot

# Notify users (optional)
node scripts/notify-maintenance.js "Private calls temporarily unavailable"
```

## 📞 Support

For issues with deployment:

1. **Check logs**: `pm2 logs pnptv-bot`
2. **Review database**: Verify migration was applied correctly
3. **Test in staging**: Reproduce issue in staging environment
4. **Contact development**: Provide detailed error information

## 🎉 Success Criteria

Deployment is successful when:

- ✅ All tests pass
- ✅ Menu option appears for eligible users
- ✅ Booking flow completes without errors
- ✅ Payments process correctly
- ✅ Call rooms create successfully
- ✅ Admin dashboard shows accurate data
- ✅ Moderation features work as expected

## 📅 Maintenance Schedule

**Daily**:
- Monitor booking success rates
- Check for failed payments
- Review moderation alerts

**Weekly**:
- Update performer availability
- Review user feedback
- Analyze performance metrics

**Monthly**:
- Audit security logs
- Review pricing strategy
- Plan feature enhancements

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
**Contact**: support@pnptv.com