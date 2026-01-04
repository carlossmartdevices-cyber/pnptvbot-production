-- =====================================================
-- FIX USERS TABLE SCHEMA
-- Add missing columns that the code expects
-- =====================================================

BEGIN;

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorites TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Rename columns to match what the code expects
-- Note: Only rename if the column exists and target doesn't exist
DO $$
BEGIN
    -- Rename blocked_users to blocked if blocked doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'blocked_users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'blocked')
    THEN
        ALTER TABLE users RENAME COLUMN blocked_users TO blocked;
    END IF;

    -- Rename onboarding_completed to onboarding_complete if onboarding_complete doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_completed')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_complete')
    THEN
        ALTER TABLE users RENAME COLUMN onboarding_completed TO onboarding_complete;
    END IF;
END$$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_profile_views ON users(profile_views DESC);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

COMMIT;
