-- =====================================================
-- MEDIA LIBRARY SCHEMA MIGRATION
-- Tables for: media library, playlists, player states
-- Migrated from: Firestore to PostgreSQL
-- Created: 2025-11-22
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. MEDIA LIBRARY SYSTEM
-- =====================================================

-- Main media items table (audio/video)
CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  url TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'audio', -- 'audio' or 'video'
  duration INTEGER DEFAULT 0, -- Duration in seconds
  category VARCHAR(100) DEFAULT 'general', -- 'music', 'podcast', 'video', 'documentary', 'comedy', etc.
  cover_url TEXT,
  description TEXT,
  plays INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  uploader_id VARCHAR(255),
  uploader_name VARCHAR(255),
  language VARCHAR(10) DEFAULT 'es',
  is_public BOOLEAN DEFAULT true,
  is_explicit BOOLEAN DEFAULT false,
  tags TEXT[], -- PostgreSQL array for searchability
  metadata JSONB, -- Flexible storage for additional metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Media playlists
CREATE TABLE IF NOT EXISTS media_playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT false,
  is_collaborative BOOLEAN DEFAULT false,
  total_plays INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(owner_id, name)
);

-- Playlist items (media in playlists)
CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL,
  media_id UUID NOT NULL,
  position INTEGER NOT NULL,
  added_by VARCHAR(255),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (playlist_id) REFERENCES media_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, media_id)
);

-- Player states (user playback history/state)
CREATE TABLE IF NOT EXISTS player_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  media_id UUID,
  playlist_id UUID,
  current_position INTEGER DEFAULT 0, -- Current playback position in seconds
  is_playing BOOLEAN DEFAULT false,
  last_played_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE SET NULL,
  FOREIGN KEY (playlist_id) REFERENCES media_playlists(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

-- Media favorites
CREATE TABLE IF NOT EXISTS media_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  media_id UUID NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
  UNIQUE(user_id, media_id)
);

-- Media ratings/reviews
CREATE TABLE IF NOT EXISTS media_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  media_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE,
  UNIQUE(user_id, media_id)
);

-- Media play history
CREATE TABLE IF NOT EXISTS media_play_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  media_id UUID NOT NULL,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_played INTEGER, -- How many seconds were played
  completed BOOLEAN DEFAULT false,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for media_library
CREATE INDEX IF NOT EXISTS idx_media_library_category ON media_library(category);
CREATE INDEX IF NOT EXISTS idx_media_library_type ON media_library(type);
CREATE INDEX IF NOT EXISTS idx_media_library_is_public ON media_library(is_public);
CREATE INDEX IF NOT EXISTS idx_media_library_uploader_id ON media_library(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON media_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_plays ON media_library(plays DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_likes ON media_library(likes DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_title ON media_library(title);
CREATE INDEX IF NOT EXISTS idx_media_library_tags ON media_library USING GIN(tags);

-- Indexes for media_playlists
CREATE INDEX IF NOT EXISTS idx_media_playlists_owner_id ON media_playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_media_playlists_is_public ON media_playlists(is_public);
CREATE INDEX IF NOT EXISTS idx_media_playlists_created_at ON media_playlists(created_at DESC);

-- Indexes for playlist_items
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_media_id ON playlist_items(media_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_position ON playlist_items(playlist_id, position);

-- Indexes for player_states
CREATE INDEX IF NOT EXISTS idx_player_states_user_id ON player_states(user_id);
CREATE INDEX IF NOT EXISTS idx_player_states_media_id ON player_states(media_id);
CREATE INDEX IF NOT EXISTS idx_player_states_playlist_id ON player_states(playlist_id);

-- Indexes for media_favorites
CREATE INDEX IF NOT EXISTS idx_media_favorites_user_id ON media_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_media_favorites_media_id ON media_favorites(media_id);

-- Indexes for media_ratings
CREATE INDEX IF NOT EXISTS idx_media_ratings_user_id ON media_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_media_ratings_media_id ON media_ratings(media_id);
CREATE INDEX IF NOT EXISTS idx_media_ratings_rating ON media_ratings(rating);

-- Indexes for media_play_history
CREATE INDEX IF NOT EXISTS idx_media_play_history_user_id ON media_play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_media_play_history_media_id ON media_play_history(media_id);
CREATE INDEX IF NOT EXISTS idx_media_play_history_played_at ON media_play_history(played_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_media_library_updated_at ON media_library;
CREATE TRIGGER trigger_media_library_updated_at
BEFORE UPDATE ON media_library
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_media_playlists_updated_at ON media_playlists;
CREATE TRIGGER trigger_media_playlists_updated_at
BEFORE UPDATE ON media_playlists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_player_states_updated_at ON player_states;
CREATE TRIGGER trigger_player_states_updated_at
BEFORE UPDATE ON player_states
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_media_ratings_updated_at ON media_ratings;
CREATE TRIGGER trigger_media_ratings_updated_at
BEFORE UPDATE ON media_ratings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

-- Insert sample media items (if needed)
-- Uncomment and modify as needed

/*
INSERT INTO media_library (title, artist, url, type, duration, category, description, is_public)
VALUES
  ('Estrellas del Futuro', 'PNPtv Radio', 'https://pnptv.app/media/sample-1.mp3', 'audio', 180, 'music', 'Compilation of emerging talent', true),
  ('Charla Interactiva', 'PNPtv Team', 'https://pnptv.app/media/sample-2.mp3', 'audio', 900, 'talk', 'Interactive discussion about current events', true),
  ('Mini Documental', 'PNPtv Docs', 'https://pnptv.app/media/sample-3.mp4', 'video', 600, 'documentary', 'Short documentary series', true)
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: 7
-- - media_library (main media items)
-- - media_playlists (user playlists)
-- - playlist_items (media in playlists)
-- - player_states (user playback state)
-- - media_favorites (user favorites)
-- - media_ratings (ratings and reviews)
-- - media_play_history (playback history)
--
-- All tables have proper indexes and foreign keys
-- Ready for production use
-- =====================================================
