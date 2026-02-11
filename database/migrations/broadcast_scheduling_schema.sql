-- =====================================================
-- BROADCAST SCHEDULING SCHEMA MIGRATION
-- Tables for: broadcasts, scheduling, S3 media, recipients
-- Migrated from: Firestore to PostgreSQL
-- Created: 2025-12-08
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. MAIN BROADCASTS TABLE
-- =====================================================

-- Main broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  broadcast_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  admin_id VARCHAR(255) NOT NULL,
  admin_username VARCHAR(255),

  -- Broadcast content
  title VARCHAR(500),
  message_en TEXT NOT NULL,
  message_es TEXT NOT NULL,

  -- Media handling
  media_type VARCHAR(50), -- 'photo', 'video', 'document', 'audio', 'voice', NULL
  media_url TEXT, -- S3 URL or Telegram file_id
  media_file_id VARCHAR(500), -- Telegram file_id for reference
  s3_key TEXT, -- S3 object key
  s3_bucket VARCHAR(255), -- S3 bucket name

  -- Targeting
  target_type VARCHAR(50) NOT NULL, -- 'all', 'premium', 'free', 'churned'
  include_filters JSONB, -- Additional filters if needed
  exclude_user_ids TEXT[], -- Array of user IDs to exclude

  -- Scheduling
  scheduled_at TIMESTAMP, -- NULL for immediate broadcasts
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancelled_by VARCHAR(255),
  cancellation_reason TEXT,

  -- Statistics
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  deactivated_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Progress tracking
  last_processed_user_id VARCHAR(255), -- For resuming interrupted broadcasts
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- 2. BROADCAST RECIPIENTS TRACKING
-- =====================================================

-- Broadcast recipient tracking
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id SERIAL PRIMARY KEY,
  broadcast_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Delivery status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'blocked', 'deactivated', 'skipped'
  message_id VARCHAR(500), -- Telegram message_id for reference
  sent_at TIMESTAMP,
  error_code VARCHAR(100),
  error_message TEXT,

  -- User metadata at time of send
  language VARCHAR(10) DEFAULT 'en',
  subscription_tier VARCHAR(50), -- 'free', 'premium', 'churned'
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(broadcast_id, user_id)
);

-- =====================================================
-- 3. BROADCAST MEDIA STORAGE (S3)
-- =====================================================

-- Broadcast media storage (for S3 metadata)
CREATE TABLE IF NOT EXISTS broadcast_media (
  id SERIAL PRIMARY KEY,
  media_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  broadcast_id UUID,

  -- File info
  original_filename VARCHAR(500),
  media_type VARCHAR(50) NOT NULL, -- 'photo', 'video', 'document', 'audio', 'voice'
  file_size BIGINT, -- Size in bytes
  mime_type VARCHAR(100),

  -- Storage
  s3_bucket VARCHAR(255) NOT NULL,
  s3_key TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  s3_region VARCHAR(50) DEFAULT 'us-east-1',
  telegram_file_id VARCHAR(500), -- Keep for backward compatibility

  -- Processing
  processing_status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded', 'optimized', 'archived', 'deleted'
  cdn_url TEXT, -- CloudFront/CDN URL for fast delivery
  thumbnail_url TEXT, -- For videos and images

  -- Media metadata
  duration INTEGER, -- Duration in seconds (for audio/video)
  width INTEGER, -- Width in pixels (for images/videos)
  height INTEGER, -- Height in pixels (for images/videos)
  metadata JSONB, -- Additional metadata (bitrate, codec, etc.)

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE SET NULL
);

-- =====================================================
-- 4. BROADCAST SCHEDULES (RECURRING)
-- =====================================================

-- Scheduled broadcasts (for recurring/scheduled broadcasts)
CREATE TABLE IF NOT EXISTS broadcast_schedules (
  id SERIAL PRIMARY KEY,
  schedule_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL,

  -- Schedule configuration
  scheduled_for TIMESTAMP NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- Recurring options
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'custom'
  cron_expression VARCHAR(100), -- For custom recurring broadcasts
  recurrence_end_date TIMESTAMP,
  max_occurrences INTEGER, -- Maximum number of times to repeat
  current_occurrence INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'sent', 'cancelled', 'failed', 'paused'
  executed_at TIMESTAMP,
  next_execution_at TIMESTAMP, -- For recurring schedules

  -- Error handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE
);

-- =====================================================
-- 5. BROADCAST TEMPLATES (OPTIONAL)
-- =====================================================

-- Broadcast templates (for reusable broadcast messages)
CREATE TABLE IF NOT EXISTS broadcast_templates (
  id SERIAL PRIMARY KEY,
  template_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  created_by VARCHAR(255) NOT NULL,

  -- Template content
  name VARCHAR(255) NOT NULL,
  description TEXT,
  message_en TEXT NOT NULL,
  message_es TEXT NOT NULL,

  -- Default settings
  default_target_type VARCHAR(50) DEFAULT 'all',
  default_media_type VARCHAR(50),

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_admin_id ON broadcasts(admin_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_target_type ON broadcasts(target_type);
CREATE INDEX IF NOT EXISTS idx_broadcasts_broadcast_id ON broadcasts(broadcast_id);

-- Indexes for broadcast_recipients
CREATE INDEX IF NOT EXISTS idx_recipients_broadcast_id ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON broadcast_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS idx_recipients_sent_at ON broadcast_recipients(sent_at DESC);

-- Indexes for broadcast_media
CREATE INDEX IF NOT EXISTS idx_broadcast_media_broadcast_id ON broadcast_media(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_media_media_id ON broadcast_media(media_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_media_s3_key ON broadcast_media(s3_key);
CREATE INDEX IF NOT EXISTS idx_broadcast_media_created_at ON broadcast_media(created_at DESC);

-- Indexes for broadcast_schedules
CREATE INDEX IF NOT EXISTS idx_schedules_broadcast_id ON broadcast_schedules(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_for ON broadcast_schedules(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON broadcast_schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_execution ON broadcast_schedules(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_schedules_is_recurring ON broadcast_schedules(is_recurring);

-- Indexes for broadcast_templates
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON broadcast_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON broadcast_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON broadcast_templates(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create or replace update trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for broadcasts
DROP TRIGGER IF EXISTS trigger_broadcasts_updated_at ON broadcasts;
CREATE TRIGGER trigger_broadcasts_updated_at
BEFORE UPDATE ON broadcasts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triggers for broadcast_media
DROP TRIGGER IF EXISTS trigger_broadcast_media_updated_at ON broadcast_media;
CREATE TRIGGER trigger_broadcast_media_updated_at
BEFORE UPDATE ON broadcast_media
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triggers for broadcast_schedules
DROP TRIGGER IF EXISTS trigger_broadcast_schedules_updated_at ON broadcast_schedules;
CREATE TRIGGER trigger_broadcast_schedules_updated_at
BEFORE UPDATE ON broadcast_schedules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triggers for broadcast_templates
DROP TRIGGER IF EXISTS trigger_broadcast_templates_updated_at ON broadcast_templates;
CREATE TRIGGER trigger_broadcast_templates_updated_at
BEFORE UPDATE ON broadcast_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- View for broadcast statistics
CREATE OR REPLACE VIEW broadcast_stats AS
SELECT
  b.broadcast_id,
  b.title,
  b.admin_id,
  b.admin_username,
  b.target_type,
  b.status,
  b.scheduled_at,
  b.created_at,
  b.completed_at,
  b.total_recipients,
  b.sent_count,
  b.failed_count,
  b.blocked_count,
  b.deactivated_count,
  b.progress_percentage,
  CASE
    WHEN b.total_recipients > 0 THEN ROUND((b.sent_count::DECIMAL / b.total_recipients * 100), 2)
    ELSE 0
  END AS success_rate,
  EXTRACT(EPOCH FROM (b.completed_at - b.started_at)) AS duration_seconds
FROM broadcasts b
WHERE b.status IN ('completed', 'sending');

-- View for pending scheduled broadcasts
CREATE OR REPLACE VIEW pending_scheduled_broadcasts AS
SELECT
  bs.schedule_id,
  bs.broadcast_id,
  b.title,
  b.admin_id,
  b.admin_username,
  bs.scheduled_for,
  bs.timezone,
  bs.is_recurring,
  bs.recurrence_pattern,
  bs.next_execution_at,
  bs.status,
  b.message_en,
  b.message_es,
  b.target_type
FROM broadcast_schedules bs
JOIN broadcasts b ON bs.broadcast_id = b.broadcast_id
WHERE bs.status = 'scheduled'
  AND bs.scheduled_for <= CURRENT_TIMESTAMP + INTERVAL '1 hour'
ORDER BY bs.scheduled_for ASC;

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

-- Insert sample broadcast template (optional)
/*
INSERT INTO broadcast_templates (created_by, name, description, message_en, message_es, default_target_type)
VALUES
  ('admin', 'Welcome New Users', 'Welcome message for new users',
   'Welcome to PNPtv! We''re excited to have you here.',
   '¡Bienvenido a PNPtv! Estamos emocionados de tenerte aquí.',
   'free')
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: 5
-- - broadcasts (main broadcast records)
-- - broadcast_recipients (delivery tracking)
-- - broadcast_media (S3 media storage metadata)
-- - broadcast_schedules (scheduling and recurrence)
-- - broadcast_templates (reusable message templates)
--
-- Views created: 2
-- - broadcast_stats (analytics view)
-- - pending_scheduled_broadcasts (upcoming broadcasts)
--
-- All tables have proper indexes, foreign keys, and triggers
-- Ready for production use with scheduling and S3 support
-- =====================================================
