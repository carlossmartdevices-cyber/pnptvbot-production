-- Migration: Add has_seen_tutorial field to users table
-- Description: Track if users have seen the PNP Latino tutorial

BEGIN;

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'has_seen_tutorial'
    ) THEN
        -- Add the column
        ALTER TABLE users 
        ADD COLUMN has_seen_tutorial BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added has_seen_tutorial column to users table';
    ELSE
        RAISE NOTICE 'has_seen_tutorial column already exists';
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_has_seen_tutorial ON users(has_seen_tutorial);

COMMIT;
