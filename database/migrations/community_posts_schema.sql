/**
 * Community Posts Schema Migration
 * Supports sharing posts to community groups with:
 * - Media (photo/video) support
 * - Formatted message templates
 * - Multiple button types and custom links
 * - Recurring/scheduled posting
 * - Multi-schedule support (1-12 posts into future)
 */

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. COMMUNITY GROUPS CONFIGURATION TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_groups (
  id SERIAL PRIMARY KEY,
  group_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  telegram_group_id VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(20) DEFAULT '📢',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial community groups
INSERT INTO community_groups (name, telegram_group_id, description, icon, display_order, is_active)
VALUES
  ('📍 Nearby', '-1001234567890', 'Geolocation-based feature', '📍', 1, true),
  ('👤 Profile', '-1001234567891', 'User profile viewing', '👤', 2, true),
  ('🎯 Main Room', '-1001234567892', 'PNPtv Main Group Channel', '🎯', 3, true),
  ('🎉 Hangouts', '-1001234567893', 'PNPtv Hangout Group', '🎉', 4, true),
  ('🤖 Cristina AI', '-1001234567894', 'AI Assistant Chat', '🤖', 5, true),
  ('🎬 Videorama', '-1001234567895', 'Video Section', '🎬', 6, true)
ON CONFLICT (telegram_group_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_community_groups_is_active ON community_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_community_groups_display_order ON community_groups(display_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. COMMUNITY POSTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  post_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  admin_id VARCHAR(255) NOT NULL,
  admin_username VARCHAR(255),

  -- Content
  title VARCHAR(500),
  message_en TEXT NOT NULL,
  message_es TEXT NOT NULL,

  -- Media
  media_type VARCHAR(50), -- 'photo', 'video', NULL for text-only
  media_url TEXT,
  s3_key TEXT,
  s3_bucket VARCHAR(255),
  telegram_file_id VARCHAR(255),

  -- Target groups (array of group UUIDs)
  target_group_ids UUID[] NOT NULL,
  target_all_groups BOOLEAN DEFAULT false,

  -- Formatting
  formatted_template_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'featured', 'announcement', 'event'
  button_layout VARCHAR(20) DEFAULT 'single_row', -- 'single_row', 'double_row', 'grid'

  -- Scheduling & Recurrence
  scheduled_at TIMESTAMP,
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- Recurrence config
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'custom'
  cron_expression VARCHAR(100),
  recurrence_end_date TIMESTAMP,
  max_occurrences INTEGER,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
  scheduled_count INTEGER DEFAULT 0, -- How many times scheduled (1-12)
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_admin_id ON community_posts(admin_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_scheduled_at ON community_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_recurring ON community_posts(is_recurring);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. COMMUNITY POST BUTTONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_post_buttons (
  id SERIAL PRIMARY KEY,
  button_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  button_type VARCHAR(50) NOT NULL, -- 'nearby', 'profile', 'main_room', 'hangouts', 'cristina_ai', 'videorama', 'custom'
  button_label VARCHAR(255) NOT NULL,
  target_url TEXT,
  icon_emoji VARCHAR(10),
  button_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_post_buttons_post_id ON community_post_buttons(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_buttons_button_order ON community_post_buttons(post_id, button_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. COMMUNITY POST SCHEDULES TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_post_schedules (
  id SERIAL PRIMARY KEY,
  schedule_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50),
  cron_expression VARCHAR(100),
  next_execution_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'executing', 'completed', 'failed', 'cancelled'
  execution_order INT, -- 1-12 for multiple scheduled posts
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_post_schedules_scheduled_for ON community_post_schedules(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_community_post_schedules_post_id ON community_post_schedules(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_schedules_status ON community_post_schedules(status);
CREATE INDEX IF NOT EXISTS idx_community_post_schedules_next_execution ON community_post_schedules(next_execution_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. COMMUNITY POST DELIVERY TRACKING
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_post_deliveries (
  id SERIAL PRIMARY KEY,
  delivery_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  schedule_id UUID,
  group_id UUID NOT NULL,
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
  FOREIGN KEY (schedule_id) REFERENCES community_post_schedules(schedule_id) ON DELETE SET NULL,
  FOREIGN KEY (group_id) REFERENCES community_groups(group_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_post_deliveries_post_id ON community_post_deliveries(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_deliveries_status ON community_post_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_community_post_deliveries_group_id ON community_post_deliveries(group_id);
CREATE INDEX IF NOT EXISTS idx_community_post_deliveries_schedule_id ON community_post_deliveries(schedule_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. COMMUNITY POST ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_post_analytics (
  id SERIAL PRIMARY KEY,
  analytics_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  group_id UUID,

  -- Engagement metrics
  views INT DEFAULT 0,
  interactions INT DEFAULT 0,
  button_clicks INT DEFAULT 0,
  replies INT DEFAULT 0,
  reactions INT DEFAULT 0,

  -- Button-specific clicks
  button_click_details JSONB, -- { "button_id": count, ... }

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES community_groups(group_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_community_post_analytics_post_id ON community_post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_analytics_group_id ON community_post_analytics(group_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Predefined Button Configuration
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_button_presets (
  id SERIAL PRIMARY KEY,
  preset_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  button_type VARCHAR(50) NOT NULL UNIQUE,
  button_label VARCHAR(255) NOT NULL,
  default_label VARCHAR(255) NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(10),
  target_url TEXT, -- Static URL if applicable
  allow_custom_url BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed button presets
INSERT INTO community_button_presets
  (button_type, button_label, default_label, description, icon_emoji, allow_custom_url, is_active)
VALUES
  ('nearby', '📍 Nearby', 'See Nearby', 'Geolocation-based feature', '📍', false, true),
  ('profile', '👤 Profile', 'View Profile', 'User profile viewing', '👤', false, true),
  ('main_room', '🎯 Main Room', 'Join Main Room', 'PNPtv Main Group Channel', '🎯', false, true),
  ('hangouts', '🎉 Hangouts', 'Join Hangouts', 'PNPtv Hangout Group', '🎉', false, true),
  ('cristina_ai', '🤖 Cristina AI', 'Chat with Cristina', 'AI Assistant', '🤖', false, true),
  ('videorama', '🎬 Videorama', 'Watch Videos', 'Video Section', '🎬', false, true),
  ('custom', '🔗 Custom Link', 'Learn More', 'User-provided URL', '🔗', true, true)
ON CONFLICT (button_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_community_button_presets_button_type ON community_button_presets(button_type);
CREATE INDEX IF NOT EXISTS idx_community_button_presets_is_active ON community_button_presets(is_active);
