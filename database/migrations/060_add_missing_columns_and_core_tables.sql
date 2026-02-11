-- Fix runtime schema drift for production stability.
-- This migration is idempotent and safe to run multiple times.

-- =====================================================
-- 1) BROADCAST RETRY COMPATIBILITY
-- =====================================================
ALTER TABLE IF EXISTS broadcast_recipients
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS broadcast_recipients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE broadcast_recipients
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recipients_retry_count ON broadcast_recipients(retry_count);
CREATE INDEX IF NOT EXISTS idx_recipients_status_retry ON broadcast_recipients(status, retry_count);

-- =====================================================
-- 2) PAYMENTS COMPATIBILITY
-- =====================================================
ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- =====================================================
-- 3) USERS PROFILE COMPATIBILITY (legacy + social fields)
-- =====================================================
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS instagram VARCHAR(100),
  ADD COLUMN IF NOT EXISTS twitter VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facebook VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tiktok VARCHAR(100),
  ADD COLUMN IF NOT EXISTS youtube VARCHAR(200),
  ADD COLUMN IF NOT EXISTS telegram VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tribe VARCHAR(100);

-- =====================================================
-- 4) CREATE HISTORICALLY REFERENCED TABLES IF MISSING
--    (prevents relation-does-not-exist regressions)
-- =====================================================
CREATE TABLE IF NOT EXISTS wall_of_fame_posts (
  id SERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key DATE NOT NULL,
  reactions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, message_id)
);

CREATE TABLE IF NOT EXISTS wall_of_fame_daily_stats (
  date_key DATE NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photos_shared INTEGER DEFAULT 0,
  reactions_received INTEGER DEFAULT 0,
  is_new_member BOOLEAN DEFAULT FALSE,
  first_post_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date_key, user_id)
);

CREATE TABLE IF NOT EXISTS wall_of_fame_daily_winners (
  date_key DATE PRIMARY KEY,
  legend_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  new_member_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  active_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wall_of_fame_posts_group ON wall_of_fame_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_wall_of_fame_posts_date ON wall_of_fame_posts(date_key);
CREATE INDEX IF NOT EXISTS idx_wall_of_fame_stats_reactions ON wall_of_fame_daily_stats(reactions_received);

CREATE TABLE IF NOT EXISTS cult_event_registrations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  month_key VARCHAR(7) NOT NULL,
  event_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'registered',
  claimed_at TIMESTAMP,
  reminder_7d_sent BOOLEAN DEFAULT FALSE,
  reminder_3d_sent BOOLEAN DEFAULT FALSE,
  reminder_day_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_type, month_key)
);

CREATE INDEX IF NOT EXISTS idx_cult_event_registrations_event
  ON cult_event_registrations(event_type, event_at);
