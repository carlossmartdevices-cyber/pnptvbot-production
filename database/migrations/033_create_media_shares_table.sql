-- Migration: Create media_shares table for tracking media popularity
-- This table tracks which users share the most pictures and which media gets the most likes

CREATE TABLE IF NOT EXISTS media_shares (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video', 'document')),
    media_id VARCHAR(255) NOT NULL UNIQUE,
    message_id VARCHAR(255),
    share_count INTEGER DEFAULT 1,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_like_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_shares_user_id ON media_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_media_shares_media_type ON media_shares(media_type);
CREATE INDEX IF NOT EXISTS idx_media_shares_created_at ON media_shares(created_at);
CREATE INDEX IF NOT EXISTS idx_media_shares_like_count ON media_shares(like_count);
CREATE INDEX IF NOT EXISTS idx_media_shares_share_count ON media_shares(share_count);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update timestamps
CREATE TRIGGER trigger_update_media_shares_updated_at
BEFORE UPDATE ON media_shares
FOR EACH ROW
EXECUTE FUNCTION update_media_shares_updated_at();

-- Add comments for documentation
COMMENT ON TABLE media_shares IS 'Tracks media shares and likes for gamification and rewards';
COMMENT ON COLUMN media_shares.user_id IS 'Telegram user ID who shared the media';
COMMENT ON COLUMN media_shares.media_type IS 'Type of media: photo, video, or document';
COMMENT ON COLUMN media_shares.media_id IS 'Telegram file ID of the media';
COMMENT ON COLUMN media_shares.message_id IS 'Telegram message ID containing the media';
COMMENT ON COLUMN media_shares.share_count IS 'Number of times this media has been shared';
COMMENT ON COLUMN media_shares.like_count IS 'Number of likes/reactions this media has received';
COMMENT ON COLUMN media_shares.created_at IS 'When the media was first shared';
COMMENT ON COLUMN media_shares.updated_at IS 'When the media record was last updated';
COMMENT ON COLUMN media_shares.last_like_at IS 'When the media last received a like';
