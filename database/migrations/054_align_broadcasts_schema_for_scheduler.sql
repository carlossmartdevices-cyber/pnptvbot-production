-- Align legacy broadcasts table with scheduler expectations

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS message_en TEXT,
  ADD COLUMN IF NOT EXISTS message_es TEXT,
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS media_file_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS s3_key TEXT,
  ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(255),
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS include_filters JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exclude_user_ids TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS total_recipients INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deactivated_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processed_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0.00;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'broadcasts' AND column_name = 'message'
    ) THEN
        ALTER TABLE broadcasts
        ALTER COLUMN message SET DEFAULT '';
    END IF;
END
$$;

UPDATE broadcasts
SET
  admin_id = COALESCE(admin_id, NULL), -- Assuming admin_id is BIGINT, set to NULL if missing
  admin_username = COALESCE(admin_username, ''), -- Assuming admin_username can be empty if created_by is missing
  message_en = COALESCE(message_en, message_es, ''),
  message_es = COALESCE(message_es, ''),
  target_type = COALESCE(target_type, '') -- Assuming target_type can be empty if target_tier is missing
WHERE admin_id IS NULL
   OR admin_username IS NULL
   OR message_en IS NULL
   OR message_es IS NULL
   OR target_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_broadcasts_admin_id ON broadcasts(admin_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
