-- Jitsi Tiered Call Rooms Schema
-- Three tiers: mini (10 users), medium (50 users), unlimited

-- Room tier enum
DO $$ BEGIN
    CREATE TYPE jitsi_room_tier AS ENUM ('mini', 'medium', 'unlimited');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Room status enum
DO $$ BEGIN
    CREATE TYPE jitsi_room_status AS ENUM ('active', 'scheduled', 'ended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main Jitsi rooms table
CREATE TABLE IF NOT EXISTS jitsi_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(20) UNIQUE NOT NULL,
    room_name VARCHAR(255) NOT NULL,

    -- Host information
    host_user_id VARCHAR(100) NOT NULL,
    host_name VARCHAR(255),
    host_telegram_id BIGINT,

    -- Room configuration
    tier jitsi_room_tier NOT NULL DEFAULT 'mini',
    max_participants INTEGER NOT NULL DEFAULT 10,
    title VARCHAR(255),
    description TEXT,

    -- Jitsi configuration
    jitsi_domain VARCHAR(255) DEFAULT 'meet.jit.si',
    jwt_token TEXT,
    moderator_password VARCHAR(100),

    -- Scheduling
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    scheduled_duration INTEGER DEFAULT 60, -- minutes
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,

    -- Settings
    settings JSONB DEFAULT '{
        "start_with_audio_muted": true,
        "start_with_video_muted": false,
        "enable_lobby": true,
        "enable_recording": false,
        "enable_chat": true,
        "enable_screen_share": true,
        "require_display_name": true,
        "enable_prejoin_page": true
    }'::jsonb,

    -- Access control
    is_public BOOLEAN DEFAULT true,
    requires_password BOOLEAN DEFAULT false,
    room_password VARCHAR(100),
    allowed_user_ids TEXT[], -- For private rooms

    -- Telegram integration
    telegram_group_id VARCHAR(100),
    shared_in_groups TEXT[],

    -- Status and metrics
    status jitsi_room_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    current_participants INTEGER DEFAULT 0,
    total_participants INTEGER DEFAULT 0,
    peak_participants INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- minutes

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Jitsi participants table
CREATE TABLE IF NOT EXISTS jitsi_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES jitsi_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    telegram_id BIGINT,
    display_name VARCHAR(255),

    -- Participant info
    is_moderator BOOLEAN DEFAULT false,
    is_host BOOLEAN DEFAULT false,

    -- Session tracking
    join_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    leave_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- minutes

    -- Connection info
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tier access configuration table
CREATE TABLE IF NOT EXISTS jitsi_tier_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_tier VARCHAR(50) NOT NULL, -- Basic, PNP, Crystal, Diamond, Premium
    allowed_room_tier jitsi_room_tier NOT NULL,
    max_rooms_per_day INTEGER DEFAULT 1,
    max_duration_minutes INTEGER DEFAULT 60,
    can_record BOOLEAN DEFAULT false,
    can_set_password BOOLEAN DEFAULT false,
    can_create_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default tier access configuration
INSERT INTO jitsi_tier_access (plan_tier, allowed_room_tier, max_rooms_per_day, max_duration_minutes, can_record, can_set_password, can_create_private)
VALUES
    -- Basic (Trial) - Mini rooms only
    ('Basic', 'mini', 1, 30, false, false, false),

    -- PNP Member - Mini rooms
    ('PNP', 'mini', 2, 60, false, true, false),

    -- Crystal Member - Mini and Medium rooms
    ('Crystal', 'mini', 5, 120, false, true, true),
    ('Crystal', 'medium', 2, 120, false, true, true),

    -- Diamond Member - All tiers
    ('Diamond', 'mini', 10, 180, true, true, true),
    ('Diamond', 'medium', 5, 180, true, true, true),
    ('Diamond', 'unlimited', 2, 180, true, true, true),

    -- Premium (Lifetime) - All tiers unlimited
    ('Premium', 'mini', 999, 240, true, true, true),
    ('Premium', 'medium', 999, 240, true, true, true),
    ('Premium', 'unlimited', 999, 240, true, true, true)
ON CONFLICT DO NOTHING;

-- User room usage tracking
CREATE TABLE IF NOT EXISTS jitsi_user_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    tier jitsi_room_tier NOT NULL,
    rooms_created INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date, tier)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_host_user_id ON jitsi_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_room_code ON jitsi_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_status ON jitsi_rooms(status);
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_tier ON jitsi_rooms(tier);
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_created_at ON jitsi_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jitsi_rooms_telegram_group ON jitsi_rooms(telegram_group_id);

CREATE INDEX IF NOT EXISTS idx_jitsi_participants_room_id ON jitsi_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_jitsi_participants_user_id ON jitsi_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_jitsi_user_usage_user_date ON jitsi_user_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_jitsi_tier_access_plan ON jitsi_tier_access(plan_tier);

-- View for active rooms
CREATE OR REPLACE VIEW active_jitsi_rooms AS
SELECT * FROM jitsi_rooms
WHERE status = 'active'
AND deleted_at IS NULL
AND is_active = true;

-- View for room statistics
CREATE OR REPLACE VIEW jitsi_room_statistics AS
SELECT
    r.id as room_id,
    r.room_code,
    r.tier,
    r.title,
    r.host_user_id,
    r.status,
    r.current_participants,
    r.total_participants,
    r.peak_participants,
    r.total_duration,
    COUNT(p.id) as session_count,
    AVG(p.duration) as avg_session_duration
FROM jitsi_rooms r
LEFT JOIN jitsi_participants p ON r.id = p.room_id
GROUP BY r.id;

-- Function to update room timestamps
CREATE OR REPLACE FUNCTION update_jitsi_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamps
DROP TRIGGER IF EXISTS update_jitsi_room_timestamp ON jitsi_rooms;
CREATE TRIGGER update_jitsi_room_timestamp
    BEFORE UPDATE ON jitsi_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_jitsi_room_timestamp();
