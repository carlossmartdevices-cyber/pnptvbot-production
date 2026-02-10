--
-- PostgreSQL database dump
--

\restrict GMMLOc5jCoAHriXJPUnvShgA6coTUBLMSIqzjfmhHlqK3qB4u4OayU0J1BEp5l8

-- Dumped from database version 17.7 (Ubuntu 17.7-0ubuntu0.25.10.1)
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.10.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: jitsi_room_status; Type: TYPE; Schema: public; Owner: pnptvbot
--

CREATE TYPE public.jitsi_room_status AS ENUM (
    'active',
    'scheduled',
    'ended',
    'cancelled'
);


ALTER TYPE public.jitsi_room_status OWNER TO pnptvbot;

--
-- Name: jitsi_room_tier; Type: TYPE; Schema: public; Owner: pnptvbot
--

CREATE TYPE public.jitsi_room_tier AS ENUM (
    'mini',
    'medium',
    'unlimited'
);


ALTER TYPE public.jitsi_room_tier OWNER TO pnptvbot;

--
-- Name: auto_offline_inactive_models(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.auto_offline_inactive_models() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.auto_offline_inactive_models() OWNER TO pnptvbot;

--
-- Name: check_availability_conflicts(integer, timestamp without time zone, timestamp without time zone, integer); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.check_availability_conflicts(p_model_id integer, p_start_time timestamp without time zone, p_end_time timestamp without time zone, p_exclude_id integer DEFAULT NULL::integer) RETURNS TABLE(id integer, available_from timestamp without time zone, available_to timestamp without time zone, is_booked boolean, conflict_type character varying)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.check_availability_conflicts(p_model_id integer, p_start_time timestamp without time zone, p_end_time timestamp without time zone, p_exclude_id integer) OWNER TO pnptvbot;

--
-- Name: cleanup_old_availability(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.cleanup_old_availability() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM pnp_availability
    WHERE available_to < NOW() - INTERVAL '30 days'
    AND is_booked = FALSE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_availability() OWNER TO pnptvbot;

--
-- Name: expire_held_bookings(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.expire_held_bookings() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.expire_held_bookings() OWNER TO pnptvbot;

--
-- Name: generate_availability_from_schedules(integer, date, date, boolean); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.generate_availability_from_schedules(p_model_id integer, p_start_date date, p_end_date date, p_overwrite_existing boolean DEFAULT false) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.generate_availability_from_schedules(p_model_id integer, p_start_date date, p_end_date date, p_overwrite_existing boolean) OWNER TO pnptvbot;

--
-- Name: generate_recurring_availability(integer, date, date); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.generate_recurring_availability(p_model_id integer, p_start_date date, p_end_date date) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.generate_recurring_availability(p_model_id integer, p_start_date date, p_end_date date) OWNER TO pnptvbot;

--
-- Name: get_place_average_rating(integer); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.get_place_average_rating(p_place_id integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    avg_rating DECIMAL(3,2);
BEGIN
    SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
    INTO avg_rating
    FROM nearby_place_reviews
    WHERE place_id = p_place_id AND status = 'approved';

    RETURN avg_rating;
END;
$$;


ALTER FUNCTION public.get_place_average_rating(p_place_id integer) OWNER TO pnptvbot;

--
-- Name: hold_booking_slot(uuid, integer); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.hold_booking_slot(p_booking_id uuid, p_hold_minutes integer DEFAULT 10) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.hold_booking_slot(p_booking_id uuid, p_hold_minutes integer) OWNER TO pnptvbot;

--
-- Name: is_slot_available(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.is_slot_available(p_performer_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.is_slot_available(p_performer_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone) OWNER TO pnptvbot;

--
-- Name: log_availability_changes(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.log_availability_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.log_availability_changes() OWNER TO pnptvbot;

--
-- Name: release_expired_availability_holds(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.release_expired_availability_holds() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.release_expired_availability_holds() OWNER TO pnptvbot;

--
-- Name: release_expired_holds(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.release_expired_holds() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.release_expired_holds() OWNER TO pnptvbot;

--
-- Name: update_booking_payments_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_booking_payments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_booking_payments_updated_at() OWNER TO pnptvbot;

--
-- Name: update_booking_timestamp(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_booking_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_booking_timestamp() OWNER TO pnptvbot;

--
-- Name: update_bookings_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_bookings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_bookings_updated_at() OWNER TO pnptvbot;

--
-- Name: update_call_availability_slots_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_call_availability_slots_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_call_availability_slots_updated_at() OWNER TO pnptvbot;

--
-- Name: update_call_bookings_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_call_bookings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_call_bookings_updated_at() OWNER TO pnptvbot;

--
-- Name: update_daily_moderation_stats(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_daily_moderation_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    -- Update or insert daily stats
    INSERT INTO stream_moderation_stats 
        (stream_id, date, total_violations, high_severity_violations, 
         medium_severity_violations, low_severity_violations, 
         warnings_issued, mutes_issued, bans_issued, messages_deleted, 
         unique_violators)
    VALUES 
        (NEW.stream_id, today, 
         1, 
         CASE WHEN NEW.severity = 'HIGH' THEN 1 ELSE 0 END,
         CASE WHEN NEW.severity = 'MEDIUM' THEN 1 ELSE 0 END,
         CASE WHEN NEW.severity = 'LOW' THEN 1 ELSE 0 END,
         CASE WHEN NEW.action_taken = 'WARN' THEN 1 ELSE 0 END,
         CASE WHEN NEW.action_taken = 'MUTE' THEN 1 ELSE 0 END,
         CASE WHEN NEW.action_taken = 'BAN' THEN 1 ELSE 0 END,
         CASE WHEN NEW.action_taken = 'DELETE' THEN 1 ELSE 0 END,
         1)
    ON CONFLICT (stream_id, date)
    DO UPDATE SET
        total_violations = stream_moderation_stats.total_violations + 1,
        high_severity_violations = 
            stream_moderation_stats.high_severity_violations + 
            CASE WHEN NEW.severity = 'HIGH' THEN 1 ELSE 0 END,
        medium_severity_violations = 
            stream_moderation_stats.medium_severity_violations + 
            CASE WHEN NEW.severity = 'MEDIUM' THEN 1 ELSE 0 END,
        low_severity_violations = 
            stream_moderation_stats.low_severity_violations + 
            CASE WHEN NEW.severity = 'LOW' THEN 1 ELSE 0 END,
        warnings_issued = 
            stream_moderation_stats.warnings_issued + 
            CASE WHEN NEW.action_taken = 'WARN' THEN 1 ELSE 0 END,
        mutes_issued = 
            stream_moderation_stats.mutes_issued + 
            CASE WHEN NEW.action_taken = 'MUTE' THEN 1 ELSE 0 END,
        bans_issued = 
            stream_moderation_stats.bans_issued + 
            CASE WHEN NEW.action_taken = 'BAN' THEN 1 ELSE 0 END,
        messages_deleted = 
            stream_moderation_stats.messages_deleted + 
            CASE WHEN NEW.action_taken = 'DELETE' THEN 1 ELSE 0 END,
        unique_violators = 
            CASE 
                WHEN stream_moderation_stats.unique_violators @> ARRAY[NEW.user_id] 
                THEN stream_moderation_stats.unique_violators
                ELSE array_append(stream_moderation_stats.unique_violators, NEW.user_id)
            END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_daily_moderation_stats() OWNER TO pnptvbot;

--
-- Name: update_jitsi_room_timestamp(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_jitsi_room_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_jitsi_room_timestamp() OWNER TO pnptvbot;

--
-- Name: update_live_streams_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_live_streams_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_live_streams_updated_at() OWNER TO pnptvbot;

--
-- Name: update_model_activity(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_model_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE pnp_models
    SET last_activity_at = NOW()
    WHERE id = NEW.model_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_model_activity() OWNER TO pnptvbot;

--
-- Name: update_model_earnings_on_tip(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_model_earnings_on_tip() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        UPDATE pnp_models
        SET total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.model_earnings, 0),
            updated_at = NOW()
        WHERE id = NEW.model_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_model_earnings_on_tip() OWNER TO pnptvbot;

--
-- Name: update_model_online_status(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_model_online_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.is_online = TRUE THEN
        NEW.last_online = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_model_online_status() OWNER TO pnptvbot;

--
-- Name: update_model_rating_on_feedback(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_model_rating_on_feedback() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_model_id INTEGER;
BEGIN
    -- Get the model_id from the booking
    SELECT model_id INTO v_model_id
    FROM pnp_bookings
    WHERE id = NEW.booking_id;

    IF v_model_id IS NOT NULL THEN
        UPDATE pnp_models
        SET avg_rating = (
            SELECT COALESCE(AVG(f.rating)::DECIMAL(3,2), 0)
            FROM pnp_feedback f
            JOIN pnp_bookings b ON f.booking_id = b.id
            WHERE b.model_id = v_model_id AND f.rating IS NOT NULL
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM pnp_feedback f
            JOIN pnp_bookings b ON f.booking_id = b.id
            WHERE b.model_id = v_model_id AND f.rating IS NOT NULL
        ),
        updated_at = NOW()
        WHERE id = v_model_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_model_rating_on_feedback() OWNER TO pnptvbot;

--
-- Name: update_model_stats_on_booking(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_model_stats_on_booking() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE pnp_models
        SET total_shows = COALESCE(total_shows, 0) + 1,
            total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.model_earnings, 0),
            updated_at = NOW()
        WHERE id = NEW.model_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_model_stats_on_booking() OWNER TO pnptvbot;

--
-- Name: update_nearby_places_timestamp(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_nearby_places_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_nearby_places_timestamp() OWNER TO pnptvbot;

--
-- Name: update_performers_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_performers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_performers_updated_at() OWNER TO pnptvbot;

--
-- Name: update_promo_usage_count(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_promo_usage_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE pnp_live_promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = NEW.promo_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_promo_usage_count() OWNER TO pnptvbot;

--
-- Name: update_promos_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_promos_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_promos_updated_at() OWNER TO pnptvbot;

--
-- Name: update_radio_now_playing_fixed_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_radio_now_playing_fixed_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_radio_now_playing_fixed_updated_at() OWNER TO pnptvbot;

--
-- Name: update_radio_now_playing_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_radio_now_playing_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_radio_now_playing_updated_at() OWNER TO pnptvbot;

--
-- Name: update_radio_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_radio_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_radio_updated_at() OWNER TO pnptvbot;

--
-- Name: update_stream_violations_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_stream_violations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_stream_violations_updated_at() OWNER TO pnptvbot;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO pnptvbot;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activation_codes; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.activation_codes (
    code character varying(50) NOT NULL,
    product character varying(100) DEFAULT 'lifetime-pass'::character varying,
    used boolean DEFAULT false,
    used_at timestamp without time zone,
    used_by character varying(255),
    used_by_username character varying(255),
    email character varying(255),
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.activation_codes OWNER TO pnptvbot;

--
-- Name: activation_logs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.activation_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    username character varying(255),
    code character varying(50) NOT NULL,
    product character varying(100),
    activated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    success boolean DEFAULT true
);


ALTER TABLE public.activation_logs OWNER TO pnptvbot;

--
-- Name: jitsi_rooms; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.jitsi_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_code character varying(20) NOT NULL,
    room_name character varying(255) NOT NULL,
    host_user_id character varying(100) NOT NULL,
    host_name character varying(255),
    host_telegram_id bigint,
    tier public.jitsi_room_tier DEFAULT 'mini'::public.jitsi_room_tier NOT NULL,
    max_participants integer DEFAULT 10 NOT NULL,
    title character varying(255),
    description text,
    jitsi_domain character varying(255) DEFAULT 'meet.jit.si'::character varying,
    jwt_token text,
    moderator_password character varying(100),
    scheduled_start_time timestamp with time zone,
    scheduled_duration integer DEFAULT 60,
    actual_start_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    settings jsonb DEFAULT '{"enable_chat": true, "enable_lobby": true, "enable_recording": false, "enable_prejoin_page": true, "enable_screen_share": true, "require_display_name": true, "start_with_audio_muted": true, "start_with_video_muted": false}'::jsonb,
    is_public boolean DEFAULT true,
    requires_password boolean DEFAULT false,
    room_password character varying(100),
    allowed_user_ids text[],
    telegram_group_id character varying(100),
    shared_in_groups text[],
    status public.jitsi_room_status DEFAULT 'active'::public.jitsi_room_status,
    is_active boolean DEFAULT true,
    current_participants integer DEFAULT 0,
    total_participants integer DEFAULT 0,
    peak_participants integer DEFAULT 0,
    total_duration integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


ALTER TABLE public.jitsi_rooms OWNER TO pnptvbot;

--
-- Name: active_jitsi_rooms; Type: VIEW; Schema: public; Owner: pnptvbot
--

CREATE VIEW public.active_jitsi_rooms AS
 SELECT id,
    room_code,
    room_name,
    host_user_id,
    host_name,
    host_telegram_id,
    tier,
    max_participants,
    title,
    description,
    jitsi_domain,
    jwt_token,
    moderator_password,
    scheduled_start_time,
    scheduled_duration,
    actual_start_time,
    actual_end_time,
    settings,
    is_public,
    requires_password,
    room_password,
    allowed_user_ids,
    telegram_group_id,
    shared_in_groups,
    status,
    is_active,
    current_participants,
    total_participants,
    peak_participants,
    total_duration,
    created_at,
    updated_at,
    deleted_at
   FROM public.jitsi_rooms
  WHERE ((status = 'active'::public.jitsi_room_status) AND (deleted_at IS NULL) AND (is_active = true));


ALTER VIEW public.active_jitsi_rooms OWNER TO pnptvbot;

--
-- Name: age_verification_attempts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.age_verification_attempts (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    photo_file_id character varying(255) NOT NULL,
    estimated_age integer,
    confidence numeric(5,4),
    verified boolean DEFAULT false,
    provider character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.age_verification_attempts OWNER TO pnptvbot;

--
-- Name: TABLE age_verification_attempts; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.age_verification_attempts IS 'Stores all age verification attempts using AI/photo analysis';


--
-- Name: COLUMN age_verification_attempts.user_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.user_id IS 'Telegram user ID';


--
-- Name: COLUMN age_verification_attempts.photo_file_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.photo_file_id IS 'Telegram file ID of the verification photo';


--
-- Name: COLUMN age_verification_attempts.estimated_age; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.estimated_age IS 'Age estimated by AI in years';


--
-- Name: COLUMN age_verification_attempts.confidence; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.confidence IS 'Confidence score of the AI prediction (0-1)';


--
-- Name: COLUMN age_verification_attempts.verified; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.verified IS 'Whether the user passed age verification (age >= minimum)';


--
-- Name: COLUMN age_verification_attempts.provider; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.provider IS 'AI provider used: azure, facepp, etc.';


--
-- Name: COLUMN age_verification_attempts.created_at; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.age_verification_attempts.created_at IS 'Timestamp of verification attempt';


--
-- Name: age_verification_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.age_verification_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.age_verification_attempts_id_seq OWNER TO pnptvbot;

--
-- Name: age_verification_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.age_verification_attempts_id_seq OWNED BY public.age_verification_attempts.id;


--
-- Name: banned_users; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.banned_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    reason text,
    banned_by character varying(255) NOT NULL,
    banned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    active boolean DEFAULT true
);


ALTER TABLE public.banned_users OWNER TO pnptvbot;

--
-- Name: booking_audit_logs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.booking_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actor_type character varying(50) NOT NULL,
    actor_id character varying(255),
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(255),
    old_values jsonb,
    new_values jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_audit_logs_actor_type_check CHECK (((actor_type)::text = ANY ((ARRAY['user'::character varying, 'performer'::character varying, 'admin'::character varying, 'system'::character varying])::text[])))
);


ALTER TABLE public.booking_audit_logs OWNER TO pnptvbot;

--
-- Name: booking_notifications; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.booking_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    booking_id uuid,
    type character varying(50) NOT NULL,
    recipient_type character varying(50) DEFAULT 'user'::character varying,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    payload jsonb DEFAULT '{}'::jsonb,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_notifications_recipient_type_check CHECK (((recipient_type)::text = ANY ((ARRAY['user'::character varying, 'performer'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT booking_notifications_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT booking_notifications_type_check CHECK (((type)::text = ANY ((ARRAY['reminder_60'::character varying, 'reminder_15'::character varying, 'reminder_5'::character varying, 'booking_confirmed'::character varying, 'payment_received'::character varying, 'call_starting'::character varying, 'followup'::character varying, 'feedback_request'::character varying, 'admin_alert'::character varying])::text[])))
);


ALTER TABLE public.booking_notifications OWNER TO pnptvbot;

--
-- Name: booking_payments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.booking_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    provider_payment_id character varying(255),
    payment_link text,
    amount_cents integer NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'created'::character varying,
    expires_at timestamp with time zone,
    paid_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_payments_provider_check CHECK (((provider)::text = ANY ((ARRAY['meru'::character varying, 'stripe'::character varying, 'wompi'::character varying, 'paypal'::character varying, 'epayco'::character varying, 'daimo'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT booking_payments_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'expired'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.booking_payments OWNER TO pnptvbot;

--
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.booking_slots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    performer_id uuid NOT NULL,
    start_time_utc timestamp with time zone NOT NULL,
    end_time_utc timestamp with time zone NOT NULL,
    status character varying(50) DEFAULT 'available'::character varying,
    held_by_user_id character varying(255),
    hold_expires_at timestamp with time zone,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_slots_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'held'::character varying, 'booked'::character varying, 'blocked'::character varying])::text[])))
);


ALTER TABLE public.booking_slots OWNER TO pnptvbot;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    performer_id uuid NOT NULL,
    slot_id uuid,
    call_type character varying(50) NOT NULL,
    duration_minutes integer NOT NULL,
    price_cents integer NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    start_time_utc timestamp with time zone NOT NULL,
    end_time_utc timestamp with time zone NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    hold_expires_at timestamp with time zone,
    cancel_reason text,
    cancelled_by character varying(50),
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    rules_accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bookings_call_type_check CHECK (((call_type)::text = ANY ((ARRAY['video'::character varying, 'audio'::character varying])::text[]))),
    CONSTRAINT bookings_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'held'::character varying, 'awaiting_payment'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'no_show'::character varying, 'completed'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.bookings OWNER TO pnptvbot;

--
-- Name: bot_addition_attempts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.bot_addition_attempts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    bot_username character varying(255) NOT NULL,
    bot_id character varying(255),
    status character varying(50) DEFAULT 'blocked'::character varying,
    reason text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bot_addition_attempts OWNER TO pnptvbot;

--
-- Name: broadcast_button_presets; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_button_presets (
    preset_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(10),
    buttons jsonb NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcast_button_presets OWNER TO pnptvbot;

--
-- Name: broadcast_button_presets_preset_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_button_presets_preset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_button_presets_preset_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_button_presets_preset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_button_presets_preset_id_seq OWNED BY public.broadcast_button_presets.preset_id;


--
-- Name: broadcast_media; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_media (
    id integer NOT NULL,
    media_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    broadcast_id uuid,
    original_filename character varying(500),
    media_type character varying(50) NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    s3_bucket character varying(255) NOT NULL,
    s3_key text NOT NULL,
    s3_url text NOT NULL,
    s3_region character varying(50) DEFAULT 'us-east-1'::character varying,
    telegram_file_id character varying(500),
    processing_status character varying(50) DEFAULT 'uploaded'::character varying,
    cdn_url text,
    thumbnail_url text,
    duration integer,
    width integer,
    height integer,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    archived_at timestamp without time zone
);


ALTER TABLE public.broadcast_media OWNER TO pnptvbot;

--
-- Name: broadcast_media_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_media_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_media_id_seq OWNED BY public.broadcast_media.id;


--
-- Name: broadcast_queue_jobs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_queue_jobs (
    id integer NOT NULL,
    job_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    queue_name character varying(50) NOT NULL,
    job_type character varying(50) NOT NULL,
    job_data jsonb NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    error_message text,
    result jsonb,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    next_retry_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcast_queue_jobs OWNER TO pnptvbot;

--
-- Name: broadcast_queue_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_queue_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_queue_jobs_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_queue_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_queue_jobs_id_seq OWNED BY public.broadcast_queue_jobs.id;


--
-- Name: broadcast_recipients; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_recipients (
    id integer NOT NULL,
    broadcast_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    message_id character varying(500),
    sent_at timestamp without time zone,
    error_code character varying(100),
    error_message text,
    language character varying(10) DEFAULT 'en'::character varying,
    subscription_tier character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcast_recipients OWNER TO pnptvbot;

--
-- Name: broadcast_recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_recipients_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_recipients_id_seq OWNED BY public.broadcast_recipients.id;


--
-- Name: broadcast_schedules; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_schedules (
    id integer NOT NULL,
    schedule_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    broadcast_id uuid NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(50),
    cron_expression character varying(100),
    recurrence_end_date timestamp without time zone,
    max_occurrences integer,
    current_occurrence integer DEFAULT 0,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    executed_at timestamp without time zone,
    next_execution_at timestamp without time zone,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    last_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcast_schedules OWNER TO pnptvbot;

--
-- Name: broadcast_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_schedules_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_schedules_id_seq OWNED BY public.broadcast_schedules.id;


--
-- Name: broadcasts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcasts (
    id integer NOT NULL,
    broadcast_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id character varying(255) NOT NULL,
    admin_username character varying(255),
    title character varying(500),
    message_en text NOT NULL,
    message_es text NOT NULL,
    media_type character varying(50),
    media_url text,
    media_file_id character varying(500),
    s3_key text,
    s3_bucket character varying(255),
    target_type character varying(50) NOT NULL,
    include_filters jsonb,
    exclude_user_ids text[],
    scheduled_at timestamp without time zone,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by character varying(255),
    cancellation_reason text,
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    blocked_count integer DEFAULT 0,
    deactivated_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    last_processed_user_id character varying(255),
    progress_percentage numeric(5,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcasts OWNER TO pnptvbot;

--
-- Name: broadcast_stats; Type: VIEW; Schema: public; Owner: pnptvbot
--

CREATE VIEW public.broadcast_stats AS
 SELECT broadcast_id,
    title,
    admin_id,
    admin_username,
    target_type,
    status,
    scheduled_at,
    created_at,
    completed_at,
    total_recipients,
    sent_count,
    failed_count,
    blocked_count,
    deactivated_count,
    progress_percentage,
        CASE
            WHEN (total_recipients > 0) THEN round((((sent_count)::numeric / (total_recipients)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS success_rate,
    EXTRACT(epoch FROM (completed_at - started_at)) AS duration_seconds
   FROM public.broadcasts b
  WHERE ((status)::text = ANY ((ARRAY['completed'::character varying, 'sending'::character varying])::text[]));


ALTER VIEW public.broadcast_stats OWNER TO pnptvbot;

--
-- Name: broadcast_templates; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcast_templates (
    id integer NOT NULL,
    template_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_by character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    message_en text NOT NULL,
    message_es text NOT NULL,
    default_target_type character varying(50) DEFAULT 'all'::character varying,
    default_media_type character varying(50),
    usage_count integer DEFAULT 0,
    last_used_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcast_templates OWNER TO pnptvbot;

--
-- Name: broadcast_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcast_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcast_templates_id_seq OWNER TO pnptvbot;

--
-- Name: broadcast_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_templates_id_seq OWNED BY public.broadcast_templates.id;


--
-- Name: broadcasts_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.broadcasts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.broadcasts_id_seq OWNER TO pnptvbot;

--
-- Name: broadcasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcasts_id_seq OWNED BY public.broadcasts.id;


--
-- Name: call_feedback; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.call_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    call_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT call_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.call_feedback OWNER TO pnptvbot;

--
-- Name: call_packages_catalog; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.call_packages_catalog (
    id character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    calls integer NOT NULL,
    price_cents integer NOT NULL,
    price_per_call_cents integer,
    savings_cents integer,
    savings_percent integer,
    popular boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.call_packages_catalog OWNER TO pnptvbot;

--
-- Name: call_sessions; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.call_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    room_provider character varying(50) NOT NULL,
    room_id character varying(255) NOT NULL,
    room_name character varying(255),
    join_url_user text,
    join_url_performer text,
    token_user text,
    token_performer text,
    max_participants integer DEFAULT 2,
    recording_disabled boolean DEFAULT true,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    actual_duration_seconds integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT call_sessions_room_provider_check CHECK (((room_provider)::text = ANY ((ARRAY['agora'::character varying, 'jitsi'::character varying, 'daily'::character varying, 'internal'::character varying])::text[]))),
    CONSTRAINT call_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'live'::character varying, 'ended'::character varying, 'destroyed'::character varying])::text[])))
);


ALTER TABLE public.call_sessions OWNER TO pnptvbot;

--
-- Name: calls; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.calls (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    caller_id character varying(255) NOT NULL,
    receiver_id character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    call_type character varying(50) DEFAULT 'video'::character varying,
    duration integer DEFAULT 0,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    caller_rating integer,
    receiver_rating integer,
    caller_feedback text,
    receiver_feedback text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT calls_caller_rating_check CHECK (((caller_rating >= 1) AND (caller_rating <= 5))),
    CONSTRAINT calls_receiver_rating_check CHECK (((receiver_rating >= 1) AND (receiver_rating <= 5)))
);


ALTER TABLE public.calls OWNER TO pnptvbot;

--
-- Name: card_tokens; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.card_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    customer_id character varying(255),
    card_mask character varying(20),
    franchise character varying(50),
    expiry_month character varying(2),
    expiry_year character varying(4),
    card_holder_name character varying(255),
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone
);


ALTER TABLE public.card_tokens OWNER TO pnptvbot;

--
-- Name: TABLE card_tokens; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.card_tokens IS 'Stores tokenized card information from ePayco';


--
-- Name: community_button_presets; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_button_presets (
    id integer NOT NULL,
    preset_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    button_type character varying(50) NOT NULL,
    button_label character varying(255) NOT NULL,
    default_label character varying(255) NOT NULL,
    description text,
    icon_emoji character varying(10),
    target_url text,
    allow_custom_url boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_button_presets OWNER TO pnptvbot;

--
-- Name: community_button_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_button_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_button_presets_id_seq OWNER TO pnptvbot;

--
-- Name: community_button_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_button_presets_id_seq OWNED BY public.community_button_presets.id;


--
-- Name: community_groups; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_groups (
    id integer NOT NULL,
    group_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    telegram_group_id character varying(255) NOT NULL,
    description text,
    icon character varying(20) DEFAULT '📢'::character varying,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_groups OWNER TO pnptvbot;

--
-- Name: community_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_groups_id_seq OWNER TO pnptvbot;

--
-- Name: community_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_groups_id_seq OWNED BY public.community_groups.id;


--
-- Name: community_post_analytics; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_post_analytics (
    id integer NOT NULL,
    analytics_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    group_id uuid,
    views integer DEFAULT 0,
    interactions integer DEFAULT 0,
    button_clicks integer DEFAULT 0,
    replies integer DEFAULT 0,
    reactions integer DEFAULT 0,
    button_click_details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_post_analytics OWNER TO pnptvbot;

--
-- Name: community_post_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_post_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_post_analytics_id_seq OWNER TO pnptvbot;

--
-- Name: community_post_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_post_analytics_id_seq OWNED BY public.community_post_analytics.id;


--
-- Name: community_post_buttons; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_post_buttons (
    id integer NOT NULL,
    button_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    button_type character varying(50) NOT NULL,
    button_label character varying(255) NOT NULL,
    target_url text,
    icon_emoji character varying(10),
    button_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_post_buttons OWNER TO pnptvbot;

--
-- Name: community_post_buttons_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_post_buttons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_post_buttons_id_seq OWNER TO pnptvbot;

--
-- Name: community_post_buttons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_post_buttons_id_seq OWNED BY public.community_post_buttons.id;


--
-- Name: community_post_deliveries; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_post_deliveries (
    id integer NOT NULL,
    delivery_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    schedule_id uuid,
    group_id uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    message_id character varying(255),
    error_code character varying(50),
    error_message text,
    attempts integer DEFAULT 0,
    last_attempt_at timestamp without time zone,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_post_deliveries OWNER TO pnptvbot;

--
-- Name: community_post_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_post_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_post_deliveries_id_seq OWNER TO pnptvbot;

--
-- Name: community_post_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_post_deliveries_id_seq OWNED BY public.community_post_deliveries.id;


--
-- Name: community_post_destinations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_post_destinations (
    id integer NOT NULL,
    destination_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    destination_type character varying(50) NOT NULL,
    destination_name character varying(255) NOT NULL,
    telegram_id character varying(255) NOT NULL,
    description text,
    icon character varying(20),
    supports_media boolean DEFAULT true,
    supports_videos boolean DEFAULT true,
    max_video_size_mb integer DEFAULT 2000,
    supports_buttons boolean DEFAULT true,
    supports_topics boolean DEFAULT false,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    auto_delete_after_hours integer,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_post_destinations OWNER TO pnptvbot;

--
-- Name: community_post_destinations_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_post_destinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_post_destinations_id_seq OWNER TO pnptvbot;

--
-- Name: community_post_destinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_post_destinations_id_seq OWNED BY public.community_post_destinations.id;


--
-- Name: community_post_schedules; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_post_schedules (
    id integer NOT NULL,
    schedule_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(50),
    cron_expression character varying(100),
    next_execution_at timestamp without time zone,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    execution_order integer,
    execution_count integer DEFAULT 0,
    last_executed_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_post_schedules OWNER TO pnptvbot;

--
-- Name: community_post_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_post_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_post_schedules_id_seq OWNER TO pnptvbot;

--
-- Name: community_post_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_post_schedules_id_seq OWNED BY public.community_post_schedules.id;


--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.community_posts (
    id integer NOT NULL,
    post_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id character varying(255) NOT NULL,
    admin_username character varying(255),
    title character varying(500),
    message_en text NOT NULL,
    message_es text NOT NULL,
    media_type character varying(50),
    media_url text,
    s3_key text,
    s3_bucket character varying(255),
    telegram_file_id character varying(255),
    target_group_ids uuid[] NOT NULL,
    target_all_groups boolean DEFAULT false,
    formatted_template_type character varying(50) DEFAULT 'standard'::character varying,
    button_layout character varying(20) DEFAULT 'single_row'::character varying,
    scheduled_at timestamp without time zone,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(50),
    cron_expression character varying(100),
    recurrence_end_date timestamp without time zone,
    max_occurrences integer,
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_count integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_posts OWNER TO pnptvbot;

--
-- Name: community_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.community_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_posts_id_seq OWNER TO pnptvbot;

--
-- Name: community_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.community_posts_id_seq OWNED BY public.community_posts.id;


--
-- Name: cristina_admin_briefs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.cristina_admin_briefs (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cristina_admin_briefs OWNER TO pnptvbot;

--
-- Name: cult_event_registrations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.cult_event_registrations (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    month_key character varying(7) NOT NULL,
    event_at timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'registered'::character varying,
    claimed_at timestamp without time zone,
    reminder_7d_sent boolean DEFAULT false,
    reminder_3d_sent boolean DEFAULT false,
    reminder_day_sent boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cult_event_registrations OWNER TO pnptvbot;

--
-- Name: cult_event_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.cult_event_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cult_event_registrations_id_seq OWNER TO pnptvbot;

--
-- Name: cult_event_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.cult_event_registrations_id_seq OWNED BY public.cult_event_registrations.id;


--
-- Name: custom_emotes; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.custom_emotes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    streamer_name character varying(255),
    name character varying(100) NOT NULL,
    emoji character varying(50),
    image_url text,
    status character varying(50) DEFAULT 'pending'::character varying,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    approved_at timestamp without time zone,
    approved_by character varying(255),
    rejected_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.custom_emotes OWNER TO pnptvbot;

--
-- Name: emote_usage; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.emote_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    emote_id uuid,
    user_id character varying(255),
    emote_name character varying(100),
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    context character varying(50)
);


ALTER TABLE public.emote_usage OWNER TO pnptvbot;

--
-- Name: emotes; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.emotes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    emoji character varying(50) NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.emotes OWNER TO pnptvbot;

--
-- Name: forwarded_violations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.forwarded_violations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    message_id integer,
    source_type character varying(50) NOT NULL,
    source_info jsonb,
    violation_type character varying(50) DEFAULT 'forwarded_message'::character varying,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.forwarded_violations OWNER TO pnptvbot;

--
-- Name: group_invitations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.group_invitations (
    id integer NOT NULL,
    token character varying(128) NOT NULL,
    user_id bigint NOT NULL,
    group_type character varying(50) DEFAULT 'free'::character varying NOT NULL,
    invitation_link text NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    last_reminder_at timestamp without time zone
);


ALTER TABLE public.group_invitations OWNER TO pnptvbot;

--
-- Name: group_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.group_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_invitations_id_seq OWNER TO pnptvbot;

--
-- Name: group_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.group_invitations_id_seq OWNED BY public.group_invitations.id;


--
-- Name: group_settings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.group_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id character varying(255) NOT NULL,
    group_title character varying(255),
    anti_links_enabled boolean DEFAULT true,
    anti_spam_enabled boolean DEFAULT true,
    anti_flood_enabled boolean DEFAULT true,
    anti_forwarded_enabled boolean DEFAULT true,
    profanity_filter_enabled boolean DEFAULT false,
    max_warnings integer DEFAULT 3,
    flood_limit integer DEFAULT 5,
    flood_window integer DEFAULT 10,
    mute_duration integer DEFAULT 3600,
    allowed_domains text[] DEFAULT '{}'::text[],
    banned_words text[] DEFAULT '{}'::text[],
    restrict_bot_addition boolean DEFAULT true,
    allowed_bots text[] DEFAULT '{pnptv_bot,PNPtvBot,PNPtvOfficialBot}'::text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_settings OWNER TO pnptvbot;

--
-- Name: jitsi_participants; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.jitsi_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_id character varying(100),
    telegram_id bigint,
    display_name character varying(255),
    is_moderator boolean DEFAULT false,
    is_host boolean DEFAULT false,
    join_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    leave_time timestamp with time zone,
    duration integer,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.jitsi_participants OWNER TO pnptvbot;

--
-- Name: jitsi_room_statistics; Type: VIEW; Schema: public; Owner: pnptvbot
--

CREATE VIEW public.jitsi_room_statistics AS
SELECT
    NULL::uuid AS room_id,
    NULL::character varying(20) AS room_code,
    NULL::public.jitsi_room_tier AS tier,
    NULL::character varying(255) AS title,
    NULL::character varying(100) AS host_user_id,
    NULL::public.jitsi_room_status AS status,
    NULL::integer AS current_participants,
    NULL::integer AS total_participants,
    NULL::integer AS peak_participants,
    NULL::integer AS total_duration,
    NULL::bigint AS session_count,
    NULL::numeric AS avg_session_duration;


ALTER VIEW public.jitsi_room_statistics OWNER TO pnptvbot;

--
-- Name: jitsi_tier_access; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.jitsi_tier_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_tier character varying(50) NOT NULL,
    allowed_room_tier public.jitsi_room_tier NOT NULL,
    max_rooms_per_day integer DEFAULT 1,
    max_duration_minutes integer DEFAULT 60,
    can_record boolean DEFAULT false,
    can_set_password boolean DEFAULT false,
    can_create_private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.jitsi_tier_access OWNER TO pnptvbot;

--
-- Name: jitsi_user_usage; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.jitsi_user_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(100) NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    tier public.jitsi_room_tier NOT NULL,
    rooms_created integer DEFAULT 0,
    total_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.jitsi_user_usage OWNER TO pnptvbot;

--
-- Name: live_streams; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.live_streams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    host_id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    stream_url text,
    thumbnail_url text,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    is_public boolean DEFAULT true,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    viewers_count_old integer DEFAULT 0,
    max_viewers integer DEFAULT 1000,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ai_moderation_enabled boolean DEFAULT false,
    moderation_thresholds jsonb DEFAULT '{}'::jsonb,
    auto_moderate boolean DEFAULT false,
    channel_name character varying(255),
    host_name character varying(255),
    is_paid boolean DEFAULT false,
    price integer DEFAULT 0,
    scheduled_for timestamp without time zone,
    tags text[],
    allow_comments boolean DEFAULT true,
    record_stream boolean DEFAULT false,
    language character varying(10) DEFAULT 'en'::character varying,
    duration integer,
    current_viewers integer DEFAULT 0,
    total_views integer DEFAULT 0,
    peak_viewers integer DEFAULT 0,
    likes integer DEFAULT 0,
    total_comments integer DEFAULT 0,
    viewers jsonb,
    banned_users text[],
    moderators text[],
    tokens jsonb,
    recording_url text,
    analytics jsonb,
    chat_settings jsonb,
    viewers_count integer DEFAULT 0
);


ALTER TABLE public.live_streams OWNER TO pnptvbot;

--
-- Name: TABLE live_streams; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.live_streams IS 'Stores information about live streaming sessions';


--
-- Name: media_favorites; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_favorites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    media_id uuid NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.media_favorites OWNER TO pnptvbot;

--
-- Name: media_library; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_library (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    artist character varying(255),
    url text NOT NULL,
    type character varying(50) DEFAULT 'audio'::character varying,
    duration integer DEFAULT 0,
    category character varying(100) DEFAULT 'general'::character varying,
    cover_url text,
    description text,
    plays integer DEFAULT 0,
    likes integer DEFAULT 0,
    uploader_id character varying(255),
    uploader_name character varying(255),
    language character varying(10) DEFAULT 'es'::character varying,
    is_public boolean DEFAULT true,
    is_explicit boolean DEFAULT false,
    tags text[],
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.media_library OWNER TO pnptvbot;

--
-- Name: media_play_history; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_play_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    media_id uuid NOT NULL,
    played_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    duration_played integer,
    completed boolean DEFAULT false
);


ALTER TABLE public.media_play_history OWNER TO pnptvbot;

--
-- Name: media_playlists; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_playlists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    owner_id character varying(255) NOT NULL,
    description text,
    cover_url text,
    is_public boolean DEFAULT false,
    is_collaborative boolean DEFAULT false,
    total_plays integer DEFAULT 0,
    total_likes integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.media_playlists OWNER TO pnptvbot;

--
-- Name: media_ratings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_ratings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    media_id uuid NOT NULL,
    rating integer,
    review text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT media_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.media_ratings OWNER TO pnptvbot;

--
-- Name: media_shares; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.media_shares (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    media_type character varying(20) NOT NULL,
    media_id character varying(255) NOT NULL,
    message_id character varying(255),
    share_count integer DEFAULT 1,
    like_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_like_at timestamp with time zone,
    CONSTRAINT media_shares_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['photo'::character varying, 'video'::character varying, 'document'::character varying])::text[])))
);


ALTER TABLE public.media_shares OWNER TO pnptvbot;

--
-- Name: TABLE media_shares; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.media_shares IS 'Tracks media shares and likes for gamification and rewards';


--
-- Name: COLUMN media_shares.user_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.user_id IS 'Telegram user ID who shared the media';


--
-- Name: COLUMN media_shares.media_type; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.media_type IS 'Type of media: photo, video, or document';


--
-- Name: COLUMN media_shares.media_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.media_id IS 'Telegram file ID of the media';


--
-- Name: COLUMN media_shares.message_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.message_id IS 'Telegram message ID containing the media';


--
-- Name: COLUMN media_shares.share_count; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.share_count IS 'Number of times this media has been shared';


--
-- Name: COLUMN media_shares.like_count; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.like_count IS 'Number of likes/reactions this media has received';


--
-- Name: COLUMN media_shares.created_at; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.created_at IS 'When the media was first shared';


--
-- Name: COLUMN media_shares.updated_at; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.updated_at IS 'When the media record was last updated';


--
-- Name: COLUMN media_shares.last_like_at; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.media_shares.last_like_at IS 'When the media last received a like';


--
-- Name: media_shares_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.media_shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_shares_id_seq OWNER TO pnptvbot;

--
-- Name: media_shares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.media_shares_id_seq OWNED BY public.media_shares.id;


--
-- Name: meet_greet_bookings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.meet_greet_bookings (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    model_id integer,
    duration_minutes integer NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    booking_time timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT meet_greet_bookings_duration_minutes_check CHECK ((duration_minutes = ANY (ARRAY[30, 60, 90]))),
    CONSTRAINT meet_greet_bookings_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT meet_greet_bookings_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.meet_greet_bookings OWNER TO pnptvbot;

--
-- Name: meet_greet_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.meet_greet_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.meet_greet_bookings_id_seq OWNER TO pnptvbot;

--
-- Name: meet_greet_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.meet_greet_bookings_id_seq OWNED BY public.meet_greet_bookings.id;


--
-- Name: meet_greet_payments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.meet_greet_payments (
    id integer NOT NULL,
    booking_id integer,
    amount_usd numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    transaction_id character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT meet_greet_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.meet_greet_payments OWNER TO pnptvbot;

--
-- Name: meet_greet_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.meet_greet_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.meet_greet_payments_id_seq OWNER TO pnptvbot;

--
-- Name: meet_greet_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.meet_greet_payments_id_seq OWNED BY public.meet_greet_payments.id;


--
-- Name: message_rate_limits; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.message_rate_limits (
    date date NOT NULL,
    total_messages_sent integer DEFAULT 0,
    last_reset timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.message_rate_limits OWNER TO pnptvbot;

--
-- Name: model_availability; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.model_availability (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.model_availability OWNER TO pnptvbot;

--
-- Name: model_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.model_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_availability_id_seq OWNER TO pnptvbot;

--
-- Name: model_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.model_availability_id_seq OWNED BY public.model_availability.id;


--
-- Name: model_bookings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.model_bookings (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    user_id bigint NOT NULL,
    telegram_user_id bigint NOT NULL,
    username character varying(255),
    scheduled_date date NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    end_time time without time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    transaction_id character varying(255),
    total_price numeric(10,2) NOT NULL,
    notes text,
    call_room_url character varying(512),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.model_bookings OWNER TO pnptvbot;

--
-- Name: model_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.model_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_bookings_id_seq OWNER TO pnptvbot;

--
-- Name: model_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.model_bookings_id_seq OWNED BY public.model_bookings.id;


--
-- Name: model_earnings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.model_earnings (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    booking_id integer,
    amount numeric(10,2) NOT NULL,
    commission_percentage numeric(5,2) DEFAULT 30,
    model_earnings numeric(10,2) NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payout_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.model_earnings OWNER TO pnptvbot;

--
-- Name: model_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.model_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_earnings_id_seq OWNER TO pnptvbot;

--
-- Name: model_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.model_earnings_id_seq OWNED BY public.model_earnings.id;


--
-- Name: model_photos; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.model_photos (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    photo_url character varying(512) NOT NULL,
    caption text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.model_photos OWNER TO pnptvbot;

--
-- Name: model_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.model_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_photos_id_seq OWNER TO pnptvbot;

--
-- Name: model_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.model_photos_id_seq OWNED BY public.model_photos.id;


--
-- Name: model_reviews; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.model_reviews (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    user_id bigint NOT NULL,
    booking_id integer,
    rating integer NOT NULL,
    review_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT model_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.model_reviews OWNER TO pnptvbot;

--
-- Name: model_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.model_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_reviews_id_seq OWNER TO pnptvbot;

--
-- Name: model_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.model_reviews_id_seq OWNED BY public.model_reviews.id;


--
-- Name: models; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.models (
    id integer NOT NULL,
    model_id bigint NOT NULL,
    username character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    bio text,
    photo_url character varying(512),
    price_per_minute numeric(10,2) NOT NULL,
    min_duration_minutes integer DEFAULT 15,
    max_duration_minutes integer DEFAULT 120,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.models OWNER TO pnptvbot;

--
-- Name: models_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.models_id_seq OWNER TO pnptvbot;

--
-- Name: models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.models_id_seq OWNED BY public.models.id;


--
-- Name: moderation; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.moderation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    words text[] DEFAULT '{}'::text[],
    links text[] DEFAULT '{}'::text[],
    patterns text[] DEFAULT '{}'::text[],
    updated_by character varying(255),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    group_id character varying(255)
);


ALTER TABLE public.moderation OWNER TO pnptvbot;

--
-- Name: moderation_logs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.moderation_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id character varying(255) NOT NULL,
    action character varying(50) NOT NULL,
    user_id character varying(255),
    moderator_id character varying(255),
    target_user_id character varying(255),
    reason text,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.moderation_logs OWNER TO pnptvbot;

--
-- Name: nearby_place_categories; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_place_categories (
    id integer NOT NULL,
    slug character varying(50) NOT NULL,
    name_en character varying(100) NOT NULL,
    name_es character varying(100) NOT NULL,
    description_en text,
    description_es text,
    emoji character varying(10),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    requires_age_verification boolean DEFAULT false,
    parent_category_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.nearby_place_categories OWNER TO pnptvbot;

--
-- Name: TABLE nearby_place_categories; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_place_categories IS 'Categories for nearby places (wellness, cruising, bars, etc.)';


--
-- Name: nearby_place_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_place_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_place_categories_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_place_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_place_categories_id_seq OWNED BY public.nearby_place_categories.id;


--
-- Name: nearby_place_favorites; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_place_favorites (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    place_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.nearby_place_favorites OWNER TO pnptvbot;

--
-- Name: TABLE nearby_place_favorites; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_place_favorites IS 'User favorites for quick access to saved places';


--
-- Name: nearby_place_favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_place_favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_place_favorites_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_place_favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_place_favorites_id_seq OWNED BY public.nearby_place_favorites.id;


--
-- Name: nearby_place_reports; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_place_reports (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    place_id integer,
    report_type character varying(50) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    resolved_by character varying(50),
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT nearby_place_reports_report_type_check CHECK (((report_type)::text = ANY ((ARRAY['closed'::character varying, 'incorrect_info'::character varying, 'inappropriate'::character varying, 'spam'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT nearby_place_reports_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[])))
);


ALTER TABLE public.nearby_place_reports OWNER TO pnptvbot;

--
-- Name: TABLE nearby_place_reports; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_place_reports IS 'User reports for moderation of incorrect/inappropriate places';


--
-- Name: nearby_place_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_place_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_place_reports_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_place_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_place_reports_id_seq OWNED BY public.nearby_place_reports.id;


--
-- Name: nearby_place_reviews; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_place_reviews (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    place_id integer,
    rating integer,
    comment text,
    status character varying(20) DEFAULT 'approved'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT nearby_place_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT nearby_place_reviews_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.nearby_place_reviews OWNER TO pnptvbot;

--
-- Name: TABLE nearby_place_reviews; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_place_reviews IS 'User reviews and ratings for places';


--
-- Name: nearby_place_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_place_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_place_reviews_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_place_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_place_reviews_id_seq OWNED BY public.nearby_place_reviews.id;


--
-- Name: nearby_place_submissions; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_place_submissions (
    id integer NOT NULL,
    submitted_by_user_id character varying(50) NOT NULL,
    submitted_at timestamp without time zone DEFAULT now(),
    name character varying(200) NOT NULL,
    description text,
    address character varying(500),
    city character varying(100),
    country character varying(100),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    category_id integer,
    place_type character varying(50) NOT NULL,
    phone character varying(50),
    email character varying(255),
    website character varying(500),
    telegram_username character varying(100),
    instagram character varying(100),
    is_community_owned boolean DEFAULT false,
    photo_file_id character varying(255),
    hours_of_operation jsonb DEFAULT '{}'::jsonb,
    price_range character varying(10),
    status character varying(20) DEFAULT 'pending'::character varying,
    moderated_by character varying(50),
    moderated_at timestamp without time zone,
    rejection_reason text,
    admin_notes text,
    created_place_id integer,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT nearby_place_submissions_place_type_check CHECK (((place_type)::text = ANY ((ARRAY['business'::character varying, 'place_of_interest'::character varying])::text[]))),
    CONSTRAINT nearby_place_submissions_price_range_check CHECK ((((price_range)::text = ANY ((ARRAY['$'::character varying, '$$'::character varying, '$$$'::character varying, '$$$$'::character varying])::text[])) OR (price_range IS NULL))),
    CONSTRAINT nearby_place_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.nearby_place_submissions OWNER TO pnptvbot;

--
-- Name: TABLE nearby_place_submissions; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_place_submissions IS 'User-submitted proposals for new places awaiting admin approval';


--
-- Name: nearby_place_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_place_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_place_submissions_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_place_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_place_submissions_id_seq OWNED BY public.nearby_place_submissions.id;


--
-- Name: nearby_places; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.nearby_places (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    address character varying(500),
    city character varying(100),
    country character varying(100),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    location_geohash character varying(12),
    category_id integer,
    place_type character varying(50) NOT NULL,
    phone character varying(50),
    email character varying(255),
    website character varying(500),
    telegram_username character varying(100),
    instagram character varying(100),
    is_community_owned boolean DEFAULT false,
    owner_user_id character varying(50),
    recommender_user_id character varying(50),
    photo_url character varying(500),
    photo_file_id character varying(255),
    hours_of_operation jsonb DEFAULT '{}'::jsonb,
    price_range character varying(10),
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_reason text,
    moderated_by character varying(50),
    moderated_at timestamp without time zone,
    view_count integer DEFAULT 0,
    favorite_count integer DEFAULT 0,
    report_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT nearby_places_place_type_check CHECK (((place_type)::text = ANY ((ARRAY['business'::character varying, 'place_of_interest'::character varying])::text[]))),
    CONSTRAINT nearby_places_price_range_check CHECK ((((price_range)::text = ANY ((ARRAY['$'::character varying, '$$'::character varying, '$$$'::character varying, '$$$$'::character varying])::text[])) OR (price_range IS NULL))),
    CONSTRAINT nearby_places_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'suspended'::character varying])::text[])))
);


ALTER TABLE public.nearby_places OWNER TO pnptvbot;

--
-- Name: TABLE nearby_places; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.nearby_places IS 'Main table storing all approved and pending places/businesses';


--
-- Name: COLUMN nearby_places.location_geohash; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.nearby_places.location_geohash IS 'Geohash for efficient spatial queries';


--
-- Name: COLUMN nearby_places.place_type; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.nearby_places.place_type IS 'Type: business (community-owned/recommended) or place_of_interest (general POI)';


--
-- Name: COLUMN nearby_places.status; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.nearby_places.status IS 'Moderation status: pending, approved, rejected, or suspended';


--
-- Name: nearby_places_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.nearby_places_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nearby_places_id_seq OWNER TO pnptvbot;

--
-- Name: nearby_places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.nearby_places_id_seq OWNED BY public.nearby_places.id;


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.payment_webhook_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider character varying(50) NOT NULL,
    event_id character varying(255),
    payment_id uuid,
    status character varying(50),
    state_code character varying(50),
    is_valid_signature boolean DEFAULT true,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payment_webhook_events OWNER TO pnptvbot;

--
-- Name: TABLE payment_webhook_events; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.payment_webhook_events IS 'Raw payment webhook events for auditing payment attempts';


--
-- Name: COLUMN payment_webhook_events.event_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.payment_webhook_events.event_id IS 'Provider event id or reference (ePayco ref_payco, Daimo id)';


--
-- Name: COLUMN payment_webhook_events.state_code; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.payment_webhook_events.state_code IS 'Provider-specific state code (ePayco cod_transaction_state, Daimo event type)';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    plan_id character varying(100),
    plan_name character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    provider character varying(50),
    payment_method character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    payment_id character varying(255),
    reference character varying(255),
    destination_address character varying(255),
    payment_url text,
    chain jsonb,
    chain_id integer,
    completed_at timestamp without time zone,
    completed_by character varying(255),
    manual_completion boolean DEFAULT false,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    daimo_payment_id character varying(255),
    CONSTRAINT payments_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_currency_valid CHECK (((currency)::text = ANY ((ARRAY['USD'::character varying, 'USDC'::character varying, 'EUR'::character varying, 'COP'::character varying])::text[]))),
    CONSTRAINT payments_provider_valid CHECK (((provider)::text = ANY ((ARRAY['epayco'::character varying, 'daimo'::character varying, 'paypal'::character varying, 'stripe'::character varying, 'manual'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT payments_status_valid CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO pnptvbot;

--
-- Name: COLUMN payments.metadata; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.payments.metadata IS 'JSON metadata for promo tracking: {promoId, promoCode, redemptionId, originalPrice, discountAmount}';


--
-- Name: COLUMN payments.daimo_payment_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.payments.daimo_payment_id IS 'Identifier returned by Daimo Pay (useful to track webhook events and reconcile records).';


--
-- Name: CONSTRAINT payments_amount_positive ON payments; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON CONSTRAINT payments_amount_positive ON public.payments IS 'Ensures payment amount is greater than zero';


--
-- Name: CONSTRAINT payments_currency_valid ON payments; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON CONSTRAINT payments_currency_valid ON public.payments IS 'Ensures currency is one of the supported currencies';


--
-- Name: CONSTRAINT payments_provider_valid ON payments; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON CONSTRAINT payments_provider_valid ON public.payments IS 'Ensures provider is one of the supported payment providers';


--
-- Name: CONSTRAINT payments_status_valid ON payments; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON CONSTRAINT payments_status_valid ON public.payments IS 'Ensures payment status is one of the valid values';


--
-- Name: pending_scheduled_broadcasts; Type: VIEW; Schema: public; Owner: pnptvbot
--

CREATE VIEW public.pending_scheduled_broadcasts AS
 SELECT bs.schedule_id,
    bs.broadcast_id,
    b.title,
    b.admin_id,
    b.admin_username,
    bs.scheduled_for,
    bs.timezone,
    bs.is_recurring,
    bs.recurrence_pattern,
    bs.next_execution_at,
    bs.status,
    b.message_en,
    b.message_es,
    b.target_type
   FROM (public.broadcast_schedules bs
     JOIN public.broadcasts b ON ((bs.broadcast_id = b.broadcast_id)))
  WHERE (((bs.status)::text = 'scheduled'::text) AND (bs.scheduled_for <= (CURRENT_TIMESTAMP + '01:00:00'::interval)))
  ORDER BY bs.scheduled_for;


ALTER VIEW public.pending_scheduled_broadcasts OWNER TO pnptvbot;

--
-- Name: performer_availability; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.performer_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    performer_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    day_of_week integer,
    start_time_local time without time zone,
    end_time_local time without time zone,
    date_local date,
    timezone character varying(100) DEFAULT 'America/Bogota'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT performer_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT performer_availability_type_check CHECK (((type)::text = ANY ((ARRAY['weekly_rule'::character varying, 'exception_add'::character varying, 'exception_block'::character varying])::text[])))
);


ALTER TABLE public.performer_availability OWNER TO pnptvbot;

--
-- Name: performers; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.performers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255),
    display_name character varying(255) NOT NULL,
    bio text,
    photo_url text,
    availability_schedule jsonb DEFAULT '[]'::jsonb,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    allowed_call_types character varying(50)[] DEFAULT ARRAY['video'::character varying, 'audio'::character varying],
    max_call_duration integer DEFAULT 60,
    base_price numeric(10,2) NOT NULL,
    buffer_time_before integer DEFAULT 15,
    buffer_time_after integer DEFAULT 15,
    status character varying(50) DEFAULT 'active'::character varying,
    is_available boolean DEFAULT true,
    availability_message text,
    total_calls integer DEFAULT 0,
    total_rating numeric(3,2) DEFAULT 0.00,
    rating_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    updated_by character varying(255),
    bio_short text,
    default_timezone character varying(100) DEFAULT 'America/Bogota'::character varying,
    allowed_call_types_json jsonb DEFAULT '["video", "audio"]'::jsonb,
    durations_minutes jsonb DEFAULT '[15, 30, 60]'::jsonb,
    base_price_cents integer DEFAULT 10000,
    currency character varying(10) DEFAULT 'USD'::character varying,
    buffer_before_minutes integer DEFAULT 5,
    buffer_after_minutes integer DEFAULT 10,
    max_daily_calls integer
);


ALTER TABLE public.performers OWNER TO pnptvbot;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.plans (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    tier character varying(50) NOT NULL,
    price numeric(10,2) NOT NULL,
    price_in_cop numeric(10,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    duration integer NOT NULL,
    duration_days integer,
    description text,
    features jsonb DEFAULT '[]'::jsonb,
    icon character varying(50),
    active boolean DEFAULT true,
    recommended boolean DEFAULT false,
    is_lifetime boolean DEFAULT false,
    requires_manual_activation boolean DEFAULT false,
    payment_method character varying(50),
    wompi_payment_link text,
    crypto_bonus jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_recurring boolean DEFAULT false,
    billing_interval character varying(20) DEFAULT 'month'::character varying,
    billing_interval_count integer DEFAULT 1,
    trial_days integer DEFAULT 0,
    recurring_price numeric(10,2)
);


ALTER TABLE public.plans OWNER TO pnptvbot;

--
-- Name: player_states; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.player_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    media_id uuid,
    playlist_id uuid,
    current_position integer DEFAULT 0,
    is_playing boolean DEFAULT false,
    last_played_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.player_states OWNER TO pnptvbot;

--
-- Name: playlist_items; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.playlist_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    playlist_id uuid NOT NULL,
    media_id uuid NOT NULL,
    "position" integer NOT NULL,
    added_by character varying(255),
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.playlist_items OWNER TO pnptvbot;

--
-- Name: pnp_bookings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_bookings (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    model_id integer,
    duration_minutes integer NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    booking_time timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    video_room_name character varying(100),
    video_room_url character varying(255),
    video_room_token text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    model_earnings numeric(10,2),
    platform_fee numeric(10,2),
    transaction_id character varying(100),
    show_ended_at timestamp without time zone,
    availability_id integer,
    promo_code_id integer,
    discount_amount numeric(10,2) DEFAULT 0,
    original_price numeric(10,2),
    promo_code character varying(50),
    promo_id integer,
    rating integer,
    feedback_text text,
    reminder_1h_sent boolean DEFAULT false,
    reminder_5m_sent boolean DEFAULT false,
    payment_expires_at timestamp without time zone,
    hold_released_at timestamp without time zone,
    booking_source character varying(20) DEFAULT 'telegram'::character varying,
    CONSTRAINT pnp_bookings_duration_minutes_check CHECK ((duration_minutes = ANY (ARRAY[30, 60, 90]))),
    CONSTRAINT pnp_bookings_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT pnp_bookings_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.pnp_bookings OWNER TO pnptvbot;

--
-- Name: pnp_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_bookings_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_bookings_id_seq OWNED BY public.pnp_bookings.id;


--
-- Name: pnp_feedback; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_feedback (
    id integer NOT NULL,
    booking_id integer,
    user_id character varying(50) NOT NULL,
    rating integer,
    comments text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.pnp_feedback OWNER TO pnptvbot;

--
-- Name: pnp_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_feedback_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_feedback_id_seq OWNED BY public.pnp_feedback.id;


--
-- Name: pnp_live_promo_codes; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_live_promo_codes (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type character varying(20) DEFAULT 'percentage'::character varying,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0,
    valid_from timestamp without time zone DEFAULT now(),
    valid_until timestamp without time zone,
    applicable_durations integer[],
    applicable_models integer[],
    min_booking_amount numeric(10,2) DEFAULT 0,
    max_discount numeric(10,2),
    single_use_per_user boolean DEFAULT false,
    active boolean DEFAULT true,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_live_promo_codes_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::text[])))
);


ALTER TABLE public.pnp_live_promo_codes OWNER TO pnptvbot;

--
-- Name: pnp_live_promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_live_promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_live_promo_codes_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_live_promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_live_promo_codes_id_seq OWNED BY public.pnp_live_promo_codes.id;


--
-- Name: pnp_live_promo_usage; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_live_promo_usage (
    id integer NOT NULL,
    promo_id integer,
    booking_id integer,
    user_id character varying(50) NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    original_price numeric(10,2) NOT NULL,
    final_price numeric(10,2) NOT NULL,
    used_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pnp_live_promo_usage OWNER TO pnptvbot;

--
-- Name: pnp_live_promo_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_live_promo_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_live_promo_usage_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_live_promo_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_live_promo_usage_id_seq OWNED BY public.pnp_live_promo_usage.id;


--
-- Name: pnp_model_blocked_dates; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_model_blocked_dates (
    id integer NOT NULL,
    model_id integer,
    blocked_date date NOT NULL,
    reason character varying(200),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pnp_model_blocked_dates OWNER TO pnptvbot;

--
-- Name: TABLE pnp_model_blocked_dates; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.pnp_model_blocked_dates IS 'Stores dates when models are not available';


--
-- Name: pnp_model_blocked_dates_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_model_blocked_dates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_model_blocked_dates_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_model_blocked_dates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_model_blocked_dates_id_seq OWNED BY public.pnp_model_blocked_dates.id;


--
-- Name: pnp_model_earnings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_model_earnings (
    id integer NOT NULL,
    model_id integer,
    booking_id integer,
    tip_id integer,
    earning_type character varying(20) NOT NULL,
    gross_amount numeric(10,2) NOT NULL,
    commission_percent integer NOT NULL,
    model_earnings numeric(10,2) NOT NULL,
    platform_fee numeric(10,2) NOT NULL,
    payout_status character varying(20) DEFAULT 'pending'::character varying,
    payout_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_model_earnings_earning_type_check CHECK (((earning_type)::text = ANY ((ARRAY['booking'::character varying, 'tip'::character varying])::text[]))),
    CONSTRAINT pnp_model_earnings_payout_status_check CHECK (((payout_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.pnp_model_earnings OWNER TO pnptvbot;

--
-- Name: pnp_model_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_model_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_model_earnings_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_model_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_model_earnings_id_seq OWNED BY public.pnp_model_earnings.id;


--
-- Name: pnp_model_payouts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_model_payouts (
    id integer NOT NULL,
    model_id integer,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    payment_details jsonb,
    requested_at timestamp without time zone DEFAULT now(),
    processed_at timestamp without time zone,
    processed_by character varying(50),
    transaction_id character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_model_payouts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.pnp_model_payouts OWNER TO pnptvbot;

--
-- Name: pnp_model_payouts_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_model_payouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_model_payouts_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_model_payouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_model_payouts_id_seq OWNED BY public.pnp_model_payouts.id;


--
-- Name: pnp_model_schedules; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_model_schedules (
    id integer NOT NULL,
    model_id integer,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_model_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.pnp_model_schedules OWNER TO pnptvbot;

--
-- Name: TABLE pnp_model_schedules; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.pnp_model_schedules IS 'Stores recurring availability schedules for models';


--
-- Name: pnp_model_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_model_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_model_schedules_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_model_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_model_schedules_id_seq OWNED BY public.pnp_model_schedules.id;


--
-- Name: pnp_model_status_history; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_model_status_history (
    id integer NOT NULL,
    model_id integer,
    status character varying(20) NOT NULL,
    changed_at timestamp without time zone DEFAULT now(),
    changed_by character varying(50),
    source character varying(20) DEFAULT 'manual'::character varying,
    CONSTRAINT pnp_model_status_history_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying, 'system'::character varying, 'booking'::character varying])::text[]))),
    CONSTRAINT pnp_model_status_history_status_check CHECK (((status)::text = ANY ((ARRAY['online'::character varying, 'offline'::character varying, 'busy'::character varying, 'away'::character varying])::text[])))
);


ALTER TABLE public.pnp_model_status_history OWNER TO pnptvbot;

--
-- Name: pnp_model_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_model_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_model_status_history_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_model_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_model_status_history_id_seq OWNED BY public.pnp_model_status_history.id;


--
-- Name: pnp_models; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_models (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    username character varying(50),
    bio text,
    profile_image_url character varying(255),
    is_active boolean DEFAULT true,
    is_online boolean DEFAULT false,
    last_online timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    price_30min numeric(10,2) DEFAULT 60.00,
    price_60min numeric(10,2) DEFAULT 100.00,
    price_90min numeric(10,2) DEFAULT 250.00,
    commission_percent integer DEFAULT 70,
    telegram_id character varying(50),
    avg_rating numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    total_shows integer DEFAULT 0,
    total_earnings numeric(12,2) DEFAULT 0,
    last_activity_at timestamp without time zone DEFAULT now(),
    auto_offline_minutes integer DEFAULT 240,
    status_message character varying(200),
    can_instant_book boolean DEFAULT false,
    user_id character varying(50)
);


ALTER TABLE public.pnp_models OWNER TO pnptvbot;

--
-- Name: COLUMN pnp_models.user_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.pnp_models.user_id IS 'Telegram user ID that owns this model profile';


--
-- Name: pnp_models_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_models_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_models_id_seq OWNED BY public.pnp_models.id;


--
-- Name: pnp_payments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_payments (
    id integer NOT NULL,
    booking_id integer,
    amount_usd numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    transaction_id character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.pnp_payments OWNER TO pnptvbot;

--
-- Name: pnp_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_payments_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_payments_id_seq OWNED BY public.pnp_payments.id;


--
-- Name: pnp_refunds; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_refunds (
    id integer NOT NULL,
    booking_id integer,
    amount_usd numeric(10,2) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    processed_by character varying(50),
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_refunds_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.pnp_refunds OWNER TO pnptvbot;

--
-- Name: pnp_refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_refunds_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_refunds_id_seq OWNED BY public.pnp_refunds.id;


--
-- Name: pnp_tips; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.pnp_tips (
    id integer NOT NULL,
    booking_id integer,
    user_id character varying(50) NOT NULL,
    model_id integer,
    amount numeric(10,2) NOT NULL,
    message text,
    payment_method character varying(50),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    transaction_id character varying(100),
    model_earnings numeric(10,2),
    platform_fee numeric(10,2),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pnp_tips_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.pnp_tips OWNER TO pnptvbot;

--
-- Name: pnp_tips_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.pnp_tips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pnp_tips_id_seq OWNER TO pnptvbot;

--
-- Name: pnp_tips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.pnp_tips_id_seq OWNED BY public.pnp_tips.id;


--
-- Name: private_calls; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.private_calls (
    id integer NOT NULL,
    caller_id character varying(255) NOT NULL,
    performer_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    scheduled_date timestamp without time zone,
    duration_minutes integer DEFAULT 30,
    call_type character varying(50) DEFAULT 'video'::character varying,
    platform character varying(50) DEFAULT 'jitsi'::character varying,
    room_url text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.private_calls OWNER TO pnptvbot;

--
-- Name: private_calls_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.private_calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.private_calls_id_seq OWNER TO pnptvbot;

--
-- Name: private_calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.private_calls_id_seq OWNED BY public.private_calls.id;


--
-- Name: profile_compliance; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.profile_compliance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    username_valid boolean DEFAULT false,
    name_valid boolean DEFAULT false,
    compliance_issues text[],
    warning_sent_at timestamp without time zone,
    warning_count integer DEFAULT 0,
    purge_deadline timestamp without time zone,
    purged boolean DEFAULT false,
    purged_at timestamp without time zone,
    compliance_met_at timestamp without time zone,
    last_checked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.profile_compliance OWNER TO pnptvbot;

--
-- Name: promo_code_usage; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.promo_code_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    user_id character varying(255) NOT NULL,
    payment_id character varying(255),
    discount_amount numeric(10,2) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promo_code_usage OWNER TO pnptvbot;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    discount_type character varying(50) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    applicable_plans text[],
    max_uses integer,
    current_uses integer DEFAULT 0,
    max_uses_per_user integer DEFAULT 1,
    valid_from timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp without time zone,
    active boolean DEFAULT true,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promo_codes OWNER TO pnptvbot;

--
-- Name: promo_redemptions; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.promo_redemptions (
    id integer NOT NULL,
    promo_id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    payment_id uuid,
    original_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    final_price numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'claimed'::character varying,
    claimed_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT promo_redemptions_status_check CHECK (((status)::text = ANY ((ARRAY['claimed'::character varying, 'completed'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.promo_redemptions OWNER TO pnptvbot;

--
-- Name: TABLE promo_redemptions; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.promo_redemptions IS 'Tracks user promo claims and completions';


--
-- Name: COLUMN promo_redemptions.status; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promo_redemptions.status IS 'claimed = spot reserved pending payment, completed = payment successful, expired/cancelled = did not complete';


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.promo_redemptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promo_redemptions_id_seq OWNER TO pnptvbot;

--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.promo_redemptions_id_seq OWNED BY public.promo_redemptions.id;


--
-- Name: promos; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.promos (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    name_es character varying(255),
    description text,
    description_es text,
    base_plan_id character varying(100) NOT NULL,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    target_audience character varying(50) DEFAULT 'all'::character varying NOT NULL,
    new_user_days integer DEFAULT 7,
    max_spots integer,
    current_spots_used integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    features jsonb DEFAULT '[]'::jsonb,
    features_es jsonb DEFAULT '[]'::jsonb,
    active boolean DEFAULT true,
    hidden boolean DEFAULT true,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promos_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed_price'::character varying])::text[]))),
    CONSTRAINT promos_target_audience_check CHECK (((target_audience)::text = ANY ((ARRAY['all'::character varying, 'churned'::character varying, 'new_users'::character varying, 'free_users'::character varying])::text[])))
);


ALTER TABLE public.promos OWNER TO pnptvbot;

--
-- Name: TABLE promos; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.promos IS 'Promotional offers with audience targeting, spot limits, and expiration dates';


--
-- Name: COLUMN promos.code; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promos.code IS 'Unique promo code used in deep links (e.g., SUMMER50 -> t.me/bot?start=promo_SUMMER50)';


--
-- Name: COLUMN promos.discount_type; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promos.discount_type IS 'percentage = discount off base price, fixed_price = absolute price';


--
-- Name: COLUMN promos.discount_value; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promos.discount_value IS 'For percentage: 0-100. For fixed_price: final price in USD';


--
-- Name: COLUMN promos.target_audience; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promos.target_audience IS 'all = everyone, churned = previous subscribers, new_users = within N days, free_users = never subscribed';


--
-- Name: COLUMN promos.hidden; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.promos.hidden IS 'If true, promo only accessible via deep link, not shown in menus';


--
-- Name: promos_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.promos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promos_id_seq OWNER TO pnptvbot;

--
-- Name: promos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.promos_id_seq OWNED BY public.promos.id;


--
-- Name: radio_history; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    played_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.radio_history OWNER TO pnptvbot;

--
-- Name: radio_now_playing; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_now_playing (
    id integer DEFAULT 1 NOT NULL,
    track_id uuid,
    title character varying(255),
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    started_at timestamp without time zone DEFAULT now(),
    ends_at timestamp without time zone,
    listener_count integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT radio_now_playing_id_check CHECK ((id = 1))
);


ALTER TABLE public.radio_now_playing OWNER TO pnptvbot;

--
-- Name: radio_now_playing_fixed; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_now_playing_fixed (
    id integer DEFAULT 1 NOT NULL,
    track_id uuid,
    title character varying(255),
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    started_at timestamp without time zone DEFAULT now(),
    ends_at timestamp without time zone,
    listener_count integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT radio_now_playing_fixed_id_check CHECK ((id = 1))
);


ALTER TABLE public.radio_now_playing_fixed OWNER TO pnptvbot;

--
-- Name: radio_now_playing_new; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_now_playing_new (
    id integer DEFAULT 1 NOT NULL,
    track_id uuid,
    title character varying(255),
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    started_at timestamp without time zone DEFAULT now(),
    ends_at timestamp without time zone,
    listener_count integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT radio_now_playing_new_id_check CHECK ((id = 1))
);


ALTER TABLE public.radio_now_playing_new OWNER TO pnptvbot;

--
-- Name: radio_queue; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid,
    title text NOT NULL,
    artist text,
    duration integer,
    cover_url text,
    "position" integer DEFAULT 0 NOT NULL,
    added_by character varying(100),
    added_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.radio_queue OWNER TO pnptvbot;

--
-- Name: radio_requests; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    song_name character varying(255) NOT NULL,
    artist character varying(255),
    duration character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    played_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.radio_requests OWNER TO pnptvbot;

--
-- Name: radio_schedule; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_schedule (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    day_of_week integer NOT NULL,
    time_slot character varying(50) NOT NULL,
    program_name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT radio_schedule_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.radio_schedule OWNER TO pnptvbot;

--
-- Name: radio_stations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.radio_stations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    stream_url text NOT NULL,
    website_url text,
    logo_url text,
    genre character varying(100),
    country character varying(100),
    language character varying(50),
    active boolean DEFAULT true,
    featured boolean DEFAULT false,
    listeners_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.radio_stations OWNER TO pnptvbot;

--
-- Name: recurring_payments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.recurring_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) NOT NULL,
    provider character varying(50) DEFAULT 'epayco_cybersource'::character varying,
    transaction_id character varying(255),
    authorization_code character varying(100),
    response_code character varying(50),
    response_message text,
    period_start timestamp without time zone,
    period_end timestamp without time zone,
    attempt_number integer DEFAULT 1,
    next_retry_at timestamp without time zone,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recurring_payments OWNER TO pnptvbot;

--
-- Name: TABLE recurring_payments; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.recurring_payments IS 'Stores payment history for recurring subscriptions';


--
-- Name: recurring_subscriptions; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.recurring_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    plan_id character varying(100),
    card_token character varying(255) NOT NULL,
    card_token_mask character varying(20),
    card_franchise character varying(50),
    customer_id character varying(255),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    billing_interval character varying(20) DEFAULT 'month'::character varying,
    billing_interval_count integer DEFAULT 1,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    next_billing_date timestamp without time zone,
    trial_end timestamp without time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp without time zone,
    cancellation_reason text,
    ended_at timestamp without time zone,
    billing_failures integer DEFAULT 0,
    last_billing_attempt timestamp without time zone,
    last_successful_payment timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recurring_subscriptions OWNER TO pnptvbot;

--
-- Name: TABLE recurring_subscriptions; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.recurring_subscriptions IS 'Stores recurring subscription details for ePayco/Visa Cybersource';


--
-- Name: segment_membership; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.segment_membership (
    id integer NOT NULL,
    segment_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.segment_membership OWNER TO pnptvbot;

--
-- Name: segment_membership_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.segment_membership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.segment_membership_id_seq OWNER TO pnptvbot;

--
-- Name: segment_membership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.segment_membership_id_seq OWNED BY public.segment_membership.id;


--
-- Name: stream_banned_users; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.stream_banned_users (
    id integer NOT NULL,
    stream_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    banned_by character varying(255) NOT NULL,
    banned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason text
);


ALTER TABLE public.stream_banned_users OWNER TO pnptvbot;

--
-- Name: stream_banned_users_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.stream_banned_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_banned_users_id_seq OWNER TO pnptvbot;

--
-- Name: stream_banned_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.stream_banned_users_id_seq OWNED BY public.stream_banned_users.id;


--
-- Name: stream_comments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.stream_comments (
    id character varying(255) NOT NULL,
    stream_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255),
    text text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    likes integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by character varying(255)
);


ALTER TABLE public.stream_comments OWNER TO pnptvbot;

--
-- Name: stream_notifications; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.stream_notifications (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    streamer_id character varying(255) NOT NULL,
    subscribed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notifications_enabled boolean DEFAULT true
);


ALTER TABLE public.stream_notifications OWNER TO pnptvbot;

--
-- Name: stream_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.stream_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_notifications_id_seq OWNER TO pnptvbot;

--
-- Name: stream_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.stream_notifications_id_seq OWNED BY public.stream_notifications.id;


--
-- Name: stream_viewers; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.stream_viewers (
    id integer NOT NULL,
    stream_id uuid NOT NULL,
    viewer_id character varying(255),
    viewer_name character varying(255),
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    left_at timestamp without time zone
);


ALTER TABLE public.stream_viewers OWNER TO pnptvbot;

--
-- Name: stream_viewers_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.stream_viewers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_viewers_id_seq OWNER TO pnptvbot;

--
-- Name: stream_viewers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.stream_viewers_id_seq OWNED BY public.stream_viewers.id;


--
-- Name: subscribers; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.subscribers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    telegram_id character varying(255),
    email character varying(255) NOT NULL,
    name character varying(255),
    plan character varying(100),
    subscription_id character varying(255),
    provider character varying(50) DEFAULT 'epayco'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    last_payment_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subscribers OWNER TO pnptvbot;

--
-- Name: support_topics; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.support_topics (
    user_id character varying(255) NOT NULL,
    thread_id integer NOT NULL,
    thread_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    message_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'open'::character varying,
    assigned_to character varying(255),
    priority character varying(20) DEFAULT 'medium'::character varying,
    category character varying(50),
    language character varying(10),
    first_response_at timestamp without time zone,
    resolution_time timestamp without time zone,
    sla_breached boolean DEFAULT false,
    escalation_level integer DEFAULT 0,
    last_agent_message_at timestamp without time zone,
    user_satisfaction integer,
    feedback text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.support_topics OWNER TO pnptvbot;

--
-- Name: topic_analytics; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.topic_analytics (
    id integer NOT NULL,
    topic_id bigint NOT NULL,
    user_id bigint NOT NULL,
    username character varying(255),
    total_posts integer DEFAULT 0,
    total_media_shared integer DEFAULT 0,
    total_reactions_given integer DEFAULT 0,
    total_reactions_received integer DEFAULT 0,
    total_replies integer DEFAULT 0,
    most_liked_post_id bigint,
    most_liked_post_count integer DEFAULT 0,
    last_post_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.topic_analytics OWNER TO pnptvbot;

--
-- Name: topic_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.topic_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.topic_analytics_id_seq OWNER TO pnptvbot;

--
-- Name: topic_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.topic_analytics_id_seq OWNED BY public.topic_analytics.id;


--
-- Name: topic_configuration; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.topic_configuration (
    topic_id bigint NOT NULL,
    group_id bigint NOT NULL,
    topic_name character varying(255) NOT NULL,
    can_post character varying(50) DEFAULT 'all'::character varying,
    can_reply character varying(50) DEFAULT 'all'::character varying,
    can_react character varying(50) DEFAULT 'all'::character varying,
    required_role character varying(50) DEFAULT 'user'::character varying,
    required_subscription character varying(50) DEFAULT 'free'::character varying,
    media_required boolean DEFAULT false,
    allow_text_only boolean DEFAULT true,
    allow_caption boolean DEFAULT true,
    allowed_media jsonb DEFAULT '["photo", "video", "animation"]'::jsonb,
    allow_stickers boolean DEFAULT true,
    allow_documents boolean DEFAULT false,
    allow_replies boolean DEFAULT true,
    reply_must_quote boolean DEFAULT false,
    allow_text_in_replies boolean DEFAULT true,
    auto_moderate boolean DEFAULT false,
    anti_spam_enabled boolean DEFAULT false,
    anti_flood_enabled boolean DEFAULT false,
    anti_links_enabled boolean DEFAULT false,
    allow_commands boolean DEFAULT true,
    max_posts_per_hour integer DEFAULT 100,
    max_replies_per_hour integer DEFAULT 100,
    cooldown_between_posts integer DEFAULT 0,
    redirect_bot_responses boolean DEFAULT false,
    auto_delete_enabled boolean DEFAULT false,
    auto_delete_after integer DEFAULT 300,
    override_global_deletion boolean DEFAULT false,
    notify_all_on_new_post boolean DEFAULT false,
    auto_pin_admin_messages boolean DEFAULT false,
    auto_pin_duration integer DEFAULT 172800,
    auto_mirror_enabled boolean DEFAULT false,
    mirror_from_general boolean DEFAULT false,
    mirror_format text DEFAULT '📸 From: @{username}\n\n{caption}'::text,
    enable_leaderboard boolean DEFAULT false,
    track_reactions boolean DEFAULT false,
    track_posts boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.topic_configuration OWNER TO pnptvbot;

--
-- Name: topic_violations; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.topic_violations (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    topic_id bigint NOT NULL,
    violation_type character varying(100) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.topic_violations OWNER TO pnptvbot;

--
-- Name: topic_violations_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.topic_violations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.topic_violations_id_seq OWNER TO pnptvbot;

--
-- Name: topic_violations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.topic_violations_id_seq OWNED BY public.topic_violations.id;


--
-- Name: user_broadcast_preferences; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_broadcast_preferences (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    is_opted_out boolean DEFAULT false,
    opted_out_at timestamp without time zone,
    opted_out_reason text,
    max_broadcasts_per_week integer DEFAULT 7,
    max_broadcasts_per_month integer DEFAULT 30,
    broadcasts_received_week integer DEFAULT 0,
    broadcasts_received_month integer DEFAULT 0,
    last_broadcast_at timestamp without time zone,
    preferred_send_hour integer,
    preferred_send_day character varying(50),
    category_preferences jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_broadcast_preferences OWNER TO pnptvbot;

--
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.user_broadcast_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_broadcast_preferences_id_seq OWNER TO pnptvbot;

--
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.user_broadcast_preferences_id_seq OWNED BY public.user_broadcast_preferences.id;


--
-- Name: user_moderation_actions; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_moderation_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    moderator_id character varying(255) NOT NULL,
    action_type character varying(50) NOT NULL,
    reason text,
    duration integer,
    active boolean DEFAULT true,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_moderation_actions OWNER TO pnptvbot;

--
-- Name: user_moderation_history; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_moderation_history (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    telegram_id bigint,
    username character varying(255),
    action_type character varying(20) NOT NULL,
    action_reason character varying(200),
    action_duration character varying(50),
    stream_id character varying(100),
    violation_id character varying(100),
    moderated_by character varying(50),
    moderated_by_telegram_id bigint,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_moderation_history_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['WARN'::character varying, 'MUTE'::character varying, 'BAN'::character varying, 'UNMUTE'::character varying, 'UNBAN'::character varying])::text[])))
);


ALTER TABLE public.user_moderation_history OWNER TO pnptvbot;

--
-- Name: TABLE user_moderation_history; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.user_moderation_history IS 'Tracks moderation actions taken against users';


--
-- Name: user_moderation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.user_moderation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_moderation_history_id_seq OWNER TO pnptvbot;

--
-- Name: user_moderation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.user_moderation_history_id_seq OWNED BY public.user_moderation_history.id;


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_notifications (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    model_id integer,
    notification_type character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['availability'::character varying, 'booking'::character varying, 'message'::character varying, 'promotion'::character varying])::text[])))
);


ALTER TABLE public.user_notifications OWNER TO pnptvbot;

--
-- Name: TABLE user_notifications; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON TABLE public.user_notifications IS 'Manages user notification preferences for availability changes';


--
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.user_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_notifications_id_seq OWNER TO pnptvbot;

--
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.user_notifications_id_seq OWNED BY public.user_notifications.id;


--
-- Name: user_segments; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_segments (
    id integer NOT NULL,
    segment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_by character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    filters jsonb NOT NULL,
    estimated_count integer DEFAULT 0,
    actual_count integer DEFAULT 0,
    last_recalculated_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_segments OWNER TO pnptvbot;

--
-- Name: user_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.user_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_segments_id_seq OWNER TO pnptvbot;

--
-- Name: user_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.user_segments_id_seq OWNED BY public.user_segments.id;


--
-- Name: user_warnings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_warnings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    reason text NOT NULL,
    details text DEFAULT ''::text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_warnings OWNER TO pnptvbot;

--
-- Name: username_history; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.username_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    old_username character varying(255),
    new_username character varying(255),
    group_id character varying(255),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    flagged boolean DEFAULT false,
    flagged_by character varying(255),
    flag_reason text
);


ALTER TABLE public.username_history OWNER TO pnptvbot;

--
-- Name: users; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    username character varying(255),
    first_name character varying(255) NOT NULL,
    last_name character varying(255),
    email character varying(255),
    email_verified boolean DEFAULT false,
    bio text,
    photo_file_id character varying(255),
    photo_updated_at timestamp without time zone,
    interests text[],
    looking_for character varying(200),
    tribe character varying(100),
    city character varying(100),
    country character varying(100),
    instagram character varying(100),
    twitter character varying(100),
    facebook character varying(100),
    tiktok character varying(100),
    youtube character varying(200),
    telegram character varying(100),
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    location_name character varying(255),
    location_geohash character varying(50),
    location_updated_at timestamp without time zone,
    location_sharing_enabled boolean DEFAULT true,
    subscription_status character varying(50) DEFAULT 'free'::character varying,
    plan_id character varying(100),
    plan_expiry timestamp without time zone,
    tier character varying(50) DEFAULT 'free'::character varying,
    role character varying(255) DEFAULT 'user'::character varying,
    assigned_by character varying(255),
    role_assigned_at timestamp without time zone,
    privacy jsonb DEFAULT '{"showBio": true, "showOnline": true, "showLocation": true, "allowMessages": true, "showInterests": true}'::jsonb,
    profile_views integer DEFAULT 0,
    xp integer DEFAULT 0,
    favorites text[] DEFAULT '{}'::text[],
    blocked text[] DEFAULT '{}'::text[],
    badges text[] DEFAULT '{}'::text[],
    onboarding_complete boolean DEFAULT false,
    age_verified boolean DEFAULT false,
    age_verified_at timestamp without time zone,
    age_verification_expires_at timestamp without time zone,
    age_verification_interval_hours integer DEFAULT 168,
    terms_accepted boolean DEFAULT false,
    privacy_accepted boolean DEFAULT false,
    last_active timestamp without time zone,
    last_activity_in_group character varying(255),
    group_activity_log jsonb,
    timezone character varying(100),
    timezone_detected boolean DEFAULT false,
    timezone_updated_at timestamp without time zone,
    language character varying(10) DEFAULT 'en'::character varying,
    is_active boolean DEFAULT true,
    deactivated_at timestamp without time zone,
    deactivation_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    accepted_terms boolean DEFAULT false,
    is_restricted boolean DEFAULT false,
    risk_flags jsonb DEFAULT '[]'::jsonb,
    private_calls_enabled boolean DEFAULT true,
    total_calls_booked integer DEFAULT 0,
    total_calls_completed integer DEFAULT 0,
    last_call_at timestamp with time zone,
    card_token character varying(255),
    card_token_mask character varying(20),
    card_franchise character varying(50),
    auto_renew boolean DEFAULT false,
    subscription_type character varying(50) DEFAULT 'one_time'::character varying,
    recurring_plan_id character varying(100),
    next_billing_date timestamp without time zone,
    billing_failures integer DEFAULT 0,
    last_billing_attempt timestamp without time zone,
    has_seen_tutorial boolean DEFAULT false,
    age_verification_method character varying(50) DEFAULT 'manual'::character varying
);


ALTER TABLE public.users OWNER TO pnptvbot;

--
-- Name: COLUMN users.card_token; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.card_token IS 'Default card token for recurring billing (ePayco)';


--
-- Name: COLUMN users.card_token_mask; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.card_token_mask IS 'Masked card number (e.g., ****4242)';


--
-- Name: COLUMN users.card_franchise; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.card_franchise IS 'Card brand (visa, mastercard, etc.)';


--
-- Name: COLUMN users.auto_renew; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.auto_renew IS 'Whether user has enabled auto-renewal';


--
-- Name: COLUMN users.subscription_type; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.subscription_type IS 'Type of subscription: one_time or recurring';


--
-- Name: COLUMN users.recurring_plan_id; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.recurring_plan_id IS 'Plan ID for recurring subscription';


--
-- Name: COLUMN users.next_billing_date; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.next_billing_date IS 'Next scheduled billing date';


--
-- Name: COLUMN users.billing_failures; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.billing_failures IS 'Number of consecutive billing failures';


--
-- Name: COLUMN users.age_verification_method; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.users.age_verification_method IS 'Method used for age verification: manual, ai_photo, document';


--
-- Name: wall_of_fame_daily_stats; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.wall_of_fame_daily_stats (
    date_key date NOT NULL,
    user_id character varying(255) NOT NULL,
    photos_shared integer DEFAULT 0,
    reactions_received integer DEFAULT 0,
    is_new_member boolean DEFAULT false,
    first_post_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.wall_of_fame_daily_stats OWNER TO pnptvbot;

--
-- Name: wall_of_fame_daily_winners; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.wall_of_fame_daily_winners (
    date_key date NOT NULL,
    legend_user_id character varying(255),
    new_member_user_id character varying(255),
    active_user_id character varying(255),
    processed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.wall_of_fame_daily_winners OWNER TO pnptvbot;

--
-- Name: wall_of_fame_posts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.wall_of_fame_posts (
    id integer NOT NULL,
    group_id bigint NOT NULL,
    message_id bigint NOT NULL,
    user_id character varying(255) NOT NULL,
    date_key date NOT NULL,
    reactions_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.wall_of_fame_posts OWNER TO pnptvbot;

--
-- Name: wall_of_fame_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.wall_of_fame_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wall_of_fame_posts_id_seq OWNER TO pnptvbot;

--
-- Name: wall_of_fame_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.wall_of_fame_posts_id_seq OWNED BY public.wall_of_fame_posts.id;


--
-- Name: warnings; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.warnings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    admin_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cleared boolean DEFAULT false,
    cleared_at timestamp without time zone,
    cleared_by character varying(255),
    expires_at timestamp without time zone
);


ALTER TABLE public.warnings OWNER TO pnptvbot;

--
-- Name: x_accounts; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.x_accounts (
    account_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    x_user_id character varying(40),
    handle character varying(50) NOT NULL,
    display_name character varying(120),
    encrypted_access_token text NOT NULL,
    encrypted_refresh_token text,
    token_expires_at timestamp without time zone,
    created_by bigint,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.x_accounts OWNER TO pnptvbot;

--
-- Name: x_oauth_states; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.x_oauth_states (
    state character varying(64) NOT NULL,
    code_verifier text NOT NULL,
    admin_id bigint,
    admin_username character varying(100),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.x_oauth_states OWNER TO pnptvbot;

--
-- Name: x_post_jobs; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.x_post_jobs (
    post_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    admin_id bigint,
    admin_username character varying(100),
    text text NOT NULL,
    media_url text,
    scheduled_at timestamp without time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    response_json jsonb,
    error_message text,
    retry_count integer DEFAULT 0,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.x_post_jobs OWNER TO pnptvbot;

--
-- Name: COLUMN x_post_jobs.retry_count; Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON COLUMN public.x_post_jobs.retry_count IS 'Number of retry attempts for failed posts';


--
-- Name: age_verification_attempts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.age_verification_attempts ALTER COLUMN id SET DEFAULT nextval('public.age_verification_attempts_id_seq'::regclass);


--
-- Name: broadcast_button_presets preset_id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_button_presets ALTER COLUMN preset_id SET DEFAULT nextval('public.broadcast_button_presets_preset_id_seq'::regclass);


--
-- Name: broadcast_media id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_media ALTER COLUMN id SET DEFAULT nextval('public.broadcast_media_id_seq'::regclass);


--
-- Name: broadcast_queue_jobs id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_queue_jobs ALTER COLUMN id SET DEFAULT nextval('public.broadcast_queue_jobs_id_seq'::regclass);


--
-- Name: broadcast_recipients id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_recipients ALTER COLUMN id SET DEFAULT nextval('public.broadcast_recipients_id_seq'::regclass);


--
-- Name: broadcast_schedules id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_schedules ALTER COLUMN id SET DEFAULT nextval('public.broadcast_schedules_id_seq'::regclass);


--
-- Name: broadcast_templates id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_templates ALTER COLUMN id SET DEFAULT nextval('public.broadcast_templates_id_seq'::regclass);


--
-- Name: broadcasts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcasts ALTER COLUMN id SET DEFAULT nextval('public.broadcasts_id_seq'::regclass);


--
-- Name: community_button_presets id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_button_presets ALTER COLUMN id SET DEFAULT nextval('public.community_button_presets_id_seq'::regclass);


--
-- Name: community_groups id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_groups ALTER COLUMN id SET DEFAULT nextval('public.community_groups_id_seq'::regclass);


--
-- Name: community_post_analytics id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_analytics ALTER COLUMN id SET DEFAULT nextval('public.community_post_analytics_id_seq'::regclass);


--
-- Name: community_post_buttons id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_buttons ALTER COLUMN id SET DEFAULT nextval('public.community_post_buttons_id_seq'::regclass);


--
-- Name: community_post_deliveries id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries ALTER COLUMN id SET DEFAULT nextval('public.community_post_deliveries_id_seq'::regclass);


--
-- Name: community_post_destinations id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_destinations ALTER COLUMN id SET DEFAULT nextval('public.community_post_destinations_id_seq'::regclass);


--
-- Name: community_post_schedules id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_schedules ALTER COLUMN id SET DEFAULT nextval('public.community_post_schedules_id_seq'::regclass);


--
-- Name: community_posts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_posts ALTER COLUMN id SET DEFAULT nextval('public.community_posts_id_seq'::regclass);


--
-- Name: cult_event_registrations id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.cult_event_registrations ALTER COLUMN id SET DEFAULT nextval('public.cult_event_registrations_id_seq'::regclass);


--
-- Name: group_invitations id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_invitations ALTER COLUMN id SET DEFAULT nextval('public.group_invitations_id_seq'::regclass);


--
-- Name: media_shares id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_shares ALTER COLUMN id SET DEFAULT nextval('public.media_shares_id_seq'::regclass);


--
-- Name: meet_greet_bookings id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_bookings ALTER COLUMN id SET DEFAULT nextval('public.meet_greet_bookings_id_seq'::regclass);


--
-- Name: meet_greet_payments id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_payments ALTER COLUMN id SET DEFAULT nextval('public.meet_greet_payments_id_seq'::regclass);


--
-- Name: model_availability id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_availability ALTER COLUMN id SET DEFAULT nextval('public.model_availability_id_seq'::regclass);


--
-- Name: model_bookings id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_bookings ALTER COLUMN id SET DEFAULT nextval('public.model_bookings_id_seq'::regclass);


--
-- Name: model_earnings id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_earnings ALTER COLUMN id SET DEFAULT nextval('public.model_earnings_id_seq'::regclass);


--
-- Name: model_photos id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_photos ALTER COLUMN id SET DEFAULT nextval('public.model_photos_id_seq'::regclass);


--
-- Name: model_reviews id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_reviews ALTER COLUMN id SET DEFAULT nextval('public.model_reviews_id_seq'::regclass);


--
-- Name: models id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.models ALTER COLUMN id SET DEFAULT nextval('public.models_id_seq'::regclass);


--
-- Name: nearby_place_categories id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_categories ALTER COLUMN id SET DEFAULT nextval('public.nearby_place_categories_id_seq'::regclass);


--
-- Name: nearby_place_favorites id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_favorites ALTER COLUMN id SET DEFAULT nextval('public.nearby_place_favorites_id_seq'::regclass);


--
-- Name: nearby_place_reports id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reports ALTER COLUMN id SET DEFAULT nextval('public.nearby_place_reports_id_seq'::regclass);


--
-- Name: nearby_place_reviews id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reviews ALTER COLUMN id SET DEFAULT nextval('public.nearby_place_reviews_id_seq'::regclass);


--
-- Name: nearby_place_submissions id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_submissions ALTER COLUMN id SET DEFAULT nextval('public.nearby_place_submissions_id_seq'::regclass);


--
-- Name: nearby_places id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_places ALTER COLUMN id SET DEFAULT nextval('public.nearby_places_id_seq'::regclass);


--
-- Name: pnp_bookings id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_bookings ALTER COLUMN id SET DEFAULT nextval('public.pnp_bookings_id_seq'::regclass);


--
-- Name: pnp_feedback id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_feedback ALTER COLUMN id SET DEFAULT nextval('public.pnp_feedback_id_seq'::regclass);


--
-- Name: pnp_live_promo_codes id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_codes ALTER COLUMN id SET DEFAULT nextval('public.pnp_live_promo_codes_id_seq'::regclass);


--
-- Name: pnp_live_promo_usage id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_usage ALTER COLUMN id SET DEFAULT nextval('public.pnp_live_promo_usage_id_seq'::regclass);


--
-- Name: pnp_model_blocked_dates id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_blocked_dates ALTER COLUMN id SET DEFAULT nextval('public.pnp_model_blocked_dates_id_seq'::regclass);


--
-- Name: pnp_model_earnings id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_earnings ALTER COLUMN id SET DEFAULT nextval('public.pnp_model_earnings_id_seq'::regclass);


--
-- Name: pnp_model_payouts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_payouts ALTER COLUMN id SET DEFAULT nextval('public.pnp_model_payouts_id_seq'::regclass);


--
-- Name: pnp_model_schedules id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_schedules ALTER COLUMN id SET DEFAULT nextval('public.pnp_model_schedules_id_seq'::regclass);


--
-- Name: pnp_model_status_history id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_status_history ALTER COLUMN id SET DEFAULT nextval('public.pnp_model_status_history_id_seq'::regclass);


--
-- Name: pnp_models id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_models ALTER COLUMN id SET DEFAULT nextval('public.pnp_models_id_seq'::regclass);


--
-- Name: pnp_payments id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_payments ALTER COLUMN id SET DEFAULT nextval('public.pnp_payments_id_seq'::regclass);


--
-- Name: pnp_refunds id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_refunds ALTER COLUMN id SET DEFAULT nextval('public.pnp_refunds_id_seq'::regclass);


--
-- Name: pnp_tips id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_tips ALTER COLUMN id SET DEFAULT nextval('public.pnp_tips_id_seq'::regclass);


--
-- Name: private_calls id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.private_calls ALTER COLUMN id SET DEFAULT nextval('public.private_calls_id_seq'::regclass);


--
-- Name: promo_redemptions id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_redemptions ALTER COLUMN id SET DEFAULT nextval('public.promo_redemptions_id_seq'::regclass);


--
-- Name: promos id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promos ALTER COLUMN id SET DEFAULT nextval('public.promos_id_seq'::regclass);


--
-- Name: segment_membership id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.segment_membership ALTER COLUMN id SET DEFAULT nextval('public.segment_membership_id_seq'::regclass);


--
-- Name: stream_banned_users id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_banned_users ALTER COLUMN id SET DEFAULT nextval('public.stream_banned_users_id_seq'::regclass);


--
-- Name: stream_notifications id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_notifications ALTER COLUMN id SET DEFAULT nextval('public.stream_notifications_id_seq'::regclass);


--
-- Name: stream_viewers id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_viewers ALTER COLUMN id SET DEFAULT nextval('public.stream_viewers_id_seq'::regclass);


--
-- Name: topic_analytics id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_analytics ALTER COLUMN id SET DEFAULT nextval('public.topic_analytics_id_seq'::regclass);


--
-- Name: topic_violations id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_violations ALTER COLUMN id SET DEFAULT nextval('public.topic_violations_id_seq'::regclass);


--
-- Name: user_broadcast_preferences id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_broadcast_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_broadcast_preferences_id_seq'::regclass);


--
-- Name: user_moderation_history id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_moderation_history ALTER COLUMN id SET DEFAULT nextval('public.user_moderation_history_id_seq'::regclass);


--
-- Name: user_notifications id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_notifications ALTER COLUMN id SET DEFAULT nextval('public.user_notifications_id_seq'::regclass);


--
-- Name: user_segments id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_segments ALTER COLUMN id SET DEFAULT nextval('public.user_segments_id_seq'::regclass);


--
-- Name: wall_of_fame_posts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_posts ALTER COLUMN id SET DEFAULT nextval('public.wall_of_fame_posts_id_seq'::regclass);


--
-- Data for Name: activation_codes; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.activation_codes (code, product, used, used_at, used_by, used_by_username, email, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: activation_logs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.activation_logs (id, user_id, username, code, product, activated_at, success) FROM stdin;
\.


--
-- Data for Name: age_verification_attempts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.age_verification_attempts (id, user_id, photo_file_id, estimated_age, confidence, verified, provider, created_at) FROM stdin;
\.


--
-- Data for Name: banned_users; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.banned_users (id, user_id, group_id, reason, banned_by, banned_at, expires_at, active) FROM stdin;
\.


--
-- Data for Name: booking_audit_logs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.booking_audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, old_values, new_values, metadata, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: booking_notifications; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.booking_notifications (id, user_id, booking_id, type, recipient_type, scheduled_for, sent_at, status, payload, error_message, retry_count, created_at) FROM stdin;
\.


--
-- Data for Name: booking_payments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.booking_payments (id, booking_id, provider, provider_payment_id, payment_link, amount_cents, currency, status, expires_at, paid_at, refunded_at, refund_reason, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_slots; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.booking_slots (id, performer_id, start_time_utc, end_time_utc, status, held_by_user_id, hold_expires_at, booking_id, created_at) FROM stdin;
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.bookings (id, user_id, performer_id, slot_id, call_type, duration_minutes, price_cents, currency, start_time_utc, end_time_utc, status, hold_expires_at, cancel_reason, cancelled_by, cancelled_at, completed_at, rules_accepted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bot_addition_attempts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.bot_addition_attempts (id, user_id, group_id, bot_username, bot_id, status, reason, "timestamp") FROM stdin;
\.


--
-- Data for Name: broadcast_button_presets; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_button_presets (preset_id, name, description, icon, buttons, enabled, created_at, updated_at) FROM stdin;
1	Plans Promo	Link to subscription plans page	💎	[{"text": "💎 View Plans", "type": "command", "target": "/plans"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
2	Premium Offer	Direct link to premium plan	⭐	[{"text": "⭐ Get Premium", "type": "plan", "target": "premium"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
3	Support & Share	Support link and share option	🆘	[{"text": "🆘 Get Help", "type": "command", "target": "/support"}, {"text": "📢 Share", "type": "command", "target": "/share"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
4	Features Showcase	Link to app features	✨	[{"text": "✨ Explore Features", "type": "command", "target": "/features"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
5	Community Links	Community engagement buttons	👥	[{"text": "👥 Join Community", "type": "url", "target": "https://t.me/pnptv_community"}, {"text": "📣 Channel", "type": "url", "target": "https://t.me/pnptv_channel"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
6	Engagement Full	All engagement options	🎯	[{"text": "💎 Plans", "type": "command", "target": "/plans"}, {"text": "🆘 Support", "type": "command", "target": "/support"}, {"text": "📢 Share", "type": "command", "target": "/share"}]	t	2026-02-07 14:26:12.737393	2026-02-07 14:26:12.737393
\.


--
-- Data for Name: broadcast_media; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_media (id, media_id, broadcast_id, original_filename, media_type, file_size, mime_type, s3_bucket, s3_key, s3_url, s3_region, telegram_file_id, processing_status, cdn_url, thumbnail_url, duration, width, height, metadata, created_at, updated_at, archived_at) FROM stdin;
\.


--
-- Data for Name: broadcast_queue_jobs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_queue_jobs (id, job_id, queue_name, job_type, job_data, status, attempts, max_attempts, error_message, result, scheduled_at, started_at, completed_at, next_retry_at, created_at, updated_at) FROM stdin;
1	5b72c095-9ecd-4d83-8c1c-141d3ef35a6a	retries	process_retries	{"timestamp": "2026-02-07T15:20:23.467Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:20:23.468	2026-02-07 15:20:23.588	\N	\N	2026-02-07 15:20:23.46871	2026-02-07 15:20:23.593686
28	d69873f3-be89-4398-bad5-35e1ec06341d	retries	process_retries	{"timestamp": "2026-02-07T17:38:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:38:51.315	2026-02-07 17:38:51.845	\N	\N	2026-02-07 17:38:51.315888	2026-02-07 17:38:51.850262
708	553a9cbe-4e62-43f3-afdc-86df44879f3c	retries	process_retries	{"timestamp": "2026-02-10T02:03:51.658Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:03:51.659	2026-02-10 02:03:51.723	\N	\N	2026-02-10 02:03:51.659376	2026-02-10 02:03:51.726488
2	7e7605ca-228f-4d9e-9391-aadf51decdd8	retries	process_retries	{"timestamp": "2026-02-07T15:27:17.371Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:27:17.371	2026-02-07 15:27:17.493	\N	\N	2026-02-07 15:27:17.372283	2026-02-07 15:27:17.499662
29	984425d7-0443-4a8d-8dd9-61f48a85c8f9	retries	process_retries	{"timestamp": "2026-02-07T17:43:51.314Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:43:51.314	2026-02-07 17:43:52.044	\N	\N	2026-02-07 17:43:51.315283	2026-02-07 17:43:52.048702
3	ecc87abc-0018-4f5a-b957-346d684f61a7	retries	process_retries	{"timestamp": "2026-02-07T15:33:51.304Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:33:51.304	2026-02-07 15:33:51.446	\N	\N	2026-02-07 15:33:51.305358	2026-02-07 15:33:51.457016
4	09251e63-7b1d-4fc4-b769-a917f98c1dca	retries	process_retries	{"timestamp": "2026-02-07T15:38:51.305Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:38:51.305	2026-02-07 15:38:51.573	\N	\N	2026-02-07 15:38:51.306029	2026-02-07 15:38:51.577237
30	900a65ef-339c-48d0-bd23-7318bd078a23	retries	process_retries	{"timestamp": "2026-02-07T17:48:51.314Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:48:51.314	2026-02-07 17:48:52.211	\N	\N	2026-02-07 17:48:51.315112	2026-02-07 17:48:52.219709
5	c82e22ce-fb30-46b4-aa5a-842182a2cc73	retries	process_retries	{"timestamp": "2026-02-07T15:43:51.304Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:43:51.304	2026-02-07 15:43:51.702	\N	\N	2026-02-07 15:43:51.305361	2026-02-07 15:43:51.705484
31	dc0f5196-eebd-4c63-bcd1-913b56a60777	retries	process_retries	{"timestamp": "2026-02-07T17:53:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:53:51.315	2026-02-07 17:53:51.386	\N	\N	2026-02-07 17:53:51.31583	2026-02-07 17:53:51.389679
6	524c7cfb-a58e-4cea-882f-d68fae81247f	retries	process_retries	{"timestamp": "2026-02-07T15:48:51.304Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:48:51.304	2026-02-07 15:48:51.905	\N	\N	2026-02-07 15:48:51.30547	2026-02-07 15:48:51.917276
7	f395d40a-1f71-47ee-885d-e2b718d5e208	retries	process_retries	{"timestamp": "2026-02-07T15:53:51.305Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:53:51.305	2026-02-07 15:53:52.098	\N	\N	2026-02-07 15:53:51.306154	2026-02-07 15:53:52.101905
32	283f611e-4cfb-432c-9749-cbcef940dd89	retries	process_retries	{"timestamp": "2026-02-07T17:58:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:58:51.315	2026-02-07 17:58:51.588	\N	\N	2026-02-07 17:58:51.315764	2026-02-07 17:58:51.591463
8	381519ef-600d-4e69-854c-f9993feb822b	retries	process_retries	{"timestamp": "2026-02-07T15:58:51.306Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 15:58:51.306	2026-02-07 15:58:52.281	\N	\N	2026-02-07 15:58:51.307132	2026-02-07 15:58:52.284691
33	07b17030-bfa9-4a84-b0c9-e38827aa16d5	retries	process_retries	{"timestamp": "2026-02-07T18:03:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:03:51.315	2026-02-07 18:03:51.777	\N	\N	2026-02-07 18:03:51.315908	2026-02-07 18:03:51.787531
9	6412cc2a-a895-4e12-a8fd-37cdc9cfaeb2	retries	process_retries	{"timestamp": "2026-02-07T16:03:51.307Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:03:51.307	2026-02-07 16:03:51.439	\N	\N	2026-02-07 16:03:51.307589	2026-02-07 16:03:51.442004
10	60c9b61f-3217-4d4f-a130-eab0bae823bd	retries	process_retries	{"timestamp": "2026-02-07T16:08:51.308Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:08:51.308	2026-02-07 16:08:51.619	\N	\N	2026-02-07 16:08:51.309013	2026-02-07 16:08:51.623245
34	7c1e66ee-b188-4519-8ae9-3fd3f20d467e	retries	process_retries	{"timestamp": "2026-02-07T18:08:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:08:51.316	2026-02-07 18:08:51.927	\N	\N	2026-02-07 18:08:51.316882	2026-02-07 18:08:51.936927
11	416986f3-fe0e-4578-8d27-1143074aa0f1	retries	process_retries	{"timestamp": "2026-02-07T16:13:51.308Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:13:51.308	2026-02-07 16:13:51.796	\N	\N	2026-02-07 16:13:51.309145	2026-02-07 16:13:51.806802
35	3d31a8b1-ab90-4426-96bf-ef59da69c856	retries	process_retries	{"timestamp": "2026-02-07T18:13:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:13:51.316	2026-02-07 18:13:52.094	\N	\N	2026-02-07 18:13:51.316863	2026-02-07 18:13:52.097444
12	0708471c-bd3f-4f56-ac35-2d681d6ad299	retries	process_retries	{"timestamp": "2026-02-07T16:18:51.308Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:18:51.308	2026-02-07 16:18:51.989	\N	\N	2026-02-07 16:18:51.309326	2026-02-07 16:18:51.997847
13	53933857-d102-457c-81bc-59c06e2613a5	retries	process_retries	{"timestamp": "2026-02-07T16:23:51.308Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:23:51.309	2026-02-07 16:23:52.163	\N	\N	2026-02-07 16:23:51.309416	2026-02-07 16:23:52.172206
36	52f942bd-75fd-4b2e-8700-9552022b1a19	retries	process_retries	{"timestamp": "2026-02-07T18:18:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:18:51.316	2026-02-07 18:18:52.269	\N	\N	2026-02-07 18:18:51.316703	2026-02-07 18:18:52.272768
14	2f57f926-3ffa-465c-9569-5540401d71f4	retries	process_retries	{"timestamp": "2026-02-07T16:28:51.309Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:28:51.309	2026-02-07 16:28:51.356	\N	\N	2026-02-07 16:28:51.309955	2026-02-07 16:28:51.359536
15	91f3a9f6-1693-4407-99f9-eb809b7d5fd7	retries	process_retries	{"timestamp": "2026-02-07T16:33:51.310Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:33:51.31	2026-02-07 16:33:51.542	\N	\N	2026-02-07 16:33:51.311131	2026-02-07 16:33:51.55172
16	4cb50cc1-c09a-4b7b-b8c0-43fd2e596e90	retries	process_retries	{"timestamp": "2026-02-07T16:38:51.311Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:38:51.311	2026-02-07 16:38:51.716	\N	\N	2026-02-07 16:38:51.311916	2026-02-07 16:38:51.726261
17	dabae746-bfe7-4416-9301-6b247f4a0275	retries	process_retries	{"timestamp": "2026-02-07T16:43:51.311Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:43:51.311	2026-02-07 16:43:51.9	\N	\N	2026-02-07 16:43:51.312137	2026-02-07 16:43:51.905641
18	c492b104-85d2-4d12-8758-a431f65c5017	retries	process_retries	{"timestamp": "2026-02-07T16:48:51.312Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:48:51.312	2026-02-07 16:48:52.07	\N	\N	2026-02-07 16:48:51.313086	2026-02-07 16:48:52.073866
19	64f2567f-c18d-4d21-8ca9-a290fa4f1a3d	retries	process_retries	{"timestamp": "2026-02-07T16:53:51.313Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:53:51.313	2026-02-07 16:53:52.256	\N	\N	2026-02-07 16:53:51.313644	2026-02-07 16:53:52.259229
20	c02a9182-197e-47a7-95ca-9cd3100dbbe8	retries	process_retries	{"timestamp": "2026-02-07T16:58:51.313Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 16:58:51.313	2026-02-07 16:58:51.432	\N	\N	2026-02-07 16:58:51.314022	2026-02-07 16:58:51.435986
21	f9280ca4-34d4-4d20-b8b2-38f56df3040e	retries	process_retries	{"timestamp": "2026-02-07T17:03:51.313Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:03:51.313	2026-02-07 17:03:51.622	\N	\N	2026-02-07 17:03:51.314324	2026-02-07 17:03:51.632609
22	33aaf192-75e1-4b67-9a8b-830d19adbb0d	retries	process_retries	{"timestamp": "2026-02-07T17:08:51.313Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:08:51.313	2026-02-07 17:08:51.79	\N	\N	2026-02-07 17:08:51.314107	2026-02-07 17:08:51.80022
23	77eb78e6-53f6-4859-b87e-04ddc4879367	retries	process_retries	{"timestamp": "2026-02-07T17:13:51.314Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:13:51.314	2026-02-07 17:13:51.979	\N	\N	2026-02-07 17:13:51.314562	2026-02-07 17:13:51.983099
24	ff00e2b9-eff6-45ce-8057-678eca355f16	retries	process_retries	{"timestamp": "2026-02-07T17:18:51.314Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:18:51.314	2026-02-07 17:18:52.166	\N	\N	2026-02-07 17:18:51.314664	2026-02-07 17:18:52.174511
25	6f9b1d80-aa82-4a34-bee8-58bf8af2acdd	retries	process_retries	{"timestamp": "2026-02-07T17:23:51.314Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:23:51.314	2026-02-07 17:23:51.334	\N	\N	2026-02-07 17:23:51.315188	2026-02-07 17:23:51.337875
26	d60bf721-81df-48cb-9033-92e2cecd805c	retries	process_retries	{"timestamp": "2026-02-07T17:28:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:28:51.315	2026-02-07 17:28:51.48	\N	\N	2026-02-07 17:28:51.315734	2026-02-07 17:28:51.48436
27	377b2a8e-2b5b-4862-ae19-53940b803d2e	retries	process_retries	{"timestamp": "2026-02-07T17:33:51.315Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 17:33:51.315	2026-02-07 17:33:51.657	\N	\N	2026-02-07 17:33:51.315687	2026-02-07 17:33:51.660196
37	4ae2417d-de53-44fa-8c6f-499940c0ae14	retries	process_retries	{"timestamp": "2026-02-07T18:23:51.317Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:23:51.317	2026-02-07 18:23:51.436	\N	\N	2026-02-07 18:23:51.317605	2026-02-07 18:23:51.439491
59	2d91db6f-3508-4dd0-8989-e02c9f9689a3	retries	process_retries	{"timestamp": "2026-02-07T20:13:51.326Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:13:51.326	2026-02-07 20:13:51.453	\N	\N	2026-02-07 20:13:51.327019	2026-02-07 20:13:51.456289
60	cf8d7e85-ab20-4f88-8f4f-8b3b411897fd	retries	process_retries	{"timestamp": "2026-02-07T20:18:51.326Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:18:51.326	2026-02-07 20:18:51.635	\N	\N	2026-02-07 20:18:51.327231	2026-02-07 20:18:51.647378
38	8defb8d9-9e03-4857-9e5c-a6ed92ecbfa4	retries	process_retries	{"timestamp": "2026-02-07T18:28:51.317Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:28:51.317	2026-02-07 18:28:51.614	\N	\N	2026-02-07 18:28:51.317171	2026-02-07 18:28:51.617597
61	9612f607-a73e-4adc-a5b8-eaf863ede47f	retries	process_retries	{"timestamp": "2026-02-07T20:23:51.327Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:23:51.327	2026-02-07 20:23:51.812	\N	\N	2026-02-07 20:23:51.327564	2026-02-07 20:23:51.820554
62	e346ce86-2862-451c-a948-d5ef8ca7df9e	retries	process_retries	{"timestamp": "2026-02-07T20:28:51.328Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:28:51.328	2026-02-07 20:28:52.002	\N	\N	2026-02-07 20:28:51.328977	2026-02-07 20:28:52.007698
39	6a6f5d45-0c72-4bdd-a2bc-5b14f727717b	retries	process_retries	{"timestamp": "2026-02-07T18:33:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:33:51.316	2026-02-07 18:33:51.784	\N	\N	2026-02-07 18:33:51.316889	2026-02-07 18:33:51.788585
386	bae5f13f-be87-4a0c-9ae5-9a702d7d22cc	retries	process_retries	{"timestamp": "2026-02-08T23:23:51.492Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:23:51.492	2026-02-08 23:23:52.421	\N	\N	2026-02-08 23:23:51.492726	2026-02-08 23:23:52.425749
40	a8347426-a4f4-4003-9709-c55f82e00947	retries	process_retries	{"timestamp": "2026-02-07T18:38:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:38:51.316	2026-02-07 18:38:52.001	\N	\N	2026-02-07 18:38:51.317255	2026-02-07 18:38:52.004096
63	4d05f607-ad20-4d7c-8abb-5dfc4e0098e4	retries	process_retries	{"timestamp": "2026-02-07T20:33:51.328Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:33:51.329	2026-02-07 20:33:52.191	\N	\N	2026-02-07 20:33:51.329381	2026-02-07 20:33:52.195065
41	2954b3c5-4d59-4e46-a0ee-396c88c33468	retries	process_retries	{"timestamp": "2026-02-07T18:43:51.317Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:43:51.317	2026-02-07 18:43:52.178	\N	\N	2026-02-07 18:43:51.31751	2026-02-07 18:43:52.182177
64	d333ca35-aab8-4a0e-a473-b5961905fcd3	retries	process_retries	{"timestamp": "2026-02-07T20:38:51.329Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:38:51.329	2026-02-07 20:38:51.389	\N	\N	2026-02-07 20:38:51.329879	2026-02-07 20:38:51.393383
42	8757dd16-25ef-47b7-98b1-74392051b6d4	retries	process_retries	{"timestamp": "2026-02-07T18:48:51.316Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:48:51.316	2026-02-07 18:48:51.368	\N	\N	2026-02-07 18:48:51.317138	2026-02-07 18:48:51.371197
43	b886e2ce-1108-4e9f-9716-5d9ba4dcd8c6	retries	process_retries	{"timestamp": "2026-02-07T18:53:51.317Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:53:51.317	2026-02-07 18:53:51.516	\N	\N	2026-02-07 18:53:51.317756	2026-02-07 18:53:51.519921
65	24d7151d-a13d-4495-85b5-90bca2c0912c	retries	process_retries	{"timestamp": "2026-02-07T20:43:51.330Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:43:51.33	2026-02-07 20:43:51.542	\N	\N	2026-02-07 20:43:51.331105	2026-02-07 20:43:51.546981
44	644c2f37-d0d0-41d2-a7af-624f382442e9	retries	process_retries	{"timestamp": "2026-02-07T18:58:51.318Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 18:58:51.318	2026-02-07 18:58:51.692	\N	\N	2026-02-07 18:58:51.318517	2026-02-07 18:58:51.696073
66	b2186554-270d-433e-8c53-225c8551302a	retries	process_retries	{"timestamp": "2026-02-07T20:48:51.331Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:48:51.331	2026-02-07 20:48:51.758	\N	\N	2026-02-07 20:48:51.33197	2026-02-07 20:48:51.767515
45	ada62f32-1de5-42f2-9974-0131c530bde1	retries	process_retries	{"timestamp": "2026-02-07T19:03:51.318Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:03:51.318	2026-02-07 19:03:51.869	\N	\N	2026-02-07 19:03:51.319089	2026-02-07 19:03:51.879139
46	faf968ae-9193-46cb-b995-9aceb7e915bd	retries	process_retries	{"timestamp": "2026-02-07T19:08:51.319Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:08:51.319	2026-02-07 19:08:52.057	\N	\N	2026-02-07 19:08:51.319487	2026-02-07 19:08:52.069056
67	84dd6a56-4ec1-4e98-be8f-75ece7340f24	retries	process_retries	{"timestamp": "2026-02-07T20:53:51.331Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:53:51.331	2026-02-07 20:53:51.916	\N	\N	2026-02-07 20:53:51.332405	2026-02-07 20:53:51.926792
47	0650e2a3-abc2-447d-88ce-00fef27b3d5c	retries	process_retries	{"timestamp": "2026-02-07T19:13:51.320Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:13:51.32	2026-02-07 19:13:52.234	\N	\N	2026-02-07 19:13:51.320793	2026-02-07 19:13:52.237269
68	86568787-cf1a-4d48-a679-2df3a4173501	retries	process_retries	{"timestamp": "2026-02-07T20:58:51.333Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:58:51.333	2026-02-07 20:58:52.078	\N	\N	2026-02-07 20:58:51.334166	2026-02-07 20:58:52.088444
48	aed97faf-6344-42df-bd4f-1783d3ee4ca0	retries	process_retries	{"timestamp": "2026-02-07T19:18:51.320Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:18:51.32	2026-02-07 19:18:51.435	\N	\N	2026-02-07 19:18:51.320704	2026-02-07 19:18:51.438444
49	df9e9e4a-883a-495c-91d2-d399c67b683b	retries	process_retries	{"timestamp": "2026-02-07T19:23:51.321Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:23:51.321	2026-02-07 19:23:51.625	\N	\N	2026-02-07 19:23:51.321564	2026-02-07 19:23:51.635372
69	7165a7d5-ed58-4962-986d-d32195c5417b	retries	process_retries	{"timestamp": "2026-02-07T21:03:51.334Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:03:51.334	2026-02-07 21:03:52.261	\N	\N	2026-02-07 21:03:51.334531	2026-02-07 21:03:52.265137
50	8fd44512-3e3d-4212-80c6-435d8e08c8a7	retries	process_retries	{"timestamp": "2026-02-07T19:28:51.321Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:28:51.321	2026-02-07 19:28:51.804	\N	\N	2026-02-07 19:28:51.322148	2026-02-07 19:28:51.810132
70	88fb2f06-6eaa-4113-b8da-bb2e2d2bea35	retries	process_retries	{"timestamp": "2026-02-07T21:08:51.334Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:08:51.334	2026-02-07 21:08:51.459	\N	\N	2026-02-07 21:08:51.334732	2026-02-07 21:08:51.463811
51	d0f7a48b-8332-4d8d-8448-abaea3e4e17b	retries	process_retries	{"timestamp": "2026-02-07T19:33:51.321Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:33:51.321	2026-02-07 19:33:51.968	\N	\N	2026-02-07 19:33:51.322371	2026-02-07 19:33:51.971316
52	537aa2bd-f445-45f4-a096-2a858a0880ce	retries	process_retries	{"timestamp": "2026-02-07T19:38:51.322Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:38:51.322	2026-02-07 19:38:52.131	\N	\N	2026-02-07 19:38:51.322852	2026-02-07 19:38:52.134574
71	2c551836-e963-4998-8c7f-51954292a44f	retries	process_retries	{"timestamp": "2026-02-07T21:13:51.334Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:13:51.334	2026-02-07 21:13:51.61	\N	\N	2026-02-07 21:13:51.335148	2026-02-07 21:13:51.620327
53	f2d3f51b-00e1-4c92-90f6-535b15712463	retries	process_retries	{"timestamp": "2026-02-07T19:43:51.322Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:43:51.322	2026-02-07 19:43:52.322	\N	\N	2026-02-07 19:43:51.322771	2026-02-07 19:43:52.326496
72	41af509e-84d1-4075-90c3-69bbb8bd42b1	retries	process_retries	{"timestamp": "2026-02-07T21:18:51.335Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:18:51.335	2026-02-07 21:18:51.808	\N	\N	2026-02-07 21:18:51.336395	2026-02-07 21:18:51.817583
54	0b5ebd76-9ac8-49b5-9286-19da677319e0	retries	process_retries	{"timestamp": "2026-02-07T19:48:51.322Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:48:51.322	2026-02-07 19:48:51.54	\N	\N	2026-02-07 19:48:51.323326	2026-02-07 19:48:51.544649
55	39790e8c-dc4e-465c-b060-bec32fec5a8f	retries	process_retries	{"timestamp": "2026-02-07T19:53:51.323Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:53:51.323	2026-02-07 19:53:51.737	\N	\N	2026-02-07 19:53:51.324091	2026-02-07 19:53:51.746985
73	2a42ebe4-007d-4b83-9220-1fde6cdc1e98	retries	process_retries	{"timestamp": "2026-02-07T21:23:51.335Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:23:51.335	2026-02-07 21:23:51.997	\N	\N	2026-02-07 21:23:51.336015	2026-02-07 21:23:52.00704
56	b2e98099-0e47-4359-bd93-ff2901f0c281	retries	process_retries	{"timestamp": "2026-02-07T19:58:51.324Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 19:58:51.324	2026-02-07 19:58:51.935	\N	\N	2026-02-07 19:58:51.325133	2026-02-07 19:58:51.938585
57	367b756d-adc4-46b7-8b4e-bd890eac5068	retries	process_retries	{"timestamp": "2026-02-07T20:03:51.324Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:03:51.324	2026-02-07 20:03:52.122	\N	\N	2026-02-07 20:03:51.325346	2026-02-07 20:03:52.131186
58	521a1436-a329-4bd2-8735-109f88de24a8	retries	process_retries	{"timestamp": "2026-02-07T20:08:51.325Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 20:08:51.325	2026-02-07 20:08:52.298	\N	\N	2026-02-07 20:08:51.325383	2026-02-07 20:08:52.301645
91	78bce6c9-a5c7-4376-ba58-d65ea4f596dd	retries	process_retries	{"timestamp": "2026-02-07T22:53:51.345Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:53:51.345	2026-02-07 22:53:52.321	\N	\N	2026-02-07 22:53:51.345501	2026-02-07 22:53:52.332968
74	95928c7a-6322-4d76-aee3-766a87386e27	retries	process_retries	{"timestamp": "2026-02-07T21:28:51.335Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:28:51.335	2026-02-07 21:28:52.171	\N	\N	2026-02-07 21:28:51.336248	2026-02-07 21:28:52.185339
92	a02f1772-311e-468b-80a2-43316c6b0fe9	retries	process_retries	{"timestamp": "2026-02-07T22:58:51.345Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:58:51.345	2026-02-07 22:58:51.485	\N	\N	2026-02-07 22:58:51.345999	2026-02-07 22:58:51.494478
93	bc361c59-126f-4fba-92a0-16d7300d9b3f	retries	process_retries	{"timestamp": "2026-02-07T23:03:51.345Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:03:51.345	2026-02-07 23:03:51.644	\N	\N	2026-02-07 23:03:51.346489	2026-02-07 23:03:51.647936
75	4dc4b7f3-04d9-41ee-8b01-3f2cca5a0102	retries	process_retries	{"timestamp": "2026-02-07T21:33:51.337Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:33:51.337	2026-02-07 21:33:51.38	\N	\N	2026-02-07 21:33:51.337599	2026-02-07 21:33:51.383491
94	cdc4d972-a7ae-42c1-90c9-c0fda34d458b	retries	process_retries	{"timestamp": "2026-02-07T23:08:51.347Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:08:51.347	2026-02-07 23:08:51.819	\N	\N	2026-02-07 23:08:51.347671	2026-02-07 23:08:51.829395
76	95ea5d6b-96bd-4d85-9510-9bd3e67083ec	retries	process_retries	{"timestamp": "2026-02-07T21:38:51.336Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:38:51.336	2026-02-07 21:38:51.577	\N	\N	2026-02-07 21:38:51.33715	2026-02-07 21:38:51.585582
95	153392eb-1cf2-47df-984c-c2e913a73ceb	retries	process_retries	{"timestamp": "2026-02-07T23:13:51.346Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:13:51.346	2026-02-07 23:13:52.01	\N	\N	2026-02-07 23:13:51.347273	2026-02-07 23:13:52.019607
77	75314394-f32c-458e-8ff2-48decba8eef2	retries	process_retries	{"timestamp": "2026-02-07T21:43:51.336Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:43:51.336	2026-02-07 21:43:51.726	\N	\N	2026-02-07 21:43:51.337015	2026-02-07 21:43:51.735198
96	14e14923-e1e4-4980-af62-31e74698bd4d	retries	process_retries	{"timestamp": "2026-02-07T23:18:51.347Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:18:51.347	2026-02-07 23:18:52.193	\N	\N	2026-02-07 23:18:51.348113	2026-02-07 23:18:52.20581
78	bb13c029-bcca-490e-8b9d-854e996cd6f7	retries	process_retries	{"timestamp": "2026-02-07T21:48:51.337Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:48:51.337	2026-02-07 21:48:51.902	\N	\N	2026-02-07 21:48:51.33765	2026-02-07 21:48:51.913906
97	3d6086b0-8731-4429-8adc-20efdae377f9	retries	process_retries	{"timestamp": "2026-02-07T23:23:51.347Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:23:51.347	2026-02-07 23:23:51.417	\N	\N	2026-02-07 23:23:51.348239	2026-02-07 23:23:51.421307
79	5d1759f4-3786-4f2a-8573-b2bf0ec30e89	retries	process_retries	{"timestamp": "2026-02-07T21:53:51.336Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:53:51.336	2026-02-07 21:53:52.096	\N	\N	2026-02-07 21:53:51.33732	2026-02-07 21:53:52.106221
80	515406df-a5cc-4df4-8712-d422dd02fea7	retries	process_retries	{"timestamp": "2026-02-07T21:58:51.336Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 21:58:51.336	2026-02-07 21:58:52.272	\N	\N	2026-02-07 21:58:51.336937	2026-02-07 21:58:52.276028
98	eb5c750b-54c0-4717-a19a-747b0c7b81a8	retries	process_retries	{"timestamp": "2026-02-07T23:28:51.349Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:28:51.349	2026-02-07 23:28:51.624	\N	\N	2026-02-07 23:28:51.349535	2026-02-07 23:28:51.635092
81	e601f35a-1bdc-49e7-b905-3522cd2c1e32	retries	process_retries	{"timestamp": "2026-02-07T22:03:51.337Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:03:51.337	2026-02-07 22:03:51.463	\N	\N	2026-02-07 22:03:51.337842	2026-02-07 22:03:51.466215
99	636b0a6b-b68c-4187-9f64-f5140146d0dc	retries	process_retries	{"timestamp": "2026-02-07T23:33:51.348Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:33:51.348	2026-02-07 23:33:51.791	\N	\N	2026-02-07 23:33:51.349367	2026-02-07 23:33:51.801532
82	cb31eacb-3306-46da-a507-88a1c9a5786c	retries	process_retries	{"timestamp": "2026-02-07T22:08:51.338Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:08:51.338	2026-02-07 22:08:51.663	\N	\N	2026-02-07 22:08:51.338491	2026-02-07 22:08:51.672894
83	e96113cb-999f-4bef-b8e5-9167bff547dd	retries	process_retries	{"timestamp": "2026-02-07T22:13:51.339Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:13:51.339	2026-02-07 22:13:51.862	\N	\N	2026-02-07 22:13:51.339767	2026-02-07 22:13:51.870478
100	d7d354a4-00a5-47ea-90e4-7165e2390c84	retries	process_retries	{"timestamp": "2026-02-07T23:38:51.349Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:38:51.349	2026-02-07 23:38:51.938	\N	\N	2026-02-07 23:38:51.349626	2026-02-07 23:38:51.947627
84	cc16d784-3dfd-4c8f-8dff-481dae21f4c9	retries	process_retries	{"timestamp": "2026-02-07T22:18:51.340Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:18:51.34	2026-02-07 22:18:52.014	\N	\N	2026-02-07 22:18:51.340913	2026-02-07 22:18:52.018427
101	4173e00b-42cf-4700-86db-d004e0799b72	retries	process_retries	{"timestamp": "2026-02-07T23:43:51.350Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:43:51.35	2026-02-07 23:43:52.116	\N	\N	2026-02-07 23:43:51.350967	2026-02-07 23:43:52.126785
85	0c53520d-eeee-42c8-93fd-acd07cf3a001	retries	process_retries	{"timestamp": "2026-02-07T22:23:51.341Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:23:51.341	2026-02-07 22:23:52.195	\N	\N	2026-02-07 22:23:51.341705	2026-02-07 22:23:52.206399
86	f223a100-1e26-4323-ac2c-2468f3a1f017	retries	process_retries	{"timestamp": "2026-02-07T22:28:51.342Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:28:51.342	2026-02-07 22:28:51.351	\N	\N	2026-02-07 22:28:51.342614	2026-02-07 22:28:51.354013
102	a8f0c729-f2a4-43d2-850f-78c7cda57154	retries	process_retries	{"timestamp": "2026-02-07T23:48:51.351Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:48:51.351	2026-02-07 23:48:52.306	\N	\N	2026-02-07 23:48:51.3519	2026-02-07 23:48:52.315919
87	16d334ea-8ee2-4c96-8534-038e4292a6e9	retries	process_retries	{"timestamp": "2026-02-07T22:33:51.342Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:33:51.342	2026-02-07 22:33:51.549	\N	\N	2026-02-07 22:33:51.34337	2026-02-07 22:33:51.554523
103	25d25778-3c2c-4883-ab50-6a332207425e	retries	process_retries	{"timestamp": "2026-02-07T23:53:51.351Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:53:51.351	2026-02-07 23:53:51.51	\N	\N	2026-02-07 23:53:51.352245	2026-02-07 23:53:51.520575
88	bc3118c6-e56d-4cd8-9b38-d4cd7762a0c6	retries	process_retries	{"timestamp": "2026-02-07T22:38:51.342Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:38:51.342	2026-02-07 22:38:51.748	\N	\N	2026-02-07 22:38:51.343175	2026-02-07 22:38:51.756616
89	8dede992-1c29-416b-a78b-4b7385d04b59	retries	process_retries	{"timestamp": "2026-02-07T22:43:51.343Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:43:51.343	2026-02-07 22:43:51.954	\N	\N	2026-02-07 22:43:51.343664	2026-02-07 22:43:51.962561
104	1e6638db-bcb4-4849-9eb3-39e2189fc82b	retries	process_retries	{"timestamp": "2026-02-07T23:58:51.351Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 23:58:51.351	2026-02-07 23:58:51.697	\N	\N	2026-02-07 23:58:51.352225	2026-02-07 23:58:51.707335
90	00ed1f22-cdfe-422f-8824-b74991e9802c	retries	process_retries	{"timestamp": "2026-02-07T22:48:51.344Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-07 22:48:51.344	2026-02-07 22:48:52.138	\N	\N	2026-02-07 22:48:51.344431	2026-02-07 22:48:52.148856
105	8e595787-5440-4e2a-b7de-826704f6c21b	retries	process_retries	{"timestamp": "2026-02-08T00:03:51.352Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:03:51.352	2026-02-08 00:03:52.191	\N	\N	2026-02-08 00:03:51.352719	2026-02-08 00:03:52.202396
106	00c1339a-3d62-4a19-9d14-3c40108e3e66	retries	process_retries	{"timestamp": "2026-02-08T00:08:51.352Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:08:51.352	2026-02-08 00:08:52.318	\N	\N	2026-02-08 00:08:51.352697	2026-02-08 00:08:52.329795
107	ec95853e-e394-4f61-86fe-3f65a80db19e	retries	process_retries	{"timestamp": "2026-02-08T00:13:51.351Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:13:51.351	2026-02-08 00:13:51.438	\N	\N	2026-02-08 00:13:51.352226	2026-02-08 00:13:51.442267
108	e908a205-4468-482e-b138-44492fee64c7	retries	process_retries	{"timestamp": "2026-02-08T00:18:51.352Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:18:51.352	2026-02-08 00:18:51.62	\N	\N	2026-02-08 00:18:51.352655	2026-02-08 00:18:51.630828
109	bdccc74b-9549-4857-8373-228739fca764	retries	process_retries	{"timestamp": "2026-02-08T00:23:51.353Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:23:51.353	2026-02-08 00:23:51.806	\N	\N	2026-02-08 00:23:51.353947	2026-02-08 00:23:51.814268
110	649aed57-6701-4ce7-8ca7-9ab4b9633d01	retries	process_retries	{"timestamp": "2026-02-08T00:28:51.354Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:28:51.354	2026-02-08 00:28:51.966	\N	\N	2026-02-08 00:28:51.354208	2026-02-08 00:28:51.976537
128	ab858ace-810c-4d93-ae49-bf4fbeb13964	retries	process_retries	{"timestamp": "2026-02-08T01:58:51.366Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:58:51.366	2026-02-08 01:58:52.159	\N	\N	2026-02-08 01:58:51.366708	2026-02-08 01:58:52.168641
111	6b3f91ea-e6df-45e4-952e-8163ad804795	retries	process_retries	{"timestamp": "2026-02-08T00:33:51.354Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:33:51.354	2026-02-08 00:33:52.14	\N	\N	2026-02-08 00:33:51.355055	2026-02-08 00:33:52.144441
129	4f8eb01a-548c-486d-b901-d0b480d4afdf	cleanup	cleanup_queue	{"daysOld": 7}	completed	1	1	\N	{"success": true, "jobsCleared": 0}	2026-02-08 02:00:00.003	2026-02-08 02:00:00.361	2026-02-08 02:00:00.373157	\N	2026-02-08 02:00:00.003817	2026-02-08 02:00:00.373157
130	b73be8cf-80c8-4060-9486-eabd7b31bfcb	retries	process_retries	{"timestamp": "2026-02-08T02:03:51.366Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:03:51.366	2026-02-08 02:03:52.099	\N	\N	2026-02-08 02:03:51.367386	2026-02-08 02:03:52.109489
112	b8213ae9-d044-4848-85ca-7d92a5c2cefb	retries	process_retries	{"timestamp": "2026-02-08T00:38:51.354Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:38:51.354	2026-02-08 00:38:52.337	\N	\N	2026-02-08 00:38:51.355128	2026-02-08 00:38:52.346943
131	f07f51f7-48ab-4a86-9563-ad147235a765	retries	process_retries	{"timestamp": "2026-02-08T02:08:51.367Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:08:51.367	2026-02-08 02:08:52.278	\N	\N	2026-02-08 02:08:51.367555	2026-02-08 02:08:52.281654
132	a283380b-91b6-4c63-a3ba-dd0a0fca44a1	retries	process_retries	{"timestamp": "2026-02-08T02:13:51.367Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:13:51.367	2026-02-08 02:13:51.461	\N	\N	2026-02-08 02:13:51.367685	2026-02-08 02:13:51.466692
113	e50ee7a1-56f4-4480-aa88-1899921c5630	retries	process_retries	{"timestamp": "2026-02-08T00:43:51.355Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:43:51.355	2026-02-08 00:43:51.503	\N	\N	2026-02-08 00:43:51.355965	2026-02-08 00:43:51.511972
133	ff273703-1936-4d71-bc97-e248fa192ec5	retries	process_retries	{"timestamp": "2026-02-08T02:18:51.367Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:18:51.368	2026-02-08 02:18:51.651	\N	\N	2026-02-08 02:18:51.36848	2026-02-08 02:18:51.662158
134	795f42e6-4b5d-43c2-9b95-0ff986a017bc	retries	process_retries	{"timestamp": "2026-02-08T02:23:51.367Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:23:51.367	2026-02-08 02:23:51.834	\N	\N	2026-02-08 02:23:51.368485	2026-02-08 02:23:51.837648
114	928b4053-abfc-4c95-a5fb-23a2359ee6b5	retries	process_retries	{"timestamp": "2026-02-08T00:48:51.356Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:48:51.356	2026-02-08 00:48:51.699	\N	\N	2026-02-08 00:48:51.357184	2026-02-08 00:48:51.703333
135	a3b99161-e4e0-4a86-84b7-2a072f1587f8	retries	process_retries	{"timestamp": "2026-02-08T02:28:51.368Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:28:51.368	2026-02-08 02:28:52.046	\N	\N	2026-02-08 02:28:51.368798	2026-02-08 02:28:52.057659
136	81f04ef5-9153-400f-98c0-85340ebbc2c6	retries	process_retries	{"timestamp": "2026-02-08T02:33:51.368Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:33:51.368	2026-02-08 02:33:52.189	\N	\N	2026-02-08 02:33:51.369468	2026-02-08 02:33:52.19924
115	e45f96c9-d435-46ae-bb21-d6c99de6afd9	retries	process_retries	{"timestamp": "2026-02-08T00:53:51.356Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:53:51.357	2026-02-08 00:53:51.864	\N	\N	2026-02-08 00:53:51.357465	2026-02-08 00:53:51.873728
137	83b5f624-d637-4056-afc8-ad6590c36955	retries	process_retries	{"timestamp": "2026-02-08T02:38:51.368Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:38:51.368	2026-02-08 02:38:52.344	\N	\N	2026-02-08 02:38:51.369118	2026-02-08 02:38:52.347134
138	91e49152-53e5-4feb-a2d7-af48d41dce7d	retries	process_retries	{"timestamp": "2026-02-08T02:43:51.368Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:43:51.368	2026-02-08 02:43:51.536	\N	\N	2026-02-08 02:43:51.369246	2026-02-08 02:43:51.546784
116	6e53544c-0f30-410c-8833-6bae8a6e2207	retries	process_retries	{"timestamp": "2026-02-08T00:58:51.356Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 00:58:51.356	2026-02-08 00:58:52.02	\N	\N	2026-02-08 00:58:51.356858	2026-02-08 00:58:52.028925
139	1810f9bd-7e63-46eb-ba2e-d600354fd57c	retries	process_retries	{"timestamp": "2026-02-08T02:48:51.369Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:48:51.369	2026-02-08 02:48:51.694	\N	\N	2026-02-08 02:48:51.369876	2026-02-08 02:48:51.707039
140	8ff69320-b43f-42e6-b1a8-e95495462f8f	retries	process_retries	{"timestamp": "2026-02-08T02:53:51.370Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:53:51.37	2026-02-08 02:53:51.909	\N	\N	2026-02-08 02:53:51.371125	2026-02-08 02:53:51.912433
117	22d44029-cafe-46e5-806f-edacffc1156e	retries	process_retries	{"timestamp": "2026-02-08T01:03:51.358Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:03:51.358	2026-02-08 01:03:52.206	\N	\N	2026-02-08 01:03:51.358946	2026-02-08 01:03:52.212345
141	d7d803b4-8df5-4ac6-9d4d-ee5758d45b91	retries	process_retries	{"timestamp": "2026-02-08T02:58:51.371Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 02:58:51.371	2026-02-08 02:58:52.106	\N	\N	2026-02-08 02:58:51.371738	2026-02-08 02:58:52.114833
142	6625b4ed-41df-412f-8c47-1a94662d88ee	retries	process_retries	{"timestamp": "2026-02-08T03:03:51.372Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:03:51.372	2026-02-08 03:03:52.305	\N	\N	2026-02-08 03:03:51.372601	2026-02-08 03:03:52.314048
118	56ba7c5c-6d84-4552-89e6-27b4c1796222	retries	process_retries	{"timestamp": "2026-02-08T01:08:51.359Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:08:51.359	2026-02-08 01:08:51.401	\N	\N	2026-02-08 01:08:51.359949	2026-02-08 01:08:51.405141
143	1e3e4b8c-436f-4858-a18f-8a34aefa127d	retries	process_retries	{"timestamp": "2026-02-08T03:08:51.372Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:08:51.372	2026-02-08 03:08:51.47	\N	\N	2026-02-08 03:08:51.373415	2026-02-08 03:08:51.473287
144	dd156fac-bca1-42cc-a43e-edbf6d1beaf0	retries	process_retries	{"timestamp": "2026-02-08T03:13:51.372Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:13:51.372	2026-02-08 03:13:51.632	\N	\N	2026-02-08 03:13:51.373279	2026-02-08 03:13:51.636107
119	247d0a1c-71dc-42cc-bfaf-c193c7422883	retries	process_retries	{"timestamp": "2026-02-08T01:13:51.359Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:13:51.359	2026-02-08 01:13:51.539	\N	\N	2026-02-08 01:13:51.360218	2026-02-08 01:13:51.549867
145	f205589c-b078-4d13-8a44-73a8f3eb5b59	retries	process_retries	{"timestamp": "2026-02-08T03:18:51.373Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:18:51.373	2026-02-08 03:18:51.8	\N	\N	2026-02-08 03:18:51.373532	2026-02-08 03:18:51.811333
146	92707d65-6521-4731-b352-cffc5b04fb4d	retries	process_retries	{"timestamp": "2026-02-08T03:23:51.374Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:23:51.374	2026-02-08 03:23:51.989	\N	\N	2026-02-08 03:23:51.37505	2026-02-08 03:23:51.998275
120	dc64955f-9b60-46cd-a1c0-cf65c57a03f1	retries	process_retries	{"timestamp": "2026-02-08T01:18:51.361Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:18:51.361	2026-02-08 01:18:51.739	\N	\N	2026-02-08 01:18:51.361896	2026-02-08 01:18:51.74848
147	40cb0bec-753d-4e16-a6cb-51af43d83d75	retries	process_retries	{"timestamp": "2026-02-08T03:28:51.375Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:28:51.375	2026-02-08 03:28:52.18	\N	\N	2026-02-08 03:28:51.375892	2026-02-08 03:28:52.183769
148	5cfcddfc-2fa3-4094-994e-4acbfa7eb215	retries	process_retries	{"timestamp": "2026-02-08T03:33:51.376Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:33:51.376	2026-02-08 03:33:52.353	\N	\N	2026-02-08 03:33:51.376566	2026-02-08 03:33:52.3625
121	f90a84e4-a5e5-42ae-b0c4-41a3289ba9db	retries	process_retries	{"timestamp": "2026-02-08T01:23:51.362Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:23:51.362	2026-02-08 01:23:51.918	\N	\N	2026-02-08 01:23:51.363007	2026-02-08 01:23:51.92829
122	4036f89a-ac65-43a0-bb24-ac8957b1c759	retries	process_retries	{"timestamp": "2026-02-08T01:28:51.363Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:28:51.363	2026-02-08 01:28:52.099	\N	\N	2026-02-08 01:28:51.363862	2026-02-08 01:28:52.107648
123	61fc6af6-3e0a-49c0-b473-33447b1270e9	retries	process_retries	{"timestamp": "2026-02-08T01:33:51.363Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:33:51.363	2026-02-08 01:33:52.3	\N	\N	2026-02-08 01:33:51.364331	2026-02-08 01:33:52.310332
124	10301b19-98e9-4887-8fa1-13f983f97735	retries	process_retries	{"timestamp": "2026-02-08T01:38:51.364Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:38:51.364	2026-02-08 01:38:51.459	\N	\N	2026-02-08 01:38:51.364595	2026-02-08 01:38:51.462944
125	244c95d5-eb55-467a-bbb5-08e42ce1bf2b	retries	process_retries	{"timestamp": "2026-02-08T01:43:51.365Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:43:51.365	2026-02-08 01:43:51.632	\N	\N	2026-02-08 01:43:51.366192	2026-02-08 01:43:51.641152
126	aec1e337-47b1-4da1-8c99-e5f3a9ccb257	retries	process_retries	{"timestamp": "2026-02-08T01:48:51.366Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:48:51.366	2026-02-08 01:48:51.806	\N	\N	2026-02-08 01:48:51.36677	2026-02-08 01:48:51.816937
127	73c68cfb-d330-4250-a315-8257db30d708	retries	process_retries	{"timestamp": "2026-02-08T01:53:51.366Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 01:53:51.366	2026-02-08 01:53:51.997	\N	\N	2026-02-08 01:53:51.366697	2026-02-08 01:53:52.009424
149	3cec0446-c730-46fb-9190-94851b4e4566	retries	process_retries	{"timestamp": "2026-02-08T03:38:51.376Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:38:51.377	2026-02-08 03:38:51.554	\N	\N	2026-02-08 03:38:51.37752	2026-02-08 03:38:51.558316
150	c76929bf-1fd3-4a02-8d78-c1fe8abcbece	retries	process_retries	{"timestamp": "2026-02-08T03:43:51.377Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:43:51.377	2026-02-08 03:43:51.739	\N	\N	2026-02-08 03:43:51.37798	2026-02-08 03:43:51.744345
169	c9aceb42-06ca-4c69-9666-926f7c25c9e4	retries	process_retries	{"timestamp": "2026-02-08T05:18:51.385Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:18:51.385	2026-02-08 05:18:52.169	\N	\N	2026-02-08 05:18:51.386008	2026-02-08 05:18:52.177718
171	53ef9f62-67fc-459d-87ad-91b5397f8db7	retries	process_retries	{"timestamp": "2026-02-08T05:28:51.385Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:28:51.385	2026-02-08 05:28:51.486	\N	\N	2026-02-08 05:28:51.385585	2026-02-08 05:28:51.489665
173	839440cc-ce78-4741-830e-e46a5c82cec7	retries	process_retries	{"timestamp": "2026-02-08T05:38:51.387Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:38:51.387	2026-02-08 05:38:51.864	\N	\N	2026-02-08 05:38:51.38813	2026-02-08 05:38:51.867597
175	0dd0ad91-fc71-4d1a-b537-aba031b25c48	retries	process_retries	{"timestamp": "2026-02-08T05:48:51.387Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:48:51.388	2026-02-08 05:48:52.252	\N	\N	2026-02-08 05:48:51.388372	2026-02-08 05:48:52.261526
177	12ba82e8-0b8d-4c1e-9fcd-a6f46f85dfd8	retries	process_retries	{"timestamp": "2026-02-08T05:58:51.389Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:58:51.389	2026-02-08 05:58:51.649	\N	\N	2026-02-08 05:58:51.389819	2026-02-08 05:58:51.652349
179	20f7810d-d600-4867-b5d1-9e44202a6168	retries	process_retries	{"timestamp": "2026-02-08T06:08:51.391Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:08:51.391	2026-02-08 06:08:51.978	\N	\N	2026-02-08 06:08:51.391729	2026-02-08 06:08:51.982281
181	3675560d-bb00-4f66-9669-6eb1902e10ab	retries	process_retries	{"timestamp": "2026-02-08T06:18:51.391Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:18:51.391	2026-02-08 06:18:52.334	\N	\N	2026-02-08 06:18:51.391798	2026-02-08 06:18:52.344663
183	5b05a75d-a04a-4a2f-99be-6bd5eb18a976	retries	process_retries	{"timestamp": "2026-02-08T06:28:51.391Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:28:51.391	2026-02-08 06:28:51.72	\N	\N	2026-02-08 06:28:51.392226	2026-02-08 06:28:51.730241
185	dcce49d0-bdfe-4b9a-a8dd-9b679359ce6e	retries	process_retries	{"timestamp": "2026-02-08T06:38:51.393Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:38:51.393	2026-02-08 06:38:52.094	\N	\N	2026-02-08 06:38:51.393552	2026-02-08 06:38:52.098368
187	7ed55f4b-2988-4f47-b6fc-7320a120f4e1	retries	process_retries	{"timestamp": "2026-02-08T06:48:51.392Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:48:51.392	2026-02-08 06:48:51.414	\N	\N	2026-02-08 06:48:51.393262	2026-02-08 06:48:51.417881
189	a79e7bb9-4daa-4e1f-a4ba-b13ea70b313f	retries	process_retries	{"timestamp": "2026-02-08T06:58:51.394Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:58:51.394	2026-02-08 06:58:51.765	\N	\N	2026-02-08 06:58:51.395242	2026-02-08 06:58:51.770183
191	e9ade193-e2e0-4311-ac54-69f405fc0f6f	retries	process_retries	{"timestamp": "2026-02-08T07:08:51.396Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:08:51.396	2026-02-08 07:08:52.17	\N	\N	2026-02-08 07:08:51.396662	2026-02-08 07:08:52.179588
193	a2212b5d-f9db-4cfa-b38a-ecf37af23518	retries	process_retries	{"timestamp": "2026-02-08T07:18:51.396Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:18:51.396	2026-02-08 07:18:51.571	\N	\N	2026-02-08 07:18:51.39737	2026-02-08 07:18:51.57497
215	3602a1e5-a4c5-492a-b5af-95a789215915	retries	process_retries	{"timestamp": "2026-02-08T09:08:51.406Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:08:51.406	2026-02-08 09:08:51.411	\N	\N	2026-02-08 09:08:51.407362	2026-02-08 09:08:51.414657
195	74a64677-aef8-4693-b18b-95f938abcdd7	retries	process_retries	{"timestamp": "2026-02-08T07:28:51.398Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:28:51.398	2026-02-08 07:28:51.912	\N	\N	2026-02-08 07:28:51.398911	2026-02-08 07:28:51.916441
217	02588d6d-54f1-44c6-bf0f-f5be94226c89	retries	process_retries	{"timestamp": "2026-02-08T09:18:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:18:51.407	2026-02-08 09:18:51.742	\N	\N	2026-02-08 09:18:51.4082	2026-02-08 09:18:51.74543
197	0ff406f4-9f95-463d-8ac3-0548b49a5c66	retries	process_retries	{"timestamp": "2026-02-08T07:38:51.399Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:38:51.399	2026-02-08 07:38:52.272	\N	\N	2026-02-08 07:38:51.3995	2026-02-08 07:38:52.281332
218	a1aefc5b-7a4e-4636-a454-ea7ad65b34d4	retries	process_retries	{"timestamp": "2026-02-08T09:23:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:23:51.407	2026-02-08 09:23:51.949	\N	\N	2026-02-08 09:23:51.408069	2026-02-08 09:23:51.957081
199	a893f1c9-fc7d-4fa1-b078-f5024d427a97	retries	process_retries	{"timestamp": "2026-02-08T07:48:51.400Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:48:51.4	2026-02-08 07:48:51.627	\N	\N	2026-02-08 07:48:51.400984	2026-02-08 07:48:51.63113
219	01e62579-5338-49ba-b84a-3438cc56d913	retries	process_retries	{"timestamp": "2026-02-08T09:28:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:28:51.407	2026-02-08 09:28:52.131	\N	\N	2026-02-08 09:28:51.408137	2026-02-08 09:28:52.141212
220	cbee070c-2a46-4f00-a927-417b82992cba	retries	process_retries	{"timestamp": "2026-02-08T09:33:51.408Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:33:51.408	2026-02-08 09:33:52.298	\N	\N	2026-02-08 09:33:51.408779	2026-02-08 09:33:52.301874
201	4dc0500f-c6eb-453d-b16e-5bb0fd009b34	retries	process_retries	{"timestamp": "2026-02-08T07:58:51.401Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:58:51.401	2026-02-08 07:58:51.992	\N	\N	2026-02-08 07:58:51.402487	2026-02-08 07:58:51.995369
221	804ad95a-6785-4a6c-a72f-8f90243106c8	retries	process_retries	{"timestamp": "2026-02-08T09:38:51.408Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:38:51.408	2026-02-08 09:38:51.45	\N	\N	2026-02-08 09:38:51.408624	2026-02-08 09:38:51.454482
222	671eb906-09ff-4fd5-9ec4-a4c060e7c71a	retries	process_retries	{"timestamp": "2026-02-08T09:43:51.409Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:43:51.409	2026-02-08 09:43:51.622	\N	\N	2026-02-08 09:43:51.409735	2026-02-08 09:43:51.62585
203	2bbed322-d456-49d7-bfca-c12a210ca44b	retries	process_retries	{"timestamp": "2026-02-08T08:08:51.402Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:08:51.402	2026-02-08 08:08:52.359	\N	\N	2026-02-08 08:08:51.403048	2026-02-08 08:08:52.370777
223	de49ce5d-a9c8-4158-8a44-9b1c3c03430a	retries	process_retries	{"timestamp": "2026-02-08T09:48:51.409Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:48:51.409	2026-02-08 09:48:51.782	\N	\N	2026-02-08 09:48:51.410166	2026-02-08 09:48:51.792947
205	b4465f15-f3b1-489d-b33c-557f2a66f065	retries	process_retries	{"timestamp": "2026-02-08T08:18:51.403Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:18:51.403	2026-02-08 08:18:51.692	\N	\N	2026-02-08 08:18:51.404158	2026-02-08 08:18:51.69559
206	2886b067-2b36-4914-bc59-d6e9b4ca5c67	retries	process_retries	{"timestamp": "2026-02-08T08:23:51.404Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:23:51.404	2026-02-08 08:23:51.861	\N	\N	2026-02-08 08:23:51.404993	2026-02-08 08:23:51.865595
207	7ddc7690-445f-4478-9fe1-50aff5558b0b	retries	process_retries	{"timestamp": "2026-02-08T08:28:51.404Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:28:51.404	2026-02-08 08:28:52.038	\N	\N	2026-02-08 08:28:51.405399	2026-02-08 08:28:52.047165
208	e96a6edd-2472-4d2e-89c6-3ae04cb2c061	retries	process_retries	{"timestamp": "2026-02-08T08:33:51.404Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:33:51.404	2026-02-08 08:33:52.227	\N	\N	2026-02-08 08:33:51.405262	2026-02-08 08:33:52.236285
209	96256a55-502f-48ac-8ce3-5645b1f5286a	retries	process_retries	{"timestamp": "2026-02-08T08:38:51.404Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:38:51.404	2026-02-08 08:38:52.405	\N	\N	2026-02-08 08:38:51.40472	2026-02-08 08:38:52.416365
210	fcacc982-e041-40ec-a65b-e1b65e531ec6	retries	process_retries	{"timestamp": "2026-02-08T08:43:51.405Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:43:51.405	2026-02-08 08:43:51.587	\N	\N	2026-02-08 08:43:51.40588	2026-02-08 08:43:51.592187
211	8ef91012-e56c-42f5-989e-386f3130e79a	retries	process_retries	{"timestamp": "2026-02-08T08:48:51.405Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:48:51.405	2026-02-08 08:48:51.775	\N	\N	2026-02-08 08:48:51.406204	2026-02-08 08:48:51.784734
212	b7ae0035-42b7-4fda-b044-643da4fa4ad4	retries	process_retries	{"timestamp": "2026-02-08T08:53:51.406Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:53:51.406	2026-02-08 08:53:51.941	\N	\N	2026-02-08 08:53:51.406731	2026-02-08 08:53:51.951526
213	d0ec644b-1adf-4644-b233-7c2e48eab267	retries	process_retries	{"timestamp": "2026-02-08T08:58:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:58:51.407	2026-02-08 08:58:52.08	\N	\N	2026-02-08 08:58:51.407657	2026-02-08 08:58:52.084109
214	0cd18f97-a793-481b-b7ff-e2a326b93348	retries	process_retries	{"timestamp": "2026-02-08T09:03:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:03:51.407	2026-02-08 09:03:52.23	\N	\N	2026-02-08 09:03:51.407835	2026-02-08 09:03:52.239021
151	a509c7ca-7551-4050-9ebb-d3a7a9ba7d26	retries	process_retries	{"timestamp": "2026-02-08T03:48:51.378Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:48:51.378	2026-02-08 03:48:51.904	\N	\N	2026-02-08 03:48:51.378925	2026-02-08 03:48:51.916227
170	6527bb4a-ac41-4b90-a9a2-45136a54b975	retries	process_retries	{"timestamp": "2026-02-08T05:23:51.385Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:23:51.385	2026-02-08 05:23:52.331	\N	\N	2026-02-08 05:23:51.386423	2026-02-08 05:23:52.335492
152	658b1249-e3ab-40e3-bd51-55c8e0e89bde	retries	process_retries	{"timestamp": "2026-02-08T03:53:51.379Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:53:51.379	2026-02-08 03:53:52.069	\N	\N	2026-02-08 03:53:51.379591	2026-02-08 03:53:52.080324
216	fe928503-88b7-41ba-b595-547ebf8f78f8	retries	process_retries	{"timestamp": "2026-02-08T09:13:51.407Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:13:51.407	2026-02-08 09:13:51.577	\N	\N	2026-02-08 09:13:51.407513	2026-02-08 09:13:51.581427
153	b28c21db-7a4c-4f11-93dd-e65c32768925	retries	process_retries	{"timestamp": "2026-02-08T03:58:51.379Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 03:58:51.379	2026-02-08 03:58:52.25	\N	\N	2026-02-08 03:58:51.379522	2026-02-08 03:58:52.262036
172	152c10ed-3ed8-4c97-a669-4172df69a11f	retries	process_retries	{"timestamp": "2026-02-08T05:33:51.386Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:33:51.386	2026-02-08 05:33:51.664	\N	\N	2026-02-08 05:33:51.386966	2026-02-08 05:33:51.667927
154	33f2180b-cacb-45d6-8388-46c730dc9d38	retries	process_retries	{"timestamp": "2026-02-08T04:03:51.379Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:03:51.379	2026-02-08 04:03:51.413	\N	\N	2026-02-08 04:03:51.38003	2026-02-08 04:03:51.416493
174	eac475ec-8e13-4037-aa1f-f356d4c17848	retries	process_retries	{"timestamp": "2026-02-08T05:43:51.388Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:43:51.388	2026-02-08 05:43:52.076	\N	\N	2026-02-08 05:43:51.388552	2026-02-08 05:43:52.079669
155	133e1bda-5ddb-474a-87d8-478fd4dc8a92	retries	process_retries	{"timestamp": "2026-02-08T04:08:51.380Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:08:51.38	2026-02-08 04:08:51.607	\N	\N	2026-02-08 04:08:51.380705	2026-02-08 04:08:51.61174
156	6e3709ce-4f4f-48c8-8e22-372d8d2c2ca4	retries	process_retries	{"timestamp": "2026-02-08T04:13:51.380Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:13:51.38	2026-02-08 04:13:51.794	\N	\N	2026-02-08 04:13:51.380908	2026-02-08 04:13:51.803017
176	845bcdf3-66cd-4ccd-8794-d37be5390b87	retries	process_retries	{"timestamp": "2026-02-08T05:53:51.389Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:53:51.389	2026-02-08 05:53:51.46	\N	\N	2026-02-08 05:53:51.389661	2026-02-08 05:53:51.46459
157	404f2ea5-b61e-4135-8047-3f18063cd0a4	retries	process_retries	{"timestamp": "2026-02-08T04:18:51.380Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:18:51.38	2026-02-08 04:18:51.973	\N	\N	2026-02-08 04:18:51.381349	2026-02-08 04:18:51.982724
178	b01464e9-1f65-49f1-af8b-7163fe8b787e	retries	process_retries	{"timestamp": "2026-02-08T06:03:51.390Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:03:51.39	2026-02-08 06:03:51.809	\N	\N	2026-02-08 06:03:51.390938	2026-02-08 06:03:51.819086
158	834e1b51-2548-44eb-9854-8ceba9f7e747	retries	process_retries	{"timestamp": "2026-02-08T04:23:51.381Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:23:51.381	2026-02-08 04:23:52.128	\N	\N	2026-02-08 04:23:51.38161	2026-02-08 04:23:52.133119
159	4af9c4b6-a8d8-4a6c-993d-7e384722e903	retries	process_retries	{"timestamp": "2026-02-08T04:28:51.382Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:28:51.382	2026-02-08 04:28:52.342	\N	\N	2026-02-08 04:28:51.382794	2026-02-08 04:28:52.353434
180	bc6c240d-11c5-489c-9230-b2c518aa3cfb	retries	process_retries	{"timestamp": "2026-02-08T06:13:51.390Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:13:51.39	2026-02-08 06:13:52.143	\N	\N	2026-02-08 06:13:51.391372	2026-02-08 06:13:52.154285
160	25c77e4c-4c45-4584-a69d-e0d74829e9eb	retries	process_retries	{"timestamp": "2026-02-08T04:33:51.382Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:33:51.382	2026-02-08 04:33:51.531	\N	\N	2026-02-08 04:33:51.38306	2026-02-08 04:33:51.535316
182	89eb576f-7c62-44d8-be14-91ae70d3cbd0	retries	process_retries	{"timestamp": "2026-02-08T06:23:51.391Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:23:51.391	2026-02-08 06:23:51.507	\N	\N	2026-02-08 06:23:51.39242	2026-02-08 06:23:51.511631
161	abbcb162-51fb-4fa9-98e7-2ea78d151a8a	retries	process_retries	{"timestamp": "2026-02-08T04:38:51.383Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:38:51.383	2026-02-08 04:38:51.702	\N	\N	2026-02-08 04:38:51.384108	2026-02-08 04:38:51.706082
162	bb80bb75-9dd1-40c3-8c84-f8d5918a6a8d	retries	process_retries	{"timestamp": "2026-02-08T04:43:51.384Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:43:51.384	2026-02-08 04:43:51.904	\N	\N	2026-02-08 04:43:51.384903	2026-02-08 04:43:51.915519
184	026c4a71-ee49-45c6-baf2-89a1d87c37af	retries	process_retries	{"timestamp": "2026-02-08T06:33:51.392Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:33:51.392	2026-02-08 06:33:51.915	\N	\N	2026-02-08 06:33:51.392887	2026-02-08 06:33:51.925028
163	883b011f-2b5e-43a1-9e9a-9e704017ff03	retries	process_retries	{"timestamp": "2026-02-08T04:48:51.384Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:48:51.384	2026-02-08 04:48:52.062	\N	\N	2026-02-08 04:48:51.38456	2026-02-08 04:48:52.072411
186	0d188804-38e5-4ffb-9186-4748494a5a19	retries	process_retries	{"timestamp": "2026-02-08T06:43:51.393Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:43:51.393	2026-02-08 06:43:52.247	\N	\N	2026-02-08 06:43:51.393707	2026-02-08 06:43:52.250999
164	4f23c13c-61f6-4f01-9878-7c94bea84e8d	retries	process_retries	{"timestamp": "2026-02-08T04:53:51.384Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:53:51.384	2026-02-08 04:53:52.217	\N	\N	2026-02-08 04:53:51.384659	2026-02-08 04:53:52.220669
165	38581178-e77f-4280-93c2-3cffc723493a	retries	process_retries	{"timestamp": "2026-02-08T04:58:51.384Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 04:58:51.384	2026-02-08 04:58:51.411	\N	\N	2026-02-08 04:58:51.384707	2026-02-08 04:58:51.415255
188	c4b0a0a5-7149-450f-8297-12df9e75156b	retries	process_retries	{"timestamp": "2026-02-08T06:53:51.393Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 06:53:51.393	2026-02-08 06:53:51.596	\N	\N	2026-02-08 06:53:51.394126	2026-02-08 06:53:51.599193
166	b6bd3045-3b48-4d3f-b229-bc39ad500283	retries	process_retries	{"timestamp": "2026-02-08T05:03:51.384Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:03:51.384	2026-02-08 05:03:51.606	\N	\N	2026-02-08 05:03:51.384905	2026-02-08 05:03:51.609772
190	909490b6-5ac5-4758-adfe-789a3cddd4fb	retries	process_retries	{"timestamp": "2026-02-08T07:03:51.395Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:03:51.395	2026-02-08 07:03:51.998	\N	\N	2026-02-08 07:03:51.395964	2026-02-08 07:03:52.008398
167	80dc3b27-7434-40ed-8959-1c7a1247a8d4	retries	process_retries	{"timestamp": "2026-02-08T05:08:51.385Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:08:51.385	2026-02-08 05:08:51.794	\N	\N	2026-02-08 05:08:51.385954	2026-02-08 05:08:51.796966
168	f4f9a12b-96fa-4ce5-9e52-707ea2456fc9	retries	process_retries	{"timestamp": "2026-02-08T05:13:51.385Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 05:13:51.385	2026-02-08 05:13:51.979	\N	\N	2026-02-08 05:13:51.386187	2026-02-08 05:13:51.989487
192	5762c31b-b03b-43c6-87ef-581503954d87	retries	process_retries	{"timestamp": "2026-02-08T07:13:51.397Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:13:51.397	2026-02-08 07:13:52.357	\N	\N	2026-02-08 07:13:51.397484	2026-02-08 07:13:52.367253
194	79267e76-21ac-43cb-af24-63b3c10d40e1	retries	process_retries	{"timestamp": "2026-02-08T07:23:51.397Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:23:51.397	2026-02-08 07:23:51.743	\N	\N	2026-02-08 07:23:51.397941	2026-02-08 07:23:51.746392
196	b9c63ec2-e4a0-4f7e-975e-8d615e49c9e1	retries	process_retries	{"timestamp": "2026-02-08T07:33:51.398Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:33:51.398	2026-02-08 07:33:52.096	\N	\N	2026-02-08 07:33:51.39894	2026-02-08 07:33:52.106695
198	e56363e8-5d27-4860-b577-4130fed54596	retries	process_retries	{"timestamp": "2026-02-08T07:43:51.398Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:43:51.398	2026-02-08 07:43:51.427	\N	\N	2026-02-08 07:43:51.399368	2026-02-08 07:43:51.431236
200	e0954885-889e-4f68-99b9-ffa63cbb030a	retries	process_retries	{"timestamp": "2026-02-08T07:53:51.401Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 07:53:51.401	2026-02-08 07:53:51.802	\N	\N	2026-02-08 07:53:51.402017	2026-02-08 07:53:51.812283
202	9bd6b3f5-bc53-4089-a150-cdd23cd5099c	retries	process_retries	{"timestamp": "2026-02-08T08:03:51.402Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:03:51.402	2026-02-08 08:03:52.202	\N	\N	2026-02-08 08:03:51.40308	2026-02-08 08:03:52.204559
204	a1a22b42-e18f-4233-af04-a41b6a5fe5e8	retries	process_retries	{"timestamp": "2026-02-08T08:13:51.402Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 08:13:51.402	2026-02-08 08:13:51.523	\N	\N	2026-02-08 08:13:51.403233	2026-02-08 08:13:51.527329
224	7e46f642-2d0b-498e-ae1e-8a0821b39f16	retries	process_retries	{"timestamp": "2026-02-08T09:53:51.409Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:53:51.409	2026-02-08 09:53:51.989	\N	\N	2026-02-08 09:53:51.410309	2026-02-08 09:53:51.992632
225	c297e414-aa23-41da-8329-731f838a5c44	retries	process_retries	{"timestamp": "2026-02-08T09:58:51.410Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 09:58:51.41	2026-02-08 09:58:52.172	\N	\N	2026-02-08 09:58:51.411218	2026-02-08 09:58:52.183515
266	bd35a1cd-c3c0-4031-97ed-d99dde3f1f46	retries	process_retries	{"timestamp": "2026-02-08T13:23:51.432Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:23:51.432	2026-02-08 13:23:51.567	\N	\N	2026-02-08 13:23:51.433115	2026-02-08 13:23:51.570734
268	60c9b211-d4dc-4ab7-9e0c-20e4903d4dac	retries	process_retries	{"timestamp": "2026-02-08T13:33:51.433Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:33:51.433	2026-02-08 13:33:51.936	\N	\N	2026-02-08 13:33:51.433891	2026-02-08 13:33:51.939917
270	527f899c-cef0-4ca3-834f-c609c3e7e681	retries	process_retries	{"timestamp": "2026-02-08T13:43:51.434Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:43:51.434	2026-02-08 13:43:52.305	\N	\N	2026-02-08 13:43:51.434524	2026-02-08 13:43:52.31407
272	8ca2196d-2812-4e0b-9619-0ceebf003d38	retries	process_retries	{"timestamp": "2026-02-08T13:53:51.433Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:53:51.433	2026-02-08 13:53:51.63	\N	\N	2026-02-08 13:53:51.434309	2026-02-08 13:53:51.633935
274	d8599e0d-d698-44ff-bd6f-629d0bf4ae28	retries	process_retries	{"timestamp": "2026-02-08T14:03:51.434Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:03:51.434	2026-02-08 14:03:51.974	\N	\N	2026-02-08 14:03:51.43462	2026-02-08 14:03:51.977911
276	4664c909-cf11-4066-b122-567aa6af865e	retries	process_retries	{"timestamp": "2026-02-08T14:13:51.434Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:13:51.434	2026-02-08 14:13:52.358	\N	\N	2026-02-08 14:13:51.435275	2026-02-08 14:13:52.367726
322	25fa5cf4-18ac-444d-b1ff-cec69a8a5312	retries	process_retries	{"timestamp": "2026-02-08T18:03:51.456Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:03:51.456	2026-02-08 18:03:51.735	\N	\N	2026-02-08 18:03:51.457296	2026-02-08 18:03:51.738203
278	383baa84-6492-4098-acaf-f273a3ee3f42	retries	process_retries	{"timestamp": "2026-02-08T14:23:51.437Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:23:51.437	2026-02-08 14:23:51.71	\N	\N	2026-02-08 14:23:51.437986	2026-02-08 14:23:51.713284
324	611f131f-1bac-4b12-b5c0-4a01819f18bf	retries	process_retries	{"timestamp": "2026-02-08T18:13:51.457Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:13:51.457	2026-02-08 18:13:52.09	\N	\N	2026-02-08 18:13:51.458143	2026-02-08 18:13:52.10068
326	b4e7b30d-c2b3-409a-b3e1-c4877eff85f3	retries	process_retries	{"timestamp": "2026-02-08T18:23:51.457Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:23:51.457	2026-02-08 18:23:52.456	\N	\N	2026-02-08 18:23:51.457947	2026-02-08 18:23:52.460294
280	9738bc98-2b1a-4344-bf7d-4b336a2a45b8	retries	process_retries	{"timestamp": "2026-02-08T14:33:51.438Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:33:51.438	2026-02-08 14:33:52.053	\N	\N	2026-02-08 14:33:51.439378	2026-02-08 14:33:52.056925
328	4fb29708-74f0-483a-ad52-2935f66e67e4	retries	process_retries	{"timestamp": "2026-02-08T18:33:51.459Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:33:51.459	2026-02-08 18:33:51.822	\N	\N	2026-02-08 18:33:51.459912	2026-02-08 18:33:51.826117
282	248e3674-a8bd-4774-9078-58fe4b8072f6	retries	process_retries	{"timestamp": "2026-02-08T14:43:51.438Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:43:51.438	2026-02-08 14:43:52.398	\N	\N	2026-02-08 14:43:51.439223	2026-02-08 14:43:52.408117
330	b4ac07af-3074-45b0-887b-203d53a50427	retries	process_retries	{"timestamp": "2026-02-08T18:43:51.461Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:43:51.461	2026-02-08 18:43:52.207	\N	\N	2026-02-08 18:43:51.461574	2026-02-08 18:43:52.21655
284	0b866f53-6d81-446b-b835-1908e4f115bd	retries	process_retries	{"timestamp": "2026-02-08T14:53:51.440Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:53:51.44	2026-02-08 14:53:51.698	\N	\N	2026-02-08 14:53:51.440875	2026-02-08 14:53:51.701612
331	b695689a-89f3-463f-bdd2-67734363d647	retries	process_retries	{"timestamp": "2026-02-08T18:48:51.462Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:48:51.462	2026-02-08 18:48:52.369	\N	\N	2026-02-08 18:48:51.463368	2026-02-08 18:48:52.379551
286	0bafc092-7a09-4791-8598-ac4635a79e3d	retries	process_retries	{"timestamp": "2026-02-08T15:03:51.439Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:03:51.439	2026-02-08 15:03:52.038	\N	\N	2026-02-08 15:03:51.440353	2026-02-08 15:03:52.041682
332	3da6c998-aa6d-4348-8a93-0883738e85b4	retries	process_retries	{"timestamp": "2026-02-08T18:53:51.463Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:53:51.463	2026-02-08 18:53:51.517	\N	\N	2026-02-08 18:53:51.463792	2026-02-08 18:53:51.520058
288	373b177e-964c-4e3d-a2bf-094492ef0b15	retries	process_retries	{"timestamp": "2026-02-08T15:13:51.440Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:13:51.44	2026-02-08 15:13:51.482	\N	\N	2026-02-08 15:13:51.441418	2026-02-08 15:13:51.485859
290	f0579250-b6b3-442c-8e37-43c4657b22cc	retries	process_retries	{"timestamp": "2026-02-08T15:23:51.442Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:23:51.442	2026-02-08 15:23:51.774	\N	\N	2026-02-08 15:23:51.443017	2026-02-08 15:23:51.77777
292	28aff2fb-84ff-480e-8adb-a007c93a7dcc	retries	process_retries	{"timestamp": "2026-02-08T15:33:51.444Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:33:51.444	2026-02-08 15:33:52.078	\N	\N	2026-02-08 15:33:51.44483	2026-02-08 15:33:52.081756
294	4cecc848-eb5b-468e-a24a-c4d499213b10	retries	process_retries	{"timestamp": "2026-02-08T15:43:51.444Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:43:51.444	2026-02-08 15:43:51.483	\N	\N	2026-02-08 15:43:51.445043	2026-02-08 15:43:51.487336
296	930717ba-f2c5-4a41-aef0-1ef54e63ec07	retries	process_retries	{"timestamp": "2026-02-08T15:53:51.445Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:53:51.445	2026-02-08 15:53:51.881	\N	\N	2026-02-08 15:53:51.446047	2026-02-08 15:53:51.884372
298	1d9be40c-cd37-4842-b0e1-afd0d72465ae	retries	process_retries	{"timestamp": "2026-02-08T16:03:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:03:51.447	2026-02-08 16:03:52.194	\N	\N	2026-02-08 16:03:51.447691	2026-02-08 16:03:52.197973
300	4e341cc9-8c7b-4614-bd55-4e10bfeb5daa	retries	process_retries	{"timestamp": "2026-02-08T16:13:51.446Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:13:51.446	2026-02-08 16:13:51.533	\N	\N	2026-02-08 16:13:51.447081	2026-02-08 16:13:51.538068
302	4962adb1-02ae-442a-be0d-af32acf85a20	retries	process_retries	{"timestamp": "2026-02-08T16:23:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:23:51.447	2026-02-08 16:23:51.877	\N	\N	2026-02-08 16:23:51.447486	2026-02-08 16:23:51.880202
304	90d97c51-5e83-4f57-8b56-aa6a0d21e206	retries	process_retries	{"timestamp": "2026-02-08T16:33:51.448Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:33:51.448	2026-02-08 16:33:52.267	\N	\N	2026-02-08 16:33:51.448673	2026-02-08 16:33:52.272123
306	a9ba9207-da4f-4055-8741-0c4e13d8abd7	retries	process_retries	{"timestamp": "2026-02-08T16:43:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:43:51.447	2026-02-08 16:43:51.597	\N	\N	2026-02-08 16:43:51.448345	2026-02-08 16:43:51.600766
308	dbdcde59-9bae-49d4-be66-a70532f67d7b	retries	process_retries	{"timestamp": "2026-02-08T16:53:51.448Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:53:51.448	2026-02-08 16:53:51.938	\N	\N	2026-02-08 16:53:51.449314	2026-02-08 16:53:51.944834
310	6f41cfdd-ec78-44cb-89f3-6029e6b2edd1	retries	process_retries	{"timestamp": "2026-02-08T17:03:51.449Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:03:51.449	2026-02-08 17:03:52.297	\N	\N	2026-02-08 17:03:51.450395	2026-02-08 17:03:52.301222
312	68987388-effb-4e80-b33f-a93a206847f9	retries	process_retries	{"timestamp": "2026-02-08T17:13:51.451Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:13:51.451	2026-02-08 17:13:51.672	\N	\N	2026-02-08 17:13:51.451671	2026-02-08 17:13:51.675358
314	4dd24bef-a11a-454a-b0d0-75e3563f8580	retries	process_retries	{"timestamp": "2026-02-08T17:23:51.452Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:23:51.452	2026-02-08 17:23:52.328	\N	\N	2026-02-08 17:23:51.452816	2026-02-08 17:23:52.331608
316	ff9daa99-9d4a-429c-bff8-6b8ea3950ed3	retries	process_retries	{"timestamp": "2026-02-08T17:33:51.453Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:33:51.453	2026-02-08 17:33:51.67	\N	\N	2026-02-08 17:33:51.454487	2026-02-08 17:33:51.673476
318	56e91e54-3b7e-48ec-b517-5c6ce9c2c1fa	retries	process_retries	{"timestamp": "2026-02-08T17:43:51.455Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:43:51.455	2026-02-08 17:43:51.99	\N	\N	2026-02-08 17:43:51.455838	2026-02-08 17:43:51.994044
320	6ece29a4-7e06-47bf-bc8a-cbb8ccb331d5	retries	process_retries	{"timestamp": "2026-02-08T17:53:51.455Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:53:51.455	2026-02-08 17:53:52.383	\N	\N	2026-02-08 17:53:51.456224	2026-02-08 17:53:52.38642
383	8e5d2a6f-9b9e-484b-9cae-84b9bde16c43	retries	process_retries	{"timestamp": "2026-02-08T23:08:51.490Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:08:51.49	2026-02-08 23:08:51.735	\N	\N	2026-02-08 23:08:51.490584	2026-02-08 23:08:51.738963
226	41fc6bdf-6d74-4cce-9eba-c35944e4ed97	retries	process_retries	{"timestamp": "2026-02-08T10:03:51.411Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:03:51.411	2026-02-08 10:03:52.341	\N	\N	2026-02-08 10:03:51.412042	2026-02-08 10:03:52.371848
227	3c129ea7-2a54-4b61-ae72-dc27e278189a	retries	process_retries	{"timestamp": "2026-02-08T10:08:51.410Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:08:51.41	2026-02-08 10:08:51.516	\N	\N	2026-02-08 10:08:51.411246	2026-02-08 10:08:51.528794
228	6cb17d35-0576-4b54-8e2d-66b9150e6ab0	retries	process_retries	{"timestamp": "2026-02-08T10:13:51.411Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:13:51.411	2026-02-08 10:13:51.692	\N	\N	2026-02-08 10:13:51.411596	2026-02-08 10:13:51.695706
229	598764ff-cca9-4c24-855d-e0035d72bab8	retries	process_retries	{"timestamp": "2026-02-08T10:18:51.412Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:18:51.412	2026-02-08 10:18:51.866	\N	\N	2026-02-08 10:18:51.413146	2026-02-08 10:18:51.870789
230	b16515c9-8e27-4a6c-acf9-cf793d703653	retries	process_retries	{"timestamp": "2026-02-08T10:23:51.412Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:23:51.413	2026-02-08 10:23:52.017	\N	\N	2026-02-08 10:23:51.413509	2026-02-08 10:23:52.020718
231	d6075bf9-53d0-46f7-9116-4e9f2dfb03a4	retries	process_retries	{"timestamp": "2026-02-08T10:28:51.413Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:28:51.413	2026-02-08 10:28:52.196	\N	\N	2026-02-08 10:28:51.413575	2026-02-08 10:28:52.206064
232	10b1ae8f-002d-46f2-aefb-793e035e7898	retries	process_retries	{"timestamp": "2026-02-08T10:33:51.414Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:33:51.414	2026-02-08 10:33:52.379	\N	\N	2026-02-08 10:33:51.414746	2026-02-08 10:33:52.387603
233	b3c5e1ab-0adc-4980-aa55-dfdcae879b7f	retries	process_retries	{"timestamp": "2026-02-08T10:38:51.414Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:38:51.414	2026-02-08 10:38:51.58	\N	\N	2026-02-08 10:38:51.414727	2026-02-08 10:38:51.584848
234	bbe1b840-0385-4d8b-83b6-8ce6a24f8c3f	retries	process_retries	{"timestamp": "2026-02-08T10:43:51.413Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:43:51.413	2026-02-08 10:43:51.755	\N	\N	2026-02-08 10:43:51.4142	2026-02-08 10:43:51.758608
235	6082bafa-692a-466a-b14f-698642281676	retries	process_retries	{"timestamp": "2026-02-08T10:48:51.414Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:48:51.414	2026-02-08 10:48:51.922	\N	\N	2026-02-08 10:48:51.414928	2026-02-08 10:48:51.930479
236	3efa4ccb-a19a-432a-a491-112ce11d0c0a	retries	process_retries	{"timestamp": "2026-02-08T10:53:51.414Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:53:51.414	2026-02-08 10:53:52.117	\N	\N	2026-02-08 10:53:51.415383	2026-02-08 10:53:52.126256
237	f84b54a6-7f9c-4b28-967a-981116047ced	retries	process_retries	{"timestamp": "2026-02-08T10:58:51.415Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 10:58:51.415	2026-02-08 10:58:52.313	\N	\N	2026-02-08 10:58:51.415751	2026-02-08 10:58:52.321531
238	9cc90822-5fab-45ff-bfe4-c5f62555d66e	retries	process_retries	{"timestamp": "2026-02-08T11:03:51.416Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:03:51.416	2026-02-08 11:03:51.466	\N	\N	2026-02-08 11:03:51.416725	2026-02-08 11:03:51.469776
239	63f2a7f6-852b-4194-87ba-33af6fbdf839	retries	process_retries	{"timestamp": "2026-02-08T11:08:51.417Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:08:51.417	2026-02-08 11:08:51.631	\N	\N	2026-02-08 11:08:51.417777	2026-02-08 11:08:51.634529
240	07cb7024-5041-4d79-a408-4f70e2b97a73	retries	process_retries	{"timestamp": "2026-02-08T11:13:51.417Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:13:51.417	2026-02-08 11:13:51.823	\N	\N	2026-02-08 11:13:51.417727	2026-02-08 11:13:51.826136
241	91b7cd79-37b4-4a82-8629-91cc1fca8f71	retries	process_retries	{"timestamp": "2026-02-08T11:18:51.418Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:18:51.418	2026-02-08 11:18:51.984	\N	\N	2026-02-08 11:18:51.418837	2026-02-08 11:18:51.987964
242	93c725ff-a086-427d-b28b-777b62711472	retries	process_retries	{"timestamp": "2026-02-08T11:23:51.419Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:23:51.419	2026-02-08 11:23:52.182	\N	\N	2026-02-08 11:23:51.420114	2026-02-08 11:23:52.191057
243	82dea576-4c79-40e7-9f05-190da7964782	retries	process_retries	{"timestamp": "2026-02-08T11:28:51.419Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:28:51.419	2026-02-08 11:28:52.37	\N	\N	2026-02-08 11:28:51.420125	2026-02-08 11:28:52.380148
244	6f7d79b3-341f-4a25-868f-7ca874782543	retries	process_retries	{"timestamp": "2026-02-08T11:33:51.420Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:33:51.42	2026-02-08 11:33:51.537	\N	\N	2026-02-08 11:33:51.421139	2026-02-08 11:33:51.540766
245	511c68de-ce14-4537-9178-ff615052eba6	retries	process_retries	{"timestamp": "2026-02-08T11:38:51.421Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:38:51.421	2026-02-08 11:38:51.739	\N	\N	2026-02-08 11:38:51.421531	2026-02-08 11:38:51.742206
246	6303943b-e89d-4739-b468-1c819d099f9e	retries	process_retries	{"timestamp": "2026-02-08T11:43:51.421Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:43:51.421	2026-02-08 11:43:51.938	\N	\N	2026-02-08 11:43:51.421625	2026-02-08 11:43:51.942257
247	8524c1ab-91c3-44e0-b286-7574d04fdc82	retries	process_retries	{"timestamp": "2026-02-08T11:48:51.421Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:48:51.421	2026-02-08 11:48:52.083	\N	\N	2026-02-08 11:48:51.421831	2026-02-08 11:48:52.092412
248	3a59ec72-d0ed-4942-b835-b60539473243	retries	process_retries	{"timestamp": "2026-02-08T11:53:51.421Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:53:51.421	2026-02-08 11:53:52.245	\N	\N	2026-02-08 11:53:51.422291	2026-02-08 11:53:52.254949
249	505d14f9-c2a9-4d8f-bf8c-f161f74b6192	retries	process_retries	{"timestamp": "2026-02-08T11:58:51.422Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 11:58:51.422	2026-02-08 11:58:52.399	\N	\N	2026-02-08 11:58:51.422658	2026-02-08 11:58:52.403158
250	8fd2c437-79b3-4721-8b3e-8571144f8383	retries	process_retries	{"timestamp": "2026-02-08T12:03:51.423Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:03:51.423	2026-02-08 12:03:51.559	\N	\N	2026-02-08 12:03:51.423507	2026-02-08 12:03:51.563095
251	3fd28bca-6134-4d2c-b480-bd9a678298d5	retries	process_retries	{"timestamp": "2026-02-08T12:08:51.424Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:08:51.424	2026-02-08 12:08:51.761	\N	\N	2026-02-08 12:08:51.424858	2026-02-08 12:08:51.764559
252	1840be1f-c049-47d1-a94c-ae691b4736dc	retries	process_retries	{"timestamp": "2026-02-08T12:13:51.423Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:13:51.423	2026-02-08 12:13:51.968	\N	\N	2026-02-08 12:13:51.424224	2026-02-08 12:13:51.971568
253	33fb7fd7-21ae-4710-8f5f-f5f8c6a56eaf	retries	process_retries	{"timestamp": "2026-02-08T12:18:51.424Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:18:51.424	2026-02-08 12:18:52.135	\N	\N	2026-02-08 12:18:51.424829	2026-02-08 12:18:52.139042
254	90753ab5-08bf-499a-873a-fa3fa18062a1	retries	process_retries	{"timestamp": "2026-02-08T12:23:51.424Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:23:51.424	2026-02-08 12:23:52.335	\N	\N	2026-02-08 12:23:51.425033	2026-02-08 12:23:52.345346
255	2618e79e-b5f1-49f7-84d3-08ec9c4ee1a5	retries	process_retries	{"timestamp": "2026-02-08T12:28:51.425Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:28:51.425	2026-02-08 12:28:51.503	\N	\N	2026-02-08 12:28:51.426127	2026-02-08 12:28:51.506127
256	08a81f0d-1fa7-453c-b97a-05c3a48cb855	retries	process_retries	{"timestamp": "2026-02-08T12:33:51.426Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:33:51.426	2026-02-08 12:33:51.642	\N	\N	2026-02-08 12:33:51.426985	2026-02-08 12:33:51.646185
257	6bb588a3-b1c3-4efc-886e-51fc67b4662e	retries	process_retries	{"timestamp": "2026-02-08T12:38:51.426Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:38:51.426	2026-02-08 12:38:51.807	\N	\N	2026-02-08 12:38:51.427304	2026-02-08 12:38:51.81036
258	913b6212-987d-4004-b23f-28f494dac25f	retries	process_retries	{"timestamp": "2026-02-08T12:43:51.428Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:43:51.428	2026-02-08 12:43:52.005	\N	\N	2026-02-08 12:43:51.428641	2026-02-08 12:43:52.00844
259	317469a1-ebef-445b-ad70-7142c1c9f6e5	retries	process_retries	{"timestamp": "2026-02-08T12:48:51.428Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:48:51.428	2026-02-08 12:48:52.275	\N	\N	2026-02-08 12:48:51.428839	2026-02-08 12:48:52.278512
260	26b034d3-c096-4dee-ba89-ee999823b971	retries	process_retries	{"timestamp": "2026-02-08T12:53:51.429Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:53:51.429	2026-02-08 12:53:51.489	\N	\N	2026-02-08 12:53:51.429993	2026-02-08 12:53:51.49282
261	76384a83-62c2-4056-af98-d46cb34a3081	retries	process_retries	{"timestamp": "2026-02-08T12:58:51.429Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 12:58:51.429	2026-02-08 12:58:51.688	\N	\N	2026-02-08 12:58:51.430333	2026-02-08 12:58:51.692234
450	d69b28f4-9689-455b-beae-dce92650f800	retries	process_retries	{"timestamp": "2026-02-09T04:38:51.518Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:38:51.519	2026-02-09 04:38:51.664	\N	\N	2026-02-09 04:38:51.519525	2026-02-09 04:38:51.667409
262	1a98c99d-c66d-4bd2-ab2e-a8529341d55b	retries	process_retries	{"timestamp": "2026-02-08T13:03:51.430Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:03:51.43	2026-02-08 13:03:51.878	\N	\N	2026-02-08 13:03:51.430497	2026-02-08 13:03:51.884
267	8a6a5035-412e-4ae9-a722-4b8363934346	retries	process_retries	{"timestamp": "2026-02-08T13:28:51.432Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:28:51.432	2026-02-08 13:28:51.765	\N	\N	2026-02-08 13:28:51.433304	2026-02-08 13:28:51.768685
323	0046f3f7-d92b-494c-b149-f88ca5f36fe4	retries	process_retries	{"timestamp": "2026-02-08T18:08:51.457Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:08:51.457	2026-02-08 18:08:51.884	\N	\N	2026-02-08 18:08:51.458051	2026-02-08 18:08:51.888255
263	c8ef2a45-66af-4a77-b769-438df7076b0f	retries	process_retries	{"timestamp": "2026-02-08T13:08:51.431Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:08:51.431	2026-02-08 13:08:52.028	\N	\N	2026-02-08 13:08:51.432096	2026-02-08 13:08:52.036695
269	a394eea2-a073-4fe9-adae-377e70aba346	retries	process_retries	{"timestamp": "2026-02-08T13:38:51.434Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:38:51.434	2026-02-08 13:38:52.127	\N	\N	2026-02-08 13:38:51.434615	2026-02-08 13:38:52.14041
264	0b9ce0d2-3107-40ed-8e3f-d9b7dee0f825	retries	process_retries	{"timestamp": "2026-02-08T13:13:51.431Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:13:51.431	2026-02-08 13:13:52.224	\N	\N	2026-02-08 13:13:51.432432	2026-02-08 13:13:52.233008
325	feee0820-26a5-43d4-8487-0e181bb946e5	retries	process_retries	{"timestamp": "2026-02-08T18:18:51.458Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:18:51.458	2026-02-08 18:18:52.262	\N	\N	2026-02-08 18:18:51.45853	2026-02-08 18:18:52.27576
265	48b12c58-5ffc-40ac-9e92-375234cf6826	retries	process_retries	{"timestamp": "2026-02-08T13:18:51.432Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:18:51.432	2026-02-08 13:18:52.38	\N	\N	2026-02-08 13:18:51.432807	2026-02-08 13:18:52.384536
271	7f94db63-c9ae-4ac5-a844-81da3148b1da	retries	process_retries	{"timestamp": "2026-02-08T13:48:51.433Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:48:51.433	2026-02-08 13:48:51.468	\N	\N	2026-02-08 13:48:51.434052	2026-02-08 13:48:51.471762
273	d867b43e-e8b4-46c6-afdb-16d9fb66d67c	retries	process_retries	{"timestamp": "2026-02-08T13:58:51.433Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 13:58:51.433	2026-02-08 13:58:51.804	\N	\N	2026-02-08 13:58:51.434369	2026-02-08 13:58:51.807631
327	4dbeedf0-083b-4caf-9b82-f12b3e8da245	retries	process_retries	{"timestamp": "2026-02-08T18:28:51.458Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:28:51.458	2026-02-08 18:28:51.642	\N	\N	2026-02-08 18:28:51.458504	2026-02-08 18:28:51.647583
275	235686ce-9401-40ef-a417-52516a6aa3e0	retries	process_retries	{"timestamp": "2026-02-08T14:08:51.434Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:08:51.434	2026-02-08 14:08:52.176	\N	\N	2026-02-08 14:08:51.435048	2026-02-08 14:08:52.185121
329	83c2aedd-614a-4a47-a4e8-50e6ae6f3e13	retries	process_retries	{"timestamp": "2026-02-08T18:38:51.460Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:38:51.46	2026-02-08 18:38:52.02	\N	\N	2026-02-08 18:38:51.460924	2026-02-08 18:38:52.023494
277	7a22035d-c1e1-4a7c-b261-57bf1d8101e5	retries	process_retries	{"timestamp": "2026-02-08T14:18:51.436Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:18:51.436	2026-02-08 14:18:51.518	\N	\N	2026-02-08 14:18:51.437129	2026-02-08 14:18:51.522319
279	c522adcf-9236-4b63-a5d0-a46ea62f73ba	retries	process_retries	{"timestamp": "2026-02-08T14:28:51.438Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:28:51.438	2026-02-08 14:28:51.893	\N	\N	2026-02-08 14:28:51.438506	2026-02-08 14:28:51.896587
281	a6b0d615-aec6-4de4-98e3-3eb198dcde2e	retries	process_retries	{"timestamp": "2026-02-08T14:38:51.439Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:38:51.439	2026-02-08 14:38:52.236	\N	\N	2026-02-08 14:38:51.439609	2026-02-08 14:38:52.244397
283	ad0b9588-4acd-4c07-bef0-d0f999229d10	retries	process_retries	{"timestamp": "2026-02-08T14:48:51.439Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:48:51.439	2026-02-08 14:48:51.54	\N	\N	2026-02-08 14:48:51.440376	2026-02-08 14:48:51.543492
285	2545a070-4d61-4fa0-8eb2-dd0c095c122c	retries	process_retries	{"timestamp": "2026-02-08T14:58:51.439Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 14:58:51.439	2026-02-08 14:58:51.848	\N	\N	2026-02-08 14:58:51.440217	2026-02-08 14:58:51.851871
287	693d4752-b778-4935-9845-8c5eeb4d93ce	retries	process_retries	{"timestamp": "2026-02-08T15:08:51.440Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:08:51.44	2026-02-08 15:08:52.243	\N	\N	2026-02-08 15:08:51.440929	2026-02-08 15:08:52.251075
289	8429d240-c530-44af-8d8c-16f6984fd5db	retries	process_retries	{"timestamp": "2026-02-08T15:18:51.442Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:18:51.442	2026-02-08 15:18:51.626	\N	\N	2026-02-08 15:18:51.442986	2026-02-08 15:18:51.629677
291	bb08a053-4021-40f9-9ef4-29c151f7aa5c	retries	process_retries	{"timestamp": "2026-02-08T15:28:51.442Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:28:51.443	2026-02-08 15:28:51.919	\N	\N	2026-02-08 15:28:51.443521	2026-02-08 15:28:51.922854
293	6cf3d86c-e327-42f1-aa4a-3fbe2473ef42	retries	process_retries	{"timestamp": "2026-02-08T15:38:51.443Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:38:51.443	2026-02-08 15:38:52.281	\N	\N	2026-02-08 15:38:51.444349	2026-02-08 15:38:52.290815
295	9fabde23-4946-4f7e-b729-ec191052d8cd	retries	process_retries	{"timestamp": "2026-02-08T15:48:51.445Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:48:51.445	2026-02-08 15:48:51.669	\N	\N	2026-02-08 15:48:51.446099	2026-02-08 15:48:51.67354
297	4ebb4cf6-d33a-423d-bfe5-f72602d736ac	retries	process_retries	{"timestamp": "2026-02-08T15:58:51.445Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 15:58:51.445	2026-02-08 15:58:52.038	\N	\N	2026-02-08 15:58:51.4464	2026-02-08 15:58:52.047713
299	ad529dd6-0d7f-49c9-9bae-e93ce8e4ab65	retries	process_retries	{"timestamp": "2026-02-08T16:08:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:08:51.447	2026-02-08 16:08:52.356	\N	\N	2026-02-08 16:08:51.447375	2026-02-08 16:08:52.365337
301	14080021-52e1-48f0-892d-8a3782c482fc	retries	process_retries	{"timestamp": "2026-02-08T16:18:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:18:51.447	2026-02-08 16:18:51.696	\N	\N	2026-02-08 16:18:51.447689	2026-02-08 16:18:51.699212
303	80ca60ab-ccae-4217-a292-57cd5b7dc4c0	retries	process_retries	{"timestamp": "2026-02-08T16:28:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:28:51.447	2026-02-08 16:28:52.075	\N	\N	2026-02-08 16:28:51.447588	2026-02-08 16:28:52.083867
305	7df16aa1-e4ed-4ab2-881e-d4ffd22badd2	retries	process_retries	{"timestamp": "2026-02-08T16:38:51.447Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:38:51.448	2026-02-08 16:38:52.445	\N	\N	2026-02-08 16:38:51.448497	2026-02-08 16:38:52.456729
307	59b9b63c-a25f-446c-b6bc-31b0f8f14ca9	retries	process_retries	{"timestamp": "2026-02-08T16:48:51.448Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:48:51.448	2026-02-08 16:48:51.76	\N	\N	2026-02-08 16:48:51.449263	2026-02-08 16:48:51.763163
309	556bdc0c-0721-45a5-9768-a21d420620a0	retries	process_retries	{"timestamp": "2026-02-08T16:58:51.449Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 16:58:51.449	2026-02-08 16:58:52.13	\N	\N	2026-02-08 16:58:51.449592	2026-02-08 16:58:52.140636
311	076fd699-0520-4f63-bdbd-c91af1645fc8	retries	process_retries	{"timestamp": "2026-02-08T17:08:51.450Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:08:51.45	2026-02-08 17:08:51.509	\N	\N	2026-02-08 17:08:51.451139	2026-02-08 17:08:51.512041
313	8588c273-1bf4-4bc1-bc54-22bf4696d878	retries	process_retries	{"timestamp": "2026-02-08T17:18:51.451Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:18:51.451	2026-02-08 17:18:51.879	\N	\N	2026-02-08 17:18:51.452535	2026-02-08 17:18:51.882738
315	4d99dcbb-fe71-4b6e-931c-4adafef9f211	retries	process_retries	{"timestamp": "2026-02-08T17:28:51.453Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:28:51.453	2026-02-08 17:28:51.479	\N	\N	2026-02-08 17:28:51.453925	2026-02-08 17:28:51.48417
317	c7eab75a-fc3a-46b3-901a-10dc0b566fac	retries	process_retries	{"timestamp": "2026-02-08T17:38:51.454Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:38:51.454	2026-02-08 17:38:51.825	\N	\N	2026-02-08 17:38:51.454853	2026-02-08 17:38:51.829169
319	280ef5aa-5e42-4ed1-97fc-ee57187c925c	retries	process_retries	{"timestamp": "2026-02-08T17:48:51.456Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:48:51.456	2026-02-08 17:48:52.155	\N	\N	2026-02-08 17:48:51.45677	2026-02-08 17:48:52.164421
321	16d0dcf4-577f-4c0d-8fe5-cea61cee92c4	retries	process_retries	{"timestamp": "2026-02-08T17:58:51.456Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 17:58:51.456	2026-02-08 17:58:51.568	\N	\N	2026-02-08 17:58:51.45699	2026-02-08 17:58:51.571315
527	d225dc24-7ea0-43c1-8f21-829316282f66	retries	process_retries	{"timestamp": "2026-02-09T11:03:51.558Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:03:51.558	2026-02-09 11:03:52.317	\N	\N	2026-02-09 11:03:51.558926	2026-02-09 11:03:52.321258
333	2874e19b-7458-46e0-9a4c-3d5f87ed5f95	retries	process_retries	{"timestamp": "2026-02-08T18:58:51.464Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 18:58:51.464	2026-02-08 18:58:51.713	\N	\N	2026-02-08 18:58:51.465012	2026-02-08 18:58:51.717834
334	7ec0b758-7470-44b8-955a-33616bc2aa60	retries	process_retries	{"timestamp": "2026-02-08T19:03:51.465Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:03:51.465	2026-02-08 19:03:51.89	\N	\N	2026-02-08 19:03:51.465747	2026-02-08 19:03:51.893787
335	368ada11-e973-4248-97f7-7c9f551208b8	retries	process_retries	{"timestamp": "2026-02-08T19:08:51.465Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:08:51.465	2026-02-08 19:08:52.073	\N	\N	2026-02-08 19:08:51.465845	2026-02-08 19:08:52.076852
336	bb93cfe2-d242-4876-8e78-d16d342d6d11	retries	process_retries	{"timestamp": "2026-02-08T19:13:51.465Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:13:51.466	2026-02-08 19:13:52.267	\N	\N	2026-02-08 19:13:51.466613	2026-02-08 19:13:52.277305
337	206677e7-400c-4483-9966-342b07cfea15	retries	process_retries	{"timestamp": "2026-02-08T19:18:51.467Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:18:51.467	2026-02-08 19:18:52.456	\N	\N	2026-02-08 19:18:51.467659	2026-02-08 19:18:52.466746
338	9edc7631-ba53-4b44-a313-3351c6eb023b	retries	process_retries	{"timestamp": "2026-02-08T19:23:51.467Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:23:51.467	2026-02-08 19:23:51.625	\N	\N	2026-02-08 19:23:51.467878	2026-02-08 19:23:51.628504
339	64b11fec-d265-41fc-91ff-81d7aa0498bc	retries	process_retries	{"timestamp": "2026-02-08T19:28:51.468Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:28:51.468	2026-02-08 19:28:51.815	\N	\N	2026-02-08 19:28:51.468768	2026-02-08 19:28:51.818897
340	93b2f99f-4fea-4cd9-a81e-73b0c9946169	retries	process_retries	{"timestamp": "2026-02-08T19:33:51.469Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:33:51.469	2026-02-08 19:33:51.997	\N	\N	2026-02-08 19:33:51.470158	2026-02-08 19:33:52.001867
341	3d9e9655-c296-4eb7-a5a0-6ff5fe4d5563	retries	process_retries	{"timestamp": "2026-02-08T19:38:51.470Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:38:51.47	2026-02-08 19:38:52.185	\N	\N	2026-02-08 19:38:51.470756	2026-02-08 19:38:52.188111
342	21d138ac-6a47-4c4d-a5d5-bb27f66d0c06	retries	process_retries	{"timestamp": "2026-02-08T19:43:51.471Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:43:51.471	2026-02-08 19:43:52.33	\N	\N	2026-02-08 19:43:51.471517	2026-02-08 19:43:52.333946
343	d7413b0a-546f-408e-aef9-a89a6c1550ef	retries	process_retries	{"timestamp": "2026-02-08T19:48:51.472Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:48:51.472	2026-02-08 19:48:51.479	\N	\N	2026-02-08 19:48:51.473123	2026-02-08 19:48:51.482265
344	6763044d-a959-4b0b-a4c5-b0525de48848	retries	process_retries	{"timestamp": "2026-02-08T19:53:51.473Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:53:51.473	2026-02-08 19:53:51.702	\N	\N	2026-02-08 19:53:51.473838	2026-02-08 19:53:51.707182
345	7a3ab1b4-8bf7-4a1c-9984-2e8ed7039642	retries	process_retries	{"timestamp": "2026-02-08T19:58:51.473Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 19:58:51.473	2026-02-08 19:58:51.881	\N	\N	2026-02-08 19:58:51.474037	2026-02-08 19:58:51.885017
346	ed0c0722-1f75-4eba-8f73-37ac3f1c1bed	retries	process_retries	{"timestamp": "2026-02-08T20:03:51.474Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:03:51.474	2026-02-08 20:03:52.047	\N	\N	2026-02-08 20:03:51.475435	2026-02-08 20:03:52.050951
347	874af89a-de83-429f-824a-30377b0867ce	retries	process_retries	{"timestamp": "2026-02-08T20:08:51.475Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:08:51.475	2026-02-08 20:08:52.227	\N	\N	2026-02-08 20:08:51.476005	2026-02-08 20:08:52.232971
348	f1e3d1a6-ab62-4541-bef4-3d9a4e0fe484	retries	process_retries	{"timestamp": "2026-02-08T20:13:51.474Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:13:51.474	2026-02-08 20:13:52.417	\N	\N	2026-02-08 20:13:51.475211	2026-02-08 20:13:52.423538
349	ca396409-ded1-4a73-ae80-2bc5327ddde9	retries	process_retries	{"timestamp": "2026-02-08T20:18:51.476Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:18:51.476	2026-02-08 20:18:51.625	\N	\N	2026-02-08 20:18:51.476883	2026-02-08 20:18:51.628772
350	21db318a-6e04-4893-8df6-f9d1c97fed68	retries	process_retries	{"timestamp": "2026-02-08T20:23:51.477Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:23:51.477	2026-02-08 20:23:51.788	\N	\N	2026-02-08 20:23:51.477968	2026-02-08 20:23:51.791972
351	e2de915b-7945-4515-a0cc-cb2658e4f7d3	retries	process_retries	{"timestamp": "2026-02-08T20:28:51.478Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:28:51.478	2026-02-08 20:28:51.971	\N	\N	2026-02-08 20:28:51.479008	2026-02-08 20:28:51.975006
352	9cfdec1c-8d19-47a0-ac92-4fd5625737a4	retries	process_retries	{"timestamp": "2026-02-08T20:33:51.478Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:33:51.478	2026-02-08 20:33:52.165	\N	\N	2026-02-08 20:33:51.479426	2026-02-08 20:33:52.168113
353	4609398c-5088-4cd7-9f53-ac8802ce04fa	retries	process_retries	{"timestamp": "2026-02-08T20:38:51.478Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:38:51.478	2026-02-08 20:38:52.348	\N	\N	2026-02-08 20:38:51.47941	2026-02-08 20:38:52.35284
354	450c015b-ed16-4b89-b12d-7eb1d5378d94	retries	process_retries	{"timestamp": "2026-02-08T20:43:51.479Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:43:51.479	2026-02-08 20:43:51.517	\N	\N	2026-02-08 20:43:51.479516	2026-02-08 20:43:51.520866
355	f42b0191-0077-419f-a177-20482d97a777	retries	process_retries	{"timestamp": "2026-02-08T20:48:51.478Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:48:51.478	2026-02-08 20:48:51.728	\N	\N	2026-02-08 20:48:51.479429	2026-02-08 20:48:51.732674
356	2ed562d0-540b-4581-aa76-85784fa9ac58	retries	process_retries	{"timestamp": "2026-02-08T20:53:51.479Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:53:51.479	2026-02-08 20:53:51.928	\N	\N	2026-02-08 20:53:51.480003	2026-02-08 20:53:51.934021
357	787d8376-3f25-4127-846c-426286984216	retries	process_retries	{"timestamp": "2026-02-08T20:58:51.480Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 20:58:51.48	2026-02-08 20:58:52.1	\N	\N	2026-02-08 20:58:51.480721	2026-02-08 20:58:52.103712
358	f18692fc-5385-4407-bfce-43f1fb56be6e	retries	process_retries	{"timestamp": "2026-02-08T21:03:51.480Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:03:51.48	2026-02-08 21:03:52.311	\N	\N	2026-02-08 21:03:51.480838	2026-02-08 21:03:52.314284
359	d93d779b-0026-4c19-9500-4f6d2a56fdcf	retries	process_retries	{"timestamp": "2026-02-08T21:08:51.480Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:08:51.48	2026-02-08 21:08:52.465	\N	\N	2026-02-08 21:08:51.481066	2026-02-08 21:08:52.473972
360	4e5cd200-196a-4abd-8b7c-5f1765f8b953	retries	process_retries	{"timestamp": "2026-02-08T21:13:51.481Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:13:51.481	2026-02-08 21:13:51.617	\N	\N	2026-02-08 21:13:51.481684	2026-02-08 21:13:51.621018
361	80dd03d5-d5c2-4375-9ce3-874ef66fd9df	retries	process_retries	{"timestamp": "2026-02-08T21:18:51.481Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:18:51.481	2026-02-08 21:18:51.79	\N	\N	2026-02-08 21:18:51.482113	2026-02-08 21:18:51.794922
362	ec963b22-d840-4476-a304-e3e82e274567	retries	process_retries	{"timestamp": "2026-02-08T21:23:51.482Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:23:51.482	2026-02-08 21:23:51.974	\N	\N	2026-02-08 21:23:51.482619	2026-02-08 21:23:51.977914
363	f0311bf1-580c-42e8-be08-08d352ef8e58	retries	process_retries	{"timestamp": "2026-02-08T21:28:51.483Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:28:51.483	2026-02-08 21:28:52.178	\N	\N	2026-02-08 21:28:51.483904	2026-02-08 21:28:52.187484
364	4116d7ae-3e66-487d-b6c3-5e14a2aa9597	retries	process_retries	{"timestamp": "2026-02-08T21:33:51.482Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:33:51.483	2026-02-08 21:33:52.363	\N	\N	2026-02-08 21:33:51.483528	2026-02-08 21:33:52.366131
365	c3e61a06-d30c-41c3-922c-28352a4eaa95	retries	process_retries	{"timestamp": "2026-02-08T21:38:51.483Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:38:51.483	2026-02-08 21:38:51.569	\N	\N	2026-02-08 21:38:51.484157	2026-02-08 21:38:51.572955
366	0154736c-4178-47cd-b8a3-5ad76625685b	retries	process_retries	{"timestamp": "2026-02-08T21:43:51.483Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:43:51.483	2026-02-08 21:43:51.766	\N	\N	2026-02-08 21:43:51.484512	2026-02-08 21:43:51.770404
367	a72a0683-e4e2-4f82-9fd0-f78dca03131b	retries	process_retries	{"timestamp": "2026-02-08T21:48:51.483Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:48:51.483	2026-02-08 21:48:51.92	\N	\N	2026-02-08 21:48:51.484324	2026-02-08 21:48:51.923306
368	4a9aa2a6-a56e-4622-a021-a0ddf5876aa8	retries	process_retries	{"timestamp": "2026-02-08T21:53:51.484Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:53:51.484	2026-02-08 21:53:52.061	\N	\N	2026-02-08 21:53:51.484964	2026-02-08 21:53:52.064678
384	63954e65-9b7d-4b06-b140-4eac8ff8d579	retries	process_retries	{"timestamp": "2026-02-08T23:13:51.490Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:13:51.491	2026-02-08 23:13:52.105	\N	\N	2026-02-08 23:13:51.491489	2026-02-08 23:13:52.108974
369	1d5bc994-9fcc-413b-a63c-800a9a3f382e	retries	process_retries	{"timestamp": "2026-02-08T21:58:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 21:58:51.485	2026-02-08 21:58:52.258	\N	\N	2026-02-08 21:58:51.485557	2026-02-08 21:58:52.264549
385	3f69889c-47f3-4641-a5f3-488b50383a84	retries	process_retries	{"timestamp": "2026-02-08T23:18:51.491Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:18:51.491	2026-02-08 23:18:52.27	\N	\N	2026-02-08 23:18:51.492043	2026-02-08 23:18:52.274245
370	2fc52b4a-447b-4b46-befb-5b971b51ad7d	retries	process_retries	{"timestamp": "2026-02-08T22:03:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:03:51.485	2026-02-08 22:03:52.45	\N	\N	2026-02-08 22:03:51.485659	2026-02-08 22:03:52.460502
387	09a85107-9925-43f7-8d36-e66bd4ae1c08	retries	process_retries	{"timestamp": "2026-02-08T23:28:51.492Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:28:51.492	2026-02-08 23:28:51.59	\N	\N	2026-02-08 23:28:51.493114	2026-02-08 23:28:51.593047
371	830910f1-9f27-48ea-a76e-ed6214e1ced1	retries	process_retries	{"timestamp": "2026-02-08T22:08:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:08:51.485	2026-02-08 22:08:51.638	\N	\N	2026-02-08 22:08:51.486019	2026-02-08 22:08:51.641982
530	9d6c89fb-9194-4021-8eb9-9143985ea00c	retries	process_retries	{"timestamp": "2026-02-09T11:18:51.560Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:18:51.56	2026-02-09 11:18:51.86	\N	\N	2026-02-09 11:18:51.561055	2026-02-09 11:18:51.864502
388	a541b19d-e900-458b-a86b-d3d41fd1a108	retries	process_retries	{"timestamp": "2026-02-08T23:33:51.493Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:33:51.493	2026-02-08 23:33:51.766	\N	\N	2026-02-08 23:33:51.493914	2026-02-08 23:33:51.771709
372	4ac0ce3c-40e1-4f6a-9811-1c58485ced03	retries	process_retries	{"timestamp": "2026-02-08T22:13:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:13:51.485	2026-02-08 22:13:51.827	\N	\N	2026-02-08 22:13:51.486353	2026-02-08 22:13:51.8303
373	30d6257c-16f2-4493-8d7f-2066d7a0f70f	retries	process_retries	{"timestamp": "2026-02-08T22:18:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:18:51.486	2026-02-08 22:18:52.414	\N	\N	2026-02-08 22:18:51.486408	2026-02-08 22:18:52.418609
389	d6e05ea6-2b55-4576-a8a3-ba566fb50e44	retries	process_retries	{"timestamp": "2026-02-08T23:38:51.493Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:38:51.493	2026-02-08 23:38:51.943	\N	\N	2026-02-08 23:38:51.494417	2026-02-08 23:38:51.946975
374	6e9cdeff-8b75-4343-b72c-2005bdb353d3	retries	process_retries	{"timestamp": "2026-02-08T22:23:51.485Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:23:51.485	2026-02-08 22:23:51.993	\N	\N	2026-02-08 22:23:51.486389	2026-02-08 22:23:51.996884
390	8eb10cbf-cc4c-4c20-9e4c-ab9c0b06d24c	retries	process_retries	{"timestamp": "2026-02-08T23:43:51.495Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:43:51.495	2026-02-08 23:43:52.144	\N	\N	2026-02-08 23:43:51.495729	2026-02-08 23:43:52.147727
375	6ab6d896-4f34-4c95-ab02-c4b2f6fad3f7	retries	process_retries	{"timestamp": "2026-02-08T22:28:51.486Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:28:51.486	2026-02-08 22:28:52.355	\N	\N	2026-02-08 22:28:51.487247	2026-02-08 22:28:52.358503
376	41882035-6a11-4474-a1c1-fa7bc4ce95cf	retries	process_retries	{"timestamp": "2026-02-08T22:33:51.487Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:33:51.487	2026-02-08 22:33:51.509	\N	\N	2026-02-08 22:33:51.487873	2026-02-08 22:33:51.512328
391	76630b9e-668f-4805-910e-f59d3f9e7847	retries	process_retries	{"timestamp": "2026-02-08T23:48:51.495Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:48:51.495	2026-02-08 23:48:52.344	\N	\N	2026-02-08 23:48:51.495941	2026-02-08 23:48:52.354934
377	ca94a9fb-b9ef-49f0-b924-8d827da37f35	retries	process_retries	{"timestamp": "2026-02-08T22:38:51.487Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:38:51.487	2026-02-08 22:38:51.661	\N	\N	2026-02-08 22:38:51.488117	2026-02-08 22:38:51.665585
392	77d039d1-41d4-4fb0-ba23-d8c17f706cc7	retries	process_retries	{"timestamp": "2026-02-08T23:53:51.496Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:53:51.496	2026-02-08 23:53:51.517	\N	\N	2026-02-08 23:53:51.496597	2026-02-08 23:53:51.520203
378	ab0864c3-1494-44dd-ae50-e3f382c95a96	retries	process_retries	{"timestamp": "2026-02-08T22:43:51.487Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:43:51.487	2026-02-08 22:43:51.849	\N	\N	2026-02-08 22:43:51.488383	2026-02-08 22:43:51.852895
379	6b0cb6ae-553c-4644-b347-482cac4e1c7a	retries	process_retries	{"timestamp": "2026-02-08T22:48:51.488Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:48:51.488	2026-02-08 22:48:52.034	\N	\N	2026-02-08 22:48:51.488546	2026-02-08 22:48:52.039264
393	13650bb3-d8f9-43d6-9bca-b8ebc38234df	retries	process_retries	{"timestamp": "2026-02-08T23:58:51.497Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:58:51.497	2026-02-08 23:58:51.666	\N	\N	2026-02-08 23:58:51.497599	2026-02-08 23:58:51.670025
380	a08fa520-2167-42f2-9774-d1466a1bdbdd	retries	process_retries	{"timestamp": "2026-02-08T22:53:51.487Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:53:51.487	2026-02-08 22:53:52.191	\N	\N	2026-02-08 22:53:51.488244	2026-02-08 22:53:52.19531
394	5c18ddcd-af20-441d-b2a3-66b0bf6ac16d	retries	process_retries	{"timestamp": "2026-02-09T00:03:51.497Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:03:51.497	2026-02-09 00:03:51.872	\N	\N	2026-02-09 00:03:51.497692	2026-02-09 00:03:51.875771
381	62d6ffd5-67e6-4ecb-8657-0a17c5eaf883	retries	process_retries	{"timestamp": "2026-02-08T22:58:51.489Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 22:58:51.489	2026-02-08 22:58:52.36	\N	\N	2026-02-08 22:58:51.489951	2026-02-08 22:58:52.363852
382	53bff80a-99a4-45ef-91b1-0c12721e96e7	retries	process_retries	{"timestamp": "2026-02-08T23:03:51.489Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-08 23:03:51.489	2026-02-08 23:03:51.545	\N	\N	2026-02-08 23:03:51.489822	2026-02-08 23:03:51.549059
395	4d7b5d74-1151-42fb-acd9-1da9bff67c1b	retries	process_retries	{"timestamp": "2026-02-09T00:08:51.497Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:08:51.497	2026-02-09 00:08:52.049	\N	\N	2026-02-09 00:08:51.497888	2026-02-09 00:08:52.053211
396	478e3cea-6585-47cf-a487-35d19dc0af42	retries	process_retries	{"timestamp": "2026-02-09T00:13:51.498Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:13:51.498	2026-02-09 00:13:52.249	\N	\N	2026-02-09 00:13:51.498895	2026-02-09 00:13:52.253559
397	6c3d1d69-8f8b-49fd-a562-4d2d246d9a79	retries	process_retries	{"timestamp": "2026-02-09T00:18:51.497Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:18:51.497	2026-02-09 00:18:52.438	\N	\N	2026-02-09 00:18:51.498298	2026-02-09 00:18:52.44714
398	e0b73e4f-a901-4ada-a4f1-29195cfcb429	retries	process_retries	{"timestamp": "2026-02-09T00:23:51.498Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:23:51.498	2026-02-09 00:23:51.632	\N	\N	2026-02-09 00:23:51.499061	2026-02-09 00:23:51.636998
399	34b4e7fe-907c-4596-abe6-748a1d7fd353	retries	process_retries	{"timestamp": "2026-02-09T00:28:51.499Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:28:51.499	2026-02-09 00:28:51.812	\N	\N	2026-02-09 00:28:51.499938	2026-02-09 00:28:51.816626
400	99e91697-67e1-4700-b0ec-ea15fadf4379	retries	process_retries	{"timestamp": "2026-02-09T00:33:51.499Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:33:51.499	2026-02-09 00:33:52.005	\N	\N	2026-02-09 00:33:51.500021	2026-02-09 00:33:52.008911
401	d4260b42-610a-4367-926a-3d0b83d14243	retries	process_retries	{"timestamp": "2026-02-09T00:38:51.500Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:38:51.5	2026-02-09 00:38:52.145	\N	\N	2026-02-09 00:38:51.501035	2026-02-09 00:38:52.148709
402	e22be8fc-5766-4435-94b9-4db4a52428b7	retries	process_retries	{"timestamp": "2026-02-09T00:43:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:43:51.501	2026-02-09 00:43:52.314	\N	\N	2026-02-09 00:43:51.50166	2026-02-09 00:43:52.318357
403	bb38d26a-3576-4d1d-8e2d-b18ec090a8ee	retries	process_retries	{"timestamp": "2026-02-09T00:48:51.500Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:48:51.5	2026-02-09 00:48:51.504	\N	\N	2026-02-09 00:48:51.50127	2026-02-09 00:48:51.508073
404	f9913ad8-f951-42ac-902b-212390d3b10a	retries	process_retries	{"timestamp": "2026-02-09T00:53:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:53:51.501	2026-02-09 00:53:51.667	\N	\N	2026-02-09 00:53:51.501668	2026-02-09 00:53:51.671322
405	4a760f97-8da0-493f-9306-63e33148e813	retries	process_retries	{"timestamp": "2026-02-09T00:58:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 00:58:51.501	2026-02-09 00:58:51.857	\N	\N	2026-02-09 00:58:51.502239	2026-02-09 00:58:51.860934
406	bcf0e9f9-2ff2-420e-8e20-1ae58ea8b785	retries	process_retries	{"timestamp": "2026-02-09T01:03:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:03:51.501	2026-02-09 01:03:52.066	\N	\N	2026-02-09 01:03:51.5023	2026-02-09 01:03:52.070001
407	ecbabf19-ea06-46a6-abf3-c2fe9619d21e	retries	process_retries	{"timestamp": "2026-02-09T01:08:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:08:51.501	2026-02-09 01:08:52.224	\N	\N	2026-02-09 01:08:51.502224	2026-02-09 01:08:52.227638
408	e601103c-afe5-4351-be87-b2a8e2716086	retries	process_retries	{"timestamp": "2026-02-09T01:13:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:13:51.501	2026-02-09 01:13:52.4	\N	\N	2026-02-09 01:13:51.502075	2026-02-09 01:13:52.410626
409	8f14aa56-b6e8-4e3a-973a-cb19da9f22d3	retries	process_retries	{"timestamp": "2026-02-09T01:18:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:18:51.501	2026-02-09 01:18:51.579	\N	\N	2026-02-09 01:18:51.502155	2026-02-09 01:18:51.582745
410	06be4ff0-53f2-407b-81d0-5481f247ca6c	retries	process_retries	{"timestamp": "2026-02-09T01:23:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:23:51.501	2026-02-09 01:23:51.747	\N	\N	2026-02-09 01:23:51.502233	2026-02-09 01:23:51.750693
451	bd312e70-68e5-41b1-8331-d03c84337e55	retries	process_retries	{"timestamp": "2026-02-09T04:43:51.519Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:43:51.519	2026-02-09 04:43:51.841	\N	\N	2026-02-09 04:43:51.520045	2026-02-09 04:43:51.844849
453	e34be40c-4b32-4978-9d7f-c0a3f314d9e9	retries	process_retries	{"timestamp": "2026-02-09T04:53:51.520Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:53:51.52	2026-02-09 04:53:52.179	\N	\N	2026-02-09 04:53:51.520835	2026-02-09 04:53:52.183872
455	b84b49b9-2b47-4148-8a33-dc301665b880	retries	process_retries	{"timestamp": "2026-02-09T05:03:51.520Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:03:51.52	2026-02-09 05:03:52.521	\N	\N	2026-02-09 05:03:51.521008	2026-02-09 05:03:52.524344
457	bb46f824-82ae-4a30-9c75-3f5cecc7b28d	retries	process_retries	{"timestamp": "2026-02-09T05:13:51.522Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:13:51.522	2026-02-09 05:13:51.88	\N	\N	2026-02-09 05:13:51.522995	2026-02-09 05:13:51.884674
459	53ed48c1-bc4b-4f87-9708-d5788aad7e84	retries	process_retries	{"timestamp": "2026-02-09T05:23:51.521Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:23:51.522	2026-02-09 05:23:52.254	\N	\N	2026-02-09 05:23:51.522381	2026-02-09 05:23:52.257186
461	b000e993-fe64-489b-86d1-76dab2eee63e	retries	process_retries	{"timestamp": "2026-02-09T05:33:51.522Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:33:51.522	2026-02-09 05:33:51.631	\N	\N	2026-02-09 05:33:51.523233	2026-02-09 05:33:51.634824
463	61e7261e-fe23-4e5b-a0af-a31bc31da1c9	retries	process_retries	{"timestamp": "2026-02-09T05:43:51.524Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:43:51.524	2026-02-09 05:43:51.955	\N	\N	2026-02-09 05:43:51.524864	2026-02-09 05:43:51.95978
465	fb1a5e74-2aa9-40cb-865e-43fc5dbc6457	retries	process_retries	{"timestamp": "2026-02-09T05:53:51.524Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:53:51.524	2026-02-09 05:53:52.288	\N	\N	2026-02-09 05:53:51.524861	2026-02-09 05:53:52.292402
467	91ae2d6f-64a9-45a2-ae11-e76442ef951b	retries	process_retries	{"timestamp": "2026-02-09T06:03:51.524Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:03:51.524	2026-02-09 06:03:51.649	\N	\N	2026-02-09 06:03:51.525393	2026-02-09 06:03:51.651863
469	f26cff58-1ac7-498a-b7f8-236297e014ab	retries	process_retries	{"timestamp": "2026-02-09T06:13:51.525Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:13:51.525	2026-02-09 06:13:52.053	\N	\N	2026-02-09 06:13:51.525678	2026-02-09 06:13:52.056814
471	b7e702db-ff08-4883-bbdb-1912112c031f	retries	process_retries	{"timestamp": "2026-02-09T06:23:51.525Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:23:51.525	2026-02-09 06:23:52.404	\N	\N	2026-02-09 06:23:51.526354	2026-02-09 06:23:52.407158
473	c12b68a7-a423-4254-b153-a8f01c9030e0	retries	process_retries	{"timestamp": "2026-02-09T06:33:51.527Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:33:51.527	2026-02-09 06:33:51.725	\N	\N	2026-02-09 06:33:51.528612	2026-02-09 06:33:51.729552
475	db397651-31fa-49f9-875a-9abed4f84284	retries	process_retries	{"timestamp": "2026-02-09T06:43:51.528Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:43:51.528	2026-02-09 06:43:52.082	\N	\N	2026-02-09 06:43:51.529242	2026-02-09 06:43:52.085778
477	737033ad-c887-4077-86e2-a34ac86eb630	retries	process_retries	{"timestamp": "2026-02-09T06:53:51.531Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:53:51.531	2026-02-09 06:53:52.493	\N	\N	2026-02-09 06:53:51.531584	2026-02-09 06:53:52.498259
479	781f5c7e-4595-4092-85a8-9703215d6be2	retries	process_retries	{"timestamp": "2026-02-09T07:03:51.531Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:03:51.531	2026-02-09 07:03:51.852	\N	\N	2026-02-09 07:03:51.532016	2026-02-09 07:03:51.856643
481	5e67cd9f-4781-46d5-a2e4-738b723508be	retries	process_retries	{"timestamp": "2026-02-09T07:13:51.531Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:13:51.532	2026-02-09 07:13:52.172	\N	\N	2026-02-09 07:13:51.532433	2026-02-09 07:13:52.177393
483	b2881199-6fa1-4e40-9ec0-4cd8e91517e7	retries	process_retries	{"timestamp": "2026-02-09T07:23:51.533Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:23:51.533	2026-02-09 07:23:52.531	\N	\N	2026-02-09 07:23:51.53382	2026-02-09 07:23:52.533545
485	35a9bd6e-5b3c-41a9-9947-c6491d8dda61	retries	process_retries	{"timestamp": "2026-02-09T07:33:51.534Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:33:51.534	2026-02-09 07:33:51.9	\N	\N	2026-02-09 07:33:51.535333	2026-02-09 07:33:51.90394
487	183c627e-be13-40d3-af37-d604cf4c22aa	retries	process_retries	{"timestamp": "2026-02-09T07:43:51.536Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:43:51.536	2026-02-09 07:43:52.255	\N	\N	2026-02-09 07:43:51.536699	2026-02-09 07:43:52.25781
489	8edd7cf7-721f-455b-973c-6844b4aa3fa0	retries	process_retries	{"timestamp": "2026-02-09T07:53:51.537Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:53:51.537	2026-02-09 07:53:51.6	\N	\N	2026-02-09 07:53:51.537728	2026-02-09 07:53:51.6037
491	54db7737-3f89-4185-80d9-fda2cee00208	retries	process_retries	{"timestamp": "2026-02-09T08:03:51.538Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:03:51.538	2026-02-09 08:03:51.953	\N	\N	2026-02-09 08:03:51.538979	2026-02-09 08:03:51.955989
493	40834a44-02c8-44bf-9043-fd5ee151299e	retries	process_retries	{"timestamp": "2026-02-09T08:13:51.540Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:13:51.54	2026-02-09 08:13:52.312	\N	\N	2026-02-09 08:13:51.540445	2026-02-09 08:13:52.315361
495	c6791fbd-991a-44d6-80a0-28f43cd78dfd	retries	process_retries	{"timestamp": "2026-02-09T08:23:51.542Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:23:51.542	2026-02-09 08:23:51.684	\N	\N	2026-02-09 08:23:51.542571	2026-02-09 08:23:51.688326
497	9af94d9c-fdb4-479b-8744-8b5ae9f15fb9	retries	process_retries	{"timestamp": "2026-02-09T08:33:51.541Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:33:51.541	2026-02-09 08:33:52.032	\N	\N	2026-02-09 08:33:51.542184	2026-02-09 08:33:52.036016
499	cda5ef1a-9346-48c1-afa6-d68b38a2fcd6	retries	process_retries	{"timestamp": "2026-02-09T08:43:51.542Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:43:51.542	2026-02-09 08:43:52.377	\N	\N	2026-02-09 08:43:51.543258	2026-02-09 08:43:52.38112
501	670e7384-9213-4abe-a707-d0e63d059749	retries	process_retries	{"timestamp": "2026-02-09T08:53:51.544Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:53:51.544	2026-02-09 08:53:51.713	\N	\N	2026-02-09 08:53:51.545043	2026-02-09 08:53:51.717104
503	a0b26d01-2a80-4d59-bde0-c03b5bef3c0d	retries	process_retries	{"timestamp": "2026-02-09T09:03:51.545Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:03:51.545	2026-02-09 09:03:52.081	\N	\N	2026-02-09 09:03:51.545681	2026-02-09 09:03:52.084514
505	1ff78df6-013c-47b6-be28-c99afcad4896	retries	process_retries	{"timestamp": "2026-02-09T09:13:51.546Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:13:51.546	2026-02-09 09:13:52.468	\N	\N	2026-02-09 09:13:51.546809	2026-02-09 09:13:52.471724
507	bd50482e-b7f5-4711-9351-61e13e71f887	retries	process_retries	{"timestamp": "2026-02-09T09:23:51.548Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:23:51.548	2026-02-09 09:23:51.758	\N	\N	2026-02-09 09:23:51.548879	2026-02-09 09:23:51.761786
509	33591035-aa91-4659-ade9-1d1c882a229f	retries	process_retries	{"timestamp": "2026-02-09T09:33:51.548Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:33:51.548	2026-02-09 09:33:52.078	\N	\N	2026-02-09 09:33:51.549231	2026-02-09 09:33:52.081063
511	06c3b831-c7f3-4b61-a997-6babc03aa572	retries	process_retries	{"timestamp": "2026-02-09T09:43:51.549Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:43:51.549	2026-02-09 09:43:52.485	\N	\N	2026-02-09 09:43:51.549566	2026-02-09 09:43:52.488257
513	651e1492-c602-4dfb-b738-4d3f52036e58	retries	process_retries	{"timestamp": "2026-02-09T09:53:51.549Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:53:51.549	2026-02-09 09:53:51.855	\N	\N	2026-02-09 09:53:51.550338	2026-02-09 09:53:51.85784
515	b2e857f6-ec7d-4f87-83e4-b4b4e211bbe7	retries	process_retries	{"timestamp": "2026-02-09T10:03:51.551Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:03:51.551	2026-02-09 10:03:52.173	\N	\N	2026-02-09 10:03:51.551991	2026-02-09 10:03:52.1778
517	58c58666-8ab2-4aa9-9f16-c8b9acbe7499	retries	process_retries	{"timestamp": "2026-02-09T10:13:51.552Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:13:51.552	2026-02-09 10:13:52.518	\N	\N	2026-02-09 10:13:51.553375	2026-02-09 10:13:52.521531
528	a4bf06d9-da59-48d7-b48e-eb139001124b	retries	process_retries	{"timestamp": "2026-02-09T11:08:51.558Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:08:51.558	2026-02-09 11:08:52.509	\N	\N	2026-02-09 11:08:51.55931	2026-02-09 11:08:52.512723
411	13100870-afde-4b9a-ad95-6dfc1a239711	retries	process_retries	{"timestamp": "2026-02-09T01:28:51.501Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:28:51.502	2026-02-09 01:28:51.934	\N	\N	2026-02-09 01:28:51.502476	2026-02-09 01:28:51.939592
412	b14056a3-cfde-4b10-9b6b-6a93cfe9f17e	retries	process_retries	{"timestamp": "2026-02-09T01:33:51.503Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:33:51.503	2026-02-09 01:33:52.139	\N	\N	2026-02-09 01:33:51.503683	2026-02-09 01:33:52.142722
413	a06522b9-d7a2-4511-b4fc-11f2a90e8901	retries	process_retries	{"timestamp": "2026-02-09T01:38:51.502Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:38:51.503	2026-02-09 01:38:52.304	\N	\N	2026-02-09 01:38:51.5034	2026-02-09 01:38:52.308068
414	246d8c9f-611c-4e76-8585-d0ff9ef89d0c	retries	process_retries	{"timestamp": "2026-02-09T01:43:51.503Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:43:51.503	2026-02-09 01:43:52.476	\N	\N	2026-02-09 01:43:51.503709	2026-02-09 01:43:52.485993
415	afdab004-3313-4e18-ae9d-27d3b80bc359	retries	process_retries	{"timestamp": "2026-02-09T01:48:51.503Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:48:51.503	2026-02-09 01:48:51.656	\N	\N	2026-02-09 01:48:51.503599	2026-02-09 01:48:51.660093
416	c7be6aa8-7ef3-4b3c-8765-d333f1bf1de9	retries	process_retries	{"timestamp": "2026-02-09T01:53:51.503Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:53:51.503	2026-02-09 01:53:51.854	\N	\N	2026-02-09 01:53:51.50407	2026-02-09 01:53:51.858506
417	4e438bf4-fb37-4342-91d0-cff0c00dac5a	retries	process_retries	{"timestamp": "2026-02-09T01:58:51.503Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 01:58:51.504	2026-02-09 01:58:52.019	\N	\N	2026-02-09 01:58:51.50449	2026-02-09 01:58:52.022652
418	c1dc598c-99c4-4dd5-9779-b1dcc2be5016	cleanup	cleanup_queue	{"daysOld": 7}	completed	1	1	\N	{"success": true, "jobsCleared": 0}	2026-02-09 02:00:00.005	2026-02-09 02:00:00.144	2026-02-09 02:00:00.156243	\N	2026-02-09 02:00:00.006038	2026-02-09 02:00:00.156243
419	252aa173-d4f0-45a3-a3ff-2f688496715f	retries	process_retries	{"timestamp": "2026-02-09T02:03:51.504Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:03:51.504	2026-02-09 02:03:52.186	\N	\N	2026-02-09 02:03:51.505206	2026-02-09 02:03:52.189749
420	d38706cf-013f-4e9b-9b57-8fb24ffb90dd	retries	process_retries	{"timestamp": "2026-02-09T02:08:51.505Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:08:51.505	2026-02-09 02:08:52.35	\N	\N	2026-02-09 02:08:51.505826	2026-02-09 02:08:52.36179
421	25725bc5-3860-4034-8faa-4b469365c7e2	retries	process_retries	{"timestamp": "2026-02-09T02:13:51.506Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:13:51.506	2026-02-09 02:13:51.532	\N	\N	2026-02-09 02:13:51.50688	2026-02-09 02:13:51.537917
422	e53be206-dbf7-4edf-8cd1-0fa8b3118f8b	retries	process_retries	{"timestamp": "2026-02-09T02:18:51.507Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:18:51.507	2026-02-09 02:18:51.712	\N	\N	2026-02-09 02:18:51.507819	2026-02-09 02:18:51.715117
423	fd09b8a0-af5c-4d9b-843f-0ad3a5c6e3b1	retries	process_retries	{"timestamp": "2026-02-09T02:23:51.507Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:23:51.507	2026-02-09 02:23:51.877	\N	\N	2026-02-09 02:23:51.50741	2026-02-09 02:23:51.882126
424	ee57d00a-3e3c-499a-aed8-0b1664bafa85	retries	process_retries	{"timestamp": "2026-02-09T02:28:51.506Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:28:51.506	2026-02-09 02:28:52.06	\N	\N	2026-02-09 02:28:51.507351	2026-02-09 02:28:52.06577
425	9f5619e6-cfb9-4432-9c8e-469de49b6976	retries	process_retries	{"timestamp": "2026-02-09T02:33:51.507Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:33:51.507	2026-02-09 02:33:52.249	\N	\N	2026-02-09 02:33:51.507645	2026-02-09 02:33:52.252138
426	96de5fbe-865e-49dc-923d-b5603b95783e	retries	process_retries	{"timestamp": "2026-02-09T02:38:51.508Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:38:51.508	2026-02-09 02:38:52.437	\N	\N	2026-02-09 02:38:51.509236	2026-02-09 02:38:52.446946
427	b0854d32-8f12-4d72-8483-d9374580fd8f	retries	process_retries	{"timestamp": "2026-02-09T02:43:51.509Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:43:51.509	2026-02-09 02:43:51.633	\N	\N	2026-02-09 02:43:51.510058	2026-02-09 02:43:51.636702
428	a365c2d9-947e-417f-bad0-0a262b17d569	retries	process_retries	{"timestamp": "2026-02-09T02:48:51.509Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:48:51.509	2026-02-09 02:48:51.791	\N	\N	2026-02-09 02:48:51.510804	2026-02-09 02:48:51.794795
429	a40d8cb7-1149-4af0-a719-c918f2ecca1d	retries	process_retries	{"timestamp": "2026-02-09T02:53:51.510Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:53:51.51	2026-02-09 02:53:51.953	\N	\N	2026-02-09 02:53:51.51112	2026-02-09 02:53:51.957587
430	6560f502-49d0-413f-bab1-a700df52db60	retries	process_retries	{"timestamp": "2026-02-09T02:58:51.510Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 02:58:51.51	2026-02-09 02:58:52.138	\N	\N	2026-02-09 02:58:51.511361	2026-02-09 02:58:52.142024
431	7a118915-073d-45ed-9dac-46dfca5ab5a2	retries	process_retries	{"timestamp": "2026-02-09T03:03:51.510Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:03:51.51	2026-02-09 03:03:52.311	\N	\N	2026-02-09 03:03:51.510495	2026-02-09 03:03:52.315166
432	88050866-6859-4b78-bf2e-657d9012b167	retries	process_retries	{"timestamp": "2026-02-09T03:08:51.510Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:08:51.51	2026-02-09 03:08:51.518	\N	\N	2026-02-09 03:08:51.511435	2026-02-09 03:08:51.52221
433	97cd80c2-618f-4e5d-b484-eafe19da3db1	retries	process_retries	{"timestamp": "2026-02-09T03:13:51.511Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:13:51.511	2026-02-09 03:13:51.726	\N	\N	2026-02-09 03:13:51.511729	2026-02-09 03:13:51.73005
434	1f5569d5-a955-40ad-a7c1-30b26bb97ad2	retries	process_retries	{"timestamp": "2026-02-09T03:18:51.512Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:18:51.512	2026-02-09 03:18:51.904	\N	\N	2026-02-09 03:18:51.513086	2026-02-09 03:18:51.907571
435	f8f6f2f6-32dc-43bd-b307-186c5486c986	retries	process_retries	{"timestamp": "2026-02-09T03:23:51.512Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:23:51.512	2026-02-09 03:23:52.093	\N	\N	2026-02-09 03:23:51.513401	2026-02-09 03:23:52.097021
436	ec414aa2-750f-4b93-8ea2-fb3cf2ee6e2e	retries	process_retries	{"timestamp": "2026-02-09T03:28:51.513Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:28:51.513	2026-02-09 03:28:52.241	\N	\N	2026-02-09 03:28:51.513558	2026-02-09 03:28:52.243997
437	42026829-9abe-4635-8973-4f100577db52	retries	process_retries	{"timestamp": "2026-02-09T03:33:51.512Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:33:51.512	2026-02-09 03:33:52.395	\N	\N	2026-02-09 03:33:51.513289	2026-02-09 03:33:52.400531
438	8e483d2c-e018-4e2c-b3db-2b444126f8ad	retries	process_retries	{"timestamp": "2026-02-09T03:38:51.513Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:38:51.513	2026-02-09 03:38:51.561	\N	\N	2026-02-09 03:38:51.514218	2026-02-09 03:38:51.565609
439	c623398a-2c6e-4edb-b756-431526700dcd	retries	process_retries	{"timestamp": "2026-02-09T03:43:51.514Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:43:51.514	2026-02-09 03:43:51.756	\N	\N	2026-02-09 03:43:51.514571	2026-02-09 03:43:51.760126
440	6483ad97-c1c7-4ac3-88ba-99a0e074ed97	retries	process_retries	{"timestamp": "2026-02-09T03:48:51.514Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:48:51.514	2026-02-09 03:48:51.943	\N	\N	2026-02-09 03:48:51.51475	2026-02-09 03:48:51.946727
441	2b8fcf9c-a69a-41ac-a1e2-3f4b581a3732	retries	process_retries	{"timestamp": "2026-02-09T03:53:51.515Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:53:51.515	2026-02-09 03:53:52.113	\N	\N	2026-02-09 03:53:51.516127	2026-02-09 03:53:52.116608
442	939bf8ac-3b8c-47c5-bbd7-7c6495d99a54	retries	process_retries	{"timestamp": "2026-02-09T03:58:51.515Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 03:58:51.515	2026-02-09 03:58:52.332	\N	\N	2026-02-09 03:58:51.516217	2026-02-09 03:58:52.335765
443	107ccccc-cd1c-41fd-9d96-e270476ba9a7	retries	process_retries	{"timestamp": "2026-02-09T04:03:51.516Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:03:51.516	2026-02-09 04:03:52.515	\N	\N	2026-02-09 04:03:51.516704	2026-02-09 04:03:52.527877
444	506e271f-d101-43fc-b6cb-84566ba0baa3	retries	process_retries	{"timestamp": "2026-02-09T04:08:51.516Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:08:51.516	2026-02-09 04:08:51.655	\N	\N	2026-02-09 04:08:51.517246	2026-02-09 04:08:51.658963
445	7d61cd12-e423-4085-a93b-fa7d7b7bced9	retries	process_retries	{"timestamp": "2026-02-09T04:13:51.516Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:13:51.516	2026-02-09 04:13:51.797	\N	\N	2026-02-09 04:13:51.517129	2026-02-09 04:13:51.801664
446	89274c9e-cac4-4f81-8cbc-5afe610f6b77	retries	process_retries	{"timestamp": "2026-02-09T04:18:51.516Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:18:51.516	2026-02-09 04:18:51.976	\N	\N	2026-02-09 04:18:51.51749	2026-02-09 04:18:51.97974
611	5f7f158e-4bdf-4ff9-9b32-6334155c16ae	retries	process_retries	{"timestamp": "2026-02-09T18:03:51.606Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:03:51.606	2026-02-09 18:03:52.386	\N	\N	2026-02-09 18:03:51.606824	2026-02-09 18:03:52.389604
447	975e09ec-bba2-48c4-a1c6-64100f773894	retries	process_retries	{"timestamp": "2026-02-09T04:23:51.517Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:23:51.517	2026-02-09 04:23:52.132	\N	\N	2026-02-09 04:23:51.51806	2026-02-09 04:23:52.135372
452	bc3373df-bf92-4f93-a405-b79ba0e3db65	retries	process_retries	{"timestamp": "2026-02-09T04:48:51.519Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:48:51.519	2026-02-09 04:48:51.996	\N	\N	2026-02-09 04:48:51.520269	2026-02-09 04:48:52.000052
448	f57af00b-0a80-4b39-9962-d38d108f9e4e	retries	process_retries	{"timestamp": "2026-02-09T04:28:51.518Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:28:51.518	2026-02-09 04:28:52.322	\N	\N	2026-02-09 04:28:51.519233	2026-02-09 04:28:52.326126
454	c933b328-25da-49dc-8b5a-4a38c13c5503	retries	process_retries	{"timestamp": "2026-02-09T04:58:51.521Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:58:51.521	2026-02-09 04:58:52.347	\N	\N	2026-02-09 04:58:51.521828	2026-02-09 04:58:52.351249
449	802b3f3f-83b8-422b-ad6d-8339b0d5a8b2	retries	process_retries	{"timestamp": "2026-02-09T04:33:51.518Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 04:33:51.518	2026-02-09 04:33:52.503	\N	\N	2026-02-09 04:33:51.519362	2026-02-09 04:33:52.507592
456	ebbc2cce-cf7f-4d23-a0cb-b17362b4d5cc	retries	process_retries	{"timestamp": "2026-02-09T05:08:51.521Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:08:51.521	2026-02-09 05:08:51.697	\N	\N	2026-02-09 05:08:51.521747	2026-02-09 05:08:51.700407
458	64a316e9-e675-4e33-a6e5-ad75dfd7e49e	retries	process_retries	{"timestamp": "2026-02-09T05:18:51.522Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:18:51.522	2026-02-09 05:18:52.048	\N	\N	2026-02-09 05:18:51.522425	2026-02-09 05:18:52.052328
460	79566e1a-f5f7-4e28-a9d7-21df7e3f85b7	retries	process_retries	{"timestamp": "2026-02-09T05:28:51.522Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:28:51.522	2026-02-09 05:28:52.427	\N	\N	2026-02-09 05:28:51.523017	2026-02-09 05:28:52.431289
462	0f6b6f0c-c7fc-401b-b33e-779d000897fd	retries	process_retries	{"timestamp": "2026-02-09T05:38:51.522Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:38:51.522	2026-02-09 05:38:51.788	\N	\N	2026-02-09 05:38:51.52331	2026-02-09 05:38:51.792702
464	9df21113-1fed-418a-b488-bf0262dc0267	retries	process_retries	{"timestamp": "2026-02-09T05:48:51.524Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:48:51.524	2026-02-09 05:48:52.132	\N	\N	2026-02-09 05:48:51.524768	2026-02-09 05:48:52.135622
466	10e010a3-e95e-4647-aa28-a5d2b953b4ba	retries	process_retries	{"timestamp": "2026-02-09T05:58:51.525Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 05:58:51.525	2026-02-09 05:58:52.467	\N	\N	2026-02-09 05:58:51.525696	2026-02-09 05:58:52.471239
468	1fdda20a-c760-4473-9653-2cbf78b34210	retries	process_retries	{"timestamp": "2026-02-09T06:08:51.524Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:08:51.524	2026-02-09 06:08:51.851	\N	\N	2026-02-09 06:08:51.525243	2026-02-09 06:08:51.854821
470	21a26e57-07cc-43b6-8b97-0ab8443df94c	retries	process_retries	{"timestamp": "2026-02-09T06:18:51.525Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:18:51.525	2026-02-09 06:18:52.256	\N	\N	2026-02-09 06:18:51.525834	2026-02-09 06:18:52.261283
472	fda55175-0c50-419d-9542-2b00a0d5e14f	retries	process_retries	{"timestamp": "2026-02-09T06:28:51.525Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:28:51.526	2026-02-09 06:28:51.55	\N	\N	2026-02-09 06:28:51.5265	2026-02-09 06:28:51.554519
474	95effb0b-e1a2-41df-8ae3-8ced29376d7a	retries	process_retries	{"timestamp": "2026-02-09T06:38:51.528Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:38:51.528	2026-02-09 06:38:51.906	\N	\N	2026-02-09 06:38:51.529146	2026-02-09 06:38:51.90978
476	6b789650-eb6c-4455-aeb8-30137a8784b3	retries	process_retries	{"timestamp": "2026-02-09T06:48:51.530Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:48:51.53	2026-02-09 06:48:52.289	\N	\N	2026-02-09 06:48:51.530907	2026-02-09 06:48:52.29311
478	3efb1c32-e40b-4f0f-90f7-d454f8fa1fd1	retries	process_retries	{"timestamp": "2026-02-09T06:58:51.530Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 06:58:51.53	2026-02-09 06:58:51.676	\N	\N	2026-02-09 06:58:51.531084	2026-02-09 06:58:51.68065
480	8cbfb2ce-9b69-4008-bed7-e0094903192f	retries	process_retries	{"timestamp": "2026-02-09T07:08:51.531Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:08:51.532	2026-02-09 07:08:51.999	\N	\N	2026-02-09 07:08:51.532546	2026-02-09 07:08:52.003989
482	98fc943a-ab59-4f17-8409-7991cbb06516	retries	process_retries	{"timestamp": "2026-02-09T07:18:51.533Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:18:51.533	2026-02-09 07:18:52.349	\N	\N	2026-02-09 07:18:51.534013	2026-02-09 07:18:52.35229
484	d1a3f925-c534-4616-ae61-1c427a12305b	retries	process_retries	{"timestamp": "2026-02-09T07:28:51.533Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:28:51.533	2026-02-09 07:28:51.724	\N	\N	2026-02-09 07:28:51.534375	2026-02-09 07:28:51.728322
486	1ccaa858-428a-401e-b323-9db4e9c9f68e	retries	process_retries	{"timestamp": "2026-02-09T07:38:51.535Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:38:51.535	2026-02-09 07:38:52.081	\N	\N	2026-02-09 07:38:51.535978	2026-02-09 07:38:52.084111
488	b8090eb2-4335-4beb-bb94-1ddbedaef74f	retries	process_retries	{"timestamp": "2026-02-09T07:48:51.536Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:48:51.536	2026-02-09 07:48:52.436	\N	\N	2026-02-09 07:48:51.537085	2026-02-09 07:48:52.439862
490	3ddbc1fc-aac5-44bc-b45c-f467d1b86991	retries	process_retries	{"timestamp": "2026-02-09T07:58:51.537Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 07:58:51.537	2026-02-09 07:58:51.772	\N	\N	2026-02-09 07:58:51.537696	2026-02-09 07:58:51.775678
492	7915ac53-4c3c-494c-887f-5ccb665ad52c	retries	process_retries	{"timestamp": "2026-02-09T08:08:51.539Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:08:51.539	2026-02-09 08:08:52.143	\N	\N	2026-02-09 08:08:51.540004	2026-02-09 08:08:52.145938
494	37fbdeab-78dc-44bb-bcba-b5d8c43b5103	retries	process_retries	{"timestamp": "2026-02-09T08:18:51.541Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:18:51.541	2026-02-09 08:18:52.49	\N	\N	2026-02-09 08:18:51.542023	2026-02-09 08:18:52.493958
496	164f3cbc-8df3-42c7-bfa0-921da71a2473	retries	process_retries	{"timestamp": "2026-02-09T08:28:51.541Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:28:51.541	2026-02-09 08:28:51.879	\N	\N	2026-02-09 08:28:51.542238	2026-02-09 08:28:51.883437
498	83535676-029d-44c8-8902-9fa6b73d0668	retries	process_retries	{"timestamp": "2026-02-09T08:38:51.543Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:38:51.543	2026-02-09 08:38:52.2	\N	\N	2026-02-09 08:38:51.543756	2026-02-09 08:38:52.203215
500	b83c4b16-b79a-4f6f-9b61-0c8372a6a906	retries	process_retries	{"timestamp": "2026-02-09T08:48:51.543Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:48:51.543	2026-02-09 08:48:52.545	\N	\N	2026-02-09 08:48:51.543604	2026-02-09 08:48:52.548411
502	27c57e39-a9bf-4112-b2eb-fb34c39efb13	retries	process_retries	{"timestamp": "2026-02-09T08:58:51.544Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 08:58:51.544	2026-02-09 08:58:51.883	\N	\N	2026-02-09 08:58:51.545133	2026-02-09 08:58:51.886805
504	96ed5aa9-20cf-46b5-b262-9c92f9270bf3	retries	process_retries	{"timestamp": "2026-02-09T09:08:51.546Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:08:51.546	2026-02-09 09:08:52.296	\N	\N	2026-02-09 09:08:51.546614	2026-02-09 09:08:52.299364
506	927a975b-9860-4538-885a-5d92ea77594c	retries	process_retries	{"timestamp": "2026-02-09T09:18:51.546Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:18:51.546	2026-02-09 09:18:51.605	\N	\N	2026-02-09 09:18:51.547386	2026-02-09 09:18:51.609952
508	480bda44-ec84-4f2f-9652-6f0b23bf8ab4	retries	process_retries	{"timestamp": "2026-02-09T09:28:51.548Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:28:51.548	2026-02-09 09:28:51.931	\N	\N	2026-02-09 09:28:51.54884	2026-02-09 09:28:51.934438
510	24c44783-33de-4b84-944f-9ef02a41abe0	retries	process_retries	{"timestamp": "2026-02-09T09:38:51.549Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:38:51.549	2026-02-09 09:38:52.267	\N	\N	2026-02-09 09:38:51.549892	2026-02-09 09:38:52.270189
512	2208bd81-b20f-4b1c-bd93-cb55367ad117	retries	process_retries	{"timestamp": "2026-02-09T09:48:51.549Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:48:51.549	2026-02-09 09:48:51.664	\N	\N	2026-02-09 09:48:51.549848	2026-02-09 09:48:51.667022
514	8bca3744-e7df-42a0-b24d-3769530c5211	retries	process_retries	{"timestamp": "2026-02-09T09:58:51.550Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 09:58:51.55	2026-02-09 09:58:52.017	\N	\N	2026-02-09 09:58:51.550912	2026-02-09 09:58:52.021878
516	5dbc7911-3a96-40b1-b427-92ea6a2f9168	retries	process_retries	{"timestamp": "2026-02-09T10:08:51.551Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:08:51.551	2026-02-09 10:08:52.334	\N	\N	2026-02-09 10:08:51.552415	2026-02-09 10:08:52.340052
518	e224cbd4-7837-4f4b-b329-9a39c58ed0c7	retries	process_retries	{"timestamp": "2026-02-09T10:18:51.553Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:18:51.553	2026-02-09 10:18:51.71	\N	\N	2026-02-09 10:18:51.553846	2026-02-09 10:18:51.714819
519	59839402-2808-4f04-8b4b-9dacda0dae0f	retries	process_retries	{"timestamp": "2026-02-09T10:23:51.553Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:23:51.553	2026-02-09 10:23:51.898	\N	\N	2026-02-09 10:23:51.554046	2026-02-09 10:23:51.901019
520	f51e2dbc-a499-4e42-952c-4efaf0d38a83	retries	process_retries	{"timestamp": "2026-02-09T10:28:51.554Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:28:51.554	2026-02-09 10:28:52.09	\N	\N	2026-02-09 10:28:51.555168	2026-02-09 10:28:52.092905
521	810b4bfb-1d9e-44c6-a6df-8eba22afb43c	retries	process_retries	{"timestamp": "2026-02-09T10:33:51.555Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:33:51.555	2026-02-09 10:33:52.256	\N	\N	2026-02-09 10:33:51.555794	2026-02-09 10:33:52.25949
522	a0cf814d-ceec-4ddb-8767-87e0b0ac411e	retries	process_retries	{"timestamp": "2026-02-09T10:38:51.556Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:38:51.556	2026-02-09 10:38:52.433	\N	\N	2026-02-09 10:38:51.556872	2026-02-09 10:38:52.436651
523	10581244-c78f-48e8-b8a9-052ae794a3e7	retries	process_retries	{"timestamp": "2026-02-09T10:43:51.556Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:43:51.556	2026-02-09 10:43:51.587	\N	\N	2026-02-09 10:43:51.557249	2026-02-09 10:43:51.591169
524	460e8bff-2254-4b38-8f1e-2e2a7a9740ee	retries	process_retries	{"timestamp": "2026-02-09T10:48:51.556Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:48:51.556	2026-02-09 10:48:51.751	\N	\N	2026-02-09 10:48:51.557226	2026-02-09 10:48:51.754491
525	305e56d2-7f3c-4c57-bd6a-e2681cbbb95a	retries	process_retries	{"timestamp": "2026-02-09T10:53:51.556Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:53:51.556	2026-02-09 10:53:51.947	\N	\N	2026-02-09 10:53:51.557237	2026-02-09 10:53:51.950766
526	d62822d6-c1fa-49ab-8172-eefe1bf9fc02	retries	process_retries	{"timestamp": "2026-02-09T10:58:51.557Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 10:58:51.557	2026-02-09 10:58:52.127	\N	\N	2026-02-09 10:58:51.55804	2026-02-09 10:58:52.130317
706	4b0c2358-bd8c-47b5-8aa2-77148841bf71	retries	process_retries	{"timestamp": "2026-02-10T01:58:51.658Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:58:51.658	2026-02-10 01:58:52.541	\N	\N	2026-02-10 01:58:51.659257	2026-02-10 01:58:52.544353
529	1e1960df-fa64-4d21-ae76-317a0bb580bf	retries	process_retries	{"timestamp": "2026-02-09T11:13:51.559Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:13:51.559	2026-02-09 11:13:51.681	\N	\N	2026-02-09 11:13:51.559808	2026-02-09 11:13:51.684541
531	87ef2fce-9089-47cb-a797-14c48e9407a0	retries	process_retries	{"timestamp": "2026-02-09T11:23:51.560Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:23:51.56	2026-02-09 11:23:52.041	\N	\N	2026-02-09 11:23:51.561344	2026-02-09 11:23:52.045656
532	c342a896-c4bb-4eb0-a97c-03d77a294184	retries	process_retries	{"timestamp": "2026-02-09T11:28:51.561Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:28:51.561	2026-02-09 11:28:52.201	\N	\N	2026-02-09 11:28:51.561624	2026-02-09 11:28:52.204857
533	96748d18-a235-47d8-8e51-460db4a975a1	retries	process_retries	{"timestamp": "2026-02-09T11:33:51.562Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:33:51.562	2026-02-09 11:33:52.383	\N	\N	2026-02-09 11:33:51.563122	2026-02-09 11:33:52.386632
534	13ab6ecd-9032-4208-96a1-8b458866e2bf	retries	process_retries	{"timestamp": "2026-02-09T11:38:51.562Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:38:51.562	2026-02-09 11:38:52.552	\N	\N	2026-02-09 11:38:51.563242	2026-02-09 11:38:52.555171
535	849ec21b-4a21-4715-a18b-1d7f27c83f72	retries	process_retries	{"timestamp": "2026-02-09T11:43:51.562Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:43:51.562	2026-02-09 11:43:51.738	\N	\N	2026-02-09 11:43:51.563236	2026-02-09 11:43:51.741625
536	c9d93102-149a-440a-bac9-072739f80c89	retries	process_retries	{"timestamp": "2026-02-09T11:48:51.563Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:48:51.563	2026-02-09 11:48:51.894	\N	\N	2026-02-09 11:48:51.56405	2026-02-09 11:48:51.897212
537	2ad143a4-6192-4195-a9aa-f510d9550d47	retries	process_retries	{"timestamp": "2026-02-09T11:53:51.564Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:53:51.564	2026-02-09 11:53:52.093	\N	\N	2026-02-09 11:53:51.565043	2026-02-09 11:53:52.096953
538	c443c053-07fa-49a4-8255-b7784ae3a90a	retries	process_retries	{"timestamp": "2026-02-09T11:58:51.564Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 11:58:51.564	2026-02-09 11:58:52.259	\N	\N	2026-02-09 11:58:51.565213	2026-02-09 11:58:52.262334
539	79288ade-b8e9-469e-9703-95d1020849a3	retries	process_retries	{"timestamp": "2026-02-09T12:03:51.564Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:03:51.564	2026-02-09 12:03:52.475	\N	\N	2026-02-09 12:03:51.565271	2026-02-09 12:03:52.479223
540	aa369975-3139-4b3e-a8ef-294866c8a944	retries	process_retries	{"timestamp": "2026-02-09T12:08:51.566Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:08:51.566	2026-02-09 12:08:51.663	\N	\N	2026-02-09 12:08:51.56689	2026-02-09 12:08:51.666493
541	6323a34b-c8ca-48df-8274-5428afda746e	retries	process_retries	{"timestamp": "2026-02-09T12:13:51.567Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:13:51.567	2026-02-09 12:13:51.823	\N	\N	2026-02-09 12:13:51.567858	2026-02-09 12:13:51.826362
542	0c1a81c3-5c36-4c46-beb9-b3dc5662794a	retries	process_retries	{"timestamp": "2026-02-09T12:18:51.567Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:18:51.567	2026-02-09 12:18:51.989	\N	\N	2026-02-09 12:18:51.568211	2026-02-09 12:18:51.993197
543	373224b7-0602-4a04-89ab-c5703463a911	retries	process_retries	{"timestamp": "2026-02-09T12:23:51.568Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:23:51.569	2026-02-09 12:23:52.166	\N	\N	2026-02-09 12:23:51.569428	2026-02-09 12:23:52.169981
544	e622a40b-d7e9-478f-8739-c9eefccc601a	retries	process_retries	{"timestamp": "2026-02-09T12:28:51.568Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:28:51.568	2026-02-09 12:28:52.324	\N	\N	2026-02-09 12:28:51.569295	2026-02-09 12:28:52.327249
545	9abe340d-c8ae-49f4-9f54-ce77fd8b7423	retries	process_retries	{"timestamp": "2026-02-09T12:33:51.569Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:33:51.569	2026-02-09 12:33:52.51	\N	\N	2026-02-09 12:33:51.569498	2026-02-09 12:33:52.513964
546	f76a3611-3727-437d-912d-1f322c5fa874	retries	process_retries	{"timestamp": "2026-02-09T12:38:51.570Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:38:51.57	2026-02-09 12:38:51.703	\N	\N	2026-02-09 12:38:51.570757	2026-02-09 12:38:51.70718
547	a4365ced-378c-4dcb-be0b-56bb151405cc	retries	process_retries	{"timestamp": "2026-02-09T12:43:51.570Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:43:51.57	2026-02-09 12:43:51.874	\N	\N	2026-02-09 12:43:51.570537	2026-02-09 12:43:51.877301
548	385e8bf0-f60c-4726-8e2b-bfd690e805b3	retries	process_retries	{"timestamp": "2026-02-09T12:48:51.569Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:48:51.569	2026-02-09 12:48:52.073	\N	\N	2026-02-09 12:48:51.569874	2026-02-09 12:48:52.077048
549	cd90507a-1ef0-4ded-b81b-5efe0e1155a6	retries	process_retries	{"timestamp": "2026-02-09T12:53:51.570Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:53:51.57	2026-02-09 12:53:52.238	\N	\N	2026-02-09 12:53:51.570798	2026-02-09 12:53:52.241757
550	d897283b-a7b8-4a4e-8189-ab1da8d99a9f	retries	process_retries	{"timestamp": "2026-02-09T12:58:51.569Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 12:58:51.569	2026-02-09 12:58:52.402	\N	\N	2026-02-09 12:58:51.570359	2026-02-09 12:58:52.405217
551	3a8b0153-6554-4d3c-b4c9-03074bba7f56	retries	process_retries	{"timestamp": "2026-02-09T13:03:51.570Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:03:51.57	2026-02-09 13:03:52.572	\N	\N	2026-02-09 13:03:51.570668	2026-02-09 13:03:52.575118
552	fe5078c6-71be-47b0-afff-27b63088c933	retries	process_retries	{"timestamp": "2026-02-09T13:08:51.570Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:08:51.57	2026-02-09 13:08:51.733	\N	\N	2026-02-09 13:08:51.571283	2026-02-09 13:08:51.73716
553	78a95cd4-9fe7-4fef-b628-ec835aafc98e	retries	process_retries	{"timestamp": "2026-02-09T13:13:51.571Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:13:51.571	2026-02-09 13:13:51.932	\N	\N	2026-02-09 13:13:51.571968	2026-02-09 13:13:51.936573
554	6d8fdc56-cd48-4c0d-a419-41a80d34fb2d	retries	process_retries	{"timestamp": "2026-02-09T13:18:51.572Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:18:51.572	2026-02-09 13:18:52.124	\N	\N	2026-02-09 13:18:51.572893	2026-02-09 13:18:52.127865
555	8b5b05cb-f88b-4bb7-8a61-53309ce09a92	retries	process_retries	{"timestamp": "2026-02-09T13:23:51.572Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:23:51.572	2026-02-09 13:23:52.305	\N	\N	2026-02-09 13:23:51.57338	2026-02-09 13:23:52.308958
556	e500dfbd-8cea-425e-a78c-39293dda8497	retries	process_retries	{"timestamp": "2026-02-09T13:28:51.573Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:28:51.573	2026-02-09 13:28:52.504	\N	\N	2026-02-09 13:28:51.574055	2026-02-09 13:28:52.50725
557	d0669bd2-f517-46d6-8ef9-76c2b5c82731	retries	process_retries	{"timestamp": "2026-02-09T13:33:51.574Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:33:51.574	2026-02-09 13:33:51.674	\N	\N	2026-02-09 13:33:51.574998	2026-02-09 13:33:51.677149
558	7ade0987-307b-48a1-b345-2b83d0a64429	retries	process_retries	{"timestamp": "2026-02-09T13:38:51.575Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:38:51.575	2026-02-09 13:38:51.819	\N	\N	2026-02-09 13:38:51.575984	2026-02-09 13:38:51.823964
559	0f61d6a0-59ab-4132-b2ba-ffa59b3b9d50	retries	process_retries	{"timestamp": "2026-02-09T13:43:51.576Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:43:51.576	2026-02-09 13:43:52.006	\N	\N	2026-02-09 13:43:51.576487	2026-02-09 13:43:52.009576
560	33d0cf45-f0ed-4194-b71b-789197f90410	retries	process_retries	{"timestamp": "2026-02-09T13:48:51.576Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:48:51.576	2026-02-09 13:48:52.177	\N	\N	2026-02-09 13:48:51.576857	2026-02-09 13:48:52.180193
561	2bd40925-9f4a-4363-a3f1-14cb6f7c866a	retries	process_retries	{"timestamp": "2026-02-09T13:53:51.577Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:53:51.577	2026-02-09 13:53:52.369	\N	\N	2026-02-09 13:53:51.578034	2026-02-09 13:53:52.372951
562	145e7c43-b587-4ded-9d85-9a02e17daaed	retries	process_retries	{"timestamp": "2026-02-09T13:58:51.578Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 13:58:51.578	2026-02-09 13:58:52.553	\N	\N	2026-02-09 13:58:51.578933	2026-02-09 13:58:52.556906
563	927f3a6b-124b-4a8c-a561-45248b24369b	retries	process_retries	{"timestamp": "2026-02-09T14:03:51.578Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:03:51.579	2026-02-09 14:03:51.767	\N	\N	2026-02-09 14:03:51.579406	2026-02-09 14:03:51.770415
564	c8627d34-ca4e-4335-89ac-59fb762c54fd	retries	process_retries	{"timestamp": "2026-02-09T14:08:51.579Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:08:51.579	2026-02-09 14:08:51.945	\N	\N	2026-02-09 14:08:51.579853	2026-02-09 14:08:51.948107
565	8ac485a7-1451-476e-8c2f-5a93dc1034e6	retries	process_retries	{"timestamp": "2026-02-09T14:13:51.580Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:13:51.58	2026-02-09 14:13:52.138	\N	\N	2026-02-09 14:13:51.580807	2026-02-09 14:13:52.14148
566	b5b72f81-5b37-4890-a958-eb544fd04636	retries	process_retries	{"timestamp": "2026-02-09T14:18:51.579Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:18:51.58	2026-02-09 14:18:52.303	\N	\N	2026-02-09 14:18:51.580513	2026-02-09 14:18:52.306077
567	4d4e08f2-d88c-4b9b-8875-172a780d5c1b	retries	process_retries	{"timestamp": "2026-02-09T14:23:51.580Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:23:51.58	2026-02-09 14:23:52.481	\N	\N	2026-02-09 14:23:51.58049	2026-02-09 14:23:52.485128
568	641fb8c5-7a07-4d1c-86f5-b3ea1d5b508c	retries	process_retries	{"timestamp": "2026-02-09T14:28:51.581Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:28:51.581	2026-02-09 14:28:51.674	\N	\N	2026-02-09 14:28:51.582038	2026-02-09 14:28:51.678401
569	581b7a1c-022e-4ea8-8a7b-1d56f7491639	retries	process_retries	{"timestamp": "2026-02-09T14:33:51.580Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:33:51.58	2026-02-09 14:33:51.906	\N	\N	2026-02-09 14:33:51.581355	2026-02-09 14:33:51.909336
570	654c6139-f757-4094-b305-4555445fa37c	retries	process_retries	{"timestamp": "2026-02-09T14:38:51.581Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:38:51.581	2026-02-09 14:38:52.069	\N	\N	2026-02-09 14:38:51.58161	2026-02-09 14:38:52.072994
571	9707ff20-9bc3-4d4d-9f12-8e5b2eba08c4	retries	process_retries	{"timestamp": "2026-02-09T14:43:51.582Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:43:51.582	2026-02-09 14:43:52.251	\N	\N	2026-02-09 14:43:51.582742	2026-02-09 14:43:52.254791
572	1bf8a39e-4403-4032-a2e2-e3fb901a5b9d	retries	process_retries	{"timestamp": "2026-02-09T14:48:51.581Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:48:51.581	2026-02-09 14:48:52.448	\N	\N	2026-02-09 14:48:51.582353	2026-02-09 14:48:52.451569
573	ecfe6e9b-693d-4d14-ab0a-8c653022e0f2	retries	process_retries	{"timestamp": "2026-02-09T14:53:51.582Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:53:51.582	2026-02-09 14:53:51.612	\N	\N	2026-02-09 14:53:51.58244	2026-02-09 14:53:51.61563
574	d116b124-a39f-4571-bffc-b52dab7bd111	retries	process_retries	{"timestamp": "2026-02-09T14:58:51.582Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 14:58:51.583	2026-02-09 14:58:51.775	\N	\N	2026-02-09 14:58:51.583486	2026-02-09 14:58:51.778509
575	f3619e10-b99f-46e3-b5d1-24cadc5562e5	retries	process_retries	{"timestamp": "2026-02-09T15:03:51.584Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:03:51.584	2026-02-09 15:03:51.979	\N	\N	2026-02-09 15:03:51.584664	2026-02-09 15:03:51.983615
576	bdfdcfd5-dbc0-46f8-957a-cdfea29b8f38	retries	process_retries	{"timestamp": "2026-02-09T15:08:51.583Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:08:51.583	2026-02-09 15:08:52.176	\N	\N	2026-02-09 15:08:51.584241	2026-02-09 15:08:52.180188
577	0e77fbd8-c875-4686-81ef-8ba532f3b21b	retries	process_retries	{"timestamp": "2026-02-09T15:13:51.583Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:13:51.583	2026-02-09 15:13:52.339	\N	\N	2026-02-09 15:13:51.584418	2026-02-09 15:13:52.342229
578	3d34d57d-df9e-4b33-a24b-b01525715c9b	retries	process_retries	{"timestamp": "2026-02-09T15:18:51.584Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:18:51.584	2026-02-09 15:18:52.525	\N	\N	2026-02-09 15:18:51.585171	2026-02-09 15:18:52.528491
579	8e663dde-06fd-46a9-862e-804a27e5351b	retries	process_retries	{"timestamp": "2026-02-09T15:23:51.584Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:23:51.584	2026-02-09 15:23:51.709	\N	\N	2026-02-09 15:23:51.58544	2026-02-09 15:23:51.713002
580	2b5f0ba4-e956-4047-b150-55105e0875a0	retries	process_retries	{"timestamp": "2026-02-09T15:28:51.585Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:28:51.585	2026-02-09 15:28:51.919	\N	\N	2026-02-09 15:28:51.586071	2026-02-09 15:28:51.924308
581	62d1bc0f-a0d1-48cc-8a80-d78a7aa0cfda	retries	process_retries	{"timestamp": "2026-02-09T15:33:51.586Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:33:51.586	2026-02-09 15:33:52.117	\N	\N	2026-02-09 15:33:51.586755	2026-02-09 15:33:52.121852
582	cfeaa2a8-9c20-48e3-af8b-5d0e2a274efe	retries	process_retries	{"timestamp": "2026-02-09T15:38:51.586Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:38:51.586	2026-02-09 15:38:52.298	\N	\N	2026-02-09 15:38:51.587065	2026-02-09 15:38:52.302635
583	97ad5de3-3e93-4775-acbc-4430443bff33	retries	process_retries	{"timestamp": "2026-02-09T15:43:51.587Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:43:51.587	2026-02-09 15:43:52.454	\N	\N	2026-02-09 15:43:51.587988	2026-02-09 15:43:52.457614
584	ebcc4b0f-5cbd-4040-9e70-83a9d548c2f8	retries	process_retries	{"timestamp": "2026-02-09T15:48:51.588Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:48:51.588	2026-02-09 15:48:51.613	\N	\N	2026-02-09 15:48:51.589015	2026-02-09 15:48:51.616426
585	7013bf57-33d2-4975-8097-43a499c54997	retries	process_retries	{"timestamp": "2026-02-09T15:53:51.588Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:53:51.588	2026-02-09 15:53:51.791	\N	\N	2026-02-09 15:53:51.589213	2026-02-09 15:53:51.795934
586	7c178d2a-c02c-46f9-a28c-8e342f68039f	retries	process_retries	{"timestamp": "2026-02-09T15:58:51.589Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 15:58:51.589	2026-02-09 15:58:51.959	\N	\N	2026-02-09 15:58:51.589976	2026-02-09 15:58:51.96249
587	674b424e-6987-491d-89fd-95878a0fe402	retries	process_retries	{"timestamp": "2026-02-09T16:03:51.590Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:03:51.59	2026-02-09 16:03:52.136	\N	\N	2026-02-09 16:03:51.590647	2026-02-09 16:03:52.140392
588	c843e662-92fa-4659-81e6-9e00fd02d141	retries	process_retries	{"timestamp": "2026-02-09T16:08:51.590Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:08:51.59	2026-02-09 16:08:52.329	\N	\N	2026-02-09 16:08:51.590906	2026-02-09 16:08:52.332926
589	913f62df-a7b9-48ef-add1-b42919edf89a	retries	process_retries	{"timestamp": "2026-02-09T16:13:51.591Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:13:51.591	2026-02-09 16:13:52.497	\N	\N	2026-02-09 16:13:51.591521	2026-02-09 16:13:52.501512
590	178db29a-6812-4a59-aa34-f3c3ebd7e2f6	retries	process_retries	{"timestamp": "2026-02-09T16:18:51.592Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:18:51.592	2026-02-09 16:18:51.709	\N	\N	2026-02-09 16:18:51.593199	2026-02-09 16:18:51.712628
591	12920bbc-8258-47c3-95c8-d9439919d6a3	retries	process_retries	{"timestamp": "2026-02-09T16:23:51.593Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:23:51.593	2026-02-09 16:23:51.874	\N	\N	2026-02-09 16:23:51.593512	2026-02-09 16:23:51.877099
592	d3ca6c8c-4449-4b07-963d-f4bf9bb7f093	retries	process_retries	{"timestamp": "2026-02-09T16:28:51.593Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:28:51.593	2026-02-09 16:28:52.012	\N	\N	2026-02-09 16:28:51.593902	2026-02-09 16:28:52.016105
593	78a076d6-5490-47f5-966d-46e6f8423009	retries	process_retries	{"timestamp": "2026-02-09T16:33:51.594Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:33:51.594	2026-02-09 16:33:52.191	\N	\N	2026-02-09 16:33:51.594514	2026-02-09 16:33:52.195381
612	c3c67a51-48ba-43ad-b8d5-a25788e39473	retries	process_retries	{"timestamp": "2026-02-09T18:08:51.607Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:08:51.607	2026-02-09 18:08:52.571	\N	\N	2026-02-09 18:08:51.608076	2026-02-09 18:08:52.574753
594	1547125f-bfc2-4370-aa40-b17d8794d38f	retries	process_retries	{"timestamp": "2026-02-09T16:38:51.594Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:38:51.594	2026-02-09 16:38:52.355	\N	\N	2026-02-09 16:38:51.594611	2026-02-09 16:38:52.359327
613	1edca011-d3ab-486d-8743-2744f9d13c9d	retries	process_retries	{"timestamp": "2026-02-09T18:13:51.608Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:13:51.608	2026-02-09 18:13:51.729	\N	\N	2026-02-09 18:13:51.609084	2026-02-09 18:13:51.732402
614	00454e02-52c1-4a5d-b6a1-b7651b829b7c	retries	process_retries	{"timestamp": "2026-02-09T18:18:51.610Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:18:51.61	2026-02-09 18:18:51.899	\N	\N	2026-02-09 18:18:51.610385	2026-02-09 18:18:51.90324
595	aa23a898-3a73-4c6d-aad3-2f441e95e7ce	retries	process_retries	{"timestamp": "2026-02-09T16:43:51.594Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:43:51.594	2026-02-09 16:43:52.522	\N	\N	2026-02-09 16:43:51.595167	2026-02-09 16:43:52.524854
615	405ad6aa-c6a8-48fe-b134-f3c9bba7c8cf	retries	process_retries	{"timestamp": "2026-02-09T18:23:51.610Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:23:51.61	2026-02-09 18:23:52.082	\N	\N	2026-02-09 18:23:51.610899	2026-02-09 18:23:52.085252
616	5351287d-7d97-4ce3-9963-049bed2fc781	retries	process_retries	{"timestamp": "2026-02-09T18:28:51.609Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:28:51.609	2026-02-09 18:28:52.293	\N	\N	2026-02-09 18:28:51.610398	2026-02-09 18:28:52.296699
596	d4becc07-ad8c-4ec5-aa4c-619848af9905	retries	process_retries	{"timestamp": "2026-02-09T16:48:51.595Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:48:51.595	2026-02-09 16:48:51.712	\N	\N	2026-02-09 16:48:51.595664	2026-02-09 16:48:51.715919
617	45572bf8-1639-4a59-99a3-a426bc38c918	retries	process_retries	{"timestamp": "2026-02-09T18:33:51.609Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:33:51.609	2026-02-09 18:33:52.484	\N	\N	2026-02-09 18:33:51.61037	2026-02-09 18:33:52.487439
618	776cc61f-0369-42e3-9e61-4e83ecc05a69	retries	process_retries	{"timestamp": "2026-02-09T18:38:51.611Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:38:51.611	2026-02-09 18:38:51.639	\N	\N	2026-02-09 18:38:51.611914	2026-02-09 18:38:51.643482
597	ddb9a2cb-a1db-4950-8c7a-b1512350561a	retries	process_retries	{"timestamp": "2026-02-09T16:53:51.595Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:53:51.595	2026-02-09 16:53:51.913	\N	\N	2026-02-09 16:53:51.595505	2026-02-09 16:53:51.916878
619	26d3ad3a-58ba-4b33-9dea-5917cb6e16cd	retries	process_retries	{"timestamp": "2026-02-09T18:43:51.611Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:43:51.611	2026-02-09 18:43:51.819	\N	\N	2026-02-09 18:43:51.612064	2026-02-09 18:43:51.8231
620	0df3501d-00ba-4498-bba2-5a8b32627224	retries	process_retries	{"timestamp": "2026-02-09T18:48:51.612Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:48:51.612	2026-02-09 18:48:51.962	\N	\N	2026-02-09 18:48:51.612516	2026-02-09 18:48:51.966444
598	d80b254c-fa9d-40f9-8845-2083505713f5	retries	process_retries	{"timestamp": "2026-02-09T16:58:51.595Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 16:58:51.595	2026-02-09 16:58:52.081	\N	\N	2026-02-09 16:58:51.595787	2026-02-09 16:58:52.084268
621	20fb71c8-2053-4d78-b241-8829e77cc184	retries	process_retries	{"timestamp": "2026-02-09T18:53:51.612Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:53:51.612	2026-02-09 18:53:52.117	\N	\N	2026-02-09 18:53:51.613521	2026-02-09 18:53:52.120619
622	e78ae248-9078-44d8-b89a-ca9ca44b8c54	retries	process_retries	{"timestamp": "2026-02-09T18:58:51.612Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 18:58:51.612	2026-02-09 18:58:52.297	\N	\N	2026-02-09 18:58:51.613369	2026-02-09 18:58:52.300831
599	69695606-d2c3-4265-9352-4190cd73db32	retries	process_retries	{"timestamp": "2026-02-09T17:03:51.596Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:03:51.596	2026-02-09 17:03:52.273	\N	\N	2026-02-09 17:03:51.597096	2026-02-09 17:03:52.277388
623	c995b97a-0c7f-4953-9aba-c5e7a394d005	retries	process_retries	{"timestamp": "2026-02-09T19:03:51.613Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:03:51.613	2026-02-09 19:03:52.512	\N	\N	2026-02-09 19:03:51.61392	2026-02-09 19:03:52.516608
624	29a61243-2474-4d10-9940-87fb5040a36e	retries	process_retries	{"timestamp": "2026-02-09T19:08:51.614Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:08:51.614	2026-02-09 19:08:51.726	\N	\N	2026-02-09 19:08:51.615233	2026-02-09 19:08:51.729555
600	bf072f7f-e549-40a3-868c-9efe93531b6c	retries	process_retries	{"timestamp": "2026-02-09T17:08:51.597Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:08:51.597	2026-02-09 17:08:52.439	\N	\N	2026-02-09 17:08:51.597781	2026-02-09 17:08:52.442274
625	c1445b95-fa3e-4c2f-96cb-f1f31becaa08	retries	process_retries	{"timestamp": "2026-02-09T19:13:51.614Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:13:51.615	2026-02-09 19:13:51.938	\N	\N	2026-02-09 19:13:51.615485	2026-02-09 19:13:51.941732
626	a14e4273-a8d8-4484-b0fb-0903baf368bb	retries	process_retries	{"timestamp": "2026-02-09T19:18:51.615Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:18:51.615	2026-02-09 19:18:52.109	\N	\N	2026-02-09 19:18:51.615912	2026-02-09 19:18:52.112772
601	4e74b563-db08-4a96-a533-914e0bc186ef	retries	process_retries	{"timestamp": "2026-02-09T17:13:51.597Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:13:51.597	2026-02-09 17:13:51.604	\N	\N	2026-02-09 17:13:51.598218	2026-02-09 17:13:51.608699
627	4f575f74-69da-4b51-9550-d9cd371448d7	retries	process_retries	{"timestamp": "2026-02-09T19:23:51.616Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:23:51.616	2026-02-09 19:23:52.253	\N	\N	2026-02-09 19:23:51.616972	2026-02-09 19:23:52.258111
628	eaf17aec-4036-4105-8f42-1be776966a2e	retries	process_retries	{"timestamp": "2026-02-09T19:28:51.616Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:28:51.616	2026-02-09 19:28:52.423	\N	\N	2026-02-09 19:28:51.616557	2026-02-09 19:28:52.426774
602	124c595a-ff95-4747-b6e7-89289787578f	retries	process_retries	{"timestamp": "2026-02-09T17:18:51.599Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:18:51.599	2026-02-09 17:18:51.784	\N	\N	2026-02-09 17:18:51.600088	2026-02-09 17:18:51.787865
629	76dd2a37-d22b-41dd-8fe6-29c728b28816	retries	process_retries	{"timestamp": "2026-02-09T19:33:51.616Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:33:51.616	2026-02-09 19:33:52.594	\N	\N	2026-02-09 19:33:51.617048	2026-02-09 19:33:52.598272
630	fd0c9a1a-c595-471a-b454-30f61b71bb75	retries	process_retries	{"timestamp": "2026-02-09T19:38:51.616Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:38:51.616	2026-02-09 19:38:51.786	\N	\N	2026-02-09 19:38:51.617303	2026-02-09 19:38:51.790761
603	c5ec69e5-e7f8-481b-a952-274f5991d013	retries	process_retries	{"timestamp": "2026-02-09T17:23:51.600Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:23:51.6	2026-02-09 17:23:51.987	\N	\N	2026-02-09 17:23:51.600779	2026-02-09 17:23:51.991807
631	6a0fcd94-a23c-4c2a-9f3f-cd2c89df231d	retries	process_retries	{"timestamp": "2026-02-09T19:43:51.617Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:43:51.617	2026-02-09 19:43:51.999	\N	\N	2026-02-09 19:43:51.617948	2026-02-09 19:43:52.003561
632	1d0c4e83-e5ab-43d1-8460-e8c4f173e2ac	retries	process_retries	{"timestamp": "2026-02-09T19:48:51.618Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:48:51.618	2026-02-09 19:48:52.176	\N	\N	2026-02-09 19:48:51.618723	2026-02-09 19:48:52.179421
604	2cd958ff-e3be-49cd-a5e3-7fa6cc8a9b74	retries	process_retries	{"timestamp": "2026-02-09T17:28:51.600Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:28:51.6	2026-02-09 17:28:52.161	\N	\N	2026-02-09 17:28:51.601405	2026-02-09 17:28:52.164379
605	645d52e3-9858-4556-ad2b-83dcde1519fa	retries	process_retries	{"timestamp": "2026-02-09T17:33:51.601Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:33:51.601	2026-02-09 17:33:52.348	\N	\N	2026-02-09 17:33:51.602039	2026-02-09 17:33:52.352701
606	e5ee0a05-9ea0-4115-997a-0bcb8415268a	retries	process_retries	{"timestamp": "2026-02-09T17:38:51.602Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:38:51.602	2026-02-09 17:38:52.537	\N	\N	2026-02-09 17:38:51.603077	2026-02-09 17:38:52.540634
607	97522c65-6267-4582-8b7c-568359ca3758	retries	process_retries	{"timestamp": "2026-02-09T17:43:51.603Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:43:51.603	2026-02-09 17:43:51.719	\N	\N	2026-02-09 17:43:51.604148	2026-02-09 17:43:51.721813
608	95f23bbe-a040-4871-a755-10535d0ac9e6	retries	process_retries	{"timestamp": "2026-02-09T17:48:51.603Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:48:51.604	2026-02-09 17:48:51.899	\N	\N	2026-02-09 17:48:51.604472	2026-02-09 17:48:51.902667
609	3764336c-9838-49bc-8a35-0539fb56508f	retries	process_retries	{"timestamp": "2026-02-09T17:53:51.605Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:53:51.605	2026-02-09 17:53:52.069	\N	\N	2026-02-09 17:53:51.605776	2026-02-09 17:53:52.073718
610	a51a98f4-2dd2-4128-9615-753fbb140c54	retries	process_retries	{"timestamp": "2026-02-09T17:58:51.605Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 17:58:51.605	2026-02-09 17:58:52.216	\N	\N	2026-02-09 17:58:51.605956	2026-02-09 17:58:52.218964
633	9344cfe1-2c95-4d40-9552-2d547bbf861a	retries	process_retries	{"timestamp": "2026-02-09T19:53:51.619Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:53:51.619	2026-02-09 19:53:52.371	\N	\N	2026-02-09 19:53:51.620002	2026-02-09 19:53:52.374715
707	aba6678b-b7e7-4ab6-85ac-79f9e36d5e09	cleanup	cleanup_queue	{"daysOld": 7}	completed	1	1	\N	{"success": true, "jobsCleared": 0}	2026-02-10 02:00:00.003	2026-02-10 02:00:00.585	2026-02-10 02:00:00.598122	\N	2026-02-10 02:00:00.0039	2026-02-10 02:00:00.598122
709	e14c0adb-70b2-4b71-917b-153c613abb47	retries	process_retries	{"timestamp": "2026-02-10T02:08:51.659Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:08:51.659	2026-02-10 02:08:51.937	\N	\N	2026-02-10 02:08:51.659968	2026-02-10 02:08:51.941066
710	4398dfdb-1148-471f-aa9b-4c334ad0191d	retries	process_retries	{"timestamp": "2026-02-10T02:13:51.660Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:13:51.66	2026-02-10 02:13:52.138	\N	\N	2026-02-10 02:13:51.660465	2026-02-10 02:13:52.141409
711	0a6c95ab-c0b6-45b0-842d-32c0023d2c5f	retries	process_retries	{"timestamp": "2026-02-10T02:18:51.659Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:18:51.659	2026-02-10 02:18:52.338	\N	\N	2026-02-10 02:18:51.660156	2026-02-10 02:18:52.341582
712	4abdad9f-bc65-49db-b697-65e477a7339d	retries	process_retries	{"timestamp": "2026-02-10T02:23:51.660Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:23:51.66	2026-02-10 02:23:52.496	\N	\N	2026-02-10 02:23:51.660572	2026-02-10 02:23:52.499516
713	0cceb505-ee15-4c76-a21d-f7841e036ccb	retries	process_retries	{"timestamp": "2026-02-10T02:28:51.660Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:28:51.66	2026-02-10 02:28:51.666	\N	\N	2026-02-10 02:28:51.660596	2026-02-10 02:28:51.669814
714	0cc1bb50-a8b5-48dd-a395-5158ef58dafc	retries	process_retries	{"timestamp": "2026-02-10T02:33:51.661Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:33:51.661	2026-02-10 02:33:51.85	\N	\N	2026-02-10 02:33:51.662115	2026-02-10 02:33:51.854007
715	60ae8c63-cb66-428c-aa04-f0c54e5112d1	retries	process_retries	{"timestamp": "2026-02-10T02:38:51.662Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:38:51.662	2026-02-10 02:38:52.042	\N	\N	2026-02-10 02:38:51.662869	2026-02-10 02:38:52.046219
716	51dd1fae-0830-4821-842b-75b8967d8065	retries	process_retries	{"timestamp": "2026-02-10T02:43:51.662Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:43:51.662	2026-02-10 02:43:52.239	\N	\N	2026-02-10 02:43:51.663103	2026-02-10 02:43:52.242957
717	4bfd021c-2abc-43d5-bd2a-49a05b075877	retries	process_retries	{"timestamp": "2026-02-10T02:48:51.662Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:48:51.662	2026-02-10 02:48:52.436	\N	\N	2026-02-10 02:48:51.6634	2026-02-10 02:48:52.439372
718	69d9fcfb-3365-42cd-b398-87792ad619d4	retries	process_retries	{"timestamp": "2026-02-10T02:53:51.661Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:53:51.661	2026-02-10 02:53:52.611	\N	\N	2026-02-10 02:53:51.662099	2026-02-10 02:53:52.615721
719	a1c046f9-42c2-42b2-b65d-badadb93fc4b	retries	process_retries	{"timestamp": "2026-02-10T02:58:51.663Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 02:58:51.663	2026-02-10 02:58:51.823	\N	\N	2026-02-10 02:58:51.663668	2026-02-10 02:58:51.826585
720	e7e78d42-1459-48d6-b213-892ba3ec762c	retries	process_retries	{"timestamp": "2026-02-10T03:03:51.662Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:03:51.663	2026-02-10 03:03:51.992	\N	\N	2026-02-10 03:03:51.66352	2026-02-10 03:03:51.995365
721	4ef486b5-a13b-4a96-9084-8a01491f6982	retries	process_retries	{"timestamp": "2026-02-10T03:08:51.663Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:08:51.663	2026-02-10 03:08:52.151	\N	\N	2026-02-10 03:08:51.663379	2026-02-10 03:08:52.154915
722	14258793-9411-4ea1-9c54-04d629e981f2	retries	process_retries	{"timestamp": "2026-02-10T03:13:51.663Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:13:51.663	2026-02-10 03:13:52.344	\N	\N	2026-02-10 03:13:51.663654	2026-02-10 03:13:52.347862
723	fc638072-15b2-4bd2-b62a-1a1d43a1fced	retries	process_retries	{"timestamp": "2026-02-10T03:18:51.662Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:18:51.662	2026-02-10 03:18:52.588	\N	\N	2026-02-10 03:18:51.663199	2026-02-10 03:18:52.592259
724	3bc71429-c8d9-4b07-a6f8-90c3fb533b5c	retries	process_retries	{"timestamp": "2026-02-10T03:23:51.663Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:23:51.663	2026-02-10 03:23:51.765	\N	\N	2026-02-10 03:23:51.663472	2026-02-10 03:23:51.769185
725	0fe45938-dd28-4214-b201-73aeb2fef979	retries	process_retries	{"timestamp": "2026-02-10T03:28:51.663Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:28:51.664	2026-02-10 03:28:51.954	\N	\N	2026-02-10 03:28:51.664369	2026-02-10 03:28:51.958501
726	79e7583b-eb95-434d-bfdc-e3a80f727d32	retries	process_retries	{"timestamp": "2026-02-10T03:33:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:33:51.664	2026-02-10 03:33:52.154	\N	\N	2026-02-10 03:33:51.664769	2026-02-10 03:33:52.158352
727	33638ed1-faaf-45c5-8394-401fa10713e6	retries	process_retries	{"timestamp": "2026-02-10T03:38:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:38:51.664	2026-02-10 03:38:52.313	\N	\N	2026-02-10 03:38:51.665012	2026-02-10 03:38:52.317276
728	293efee3-8124-4886-b7e0-442b3a24fc69	retries	process_retries	{"timestamp": "2026-02-10T03:43:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:43:51.665	2026-02-10 03:43:52.457	\N	\N	2026-02-10 03:43:51.665676	2026-02-10 03:43:52.461858
729	28ce1b31-05fc-438f-b949-b739d8d4c372	retries	process_retries	{"timestamp": "2026-02-10T03:48:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:48:51.664	2026-02-10 03:48:52.628	\N	\N	2026-02-10 03:48:51.665253	2026-02-10 03:48:52.631272
730	65e359fe-7c6e-4324-beb7-a7a8da2d93a1	retries	process_retries	{"timestamp": "2026-02-10T03:53:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:53:51.665	2026-02-10 03:53:51.817	\N	\N	2026-02-10 03:53:51.665724	2026-02-10 03:53:51.821086
731	595da803-b204-4f20-9cfc-778b96412e6d	retries	process_retries	{"timestamp": "2026-02-10T03:58:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 03:58:51.664	2026-02-10 03:58:52.01	\N	\N	2026-02-10 03:58:51.665189	2026-02-10 03:58:52.01431
732	8cecc95a-9a5d-4dd0-a9cf-9360644f5b81	retries	process_retries	{"timestamp": "2026-02-10T04:03:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:03:51.664	2026-02-10 04:03:52.192	\N	\N	2026-02-10 04:03:51.664929	2026-02-10 04:03:52.196205
733	9e087b59-370c-40c3-9b4f-03ddb9494488	retries	process_retries	{"timestamp": "2026-02-10T04:08:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:08:51.664	2026-02-10 04:08:52.373	\N	\N	2026-02-10 04:08:51.665201	2026-02-10 04:08:52.376831
734	c58f51b5-dca8-4c83-af74-e6143c5ad23e	retries	process_retries	{"timestamp": "2026-02-10T04:13:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:13:51.664	2026-02-10 04:13:52.536	\N	\N	2026-02-10 04:13:51.665163	2026-02-10 04:13:52.539958
735	5aa1bbdd-fa8b-41ae-8721-843d3383730a	retries	process_retries	{"timestamp": "2026-02-10T04:18:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:18:51.665	2026-02-10 04:18:51.731	\N	\N	2026-02-10 04:18:51.665803	2026-02-10 04:18:51.734489
736	567d0fde-dbd3-4d46-886f-245d2a41a747	retries	process_retries	{"timestamp": "2026-02-10T04:23:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:23:51.664	2026-02-10 04:23:51.899	\N	\N	2026-02-10 04:23:51.664969	2026-02-10 04:23:51.903194
737	4af6eb82-d907-46e5-800e-50bfdb5e994d	retries	process_retries	{"timestamp": "2026-02-10T04:28:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:28:51.664	2026-02-10 04:28:52.048	\N	\N	2026-02-10 04:28:51.665136	2026-02-10 04:28:52.05217
738	5f03f46d-0685-4698-9072-7e60b8b78df1	retries	process_retries	{"timestamp": "2026-02-10T04:33:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:33:51.665	2026-02-10 04:33:52.236	\N	\N	2026-02-10 04:33:51.665364	2026-02-10 04:33:52.239724
739	bb248e64-eb50-4a18-b0ae-103deb1ee22f	retries	process_retries	{"timestamp": "2026-02-10T04:38:51.664Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:38:51.664	2026-02-10 04:38:52.4	\N	\N	2026-02-10 04:38:51.665073	2026-02-10 04:38:52.403897
740	30ebd437-6e69-4403-9654-d34aa09c0619	retries	process_retries	{"timestamp": "2026-02-10T04:43:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:43:51.665	2026-02-10 04:43:52.57	\N	\N	2026-02-10 04:43:51.665743	2026-02-10 04:43:52.57326
741	a73401bb-1b0e-47fc-b288-69ffe1e9eefa	retries	process_retries	{"timestamp": "2026-02-10T04:48:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:48:51.665	2026-02-10 04:48:51.783	\N	\N	2026-02-10 04:48:51.665434	2026-02-10 04:48:51.788003
742	3de68944-82ac-4dc1-bb2f-68f6a1093b07	retries	process_retries	{"timestamp": "2026-02-10T04:53:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:53:51.665	2026-02-10 04:53:51.954	\N	\N	2026-02-10 04:53:51.666107	2026-02-10 04:53:51.957672
634	207163a8-4545-42ae-b27d-7e2f8b498b33	retries	process_retries	{"timestamp": "2026-02-09T19:58:51.618Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 19:58:51.618	2026-02-09 19:58:52.547	\N	\N	2026-02-09 19:58:51.619119	2026-02-09 19:58:52.55054
635	45c85dde-eb4c-405a-9638-44676324023c	retries	process_retries	{"timestamp": "2026-02-09T20:03:51.619Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:03:51.619	2026-02-09 20:03:51.687	\N	\N	2026-02-09 20:03:51.620023	2026-02-09 20:03:51.690335
636	4700fab3-07bb-4f94-a8d8-e2069444a884	retries	process_retries	{"timestamp": "2026-02-09T20:08:51.620Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:08:51.62	2026-02-09 20:08:51.837	\N	\N	2026-02-09 20:08:51.620791	2026-02-09 20:08:51.840791
637	01d40232-281a-4e64-922f-02fbe76c2be3	retries	process_retries	{"timestamp": "2026-02-09T20:13:51.620Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:13:51.62	2026-02-09 20:13:52.016	\N	\N	2026-02-09 20:13:51.620797	2026-02-09 20:13:52.01894
638	0943ad1e-f850-4d86-a2be-441ad2915f5d	retries	process_retries	{"timestamp": "2026-02-09T20:18:51.620Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:18:51.62	2026-02-09 20:18:52.193	\N	\N	2026-02-09 20:18:51.621	2026-02-09 20:18:52.196674
639	9cd6fc4d-4f68-4c59-bb12-a742faf14654	retries	process_retries	{"timestamp": "2026-02-09T20:23:51.621Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:23:51.621	2026-02-09 20:23:52.377	\N	\N	2026-02-09 20:23:51.621735	2026-02-09 20:23:52.381163
640	b7b5e298-ed60-4ccc-af42-892478124342	retries	process_retries	{"timestamp": "2026-02-09T20:28:51.621Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:28:51.621	2026-02-09 20:28:52.599	\N	\N	2026-02-09 20:28:51.621954	2026-02-09 20:28:52.602984
641	900623f4-7df6-43c0-b9b9-bb130c88763a	retries	process_retries	{"timestamp": "2026-02-09T20:33:51.622Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:33:51.622	2026-02-09 20:33:51.755	\N	\N	2026-02-09 20:33:51.622706	2026-02-09 20:33:51.758954
642	5d0c1b30-31ad-4dee-aca8-872054f94b17	retries	process_retries	{"timestamp": "2026-02-09T20:38:51.623Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:38:51.623	2026-02-09 20:38:51.906	\N	\N	2026-02-09 20:38:51.623561	2026-02-09 20:38:51.910394
643	ff990b29-2ecc-46aa-9291-66b417cf4d77	retries	process_retries	{"timestamp": "2026-02-09T20:43:51.624Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:43:51.624	2026-02-09 20:43:52.104	\N	\N	2026-02-09 20:43:51.624819	2026-02-09 20:43:52.107658
644	0603780a-ead1-4e98-9c1b-55c1e52d4f8f	retries	process_retries	{"timestamp": "2026-02-09T20:48:51.625Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:48:51.625	2026-02-09 20:48:52.276	\N	\N	2026-02-09 20:48:51.62568	2026-02-09 20:48:52.278594
645	af030110-037e-4c74-b452-2c4cf503d256	retries	process_retries	{"timestamp": "2026-02-09T20:53:51.625Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:53:51.625	2026-02-09 20:53:52.425	\N	\N	2026-02-09 20:53:51.625386	2026-02-09 20:53:52.430238
646	af63e339-091b-4e70-bad4-09506a53da97	retries	process_retries	{"timestamp": "2026-02-09T20:58:51.625Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 20:58:51.625	2026-02-09 20:58:51.644	\N	\N	2026-02-09 20:58:51.626357	2026-02-09 20:58:51.647336
647	77cdfda9-db3a-49dc-91f2-2b54f556be2e	retries	process_retries	{"timestamp": "2026-02-09T21:03:51.626Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:03:51.626	2026-02-09 21:03:51.837	\N	\N	2026-02-09 21:03:51.62648	2026-02-09 21:03:51.841072
648	deee4d2d-a549-46ff-baae-e4a8e41c271d	retries	process_retries	{"timestamp": "2026-02-09T21:08:51.627Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:08:51.627	2026-02-09 21:08:51.982	\N	\N	2026-02-09 21:08:51.627532	2026-02-09 21:08:51.98588
649	ee40ca9b-eae7-4ac6-b4fe-e1075962366a	retries	process_retries	{"timestamp": "2026-02-09T21:13:51.628Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:13:51.628	2026-02-09 21:13:52.192	\N	\N	2026-02-09 21:13:51.62885	2026-02-09 21:13:52.195005
650	b6098936-30b5-4e2c-83cf-b25afbe8974d	retries	process_retries	{"timestamp": "2026-02-09T21:18:51.628Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:18:51.628	2026-02-09 21:18:52.37	\N	\N	2026-02-09 21:18:51.628472	2026-02-09 21:18:52.373346
651	75d12d3a-ad40-4018-837c-657fceb3d4bc	retries	process_retries	{"timestamp": "2026-02-09T21:23:51.629Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:23:51.629	2026-02-09 21:23:52.542	\N	\N	2026-02-09 21:23:51.629892	2026-02-09 21:23:52.545496
652	5e818fac-a43d-4c22-9f81-7673b87c3b7e	retries	process_retries	{"timestamp": "2026-02-09T21:28:51.630Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:28:51.63	2026-02-09 21:28:51.715	\N	\N	2026-02-09 21:28:51.630937	2026-02-09 21:28:51.720322
653	da226eb5-98b8-4cca-b188-62226f463511	retries	process_retries	{"timestamp": "2026-02-09T21:33:51.631Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:33:51.631	2026-02-09 21:33:51.89	\N	\N	2026-02-09 21:33:51.631659	2026-02-09 21:33:51.893102
654	bcb01f64-19d8-440d-a1fd-30675c92d7ee	retries	process_retries	{"timestamp": "2026-02-09T21:38:51.632Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:38:51.632	2026-02-09 21:38:52.041	\N	\N	2026-02-09 21:38:51.632654	2026-02-09 21:38:52.044772
655	48b78da6-dd85-4efd-a1e8-2d57e412a90e	retries	process_retries	{"timestamp": "2026-02-09T21:43:51.633Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:43:51.633	2026-02-09 21:43:52.193	\N	\N	2026-02-09 21:43:51.633682	2026-02-09 21:43:52.196836
656	904148c2-70e4-422a-9d13-a76fabb557e8	retries	process_retries	{"timestamp": "2026-02-09T21:48:51.633Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:48:51.633	2026-02-09 21:48:52.378	\N	\N	2026-02-09 21:48:51.633681	2026-02-09 21:48:52.38198
657	2023a20b-aaf9-43c5-91cf-6afaf9e6619f	retries	process_retries	{"timestamp": "2026-02-09T21:53:51.634Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:53:51.634	2026-02-09 21:53:52.551	\N	\N	2026-02-09 21:53:51.635085	2026-02-09 21:53:52.554797
658	93fce7a6-ed28-4a4b-974d-734b2ce16128	retries	process_retries	{"timestamp": "2026-02-09T21:58:51.634Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 21:58:51.634	2026-02-09 21:58:51.751	\N	\N	2026-02-09 21:58:51.635394	2026-02-09 21:58:51.754541
659	f35c41bb-511a-4344-b2ad-2447c33fe25e	retries	process_retries	{"timestamp": "2026-02-09T22:03:51.635Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:03:51.635	2026-02-09 22:03:51.933	\N	\N	2026-02-09 22:03:51.6358	2026-02-09 22:03:51.936854
660	103c8202-b21e-41f3-a5fe-c60b1275e38b	retries	process_retries	{"timestamp": "2026-02-09T22:08:51.636Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:08:51.636	2026-02-09 22:08:52.118	\N	\N	2026-02-09 22:08:51.636655	2026-02-09 22:08:52.122429
661	7537cb8b-9ff4-4f5f-b345-80815d9ef956	retries	process_retries	{"timestamp": "2026-02-09T22:13:51.636Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:13:51.636	2026-02-09 22:13:52.306	\N	\N	2026-02-09 22:13:51.637159	2026-02-09 22:13:52.309668
662	f696ec6e-3519-41fa-bd23-4d7babc17203	retries	process_retries	{"timestamp": "2026-02-09T22:18:51.637Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:18:51.637	2026-02-09 22:18:52.469	\N	\N	2026-02-09 22:18:51.63771	2026-02-09 22:18:52.472472
663	3efa764b-2176-4521-8bdc-7af3f883bb43	retries	process_retries	{"timestamp": "2026-02-09T22:23:51.638Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:23:51.638	2026-02-09 22:23:51.643	\N	\N	2026-02-09 22:23:51.638893	2026-02-09 22:23:51.647433
664	3d2926e9-8dcf-46c7-88c5-38138cc622be	retries	process_retries	{"timestamp": "2026-02-09T22:28:51.638Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:28:51.638	2026-02-09 22:28:51.825	\N	\N	2026-02-09 22:28:51.639304	2026-02-09 22:28:51.829735
665	fb5066a7-6a7b-45d9-8054-321154632a71	retries	process_retries	{"timestamp": "2026-02-09T22:33:51.638Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:33:51.638	2026-02-09 22:33:52.024	\N	\N	2026-02-09 22:33:51.639126	2026-02-09 22:33:52.028654
666	2d3ae720-a8a4-46aa-b851-98cfdf6ba4bd	retries	process_retries	{"timestamp": "2026-02-09T22:38:51.639Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:38:51.639	2026-02-09 22:38:52.245	\N	\N	2026-02-09 22:38:51.639883	2026-02-09 22:38:52.248097
667	1aa41ebd-5b9a-4583-a2d8-5db7bc59b62f	retries	process_retries	{"timestamp": "2026-02-09T22:43:51.640Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:43:51.64	2026-02-09 22:43:52.446	\N	\N	2026-02-09 22:43:51.640812	2026-02-09 22:43:52.449744
668	f85937f7-756d-48a5-94f5-e3716a1c561f	retries	process_retries	{"timestamp": "2026-02-09T22:48:51.640Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:48:51.64	2026-02-09 22:48:52.618	\N	\N	2026-02-09 22:48:51.640691	2026-02-09 22:48:52.622019
669	d08daa2a-99fd-4a4d-8808-97067a3cd312	retries	process_retries	{"timestamp": "2026-02-09T22:53:51.640Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:53:51.641	2026-02-09 22:53:51.764	\N	\N	2026-02-09 22:53:51.64127	2026-02-09 22:53:51.767152
670	9ff75bf1-30a5-449f-b72b-e45de7425c6a	retries	process_retries	{"timestamp": "2026-02-09T22:58:51.642Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 22:58:51.642	2026-02-09 22:58:51.942	\N	\N	2026-02-09 22:58:51.642707	2026-02-09 22:58:51.94605
671	75ffd462-16e3-455e-972e-683613bcc513	retries	process_retries	{"timestamp": "2026-02-09T23:03:51.641Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:03:51.641	2026-02-09 23:03:52.126	\N	\N	2026-02-09 23:03:51.642214	2026-02-09 23:03:52.130319
672	a3dc7ad3-76d2-4e56-bbc2-14c890c93e59	retries	process_retries	{"timestamp": "2026-02-09T23:08:51.642Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:08:51.642	2026-02-09 23:08:52.336	\N	\N	2026-02-09 23:08:51.642702	2026-02-09 23:08:52.339294
673	5b1d4cd5-8b0e-4ccf-be27-87c147fb7ba9	retries	process_retries	{"timestamp": "2026-02-09T23:13:51.643Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:13:51.643	2026-02-09 23:13:52.537	\N	\N	2026-02-09 23:13:51.643816	2026-02-09 23:13:52.540178
674	e4b6646c-3986-4cab-8b27-aa3cb278223d	retries	process_retries	{"timestamp": "2026-02-09T23:18:51.643Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:18:51.643	2026-02-09 23:18:51.73	\N	\N	2026-02-09 23:18:51.643899	2026-02-09 23:18:51.73385
675	cb002338-3cc0-43fe-a746-10a9b4eaf16d	retries	process_retries	{"timestamp": "2026-02-09T23:23:51.644Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:23:51.644	2026-02-09 23:23:51.891	\N	\N	2026-02-09 23:23:51.64465	2026-02-09 23:23:51.894611
676	76020c97-25eb-440b-b821-3d36094d7820	retries	process_retries	{"timestamp": "2026-02-09T23:28:51.645Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:28:51.645	2026-02-09 23:28:52.076	\N	\N	2026-02-09 23:28:51.64603	2026-02-09 23:28:52.079808
677	ddd31418-202c-40b5-a4ff-775dd9e597f7	retries	process_retries	{"timestamp": "2026-02-09T23:33:51.644Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:33:51.644	2026-02-09 23:33:52.251	\N	\N	2026-02-09 23:33:51.645378	2026-02-09 23:33:52.255613
678	a2855480-00b8-4fb7-93f9-4e8d1fa97222	retries	process_retries	{"timestamp": "2026-02-09T23:38:51.644Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:38:51.644	2026-02-09 23:38:52.411	\N	\N	2026-02-09 23:38:51.645425	2026-02-09 23:38:52.414482
679	fa35e612-282d-4c6a-ab56-bdf5138819cf	retries	process_retries	{"timestamp": "2026-02-09T23:43:51.645Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:43:51.645	2026-02-09 23:43:52.588	\N	\N	2026-02-09 23:43:51.645889	2026-02-09 23:43:52.591707
680	c7d99b22-0f8a-46d8-a62f-85572b279661	retries	process_retries	{"timestamp": "2026-02-09T23:48:51.646Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:48:51.646	2026-02-09 23:48:51.783	\N	\N	2026-02-09 23:48:51.646685	2026-02-09 23:48:51.787534
681	90875076-b799-4957-977d-a45289ad97c7	retries	process_retries	{"timestamp": "2026-02-09T23:53:51.647Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:53:51.647	2026-02-09 23:53:51.985	\N	\N	2026-02-09 23:53:51.647814	2026-02-09 23:53:51.988979
682	62b8381f-8bc6-43d5-b55d-8e37a7a59557	retries	process_retries	{"timestamp": "2026-02-09T23:58:51.646Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-09 23:58:51.646	2026-02-09 23:58:52.159	\N	\N	2026-02-09 23:58:51.647298	2026-02-09 23:58:52.162468
683	97aec023-7a8e-48c0-b107-77109addce71	retries	process_retries	{"timestamp": "2026-02-10T00:03:51.647Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:03:51.647	2026-02-10 00:03:52.434	\N	\N	2026-02-10 00:03:51.647757	2026-02-10 00:03:52.437125
684	25ec8400-5b07-4880-bf4f-b5db6f87169d	retries	process_retries	{"timestamp": "2026-02-10T00:08:51.648Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:08:51.648	2026-02-10 00:08:52.619	\N	\N	2026-02-10 00:08:51.648485	2026-02-10 00:08:52.622481
685	3c4f1469-d68a-4837-abcf-4da7a408cd94	retries	process_retries	{"timestamp": "2026-02-10T00:13:51.649Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:13:51.649	2026-02-10 00:13:51.773	\N	\N	2026-02-10 00:13:51.649832	2026-02-10 00:13:51.776862
686	e479277d-1e19-458b-9de6-dcc32bd38682	retries	process_retries	{"timestamp": "2026-02-10T00:18:51.650Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:18:51.65	2026-02-10 00:18:51.951	\N	\N	2026-02-10 00:18:51.651125	2026-02-10 00:18:51.954787
687	132eae8c-1e5c-4754-b675-e49ead8096d7	retries	process_retries	{"timestamp": "2026-02-10T00:23:51.651Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:23:51.651	2026-02-10 00:23:52.135	\N	\N	2026-02-10 00:23:51.651827	2026-02-10 00:23:52.139285
688	da2ff17e-d984-4cc3-afdc-97af34f22b8c	retries	process_retries	{"timestamp": "2026-02-10T00:28:51.652Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:28:51.652	2026-02-10 00:28:52.306	\N	\N	2026-02-10 00:28:51.652747	2026-02-10 00:28:52.309165
689	3dd966ef-9eef-46cf-b0ca-8df641ba4f23	retries	process_retries	{"timestamp": "2026-02-10T00:33:51.652Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:33:51.652	2026-02-10 00:33:52.471	\N	\N	2026-02-10 00:33:51.653069	2026-02-10 00:33:52.474173
690	93932157-975d-4909-b8ba-00965463fcdd	retries	process_retries	{"timestamp": "2026-02-10T00:38:51.653Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:38:51.653	2026-02-10 00:38:52.642	\N	\N	2026-02-10 00:38:51.653624	2026-02-10 00:38:52.645806
691	a58e0d40-4635-4a80-be36-ff9945403706	retries	process_retries	{"timestamp": "2026-02-10T00:43:51.652Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:43:51.652	2026-02-10 00:43:51.818	\N	\N	2026-02-10 00:43:51.653332	2026-02-10 00:43:51.821345
692	419dc2ed-d5c0-4e7c-959e-8f99355c7f9e	retries	process_retries	{"timestamp": "2026-02-10T00:48:51.654Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:48:51.654	2026-02-10 00:48:52.006	\N	\N	2026-02-10 00:48:51.654796	2026-02-10 00:48:52.009677
693	8849d990-17cf-4594-83d6-deb1f993a807	retries	process_retries	{"timestamp": "2026-02-10T00:53:51.654Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:53:51.654	2026-02-10 00:53:52.211	\N	\N	2026-02-10 00:53:51.654632	2026-02-10 00:53:52.21398
694	bcf85cb1-76e0-4044-81c3-b5d40176a39a	retries	process_retries	{"timestamp": "2026-02-10T00:58:51.653Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 00:58:51.653	2026-02-10 00:58:52.377	\N	\N	2026-02-10 00:58:51.654165	2026-02-10 00:58:52.38178
695	398ce6a4-e71c-4fb5-862c-0c8cd4fd1484	retries	process_retries	{"timestamp": "2026-02-10T01:03:51.654Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:03:51.654	2026-02-10 01:03:52.56	\N	\N	2026-02-10 01:03:51.654566	2026-02-10 01:03:52.564675
696	c525b40c-1dd9-4dd4-9045-1bd3b34a301b	retries	process_retries	{"timestamp": "2026-02-10T01:08:51.654Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:08:51.654	2026-02-10 01:08:51.724	\N	\N	2026-02-10 01:08:51.655055	2026-02-10 01:08:51.727878
697	a31f1b9b-f440-4761-82d6-5ddc63b4c457	retries	process_retries	{"timestamp": "2026-02-10T01:13:51.655Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:13:51.655	2026-02-10 01:13:51.895	\N	\N	2026-02-10 01:13:51.655399	2026-02-10 01:13:51.898757
698	2f4a1db0-423d-490f-89fb-ca721cfa7146	retries	process_retries	{"timestamp": "2026-02-10T01:18:51.655Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:18:51.655	2026-02-10 01:18:52.08	\N	\N	2026-02-10 01:18:51.655934	2026-02-10 01:18:52.083654
699	7849f1a4-08e7-4a65-a437-298b1a42de56	retries	process_retries	{"timestamp": "2026-02-10T01:23:51.657Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:23:51.657	2026-02-10 01:23:52.278	\N	\N	2026-02-10 01:23:51.658003	2026-02-10 01:23:52.281151
700	559ec11d-7786-49f8-bb15-70b4b8f7f924	retries	process_retries	{"timestamp": "2026-02-10T01:28:51.658Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:28:51.658	2026-02-10 01:28:52.46	\N	\N	2026-02-10 01:28:51.659307	2026-02-10 01:28:52.46398
701	798da8c7-dc9d-4f45-8c93-300804910f45	retries	process_retries	{"timestamp": "2026-02-10T01:33:51.659Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:33:51.659	2026-02-10 01:33:51.665	\N	\N	2026-02-10 01:33:51.659935	2026-02-10 01:33:51.668525
702	d0b79378-d24a-4dbe-92ed-d150f1ef416d	retries	process_retries	{"timestamp": "2026-02-10T01:38:51.658Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:38:51.659	2026-02-10 01:38:51.867	\N	\N	2026-02-10 01:38:51.659489	2026-02-10 01:38:51.871525
703	974322ed-cee7-4c8d-8d83-41a5cf3f95c0	retries	process_retries	{"timestamp": "2026-02-10T01:43:51.658Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:43:51.658	2026-02-10 01:43:52.003	\N	\N	2026-02-10 01:43:51.659201	2026-02-10 01:43:52.006635
704	9f4f8bd2-99d6-4568-895c-47ed0be7b389	retries	process_retries	{"timestamp": "2026-02-10T01:48:51.659Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:48:51.659	2026-02-10 01:48:52.163	\N	\N	2026-02-10 01:48:51.659811	2026-02-10 01:48:52.166486
705	3d81af05-131b-413d-b565-b67cb458fffd	retries	process_retries	{"timestamp": "2026-02-10T01:53:51.659Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 01:53:51.659	2026-02-10 01:53:52.34	\N	\N	2026-02-10 01:53:51.659725	2026-02-10 01:53:52.344518
743	440922ec-e38d-41f5-acc5-cc2f6a310dae	retries	process_retries	{"timestamp": "2026-02-10T04:58:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 04:58:51.666	2026-02-10 04:58:52.133	\N	\N	2026-02-10 04:58:51.666548	2026-02-10 04:58:52.138657
744	1ef48b9a-bdbf-4842-ba8e-c242f50eecb1	retries	process_retries	{"timestamp": "2026-02-10T05:03:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:03:51.666	2026-02-10 05:03:52.329	\N	\N	2026-02-10 05:03:51.666381	2026-02-10 05:03:52.333781
745	4ac18921-977f-42b3-8c40-ccba8a96be94	retries	process_retries	{"timestamp": "2026-02-10T05:08:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:08:51.666	2026-02-10 05:08:52.499	\N	\N	2026-02-10 05:08:51.666568	2026-02-10 05:08:52.504076
746	38ca079e-3a8d-45d5-a5cf-2f8cbacf2d9d	retries	process_retries	{"timestamp": "2026-02-10T05:13:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:13:51.666	2026-02-10 05:13:52.642	\N	\N	2026-02-10 05:13:51.666569	2026-02-10 05:13:52.645182
747	44b769f8-b0cf-44de-bfe9-5821b1f2ba21	retries	process_retries	{"timestamp": "2026-02-10T05:18:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:18:51.666	2026-02-10 05:18:51.81	\N	\N	2026-02-10 05:18:51.666422	2026-02-10 05:18:51.81375
748	6df76d81-c495-4848-ae06-96460ac52104	retries	process_retries	{"timestamp": "2026-02-10T05:23:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:23:51.665	2026-02-10 05:23:51.994	\N	\N	2026-02-10 05:23:51.665817	2026-02-10 05:23:51.99866
749	7f6f6020-19b3-46b9-8b7a-62a5b9b1d53c	retries	process_retries	{"timestamp": "2026-02-10T05:28:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:28:51.665	2026-02-10 05:28:52.159	\N	\N	2026-02-10 05:28:51.665697	2026-02-10 05:28:52.162641
750	1a0fb27e-21c2-4f7a-a0f1-4197fc774c75	retries	process_retries	{"timestamp": "2026-02-10T05:33:51.665Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:33:51.665	2026-02-10 05:33:52.37	\N	\N	2026-02-10 05:33:51.666063	2026-02-10 05:33:52.373816
751	50b5319a-6232-4016-9446-442463e49521	retries	process_retries	{"timestamp": "2026-02-10T05:38:51.666Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:38:51.666	2026-02-10 05:38:52.569	\N	\N	2026-02-10 05:38:51.666519	2026-02-10 05:38:52.572251
752	5149ed26-02a1-4e65-968a-37cbd60a1cd6	retries	process_retries	{"timestamp": "2026-02-10T05:43:51.667Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:43:51.667	2026-02-10 05:43:51.755	\N	\N	2026-02-10 05:43:51.667648	2026-02-10 05:43:51.758158
753	b1346457-57cd-4a0b-a918-3fe3a5e47435	retries	process_retries	{"timestamp": "2026-02-10T05:48:51.667Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:48:51.667	2026-02-10 05:48:51.918	\N	\N	2026-02-10 05:48:51.668137	2026-02-10 05:48:51.921248
754	dc1c355c-7db1-4263-9078-23e07a32971d	retries	process_retries	{"timestamp": "2026-02-10T05:53:51.668Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:53:51.668	2026-02-10 05:53:52.061	\N	\N	2026-02-10 05:53:51.668582	2026-02-10 05:53:52.06492
755	e1aacde2-6f28-44dc-895a-dcf69b7c33ff	retries	process_retries	{"timestamp": "2026-02-10T05:58:51.669Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 05:58:51.669	2026-02-10 05:58:52.215	\N	\N	2026-02-10 05:58:51.669611	2026-02-10 05:58:52.218539
756	bce563b9-81ed-448a-be06-193916c99de5	retries	process_retries	{"timestamp": "2026-02-10T06:03:51.669Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:03:51.669	2026-02-10 06:03:52.397	\N	\N	2026-02-10 06:03:51.670171	2026-02-10 06:03:52.401193
757	8817e966-4bfb-4910-a585-497a2cbcddc3	retries	process_retries	{"timestamp": "2026-02-10T06:08:51.670Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:08:51.67	2026-02-10 06:08:52.581	\N	\N	2026-02-10 06:08:51.670536	2026-02-10 06:08:52.584585
758	d6d7f4ba-8de8-47d9-9cbe-00188cba0604	retries	process_retries	{"timestamp": "2026-02-10T06:13:51.670Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:13:51.67	2026-02-10 06:13:51.778	\N	\N	2026-02-10 06:13:51.671126	2026-02-10 06:13:51.782668
759	a4e094a0-08ef-4fa7-833a-34b403ac08e2	retries	process_retries	{"timestamp": "2026-02-10T06:18:51.671Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:18:51.671	2026-02-10 06:18:51.978	\N	\N	2026-02-10 06:18:51.671237	2026-02-10 06:18:51.983755
760	78dc3e39-e429-403f-b116-7ccf3872d867	retries	process_retries	{"timestamp": "2026-02-10T06:23:51.671Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:23:51.671	2026-02-10 06:23:52.153	\N	\N	2026-02-10 06:23:51.671935	2026-02-10 06:23:52.158153
761	5ec4487c-e4e5-47fa-bda5-31b8c555a1d5	retries	process_retries	{"timestamp": "2026-02-10T06:28:51.672Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:28:51.672	2026-02-10 06:28:52.335	\N	\N	2026-02-10 06:28:51.672961	2026-02-10 06:28:52.340377
762	d3248443-8437-419e-9d58-d7e48a1bd527	retries	process_retries	{"timestamp": "2026-02-10T06:33:51.672Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:33:51.672	2026-02-10 06:33:52.529	\N	\N	2026-02-10 06:33:51.673192	2026-02-10 06:33:52.532676
763	bad7aade-1215-4dcd-a3a6-91a449d2b214	retries	process_retries	{"timestamp": "2026-02-10T06:38:51.673Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:38:51.673	2026-02-10 06:38:51.695	\N	\N	2026-02-10 06:38:51.673534	2026-02-10 06:38:51.699905
764	897b2b32-cc27-498c-9388-45cf774313ad	retries	process_retries	{"timestamp": "2026-02-10T06:43:51.674Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:43:51.674	2026-02-10 06:43:51.901	\N	\N	2026-02-10 06:43:51.674597	2026-02-10 06:43:51.905154
765	4e9dac3c-8ebb-4cde-9db5-ca1086e93006	retries	process_retries	{"timestamp": "2026-02-10T06:48:51.674Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:48:51.675	2026-02-10 06:48:52.125	\N	\N	2026-02-10 06:48:51.675495	2026-02-10 06:48:52.129829
766	f955fb69-9bca-4677-9317-55c15bb453b9	retries	process_retries	{"timestamp": "2026-02-10T06:53:51.675Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:53:51.675	2026-02-10 06:53:52.311	\N	\N	2026-02-10 06:53:51.676145	2026-02-10 06:53:52.316006
767	0d8fe437-b0ee-45bd-a576-f6cfc6474e28	retries	process_retries	{"timestamp": "2026-02-10T06:58:51.676Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 06:58:51.676	2026-02-10 06:58:52.475	\N	\N	2026-02-10 06:58:51.676548	2026-02-10 06:58:52.479971
768	884962f6-36bf-4c1e-b376-d74a79272db5	retries	process_retries	{"timestamp": "2026-02-10T07:03:51.676Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:03:51.676	2026-02-10 07:03:52.647	\N	\N	2026-02-10 07:03:51.676689	2026-02-10 07:03:52.651476
769	3c969e36-dd91-4060-886f-f9d1f55e3d79	retries	process_retries	{"timestamp": "2026-02-10T07:08:51.677Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:08:51.677	2026-02-10 07:08:51.839	\N	\N	2026-02-10 07:08:51.677801	2026-02-10 07:08:51.844097
770	c81d3fc8-6d4e-4779-9ca9-a9c79f80de20	retries	process_retries	{"timestamp": "2026-02-10T07:13:51.677Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:13:51.677	2026-02-10 07:13:52.028	\N	\N	2026-02-10 07:13:51.677865	2026-02-10 07:13:52.032942
771	0021bb2d-c403-4693-886e-b874a6741c9a	retries	process_retries	{"timestamp": "2026-02-10T07:18:51.678Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:18:51.678	2026-02-10 07:18:52.179	\N	\N	2026-02-10 07:18:51.678281	2026-02-10 07:18:52.183893
772	2e6df809-5a8f-4b42-87ad-aa58d050451d	retries	process_retries	{"timestamp": "2026-02-10T07:23:51.678Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:23:51.678	2026-02-10 07:23:52.346	\N	\N	2026-02-10 07:23:51.678478	2026-02-10 07:23:52.349629
773	eb53817b-8afe-4969-8058-314760075188	retries	process_retries	{"timestamp": "2026-02-10T07:28:51.679Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:28:51.679	2026-02-10 07:28:52.528	\N	\N	2026-02-10 07:28:51.679208	2026-02-10 07:28:52.531768
774	cee819af-7fc6-4a8c-a01f-097733ad423a	retries	process_retries	{"timestamp": "2026-02-10T07:33:51.679Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:33:51.679	2026-02-10 07:33:51.707	\N	\N	2026-02-10 07:33:51.679706	2026-02-10 07:33:51.712306
775	59f60e24-5db4-4970-b111-ba6829e609f6	retries	process_retries	{"timestamp": "2026-02-10T07:38:51.679Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:38:51.679	2026-02-10 07:38:51.875	\N	\N	2026-02-10 07:38:51.680173	2026-02-10 07:38:51.878035
776	eb17e5c9-fcf8-416a-b4b5-366f80a90ac4	retries	process_retries	{"timestamp": "2026-02-10T07:43:51.680Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:43:51.68	2026-02-10 07:43:52.052	\N	\N	2026-02-10 07:43:51.681121	2026-02-10 07:43:52.055986
777	b556ae22-5f26-4db1-b0ce-d4f450a47ffc	retries	process_retries	{"timestamp": "2026-02-10T07:48:51.681Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:48:51.681	2026-02-10 07:48:52.253	\N	\N	2026-02-10 07:48:51.681792	2026-02-10 07:48:52.256875
778	fdee4b65-2161-44ec-b41b-70ba65d6ed65	retries	process_retries	{"timestamp": "2026-02-10T07:53:51.682Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:53:51.682	2026-02-10 07:53:52.44	\N	\N	2026-02-10 07:53:51.682665	2026-02-10 07:53:52.444706
779	b4c00f05-00fb-4fea-8880-99bc6168fe20	retries	process_retries	{"timestamp": "2026-02-10T07:58:51.683Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 07:58:51.683	2026-02-10 07:58:52.643	\N	\N	2026-02-10 07:58:51.683301	2026-02-10 07:58:52.648263
780	e2d48a8a-3d41-43eb-aaa4-1a03f43146b2	retries	process_retries	{"timestamp": "2026-02-10T08:03:51.684Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:03:51.684	2026-02-10 08:03:51.815	\N	\N	2026-02-10 08:03:51.684314	2026-02-10 08:03:51.820522
781	5e8b797c-808b-4362-bc26-bce786864af8	retries	process_retries	{"timestamp": "2026-02-10T08:08:51.683Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:08:51.683	2026-02-10 08:08:51.971	\N	\N	2026-02-10 08:08:51.684093	2026-02-10 08:08:51.974354
782	2632b4ca-2a2f-4241-9983-346898922ea2	retries	process_retries	{"timestamp": "2026-02-10T08:13:51.685Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:13:51.685	2026-02-10 08:13:52.15	\N	\N	2026-02-10 08:13:51.685737	2026-02-10 08:13:52.153229
783	e32c0f21-6360-4ce7-ad61-cc6b0c000e06	retries	process_retries	{"timestamp": "2026-02-10T08:18:51.685Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:18:51.685	2026-02-10 08:18:52.301	\N	\N	2026-02-10 08:18:51.685974	2026-02-10 08:18:52.305238
784	bf85cda9-ce6b-4ed3-bd72-280720250527	retries	process_retries	{"timestamp": "2026-02-10T08:23:51.686Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:23:51.686	2026-02-10 08:23:52.513	\N	\N	2026-02-10 08:23:51.686428	2026-02-10 08:23:52.516333
785	8635bcbc-5282-4b2e-9ec8-95536e713e18	retries	process_retries	{"timestamp": "2026-02-10T08:28:51.686Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:28:51.686	2026-02-10 08:28:51.731	\N	\N	2026-02-10 08:28:51.687028	2026-02-10 08:28:51.735011
786	d71d3180-1983-49ba-8eda-4bf6a1d24bff	retries	process_retries	{"timestamp": "2026-02-10T08:33:51.687Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:33:51.687	2026-02-10 08:33:51.902	\N	\N	2026-02-10 08:33:51.687875	2026-02-10 08:33:51.905851
787	c278709a-17dc-4e8b-9cc0-c11a02431980	retries	process_retries	{"timestamp": "2026-02-10T08:38:51.687Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:38:51.687	2026-02-10 08:38:52.084	\N	\N	2026-02-10 08:38:51.688026	2026-02-10 08:38:52.086928
788	b35105d6-a079-4905-bf62-fe166173364d	retries	process_retries	{"timestamp": "2026-02-10T08:43:51.688Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:43:51.688	2026-02-10 08:43:52.246	\N	\N	2026-02-10 08:43:51.689123	2026-02-10 08:43:52.250174
789	700ed09d-8ccd-4938-bfa9-c17363892062	retries	process_retries	{"timestamp": "2026-02-10T08:48:51.689Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:48:51.689	2026-02-10 08:48:52.414	\N	\N	2026-02-10 08:48:51.689763	2026-02-10 08:48:52.417573
790	352fa1d4-aac6-4ead-ba27-536be9e8747d	retries	process_retries	{"timestamp": "2026-02-10T08:53:51.690Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:53:51.69	2026-02-10 08:53:52.579	\N	\N	2026-02-10 08:53:51.690708	2026-02-10 08:53:52.581848
791	72a1ec5c-a94c-441f-8e11-79117255bdbe	retries	process_retries	{"timestamp": "2026-02-10T08:58:51.691Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 08:58:51.691	2026-02-10 08:58:51.75	\N	\N	2026-02-10 08:58:51.69161	2026-02-10 08:58:51.753797
792	98452b31-afd5-46a7-9c98-0dcf258dd965	retries	process_retries	{"timestamp": "2026-02-10T09:03:51.691Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:03:51.691	2026-02-10 09:03:51.952	\N	\N	2026-02-10 09:03:51.691213	2026-02-10 09:03:51.955407
793	741651a2-9198-418d-897e-5e66aa4c5513	retries	process_retries	{"timestamp": "2026-02-10T09:08:51.691Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:08:51.691	2026-02-10 09:08:52.126	\N	\N	2026-02-10 09:08:51.691481	2026-02-10 09:08:52.128871
794	c1aae81a-2e74-42e3-8fd1-0d5de6f25726	retries	process_retries	{"timestamp": "2026-02-10T09:13:51.690Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:13:51.69	2026-02-10 09:13:52.322	\N	\N	2026-02-10 09:13:51.690813	2026-02-10 09:13:52.3259
795	282b373c-b07e-40b9-904c-22e50d016ea4	retries	process_retries	{"timestamp": "2026-02-10T09:18:51.691Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:18:51.691	2026-02-10 09:18:52.491	\N	\N	2026-02-10 09:18:51.691694	2026-02-10 09:18:52.494128
796	45e15b75-ce99-4b8c-ac69-af9151088873	retries	process_retries	{"timestamp": "2026-02-10T09:23:51.691Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:23:51.691	2026-02-10 09:23:52.661	\N	\N	2026-02-10 09:23:51.691886	2026-02-10 09:23:52.665043
797	7e03ca89-f665-4d1b-a31a-0eab6fdb1413	retries	process_retries	{"timestamp": "2026-02-10T09:28:51.692Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:28:51.692	2026-02-10 09:28:51.821	\N	\N	2026-02-10 09:28:51.692225	2026-02-10 09:28:51.825241
798	cd43f815-fb79-4f2c-b690-73e62c9fa7b8	retries	process_retries	{"timestamp": "2026-02-10T09:33:51.692Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:33:51.692	2026-02-10 09:33:51.977	\N	\N	2026-02-10 09:33:51.693124	2026-02-10 09:33:51.980318
799	ccc986fb-10c7-422b-941f-c9f583a082f3	retries	process_retries	{"timestamp": "2026-02-10T09:38:51.693Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:38:51.693	2026-02-10 09:38:52.156	\N	\N	2026-02-10 09:38:51.693431	2026-02-10 09:38:52.159433
800	0b6b74e6-c9b6-491d-b063-4203673ec389	retries	process_retries	{"timestamp": "2026-02-10T09:43:51.692Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:43:51.692	2026-02-10 09:43:52.332	\N	\N	2026-02-10 09:43:51.693137	2026-02-10 09:43:52.335104
801	6cf30f2b-9420-4b30-bea5-2d6af7d826cf	retries	process_retries	{"timestamp": "2026-02-10T09:48:51.692Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:48:51.692	2026-02-10 09:48:52.517	\N	\N	2026-02-10 09:48:51.693195	2026-02-10 09:48:52.521095
802	7b7c78c5-6994-485d-8d16-db07d667a596	retries	process_retries	{"timestamp": "2026-02-10T09:53:51.694Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:53:51.694	2026-02-10 09:53:52.67	\N	\N	2026-02-10 09:53:51.694276	2026-02-10 09:53:52.675137
803	f0ab0214-490c-4d81-a3e5-84e10ca06fe0	retries	process_retries	{"timestamp": "2026-02-10T09:58:51.694Z"}	failed	1	1	column "retry_count" does not exist	\N	2026-02-10 09:58:51.694	2026-02-10 09:58:51.871	\N	\N	2026-02-10 09:58:51.694187	2026-02-10 09:58:51.874602
\.


--
-- Data for Name: broadcast_recipients; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_recipients (id, broadcast_id, user_id, status, message_id, sent_at, error_code, error_message, language, subscription_tier, created_at) FROM stdin;
\.


--
-- Data for Name: broadcast_schedules; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_schedules (id, schedule_id, broadcast_id, scheduled_for, timezone, is_recurring, recurrence_pattern, cron_expression, recurrence_end_date, max_occurrences, current_occurrence, status, executed_at, next_execution_at, retry_count, max_retries, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: broadcast_templates; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcast_templates (id, template_id, created_by, name, description, message_en, message_es, default_target_type, default_media_type, usage_count, last_used_at, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: broadcasts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.broadcasts (id, broadcast_id, admin_id, admin_username, title, message_en, message_es, media_type, media_url, media_file_id, s3_key, s3_bucket, target_type, include_filters, exclude_user_ids, scheduled_at, timezone, status, started_at, completed_at, cancelled_at, cancelled_by, cancellation_reason, total_recipients, sent_count, failed_count, blocked_count, deactivated_count, error_count, last_processed_user_id, progress_percentage, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: call_feedback; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.call_feedback (id, call_id, user_id, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: call_packages_catalog; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.call_packages_catalog (id, display_name, calls, price_cents, price_per_call_cents, savings_cents, savings_percent, popular, created_at, updated_at) FROM stdin;
single-call	Single Call	1	2500	2500	0	0	f	2026-02-07 14:26:14.055666	2026-02-07 14:26:14.055666
3-call-pack	3 Call Package	3	6000	2000	1500	20	f	2026-02-07 14:26:14.055666	2026-02-07 14:26:14.055666
5-call-pack	5 Call Package	5	9000	1800	3500	28	t	2026-02-07 14:26:14.055666	2026-02-07 14:26:14.055666
10-call-pack	10 Call Package	10	15000	1500	10000	40	f	2026-02-07 14:26:14.055666	2026-02-07 14:26:14.055666
\.


--
-- Data for Name: call_sessions; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.call_sessions (id, booking_id, room_provider, room_id, room_name, join_url_user, join_url_performer, token_user, token_performer, max_participants, recording_disabled, status, started_at, ended_at, actual_duration_seconds, created_at) FROM stdin;
\.


--
-- Data for Name: calls; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.calls (id, caller_id, receiver_id, status, call_type, duration, scheduled_at, started_at, ended_at, caller_rating, receiver_rating, caller_feedback, receiver_feedback, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: card_tokens; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.card_tokens (id, user_id, token, customer_id, card_mask, franchise, expiry_month, expiry_year, card_holder_name, is_default, is_active, created_at, updated_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: community_button_presets; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_button_presets (id, preset_id, button_type, button_label, default_label, description, icon_emoji, target_url, allow_custom_url, is_active, created_at, updated_at) FROM stdin;
1	cb6c378f-0a1e-45aa-9a0c-d6fcbce0d410	nearby	📍 Nearby	See Nearby	Geolocation-based feature	📍	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
2	e8ac889b-dbc2-4677-8052-9b220c161255	profile	👤 Profile	View Profile	User profile viewing	👤	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
3	c6e492dc-e641-41ad-9e23-66b0af983788	main_room	🎯 Main Room	Join Main Room	PNPtv Main Group Channel	🎯	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
4	9d7acb74-1ab3-499b-ba12-b4827359d0b9	hangouts	🎉 Hangouts	Join Hangouts	PNPtv Hangout Group	🎉	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
5	bdd110e7-353f-49e4-998a-2d3d211bc6c3	cristina_ai	🤖 Cristina AI	Chat with Cristina	AI Assistant	🤖	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
6	1f9ed477-66be-4f02-ab68-e26fd5b72ba3	videorama	🎬 Videorama	Watch Videos	Video Section	🎬	\N	f	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
7	19cb3a09-779e-407b-9bd3-2cb8c6cfbc0e	custom	🔗 Custom Link	Learn More	User-provided URL	🔗	\N	t	t	2026-02-07 14:26:13.091607	2026-02-07 14:26:13.091607
\.


--
-- Data for Name: community_groups; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_groups (id, group_id, name, telegram_group_id, description, icon, display_order, is_active, created_at, updated_at) FROM stdin;
1	2f64c691-ca57-415c-8cdd-e457e02ae96c	📍 Nearby	-1001234567890	Geolocation-based feature	📍	1	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
2	d705aa9f-076b-4f8f-a15e-46a02d21be57	👤 Profile	-1001234567891	User profile viewing	👤	2	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
3	1e196304-097c-4f48-b523-a1740dd98ebf	🎯 Main Room	-1001234567892	PNPtv Main Group Channel	🎯	3	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
4	dff1a24a-1ddb-4042-af33-af3b0dce2c49	🎉 Hangouts	-1001234567893	PNPtv Hangout Group	🎉	4	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
5	38fc4605-b98d-4249-b75c-bdac2d441860	🤖 Cristina AI	-1001234567894	AI Assistant Chat	🤖	5	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
6	e8d3ae50-2f46-4766-939e-1b06fbc6b0dc	🎬 Videorama	-1001234567895	Video Section	🎬	6	t	2026-02-07 14:26:13.052725	2026-02-07 14:26:13.052725
\.


--
-- Data for Name: community_post_analytics; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_post_analytics (id, analytics_id, post_id, group_id, views, interactions, button_clicks, replies, reactions, button_click_details, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: community_post_buttons; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_post_buttons (id, button_id, post_id, button_type, button_label, target_url, icon_emoji, button_order, created_at) FROM stdin;
\.


--
-- Data for Name: community_post_deliveries; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_post_deliveries (id, delivery_id, post_id, schedule_id, group_id, status, message_id, error_code, error_message, attempts, last_attempt_at, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: community_post_destinations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_post_destinations (id, destination_id, destination_type, destination_name, telegram_id, description, icon, supports_media, supports_videos, max_video_size_mb, supports_buttons, supports_topics, is_active, requires_approval, auto_delete_after_hours, display_order, created_at, updated_at) FROM stdin;
1	735745a3-2cf1-40eb-9384-4e49b937246a	channel	💎 Prime Channel	-1002997324714	\N	💎	t	t	2000	t	f	t	f	\N	0	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
2	4fd334a7-1d34-4c15-a6ea-a2725ee336f0	group	📍 Nearby	-1001234567890	\N	📍	t	t	2000	t	f	t	f	\N	1	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
3	81b51b21-e1b7-4cae-83fc-3a1ed7d3d6d5	group	👤 Profile	-1001234567891	\N	👤	t	t	2000	t	f	t	f	\N	2	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
4	eb251969-74ef-41aa-93f5-e2850fe2df74	group	🎯 Main Room	-1001234567892	\N	🎯	t	t	2000	t	f	t	f	\N	3	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
5	3d8d1868-f46b-45bf-8002-25627b7f8bc3	group	🎉 Hangouts	-1001234567893	\N	🎉	t	t	2000	t	f	t	f	\N	4	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
6	ac772b46-6ff7-46b6-96e0-55299daf2d4d	group	🤖 Cristina AI	-1001234567894	\N	🤖	t	t	2000	t	f	t	f	\N	5	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
7	0f628438-e1a1-4124-a5fe-7d3a238156dd	group	🎬 Videorama	-1001234567895	\N	🎬	t	t	2000	t	f	t	f	\N	6	2026-02-07 14:26:12.988342	2026-02-07 14:26:12.988342
\.


--
-- Data for Name: community_post_schedules; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_post_schedules (id, schedule_id, post_id, scheduled_for, timezone, is_recurring, recurrence_pattern, cron_expression, next_execution_at, status, execution_order, execution_count, last_executed_at, error_message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: community_posts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_posts (id, post_id, admin_id, admin_username, title, message_en, message_es, media_type, media_url, s3_key, s3_bucket, telegram_file_id, target_group_ids, target_all_groups, formatted_template_type, button_layout, scheduled_at, timezone, is_recurring, recurrence_pattern, cron_expression, recurrence_end_date, max_occurrences, status, scheduled_count, sent_count, failed_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cristina_admin_briefs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.cristina_admin_briefs (key, value, updated_at) FROM stdin;
\.


--
-- Data for Name: cult_event_registrations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.cult_event_registrations (id, user_id, event_type, month_key, event_at, status, claimed_at, reminder_7d_sent, reminder_3d_sent, reminder_day_sent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_emotes; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.custom_emotes (id, user_id, streamer_name, name, emoji, image_url, status, usage_count, is_active, approved_at, approved_by, rejected_at, rejection_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: emote_usage; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.emote_usage (id, emote_id, user_id, emote_name, used_at, context) FROM stdin;
\.


--
-- Data for Name: emotes; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.emotes (id, name, emoji, category, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: forwarded_violations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.forwarded_violations (id, user_id, group_id, message_id, source_type, source_info, violation_type, "timestamp") FROM stdin;
\.


--
-- Data for Name: group_invitations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.group_invitations (id, token, user_id, group_type, invitation_link, used, created_at, expires_at, used_at, last_reminder_at) FROM stdin;
\.


--
-- Data for Name: group_settings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.group_settings (id, group_id, group_title, anti_links_enabled, anti_spam_enabled, anti_flood_enabled, anti_forwarded_enabled, profanity_filter_enabled, max_warnings, flood_limit, flood_window, mute_duration, allowed_domains, banned_words, restrict_bot_addition, allowed_bots, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: jitsi_participants; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.jitsi_participants (id, room_id, user_id, telegram_id, display_name, is_moderator, is_host, join_time, leave_time, duration, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: jitsi_rooms; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.jitsi_rooms (id, room_code, room_name, host_user_id, host_name, host_telegram_id, tier, max_participants, title, description, jitsi_domain, jwt_token, moderator_password, scheduled_start_time, scheduled_duration, actual_start_time, actual_end_time, settings, is_public, requires_password, room_password, allowed_user_ids, telegram_group_id, shared_in_groups, status, is_active, current_participants, total_participants, peak_participants, total_duration, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: jitsi_tier_access; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.jitsi_tier_access (id, plan_tier, allowed_room_tier, max_rooms_per_day, max_duration_minutes, can_record, can_set_password, can_create_private, created_at) FROM stdin;
043d582f-b485-4822-b826-bbc1bd71cbb7	Basic	mini	1	30	f	f	f	2026-02-07 14:26:13.497554+00
61b9c31e-3aa4-4559-b166-11b3e949b1d1	PNP	mini	2	60	f	t	f	2026-02-07 14:26:13.497554+00
94990a2e-ff84-4055-b206-82d64d355f81	Crystal	mini	5	120	f	t	t	2026-02-07 14:26:13.497554+00
0f21836b-e210-498b-9e65-092e1f5ed08b	Crystal	medium	2	120	f	t	t	2026-02-07 14:26:13.497554+00
2dcad624-6ca6-4a4c-a04a-4e945f35b63b	Diamond	mini	10	180	t	t	t	2026-02-07 14:26:13.497554+00
669c0244-8546-448d-a7d0-71bfa06ab87c	Diamond	medium	5	180	t	t	t	2026-02-07 14:26:13.497554+00
deef7d28-7f67-4805-96ac-8e3cab1518f0	Diamond	unlimited	2	180	t	t	t	2026-02-07 14:26:13.497554+00
46db7f8e-3857-4a62-b6e9-327c9afe7c88	Premium	mini	999	240	t	t	t	2026-02-07 14:26:13.497554+00
ce4d65c9-418f-4807-be88-2070d73a9d8a	Premium	medium	999	240	t	t	t	2026-02-07 14:26:13.497554+00
4d44892b-1dbb-4dee-a870-12165b7f93c8	Premium	unlimited	999	240	t	t	t	2026-02-07 14:26:13.497554+00
\.


--
-- Data for Name: jitsi_user_usage; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.jitsi_user_usage (id, user_id, date, tier, rooms_created, total_minutes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: live_streams; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.live_streams (id, host_id, title, description, category, stream_url, thumbnail_url, status, is_public, scheduled_at, started_at, ended_at, viewers_count_old, max_viewers, created_at, updated_at, ai_moderation_enabled, moderation_thresholds, auto_moderate, channel_name, host_name, is_paid, price, scheduled_for, tags, allow_comments, record_stream, language, duration, current_viewers, total_views, peak_viewers, likes, total_comments, viewers, banned_users, moderators, tokens, recording_url, analytics, chat_settings, viewers_count) FROM stdin;
\.


--
-- Data for Name: media_favorites; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_favorites (id, user_id, media_id, added_at) FROM stdin;
\.


--
-- Data for Name: media_library; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_library (id, title, artist, url, type, duration, category, cover_url, description, plays, likes, uploader_id, uploader_name, language, is_public, is_explicit, tags, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: media_play_history; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_play_history (id, user_id, media_id, played_at, duration_played, completed) FROM stdin;
\.


--
-- Data for Name: media_playlists; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_playlists (id, name, owner_id, description, cover_url, is_public, is_collaborative, total_plays, total_likes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: media_ratings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_ratings (id, user_id, media_id, rating, review, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: media_shares; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.media_shares (id, user_id, media_type, media_id, message_id, share_count, like_count, created_at, updated_at, last_like_at) FROM stdin;
\.


--
-- Data for Name: meet_greet_bookings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.meet_greet_bookings (id, user_id, model_id, duration_minutes, price_usd, booking_time, status, payment_status, payment_method, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: meet_greet_payments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.meet_greet_payments (id, booking_id, amount_usd, payment_method, transaction_id, status, payment_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: message_rate_limits; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.message_rate_limits (date, total_messages_sent, last_reset, created_at) FROM stdin;
2026-02-07	2	2026-02-07 19:28:51.253755	2026-02-07 19:28:51.253755
2026-02-08	6	2026-02-08 00:00:00.007742	2026-02-08 00:00:00.007742
2026-02-09	6	2026-02-09 00:00:00.030526	2026-02-09 00:00:00.030526
2026-02-10	2	2026-02-10 00:00:00.031341	2026-02-10 00:00:00.031341
\.


--
-- Data for Name: model_availability; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.model_availability (id, model_id, day_of_week, start_time, end_time, is_available, created_at) FROM stdin;
\.


--
-- Data for Name: model_bookings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.model_bookings (id, model_id, user_id, telegram_user_id, username, scheduled_date, start_time, duration_minutes, end_time, status, payment_status, payment_method, transaction_id, total_price, notes, call_room_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: model_earnings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.model_earnings (id, model_id, booking_id, amount, commission_percentage, model_earnings, payment_status, payout_date, created_at) FROM stdin;
\.


--
-- Data for Name: model_photos; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.model_photos (id, model_id, photo_url, caption, display_order, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: model_reviews; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.model_reviews (id, model_id, user_id, booking_id, rating, review_text, created_at) FROM stdin;
\.


--
-- Data for Name: models; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.models (id, model_id, username, display_name, bio, photo_url, price_per_minute, min_duration_minutes, max_duration_minutes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: moderation; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.moderation (id, words, links, patterns, updated_by, updated_at, group_id) FROM stdin;
\.


--
-- Data for Name: moderation_logs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.moderation_logs (id, group_id, action, user_id, moderator_id, target_user_id, reason, details, created_at) FROM stdin;
\.


--
-- Data for Name: nearby_place_categories; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_place_categories (id, slug, name_en, name_es, description_en, description_es, emoji, sort_order, is_active, requires_age_verification, parent_category_id, created_at, updated_at) FROM stdin;
1	wellness	Wellness	Bienestar	Spas, massage parlors, gyms, and wellness centers	Spas, centros de masajes, gimnasios y centros de bienestar	🧘	1	t	f	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
2	cruising	Cruising Spots	Zonas de Cruising	Popular cruising locations	Lugares populares de cruising	🌙	2	t	t	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
3	adult_entertainment	+18 Businesses	Negocios +18	Adult entertainment venues	Lugares de entretenimiento para adultos	🔞	3	t	t	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
4	pnp_friendly	PNP Friendly	PNP Amigable	PNP-friendly businesses and spaces	Negocios y espacios PNP-amigables	💨	4	t	t	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
5	help_centers	Help Centers	Centros de Ayuda	LGBTQ+ support, youth refuges, health centers	Apoyo LGBTQ+, refugios juveniles, centros de salud	🏥	5	t	f	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
6	saunas	Saunas & Bath Houses	Saunas y Baños	Saunas, steam rooms, and bath houses	Saunas, baños de vapor y casas de baños	🧖	6	t	t	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
7	bars_clubs	Bars & Clubs	Bares y Discotecas	LGBTQ+ bars, clubs, and nightlife venues	Bares, discotecas y lugares nocturnos LGBTQ+	🍸	7	t	f	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
8	community_business	Community Businesses	Negocios Comunitarios	Businesses owned by or recommended by community members	Negocios propiedad de o recomendados por miembros de la comunidad	🏪	8	t	f	\N	2026-02-07 14:26:12.117545	2026-02-07 14:26:12.117545
\.


--
-- Data for Name: nearby_place_favorites; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_place_favorites (id, user_id, place_id, created_at) FROM stdin;
\.


--
-- Data for Name: nearby_place_reports; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_place_reports (id, user_id, place_id, report_type, description, status, resolved_by, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: nearby_place_reviews; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_place_reviews (id, user_id, place_id, rating, comment, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nearby_place_submissions; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_place_submissions (id, submitted_by_user_id, submitted_at, name, description, address, city, country, location_lat, location_lng, category_id, place_type, phone, email, website, telegram_username, instagram, is_community_owned, photo_file_id, hours_of_operation, price_range, status, moderated_by, moderated_at, rejection_reason, admin_notes, created_place_id, updated_at) FROM stdin;
\.


--
-- Data for Name: nearby_places; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.nearby_places (id, name, description, address, city, country, location_lat, location_lng, location_geohash, category_id, place_type, phone, email, website, telegram_username, instagram, is_community_owned, owner_user_id, recommender_user_id, photo_url, photo_file_id, hours_of_operation, price_range, status, rejection_reason, moderated_by, moderated_at, view_count, favorite_count, report_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_webhook_events; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.payment_webhook_events (id, provider, event_id, payment_id, status, state_code, is_valid_signature, payload, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.payments (id, user_id, plan_id, plan_name, amount, currency, provider, payment_method, status, payment_id, reference, destination_address, payment_url, chain, chain_id, completed_at, completed_by, manual_completion, expires_at, created_at, updated_at, metadata, daimo_payment_id) FROM stdin;
\.


--
-- Data for Name: performer_availability; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.performer_availability (id, performer_id, type, day_of_week, start_time_local, end_time_local, date_local, timezone, created_at) FROM stdin;
85fbd899-e0c9-4655-8976-b9b60c475b2c	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	1	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
554c317b-eb4d-41d4-9c70-231b70ed2c8b	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	2	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
d339bb65-a33c-465c-99b0-c79ee78be9ef	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	3	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
eae81bc8-2b88-4129-bea1-3bf5e6d52d05	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	4	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
1d518b1b-2ff7-4d08-81e5-2dc69e713f16	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	5	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
05e017f0-4cd8-4976-bd6f-79173b06997c	fb4ad8f7-566b-4d85-a226-671df6f04306	weekly_rule	6	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
5c5c09ef-e210-4061-940e-8dcf0f8c411d	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	1	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
6284cdbf-5b58-4831-a0e9-3f9a91f3fdf9	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	2	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
9c876e39-84eb-445f-b051-0ec1b5d081bf	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	3	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
fd33f4bd-f9d8-4139-a62e-5bbbc37793e3	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	4	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
a09916ec-6d6a-4577-894d-2d278bf65f5c	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	5	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
a1fbe5f7-ed4b-422a-bf3b-76fefc66b869	74c8a70f-44a3-493f-96c5-cc662c43b72b	weekly_rule	6	10:00:00	22:00:00	\N	UTC	2026-02-07 14:26:11.284323+00
\.


--
-- Data for Name: performers; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.performers (id, user_id, display_name, bio, photo_url, availability_schedule, timezone, allowed_call_types, max_call_duration, base_price, buffer_time_before, buffer_time_after, status, is_available, availability_message, total_calls, total_rating, rating_count, created_at, updated_at, created_by, updated_by, bio_short, default_timezone, allowed_call_types_json, durations_minutes, base_price_cents, currency, buffer_before_minutes, buffer_after_minutes, max_daily_calls) FROM stdin;
fb4ad8f7-566b-4d85-a226-671df6f04306	\N	Santino	Experienced performer with great personality	\N	[]	UTC	{video,audio}	60	100.00	15	15	active	t	\N	0	0.00	0	2026-02-07 14:26:11.174865	2026-02-07 14:26:11.174865	system	system	\N	America/Bogota	["video", "audio"]	[15, 30, 60]	10000	USD	5	10	\N
74c8a70f-44a3-493f-96c5-cc662c43b72b	\N	Lex Boy	Charismatic and engaging performer	\N	[]	UTC	{video,audio}	60	100.00	15	15	active	t	\N	0	0.00	0	2026-02-07 14:26:11.174865	2026-02-07 14:26:11.174865	system	system	\N	America/Bogota	["video", "audio"]	[15, 30, 60]	10000	USD	5	10	\N
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.plans (id, name, display_name, tier, price, price_in_cop, currency, duration, duration_days, description, features, icon, active, recommended, is_lifetime, requires_manual_activation, payment_method, wompi_payment_link, crypto_bonus, created_at, updated_at, is_recurring, billing_interval, billing_interval_count, trial_days, recurring_price) FROM stdin;
\.


--
-- Data for Name: player_states; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.player_states (id, user_id, media_id, playlist_id, current_position, is_playing, last_played_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: playlist_items; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.playlist_items (id, playlist_id, media_id, "position", added_by, added_at) FROM stdin;
\.


--
-- Data for Name: pnp_bookings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_bookings (id, user_id, model_id, duration_minutes, price_usd, booking_time, status, payment_status, payment_method, video_room_name, video_room_url, video_room_token, notes, created_at, updated_at, model_earnings, platform_fee, transaction_id, show_ended_at, availability_id, promo_code_id, discount_amount, original_price, promo_code, promo_id, rating, feedback_text, reminder_1h_sent, reminder_5m_sent, payment_expires_at, hold_released_at, booking_source) FROM stdin;
\.


--
-- Data for Name: pnp_feedback; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_feedback (id, booking_id, user_id, rating, comments, created_at) FROM stdin;
\.


--
-- Data for Name: pnp_live_promo_codes; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_live_promo_codes (id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, applicable_durations, applicable_models, min_booking_amount, max_discount, single_use_per_user, active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pnp_live_promo_usage; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_live_promo_usage (id, promo_id, booking_id, user_id, discount_amount, original_price, final_price, used_at) FROM stdin;
\.


--
-- Data for Name: pnp_model_blocked_dates; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_model_blocked_dates (id, model_id, blocked_date, reason, created_at) FROM stdin;
\.


--
-- Data for Name: pnp_model_earnings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_model_earnings (id, model_id, booking_id, tip_id, earning_type, gross_amount, commission_percent, model_earnings, platform_fee, payout_status, payout_date, created_at) FROM stdin;
\.


--
-- Data for Name: pnp_model_payouts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_model_payouts (id, model_id, amount, status, payment_method, payment_details, requested_at, processed_at, processed_by, transaction_id, notes, created_at) FROM stdin;
\.


--
-- Data for Name: pnp_model_schedules; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_model_schedules (id, model_id, day_of_week, start_time, end_time, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pnp_model_status_history; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_model_status_history (id, model_id, status, changed_at, changed_by, source) FROM stdin;
\.


--
-- Data for Name: pnp_models; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_models (id, name, username, bio, profile_image_url, is_active, is_online, last_online, created_at, updated_at, price_30min, price_60min, price_90min, commission_percent, telegram_id, avg_rating, rating_count, total_shows, total_earnings, last_activity_at, auto_offline_minutes, status_message, can_instant_book, user_id) FROM stdin;
\.


--
-- Data for Name: pnp_payments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_payments (id, booking_id, amount_usd, payment_method, transaction_id, status, payment_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pnp_refunds; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_refunds (id, booking_id, amount_usd, reason, status, processed_by, processed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pnp_tips; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.pnp_tips (id, booking_id, user_id, model_id, amount, message, payment_method, payment_status, transaction_id, model_earnings, platform_fee, created_at) FROM stdin;
\.


--
-- Data for Name: private_calls; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.private_calls (id, caller_id, performer_id, status, scheduled_date, duration_minutes, call_type, platform, room_url, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: profile_compliance; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.profile_compliance (id, user_id, group_id, username_valid, name_valid, compliance_issues, warning_sent_at, warning_count, purge_deadline, purged, purged_at, compliance_met_at, last_checked_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: promo_code_usage; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.promo_code_usage (id, code, user_id, payment_id, discount_amount, used_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.promo_codes (id, code, discount_type, discount_value, applicable_plans, max_uses, current_uses, max_uses_per_user, valid_from, valid_until, active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: promo_redemptions; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.promo_redemptions (id, promo_id, user_id, payment_id, original_price, discount_amount, final_price, status, claimed_at, completed_at) FROM stdin;
\.


--
-- Data for Name: promos; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.promos (id, code, name, name_es, description, description_es, base_plan_id, discount_type, discount_value, target_audience, new_user_days, max_spots, current_spots_used, valid_from, valid_until, features, features_es, active, hidden, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_history; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_history (id, title, artist, duration, cover_url, played_at) FROM stdin;
\.


--
-- Data for Name: radio_now_playing; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_now_playing (id, track_id, title, artist, duration, cover_url, started_at, ends_at, listener_count, updated_at) FROM stdin;
1	\N	\N	\N	\N	\N	2026-02-07 14:26:13.190544	\N	0	2026-02-07 14:26:13.190544
\.


--
-- Data for Name: radio_now_playing_fixed; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_now_playing_fixed (id, track_id, title, artist, duration, cover_url, started_at, ends_at, listener_count, updated_at) FROM stdin;
1	\N	\N	\N	\N	\N	2026-02-07 14:26:13.366308	\N	0	2026-02-07 14:26:13.366308
\.


--
-- Data for Name: radio_now_playing_new; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_now_playing_new (id, track_id, title, artist, duration, cover_url, started_at, ends_at, listener_count, updated_at) FROM stdin;
1	\N	\N	\N	\N	\N	2026-02-07 14:26:13.190544	\N	0	2026-02-07 14:26:13.253248
\.


--
-- Data for Name: radio_queue; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_queue (id, media_id, title, artist, duration, cover_url, "position", added_by, added_at, metadata) FROM stdin;
\.


--
-- Data for Name: radio_requests; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_requests (id, user_id, song_name, artist, duration, status, requested_at, played_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_schedule; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_schedule (id, day_of_week, time_slot, program_name, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_stations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.radio_stations (id, name, description, stream_url, website_url, logo_url, genre, country, language, active, featured, listeners_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recurring_payments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.recurring_payments (id, subscription_id, user_id, amount, currency, status, provider, transaction_id, authorization_code, response_code, response_message, period_start, period_end, attempt_number, next_retry_at, processed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recurring_subscriptions; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.recurring_subscriptions (id, user_id, plan_id, card_token, card_token_mask, card_franchise, customer_id, status, amount, currency, billing_interval, billing_interval_count, current_period_start, current_period_end, next_billing_date, trial_end, cancel_at_period_end, canceled_at, cancellation_reason, ended_at, billing_failures, last_billing_attempt, last_successful_payment, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: segment_membership; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.segment_membership (id, segment_id, user_id, added_at) FROM stdin;
\.


--
-- Data for Name: stream_banned_users; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.stream_banned_users (id, stream_id, user_id, banned_by, banned_at, reason) FROM stdin;
\.


--
-- Data for Name: stream_comments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.stream_comments (id, stream_id, user_id, user_name, text, "timestamp", likes, is_pinned, is_deleted, deleted_at, deleted_by) FROM stdin;
\.


--
-- Data for Name: stream_notifications; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.stream_notifications (id, user_id, streamer_id, subscribed_at, notifications_enabled) FROM stdin;
\.


--
-- Data for Name: stream_viewers; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.stream_viewers (id, stream_id, viewer_id, viewer_name, joined_at, left_at) FROM stdin;
\.


--
-- Data for Name: subscribers; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.subscribers (id, telegram_id, email, name, plan, subscription_id, provider, status, last_payment_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: support_topics; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.support_topics (user_id, thread_id, thread_name, created_at, last_message_at, message_count, status, assigned_to, priority, category, language, first_response_at, resolution_time, sla_breached, escalation_level, last_agent_message_at, user_satisfaction, feedback, updated_at) FROM stdin;
\.


--
-- Data for Name: topic_analytics; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.topic_analytics (id, topic_id, user_id, username, total_posts, total_media_shared, total_reactions_given, total_reactions_received, total_replies, most_liked_post_id, most_liked_post_count, last_post_at, updated_at) FROM stdin;
\.


--
-- Data for Name: topic_configuration; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.topic_configuration (topic_id, group_id, topic_name, can_post, can_reply, can_react, required_role, required_subscription, media_required, allow_text_only, allow_caption, allowed_media, allow_stickers, allow_documents, allow_replies, reply_must_quote, allow_text_in_replies, auto_moderate, anti_spam_enabled, anti_flood_enabled, anti_links_enabled, allow_commands, max_posts_per_hour, max_replies_per_hour, cooldown_between_posts, redirect_bot_responses, auto_delete_enabled, auto_delete_after, override_global_deletion, notify_all_on_new_post, auto_pin_admin_messages, auto_pin_duration, auto_mirror_enabled, mirror_from_general, mirror_format, enable_leaderboard, track_reactions, track_posts, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: topic_violations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.topic_violations (id, user_id, topic_id, violation_type, "timestamp") FROM stdin;
\.


--
-- Data for Name: user_broadcast_preferences; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_broadcast_preferences (id, user_id, is_opted_out, opted_out_at, opted_out_reason, max_broadcasts_per_week, max_broadcasts_per_month, broadcasts_received_week, broadcasts_received_month, last_broadcast_at, preferred_send_hour, preferred_send_day, category_preferences, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_moderation_actions; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_moderation_actions (id, user_id, moderator_id, action_type, reason, duration, active, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_moderation_history; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_moderation_history (id, user_id, telegram_id, username, action_type, action_reason, action_duration, stream_id, violation_id, moderated_by, moderated_by_telegram_id, is_active, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_notifications (id, user_id, model_id, notification_type, is_active, preferences, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_segments; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_segments (id, segment_id, created_by, name, description, filters, estimated_count, actual_count, last_recalculated_at, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_warnings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_warnings (id, user_id, group_id, reason, details, "timestamp") FROM stdin;
\.


--
-- Data for Name: username_history; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.username_history (id, user_id, old_username, new_username, group_id, changed_at, flagged, flagged_by, flag_reason) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.users (id, username, first_name, last_name, email, email_verified, bio, photo_file_id, photo_updated_at, interests, looking_for, tribe, city, country, instagram, twitter, facebook, tiktok, youtube, telegram, location_lat, location_lng, location_name, location_geohash, location_updated_at, location_sharing_enabled, subscription_status, plan_id, plan_expiry, tier, role, assigned_by, role_assigned_at, privacy, profile_views, xp, favorites, blocked, badges, onboarding_complete, age_verified, age_verified_at, age_verification_expires_at, age_verification_interval_hours, terms_accepted, privacy_accepted, last_active, last_activity_in_group, group_activity_log, timezone, timezone_detected, timezone_updated_at, language, is_active, deactivated_at, deactivation_reason, created_at, updated_at, accepted_terms, is_restricted, risk_flags, private_calls_enabled, total_calls_booked, total_calls_completed, last_call_at, card_token, card_token_mask, card_franchise, auto_renew, subscription_type, recurring_plan_id, next_billing_date, billing_failures, last_billing_attempt, has_seen_tutorial, age_verification_method) FROM stdin;
\.


--
-- Data for Name: wall_of_fame_daily_stats; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.wall_of_fame_daily_stats (date_key, user_id, photos_shared, reactions_received, is_new_member, first_post_at, updated_at) FROM stdin;
\.


--
-- Data for Name: wall_of_fame_daily_winners; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.wall_of_fame_daily_winners (date_key, legend_user_id, new_member_user_id, active_user_id, processed_at) FROM stdin;
\.


--
-- Data for Name: wall_of_fame_posts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.wall_of_fame_posts (id, group_id, message_id, user_id, date_key, reactions_count, created_at) FROM stdin;
\.


--
-- Data for Name: warnings; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.warnings (id, user_id, admin_id, group_id, reason, created_at, cleared, cleared_at, cleared_by, expires_at) FROM stdin;
\.


--
-- Data for Name: x_accounts; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.x_accounts (account_id, x_user_id, handle, display_name, encrypted_access_token, encrypted_refresh_token, token_expires_at, created_by, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: x_oauth_states; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.x_oauth_states (state, code_verifier, admin_id, admin_username, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: x_post_jobs; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.x_post_jobs (post_id, account_id, admin_id, admin_username, text, media_url, scheduled_at, status, response_json, error_message, retry_count, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: age_verification_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.age_verification_attempts_id_seq', 1, false);


--
-- Name: broadcast_button_presets_preset_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_button_presets_preset_id_seq', 6, true);


--
-- Name: broadcast_media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_media_id_seq', 1, false);


--
-- Name: broadcast_queue_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_queue_jobs_id_seq', 803, true);


--
-- Name: broadcast_recipients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_recipients_id_seq', 1, false);


--
-- Name: broadcast_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_schedules_id_seq', 1, false);


--
-- Name: broadcast_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcast_templates_id_seq', 1, false);


--
-- Name: broadcasts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.broadcasts_id_seq', 1, false);


--
-- Name: community_button_presets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_button_presets_id_seq', 7, true);


--
-- Name: community_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_groups_id_seq', 6, true);


--
-- Name: community_post_analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_analytics_id_seq', 1, false);


--
-- Name: community_post_buttons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_buttons_id_seq', 1, false);


--
-- Name: community_post_deliveries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_deliveries_id_seq', 1, false);


--
-- Name: community_post_destinations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_destinations_id_seq', 7, true);


--
-- Name: community_post_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_schedules_id_seq', 1, false);


--
-- Name: community_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_posts_id_seq', 1, false);


--
-- Name: cult_event_registrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.cult_event_registrations_id_seq', 1, false);


--
-- Name: group_invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.group_invitations_id_seq', 1, false);


--
-- Name: media_shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.media_shares_id_seq', 1, false);


--
-- Name: meet_greet_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.meet_greet_bookings_id_seq', 1, false);


--
-- Name: meet_greet_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.meet_greet_payments_id_seq', 1, false);


--
-- Name: model_availability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.model_availability_id_seq', 1, false);


--
-- Name: model_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.model_bookings_id_seq', 1, false);


--
-- Name: model_earnings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.model_earnings_id_seq', 1, false);


--
-- Name: model_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.model_photos_id_seq', 1, false);


--
-- Name: model_reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.model_reviews_id_seq', 1, false);


--
-- Name: models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.models_id_seq', 1, false);


--
-- Name: nearby_place_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_place_categories_id_seq', 8, true);


--
-- Name: nearby_place_favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_place_favorites_id_seq', 1, false);


--
-- Name: nearby_place_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_place_reports_id_seq', 1, false);


--
-- Name: nearby_place_reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_place_reviews_id_seq', 1, false);


--
-- Name: nearby_place_submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_place_submissions_id_seq', 1, false);


--
-- Name: nearby_places_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.nearby_places_id_seq', 1, false);


--
-- Name: pnp_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_bookings_id_seq', 1, false);


--
-- Name: pnp_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_feedback_id_seq', 1, false);


--
-- Name: pnp_live_promo_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_live_promo_codes_id_seq', 1, false);


--
-- Name: pnp_live_promo_usage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_live_promo_usage_id_seq', 1, false);


--
-- Name: pnp_model_blocked_dates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_model_blocked_dates_id_seq', 1, false);


--
-- Name: pnp_model_earnings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_model_earnings_id_seq', 1, false);


--
-- Name: pnp_model_payouts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_model_payouts_id_seq', 1, false);


--
-- Name: pnp_model_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_model_schedules_id_seq', 1, false);


--
-- Name: pnp_model_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_model_status_history_id_seq', 1, false);


--
-- Name: pnp_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_models_id_seq', 1, false);


--
-- Name: pnp_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_payments_id_seq', 1, false);


--
-- Name: pnp_refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_refunds_id_seq', 1, false);


--
-- Name: pnp_tips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.pnp_tips_id_seq', 1, false);


--
-- Name: private_calls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.private_calls_id_seq', 1, false);


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.promo_redemptions_id_seq', 1, false);


--
-- Name: promos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.promos_id_seq', 1, false);


--
-- Name: segment_membership_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.segment_membership_id_seq', 1, false);


--
-- Name: stream_banned_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.stream_banned_users_id_seq', 1, false);


--
-- Name: stream_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.stream_notifications_id_seq', 1, false);


--
-- Name: stream_viewers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.stream_viewers_id_seq', 1, false);


--
-- Name: topic_analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.topic_analytics_id_seq', 1, false);


--
-- Name: topic_violations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.topic_violations_id_seq', 1, false);


--
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.user_broadcast_preferences_id_seq', 1, false);


--
-- Name: user_moderation_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.user_moderation_history_id_seq', 1, false);


--
-- Name: user_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.user_notifications_id_seq', 1, false);


--
-- Name: user_segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.user_segments_id_seq', 1, false);


--
-- Name: wall_of_fame_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.wall_of_fame_posts_id_seq', 1, false);


--
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (code);


--
-- Name: activation_logs activation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.activation_logs
    ADD CONSTRAINT activation_logs_pkey PRIMARY KEY (id);


--
-- Name: age_verification_attempts age_verification_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.age_verification_attempts
    ADD CONSTRAINT age_verification_attempts_pkey PRIMARY KEY (id);


--
-- Name: banned_users banned_users_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.banned_users
    ADD CONSTRAINT banned_users_pkey PRIMARY KEY (id);


--
-- Name: banned_users banned_users_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.banned_users
    ADD CONSTRAINT banned_users_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: booking_audit_logs booking_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_audit_logs
    ADD CONSTRAINT booking_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_notifications booking_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_pkey PRIMARY KEY (id);


--
-- Name: booking_payments booking_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_payments
    ADD CONSTRAINT booking_payments_pkey PRIMARY KEY (id);


--
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: bot_addition_attempts bot_addition_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bot_addition_attempts
    ADD CONSTRAINT bot_addition_attempts_pkey PRIMARY KEY (id);


--
-- Name: broadcast_button_presets broadcast_button_presets_name_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_button_presets
    ADD CONSTRAINT broadcast_button_presets_name_key UNIQUE (name);


--
-- Name: broadcast_button_presets broadcast_button_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_button_presets
    ADD CONSTRAINT broadcast_button_presets_pkey PRIMARY KEY (preset_id);


--
-- Name: broadcast_media broadcast_media_media_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_media
    ADD CONSTRAINT broadcast_media_media_id_key UNIQUE (media_id);


--
-- Name: broadcast_media broadcast_media_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_media
    ADD CONSTRAINT broadcast_media_pkey PRIMARY KEY (id);


--
-- Name: broadcast_queue_jobs broadcast_queue_jobs_job_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_queue_jobs
    ADD CONSTRAINT broadcast_queue_jobs_job_id_key UNIQUE (job_id);


--
-- Name: broadcast_queue_jobs broadcast_queue_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_queue_jobs
    ADD CONSTRAINT broadcast_queue_jobs_pkey PRIMARY KEY (id);


--
-- Name: broadcast_recipients broadcast_recipients_broadcast_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_broadcast_id_user_id_key UNIQUE (broadcast_id, user_id);


--
-- Name: broadcast_recipients broadcast_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_pkey PRIMARY KEY (id);


--
-- Name: broadcast_schedules broadcast_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_schedules
    ADD CONSTRAINT broadcast_schedules_pkey PRIMARY KEY (id);


--
-- Name: broadcast_schedules broadcast_schedules_schedule_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_schedules
    ADD CONSTRAINT broadcast_schedules_schedule_id_key UNIQUE (schedule_id);


--
-- Name: broadcast_templates broadcast_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_templates
    ADD CONSTRAINT broadcast_templates_pkey PRIMARY KEY (id);


--
-- Name: broadcast_templates broadcast_templates_template_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_templates
    ADD CONSTRAINT broadcast_templates_template_id_key UNIQUE (template_id);


--
-- Name: broadcasts broadcasts_broadcast_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_broadcast_id_key UNIQUE (broadcast_id);


--
-- Name: broadcasts broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_pkey PRIMARY KEY (id);


--
-- Name: call_feedback call_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.call_feedback
    ADD CONSTRAINT call_feedback_pkey PRIMARY KEY (id);


--
-- Name: call_packages_catalog call_packages_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.call_packages_catalog
    ADD CONSTRAINT call_packages_catalog_pkey PRIMARY KEY (id);


--
-- Name: call_sessions call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: card_tokens card_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.card_tokens
    ADD CONSTRAINT card_tokens_pkey PRIMARY KEY (id);


--
-- Name: card_tokens card_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.card_tokens
    ADD CONSTRAINT card_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: community_button_presets community_button_presets_button_type_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_button_presets
    ADD CONSTRAINT community_button_presets_button_type_key UNIQUE (button_type);


--
-- Name: community_button_presets community_button_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_button_presets
    ADD CONSTRAINT community_button_presets_pkey PRIMARY KEY (id);


--
-- Name: community_button_presets community_button_presets_preset_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_button_presets
    ADD CONSTRAINT community_button_presets_preset_id_key UNIQUE (preset_id);


--
-- Name: community_groups community_groups_group_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT community_groups_group_id_key UNIQUE (group_id);


--
-- Name: community_groups community_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT community_groups_pkey PRIMARY KEY (id);


--
-- Name: community_groups community_groups_telegram_group_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_groups
    ADD CONSTRAINT community_groups_telegram_group_id_key UNIQUE (telegram_group_id);


--
-- Name: community_post_analytics community_post_analytics_analytics_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_analytics
    ADD CONSTRAINT community_post_analytics_analytics_id_key UNIQUE (analytics_id);


--
-- Name: community_post_analytics community_post_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_analytics
    ADD CONSTRAINT community_post_analytics_pkey PRIMARY KEY (id);


--
-- Name: community_post_buttons community_post_buttons_button_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_buttons
    ADD CONSTRAINT community_post_buttons_button_id_key UNIQUE (button_id);


--
-- Name: community_post_buttons community_post_buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_buttons
    ADD CONSTRAINT community_post_buttons_pkey PRIMARY KEY (id);


--
-- Name: community_post_deliveries community_post_deliveries_delivery_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries
    ADD CONSTRAINT community_post_deliveries_delivery_id_key UNIQUE (delivery_id);


--
-- Name: community_post_deliveries community_post_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries
    ADD CONSTRAINT community_post_deliveries_pkey PRIMARY KEY (id);


--
-- Name: community_post_destinations community_post_destinations_destination_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_destinations
    ADD CONSTRAINT community_post_destinations_destination_id_key UNIQUE (destination_id);


--
-- Name: community_post_destinations community_post_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_destinations
    ADD CONSTRAINT community_post_destinations_pkey PRIMARY KEY (id);


--
-- Name: community_post_destinations community_post_destinations_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_destinations
    ADD CONSTRAINT community_post_destinations_telegram_id_key UNIQUE (telegram_id);


--
-- Name: community_post_schedules community_post_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_schedules
    ADD CONSTRAINT community_post_schedules_pkey PRIMARY KEY (id);


--
-- Name: community_post_schedules community_post_schedules_schedule_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_schedules
    ADD CONSTRAINT community_post_schedules_schedule_id_key UNIQUE (schedule_id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: community_posts community_posts_post_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_post_id_key UNIQUE (post_id);


--
-- Name: cristina_admin_briefs cristina_admin_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.cristina_admin_briefs
    ADD CONSTRAINT cristina_admin_briefs_pkey PRIMARY KEY (key);


--
-- Name: cult_event_registrations cult_event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.cult_event_registrations
    ADD CONSTRAINT cult_event_registrations_pkey PRIMARY KEY (id);


--
-- Name: cult_event_registrations cult_event_registrations_user_id_event_type_month_key_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.cult_event_registrations
    ADD CONSTRAINT cult_event_registrations_user_id_event_type_month_key_key UNIQUE (user_id, event_type, month_key);


--
-- Name: custom_emotes custom_emotes_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.custom_emotes
    ADD CONSTRAINT custom_emotes_pkey PRIMARY KEY (id);


--
-- Name: custom_emotes custom_emotes_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.custom_emotes
    ADD CONSTRAINT custom_emotes_user_id_name_key UNIQUE (user_id, name);


--
-- Name: emote_usage emote_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.emote_usage
    ADD CONSTRAINT emote_usage_pkey PRIMARY KEY (id);


--
-- Name: emotes emotes_name_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.emotes
    ADD CONSTRAINT emotes_name_key UNIQUE (name);


--
-- Name: emotes emotes_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.emotes
    ADD CONSTRAINT emotes_pkey PRIMARY KEY (id);


--
-- Name: forwarded_violations forwarded_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.forwarded_violations
    ADD CONSTRAINT forwarded_violations_pkey PRIMARY KEY (id);


--
-- Name: group_invitations group_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_pkey PRIMARY KEY (id);


--
-- Name: group_invitations group_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_invitations
    ADD CONSTRAINT group_invitations_token_key UNIQUE (token);


--
-- Name: group_settings group_settings_group_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_settings
    ADD CONSTRAINT group_settings_group_id_key UNIQUE (group_id);


--
-- Name: group_settings group_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_settings
    ADD CONSTRAINT group_settings_pkey PRIMARY KEY (id);


--
-- Name: jitsi_participants jitsi_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_participants
    ADD CONSTRAINT jitsi_participants_pkey PRIMARY KEY (id);


--
-- Name: jitsi_rooms jitsi_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_rooms
    ADD CONSTRAINT jitsi_rooms_pkey PRIMARY KEY (id);


--
-- Name: jitsi_rooms jitsi_rooms_room_code_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_rooms
    ADD CONSTRAINT jitsi_rooms_room_code_key UNIQUE (room_code);


--
-- Name: jitsi_tier_access jitsi_tier_access_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_tier_access
    ADD CONSTRAINT jitsi_tier_access_pkey PRIMARY KEY (id);


--
-- Name: jitsi_user_usage jitsi_user_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_user_usage
    ADD CONSTRAINT jitsi_user_usage_pkey PRIMARY KEY (id);


--
-- Name: jitsi_user_usage jitsi_user_usage_user_id_date_tier_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_user_usage
    ADD CONSTRAINT jitsi_user_usage_user_id_date_tier_key UNIQUE (user_id, date, tier);


--
-- Name: live_streams live_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_pkey PRIMARY KEY (id);


--
-- Name: media_favorites media_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_favorites
    ADD CONSTRAINT media_favorites_pkey PRIMARY KEY (id);


--
-- Name: media_favorites media_favorites_user_id_media_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_favorites
    ADD CONSTRAINT media_favorites_user_id_media_id_key UNIQUE (user_id, media_id);


--
-- Name: media_library media_library_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_pkey PRIMARY KEY (id);


--
-- Name: media_play_history media_play_history_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_play_history
    ADD CONSTRAINT media_play_history_pkey PRIMARY KEY (id);


--
-- Name: media_playlists media_playlists_owner_id_name_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_playlists
    ADD CONSTRAINT media_playlists_owner_id_name_key UNIQUE (owner_id, name);


--
-- Name: media_playlists media_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_playlists
    ADD CONSTRAINT media_playlists_pkey PRIMARY KEY (id);


--
-- Name: media_ratings media_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_ratings
    ADD CONSTRAINT media_ratings_pkey PRIMARY KEY (id);


--
-- Name: media_ratings media_ratings_user_id_media_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_ratings
    ADD CONSTRAINT media_ratings_user_id_media_id_key UNIQUE (user_id, media_id);


--
-- Name: media_shares media_shares_media_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_shares
    ADD CONSTRAINT media_shares_media_id_key UNIQUE (media_id);


--
-- Name: media_shares media_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_shares
    ADD CONSTRAINT media_shares_pkey PRIMARY KEY (id);


--
-- Name: meet_greet_bookings meet_greet_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_bookings
    ADD CONSTRAINT meet_greet_bookings_pkey PRIMARY KEY (id);


--
-- Name: meet_greet_payments meet_greet_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_payments
    ADD CONSTRAINT meet_greet_payments_pkey PRIMARY KEY (id);


--
-- Name: message_rate_limits message_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.message_rate_limits
    ADD CONSTRAINT message_rate_limits_pkey PRIMARY KEY (date);


--
-- Name: model_availability model_availability_model_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_availability
    ADD CONSTRAINT model_availability_model_id_day_of_week_key UNIQUE (model_id, day_of_week);


--
-- Name: model_availability model_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_availability
    ADD CONSTRAINT model_availability_pkey PRIMARY KEY (id);


--
-- Name: model_bookings model_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_bookings
    ADD CONSTRAINT model_bookings_pkey PRIMARY KEY (id);


--
-- Name: model_earnings model_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_earnings
    ADD CONSTRAINT model_earnings_pkey PRIMARY KEY (id);


--
-- Name: model_photos model_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_photos
    ADD CONSTRAINT model_photos_pkey PRIMARY KEY (id);


--
-- Name: model_reviews model_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_reviews
    ADD CONSTRAINT model_reviews_pkey PRIMARY KEY (id);


--
-- Name: models models_model_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_model_id_key UNIQUE (model_id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: moderation_logs moderation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.moderation_logs
    ADD CONSTRAINT moderation_logs_pkey PRIMARY KEY (id);


--
-- Name: moderation moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.moderation
    ADD CONSTRAINT moderation_pkey PRIMARY KEY (id);


--
-- Name: nearby_place_categories nearby_place_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_categories
    ADD CONSTRAINT nearby_place_categories_pkey PRIMARY KEY (id);


--
-- Name: nearby_place_categories nearby_place_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_categories
    ADD CONSTRAINT nearby_place_categories_slug_key UNIQUE (slug);


--
-- Name: nearby_place_favorites nearby_place_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_favorites
    ADD CONSTRAINT nearby_place_favorites_pkey PRIMARY KEY (id);


--
-- Name: nearby_place_favorites nearby_place_favorites_user_id_place_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_favorites
    ADD CONSTRAINT nearby_place_favorites_user_id_place_id_key UNIQUE (user_id, place_id);


--
-- Name: nearby_place_reports nearby_place_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reports
    ADD CONSTRAINT nearby_place_reports_pkey PRIMARY KEY (id);


--
-- Name: nearby_place_reviews nearby_place_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reviews
    ADD CONSTRAINT nearby_place_reviews_pkey PRIMARY KEY (id);


--
-- Name: nearby_place_submissions nearby_place_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_submissions
    ADD CONSTRAINT nearby_place_submissions_pkey PRIMARY KEY (id);


--
-- Name: nearby_places nearby_places_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_places
    ADD CONSTRAINT nearby_places_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: performer_availability performer_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.performer_availability
    ADD CONSTRAINT performer_availability_pkey PRIMARY KEY (id);


--
-- Name: performers performers_display_name_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.performers
    ADD CONSTRAINT performers_display_name_key UNIQUE (display_name);


--
-- Name: performers performers_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.performers
    ADD CONSTRAINT performers_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: player_states player_states_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.player_states
    ADD CONSTRAINT player_states_pkey PRIMARY KEY (id);


--
-- Name: player_states player_states_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.player_states
    ADD CONSTRAINT player_states_user_id_key UNIQUE (user_id);


--
-- Name: playlist_items playlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_pkey PRIMARY KEY (id);


--
-- Name: playlist_items playlist_items_playlist_id_media_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_playlist_id_media_id_key UNIQUE (playlist_id, media_id);


--
-- Name: pnp_bookings pnp_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_bookings
    ADD CONSTRAINT pnp_bookings_pkey PRIMARY KEY (id);


--
-- Name: pnp_feedback pnp_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_feedback
    ADD CONSTRAINT pnp_feedback_pkey PRIMARY KEY (id);


--
-- Name: pnp_live_promo_codes pnp_live_promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_codes
    ADD CONSTRAINT pnp_live_promo_codes_code_key UNIQUE (code);


--
-- Name: pnp_live_promo_codes pnp_live_promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_codes
    ADD CONSTRAINT pnp_live_promo_codes_pkey PRIMARY KEY (id);


--
-- Name: pnp_live_promo_usage pnp_live_promo_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_usage
    ADD CONSTRAINT pnp_live_promo_usage_pkey PRIMARY KEY (id);


--
-- Name: pnp_live_promo_usage pnp_live_promo_usage_promo_id_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_usage
    ADD CONSTRAINT pnp_live_promo_usage_promo_id_booking_id_key UNIQUE (promo_id, booking_id);


--
-- Name: pnp_model_blocked_dates pnp_model_blocked_dates_model_id_blocked_date_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_blocked_dates
    ADD CONSTRAINT pnp_model_blocked_dates_model_id_blocked_date_key UNIQUE (model_id, blocked_date);


--
-- Name: pnp_model_blocked_dates pnp_model_blocked_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_blocked_dates
    ADD CONSTRAINT pnp_model_blocked_dates_pkey PRIMARY KEY (id);


--
-- Name: pnp_model_earnings pnp_model_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_earnings
    ADD CONSTRAINT pnp_model_earnings_pkey PRIMARY KEY (id);


--
-- Name: pnp_model_payouts pnp_model_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_payouts
    ADD CONSTRAINT pnp_model_payouts_pkey PRIMARY KEY (id);


--
-- Name: pnp_model_schedules pnp_model_schedules_model_id_day_of_week_start_time_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_schedules
    ADD CONSTRAINT pnp_model_schedules_model_id_day_of_week_start_time_key UNIQUE (model_id, day_of_week, start_time);


--
-- Name: pnp_model_schedules pnp_model_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_schedules
    ADD CONSTRAINT pnp_model_schedules_pkey PRIMARY KEY (id);


--
-- Name: pnp_model_status_history pnp_model_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_status_history
    ADD CONSTRAINT pnp_model_status_history_pkey PRIMARY KEY (id);


--
-- Name: pnp_models pnp_models_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_models
    ADD CONSTRAINT pnp_models_pkey PRIMARY KEY (id);


--
-- Name: pnp_models pnp_models_username_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_models
    ADD CONSTRAINT pnp_models_username_key UNIQUE (username);


--
-- Name: pnp_payments pnp_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_payments
    ADD CONSTRAINT pnp_payments_pkey PRIMARY KEY (id);


--
-- Name: pnp_refunds pnp_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_refunds
    ADD CONSTRAINT pnp_refunds_pkey PRIMARY KEY (id);


--
-- Name: pnp_tips pnp_tips_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_tips
    ADD CONSTRAINT pnp_tips_pkey PRIMARY KEY (id);


--
-- Name: private_calls private_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.private_calls
    ADD CONSTRAINT private_calls_pkey PRIMARY KEY (id);


--
-- Name: profile_compliance profile_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.profile_compliance
    ADD CONSTRAINT profile_compliance_pkey PRIMARY KEY (id);


--
-- Name: profile_compliance profile_compliance_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.profile_compliance
    ADD CONSTRAINT profile_compliance_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: promo_code_usage promo_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_promo_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_promo_id_user_id_key UNIQUE (promo_id, user_id);


--
-- Name: promos promos_code_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promos
    ADD CONSTRAINT promos_code_key UNIQUE (code);


--
-- Name: promos promos_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promos
    ADD CONSTRAINT promos_pkey PRIMARY KEY (id);


--
-- Name: radio_history radio_history_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_history
    ADD CONSTRAINT radio_history_pkey PRIMARY KEY (id);


--
-- Name: radio_now_playing_fixed radio_now_playing_fixed_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_now_playing_fixed
    ADD CONSTRAINT radio_now_playing_fixed_pkey PRIMARY KEY (id);


--
-- Name: radio_now_playing_new radio_now_playing_new_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_now_playing_new
    ADD CONSTRAINT radio_now_playing_new_pkey PRIMARY KEY (id);


--
-- Name: radio_now_playing radio_now_playing_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_now_playing
    ADD CONSTRAINT radio_now_playing_pkey PRIMARY KEY (id);


--
-- Name: radio_queue radio_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_queue
    ADD CONSTRAINT radio_queue_pkey PRIMARY KEY (id);


--
-- Name: radio_requests radio_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_requests
    ADD CONSTRAINT radio_requests_pkey PRIMARY KEY (id);


--
-- Name: radio_schedule radio_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_schedule
    ADD CONSTRAINT radio_schedule_pkey PRIMARY KEY (id);


--
-- Name: radio_stations radio_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_stations
    ADD CONSTRAINT radio_stations_pkey PRIMARY KEY (id);


--
-- Name: recurring_payments recurring_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_payments
    ADD CONSTRAINT recurring_payments_pkey PRIMARY KEY (id);


--
-- Name: recurring_subscriptions recurring_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_subscriptions
    ADD CONSTRAINT recurring_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: segment_membership segment_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_pkey PRIMARY KEY (id);


--
-- Name: segment_membership segment_membership_segment_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_segment_id_user_id_key UNIQUE (segment_id, user_id);


--
-- Name: stream_banned_users stream_banned_users_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_banned_users
    ADD CONSTRAINT stream_banned_users_pkey PRIMARY KEY (id);


--
-- Name: stream_comments stream_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_comments
    ADD CONSTRAINT stream_comments_pkey PRIMARY KEY (id);


--
-- Name: stream_notifications stream_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_pkey PRIMARY KEY (id);


--
-- Name: stream_notifications stream_notifications_user_id_streamer_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_user_id_streamer_id_key UNIQUE (user_id, streamer_id);


--
-- Name: stream_viewers stream_viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_viewers
    ADD CONSTRAINT stream_viewers_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_email_key UNIQUE (email);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: support_topics support_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.support_topics
    ADD CONSTRAINT support_topics_pkey PRIMARY KEY (user_id);


--
-- Name: topic_analytics topic_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_analytics
    ADD CONSTRAINT topic_analytics_pkey PRIMARY KEY (id);


--
-- Name: topic_analytics topic_analytics_topic_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_analytics
    ADD CONSTRAINT topic_analytics_topic_id_user_id_key UNIQUE (topic_id, user_id);


--
-- Name: topic_configuration topic_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_configuration
    ADD CONSTRAINT topic_configuration_pkey PRIMARY KEY (topic_id);


--
-- Name: topic_violations topic_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.topic_violations
    ADD CONSTRAINT topic_violations_pkey PRIMARY KEY (id);


--
-- Name: user_broadcast_preferences user_broadcast_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_broadcast_preferences user_broadcast_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_moderation_actions user_moderation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_moderation_actions
    ADD CONSTRAINT user_moderation_actions_pkey PRIMARY KEY (id);


--
-- Name: user_moderation_history user_moderation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_moderation_history
    ADD CONSTRAINT user_moderation_history_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_user_id_model_id_notification_type_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_model_id_notification_type_key UNIQUE (user_id, model_id, notification_type);


--
-- Name: user_segments user_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_pkey PRIMARY KEY (id);


--
-- Name: user_segments user_segments_segment_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_segment_id_key UNIQUE (segment_id);


--
-- Name: user_warnings user_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_warnings
    ADD CONSTRAINT user_warnings_pkey PRIMARY KEY (id);


--
-- Name: username_history username_history_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.username_history
    ADD CONSTRAINT username_history_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wall_of_fame_daily_stats wall_of_fame_daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_stats
    ADD CONSTRAINT wall_of_fame_daily_stats_pkey PRIMARY KEY (date_key, user_id);


--
-- Name: wall_of_fame_daily_winners wall_of_fame_daily_winners_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_winners
    ADD CONSTRAINT wall_of_fame_daily_winners_pkey PRIMARY KEY (date_key);


--
-- Name: wall_of_fame_posts wall_of_fame_posts_group_id_message_id_key; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_posts
    ADD CONSTRAINT wall_of_fame_posts_group_id_message_id_key UNIQUE (group_id, message_id);


--
-- Name: wall_of_fame_posts wall_of_fame_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_posts
    ADD CONSTRAINT wall_of_fame_posts_pkey PRIMARY KEY (id);


--
-- Name: warnings warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.warnings
    ADD CONSTRAINT warnings_pkey PRIMARY KEY (id);


--
-- Name: x_accounts x_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.x_accounts
    ADD CONSTRAINT x_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: x_oauth_states x_oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.x_oauth_states
    ADD CONSTRAINT x_oauth_states_pkey PRIMARY KEY (state);


--
-- Name: x_post_jobs x_post_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.x_post_jobs
    ADD CONSTRAINT x_post_jobs_pkey PRIMARY KEY (post_id);


--
-- Name: idx_activation_codes_expires_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_codes_expires_at ON public.activation_codes USING btree (expires_at);


--
-- Name: idx_activation_codes_used; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_codes_used ON public.activation_codes USING btree (used);


--
-- Name: idx_activation_codes_used_by; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_codes_used_by ON public.activation_codes USING btree (used_by);


--
-- Name: idx_activation_logs_activated_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_logs_activated_at ON public.activation_logs USING btree (activated_at);


--
-- Name: idx_activation_logs_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_logs_code ON public.activation_logs USING btree (code);


--
-- Name: idx_activation_logs_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_activation_logs_user_id ON public.activation_logs USING btree (user_id);


--
-- Name: idx_age_verification_attempts_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_age_verification_attempts_created_at ON public.age_verification_attempts USING btree (created_at);


--
-- Name: idx_age_verification_attempts_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_age_verification_attempts_user_id ON public.age_verification_attempts USING btree (user_id);


--
-- Name: idx_age_verification_attempts_verified; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_age_verification_attempts_verified ON public.age_verification_attempts USING btree (verified);


--
-- Name: idx_analytics_posts; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_posts ON public.topic_analytics USING btree (total_posts DESC);


--
-- Name: idx_analytics_reactions; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_reactions ON public.topic_analytics USING btree (total_reactions_given DESC);


--
-- Name: idx_analytics_topic; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_topic ON public.topic_analytics USING btree (topic_id);


--
-- Name: idx_analytics_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_user ON public.topic_analytics USING btree (user_id);


--
-- Name: idx_banned_users_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_banned_users_active ON public.banned_users USING btree (active);


--
-- Name: idx_banned_users_banned_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_banned_users_banned_at ON public.banned_users USING btree (banned_at);


--
-- Name: idx_banned_users_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_banned_users_group_id ON public.banned_users USING btree (group_id);


--
-- Name: idx_banned_users_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_banned_users_user_id ON public.banned_users USING btree (user_id);


--
-- Name: idx_booking_audit_action; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_audit_action ON public.booking_audit_logs USING btree (action);


--
-- Name: idx_booking_audit_actor; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_audit_actor ON public.booking_audit_logs USING btree (actor_type, actor_id);


--
-- Name: idx_booking_audit_created; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_audit_created ON public.booking_audit_logs USING btree (created_at);


--
-- Name: idx_booking_audit_entity; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_audit_entity ON public.booking_audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_booking_notifications_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_notifications_booking ON public.booking_notifications USING btree (booking_id);


--
-- Name: idx_booking_notifications_scheduled; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_notifications_scheduled ON public.booking_notifications USING btree (scheduled_for, status);


--
-- Name: idx_booking_notifications_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_notifications_status ON public.booking_notifications USING btree (status);


--
-- Name: idx_booking_notifications_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_notifications_user ON public.booking_notifications USING btree (user_id);


--
-- Name: idx_booking_payments_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_payments_booking ON public.booking_payments USING btree (booking_id);


--
-- Name: idx_booking_payments_expires; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_payments_expires ON public.booking_payments USING btree (expires_at) WHERE ((status)::text = ANY ((ARRAY['created'::character varying, 'pending'::character varying])::text[]));


--
-- Name: idx_booking_payments_provider; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_payments_provider ON public.booking_payments USING btree (provider);


--
-- Name: idx_booking_payments_provider_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_payments_provider_id ON public.booking_payments USING btree (provider_payment_id);


--
-- Name: idx_booking_payments_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_payments_status ON public.booking_payments USING btree (status);


--
-- Name: idx_booking_slots_hold_expires; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_slots_hold_expires ON public.booking_slots USING btree (hold_expires_at) WHERE ((status)::text = 'held'::text);


--
-- Name: idx_booking_slots_performer; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_slots_performer ON public.booking_slots USING btree (performer_id);


--
-- Name: idx_booking_slots_start; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_slots_start ON public.booking_slots USING btree (start_time_utc);


--
-- Name: idx_booking_slots_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_booking_slots_status ON public.booking_slots USING btree (status);


--
-- Name: idx_booking_slots_unique; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE UNIQUE INDEX idx_booking_slots_unique ON public.booking_slots USING btree (performer_id, start_time_utc);


--
-- Name: idx_bookings_created; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_created ON public.bookings USING btree (user_id, created_at);


--
-- Name: idx_bookings_hold_expires; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_hold_expires ON public.bookings USING btree (hold_expires_at) WHERE ((status)::text = ANY ((ARRAY['held'::character varying, 'awaiting_payment'::character varying])::text[]));


--
-- Name: idx_bookings_performer; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_performer ON public.bookings USING btree (performer_id);


--
-- Name: idx_bookings_performer_start; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_performer_start ON public.bookings USING btree (performer_id, start_time_utc);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_bot_addition_attempts_bot_username; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bot_addition_attempts_bot_username ON public.bot_addition_attempts USING btree (bot_username);


--
-- Name: idx_bot_addition_attempts_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bot_addition_attempts_group_id ON public.bot_addition_attempts USING btree (group_id);


--
-- Name: idx_bot_addition_attempts_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bot_addition_attempts_timestamp ON public.bot_addition_attempts USING btree ("timestamp");


--
-- Name: idx_bot_addition_attempts_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_bot_addition_attempts_user_id ON public.bot_addition_attempts USING btree (user_id);


--
-- Name: idx_broadcast_button_presets_enabled; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcast_button_presets_enabled ON public.broadcast_button_presets USING btree (enabled);


--
-- Name: idx_broadcast_media_broadcast_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcast_media_broadcast_id ON public.broadcast_media USING btree (broadcast_id);


--
-- Name: idx_broadcast_media_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcast_media_created_at ON public.broadcast_media USING btree (created_at DESC);


--
-- Name: idx_broadcast_media_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcast_media_media_id ON public.broadcast_media USING btree (media_id);


--
-- Name: idx_broadcast_media_s3_key; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcast_media_s3_key ON public.broadcast_media USING btree (s3_key);


--
-- Name: idx_broadcasts_admin_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_admin_id ON public.broadcasts USING btree (admin_id);


--
-- Name: idx_broadcasts_broadcast_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_broadcast_id ON public.broadcasts USING btree (broadcast_id);


--
-- Name: idx_broadcasts_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_created_at ON public.broadcasts USING btree (created_at DESC);


--
-- Name: idx_broadcasts_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_scheduled_at ON public.broadcasts USING btree (scheduled_at);


--
-- Name: idx_broadcasts_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_status ON public.broadcasts USING btree (status);


--
-- Name: idx_broadcasts_target_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_broadcasts_target_type ON public.broadcasts USING btree (target_type);


--
-- Name: idx_call_feedback_call_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_feedback_call_id ON public.call_feedback USING btree (call_id);


--
-- Name: idx_call_feedback_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_feedback_created_at ON public.call_feedback USING btree (created_at);


--
-- Name: idx_call_feedback_rating; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_feedback_rating ON public.call_feedback USING btree (rating);


--
-- Name: idx_call_feedback_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_feedback_user_id ON public.call_feedback USING btree (user_id);


--
-- Name: idx_call_sessions_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_sessions_booking ON public.call_sessions USING btree (booking_id);


--
-- Name: idx_call_sessions_room_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_sessions_room_id ON public.call_sessions USING btree (room_id);


--
-- Name: idx_call_sessions_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_call_sessions_status ON public.call_sessions USING btree (status);


--
-- Name: idx_calls_caller_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_calls_caller_id ON public.calls USING btree (caller_id);


--
-- Name: idx_calls_receiver_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_calls_receiver_id ON public.calls USING btree (receiver_id);


--
-- Name: idx_calls_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_calls_scheduled_at ON public.calls USING btree (scheduled_at);


--
-- Name: idx_calls_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_calls_status ON public.calls USING btree (status);


--
-- Name: idx_card_tokens_default; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_card_tokens_default ON public.card_tokens USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_card_tokens_token; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_card_tokens_token ON public.card_tokens USING btree (token);


--
-- Name: idx_card_tokens_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_card_tokens_user_id ON public.card_tokens USING btree (user_id);


--
-- Name: idx_community_button_presets_button_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_button_presets_button_type ON public.community_button_presets USING btree (button_type);


--
-- Name: idx_community_button_presets_is_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_button_presets_is_active ON public.community_button_presets USING btree (is_active);


--
-- Name: idx_community_groups_display_order; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_groups_display_order ON public.community_groups USING btree (display_order);


--
-- Name: idx_community_groups_is_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_groups_is_active ON public.community_groups USING btree (is_active);


--
-- Name: idx_community_post_analytics_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_analytics_group_id ON public.community_post_analytics USING btree (group_id);


--
-- Name: idx_community_post_analytics_post_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_analytics_post_id ON public.community_post_analytics USING btree (post_id);


--
-- Name: idx_community_post_buttons_button_order; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_buttons_button_order ON public.community_post_buttons USING btree (post_id, button_order);


--
-- Name: idx_community_post_buttons_post_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_buttons_post_id ON public.community_post_buttons USING btree (post_id);


--
-- Name: idx_community_post_deliveries_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_deliveries_group_id ON public.community_post_deliveries USING btree (group_id);


--
-- Name: idx_community_post_deliveries_post_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_deliveries_post_id ON public.community_post_deliveries USING btree (post_id);


--
-- Name: idx_community_post_deliveries_schedule_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_deliveries_schedule_id ON public.community_post_deliveries USING btree (schedule_id);


--
-- Name: idx_community_post_deliveries_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_deliveries_status ON public.community_post_deliveries USING btree (status);


--
-- Name: idx_community_post_schedules_next_execution; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_schedules_next_execution ON public.community_post_schedules USING btree (next_execution_at);


--
-- Name: idx_community_post_schedules_post_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_schedules_post_id ON public.community_post_schedules USING btree (post_id);


--
-- Name: idx_community_post_schedules_scheduled_for; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_schedules_scheduled_for ON public.community_post_schedules USING btree (scheduled_for);


--
-- Name: idx_community_post_schedules_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_post_schedules_status ON public.community_post_schedules USING btree (status);


--
-- Name: idx_community_posts_admin_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_posts_admin_id ON public.community_posts USING btree (admin_id);


--
-- Name: idx_community_posts_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_posts_created_at ON public.community_posts USING btree (created_at DESC);


--
-- Name: idx_community_posts_is_recurring; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_posts_is_recurring ON public.community_posts USING btree (is_recurring);


--
-- Name: idx_community_posts_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_posts_scheduled_at ON public.community_posts USING btree (scheduled_at);


--
-- Name: idx_community_posts_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_community_posts_status ON public.community_posts USING btree (status);


--
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_created_at ON public.live_streams USING btree (created_at);


--
-- Name: idx_cult_event_registrations_event; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_cult_event_registrations_event ON public.cult_event_registrations USING btree (event_type, event_at);


--
-- Name: idx_custom_emotes_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_custom_emotes_user_id ON public.custom_emotes USING btree (user_id);


--
-- Name: idx_emote_usage_emote_name; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_emote_usage_emote_name ON public.emote_usage USING btree (emote_name);


--
-- Name: idx_emote_usage_used_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_emote_usage_used_at ON public.emote_usage USING btree (used_at);


--
-- Name: idx_emote_usage_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_emote_usage_user_id ON public.emote_usage USING btree (user_id);


--
-- Name: idx_forwarded_violations_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_forwarded_violations_group_id ON public.forwarded_violations USING btree (group_id);


--
-- Name: idx_forwarded_violations_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_forwarded_violations_timestamp ON public.forwarded_violations USING btree ("timestamp");


--
-- Name: idx_forwarded_violations_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_forwarded_violations_user_id ON public.forwarded_violations USING btree (user_id);


--
-- Name: idx_group_invitations_expires_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_group_invitations_expires_at ON public.group_invitations USING btree (expires_at);


--
-- Name: idx_group_invitations_used; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_group_invitations_used ON public.group_invitations USING btree (used);


--
-- Name: idx_group_invitations_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_group_invitations_user_id ON public.group_invitations USING btree (user_id);


--
-- Name: idx_group_settings_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_group_settings_group_id ON public.group_settings USING btree (group_id);


--
-- Name: idx_jitsi_participants_room_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_participants_room_id ON public.jitsi_participants USING btree (room_id);


--
-- Name: idx_jitsi_participants_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_participants_user_id ON public.jitsi_participants USING btree (user_id);


--
-- Name: idx_jitsi_rooms_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_created_at ON public.jitsi_rooms USING btree (created_at DESC);


--
-- Name: idx_jitsi_rooms_host_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_host_user_id ON public.jitsi_rooms USING btree (host_user_id);


--
-- Name: idx_jitsi_rooms_room_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_room_code ON public.jitsi_rooms USING btree (room_code);


--
-- Name: idx_jitsi_rooms_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_status ON public.jitsi_rooms USING btree (status);


--
-- Name: idx_jitsi_rooms_telegram_group; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_telegram_group ON public.jitsi_rooms USING btree (telegram_group_id);


--
-- Name: idx_jitsi_rooms_tier; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_rooms_tier ON public.jitsi_rooms USING btree (tier);


--
-- Name: idx_jitsi_tier_access_plan; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_tier_access_plan ON public.jitsi_tier_access USING btree (plan_tier);


--
-- Name: idx_jitsi_user_usage_user_date; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_jitsi_user_usage_user_date ON public.jitsi_user_usage USING btree (user_id, date);


--
-- Name: idx_live_streams_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_active ON public.live_streams USING btree (status) WHERE ((status)::text = 'live'::text);


--
-- Name: idx_live_streams_channel_name; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_channel_name ON public.live_streams USING btree (channel_name);


--
-- Name: idx_live_streams_current_viewers; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_current_viewers ON public.live_streams USING btree (current_viewers DESC);


--
-- Name: idx_live_streams_host_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_host_id ON public.live_streams USING btree (host_id);


--
-- Name: idx_live_streams_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_scheduled_at ON public.live_streams USING btree (scheduled_at);


--
-- Name: idx_live_streams_scheduled_for; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_scheduled_for ON public.live_streams USING btree (scheduled_for);


--
-- Name: idx_live_streams_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_live_streams_status ON public.live_streams USING btree (status);


--
-- Name: idx_media_favorites_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_favorites_media_id ON public.media_favorites USING btree (media_id);


--
-- Name: idx_media_favorites_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_favorites_user_id ON public.media_favorites USING btree (user_id);


--
-- Name: idx_media_library_category; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_category ON public.media_library USING btree (category);


--
-- Name: idx_media_library_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_created_at ON public.media_library USING btree (created_at DESC);


--
-- Name: idx_media_library_is_public; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_is_public ON public.media_library USING btree (is_public);


--
-- Name: idx_media_library_likes; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_likes ON public.media_library USING btree (likes DESC);


--
-- Name: idx_media_library_plays; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_plays ON public.media_library USING btree (plays DESC);


--
-- Name: idx_media_library_tags; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_tags ON public.media_library USING gin (tags);


--
-- Name: idx_media_library_title; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_title ON public.media_library USING btree (title);


--
-- Name: idx_media_library_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_type ON public.media_library USING btree (type);


--
-- Name: idx_media_library_uploader_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_library_uploader_id ON public.media_library USING btree (uploader_id);


--
-- Name: idx_media_play_history_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_play_history_media_id ON public.media_play_history USING btree (media_id);


--
-- Name: idx_media_play_history_played_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_play_history_played_at ON public.media_play_history USING btree (played_at DESC);


--
-- Name: idx_media_play_history_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_play_history_user_id ON public.media_play_history USING btree (user_id);


--
-- Name: idx_media_playlists_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_playlists_created_at ON public.media_playlists USING btree (created_at DESC);


--
-- Name: idx_media_playlists_is_public; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_playlists_is_public ON public.media_playlists USING btree (is_public);


--
-- Name: idx_media_playlists_owner_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_playlists_owner_id ON public.media_playlists USING btree (owner_id);


--
-- Name: idx_media_ratings_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_ratings_media_id ON public.media_ratings USING btree (media_id);


--
-- Name: idx_media_ratings_rating; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_ratings_rating ON public.media_ratings USING btree (rating);


--
-- Name: idx_media_ratings_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_ratings_user_id ON public.media_ratings USING btree (user_id);


--
-- Name: idx_media_shares_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_shares_created_at ON public.media_shares USING btree (created_at);


--
-- Name: idx_media_shares_like_count; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_shares_like_count ON public.media_shares USING btree (like_count);


--
-- Name: idx_media_shares_media_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_shares_media_type ON public.media_shares USING btree (media_type);


--
-- Name: idx_media_shares_share_count; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_shares_share_count ON public.media_shares USING btree (share_count);


--
-- Name: idx_media_shares_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_media_shares_user_id ON public.media_shares USING btree (user_id);


--
-- Name: idx_meet_greet_bookings_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_meet_greet_bookings_model ON public.meet_greet_bookings USING btree (model_id);


--
-- Name: idx_meet_greet_bookings_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_meet_greet_bookings_status ON public.meet_greet_bookings USING btree (status);


--
-- Name: idx_meet_greet_bookings_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_meet_greet_bookings_user ON public.meet_greet_bookings USING btree (user_id);


--
-- Name: idx_meet_greet_payments_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_meet_greet_payments_booking ON public.meet_greet_payments USING btree (booking_id);


--
-- Name: idx_meet_greet_payments_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_meet_greet_payments_status ON public.meet_greet_payments USING btree (status);


--
-- Name: idx_model_availability_day; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_availability_day ON public.model_availability USING btree (day_of_week);


--
-- Name: idx_model_availability_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_availability_model ON public.model_availability USING btree (model_id);


--
-- Name: idx_model_bookings_date; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_bookings_date ON public.model_bookings USING btree (scheduled_date);


--
-- Name: idx_model_bookings_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_bookings_model ON public.model_bookings USING btree (model_id);


--
-- Name: idx_model_bookings_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_bookings_status ON public.model_bookings USING btree (status);


--
-- Name: idx_model_bookings_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_bookings_user ON public.model_bookings USING btree (user_id);


--
-- Name: idx_model_photos_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_model_photos_model ON public.model_photos USING btree (model_id);


--
-- Name: idx_models_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_models_active ON public.models USING btree (is_active);


--
-- Name: idx_moderation_actions_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_actions_active ON public.user_moderation_actions USING btree (active);


--
-- Name: idx_moderation_actions_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_actions_user_id ON public.user_moderation_actions USING btree (user_id);


--
-- Name: idx_moderation_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_group_id ON public.moderation USING btree (group_id);


--
-- Name: idx_moderation_logs_action; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_logs_action ON public.moderation_logs USING btree (action);


--
-- Name: idx_moderation_logs_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_logs_created_at ON public.moderation_logs USING btree (created_at);


--
-- Name: idx_moderation_logs_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_logs_group_id ON public.moderation_logs USING btree (group_id);


--
-- Name: idx_moderation_logs_target_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_logs_target_user_id ON public.moderation_logs USING btree (target_user_id);


--
-- Name: idx_moderation_logs_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_moderation_logs_user_id ON public.moderation_logs USING btree (user_id);


--
-- Name: idx_nearby_places_approved_location; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_approved_location ON public.nearby_places USING btree (location_lat, location_lng) WHERE ((status)::text = 'approved'::text);


--
-- Name: idx_nearby_places_category; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_category ON public.nearby_places USING btree (category_id);


--
-- Name: idx_nearby_places_city; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_city ON public.nearby_places USING btree (city);


--
-- Name: idx_nearby_places_geohash; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_geohash ON public.nearby_places USING btree (location_geohash);


--
-- Name: idx_nearby_places_location; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_location ON public.nearby_places USING btree (location_lat, location_lng);


--
-- Name: idx_nearby_places_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_status ON public.nearby_places USING btree (status);


--
-- Name: idx_nearby_places_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_nearby_places_type ON public.nearby_places USING btree (place_type);


--
-- Name: idx_payment_webhook_events_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payment_webhook_events_created_at ON public.payment_webhook_events USING btree (created_at DESC);


--
-- Name: idx_payment_webhook_events_event_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payment_webhook_events_event_id ON public.payment_webhook_events USING btree (event_id);


--
-- Name: idx_payment_webhook_events_payment_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payment_webhook_events_payment_id ON public.payment_webhook_events USING btree (payment_id);


--
-- Name: idx_payment_webhook_events_provider; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payment_webhook_events_provider ON public.payment_webhook_events USING btree (provider);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at);


--
-- Name: idx_payments_daimo_payment_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_daimo_payment_id ON public.payments USING btree (daimo_payment_id);


--
-- Name: idx_payments_metadata; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_metadata ON public.payments USING gin (metadata);


--
-- Name: idx_payments_plan_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_plan_id ON public.payments USING btree (plan_id);


--
-- Name: idx_payments_provider; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_provider ON public.payments USING btree (provider);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);


--
-- Name: idx_payments_user_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_payments_user_status ON public.payments USING btree (user_id, status);


--
-- Name: idx_performer_availability_date; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performer_availability_date ON public.performer_availability USING btree (date_local);


--
-- Name: idx_performer_availability_day; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performer_availability_day ON public.performer_availability USING btree (day_of_week);


--
-- Name: idx_performer_availability_performer; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performer_availability_performer ON public.performer_availability USING btree (performer_id);


--
-- Name: idx_performer_availability_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performer_availability_type ON public.performer_availability USING btree (type);


--
-- Name: idx_performers_availability; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performers_availability ON public.performers USING btree (is_available);


--
-- Name: idx_performers_display_name; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performers_display_name ON public.performers USING btree (display_name);


--
-- Name: idx_performers_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performers_status ON public.performers USING btree (status);


--
-- Name: idx_performers_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_performers_user_id ON public.performers USING btree (user_id);


--
-- Name: idx_place_favorites_place; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_favorites_place ON public.nearby_place_favorites USING btree (place_id);


--
-- Name: idx_place_favorites_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_favorites_user ON public.nearby_place_favorites USING btree (user_id);


--
-- Name: idx_place_reports_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_reports_status ON public.nearby_place_reports USING btree (status);


--
-- Name: idx_place_reviews_place; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_reviews_place ON public.nearby_place_reviews USING btree (place_id);


--
-- Name: idx_place_submissions_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_submissions_status ON public.nearby_place_submissions USING btree (status);


--
-- Name: idx_place_submissions_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_place_submissions_user ON public.nearby_place_submissions USING btree (submitted_by_user_id);


--
-- Name: idx_player_states_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_player_states_media_id ON public.player_states USING btree (media_id);


--
-- Name: idx_player_states_playlist_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_player_states_playlist_id ON public.player_states USING btree (playlist_id);


--
-- Name: idx_player_states_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_player_states_user_id ON public.player_states USING btree (user_id);


--
-- Name: idx_playlist_items_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_playlist_items_media_id ON public.playlist_items USING btree (media_id);


--
-- Name: idx_playlist_items_playlist_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_playlist_items_playlist_id ON public.playlist_items USING btree (playlist_id);


--
-- Name: idx_playlist_items_position; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_playlist_items_position ON public.playlist_items USING btree (playlist_id, "position");


--
-- Name: idx_pnp_blocked_dates_lookup; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_blocked_dates_lookup ON public.pnp_model_blocked_dates USING btree (model_id, blocked_date);


--
-- Name: idx_pnp_bookings_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_model ON public.pnp_bookings USING btree (model_id);


--
-- Name: idx_pnp_bookings_model_status_time; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_model_status_time ON public.pnp_bookings USING btree (model_id, status, booking_time);


--
-- Name: idx_pnp_bookings_payment_expires; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_payment_expires ON public.pnp_bookings USING btree (payment_expires_at) WHERE ((payment_status)::text = 'pending'::text);


--
-- Name: idx_pnp_bookings_promo_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_promo_code ON public.pnp_bookings USING btree (promo_code);


--
-- Name: idx_pnp_bookings_promo_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_promo_id ON public.pnp_bookings USING btree (promo_id);


--
-- Name: idx_pnp_bookings_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_status ON public.pnp_bookings USING btree (status);


--
-- Name: idx_pnp_bookings_transaction_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_transaction_id ON public.pnp_bookings USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: idx_pnp_bookings_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_user ON public.pnp_bookings USING btree (user_id);


--
-- Name: idx_pnp_bookings_user_time; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_user_time ON public.pnp_bookings USING btree (user_id, booking_time DESC);


--
-- Name: idx_pnp_bookings_worker_autocomplete; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_bookings_worker_autocomplete ON public.pnp_bookings USING btree (status, payment_status, booking_time) WHERE (((status)::text = 'confirmed'::text) AND ((payment_status)::text = 'paid'::text));


--
-- Name: idx_pnp_feedback_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_feedback_booking ON public.pnp_feedback USING btree (booking_id);


--
-- Name: idx_pnp_model_earnings_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_model_earnings_model ON public.pnp_model_earnings USING btree (model_id);


--
-- Name: idx_pnp_model_earnings_payout; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_model_earnings_payout ON public.pnp_model_earnings USING btree (payout_status);


--
-- Name: idx_pnp_model_earnings_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_model_earnings_type ON public.pnp_model_earnings USING btree (earning_type);


--
-- Name: idx_pnp_model_schedules_lookup; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_model_schedules_lookup ON public.pnp_model_schedules USING btree (model_id, day_of_week, is_active);


--
-- Name: idx_pnp_models_active_sorted; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_models_active_sorted ON public.pnp_models USING btree (is_active, is_online DESC, avg_rating DESC, total_shows DESC) WHERE (is_active = true);


--
-- Name: idx_pnp_models_last_activity; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_models_last_activity ON public.pnp_models USING btree (last_activity_at) WHERE (is_online = true);


--
-- Name: idx_pnp_models_online_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_models_online_status ON public.pnp_models USING btree (is_online, last_online) WHERE (is_online = true);


--
-- Name: idx_pnp_models_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_models_user_id ON public.pnp_models USING btree (user_id);


--
-- Name: idx_pnp_payments_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_payments_booking ON public.pnp_payments USING btree (booking_id);


--
-- Name: idx_pnp_payments_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_payments_status ON public.pnp_payments USING btree (status);


--
-- Name: idx_pnp_payouts_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_payouts_model ON public.pnp_model_payouts USING btree (model_id);


--
-- Name: idx_pnp_payouts_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_payouts_status ON public.pnp_model_payouts USING btree (status);


--
-- Name: idx_pnp_promo_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_promo_active ON public.pnp_live_promo_codes USING btree (active);


--
-- Name: idx_pnp_promo_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_promo_code ON public.pnp_live_promo_codes USING btree (code);


--
-- Name: idx_pnp_promo_usage_promo; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_promo_usage_promo ON public.pnp_live_promo_usage USING btree (promo_id);


--
-- Name: idx_pnp_promo_usage_unique_check; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_promo_usage_unique_check ON public.pnp_live_promo_usage USING btree (promo_id, user_id);


--
-- Name: idx_pnp_promo_usage_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_promo_usage_user ON public.pnp_live_promo_usage USING btree (user_id);


--
-- Name: idx_pnp_refunds_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_refunds_booking ON public.pnp_refunds USING btree (booking_id);


--
-- Name: idx_pnp_refunds_pending; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_refunds_pending ON public.pnp_refunds USING btree (status, created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_pnp_tips_booking; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_tips_booking ON public.pnp_tips USING btree (booking_id);


--
-- Name: idx_pnp_tips_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_tips_model ON public.pnp_tips USING btree (model_id);


--
-- Name: idx_pnp_tips_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_tips_status ON public.pnp_tips USING btree (payment_status);


--
-- Name: idx_pnp_tips_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_pnp_tips_user ON public.pnp_tips USING btree (user_id);


--
-- Name: idx_post_destinations_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_post_destinations_active ON public.community_post_destinations USING btree (is_active);


--
-- Name: idx_post_destinations_order; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_post_destinations_order ON public.community_post_destinations USING btree (display_order);


--
-- Name: idx_post_destinations_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_post_destinations_type ON public.community_post_destinations USING btree (destination_type);


--
-- Name: idx_private_calls_scheduled; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_private_calls_scheduled ON public.private_calls USING btree (scheduled_date);


--
-- Name: idx_private_calls_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_private_calls_status ON public.private_calls USING btree (status);


--
-- Name: idx_profile_compliance_compliance_issues; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_profile_compliance_compliance_issues ON public.profile_compliance USING btree (compliance_issues);


--
-- Name: idx_profile_compliance_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_profile_compliance_group_id ON public.profile_compliance USING btree (group_id);


--
-- Name: idx_profile_compliance_purge_deadline; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_profile_compliance_purge_deadline ON public.profile_compliance USING btree (purge_deadline);


--
-- Name: idx_profile_compliance_purged; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_profile_compliance_purged ON public.profile_compliance USING btree (purged);


--
-- Name: idx_profile_compliance_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_profile_compliance_user_id ON public.profile_compliance USING btree (user_id);


--
-- Name: idx_promo_code_usage_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_code_usage_code ON public.promo_code_usage USING btree (code);


--
-- Name: idx_promo_code_usage_used_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_code_usage_used_at ON public.promo_code_usage USING btree (used_at);


--
-- Name: idx_promo_code_usage_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_code_usage_user_id ON public.promo_code_usage USING btree (user_id);


--
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (active);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);


--
-- Name: idx_promo_redemptions_promo; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_redemptions_promo ON public.promo_redemptions USING btree (promo_id);


--
-- Name: idx_promo_redemptions_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_redemptions_status ON public.promo_redemptions USING btree (status);


--
-- Name: idx_promo_redemptions_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promo_redemptions_user ON public.promo_redemptions USING btree (user_id);


--
-- Name: idx_promos_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promos_active ON public.promos USING btree (active, hidden);


--
-- Name: idx_promos_code; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promos_code ON public.promos USING btree (code);


--
-- Name: idx_promos_target; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promos_target ON public.promos USING btree (target_audience);


--
-- Name: idx_promos_valid_dates; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_promos_valid_dates ON public.promos USING btree (valid_from, valid_until);


--
-- Name: idx_queue_jobs_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_queue_jobs_created_at ON public.broadcast_queue_jobs USING btree (created_at DESC);


--
-- Name: idx_queue_jobs_next_retry; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_queue_jobs_next_retry ON public.broadcast_queue_jobs USING btree (next_retry_at);


--
-- Name: idx_queue_jobs_queue_name; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_queue_jobs_queue_name ON public.broadcast_queue_jobs USING btree (queue_name);


--
-- Name: idx_queue_jobs_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_queue_jobs_scheduled_at ON public.broadcast_queue_jobs USING btree (scheduled_at);


--
-- Name: idx_queue_jobs_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_queue_jobs_status ON public.broadcast_queue_jobs USING btree (status);


--
-- Name: idx_radio_history_artist; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_history_artist ON public.radio_history USING btree (artist);


--
-- Name: idx_radio_history_played_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_history_played_at ON public.radio_history USING btree (played_at);


--
-- Name: idx_radio_history_title; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_history_title ON public.radio_history USING btree (title);


--
-- Name: idx_radio_now_playing_fixed_started_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_now_playing_fixed_started_at ON public.radio_now_playing_fixed USING btree (started_at);


--
-- Name: idx_radio_now_playing_new_started_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_now_playing_new_started_at ON public.radio_now_playing_new USING btree (started_at);


--
-- Name: idx_radio_now_playing_started_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_now_playing_started_at ON public.radio_now_playing USING btree (started_at);


--
-- Name: idx_radio_queue_media_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_queue_media_id ON public.radio_queue USING btree (media_id);


--
-- Name: idx_radio_queue_position; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_queue_position ON public.radio_queue USING btree ("position");


--
-- Name: idx_radio_requests_requested_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_requests_requested_at ON public.radio_requests USING btree (requested_at);


--
-- Name: idx_radio_requests_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_requests_status ON public.radio_requests USING btree (status);


--
-- Name: idx_radio_requests_status_requested; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_requests_status_requested ON public.radio_requests USING btree (status, requested_at DESC);


--
-- Name: idx_radio_requests_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_requests_user_id ON public.radio_requests USING btree (user_id);


--
-- Name: idx_radio_schedule_day_of_week; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_schedule_day_of_week ON public.radio_schedule USING btree (day_of_week);


--
-- Name: idx_radio_schedule_day_time; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_schedule_day_time ON public.radio_schedule USING btree (day_of_week, time_slot);


--
-- Name: idx_radio_stations_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_stations_active ON public.radio_stations USING btree (active);


--
-- Name: idx_radio_stations_genre; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_radio_stations_genre ON public.radio_stations USING btree (genre);


--
-- Name: idx_recipients_broadcast_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recipients_broadcast_id ON public.broadcast_recipients USING btree (broadcast_id);


--
-- Name: idx_recipients_sent_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recipients_sent_at ON public.broadcast_recipients USING btree (sent_at DESC);


--
-- Name: idx_recipients_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recipients_status ON public.broadcast_recipients USING btree (status);


--
-- Name: idx_recipients_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recipients_user_id ON public.broadcast_recipients USING btree (user_id);


--
-- Name: idx_recurring_payments_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_payments_status ON public.recurring_payments USING btree (status);


--
-- Name: idx_recurring_payments_subscription_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_payments_subscription_id ON public.recurring_payments USING btree (subscription_id);


--
-- Name: idx_recurring_payments_transaction_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_payments_transaction_id ON public.recurring_payments USING btree (transaction_id);


--
-- Name: idx_recurring_payments_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_payments_user_id ON public.recurring_payments USING btree (user_id);


--
-- Name: idx_recurring_subscriptions_card_token; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_subscriptions_card_token ON public.recurring_subscriptions USING btree (card_token);


--
-- Name: idx_recurring_subscriptions_next_billing; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_subscriptions_next_billing ON public.recurring_subscriptions USING btree (next_billing_date) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_recurring_subscriptions_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_subscriptions_status ON public.recurring_subscriptions USING btree (status);


--
-- Name: idx_recurring_subscriptions_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_recurring_subscriptions_user_id ON public.recurring_subscriptions USING btree (user_id);


--
-- Name: idx_schedules_broadcast_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_schedules_broadcast_id ON public.broadcast_schedules USING btree (broadcast_id);


--
-- Name: idx_schedules_is_recurring; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_schedules_is_recurring ON public.broadcast_schedules USING btree (is_recurring);


--
-- Name: idx_schedules_next_execution; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_schedules_next_execution ON public.broadcast_schedules USING btree (next_execution_at);


--
-- Name: idx_schedules_scheduled_for; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_schedules_scheduled_for ON public.broadcast_schedules USING btree (scheduled_for);


--
-- Name: idx_schedules_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_schedules_status ON public.broadcast_schedules USING btree (status);


--
-- Name: idx_segment_membership_segment_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segment_membership_segment_id ON public.segment_membership USING btree (segment_id);


--
-- Name: idx_segment_membership_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segment_membership_user_id ON public.segment_membership USING btree (user_id);


--
-- Name: idx_segments_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segments_created_at ON public.user_segments USING btree (created_at DESC);


--
-- Name: idx_segments_created_by; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segments_created_by ON public.user_segments USING btree (created_by);


--
-- Name: idx_segments_is_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segments_is_active ON public.user_segments USING btree (is_active);


--
-- Name: idx_segments_segment_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_segments_segment_id ON public.user_segments USING btree (segment_id);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_status ON public.live_streams USING btree (status);


--
-- Name: idx_stream_banned_users_stream_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_banned_users_stream_id ON public.stream_banned_users USING btree (stream_id);


--
-- Name: idx_stream_banned_users_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_banned_users_user_id ON public.stream_banned_users USING btree (user_id);


--
-- Name: idx_stream_comments_deleted; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_comments_deleted ON public.stream_comments USING btree (is_deleted);


--
-- Name: idx_stream_comments_stream_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_comments_stream_id ON public.stream_comments USING btree (stream_id);


--
-- Name: idx_stream_comments_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_comments_timestamp ON public.stream_comments USING btree ("timestamp" DESC);


--
-- Name: idx_stream_comments_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_comments_user_id ON public.stream_comments USING btree (user_id);


--
-- Name: idx_stream_notifications_streamer_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_notifications_streamer_id ON public.stream_notifications USING btree (streamer_id);


--
-- Name: idx_stream_notifications_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_notifications_user_id ON public.stream_notifications USING btree (user_id);


--
-- Name: idx_stream_viewers_left_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_viewers_left_at ON public.stream_viewers USING btree (left_at);


--
-- Name: idx_stream_viewers_stream_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_viewers_stream_id ON public.stream_viewers USING btree (stream_id);


--
-- Name: idx_stream_viewers_viewer_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_stream_viewers_viewer_id ON public.stream_viewers USING btree (viewer_id);


--
-- Name: idx_subscribers_email; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_subscribers_email ON public.subscribers USING btree (email);


--
-- Name: idx_subscribers_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_subscribers_status ON public.subscribers USING btree (status);


--
-- Name: idx_subscribers_subscription_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_subscribers_subscription_id ON public.subscribers USING btree (subscription_id);


--
-- Name: idx_subscribers_telegram_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_subscribers_telegram_id ON public.subscribers USING btree (telegram_id);


--
-- Name: idx_support_topics_assigned_to; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_assigned_to ON public.support_topics USING btree (assigned_to);


--
-- Name: idx_support_topics_category; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_category ON public.support_topics USING btree (category);


--
-- Name: idx_support_topics_language; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_language ON public.support_topics USING btree (language);


--
-- Name: idx_support_topics_priority; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_priority ON public.support_topics USING btree (priority);


--
-- Name: idx_support_topics_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_status ON public.support_topics USING btree (status);


--
-- Name: idx_support_topics_thread_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_support_topics_thread_id ON public.support_topics USING btree (thread_id);


--
-- Name: idx_templates_created_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_templates_created_at ON public.broadcast_templates USING btree (created_at DESC);


--
-- Name: idx_templates_created_by; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_templates_created_by ON public.broadcast_templates USING btree (created_by);


--
-- Name: idx_templates_is_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_templates_is_active ON public.broadcast_templates USING btree (is_active);


--
-- Name: idx_topic_config_group; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_topic_config_group ON public.topic_configuration USING btree (group_id);


--
-- Name: idx_user_moderation_history_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_moderation_history_active ON public.user_moderation_history USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_user_moderation_history_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_moderation_history_user ON public.user_moderation_history USING btree (user_id);


--
-- Name: idx_user_notifications_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_notifications_active ON public.user_notifications USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_user_notifications_model; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_notifications_model ON public.user_notifications USING btree (model_id);


--
-- Name: idx_user_prefs_is_opted_out; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_prefs_is_opted_out ON public.user_broadcast_preferences USING btree (is_opted_out);


--
-- Name: idx_user_prefs_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_prefs_status ON public.user_broadcast_preferences USING btree (status);


--
-- Name: idx_user_prefs_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_prefs_user_id ON public.user_broadcast_preferences USING btree (user_id);


--
-- Name: idx_user_warnings_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_warnings_group_id ON public.user_warnings USING btree (group_id);


--
-- Name: idx_user_warnings_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_warnings_timestamp ON public.user_warnings USING btree ("timestamp");


--
-- Name: idx_user_warnings_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_warnings_user_id ON public.user_warnings USING btree (user_id);


--
-- Name: idx_username_history_changed_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_username_history_changed_at ON public.username_history USING btree (changed_at);


--
-- Name: idx_username_history_flagged; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_username_history_flagged ON public.username_history USING btree (flagged);


--
-- Name: idx_username_history_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_username_history_group_id ON public.username_history USING btree (group_id);


--
-- Name: idx_username_history_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_username_history_user_id ON public.username_history USING btree (user_id);


--
-- Name: idx_users_auto_renew; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_auto_renew ON public.users USING btree (auto_renew) WHERE (auto_renew = true);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_has_seen_tutorial; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_has_seen_tutorial ON public.users USING btree (has_seen_tutorial);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_last_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_last_active ON public.users USING btree (last_active);


--
-- Name: idx_users_location; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_location ON public.users USING btree (location_lat, location_lng) WHERE (location_lat IS NOT NULL);


--
-- Name: idx_users_location_sharing; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_location_sharing ON public.users USING btree (location_sharing_enabled) WHERE (location_sharing_enabled = true);


--
-- Name: idx_users_next_billing_date; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_next_billing_date ON public.users USING btree (next_billing_date) WHERE (next_billing_date IS NOT NULL);


--
-- Name: idx_users_plan_expiry; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_plan_expiry ON public.users USING btree (plan_expiry) WHERE (plan_expiry IS NOT NULL);


--
-- Name: idx_users_profile_views; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_profile_views ON public.users USING btree (profile_views DESC);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_subscription_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_subscription_status ON public.users USING btree (subscription_status);


--
-- Name: idx_users_subscription_type; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_subscription_type ON public.users USING btree (subscription_type) WHERE ((subscription_type)::text = 'recurring'::text);


--
-- Name: idx_users_tier; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_tier ON public.users USING btree (tier);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_users_xp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_users_xp ON public.users USING btree (xp DESC);


--
-- Name: idx_violations_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_violations_timestamp ON public.topic_violations USING btree ("timestamp");


--
-- Name: idx_violations_user_topic; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_violations_user_topic ON public.topic_violations USING btree (user_id, topic_id);


--
-- Name: idx_wall_of_fame_posts_date; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_wall_of_fame_posts_date ON public.wall_of_fame_posts USING btree (date_key);


--
-- Name: idx_wall_of_fame_posts_group; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_wall_of_fame_posts_group ON public.wall_of_fame_posts USING btree (group_id);


--
-- Name: idx_wall_of_fame_stats_reactions; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_wall_of_fame_stats_reactions ON public.wall_of_fame_daily_stats USING btree (reactions_received);


--
-- Name: idx_warnings_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_warnings_active ON public.warnings USING btree (cleared);


--
-- Name: idx_warnings_group_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_warnings_group_id ON public.warnings USING btree (group_id);


--
-- Name: idx_warnings_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_warnings_user_id ON public.warnings USING btree (user_id);


--
-- Name: idx_x_accounts_active; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_accounts_active ON public.x_accounts USING btree (is_active);


--
-- Name: idx_x_accounts_handle; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE UNIQUE INDEX idx_x_accounts_handle ON public.x_accounts USING btree (handle);


--
-- Name: idx_x_accounts_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE UNIQUE INDEX idx_x_accounts_user_id ON public.x_accounts USING btree (x_user_id);


--
-- Name: idx_x_oauth_states_expires_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_oauth_states_expires_at ON public.x_oauth_states USING btree (expires_at);


--
-- Name: idx_x_post_jobs_account_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_post_jobs_account_id ON public.x_post_jobs USING btree (account_id);


--
-- Name: idx_x_post_jobs_scheduled_at; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_post_jobs_scheduled_at ON public.x_post_jobs USING btree (scheduled_at);


--
-- Name: idx_x_post_jobs_status; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_post_jobs_status ON public.x_post_jobs USING btree (status);


--
-- Name: idx_x_post_jobs_status_retry; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_x_post_jobs_status_retry ON public.x_post_jobs USING btree (status, retry_count);


--
-- Name: jitsi_room_statistics _RETURN; Type: RULE; Schema: public; Owner: pnptvbot
--

CREATE OR REPLACE VIEW public.jitsi_room_statistics AS
 SELECT r.id AS room_id,
    r.room_code,
    r.tier,
    r.title,
    r.host_user_id,
    r.status,
    r.current_participants,
    r.total_participants,
    r.peak_participants,
    r.total_duration,
    count(p.id) AS session_count,
    avg(p.duration) AS avg_session_duration
   FROM (public.jitsi_rooms r
     LEFT JOIN public.jitsi_participants p ON ((r.id = p.room_id)))
  GROUP BY r.id;


--
-- Name: live_streams live_streams_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER live_streams_updated_at BEFORE UPDATE ON public.live_streams FOR EACH ROW EXECUTE FUNCTION public.update_live_streams_updated_at();


--
-- Name: radio_now_playing radio_now_playing_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER radio_now_playing_updated_at BEFORE UPDATE ON public.radio_now_playing FOR EACH ROW EXECUTE FUNCTION public.update_radio_updated_at();


--
-- Name: radio_requests radio_requests_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER radio_requests_updated_at BEFORE UPDATE ON public.radio_requests FOR EACH ROW EXECUTE FUNCTION public.update_radio_updated_at();


--
-- Name: radio_schedule radio_schedule_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER radio_schedule_updated_at BEFORE UPDATE ON public.radio_schedule FOR EACH ROW EXECUTE FUNCTION public.update_radio_updated_at();


--
-- Name: booking_payments trigger_booking_payments_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_booking_payments_updated_at BEFORE UPDATE ON public.booking_payments FOR EACH ROW EXECUTE FUNCTION public.update_booking_payments_updated_at();


--
-- Name: pnp_bookings trigger_booking_updates_activity; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_booking_updates_activity AFTER INSERT OR UPDATE ON public.pnp_bookings FOR EACH ROW EXECUTE FUNCTION public.update_model_activity();


--
-- Name: bookings trigger_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_bookings_updated_at();


--
-- Name: broadcast_media trigger_broadcast_media_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_broadcast_media_updated_at BEFORE UPDATE ON public.broadcast_media FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: broadcast_schedules trigger_broadcast_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_broadcast_schedules_updated_at BEFORE UPDATE ON public.broadcast_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: broadcast_templates trigger_broadcast_templates_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_broadcast_templates_updated_at BEFORE UPDATE ON public.broadcast_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: broadcasts trigger_broadcasts_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: media_library trigger_media_library_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_media_library_updated_at BEFORE UPDATE ON public.media_library FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: media_playlists trigger_media_playlists_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_media_playlists_updated_at BEFORE UPDATE ON public.media_playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: media_ratings trigger_media_ratings_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_media_ratings_updated_at BEFORE UPDATE ON public.media_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: performers trigger_performers_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_performers_updated_at BEFORE UPDATE ON public.performers FOR EACH ROW EXECUTE FUNCTION public.update_performers_updated_at();


--
-- Name: player_states trigger_player_states_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_player_states_updated_at BEFORE UPDATE ON public.player_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promos trigger_promos_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_promos_updated_at BEFORE UPDATE ON public.promos FOR EACH ROW EXECUTE FUNCTION public.update_promos_updated_at();


--
-- Name: user_segments trigger_segments_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_segments_updated_at BEFORE UPDATE ON public.user_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pnp_bookings trigger_update_booking_timestamp; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_booking_timestamp BEFORE UPDATE ON public.pnp_bookings FOR EACH ROW EXECUTE FUNCTION public.update_booking_timestamp();


--
-- Name: pnp_tips trigger_update_model_earnings_tip; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_model_earnings_tip AFTER UPDATE ON public.pnp_tips FOR EACH ROW EXECUTE FUNCTION public.update_model_earnings_on_tip();


--
-- Name: pnp_models trigger_update_model_online; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_model_online BEFORE UPDATE ON public.pnp_models FOR EACH ROW EXECUTE FUNCTION public.update_model_online_status();


--
-- Name: pnp_feedback trigger_update_model_rating; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_model_rating AFTER INSERT OR UPDATE ON public.pnp_feedback FOR EACH ROW EXECUTE FUNCTION public.update_model_rating_on_feedback();


--
-- Name: pnp_bookings trigger_update_model_stats; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_model_stats AFTER UPDATE ON public.pnp_bookings FOR EACH ROW EXECUTE FUNCTION public.update_model_stats_on_booking();


--
-- Name: nearby_places trigger_update_nearby_places_timestamp; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_nearby_places_timestamp BEFORE UPDATE ON public.nearby_places FOR EACH ROW EXECUTE FUNCTION public.update_nearby_places_timestamp();


--
-- Name: nearby_place_categories trigger_update_place_categories_timestamp; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_place_categories_timestamp BEFORE UPDATE ON public.nearby_place_categories FOR EACH ROW EXECUTE FUNCTION public.update_nearby_places_timestamp();


--
-- Name: nearby_place_submissions trigger_update_place_submissions_timestamp; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_place_submissions_timestamp BEFORE UPDATE ON public.nearby_place_submissions FOR EACH ROW EXECUTE FUNCTION public.update_nearby_places_timestamp();


--
-- Name: pnp_live_promo_usage trigger_update_promo_usage; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_update_promo_usage AFTER INSERT ON public.pnp_live_promo_usage FOR EACH ROW EXECUTE FUNCTION public.update_promo_usage_count();


--
-- Name: user_broadcast_preferences trigger_user_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER trigger_user_prefs_updated_at BEFORE UPDATE ON public.user_broadcast_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calls update_calls_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_emotes update_custom_emotes_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_custom_emotes_updated_at BEFORE UPDATE ON public.custom_emotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: emotes update_emotes_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_emotes_updated_at BEFORE UPDATE ON public.emotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: group_settings update_group_settings_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_group_settings_updated_at BEFORE UPDATE ON public.group_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: jitsi_rooms update_jitsi_room_timestamp; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_jitsi_room_timestamp BEFORE UPDATE ON public.jitsi_rooms FOR EACH ROW EXECUTE FUNCTION public.update_jitsi_room_timestamp();


--
-- Name: live_streams update_live_streams_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_live_streams_updated_at BEFORE UPDATE ON public.live_streams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profile_compliance update_profile_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_profile_compliance_updated_at BEFORE UPDATE ON public.profile_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promo_codes update_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: radio_now_playing_fixed update_radio_now_playing_fixed_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_now_playing_fixed_updated_at BEFORE UPDATE ON public.radio_now_playing_fixed FOR EACH ROW EXECUTE FUNCTION public.update_radio_now_playing_fixed_updated_at();


--
-- Name: radio_now_playing update_radio_now_playing_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_now_playing_updated_at BEFORE UPDATE ON public.radio_now_playing FOR EACH ROW EXECUTE FUNCTION public.update_radio_now_playing_updated_at();


--
-- Name: radio_now_playing_new update_radio_now_playing_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_now_playing_updated_at BEFORE UPDATE ON public.radio_now_playing_new FOR EACH ROW EXECUTE FUNCTION public.update_radio_now_playing_updated_at();


--
-- Name: radio_requests update_radio_requests_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_requests_updated_at BEFORE UPDATE ON public.radio_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: radio_schedule update_radio_schedule_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_schedule_updated_at BEFORE UPDATE ON public.radio_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: radio_stations update_radio_stations_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_radio_stations_updated_at BEFORE UPDATE ON public.radio_stations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscribers update_subscribers_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON public.subscribers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_moderation_history user_moderation_history_updated_at; Type: TRIGGER; Schema: public; Owner: pnptvbot
--

CREATE TRIGGER user_moderation_history_updated_at BEFORE UPDATE ON public.user_moderation_history FOR EACH ROW EXECUTE FUNCTION public.update_stream_violations_updated_at();


--
-- Name: banned_users banned_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.banned_users
    ADD CONSTRAINT banned_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: booking_notifications booking_notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_notifications booking_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: booking_payments booking_payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_payments
    ADD CONSTRAINT booking_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_performer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_performer_id_fkey FOREIGN KEY (performer_id) REFERENCES public.performers(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_performer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_performer_id_fkey FOREIGN KEY (performer_id) REFERENCES public.performers(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.booking_slots(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bot_addition_attempts bot_addition_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.bot_addition_attempts
    ADD CONSTRAINT bot_addition_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: broadcast_media broadcast_media_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_media
    ADD CONSTRAINT broadcast_media_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(broadcast_id) ON DELETE SET NULL;


--
-- Name: broadcast_recipients broadcast_recipients_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(broadcast_id) ON DELETE CASCADE;


--
-- Name: broadcast_recipients broadcast_recipients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_recipients
    ADD CONSTRAINT broadcast_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: broadcast_schedules broadcast_schedules_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_schedules
    ADD CONSTRAINT broadcast_schedules_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(broadcast_id) ON DELETE CASCADE;


--
-- Name: broadcast_templates broadcast_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcast_templates
    ADD CONSTRAINT broadcast_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: broadcasts broadcasts_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: call_sessions call_sessions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: calls calls_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calls calls_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: card_tokens card_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.card_tokens
    ADD CONSTRAINT card_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: community_post_analytics community_post_analytics_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_analytics
    ADD CONSTRAINT community_post_analytics_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.community_groups(group_id) ON DELETE SET NULL;


--
-- Name: community_post_analytics community_post_analytics_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_analytics
    ADD CONSTRAINT community_post_analytics_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(post_id) ON DELETE CASCADE;


--
-- Name: community_post_buttons community_post_buttons_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_buttons
    ADD CONSTRAINT community_post_buttons_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(post_id) ON DELETE CASCADE;


--
-- Name: community_post_deliveries community_post_deliveries_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries
    ADD CONSTRAINT community_post_deliveries_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.community_groups(group_id) ON DELETE CASCADE;


--
-- Name: community_post_deliveries community_post_deliveries_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries
    ADD CONSTRAINT community_post_deliveries_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(post_id) ON DELETE CASCADE;


--
-- Name: community_post_deliveries community_post_deliveries_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_deliveries
    ADD CONSTRAINT community_post_deliveries_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.community_post_schedules(schedule_id) ON DELETE SET NULL;


--
-- Name: community_post_schedules community_post_schedules_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_schedules
    ADD CONSTRAINT community_post_schedules_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(post_id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cult_event_registrations cult_event_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.cult_event_registrations
    ADD CONSTRAINT cult_event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: custom_emotes custom_emotes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.custom_emotes
    ADD CONSTRAINT custom_emotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: emote_usage emote_usage_emote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.emote_usage
    ADD CONSTRAINT emote_usage_emote_id_fkey FOREIGN KEY (emote_id) REFERENCES public.custom_emotes(id) ON DELETE CASCADE;


--
-- Name: emote_usage emote_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.emote_usage
    ADD CONSTRAINT emote_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: age_verification_attempts fk_user_verification; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.age_verification_attempts
    ADD CONSTRAINT fk_user_verification FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: forwarded_violations forwarded_violations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.forwarded_violations
    ADD CONSTRAINT forwarded_violations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: jitsi_participants jitsi_participants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.jitsi_participants
    ADD CONSTRAINT jitsi_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.jitsi_rooms(id) ON DELETE CASCADE;


--
-- Name: live_streams live_streams_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_favorites media_favorites_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_favorites
    ADD CONSTRAINT media_favorites_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: media_favorites media_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_favorites
    ADD CONSTRAINT media_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_library media_library_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media_play_history media_play_history_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_play_history
    ADD CONSTRAINT media_play_history_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: media_play_history media_play_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_play_history
    ADD CONSTRAINT media_play_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_playlists media_playlists_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_playlists
    ADD CONSTRAINT media_playlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_ratings media_ratings_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_ratings
    ADD CONSTRAINT media_ratings_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: media_ratings media_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.media_ratings
    ADD CONSTRAINT media_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: meet_greet_bookings meet_greet_bookings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_bookings
    ADD CONSTRAINT meet_greet_bookings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: meet_greet_payments meet_greet_payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.meet_greet_payments
    ADD CONSTRAINT meet_greet_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.meet_greet_bookings(id) ON DELETE CASCADE;


--
-- Name: model_availability model_availability_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_availability
    ADD CONSTRAINT model_availability_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id) ON DELETE CASCADE;


--
-- Name: model_bookings model_bookings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_bookings
    ADD CONSTRAINT model_bookings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id);


--
-- Name: model_earnings model_earnings_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_earnings
    ADD CONSTRAINT model_earnings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.model_bookings(id);


--
-- Name: model_earnings model_earnings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_earnings
    ADD CONSTRAINT model_earnings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id);


--
-- Name: model_photos model_photos_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_photos
    ADD CONSTRAINT model_photos_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id) ON DELETE CASCADE;


--
-- Name: model_reviews model_reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_reviews
    ADD CONSTRAINT model_reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.model_bookings(id);


--
-- Name: model_reviews model_reviews_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.model_reviews
    ADD CONSTRAINT model_reviews_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id);


--
-- Name: nearby_place_categories nearby_place_categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_categories
    ADD CONSTRAINT nearby_place_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.nearby_place_categories(id);


--
-- Name: nearby_place_favorites nearby_place_favorites_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_favorites
    ADD CONSTRAINT nearby_place_favorites_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.nearby_places(id) ON DELETE CASCADE;


--
-- Name: nearby_place_reports nearby_place_reports_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reports
    ADD CONSTRAINT nearby_place_reports_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.nearby_places(id) ON DELETE CASCADE;


--
-- Name: nearby_place_reviews nearby_place_reviews_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_reviews
    ADD CONSTRAINT nearby_place_reviews_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.nearby_places(id) ON DELETE CASCADE;


--
-- Name: nearby_place_submissions nearby_place_submissions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_submissions
    ADD CONSTRAINT nearby_place_submissions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.nearby_place_categories(id);


--
-- Name: nearby_place_submissions nearby_place_submissions_created_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_place_submissions
    ADD CONSTRAINT nearby_place_submissions_created_place_id_fkey FOREIGN KEY (created_place_id) REFERENCES public.nearby_places(id);


--
-- Name: nearby_places nearby_places_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.nearby_places
    ADD CONSTRAINT nearby_places_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.nearby_place_categories(id);


--
-- Name: payments payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: performer_availability performer_availability_performer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.performer_availability
    ADD CONSTRAINT performer_availability_performer_id_fkey FOREIGN KEY (performer_id) REFERENCES public.performers(id) ON DELETE CASCADE;


--
-- Name: performers performers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.performers
    ADD CONSTRAINT performers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: player_states player_states_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.player_states
    ADD CONSTRAINT player_states_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE SET NULL;


--
-- Name: player_states player_states_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.player_states
    ADD CONSTRAINT player_states_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.media_playlists(id) ON DELETE SET NULL;


--
-- Name: player_states player_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.player_states
    ADD CONSTRAINT player_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: playlist_items playlist_items_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: playlist_items playlist_items_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.media_playlists(id) ON DELETE CASCADE;


--
-- Name: pnp_bookings pnp_bookings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_bookings
    ADD CONSTRAINT pnp_bookings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id);


--
-- Name: pnp_feedback pnp_feedback_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_feedback
    ADD CONSTRAINT pnp_feedback_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_live_promo_usage pnp_live_promo_usage_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_usage
    ADD CONSTRAINT pnp_live_promo_usage_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_live_promo_usage pnp_live_promo_usage_promo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_live_promo_usage
    ADD CONSTRAINT pnp_live_promo_usage_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES public.pnp_live_promo_codes(id) ON DELETE CASCADE;


--
-- Name: pnp_model_blocked_dates pnp_model_blocked_dates_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_blocked_dates
    ADD CONSTRAINT pnp_model_blocked_dates_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: pnp_model_earnings pnp_model_earnings_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_earnings
    ADD CONSTRAINT pnp_model_earnings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_model_earnings pnp_model_earnings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_earnings
    ADD CONSTRAINT pnp_model_earnings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: pnp_model_earnings pnp_model_earnings_tip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_earnings
    ADD CONSTRAINT pnp_model_earnings_tip_id_fkey FOREIGN KEY (tip_id) REFERENCES public.pnp_tips(id) ON DELETE CASCADE;


--
-- Name: pnp_model_payouts pnp_model_payouts_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_payouts
    ADD CONSTRAINT pnp_model_payouts_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: pnp_model_schedules pnp_model_schedules_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_schedules
    ADD CONSTRAINT pnp_model_schedules_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: pnp_model_status_history pnp_model_status_history_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_model_status_history
    ADD CONSTRAINT pnp_model_status_history_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: pnp_payments pnp_payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_payments
    ADD CONSTRAINT pnp_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_refunds pnp_refunds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_refunds
    ADD CONSTRAINT pnp_refunds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_tips pnp_tips_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_tips
    ADD CONSTRAINT pnp_tips_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.pnp_bookings(id) ON DELETE CASCADE;


--
-- Name: pnp_tips pnp_tips_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.pnp_tips
    ADD CONSTRAINT pnp_tips_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: profile_compliance profile_compliance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.profile_compliance
    ADD CONSTRAINT profile_compliance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: promo_redemptions promo_redemptions_promo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES public.promos(id) ON DELETE RESTRICT;


--
-- Name: radio_queue radio_queue_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.radio_queue
    ADD CONSTRAINT radio_queue_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: recurring_payments recurring_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_payments
    ADD CONSTRAINT recurring_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.recurring_subscriptions(id) ON DELETE CASCADE;


--
-- Name: recurring_payments recurring_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_payments
    ADD CONSTRAINT recurring_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recurring_subscriptions recurring_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_subscriptions
    ADD CONSTRAINT recurring_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: recurring_subscriptions recurring_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.recurring_subscriptions
    ADD CONSTRAINT recurring_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: segment_membership segment_membership_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.user_segments(segment_id) ON DELETE CASCADE;


--
-- Name: segment_membership segment_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_banned_users stream_banned_users_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_banned_users
    ADD CONSTRAINT stream_banned_users_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stream_banned_users stream_banned_users_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_banned_users
    ADD CONSTRAINT stream_banned_users_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(id) ON DELETE CASCADE;


--
-- Name: stream_banned_users stream_banned_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_banned_users
    ADD CONSTRAINT stream_banned_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_comments stream_comments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_comments
    ADD CONSTRAINT stream_comments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stream_comments stream_comments_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_comments
    ADD CONSTRAINT stream_comments_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(id) ON DELETE CASCADE;


--
-- Name: stream_comments stream_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_comments
    ADD CONSTRAINT stream_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_notifications stream_notifications_streamer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_notifications stream_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_viewers stream_viewers_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.stream_viewers
    ADD CONSTRAINT stream_viewers_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(id) ON DELETE CASCADE;


--
-- Name: user_broadcast_preferences user_broadcast_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_moderation_actions user_moderation_actions_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_moderation_actions
    ADD CONSTRAINT user_moderation_actions_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.users(id);


--
-- Name: user_moderation_actions user_moderation_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_moderation_actions
    ADD CONSTRAINT user_moderation_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.pnp_models(id) ON DELETE CASCADE;


--
-- Name: user_segments user_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_warnings user_warnings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_warnings
    ADD CONSTRAINT user_warnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: username_history username_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.username_history
    ADD CONSTRAINT username_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wall_of_fame_daily_stats wall_of_fame_daily_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_stats
    ADD CONSTRAINT wall_of_fame_daily_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wall_of_fame_daily_winners wall_of_fame_daily_winners_active_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_winners
    ADD CONSTRAINT wall_of_fame_daily_winners_active_user_id_fkey FOREIGN KEY (active_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wall_of_fame_daily_winners wall_of_fame_daily_winners_legend_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_winners
    ADD CONSTRAINT wall_of_fame_daily_winners_legend_user_id_fkey FOREIGN KEY (legend_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wall_of_fame_daily_winners wall_of_fame_daily_winners_new_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_daily_winners
    ADD CONSTRAINT wall_of_fame_daily_winners_new_member_user_id_fkey FOREIGN KEY (new_member_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wall_of_fame_posts wall_of_fame_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.wall_of_fame_posts
    ADD CONSTRAINT wall_of_fame_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: warnings warnings_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.warnings
    ADD CONSTRAINT warnings_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: warnings warnings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.warnings
    ADD CONSTRAINT warnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: x_post_jobs x_post_jobs_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.x_post_jobs
    ADD CONSTRAINT x_post_jobs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.x_accounts(account_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict GMMLOc5jCoAHriXJPUnvShgA6coTUBLMSIqzjfmhHlqK3qB4u4OayU0J1BEp5l8

