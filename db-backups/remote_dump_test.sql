pg_dump: last built-in OID is 16383
pg_dump: reading extensions
pg_dump: identifying extension members
pg_dump: reading schemas
pg_dump: reading user-defined tables
pg_dump: reading user-defined functions
pg_dump: reading user-defined types
pg_dump: reading procedural languages
pg_dump: reading user-defined aggregate functions
pg_dump: reading user-defined operators
pg_dump: reading user-defined access methods
pg_dump: reading user-defined operator classes
pg_dump: reading user-defined operator families
pg_dump: reading user-defined text search parsers
pg_dump: reading user-defined text search templates
pg_dump: reading user-defined text search dictionaries
pg_dump: reading user-defined text search configurations
pg_dump: reading user-defined foreign-data wrappers
pg_dump: reading user-defined foreign servers
pg_dump: reading default privileges
pg_dump: reading user-defined collations
pg_dump: reading user-defined conversions
pg_dump: reading type casts
pg_dump: reading transforms
pg_dump: reading table inheritance information
pg_dump: reading event triggers
pg_dump: finding extension tables
pg_dump: finding inheritance relationships
pg_dump: reading column info for interesting tables
pg_dump: finding table default expressions
pg_dump: finding table check constraints
pg_dump: flagging inherited columns in subtables
pg_dump: reading partitioning data
pg_dump: reading indexes
pg_dump: flagging indexes in partitioned tables
pg_dump: reading extended statistics
pg_dump: reading constraints
pg_dump: reading triggers
pg_dump: reading rewrite rules
pg_dump: reading policies
pg_dump: reading row-level security policies
pg_dump: reading publications
pg_dump: reading publication membership of tables
pg_dump: reading publication membership of schemas
pg_dump: reading subscriptions
pg_dump: reading subscription membership of tables
pg_dump: reading large objects
pg_dump: reading dependency data
pg_dump: saving encoding = UTF8
pg_dump: saving "standard_conforming_strings = on"
pg_dump: saving "search_path = "
pg_dump: creating SCHEMA "public"
pg_dump: creating COMMENT "SCHEMA public"
pg_dump: creating EXTENSION "uuid-ossp"
pg_dump: creating COMMENT "EXTENSION "uuid-ossp""
pg_dump: creating TYPE "public.jitsi_room_status"
pg_dump: creating TYPE "public.jitsi_room_tier"
pg_dump: creating FUNCTION "public.increment_track_play_count()"
pg_dump: creating FUNCTION "public.is_subscription_active(bigint)"
pg_dump: creating COMMENT "public.FUNCTION is_subscription_active(p_user_id bigint)"
pg_dump: creating FUNCTION "public.update_call_participant_count()"
pg_dump: creating FUNCTION "public.update_jitsi_room_timestamp()"
--
-- PostgreSQL database dump
--

\restrict 0Xdxe7P5VGd3QAi7FRDBpo2F97NvgaTVsUsaIeRk1dexxid66ow4BLQRmrf2w2K

-- Dumped from database version 17.7 (Ubuntu 17.7-0ubuntu0.25.10.1)
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.10.1)

-- Started on 2026-01-05 11:50:45 UTC

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
-- TOC entry 6 (class 2615 OID 24960)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- TOC entry 5077 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 2 (class 3079 OID 24961)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5078 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 1175 (class 1247 OID 26522)
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
-- TOC entry 1172 (class 1247 OID 26515)
-- Name: jitsi_room_tier; Type: TYPE; Schema: public; Owner: pnptvbot
--

CREATE TYPE public.jitsi_room_tier AS ENUM (
    'mini',
    'medium',
    'unlimited'
);


ALTER TYPE public.jitsi_room_tier OWNER TO pnptvbot;

--
-- TOC entry 351 (class 1255 OID 68291)
-- Name: increment_track_play_count(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.increment_track_play_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE radio_tracks
  SET play_count = play_count + 1,
      updated_at = NOW()
  WHERE id = NEW.track_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.increment_track_play_count() OWNER TO pnptvbot;

--
-- TOC entry 347 (class 1255 OID 26699)
-- Name: is_subscription_active(bigint); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.is_subscription_active(p_user_id bigint) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  subscription_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM subscriptions 
    WHERE user_id = p_user_id 
    AND status = 'active' 
    AND expires_at > NOW()
  ) INTO subscription_exists;
  
  RETURN subscription_exists;
END;
$$;


ALTER FUNCTION public.is_subscription_active(p_user_id bigint) OWNER TO pnptvbot;

--
-- TOC entry 5079 (class 0 OID 0)
-- Dependencies: 347
-- Name: FUNCTION is_subscription_active(p_user_id bigint); Type: COMMENT; Schema: public; Owner: pnptvbot
--

COMMENT ON FUNCTION public.is_subscription_active(p_user_id bigint) IS 'Verifica si un usuario tiene suscripción activa';


--
-- TOC entry 350 (class 1255 OID 68289)
-- Name: update_call_participant_count(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_call_participant_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE video_calls
    SET current_participants = current_participants + 1
    WHERE id = NEW.call_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    UPDATE video_calls
    SET current_participants = GREATEST(0, current_participants - 1)
    WHERE id = NEW.call_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_call_participant_count() OWNER TO pnptvbot;

--
-- TOC entry 345 (class 1255 OID 26618)
-- Name: update_jitsi_room_timestamp(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNpg_dump: creating FUNCTION "public.update_live_streams_updated_at()"
pg_dump: creating FUNCTION "public.update_private_calls_updated_at()"
pg_dump: creating FUNCTION "public.update_room_participant_count()"
pg_dump: creating FUNCTION "public.update_subscriptions_updated_at()"
pg_dump: creating FUNCTION "public.update_updated_at_column()"
pg_dump: creating TABLE "public.activation_codes"
pg_dump: creating TABLE "public.activation_logs"
pg_dump: creating TABLE "public.jitsi_rooms"
CTION public.update_jitsi_room_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_jitsi_room_timestamp() OWNER TO pnptvbot;

--
-- TOC entry 346 (class 1255 OID 26675)
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
-- TOC entry 344 (class 1255 OID 25561)
-- Name: update_private_calls_updated_at(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_private_calls_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_private_calls_updated_at() OWNER TO pnptvbot;

--
-- TOC entry 349 (class 1255 OID 68287)
-- Name: update_room_participant_count(); Type: FUNCTION; Schema: public; Owner: pnptvbot
--

CREATE FUNCTION public.update_room_participant_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE main_rooms
    SET current_participants = current_participants + 1,
        updated_at = NOW()
    WHERE id = NEW.room_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    UPDATE main_rooms
    SET current_participants = GREATEST(0, current_participants - 1),
        updated_at = NOW()
    WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_room_participant_count() OWNER TO pnptvbot;

--
-- TOC entry 348 (class 1255 OID 26734)
-- Name: update_subscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_subscriptions_updated_at() OWNER TO postgres;

--
-- TOC entry 343 (class 1255 OID 25218)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 244 (class 1259 OID 25467)
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
-- TOC entry 245 (class 1259 OID 25477)
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
-- TOC entry 291 (class 1259 OID 26531)
-- Name: jitsi_rooms; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.jitsi_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_code character varying(20) NOT NULL,
    room_name character varying(255) NOT NULL,
    host_user_id character varying(100) NOT NULL,
    host_name cpg_dump: creating VIEW "public.active_jitsi_rooms"
pg_dump: creating VIEW "public.active_zoom_rooms"
haracter varying(255),
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
-- TOC entry 295 (class 1259 OID 26608)
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
-- TOC entry 278 (class 1259 OID 26320)
-- Name: active_zoom_rooms; Type: VIEW; Schema: public; Owner: pnptvbot
--

CREATE VIEW public.active_zoom_rooms AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(10) AS room_code,
    NULL::character varying(255) AS zoom_meeting_id,
    NULL::character varying(255) AS zoom_meeting_password,
    NULL::character varying(255) AS host_user_id,
    NULL::character varying(255) AS host_email,
    NULL::character varying(255) AS host_name,
    NULL::character varying(500) AS host_auth_token,
    NULL::text AS host_join_url,
    NULL::character varying(255) AS title,
    NULL::text AS description,
    NULL::character varying(500) AS topic,
    NULL::timestamp without time zone AS scheduled_start_time,
    NULL::integer AS scheduled_duration,
    NULL::timestamp without time zone AS actual_start_time,
    NULL::timestamp without time zone AS actual_end_time,
    NULL::jsonb AS settings,
    NULL::boolean AS is_public,
    NULL::boolean AS requires_password,
    NULL::text[] AS allowed_domains,
    NULL::character varying(50) AS status,
    NULL::boolean AS is_active,
    NULL::integer AS total_participants,
    NULL::integer AS peak_participants,
    NULL::integer AS total_duration,
    NULL::boolean AS recording_enabled,
    NULL::character varying(50) AS recording_status,
    NULL::text AS recording_url,
    NULL::bigint AS recording_file_size,
    NULL::character varying(255) AS telegram_group_id,
    NULL::text[] AS shared_in_groups,
    NULL::timestamp without time zone AS created_pg_dump: creating TABLE "public.agora_channels"
pg_dump: creating TABLE "public.badges"
pg_dump: creating SEQUENCE "public.badges_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.badges_id_seq"
pg_dump: creating TABLE "public.banned_users"
pg_dump: creating TABLE "public.broadcast_queue_jobs"
pg_dump: creating SEQUENCE "public.broadcast_queue_jobs_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.broadcast_queue_jobs_id_seq"
pg_dump: creating TABLE "public.broadcasts"
at,
    NULL::timestamp without time zone AS updated_at,
    NULL::timestamp without time zone AS deleted_at,
    NULL::bigint AS current_participants,
    NULL::bigint AS total_participants_ever;


ALTER VIEW public.active_zoom_rooms OWNER TO pnptvbot;

--
-- TOC entry 330 (class 1259 OID 68258)
-- Name: agora_channels; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.agora_channels (
    channel_name text NOT NULL,
    channel_type text NOT NULL,
    feature_name text NOT NULL,
    is_active boolean DEFAULT true,
    created_by text,
    max_participants integer,
    current_participants integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone,
    last_activity_at timestamp without time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.agora_channels OWNER TO pnptvbot;

--
-- TOC entry 301 (class 1259 OID 26904)
-- Name: badges; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.badges (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(50) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#FFD700'::character varying,
    is_active boolean DEFAULT true,
    created_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.badges OWNER TO pnptvbot;

--
-- TOC entry 300 (class 1259 OID 26903)
-- Name: badges_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.badges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.badges_id_seq OWNER TO pnptvbot;

--
-- TOC entry 5080 (class 0 OID 0)
-- Dependencies: 300
-- Name: badges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.badges_id_seq OWNED BY public.badges.id;


--
-- TOC entry 238 (class 1259 OID 25361)
-- Name: banned_users; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.banned_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    banned_by character varying(255) NOT NULL,
    reason text,
    banned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.banned_users OWNER TO pnptvbot;

--
-- TOC entry 332 (class 1259 OID 68325)
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
-- TOC entry 331 (class 1259 OID 68324)
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
-- TOC entry 5081 (class 0 OID 0)
-- Dependencies: 331
-- Name: broadcast_queue_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.broadcast_queue_jobs_id_seq OWNED BY public.broadcast_queue_jobs.id;


--
-- TOC entry 304 (class 1259 OID 59542)
-- Name: broadcasts;pg_dump: creating TABLE "public.call_availability"
pg_dump: creating SEQUENCE "public.call_availability_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.call_availability_id_seq"
pg_dump: creating TABLE "public.call_feedback"
pg_dump: creating TABLE "public.call_packages"
pg_dump: creating TABLE "public.call_packages_catalog"
pg_dump: creating TABLE "public.call_participants"
 Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.broadcasts (
    broadcast_id uuid NOT NULL,
    admin_id bigint NOT NULL,
    admin_username character varying(255),
    title character varying(255) NOT NULL,
    message_en text,
    message_es text,
    target_type character varying(50) DEFAULT 'all'::character varying,
    media_type character varying(50),
    media_url text,
    media_file_id character varying(255),
    s3_key character varying(500),
    s3_bucket character varying(255),
    scheduled_at timestamp without time zone,
    timezone character varying(50),
    include_filters text,
    exclude_user_ids text,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcasts OWNER TO pnptvbot;

--
-- TOC entry 249 (class 1259 OID 25541)
-- Name: call_availability; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.call_availability (
    id integer NOT NULL,
    admin_id character varying(255) NOT NULL,
    available boolean DEFAULT false,
    message text,
    valid_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.call_availability OWNER TO pnptvbot;

--
-- TOC entry 248 (class 1259 OID 25540)
-- Name: call_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.call_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.call_availability_id_seq OWNER TO pnptvbot;

--
-- TOC entry 5082 (class 0 OID 0)
-- Dependencies: 248
-- Name: call_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.call_availability_id_seq OWNED BY public.call_availability.id;


--
-- TOC entry 246 (class 1259 OID 25493)
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
-- TOC entry 222 (class 1259 OID 25084)
-- Name: call_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    package_type character varying(50) NOT NULL,
    total_minutes integer NOT NULL,
    used_minutes integer DEFAULT 0,
    remaining_minutes integer NOT NULL,
    purchased_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.call_packages OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 25913)
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
-- TOC entry 313 (class 1259 OID 68052)
-- Name: call_participants; Type: TABLE; Schema: public; Ownepg_dump: creating SEQUENCE "public.call_participants_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.call_participants_id_seq"
pg_dump: creating TABLE "public.calls"
pg_dump: creating TABLE "public.confirmation_tokens"
pg_dump: creating SEQUENCE "public.confirmation_tokens_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.confirmation_tokens_id_seq"
pg_dump: creating TABLE "public.custom_emotes"
r: pnptvbot
--

CREATE TABLE public.call_participants (
    id integer NOT NULL,
    call_id uuid,
    user_id text NOT NULL,
    user_name text NOT NULL,
    is_guest boolean DEFAULT false,
    is_host boolean DEFAULT false,
    joined_at timestamp without time zone DEFAULT now(),
    left_at timestamp without time zone,
    total_duration_seconds integer,
    was_kicked boolean DEFAULT false,
    was_muted boolean DEFAULT false
);


ALTER TABLE public.call_participants OWNER TO pnptvbot;

--
-- TOC entry 312 (class 1259 OID 68051)
-- Name: call_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.call_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.call_participants_id_seq OWNER TO pnptvbot;

--
-- TOC entry 5083 (class 0 OID 0)
-- Dependencies: 312
-- Name: call_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.call_participants_id_seq OWNED BY public.call_participants.id;


--
-- TOC entry 221 (class 1259 OID 25055)
-- Name: calls; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.calls OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 67720)
-- Name: confirmation_tokens; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.confirmation_tokens (
    id integer NOT NULL,
    token character varying(64) NOT NULL,
    payment_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    plan_id character varying(100),
    provider character varying(50) NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    CONSTRAINT check_provider CHECK (((provider)::text = ANY ((ARRAY['paypal'::character varying, 'daimo'::character varying, 'epayco'::character varying])::text[])))
);


ALTER TABLE public.confirmation_tokens OWNER TO pnptvbot;

--
-- TOC entry 305 (class 1259 OID 67719)
-- Name: confirmation_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.confirmation_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.confirmation_tokens_id_seq OWNER TO pnptvbot;

--
-- TOC entry 5084 (class 0 OID 0)
-- Dependencies: 305
-- Name: confirmation_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.confirmation_tokens_id_seq OWNED BY public.confirmation_tokens.id;


--
-- TOC entry 235 (class 1259 OID 25305)
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
    is_active pg_dump: creating TABLE "public.emote_usage"
pg_dump: creating TABLE "public.emotes"
pg_dump: creating TABLE "public.fraud_flags"
pg_dump: creating TABLE "public.gamification"
pg_dump: creating TABLE "public.group_invitations"
pg_dump: creating SEQUENCE "public.group_invitations_id_seq"
pg_dump: creating SEQUENCE OWNED BY "public.group_invitations_id_seq"
pg_dump: creating TABLE "public.group_settings"
boolean DEFAULT true,
    approved_at timestamp without time zone,
    approved_by character varying(255),
    rejected_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.custom_emotes OWNER TO pnptvbot;

--
-- TOC entry 236 (class 1259 OID 25325)
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
-- TOC entry 234 (class 1259 OID 25293)
-- Name: emotes; Type: TABLE; Schema: public; Owner: pnptvbot
--

