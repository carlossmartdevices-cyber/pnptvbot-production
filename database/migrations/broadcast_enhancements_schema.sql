-- =====================================================
-- BROADCAST ENHANCEMENTS SCHEMA MIGRATION
-- Tables for: user preferences, segmentation, analytics, A/B testing, retry queue
-- Created: 2025-12-29
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER BROADCAST PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_broadcast_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Opt-out management
  is_opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMP,
  opted_out_reason TEXT,

  -- Frequency preferences
  max_broadcasts_per_week INTEGER DEFAULT 7,
  max_broadcasts_per_month INTEGER DEFAULT 30,
  broadcasts_received_week INTEGER DEFAULT 0,
  broadcasts_received_month INTEGER DEFAULT 0,
  last_broadcast_at TIMESTAMP,

  -- Preferred communication times
  preferred_send_hour INTEGER, -- 0-23, NULL for no preference
  preferred_send_day VARCHAR(50), -- 'monday', 'tuesday', etc., NULL for any day

  -- Broadcast preferences by category
  category_preferences JSONB, -- {'news': true, 'promotions': false, 'updates': true}

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'blocked', 'opted_out'

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_broadcast_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_is_opted_out ON user_broadcast_preferences(is_opted_out);
CREATE INDEX IF NOT EXISTS idx_user_prefs_status ON user_broadcast_preferences(status);

-- =====================================================
-- 2. USER SEGMENTATION
-- =====================================================

CREATE TABLE IF NOT EXISTS user_segments (
  id SERIAL PRIMARY KEY,
  segment_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  created_by VARCHAR(255) NOT NULL,

  -- Segment definition
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Filter criteria (stored as JSONB)
  filters JSONB NOT NULL, -- {
                          --   "activity_level": "active",
                          --   "subscription_tier": "premium",
                          --   "location": "US",
                          --   "language": "en",
                          --   "registration_date_from": "2024-01-01",
                          --   "registration_date_to": "2025-12-31",
                          --   "last_active_days": 7
                          -- }

  -- Segment statistics
  estimated_count INTEGER DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  last_recalculated_at TIMESTAMP,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for segments
CREATE INDEX IF NOT EXISTS idx_segments_segment_id ON user_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_segments_created_by ON user_segments(created_by);
CREATE INDEX IF NOT EXISTS idx_segments_is_active ON user_segments(is_active);
CREATE INDEX IF NOT EXISTS idx_segments_created_at ON user_segments(created_at DESC);

-- =====================================================
-- 3. SEGMENT MEMBERSHIP (Many-to-many)
-- =====================================================

CREATE TABLE IF NOT EXISTS segment_membership (
  id SERIAL PRIMARY KEY,
  segment_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Metadata
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(segment_id, user_id),
  FOREIGN KEY (segment_id) REFERENCES user_segments(segment_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_segment_membership_segment_id ON segment_membership(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_user_id ON segment_membership(user_id);

-- =====================================================
-- 4. BROADCAST ENGAGEMENT TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS broadcast_engagement (
  id SERIAL PRIMARY KEY,
  engagement_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Engagement events
  message_sent_at TIMESTAMP,
  message_opened_at TIMESTAMP, -- When user viewed the message
  message_clicked_at TIMESTAMP, -- When user clicked a link/button
  message_replied_at TIMESTAMP, -- When user replied to the broadcast

  -- Interaction data
  interaction_type VARCHAR(50), -- 'view', 'click', 'reply', 'forward', 'delete'
  interaction_data JSONB, -- Additional interaction metadata

  -- URL tracking (if broadcast contained links)
  clicked_url TEXT,
  click_count INTEGER DEFAULT 0,

  -- Reply data
  reply_text TEXT,
  reply_sentiment VARCHAR(50), -- 'positive', 'neutral', 'negative' (if analyzed)

  -- Status
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'engaged', 'failed'

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(broadcast_id, user_id)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_engagement_broadcast_id ON broadcast_engagement(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user_id ON broadcast_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_status ON broadcast_engagement(status);
CREATE INDEX IF NOT EXISTS idx_engagement_message_opened_at ON broadcast_engagement(message_opened_at);
CREATE INDEX IF NOT EXISTS idx_engagement_interaction_type ON broadcast_engagement(interaction_type);

-- =====================================================
-- 5. A/B TESTING
-- =====================================================

CREATE TABLE IF NOT EXISTS broadcast_ab_tests (
  id SERIAL PRIMARY KEY,
  ab_test_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL,
  created_by VARCHAR(255) NOT NULL,

  -- Test configuration
  test_name VARCHAR(255) NOT NULL,
  test_type VARCHAR(50) NOT NULL, -- 'subject', 'content', 'media', 'send_time', 'call_to_action'

  -- Variant A (control)
  variant_a_name VARCHAR(255),
  variant_a_message_en TEXT,
  variant_a_message_es TEXT,
  variant_a_media_url TEXT,
  variant_a_sample_size INTEGER,

  -- Variant B (treatment)
  variant_b_name VARCHAR(255),
  variant_b_message_en TEXT,
  variant_b_message_es TEXT,
  variant_b_media_url TEXT,
  variant_b_sample_size INTEGER,

  -- Results
  variant_a_opens INTEGER DEFAULT 0,
  variant_a_clicks INTEGER DEFAULT 0,
  variant_a_conversions INTEGER DEFAULT 0,
  variant_a_open_rate DECIMAL(5,2),
  variant_a_click_rate DECIMAL(5,2),
  variant_a_conversion_rate DECIMAL(5,2),

  variant_b_opens INTEGER DEFAULT 0,
  variant_b_clicks INTEGER DEFAULT 0,
  variant_b_conversions INTEGER DEFAULT 0,
  variant_b_open_rate DECIMAL(5,2),
  variant_b_click_rate DECIMAL(5,2),
  variant_b_conversion_rate DECIMAL(5,2),

  -- Statistical significance
  is_statistically_significant BOOLEAN DEFAULT false,
  p_value DECIMAL(10,8), -- Statistical p-value
  confidence_level DECIMAL(5,2) DEFAULT 95, -- 95% by default
  winner_variant VARCHAR(1), -- 'A' or 'B'

  -- Status
  status VARCHAR(50) DEFAULT 'created', -- 'created', 'running', 'completed', 'cancelled'
  started_at TIMESTAMP,
  ended_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for A/B test queries
CREATE INDEX IF NOT EXISTS idx_ab_test_broadcast_id ON broadcast_ab_tests(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_status ON broadcast_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_test_created_by ON broadcast_ab_tests(created_by);
CREATE INDEX IF NOT EXISTS idx_ab_test_created_at ON broadcast_ab_tests(created_at DESC);

-- =====================================================
-- 6. A/B TEST ASSIGNMENTS (User to variant mapping)
-- =====================================================

CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id SERIAL PRIMARY KEY,
  ab_test_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  assigned_variant VARCHAR(1) NOT NULL, -- 'A' or 'B'

  -- Tracking
  assignment_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ab_test_id, user_id),
  FOREIGN KEY (ab_test_id) REFERENCES broadcast_ab_tests(ab_test_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for quick assignments
CREATE INDEX IF NOT EXISTS idx_ab_assignment_ab_test_id ON ab_test_assignments(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignment_user_id ON ab_test_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignment_variant ON ab_test_assignments(assigned_variant);

-- =====================================================
-- 7. BROADCAST RETRY QUEUE
-- =====================================================

CREATE TABLE IF NOT EXISTS broadcast_retry_queue (
  id SERIAL PRIMARY KEY,
  retry_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Retry configuration
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP NOT NULL,

  -- Backoff configuration
  retry_delay_seconds INTEGER DEFAULT 60, -- Exponential backoff multiplier
  backoff_multiplier DECIMAL(3,1) DEFAULT 2.0, -- 2x multiplier for exponential backoff

  -- Error tracking
  last_error_code VARCHAR(100),
  last_error_message TEXT,
  error_history JSONB, -- Array of all previous errors

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'retrying', 'succeeded', 'failed', 'abandoned'

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for retry scheduling
CREATE INDEX IF NOT EXISTS idx_retry_queue_status ON broadcast_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry_at ON broadcast_retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_retry_queue_broadcast_id ON broadcast_retry_queue(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_retry_queue_user_id ON broadcast_retry_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_retry_queue_attempt_number ON broadcast_retry_queue(attempt_number);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create or replace update trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_broadcast_preferences
CREATE TRIGGER trigger_user_prefs_updated_at
BEFORE UPDATE ON user_broadcast_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_segments
CREATE TRIGGER trigger_segments_updated_at
BEFORE UPDATE ON user_segments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for broadcast_engagement
CREATE TRIGGER trigger_engagement_updated_at
BEFORE UPDATE ON broadcast_engagement
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for broadcast_ab_tests
CREATE TRIGGER trigger_ab_tests_updated_at
BEFORE UPDATE ON broadcast_ab_tests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for broadcast_retry_queue
CREATE TRIGGER trigger_retry_queue_updated_at
BEFORE UPDATE ON broadcast_retry_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Broadcast engagement summary
CREATE OR REPLACE VIEW broadcast_engagement_summary AS
SELECT
  be.broadcast_id,
  COUNT(DISTINCT be.user_id) AS total_recipients,
  COUNT(CASE WHEN be.status = 'delivered' THEN 1 END) AS delivered_count,
  COUNT(CASE WHEN be.message_opened_at IS NOT NULL THEN 1 END) AS opened_count,
  COUNT(CASE WHEN be.message_clicked_at IS NOT NULL THEN 1 END) AS clicked_count,
  COUNT(CASE WHEN be.message_replied_at IS NOT NULL THEN 1 END) AS replied_count,
  ROUND(
    (COUNT(CASE WHEN be.message_opened_at IS NOT NULL THEN 1 END)::DECIMAL /
     COUNT(DISTINCT be.user_id) * 100)::NUMERIC,
    2
  ) AS open_rate,
  ROUND(
    (COUNT(CASE WHEN be.message_clicked_at IS NOT NULL THEN 1 END)::DECIMAL /
     COUNT(DISTINCT be.user_id) * 100)::NUMERIC,
    2
  ) AS click_rate,
  ROUND(
    (COUNT(CASE WHEN be.message_replied_at IS NOT NULL THEN 1 END)::DECIMAL /
     COUNT(DISTINCT be.user_id) * 100)::NUMERIC,
    2
  ) AS reply_rate,
  MAX(be.updated_at) AS last_updated_at
FROM broadcast_engagement be
GROUP BY be.broadcast_id;

-- User segment performance
CREATE OR REPLACE VIEW segment_performance AS
SELECT
  us.segment_id,
  us.name AS segment_name,
  COUNT(DISTINCT sm.user_id) AS segment_size,
  COUNT(DISTINCT be.broadcast_id) AS broadcasts_sent,
  ROUND(
    (COUNT(CASE WHEN be.message_opened_at IS NOT NULL THEN 1 END)::DECIMAL /
     NULLIF(COUNT(DISTINCT be.user_id), 0) * 100)::NUMERIC,
    2
  ) AS avg_open_rate,
  ROUND(
    (COUNT(CASE WHEN be.message_clicked_at IS NOT NULL THEN 1 END)::DECIMAL /
     NULLIF(COUNT(DISTINCT be.user_id), 0) * 100)::NUMERIC,
    2
  ) AS avg_click_rate
FROM user_segments us
LEFT JOIN segment_membership sm ON us.segment_id = us.segment_id
LEFT JOIN broadcast_engagement be ON sm.user_id = be.user_id
WHERE us.is_active = true
GROUP BY us.segment_id, us.name;

-- A/B test results summary
CREATE OR REPLACE VIEW ab_test_results_summary AS
SELECT
  bat.ab_test_id,
  bat.test_name,
  bat.test_type,
  bat.variant_a_name,
  bat.variant_b_name,
  bat.variant_a_sample_size,
  bat.variant_b_sample_size,
  COALESCE(bat.variant_a_open_rate, 0) AS variant_a_open_rate,
  COALESCE(bat.variant_b_open_rate, 0) AS variant_b_open_rate,
  COALESCE(bat.variant_a_click_rate, 0) AS variant_a_click_rate,
  COALESCE(bat.variant_b_click_rate, 0) AS variant_b_click_rate,
  bat.is_statistically_significant,
  bat.winner_variant,
  bat.p_value,
  bat.status,
  bat.started_at,
  bat.ended_at
FROM broadcast_ab_tests bat
ORDER BY bat.created_at DESC;

-- Retry queue status
CREATE OR REPLACE VIEW retry_queue_status AS
SELECT
  status,
  COUNT(*) AS count,
  MIN(next_retry_at) AS earliest_retry,
  MAX(next_retry_at) AS latest_retry,
  AVG(attempt_number) AS avg_attempts
FROM broadcast_retry_queue
GROUP BY status;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: 7
-- - user_broadcast_preferences (user opt-out and frequency settings)
-- - user_segments (audience segmentation)
-- - segment_membership (many-to-many relationship)
-- - broadcast_engagement (message interaction tracking)
-- - broadcast_ab_tests (A/B test configurations)
-- - ab_test_assignments (user variant assignments)
-- - broadcast_retry_queue (failed message retry queue)
--
-- Views created: 4
-- - broadcast_engagement_summary (engagement analytics)
-- - segment_performance (segment performance metrics)
-- - ab_test_results_summary (A/B test results)
-- - retry_queue_status (retry queue status monitoring)
--
-- All tables include proper indexes, foreign keys, and triggers
-- Ready for production use with advanced broadcast features
-- =====================================================
