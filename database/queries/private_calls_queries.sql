-- ================================================
-- 📞 PRIVATE CALLS SYSTEM - USEFUL QUERIES
-- ================================================

-- ================================================
-- 1. MODEL MANAGEMENT QUERIES
-- ================================================

-- Get all active models with status
SELECT
  m.*,
  ms.status,
  COUNT(DISTINCT p.id) as photo_count,
  ROUND(AVG(r.rating), 1) as avg_rating,
  COUNT(DISTINCT r.id) as review_count
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
LEFT JOIN model_photos p ON m.model_id = p.model_id AND p.is_active = true
LEFT JOIN model_reviews r ON m.model_id = r.model_id
WHERE m.is_active = true
GROUP BY m.id, ms.id
ORDER BY m.display_name;

-- Get models that are currently online
SELECT m.*, ms.status
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
WHERE m.is_active = true AND ms.status = 'online'
ORDER BY m.display_name;

-- Get models with status and next available slot
SELECT
  m.model_id,
  m.display_name,
  m.price_per_minute,
  ms.status,
  ma.day_of_week,
  ma.start_time,
  ma.end_time
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
LEFT JOIN model_availability ma ON m.model_id = ma.model_id
WHERE m.is_active = true
ORDER BY m.display_name, ma.day_of_week;

-- Get model details with earnings
SELECT
  m.*,
  ms.status,
  SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN me.model_earnings ELSE 0 END), 2) as total_earnings,
  ROUND(AVG(r.rating), 1) as avg_rating
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
LEFT JOIN model_bookings b ON m.model_id = b.model_id
LEFT JOIN model_earnings me ON b.id = me.booking_id
LEFT JOIN model_reviews r ON m.model_id = r.model_id
WHERE m.is_active = true
GROUP BY m.id, ms.id
ORDER BY m.display_name;

-- ================================================
-- 2. BOOKING MANAGEMENT QUERIES
-- ================================================

-- Get all bookings for a specific date
SELECT
  b.*,
  m.display_name,
  m.photo_url
FROM model_bookings b
JOIN models m ON b.model_id = m.model_id
WHERE b.scheduled_date = CURRENT_DATE
ORDER BY b.start_time;

-- Get upcoming bookings (next 7 days)
SELECT
  b.*,
  m.display_name,
  m.price_per_minute
FROM model_bookings b
JOIN models m ON b.model_id = m.model_id
WHERE b.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  AND b.status IN ('pending', 'confirmed', 'active')
ORDER BY b.scheduled_date, b.start_time;

-- Get all pending bookings (awaiting payment)
SELECT
  b.*,
  m.display_name,
  u.username
FROM model_bookings b
JOIN models m ON b.model_id = m.model_id
WHERE b.status = 'pending'
  AND b.created_at > NOW() - INTERVAL '30 minutes'  -- Within 30 min window
ORDER BY b.created_at DESC;

-- Get user bookings
SELECT
  b.*,
  m.display_name,
  m.photo_url,
  r.rating,
  r.review_text
FROM model_bookings b
JOIN models m ON b.model_id = m.model_id
LEFT JOIN model_reviews r ON b.id = r.booking_id
WHERE b.telegram_user_id = $1  -- Replace with user ID
ORDER BY b.scheduled_date DESC;

-- Get model bookings for a date range
SELECT
  b.*,
  u.username as customer_username
FROM model_bookings b
WHERE b.model_id = $1  -- Replace with model ID
  AND b.scheduled_date BETWEEN $2 AND $3  -- Replace with dates
  AND b.status NOT IN ('cancelled')
ORDER BY b.scheduled_date, b.start_time;

-- Get booked slots for a model on specific date
SELECT
  start_time,
  end_time,
  duration_minutes,
  status
FROM model_bookings
WHERE model_id = $1  -- Replace with model ID
  AND scheduled_date = $2  -- Replace with date
  AND status NOT IN ('cancelled')
ORDER BY start_time;

-- Find free slots for booking
-- (You would process this in application code)
SELECT
  time_slot,
  is_available
FROM (
  SELECT generate_series('09:00'::time, '22:00'::time, '15 minutes'::interval) as time_slot
) slots
LEFT JOIN model_bookings b ON
  b.model_id = $1
  AND b.scheduled_date = $2
  AND slots.time_slot >= b.start_time
  AND slots.time_slot < b.end_time
  AND b.status NOT IN ('cancelled')
WHERE b.id IS NULL
ORDER BY time_slot;

-- ================================================
-- 3. PAYMENT & EARNINGS QUERIES
-- ================================================

-- Get earnings for a model
SELECT
  m.display_name,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN b.total_price ELSE 0 END), 2) as total_revenue,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN me.model_earnings ELSE 0 END), 2) as model_earnings,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN (b.total_price * 0.3) ELSE 0 END), 2) as platform_commission
FROM models m
LEFT JOIN model_bookings b ON m.model_id = b.model_id
LEFT JOIN model_earnings me ON b.id = me.booking_id
WHERE m.model_id = $1  -- Replace with model ID
GROUP BY m.id;

-- Get platform revenue
SELECT
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN b.total_price ELSE 0 END), 2) as total_revenue,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN (b.total_price * 0.3) ELSE 0 END), 2) as platform_commission,
  ROUND(SUM(CASE WHEN b.status = 'completed' THEN me.model_earnings ELSE 0 END), 2) as models_earned
FROM model_bookings b
LEFT JOIN model_earnings me ON b.id = me.booking_id;

-- Get payments by method
SELECT
  b.payment_method,
  COUNT(b.id) as count,
  SUM(CASE WHEN b.status = 'completed' THEN b.total_price ELSE 0 END) as total_amount
FROM model_bookings b
WHERE b.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.payment_method
ORDER BY total_amount DESC;

-- Get pending payouts for models
SELECT
  m.display_name,
  SUM(me.model_earnings) as amount_due,
  COUNT(me.id) as booking_count
FROM models m
LEFT JOIN model_bookings b ON m.model_id = b.model_id
LEFT JOIN model_earnings me ON b.id = me.booking_id
WHERE me.payment_status = 'pending'
  AND b.status = 'completed'
GROUP BY m.id
HAVING SUM(me.model_earnings) > 0
ORDER BY amount_due DESC;

-- ================================================
-- 4. ANALYTICS & REPORTING
-- ================================================

-- Most popular models (by completed bookings)
SELECT
  m.display_name,
  m.price_per_minute,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
  ROUND(AVG(r.rating), 1) as avg_rating,
  ROUND(SUM(b.total_price), 2) as total_revenue
FROM models m
LEFT JOIN model_bookings b ON m.model_id = b.model_id
LEFT JOIN model_reviews r ON b.id = r.booking_id
WHERE m.is_active = true
GROUP BY m.id
ORDER BY completed_bookings DESC
LIMIT 10;

-- Most active users (by booking count)
SELECT
  b.username,
  COUNT(b.id) as booking_count,
  ROUND(SUM(b.total_price), 2) as total_spent,
  MAX(b.scheduled_date) as last_booking_date
FROM model_bookings b
WHERE b.status IN ('completed', 'active', 'confirmed')
GROUP BY b.telegram_user_id, b.username
ORDER BY booking_count DESC
LIMIT 10;

-- Booking trends (by day)
SELECT
  DATE(b.scheduled_date) as booking_date,
  COUNT(b.id) as bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled,
  ROUND(AVG(b.total_price), 2) as avg_booking_value
FROM model_bookings b
WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(b.scheduled_date)
ORDER BY booking_date DESC;

-- Peak booking times
SELECT
  EXTRACT(HOUR FROM b.start_time) as hour_of_day,
  COUNT(b.id) as bookings,
  ROUND(SUM(b.total_price), 2) as revenue
FROM model_bookings b
WHERE b.status = 'completed'
GROUP BY EXTRACT(HOUR FROM b.start_time)
ORDER BY bookings DESC;

-- ================================================
-- 5. ADMIN OPERATIONS
-- ================================================

-- Expire old pending bookings (auto-cancel after timeout)
UPDATE model_bookings
SET status = 'cancelled'
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';

-- Set models to offline who haven't been updated in 24 hours
UPDATE model_status
SET status = 'offline'
WHERE last_updated < NOW() - INTERVAL '24 hours'
  AND status != 'offline';

-- Auto-mark bookings as completed (if scheduled time + duration has passed)
UPDATE model_bookings
SET status = 'completed'
WHERE status = 'active'
  AND (scheduled_date::timestamp + start_time + (duration_minutes * INTERVAL '1 minute')) < NOW();

-- Clean up old reviews (older than 2 years)
DELETE FROM model_reviews
WHERE created_at < NOW() - INTERVAL '2 years';

-- Archive old bookings to separate table (if you have archival)
-- INSERT INTO model_bookings_archive
-- SELECT * FROM model_bookings
-- WHERE status = 'completed' AND scheduled_date < CURRENT_DATE - INTERVAL '1 year';

-- ================================================
-- 6. DEBUGGING & MONITORING
-- ================================================

-- Check status of all models right now
SELECT
  m.display_name,
  m.is_active,
  ms.status,
  (SELECT COUNT(*) FROM model_bookings b
   WHERE b.model_id = m.model_id
   AND b.scheduled_date = CURRENT_DATE
   AND b.status IN ('confirmed', 'active')) as todays_bookings
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
ORDER BY m.display_name;

-- Check for booking conflicts (overlapping bookings)
SELECT DISTINCT
  b1.model_id,
  b1.scheduled_date,
  b1.start_time,
  b1.end_time,
  b1.id as booking1_id,
  b2.id as booking2_id
FROM model_bookings b1
JOIN model_bookings b2 ON
  b1.model_id = b2.model_id
  AND b1.scheduled_date = b2.scheduled_date
  AND b1.start_time < b2.end_time
  AND b1.end_time > b2.start_time
  AND b1.id < b2.id
  AND b1.status NOT IN ('cancelled')
  AND b2.status NOT IN ('cancelled')
ORDER BY b1.model_id, b1.scheduled_date;

-- Find missing payment records
SELECT
  b.*
FROM model_bookings b
LEFT JOIN model_earnings me ON b.id = me.booking_id
WHERE b.status = 'completed'
  AND me.booking_id IS NULL
ORDER BY b.completed_at DESC;

-- Check for incomplete records
SELECT
  'Missing model_status' as issue,
  COUNT(*) as count
FROM models m
LEFT JOIN model_status ms ON m.model_id = ms.model_id
WHERE ms.model_id IS NULL
UNION ALL
SELECT
  'Missing photo_url',
  COUNT(*)
FROM models
WHERE photo_url IS NULL OR photo_url = ''
UNION ALL
SELECT
  'Missing bio',
  COUNT(*)
FROM models
WHERE bio IS NULL OR bio = '';

-- ================================================
-- 7. MIGRATION & MAINTENANCE
-- ================================================

-- Recalculate model earnings (if corrupted)
-- WARNING: Only run if earnings data is corrupted
-- DELETE FROM model_earnings;
-- INSERT INTO model_earnings (booking_id, amount, commission_percentage, model_earnings)
-- SELECT
--   b.id,
--   b.total_price,
--   30,
--   ROUND(b.total_price * 0.7, 2)
-- FROM model_bookings b
-- WHERE b.status = 'completed';

-- Validate database consistency
SELECT
  'Total bookings' as metric,
  COUNT(*) as count
FROM model_bookings
UNION ALL
SELECT 'Completed bookings', COUNT(*) FROM model_bookings WHERE status = 'completed'
UNION ALL
SELECT 'Pending bookings', COUNT(*) FROM model_bookings WHERE status = 'pending'
UNION ALL
SELECT 'Active models', COUNT(*) FROM models WHERE is_active = true
UNION ALL
SELECT 'Online models', COUNT(*) FROM model_status WHERE status = 'online'
UNION ALL
SELECT 'Total earnings records', COUNT(*) FROM model_earnings
UNION ALL
SELECT 'Total reviews', COUNT(*) FROM model_reviews;
