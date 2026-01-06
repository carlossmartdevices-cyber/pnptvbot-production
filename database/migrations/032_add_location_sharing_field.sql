-- Migration: Add location_sharing_enabled field to users table
-- This adds a field to control whether user's location is shared with others

BEGIN;

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'location_sharing_enabled'
    ) THEN
        -- Add the location_sharing_enabled column with default true
        ALTER TABLE users ADD COLUMN location_sharing_enabled BOOLEAN DEFAULT TRUE;
        
        -- Add index for efficient querying
        CREATE INDEX IF NOT EXISTS idx_users_location_sharing ON users(location_sharing_enabled) WHERE location_sharing_enabled = TRUE;
        
        RAISE NOTICE 'Added location_sharing_enabled column to users table';
    ELSE
        RAISE NOTICE 'location_sharing_enabled column already exists, skipping migration';
    END IF;
END $$;

COMMIT;