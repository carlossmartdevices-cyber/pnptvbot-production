-- ===================================
-- N8N Automation & Workflow Logging
-- ===================================

-- Table for payment recovery tracking
CREATE TABLE IF NOT EXISTS payment_recovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'n8n_automation'
);

-- Table for email notification tracking
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  subject VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP,
  error_message TEXT,
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Table for workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  execution_time_ms INT,
  items_processed INT DEFAULT 0,
  items_success INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  triggered_by VARCHAR(100) DEFAULT 'n8n_scheduler',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for system health checks
CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  response_time_ms INT,
  details JSONB,
  checked_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX component_status (component, status),
  INDEX health_check_time (created_at DESC)
);

-- Table for subscription expiry notifications (scheduled)
CREATE TABLE IF NOT EXISTS subscription_expiry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  expires_at TIMESTAMP NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX expiry_date (expires_at),
  INDEX status (status),
  INDEX subscriber_id (subscriber_id)
);

-- Table for admin alerts
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title VARCHAR(255),
  message TEXT,
  details JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX alert_type (alert_type, acknowledged),
  INDEX severity (severity),
  INDEX created_time (created_at DESC)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_recovery_status ON payment_recovery_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_execution_logs(workflow_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_latest ON system_health_checks(component, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON admin_alerts(acknowledged, severity, created_at DESC);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_recovery_timestamp
  BEFORE UPDATE ON payment_recovery_log
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_email_notifications_timestamp
  BEFORE UPDATE ON email_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_workflow_logs_timestamp
  BEFORE UPDATE ON workflow_execution_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_alerts_timestamp
  BEFORE UPDATE ON admin_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
