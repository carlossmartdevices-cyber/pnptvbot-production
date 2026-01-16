-- PostgreSQL Schema for PNPtv Bot
-- Migration from Firestore to PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,  -- Telegram user ID (can be numeric or string)
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,

  -- Profile
  bio TEXT,
  photo_file_id VARCHAR(255),
  photo_updated_at TIMESTAMP,
  interests TEXT[], -- Array of interests

  -- Location
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_name VARCHAR(255),
  location_geohash VARCHAR(50),
  location_updated_at TIMESTAMP,
  location_sharing_enabled BOOLEAN DEFAULT TRUE,

  -- Subscription
  subscription_status VARCHAR(50) DEFAULT 'free',
  plan_id VARCHAR(100),
  plan_expiry TIMESTAMP,
  tier VARCHAR(50) DEFAULT 'free',

  -- Role & Permissions
  role VARCHAR(255) DEFAULT 'user',
  assigned_by VARCHAR(255),
  role_assigned_at TIMESTAMP,

  -- Privacy settings (stored as JSONB)
  privacy JSONB DEFAULT '{"showLocation": true, "showInterests": true, "showBio": true, "allowMessages": true, "showOnline": true}'::jsonb,

  -- Counters
  profile_views INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,

  -- Arrays
  favorites TEXT[] DEFAULT '{}',
  blocked TEXT[] DEFAULT '{}',
  badges TEXT[] DEFAULT '{}',

  -- Onboarding & Verification
  onboarding_complete BOOLEAN DEFAULT FALSE,
  age_verified BOOLEAN DEFAULT FALSE,
  age_verified_at TIMESTAMP,
  age_verification_expires_at TIMESTAMP,
  age_verification_interval_hours INTEGER DEFAULT 168, -- 7 days
  terms_accepted BOOLEAN DEFAULT FALSE,
  privacy_accepted BOOLEAN DEFAULT FALSE,

  -- Activity tracking
  last_active TIMESTAMP,
  last_activity_in_group VARCHAR(255),
  group_activity_log JSONB,

  -- Timezone
  timezone VARCHAR(100),
  timezone_detected BOOLEAN DEFAULT FALSE,
  timezone_updated_at TIMESTAMP,

  -- Metadata
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location_sharing ON users(location_sharing_enabled) WHERE location_sharing_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_plan_expiry ON users(plan_expiry) WHERE plan_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  price_in_cop DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  duration INTEGER NOT NULL, -- in days
  duration_days INTEGER, -- compatibility field
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  icon VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  recommended BOOLEAN DEFAULT FALSE,
  is_lifetime BOOLEAN DEFAULT FALSE,
  requires_manual_activation BOOLEAN DEFAULT FALSE,
  payment_method VARCHAR(50),
  wompi_payment_link TEXT,
  crypto_bonus JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(100) REFERENCES plans(id),
  plan_name VARCHAR(255),

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  provider VARCHAR(50),
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',

  -- Transaction info
  payment_id VARCHAR(255),
  reference VARCHAR(255),
  destination_address VARCHAR(255),
  payment_url TEXT,

  -- Blockchain specific
  chain JSONB, -- Can store chain info or chain ID
  chain_id INTEGER,

  -- Completion
  completed_at TIMESTAMP,
  completed_by VARCHAR(255),
  manual_completion BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Call details
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed, missed, cancelled
  call_type VARCHAR(50) DEFAULT 'video', -- video, audio
  duration INTEGER DEFAULT 0, -- in seconds

  -- Scheduling
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,

  -- Ratings & Feedback
  caller_rating INTEGER CHECK (caller_rating >= 1 AND caller_rating <= 5),
  receiver_rating INTEGER CHECK (receiver_rating >= 1 AND receiver_rating <= 5),
  caller_feedback TEXT,
  receiver_feedback TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for calls
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_scheduled_at ON calls(scheduled_at);

-- Call packages table
CREATE TABLE IF NOT EXISTS call_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_type VARCHAR(50) NOT NULL,

  -- Package details
  total_minutes INTEGER NOT NULL,
  used_minutes INTEGER DEFAULT 0,
  remaining_minutes INTEGER NOT NULL,

  -- Validity
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call packages
CREATE INDEX IF NOT EXISTS idx_call_packages_user_id ON call_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_call_packages_active ON call_packages(active);

-- Live streams table
CREATE TABLE IF NOT EXISTS live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stream details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  stream_url TEXT,
  thumbnail_url TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, live, ended
  is_public BOOLEAN DEFAULT TRUE,

  -- Schedule
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,

  -- Stats
  viewers_count INTEGER DEFAULT 0,
  max_viewers INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for live streams
CREATE INDEX IF NOT EXISTS idx_live_streams_host_id ON live_streams(host_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled_at ON live_streams(scheduled_at);

-- Radio stations table
CREATE TABLE IF NOT EXISTS radio_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stream_url TEXT NOT NULL,
  website_url TEXT,
  logo_url TEXT,

  -- Categorization
  genre VARCHAR(100),
  country VARCHAR(100),
  language VARCHAR(50),

  -- Status
  active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,

  -- Stats
  listeners_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for radio stations
CREATE INDEX IF NOT EXISTS idx_radio_stations_genre ON radio_stations(genre);
CREATE INDEX IF NOT EXISTS idx_radio_stations_active ON radio_stations(active);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) NOT NULL UNIQUE,

  -- Discount details
  discount_type VARCHAR(50) NOT NULL, -- percentage, fixed
  discount_value DECIMAL(10, 2) NOT NULL,

  -- Applicable plans
  applicable_plans TEXT[], -- Array of plan IDs

  -- Usage limits
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,

  -- Validity
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for promo codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active);

-- Gamification table
CREATE TABLE IF NOT EXISTS gamification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Points & Levels
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,

  -- Achievements
  achievements JSONB DEFAULT '[]'::jsonb,

  -- Streaks
  login_streak INTEGER DEFAULT 0,
  last_login_date DATE,

  -- Activity stats
  total_calls INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  referrals_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

-- Indexes for gamification
CREATE INDEX IF NOT EXISTS idx_gamification_user_id ON gamification(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_points ON gamification(points);
CREATE INDEX IF NOT EXISTS idx_gamification_level ON gamification(level);

-- Moderation table
CREATE TABLE IF NOT EXISTS moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Banned content
  words TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  patterns TEXT[] DEFAULT '{}',

  -- Metadata
  updated_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User moderation actions
CREATE TABLE IF NOT EXISTS user_moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moderator_id VARCHAR(255) NOT NULL REFERENCES users(id),

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- warn, mute, ban, unban
  reason TEXT,
  duration INTEGER, -- in minutes, null for permanent

  -- Status
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for moderation actions
CREATE INDEX IF NOT EXISTS idx_moderation_actions_user_id ON user_moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_active ON user_moderation_actions(active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_packages_updated_at BEFORE UPDATE ON call_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_live_streams_updated_at BEFORE UPDATE ON live_streams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_radio_stations_updated_at BEFORE UPDATE ON radio_stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gamification_updated_at BEFORE UPDATE ON gamification FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
