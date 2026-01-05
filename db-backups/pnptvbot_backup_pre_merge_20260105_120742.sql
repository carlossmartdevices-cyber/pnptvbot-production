--
-- PostgreSQL database dump
--

\restrict PvXwKuwsu5v1tkUa6bcb8Tt99iFdzhSn52GbyHaMSgRh4bgFkb68fu89TGV0FC1

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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
-- Name: increment_track_play_count(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.increment_track_play_count() OWNER TO postgres;

--
-- Name: update_call_participant_count(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.update_call_participant_count() OWNER TO postgres;

--
-- Name: update_live_streams_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_live_streams_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_live_streams_updated_at() OWNER TO postgres;

--
-- Name: update_private_calls_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_private_calls_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_private_calls_updated_at() OWNER TO postgres;

--
-- Name: update_room_participant_count(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.update_room_participant_count() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activation_codes; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.activation_codes OWNER TO postgres;

--
-- Name: activation_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.activation_logs OWNER TO postgres;

--
-- Name: agora_channels; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.agora_channels OWNER TO postgres;

--
-- Name: broadcasts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broadcasts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255),
    message text NOT NULL,
    media_url text,
    media_type character varying(50),
    scheduled_at timestamp without time zone,
    sent_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    target_tier character varying(50),
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.broadcasts OWNER TO postgres;

--
-- Name: call_availability; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.call_availability OWNER TO postgres;

--
-- Name: call_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.call_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.call_availability_id_seq OWNER TO postgres;

--
-- Name: call_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.call_availability_id_seq OWNED BY public.call_availability.id;


--
-- Name: call_feedback; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.call_feedback OWNER TO postgres;

--
-- Name: call_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_packages (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    calls integer NOT NULL,
    price integer NOT NULL,
    price_per_call integer,
    savings integer,
    savings_percent integer,
    popular boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.call_packages OWNER TO postgres;

--
-- Name: call_participants; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.call_participants OWNER TO postgres;

--
-- Name: call_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.call_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.call_participants_id_seq OWNER TO postgres;

--
-- Name: call_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.call_participants_id_seq OWNED BY public.call_participants.id;


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
-- Name: emotes; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.emotes OWNER TO postgres;

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
-- Name: group_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id character varying(255) NOT NULL,
    group_title character varying(255),
    anti_links_enabled boolean DEFAULT true,
    anti_spam_enabled boolean DEFAULT true,
    anti_flood_enabled boolean DEFAULT true,
    profanity_filter_enabled boolean DEFAULT false,
    max_warnings integer DEFAULT 3,
    flood_limit integer DEFAULT 5,
    flood_window integer DEFAULT 10,
    mute_duration integer DEFAULT 3600,
    allowed_domains text[] DEFAULT '{}'::text[],
    banned_words text[] DEFAULT '{}'::text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_settings OWNER TO postgres;

--
-- Name: live_streams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_streams (
    id integer NOT NULL,
    stream_id character varying(100) NOT NULL,
    room_name character varying(255) NOT NULL,
    host_user_id character varying(50) NOT NULL,
    host_telegram_id bigint NOT NULL,
    host_name character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    thumbnail_url text,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    scheduled_start_time timestamp without time zone,
    actual_start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_seconds integer DEFAULT 0,
    is_public boolean DEFAULT true,
    is_subscribers_only boolean DEFAULT false,
    allowed_plan_tiers text[],
    current_viewers integer DEFAULT 0,
    peak_viewers integer DEFAULT 0,
    total_views integer DEFAULT 0,
    total_messages integer DEFAULT 0,
    jaas_room_name character varying(255),
    recording_enabled boolean DEFAULT false,
    recording_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT live_streams_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'live'::character varying, 'ended'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.live_streams OWNER TO postgres;

--
-- Name: TABLE live_streams; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.live_streams IS 'Stores information about live streaming sessions';


--
-- Name: live_streams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.live_streams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.live_streams_id_seq OWNER TO postgres;

--
-- Name: live_streams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.live_streams_id_seq OWNED BY public.live_streams.id;


--
-- Name: main_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.main_rooms (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    channel_name text NOT NULL,
    bot_user_id text NOT NULL,
    max_participants integer DEFAULT 50,
    current_participants integer DEFAULT 0,
    is_active boolean DEFAULT true,
    enforce_camera boolean DEFAULT true,
    auto_approve_publisher boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT main_rooms_id_check CHECK ((id = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE public.main_rooms OWNER TO postgres;

--
-- Name: menu_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_configs (
    id character varying(255) NOT NULL,
    menu_id character varying(255),
    name character varying(255) NOT NULL,
    name_es character varying(255),
    parent_id character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    allowed_tiers text[],
    order_position integer DEFAULT 0,
    icon character varying(50),
    action character varying(255),
    type character varying(50) DEFAULT 'default'::character varying,
    action_type character varying(50),
    action_data jsonb,
    customizable boolean DEFAULT true,
    deletable boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.menu_configs OWNER TO postgres;

--
-- Name: moderation_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.moderation_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id character varying(255),
    user_id character varying(255),
    moderator_id character varying(255) DEFAULT 'system'::character varying,
    action character varying(50) NOT NULL,
    reason text DEFAULT ''::text,
    details text DEFAULT ''::text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.moderation_logs OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reference character varying(255) NOT NULL,
    user_id character varying(255),
    plan_id character varying(255),
    provider character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    transaction_id character varying(255),
    payment_method character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    payment_url text,
    daimo_link text,
    manual_completion boolean DEFAULT false,
    completed_by character varying(255),
    expires_at timestamp without time zone
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plans (
    id character varying(255) NOT NULL,
    sku character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255),
    name_es character varying(255),
    price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    duration_days integer DEFAULT 30,
    duration integer,
    features text[],
    features_es text[],
    active boolean DEFAULT true,
    is_lifetime boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.plans OWNER TO postgres;

--
-- Name: playlist_tracks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.playlist_tracks (
    id integer NOT NULL,
    playlist_id uuid,
    track_id uuid,
    track_order integer NOT NULL
);


ALTER TABLE public.playlist_tracks OWNER TO postgres;

--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.playlist_tracks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.playlist_tracks_id_seq OWNER TO postgres;

--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.playlist_tracks_id_seq OWNED BY public.playlist_tracks.id;


--
-- Name: private_calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.private_calls (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    caller_id character varying(255) NOT NULL,
    caller_username character varying(255),
    receiver_id character varying(255) NOT NULL,
    receiver_username character varying(255),
    user_name character varying(255),
    payment_id character varying(255),
    scheduled_date date,
    scheduled_time time without time zone,
    scheduled_at timestamp without time zone,
    duration integer DEFAULT 0,
    performer character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    call_type character varying(50),
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    caller_rating integer,
    receiver_rating integer,
    caller_feedback text,
    receiver_feedback text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id character varying(255),
    meeting_url text,
    reminder_sent boolean DEFAULT false,
    reminder_24h_sent boolean DEFAULT false,
    reminder_1h_sent boolean DEFAULT false,
    reminder_15min_sent boolean DEFAULT false,
    feedback_submitted boolean DEFAULT false,
    amount numeric(10,2) DEFAULT 100,
    CONSTRAINT private_calls_caller_rating_check CHECK (((caller_rating >= 1) AND (caller_rating <= 5))),
    CONSTRAINT private_calls_receiver_rating_check CHECK (((receiver_rating >= 1) AND (receiver_rating <= 5)))
);


ALTER TABLE public.private_calls OWNER TO postgres;

--
-- Name: promo_code_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_code_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    user_id character varying(255) NOT NULL,
    payment_id character varying(255),
    discount_amount numeric(10,2) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promo_code_usage OWNER TO postgres;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    discount numeric(10,2) NOT NULL,
    discount_type character varying(20) DEFAULT 'percentage'::character varying,
    max_uses integer,
    current_uses integer DEFAULT 0,
    valid_until timestamp without time zone,
    min_amount numeric(10,2) DEFAULT 0,
    applicable_plans text[] DEFAULT '{}'::text[],
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    deactivated_at timestamp without time zone
);


ALTER TABLE public.promo_codes OWNER TO postgres;

--
-- Name: radio_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    played_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.radio_history OWNER TO postgres;

--
-- Name: radio_listen_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_listen_history (
    id integer NOT NULL,
    user_id text,
    track_id uuid,
    session_id uuid,
    listened_at timestamp without time zone DEFAULT now(),
    duration_seconds integer,
    completed boolean DEFAULT false,
    device_type text,
    ip_address text
);


ALTER TABLE public.radio_listen_history OWNER TO postgres;

--
-- Name: radio_listen_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.radio_listen_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.radio_listen_history_id_seq OWNER TO postgres;

--
-- Name: radio_listen_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.radio_listen_history_id_seq OWNED BY public.radio_listen_history.id;


--
-- Name: radio_now_playing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_now_playing (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    artist character varying(255),
    duration character varying(50),
    cover_url text,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.radio_now_playing OWNER TO postgres;

--
-- Name: radio_playlists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_playlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    playlist_type text DEFAULT 'manual'::text,
    schedule_days integer[],
    schedule_start_time time without time zone,
    schedule_end_time time without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT radio_playlists_playlist_type_check CHECK ((playlist_type = ANY (ARRAY['auto'::text, 'manual'::text, 'schedule'::text])))
);


ALTER TABLE public.radio_playlists OWNER TO postgres;

--
-- Name: radio_requests; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.radio_requests OWNER TO postgres;

--
-- Name: radio_schedule; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.radio_schedule OWNER TO postgres;

--
-- Name: radio_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_subscribers (
    user_id text NOT NULL,
    notify_now_playing boolean DEFAULT false,
    notify_track_types text[] DEFAULT ARRAY['music'::text, 'podcast'::text, 'talkshow'::text],
    notify_new_uploads boolean DEFAULT false,
    subscribed_at timestamp without time zone DEFAULT now(),
    last_notified_at timestamp without time zone
);


ALTER TABLE public.radio_subscribers OWNER TO postgres;

--
-- Name: radio_tracks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radio_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    artist text,
    album text,
    audio_url text NOT NULL,
    file_size_bytes bigint,
    duration_seconds integer NOT NULL,
    type text DEFAULT 'music'::text,
    genre text,
    language text DEFAULT 'en'::text,
    play_order integer,
    is_active boolean DEFAULT true,
    thumbnail_url text,
    description text,
    tags text[] DEFAULT ARRAY[]::text[],
    play_count integer DEFAULT 0,
    skip_count integer DEFAULT 0,
    like_count integer DEFAULT 0,
    uploaded_by text,
    upload_source text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT radio_tracks_type_check CHECK ((type = ANY (ARRAY['music'::text, 'podcast'::text, 'talkshow'::text, 'ad'::text])))
);


ALTER TABLE public.radio_tracks OWNER TO postgres;

--
-- Name: room_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room_events (
    id integer NOT NULL,
    room_id integer,
    event_type text NOT NULL,
    initiator_user_id text,
    target_user_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.room_events OWNER TO postgres;

--
-- Name: room_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.room_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_events_id_seq OWNER TO postgres;

--
-- Name: room_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.room_events_id_seq OWNED BY public.room_events.id;


--
-- Name: room_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room_participants (
    id integer NOT NULL,
    room_id integer,
    user_id text NOT NULL,
    user_name text NOT NULL,
    is_publisher boolean DEFAULT false,
    is_moderator boolean DEFAULT false,
    joined_at timestamp without time zone DEFAULT now(),
    left_at timestamp without time zone,
    total_duration_seconds integer
);


ALTER TABLE public.room_participants OWNER TO postgres;

--
-- Name: room_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.room_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_participants_id_seq OWNER TO postgres;

--
-- Name: room_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.room_participants_id_seq OWNED BY public.room_participants.id;


--
-- Name: segment_membership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.segment_membership (
    id integer NOT NULL,
    segment_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.segment_membership OWNER TO postgres;

--
-- Name: segment_membership_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.segment_membership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.segment_membership_id_seq OWNER TO postgres;

--
-- Name: segment_membership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.segment_membership_id_seq OWNED BY public.segment_membership.id;


--
-- Name: stream_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_analytics (
    id integer NOT NULL,
    stream_id character varying(100) NOT NULL,
    date date NOT NULL,
    unique_viewers integer DEFAULT 0,
    total_views integer DEFAULT 0,
    total_messages integer DEFAULT 0,
    average_watch_time_seconds integer DEFAULT 0,
    peak_concurrent_viewers integer DEFAULT 0,
    engagement_rate numeric(5,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stream_analytics OWNER TO postgres;

--
-- Name: TABLE stream_analytics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stream_analytics IS 'Daily aggregated analytics for streams';


--
-- Name: stream_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_analytics_id_seq OWNER TO postgres;

--
-- Name: stream_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_analytics_id_seq OWNED BY public.stream_analytics.id;


--
-- Name: stream_chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_chat_messages (
    id integer NOT NULL,
    message_id character varying(100) NOT NULL,
    stream_id character varying(100) NOT NULL,
    user_id character varying(50) NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(255),
    display_name character varying(255) NOT NULL,
    message_text text NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by character varying(50),
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stream_chat_messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'reaction'::character varying, 'system'::character varying])::text[])))
);


ALTER TABLE public.stream_chat_messages OWNER TO postgres;

--
-- Name: TABLE stream_chat_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stream_chat_messages IS 'Stores chat messages sent during live streams';


--
-- Name: stream_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_chat_messages_id_seq OWNER TO postgres;

--
-- Name: stream_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_chat_messages_id_seq OWNED BY public.stream_chat_messages.id;


--
-- Name: stream_moderators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_moderators (
    id integer NOT NULL,
    stream_id character varying(100) NOT NULL,
    user_id character varying(50) NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(255),
    display_name character varying(255) NOT NULL,
    can_mute_users boolean DEFAULT true,
    can_delete_messages boolean DEFAULT true,
    can_ban_users boolean DEFAULT false,
    can_end_stream boolean DEFAULT false,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by character varying(50) NOT NULL
);


ALTER TABLE public.stream_moderators OWNER TO postgres;

--
-- Name: TABLE stream_moderators; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stream_moderators IS 'Manages moderators for live streams';


--
-- Name: stream_moderators_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_moderators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_moderators_id_seq OWNER TO postgres;

--
-- Name: stream_moderators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_moderators_id_seq OWNED BY public.stream_moderators.id;


--
-- Name: stream_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_notifications (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    streamer_id character varying(255) NOT NULL,
    subscribed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notifications_enabled boolean DEFAULT true
);


ALTER TABLE public.stream_notifications OWNER TO postgres;

--
-- Name: stream_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_notifications_id_seq OWNER TO postgres;

--
-- Name: stream_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_notifications_id_seq OWNED BY public.stream_notifications.id;


--
-- Name: stream_viewers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_viewers (
    id integer NOT NULL,
    stream_id character varying(100) NOT NULL,
    user_id character varying(50) NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(255),
    display_name character varying(255),
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    left_at timestamp without time zone,
    watch_duration_seconds integer DEFAULT 0,
    messages_sent integer DEFAULT 0,
    reactions_sent integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stream_viewers OWNER TO postgres;

--
-- Name: TABLE stream_viewers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stream_viewers IS 'Tracks viewers who join live streams';


--
-- Name: stream_viewers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_viewers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_viewers_id_seq OWNER TO postgres;

--
-- Name: stream_viewers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_viewers_id_seq OWNED BY public.stream_viewers.id;


--
-- Name: subscribers; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.subscribers OWNER TO postgres;

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
-- Name: user_broadcast_preferences; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.user_broadcast_preferences OWNER TO postgres;

--
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_broadcast_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_broadcast_preferences_id_seq OWNER TO postgres;

--
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_broadcast_preferences_id_seq OWNED BY public.user_broadcast_preferences.id;


--
-- Name: user_call_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_call_packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(255) NOT NULL,
    package_id character varying(255) NOT NULL,
    package_name character varying(255),
    total_calls integer NOT NULL,
    remaining_calls integer NOT NULL,
    used_calls integer DEFAULT 0,
    price integer,
    payment_id character varying(255),
    purchased_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    active boolean DEFAULT true,
    last_used_at timestamp without time zone,
    last_used_call_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_call_packages OWNER TO postgres;

--
-- Name: user_playlists; Type: TABLE; Schema: public; Owner: pnptvbot
--

CREATE TABLE public.user_playlists (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    category character varying(100) DEFAULT 'music'::character varying,
    icon character varying(10) DEFAULT '🎵'::character varying,
    thumbnail character varying(1000),
    videos jsonb DEFAULT '[]'::jsonb,
    is_public boolean DEFAULT false,
    video_count integer DEFAULT 0,
    creator_name character varying(255),
    creator_badge character varying(10) DEFAULT '👤'::character varying,
    featured boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_playlists OWNER TO pnptvbot;

--
-- Name: user_playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: pnptvbot
--

CREATE SEQUENCE public.user_playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_playlists_id_seq OWNER TO pnptvbot;

--
-- Name: user_playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pnptvbot
--

ALTER SEQUENCE public.user_playlists_id_seq OWNED BY public.user_playlists.id;


--
-- Name: user_segments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.user_segments OWNER TO postgres;

--
-- Name: user_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_segments_id_seq OWNER TO postgres;

--
-- Name: user_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_segments_id_seq OWNED BY public.user_segments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    username character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    email character varying(255),
    email_verified boolean DEFAULT false,
    bio text,
    photo_file_id character varying(255),
    photo_updated_at timestamp without time zone,
    interests text[],
    location_lat numeric,
    location_lng numeric,
    location_name character varying(255),
    location_geohash character varying(255),
    location_updated_at timestamp without time zone,
    subscription_status character varying(255) DEFAULT 'free'::character varying,
    tier character varying(255) DEFAULT 'Free'::character varying,
    plan_id character varying(255),
    plan_expiry timestamp without time zone,
    language character varying(50) DEFAULT 'en'::character varying,
    onboarding_complete boolean DEFAULT false,
    age_verified boolean DEFAULT false,
    terms_accepted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(255) DEFAULT 'user'::character varying,
    privacy character varying(255) DEFAULT 'public'::character varying,
    blocked text[] DEFAULT '{}'::text[],
    notifications_enabled boolean DEFAULT true,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    referral_code character varying(100),
    referred_by character varying(255),
    profile_views integer DEFAULT 0,
    xp integer DEFAULT 0,
    favorites text[] DEFAULT '{}'::text[],
    badges text[] DEFAULT '{}'::text[],
    privacy_accepted boolean DEFAULT false,
    is_active boolean DEFAULT true,
    instagram character varying(255),
    twitter character varying(255),
    tiktok character varying(255),
    youtube character varying(255),
    telegram character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: video_calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id text NOT NULL,
    creator_name text NOT NULL,
    channel_name text NOT NULL,
    title text,
    is_active boolean DEFAULT true,
    max_participants integer DEFAULT 10,
    current_participants integer DEFAULT 0,
    enforce_camera boolean DEFAULT true,
    allow_guests boolean DEFAULT true,
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone,
    duration_seconds integer,
    recording_enabled boolean DEFAULT false,
    recording_url text,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.video_calls OWNER TO postgres;

--
-- Name: webinar_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webinar_registrations (
    id integer NOT NULL,
    webinar_id uuid,
    user_id text NOT NULL,
    user_name text NOT NULL,
    user_email text,
    registered_at timestamp without time zone DEFAULT now(),
    attended boolean DEFAULT false,
    joined_at timestamp without time zone,
    left_at timestamp without time zone,
    reminder_sent_1d boolean DEFAULT false,
    reminder_sent_1h boolean DEFAULT false,
    reminder_sent_10m boolean DEFAULT false
);


ALTER TABLE public.webinar_registrations OWNER TO postgres;

--
-- Name: webinar_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webinar_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.webinar_registrations_id_seq OWNER TO postgres;

--
-- Name: webinar_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webinar_registrations_id_seq OWNED BY public.webinar_registrations.id;


--
-- Name: webinars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webinars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    scheduled_for timestamp without time zone NOT NULL,
    duration_minutes integer DEFAULT 180,
    channel_name text NOT NULL,
    host_id text NOT NULL,
    max_attendees integer DEFAULT 200,
    current_attendees integer DEFAULT 0,
    status text DEFAULT 'scheduled'::text,
    enforce_camera boolean DEFAULT true,
    allow_questions boolean DEFAULT true,
    enable_chat boolean DEFAULT true,
    recording_enabled boolean DEFAULT true,
    recording_url text,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT webinars_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text, 'cancelled'::text])))
);


ALTER TABLE public.webinars OWNER TO postgres;

--
-- Name: call_availability id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_availability ALTER COLUMN id SET DEFAULT nextval('public.call_availability_id_seq'::regclass);


--
-- Name: call_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_participants ALTER COLUMN id SET DEFAULT nextval('public.call_participants_id_seq'::regclass);


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
-- Name: community_post_schedules id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_post_schedules ALTER COLUMN id SET DEFAULT nextval('public.community_post_schedules_id_seq'::regclass);


--
-- Name: community_posts id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.community_posts ALTER COLUMN id SET DEFAULT nextval('public.community_posts_id_seq'::regclass);


--
-- Name: group_invitations id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.group_invitations ALTER COLUMN id SET DEFAULT nextval('public.group_invitations_id_seq'::regclass);


--
-- Name: live_streams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams ALTER COLUMN id SET DEFAULT nextval('public.live_streams_id_seq'::regclass);


--
-- Name: playlist_tracks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playlist_tracks ALTER COLUMN id SET DEFAULT nextval('public.playlist_tracks_id_seq'::regclass);


--
-- Name: radio_listen_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_listen_history ALTER COLUMN id SET DEFAULT nextval('public.radio_listen_history_id_seq'::regclass);


--
-- Name: room_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_events ALTER COLUMN id SET DEFAULT nextval('public.room_events_id_seq'::regclass);


--
-- Name: room_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_participants ALTER COLUMN id SET DEFAULT nextval('public.room_participants_id_seq'::regclass);


--
-- Name: segment_membership id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.segment_membership ALTER COLUMN id SET DEFAULT nextval('public.segment_membership_id_seq'::regclass);


--
-- Name: stream_analytics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_analytics ALTER COLUMN id SET DEFAULT nextval('public.stream_analytics_id_seq'::regclass);


--
-- Name: stream_chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.stream_chat_messages_id_seq'::regclass);


--
-- Name: stream_moderators id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderators ALTER COLUMN id SET DEFAULT nextval('public.stream_moderators_id_seq'::regclass);


--
-- Name: stream_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_notifications ALTER COLUMN id SET DEFAULT nextval('public.stream_notifications_id_seq'::regclass);


--
-- Name: stream_viewers id; Type: DEFAULT; Schema: public; Owner: postgres
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
-- Name: user_broadcast_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_broadcast_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_broadcast_preferences_id_seq'::regclass);


--
-- Name: user_playlists id; Type: DEFAULT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_playlists ALTER COLUMN id SET DEFAULT nextval('public.user_playlists_id_seq'::regclass);


--
-- Name: user_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_segments ALTER COLUMN id SET DEFAULT nextval('public.user_segments_id_seq'::regclass);


--
-- Name: webinar_registrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinar_registrations ALTER COLUMN id SET DEFAULT nextval('public.webinar_registrations_id_seq'::regclass);


--
-- Data for Name: activation_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activation_codes (code, product, used, used_at, used_by, used_by_username, email, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: activation_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activation_logs (id, user_id, username, code, product, activated_at, success) FROM stdin;
\.


--
-- Data for Name: agora_channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agora_channels (channel_name, channel_type, feature_name, is_active, created_by, max_participants, current_participants, created_at, expires_at, last_activity_at, metadata) FROM stdin;
pnptv_main_room_1	room	hangouts	t	\N	50	0	2026-01-04 07:37:33.860337	\N	2026-01-04 07:37:33.860337	{}
pnptv_main_room_2	room	hangouts	t	\N	50	0	2026-01-04 07:37:33.860337	\N	2026-01-04 07:37:33.860337	{}
pnptv_main_room_3	room	hangouts	t	\N	50	0	2026-01-04 07:37:33.860337	\N	2026-01-04 07:37:33.860337	{}
pnptv_radio_247	radio	radio	t	\N	\N	0	2026-01-04 07:37:33.861079	\N	2026-01-04 07:37:33.861079	{}
\.


--
-- Data for Name: broadcasts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broadcasts (id, title, message, media_url, media_type, scheduled_at, sent_at, status, target_tier, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: call_availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.call_availability (id, admin_id, available, message, valid_until, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: call_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.call_feedback (id, call_id, user_id, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: call_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.call_packages (id, name, calls, price, price_per_call, savings, savings_percent, popular, created_at, updated_at) FROM stdin;
single-call	Single Call	1	25	25	0	0	f	2026-01-04 07:37:14.89534	2026-01-04 07:37:14.89534
3-call-pack	3 Call Package	3	60	20	15	20	f	2026-01-04 07:37:14.89534	2026-01-04 07:37:14.89534
5-call-pack	5 Call Package	5	90	18	35	28	t	2026-01-04 07:37:14.89534	2026-01-04 07:37:14.89534
10-call-pack	10 Call Package	10	150	15	100	40	f	2026-01-04 07:37:14.89534	2026-01-04 07:37:14.89534
\.


--
-- Data for Name: call_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.call_participants (id, call_id, user_id, user_name, is_guest, is_host, joined_at, left_at, total_duration_seconds, was_kicked, was_muted) FROM stdin;
\.


--
-- Data for Name: community_button_presets; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_button_presets (id, preset_id, button_type, button_label, default_label, description, icon_emoji, target_url, allow_custom_url, is_active, created_at, updated_at) FROM stdin;
1	e317029a-6b45-45e8-a5ba-d378e8e4bdbe	nearby	📍 Nearby	See Nearby	Geolocation-based feature	📍	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
2	2c52bdbb-dd31-4e0d-8429-344def01fafa	profile	👤 Profile	View Profile	User profile viewing	👤	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
3	0309e920-9956-4d6a-a225-a598fc43552e	main_room	🎯 Main Room	Join Main Room	PNPtv Main Group Channel	🎯	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
4	c8471d62-6b49-4ac8-82ec-0325d70b63a5	hangouts	🎉 Hangouts	Join Hangouts	PNPtv Hangout Group	🎉	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
5	55283b2b-3fda-4b4b-b04a-8cca824f756b	cristina_ai	🤖 Cristina AI	Chat with Cristina	AI Assistant	🤖	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
6	fdcd5313-8063-42a4-84b9-d8bdcbdea7b2	videorama	🎬 Videorama	Watch Videos	Video Section	🎬	\N	f	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
7	b22fe8bc-6e75-4f6c-853a-25b96a694cd5	custom	🔗 Custom Link	Learn More	User-provided URL	🔗	\N	t	t	2026-01-05 11:43:54.975008	2026-01-05 11:43:54.975008
\.


--
-- Data for Name: community_groups; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.community_groups (id, group_id, name, telegram_group_id, description, icon, display_order, is_active, created_at, updated_at) FROM stdin;
1	a9a34fdb-2d9b-4316-9bad-cc08d460727d	📍 Nearby	-1001234567890	Geolocation-based feature	📍	1	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
2	98d6f71e-d6eb-40f1-81ec-75b788307402	👤 Profile	-1001234567891	User profile viewing	👤	2	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
3	3fb5221c-192a-432c-a897-79084bfab906	🎯 Main Room	-1001234567892	PNPtv Main Group Channel	🎯	3	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
4	6031c4ac-6f04-41fa-8dac-b2a1986de573	🎉 Hangouts	-1001234567893	PNPtv Hangout Group	🎉	4	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
5	fa580f17-c233-4f7b-99ed-9ed09f56ee0e	🤖 Cristina AI	-1001234567894	AI Assistant Chat	🤖	5	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
6	db1f62d8-9c76-49a9-869d-fe044626ba8b	🎬 Videorama	-1001234567895	Video Section	🎬	6	t	2026-01-05 11:43:54.915121	2026-01-05 11:43:54.915121
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
-- Data for Name: emotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emotes (id, name, emoji, category, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: group_invitations; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.group_invitations (id, token, user_id, group_type, invitation_link, used, created_at, expires_at, used_at, last_reminder_at) FROM stdin;
1	e36d710785b444e81811e2612e4b09a4e3b36d55650fdf18f3696d78ba2e2609	2108855269	free	https://easybots.store/join-group/e36d710785b444e81811e2612e4b09a4e3b36d55650fdf18f3696d78ba2e2609	f	2026-01-04 13:59:47.821254	2026-01-05 13:59:47.821	\N	\N
2	bcb861661de327de3c562adefa6748cfe139c7ef9fc389b1e246d6fc66210241	1760801274	free	https://easybots.store/join-group/bcb861661de327de3c562adefa6748cfe139c7ef9fc389b1e246d6fc66210241	f	2026-01-04 14:09:59.993706	2026-01-05 14:09:59.993	\N	\N
3	5eb0cabd35fdcdd81bbe78d45c958da18984593ba585a707f6c6301787fa7c0d	1324803960	free	https://easybots.store/join-group/5eb0cabd35fdcdd81bbe78d45c958da18984593ba585a707f6c6301787fa7c0d	f	2026-01-04 14:27:17.160707	2026-01-05 14:27:17.16	\N	\N
4	c917076592e4a704de51462551a10fc6b85df427c8dddfce486ab4a74862b1d7	8569671029	free	https://easybots.store/join-group/c917076592e4a704de51462551a10fc6b85df427c8dddfce486ab4a74862b1d7	f	2026-01-04 14:28:41.84775	2026-01-05 14:28:41.847	\N	\N
5	c185864747896d00dc5109385c5734e172f626aa3c01758aee200f2d1b9854a3	8569671029	free	https://easybots.store/join-group/c185864747896d00dc5109385c5734e172f626aa3c01758aee200f2d1b9854a3	t	2026-01-04 14:45:36.539358	2026-01-05 14:45:36.539	2026-01-04 14:45:37.603472	\N
6	424ad692b45f89f91f6acb413bb876e7fcaec066d2b9039bb148e742a1711e74	5996415417	free	https://easybots.store/join-group/424ad692b45f89f91f6acb413bb876e7fcaec066d2b9039bb148e742a1711e74	f	2026-01-04 16:55:34.263589	2026-01-05 16:55:34.262	\N	\N
7	91b1c1019f03210e9fcf40b6643752ddfcc416d8d34d7586a53a015a8c9b8955	6961290452	free	https://easybots.store/join-group/91b1c1019f03210e9fcf40b6643752ddfcc416d8d34d7586a53a015a8c9b8955	t	2026-01-04 16:58:46.634868	2026-01-05 16:58:46.634	2026-01-04 16:58:47.728163	\N
8	d3a57bdc04ef5fbb1cfc7070e33a5b4acf978077cd31c45170b55eb2fcdda86c	7478136172	free	https://easybots.store/join-group/d3a57bdc04ef5fbb1cfc7070e33a5b4acf978077cd31c45170b55eb2fcdda86c	f	2026-01-04 17:11:32.955794	2026-01-05 17:11:32.955	\N	\N
9	f4fe5ad505ac472d4c5784316174a790aa14a49287a060b3675c24d0a0189fbb	8283622285	free	https://easybots.store/join-group/f4fe5ad505ac472d4c5784316174a790aa14a49287a060b3675c24d0a0189fbb	f	2026-01-04 17:15:28.005472	2026-01-05 17:15:28.005	\N	\N
10	25e1ad8f9d1ef02d0a43e908454bb4cc746abc0bd67b29c08bccc7601d3c6ba4	1871708911	free	https://easybots.store/join-group/25e1ad8f9d1ef02d0a43e908454bb4cc746abc0bd67b29c08bccc7601d3c6ba4	f	2026-01-04 18:46:49.372359	2026-01-05 18:46:49.372	\N	\N
11	1a42c65f25294e333f9df2f1151d19354d86fccb28a10eac49f5868a81d5205c	1871708911	free	https://easybots.store/join-group/1a42c65f25294e333f9df2f1151d19354d86fccb28a10eac49f5868a81d5205c	f	2026-01-04 18:49:41.127177	2026-01-05 18:49:41.127	\N	\N
12	44a79835436eea30ea31a9b506b325a98b2e814154263fb795764bdf70268110	7110713697	free	https://easybots.store/join-group/44a79835436eea30ea31a9b506b325a98b2e814154263fb795764bdf70268110	f	2026-01-04 18:55:21.653049	2026-01-05 18:55:21.652	\N	\N
13	8b6de1ba45faff7c3580f3e6a1e0a25f37f5fad55c5df08164634f035f61cdc6	7110713697	free	https://easybots.store/join-group/8b6de1ba45faff7c3580f3e6a1e0a25f37f5fad55c5df08164634f035f61cdc6	f	2026-01-04 19:23:57.970438	2026-01-05 19:23:57.97	\N	\N
14	ddc765a2820252ee57149377062c519f36be893f1fdb9c73b3b287018d1de4e4	7110713697	free	https://easybots.store/join-group/ddc765a2820252ee57149377062c519f36be893f1fdb9c73b3b287018d1de4e4	t	2026-01-04 19:37:32.779451	2026-01-05 19:37:32.779	2026-01-04 19:37:34.09026	\N
15	7aef4b8dc3c0ee144aa6e06054cf814c86e14877253ba3afbe388307965d7fdc	8375669090	free	https://easybots.store/join-group/7aef4b8dc3c0ee144aa6e06054cf814c86e14877253ba3afbe388307965d7fdc	f	2026-01-04 20:32:29.496979	2026-01-05 20:32:29.496	\N	\N
16	9928c5ce0ddf1866b9f127f113f425e6943e6f7cca841fbd20a2b2c9f010c954	1974492346	free	https://easybots.store/join-group/9928c5ce0ddf1866b9f127f113f425e6943e6f7cca841fbd20a2b2c9f010c954	f	2026-01-04 20:41:58.016143	2026-01-05 20:41:58.015	\N	\N
17	8f96f699e152bb587328377c156099be9b992f944eff6df85ec6fd292a221f60	1974492346	free	https://easybots.store/join-group/8f96f699e152bb587328377c156099be9b992f944eff6df85ec6fd292a221f60	f	2026-01-04 20:43:49.066326	2026-01-05 20:43:49.066	\N	\N
18	3be8d919a5ab4c46e25498254bb5b3c9b758ba412be9982b89dd57c454bfc9b4	7199252565	free	https://easybots.store/join-group/3be8d919a5ab4c46e25498254bb5b3c9b758ba412be9982b89dd57c454bfc9b4	f	2026-01-04 21:50:23.63795	2026-01-05 21:50:23.637	\N	\N
19	852ad4750ce1663a058605fa376ad71acc1ae0d9fd08eed97ee0de3c46ca5541	6563124641	free	https://easybots.store/join-group/852ad4750ce1663a058605fa376ad71acc1ae0d9fd08eed97ee0de3c46ca5541	f	2026-01-04 21:51:18.593053	2026-01-05 21:51:18.592	\N	\N
20	4273d3429009c7f84cc43921d5a5182f3eac90f8717554a55a0b3536fbab823a	8056915969	free	https://easybots.store/join-group/4273d3429009c7f84cc43921d5a5182f3eac90f8717554a55a0b3536fbab823a	f	2026-01-04 21:59:16.848068	2026-01-05 21:59:16.847	\N	\N
21	1c14d9dfa398cf8b783e2253837cfe3ef09c2c9404afc581950a69dfb1b553ef	8531648956	free	https://easybots.store/join-group/1c14d9dfa398cf8b783e2253837cfe3ef09c2c9404afc581950a69dfb1b553ef	f	2026-01-04 22:17:31.731521	2026-01-05 22:17:31.731	\N	\N
22	c9bfc539e9f8c294e3806c4bc444a4ab0b94ab3ea2187f7c8b1afcc666df896c	5849505145	free	https://easybots.store/join-group/c9bfc539e9f8c294e3806c4bc444a4ab0b94ab3ea2187f7c8b1afcc666df896c	t	2026-01-04 22:18:11.686532	2026-01-05 22:18:11.686	2026-01-04 22:18:12.718569	\N
23	1c2a9eff32d1e6a671dbac85aeb98aed4cb38e2265c859343ffc55d13d2eafec	8387531332	free	https://easybots.store/join-group/1c2a9eff32d1e6a671dbac85aeb98aed4cb38e2265c859343ffc55d13d2eafec	f	2026-01-04 22:34:13.062861	2026-01-05 22:34:13.062	\N	\N
24	353fa6388e1e97d6c5cd10b61549a62030a728425f866fe39b2c297dec484d32	7849654881	free	https://easybots.store/join-group/353fa6388e1e97d6c5cd10b61549a62030a728425f866fe39b2c297dec484d32	f	2026-01-04 22:45:57.991361	2026-01-05 22:45:57.991	\N	\N
25	4b47338243c3ff072f4e4f8ca29c12efc113bab98dcb0791cdf3d670ead562aa	7849654881	free	https://easybots.store/join-group/4b47338243c3ff072f4e4f8ca29c12efc113bab98dcb0791cdf3d670ead562aa	f	2026-01-04 22:47:34.967479	2026-01-05 22:47:34.967	\N	\N
26	60532c3f34c4b8515a7ec54b9c7dc9577eb124eb95e2f308933f2788df0b674c	8581651013	free	https://easybots.store/join-group/60532c3f34c4b8515a7ec54b9c7dc9577eb124eb95e2f308933f2788df0b674c	f	2026-01-05 00:33:47.102233	2026-01-06 00:33:47.102	\N	\N
27	4425a169b8647448059fb0e9a2d459aeb67d0f26dabbee56d2913da5789b5fa3	1707171479	free	https://easybots.store/join-group/4425a169b8647448059fb0e9a2d459aeb67d0f26dabbee56d2913da5789b5fa3	f	2026-01-05 00:40:00.892681	2026-01-06 00:40:00.892	\N	\N
28	3cf94481f30ad4b9a493f493023ee8b7519d208e10a55a0c9084834938f35509	494202706	free	https://easybots.store/join-group/3cf94481f30ad4b9a493f493023ee8b7519d208e10a55a0c9084834938f35509	f	2026-01-05 00:45:49.218326	2026-01-06 00:45:49.218	\N	\N
29	24375c0203e3d61482aff5145e1c9159bb872fc92f872156fd3c044c02ec1643	5944968019	free	https://easybots.store/join-group/24375c0203e3d61482aff5145e1c9159bb872fc92f872156fd3c044c02ec1643	t	2026-01-05 01:07:57.131631	2026-01-06 01:07:57.131	2026-01-05 01:07:58.101266	\N
30	a7256fef47a5a1baacc1d08805cb11bd86f0b07fccb20bd6cd3b8f370cac6fa9	8420070507	free	https://easybots.store/join-group/a7256fef47a5a1baacc1d08805cb11bd86f0b07fccb20bd6cd3b8f370cac6fa9	f	2026-01-05 01:16:25.186878	2026-01-06 01:16:25.186	\N	\N
31	43388690ee9f053eea70919c4ce6cfd93e10c6447da9b7a0d63fc0c930a168e8	540482380	free	https://easybots.store/join-group/43388690ee9f053eea70919c4ce6cfd93e10c6447da9b7a0d63fc0c930a168e8	f	2026-01-05 01:22:08.924135	2026-01-06 01:22:08.924	\N	\N
32	14d2b070e0d36cc1bef2246be3516b17914af4be2cea49e5c6c90e7abc3c6ece	540482380	free	https://easybots.store/join-group/14d2b070e0d36cc1bef2246be3516b17914af4be2cea49e5c6c90e7abc3c6ece	f	2026-01-05 01:28:38.454586	2026-01-06 01:28:38.454	\N	\N
33	1534ba109ce936df17ba0474960869040556d5ebb198fd3151f09ca6be1561d5	8317267504	free	https://easybots.store/join-group/1534ba109ce936df17ba0474960869040556d5ebb198fd3151f09ca6be1561d5	t	2026-01-05 01:31:30.180368	2026-01-06 01:31:30.18	2026-01-05 01:31:31.149889	\N
34	43402364124f626c44e9dab0824fe3e04572814666a9dc649d990a26036463b1	8529551929	free	https://easybots.store/join-group/43402364124f626c44e9dab0824fe3e04572814666a9dc649d990a26036463b1	f	2026-01-05 01:36:14.922973	2026-01-06 01:36:14.922	\N	\N
35	8d177aeadf1ad4a12429a3ae7ab4fa93894d9008b522102a55f0152bd32a9be6	7246621722	free	https://easybots.store/join-group/8d177aeadf1ad4a12429a3ae7ab4fa93894d9008b522102a55f0152bd32a9be6	t	2026-01-05 01:56:36.555915	2026-01-06 01:56:36.555	2026-01-05 01:56:37.658418	\N
36	2d293c3a3e010c83154127f0afb55fc0534c7e90e09b2ebb8ed43adf21d43f5a	6707117613	free	https://easybots.store/join-group/2d293c3a3e010c83154127f0afb55fc0534c7e90e09b2ebb8ed43adf21d43f5a	f	2026-01-05 02:24:32.388426	2026-01-06 02:24:32.388	\N	\N
\.


--
-- Data for Name: group_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_settings (id, group_id, group_title, anti_links_enabled, anti_spam_enabled, anti_flood_enabled, profanity_filter_enabled, max_warnings, flood_limit, flood_window, mute_duration, allowed_domains, banned_words, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: live_streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.live_streams (id, stream_id, room_name, host_user_id, host_telegram_id, host_name, title, description, thumbnail_url, status, scheduled_start_time, actual_start_time, end_time, duration_seconds, is_public, is_subscribers_only, allowed_plan_tiers, current_viewers, peak_viewers, total_views, total_messages, jaas_room_name, recording_enabled, recording_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: main_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.main_rooms (id, name, description, channel_name, bot_user_id, max_participants, current_participants, is_active, enforce_camera, auto_approve_publisher, created_at, updated_at) FROM stdin;
1	PNPtv Hangout Room 1	Main community hangout room - join anytime!	pnptv_main_room_1	bot_room_1	50	0	t	t	t	2026-01-04 07:37:33.859559	2026-01-04 07:37:33.859559
2	PNPtv Hangout Room 2	Secondary community room - always open!	pnptv_main_room_2	bot_room_2	50	0	t	t	t	2026-01-04 07:37:33.859559	2026-01-04 07:37:33.859559
3	PNPtv Hangout Room 3	Third community room - come hang out!	pnptv_main_room_3	bot_room_3	50	0	t	t	t	2026-01-04 07:37:33.859559	2026-01-04 07:37:33.859559
\.


--
-- Data for Name: menu_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_configs (id, menu_id, name, name_es, parent_id, status, allowed_tiers, order_position, icon, action, type, action_type, action_data, customizable, deletable, created_at, updated_at) FROM stdin;
subscribe	\N	Subscribe	Suscribirse	\N	active	\N	1	💎	subscribe	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
profile	\N	My Profile	Mi Perfil	\N	active	\N	2	👤	profile	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
live	\N	Live Streams	En Vivo	\N	active	\N	4	📺	live	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
radio	\N	Radio	Radio	\N	active	\N	5	📻	radio	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
support	\N	Support	Soporte	\N	active	\N	7	💬	support	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
settings	\N	Settings	Configuración	\N	active	\N	8	⚙️	settings	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 07:37:14.89636
nearby	\N	Nearby Members	Miembros Cercanos	\N	tier_restricted	{Premium,Crystal,Diamond,PNP}	3	📍	nearby	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 08:06:54.252021
zoom	\N	Video Calls	Videollamadas	\N	tier_restricted	{Premium,Crystal,Diamond,PNP}	6	📞	zoom	default	\N	\N	t	f	2026-01-04 07:37:14.89636	2026-01-04 08:06:54.252021
\.


--
-- Data for Name: moderation_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.moderation_logs (id, group_id, user_id, moderator_id, action, reason, details, "timestamp") FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, reference, user_id, plan_id, provider, amount, currency, status, transaction_id, payment_method, created_at, updated_at, completed_at, payment_url, daimo_link, manual_completion, completed_by, expires_at) FROM stdin;
23cfda8b-7555-4792-93ae-52a14397b425	23cfda8b-7555-4792-93ae-52a14397b425	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 13:56:30.282	2026-01-04 13:56:30.282	\N	\N	\N	f	\N	\N
36a006d6-42ae-4f9b-b8d4-59341cb922de	36a006d6-42ae-4f9b-b8d4-59341cb922de	8365312597	week-pass	daimo	7.00	USD	pending	\N	\N	2026-01-04 13:57:03.523	2026-01-04 13:57:03.523	\N	\N	\N	f	\N	\N
76b1c569-08a8-413b-b14b-e7a96c2c0d2e	76b1c569-08a8-413b-b14b-e7a96c2c0d2e	8365312597	week-pass	paypal	7.00	USD	pending	\N	\N	2026-01-04 13:57:45.55	2026-01-04 13:57:45.55	\N	\N	\N	f	\N	\N
06eae41f-7355-40d1-8a08-7060191b9578	06eae41f-7355-40d1-8a08-7060191b9578	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 14:23:48.023	2026-01-04 14:23:48.03332	\N	https://easybots.store/checkout/06eae41f-7355-40d1-8a08-7060191b9578	\N	f	\N	\N
722500ec-7193-4d4f-88ed-4c316a186798	722500ec-7193-4d4f-88ed-4c316a186798	8365312597	week-pass	daimo	7.00	USD	pending	\N	\N	2026-01-04 14:24:05.548	2026-01-04 14:24:06.081284	\N	https://pay.daimo.com/checkout?id=23qAcWVuUb4XNmUtzq3RFwgvvRCbXMzFRfSis9MMxYXd	\N	f	\N	\N
96f11d25-cdb2-4f27-837f-7f510e5e80ff	96f11d25-cdb2-4f27-837f-7f510e5e80ff	8365312597	week-pass	paypal	7.00	USD	pending	\N	\N	2026-01-04 14:24:11.121	2026-01-04 14:24:11.766233	\N	https://www.paypal.com/checkoutnow?token=0HN12329D5105584N	\N	f	\N	\N
c1348c7f-33ed-41b7-b43c-c9718387aa12	c1348c7f-33ed-41b7-b43c-c9718387aa12	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 14:27:22.627	2026-01-04 14:27:22.629761	\N	https://easybots.store/checkout/c1348c7f-33ed-41b7-b43c-c9718387aa12	\N	f	\N	\N
c7290851-796e-474f-918d-fe3adccd9021	c7290851-796e-474f-918d-fe3adccd9021	8365312597	monthly-pass	epayco	15.00	USD	pending	\N	\N	2026-01-04 14:28:09.662	2026-01-04 14:28:09.664267	\N	https://easybots.store/checkout/c7290851-796e-474f-918d-fe3adccd9021	\N	f	\N	\N
844375ba-4450-4110-ad80-60ba46e058c3	844375ba-4450-4110-ad80-60ba46e058c3	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 14:34:06.919	2026-01-04 14:34:06.922896	\N	https://easybots.store/checkout/844375ba-4450-4110-ad80-60ba46e058c3	\N	f	\N	\N
bbe38349-3822-4935-8cad-27acf522d4fa	bbe38349-3822-4935-8cad-27acf522d4fa	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 14:42:33.926	2026-01-04 14:42:33.936558	\N	https://easybots.store/checkout/bbe38349-3822-4935-8cad-27acf522d4fa	\N	f	\N	\N
a8378d6d-0795-4cc4-873f-44a7b55b7428	a8378d6d-0795-4cc4-873f-44a7b55b7428	8365312597	monthly-pass	daimo	15.00	USD	pending	\N	\N	2026-01-04 14:43:32.95	2026-01-04 14:43:33.347161	\N	https://pay.daimo.com/checkout?id=B8XU4UYAUgBhfh6v4ETHGUTpcQ2Dh2T1UdA6NSx34sCh	\N	f	\N	\N
1a7d4430-77d5-4e86-bf92-04d58246b7b8	1a7d4430-77d5-4e86-bf92-04d58246b7b8	8365312597	monthly-pass	paypal	15.00	USD	pending	\N	\N	2026-01-04 14:43:46.48	2026-01-04 14:43:47.123161	\N	https://www.paypal.com/checkoutnow?token=2J102217FN441103E	\N	f	\N	\N
20fb285e-ef41-417c-bdc7-1241312c269f	20fb285e-ef41-417c-bdc7-1241312c269f	8365312597	week-pass	daimo	7.00	USD	pending	\N	\N	2026-01-04 14:44:01.349	2026-01-04 14:44:01.698292	\N	https://pay.daimo.com/checkout?id=6mTbLpyjjT4h4WuQGt7ZqH2GQr6Kr9RcrUHx33azg2pu	\N	f	\N	\N
f1e97260-8554-4f08-bac3-26b4798b5c2c	f1e97260-8554-4f08-bac3-26b4798b5c2c	5996415417	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-04 16:58:32.999	2026-01-04 16:58:33.002958	\N	https://easybots.store/checkout/f1e97260-8554-4f08-bac3-26b4798b5c2c	\N	f	\N	\N
53232a50-415a-496f-a22f-1ba049939d80	53232a50-415a-496f-a22f-1ba049939d80	8056915969	week-pass	paypal	7.00	USD	pending	\N	\N	2026-01-04 21:59:39.008	2026-01-04 21:59:39.951159	\N	https://www.paypal.com/checkoutnow?token=8A471162FT001870V	\N	f	\N	\N
10fd2702-711a-4760-b49b-82bf2c681b89	10fd2702-711a-4760-b49b-82bf2c681b89	7158699141	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-05 00:17:35.368	2026-01-05 00:17:35.372051	\N	https://easybots.store/checkout/10fd2702-711a-4760-b49b-82bf2c681b89	\N	f	\N	\N
3b7994b0-3559-4495-935b-86341b8d542f	3b7994b0-3559-4495-935b-86341b8d542f	8317267504	week-pass	paypal	7.00	USD	pending	\N	\N	2026-01-05 01:32:21.675	2026-01-05 01:32:22.315748	\N	https://www.paypal.com/checkoutnow?token=3HD447998K1796800	\N	f	\N	\N
5e22acdc-5632-4463-b1e3-c8554a8b2839	5e22acdc-5632-4463-b1e3-c8554a8b2839	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-05 05:08:10.639	2026-01-05 05:08:10.642621	\N	https://easybots.store/checkout/5e22acdc-5632-4463-b1e3-c8554a8b2839	\N	f	\N	\N
239ba840-3864-4e88-abed-f0481fd9b129	239ba840-3864-4e88-abed-f0481fd9b129	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-05 05:08:24.948	2026-01-05 05:08:24.952786	\N	https://easybots.store/checkout/239ba840-3864-4e88-abed-f0481fd9b129	\N	f	\N	\N
d9e54e06-b227-4832-bb8e-0ec24e93a308	d9e54e06-b227-4832-bb8e-0ec24e93a308	8365312597	week-pass	daimo	7.00	USD	pending	\N	\N	2026-01-05 05:08:46.609	2026-01-05 05:08:47.131245	\N	https://pay.daimo.com/checkout?id=4jvofLo5LFDCh8h2gDfXx42wV9Vf5usRaowHk9rk5eBB	\N	f	\N	\N
6e75480a-0c44-4b79-ad0a-f9cca66db06c	6e75480a-0c44-4b79-ad0a-f9cca66db06c	8365312597	6-month-pass	paypal	75.00	USD	pending	\N	\N	2026-01-05 05:09:14.166	2026-01-05 05:09:14.757415	\N	https://www.paypal.com/checkoutnow?token=570884211P339805P	\N	f	\N	\N
53c6dba9-5e34-4228-b143-47404d112b50	53c6dba9-5e34-4228-b143-47404d112b50	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-05 05:24:39.757	2026-01-05 05:24:39.769242	\N	https://easybots.store/checkout/53c6dba9-5e34-4228-b143-47404d112b50	\N	f	\N	\N
c2eb2f7e-76e2-4d75-a2a7-950b74d27205	c2eb2f7e-76e2-4d75-a2a7-950b74d27205	8365312597	week-pass	epayco	7.00	USD	pending	\N	\N	2026-01-05 06:46:17.928	2026-01-05 06:46:17.933065	\N	https://easybots.store/checkout/c2eb2f7e-76e2-4d75-a2a7-950b74d27205	\N	f	\N	\N
1a4093c9-1b8a-41c9-935c-577dfd8bc03b	1a4093c9-1b8a-41c9-935c-577dfd8bc03b	7263766501	monthly-pass	daimo	15.00	USD	pending	\N	\N	2026-01-05 09:01:10.275	2026-01-05 09:01:10.686088	\N	https://pay.daimo.com/checkout?id=6bvpZyCJZaMSYdvXABzXHPV2vYyPT7muTTczqtGKNDvz	\N	f	\N	\N
ec3991f0-2948-42b3-8c04-751110dc3ed2	ec3991f0-2948-42b3-8c04-751110dc3ed2	7263766501	week-pass	daimo	7.00	USD	pending	\N	\N	2026-01-05 09:02:51.176	2026-01-05 09:02:51.464954	\N	https://pay.daimo.com/checkout?id=eaeEHntbDkgGcDYhvgNXvPi5gEAkwG7btizbf7VFtaa	\N	f	\N	\N
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plans (id, sku, name, display_name, name_es, price, currency, duration_days, duration, features, features_es, active, is_lifetime, created_at, updated_at) FROM stdin;
week-pass	week-pass	Week Pass	Week Pass	Pase Semanal	7.00	USD	7	\N	{"7 days access","All basic features","Community access"}	{"Acceso por 7 días","Todas las funciones básicas","Acceso a la comunidad"}	t	f	2026-01-04 08:51:13.830719	2026-01-04 08:51:13.830719
monthly-pass	monthly-pass	Monthly Pass	Monthly Pass	Pase Mensual	15.00	USD	30	\N	{"30 days access","All basic features","Community access","Priority support"}	{"Acceso por 30 días","Todas las funciones básicas","Acceso a la comunidad","Soporte prioritario"}	t	f	2026-01-04 08:51:13.830719	2026-01-04 08:51:13.830719
3-month-pass	3-month-pass	3-Month Pass	3-Month Pass	Pase 3 Meses	40.00	USD	90	\N	{"90 days access","All premium features","Community access","Priority support","Save 11%"}	{"Acceso por 90 días","Todas las funciones premium","Acceso a la comunidad","Soporte prioritario","Ahorra 11%"}	t	f	2026-01-04 08:51:13.830719	2026-01-04 08:51:13.830719
6-month-pass	6-month-pass	6-Month Pass	6-Month Pass	Pase 6 Meses	75.00	USD	180	\N	{"180 days access","All premium features","Community access","Priority support","Save 17%"}	{"Acceso por 180 días","Todas las funciones premium","Acceso a la comunidad","Soporte prioritario","Ahorra 17%"}	t	f	2026-01-04 08:51:13.830719	2026-01-04 08:51:13.830719
yearly-pass	yearly-pass	Yearly Pass	Yearly Pass	Pase Anual	120.00	USD	365	\N	{"365 days access","All premium features","Community access","Priority support","Save 33%","Best value"}	{"Acceso por 365 días","Todas las funciones premium","Acceso a la comunidad","Soporte prioritario","Ahorra 33%","Mejor valor"}	t	f	2026-01-04 08:51:13.830719	2026-01-04 08:51:13.830719
\.


--
-- Data for Name: playlist_tracks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.playlist_tracks (id, playlist_id, track_id, track_order) FROM stdin;
\.


--
-- Data for Name: private_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.private_calls (id, caller_id, caller_username, receiver_id, receiver_username, user_name, payment_id, scheduled_date, scheduled_time, scheduled_at, duration, performer, status, call_type, started_at, ended_at, caller_rating, receiver_rating, caller_feedback, receiver_feedback, created_at, updated_at, user_id, meeting_url, reminder_sent, reminder_24h_sent, reminder_1h_sent, reminder_15min_sent, feedback_submitted, amount) FROM stdin;
\.


--
-- Data for Name: promo_code_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promo_code_usage (id, code, user_id, payment_id, discount_amount, used_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promo_codes (id, code, discount, discount_type, max_uses, current_uses, valid_until, min_amount, applicable_plans, active, created_at, created_by, deactivated_at) FROM stdin;
\.


--
-- Data for Name: radio_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_history (id, title, artist, duration, cover_url, played_at) FROM stdin;
\.


--
-- Data for Name: radio_listen_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_listen_history (id, user_id, track_id, session_id, listened_at, duration_seconds, completed, device_type, ip_address) FROM stdin;
\.


--
-- Data for Name: radio_now_playing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_now_playing (id, title, artist, duration, cover_url, started_at) FROM stdin;
\.


--
-- Data for Name: radio_playlists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_playlists (id, name, description, playlist_type, schedule_days, schedule_start_time, schedule_end_time, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_requests (id, user_id, song_name, artist, duration, status, requested_at, played_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_schedule (id, day_of_week, time_slot, program_name, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radio_subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_subscribers (user_id, notify_now_playing, notify_track_types, notify_new_uploads, subscribed_at, last_notified_at) FROM stdin;
\.


--
-- Data for Name: radio_tracks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radio_tracks (id, title, artist, album, audio_url, file_size_bytes, duration_seconds, type, genre, language, play_order, is_active, thumbnail_url, description, tags, play_count, skip_count, like_count, uploaded_by, upload_source, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: room_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.room_events (id, room_id, event_type, initiator_user_id, target_user_id, metadata, created_at) FROM stdin;
1	1	USER_JOINED_PUBLISHER	\N	8365312597	{}	2026-01-04 08:31:03.981153
\.


--
-- Data for Name: room_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.room_participants (id, room_id, user_id, user_name, is_publisher, is_moderator, joined_at, left_at, total_duration_seconds) FROM stdin;
\.


--
-- Data for Name: segment_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.segment_membership (id, segment_id, user_id, added_at) FROM stdin;
\.


--
-- Data for Name: stream_analytics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_analytics (id, stream_id, date, unique_viewers, total_views, total_messages, average_watch_time_seconds, peak_concurrent_viewers, engagement_rate, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stream_chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_chat_messages (id, message_id, stream_id, user_id, telegram_id, username, display_name, message_text, message_type, is_deleted, deleted_at, deleted_by, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: stream_moderators; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_moderators (id, stream_id, user_id, telegram_id, username, display_name, can_mute_users, can_delete_messages, can_ban_users, can_end_stream, added_at, added_by) FROM stdin;
\.


--
-- Data for Name: stream_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_notifications (id, user_id, streamer_id, subscribed_at, notifications_enabled) FROM stdin;
\.


--
-- Data for Name: stream_viewers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_viewers (id, stream_id, user_id, telegram_id, username, display_name, joined_at, left_at, watch_duration_seconds, messages_sent, reactions_sent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscribers (id, telegram_id, email, name, plan, subscription_id, provider, status, last_payment_at, created_at, updated_at) FROM stdin;
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
-- Data for Name: user_broadcast_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_broadcast_preferences (id, user_id, is_opted_out, opted_out_at, opted_out_reason, max_broadcasts_per_week, max_broadcasts_per_month, broadcasts_received_week, broadcasts_received_month, last_broadcast_at, preferred_send_hour, preferred_send_day, category_preferences, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_call_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_call_packages (id, user_id, package_id, package_name, total_calls, remaining_calls, used_calls, price, payment_id, purchased_at, expires_at, active, last_used_at, last_used_call_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_playlists; Type: TABLE DATA; Schema: public; Owner: pnptvbot
--

COPY public.user_playlists (id, user_id, title, description, category, icon, thumbnail, videos, is_public, video_count, creator_name, creator_badge, featured, created_at, updated_at) FROM stdin;
1	pnptv-official	Emotional Rollercoaster	A narrative journey through impulse, mental noise, intrusive thoughts, emotional numbness, breaking points, acceptance, and landing back in reality. Listen in order. Let each song do its work. It's not a party. It's a journey.	music	🎢	https://i.ytimg.com/vi/_9BGLtqqkVI/hqdefault.jpg	[{"url": "https://www.youtube.com/watch?v=_9BGLtqqkVI", "title": "1. Hash Pipe - Weezer", "description": "Impulso inicial: energía caótica, decisiones rápidas, cero filtro."}, {"url": "https://www.youtube.com/watch?v=4D35vfQ7eZg", "title": "2. Come Undone - Robbie Williams", "description": "La euforia empieza a agrietarse."}, {"url": "https://www.youtube.com/watch?v=asaCQOZpqUQ", "title": "3. Don't Let Me Get Me - P!nk", "description": "Auto-conflicto. Frustración."}, {"url": "https://www.youtube.com/watch?v=6TKYd-pHo1A", "title": "4. Berghain - Rosalía feat. Björk & Yves Tumor", "description": "Pensamientos intrusivos."}, {"url": "https://www.youtube.com/watch?v=yS8lkzNF-eU", "title": "5. Numb / Encore - Linkin Park & Jay-Z", "description": "Saturación total."}, {"url": "https://www.youtube.com/watch?v=SYM-RJwSGQ8", "title": "6. Habits (Stay High) - Tove Lo", "description": "El intento de escapar."}, {"url": "https://www.youtube.com/watch?v=8PtP3AO4Rgo", "title": "7. Novacane - Frank Ocean", "description": "Anestesia emocional."}, {"url": "https://www.youtube.com/watch?v=tG21lp8fNpM", "title": "8. When It Hurts So Bad - Lauryn Hill", "description": "El quiebre."}, {"url": "https://www.youtube.com/watch?v=vuGL6RZg_Gs", "title": "9. Don't Leave Home - Dido", "description": "Aislamiento. Miedo."}, {"url": "https://www.youtube.com/watch?v=j-GqgTX43wo", "title": "10. Tears Dry on Their Own - Amy Winehouse", "description": "Aceptación silenciosa."}, {"url": "https://www.youtube.com/watch?v=0MWlFi9d4c0", "title": "11. La Plata - Diomedes Díaz", "description": "Aterrizaje terrenal."}, {"url": "https://www.youtube.com/watch?v=JXRmZRmpsbE", "title": "12. Thank U - Alanis Morissette", "description": "Gratitud por lo aprendido."}]	t	12	PNPtv	👑	t	2026-01-04 10:29:00.511975	2026-01-04 10:29:00.511975
2	pnptv-system	Emotional Rollercoaster	A narrative journey through impulse, mental noise, intrusive thoughts, emotional numbness, breaking points, acceptance, and landing back in reality. Listen in order. Let each song do its work. It's not a party. It's a journey.	music	🎢	https://i.ytimg.com/vi/_9BGLtqqkVI/hqdefault.jpg	[{"url": "https://www.youtube.com/watch?v=_9BGLtqqkVI", "title": "1. Hash Pipe - Weezer", "description": "Impulso inicial: energía caótica, decisiones rápidas, cero filtro. El momento donde todo arranca sin pensar demasiado.\\n\\n🧠 Why does it open the playlist? It captures the initial impulse: chaotic energy, fast decisions, no filter. The moment everything starts without overthinking."}, {"url": "https://www.youtube.com/watch?v=4D35vfQ7eZg", "title": "2. Come Undone - Robbie Williams", "description": "La euforia empieza a agrietarse. Sigue siendo intensa, pero ya convive con ansiedad y pérdida de control.\\n\\n🧠 Why here? Euphoria starts to crack. It's still intense, but anxiety and loss of control begin to show."}, {"url": "https://www.youtube.com/watch?v=asaCQOZpqUQ", "title": "3. Don't Let Me Get Me - P!nk", "description": "Auto-conflicto. Frustración. La mente girando contra sí misma.\\n\\n🧠 What does it represent? Self-conflict. Frustration. The mind turning against itself."}, {"url": "https://www.youtube.com/watch?v=6TKYd-pHo1A", "title": "4. Berghain - Rosalía feat. Björk & Yves Tumor", "description": "Pensamientos intrusivos: introspección intensa, diálogo interno invasivo, ideas que no se pueden apagar. Aquí el viaje se vuelve mental.\\n\\n🧠 Why is Berghain placed here? It represents intrusive thoughts: intense introspection, invasive inner dialogue, ideas you can't shut off. This is where the journey turns inward."}, {"url": "https://www.youtube.com/watch?v=yS8lkzNF-eU", "title": "5. Numb / Encore - Linkin Park & Jay-Z", "description": "Saturación total. El ruido interno ya es constante y abrumador.\\n\\n🧠 Why next? Total saturation. The internal noise becomes constant and overwhelming."}, {"url": "https://www.youtube.com/watch?v=SYM-RJwSGQ8", "title": "6. Habits (Stay High) - Tove Lo", "description": "El intento de escapar. Repetición emocional. Loop.\\n\\n🧠 What stage is this? The attempt to escape. Emotional repetition. A loop."}, {"url": "https://www.youtube.com/watch?v=8PtP3AO4Rgo", "title": "7. Novacane - Frank Ocean", "description": "Anestesia emocional. Nada duele… pero nada se siente.\\n\\n🧠 Why here? Emotional numbness. Nothing hurts… but nothing is felt either."}, {"url": "https://www.youtube.com/watch?v=tG21lp8fNpM", "title": "8. When It Hurts So Bad - Lauryn Hill", "description": "El quiebre. La emoción que ya no se puede evitar.\\n\\n🧠 What happens here? The break. Emotion you can no longer avoid."}, {"url": "https://www.youtube.com/watch?v=vuGL6RZg_Gs", "title": "9. Don't Leave Home - Dido", "description": "Aislamiento. Miedo. Necesidad de refugio.\\n\\n🧠 What does it represent? Isolation. Fear. The need for shelter."}, {"url": "https://www.youtube.com/watch?v=j-GqgTX43wo", "title": "10. Tears Dry on Their Own - Amy Winehouse", "description": "Aceptación silenciosa. No todo se arregla, pero se sigue.\\n\\n🧠 Why before landing? Quiet acceptance. Not everything gets fixed, but you keep going."}, {"url": "https://www.youtube.com/watch?v=0MWlFi9d4c0", "title": "11. La Plata - Diomedes Díaz", "description": "Aterrizaje terrenal. Memoria, culpa, realidad cotidiana.\\n\\n🧠 What does it bring? A grounded landing. Memory, consequence, everyday reality."}, {"url": "https://www.youtube.com/watch?v=JXRmZRmpsbE", "title": "12. Thank U - Alanis Morissette", "description": "No es felicidad forzada. Es conciencia. Gratitud por lo aprendido, incluso por lo incómodo.\\n\\n🧠 Why does it close the playlist? Not forced happiness. Awareness. Gratitude for the lessons — even the uncomfortable ones."}]	t	12	PNPtv	👑	t	2026-01-05 00:55:11.494654	2026-01-05 00:55:11.494654
\.


--
-- Data for Name: user_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_segments (id, segment_id, created_by, name, description, filters, estimated_count, actual_count, last_recalculated_at, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, first_name, last_name, email, email_verified, bio, photo_file_id, photo_updated_at, interests, location_lat, location_lng, location_name, location_geohash, location_updated_at, subscription_status, tier, plan_id, plan_expiry, language, onboarding_complete, age_verified, terms_accepted, created_at, updated_at, role, privacy, blocked, notifications_enabled, last_active, referral_code, referred_by, profile_views, xp, favorites, badges, privacy_accepted, is_active, instagram, twitter, tiktok, youtube, telegram) FROM stdin;
1760801274	place290	Place	Holder	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:29:13.951	en	f	f	f	2026-01-04 14:09:42.108876	2026-01-05 06:29:13.951231	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 14:09:42.108876	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7185383111	Red52000	Jay	Rydbeck	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 08:54:26.819851	2026-01-04 08:54:26.819851	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 08:54:26.819851	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8365312597	sxntinx	Santino - offline for tonight	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:28:58.273	en	t	f	f	2026-01-04 08:30:01.570787	2026-01-05 06:28:58.274349	admin	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 08:30:01.570787	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6722783063	giyuuxcrush	Tu_ Senpai_Peludooo🐻	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 09:36:50.281426	2026-01-04 09:41:20.517889	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:36:50.281426	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
1927422318	underscorenyc	No	Name	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 13:06:54.677124	2026-01-04 13:07:41.272598	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 13:06:54.677124	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6511046349	PinOnIce	13197	Prin	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	th	f	f	f	2026-01-04 09:46:13.878339	2026-01-04 09:46:13.878339	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:46:13.878339	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7962392381	juniormoratta	🇧🇷Junior	Moratta🇧🇷	juniormoratta@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 09:24:41.708097	2026-01-04 09:27:24.361041	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:24:41.708097	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
1071160931	SUIRODEF	Fedorius	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 09:41:19.971899	2026-01-04 11:01:24.331797	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:41:19.971899	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
7872984890	\N	ᅠ	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 11:11:13.486137	2026-01-04 11:11:13.486137	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 11:11:13.486137	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7099312875	wrldtravl	T	S	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 09:24:19.599792	2026-01-04 09:29:07.656289	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:24:19.599792	\N	\N	0	0	{}	{spun_royal}	f	t	\N	\N	\N	\N	\N
7942547805	nathanielane	Type	Dangerous	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 11:36:04.222	en	f	f	f	2026-01-04 12:14:16.203927	2026-01-05 11:36:04.222837	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 12:14:16.203927	\N	\N	0	0	{}	{spun_royal,slam_slut}	f	t	\N	\N	\N	\N	\N
1333424527	KinkyLdnTop	Master Max	(+pig)	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	ru	f	f	f	2026-01-04 11:21:01.30473	2026-01-04 11:21:01.30473	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 11:21:01.30473	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
2081444200	Antoniojgr	A	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 11:34:33.014705	2026-01-04 11:34:33.014705	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 11:34:33.014705	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6433613479	manuvic27	Victor	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 09:48:50.866118	2026-01-04 09:49:29.469234	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:48:50.866118	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8581438778	invisiblemeaty	Guy	Hellen	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 09:53:29.990516	2026-01-04 09:53:29.990516	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:53:29.990516	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8337713325	\N	Luca	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 10:01:45.190641	2026-01-04 10:01:45.190641	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 10:01:45.190641	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7895662345	IceBBfunbtm	Nice hairy guy	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	zh-hant	f	f	f	2026-01-04 13:18:36.320244	2026-01-04 13:18:36.320244	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 13:18:36.320244	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7948044764	Kitans10	Kitan's	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 13:43:03.687277	2026-01-04 13:43:03.687277	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 13:43:03.687277	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
2108855269	pelonact	Ric	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 13:58:20.570257	2026-01-04 14:02:30.328881	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 13:58:20.570257	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
8343582666	Javniztrik	Putito	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 14:30:44.811181	2026-01-04 14:30:44.811181	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 14:30:44.811181	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7158699141	\N	Raul	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:36:49.233	es	f	f	f	2026-01-04 09:05:43.111898	2026-01-05 06:36:49.233823	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 09:05:43.111898	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
1324803960	\N	Hf	Hf	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 14:26:53.896006	2026-01-04 14:27:30.087397	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 14:26:53.896006	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
8569671029	luisfelipe091	Luis	Felipe	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 14:29:25.501076	2026-01-04 14:45:36.534182	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 14:29:25.501076	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5996415417	felyx16	feliciano	ortega	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 16:54:18.501346	2026-01-04 16:55:34.258292	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 16:54:18.501346	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
670994589	YiQin2019	Nimoi X	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 16:56:46.374068	2026-01-04 16:56:46.374068	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 16:56:46.374068	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5944968019	che2j2	CJ	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 09:32:03.16436	2026-01-05 01:07:57.126034	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":false,"showOnline":true}	{}	t	2026-01-04 09:32:03.16436	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6961290452	KKGERMM	K	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 16:58:16.827794	2026-01-04 16:58:46.631648	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 16:58:16.827794	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7478136172	BlowinWhirlwindz	Mikal	\N	blowmikal@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 17:08:21.16081	2026-01-04 17:11:32.950092	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 17:08:21.16081	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
1326048009	Tms185	T	N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	de	f	f	f	2026-01-04 17:22:36.382885	2026-01-04 17:22:36.382885	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 17:22:36.382885	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6974056284	\N	J	P	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 17:58:13.280273	2026-01-04 17:58:13.280273	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 17:58:13.280273	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
540482380	Yuekiu	Yuekiu	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:29:02.834	es	f	f	f	2026-01-05 01:21:31.760422	2026-01-05 06:29:02.834702	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 01:21:31.760422	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7199252565	\N	ELLIOT	LEONEL	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 18:00:31.301561	2026-01-04 21:50:37.711239	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 18:00:31.301561	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
1871708911	jeffny456	jeffny456	\N	jeffny456@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 18:42:02.30177	2026-01-04 18:49:41.12292	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 18:42:02.30177	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
8581651013	\N	Lcm	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 19:19:41.806583	2026-01-05 00:34:03.185062	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 19:19:41.806583	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7119643265	\N	Paul	Greene	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 19:31:23.025372	2026-01-04 19:31:23.025372	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 19:31:23.025372	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7110713697	\N	Horny	Yungbutt	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 18:53:19.946563	2026-01-04 19:37:32.775018	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 18:53:19.946563	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8375669090	Iszhan7	Porcelain77	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 20:31:33.449335	2026-01-04 20:32:29.493416	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 20:31:33.449335	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5849505145	ms601fx	FireFX	\N	fx4msguy@gmail.com	f	51, 6 ft 4 in,  243 lbs    US	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 22:10:45.411243	2026-01-04 22:25:33.852678	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 22:10:45.411243	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6563124641	CesPDX24	CesPDXT	30	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 21:50:43.287875	2026-01-04 21:52:10.31675	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 21:50:43.287875	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
494202706	ed168	Ed	2018	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:28:55.146	en	f	f	f	2026-01-04 21:40:42.493783	2026-01-05 06:28:55.146437	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 21:40:42.493783	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8056915969	\N	Rico	Juan	jamwill33@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 21:56:37.469019	2026-01-04 21:59:44.785149	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 21:56:37.469019	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8531648956	\N	Andrés	Toro	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-04 22:12:50.724319	2026-01-04 22:17:31.727033	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 22:12:50.724319	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8420070507	VerbalVers92	Sam	Southern	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 01:15:10.801604	2026-01-05 10:08:19.078641	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 01:15:10.801604	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
8387531332	\N	Jermey	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 22:33:41.915338	2026-01-04 22:34:42.914588	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 22:33:41.915338	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7849654881	xtm_88	.	\N	jasontidus@gmail.com	f	\N	AgACAgUAAxkBAAJABGla7wyUEC5i25cwnlRjH4_GB1ihAAJ-C2sb9nzYVoUgVbfVZwyKAQADAgADeQADOAQ	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-04 22:41:43.865877	2026-01-04 22:51:56.22063	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 22:41:43.865877	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
1707171479	jpcalv	J P	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 00:39:36.231354	2026-01-05 00:40:46.031432	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 00:39:36.231354	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
8529551929	kikemadddd	Enrique	Granaanei	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 06:29:49.551	es	f	f	f	2026-01-05 01:35:05.341114	2026-01-05 06:29:49.551752	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 01:35:05.341114	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
8317267504	\N	Yuz 😶‍🌫️	\N	jmortizaisc@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 01:31:08.638406	2026-01-05 01:31:30.175057	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 01:31:08.638406	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7246621722	PNPLatinoBoy	PNP	LATINO TV	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 01:56:23.598076	2026-01-05 01:56:36.550208	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 01:56:23.598076	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7775881622	\N	An	Dres	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 02:08:56.381044	2026-01-05 02:08:56.381044	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 02:08:56.381044	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8330417392	HOISERPIG	Hello	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 02:09:08.688683	2026-01-05 02:09:08.688683	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 02:09:08.688683	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7017953391	kaikaikan	k	k	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	zh-hans	f	f	f	2026-01-05 02:18:58.670545	2026-01-05 02:18:58.670545	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 02:18:58.670545	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7678653235	\N	Michael	Palmer	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 06:04:24.19796	2026-01-05 06:04:24.19796	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 06:04:24.19796	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8591407441	\N	John	Lopez	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 06:08:42.813558	2026-01-05 06:08:43.036563	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 06:08:42.813558	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8053704275	\N	Amarantha	Rodríguez	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 02:50:14.584562	2026-01-05 02:50:14.584562	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 02:50:14.584562	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6803391488	\N	Jesús Cáceres Torrealba	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 03:10:01.650055	2026-01-05 03:10:01.650055	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 03:10:01.650055	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8241587439	\N	Mati	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 03:18:42.607976	2026-01-05 03:18:42.607976	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 03:18:42.607976	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6983593708	sindjdi	Mc	\N	\N	f	\N	\N	\N	{}	40.642872	-74.01146	\N	\N	2026-01-05 10:07:18.47853	free	free	\N	\N	en	f	f	f	2026-01-05 08:40:44.799365	2026-01-05 10:07:18.47853	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 08:40:44.799365	\N	\N	0	0	{}	{chem_mermaids}	f	t	\N	\N	\N	\N	\N
1974492346	Proper_dave	Proper_dave🇦🇺	\N	\N	f	Delete	AgACAgUAAxkBAAJBw2lbXaz_xxmsrdi8V-G2pvPqBq99AALHDGsbn8nYVuXArTTX84awAQADAgADeQADOAQ	\N	{Films,books,Sci-fi,birdwatching,"going to zoos","being a sleazy pig"}	-37.891893	145.042461	\N	\N	2026-01-05 05:36:07.627912	active	free	community_premium_2026-01-05	2026-01-06 06:41:56.579	en	f	f	f	2026-01-04 20:41:19.074688	2026-01-05 06:47:08.833454	user	{"showLocation":true,"showInterests":true,"showBio":false,"allowMessages":true,"showOnline":true}	{}	t	2026-01-04 20:41:19.074688	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
8484504532	Fill_Up_25	Phill	Up	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 06:51:57.179936	2026-01-05 06:51:57.179936	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 06:51:57.179936	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7713202458	ThisHelpsInTheory	Well…	ThisHelpsInTheory	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 03:54:59.00641	2026-01-05 04:06:34.140252	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 03:54:59.00641	\N	\N	0	0	{}	{spun_royal}	f	t	\N	\N	\N	\N	\N
721048811	awesomeRPR	Rpr	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 04:12:32.514307	2026-01-05 04:12:32.514307	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 04:12:32.514307	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6275897553	Hansmorris	欸逼	RrRr	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 04:10:39.355212	2026-01-05 04:25:29.312417	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 04:10:39.355212	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5675275182	\N	Adal	Ponce	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 04:34:06.819832	2026-01-05 04:34:06.819832	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 04:34:06.819832	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7862359954	YSRAPAT	Ysrapat	.Y	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 04:36:58.469585	2026-01-05 04:37:25.132891	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 04:36:58.469585	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5489955139	mcaorlando	Mark	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 04:38:43.193328	2026-01-05 04:41:22.946673	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 04:38:43.193328	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8243602526	MexVersTop	MexVersTop	\N	ritzukasaint@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 07:03:11.961377	2026-01-05 07:13:42.051462	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:03:11.961377	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6354561740	\N	M	M	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 07:23:12.239413	2026-01-05 07:23:43.196744	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:23:12.239413	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6620123243	Oddtwink22	PJ	S	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 07:26:47.950579	2026-01-05 07:26:47.950579	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:26:47.950579	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6732898304	Yuyosple	J	Lz	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 07:16:53.932414	2026-01-05 07:17:32.244249	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:16:53.932414	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6707117613	\N	K	P	amosking930@gmail.com	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	active	free	community_premium_2026-01-05	2026-01-06 07:37:32.86	en	f	f	f	2026-01-05 02:20:01.667935	2026-01-05 07:37:32.860291	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 02:20:01.667935	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
8081026550	\N	enrique	v	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 07:49:23.958903	2026-01-05 07:49:39.118748	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:49:23.958903	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8364016947	\N	🤪	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 07:49:07.659118	2026-01-05 07:51:01.132779	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:49:07.659118	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
742351654	Jerkywong	Jerky	Wong	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 07:54:43.605068	2026-01-05 07:55:38.434894	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 07:54:43.605068	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8357808060	Georgianative01	Dong	In Need Of	\N	f	\N	\N	\N	{}	30.955265	-83.738491	\N	\N	2026-01-05 09:10:43.998518	active	free	community_premium_2026-01-05	2026-01-06 06:29:03.884	en	f	f	f	2026-01-05 05:45:13.771633	2026-01-05 09:10:43.998518	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 05:45:13.771633	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7263766501	\N	W	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 09:00:21.90868	2026-01-05 09:02:01.409557	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 09:00:21.90868	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
8595494168	socaltito	.	.	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 08:24:47.400051	2026-01-05 10:23:20.644879	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 08:24:47.400051	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6496516609	TiMe4ParTy2	PartyTime!	\N	\N	f	Inhale Inhale Inhale \nExhale Exhale Exhale	AgACAgQAAxkBAAJC5mlbk87T3QbXRTwalRDe_Rnf9ffdAAKrC2sb2aXgUopERA_osQ26AQADAgADeQADOAQ	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 10:15:52.086956	2026-01-05 10:38:57.325386	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 10:15:52.086956	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
5586839416	flako1514	Flacco	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 11:32:42.603434	2026-01-05 11:33:54.143924	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 11:32:42.603434	\N	\N	0	0	{}	{meth_alpha}	f	t	\N	\N	\N	\N	\N
7175983259	\N	Fabián	Ramos	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 11:37:40.411178	2026-01-05 11:37:40.411178	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 11:37:40.411178	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6681745585	\N	Danny	Hot	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	es	f	f	f	2026-01-05 11:47:20.837442	2026-01-05 11:47:20.837442	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 11:47:20.837442	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
7863402684	E3T4P	CA_RL	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 11:50:58.237523	2026-01-05 11:50:58.237523	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 11:50:58.237523	\N	\N	0	0	{}	{}	f	t	\N	\N	\N	\N	\N
6990697316	\N	THM	\N	\N	f	\N	\N	\N	{}	\N	\N	\N	\N	\N	free	free	\N	\N	en	f	f	f	2026-01-05 12:00:04.304601	2026-01-05 12:01:05.38945	user	{"showLocation":true,"showInterests":true,"showBio":true,"allowMessages":true,"showOnline":true}	{}	t	2026-01-05 12:00:04.304601	\N	\N	0	0	{}	{slam_slut}	f	t	\N	\N	\N	\N	\N
\.


--
-- Data for Name: video_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_calls (id, creator_id, creator_name, channel_name, title, is_active, max_participants, current_participants, enforce_camera, allow_guests, is_public, created_at, ended_at, duration_seconds, recording_enabled, recording_url, metadata) FROM stdin;
\.


--
-- Data for Name: webinar_registrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webinar_registrations (id, webinar_id, user_id, user_name, user_email, registered_at, attended, joined_at, left_at, reminder_sent_1d, reminder_sent_1h, reminder_sent_10m) FROM stdin;
\.


--
-- Data for Name: webinars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webinars (id, title, description, thumbnail_url, scheduled_for, duration_minutes, channel_name, host_id, max_attendees, current_attendees, status, enforce_camera, allow_questions, enable_chat, recording_enabled, recording_url, started_at, ended_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: call_availability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.call_availability_id_seq', 1, false);


--
-- Name: call_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.call_participants_id_seq', 1, false);


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
-- Name: community_post_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_post_schedules_id_seq', 1, false);


--
-- Name: community_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.community_posts_id_seq', 1, false);


--
-- Name: group_invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.group_invitations_id_seq', 36, true);


--
-- Name: live_streams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.live_streams_id_seq', 1, false);


--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.playlist_tracks_id_seq', 1, false);


--
-- Name: radio_listen_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.radio_listen_history_id_seq', 1, false);


--
-- Name: room_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.room_events_id_seq', 1, true);


--
-- Name: room_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.room_participants_id_seq', 1, true);


--
-- Name: segment_membership_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.segment_membership_id_seq', 1, false);


--
-- Name: stream_analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_analytics_id_seq', 1, false);


--
-- Name: stream_chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_chat_messages_id_seq', 1, false);


--
-- Name: stream_moderators_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_moderators_id_seq', 1, false);


--
-- Name: stream_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_notifications_id_seq', 1, false);


--
-- Name: stream_viewers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
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
-- Name: user_broadcast_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_broadcast_preferences_id_seq', 1, false);


--
-- Name: user_playlists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pnptvbot
--

SELECT pg_catalog.setval('public.user_playlists_id_seq', 2, true);


--
-- Name: user_segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_segments_id_seq', 1, false);


--
-- Name: webinar_registrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.webinar_registrations_id_seq', 1, false);


--
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (code);


--
-- Name: activation_logs activation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activation_logs
    ADD CONSTRAINT activation_logs_pkey PRIMARY KEY (id);


--
-- Name: agora_channels agora_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agora_channels
    ADD CONSTRAINT agora_channels_pkey PRIMARY KEY (channel_name);


--
-- Name: broadcasts broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_pkey PRIMARY KEY (id);


--
-- Name: call_availability call_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_availability
    ADD CONSTRAINT call_availability_pkey PRIMARY KEY (id);


--
-- Name: call_feedback call_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_feedback
    ADD CONSTRAINT call_feedback_pkey PRIMARY KEY (id);


--
-- Name: call_packages call_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_packages
    ADD CONSTRAINT call_packages_pkey PRIMARY KEY (id);


--
-- Name: call_participants call_participants_call_id_user_id_joined_at_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_call_id_user_id_joined_at_key UNIQUE (call_id, user_id, joined_at);


--
-- Name: call_participants call_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_pkey PRIMARY KEY (id);


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
-- Name: emotes emotes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emotes
    ADD CONSTRAINT emotes_name_key UNIQUE (name);


--
-- Name: emotes emotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emotes
    ADD CONSTRAINT emotes_pkey PRIMARY KEY (id);


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
-- Name: group_settings group_settings_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_settings
    ADD CONSTRAINT group_settings_group_id_key UNIQUE (group_id);


--
-- Name: group_settings group_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_settings
    ADD CONSTRAINT group_settings_pkey PRIMARY KEY (id);


--
-- Name: live_streams live_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_pkey PRIMARY KEY (id);


--
-- Name: live_streams live_streams_room_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_room_name_key UNIQUE (room_name);


--
-- Name: live_streams live_streams_stream_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_stream_id_key UNIQUE (stream_id);


--
-- Name: main_rooms main_rooms_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.main_rooms
    ADD CONSTRAINT main_rooms_channel_name_key UNIQUE (channel_name);


--
-- Name: main_rooms main_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.main_rooms
    ADD CONSTRAINT main_rooms_pkey PRIMARY KEY (id);


--
-- Name: menu_configs menu_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_configs
    ADD CONSTRAINT menu_configs_pkey PRIMARY KEY (id);


--
-- Name: moderation_logs moderation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moderation_logs
    ADD CONSTRAINT moderation_logs_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_reference_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reference_key UNIQUE (reference);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: plans plans_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_sku_key UNIQUE (sku);


--
-- Name: playlist_tracks playlist_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (id);


--
-- Name: playlist_tracks playlist_tracks_playlist_id_track_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_playlist_id_track_id_key UNIQUE (playlist_id, track_id);


--
-- Name: private_calls private_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_calls
    ADD CONSTRAINT private_calls_pkey PRIMARY KEY (id);


--
-- Name: promo_code_usage promo_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: radio_history radio_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_history
    ADD CONSTRAINT radio_history_pkey PRIMARY KEY (id);


--
-- Name: radio_listen_history radio_listen_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_listen_history
    ADD CONSTRAINT radio_listen_history_pkey PRIMARY KEY (id);


--
-- Name: radio_now_playing radio_now_playing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_now_playing
    ADD CONSTRAINT radio_now_playing_pkey PRIMARY KEY (id);


--
-- Name: radio_playlists radio_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_playlists
    ADD CONSTRAINT radio_playlists_pkey PRIMARY KEY (id);


--
-- Name: radio_requests radio_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_requests
    ADD CONSTRAINT radio_requests_pkey PRIMARY KEY (id);


--
-- Name: radio_schedule radio_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_schedule
    ADD CONSTRAINT radio_schedule_pkey PRIMARY KEY (id);


--
-- Name: radio_subscribers radio_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_subscribers
    ADD CONSTRAINT radio_subscribers_pkey PRIMARY KEY (user_id);


--
-- Name: radio_tracks radio_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_tracks
    ADD CONSTRAINT radio_tracks_pkey PRIMARY KEY (id);


--
-- Name: room_events room_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_events
    ADD CONSTRAINT room_events_pkey PRIMARY KEY (id);


--
-- Name: room_participants room_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_pkey PRIMARY KEY (id);


--
-- Name: room_participants room_participants_room_id_user_id_joined_at_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_room_id_user_id_joined_at_key UNIQUE (room_id, user_id, joined_at);


--
-- Name: segment_membership segment_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_pkey PRIMARY KEY (id);


--
-- Name: segment_membership segment_membership_segment_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_segment_id_user_id_key UNIQUE (segment_id, user_id);


--
-- Name: stream_analytics stream_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_analytics
    ADD CONSTRAINT stream_analytics_pkey PRIMARY KEY (id);


--
-- Name: stream_analytics stream_analytics_stream_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_analytics
    ADD CONSTRAINT stream_analytics_stream_id_date_key UNIQUE (stream_id, date);


--
-- Name: stream_chat_messages stream_chat_messages_message_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_chat_messages
    ADD CONSTRAINT stream_chat_messages_message_id_key UNIQUE (message_id);


--
-- Name: stream_chat_messages stream_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_chat_messages
    ADD CONSTRAINT stream_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: stream_moderators stream_moderators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderators
    ADD CONSTRAINT stream_moderators_pkey PRIMARY KEY (id);


--
-- Name: stream_moderators stream_moderators_stream_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderators
    ADD CONSTRAINT stream_moderators_stream_id_user_id_key UNIQUE (stream_id, user_id);


--
-- Name: stream_notifications stream_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_pkey PRIMARY KEY (id);


--
-- Name: stream_notifications stream_notifications_user_id_streamer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_user_id_streamer_id_key UNIQUE (user_id, streamer_id);


--
-- Name: stream_viewers stream_viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_viewers
    ADD CONSTRAINT stream_viewers_pkey PRIMARY KEY (id);


--
-- Name: stream_viewers stream_viewers_stream_id_user_id_left_at_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_viewers
    ADD CONSTRAINT stream_viewers_stream_id_user_id_left_at_key UNIQUE (stream_id, user_id, left_at);


--
-- Name: subscribers subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_email_key UNIQUE (email);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


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
-- Name: user_broadcast_preferences user_broadcast_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_broadcast_preferences user_broadcast_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_call_packages user_call_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_call_packages
    ADD CONSTRAINT user_call_packages_pkey PRIMARY KEY (id);


--
-- Name: user_playlists user_playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: pnptvbot
--

ALTER TABLE ONLY public.user_playlists
    ADD CONSTRAINT user_playlists_pkey PRIMARY KEY (id);


--
-- Name: user_segments user_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_pkey PRIMARY KEY (id);


--
-- Name: user_segments user_segments_segment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_segment_id_key UNIQUE (segment_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: video_calls video_calls_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_channel_name_key UNIQUE (channel_name);


--
-- Name: video_calls video_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_calls
    ADD CONSTRAINT video_calls_pkey PRIMARY KEY (id);


--
-- Name: webinar_registrations webinar_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinar_registrations
    ADD CONSTRAINT webinar_registrations_pkey PRIMARY KEY (id);


--
-- Name: webinar_registrations webinar_registrations_webinar_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinar_registrations
    ADD CONSTRAINT webinar_registrations_webinar_id_user_id_key UNIQUE (webinar_id, user_id);


--
-- Name: webinars webinars_channel_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinars
    ADD CONSTRAINT webinars_channel_name_key UNIQUE (channel_name);


--
-- Name: webinars webinars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinars
    ADD CONSTRAINT webinars_pkey PRIMARY KEY (id);


--
-- Name: idx_activation_codes_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_expires_at ON public.activation_codes USING btree (expires_at);


--
-- Name: idx_activation_codes_used; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_used ON public.activation_codes USING btree (used);


--
-- Name: idx_activation_codes_used_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_used_by ON public.activation_codes USING btree (used_by);


--
-- Name: idx_activation_logs_activated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_logs_activated_at ON public.activation_logs USING btree (activated_at);


--
-- Name: idx_activation_logs_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_logs_code ON public.activation_logs USING btree (code);


--
-- Name: idx_activation_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_logs_user_id ON public.activation_logs USING btree (user_id);


--
-- Name: idx_agora_channels_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agora_channels_active ON public.agora_channels USING btree (is_active, feature_name);


--
-- Name: idx_agora_channels_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agora_channels_type ON public.agora_channels USING btree (channel_type, is_active);


--
-- Name: idx_analytics_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_date ON public.stream_analytics USING btree (date);


--
-- Name: idx_analytics_posts; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_posts ON public.topic_analytics USING btree (total_posts DESC);


--
-- Name: idx_analytics_reactions; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_reactions ON public.topic_analytics USING btree (total_reactions_given DESC);


--
-- Name: idx_analytics_stream; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_stream ON public.stream_analytics USING btree (stream_id);


--
-- Name: idx_analytics_topic; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_topic ON public.topic_analytics USING btree (topic_id);


--
-- Name: idx_analytics_user; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_analytics_user ON public.topic_analytics USING btree (user_id);


--
-- Name: idx_call_feedback_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_feedback_call_id ON public.call_feedback USING btree (call_id);


--
-- Name: idx_call_feedback_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_feedback_created_at ON public.call_feedback USING btree (created_at);


--
-- Name: idx_call_feedback_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_feedback_rating ON public.call_feedback USING btree (rating);


--
-- Name: idx_call_feedback_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_feedback_user_id ON public.call_feedback USING btree (user_id);


--
-- Name: idx_call_participants_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_participants_call_id ON public.call_participants USING btree (call_id);


--
-- Name: idx_call_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_participants_user_id ON public.call_participants USING btree (user_id);


--
-- Name: idx_chat_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_deleted ON public.stream_chat_messages USING btree (is_deleted);


--
-- Name: idx_chat_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_recent ON public.stream_chat_messages USING btree (stream_id, sent_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_chat_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_sent_at ON public.stream_chat_messages USING btree (sent_at);


--
-- Name: idx_chat_stream_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_stream_id ON public.stream_chat_messages USING btree (stream_id);


--
-- Name: idx_chat_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_user_id ON public.stream_chat_messages USING btree (user_id);


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
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_created_at ON public.live_streams USING btree (created_at);


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
-- Name: idx_group_settings_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_settings_group_id ON public.group_settings USING btree (group_id);


--
-- Name: idx_host_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_host_user_id ON public.live_streams USING btree (host_user_id);


--
-- Name: idx_live_streams_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_streams_active ON public.live_streams USING btree (status) WHERE ((status)::text = 'live'::text);


--
-- Name: idx_live_streams_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_streams_status ON public.live_streams USING btree (status);


--
-- Name: idx_live_streams_viewers; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_streams_viewers ON public.live_streams USING btree (current_viewers DESC);


--
-- Name: idx_menu_configs_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_configs_order ON public.menu_configs USING btree (order_position);


--
-- Name: idx_menu_configs_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_configs_parent_id ON public.menu_configs USING btree (parent_id);


--
-- Name: idx_menu_configs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_configs_status ON public.menu_configs USING btree (status);


--
-- Name: idx_menu_configs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_menu_configs_type ON public.menu_configs USING btree (type);


--
-- Name: idx_moderation_logs_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_moderation_logs_group_id ON public.moderation_logs USING btree (group_id);


--
-- Name: idx_moderation_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_moderation_logs_timestamp ON public.moderation_logs USING btree ("timestamp");


--
-- Name: idx_moderation_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_moderation_logs_user_id ON public.moderation_logs USING btree (user_id);


--
-- Name: idx_moderators_stream; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_moderators_stream ON public.stream_moderators USING btree (stream_id);


--
-- Name: idx_moderators_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_moderators_user ON public.stream_moderators USING btree (user_id);


--
-- Name: idx_playlist_tracks_playlist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks USING btree (playlist_id, track_order);


--
-- Name: idx_private_calls_caller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_private_calls_caller_id ON public.private_calls USING btree (caller_id);


--
-- Name: idx_private_calls_receiver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_private_calls_receiver_id ON public.private_calls USING btree (receiver_id);


--
-- Name: idx_private_calls_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_private_calls_scheduled_at ON public.private_calls USING btree (scheduled_at);


--
-- Name: idx_private_calls_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_private_calls_status ON public.private_calls USING btree (status);


--
-- Name: idx_promo_code_usage_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_code_usage_code ON public.promo_code_usage USING btree (code);


--
-- Name: idx_promo_code_usage_used_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_code_usage_used_at ON public.promo_code_usage USING btree (used_at);


--
-- Name: idx_promo_code_usage_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_code_usage_user_id ON public.promo_code_usage USING btree (user_id);


--
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (active);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);


--
-- Name: idx_radio_history_played_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_history_played_at ON public.radio_history USING btree (played_at);


--
-- Name: idx_radio_listen_history_track; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_listen_history_track ON public.radio_listen_history USING btree (track_id, listened_at DESC);


--
-- Name: idx_radio_listen_history_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_listen_history_user ON public.radio_listen_history USING btree (user_id, listened_at DESC);


--
-- Name: idx_radio_now_playing_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_now_playing_started_at ON public.radio_now_playing USING btree (started_at);


--
-- Name: idx_radio_requests_requested_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_requests_requested_at ON public.radio_requests USING btree (requested_at);


--
-- Name: idx_radio_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_requests_status ON public.radio_requests USING btree (status);


--
-- Name: idx_radio_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_requests_user_id ON public.radio_requests USING btree (user_id);


--
-- Name: idx_radio_schedule_day_of_week; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_schedule_day_of_week ON public.radio_schedule USING btree (day_of_week);


--
-- Name: idx_radio_tracks_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_tracks_active ON public.radio_tracks USING btree (is_active, play_order);


--
-- Name: idx_radio_tracks_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radio_tracks_type ON public.radio_tracks USING btree (type, is_active);


--
-- Name: idx_room_events_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_room_events_room_id ON public.room_events USING btree (room_id, created_at DESC);


--
-- Name: idx_room_participants_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_room_participants_room_id ON public.room_participants USING btree (room_id);


--
-- Name: idx_room_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_room_participants_user_id ON public.room_participants USING btree (user_id);


--
-- Name: idx_scheduled_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_start ON public.live_streams USING btree (scheduled_start_time);


--
-- Name: idx_segment_membership_segment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segment_membership_segment_id ON public.segment_membership USING btree (segment_id);


--
-- Name: idx_segment_membership_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segment_membership_user_id ON public.segment_membership USING btree (user_id);


--
-- Name: idx_segments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_created_at ON public.user_segments USING btree (created_at DESC);


--
-- Name: idx_segments_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_created_by ON public.user_segments USING btree (created_by);


--
-- Name: idx_segments_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_is_active ON public.user_segments USING btree (is_active);


--
-- Name: idx_segments_segment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_segment_id ON public.user_segments USING btree (segment_id);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_status ON public.live_streams USING btree (status);


--
-- Name: idx_stream_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_id ON public.live_streams USING btree (stream_id);


--
-- Name: idx_stream_notifications_streamer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_notifications_streamer_id ON public.stream_notifications USING btree (streamer_id);


--
-- Name: idx_stream_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_notifications_user_id ON public.stream_notifications USING btree (user_id);


--
-- Name: idx_stream_viewers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_active ON public.stream_viewers USING btree (stream_id, left_at) WHERE (left_at IS NULL);


--
-- Name: idx_stream_viewers_joined; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_joined ON public.stream_viewers USING btree (joined_at);


--
-- Name: idx_stream_viewers_left_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_left_at ON public.stream_viewers USING btree (left_at);


--
-- Name: idx_stream_viewers_stream; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_stream ON public.stream_viewers USING btree (stream_id);


--
-- Name: idx_stream_viewers_stream_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_stream_id ON public.stream_viewers USING btree (stream_id);


--
-- Name: idx_stream_viewers_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stream_viewers_user ON public.stream_viewers USING btree (user_id);


--
-- Name: idx_subscribers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscribers_email ON public.subscribers USING btree (email);


--
-- Name: idx_subscribers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscribers_status ON public.subscribers USING btree (status);


--
-- Name: idx_subscribers_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscribers_subscription_id ON public.subscribers USING btree (subscription_id);


--
-- Name: idx_subscribers_telegram_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscribers_telegram_id ON public.subscribers USING btree (telegram_id);


--
-- Name: idx_topic_config_group; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_topic_config_group ON public.topic_configuration USING btree (group_id);


--
-- Name: idx_user_packages_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_packages_active ON public.user_call_packages USING btree (active);


--
-- Name: idx_user_packages_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_packages_expires ON public.user_call_packages USING btree (expires_at);


--
-- Name: idx_user_packages_remaining; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_packages_remaining ON public.user_call_packages USING btree (remaining_calls);


--
-- Name: idx_user_packages_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_packages_user_id ON public.user_call_packages USING btree (user_id);


--
-- Name: idx_user_playlists_category; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_playlists_category ON public.user_playlists USING btree (category);


--
-- Name: idx_user_playlists_is_public; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_playlists_is_public ON public.user_playlists USING btree (is_public);


--
-- Name: idx_user_playlists_user_id; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_user_playlists_user_id ON public.user_playlists USING btree (user_id);


--
-- Name: idx_user_prefs_is_opted_out; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_prefs_is_opted_out ON public.user_broadcast_preferences USING btree (is_opted_out);


--
-- Name: idx_user_prefs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_prefs_status ON public.user_broadcast_preferences USING btree (status);


--
-- Name: idx_user_prefs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_prefs_user_id ON public.user_broadcast_preferences USING btree (user_id);


--
-- Name: idx_users_instagram; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_instagram ON public.users USING btree (instagram);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_profile_views; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_profile_views ON public.users USING btree (profile_views DESC);


--
-- Name: idx_users_tiktok; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tiktok ON public.users USING btree (tiktok);


--
-- Name: idx_users_twitter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_twitter ON public.users USING btree (twitter);


--
-- Name: idx_users_xp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_xp ON public.users USING btree (xp DESC);


--
-- Name: idx_video_calls_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_calls_active ON public.video_calls USING btree (is_active, created_at DESC);


--
-- Name: idx_video_calls_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_calls_creator ON public.video_calls USING btree (creator_id);


--
-- Name: idx_violations_timestamp; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_violations_timestamp ON public.topic_violations USING btree ("timestamp");


--
-- Name: idx_violations_user_topic; Type: INDEX; Schema: public; Owner: pnptvbot
--

CREATE INDEX idx_violations_user_topic ON public.topic_violations USING btree (user_id, topic_id);


--
-- Name: idx_webinar_registrations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webinar_registrations_user_id ON public.webinar_registrations USING btree (user_id);


--
-- Name: idx_webinar_registrations_webinar_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webinar_registrations_webinar_id ON public.webinar_registrations USING btree (webinar_id);


--
-- Name: idx_webinars_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webinars_status ON public.webinars USING btree (status, scheduled_for);


--
-- Name: call_participants call_participant_count_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER call_participant_count_trigger AFTER INSERT OR UPDATE ON public.call_participants FOR EACH ROW EXECUTE FUNCTION public.update_call_participant_count();


--
-- Name: live_streams live_streams_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER live_streams_updated_at BEFORE UPDATE ON public.live_streams FOR EACH ROW EXECUTE FUNCTION public.update_live_streams_updated_at();


--
-- Name: room_participants room_participant_count_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER room_participant_count_trigger AFTER INSERT OR UPDATE ON public.room_participants FOR EACH ROW EXECUTE FUNCTION public.update_room_participant_count();


--
-- Name: stream_analytics stream_analytics_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER stream_analytics_updated_at BEFORE UPDATE ON public.stream_analytics FOR EACH ROW EXECUTE FUNCTION public.update_live_streams_updated_at();


--
-- Name: stream_viewers stream_viewers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER stream_viewers_updated_at BEFORE UPDATE ON public.stream_viewers FOR EACH ROW EXECUTE FUNCTION public.update_live_streams_updated_at();


--
-- Name: call_availability trigger_call_availability_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_call_availability_updated_at BEFORE UPDATE ON public.call_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: call_packages trigger_call_packages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_call_packages_updated_at BEFORE UPDATE ON public.call_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: live_streams trigger_live_streams_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_live_streams_updated_at BEFORE UPDATE ON public.live_streams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: menu_configs trigger_menu_configs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_menu_configs_updated_at BEFORE UPDATE ON public.menu_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: private_calls trigger_private_calls_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_private_calls_updated_at BEFORE UPDATE ON public.private_calls FOR EACH ROW EXECUTE FUNCTION public.update_private_calls_updated_at();


--
-- Name: user_call_packages trigger_user_call_packages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_user_call_packages_updated_at BEFORE UPDATE ON public.user_call_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: call_availability call_availability_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_availability
    ADD CONSTRAINT call_availability_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: call_participants call_participants_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.video_calls(id) ON DELETE CASCADE;


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
-- Name: menu_configs menu_configs_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_configs
    ADD CONSTRAINT menu_configs_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.menu_configs(id) ON DELETE SET NULL;


--
-- Name: payments payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.radio_playlists(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.radio_tracks(id) ON DELETE CASCADE;


--
-- Name: private_calls private_calls_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_calls
    ADD CONSTRAINT private_calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: private_calls private_calls_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.private_calls
    ADD CONSTRAINT private_calls_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: radio_listen_history radio_listen_history_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radio_listen_history
    ADD CONSTRAINT radio_listen_history_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.radio_tracks(id) ON DELETE CASCADE;


--
-- Name: room_events room_events_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_events
    ADD CONSTRAINT room_events_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.main_rooms(id) ON DELETE CASCADE;


--
-- Name: room_participants room_participants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.main_rooms(id) ON DELETE CASCADE;


--
-- Name: segment_membership segment_membership_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.user_segments(segment_id) ON DELETE CASCADE;


--
-- Name: segment_membership segment_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.segment_membership
    ADD CONSTRAINT segment_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_analytics stream_analytics_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_analytics
    ADD CONSTRAINT stream_analytics_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(stream_id) ON DELETE CASCADE;


--
-- Name: stream_chat_messages stream_chat_messages_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_chat_messages
    ADD CONSTRAINT stream_chat_messages_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(stream_id) ON DELETE CASCADE;


--
-- Name: stream_moderators stream_moderators_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderators
    ADD CONSTRAINT stream_moderators_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(stream_id) ON DELETE CASCADE;


--
-- Name: stream_notifications stream_notifications_streamer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_notifications stream_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_notifications
    ADD CONSTRAINT stream_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_viewers stream_viewers_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_viewers
    ADD CONSTRAINT stream_viewers_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.live_streams(stream_id) ON DELETE CASCADE;


--
-- Name: user_broadcast_preferences user_broadcast_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_broadcast_preferences
    ADD CONSTRAINT user_broadcast_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_call_packages user_call_packages_last_used_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_call_packages
    ADD CONSTRAINT user_call_packages_last_used_call_id_fkey FOREIGN KEY (last_used_call_id) REFERENCES public.private_calls(id) ON DELETE SET NULL;


--
-- Name: user_call_packages user_call_packages_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_call_packages
    ADD CONSTRAINT user_call_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.call_packages(id);


--
-- Name: user_call_packages user_call_packages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_call_packages
    ADD CONSTRAINT user_call_packages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_segments user_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_segments
    ADD CONSTRAINT user_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: webinar_registrations webinar_registrations_webinar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webinar_registrations
    ADD CONSTRAINT webinar_registrations_webinar_id_fkey FOREIGN KEY (webinar_id) REFERENCES public.webinars(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO pnptvbot;


--
-- Name: TABLE activation_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activation_codes TO pnptvbot;


--
-- Name: TABLE activation_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activation_logs TO pnptvbot;


--
-- Name: TABLE agora_channels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agora_channels TO pnptvbot;


--
-- Name: TABLE broadcasts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.broadcasts TO pnptvbot;


--
-- Name: TABLE call_availability; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_availability TO pnptvbot;


--
-- Name: SEQUENCE call_availability_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.call_availability_id_seq TO pnptvbot;


--
-- Name: TABLE call_feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_feedback TO pnptvbot;


--
-- Name: TABLE call_packages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_packages TO pnptvbot;


--
-- Name: TABLE call_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_participants TO pnptvbot;


--
-- Name: SEQUENCE call_participants_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.call_participants_id_seq TO pnptvbot;


--
-- Name: TABLE emotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.emotes TO pnptvbot;


--
-- Name: TABLE group_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.group_settings TO pnptvbot;


--
-- Name: TABLE live_streams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.live_streams TO pnptvbot;


--
-- Name: SEQUENCE live_streams_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.live_streams_id_seq TO pnptvbot;


--
-- Name: TABLE main_rooms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.main_rooms TO pnptvbot;


--
-- Name: TABLE menu_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.menu_configs TO pnptvbot;


--
-- Name: TABLE moderation_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.moderation_logs TO pnptvbot;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO pnptvbot;


--
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plans TO pnptvbot;


--
-- Name: TABLE playlist_tracks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.playlist_tracks TO pnptvbot;


--
-- Name: SEQUENCE playlist_tracks_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.playlist_tracks_id_seq TO pnptvbot;


--
-- Name: TABLE private_calls; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.private_calls TO pnptvbot;


--
-- Name: TABLE promo_code_usage; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promo_code_usage TO pnptvbot;


--
-- Name: TABLE promo_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promo_codes TO pnptvbot;


--
-- Name: TABLE radio_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_history TO pnptvbot;


--
-- Name: TABLE radio_listen_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_listen_history TO pnptvbot;


--
-- Name: SEQUENCE radio_listen_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.radio_listen_history_id_seq TO pnptvbot;


--
-- Name: TABLE radio_now_playing; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_now_playing TO pnptvbot;


--
-- Name: TABLE radio_playlists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_playlists TO pnptvbot;


--
-- Name: TABLE radio_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_requests TO pnptvbot;


--
-- Name: TABLE radio_schedule; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_schedule TO pnptvbot;


--
-- Name: TABLE radio_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_subscribers TO pnptvbot;


--
-- Name: TABLE radio_tracks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.radio_tracks TO pnptvbot;


--
-- Name: TABLE room_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.room_events TO pnptvbot;


--
-- Name: SEQUENCE room_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.room_events_id_seq TO pnptvbot;


--
-- Name: TABLE room_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.room_participants TO pnptvbot;


--
-- Name: SEQUENCE room_participants_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.room_participants_id_seq TO pnptvbot;


--
-- Name: TABLE segment_membership; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.segment_membership TO pnptvbot;


--
-- Name: SEQUENCE segment_membership_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.segment_membership_id_seq TO pnptvbot;


--
-- Name: TABLE stream_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stream_analytics TO pnptvbot;


--
-- Name: SEQUENCE stream_analytics_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stream_analytics_id_seq TO pnptvbot;


--
-- Name: TABLE stream_chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stream_chat_messages TO pnptvbot;


--
-- Name: SEQUENCE stream_chat_messages_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stream_chat_messages_id_seq TO pnptvbot;


--
-- Name: TABLE stream_moderators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stream_moderators TO pnptvbot;


--
-- Name: SEQUENCE stream_moderators_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stream_moderators_id_seq TO pnptvbot;


--
-- Name: TABLE stream_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stream_notifications TO pnptvbot;


--
-- Name: SEQUENCE stream_notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stream_notifications_id_seq TO pnptvbot;


--
-- Name: TABLE stream_viewers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stream_viewers TO pnptvbot;


--
-- Name: SEQUENCE stream_viewers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stream_viewers_id_seq TO pnptvbot;


--
-- Name: TABLE subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subscribers TO pnptvbot;


--
-- Name: TABLE user_broadcast_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_broadcast_preferences TO pnptvbot;


--
-- Name: SEQUENCE user_broadcast_preferences_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_broadcast_preferences_id_seq TO pnptvbot;


--
-- Name: TABLE user_call_packages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_call_packages TO pnptvbot;


--
-- Name: TABLE user_segments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_segments TO pnptvbot;


--
-- Name: SEQUENCE user_segments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_segments_id_seq TO pnptvbot;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO pnptvbot;


--
-- Name: TABLE video_calls; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.video_calls TO pnptvbot;


--
-- Name: TABLE webinar_registrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webinar_registrations TO pnptvbot;


--
-- Name: SEQUENCE webinar_registrations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.webinar_registrations_id_seq TO pnptvbot;


--
-- Name: TABLE webinars; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webinars TO pnptvbot;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO pnptvbot;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO pnptvbot;


--
-- PostgreSQL database dump complete
--

\unrestrict PvXwKuwsu5v1tkUa6bcb8Tt99iFdzhSn52GbyHaMSgRh4bgFkb68fu89TGV0FC1

