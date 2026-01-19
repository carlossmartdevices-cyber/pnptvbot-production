-- Migration to fix radio_now_playing table schema
-- Changes UUID id to INTEGER id to match code expectations

-- Check if radio_now_playing table exists and fix its schema
DO $$
DECLARE
    table_exists BOOLEAN;
    column_type TEXT;
    backup_table_name TEXT := 'radio_now_playing_backup_' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS');
    error_message TEXT;
BEGIN
    -- Check if radio_now_playing table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'radio_now_playing'
    ) INTO table_exists;

    IF table_exists THEN
        -- Get the current column type of id
        BEGIN
            SELECT data_type INTO column_type
            FROM information_schema.columns 
            WHERE table_name = 'radio_now_playing' AND column_name = 'id';

            -- If id is UUID, we need to migrate to INTEGER
            IF column_type = 'uuid' THEN
                RAISE NOTICE 'Migrating radio_now_playing table from UUID to INTEGER id';
                
                -- Create backup table
                BEGIN
                    EXECUTE format('CREATE TABLE %I AS SELECT * FROM radio_now_playing', backup_table_name);
                    EXCEPTION WHEN OTHERS THEN
                        RAISE NOTICE 'Could not create backup table: %', SQLERRM;
                        error_message := 'backup_failed';
                END;
                
                IF error_message IS NULL THEN
                    -- Drop the old table
                    BEGIN
                        DROP TABLE radio_now_playing;
                        EXCEPTION WHEN OTHERS THEN
                            RAISE NOTICE 'Could not drop old table: %', SQLERRM;
                            error_message := 'drop_failed';
                    END;
                END IF;
                
                IF error_message IS NULL THEN
                    -- Create new table with correct schema
                    BEGIN
                        CREATE TABLE radio_now_playing (
                          id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row
                          track_id UUID,
                          title VARCHAR(255),
                          artist VARCHAR(255),
                          duration VARCHAR(50),
                          cover_url TEXT,
                          started_at TIMESTAMP DEFAULT NOW(),
                          ends_at TIMESTAMP,
                          listener_count INTEGER DEFAULT 0,
                          updated_at TIMESTAMP DEFAULT NOW()
                        );
                        EXCEPTION WHEN OTHERS THEN
                            RAISE NOTICE 'Could not create new table: %', SQLERRM;
                            error_message := 'create_failed';
                    END;
                END IF;
                
                -- Try to restore data from backup if it exists
                IF error_message IS NULL THEN
                    BEGIN
                        INSERT INTO radio_now_playing (id, title, artist, duration, cover_url, started_at)
                        SELECT 
                            1, -- Always use id = 1
                            title,
                            artist,
                            duration,
                            cover_url,
                            started_at
                        FROM (SELECT * FROM public.radio_now_playing_backup_* ORDER BY started_at DESC LIMIT 1) AS latest;
                        EXCEPTION WHEN OTHERS THEN
                            RAISE NOTICE 'Could not restore data from backup: %', SQLERRM;
                    END;
                END IF;
                
            ELSE
                RAISE NOTICE 'radio_now_playing table already has correct schema (id is INTEGER)';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not check column type: %', SQLERRM;
            error_message := 'check_failed';
        END;
    ELSE
        RAISE NOTICE 'Creating radio_now_playing table with correct schema';
        -- Create the table with the correct schema
        BEGIN
            CREATE TABLE radio_now_playing (
              id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row
              track_id UUID,
              title VARCHAR(255),
              artist VARCHAR(255),
              duration VARCHAR(50),
              cover_url TEXT,
              started_at TIMESTAMP DEFAULT NOW(),
              ends_at TIMESTAMP,
              listener_count INTEGER DEFAULT 0,
              updated_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Insert default row
            INSERT INTO radio_now_playing (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create radio_now_playing table: %', SQLERRM;
                error_message := 'create_failed';
        END;
    END IF;
END $$;

-- Create indexes for radio_now_playing
CREATE INDEX IF NOT EXISTS idx_radio_now_playing_started_at ON radio_now_playing(started_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_radio_now_playing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for radio_now_playing updated_at
DROP TRIGGER IF EXISTS update_radio_now_playing_updated_at ON radio_now_playing;
CREATE TRIGGER update_radio_now_playing_updated_at
BEFORE UPDATE ON radio_now_playing
FOR EACH ROW
EXECUTE FUNCTION update_radio_now_playing_updated_at();