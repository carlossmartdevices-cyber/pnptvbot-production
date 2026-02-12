-- Fix Agora Channels Schema
-- Add missing columns to agora_channels table
-- Date: 2026-02-12
-- Note: channel_name is already PRIMARY KEY, so id is added as regular UUID column

-- Add id column as UUID if not exists (not as PRIMARY KEY since channel_name is PK)
ALTER TABLE agora_channels
ADD COLUMN IF NOT EXISTS id UUID UNIQUE DEFAULT gen_random_uuid();

-- Add deactivated_at column if not exists
ALTER TABLE agora_channels
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;

-- Create index on id if not exists
CREATE INDEX IF NOT EXISTS idx_agora_channels_id ON agora_channels(id);

-- Create index on deactivated_at if not exists
CREATE INDEX IF NOT EXISTS idx_agora_channels_deactivated_at ON agora_channels(deactivated_at);
