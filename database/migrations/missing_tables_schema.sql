-- Missing PostgreSQL Tables for Firestore Migration
-- Tables for emotes, moderation, radio, and subscribers functionality

-- Emotes table (platform-wide emotes)
CREATE TABLE IF NOT EXISTS emotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  emoji VARCHAR(50) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom emotes (user-specific)
CREATE TABLE IF NOT EXISTS custom_emotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streamer_name VARCHAR(255),
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(50),
  image_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMP,
  approved_by VARCHAR(255),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Emote usage tracking
CREATE TABLE IF NOT EXISTS emote_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emote_id UUID REFERENCES custom_emotes(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  emote_name VARCHAR(100),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  context VARCHAR(50) -- 'message', 'reaction', etc.
);

-- Indexes for emotes
CREATE INDEX IF NOT EXISTS idx_custom_emotes_user_id ON custom_emotes(user_id);
CREATE INDEX IF NOT EXISTS idx_emote_usage_user_id ON emote_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_emote_usage_emote_name ON emote_usage(emote_name);
CREATE INDEX IF NOT EXISTS idx_emote_usage_used_at ON emote_usage(used_at);

-- Group settings for moderation
CREATE TABLE IF NOT EXISTS group_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id VARCHAR(255) NOT NULL UNIQUE,
  group_title VARCHAR(255),

  -- Moderation settings
  anti_links_enabled BOOLEAN DEFAULT TRUE,
  anti_spam_enabled BOOLEAN DEFAULT TRUE,
  anti_flood_enabled BOOLEAN DEFAULT TRUE,
  anti_forwarded_enabled BOOLEAN DEFAULT TRUE,
  profanity_filter_enabled BOOLEAN DEFAULT FALSE,
  max_warnings INTEGER DEFAULT 3,
  flood_limit INTEGER DEFAULT 5,
  flood_window INTEGER DEFAULT 10,
  mute_duration INTEGER DEFAULT 3600,

  -- Custom filters
  allowed_domains TEXT[] DEFAULT '{}',
  banned_words TEXT[] DEFAULT '{}',

  -- Bot addition settings
  restrict_bot_addition BOOLEAN DEFAULT TRUE,
  allowed_bots TEXT[] DEFAULT '{pnptv_bot,PNPtvBot,PNPtvOfficialBot}',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User warnings
CREATE TABLE IF NOT EXISTS user_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Forwarded message violations
CREATE TABLE IF NOT EXISTS forwarded_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  message_id INTEGER,
  source_type VARCHAR(50) NOT NULL, -- 'group', 'bot', 'external'
  source_info JSONB,
  violation_type VARCHAR(50) DEFAULT 'forwarded_message',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bot addition attempts
CREATE TABLE IF NOT EXISTS bot_addition_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  bot_username VARCHAR(255) NOT NULL,
  bot_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'blocked', -- 'blocked', 'allowed'
  reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banned users
CREATE TABLE IF NOT EXISTS banned_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  banned_by VARCHAR(255) NOT NULL,
  reason TEXT,
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

-- Moderation logs
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id VARCHAR(255),
  user_id VARCHAR(255),
  moderator_id VARCHAR(255) DEFAULT 'system',
  action VARCHAR(50) NOT NULL,
  reason TEXT DEFAULT '',
  details TEXT DEFAULT '',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Username history (for tracking name changes)
CREATE TABLE IF NOT EXISTS username_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username VARCHAR(255),
  new_username VARCHAR(255),
  group_id VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  flagged BOOLEAN DEFAULT FALSE,
  flagged_by VARCHAR(255),
  flagged_at TIMESTAMP,
  flag_reason TEXT
);

-- Indexes for moderation tables
CREATE INDEX IF NOT EXISTS idx_group_settings_group_id ON group_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_group_id ON user_warnings(group_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_timestamp ON user_warnings(timestamp);
CREATE INDEX IF NOT EXISTS idx_banned_users_user_id ON banned_users(user_id);
CREATE INDEX IF NOT EXISTS idx_banned_users_group_id ON banned_users(group_id);
CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_group_id ON moderation_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_timestamp ON moderation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id);
CREATE INDEX IF NOT EXISTS idx_username_history_group_id ON username_history(group_id);
CREATE INDEX IF NOT EXISTS idx_username_history_changed_at ON username_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_username_history_flagged ON username_history(flagged);
CREATE INDEX IF NOT EXISTS idx_username_history_flagged_at ON username_history(flagged_at);
CREATE INDEX IF NOT EXISTS idx_forwarded_violations_user_id ON forwarded_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_violations_group_id ON forwarded_violations(group_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_violations_timestamp ON forwarded_violations(timestamp);
CREATE INDEX IF NOT EXISTS idx_bot_addition_attempts_user_id ON bot_addition_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_addition_attempts_group_id ON bot_addition_attempts(group_id);
CREATE INDEX IF NOT EXISTS idx_bot_addition_attempts_timestamp ON bot_addition_attempts(timestamp);
CREATE INDEX IF NOT EXISTS idx_bot_addition_attempts_bot_username ON bot_addition_attempts(bot_username);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  discount NUMERIC(10,2) NOT NULL,
  discount_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' or 'fixed'
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_until TIMESTAMP,
  min_amount NUMERIC(10,2) DEFAULT 0,
  applicable_plans TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  deactivated_at TIMESTAMP
);

-- Promo code usage tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255),
  discount_amount NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for promo codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_code ON promo_code_usage(code);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user_id ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_used_at ON promo_code_usage(used_at);

-- Subscribers table (for subscription management)
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  plan VARCHAR(100),
  subscription_id VARCHAR(255), -- External subscription ID (ePayco, etc.)
  provider VARCHAR(50) DEFAULT 'epayco',
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'cancelled'
  last_payment_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_telegram_id ON subscribers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_subscription_id ON subscribers(subscription_id);

-- Radio now playing
CREATE TABLE IF NOT EXISTS radio_now_playing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  duration VARCHAR(50),
  cover_url TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Radio requests
CREATE TABLE IF NOT EXISTS radio_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  song_name VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  duration VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'played', 'rejected'
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  played_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Radio history
CREATE TABLE IF NOT EXISTS radio_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  duration VARCHAR(50),
  cover_url TEXT,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Radio schedule
CREATE TABLE IF NOT EXISTS radio_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  time_slot VARCHAR(50) NOT NULL,
  program_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for radio tables
CREATE INDEX IF NOT EXISTS idx_radio_now_playing_started_at ON radio_now_playing(started_at);
CREATE INDEX IF NOT EXISTS idx_radio_requests_user_id ON radio_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_radio_requests_status ON radio_requests(status);
CREATE INDEX IF NOT EXISTS idx_radio_requests_requested_at ON radio_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_radio_history_played_at ON radio_history(played_at);
CREATE INDEX IF NOT EXISTS idx_radio_schedule_day_of_week ON radio_schedule(day_of_week);

-- Activation codes table
CREATE TABLE IF NOT EXISTS activation_codes (
  code VARCHAR(50) PRIMARY KEY,
  product VARCHAR(100) DEFAULT 'lifetime-pass',
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  used_by VARCHAR(255),
  used_by_username VARCHAR(255),
  email VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activation logs table
CREATE TABLE IF NOT EXISTS activation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  code VARCHAR(50) NOT NULL,
  product VARCHAR(100),
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT TRUE
);

-- Indexes for activation tables
CREATE INDEX IF NOT EXISTS idx_activation_codes_used ON activation_codes(used);
CREATE INDEX IF NOT EXISTS idx_activation_codes_used_by ON activation_codes(used_by);
CREATE INDEX IF NOT EXISTS idx_activation_codes_expires_at ON activation_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_activation_logs_user_id ON activation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_logs_code ON activation_logs(code);
CREATE INDEX IF NOT EXISTS idx_activation_logs_activated_at ON activation_logs(activated_at);

-- Call feedback table
CREATE TABLE IF NOT EXISTS call_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call feedback
CREATE INDEX IF NOT EXISTS idx_call_feedback_call_id ON call_feedback(call_id);
CREATE INDEX IF NOT EXISTS idx_call_feedback_user_id ON call_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_call_feedback_rating ON call_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_call_feedback_created_at ON call_feedback(created_at);

-- Profile compliance tracking (for username/name validation)
CREATE TABLE IF NOT EXISTS profile_compliance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL,
  username_valid BOOLEAN DEFAULT FALSE,
  name_valid BOOLEAN DEFAULT FALSE,
  compliance_issues TEXT[], -- Array of issues: 'no_username', 'invalid_name', 'non_latin_characters'
  warning_sent_at TIMESTAMP,
  warning_count INTEGER DEFAULT 0,
  purge_deadline TIMESTAMP,
  purged BOOLEAN DEFAULT FALSE,
  purged_at TIMESTAMP,
  compliance_met_at TIMESTAMP,
  last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

-- Indexes for profile compliance
CREATE INDEX IF NOT EXISTS idx_profile_compliance_user_id ON profile_compliance(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_compliance_group_id ON profile_compliance(group_id);
CREATE INDEX IF NOT EXISTS idx_profile_compliance_purge_deadline ON profile_compliance(purge_deadline);
CREATE INDEX IF NOT EXISTS idx_profile_compliance_purged ON profile_compliance(purged);
CREATE INDEX IF NOT EXISTS idx_profile_compliance_compliance_issues ON profile_compliance(compliance_issues);

-- Triggers for updated_at
CREATE TRIGGER update_custom_emotes_updated_at BEFORE UPDATE ON custom_emotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_settings_updated_at BEFORE UPDATE ON group_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_radio_requests_updated_at BEFORE UPDATE ON radio_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_radio_schedule_updated_at BEFORE UPDATE ON radio_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emotes_updated_at BEFORE UPDATE ON emotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_compliance_updated_at BEFORE UPDATE ON profile_compliance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

