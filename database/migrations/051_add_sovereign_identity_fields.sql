-- =====================================================
-- MIGRATION 051: SOVEREIGN IDENTITY FIELDS
-- Adds pnptv_id (sovereign platform identity) and
-- x_id (X/Twitter OAuth ID for future login) to users.
--
-- pnptv_id: auto-generated UUID v4, permanent, never changes.
--           This is the user's true identity — independent of
--           Telegram, X, or any third-party platform.
--
-- x_id:     X/Twitter numeric user ID. Populated when the user
--           links their X account via OAuth. Separate from the
--           existing `twitter` column (which stores the @handle
--           for social display, not for authentication).
-- =====================================================

BEGIN;

-- Ensure uuid-ossp extension is available (required for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add pnptv_id (sovereign identity) — no inline UNIQUE, we create an index below
ALTER TABLE users ADD COLUMN IF NOT EXISTS pnptv_id VARCHAR(36);

-- Add x_id (X/Twitter OAuth user ID for future login) — no inline UNIQUE
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_id VARCHAR(50);

-- Backfill existing rows that don't have a pnptv_id yet
UPDATE users SET pnptv_id = uuid_generate_v4()::VARCHAR WHERE pnptv_id IS NULL;

-- Now enforce NOT NULL with default for new rows
ALTER TABLE users ALTER COLUMN pnptv_id SET DEFAULT uuid_generate_v4()::VARCHAR;
ALTER TABLE users ALTER COLUMN pnptv_id SET NOT NULL;

-- Indexes (unique constraints via indexes — partial index on x_id skips NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pnptv_id ON users(pnptv_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id) WHERE x_id IS NOT NULL;

COMMIT;
