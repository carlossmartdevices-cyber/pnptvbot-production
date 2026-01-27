-- Migration 045: PNP Live Availability & Booking Improvements
-- Enhances model online status, availability management, and booking flow

-- =====================================================
-- 1. Add activity tracking to models for auto-offline
-- =====================================================
ALTER TABLE pnp_models
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS auto_offline_minutes INTEGER DEFAULT 240,
ADD COLUMN IF NOT EXISTS status_message VARCHAR(200),
ADD COLUMN IF NOT EXISTS can_instant_book BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 2. Add slot hold/reservation support to availability
-- =====================================================
ALTER TABLE pnp_availability
ADD COLUMN IF NOT EXISTS hold_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS slot_type VARCHAR(20) DEFAULT 'manual' CHECK (slot_type IN ('manual', 'recurring', 'generated'));

-- =====================================================
-- 3. Add payment timeout tracking to bookings
-- =====================================================
ALTER TABLE pnp_bookings
ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) DEFAULT 'telegram';

-- =====================================================
-- 4. Create model schedule templates table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_model_schedules (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(model_id, day_of_week, start_time)
);

-- =====================================================
-- 5. Create model blocked dates table
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_model_blocked_dates (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    blocked_date DATE NOT NULL,
    reason VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(model_id, blocked_date)
);

-- =====================================================
-- 6. Create model status history for analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS pnp_model_status_history (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')),
    changed_at TIMESTAMP DEFAULT NOW(),
    changed_by VARCHAR(50),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'system', 'booking'))
);

-- =====================================================
-- 7. Indexes for new columns
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_models_last_activity
ON pnp_models(last_activity_at)
WHERE is_online = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_availability_hold
ON pnp_availability(hold_expires_at)
WHERE hold_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_bookings_payment_expires
ON pnp_bookings(payment_expires_at)
WHERE payment_status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_model_schedules_lookup
ON pnp_model_schedules(model_id, day_of_week, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_blocked_dates_lookup
ON pnp_model_blocked_dates(model_id, blocked_date);

-- =====================================================
-- 8. Function to auto-release expired holds
-- =====================================================
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    UPDATE pnp_availability
    SET hold_user_id = NULL,
        hold_expires_at = NULL,
        updated_at = NOW()
    WHERE hold_expires_at < NOW()
    AND hold_user_id IS NOT NULL;

    GET DIAGNOSTICS released_count = ROW_COUNT;
    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. Function to auto-offline inactive models
-- =====================================================
CREATE OR REPLACE FUNCTION auto_offline_inactive_models()
RETURNS INTEGER AS $$
DECLARE
    offline_count INTEGER;
BEGIN
    UPDATE pnp_models
    SET is_online = FALSE,
        updated_at = NOW()
    WHERE is_online = TRUE
    AND last_activity_at < NOW() - (auto_offline_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS offline_count = ROW_COUNT;
    RETURN offline_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. Function to generate recurring availability
-- =====================================================
CREATE OR REPLACE FUNCTION generate_recurring_availability(
    p_model_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    curr_date DATE := p_start_date;
    schedule_row RECORD;
    slot_start TIMESTAMP;
    slot_end TIMESTAMP;
    created_count INTEGER := 0;
BEGIN
    WHILE curr_date <= p_end_date LOOP
        FOR schedule_row IN
            SELECT * FROM pnp_model_schedules
            WHERE model_id = p_model_id
            AND day_of_week = EXTRACT(DOW FROM curr_date)
            AND is_active = TRUE
        LOOP
            -- Check if date is blocked
            IF NOT EXISTS (
                SELECT 1 FROM pnp_model_blocked_dates
                WHERE model_id = p_model_id AND blocked_date = curr_date
            ) THEN
                slot_start := curr_date + schedule_row.start_time;
                slot_end := curr_date + schedule_row.end_time;

                -- Check for conflicts
                IF NOT EXISTS (
                    SELECT 1 FROM pnp_availability
                    WHERE model_id = p_model_id
                    AND available_from < slot_end
                    AND available_to > slot_start
                ) THEN
                    INSERT INTO pnp_availability (model_id, available_from, available_to, slot_type)
                    VALUES (p_model_id, slot_start, slot_end, 'recurring');
                    created_count := created_count + 1;
                END IF;
            END IF;
        END LOOP;
        curr_date := curr_date + 1;
    END LOOP;

    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. Update last_activity trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pnp_models
    SET last_activity_at = NOW()
    WHERE id = NEW.model_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_updates_activity ON pnp_bookings;
CREATE TRIGGER trigger_booking_updates_activity
AFTER INSERT OR UPDATE ON pnp_bookings
FOR EACH ROW
EXECUTE FUNCTION update_model_activity();

-- =====================================================
-- 12. Analyze tables
-- =====================================================
ANALYZE pnp_models;
ANALYZE pnp_availability;
ANALYZE pnp_bookings;
