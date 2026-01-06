-- Migration: Add looking_for field to users table
-- This adds a field for users to specify what they're looking for

BEGIN;

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'looking_for'
    ) THEN
        -- Add the looking_for column
        ALTER TABLE users ADD COLUMN looking_for TEXT;
        
        -- Add index for searching
        CREATE INDEX IF NOT EXISTS idx_users_looking_for ON users(looking_for) WHERE looking_for IS NOT NULL;
        
        RAISE NOTICE 'Added looking_for column to users table';
    ELSE
        RAISE NOTICE 'looking_for column already exists, skipping migration';
    END IF;
END $$;

COMMIT;