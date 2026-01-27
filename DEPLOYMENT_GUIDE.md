# Deployment Guide: Comprehensive Availability System & AI Moderation

## Overview
This guide provides step-by-step instructions for deploying the comprehensive availability system and AI moderation enhancements to the PNP Live platform.

## Deployment Checklist

- [ ] ✅ Code committed and pushed to repository
- [ ] Database migrations applied
- [ ] Services integrated and tested
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] User training completed

## Step 1: Code Deployment

### Prerequisites
- Node.js v16+
- PostgreSQL 12+
- Redis 6+
- Git

### Deployment Steps

```bash
# Clone or update the repository
git clone https://github.com/carlossmartdevices-cyber/pnptvbot-production.git
cd pnptvbot-production
git pull origin main

# Install dependencies
npm install

# Verify new files are present
ls -la src/services/aiModerationService.js
ls -la src/services/comprehensiveAvailabilityService.js
ls -la src/services/bookingAvailabilityIntegration.js
```

## Step 2: Database Migration

### Apply Database Migrations

```bash
# Connect to PostgreSQL
psql -U postgres -d pnptvbot

# Apply AI moderation migration (046)
\i database/migrations/046_add_ai_moderation_tables.sql

# Apply comprehensive availability migration (047)
\i database/migrations/047_comprehensive_availability_system.sql

# Verify tables were created
\dt pnp_model_schedules
\dt pnp_model_blocked_dates
\dt user_notifications
\dt availability_change_log
\dt booking_holds
```

### Expected Output
```
List of relations
 Schema |           Name           | Type  | Owner
--------+--------------------------+-------+-------
 public | pnp_model_schedules      | table | postgres
 public | pnp_model_blocked_dates   | table | postgres
 public | user_notifications        | table | postgres
 public | availability_change_log   | table | postgres
 public | booking_holds            | table | postgres
```

## Step 3: Configuration

### Environment Variables
Add these to your `.env` file:

```env
# AI Moderation Settings
AI_MODERATION_ENABLED=true
AI_MODERATION_DEFAULT_THRESHOLD=0.7

# Availability System Settings
AVAILABILITY_CACHE_TTL=300
HOLD_DURATION_MINUTES=10
MAX_ADVANCE_BOOKING_DAYS=90

# Database Settings (ensure these are correct)
PG_HOST=localhost
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_DATABASE=pnptvbot
```

### Redis Configuration
Ensure Redis is running and accessible:

```bash
redis-cli ping
# Should return: PONG
```

## Step 4: Service Integration

### Import Services
Update your main application file to import the new services:

```javascript
// Add to your main application file
const AIModerationService = require('./src/services/aiModerationService');
const ComprehensiveAvailabilityService = require('./src/services/comprehensiveAvailabilityService');
const BookingAvailabilityIntegration = require('./src/services/bookingAvailabilityIntegration');
```

### Initialize Services
Add service initialization to your startup sequence:

```javascript
// Initialize services
app.locals.aiModeration = AIModerationService;
app.locals.availability = ComprehensiveAvailabilityService;
app.locals.bookingIntegration = BookingAvailabilityIntegration;
```

## Step 5: Feature Activation

### Activate AI Moderation
```javascript
// Enable AI moderation for streams
const streamId = 'stream_123';
await app.locals.aiModeration.updateStreamModerationSettings(streamId, {
  ai_moderation_enabled: true,
  auto_moderate: true,
  moderation_thresholds: app.locals.aiModeration.DEFAULT_THRESHOLDS
});
```

### Set Up Recurring Schedules
```javascript
// Add recurring schedule for a model
const modelId = 42;
await app.locals.availability.addRecurringSchedule(modelId, {
  dayOfWeek: 1, // Monday
  startTime: '14:00:00',
  endTime: '22:00:00',
  isActive: true
});

// Generate availability from schedules
await app.locals.availability.generateAvailabilityFromSchedules(
  modelId,
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

## Step 6: Testing

### Test AI Moderation
```javascript
// Test content moderation
const result = await app.locals.aiModeration.analyzeContent(
  "This is a test message with some bad words",
  { thresholds: app.locals.aiModeration.DEFAULT_THRESHOLDS }
);

console.log('Moderation result:', result);
```

### Test Smart Booking
```javascript
// Test smart booking creation
const bookingResult = await app.locals.bookingIntegration.createSmartBooking({
  userId: 'user_123',
  modelId: 42,
  durationMinutes: 60,
  preferredStartTime: new Date('2024-01-01T15:00:00Z'),
  searchStartTime: new Date('2024-01-01T10:00:00Z'),
  searchEndTime: new Date('2024-01-01T20:00:00Z')
});

console.log('Smart booking result:', bookingResult);
```

### Test Conflict Resolution
```javascript
// Test conflict detection and resolution
const conflicts = await app.locals.availability.checkAvailabilityConflicts(
  42,
  new Date('2024-01-01T15:00:00Z'),
  new Date('2024-01-01T17:00:00Z')
);

if (conflicts.length > 0) {
  const resolution = await app.locals.availability.resolveConflicts(
    42,
    new Date('2024-01-01T15:00:00Z'),
    new Date('2024-01-01T17:00:00Z'),
    'adjust'
  );
  console.log('Conflict resolution:', resolution);
}
```

## Step 7: Monitoring Setup

### Database Monitoring
```sql
-- Check availability statistics
SELECT 
  COUNT(*) as total_slots,
  SUM(CASE WHEN is_booked THEN 1 ELSE 0 END) as booked_slots,
  SUM(CASE WHEN hold_user_id IS NOT NULL THEN 1 ELSE 0 END) as held_slots
FROM pnp_availability
WHERE model_id = 42;

-- Check moderation statistics
SELECT 
  COUNT(*) as total_violations,
  SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_severity
FROM stream_chat_violations
WHERE stream_id = 'stream_123';
```

### Performance Monitoring
```javascript
// Monitor cache performance
const cacheStats = await app.locals.cache.info();
console.log('Redis cache stats:', cacheStats);

// Monitor service performance
console.time('availabilityCheck');
const slots = await app.locals.availability.getAvailableSlots(42, new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
console.timeEnd('availabilityCheck');
```

## Step 8: Alert Configuration

### Set Up Alerts
```javascript
// Example: Monitor for expired holds
setInterval(async () => {
  const expiredHolds = await app.locals.availability.checkAvailabilityConflicts(
    null,
    new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    new Date()
  );
  
  if (expiredHolds.length > 0) {
    console.warn(`⚠️ Found ${expiredHolds.length} expired holds`);
    // Send alert to admin
  }
}, 60 * 60 * 1000); // Check hourly
```

## Step 9: User Training

### Key Concepts to Train

1. **AI Moderation**:
   - How moderation works
   - Understanding violation types
   - Managing moderation settings
   - Viewing moderation statistics

2. **Availability Management**:
   - Setting up recurring schedules
   - Managing blocked dates
   - Understanding slot types
   - Using the calendar view

3. **Smart Booking**:
   - How match scoring works
   - Understanding hold system
   - Conflict resolution options
   - Rescheduling bookings

4. **Analytics**:
   - Reading utilization reports
   - Understanding revenue projections
   - Exporting data for analysis

## Step 10: Documentation

### Update User Documentation
Ensure users have access to:
- `AVAILABILITY_SYSTEM_IMPLEMENTATION.md` - Technical documentation
- `PNP_LIVE_ENHANCEMENTS.md` - AI moderation documentation
- Updated user guides with new features

### API Documentation
Update your API documentation with new endpoints:

```markdown
### AI Moderation Endpoints
- `POST /api/moderation/analyze` - Analyze content
- `GET /api/moderation/settings/:streamId` - Get moderation settings
- `PUT /api/moderation/settings/:streamId` - Update moderation settings
- `GET /api/moderation/stats/:streamId` - Get moderation statistics

### Availability Endpoints
- `GET /api/availability/:modelId` - Get availability settings
- `POST /api/availability/schedule` - Add recurring schedule
- `POST /api/availability/block` - Add blocked date
- `POST /api/availability/generate` - Generate availability
- `GET /api/availability/slots` - Find available slots
- `POST /api/availability/hold` - Hold slot for booking
- `POST /api/availability/book` - Book held slot

### Booking Integration Endpoints
- `POST /api/booking/smart` - Create smart booking
- `POST /api/booking/complete` - Complete booking
- `POST /api/booking/cancel` - Cancel booking
- `GET /api/booking/:id/availability` - Get booking with availability
- `GET /api/booking/user/:userId` - Get user bookings with availability
- `GET /api/booking/model/:modelId` - Get model bookings with calendar
```

## Rollback Procedure

### Database Rollback
```bash
# Connect to PostgreSQL
psql -U postgres -d pnptvbot

# Rollback specific migration (if needed)
-- Manual rollback steps would be required
-- This should be tested in staging first

# Alternative: Restore from backup
pg_restore -U postgres -d pnptvbot /path/to/backup/file.dump
```

### Code Rollback
```bash
# Revert to previous commit
git revert 5701e33

# Or checkout specific commit
git checkout 9d30815

# Redeploy
npm install
pm restart
```

## Troubleshooting

### Common Issues and Solutions

**Issue: AI moderation not working**
- Check if moderation is enabled for the stream
- Verify Redis is running and connected
- Check database tables were created correctly

**Issue: Availability slots not generating**
- Verify recurring schedules are active
- Check for blocked dates conflicts
- Ensure time ranges are valid

**Issue: Booking conflicts not detected**
- Verify conflict detection function is working
- Check database constraints are in place
- Ensure proper transaction management

**Issue: Performance slow**
- Check Redis cache is working
- Verify database indexes are created
- Monitor query performance
- Consider increasing cache TTL

## Support Resources

### Documentation
- `AVAILABILITY_SYSTEM_IMPLEMENTATION.md` - Complete technical documentation
- `PNP_LIVE_ENHANCEMENTS.md` - AI moderation details
- Database migration files for schema reference

### Monitoring Commands
```bash
# Check service status
pm2 list

# View logs
pm2 logs

# Check database connections
psql -U postgres -d pnptvbot -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis status
redis-cli info
```

## Deployment Verification

### Verification Checklist

- [ ] Database migrations applied successfully
- [ ] All tables and functions created
- [ ] Services imported and initialized
- [ ] Configuration variables set correctly
- [ ] Basic functionality tested
- [ ] Performance metrics within expectations
- [ ] Monitoring and alerts configured
- [ ] Documentation accessible to users
- [ ] Rollback procedure tested in staging

### Verification Commands

```bash
# Check service health
curl -I http://localhost:3000/health

# Test AI moderation
curl -X POST http://localhost:3000/api/moderation/analyze 
  -H "Content-Type: application/json" 
  -d '{"text": "test message", "streamId": "test_123"}'

# Test availability
curl -X GET http://localhost:3000/api/availability/42

# Test smart booking
curl -X POST http://localhost:3000/api/booking/smart 
  -H "Content-Type: application/json" 
  -d '{"userId": "test_user", "modelId": 42, "durationMinutes": 60}'
```

## Post-Deployment Tasks

1. **Monitor System Performance**: Track response times and resource usage
2. **Gather User Feedback**: Collect input on new features
3. **Adjust Thresholds**: Fine-tune AI moderation thresholds
4. **Optimize Queries**: Identify and optimize slow database queries
5. **Update Training Materials**: Incorporate real-world usage examples
6. **Plan Next Iteration**: Identify areas for further enhancement

## Success Metrics

Track these metrics to measure deployment success:

- **AI Moderation**:
  - Reduction in manual moderation workload
  - User satisfaction with moderation decisions
  - False positive/negative rates

- **Availability System**:
  - Increase in booking success rates
  - Reduction in scheduling conflicts
  - User adoption of recurring schedules

- **Smart Booking**:
  - Improvement in booking match quality
  - Reduction in booking time
  - Increase in successful bookings

- **System Performance**:
  - Response times within SLA
  - Cache hit rates
  - Database query performance

## Conclusion

This deployment guide provides a comprehensive approach to implementing the comprehensive availability system and AI moderation enhancements. By following these steps, you can ensure a smooth deployment with proper testing, monitoring, and user training.

For any issues not covered in this guide, refer to the detailed implementation documentation or contact the development team for assistance.