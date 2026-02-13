-- Comprehensive Payment History Tracking System
-- Tracks all payments across all methods with full audit trail

-- Main payment history table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Payment details
  payment_method VARCHAR(50) NOT NULL,  -- 'epayco', 'daimo', 'meru', 'lifetime100', 'bold', 'paypal', 'stripe'
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Product/Plan information
  plan_id VARCHAR(100),
  plan_name VARCHAR(255),
  product VARCHAR(100),  -- 'lifetime-pass', 'monthly', 'yearly', 'lifetime100-promo', etc.

  -- Payment reference (varies by method)
  payment_reference VARCHAR(255) NOT NULL UNIQUE,  -- Transaction ID, activation code, link code
  provider_transaction_id VARCHAR(255),             -- ePayco: x_ref_payco, Daimo: txHash, Meru: link code
  provider_payment_id VARCHAR(255),                 -- Daimo: daimo_payment_id, ePayco: payment_id

  -- Webhook metadata
  webhook_data JSONB,  -- Full webhook payload for audit and debugging

  -- Status
  status VARCHAR(50) DEFAULT 'completed',  -- 'completed', 'pending', 'failed', 'refunded'

  -- Timestamps
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When payment was made
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When processed/verified

  -- Additional tracking
  ip_address INET,                  -- IP address of payment origin
  user_agent TEXT,                  -- User agent from webhook
  metadata JSONB,                   -- Promo codes, admin notes, verification method, etc.

  -- Constraints
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_method ON payment_history(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_history_reference ON payment_history(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_date ON payment_history(user_id, payment_date DESC);

-- Add fields to users table for quick access to last payment info
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_payment_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS last_payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_payment_reference VARCHAR(255);

-- Create index on last_payment_date for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_last_payment_date ON users(last_payment_date);

-- View for active payment methods by user
CREATE OR REPLACE VIEW user_payment_methods AS
SELECT DISTINCT
  user_id,
  payment_method,
  COUNT(*) as usage_count,
  MAX(payment_date) as last_used
FROM payment_history
WHERE status = 'completed'
GROUP BY user_id, payment_method
ORDER BY user_id, payment_date DESC;

-- View for users with payment history
CREATE OR REPLACE VIEW user_payment_summary AS
SELECT
  u.id as user_id,
  u.username,
  COUNT(ph.id) as total_payments,
  SUM(CASE WHEN ph.status = 'completed' THEN ph.amount ELSE 0 END) as total_amount_paid,
  COUNT(DISTINCT ph.payment_method) as payment_methods_used,
  MIN(ph.payment_date) as first_payment_date,
  MAX(ph.payment_date) as last_payment_date,
  u.plan_expiry,
  u.subscription_status
FROM users u
LEFT JOIN payment_history ph ON u.id = ph.user_id AND ph.status = 'completed'
GROUP BY u.id, u.username, u.plan_expiry, u.subscription_status;

-- Trigger to update users.last_payment_* fields when payment_history is inserted
CREATE OR REPLACE FUNCTION update_user_last_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE users
    SET
      last_payment_date = NEW.payment_date,
      last_payment_amount = NEW.amount,
      last_payment_method = NEW.payment_method,
      last_payment_reference = NEW.payment_reference,
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_last_payment ON payment_history;
CREATE TRIGGER trigger_update_user_last_payment
  AFTER INSERT ON payment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_payment();
