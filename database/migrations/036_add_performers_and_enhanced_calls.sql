-- Migration: Add Performers and Enhanced Private Calls System
-- This migration adds the performers table and enhances the private_calls table
-- to support the full 1:1 private call booking feature

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PERFORMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS performers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  photo_url TEXT,
  
  -- Availability schedule (timezone-aware)
  availability_schedule JSONB DEFAULT '[]'::jsonb, -- Array of available time slots
  timezone VARCHAR(100) DEFAULT 'UTC',
  
  -- Call preferences
  allowed_call_types VARCHAR(50)[] DEFAULT ARRAY['video', 'audio']::varchar[],
  max_call_duration INTEGER DEFAULT 60, -- in minutes
  base_price DECIMAL(10, 2) NOT NULL,
  buffer_time_before INTEGER DEFAULT 15, -- in minutes
  buffer_time_after INTEGER DEFAULT 15, -- in minutes
  
  -- Status and settings
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'inactive'
  is_available BOOLEAN DEFAULT true,
  availability_message TEXT,
  
  -- Statistics
  total_calls INTEGER DEFAULT 0,
  total_rating DECIMAL(3, 2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  
  UNIQUE(display_name)
);

-- Indexes for performers
CREATE INDEX IF NOT EXISTS idx_performers_user_id ON performers(user_id);
CREATE INDEX IF NOT EXISTS idx_performers_status ON performers(status);
CREATE INDEX IF NOT EXISTS idx_performers_availability ON performers(is_available);
CREATE INDEX IF NOT EXISTS idx_performers_display_name ON performers(display_name);

-- =====================================================
-- 2. ENHANCE PRIVATE_CALLS TABLE
-- =====================================================
-- Add new columns to private_calls table
ALTER TABLE private_calls
ADD COLUMN IF NOT EXISTS booking_id UUID DEFAULT uuid_generate_v4(),
ADD COLUMN IF NOT EXISTS meeting_url TEXT,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_15min_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS feedback_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS call_status VARCHAR(50) DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS incident_reported BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS incident_details TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_private_calls_booking_id ON private_calls(booking_id);
CREATE INDEX IF NOT EXISTS idx_private_calls_payment_status ON private_calls(payment_status);
CREATE INDEX IF NOT EXISTS idx_private_calls_call_status ON private_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_private_calls_scheduled_date ON private_calls(scheduled_date);

-- =====================================================
-- 3. CALL BOOKING LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  
  -- Booking details
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment information
  payment_id VARCHAR(255),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_completed_at TIMESTAMP,
  
  -- Call information
  call_id UUID REFERENCES private_calls(id) ON DELETE SET NULL,
  meeting_url TEXT,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, paid, scheduled, completed, cancelled, refunded
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP,
  cancelled_by VARCHAR(255),
  
  -- Reminders
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  reminder_15min_sent BOOLEAN DEFAULT false,
  
  -- Feedback
  user_feedback TEXT,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  performer_feedback TEXT,
  performer_rating INTEGER CHECK (performer_rating >= 1 AND performer_rating <= 5),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(booking_id)
);

-- Indexes for call bookings
CREATE INDEX IF NOT EXISTS idx_call_bookings_user_id ON call_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_call_bookings_performer_id ON call_bookings(performer_id);
CREATE INDEX IF NOT EXISTS idx_call_bookings_status ON call_bookings(status);
CREATE INDEX IF NOT EXISTS idx_call_bookings_payment_status ON call_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_call_bookings_scheduled_at ON call_bookings(scheduled_at);

-- =====================================================
-- 4. CALL AVAILABILITY SLOTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performer_id UUID NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  
  -- Time slot details
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  
  -- Status
  is_available BOOLEAN DEFAULT true,
  is_booked BOOLEAN DEFAULT false,
  booking_id UUID REFERENCES call_bookings(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(performer_id, date, start_time)
);

-- Indexes for call availability slots
CREATE INDEX IF NOT EXISTS idx_call_availability_slots_performer_id ON call_availability_slots(performer_id);
CREATE INDEX IF NOT EXISTS idx_call_availability_slots_date ON call_availability_slots(date);
CREATE INDEX IF NOT EXISTS idx_call_availability_slots_available ON call_availability_slots(is_available);
CREATE INDEX IF NOT EXISTS idx_call_availability_slots_booked ON call_availability_slots(is_booked);

-- =====================================================
-- 5. CALL MODERATION LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS call_moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES private_calls(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES call_bookings(id) ON DELETE SET NULL,
  
  -- Moderation details
  action_type VARCHAR(50) NOT NULL, -- 'reminder', 'warning', 'termination', 'refund', 'ban'
  action_reason TEXT,
  severity VARCHAR(50), -- 'low', 'medium', 'high'
  
  -- User information
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  performer_id UUID REFERENCES performers(id) ON DELETE SET NULL,
  moderator_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional data
  metadata JSONB,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT
);

-- Indexes for call moderation logs
CREATE INDEX IF NOT EXISTS idx_call_moderation_logs_call_id ON call_moderation_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_call_moderation_logs_booking_id ON call_moderation_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_call_moderation_logs_user_id ON call_moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_moderation_logs_action_type ON call_moderation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_call_moderation_logs_timestamp ON call_moderation_logs(action_timestamp);

-- =====================================================
-- 6. UPDATE TRIGGERS
-- =====================================================
-- Create or replace trigger function for performers
CREATE OR REPLACE FUNCTION update_performers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_performers_updated_at
BEFORE UPDATE ON performers
FOR EACH ROW
EXECUTE FUNCTION update_performers_updated_at();

-- Create or replace trigger function for call bookings
CREATE OR REPLACE FUNCTION update_call_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_call_bookings_updated_at
BEFORE UPDATE ON call_bookings
FOR EACH ROW
EXECUTE FUNCTION update_call_bookings_updated_at();

-- Create or replace trigger function for call availability slots
CREATE OR REPLACE FUNCTION update_call_availability_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_call_availability_slots_updated_at
BEFORE UPDATE ON call_availability_slots
FOR EACH ROW
EXECUTE FUNCTION update_call_availability_slots_updated_at();

-- =====================================================
-- 7. ADD PERFORMER FOREIGN KEY TO PRIVATE_CALLS
-- =====================================================
-- Add performer_id column if it doesn't exist
ALTER TABLE private_calls
ADD COLUMN IF NOT EXISTS performer_id UUID REFERENCES performers(id) ON DELETE SET NULL;

-- Update existing calls to reference performers if possible
-- This is a data migration step that would need to be run manually
-- UPDATE private_calls
-- SET performer_id = (
--   SELECT id FROM performers WHERE display_name = private_calls.performer LIMIT 1
-- )
-- WHERE performer IS NOT NULL;

-- =====================================================
-- 8. CREATE DEFAULT PERFORMERS
-- =====================================================
-- Insert default performers if they don't exist
INSERT INTO performers (display_name, bio, base_price, status, created_by, updated_by)
VALUES 
  ('Santino', 'Experienced performer with great personality', 100.00, 'active', 'system', 'system'),
  ('Lex Boy', 'Charismatic and engaging performer', 100.00, 'active', 'system', 'system')
ON CONFLICT (display_name) DO NOTHING;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Log migration completion
INSERT INTO migrations (name, applied_at, description)
VALUES ('036_add_performers_and_enhanced_calls', NOW(), 'Added performers table and enhanced private calls system')
ON CONFLICT (name) DO NOTHING;