-- Migration 043: Add promo code fields to pnp_bookings table
-- Adds support for promo codes in PNP Television Live bookings

-- ============================================================
-- 1. Add promo code fields to pnp_bookings
-- ============================================================
ALTER TABLE pnp_bookings
ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS promo_id INTEGER,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2);

-- ============================================================
-- 2. Update existing bookings to set original_price
-- ============================================================
UPDATE pnp_bookings
SET original_price = price_usd
WHERE original_price IS NULL;

-- ============================================================
-- 3. Create index for promo code lookup
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pnp_bookings_promo_code ON pnp_bookings(promo_code);

-- ============================================================
-- 4. Create index for promo ID lookup
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pnp_bookings_promo_id ON pnp_bookings(promo_id);