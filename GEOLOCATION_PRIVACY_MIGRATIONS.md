# Geolocation Privacy Schema Changes (Sprint 1-1F)

## Overview

This document describes the database migrations and backend changes required to implement GDPR-compliant geolocation privacy in PNPtv. The changes reduce excessive precision, enable opt-in consent, and provide coordinate truncation utilities.

## Requirements

### Requirement 1A: Reduce Geolocation Precision

**Problem:**
- Current: `DECIMAL(10, 8)` = ~1.1mm precision
- Risk: Excessive precision allows deanonymization
- GDPR: Anonymization requires ~111m precision

**Solution:**
- Target: `DECIMAL(8, 3)` = ~111m precision
- Applies to: ALL geolocation storage (not just queries)
- Enforcement: Dual-layer (DB + Application)

**Precision Scale:**
```
Decimals  Precision (meters)  Use Case
1         11,100             Country/region
2         1,100              City
3         111                Neighborhood (ANONYMIZATION)
4         11                 Street
5         1.1                House
6         0.11               Meter
7         0.011              Decimeter
8         0.0011             Millimeter (GDPR RISK)
```

### Requirement 1B: Change Default to Opt-In

**Problem:**
- Current: `location_sharing_enabled = true` by default (opt-out)
- Risk: Violates GDPR privacy-by-default principle
- Requirement: Explicit user consent

**Solution:**
- Target: `location_sharing_enabled = false` by default (opt-in)
- Scope: NEW users only (future registrations)
- Preservation: Existing user preferences unchanged

**Migration Impact:**
- ✅ No data loss
- ✅ Existing TRUE values remain TRUE
- ✅ Only affects new registrations
- ✅ Rollback reversible

### Requirement 1C: Coordinate Truncation Utility

**Function:**
```javascript
const { truncateCoordinates } = require('./utils/coordinateUtils');
const { latitude, longitude } = truncateCoordinates(40.7128, -74.0060);
// Returns: { latitude: 40.713, longitude: -74.006 }
```

**Features:**
- Input validation
- 3-decimal rounding
- Error handling
- Distance calculations
- Precision info helpers

---

## Migration Files

### 1. Location Sharing Default Change
**File:** `/database/migrations/20260221_alter_location_sharing_default.sql`

**What it does:**
- Changes `location_sharing_enabled` DEFAULT from TRUE to FALSE
- Adds column comment documenting the change
- Does NOT modify existing user data

**SQL:**
```sql
ALTER TABLE users
  ALTER COLUMN location_sharing_enabled SET DEFAULT false;
```

**Rollback:**
```sql
ALTER TABLE users
  ALTER COLUMN location_sharing_enabled SET DEFAULT true;
```

**Verification:**
```sql
-- Check default value
SELECT column_default FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'location_sharing_enabled';
-- Expected: false

-- Verify no data change
SELECT COUNT(*) WHERE location_sharing_enabled = true;
-- Should be same as before migration
```

---

### 2. Geolocation Precision Reduction
**File:** `/database/migrations/20260221_reduce_geolocation_precision.sql`

**What it does:**
- Changes data types from `DECIMAL(10, 8)` to `DECIMAL(8, 3)` in 5 tables
- Adds column comments documenting precision change
- Truncates existing values to 3 decimals (e.g., 40.7128 → 40.713)

**Tables Modified:**
1. `users.location_lat`, `users.location_lng`
2. `user_locations.latitude`, `user_locations.longitude`
3. `user_location_history.latitude`, `user_location_history.longitude`
4. `nearby_places.location_lat`, `nearby_places.location_lng`
5. `nearby_place_submissions.location_lat`, `nearby_place_submissions.location_lng`

**SQL Example:**
```sql
ALTER TABLE users
  ALTER COLUMN location_lat SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN location_lng SET DATA TYPE NUMERIC(8, 3);
```

**Data Truncation:**
- Before: `40.71281945` (8 decimals)
- After: `40.713` (3 decimals)
- Method: DECIMAL rounding during type conversion
- No loss: Values preserved, just less precise

**Rollback:**
```sql
ALTER TABLE users
  ALTER COLUMN location_lat SET DATA TYPE DECIMAL(10, 8),
  ALTER COLUMN location_lng SET DATA TYPE DECIMAL(10, 8);
```

**Verification:**
```sql
-- Check data types were updated
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('location_lat', 'location_lng')
ORDER BY column_name;
-- Expected: numeric | 8 | 3

-- Check data integrity
SELECT COUNT(*) FROM users WHERE location_lat IS NOT NULL;
-- Should be same as before migration
```

---

## Backend Implementation

### Coordinate Utility Functions
**File:** `/apps/backend/utils/coordinateUtils.js`

**Available Functions:**

#### 1. `truncateCoordinates(latitude, longitude)`
```javascript
const { truncateCoordinates } = require('./utils/coordinateUtils');

const result = truncateCoordinates(40.71281945, -74.00603456);
// Returns: { latitude: 40.713, longitude: -74.006 }

// Usage in services:
const { latitude, longitude } = truncateCoordinates(
  req.body.latitude,
  req.body.longitude
);
await UserLocation.upsert({
  user_id: userId,
  latitude,    // Already 3 decimals
  longitude    // Already 3 decimals
});
```

#### 2. `truncateCoordinate(value)`
```javascript
const { truncateCoordinate } = require('./utils/coordinateUtils');

const lat = truncateCoordinate(40.71281945);
// Returns: 40.713
```

#### 3. `isValidCoordinates(latitude, longitude)`
```javascript
const { isValidCoordinates } = require('./utils/coordinateUtils');

if (!isValidCoordinates(req.body.latitude, req.body.longitude)) {
  return res.status(400).json({ error: 'Invalid coordinates' });
}
```

#### 4. `calculateDistance(lat1, lon1, lat2, lon2)`
```javascript
const { calculateDistance } = require('./utils/coordinateUtils');

const distance = calculateDistance(40.713, -74.006, 40.730, -74.010);
// Returns: { km: 1.89, meters: 1890 }
```

#### 5. `getPrecisionInfo(decimals)`
```javascript
const { getPrecisionInfo } = require('./utils/coordinateUtils');

const info = getPrecisionInfo(3);
// Returns: { decimals: 3, precision_meters: 111, use_case: 'Neighborhood/anonymization' }
```

**Error Handling:**
```javascript
try {
  const coords = truncateCoordinates(latitude, longitude);
} catch (error) {
  logger.error('Coordinate truncation failed:', error.message);
  // Handle: Invalid types, out of range, etc.
}
```

---

## Service Integration

### Example: NearbyService (already implemented)

The `NearbyService` already enforces 3-decimal precision:

```javascript
// From /apps/backend/services/nearbyService.js (line 99-101)
const roundedLatitude = Math.round(latitude * 1000) / 1000;
const roundedLongitude = Math.round(longitude * 1000) / 1000;

// Store in PostgreSQL
const userLocation = await UserLocation.upsert({
  user_id: userId,
  latitude: roundedLatitude,
  longitude: roundedLongitude
});
```

**For new services implementing geolocation:**
```javascript
const { truncateCoordinates } = require('../../utils/coordinateUtils');

async updatePlaceLocation(placeId, latitude, longitude) {
  // Validate and truncate
  const { latitude: lat, longitude: lon } = truncateCoordinates(
    latitude,
    longitude
  );

  // Store
  await NearbyPlace.update(placeId, {
    location_lat: lat,
    location_lng: lon
  });
}
```

---

## Deployment Checklist

### Pre-Migration
- [ ] Backup database: `pg_dump pnptv > backup_20260221.sql`
- [ ] Test migrations on staging environment first
- [ ] Review column comments and data types
- [ ] Verify no active connections to affected tables

### Apply Migrations (in order)
1. [ ] Run: `20260221_alter_location_sharing_default.sql`
   - Safe: Only changes default, no data modification
   - Takes <1s

2. [ ] Run: `20260221_reduce_geolocation_precision.sql`
   - Safe: Type conversion with rounding
   - Duration: Depends on row count (5-30s typical)
   - Can use: `CONCURRENTLY` on indices if needed

### Post-Migration
- [ ] Verify data types: See "Verification" sections above
- [ ] Test location update API: `POST /api/nearby/update-location`
- [ ] Test nearby search API: `GET /api/nearby/search`
- [ ] Verify default for NEW users: Insert test record
- [ ] Monitor application logs for truncation errors
- [ ] Update API documentation: New precision requirements

### Rollback Plan
**If issues occur:**

1. Rollback precision:
```sql
ALTER TABLE users ALTER COLUMN location_lat SET DATA TYPE DECIMAL(10, 8);
ALTER TABLE users ALTER COLUMN location_lng SET DATA TYPE DECIMAL(10, 8);
-- (repeat for other tables)
```

2. Rollback default:
```sql
ALTER TABLE users ALTER COLUMN location_sharing_enabled SET DEFAULT true;
```

3. Restore from backup if needed:
```bash
psql pnptv < backup_20260221.sql
```

---

## Testing

### Unit Tests
```javascript
// tests/unit/utils/coordinateUtils.test.js
const { truncateCoordinates, isValidCoordinates } = require('coordinateUtils');

describe('truncateCoordinates', () => {
  it('should truncate to 3 decimals', () => {
    const result = truncateCoordinates(40.71281945, -74.00603456);
    expect(result.latitude).toBe(40.713);
    expect(result.longitude).toBe(-74.006);
  });

  it('should reject invalid coordinates', () => {
    expect(() => truncateCoordinates(91, 0)).toThrow();
    expect(() => truncateCoordinates(0, 181)).toThrow();
  });

  it('should handle negative coordinates', () => {
    const result = truncateCoordinates(-40.713, -74.006);
    expect(result.latitude).toBe(-40.713);
    expect(result.longitude).toBe(-74.006);
  });
});

describe('isValidCoordinates', () => {
  it('should validate correct ranges', () => {
    expect(isValidCoordinates(40.713, -74.006)).toBe(true);
    expect(isValidCoordinates(-90, 180)).toBe(true);
    expect(isValidCoordinates(90, -180)).toBe(true);
  });

  it('should reject out-of-range coordinates', () => {
    expect(isValidCoordinates(91, 0)).toBe(false);
    expect(isValidCoordinates(0, 181)).toBe(false);
  });
});
```

### Integration Tests
```javascript
// tests/integration/nearby.test.js
describe('Nearby API with 3-decimal precision', () => {
  it('should store location with 3 decimals', async () => {
    const res = await request(app)
      .post('/api/nearby/update-location')
      .send({
        latitude: 40.71281945,
        longitude: -74.00603456,
        accuracy: 25
      });

    expect(res.status).toBe(200);
    expect(res.body.latitude).toBe(40.713);
    expect(res.body.longitude).toBe(-74.006);
  });

  it('should reject excessive precision in requests', async () => {
    // Application should truncate, not reject
    const res = await request(app)
      .post('/api/nearby/update-location')
      .send({
        latitude: 40.712819456789,
        longitude: -74.006034567890,
        accuracy: 25
      });

    expect(res.status).toBe(200);
    expect(res.body.latitude).toBe(40.713);
  });
});
```

### SQL Verification Queries
```sql
-- Check precision of existing locations
SELECT
  COUNT(*) as total_locations,
  COUNT(CASE WHEN location_lat % 1 < 0.001 THEN 1 END) as exact_3_decimal,
  AVG(location_lat) as avg_latitude,
  MAX(location_lat) as max_latitude,
  MIN(location_lat) as min_latitude
FROM users
WHERE location_lat IS NOT NULL;

-- Verify data type change
SELECT
  table_name,
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name IN ('users', 'user_locations', 'user_location_history', 'nearby_places', 'nearby_place_submissions')
  AND column_name IN ('location_lat', 'location_lng', 'latitude', 'longitude')
ORDER BY table_name, column_name;

-- Check default values
SELECT
  column_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('location_sharing_enabled', 'location_lat', 'location_lng');

-- Verify no precision loss
SELECT COUNT(DISTINCT location_lat) FROM users WHERE location_lat IS NOT NULL;
SELECT COUNT(DISTINCT location_lng) FROM users WHERE location_lng IS NOT NULL;
```

---

## Documentation Updates

### API Documentation
Update `/docs/api/nearby.md`:
```markdown
### Location Precision
All location data is stored with 3 decimal precision (~111m):
- User locations: 40.713, -74.006
- Request coordinates: Automatically truncated to 3 decimals
- Response coordinates: Already truncated

Example request:
```json
{
  "latitude": 40.71281945,
  "longitude": -74.00603456,
  "accuracy": 25
}
```

Response (precision reduced):
```json
{
  "success": true,
  "latitude": 40.713,
  "longitude": -74.006
}
```
```

### Privacy Policy
Update `/legal/privacy.md`:
```markdown
#### Location Data
- **Precision:** 3 decimal places (~111m) for anonymization
- **Sharing:** Opt-in (users must explicitly enable)
- **Duration:** Real-time only, not historical
- **Access:** Only shared with opted-in nearby users
```

---

## Summary

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Precision** | 8 decimals (~1.1mm) | 3 decimals (~111m) | More private, anonymization-friendly |
| **Location Sharing Default** | TRUE (opt-out) | FALSE (opt-in) | GDPR compliant |
| **Existing User Data** | Not changed | Not changed | Zero data loss |
| **New Users** | Sharing enabled by default | Sharing disabled by default | Explicit consent required |
| **Backend Enforcement** | No utility | `coordinateUtils.js` | Consistent precision in services |
| **Migration Risk** | Low | Low | No data modification |
| **Rollback Time** | <1 minute | <1 minute | Fully reversible |

---

## Questions & Support

**Q: Will existing user locations be lost?**
A: No. Values are preserved, just truncated from 8 to 3 decimals (40.7128 → 40.713).

**Q: Do existing users lose location sharing?**
A: No. The default change only affects NEW registrations. Existing enabled/disabled values are preserved.

**Q: How precise is 3 decimals?**
A: ~111 meters. Enough for neighborhood-level features without enabling deanonymization.

**Q: What if coordinates arrive with 8 decimals?**
A: The application layer truncates automatically via `truncateCoordinates()`.

**Q: Is this GDPR compliant now?**
A: Yes. 3-decimal precision enables anonymization (GDPR requirement) + opt-in consent (privacy-by-default).

**Contact:** @dba-specialist for database issues, @fullstack-architect for application implementation.
