-- Photo system tables for admin gallery and user post photos
-- Created: 2026-02-19

-- Photos table for storing individual photo metadata
CREATE TABLE IF NOT EXISTS photos (
  id VARCHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  post_id VARCHAR(36) REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  original_filename VARCHAR(255),
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  caption TEXT,
  category VARCHAR(100) DEFAULT 'general',
  is_admin_photo BOOLEAN DEFAULT FALSE,
  order_position INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_post_id ON photos(post_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);
CREATE INDEX IF NOT EXISTS idx_photos_is_admin ON photos(is_admin_photo);
CREATE INDEX IF NOT EXISTS idx_photos_not_deleted ON photos(deleted_at) WHERE deleted_at IS NULL;

-- Update social_posts table to include photo fields
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS photos JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS has_gallery BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_photos ON social_posts USING gin(photos);

-- Photo categories enum
CREATE TABLE IF NOT EXISTS photo_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(100),
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO photo_categories (name, display_name, description, icon) VALUES
  ('gallery', 'Gallery', 'General gallery photos', '🖼️'),
  ('featured', 'Featured', 'Featured photos', '⭐'),
  ('events', 'Events', 'Event photos', '🎉'),
  ('promotions', 'Promotions', 'Promotional photos', '📢'),
  ('user_uploads', 'User Uploads', 'User uploaded photos', '📸')
ON CONFLICT (name) DO NOTHING;

-- Photo activity log for audit trail
CREATE TABLE IF NOT EXISTS photo_activity_log (
  id SERIAL PRIMARY KEY,
  photo_id VARCHAR(36) REFERENCES photos(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photo_activity_photo_id ON photo_activity_log(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_activity_user_id ON photo_activity_log(user_id);

-- User photo upload statistics
CREATE TABLE IF NOT EXISTS user_photo_stats (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_photos INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  photos_this_month INTEGER DEFAULT 0,
  last_upload_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_photo_stats_updated ON user_photo_stats(updated_at);

-- Photo storage quota configuration per role
CREATE TABLE IF NOT EXISTS photo_storage_limits (
  role VARCHAR(50) PRIMARY KEY,
  max_file_size_mb INTEGER NOT NULL,
  max_files_per_month INTEGER NOT NULL,
  max_total_storage_mb INTEGER NOT NULL,
  max_files_per_post INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default limits
INSERT INTO photo_storage_limits (role, max_file_size_mb, max_files_per_month, max_total_storage_mb, max_files_per_post) VALUES
  ('user', 10, 10, 500, 5),
  ('creator', 25, 50, 2000, 10),
  ('model', 50, 100, 5000, 10),
  ('admin', 50, 999, 99999, 999),
  ('superadmin', 50, 999, 99999, 999)
ON CONFLICT (role) DO NOTHING;

-- Update timestamp function for photos table
CREATE OR REPLACE FUNCTION update_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update photos.updated_at
DROP TRIGGER IF EXISTS trigger_update_photos_updated_at ON photos;
CREATE TRIGGER trigger_update_photos_updated_at
BEFORE UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_photos_updated_at();

-- Trigger to update social_posts photo_count when photos are added/removed
CREATE OR REPLACE FUNCTION update_post_photo_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts
    SET photo_count = (SELECT COUNT(*) FROM photos WHERE post_id = NEW.post_id AND deleted_at IS NULL),
        has_gallery = (SELECT COUNT(*) FROM photos WHERE post_id = NEW.post_id AND deleted_at IS NULL) > 0
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE social_posts
    SET photo_count = (SELECT COUNT(*) FROM photos WHERE post_id = NEW.post_id AND deleted_at IS NULL),
        has_gallery = (SELECT COUNT(*) FROM photos WHERE post_id = NEW.post_id AND deleted_at IS NULL) > 0
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts
    SET photo_count = (SELECT COUNT(*) FROM photos WHERE post_id = OLD.post_id AND deleted_at IS NULL),
        has_gallery = (SELECT COUNT(*) FROM photos WHERE post_id = OLD.post_id AND deleted_at IS NULL) > 0
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_post_photo_count ON photos;
CREATE TRIGGER trigger_update_post_photo_count
AFTER INSERT OR UPDATE OR DELETE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_post_photo_count();
