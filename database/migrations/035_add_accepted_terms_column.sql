-- Migration: Add accepted_terms column to users table
-- This column tracks whether users have accepted the terms and conditions
-- for Hangouts and Videorama

BEGIN;

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'accepted_terms'
    ) THEN
        -- Add the column
        ALTER TABLE users 
        ADD COLUMN accepted_terms BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added accepted_terms column to users table';
    ELSE
        RAISE NOTICE 'accepted_terms column already exists';
    END IF;
END $$;

COMMIT;