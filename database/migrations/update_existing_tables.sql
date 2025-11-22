-- =====================================================
-- UPDATE EXISTING TABLES FOR FIRESTORE MIGRATION
-- Fix mismatches between existing schema and Firestore models
-- =====================================================

-- ===== 1. FIX CALL PACKAGES =====
-- Rename existing call_packages to user_call_packages
ALTER TABLE IF EXISTS call_packages RENAME TO user_call_packages_temp;

-- Create call_packages catalog table
CREATE TABLE IF NOT EXISTS call_packages_catalog (
  id VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  calls INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  price_per_call_cents INTEGER,
  savings_cents INTEGER,
  savings_percent INTEGER,
  popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create proper user_call_packages table
CREATE TABLE IF NOT EXISTS user_call_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  package_id VARCHAR(255) NOT NULL,
  package_name VARCHAR(255),
  total_calls INTEGER NOT NULL,
  remaining_calls INTEGER NOT NULL,
  used_calls INTEGER DEFAULT 0,
  price_cents INTEGER,
  payment_id VARCHAR(255),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  last_used_call_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES call_packages_catalog(id),
  FOREIGN KEY (last_used_call_id) REFERENCES private_calls(id) ON DELETE SET NULL
);

-- Migrate data from temp table if exists
INSERT INTO user_call_packages (id, user_id, package_id, total_calls, remaining_calls, used_calls, purchased_at, expires_at, active)
SELECT
  id,
  user_id,
  package_type as package_id,
  total_minutes as total_calls,
  remaining_minutes as remaining_calls,
  used_minutes as used_calls,
  purchased_at,
  expires_at,
  active
FROM user_call_packages_temp
ON CONFLICT (id) DO NOTHING;

-- Drop temp table
DROP TABLE IF EXISTS user_call_packages_temp CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_call_packages_user_id ON user_call_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_call_packages_active ON user_call_packages(active);
CREATE INDEX IF NOT EXISTS idx_user_call_packages_remaining ON user_call_packages(remaining_calls);
CREATE INDEX IF NOT EXISTS idx_user_call_packages_expires ON user_call_packages(expires_at);

-- Add trigger
DROP TRIGGER IF EXISTS trigger_user_call_packages_updated_at ON user_call_packages;
CREATE TRIGGER trigger_user_call_packages_updated_at
BEFORE UPDATE ON user_call_packages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===== 2. UPDATE LIVE_STREAMS TABLE =====
-- Add missing columns to live_streams
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS channel_name VARCHAR(255);
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS host_name VARCHAR(255);
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS record_stream BOOLEAN DEFAULT false;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS current_viewers INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS total_views INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS peak_viewers INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS total_comments INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS viewers JSONB;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS banned_users TEXT[];
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS moderators TEXT[];
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS tokens JSONB;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS analytics JSONB;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS chat_settings JSONB;

-- Rename columns to match Firestore model
ALTER TABLE live_streams RENAME COLUMN viewers_count TO viewers_count_old;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS viewers_count INTEGER DEFAULT 0;

-- Update max_viewers default
ALTER TABLE live_streams ALTER COLUMN max_viewers SET DEFAULT 1000;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled_for ON live_streams(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_live_streams_current_viewers ON live_streams(current_viewers DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_channel_name ON live_streams(channel_name);

-- Create stream_viewers table
CREATE TABLE IF NOT EXISTS stream_viewers (
  id SERIAL PRIMARY KEY,
  stream_id UUID NOT NULL,
  viewer_id VARCHAR(255),
  viewer_name VARCHAR(255),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,

  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_viewer_id ON stream_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_left_at ON stream_viewers(left_at);

-- Create stream_comments table
CREATE TABLE IF NOT EXISTS stream_comments (
  id VARCHAR(255) PRIMARY KEY,
  stream_id UUID NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_stream_comments_stream_id ON stream_comments(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_comments_user_id ON stream_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_comments_timestamp ON stream_comments(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_stream_comments_deleted ON stream_comments(is_deleted);

-- Create stream_notifications table
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

CREATE INDEX IF NOT EXISTS idx_stream_notifications_user_id ON stream_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_notifications_streamer_id ON stream_notifications(streamer_id);

-- Create stream_banned_users table
CREATE TABLE IF NOT EXISTS stream_banned_users (
  id SERIAL PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  banned_by VARCHAR(255) NOT NULL,
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,

  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stream_banned_users_stream_id ON stream_banned_users(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_banned_users_user_id ON stream_banned_users(user_id);

-- ===== 3. SEED DEFAULT DATA =====

-- Insert default call packages catalog
INSERT INTO call_packages_catalog (id, display_name, calls, price_cents, price_per_call_cents, savings_cents, savings_percent, popular)
VALUES
  ('single-call', 'Single Call', 1, 2500, 2500, 0, 0, false),
  ('3-call-pack', '3 Call Package', 3, 6000, 2000, 1500, 20, false),
  ('5-call-pack', '5 Call Package', 5, 9000, 1800, 3500, 28, true),
  ('10-call-pack', '10 Call Package', 10, 15000, 1500, 10000, 40, false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
