-- Migration: AI-based Age Verification System
-- Description: Adds age verification method field and creates age verification attempts table
-- Date: 2025-12-08

-- Add age_verification_method column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS age_verification_method VARCHAR(50) DEFAULT 'manual';

-- Add comment to explain the column
COMMENT ON COLUMN users.age_verification_method IS 'Method used for age verification: manual, ai_photo, document';

-- Create age_verification_attempts table
CREATE TABLE IF NOT EXISTS age_verification_attempts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  photo_file_id VARCHAR(255) NOT NULL,
  estimated_age INTEGER,
  confidence DECIMAL(5,4),
  verified BOOLEAN DEFAULT FALSE,
  provider VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key
  CONSTRAINT fk_user_verification
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_age_verification_attempts_user_id
  ON age_verification_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_age_verification_attempts_created_at
  ON age_verification_attempts(created_at);

CREATE INDEX IF NOT EXISTS idx_age_verification_attempts_verified
  ON age_verification_attempts(verified);

-- Add comments to table and columns
COMMENT ON TABLE age_verification_attempts IS 'Stores all age verification attempts using AI/photo analysis';
COMMENT ON COLUMN age_verification_attempts.user_id IS 'Telegram user ID';
COMMENT ON COLUMN age_verification_attempts.photo_file_id IS 'Telegram file ID of the verification photo';
COMMENT ON COLUMN age_verification_attempts.estimated_age IS 'Age estimated by AI in years';
COMMENT ON COLUMN age_verification_attempts.confidence IS 'Confidence score of the AI prediction (0-1)';
COMMENT ON COLUMN age_verification_attempts.verified IS 'Whether the user passed age verification (age >= minimum)';
COMMENT ON COLUMN age_verification_attempts.provider IS 'AI provider used: azure, facepp, etc.';
COMMENT ON COLUMN age_verification_attempts.created_at IS 'Timestamp of verification attempt';

-- Sample query to get verification statistics
-- SELECT
--   provider,
--   COUNT(*) as total_attempts,
--   COUNT(*) FILTER (WHERE verified = true) as successful_verifications,
--   ROUND(AVG(estimated_age)::numeric, 2) as avg_estimated_age,
--   ROUND(AVG(confidence)::numeric, 4) as avg_confidence
-- FROM age_verification_attempts
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- GROUP BY provider;
