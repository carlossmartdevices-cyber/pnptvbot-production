-- Zoom Integration Database Schema
-- Created: 2025-11-19
-- Description: Tables for Zoom meeting management system

-- =====================================================
-- ZOOM ROOMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Room identification
    room_code VARCHAR(10) UNIQUE NOT NULL, -- Short code for easy sharing (e.g., "ABC-1234")
    zoom_meeting_id VARCHAR(255) UNIQUE, -- Actual Zoom meeting ID
    zoom_meeting_password VARCHAR(255), -- Zoom meeting password

    -- Host information
    host_user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    host_email VARCHAR(255),
    host_name VARCHAR(255),
    host_auth_token VARCHAR(500), -- JWT token for host authentication
    host_join_url TEXT, -- Special URL for host with controls

    -- Meeting configuration
    title VARCHAR(255) NOT NULL DEFAULT 'PNP.tv Meeting',
    description TEXT,
    topic VARCHAR(500),

    -- Scheduling
    scheduled_start_time TIMESTAMP,
    scheduled_duration INTEGER DEFAULT 60, -- Duration in minutes
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,

    -- Room settings
    settings JSONB DEFAULT '{
        "waiting_room_enabled": true,
        "join_before_host": false,
        "mute_upon_entry": true,
        "enable_recording": true,
        "auto_recording": "cloud",
        "enable_chat": true,
        "enable_reactions": true,
        "enable_polls": true,
        "enable_transcription": true,
        "enable_breakout_rooms": false,
        "max_participants": 100,
        "allow_video": true,
        "allow_screen_share": "host",
        "layout_mode": "gallery",
        "spotlight_user_id": null,
        "virtual_background_enabled": true
    }'::jsonb,

    -- Access control
    is_public BOOLEAN DEFAULT true,
    requires_password BOOLEAN DEFAULT false,
    allowed_domains TEXT[], -- Email domains allowed to join

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, active, ended, cancelled
    is_active BOOLEAN DEFAULT true,

    -- Statistics
    total_participants INTEGER DEFAULT 0,
    peak_participants INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- Actual duration in minutes

    -- Recording
    recording_enabled BOOLEAN DEFAULT false,
    recording_status VARCHAR(50), -- not_started, recording, paused, stopped, processing, completed
    recording_url TEXT,
    recording_file_size BIGINT,

    -- Group integration
    telegram_group_id VARCHAR(255), -- If created from a Telegram group
    shared_in_groups TEXT[], -- Array of group IDs where this room was shared

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Indexes
    CONSTRAINT valid_status CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled'))
);

CREATE INDEX idx_zoom_rooms_host ON zoom_rooms(host_user_id);
CREATE INDEX idx_zoom_rooms_status ON zoom_rooms(status);
CREATE INDEX idx_zoom_rooms_room_code ON zoom_rooms(room_code);
CREATE INDEX idx_zoom_rooms_active ON zoom_rooms(is_active, status);
CREATE INDEX idx_zoom_rooms_scheduled_start ON zoom_rooms(scheduled_start_time);

-- =====================================================
-- ZOOM PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Participant identification
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL, -- Null if guest
    zoom_participant_id VARCHAR(255), -- ID from Zoom

    -- Participant info
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_guest BOOLEAN DEFAULT true,
    is_host BOOLEAN DEFAULT false,
    is_co_host BOOLEAN DEFAULT false,

    -- Join information
    join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    leave_time TIMESTAMP,
    join_url TEXT, -- Personal join URL

    -- Participant state
    audio_status VARCHAR(20) DEFAULT 'muted', -- muted, unmuted
    video_status VARCHAR(20) DEFAULT 'off', -- on, off
    screen_share_status VARCHAR(20) DEFAULT 'off', -- on, off
    is_hand_raised BOOLEAN DEFAULT false,
    is_speaking BOOLEAN DEFAULT false,

    -- Permissions granted by host
    permissions JSONB DEFAULT '{
        "can_unmute_self": true,
        "can_enable_video": true,
        "can_share_screen": false,
        "can_chat": true,
        "can_use_reactions": true,
        "can_rename": false
    }'::jsonb,

    -- Activity tracking
    total_talk_time INTEGER DEFAULT 0, -- Seconds
    messages_sent INTEGER DEFAULT 0,
    reactions_sent INTEGER DEFAULT 0,
    polls_answered INTEGER DEFAULT 0,

    -- Connection quality
    connection_quality VARCHAR(20), -- excellent, good, poor
    network_issues_count INTEGER DEFAULT 0,

    -- Kick/Ban tracking
    was_removed BOOLEAN DEFAULT false,
    removal_reason TEXT,
    removed_at TIMESTAMP,
    removed_by VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zoom_participants_room ON zoom_participants(room_id);
CREATE INDEX idx_zoom_participants_user ON zoom_participants(user_id);
CREATE INDEX idx_zoom_participants_join_time ON zoom_participants(join_time);
CREATE INDEX idx_zoom_participants_active ON zoom_participants(room_id, leave_time) WHERE leave_time IS NULL;

-- =====================================================
-- ZOOM RECORDINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recording identification
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    zoom_recording_id VARCHAR(255) UNIQUE,

    -- Recording info
    recording_type VARCHAR(50), -- cloud, local
    file_type VARCHAR(20), -- MP4, M4A, CHAT, TRANSCRIPT
    file_extension VARCHAR(10),

    -- Storage
    storage_location TEXT, -- URL or file path
    cloud_storage_url TEXT, -- Zoom cloud URL
    local_storage_path TEXT, -- Local server path
    download_url TEXT,

    -- File details
    file_size BIGINT, -- Bytes
    duration INTEGER, -- Seconds
    recording_start TIMESTAMP,
    recording_end TIMESTAMP,

    -- Status
    status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed, deleted
    processing_progress INTEGER DEFAULT 0, -- 0-100

    -- Access control
    is_public BOOLEAN DEFAULT false,
    password_protected BOOLEAN DEFAULT false,
    access_password VARCHAR(255),
    download_allowed BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,

    -- Transcription (if available)
    transcript_url TEXT,
    transcript_text TEXT,
    transcript_language VARCHAR(10),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- When recording will be auto-deleted
    deleted_at TIMESTAMP
);

CREATE INDEX idx_zoom_recordings_room ON zoom_recordings(room_id);
CREATE INDEX idx_zoom_recordings_status ON zoom_recordings(status);
CREATE INDEX idx_zoom_recordings_created ON zoom_recordings(created_at);

-- =====================================================
-- ZOOM EVENTS TABLE (Activity Log)
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event context
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES zoom_participants(id) ON DELETE SET NULL,

    -- Event details
    event_type VARCHAR(100) NOT NULL, -- meeting.started, participant.joined, participant.left, recording.started, etc.
    event_category VARCHAR(50), -- meeting, participant, recording, chat, poll

    -- Event data
    event_data JSONB, -- Flexible storage for event-specific data
    description TEXT,

    -- Actor (who triggered the event)
    actor_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(50), -- host, co-host, participant

    -- Target (who was affected)
    target_user_id VARCHAR(255),
    target_name VARCHAR(255),

    -- Metadata
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_zoom_events_room ON zoom_events(room_id);
CREATE INDEX idx_zoom_events_type ON zoom_events(event_type);
CREATE INDEX idx_zoom_events_timestamp ON zoom_events(timestamp);
CREATE INDEX idx_zoom_events_category ON zoom_events(event_category);

-- =====================================================
-- ZOOM POLLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Poll context
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

    -- Poll details
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of options: [{"id": "1", "text": "Option 1", "votes": 0}, ...]

    -- Poll settings
    poll_type VARCHAR(50) DEFAULT 'single_choice', -- single_choice, multiple_choice, rating
    allow_anonymous BOOLEAN DEFAULT true,
    show_results_live BOOLEAN DEFAULT true,

    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, ended
    started_at TIMESTAMP,
    ended_at TIMESTAMP,

    -- Statistics
    total_votes INTEGER DEFAULT 0,
    total_voters INTEGER DEFAULT 0,

    -- Results
    results JSONB, -- Calculated results

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zoom_polls_room ON zoom_polls(room_id);
CREATE INDEX idx_zoom_polls_status ON zoom_polls(status);

-- =====================================================
-- ZOOM POLL RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    poll_id UUID REFERENCES zoom_polls(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES zoom_participants(id) ON DELETE CASCADE,

    -- Response
    selected_options JSONB NOT NULL, -- Array of selected option IDs
    response_text TEXT, -- For open-ended questions

    -- Metadata
    responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(poll_id, participant_id) -- One response per participant per poll
);

CREATE INDEX idx_zoom_poll_responses_poll ON zoom_poll_responses(poll_id);
CREATE INDEX idx_zoom_poll_responses_participant ON zoom_poll_responses(participant_id);

-- =====================================================
-- ZOOM CHAT MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message context
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES zoom_participants(id) ON DELETE SET NULL,

    -- Message content
    message_text TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- text, file, emoji

    -- Translation (if enabled)
    original_language VARCHAR(10),
    translated_text JSONB, -- {"es": "...", "en": "..."}

    -- Recipient
    is_private BOOLEAN DEFAULT false,
    recipient_id UUID REFERENCES zoom_participants(id) ON DELETE SET NULL,

    -- File attachment (if any)
    file_url TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,

    -- Moderation
    is_deleted BOOLEAN DEFAULT false,
    deleted_by VARCHAR(255),
    deleted_at TIMESTAMP,

    -- Metadata
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zoom_chat_room ON zoom_chat_messages(room_id);
CREATE INDEX idx_zoom_chat_participant ON zoom_chat_messages(participant_id);
CREATE INDEX idx_zoom_chat_timestamp ON zoom_chat_messages(timestamp);

-- =====================================================
-- ZOOM REACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES zoom_participants(id) ON DELETE CASCADE,

    -- Reaction
    reaction_type VARCHAR(50) NOT NULL, -- thumbs_up, heart, clap, laugh, etc.
    emoji VARCHAR(10), -- Unicode emoji

    -- Target (optional - can react to specific participant)
    target_participant_id UUID REFERENCES zoom_participants(id) ON DELETE SET NULL,

    -- Metadata
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zoom_reactions_room ON zoom_reactions(room_id);
CREATE INDEX idx_zoom_reactions_timestamp ON zoom_reactions(timestamp);

-- =====================================================
-- ZOOM BREAKOUT ROOMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_breakout_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent room
    parent_room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    zoom_breakout_room_id VARCHAR(255),

    -- Room details
    room_name VARCHAR(255) NOT NULL,
    room_number INTEGER,

    -- Configuration
    duration INTEGER, -- Minutes
    auto_assign BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(50) DEFAULT 'created', -- created, active, ended
    started_at TIMESTAMP,
    ended_at TIMESTAMP,

    -- Participants assigned
    participant_ids JSONB, -- Array of participant IDs

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zoom_breakout_parent ON zoom_breakout_rooms(parent_room_id);
CREATE INDEX idx_zoom_breakout_status ON zoom_breakout_rooms(status);

-- =====================================================
-- ZOOM HOST SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS zoom_host_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session identification
    room_id UUID REFERENCES zoom_rooms(id) ON DELETE CASCADE,
    host_user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,

    -- Authentication
    auth_token VARCHAR(500) UNIQUE NOT NULL,
    magic_link_token VARCHAR(255) UNIQUE, -- For email magic link

    -- Session details
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,
    login_method VARCHAR(50), -- email_link, telegram, direct

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Session expiration
    logged_out_at TIMESTAMP
);

CREATE INDEX idx_zoom_host_sessions_room ON zoom_host_sessions(room_id);
CREATE INDEX idx_zoom_host_sessions_token ON zoom_host_sessions(auth_token);
CREATE INDEX idx_zoom_host_sessions_magic_link ON zoom_host_sessions(magic_link_token);
CREATE INDEX idx_zoom_host_sessions_active ON zoom_host_sessions(is_active);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zoom_rooms_updated_at BEFORE UPDATE ON zoom_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_participants_updated_at BEFORE UPDATE ON zoom_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_recordings_updated_at BEFORE UPDATE ON zoom_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_polls_updated_at BEFORE UPDATE ON zoom_polls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_breakout_rooms_updated_at BEFORE UPDATE ON zoom_breakout_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active rooms with participant count
CREATE OR REPLACE VIEW active_zoom_rooms AS
SELECT
    r.*,
    COUNT(DISTINCT p.id) FILTER (WHERE p.leave_time IS NULL) as current_participants,
    COUNT(DISTINCT p.id) as total_participants_ever
FROM zoom_rooms r
LEFT JOIN zoom_participants p ON r.id = p.room_id
WHERE r.status = 'active' AND r.is_active = true
GROUP BY r.id;

-- Room statistics
CREATE OR REPLACE VIEW zoom_room_statistics AS
SELECT
    r.id as room_id,
    r.room_code,
    r.title,
    r.host_user_id,
    r.status,
    COUNT(DISTINCT p.id) as total_participants,
    COUNT(DISTINCT p.id) FILTER (WHERE p.leave_time IS NULL) as current_participants,
    AVG(EXTRACT(EPOCH FROM (COALESCE(p.leave_time, CURRENT_TIMESTAMP) - p.join_time))/60)::INTEGER as avg_duration_minutes,
    COUNT(DISTINCT rec.id) as total_recordings,
    COUNT(DISTINCT e.id) as total_events,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT pl.id) as total_polls
FROM zoom_rooms r
LEFT JOIN zoom_participants p ON r.id = p.room_id
LEFT JOIN zoom_recordings rec ON r.id = rec.room_id
LEFT JOIN zoom_events e ON r.id = e.room_id
LEFT JOIN zoom_chat_messages m ON r.id = m.room_id
LEFT JOIN zoom_polls pl ON r.id = pl.room_id
GROUP BY r.id;

-- =====================================================
-- SEED DATA (Optional)
-- =====================================================

-- Insert default room settings template
INSERT INTO zoom_rooms (
    room_code,
    host_user_id,
    title,
    status,
    settings
) VALUES (
    'TEMPLATE',
    '0',
    'Template Room (Do Not Use)',
    'cancelled',
    '{
        "waiting_room_enabled": true,
        "join_before_host": false,
        "mute_upon_entry": true,
        "enable_recording": true,
        "auto_recording": "cloud",
        "enable_chat": true,
        "enable_reactions": true,
        "enable_polls": true,
        "enable_transcription": true,
        "enable_breakout_rooms": false,
        "max_participants": 100,
        "allow_video": true,
        "allow_screen_share": "host",
        "layout_mode": "gallery",
        "spotlight_user_id": null,
        "virtual_background_enabled": true
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE zoom_rooms IS 'Stores Zoom meeting rooms created by prime users';
COMMENT ON TABLE zoom_participants IS 'Tracks participants in Zoom meetings';
COMMENT ON TABLE zoom_recordings IS 'Manages meeting recordings and transcripts';
COMMENT ON TABLE zoom_events IS 'Activity log for all Zoom-related events';
COMMENT ON TABLE zoom_polls IS 'In-meeting polls created by hosts';
COMMENT ON TABLE zoom_poll_responses IS 'Participant responses to polls';
COMMENT ON TABLE zoom_chat_messages IS 'Chat messages sent during meetings';
COMMENT ON TABLE zoom_reactions IS 'Real-time reactions from participants';
COMMENT ON TABLE zoom_breakout_rooms IS 'Breakout rooms for group discussions';
COMMENT ON TABLE zoom_host_sessions IS 'Host authentication sessions';

COMMENT ON COLUMN zoom_rooms.room_code IS 'Short shareable code like ABC-1234';
COMMENT ON COLUMN zoom_rooms.settings IS 'JSONB containing all meeting settings and preferences';
COMMENT ON COLUMN zoom_participants.permissions IS 'Per-participant permissions granted by host';
COMMENT ON COLUMN zoom_recordings.transcript_text IS 'Full text transcription of the meeting';
