-- Migration 050: Promotional System
-- Creates tables for hidden promotional offers with audience targeting, spot limits, and expiration

-- ============================================================
-- 1. Create promos table
-- ============================================================
CREATE TABLE IF NOT EXISTS promos (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,  -- Unique promo identifier (used in deep links)
  name VARCHAR(255) NOT NULL,         -- Admin-friendly name
  name_es VARCHAR(255),               -- Spanish name for display
  description TEXT,                   -- English description for users
  description_es TEXT,                -- Spanish description for users

  -- Target plan and pricing
  base_plan_id VARCHAR(100) NOT NULL, -- Reference to plans.id (e.g., 'monthly_pass', 'yearly_pass')
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_price')),
  discount_value DECIMAL(10,2) NOT NULL, -- Percentage (e.g., 50.00 for 50%) OR fixed price in USD

  -- Audience targeting
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'churned', 'new_users', 'free_users')),
  new_user_days INTEGER DEFAULT 7,    -- For 'new_users': users created within X days

  -- Limits and expiration
  max_spots INTEGER,                  -- NULL = unlimited
  current_spots_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE, -- NULL = no expiration

  -- Features override (optional - if empty, uses base plan features)
  features JSONB DEFAULT '[]'::jsonb,  -- Array of feature strings in English
  features_es JSONB DEFAULT '[]'::jsonb, -- Array of feature strings in Spanish

  -- Status
  active BOOLEAN DEFAULT true,
  hidden BOOLEAN DEFAULT true,        -- If true, only accessible via deep link

  -- Tracking
  created_by VARCHAR(100),            -- Admin user ID who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. Create promo_redemptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id SERIAL PRIMARY KEY,
  promo_id INTEGER NOT NULL REFERENCES promos(id) ON DELETE RESTRICT,
  user_id VARCHAR(100) NOT NULL,      -- Telegram user ID
  payment_id UUID,                    -- Reference to payments.id (set after payment completion)

  -- Pricing at time of redemption
  original_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,

  -- Status: claimed = spot reserved, completed = payment done, expired = payment timed out, cancelled = user cancelled
  status VARCHAR(20) DEFAULT 'claimed' CHECK (status IN ('claimed', 'completed', 'expired', 'cancelled')),

  -- Tracking
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(promo_id, user_id)           -- One redemption per user per promo
);

-- ============================================================
-- 3. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_promos_code ON promos(code);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(active, hidden);
CREATE INDEX IF NOT EXISTS idx_promos_valid_dates ON promos(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promos_target ON promos(target_audience);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promo_redemptions(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_status ON promo_redemptions(status);

-- ============================================================
-- 4. Trigger to auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_promos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_promos_updated_at ON promos;
CREATE TRIGGER trigger_promos_updated_at
  BEFORE UPDATE ON promos
  FOR EACH ROW
  EXECUTE FUNCTION update_promos_updated_at();

-- ============================================================
-- 5. Add metadata column to payments table for promo tracking
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payments_metadata ON payments USING GIN (metadata);

COMMENT ON COLUMN payments.metadata IS 'JSON metadata for promo tracking: {promoId, promoCode, redemptionId, originalPrice, discountAmount}';

-- ============================================================
-- 6. Comments for documentation
-- ============================================================
COMMENT ON TABLE promos IS 'Promotional offers with audience targeting, spot limits, and expiration dates';
COMMENT ON COLUMN promos.code IS 'Unique promo code used in deep links (e.g., SUMMER50 -> t.me/bot?start=promo_SUMMER50)';
COMMENT ON COLUMN promos.discount_type IS 'percentage = discount off base price, fixed_price = absolute price';
COMMENT ON COLUMN promos.discount_value IS 'For percentage: 0-100. For fixed_price: final price in USD';
COMMENT ON COLUMN promos.target_audience IS 'all = everyone, churned = previous subscribers, new_users = within N days, free_users = never subscribed';
COMMENT ON COLUMN promos.hidden IS 'If true, promo only accessible via deep link, not shown in menus';

COMMENT ON TABLE promo_redemptions IS 'Tracks user promo claims and completions';
COMMENT ON COLUMN promo_redemptions.status IS 'claimed = spot reserved pending payment, completed = payment successful, expired/cancelled = did not complete';
