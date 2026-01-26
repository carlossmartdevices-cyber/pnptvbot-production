# Firebase to PostgreSQL Migration - Deployment Guide

## Overview

This guide provides instructions for deploying the Firebase to PostgreSQL migration fixes.

## Changes Deployed

### 1. Database Schema Fixes

#### Applied Migrations:
- **Recurring Subscriptions Migration (039)**: Added support for recurring billing
  - Created `recurring_subscriptions` table
  - Created `recurring_payments` table  
  - Created `card_tokens` table
  - Added columns to `users` table: `card_token`, `card_token_mask`, `card_franchise`, `auto_renew`, `subscription_type`, `recurring_plan_id`, `next_billing_date`, `billing_failures`, `last_billing_attempt`
  - Added columns to `plans` table for recurring billing

- **Telegram ID Column**: Added `telegram_id VARCHAR(255)` to `users` table

### 2. Code Changes

#### Modified Files:
- **`src/config/firebase.js`**: Updated to throw clear errors instead of returning `null`
- **`src/config/database.js`**: Updated to throw clear errors when Firestore methods are called

#### New Files:
- **`scripts/apply_recurring_subscriptions_migration.js`**: Script to apply migration 039
- **`scripts/add_telegram_id_column.js`**: Script to add missing telegram_id column

## Deployment Steps

### 1. Pull Latest Changes

```bash
cd /root/pnptvbot-production
git pull origin main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Apply Database Migrations

#### Option A: Manual Migration (Recommended)

Run the migrations as the PostgreSQL superuser:

```bash
# Apply recurring subscriptions migration
sudo -u postgres psql -d pnptvbot -f database/migrations/039_add_recurring_subscription_fields.sql

# Add telegram_id column
sudo -u postgres psql -d pnptvbot -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255)"
sudo -u postgres psql -d pnptvbot -c "CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)"
```

#### Option B: Using Migration Scripts

```bash
# Apply recurring subscriptions migration
node scripts/apply_recurring_subscriptions_migration.js

# Add telegram_id column
node scripts/add_telegram_id_column.js
```

**Note**: If you get permission errors with Option B, use Option A instead.

### 4. Restart the Bot

```bash
# If using PM2
pm2 restart bot

# If using direct node
pkill -f "node.*bot.js"
nohup node src/index.js > logs/bot.log 2>&1 &
```

### 5. Verify Deployment

Check the logs for any errors:

```bash
tail -f logs/error-*.log
tail -f logs/combined-*.log
```

## Expected Errors Fixed

### Before Deployment:
- ❌ `relation "recurring_subscriptions" does not exist`
- ❌ `relation "recurring_payments" does not exist`
- ❌ `column "subscription_type" does not exist`
- ❌ `column "telegram_id" does not exist`
- ❌ `Cannot read properties of null (reading 'collection')`

### After Deployment:
- ✅ All database schema errors resolved
- ✅ Clear error messages if any code still tries to use Firestore
- ✅ Recurring subscriptions functionality working
- ✅ User telegram_id queries working

## Troubleshooting

### If you see "must be owner of table users"

This means the `pnptvbot` database user doesn't have permission to modify the `users` table. Use the PostgreSQL superuser:

```bash
sudo -u postgres psql -d pnptvbot -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255)"
```

### If you see Firestore-related errors

The updated Firebase stub will now throw clear errors. Look for messages like:
- `❌ getFirestore() called but Firebase is DISABLED`
- `❌ This is a BUG - code should use PostgreSQL instead!`

These indicate that some code is still trying to use Firestore. Check the stack trace to find the offending code and update it to use PostgreSQL.

### If recurring subscriptions don't work

1. Verify the tables exist:
   ```bash
   PGPASSWORD='your_password' psql -h localhost -U pnptvbot -d pnptvbot -c "\dt" | grep recurring
   ```

2. Check the columns exist:
   ```bash
   PGPASSWORD='your_password' psql -h localhost -U pnptvbot -d pnptvbot -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_type'"
   ```

## Rollback Procedure

If you need to rollback:

```bash
# Revert to previous commit
git reset --hard d537c9c

# Reapply database changes manually if needed
# (The database changes are additive and won't break existing functionality)
```

## Monitoring

After deployment, monitor these key metrics:

1. **Database queries**: Check for any remaining "relation does not exist" errors
2. **Firestore calls**: Watch for any "Firebase is DISABLED" error messages
3. **Recurring subscriptions**: Verify that recurring billing functionality works
4. **User queries**: Ensure that queries using `telegram_id` work correctly

## Support

If you encounter any issues:

1. Check the logs: `tail -100 logs/error-*.log`
2. Verify database schema: `PGPASSWORD='your_password' psql -h localhost -U pnptvbot -d pnptvbot -c "\dt"`
3. Test recurring subscriptions: Create a test subscription and verify it appears in the database
4. Test user queries: Run a query with telegram_id and verify it works

## Summary

This deployment:
- ✅ Fixes all database schema issues
- ✅ Improves error handling for Firestore migration
- ✅ Enables recurring subscriptions functionality
- ✅ Adds missing telegram_id column for user queries
- ✅ Provides clear error messages for any remaining Firestore usage

The system is now fully migrated to PostgreSQL with proper error handling and all necessary database schema in place.
