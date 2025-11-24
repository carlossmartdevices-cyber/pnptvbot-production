-- Live Streams Schema
-- Tracks live streaming sessions, viewers, and chat messages

-- Live streams table
CREATE TABLE IF NOT EXISTS live_streams (
    id SERIAL PRIMARY KEY,
    stream_id VARCHAR(100) UNIQUE NOT NULL,
    room_name VARCHAR(255) UNIQUE NOT NULL,

    -- Host information
    host_user_id VARCHAR(50) NOT NULL,
    host_telegram_id BIGINT NOT NULL,
    host_name VARCHAR(255) NOT NULL,

    -- Stream details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),

    -- Timing
    scheduled_start_time TIMESTAMP,
    actual_start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,

    -- Access control
    is_public BOOLEAN DEFAULT true,
    is_subscribers_only BOOLEAN DEFAULT false,
    allowed_plan_tiers TEXT[], -- Array of plan tiers allowed (e.g., ['PNP', 'Crystal', 'Diamond'])

    -- Statistics
    current_viewers INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,

    -- Technical details
    jaas_room_name VARCHAR(255),
    recording_enabled BOOLEAN DEFAULT false,
    recording_url TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream viewers table (tracks who watched the stream)
CREATE TABLE IF NOT EXISTS stream_viewers (
    id SERIAL PRIMARY KEY,
    stream_id VARCHAR(100) NOT NULL,

    -- Viewer information
    user_id VARCHAR(50) NOT NULL,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255),

    -- Viewer session
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    watch_duration_seconds INTEGER DEFAULT 0,

    -- Activity
    messages_sent INTEGER DEFAULT 0,
    reactions_sent INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate active sessions
    UNIQUE (stream_id, user_id, left_at),

    -- Foreign key
    FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
);

-- Stream chat messages table
CREATE TABLE IF NOT EXISTS stream_chat_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) UNIQUE NOT NULL,
    stream_id VARCHAR(100) NOT NULL,

    -- Sender information
    user_id VARCHAR(50) NOT NULL,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,

    -- Message content
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'reaction', 'system')),

    -- Moderation
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(50),

    -- Metadata
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
);

-- Stream analytics table (daily aggregations)
CREATE TABLE IF NOT EXISTS stream_analytics (
    id SERIAL PRIMARY KEY,
    stream_id VARCHAR(100) NOT NULL,

    -- Metrics
    date DATE NOT NULL,
    unique_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    average_watch_time_seconds INTEGER DEFAULT 0,
    peak_concurrent_viewers INTEGER DEFAULT 0,

    -- Engagement
    engagement_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint
    UNIQUE (stream_id, date),

    -- Foreign key
    FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
);

-- Stream moderators table (who can moderate the stream)
CREATE TABLE IF NOT EXISTS stream_moderators (
    id SERIAL PRIMARY KEY,
    stream_id VARCHAR(100) NOT NULL,

    -- Moderator information
    user_id VARCHAR(50) NOT NULL,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,

    -- Permissions
    can_mute_users BOOLEAN DEFAULT true,
    can_delete_messages BOOLEAN DEFAULT true,
    can_ban_users BOOLEAN DEFAULT false,
    can_end_stream BOOLEAN DEFAULT false,

    -- Metadata
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by VARCHAR(50) NOT NULL,

    -- Unique constraint
    UNIQUE (stream_id, user_id),

    -- Foreign key
    FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_live_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER live_streams_updated_at
    BEFORE UPDATE ON live_streams
    FOR EACH ROW
    EXECUTE FUNCTION update_live_streams_updated_at();

CREATE TRIGGER stream_viewers_updated_at
    BEFORE UPDATE ON stream_viewers
    FOR EACH ROW
    EXECUTE FUNCTION update_live_streams_updated_at();

CREATE TRIGGER stream_analytics_updated_at
    BEFORE UPDATE ON stream_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_live_streams_updated_at();

-- Create indexes for efficient querying
-- live_streams table indexes
CREATE INDEX IF NOT EXISTS idx_stream_id ON live_streams(stream_id);
CREATE INDEX IF NOT EXISTS idx_host_user_id ON live_streams(host_user_id);
CREATE INDEX IF NOT EXISTS idx_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_start ON live_streams(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_created_at ON live_streams(created_at);

-- stream_viewers table indexes
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user ON stream_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_joined ON stream_viewers(joined_at);

-- stream_chat_messages table indexes
CREATE INDEX IF NOT EXISTS idx_chat_stream_id ON stream_chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON stream_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sent_at ON stream_chat_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_chat_deleted ON stream_chat_messages(is_deleted);

-- stream_analytics table indexes
CREATE INDEX IF NOT EXISTS idx_analytics_stream ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON stream_analytics(date);

-- stream_moderators table indexes
CREATE INDEX IF NOT EXISTS idx_moderators_stream ON stream_moderators(stream_id);
CREATE INDEX IF NOT EXISTS idx_moderators_user ON stream_moderators(user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_live_streams_active ON live_streams(status) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_stream_viewers_active ON stream_viewers(stream_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_recent ON stream_chat_messages(stream_id, sent_at DESC) WHERE is_deleted = false;

-- Comments for documentation
COMMENT ON TABLE live_streams IS 'Stores information about live streaming sessions';
COMMENT ON TABLE stream_viewers IS 'Tracks viewers who join live streams';
COMMENT ON TABLE stream_chat_messages IS 'Stores chat messages sent during live streams';
COMMENT ON TABLE stream_analytics IS 'Daily aggregated analytics for streams';
COMMENT ON TABLE stream_moderators IS 'Manages moderators for live streams';
