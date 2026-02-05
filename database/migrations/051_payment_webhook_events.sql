-- Migration 051: Payment Webhook Events
-- Stores raw webhook payloads for auditing all payment attempts

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255),
  payment_id UUID,
  status VARCHAR(50),
  state_code VARCHAR(50),
  is_valid_signature BOOLEAN DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider
  ON payment_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id
  ON payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment_id
  ON payment_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at
  ON payment_webhook_events(created_at DESC);

COMMENT ON TABLE payment_webhook_events IS 'Raw payment webhook events for auditing payment attempts';
COMMENT ON COLUMN payment_webhook_events.event_id IS 'Provider event id or reference (ePayco ref_payco, Daimo id)';
COMMENT ON COLUMN payment_webhook_events.state_code IS 'Provider-specific state code (ePayco cod_transaction_state, Daimo event type)';
