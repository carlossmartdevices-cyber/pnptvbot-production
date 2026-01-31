-- Add X (Twitter) account management and scheduled posting

CREATE TABLE IF NOT EXISTS x_accounts (
  account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  x_user_id VARCHAR(40),
  handle VARCHAR(50) NOT NULL,
  display_name VARCHAR(120),
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_by BIGINT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_x_accounts_handle ON x_accounts(handle);
CREATE UNIQUE INDEX IF NOT EXISTS idx_x_accounts_user_id ON x_accounts(x_user_id);
CREATE INDEX IF NOT EXISTS idx_x_accounts_active ON x_accounts(is_active);

CREATE TABLE IF NOT EXISTS x_oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  admin_id BIGINT,
  admin_username VARCHAR(100),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_x_oauth_states_expires_at ON x_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS x_post_jobs (
  post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES x_accounts(account_id) ON DELETE CASCADE,
  admin_id BIGINT,
  admin_username VARCHAR(100),
  text TEXT NOT NULL,
  media_url TEXT,
  scheduled_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'scheduled',
  response_json JSONB,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_x_post_jobs_status ON x_post_jobs(status);
CREATE INDEX IF NOT EXISTS idx_x_post_jobs_scheduled_at ON x_post_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_x_post_jobs_account_id ON x_post_jobs(account_id);
