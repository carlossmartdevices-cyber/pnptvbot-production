-- Create group invitations table to support onboarding invites
CREATE TABLE IF NOT EXISTS group_invitations (
  id SERIAL PRIMARY KEY,
  token VARCHAR(128) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  group_type VARCHAR(50) NOT NULL DEFAULT 'free',
  invitation_link TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  used_at TIMESTAMP WITHOUT TIME ZONE,
  last_reminder_at TIMESTAMP WITHOUT TIME ZONE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_group_invitations_user_id ON group_invitations (user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_expires_at ON group_invitations (expires_at);
CREATE INDEX IF NOT EXISTS idx_group_invitations_used ON group_invitations (used);
