-- Meru Payment Links Tracking
-- Tracks all Meru payment links and their usage status to prevent duplicates

CREATE TABLE IF NOT EXISTS meru_payment_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  meru_link VARCHAR(255) NOT NULL UNIQUE,
  product VARCHAR(100) DEFAULT 'lifetime-pass',
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'used', 'expired', 'invalid'
  activation_code VARCHAR(50) REFERENCES activation_codes(code) ON DELETE SET NULL,
  used_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  used_by_username VARCHAR(255),
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invalidated_at TIMESTAMP,
  invalidation_reason TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_meru_links_status ON meru_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_meru_links_code ON meru_payment_links(code);
CREATE INDEX IF NOT EXISTS idx_meru_links_used_by ON meru_payment_links(used_by);
CREATE INDEX IF NOT EXISTS idx_meru_links_created_at ON meru_payment_links(created_at);
CREATE INDEX IF NOT EXISTS idx_meru_links_activation_code ON meru_payment_links(activation_code);

-- View for available links (active only)
CREATE OR REPLACE VIEW available_meru_links AS
SELECT * FROM meru_payment_links WHERE status = 'active';

-- Seed initial data from the lifetime-pass.html links
-- These would normally be populated by a service
INSERT INTO meru_payment_links (code, meru_link, product, status) VALUES
('LSJUek', 'https://pay.getmeru.com/LSJUek', 'lifetime-pass', 'active'),
('FCqG-z', 'https://pay.getmeru.com/FCqG-z', 'lifetime-pass', 'active'),
('MEz8OG', 'https://pay.getmeru.com/MEz8OG', 'lifetime-pass', 'active'),
('_DIFtk', 'https://pay.getmeru.com/_DIFtk', 'lifetime-pass', 'active'),
('no4m1d', 'https://pay.getmeru.com/no4m1d', 'lifetime-pass', 'active'),
('9lDA6e', 'https://pay.getmeru.com/9lDA6e', 'lifetime-pass', 'active'),
('SKYO2w', 'https://pay.getmeru.com/SKYO2w', 'lifetime-pass', 'active'),
('m-3CVd', 'https://pay.getmeru.com/m-3CVd', 'lifetime-pass', 'active'),
('daq_Ak', 'https://pay.getmeru.com/daq_Ak', 'lifetime-pass', 'active'),
('_26Hnr', 'https://pay.getmeru.com/_26Hnr', 'lifetime-pass', 'active')
ON CONFLICT (code) DO NOTHING;
