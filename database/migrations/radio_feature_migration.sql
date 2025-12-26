-- ==========================================
-- RADIO FEATURE MIGRATION TO POSTGRESQL
-- ==========================================
-- Migrates radio_now_playing, radio_requests, radio_history, radio_schedule
-- from Firestore to PostgreSQL

-- Radio now playing (current song - singleton table)
CREATE TABLE IF NOT EXISTS radio_now_playing (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title TEXT NOT NULL,
  artist TEXT,
  duration TEXT,
  cover_url TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Radio requests (song requests from users)
CREATE TABLE IF NOT EXISTS radio_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_name TEXT NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'played')),

  artist TEXT,
  duration TEXT,

  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  played_at TIMESTAMP WITH TIME ZONE,

  metadata JSONB DEFAULT '{}'::jsonb
);

-- Radio history (historical played songs)
CREATE TABLE IF NOT EXISTS radio_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  duration TEXT,
  cover_url TEXT,

  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

-- Radio schedule (weekly programming schedule)
CREATE TABLE IF NOT EXISTS radio_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time_slot TEXT NOT NULL,
  program_name TEXT NOT NULL,
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(day_of_week, time_slot)
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Radio requests indexes
CREATE INDEX IF NOT EXISTS idx_radio_requests_user_id ON radio_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_radio_requests_status ON radio_requests(status, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_radio_requests_requested_at ON radio_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_requests_status_requested ON radio_requests(status, requested_at DESC);

-- Radio history indexes
CREATE INDEX IF NOT EXISTS idx_radio_history_played_at ON radio_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_history_title ON radio_history(title);
CREATE INDEX IF NOT EXISTS idx_radio_history_artist ON radio_history(artist);

-- Radio schedule indexes
CREATE INDEX IF NOT EXISTS idx_radio_schedule_day_time ON radio_schedule(day_of_week, time_slot);

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Initialize radio now playing singleton (empty state)
INSERT INTO radio_now_playing (id, title, artist, duration)
VALUES (1, 'PNPtv Radio', 'Starting Soon', '0:00')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_radio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS radio_requests_updated_at ON radio_requests;
CREATE TRIGGER radio_requests_updated_at
  BEFORE UPDATE ON radio_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_radio_updated_at();

DROP TRIGGER IF EXISTS radio_schedule_updated_at ON radio_schedule;
CREATE TRIGGER radio_schedule_updated_at
  BEFORE UPDATE ON radio_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_radio_updated_at();

DROP TRIGGER IF EXISTS radio_now_playing_updated_at ON radio_now_playing;
CREATE TRIGGER radio_now_playing_updated_at
  BEFORE UPDATE ON radio_now_playing
  FOR EACH ROW
  EXECUTE FUNCTION update_radio_updated_at();
