-- Migration 044: PNP Live Performance Optimization Indexes
-- Adds indexes to improve query performance for common operations

-- =====================================================
-- 1. Transaction ID index for idempotency checks
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_transaction_id
ON pnp_bookings(transaction_id)
WHERE transaction_id IS NOT NULL;

-- =====================================================
-- 2. Composite index for worker auto-complete queries
-- Optimizes: WHERE status = 'confirmed' AND payment_status = 'paid' AND booking_time < X
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_worker_autocomplete
ON pnp_bookings(status, payment_status, booking_time)
WHERE status = 'confirmed' AND payment_status = 'paid';

-- =====================================================
-- 3. Composite index for user bookings with time ordering
-- Optimizes: WHERE user_id = X ORDER BY booking_time DESC
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_user_time
ON pnp_bookings(user_id, booking_time DESC);

-- =====================================================
-- 4. Index for model bookings with status filter
-- Optimizes: WHERE model_id = X AND status != 'cancelled' ORDER BY booking_time
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_model_status_time
ON pnp_bookings(model_id, status, booking_time);

-- =====================================================
-- 6. Add rating and notification tracking columns to pnp_bookings
-- (Used for quick feedback check and duplicate notification prevention)
-- =====================================================
ALTER TABLE pnp_bookings
ADD COLUMN IF NOT EXISTS rating INTEGER,
ADD COLUMN IF NOT EXISTS feedback_text TEXT,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_5m_sent BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 5. Index for feedback requests worker query
-- Optimizes: WHERE status = 'completed' AND rating IS NULL AND show_ended_at BETWEEN X AND Y
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_feedback_pending
ON pnp_bookings(status, show_ended_at)
WHERE status = 'completed' AND rating IS NULL;

-- =====================================================
-- 7. Composite index for promo usage unique check
-- Optimizes atomic promo code validation
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_promo_usage_unique_check
ON pnp_live_promo_usage(promo_id, user_id);

-- =====================================================
-- 8. Index for model online status updates
-- Optimizes: WHERE is_online = TRUE AND last_online < X
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_models_online_status
ON pnp_models(is_online, last_online)
WHERE is_online = TRUE;

-- =====================================================
-- 9. Index for active models with ratings
-- Optimizes: WHERE is_active = TRUE ORDER BY is_online DESC, avg_rating DESC
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_models_active_sorted
ON pnp_models(is_active, is_online DESC, avg_rating DESC, total_shows DESC)
WHERE is_active = TRUE;

-- =====================================================
-- 10. Partial index for pending refunds
-- Optimizes admin refund processing queries
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_refunds_pending
ON pnp_refunds(status, created_at)
WHERE status = 'pending';

-- =====================================================
-- ANALYZE tables to update statistics
-- =====================================================
ANALYZE pnp_bookings;
ANALYZE pnp_models;
ANALYZE pnp_live_promo_codes;
ANALYZE pnp_live_promo_usage;
ANALYZE pnp_refunds;
ANALYZE pnp_feedback;
