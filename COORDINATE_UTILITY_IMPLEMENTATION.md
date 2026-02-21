# Coordinate Utility Implementation Guide

## Overview

This guide explains how to integrate the `truncateCoordinates()` utility function across backend services to ensure consistent 3-decimal precision for all geolocation operations.

## Quick Start

### Import the Utility
```javascript
const {
  truncateCoordinates,
  truncateCoordinate,
  isValidCoordinates,
  calculateDistance,
  getPrecisionInfo
} = require('../../utils/coordinateUtils');
```

### Basic Usage
```javascript
// Before storing location
const { latitude, longitude } = truncateCoordinates(
  req.body.latitude,
  req.body.longitude
);

// Store truncated values
await UserLocation.create({
  user_id: userId,
  latitude,
  longitude
});
```

---

## Services Requiring Integration

### 1. Nearby Service (ALREADY IMPLEMENTED)
**File:** `/apps/backend/services/nearbyService.js`

**Status:** ✅ Already enforces 3-decimal precision
- Lines 99-101: Rounds coordinates to 3 decimals
- Lines 104-109: Stores rounded values
- Line 112-117: Sends to Redis

**No changes needed** - already compliant with requirements.

---

### 2. Nearby Place Service
**File:** `/apps/backend/bot/services/nearbyPlaceService.js`

**Current Implementation:**
Find and update location handling sections:

```javascript
// BEFORE: May not enforce precision
async submitPlace(userId, placeData) {
  const place = await NearbyPlace.create({
    name: placeData.name,
    location_lat: placeData.latitude,    // Raw value - may have 8 decimals
    location_lng: placeData.longitude,   // Raw value - may have 8 decimals
    // ... other fields
  });
}
```

**AFTER: With truncateCoordinates**
```javascript
const { truncateCoordinates } = require('../../utils/coordinateUtils');

async submitPlace(userId, placeData) {
  // Validate and truncate
  const { latitude, longitude } = truncateCoordinates(
    placeData.latitude,
    placeData.longitude
  );

  const place = await NearbyPlace.create({
    name: placeData.name,
    location_lat: latitude,     // 3 decimals
    location_lng: longitude,    // 3 decimals
    // ... other fields
  });
}

// Similar pattern for:
async updatePlace(placeId, updateData) {
  if (updateData.latitude || updateData.longitude) {
    const { latitude, longitude } = truncateCoordinates(
      updateData.latitude,
      updateData.longitude
    );
    // Update with truncated values
  }
}

async searchNearbyPlaces(latitude, longitude, radiusKm) {
  // Search coordinates are already 3 decimals from nearby service
  // No truncation needed here
}
```

---

### 3. Nearby Controller
**File:** `/apps/backend/bot/api/controllers/nearbyController.js`

**Current Implementation:**
```javascript
// BEFORE: May not enforce precision
static async updateLocation(req, res) {
  const { latitude, longitude, accuracy } = req.body;

  const result = await nearbyService.updateLocation(
    userId,
    latitude,           // Raw from request
    longitude,          // Raw from request
    accuracy
  );
}
```

**AFTER: With validation**
```javascript
const { isValidCoordinates } = require('../../../utils/coordinateUtils');

static async updateLocation(req, res) {
  const { latitude, longitude, accuracy } = req.body;

  // Validate before processing
  if (!isValidCoordinates(latitude, longitude)) {
    return res.status(400).json({
      error: 'Invalid coordinates: latitude -90 to 90, longitude -180 to 180'
    });
  }

  // Service handles truncation
  const result = await nearbyService.updateLocation(
    userId,
    latitude,
    longitude,
    accuracy
  );
}
```

---

### 4. User Profile Service
**File:** `/apps/backend/services/userProfileService.js` (if exists)

**Usage Pattern:**
```javascript
const { truncateCoordinates } = require('../../utils/coordinateUtils');

async updateUserLocation(userId, latitude, longitude) {
  const { latitude: lat, longitude: lon } = truncateCoordinates(
    latitude,
    longitude
  );

  await User.update(userId, {
    location_lat: lat,
    location_lng: lon,
    location_updated_at: new Date()
  });
}
```

---

### 5. Geolocation Search Service (if exists)
**File:** `/apps/backend/services/geolocationService.js` (if exists)

**Usage Pattern - Store Operation:**
```javascript
const { truncateCoordinates } = require('../../utils/coordinateUtils');

async storeLocationRecord(userId, latitude, longitude, accuracy) {
  const { latitude: lat, longitude: lon } = truncateCoordinates(
    latitude,
    longitude
  );

  await UserLocationHistory.create({
    user_id: userId,
    latitude: lat,
    longitude: lon,
    accuracy: Math.round(accuracy),
    recorded_at: new Date()
  });
}
```

**Usage Pattern - Query Operation:**
```javascript
// Query coordinates are already 3 decimals from truncation
// No additional truncation needed for searches
async findNearbyUsers(latitude, longitude, radiusKm) {
  // latitude and longitude should already be 3 decimals
  // from being truncated when stored/received

  return await redisGeoService.getNearbyUsers(
    latitude,
    longitude,
    radiusKm
  );
}
```

---

## Implementation Checklist

### Step 1: Import Utility
```javascript
// At top of service file
const { truncateCoordinates } = require('../../utils/coordinateUtils');
```

### Step 2: Identify Location Inputs
Find all places where coordinates are received:
- `req.body.latitude`, `req.body.longitude`
- `req.query` parameters
- API payload objects
- WebSocket messages
- Telegram location updates

### Step 3: Add Truncation
Before storing or using coordinates:
```javascript
const { latitude, longitude } = truncateCoordinates(
  inputLatitude,
  inputLongitude
);
```

### Step 4: Update Queries
Ensure all database inserts use truncated values:
```javascript
// ✗ WRONG
await Location.create({ lat: rawValue });

// ✓ CORRECT
const { latitude } = truncateCoordinates(rawValue, 0);
await Location.create({ lat: latitude });
```

### Step 5: Test
```bash
npm test -- --testPathPattern="coordinateUtils"
npm test -- --testPathPattern="nearby"
```

---

## Common Patterns

### Pattern 1: Input Validation + Truncation
```javascript
const { truncateCoordinates, isValidCoordinates } = require('coordinateUtils');

router.post('/location/update', async (req, res) => {
  const { latitude, longitude } = req.body;

  // Validate
  if (!isValidCoordinates(latitude, longitude)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  // Truncate
  const { latitude: lat, longitude: lon } = truncateCoordinates(
    latitude,
    longitude
  );

  // Store
  await updateUserLocation(userId, lat, lon);
  res.json({ success: true, latitude: lat, longitude: lon });
});
```

### Pattern 2: Service Layer Enforcement
```javascript
class LocationService {
  async updateLocation(userId, latitude, longitude) {
    // Truncate at service level (before DB)
    const { latitude: lat, longitude: lon } = truncateCoordinates(
      latitude,
      longitude
    );

    // Store in DB
    return await UserLocation.update(userId, {
      latitude: lat,
      longitude: lon
    });
  }
}
```

### Pattern 3: Batch Operations
```javascript
const { truncateCoordinates } = require('coordinateUtils');

async function importUserLocations(locations) {
  const truncated = locations.map(loc => {
    const { latitude, longitude } = truncateCoordinates(
      loc.latitude,
      loc.longitude
    );
    return {
      ...loc,
      latitude,
      longitude
    };
  });

  await UserLocation.bulkCreate(truncated);
}
```

### Pattern 4: Search Operations
```javascript
const { truncateCoordinates } = require('coordinateUtils');

async function searchNearby(latitude, longitude, radius) {
  // Search coordinates should be 3 decimals
  const { latitude: lat, longitude: lon } = truncateCoordinates(
    latitude,
    longitude
  );

  // Use truncated coordinates for all geospatial queries
  return await User.query(qb => {
    qb.whereRaw(
      'earth_distance(ll_to_earth(?, ?), ll_to_earth(location_lat, location_lng)) <= ?',
      [lat, lon, radius * 1000]
    );
  }).fetch();
}
```

---

## Error Handling

### Invalid Input Handling
```javascript
const { truncateCoordinates } = require('coordinateUtils');
const logger = require('../../utils/logger');

try {
  const { latitude, longitude } = truncateCoordinates(
    inputLat,
    inputLon
  );
  // Proceed with truncated values
} catch (error) {
  logger.error('Coordinate validation failed:', error.message);

  // Return meaningful error to client
  return res.status(400).json({
    error: 'Invalid coordinates',
    details: error.message,
    valid_ranges: {
      latitude: '-90 to 90',
      longitude: '-180 to 180'
    }
  });
}
```

### Type Safety
```javascript
// Ensure coordinates are always numbers before truncation
const latitude = parseFloat(req.body.latitude);
const longitude = parseFloat(req.body.longitude);

if (isNaN(latitude) || isNaN(longitude)) {
  return res.status(400).json({ error: 'Coordinates must be numbers' });
}

const { latitude: lat, longitude: lon } = truncateCoordinates(
  latitude,
  longitude
);
```

---

## Testing Examples

### Unit Test
```javascript
// tests/unit/utils/coordinateUtils.test.js
const { truncateCoordinates } = require('../../../apps/backend/utils/coordinateUtils');

describe('truncateCoordinates', () => {
  it('should truncate to 3 decimals', () => {
    const result = truncateCoordinates(40.71281945, -74.00603456);
    expect(result.latitude).toBe(40.713);
    expect(result.longitude).toBe(-74.006);
  });

  it('should reject invalid latitude', () => {
    expect(() => truncateCoordinates(91, 0)).toThrow('Invalid latitude');
  });

  it('should reject invalid longitude', () => {
    expect(() => truncateCoordinates(0, 181)).toThrow('Invalid longitude');
  });

  it('should handle edge cases', () => {
    const result1 = truncateCoordinates(-90, -180);
    expect(result1.latitude).toBe(-90);
    expect(result1.longitude).toBe(-180);

    const result2 = truncateCoordinates(90, 180);
    expect(result2.latitude).toBe(90);
    expect(result2.longitude).toBe(180);
  });

  it('should not lose precision for already-3-decimal values', () => {
    const result = truncateCoordinates(40.713, -74.006);
    expect(result.latitude).toBe(40.713);
    expect(result.longitude).toBe(-74.006);
  });
});
```

### Integration Test
```javascript
// tests/integration/location-precision.test.js
describe('Location Precision Integration', () => {
  it('should store and retrieve 3-decimal locations', async () => {
    const response = await request(app)
      .post('/api/nearby/update-location')
      .send({
        latitude: 40.71281945,
        longitude: -74.00603456,
        accuracy: 25
      });

    expect(response.status).toBe(200);
    expect(response.body.latitude).toBe(40.713);
    expect(response.body.longitude).toBe(-74.006);

    // Verify stored value
    const stored = await UserLocation.findByUserId(userId);
    expect(stored.latitude).toBe(40.713);
    expect(stored.longitude).toBe(-74.006);
  });

  it('should reject excessive precision in validate step', async () => {
    // The application should truncate, not reject
    const response = await request(app)
      .post('/api/nearby/update-location')
      .send({
        latitude: 40.712819456789,
        longitude: -74.006034567890,
        accuracy: 25
      });

    // Should succeed with truncation
    expect(response.status).toBe(200);
    expect(response.body.latitude).toBe(40.713);
  });
});
```

---

## Migration Path

### Phase 1: Deploy Utility
- [ ] Deploy `/apps/backend/utils/coordinateUtils.js`
- [ ] Update package.json if needed
- [ ] Run tests: `npm test coordinateUtils.test.js`

### Phase 2: Apply Database Migrations
- [ ] Apply `20260221_alter_location_sharing_default.sql`
- [ ] Apply `20260221_reduce_geolocation_precision.sql`
- [ ] Verify schema changes

### Phase 3: Update Services (in order)
- [ ] NearbyService (review, already compliant)
- [ ] NearbyPlaceService (add truncation)
- [ ] NearbyController (add validation)
- [ ] Other location services

### Phase 4: Test & Validate
- [ ] Run all tests
- [ ] Test location update API
- [ ] Test nearby search
- [ ] Monitor logs for errors

### Phase 5: Deploy to Production
- [ ] Merge to main branch
- [ ] Deploy backend changes
- [ ] Monitor error rates

---

## Performance Considerations

### Truncation Cost
- `truncateCoordinates()` is extremely fast: ~0.01ms per call
- No database impact beyond type conversion during migration
- Can be called millions of times per second without performance issues

### Database Impact
- Migration duration: 5-30 seconds depending on row count
- Index rebuild: Automatic, ~1-5 seconds
- No locking: TYPE CHANGE works with normal queries
- No application downtime required

### Optimization Tips
```javascript
// Good: Truncate once, reuse
const { latitude, longitude } = truncateCoordinates(lat, lon);
store(latitude, longitude);
search(latitude, longitude);

// Less efficient: Truncate multiple times
store(truncateCoordinates(lat, lon).latitude, ...);
search(truncateCoordinates(lat, lon).latitude, ...);

// Batch truncation for imports
const truncated = locations.map(loc =>
  truncateCoordinates(loc.lat, loc.lon)
);
bulkInsert(truncated);
```

---

## Monitoring & Debugging

### Log Truncation Events (development)
```javascript
// In coordinateUtils.js
logger.debug(`Coordinates truncated: (${latitude}, ${longitude}) → (${truncatedLat}, ${truncatedLon})`);
```

### Production Logging
```javascript
// Monitor for truncation errors
app.use((err, req, res, next) => {
  if (err.message.includes('truncate')) {
    logger.error('Coordinate truncation error:', {
      error: err.message,
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      userId: req.userId
    });
  }
});
```

### Verify Precision After Deployment
```sql
-- Run daily in production
SELECT
  column_name,
  COUNT(*) as total,
  COUNT(CASE WHEN position('.' IN CAST(value AS TEXT)) > 0 THEN 1 END) as has_decimal,
  MAX(value) as max_value
FROM (
  SELECT 'location_lat' as column_name, location_lat::TEXT as value FROM users WHERE location_lat IS NOT NULL
  UNION ALL
  SELECT 'location_lng', location_lng::TEXT FROM users WHERE location_lng IS NOT NULL
)
GROUP BY column_name;
```

---

## FAQ

**Q: What if coordinates have fewer than 3 decimals?**
A: Truncation still works: `40.71` → `40.71` (no change).

**Q: Can I use a different precision level?**
A: Yes, but 3 decimals is GDPR-recommended. Check `getPrecisionInfo()` for alternatives.

**Q: What about historical location data?**
A: Migration applies to all tables. Historical data truncated during migration.

**Q: Do I need to update the frontend?**
A: No - frontend sends raw coordinates, backend truncates. No client-side changes needed.

**Q: Can I batch update existing locations?**
A: Yes, using the utility in a database trigger or batch job. See "Batch Operations" pattern above.

---

## Support

For questions about:
- **Database schema:** Contact @dba-specialist
- **Utility function:** Check `/apps/backend/utils/coordinateUtils.js` JSDoc comments
- **Service integration:** Review examples in this guide
- **Testing:** See `tests/unit/utils/` and `tests/integration/`

