-- ==========================================
-- RADIO QUEUE TABLE MIGRATION
-- ==========================================
-- Creates radio_queue table for managing upcoming tracks

-- Radio queue (upcoming tracks to play)
CREATE TABLE IF NOT EXISTS radio_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID REFERENCES media_library(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  duration INTEGER, -- in seconds
  cover_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,

  added_by VARCHAR(100),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for queue ordering
CREATE INDEX IF NOT EXISTS idx_radio_queue_position ON radio_queue(position ASC);

-- Index for media lookup
CREATE INDEX IF NOT EXISTS idx_radio_queue_media_id ON radio_queue(media_id);
