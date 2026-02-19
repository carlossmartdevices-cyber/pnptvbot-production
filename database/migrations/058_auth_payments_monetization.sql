-- Auth, Payments & Monetization System Migration
-- Implements subscriptions, model payments, and withdrawal system
-- Idempotent: safe to run multiple times

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Add subscription and payment fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add model-specific fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS model_profile_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model_featured_until TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS model_bio TEXT,
  ADD COLUMN IF NOT EXISTS model_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_method_primary VARCHAR(50);

-- Create indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires ON users(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- ============================================
-- NEW TABLES FOR SUBSCRIPTION PLANS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL,
  description TEXT,
  price_usd NUMERIC(10,2) NOT NULL,
  price_cop NUMERIC(12,2) NOT NULL,
  billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
  features JSONB DEFAULT '{}',
  revenue_split_percentage NUMERIC(5,2) DEFAULT 80,
  max_streams_per_week INTEGER,
  max_content_uploads INTEGER,
  priority_featured BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_role ON subscription_plans(role);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);

-- ============================================
-- NEW TABLES FOR USER SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR(50),
  external_subscription_id VARCHAR(255),
  external_provider VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires ON user_subscriptions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_unique_active
  ON user_subscriptions(user_id)
  WHERE status = 'active';

-- ============================================
-- NEW TABLES FOR PAID CONTENT
-- ============================================

CREATE TABLE IF NOT EXISTS paid_content (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type VARCHAR(50) NOT NULL,
  content_url TEXT NOT NULL,
  thumbnail_url TEXT,
  price_usd NUMERIC(10,2) NOT NULL,
  price_cop NUMERIC(12,2) NOT NULL,
  is_exclusive BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paid_content_creator_id ON paid_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_paid_content_is_active ON paid_content(is_active);
CREATE INDEX IF NOT EXISTS idx_paid_content_created_at ON paid_content(created_at DESC);

-- ============================================
-- NEW TABLES FOR CONTENT PURCHASES
-- ============================================

CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES paid_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_cop NUMERIC(12,2) NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  purchased_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_purchases_content_id ON content_purchases(content_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_creator_id ON content_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_status ON content_purchases(status);
CREATE INDEX IF NOT EXISTS idx_content_purchases_purchased_at ON content_purchases(purchased_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_purchases_unique
  ON content_purchases(content_id, user_id)
  WHERE status = 'completed';

-- ============================================
-- NEW TABLES FOR LIVE STREAMS
-- ============================================

CREATE TABLE IF NOT EXISTS live_streams (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_live BOOLEAN DEFAULT TRUE,
  visibility VARCHAR(50) NOT NULL DEFAULT 'public',
  require_subscription BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  stream_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITHOUT TIME ZONE,
  total_duration_seconds INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_streams_creator_id ON live_streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_is_live ON live_streams(is_live);
CREATE INDEX IF NOT EXISTS idx_live_streams_started_at ON live_streams(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_visibility ON live_streams(visibility);

-- ============================================
-- NEW TABLES FOR STREAM VIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS stream_views (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  watch_duration_seconds INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stream_views_stream_id ON stream_views(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_views_user_id ON stream_views(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_views_created_at ON stream_views(created_at DESC);

-- ============================================
-- NEW TABLES FOR MODEL EARNINGS
-- ============================================

CREATE TABLE IF NOT EXISTS model_earnings (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  earnings_type VARCHAR(50) NOT NULL,
  source_id UUID,
  source_type VARCHAR(50),
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_cop NUMERIC(12,2) NOT NULL,
  platform_fee_usd NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_earnings_model_id ON model_earnings(model_id);
CREATE INDEX IF NOT EXISTS idx_model_earnings_status ON model_earnings(status);
CREATE INDEX IF NOT EXISTS idx_model_earnings_created_at ON model_earnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_earnings_period ON model_earnings(period_start, period_end);

-- ============================================
-- NEW TABLES FOR WITHDRAWALS
-- ============================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_cop NUMERIC(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reason TEXT,
  response_code VARCHAR(100),
  response_message TEXT,
  transaction_id VARCHAR(255),
  external_reference VARCHAR(255),
  requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITHOUT TIME ZONE,
  processed_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_model_id ON withdrawals(model_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON withdrawals(requested_at DESC);

-- ============================================
-- NEW TABLES FOR WITHDRAWAL AUDIT TRAIL
-- ============================================

CREATE TABLE IF NOT EXISTS withdrawal_audit_log (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_audit_log_withdrawal_id ON withdrawal_audit_log(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_audit_log_created_at ON withdrawal_audit_log(created_at DESC);

-- ============================================
-- NEW TABLES FOR SESSION TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS session_tokens (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  token_type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user_id ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires_at ON session_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_tokens_revoked_at ON session_tokens(revoked_at);

-- ============================================
-- PAYMENT TABLE ENHANCEMENTS
-- ============================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS subscription_plan_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS revenue_split_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS platform_fee_usd NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_payout_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS creator_payout_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS webhook_verified_at TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_payments_user_type ON payments(user_type);
CREATE INDEX IF NOT EXISTS idx_payments_creator_payout_status ON payments(creator_payout_status);

-- ============================================
-- GRANTS AND PERMISSIONS
-- ============================================

ALTER TABLE public.subscription_plans OWNER TO app_user;
ALTER TABLE public.user_subscriptions OWNER TO app_user;
ALTER TABLE public.paid_content OWNER TO app_user;
ALTER TABLE public.content_purchases OWNER TO app_user;
ALTER TABLE public.live_streams OWNER TO app_user;
ALTER TABLE public.stream_views OWNER TO app_user;
ALTER TABLE public.model_earnings OWNER TO app_user;
ALTER TABLE public.withdrawals OWNER TO app_user;
ALTER TABLE public.withdrawal_audit_log OWNER TO app_user;
ALTER TABLE public.session_tokens OWNER TO app_user;

-- Ensure indexes have correct owner
REINDEX INDEX IF EXISTS idx_users_role;
REINDEX INDEX IF EXISTS idx_users_subscription_plan;
REINDEX INDEX IF EXISTS idx_users_subscription_expires;
REINDEX INDEX IF EXISTS idx_users_email_verified;
REINDEX INDEX IF EXISTS idx_subscription_plans_role;
REINDEX INDEX IF EXISTS idx_subscription_plans_is_active;
REINDEX INDEX IF EXISTS idx_subscription_plans_slug;
REINDEX INDEX IF EXISTS idx_user_subscriptions_user_id;
REINDEX INDEX IF EXISTS idx_user_subscriptions_plan_id;
REINDEX INDEX IF EXISTS idx_user_subscriptions_status;
REINDEX INDEX IF EXISTS idx_user_subscriptions_expires;
REINDEX INDEX IF EXISTS idx_paid_content_creator_id;
REINDEX INDEX IF EXISTS idx_paid_content_is_active;
REINDEX INDEX IF EXISTS idx_paid_content_created_at;
REINDEX INDEX IF EXISTS idx_content_purchases_content_id;
REINDEX INDEX IF EXISTS idx_content_purchases_user_id;
REINDEX INDEX IF EXISTS idx_content_purchases_creator_id;
REINDEX INDEX IF EXISTS idx_content_purchases_status;
REINDEX INDEX IF EXISTS idx_content_purchases_purchased_at;
REINDEX INDEX IF EXISTS idx_live_streams_creator_id;
REINDEX INDEX IF EXISTS idx_live_streams_is_live;
REINDEX INDEX IF EXISTS idx_live_streams_started_at;
REINDEX INDEX IF EXISTS idx_live_streams_visibility;
REINDEX INDEX IF EXISTS idx_stream_views_stream_id;
REINDEX INDEX IF EXISTS idx_stream_views_user_id;
REINDEX INDEX IF EXISTS idx_stream_views_created_at;
REINDEX INDEX IF EXISTS idx_model_earnings_model_id;
REINDEX INDEX IF EXISTS idx_model_earnings_status;
REINDEX INDEX IF EXISTS idx_model_earnings_created_at;
REINDEX INDEX IF EXISTS idx_model_earnings_period;
REINDEX INDEX IF EXISTS idx_withdrawals_model_id;
REINDEX INDEX IF EXISTS idx_withdrawals_status;
REINDEX INDEX IF EXISTS idx_withdrawals_requested_at;
REINDEX INDEX IF EXISTS idx_withdrawal_audit_log_withdrawal_id;
REINDEX INDEX IF EXISTS idx_withdrawal_audit_log_created_at;
REINDEX INDEX IF EXISTS idx_session_tokens_user_id;
REINDEX INDEX IF EXISTS idx_session_tokens_expires_at;
REINDEX INDEX IF EXISTS idx_session_tokens_revoked_at;
REINDEX INDEX IF EXISTS idx_payments_user_type;
REINDEX INDEX IF EXISTS idx_payments_creator_payout_status;
