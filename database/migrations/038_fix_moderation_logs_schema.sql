-- Migration to fix moderation_logs table schema
-- Adds missing target_user_id column and created_at alias

-- Add target_user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'moderation_logs'
        AND column_name = 'target_user_id'
    ) THEN
        ALTER TABLE moderation_logs ADD COLUMN target_user_id VARCHAR(255);
        RAISE NOTICE 'Added target_user_id column to moderation_logs table';
    END IF;
END $$;

-- Add created_at column if it doesn't exist (code uses created_at, schema has timestamp)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'moderation_logs'
        AND column_name = 'created_at'
    ) THEN
        -- Check if timestamp column exists
        IF EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'moderation_logs'
            AND column_name = 'timestamp'
        ) THEN
            -- Rename timestamp to created_at for consistency with code
            ALTER TABLE moderation_logs RENAME COLUMN timestamp TO created_at;
            RAISE NOTICE 'Renamed timestamp column to created_at in moderation_logs table';
        ELSE
            -- Add created_at column
            ALTER TABLE moderation_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Added created_at column to moderation_logs table';
        END IF;
    END IF;
END $$;

-- Create index on target_user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_target_user_id ON moderation_logs(target_user_id);
