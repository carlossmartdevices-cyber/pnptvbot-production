-- Migration 058: Add email/password auth and PNPtv ID to users table
-- Allows users to register/login without Telegram

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pnptv_id VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pnptv_id ON users(pnptv_id) WHERE pnptv_id IS NOT NULL;
