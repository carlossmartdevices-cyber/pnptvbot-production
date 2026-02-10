-- Migration 047: Comprehensive Availability System
-- Enhances the availability management with advanced features and integrates with booking system

-- =====================================================
-- 1. Add missing columns to pnp_models for availability settings
-- =====================================================
ALTER TABLE pnp_models
ADD COLUMN IF NOT EXISTS can_instant_book BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_offline_minutes INTEGER DEFAULT 240,
ADD COLUMN IF NOT EXISTS status_message VARCHAR(200),
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- =====================================================
-- 2. Add missing columns to pnp_availability for enhanced functionality
-- =====================================================
ALTER TABLE pnp_availability
ADD COLUMN IF NOT EXISTS hold_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS slot_type VARCHAR(20) DEFAULT 'manual' CHECK (slot_type IN ('manual', 'recurring', 'generated', 'merged'));

-- =====================================================
-- 3. Create user notifications table (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('availability', 'booking', 'message', 'promotion')),
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, model_id, notification_type)
);

-- =====================================================
-- 4. Create availability change log table
-- =====================================================
CREATE TABLE IF NOT EXISTS availability_change_log (
    id SERIAL PRIMARY KEY,
    availability_id INTEGER REFERENCES pnp_availability(id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
    changed_by VARCHAR(50),
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'booked', 'released', 'held', 'expired')),
    old_values JSONB,
    new_values JSONB,
    change_reason VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. Create booking hold tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_holds (
    id SERIAL PRIMARY KEY,
    availability_id INTEGER REFERENCES pnp_availability(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    hold_expires_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),
    converted_to_booking_id INTEGER REFERENCES pnp_bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. Create indexes for performance optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_availability_hold
ON pnp_availability(hold_expires_at) WHERE hold_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_availability_slot_type
ON pnp_availability(slot_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pnp_availability_model_booked
ON pnp_availability(model_id, is_booked) WHERE is_booked = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_model
ON user_notifications(model_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notifications_active
ON user_notifications(user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_holds_expires
ON booking_holds(hold_expires_at, status) WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_change_log_model
ON availability_change_log(model_id);

-- =====================================================
-- 7. Create functions for availability management
-- =====================================================

-- Function to auto-release expired holds
CREATE OR REPLACE FUNCTION release_expired_availability_holds()
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
    
    -- Also update booking holds table
    UPDATE booking_holds
    SET status = 'expired',
        updated_at = NOW()
    WHERE hold_expires_at < NOW()
    AND status = 'active';

    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old availability slots
CREATE OR REPLACE FUNCTION cleanup_old_availability()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM pnp_availability
    WHERE available_to < NOW() - INTERVAL '30 days'
    AND is_booked = FALSE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate availability from recurring schedules
CREATE OR REPLACE FUNCTION generate_availability_from_schedules(
    p_model_id INTEGER,
    p_start_date DATE,
    p_end_date DATE,
    p_overwrite_existing BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
    curr_date DATE := p_start_date;
    schedule_row RECORD;
    slot_start TIMESTAMP;
    slot_end TIMESTAMP;
    created_count INTEGER := 0;
    conflict_count INTEGER := 0;
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
                ELSIF p_overwrite_existing THEN
                    -- Update existing slot
                    UPDATE pnp_availability
                    SET available_from = slot_start,
                        available_to = slot_end,
                        slot_type = 'recurring',
                        updated_at = NOW()
                    WHERE model_id = p_model_id
                    AND available_from < slot_end
                    AND available_to > slot_start;
                    created_count := created_count + 1;
                ELSE
                    conflict_count := conflict_count + 1;
                END IF;
            END IF;
        END LOOP;
        curr_date := curr_date + 1;
    END LOOP;

    RAISE NOTICE 'Generated % availability slots (skipped % conflicts)', created_count, conflict_count;
    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check availability conflicts
CREATE OR REPLACE FUNCTION check_availability_conflicts(
    p_model_id INTEGER,
    p_start_time TIMESTAMP,
    p_end_time TIMESTAMP,
    p_exclude_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    available_from TIMESTAMP,
    available_to TIMESTAMP,
    is_booked BOOLEAN,
    conflict_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id,
        available_from,
        available_to,
        is_booked,
        CASE
            WHEN available_from < p_end_time AND available_to > p_start_time THEN 'overlap'
            WHEN available_from < p_end_time AND available_to > p_start_time THEN 'overlap'
            WHEN available_from >= p_start_time AND available_to <= p_end_time THEN 'contained'
            ELSE 'adjacent'
        END as conflict_type
    FROM pnp_availability
    WHERE model_id = p_model_id
    AND id != COALESCE(p_exclude_id, id)
    AND ((available_from < p_end_time AND available_to > p_start_time)
         OR (available_from < p_end_time AND available_to > p_start_time)
         OR (available_from >= p_start_time AND available_to <= p_end_time));
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Create triggers for automatic logging
-- =====================================================

-- Trigger function for availability change logging
CREATE OR REPLACE FUNCTION log_availability_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_type VARCHAR(20);
    old_values JSONB;
    new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        change_type := 'created';
        new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        change_type := 'updated';
        old_values := to_jsonb(OLD);
        new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        change_type := 'deleted';
        old_values := to_jsonb(OLD);
    END IF;

    INSERT INTO availability_change_log (
        availability_id,
        model_id,
        changed_by,
        change_type,
        old_values,
        new_values,
        created_at
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.model_id, OLD.model_id),
        current_setting('jitsi.app_user'),
        change_type,
        old_values,
        new_values,
        NOW()
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for availability change logging
DROP TRIGGER IF EXISTS trigger_log_availability_changes ON pnp_availability;
CREATE TRIGGER trigger_log_availability_changes
AFTER INSERT OR UPDATE OR DELETE ON pnp_availability
FOR EACH ROW
EXECUTE FUNCTION log_availability_changes();

-- =====================================================
-- 9. Create views for common queries
-- =====================================================

-- View for available slots (not booked, not held)
CREATE OR REPLACE VIEW available_slots_view AS
SELECT 
    a.id,
    a.model_id,
    a.available_from,
    a.available_to,
    a.slot_type,
    m.name as model_name,
    m.is_online,
    m.can_instant_book,
    EXTRACT(EPOCH FROM (a.available_to - a.available_from)) / 60 as duration_minutes,
    CASE 
        WHEN a.hold_user_id IS NOT NULL THEN 'held'
        WHEN a.is_booked THEN 'booked'
        ELSE 'available'
    END as status
FROM pnp_availability a
JOIN pnp_models m ON a.model_id = m.id
WHERE a.available_to > NOW()
AND (a.is_booked = FALSE OR a.hold_user_id IS NOT NULL)
ORDER BY a.available_from;

-- View for model availability calendar
CREATE OR REPLACE VIEW model_availability_calendar AS
SELECT 
    m.id as model_id,
    m.name as model_name,
    a.available_from as slot_start,
    a.available_to as slot_end,
    a.slot_type,
    a.is_booked,
    a.hold_user_id,
    b.id as booking_id,
    b.status as booking_status,
    b.user_id as booked_by_user
FROM pnp_models m
LEFT JOIN pnp_availability a ON m.id = a.model_id AND a.available_to > NOW()
LEFT JOIN pnp_bookings b ON a.booking_id = b.id
WHERE m.is_active = TRUE
ORDER BY m.id, a.available_from;

-- =====================================================
-- 10. Add constraints and data integrity checks
-- =====================================================

-- Ensure availability slots don't overlap for the same model
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'valid_availability_duration'
        AND table_name = 'pnp_availability'
    ) THEN
        ALTER TABLE pnp_availability ADD CONSTRAINT valid_availability_duration CHECK (available_from < available_to);
    END IF;
END
$$;

-- Ensure hold expiration is in the future if hold_user_id is set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'valid_hold_expiration'
        AND table_name = 'pnp_availability'
    ) THEN
        ALTER TABLE pnp_availability ADD CONSTRAINT valid_hold_expiration CHECK (
            (hold_user_id IS NULL AND hold_expires_at IS NULL) OR
            (hold_user_id IS NOT NULL AND hold_expires_at > NOW())
        );
    END IF;
END
$$;

-- =====================================================
-- 11. Analyze tables for query optimization
-- =====================================================
ANALYZE pnp_models;
ANALYZE pnp_availability;
ANALYZE pnp_model_schedules;
ANALYZE pnp_model_blocked_dates;
ANALYZE user_notifications;
ANALYZE booking_holds;
ANALYZE availability_change_log;

-- ANALYZE available_slots_view;
-- ANALYZE model_availability_calendar;

-- =====================================================
-- 12. Comments for documentation
-- =====================================================
COMMENT ON TABLE pnp_model_schedules IS 'Stores recurring availability schedules for models';
COMMENT ON TABLE pnp_model_blocked_dates IS 'Stores dates when models are not available';
COMMENT ON TABLE user_notifications IS 'Manages user notification preferences for availability changes';
COMMENT ON TABLE availability_change_log IS 'Tracks all changes to availability slots for auditing';
COMMENT ON TABLE booking_holds IS 'Tracks temporary holds on availability slots during booking process';
-- COMMENT ON TABLE available_slots_view IS 'View showing currently available booking slots';
-- COMMENT ON TABLE model_availability_calendar IS 'Comprehensive view of model availability and bookings';

-- =================================0====================
-- 13. Add missing tables if they don't exist
-- =====================================================
DO $$
BEGIN
    -- Create pnp_model_schedules if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'pnp_model_schedules'
    ) THEN
        CREATE TABLE pnp_model_schedules (
            id SERIAL PRIMARY KEY,
            model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
            day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(model_id, day_of_week, start_time)
        );
    END IF;
    
    -- Create pnp_model_blocked_dates if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'pnp_model_blocked_dates'
    ) THEN
        CREATE TABLE pnp_model_blocked_dates (
            id SERIAL PRIMARY KEY,
            model_id INTEGER REFERENCES pnp_models(id) ON DELETE CASCADE,
            blocked_date DATE NOT NULL,
            reason VARCHAR(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(model_id, blocked_date)
        );
    END IF;
END $$;