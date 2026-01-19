-- Migration to fix moderation table schema
-- Adds missing group_id column to support group-specific moderation settings

-- Check if moderation table exists and add group_id column if needed
DO $$
BEGIN
    -- Check if moderation table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'moderation') THEN
        -- Check if group_id column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'moderation' AND column_name = 'group_id') THEN
            RAISE NOTICE 'Adding group_id column to moderation table';
            ALTER TABLE moderation ADD COLUMN group_id VARCHAR(255);
            
            -- Create index for group_id
            CREATE INDEX IF NOT EXISTS idx_moderation_group_id ON moderation(group_id);
            
            -- Set default group_id for existing rows (if any)
            -- This assumes a default group or you can set it to NULL
            UPDATE moderation SET group_id = 'default' WHERE group_id IS NULL;
        END IF;
    END IF;
END $$;

-- Check if group_settings table exists and has the required columns
-- If it exists but is missing columns, we'll handle that gracefully
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_settings') THEN
        RAISE NOTICE 'Creating group_settings table';
        CREATE TABLE group_settings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          group_id VARCHAR(255) NOT NULL UNIQUE,
          group_title VARCHAR(255),

          -- Moderation settings
          anti_links_enabled BOOLEAN DEFAULT TRUE,
          anti_spam_enabled BOOLEAN DEFAULT TRUE,
          anti_flood_enabled BOOLEAN DEFAULT TRUE,
          anti_forwarded_enabled BOOLEAN DEFAULT TRUE,
          profanity_filter_enabled BOOLEAN DEFAULT FALSE,
          max_warnings INTEGER DEFAULT 3,
          flood_limit INTEGER DEFAULT 5,
          flood_window INTEGER DEFAULT 10,
          mute_duration INTEGER DEFAULT 3600,

          -- Custom filters
          allowed_domains TEXT[] DEFAULT '{}',
          banned_words TEXT[] DEFAULT '{}',

          -- Bot addition settings
          restrict_bot_addition BOOLEAN DEFAULT TRUE,
          allowed_bots TEXT[] DEFAULT '{pnptv_bot,PNPtvBot,PNPtvOfficialBot}',

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        RAISE NOTICE 'group_settings table already exists, skipping creation';
    END IF;
END $$;

-- Create indexes for group_settings if they don't exist and we have permission
DO $$
BEGIN
    -- Check if the index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'group_settings' 
        AND indexname = 'idx_group_settings_group_id'
    ) THEN
        BEGIN
            CREATE INDEX idx_group_settings_group_id ON group_settings(group_id);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create index idx_group_settings_group_id: %', SQLERRM;
        END;
    END IF;
END $$;