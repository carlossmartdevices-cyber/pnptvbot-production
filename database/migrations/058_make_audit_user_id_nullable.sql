-- Migration 058: Make payment_audit_log.user_id nullable
-- Purpose: Allow null user_id for edge cases (system-initiated payments, testing, etc)
-- Date: 2026-02-13

BEGIN;

-- Allow NULL in user_id of payment_audit_log
ALTER TABLE payment_audit_log
  ALTER COLUMN user_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN payment_audit_log.user_id IS
  'User ID - nullable for edge cases like system-initiated payments or payments without registered user';

-- Verify the change was successful
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns
-- WHERE table_name = 'payment_audit_log' AND column_name = 'user_id';

COMMIT;
