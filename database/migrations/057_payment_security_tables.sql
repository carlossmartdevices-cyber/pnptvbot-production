-- Payment Security Tables Migration
-- Idempotent: safe to run multiple times

-- Audit trail for all payment events
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  payment_id VARCHAR(255),
  user_id VARCHAR(255),
  event_type VARCHAR(50),
  provider VARCHAR(50),
  amount NUMERIC(12,2),
  status VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_log_payment_id ON payment_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_user_id ON payment_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_created_at ON payment_audit_log(created_at DESC);

-- Error logging for payment processing failures
CREATE TABLE IF NOT EXISTS payment_errors (
  id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
  payment_id VARCHAR(255),
  user_id VARCHAR(255),
  provider VARCHAR(50),
  error_code VARCHAR(100),
  error_message TEXT,
  stack_trace TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_errors_payment_id ON payment_errors(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_errors_created_at ON payment_errors(created_at DESC);

-- Add encrypted_data column for at-rest encryption of payment records
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
