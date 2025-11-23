-- =====================================================
-- REMAINING FIRESTORE TABLES MIGRATION SCHEMA
-- Tables for: calls, menu configs, call packages, live streams
-- Created: 2025-11-19
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PRIVATE CALLS SYSTEM
-- =====================================================

-- Private calls table
CREATE TABLE IF NOT EXISTS private_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id VARCHAR(255) NOT NULL,
  caller_username VARCHAR(255),
  receiver_id VARCHAR(255) NOT NULL,
  receiver_username VARCHAR(255),
  user_name VARCHAR(255), -- Legacy field
  payment_id VARCHAR(255),
  scheduled_date DATE,
  scheduled_time TIME,
  scheduled_at TIMESTAMP,
  duration INTEGER DEFAULT 0, -- Duration in minutes
  performer VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  call_type VARCHAR(50),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  caller_rating INTEGER CHECK (caller_rating >= 1 AND caller_rating <= 5),
  receiver_rating INTEGER CHECK (receiver_rating >= 1 AND receiver_rating <= 5),
  caller_feedback TEXT,
  receiver_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Call availability table (admin availability status)
CREATE TABLE IF NOT EXISTS call_availability (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  available BOOLEAN DEFAULT false,
  message TEXT,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for private_calls
CREATE INDEX IF NOT EXISTS idx_private_calls_status ON private_calls(status);
CREATE INDEX IF NOT EXISTS idx_private_calls_scheduled_at ON private_calls(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_private_calls_caller_id ON private_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_private_calls_receiver_id ON private_calls(receiver_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_private_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_private_calls_updated_at
BEFORE UPDATE ON private_calls
FOR EACH ROW
EXECUTE FUNCTION update_private_calls_updated_at();

CREATE TRIGGER trigger_call_availability_updated_at
BEFORE UPDATE ON call_availability
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. MENU CONFIGURATION SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS menu_configs (
  id VARCHAR(255) PRIMARY KEY,
  menu_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  name_es VARCHAR(255),
  parent_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'disabled', 'tier_restricted'
  allowed_tiers TEXT[], -- PostgreSQL array for tier restrictions
  order_position INTEGER DEFAULT 0,
  icon VARCHAR(50),
  action VARCHAR(255),
  type VARCHAR(50) DEFAULT 'default', -- 'default', 'custom'
  action_type VARCHAR(50), -- 'submenu', 'action', 'link'
  action_data JSONB, -- Flexible action data
  customizable BOOLEAN DEFAULT true,
  deletable BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_id) REFERENCES menu_configs(id) ON DELETE SET NULL
);

-- Indexes for menu_configs
CREATE INDEX IF NOT EXISTS idx_menu_configs_status ON menu_configs(status);
CREATE INDEX IF NOT EXISTS idx_menu_configs_order ON menu_configs(order_position);
CREATE INDEX IF NOT EXISTS idx_menu_configs_parent_id ON menu_configs(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_configs_type ON menu_configs(type);

-- Trigger for updated_at
CREATE TRIGGER trigger_menu_configs_updated_at
BEFORE UPDATE ON menu_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. CALL PACKAGES SYSTEM
-- =====================================================

-- Call packages (pricing plans)
CREATE TABLE IF NOT EXISTS call_packages (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  calls INTEGER NOT NULL,
  price INTEGER NOT NULL, -- Price in cents
  price_per_call INTEGER,
  savings INTEGER,
  savings_percent INTEGER,
  popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User purchased packages
CREATE TABLE IF NOT EXISTS user_call_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  package_id VARCHAR(255) NOT NULL,
  package_name VARCHAR(255),
  total_calls INTEGER NOT NULL,
  remaining_calls INTEGER NOT NULL,
  used_calls INTEGER DEFAULT 0,
  price INTEGER,
  payment_id VARCHAR(255),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  last_used_call_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES call_packages(id),
  FOREIGN KEY (last_used_call_id) REFERENCES private_calls(id) ON DELETE SET NULL
);

-- Indexes for call packages
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON user_call_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_active ON user_call_packages(active);
CREATE INDEX IF NOT EXISTS idx_user_packages_remaining ON user_call_packages(remaining_calls);
CREATE INDEX IF NOT EXISTS idx_user_packages_expires ON user_call_packages(expires_at);

-- Triggers for updated_at
CREATE TRIGGER trigger_call_packages_updated_at
BEFORE UPDATE ON call_packages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_call_packages_updated_at
BEFORE UPDATE ON user_call_packages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. LIVE STREAMING SYSTEM
-- =====================================================

-- Main live streams table
CREATE TABLE IF NOT EXISTS live_streams (
  id VARCHAR(255) PRIMARY KEY,
  channel_name VARCHAR(255) UNIQUE NOT NULL,
  host_id VARCHAR(255) NOT NULL,
  host_name VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_paid BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  max_viewers INTEGER DEFAULT 1000,
  scheduled_for TIMESTAMP,
  category VARCHAR(100), -- 'music', 'gaming', 'talk_show', 'education', 'entertainment', 'sports', 'news', 'other'
  tags TEXT[], -- PostgreSQL array
  thumbnail_url TEXT,
  allow_comments BOOLEAN DEFAULT true,
  record_stream BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'en',
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'active', 'ended'
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER, -- Duration in minutes
  current_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  viewers JSONB, -- Array of current viewer objects
  banned_users TEXT[], -- Array of banned user IDs
  moderators TEXT[], -- Array of moderator user IDs
  tokens JSONB, -- Agora tokens object
  recording_url TEXT,
  analytics JSONB, -- Analytics data
  chat_settings JSONB, -- Chat settings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stream viewers tracking
CREATE TABLE IF NOT EXISTS stream_viewers (
  id SERIAL PRIMARY KEY,
  stream_id VARCHAR(255) NOT NULL,
  viewer_id VARCHAR(255),
  viewer_name VARCHAR(255),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,

  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
);

-- Stream comments/chat
CREATE TABLE IF NOT EXISTS stream_comments (
  id VARCHAR(255) PRIMARY KEY,
  stream_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  likes INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  deleted_by VARCHAR(255),

  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Stream notifications/subscriptions
CREATE TABLE IF NOT EXISTS stream_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  streamer_id VARCHAR(255) NOT NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notifications_enabled BOOLEAN DEFAULT true,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (streamer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, streamer_id)
);

-- Stream banned users
CREATE TABLE IF NOT EXISTS stream_banned_users (
  id SERIAL PRIMARY KEY,
  stream_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  banned_by VARCHAR(255) NOT NULL,
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,

  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for live_streams
CREATE INDEX IF NOT EXISTS idx_live_streams_host_id ON live_streams(host_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_category ON live_streams(category);
CREATE INDEX IF NOT EXISTS idx_live_streams_started_at ON live_streams(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled_for ON live_streams(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_live_streams_viewers ON live_streams(current_viewers DESC);

-- Indexes for stream_viewers
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_viewer_id ON stream_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_left_at ON stream_viewers(left_at);

-- Indexes for stream_comments
CREATE INDEX IF NOT EXISTS idx_stream_comments_stream_id ON stream_comments(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_comments_user_id ON stream_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_comments_timestamp ON stream_comments(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_stream_comments_deleted ON stream_comments(is_deleted);

-- Indexes for stream_notifications
CREATE INDEX IF NOT EXISTS idx_stream_notifications_user_id ON stream_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_notifications_streamer_id ON stream_notifications(streamer_id);

-- Indexes for stream_banned_users
CREATE INDEX IF NOT EXISTS idx_stream_banned_users_stream_id ON stream_banned_users(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_banned_users_user_id ON stream_banned_users(user_id);

-- Triggers for updated_at
CREATE TRIGGER trigger_live_streams_updated_at
BEFORE UPDATE ON live_streams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

-- Insert default call packages (if not exists)
INSERT INTO call_packages (id, name, calls, price, price_per_call, savings, savings_percent, popular)
VALUES
  ('single-call', 'Single Call', 1, 25, 25, 0, 0, false),
  ('3-call-pack', '3 Call Package', 3, 60, 20, 15, 20, false),
  ('5-call-pack', '5 Call Package', 5, 90, 18, 35, 28, true),
  ('10-call-pack', '10 Call Package', 10, 150, 15, 100, 40, false)
ON CONFLICT (id) DO NOTHING;

-- Insert default menu configs (if not exists)
INSERT INTO menu_configs (id, name, name_es, status, order_position, icon, action, type, deletable)
VALUES
  ('subscribe', 'Subscribe', 'Suscribirse', 'active', 1, '💎', 'subscribe', 'default', false),
  ('profile', 'My Profile', 'Mi Perfil', 'active', 2, '👤', 'profile', 'default', false),
  ('nearby', 'Nearby Members', 'Miembros Cercanos', 'tier_restricted', 3, '📍', 'nearby', 'default', false),
  ('live', 'Live Streams', 'En Vivo', 'active', 4, '📺', 'live', 'default', false),
  ('radio', 'Radio', 'Radio', 'active', 5, '📻', 'radio', 'default', false),
  ('zoom', 'Video Calls', 'Videollamadas', 'tier_restricted', 6, '📞', 'zoom', 'default', false),
  ('support', 'Support', 'Soporte', 'active', 7, '💬', 'support', 'default', false),
  ('settings', 'Settings', 'Configuración', 'active', 8, '⚙️', 'settings', 'default', false)
ON CONFLICT (id) DO NOTHING;

-- Set allowed tiers for restricted menus
UPDATE menu_configs SET allowed_tiers = ARRAY['Premium', 'Crystal', 'Diamond', 'PNP'] WHERE id IN ('nearby', 'zoom');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: 11
-- - private_calls
-- - call_availability
-- - menu_configs
-- - call_packages
-- - user_call_packages
-- - live_streams
-- - stream_viewers
-- - stream_comments
-- - stream_notifications
-- - stream_banned_users
-- =====================================================
