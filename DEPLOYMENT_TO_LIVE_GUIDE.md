# 🚀 Deployment to Live Environment Guide

## 🎯 Why Changes Aren't Visible in Live

The PNP Live enhancements (AI moderation, availability management, model self-service) have been implemented in the codebase but **have not been deployed to the live/production environment yet**. This is why you don't see the changes in the live system.

## 📋 What's Been Done (Development)

✅ **Code Implementation:**
- AI Moderation Service (`src/services/aiModerationService.js`)
- Comprehensive Availability System (`src/bot/services/availabilityService.js`)
- Model Self-Service Handler (`src/bot/handlers/model/modelSelfService.js`)
- Enhanced Onboarding with duplicate prevention

✅ **Database Migrations Created:**
- `database/migrations/046_add_ai_moderation_tables.sql`
- `database/migrations/047_comprehensive_availability_system.sql`
- `database/migrations/048_add_user_id_to_models.sql`

✅ **Documentation Completed:**
- Integration guides
- Deployment instructions
- Feature documentation
- Testing procedures

## 🔧 What Needs to Be Done (Production Deployment)

### 1. **Apply Database Migrations**

The new database tables and schema changes need to be applied to the production database:

```bash
# Connect to production PostgreSQL
psql -U postgres -d pnptvbot

# Apply migrations
\i database/migrations/046_add_ai_moderation_tables.sql
\i database/migrations/047_comprehensive_availability_system.sql
\i database/migrations/048_add_user_id_to_models.sql

# Verify tables created
\dt pnp_models
\dt pnp_availability
\dt pnp_model_schedules
\dt pnp_model_blocked_dates
\dt user_notifications
\dt availability_change_log
\dt booking_holds
```

### 2. **Deploy Code Changes**

The new services and handlers need to be deployed to the production server:

```bash
# Pull latest code
cd /var/www/pnptvbot-production
git pull origin main

# Install dependencies
npm install --production

# Restart services
pm2 restart all
```

### 3. **Update Configuration**

Add the new environment variables to the production `.env` file:

```bash
# AI Moderation Settings
AI_MODERATION_ENABLED=true
AI_MODERATION_DEFAULT_THRESHOLD=0.7

# Availability System Settings
AVAILABILITY_CACHE_TTL=300
HOLD_DURATION_MINUTES=10
MAX_ADVANCE_BOOKING_DAYS=90
```

### 4. **Verify Deployment**

Run the verification script to ensure everything is working:

```bash
./verify_deployment.sh
```

### 5. **Test Features**

Test all new features in the live environment:

- **AI Moderation**: Test content analysis and filtering
- **Availability Management**: Test schedule creation and availability checking
- **Model Self-Service**: Test profile management and availability updates
- **Smart Booking**: Test the slot holding system

### 6. **Monitor and Optimize**

Monitor the production environment for:

- Performance issues
- Error rates
- User feedback
- System resource usage

## 📚 Deployment Scripts Available

### 1. **Main Deployment Script**

```bash
./deploy_pnp_live_updates.sh
```

This script automates:
- Backup creation
- Database migration application
- Dependency installation
- Service deployment
- Configuration updates
- Service restart

### 2. **Verification Script**

```bash
./verify_deployment.sh
```

This script verifies:
- Services are deployed
- Migrations are applied
- Database tables exist
- Configuration is correct
- Dependencies are installed
- Services are running

## 🎯 Step-by-Step Deployment Process

### Phase 1: Preparation

```bash
# 1. Notify team about deployment
# 2. Create backup of current state
# 3. Set maintenance mode (if needed)
```

### Phase 2: Database Migration

```bash
# Apply database migrations
psql -U postgres -d pnptvbot -f database/migrations/046_add_ai_moderation_tables.sql
psql -U postgres -d pnptvbot -f database/migrations/047_comprehensive_availability_system.sql
psql -U postgres -d pnptvbot -f database/migrations/048_add_user_id_to_models.sql

# Verify tables
psql -U postgres -d pnptvbot -c "\dt"
```

### Phase 3: Code Deployment

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Restart services
pm2 restart all
```

### Phase 4: Configuration

```bash
# Update .env file
nano .env

# Add new configuration variables
AI_MODERATION_ENABLED=true
AVAILABILITY_CACHE_TTL=300
HOLD_DURATION_MINUTES=10

# Restart to apply config
pm2 restart all
```

### Phase 5: Verification

```bash
# Run verification script
./verify_deployment.sh

# Check logs
pm2 logs

# Test features manually
```

### Phase 6: Go Live

```bash
# Disable maintenance mode
# Notify team of successful deployment
# Monitor closely for first 24-48 hours
```

## ⏱️ Estimated Deployment Time

- **Database Migrations**: 5-10 minutes
- **Code Deployment**: 5 minutes
- **Configuration**: 5 minutes
- **Verification**: 10-15 minutes
- **Testing**: 15-30 minutes
- **Total**: ~1 hour

## 🚨 Rollback Plan

If issues occur, rollback using:

```bash
# Rollback code
git checkout previous_stable_commit
npm install --production
pm2 restart all

# Restore database from backup
pg_restore -U postgres -d pnptvbot -c -j 4 backup_file.dump
```

## 🎉 Expected Results After Deployment

### For Users:
- ✅ Enhanced PNP Live experience
- ✅ Better availability management
- ✅ Safer content through AI moderation
- ✅ Smoother booking process

### For Models:
- ✅ Self-service profile management
- ✅ Easy availability scheduling
- ✅ Recurring schedule support
- ✅ Better booking control

### For Admins:
- ✅ Comprehensive moderation tools
- ✅ Advanced availability management
- ✅ Better analytics and reporting
- ✅ Improved system reliability

## 📊 Success Metrics to Monitor

### System Health:
- **Uptime**: > 99.9%
- **Response Time**: < 500ms
- **Error Rate**: < 0.1%
- **Cache Hit Rate**: > 80%

### Feature Adoption:
- **AI Moderation Usage**: Track percentage of messages moderated
- **Smart Booking Usage**: Track percentage of bookings using smart matching
- **Model Self-Service Usage**: Track percentage of models using self-service
- **Recurring Schedules**: Track percentage of models using schedules

## 💡 Tips for Successful Deployment

1. **Communicate Clearly**: Keep the team informed throughout the deployment
2. **Monitor Actively**: Watch logs and metrics closely during and after deployment
3. **Test Thoroughly**: Verify all features work as expected before announcing
4. **Gather Feedback**: Listen to users, models, and admins for improvement opportunities
5. **Iterate Quickly**: Address any issues promptly and improve continuously

## 🚀 Next Steps

1. **Schedule Deployment Window**: Choose a low-traffic time for deployment
2. **Notify Team**: Inform all stakeholders about the deployment plan
3. **Prepare Backup**: Ensure you have a recent backup before starting
4. **Run Deployment Script**: Execute the automated deployment process
5. **Verify and Test**: Ensure everything works correctly
6. **Monitor**: Keep a close eye on the system post-deployment
7. **Gather Feedback**: Collect user feedback and address any issues

The PNP Live enhancements are **ready for production deployment** and will significantly improve the platform's functionality, safety, and user experience once deployed! 🎉
