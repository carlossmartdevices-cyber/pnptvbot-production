-- Migration 046: Add AI Moderation Tables
-- Adds tables for AI-powered content moderation and violation tracking

-- =====================================================
-- 1. Add AI moderation columns to live_streams
-- =====================================================
ALTER TABLE live_streams
ADD COLUMN IF NOT EXISTS ai_moderation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS moderation_thresholds JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_moderate BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 2. Create stream chat violations table
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_chat_violations (
    id SERIAL PRIMARY KEY,
    violation_id VARCHAR(100) UNIQUE NOT NULL,
    stream_id VARCHAR(100) NOT NULL,
    
    -- User information
    user_id VARCHAR(50) NOT NULL,
    telegram_id BIGINT,
    username VARCHAR(255),
    display_name VARCHAR(255),
    
    -- Violation details
    violation_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
    score DECIMAL(5,4) NOT NULL,
    message_text TEXT,
    
    -- Action taken
    action_taken VARCHAR(20) DEFAULT 'NONE' CHECK (action_taken IN ('NONE', 'WARN', 'MUTE', 'BAN', 'DELETE')),
    action_duration VARCHAR(50),
    
    -- Analysis metadata
    analysis_id VARCHAR(100),
    analysis_method VARCHAR(50) DEFAULT 'ai',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
    -- Foreign key
    -- FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
);

-- =====================================================
-- 3. Create user moderation history table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_moderation_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    telegram_id BIGINT,
    username VARCHAR(255),
    
    -- Moderation action
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('WARN', 'MUTE', 'BAN', 'UNMUTE', 'UNBAN')),
    action_reason VARCHAR(200),
    action_duration VARCHAR(50),
    
    -- Context
    stream_id VARCHAR(100),
    violation_id VARCHAR(100),
    
    -- Moderator info
    moderated_by VARCHAR(50),
    moderated_by_telegram_id BIGINT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. Create moderation statistics table
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_moderation_stats (
    id SERIAL PRIMARY KEY,
    stream_id VARCHAR(100) NOT NULL,
    
    -- Statistics
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    total_violations INTEGER DEFAULT 0,
    high_severity_violations INTEGER DEFAULT 0,
    medium_severity_violations INTEGER DEFAULT 0,
    low_severity_violations INTEGER DEFAULT 0,
    
    -- Actions taken
    warnings_issued INTEGER DEFAULT 0,
    mutes_issued INTEGER DEFAULT 0,
    bans_issued INTEGER DEFAULT 0,
    messages_deleted INTEGER DEFAULT 0,
    
    -- User metrics
    unique_violators INTEGER DEFAULT 0,
    
    -- Foreign key
    -- FOREIGN KEY (stream_id) REFERENCES live_streams(stream_id) ON DELETE CASCADE
    
    -- Unique constraint
    UNIQUE (stream_id, date)
);

-- =====================================================
-- 5. Create indexes for performance
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_violations_stream
ON stream_chat_violations(stream_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_violations_user
ON stream_chat_violations(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_violations_severity
ON stream_chat_violations(severity);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_violations_created
ON stream_chat_violations(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_moderation_history_user
ON user_moderation_history(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_moderation_history_active
ON user_moderation_history(user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_moderation_stats_date
ON stream_moderation_stats(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_moderation_stats_stream
ON stream_moderation_stats(stream_id);

-- =====================================================
-- 6. Update timestamp trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION update_stream_violations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS stream_violations_updated_at ON stream_chat_violations;
CREATE TRIGGER stream_violations_updated_at
    BEFORE UPDATE ON stream_chat_violations
    FOR EACH ROW
    EXECUTE FUNCTION update_stream_violations_updated_at();

DROP TRIGGER IF EXISTS user_moderation_history_updated_at ON user_moderation_history;
CREATE TRIGGER user_moderation_history_updated_at
    BEFORE UPDATE ON user_moderation_history
    FOR EACH ROW
    EXECUTE FUNCTION update_stream_violations_updated_at();

-- =====================================================
-- 7. Function to update daily moderation stats
-- =====================================================
CREATE OR REPLACE FUNCTION update_daily_moderation_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for daily stats update
DROP TRIGGER IF EXISTS trigger_update_daily_moderation_stats ON stream_chat_violations;
CREATE TRIGGER trigger_update_daily_moderation_stats
AFTER INSERT ON stream_chat_violations
FOR EACH ROW
EXECUTE FUNCTION update_daily_moderation_stats();

-- =====================================================
-- 8. Analyze tables
-- =====================================================
ANALYZE stream_chat_violations;
ANALYZE user_moderation_history;
ANALYZE stream_moderation_stats;

-- =====================================================
-- 9. Comments for documentation
-- =====================================================
COMMENT ON TABLE stream_chat_violations IS 'Tracks content moderation violations in live stream chats';
COMMENT ON TABLE user_moderation_history IS 'Tracks moderation actions taken against users';
COMMENT ON TABLE stream_moderation_stats IS 'Daily aggregated statistics for stream moderation activities';

-- =====================================================
-- 10. Add missing columns to live_streams if needed
-- =====================================================
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_streams' AND column_name = 'ai_moderation_enabled'
    ) THEN
        ALTER TABLE live_streams ADD COLUMN ai_moderation_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_streams' AND column_name = 'moderation_thresholds'
    ) THEN
        ALTER TABLE live_streams ADD COLUMN moderation_thresholds JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_streams' AND column_name = 'auto_moderate'
    ) THEN
        ALTER TABLE live_streams ADD COLUMN auto_moderate BOOLEAN DEFAULT FALSE;
    END IF;
END $$;