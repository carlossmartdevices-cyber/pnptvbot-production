-- Create user_roles table for access-control role assignments
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(255) PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  granted_by VARCHAR(255),
  granted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_at ON user_roles(granted_at);
