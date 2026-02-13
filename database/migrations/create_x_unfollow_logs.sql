-- Create X Unfollow Logs Table
-- Audit trail for unfollow operations

CREATE TABLE IF NOT EXISTS x_unfollow_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  total_analyzed INTEGER NOT NULL DEFAULT 0,
  total_unfollowed INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for finding logs by user
CREATE INDEX IF NOT EXISTS idx_x_unfollow_logs_user_id ON x_unfollow_logs(user_id);

-- Index for recent operations
CREATE INDEX IF NOT EXISTS idx_x_unfollow_logs_created_at ON x_unfollow_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE x_unfollow_logs IS 'Audit trail for X/Twitter unfollow operations - tracks non-mutual analysis and unfollow batches';
COMMENT ON COLUMN x_unfollow_logs.results IS 'Complete results JSON: { totalNonMutuals, unfollowed, failed, errors[], dryRun }';
