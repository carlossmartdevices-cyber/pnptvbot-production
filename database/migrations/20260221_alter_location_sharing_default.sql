/**
 * Migration 20260221_alter_location_sharing_default
 * Change location_sharing_enabled default from TRUE (opt-out) to FALSE (opt-in)
 *
 * GDPR Compliance:
 * - Opt-out (default TRUE) violates GDPR privacy-by-default principle
 * - Opt-in (default FALSE) requires explicit user consent
 *
 * Impact:
 * - Affects NEW users only (via default value)
 * - Existing user preferences unchanged (no data modification)
 * - Existing TRUE values remain TRUE
 *
 * Rollback: SET DEFAULT TRUE
 */

BEGIN;

-- Update the default value for location_sharing_enabled
ALTER TABLE users
  ALTER COLUMN location_sharing_enabled SET DEFAULT false;

-- Add a comment documenting the change
COMMENT ON COLUMN users.location_sharing_enabled IS 'User consent for location sharing. Default FALSE (opt-in, GDPR compliant). Changed 2026-02-21 from TRUE (opt-out)';

-- Verification query (no data changes, just metadata):
-- SELECT COUNT(*) WHERE location_sharing_enabled = true; -- Should be unchanged

COMMIT;
