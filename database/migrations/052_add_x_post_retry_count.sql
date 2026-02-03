-- Migration: Add retry_count column to x_post_jobs table
-- This column tracks the number of retry attempts for failed posts

ALTER TABLE x_post_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create index for faster queries on status and retry_count
CREATE INDEX IF NOT EXISTS idx_x_post_jobs_status_retry ON x_post_jobs(status, retry_count);

-- Add comment for documentation
COMMENT ON COLUMN x_post_jobs.retry_count IS 'Number of retry attempts for failed posts';
