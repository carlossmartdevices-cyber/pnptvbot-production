-- Topic configuration tables (used by media mirror and topic personalization)
CREATE TABLE IF NOT EXISTS topic_configuration (
  topic_id BIGINT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  topic_name VARCHAR(255) NOT NULL,

  -- Access Control
  can_post VARCHAR(50) DEFAULT 'all',
  can_reply VARCHAR(50) DEFAULT 'all',
  can_react VARCHAR(50) DEFAULT 'all',
  required_role VARCHAR(50) DEFAULT 'user',
  required_subscription VARCHAR(50) DEFAULT 'free',

  -- Content Rules
  media_required BOOLEAN DEFAULT FALSE,
  allow_text_only BOOLEAN DEFAULT TRUE,
  allow_caption BOOLEAN DEFAULT TRUE,
  allowed_media JSONB DEFAULT '["photo","video","animation"]',
  allow_stickers BOOLEAN DEFAULT TRUE,
  allow_documents BOOLEAN DEFAULT FALSE,

  -- Reply Handling
  allow_replies BOOLEAN DEFAULT TRUE,
  reply_must_quote BOOLEAN DEFAULT FALSE,
  allow_text_in_replies BOOLEAN DEFAULT TRUE,

  -- Moderation
  auto_moderate BOOLEAN DEFAULT FALSE,
  anti_spam_enabled BOOLEAN DEFAULT FALSE,
  anti_flood_enabled BOOLEAN DEFAULT FALSE,
  anti_links_enabled BOOLEAN DEFAULT FALSE,
  allow_commands BOOLEAN DEFAULT TRUE,

  -- Rate Limiting
  max_posts_per_hour INTEGER DEFAULT 100,
  max_replies_per_hour INTEGER DEFAULT 100,
  cooldown_between_posts INTEGER DEFAULT 0,

  -- Bot Behavior
  redirect_bot_responses BOOLEAN DEFAULT FALSE,
  auto_delete_enabled BOOLEAN DEFAULT FALSE,
  auto_delete_after INTEGER DEFAULT 300,
  override_global_deletion BOOLEAN DEFAULT FALSE,

  -- Notifications & Features
  notify_all_on_new_post BOOLEAN DEFAULT FALSE,
  auto_pin_admin_messages BOOLEAN DEFAULT FALSE,
  auto_pin_duration INTEGER DEFAULT 172800,

  -- Mirror Settings
  auto_mirror_enabled BOOLEAN DEFAULT FALSE,
  mirror_from_general BOOLEAN DEFAULT FALSE,
  mirror_format TEXT DEFAULT '📸 From: @{username}\n\n{caption}',

  -- Analytics
  enable_leaderboard BOOLEAN DEFAULT FALSE,
  track_reactions BOOLEAN DEFAULT FALSE,
  track_posts BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_violations (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  topic_id BIGINT NOT NULL,
  violation_type VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_analytics (
  id SERIAL PRIMARY KEY,
  topic_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username VARCHAR(255),
  total_posts INTEGER DEFAULT 0,
  total_media_shared INTEGER DEFAULT 0,
  total_reactions_given INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  most_liked_post_id BIGINT,
  most_liked_post_count INTEGER DEFAULT 0,
  last_post_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topic_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_config_group ON topic_configuration(group_id);
CREATE INDEX IF NOT EXISTS idx_violations_user_topic ON topic_violations(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON topic_violations(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_topic ON topic_analytics(topic_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON topic_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_posts ON topic_analytics(total_posts DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_reactions ON topic_analytics(total_reactions_given DESC);
