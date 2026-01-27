# PNP Live Production Deployment Guide

## 🎯 Deployment Summary

This guide provides step-by-step instructions for deploying the complete PNP Live system to production, including AI moderation, comprehensive availability management, and model self-service features.

## 📋 Deployment Checklist

### Pre-Deployment
- [x] Code committed and pushed to repository
- [x] Database migrations prepared
- [x] Services implemented and tested
- [x] Documentation completed
- [x] Verification scripts created
- [ ] Backup current production database
- [ ] Notify team of deployment window
- [ ] Set up maintenance page (if needed)

### Database Migrations
- [ ] Apply migration 046 (AI moderation tables)
- [ ] Apply migration 047 (Comprehensive availability system)
- [ ] Apply migration 048 (Add user_id to models)
- [ ] Verify all tables and indexes created
- [ ] Test database constraints and triggers

### Service Deployment
- [ ] Deploy backend services
- [ ] Configure environment variables
- [ ] Set up Redis caching
- [ ] Configure logging and monitoring
- [ ] Verify service health checks

### Feature Activation
- [ ] Enable AI moderation for streams
- [ ] Configure moderation thresholds
- [ ] Set up recurring schedule generation
- [ ] Configure availability settings
- [ ] Enable model self-service access

### Post-Deployment
- [ ] Monitor system performance
- [ ] Verify all features working
- [ ] Test user flows
- [ ] Test admin flows
- [ ] Test model self-service flows
- [ ] Gather initial feedback
- [ ] Address any issues

## 🚀 Step-by-Step Deployment

### 1. Pre-Deployment Preparation

```bash
# Notify team
echo "📢 PNP Live deployment starting at $(date)" | mail -s "PNP Live Deployment" team@pnptv.com

# Backup database
pg_dump -U postgres -d pnptvbot -F c -f pnptvbot_backup_$(date +%Y%m%d_%H%M%S).dump

# Set maintenance mode (if needed)
# Update nginx configuration to show maintenance page
```

### 2. Database Migrations

```bash
# Connect to PostgreSQL
psql -U postgres -d pnptvbot

# Apply AI moderation migration (046)
\i database/migrations/046_add_ai_moderation_tables.sql

# Apply comprehensive availability migration (047)
\i database/migrations/047_comprehensive_availability_system.sql

# Apply user_id to models migration (048)
\i database/migrations/048_add_user_id_to_models.sql

# Verify tables
\dt pnp_models
\dt pnp_availability
\dt pnp_model_schedules
\dt pnp_model_blocked_dates
\dt user_notifications
\dt availability_change_log
\dt booking_holds

# Exit PostgreSQL
\q
```

### 3. Code Deployment

```bash
# Pull latest code
cd /var/www/pnptvbot-production
git pull origin main

# Install dependencies
npm install --production

# Restart services
pm2 restart all

# Verify services
pm2 list
pm2 logs
```

### 4. Configuration

```bash
# Set environment variables in .env
cat >> .env << 'EOF'
# AI Moderation Settings
AI_MODERATION_ENABLED=true
AI_MODERATION_DEFAULT_THRESHOLD=0.7

# Availability System Settings
AVAILABILITY_CACHE_TTL=300
HOLD_DURATION_MINUTES=10
MAX_ADVANCE_BOOKING_DAYS=90

# Database Settings
PG_HOST=localhost
PG_USER=postgres
PG_PASSWORD=your_secure_password
PG_DATABASE=pnptvbot

# Redis Settings
REDIS_HOST=localhost
REDIS_PORT=6379
EOF

# Restart to apply config
pm2 restart all
```

### 5. Feature Activation

```bash
# Enable AI moderation for all streams (example)
# This would be done through admin interface or script

# Generate initial availability from schedules
# This would be done through admin interface or script

# Verify features
curl -I http://localhost:3000/health
curl -X GET http://localhost:3000/api/models
```

### 6. Testing

```bash
# Test AI moderation
curl -X POST http://localhost:3000/api/moderation/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "test message", "streamId": "test_123"}'

# Test availability
curl -X GET http://localhost:3000/api/availability/42

# Test model self-service
curl -X GET http://localhost:3000/api/model/me \
  -H "Authorization: Bearer model_token"
```

### 7. Monitoring Setup

```bash
# Set up monitoring
# Configure Prometheus, Grafana, or other monitoring tools

# Set up alerts
# Configure alerting for errors, performance issues, etc.

# Verify monitoring
curl -I http://localhost:3000/metrics
```

### 8. Post-Deployment

```bash
# Monitor logs
pm2 logs

# Check performance
top
htop

# Verify database
tail -f /var/log/postgresql/postgresql.log

# Check Redis
redis-cli info
redis-cli monitor
```

## 📊 Verification Checklist

### Database
- [ ] All tables created successfully
- [ ] Indexes created and optimized
- [ ] Constraints working properly
- [ ] Triggers functioning correctly

### Services
- [ ] All services running
- [ ] No errors in logs
- [ ] Response times acceptable
- [ ] Cache working properly

### Features
- [ ] AI moderation working
- [ ] Availability management working
- [ ] Smart booking working
- [ ] Model self-service working
- [ ] Admin interface working
- [ ] User interface working

### Performance
- [ ] Response times < 500ms
- [ ] Database queries optimized
- [ ] Cache hit rate > 80%
- [ ] No memory leaks
- [ ] CPU usage normal

## 🔧 Rollback Procedure

```bash
# If issues occur, rollback to previous version
cd /var/www/pnptvbot-production
git checkout 319a813
npm install --production
pm2 restart all

# Restore database from backup if needed
pg_restore -U postgres -d pnptvbot -c -j 4 pnptvbot_backup_*.dump

# Notify team of rollback
echo "⚠️ PNP Live rollback completed" | mail -s "PNP Live Rollback" team@pnptv.com
```

## 📈 Success Metrics

Track these metrics post-deployment:

### System Health
- **Uptime**: > 99.9%
- **Response Time**: < 500ms
- **Error Rate**: < 0.1%
- **Cache Hit Rate**: > 80%

### User Engagement
- **Active Users**: Track daily/monthly active users
- **Session Duration**: Average session length
- **Retention Rate**: User return rate
- **Booking Success**: Successful bookings vs attempts

### Business Metrics
- **Revenue**: Total platform revenue
- **Bookings**: Number of successful bookings
- **Utilization**: Availability slot utilization
- **Conversion**: Visitors to bookings ratio

### Feature Adoption
- **AI Moderation**: Percentage of messages moderated
- **Smart Booking**: Percentage of bookings using smart matching
- **Model Self-Service**: Percentage of models using self-service
- **Recurring Schedules**: Percentage of models using schedules

## 🎉 Deployment Complete

Once all steps are completed:

1. **Notify Team**: Deployment successful
2. **Monitor Closely**: First 24-48 hours critical
3. **Gather Feedback**: From users, models, and admins
4. **Address Issues**: Quickly resolve any problems
5. **Plan Next Iteration**: Based on feedback and metrics

## 📚 Documentation

- **PNP_LIVE_INTEGRATION.md**: Complete integration guide
- **DEPLOYMENT_GUIDE.md**: Detailed deployment instructions
- **AVAILABILITY_SYSTEM_IMPLEMENTATION.md**: Availability system details
- **PNP_LIVE_ENHANCEMENTS.md**: AI moderation details

## 💡 Tips for Success

1. **Communicate Clearly**: Keep team informed throughout deployment
2. **Monitor Actively**: Watch logs and metrics closely
3. **Test Thoroughly**: Verify all features before announcing
4. **Gather Feedback**: Listen to users and models
5. **Iterate Quickly**: Address issues and improve continuously

## 🚀 Next Steps

1. **Monitor**: Track performance and usage
2. **Optimize**: Improve based on real-world data
3. **Enhance**: Add advanced features
4. **Expand**: Grow user base and model community
5. **Innovate**: Stay ahead with new technologies

The PNP Live system is now **production-ready** with comprehensive features for admins, users, and models. All core functionality has been implemented, tested, and documented. The foundation is in place for a world-class live streaming platform! 🎉