-- ==========================================
-- PNPTV HANGOUTS! DATABASE SCHEMA
-- ==========================================
-- Video calls, main rooms, and webinars

-- Video calls table (10-person calls)
CREATE TABLE IF NOT EXISTS video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  channel_name TEXT UNIQUE NOT NULL,
  title TEXT,
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  current_participants INTEGER DEFAULT 0,

  -- Settings
  enforce_camera BOOLEAN DEFAULT true,
  allow_guests BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Recording
  recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Call participants tracking
CREATE TABLE IF NOT EXISTS call_participants (
  id SERIAL PRIMARY KEY,
  call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  is_guest BOOLEAN DEFAULT false,
  is_host BOOLEAN DEFAULT false,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  total_duration_seconds INTEGER,

  -- Actions
  was_kicked BOOLEAN DEFAULT false,
  was_muted BOOLEAN DEFAULT false,

  UNIQUE(call_id, user_id, joined_at)
);

-- Main rooms (3 permanent rooms, 50 people each)
CREATE TABLE IF NOT EXISTS main_rooms (
  id INTEGER PRIMARY KEY CHECK (id IN (1, 2, 3)),
  name TEXT NOT NULL,
  description TEXT,
  channel_name TEXT UNIQUE NOT NULL,
  bot_user_id TEXT NOT NULL,

  -- Capacity
  max_participants INTEGER DEFAULT 50,
  current_participants INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Settings
  enforce_camera BOOLEAN DEFAULT true,
  auto_approve_publisher BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Main room participants (real-time tracking)
CREATE TABLE IF NOT EXISTS room_participants (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES main_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,

  -- Role
  is_publisher BOOLEAN DEFAULT false, -- Can broadcast video
  is_moderator BOOLEAN DEFAULT false,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  total_duration_seconds INTEGER,

  UNIQUE(room_id, user_id, joined_at)
);

-- Room events (mutes, kicks, spotlights, etc.)
CREATE TABLE IF NOT EXISTS room_events (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES main_rooms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- MUTE, UNMUTE, KICK, SPOTLIGHT, PUBLISH_GRANTED, etc.
  initiator_user_id TEXT, -- Who performed the action
  target_user_id TEXT, -- Who was affected
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webinars (monthly large events - 200 attendees)
CREATE TABLE IF NOT EXISTS webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 180,

  -- Channel
  channel_name TEXT UNIQUE NOT NULL,
  host_id TEXT NOT NULL, -- Admin/owner

  -- Capacity
  max_attendees INTEGER DEFAULT 200,
  current_attendees INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),

  -- Settings
  enforce_camera BOOLEAN DEFAULT true,
  allow_questions BOOLEAN DEFAULT true,
  enable_chat BOOLEAN DEFAULT true,

  -- Recording
  recording_enabled BOOLEAN DEFAULT true,
  recording_url TEXT,

  -- Timestamps
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webinar registrations
CREATE TABLE IF NOT EXISTS webinar_registrations (
  id SERIAL PRIMARY KEY,
  webinar_id UUID REFERENCES webinars(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,

  -- Status
  registered_at TIMESTAMP DEFAULT NOW(),
  attended BOOLEAN DEFAULT false,
  joined_at TIMESTAMP,
  left_at TIMESTAMP,

  -- Notifications
  reminder_sent_1d BOOLEAN DEFAULT false,
  reminder_sent_1h BOOLEAN DEFAULT false,
  reminder_sent_10m BOOLEAN DEFAULT false,

  UNIQUE(webinar_id, user_id)
);

-- ==========================================
-- PNPTV RADIO! DATABASE SCHEMA
-- ==========================================
-- 24/7 audio streaming with playlists

-- Radio tracks (music, podcasts, talk shows)
CREATE TABLE IF NOT EXISTS radio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,

  -- File
  audio_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds INTEGER NOT NULL,

  -- Type
  type TEXT CHECK (type IN ('music', 'podcast', 'talkshow', 'ad')) DEFAULT 'music',
  genre TEXT,
  language TEXT DEFAULT 'en',

  -- Ordering
  play_order INTEGER,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  thumbnail_url TEXT,
  description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Stats
  play_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,

  -- Upload info
  uploaded_by TEXT,
  upload_source TEXT, -- 'manual', 'youtube', 'soundcloud', etc.

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Radio subscribers (for notifications)
CREATE TABLE IF NOT EXISTS radio_subscribers (
  user_id TEXT PRIMARY KEY,

  -- Preferences
  notify_now_playing BOOLEAN DEFAULT false,
  notify_track_types TEXT[] DEFAULT ARRAY['music', 'podcast', 'talkshow'],
  notify_new_uploads BOOLEAN DEFAULT false,

  -- Timestamps
  subscribed_at TIMESTAMP DEFAULT NOW(),
  last_notified_at TIMESTAMP
);

-- Radio listening history
CREATE TABLE IF NOT EXISTS radio_listen_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  track_id UUID REFERENCES radio_tracks(id) ON DELETE CASCADE,

  -- Session info
  session_id UUID,
  listened_at TIMESTAMP DEFAULT NOW(),
  duration_seconds INTEGER, -- How long they actually listened
  completed BOOLEAN DEFAULT false, -- Listened to end?

  -- Device info
  device_type TEXT, -- 'web', 'mobile', 'telegram'
  ip_address TEXT
);

-- Radio now playing (singleton table - only one row)
CREATE TABLE IF NOT EXISTS radio_now_playing (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row
  track_id UUID REFERENCES radio_tracks(id),
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  listener_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Radio playlists (for organizing tracks)
CREATE TABLE IF NOT EXISTS radio_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Type
  playlist_type TEXT CHECK (playlist_type IN ('auto', 'manual', 'schedule')) DEFAULT 'manual',

  -- Scheduling (for time-based playlists)
  schedule_days INTEGER[], -- 0-6 (Sunday-Saturday)
  schedule_start_time TIME,
  schedule_end_time TIME,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Playlist tracks (many-to-many)
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id SERIAL PRIMARY KEY,
  playlist_id UUID REFERENCES radio_playlists(id) ON DELETE CASCADE,
  track_id UUID REFERENCES radio_tracks(id) ON DELETE CASCADE,
  track_order INTEGER NOT NULL,

  UNIQUE(playlist_id, track_id)
);

-- ==========================================
-- AGORA CHANNELS REGISTRY
-- ==========================================
-- Track all active Agora channels

CREATE TABLE IF NOT EXISTS agora_channels (
  channel_name TEXT PRIMARY KEY,
  channel_type TEXT NOT NULL, -- 'call', 'room', 'webinar', 'radio'
  feature_name TEXT NOT NULL, -- 'hangouts', 'radio', 'live'

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by TEXT,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW(),

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Video calls indexes
CREATE INDEX IF NOT EXISTS idx_video_calls_creator ON video_calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_active ON video_calls(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON call_participants(user_id);

-- Main rooms indexes
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_events_room_id ON room_events(room_id, created_at DESC);

-- Webinars indexes
CREATE INDEX IF NOT EXISTS idx_webinars_status ON webinars(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar_id ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_user_id ON webinar_registrations(user_id);

-- Radio indexes
CREATE INDEX IF NOT EXISTS idx_radio_tracks_active ON radio_tracks(is_active, play_order);
CREATE INDEX IF NOT EXISTS idx_radio_tracks_type ON radio_tracks(type, is_active);
CREATE INDEX IF NOT EXISTS idx_radio_listen_history_user ON radio_listen_history(user_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_listen_history_track ON radio_listen_history(track_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, track_order);

-- Agora channels indexes
CREATE INDEX IF NOT EXISTS idx_agora_channels_active ON agora_channels(is_active, feature_name);
CREATE INDEX IF NOT EXISTS idx_agora_channels_type ON agora_channels(channel_type, is_active);

-- ==========================================
-- INITIAL DATA - MAIN ROOMS
-- ==========================================

-- Create 3 main rooms
INSERT INTO main_rooms (id, name, description, channel_name, bot_user_id, max_participants, is_active)
VALUES
  (1, 'PNPtv Hangout Room 1', 'Main community hangout room - join anytime!', 'pnptv_main_room_1', 'bot_room_1', 50, true),
  (2, 'PNPtv Hangout Room 2', 'Secondary community room - always open!', 'pnptv_main_room_2', 'bot_room_2', 50, true),
  (3, 'PNPtv Hangout Room 3', 'Third community room - come hang out!', 'pnptv_main_room_3', 'bot_room_3', 50, true)
ON CONFLICT (id) DO NOTHING;

-- Register main room channels
INSERT INTO agora_channels (channel_name, channel_type, feature_name, max_participants, is_active)
VALUES
  ('pnptv_main_room_1', 'room', 'hangouts', 50, true),
  ('pnptv_main_room_2', 'room', 'hangouts', 50, true),
  ('pnptv_main_room_3', 'room', 'hangouts', 50, true)
ON CONFLICT (channel_name) DO NOTHING;

-- Register radio channel
INSERT INTO agora_channels (channel_name, channel_type, feature_name, is_active)
VALUES
  ('pnptv_radio_247', 'radio', 'radio', true)
ON CONFLICT (channel_name) DO NOTHING;

-- Initialize radio now playing
INSERT INTO radio_now_playing (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update room participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE main_rooms
    SET current_participants = current_participants + 1,
        updated_at = NOW()
    WHERE id = NEW.room_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    UPDATE main_rooms
    SET current_participants = GREATEST(0, current_participants - 1),
        updated_at = NOW()
    WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for room participant count
DROP TRIGGER IF EXISTS room_participant_count_trigger ON room_participants;
CREATE TRIGGER room_participant_count_trigger
AFTER INSERT OR UPDATE ON room_participants
FOR EACH ROW
EXECUTE FUNCTION update_room_participant_count();

-- Function to update call participant count
CREATE OR REPLACE FUNCTION update_call_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE video_calls
    SET current_participants = current_participants + 1
    WHERE id = NEW.call_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    UPDATE video_calls
    SET current_participants = GREATEST(0, current_participants - 1)
    WHERE id = NEW.call_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for call participant count
DROP TRIGGER IF EXISTS call_participant_count_trigger ON call_participants;
CREATE TRIGGER call_participant_count_trigger
AFTER INSERT OR UPDATE ON call_participants
FOR EACH ROW
EXECUTE FUNCTION update_call_participant_count();

-- Function to increment track play count
CREATE OR REPLACE FUNCTION increment_track_play_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE radio_tracks
  SET play_count = play_count + 1,
      updated_at = NOW()
  WHERE id = NEW.track_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for track play count
DROP TRIGGER IF EXISTS track_play_count_trigger ON radio_now_playing;
CREATE TRIGGER track_play_count_trigger
AFTER UPDATE OF track_id ON radio_now_playing
FOR EACH ROW
WHEN (NEW.track_id IS DISTINCT FROM OLD.track_id)
EXECUTE FUNCTION increment_track_play_count();
