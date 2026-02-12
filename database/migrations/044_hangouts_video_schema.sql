-- Hangouts Video Calls Schema
-- Supports 10-person video calls and 3 main 50-person rooms
-- Version: 1.0
-- Date: 2026-02-12

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Video call status enum
DO $$ BEGIN
    CREATE TYPE video_call_status AS ENUM ('active', 'ended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Room event types enum
DO $$ BEGIN
    CREATE TYPE room_event_type AS ENUM (
        'USER_JOINED_PUBLISHER',
        'USER_JOINED_VIEWER',
        'USER_LEFT',
        'USER_KICKED',
        'USER_AUDIO_MUTED',
        'USER_VIDEO_MUTED',
        'PUBLISH_GRANTED',
        'SPOTLIGHT_SET',
        'ROOM_CREATED',
        'ROOM_ENDED',
        'RECORDING_STARTED',
        'RECORDING_STOPPED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- VIDEO CALLS TABLES (10-person calls)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id VARCHAR(100) NOT NULL,
    creator_name VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255),

    -- Configuration
    max_participants INTEGER NOT NULL DEFAULT 10,
    current_participants INTEGER NOT NULL DEFAULT 0,
    enforce_camera BOOLEAN DEFAULT false,
    allow_guests BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    recording_enabled BOOLEAN DEFAULT false,
    recording_url TEXT,

    -- Status tracking
    status video_call_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(255) NOT NULL,

    -- Participant info
    is_host BOOLEAN DEFAULT false,
    is_guest BOOLEAN DEFAULT false,
    was_kicked BOOLEAN DEFAULT false,

    -- Session tracking
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER,

    -- Connection info
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(call_id, user_id, joined_at)
);

-- ============================================================================
-- MAIN ROOMS TABLES (50-person community rooms)
-- ============================================================================

CREATE TABLE IF NOT EXISTS main_rooms (
    id SERIAL PRIMARY KEY, -- Fixed IDs: 1, 2, 3
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channel_name VARCHAR(255) UNIQUE NOT NULL,
    bot_user_id VARCHAR(100),

    -- Configuration
    max_participants INTEGER NOT NULL DEFAULT 50,
    current_participants INTEGER NOT NULL DEFAULT 0,
    enforce_camera BOOLEAN DEFAULT false,
    auto_approve_publisher BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(id)
);

CREATE TABLE IF NOT EXISTS room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id SERIAL NOT NULL REFERENCES main_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(255) NOT NULL,

    -- Participant roles
    is_publisher BOOLEAN DEFAULT false,
    is_moderator BOOLEAN DEFAULT false,

    -- Session tracking
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER,

    -- Connection info
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, user_id, joined_at)
);

CREATE TABLE IF NOT EXISTS room_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id SERIAL NOT NULL REFERENCES main_rooms(id) ON DELETE CASCADE,
    event_type room_event_type NOT NULL,
    initiator_user_id VARCHAR(100),
    target_user_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AGORA CHANNELS REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS agora_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name VARCHAR(255) UNIQUE NOT NULL,
    channel_type VARCHAR(50) DEFAULT 'call', -- 'call' or 'room'
    feature_name VARCHAR(100), -- 'hangouts', 'live', etc.
    created_by UUID REFERENCES video_calls(id) ON DELETE SET NULL,
    max_participants INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- Video calls indexes
CREATE INDEX IF NOT EXISTS idx_video_calls_creator_id ON video_calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_channel_name ON video_calls(channel_name);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_is_public ON video_calls(is_public);
CREATE INDEX IF NOT EXISTS idx_video_calls_created_at ON video_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_calls_is_active ON video_calls(is_active);

-- Call participants indexes
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON call_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_joined_at ON call_participants(joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_participants_left_at ON call_participants(left_at);

-- Main rooms indexes
CREATE INDEX IF NOT EXISTS idx_main_rooms_is_active ON main_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_main_rooms_channel_name ON main_rooms(channel_name);

-- Room participants indexes
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_is_publisher ON room_participants(is_publisher);
CREATE INDEX IF NOT EXISTS idx_room_participants_joined_at ON room_participants(joined_at DESC);

-- Room events indexes
CREATE INDEX IF NOT EXISTS idx_room_events_room_id ON room_events(room_id);
CREATE INDEX IF NOT EXISTS idx_room_events_event_type ON room_events(event_type);
CREATE INDEX IF NOT EXISTS idx_room_events_created_at ON room_events(created_at DESC);

-- Agora channels indexes
CREATE INDEX IF NOT EXISTS idx_agora_channels_channel_name ON agora_channels(channel_name);
CREATE INDEX IF NOT EXISTS idx_agora_channels_feature_name ON agora_channels(feature_name);
CREATE INDEX IF NOT EXISTS idx_agora_channels_is_active ON agora_channels(is_active);

-- ============================================================================
-- VIEWS (Analytics & Monitoring)
-- ============================================================================

-- Active video calls view
CREATE OR REPLACE VIEW active_video_calls AS
SELECT
    id,
    creator_id,
    creator_name,
    channel_name,
    title,
    current_participants,
    max_participants,
    is_public,
    created_at,
    (NOW() - created_at)::INTERVAL AS duration_so_far
FROM video_calls
WHERE is_active = true
AND status = 'active'
ORDER BY created_at DESC;

-- Main rooms active participants view
CREATE OR REPLACE VIEW main_rooms_active_participants AS
SELECT
    r.id,
    r.name,
    COUNT(p.id) AS total_participants,
    SUM(CASE WHEN p.is_publisher THEN 1 ELSE 0 END) AS publishers,
    SUM(CASE WHEN p.is_publisher = false THEN 1 ELSE 0 END) AS viewers,
    MAX(CASE WHEN p.left_at IS NULL THEN 1 ELSE 0 END) AS has_active_participants
FROM main_rooms r
LEFT JOIN room_participants p ON r.id = p.room_id AND p.left_at IS NULL
GROUP BY r.id, r.name;

-- Video call statistics view
CREATE OR REPLACE VIEW video_call_statistics AS
SELECT
    vc.id,
    vc.channel_name,
    vc.creator_id,
    vc.title,
    COUNT(cp.id) AS total_sessions,
    COUNT(DISTINCT cp.user_id) AS unique_participants,
    AVG(cp.total_duration_seconds) AS avg_duration_seconds,
    MAX(vc.current_participants) AS peak_participants,
    vc.created_at,
    vc.ended_at
FROM video_calls vc
LEFT JOIN call_participants cp ON vc.id = cp.call_id
GROUP BY vc.id;

-- ============================================================================
-- TRIGGERS (Automatic Timestamp Updates)
-- ============================================================================

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_hangouts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for video_calls
DROP TRIGGER IF EXISTS update_video_calls_timestamp ON video_calls;
CREATE TRIGGER update_video_calls_timestamp
    BEFORE UPDATE ON video_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_hangouts_timestamp();

-- Trigger for main_rooms
DROP TRIGGER IF EXISTS update_main_rooms_timestamp ON main_rooms;
CREATE TRIGGER update_main_rooms_timestamp
    BEFORE UPDATE ON main_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_hangouts_timestamp();

-- ============================================================================
-- SEED DATA (3 Default Main Rooms)
-- ============================================================================

INSERT INTO main_rooms (id, name, description, channel_name, bot_user_id, max_participants, is_active)
VALUES
    (1, 'Main Room 1', 'Community room #1 for hangouts', 'main_room_1', NULL, 50, true),
    (2, 'Main Room 2', 'Community room #2 for hangouts', 'main_room_2', NULL, 50, true),
    (3, 'Main Room 3', 'Community room #3 for hangouts', 'main_room_3', NULL, 50, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE video_calls IS 'Stores 10-person video calls for PRIME members';
COMMENT ON TABLE call_participants IS 'Tracks participants in video calls with session duration';
COMMENT ON TABLE main_rooms IS '3 permanent 50-person community hangout rooms';
COMMENT ON TABLE room_participants IS 'Tracks publisher/viewer roles in main rooms';
COMMENT ON TABLE room_events IS 'Audit trail of room events (joins, kicks, mutes, etc.)';
COMMENT ON TABLE agora_channels IS 'Registry of Agora RTC channels for calls and rooms';

COMMENT ON COLUMN video_calls.current_participants IS 'Real-time count, updated via transaction';
COMMENT ON COLUMN main_rooms.current_participants IS 'Real-time count, updated via transaction';
COMMENT ON COLUMN room_participants.is_publisher IS 'true = can broadcast, false = viewer only';
COMMENT ON COLUMN room_events.event_type IS 'Type of event for audit and analytics';

-- ============================================================================
-- SAFETY CHECKS & CONSTRAINTS
-- ============================================================================

-- Ensure main_rooms has exactly 3 rows (seeds above)
-- (Checked at application level, not enforced in DB)

-- End of schema migration
-- Verified against VideoCallModel, MainRoomModel, hangoutsHandler.js
-- Timestamp: 2026-02-12
