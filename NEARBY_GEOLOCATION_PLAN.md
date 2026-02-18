# PNP Nearby - Geolocation System Architecture & Implementation Plan

**Version:** 1.0
**Date:** 2026-02-13
**Status:** Planning Phase

---

## 📍 System Overview

Privacy-preserving geolocation system for "Nearby" feature that:
1. Captures GPS from user's phone
2. Sends to backend API with authentication
3. Stores online users in **Redis GEO** (real-time, fast)
4. Stores registered users in **PostGIS** (persistent, accurate)
5. Queries nearby users with geographic radius
6. Returns locations with **rounded coordinates + random noise** (privacy)

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S PHONE (WEB APP)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Capture GPS                                                 │
│     navigator.geolocation.getCurrentPosition()                 │
│     ↓                                                            │
│  2. Send to API                                                 │
│     POST /api/nearby/update-location                           │
│     { latitude, longitude, accuracy }                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  3. Validate & Authenticate                                    │
│     - Check JWT token                                          │
│     - Validate location accuracy                               │
│     - Rate limit: 1 update/5sec                                │
│                                                                 │
│  4. Store in Redis GEO (Online Users)                          │
│     zadd geo:online:nearby userId longitude latitude           │
│     expire: 5 minutes (heartbeat)                              │
│                                                                 │
│  5. Store in PostGIS (Registered Users)                        │
│     INSERT user_locations (user_id, geom, timestamp)           │
│     geom = ST_SetSRID(ST_Point(lon, lat), 4326)               │
│     ON CONFLICT (user_id) DO UPDATE                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│              DATA LAYER (Redis + PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Redis GEO:                                                     │
│  ├─ geo:online:nearby → Zset with user coordinates             │
│  └─ TTL 5 min (real-time, temporary)                           │
│                                                                 │
│  PostgreSQL + PostGIS:                                          │
│  ├─ user_locations table (geometry column)                     │
│  ├─ Spatial indexes for fast queries                           │
│  └─ Persistent record of all locations                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NEARBY QUERY FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  6. Query Nearby Users                                          │
│     GET /api/nearby/search?radius=5&lat=40.7&lon=-74.0        │
│                                                                 │
│  7. Combined Query (Redis + PostGIS)                            │
│     ├─ Online users: GEORADIUS from Redis (fast)              │
│     ├─ Registered users: ST_DWithin() from PostGIS            │
│     └─ Merge & sort by distance                                │
│                                                                 │
│  8. Apply Privacy (Noise + Rounding)                            │
│     ├─ Round coords to 3 decimals (~111m accuracy)            │
│     ├─ Add ±random(0.0001-0.0009) for noise                   │
│     ├─ Show only distance, not exact coords                    │
│     └─ Hide user offline if not in online set                  │
│                                                                 │
│  9. Return Results                                              │
│     {                                                           │
│       users: [                                                  │
│         {                                                       │
│           id: "user_123",                                      │
│           username: "SantinoFurioso",                          │
│           distance_km: 2.1,                                    │
│           latitude: 40.7495,      // rounded + noise           │
│           longitude: -73.9697,    // rounded + noise           │
│           is_online: true,                                     │
│           updated_at: "2026-02-13T11:00:00Z"                  │
│         }                                                       │
│       ],                                                        │
│       search_center: { lat: 40.7505, lon: -73.9706 },         │
│       radius_km: 5                                              │
│     }                                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                  USER'S PHONE (WEB APP)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  10. Display on Map                                             │
│      ├─ Show users as markers                                   │
│      ├─ Display distance (not exact location)                   │
│      ├─ Interactive: tap for profile                           │
│      └─ Refresh every 10 seconds                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Tasks

### Phase 1: Frontend (Web App)

#### Task 1.1: GPS Capture & Permissions
**File:** `webapps/nearby/src/components/LocationCapture.jsx`

```javascript
// Request geolocation permission
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    // Send to backend
  },
  (error) => {
    // Handle permission denied, timeout, etc.
  },
  { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
);
```

**Requirements:**
- Handle permission denied gracefully
- Show accuracy indicator
- Request update every 30 seconds (heartbeat)
- Fall back to last known location if GPS fails

#### Task 1.2: Location Update Service
**File:** `webapps/nearby/src/services/locationService.js`

```javascript
class LocationService {
  async updateLocation(latitude, longitude, accuracy) {
    // POST /api/nearby/update-location
    // Rate limit: 1 update per 5 seconds
  }

  async searchNearby(radius = 5) {
    // GET /api/nearby/search?radius=5&lat=X&lon=Y
  }

  async startHeartbeat() {
    // Update location every 30 seconds
    // Stop on page unload
  }
}
```

#### Task 1.3: Map Display Component
**File:** `webapps/nearby/src/components/NearbyMap.jsx`

- Render nearby users as map markers
- Show distance (not exact location due to privacy)
- Handle click to view profile
- Refresh every 10 seconds
- Show "last seen" time for offline users

---

### Phase 2: Backend API

#### Task 2.1: Location Update Endpoint
**File:** `src/api/routes/nearbyRoutes.js`

```javascript
app.post('/api/nearby/update-location',
  telegramAuth,
  rateLimitMiddleware('nearby:update', { windowMs: 5000, max: 1 }),
  async (req, res) => {
    const { latitude, longitude, accuracy } = req.body;
    const userId = req.user.id;

    // 1. Validate coordinates
    // 2. Store in Redis GEO (online users)
    // 3. Store in PostGIS (all locations)
    // 4. Log to audit trail
  }
);
```

**Rate Limiting:**
- Max 1 request per 5 seconds per user
- Return 429 if exceeded

#### Task 2.2: Nearby Search Endpoint
**File:** `src/api/routes/nearbyRoutes.js`

```javascript
app.get('/api/nearby/search',
  telegramAuth,
  async (req, res) => {
    const { radius = 5, lat, lon } = req.query;
    const userId = req.user.id;

    // 1. Query Redis GEO for online users
    // 2. Query PostGIS for all users (with better accuracy)
    // 3. Combine results
    // 4. Apply privacy (rounding + noise)
    // 5. Return with distance calculated
  }
);
```

**Query Logic:**
```sql
-- PostGIS query
SELECT
  id, username, tier,
  ST_X(geom) as longitude,
  ST_Y(geom) as latitude,
  ST_Distance(geom, ST_GeomFromText('POINT(lon lat)', 4326)) as distance_m,
  updated_at
FROM user_locations
WHERE subscription_status = 'free' AND deleted_at IS NULL
AND ST_DWithin(
  geom,
  ST_GeomFromText('POINT(? ?)', 4326),
  ? -- radius in meters
)
ORDER BY distance_m ASC
LIMIT 100;
```

#### Task 2.3: Create/Manage Redis GEO Index
**File:** `src/bot/services/redisGeoService.js`

```javascript
class RedisGeoService {
  // Add user to online set
  async addOnlineUser(userId, latitude, longitude) {
    await redis.geoadd('geo:online:nearby', longitude, latitude, userId);
    await redis.expire('geo:online:nearby', 300); // 5 min TTL
  }

  // Query nearby online users
  async getNearbyOnline(latitude, longitude, radiusKm) {
    // GEORADIUSBYMEMBER or GEOSEARCH
    const results = await redis.georadius(
      'geo:online:nearby',
      longitude, latitude,
      radiusKm, 'km',
      'WITHDIST', 'WITHCOORD'
    );
    return results;
  }

  // Clean stale users (5+ min inactive)
  async cleanStaleUsers() {
    // Remove users not updated in 5 minutes
  }
}
```

#### Task 2.4: Create/Manage PostGIS Locations Table
**File:** `database/migrations/YYYYMMDDHHMMSS-create-user-locations.sql`

```sql
-- Create table with PostGIS geometry
CREATE TABLE user_locations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  geom GEOMETRY(Point, 4326) NOT NULL,
  accuracy INT,  -- GPS accuracy in meters
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create spatial index
CREATE INDEX idx_user_locations_geom ON user_locations USING GIST(geom);

-- Create index on user_id for quick updates
CREATE INDEX idx_user_locations_user_id ON user_locations(user_id);
```

---

### Phase 3: Privacy & Security

#### Task 3.1: Coordinate Rounding + Noise
**File:** `src/bot/services/privacyService.js`

```javascript
class PrivacyService {
  static applyLocationNoise(latitude, longitude) {
    // Step 1: Round to 3 decimals (~111m accuracy)
    const roundedLat = Math.round(latitude * 1000) / 1000;
    const roundedLon = Math.round(longitude * 1000) / 1000;

    // Step 2: Add random noise (±50-900m)
    const noiseLat = (Math.random() - 0.5) * 0.0018; // ±100m
    const noiseLon = (Math.random() - 0.5) * 0.0018; // ±100m

    return {
      latitude: roundedLat + noiseLat,
      longitude: roundedLon + noiseLon,
      accuracy_meters: 200, // Real accuracy hidden
    };
  }

  // Don't expose exact online status
  static maskOnlineStatus(user, isOnline) {
    if (!isOnline) {
      return null; // Don't show offline users
    }
    return {
      ...user,
      is_online: true,
      // Don't show exact last_seen timestamp
      last_update: '< 2 minutes ago'
    };
  }
}
```

#### Task 3.2: Permission Validation
- Only show nearby users to users with subscription_status = 'free' or higher
- Blocked users cannot see each other
- Users can opt-out of location sharing

#### Task 3.3: Data Retention Policy
- Redis: 5 minute TTL (real-time only)
- PostGIS: Keep last 7 days, then delete
- Don't expose location history to other users

---

### Phase 4: Testing & Monitoring

#### Task 4.1: Unit Tests
- `test/services/redisGeoService.test.js`
- `test/services/privacyService.test.js`
- `test/api/nearbyRoutes.test.js`

#### Task 4.2: Integration Tests
- End-to-end: Phone GPS → API → Redis → PostGIS → Response
- Privacy verification: Noise + rounding applied
- Rate limiting enforcement

#### Task 4.3: Load Testing
- Simulate 100+ concurrent users updating location
- Verify Redis GEO performance
- Monitor PostGIS query times (should be <100ms)

#### Task 4.4: Monitoring
- Track active users in `geo:online:nearby` set
- Monitor PostGIS query performance
- Alert if Redis connection drops
- Track privacy compliance (noise applied, offline users hidden)

---

## 🗄️ Database Schema

### Redis Keys
```
geo:online:nearby          → Zset of online users with coordinates (5min TTL)
nearby:update:rate:{userId} → Rate limit counter (5 second window)
```

### PostgreSQL Tables
```
user_locations:
  id              SERIAL PRIMARY KEY
  user_id         VARCHAR(255) UNIQUE NOT NULL
  geom            GEOMETRY(Point, 4326) NOT NULL  -- PostGIS Point
  accuracy        INT  -- GPS accuracy in meters
  updated_at      TIMESTAMP
```

---

## 🔐 Security Considerations

### 1. Rate Limiting
- Max 1 location update per 5 seconds per user
- Max 100 search queries per minute per user

### 2. Privacy by Default
- Coordinates always rounded + noisy
- Online status only shown for connected users
- Location history never exposed
- Blocked users cannot see location

### 3. Data Validation
- Latitude: -90 to +90
- Longitude: -180 to +180
- Accuracy: > 0 (reject invalid GPS)
- Reject if accuracy > 1000m (unreliable)

### 4. Authentication
- All endpoints require valid JWT token
- Verify user has location sharing enabled
- Log all location queries for audit

### 5. Data Deletion
- Delete user_locations when user account deleted
- Auto-purge entries older than 7 days
- Redis entries auto-expire (5 min TTL)

---

## 📊 Performance Targets

| Operation | Target | Technology |
|-----------|--------|------------|
| Location update | < 100ms | Redis GEO direct write |
| Nearby search (100 users) | < 200ms | PostGIS spatial index |
| Online users lookup | < 50ms | Redis GEORADIUS |
| Privacy application | < 10ms | In-memory math |
| Combined query | < 300ms | Redis + PostGIS batch |

---

## 🚀 Deployment Checklist

- [ ] PostGIS extension installed on PostgreSQL
- [ ] Spatial indexes created
- [ ] Redis GEO commands available (Redis 3.2+)
- [ ] API endpoints deployed and tested
- [ ] Web app geolocation permission handling
- [ ] Privacy noise + rounding verified
- [ ] Rate limiting enforced
- [ ] Monitoring & alerting set up
- [ ] User documentation created

---

## 📚 References

### PostGIS Documentation
- https://postgis.net/docs/ST_DWithin.html
- https://postgis.net/docs/ST_Distance.html
- https://postgis.net/docs/ST_SetSRID.html

### Redis GEO Commands
- https://redis.io/commands/geoadd
- https://redis.io/commands/georadius
- https://redis.io/commands/geohash

### Web Geolocation API
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- Permissions: https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API

---

## 🎯 Implementation Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|-----------------|
| 1 | Frontend GPS capture | 2-3 days |
| 2 | Backend API + Storage | 3-4 days |
| 3 | Privacy implementation | 1-2 days |
| 4 | Testing & monitoring | 2-3 days |
| **Total** | | **8-12 days** |

---

**Next Step:** Approve this plan and begin Phase 1 (Frontend GPS Capture)
