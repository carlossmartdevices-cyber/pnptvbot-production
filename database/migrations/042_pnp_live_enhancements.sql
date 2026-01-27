-- Migration 042: PNP Latino Live Enhancements
-- Adds custom pricing, tips, promo codes, and analytics tracking

-- =====================================================
-- 1. Add custom pricing columns to pnp_models
-- =====================================================
ALTER TABLE pnp_models
ADD COLUMN IF NOT EXISTS price_30min DECIMAL(10,2) DEFAULT 60.00,
ADD COLUMN IF NOT EXISTS price_60min DECIMAL(10,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS price_90min DECIMAL(10,2) DEFAULT 250.00,
ADD COLUMN IF NOT EXISTS commission_percent INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_shows INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0;

-- =====================================================
-- 2. Add tracking columns to pnp_bookings
-- =====================================================
ALTER TABLE pnp_bookings
ADD COLUMN IF NOT EXISTS model_earnings DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS show_ended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS availability_id INTEGER,
ADD COLUMN IF NOT EXISTS promo_code_id INTEGER,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2);

-- =====================================================
-- 3. Create tips table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_tips (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    message TEXT,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(100),
    model_earnings DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnp_tips_booking ON pnp_tips(booking_id);
CREATE INDEX IF NOT EXISTS idx_pnp_tips_model ON pnp_tips(model_id);
CREATE INDEX IF NOT EXISTS idx_pnp_tips_user ON pnp_tips(user_id);
CREATE INDEX IF NOT EXISTS idx_pnp_tips_status ON pnp_tips(payment_status);

-- =====================================================
-- 4. Create promo codes table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_live_promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,
    applicable_durations INTEGER[], -- Array of durations [30, 60, 90] or empty for all
    applicable_models INTEGER[], -- Array of model IDs or empty for all
    min_booking_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2), -- Maximum discount cap for percentage discounts
    single_use_per_user BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnp_promo_code ON pnp_live_promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_pnp_promo_active ON pnp_live_promo_codes(active);

-- =====================================================
-- 5. Create promo usage tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_live_promo_usage (
    id SERIAL PRIMARY KEY,
    promo_id INTEGER REFERENCES pnp_live_promo_codes(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    final_price DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(promo_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_pnp_promo_usage_user ON pnp_live_promo_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_pnp_promo_usage_promo ON pnp_live_promo_usage(promo_id);

-- =====================================================
-- 6. Create model earnings history table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_model_earnings (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE CASCADE,
    tip_id INTEGER REFERENCES pnp_tips(id) ON DELETE CASCADE,
    earning_type VARCHAR(20) NOT NULL CHECK (earning_type IN ('booking', 'tip')),
    gross_amount DECIMAL(10,2) NOT NULL,
    commission_percent INTEGER NOT NULL,
    model_earnings DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed')),
    payout_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnp_model_earnings_model ON pnp_model_earnings(model_id);
CREATE INDEX IF NOT EXISTS idx_pnp_model_earnings_payout ON pnp_model_earnings(payout_status);
CREATE INDEX IF NOT EXISTS idx_pnp_model_earnings_type ON pnp_model_earnings(earning_type);

-- =====================================================
-- 7. Create model payouts table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_model_payouts (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_method VARCHAR(50),
    payment_details JSONB,
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    processed_by VARCHAR(50),
    transaction_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnp_payouts_model ON pnp_model_payouts(model_id);
CREATE INDEX IF NOT EXISTS idx_pnp_payouts_status ON pnp_model_payouts(status);

-- =====================================================
-- 8. Trigger to update model stats on booking completion
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_stats_on_booking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE pnp_models
        SET total_shows = COALESCE(total_shows, 0) + 1,
            total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.model_earnings, 0),
            updated_at = NOW()
        WHERE id = NEW.model_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_model_stats ON pnp_bookings;
CREATE TRIGGER trigger_update_model_stats
AFTER UPDATE ON pnp_bookings
FOR EACH ROW
EXECUTE FUNCTION update_model_stats_on_booking();

-- =====================================================
-- 9. Trigger to update model rating on feedback
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_rating_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
    v_model_id INTEGER;
BEGIN
    -- Get the model_id from the booking
    SELECT model_id INTO v_model_id
    FROM pnp_bookings
    WHERE id = NEW.booking_id;

    IF v_model_id IS NOT NULL THEN
        UPDATE pnp_models
        SET avg_rating = (
            SELECT COALESCE(AVG(f.rating)::DECIMAL(3,2), 0)
            FROM pnp_feedback f
            JOIN pnp_bookings b ON f.booking_id = b.id
            WHERE b.model_id = v_model_id AND f.rating IS NOT NULL
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM pnp_feedback f
            JOIN pnp_bookings b ON f.booking_id = b.id
            WHERE b.model_id = v_model_id AND f.rating IS NOT NULL
        ),
        updated_at = NOW()
        WHERE id = v_model_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_model_rating ON pnp_feedback;
CREATE TRIGGER trigger_update_model_rating
AFTER INSERT OR UPDATE ON pnp_feedback
FOR EACH ROW
EXECUTE FUNCTION update_model_rating_on_feedback();

-- =====================================================
-- 10. Trigger to update promo code usage count
-- =====================================================
CREATE OR REPLACE FUNCTION update_promo_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pnp_live_promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = NEW.promo_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promo_usage ON pnp_live_promo_usage;
CREATE TRIGGER trigger_update_promo_usage
AFTER INSERT ON pnp_live_promo_usage
FOR EACH ROW
EXECUTE FUNCTION update_promo_usage_count();

-- =====================================================
-- 11. Trigger to update model earnings from tips
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_earnings_on_tip()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        UPDATE pnp_models
        SET total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.model_earnings, 0),
            updated_at = NOW()
        WHERE id = NEW.model_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_model_earnings_tip ON pnp_tips;
CREATE TRIGGER trigger_update_model_earnings_tip
AFTER UPDATE ON pnp_tips
FOR EACH ROW
EXECUTE FUNCTION update_model_earnings_on_tip();
