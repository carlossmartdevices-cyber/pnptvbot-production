/**
 * Migration: Add PostGIS Geolocation Support
 * Adds geospatial tables and indices for user location tracking
 *
 * Tables:
 * - user_locations - Current and historical user locations
 * - blocked_users - Track who has blocked whom
 */

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- User Locations Table
-- Stores current and historical location data
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER NOT NULL DEFAULT 0, -- meters
  is_online BOOLEAN DEFAULT TRUE,
  geom GEOMETRY(POINT, 4326) NOT NULL, -- PostGIS geometry column
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT valid_accuracy CHECK (accuracy >= 0 AND accuracy <= 10000),
  UNIQUE(user_id) -- One record per user (upsert on updates)
);

-- Create spatial index for fast geospatial queries
CREATE INDEX IF NOT EXISTS idx_user_locations_geom
  ON user_locations USING GIST(geom);

-- Create indices for common queries
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id
  ON user_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at
  ON user_locations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_locations_is_online
  ON user_locations(is_online);

-- Trigger to automatically update geom column when lat/lon changes
CREATE OR REPLACE FUNCTION update_user_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_location_geom ON user_locations;

CREATE TRIGGER trigger_update_user_location_geom
BEFORE INSERT OR UPDATE ON user_locations
FOR EACH ROW
EXECUTE FUNCTION update_user_location_geom();

-- Blocked Users Table
-- Track who blocked whom for privacy
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT no_self_block CHECK (user_id != blocked_user_id),
  UNIQUE(user_id, blocked_user_id)
);

-- Create indices for blocked users
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id
  ON blocked_users(user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id
  ON blocked_users(blocked_user_id);

-- Location History Table (optional, for analytics)
-- Stores historical location data for movement tracking
CREATE TABLE IF NOT EXISTS user_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER NOT NULL DEFAULT 0,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_latitude_history CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude_history CHECK (longitude >= -180 AND longitude <= 180)
);

-- Create spatial index for history
CREATE INDEX IF NOT EXISTS idx_user_location_history_geom
  ON user_location_history USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_user_location_history_user_recorded
  ON user_location_history(user_id, recorded_at DESC);

-- Function to record location to history
CREATE OR REPLACE FUNCTION record_location_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_location_history (user_id, latitude, longitude, accuracy, geom)
  VALUES (NEW.user_id, NEW.latitude, NEW.longitude, NEW.accuracy, NEW.geom);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_location_history ON user_locations;

CREATE TRIGGER trigger_record_location_history
AFTER INSERT OR UPDATE ON user_locations
FOR EACH ROW
WHEN (NEW.is_online = TRUE)
EXECUTE FUNCTION record_location_history();

-- View: Nearby users query helper
-- Shows users near a specific location (example for 5km radius)
CREATE OR REPLACE VIEW vw_nearby_users AS
SELECT
  ul.user_id,
  ul.latitude,
  ul.longitude,
  ul.accuracy,
  u.first_name,
  u.username,
  u.avatar_url,
  ul.is_online,
  ul.last_seen
FROM user_locations ul
JOIN users u ON ul.user_id = u.id
WHERE ul.is_online = TRUE;

-- Sample data insertion (for testing)
-- Note: Replace with actual user IDs and locations
/*
INSERT INTO user_locations (user_id, latitude, longitude, accuracy)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 40.7128, -74.0060, 25),
  ('550e8400-e29b-41d4-a716-446655440001', 40.7130, -74.0058, 20)
ON CONFLICT (user_id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy = EXCLUDED.accuracy,
    updated_at = NOW();
*/

-- Migration completed
SELECT 'PostGIS Geolocation tables created successfully' AS migration_status;
