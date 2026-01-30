-- Migration 044: Add notification sent flags to pnp_bookings
-- Adds support for tracking sent notifications to prevent duplicates

-- ============================================================
-- 1. Add notification sent flags to pnp_bookings
-- ============================================================
ALTER TABLE pnp_bookings
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_5m_sent BOOLEAN DEFAULT FALSE;
