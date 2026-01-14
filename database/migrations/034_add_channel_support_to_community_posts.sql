-- Migration: Add channel ID support to community posts
-- This migration adds support for targeting specific channels in community posts

BEGIN;

-- Add channel IDs array column to community_posts table
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS target_channel_ids VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[];

-- Create index for channel IDs
CREATE INDEX IF NOT EXISTS idx_community_posts_channel_ids ON community_posts USING GIN(target_channel_ids);

-- Add column to track if post should go to prime channel
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS post_to_prime_channel BOOLEAN DEFAULT false;

COMMIT;