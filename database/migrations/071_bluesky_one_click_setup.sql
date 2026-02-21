/**
 * Migration: One-Click Bluesky Setup Integration
 * Adds columns to user_pds_mapping for automatic Bluesky account creation and profile syncing
 *
 * Features:
 * - Automatic Bluesky handle generation from pnptv username
 * - Auto-sync of profile data (avatar, bio, display name)
 * - Webhook integration for Bluesky events
 * - Audit trail of Bluesky operations
 */

-- ==============================================================================
-- ALTER user_pds_mapping TABLE - Add Bluesky columns
-- ==============================================================================

ALTER TABLE user_pds_mapping ADD COLUMN IF NOT EXISTS (
  -- Bluesky auto-setup status
  bluesky_handle VARCHAR(255) UNIQUE,                    -- @username.pnptv.app
  bluesky_did VARCHAR(255),                               -- Bluesky DID (decentralized identifier)
  bluesky_created_at TIMESTAMP,                           -- When Bluesky account was created
  bluesky_auto_sync BOOLEAN DEFAULT true,                 -- Enable automatic profile sync
  bluesky_synced_at TIMESTAMP,                            -- Last profile sync timestamp
  bluesky_last_error TEXT,                                -- Last sync error (if any)
  bluesky_status VARCHAR(50) DEFAULT 'pending'            -- pending, creating, active, error, disconnected
);

-- ==============================================================================
-- CREATE INDEX for Bluesky lookups
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_user_pds_mapping_bluesky_handle
  ON user_pds_mapping(bluesky_handle)
  WHERE bluesky_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_pds_mapping_bluesky_did
  ON user_pds_mapping(bluesky_did)
  WHERE bluesky_did IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_pds_mapping_bluesky_status
  ON user_pds_mapping(bluesky_status);

-- ==============================================================================
-- CREATE bluesky_profile_syncs TABLE - Audit trail of sync operations
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bluesky_profile_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pnptv_uuid VARCHAR(255) NOT NULL,

  -- What was synced
  sync_type VARCHAR(50) NOT NULL,  -- avatar, bio, display_name, all

  -- Field values before/after
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'success',  -- success, failed, pending
  error_message TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  triggered_by VARCHAR(50) DEFAULT 'auto'  -- auto, manual, webhook
);

CREATE INDEX IF NOT EXISTS idx_bluesky_profile_syncs_user_id
  ON bluesky_profile_syncs(user_id);

CREATE INDEX IF NOT EXISTS idx_bluesky_profile_syncs_created_at
  ON bluesky_profile_syncs(created_at DESC);

-- ==============================================================================
-- CREATE bluesky_events TABLE - Webhook events from Bluesky
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bluesky_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,

  -- Event type
  event_type VARCHAR(100) NOT NULL,  -- profile_updated, account_created, follow, like, etc.

  -- Event data
  event_data JSONB,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bluesky_events_user_id
  ON bluesky_events(user_id);

CREATE INDEX IF NOT EXISTS idx_bluesky_events_event_type
  ON bluesky_events(event_type);

CREATE INDEX IF NOT EXISTS idx_bluesky_events_processed
  ON bluesky_events(processed);

-- ==============================================================================
-- CREATE bluesky_connection_requests TABLE - One-click setup requests
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bluesky_connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Request status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed

  -- Generated handle
  requested_handle VARCHAR(255),

  -- Bluesky credentials (encrypted in app layer, NOT stored plain text)
  bluesky_did VARCHAR(255),
  bluesky_access_token_encrypted VARCHAR(1000),

  -- Timestamps
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Error info
  error_message TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bluesky_connection_requests_user_id
  ON bluesky_connection_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_bluesky_connection_requests_status
  ON bluesky_connection_requests(status);

CREATE INDEX IF NOT EXISTS idx_bluesky_connection_requests_expires_at
  ON bluesky_connection_requests(expires_at);

-- ==============================================================================
-- CLEANUP FUNCTIONS
-- ==============================================================================
-- Run in background job daily:
-- DELETE FROM bluesky_connection_requests WHERE expires_at < NOW();

-- Enable auto-sync trigger
-- This will be called by the BlueskyAutoSetupService when profile fields change
