/**
 * Community Posts Enhancements
 * Adds support for:
 * - Prime channel posting
 * - Large video uploads (streaming)
 * - Extended media metadata
 */

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADD PRIME CHANNEL AND CHANNEL POSTING
-- ═══════════════════════════════════════════════════════════════════════════

-- Add Prime Channel to community_groups if not exists
INSERT INTO community_groups (name, telegram_group_id, description, icon, display_order, is_active)
VALUES
  ('💎 Prime Channel', '-1002997324714', 'PNPtv Prime Member Channel', '💎', 0, true)
ON CONFLICT (telegram_group_id) DO NOTHING;

-- Add destination type column to posts if not exists
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS destination_type VARCHAR(50) DEFAULT 'group'; -- 'group' or 'channel'

-- Add channel posting flags
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS post_to_prime_channel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS post_to_groups BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ENHANCED MEDIA TABLE FOR LARGE VIDEO SUPPORT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_media_enhanced (
  id SERIAL PRIMARY KEY,
  media_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,

  -- Media info
  media_type VARCHAR(50) NOT NULL, -- 'photo', 'video', 'document'
  original_filename VARCHAR(255),
  file_size_bytes BIGINT,
  duration_seconds INT, -- for videos

  -- Storage locations
  s3_key TEXT NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  s3_url TEXT,
  cdn_url TEXT,

  -- Telegram references (multiple file IDs for different qualities)
  telegram_file_id_original VARCHAR(255), -- Original quality
  telegram_file_id_compressed VARCHAR(255), -- Compressed version
  telegram_file_id_streaming VARCHAR(255), -- Stream-optimized

  -- Video streaming support
  has_streaming BOOLEAN DEFAULT false,
  streaming_m3u8_url TEXT, -- HLS playlist for large videos
  streaming_quality_480p BOOLEAN DEFAULT false,
  streaming_quality_720p BOOLEAN DEFAULT false,
  streaming_quality_1080p BOOLEAN DEFAULT false,

  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'failed'
  processing_error TEXT,

  -- Metadata
  width INT,
  height INT,
  mime_type VARCHAR(50),
  checksum VARCHAR(255), -- For deduplication

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX idx_community_post_media_post_id ON community_post_media_enhanced(post_id);
CREATE INDEX idx_community_post_media_processing ON community_post_media_enhanced(processing_status);
CREATE INDEX idx_community_post_media_type ON community_post_media_enhanced(media_type);
CREATE INDEX idx_community_post_media_checksum ON community_post_media_enhanced(checksum);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CHANNEL DELIVERY TRACKING
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_channel_deliveries (
  id SERIAL PRIMARY KEY,
  delivery_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  schedule_id UUID,
  channel_name VARCHAR(255) NOT NULL, -- 'prime_channel', 'main_group', etc.
  channel_id VARCHAR(255) NOT NULL, -- Telegram channel ID

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retry'
  message_id VARCHAR(255),
  error_code VARCHAR(50),
  error_message TEXT,

  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES community_post_schedules(schedule_id) ON DELETE SET NULL
);

CREATE INDEX idx_post_channel_deliveries_post_id ON community_post_channel_deliveries(post_id);
CREATE INDEX idx_post_channel_deliveries_channel ON community_post_channel_deliveries(channel_name);
CREATE INDEX idx_post_channel_deliveries_status ON community_post_channel_deliveries(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. VIDEO PROCESSING QUEUE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_video_processing (
  id SERIAL PRIMARY KEY,
  task_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  media_id UUID NOT NULL,
  post_id UUID NOT NULL,

  -- Processing task
  task_type VARCHAR(50) NOT NULL, -- 'transcode', 'compress', 'generate_streaming', 'upload'
  priority INT DEFAULT 5, -- 1 (highest) to 10 (lowest)

  -- Status
  status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  progress_percent INT DEFAULT 0,
  error_message TEXT,

  -- Retry logic
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMP,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (media_id) REFERENCES community_post_media_enhanced(media_id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX idx_video_processing_status ON community_post_video_processing(status);
CREATE INDEX idx_video_processing_priority ON community_post_video_processing(priority, status);
CREATE INDEX idx_video_processing_post_id ON community_post_video_processing(post_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. POSTING DESTINATIONS CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_destinations (
  id SERIAL PRIMARY KEY,
  destination_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  destination_type VARCHAR(50) NOT NULL, -- 'channel', 'group'
  destination_name VARCHAR(255) NOT NULL,
  telegram_id VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(20),

  -- Capabilities
  supports_media BOOLEAN DEFAULT true,
  supports_videos BOOLEAN DEFAULT true,
  max_video_size_mb INT DEFAULT 2000, -- Telegram limit
  supports_buttons BOOLEAN DEFAULT true,
  supports_topics BOOLEAN DEFAULT false,

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  auto_delete_after_hours INT, -- Auto-delete messages after N hours, NULL = never

  display_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed posting destinations
INSERT INTO community_post_destinations (destination_type, destination_name, telegram_id, icon, display_order, is_active, supports_videos, max_video_size_mb)
VALUES
  ('channel', '💎 Prime Channel', '-1002997324714', '💎', 0, true, true, 2000),
  ('group', '📍 Nearby', '-1001234567890', '📍', 1, true, true, 2000),
  ('group', '👤 Profile', '-1001234567891', '👤', 2, true, true, 2000),
  ('group', '🎯 Main Room', '-1001234567892', '🎯', 3, true, true, 2000),
  ('group', '🎉 Hangouts', '-1001234567893', '🎉', 4, true, true, 2000),
  ('group', '🤖 Cristina AI', '-1001234567894', '🤖', 5, true, true, 2000),
  ('group', '🎬 Videorama', '-1001234567895', '🎬', 6, true, true, 2000)
ON CONFLICT (telegram_id) DO NOTHING;

CREATE INDEX idx_post_destinations_type ON community_post_destinations(destination_type);
CREATE INDEX idx_post_destinations_active ON community_post_destinations(is_active);
CREATE INDEX idx_post_destinations_order ON community_post_destinations(display_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. UPDATE COMMUNITY_POSTS TABLE STRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════

-- Add columns to support multiple destinations
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS post_to_destinations VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[]; -- Array of destination types

-- Add video-specific fields
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS video_file_size_mb INT,
ADD COLUMN IF NOT EXISTS video_duration_seconds INT,
ADD COLUMN IF NOT EXISTS uses_streaming BOOLEAN DEFAULT false;

-- Add channel-specific configuration
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS prime_channel_message_id VARCHAR(255);

CREATE INDEX idx_community_posts_destinations ON community_posts USING GIN(post_to_destinations);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ANALYTICS FOR CHANNELS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_channel_analytics (
  id SERIAL PRIMARY KEY,
  analytics_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  destination_name VARCHAR(255),

  -- Engagement for channels (usually lower engagement than groups)
  views INT DEFAULT 0,
  forwards INT DEFAULT 0,
  reactions INT DEFAULT 0,
  shares INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX idx_channel_analytics_post_id ON community_post_channel_analytics(post_id);
CREATE INDEX idx_channel_analytics_destination ON community_post_channel_analytics(destination_name);

-- ═══════════════════════════════════════════════════════════════════════════
-- Add status indicator for multi-destination posts
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_post_multi_destination_status (
  id SERIAL PRIMARY KEY,
  status_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,

  destination_type VARCHAR(50),
  destination_id VARCHAR(255),
  destination_name VARCHAR(255),

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retry'
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX idx_multi_status_post_id ON community_post_multi_destination_status(post_id);
CREATE INDEX idx_multi_status_destination ON community_post_multi_destination_status(destination_id);
CREATE INDEX idx_multi_status_status ON community_post_multi_destination_status(status);
