-- Migration: Private Calls Pronto - Enhanced 1:1 Booking System
-- This migration adds the complete private calls booking system with:
-- - Enhanced performers table
-- - Performer availability rules (weekly + exceptions)
-- - Booking slots with hold mechanism
-- - Bookings lifecycle
-- - Payments tracking
-- - Call sessions management
-- - Notifications scheduling
-- - Audit logs

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENHANCE PERFORMERS TABLE
-- =====================================================
-- Add missing columns to performers table
ALTER TABLE performers
ADD COLUMN IF NOT EXISTS bio_short TEXT,
ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(100) DEFAULT 'America/Bogota',
ADD COLUMN IF NOT EXISTS allowed_call_types_json JSONB DEFAULT '["video","audio"]'::jsonb,
ADD COLUMN IF NOT EXISTS durations_minutes JSONB DEFAULT '[15,30,60]'::jsonb,
ADD COLUMN IF NOT EXISTS base_price_cents INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_daily_calls INTEGER;

-- Update existing base_price to cents if needed
UPDATE performers SET base_price_cents = COALESCE(base_price * 100, 10000)::INTEGER
WHERE base_price_cents IS NULL OR base_price_cents = 0;

-- =====================================================
-- 2. PERFORMER AVAILABILITY RULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS performer_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performer_id UUID NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('weekly_rule', 'exception_add', 'exception_block')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun..6=Sat (for weekly_rule)
  start_time_local TIME,
  end_time_local TIME,
  date_local DATE, -- for exceptions
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/Bogota',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_performer_availability_performer ON performer_availability(performer_id);
CREATE INDEX IF NOT EXISTS idx_performer_availability_type ON performer_availability(type);
CREATE INDEX IF NOT EXISTS idx_performer_availability_day ON performer_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_performer_availability_date ON performer_availability(date_local);

-- =====================================================
-- 3. BOOKING SLOTS TABLE (Precomputed/Held Slots)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performer_id UUID NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  start_time_utc TIMESTAMPTZ NOT NULL,
  end_time_utc TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'held', 'booked', 'blocked')),
  held_by_user_id VARCHAR(255),
  hold_expires_at TIMESTAMPTZ,
  booking_id UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_performer ON booking_slots(performer_id);
CREATE INDEX IF NOT EXISTS idx_booking_slots_start ON booking_slots(start_time_utc);
CREATE INDEX IF NOT EXISTS idx_booking_slots_status ON booking_slots(status);
CREATE INDEX IF NOT EXISTS idx_booking_slots_hold_expires ON booking_slots(hold_expires_at) WHERE status = 'held';
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slots_unique ON booking_slots(performer_id, start_time_utc);

-- =====================================================
-- 4. BOOKINGS TABLE (Booking Lifecycle)
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES booking_slots(id) ON DELETE SET NULL,
  call_type VARCHAR(50) NOT NULL CHECK (call_type IN ('video', 'audio')),
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  start_time_utc TIMESTAMPTZ NOT NULL,
  end_time_utc TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft', 'held', 'awaiting_payment', 'confirmed',
    'cancelled', 'no_show', 'completed', 'expired'
  )),
  hold_expires_at TIMESTAMPTZ,
  cancel_reason TEXT,
  cancelled_by VARCHAR(50), -- 'user', 'performer', 'admin', 'system'
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rules_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_performer ON bookings(performer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_performer_start ON bookings(performer_id, start_time_utc);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires ON bookings(hold_expires_at) WHERE status IN ('held', 'awaiting_payment');
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(user_id, created_at);

-- =====================================================
-- 5. BOOKING PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('meru', 'stripe', 'wompi', 'paypal', 'epayco', 'daimo', 'manual')),
  provider_payment_id VARCHAR(255),
  payment_link TEXT,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'created' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_provider ON booking_payments(provider);
CREATE INDEX IF NOT EXISTS idx_booking_payments_provider_id ON booking_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_status ON booking_payments(status);
CREATE INDEX IF NOT EXISTS idx_booking_payments_expires ON booking_payments(expires_at) WHERE status IN ('created', 'pending');

-- =====================================================
-- 6. CALL SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_provider VARCHAR(50) NOT NULL CHECK (room_provider IN ('agora', 'jitsi', 'daily', 'internal')),
  room_id VARCHAR(255) NOT NULL,
  room_name VARCHAR(255),
  join_url_user TEXT,
  join_url_performer TEXT,
  token_user TEXT,
  token_performer TEXT,
  max_participants INTEGER DEFAULT 2,
  recording_disabled BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'destroyed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  actual_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_booking ON call_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_room_id ON call_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);

-- =====================================================
-- 7. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'reminder_60', 'reminder_15', 'reminder_5',
    'booking_confirmed', 'payment_received', 'call_starting',
    'followup', 'feedback_request', 'admin_alert'
  )),
  recipient_type VARCHAR(50) DEFAULT 'user' CHECK (recipient_type IN ('user', 'performer', 'admin')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_scheduled ON booking_notifications(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_user ON booking_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_booking ON booking_notifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_status ON booking_notifications(status);

-- =====================================================
-- 8. AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('user', 'performer', 'admin', 'system')),
  actor_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_audit_entity ON booking_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_booking_audit_actor ON booking_audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_booking_audit_action ON booking_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_booking_audit_created ON booking_audit_logs(created_at);

-- =====================================================
-- 9. USER ELIGIBILITY TRACKING
-- =====================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS private_calls_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS total_calls_booked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_calls_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;

-- =====================================================
-- 10. UPDATE TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON bookings;
CREATE TRIGGER trigger_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_bookings_updated_at();

CREATE OR REPLACE FUNCTION update_booking_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_payments_updated_at ON booking_payments;
CREATE TRIGGER trigger_booking_payments_updated_at
BEFORE UPDATE ON booking_payments
FOR EACH ROW
EXECUTE FUNCTION update_booking_payments_updated_at();

-- =====================================================
-- 11. INSERT DEFAULT AVAILABILITY RULES
-- =====================================================
-- Add default weekly availability for existing performers (Mon-Sat 10am-10pm)
INSERT INTO performer_availability (performer_id, type, day_of_week, start_time_local, end_time_local, timezone)
SELECT
  p.id,
  'weekly_rule',
  dow,
  '10:00:00'::TIME,
  '22:00:00'::TIME,
  COALESCE(p.timezone, 'America/Bogota')
FROM performers p
CROSS JOIN generate_series(1, 6) AS dow -- Monday (1) to Saturday (6)
WHERE p.status = 'active'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. HELPER FUNCTIONS
-- =====================================================

-- Function to check if a slot is available
CREATE OR REPLACE FUNCTION is_slot_available(
  p_performer_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings b
  WHERE b.performer_id = p_performer_id
    AND b.status IN ('held', 'awaiting_payment', 'confirmed')
    AND (
      (b.start_time_utc < p_end_time AND b.end_time_utc > p_start_time)
    );

  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to hold a slot
CREATE OR REPLACE FUNCTION hold_booking_slot(
  p_booking_id UUID,
  p_hold_minutes INTEGER DEFAULT 10
) RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if slot is still available
  IF NOT is_slot_available(v_booking.performer_id, v_booking.start_time_utc, v_booking.end_time_utc) THEN
    RETURN FALSE;
  END IF;

  -- Update booking to held status
  UPDATE bookings
  SET status = 'held',
      hold_expires_at = CURRENT_TIMESTAMP + (p_hold_minutes || ' minutes')::INTERVAL,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_booking_id AND status = 'draft';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to expire held bookings
CREATE OR REPLACE FUNCTION expire_held_bookings() RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE bookings
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('held', 'awaiting_payment')
      AND hold_expires_at IS NOT NULL
      AND hold_expires_at < CURRENT_TIMESTAMP
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  -- Also expire associated payments
  UPDATE booking_payments bp
  SET status = 'expired',
      updated_at = CURRENT_TIMESTAMP
  FROM bookings b
  WHERE bp.booking_id = b.id
    AND b.status = 'expired'
    AND bp.status IN ('created', 'pending');

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Log migration completion
-- INSERT INTO migrations (name, applied_at, description)
VALUES ('037_private_calls_pronto', NOW(), 'Enhanced private calls booking system with hold mechanism, payments, sessions, notifications, and audit logs')
-- ON CONFLICT (name) DO NOTHING;
