-- Migration to fix radio_now_playing table schema
-- Creates a new table with correct schema

-- Create a new table with the correct schema
CREATE TABLE IF NOT EXISTS radio_now_playing_fixed (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row
  track_id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  duration VARCHAR(50),
  cover_url TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  listener_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default row if table is empty
INSERT INTO radio_now_playing_fixed (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Create indexes for the new table
CREATE INDEX IF NOT EXISTS idx_radio_now_playing_fixed_started_at ON radio_now_playing_fixed(started_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_radio_now_playing_fixed_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for radio_now_playing_fixed updated_at
DROP TRIGGER IF EXISTS update_radio_now_playing_fixed_updated_at ON radio_now_playing_fixed;
CREATE TRIGGER update_radio_now_playing_fixed_updated_at
BEFORE UPDATE ON radio_now_playing_fixed
FOR EACH ROW
EXECUTE FUNCTION update_radio_now_playing_fixed_updated_at();