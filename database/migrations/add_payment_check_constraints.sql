-- =====================================================
-- ADD CHECK CONSTRAINTS TO PAYMENTS TABLE
-- Ensures data integrity for payment amounts and statuses
-- Created: 2025-12-28
-- =====================================================

-- Add CHECK constraint for payment amount (must be positive)
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_amount_positive;

ALTER TABLE payments
ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- Add CHECK constraint for payment status (must be one of valid values)
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_status_valid;

ALTER TABLE payments
ADD CONSTRAINT payments_status_valid CHECK (
  status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'expired',
    'refunded'
  )
);

-- Add CHECK constraint for currency (must be one of supported values)
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_currency_valid;

ALTER TABLE payments
ADD CONSTRAINT payments_currency_valid CHECK (
  currency IN ('USD', 'USDC', 'EUR', 'COP')
);

-- Add CHECK constraint for provider (must be one of supported providers)
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_provider_valid;

ALTER TABLE payments
ADD CONSTRAINT payments_provider_valid CHECK (
  provider IN ('epayco', 'daimo', 'paypal', 'stripe', 'manual', NULL)
);

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add index on provider for analytics
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);

-- Add index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Add composite index for user payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);

COMMENT ON CONSTRAINT payments_amount_positive ON payments IS 'Ensures payment amount is greater than zero';
COMMENT ON CONSTRAINT payments_status_valid ON payments IS 'Ensures payment status is one of the valid values';
COMMENT ON CONSTRAINT payments_currency_valid ON payments IS 'Ensures currency is one of the supported currencies';
COMMENT ON CONSTRAINT payments_provider_valid ON payments IS 'Ensures provider is one of the supported payment providers';
