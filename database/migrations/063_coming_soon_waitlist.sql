-- Coming Soon Waitlist - Tracks newsletter signups for upcoming features

CREATE TABLE coming_soon_waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  feature_type VARCHAR(50) NOT NULL, -- 'live', 'hangouts'
  signed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notified_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'notified', 'unsubscribed'
  source VARCHAR(100), -- 'hero', 'signup_box', 'final_cta', 'share', etc.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_email_feature UNIQUE (email, feature_type)
);

CREATE INDEX idx_coming_soon_feature ON coming_soon_waitlist(feature_type);
CREATE INDEX idx_coming_soon_status ON coming_soon_waitlist(status);
CREATE INDEX idx_coming_soon_created ON coming_soon_waitlist(created_at);
CREATE INDEX idx_coming_soon_notified ON coming_soon_waitlist(notified_at);

-- Audit table for tracking waitlist activities
CREATE TABLE coming_soon_waitlist_audit (
  id SERIAL PRIMARY KEY,
  waitlist_id INTEGER NOT NULL REFERENCES coming_soon_waitlist(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'signed_up', 'notified', 'unsubscribed', 'bounced'
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_waitlist_id ON coming_soon_waitlist_audit(waitlist_id);
CREATE INDEX idx_audit_action ON coming_soon_waitlist_audit(action);

-- View for getting waitlist statistics by feature
CREATE OR REPLACE VIEW coming_soon_waitlist_stats AS
SELECT
  feature_type,
  COUNT(*) as total_signups,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'notified' THEN 1 END) as notified,
  COUNT(CASE WHEN status = 'unsubscribed' THEN 1 END) as unsubscribed,
  COUNT(DISTINCT DATE(created_at)) as signup_days,
  MAX(created_at) as latest_signup
FROM coming_soon_waitlist
GROUP BY feature_type;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_coming_soon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coming_soon_updated_at_trigger
BEFORE UPDATE ON coming_soon_waitlist
FOR EACH ROW
EXECUTE FUNCTION update_coming_soon_updated_at();
