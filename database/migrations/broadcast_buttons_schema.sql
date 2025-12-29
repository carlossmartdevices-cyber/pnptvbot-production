-- Broadcast Buttons Schema
-- Stores custom buttons and CTAs for broadcasts

-- Table: broadcast_button_presets
-- Predefined button sets that admins can use
CREATE TABLE IF NOT EXISTS broadcast_button_presets (
  preset_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(10),
  buttons JSONB NOT NULL, -- Array of button objects
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: broadcast_buttons
-- Custom buttons for each broadcast
CREATE TABLE IF NOT EXISTS broadcast_buttons (
  button_id SERIAL PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  preset_id INT REFERENCES broadcast_button_presets(preset_id),
  button_text VARCHAR(255) NOT NULL,
  button_type VARCHAR(50) NOT NULL, -- 'url', 'plan', 'feature', 'command', 'custom'
  button_target VARCHAR(500), -- URL, plan ID, feature name, or command
  button_order INT NOT NULL DEFAULT 0,
  button_icon VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_buttons_broadcast_id ON broadcast_buttons(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_buttons_preset_id ON broadcast_buttons(preset_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_button_presets_enabled ON broadcast_button_presets(enabled);

-- Insert default presets
INSERT INTO broadcast_button_presets (name, description, icon, buttons, enabled) VALUES
(
  'Plans Promo',
  'Link to subscription plans page',
  '💎',
  '[{"text":"💎 View Plans","type":"command","target":"/plans"}]'::jsonb,
  true
),
(
  'Premium Offer',
  'Direct link to premium plan',
  '⭐',
  '[{"text":"⭐ Get Premium","type":"plan","target":"premium"}]'::jsonb,
  true
),
(
  'Support & Share',
  'Support link and share option',
  '🆘',
  '[{"text":"🆘 Get Help","type":"command","target":"/support"},{"text":"📢 Share","type":"command","target":"/share"}]'::jsonb,
  true
),
(
  'Features Showcase',
  'Link to app features',
  '✨',
  '[{"text":"✨ Explore Features","type":"command","target":"/features"}]'::jsonb,
  true
),
(
  'Community Links',
  'Community engagement buttons',
  '👥',
  '[{"text":"👥 Join Community","type":"url","target":"https://t.me/pnptv_community"},{"text":"📣 Channel","type":"url","target":"https://t.me/pnptv_channel"}]'::jsonb,
  true
),
(
  'Engagement Full',
  'All engagement options',
  '🎯',
  '[{"text":"💎 Plans","type":"command","target":"/plans"},{"text":"🆘 Support","type":"command","target":"/support"},{"text":"📢 Share","type":"command","target":"/share"}]'::jsonb,
  true
) ON CONFLICT (name) DO NOTHING;
