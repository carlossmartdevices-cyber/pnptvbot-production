/**
 * Migration 20260221_reduce_geolocation_precision
 * Reduce geolocation data precision from 8 to 3 decimals
 *
 * Privacy & Anonymization:
 * - Current: DECIMAL(10, 8) = ~1.1mm precision (excessive, GDPR risk)
 * - Target: DECIMAL(8, 3) = ~111m precision (anonymization-friendly)
 *
 * Affected Tables:
 * 1. users - location_lat, location_lng
 * 2. user_locations - latitude, longitude
 * 3. user_location_history - latitude, longitude
 * 4. nearby_places - location_lat, location_lng
 * 5. nearby_place_submissions - location_lat, location_lng
 *
 * Behavior:
 * - Precision reduction via data type change
 * - Existing values truncated to 3 decimals (e.g., 40.7128 stays 40.713)
 * - Application layer also enforces 3-decimal truncation
 * - Dual enforcement: DB + Application layer
 *
 * Rollback: Change back to DECIMAL(10, 8)
 */

BEGIN;

-- ===================================
-- 1. ALTER USERS TABLE
-- ===================================
ALTER TABLE users
  ALTER COLUMN location_lat SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN location_lng SET DATA TYPE NUMERIC(8, 3);

COMMENT ON COLUMN users.location_lat IS 'User latitude (3 decimals = ~111m precision, anonymization-friendly). Changed 2026-02-21 from 8 decimals.';
COMMENT ON COLUMN users.location_lng IS 'User longitude (3 decimals = ~111m precision, anonymization-friendly). Changed 2026-02-21 from 8 decimals.';

-- ===================================
-- 2. ALTER USER_LOCATIONS TABLE
-- ===================================
ALTER TABLE user_locations
  ALTER COLUMN latitude SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN longitude SET DATA TYPE NUMERIC(8, 3);

COMMENT ON COLUMN user_locations.latitude IS 'User latitude (3 decimals = ~111m precision, anonymization-friendly). Changed 2026-02-21 from 8 decimals.';
COMMENT ON COLUMN user_locations.longitude IS 'User longitude (3 decimals = ~111m precision, anonymization-friendly). Changed 2026-02-21 from 8 decimals.';

-- ===================================
-- 3. ALTER USER_LOCATION_HISTORY TABLE
-- ===================================
ALTER TABLE user_location_history
  ALTER COLUMN latitude SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN longitude SET DATA TYPE NUMERIC(8, 3);

COMMENT ON COLUMN user_location_history.latitude IS 'Historical user latitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';
COMMENT ON COLUMN user_location_history.longitude IS 'Historical user longitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';

-- ===================================
-- 4. ALTER NEARBY_PLACES TABLE
-- ===================================
ALTER TABLE nearby_places
  ALTER COLUMN location_lat SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN location_lng SET DATA TYPE NUMERIC(8, 3);

COMMENT ON COLUMN nearby_places.location_lat IS 'Place latitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';
COMMENT ON COLUMN nearby_places.location_lng IS 'Place longitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';

-- ===================================
-- 5. ALTER NEARBY_PLACE_SUBMISSIONS TABLE
-- ===================================
ALTER TABLE nearby_place_submissions
  ALTER COLUMN location_lat SET DATA TYPE NUMERIC(8, 3),
  ALTER COLUMN location_lng SET DATA TYPE NUMERIC(8, 3);

COMMENT ON COLUMN nearby_place_submissions.location_lat IS 'Submission latitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';
COMMENT ON COLUMN nearby_place_submissions.location_lng IS 'Submission longitude (3 decimals = ~111m precision). Changed 2026-02-21 from 8 decimals.';

-- ===================================
-- VERIFICATION QUERIES (optional, run after migration)
-- ===================================
-- Check data types were updated:
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name IN ('users', 'user_locations', 'user_location_history', 'nearby_places', 'nearby_place_submissions')
-- AND column_name IN ('location_lat', 'location_lng', 'latitude', 'longitude')
-- ORDER BY table_name, column_name;

-- Check for any data loss (should show original value rounded to 3 decimals):
-- SELECT COUNT(*) FROM users WHERE location_lat IS NOT NULL;
-- SELECT COUNT(*) FROM user_locations WHERE latitude IS NOT NULL;

COMMIT;
