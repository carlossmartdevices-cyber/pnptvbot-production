/**
 * Migration: PDS Bluesky and Element/Matrix Integration
 * Adds tables for federated identity management and external content ingestion
 *
 * PRIVACY ARCHITECTURE:
 * - Inbound only: External posts/profiles are read-only cached
 * - Outbound blocked: NO data from pnptv shared to external services
 * - Isolation: Posts remain private to pnptv infrastructure
 * - Community boundary: Internal posts never federate outbound
 *
 * Tables:
 * - external_profiles - Link pnptv users to Bluesky/Element accounts
 * - pds_posts - Cache of Bluesky posts (read-only, never re-shared)
 * - element_rooms - Subscribed Element/Matrix rooms
 * - external_profile_verification - Verification tokens for linked accounts
 * - federated_access_log - Audit trail of external data access
 * - pds_feed_preferences - User feed filtering and privacy settings
 * - element_room_membership - Track user membership in Element rooms
 */

-- ==============================================================================
-- EXTERNAL PROFILES TABLE
-- ==============================================================================
-- Links pnptv user accounts to external Bluesky/Element profiles
CREATE TABLE IF NOT EXISTS external_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pnptv_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Service type (bluesky, element)
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('bluesky', 'element')),

  -- External account identifier
  external_user_id VARCHAR(255) NOT NULL, -- Bluesky DID, Element user_id
  external_username VARCHAR(255) NOT NULL, -- Display username
  external_email VARCHAR(255), -- May not always be available

  -- Profile metadata (cached from external service, read-only)
  profile_name VARCHAR(256),
  profile_bio TEXT,
  profile_avatar_url TEXT, -- External avatar URL (not stored locally)
  profile_metadata JSONB, -- Service-specific profile data

  -- Verification status
  is_verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(255), -- Temporary code for ownership verification
  verification_expires_at TIMESTAMP,
  verified_at TIMESTAMP,

  -- Privacy controls
  show_on_profile BOOLEAN DEFAULT TRUE, -- Display on pnptv profile card
  show_follower_count BOOLEAN DEFAULT TRUE, -- Display external follower count
  show_activity_status BOOLEAN DEFAULT TRUE, -- Show last active from external
  public_linking BOOLEAN DEFAULT FALSE, -- Allow others to see this linking

  -- API credentials (encrypted in app layer, NOT stored plain text)
  -- Only used for read-only access to external APIs
  access_token_encrypted VARCHAR(1000), -- Encrypted external API token
  refresh_token_encrypted VARCHAR(1000), -- For services that support refresh
  token_expires_at TIMESTAMP,

  -- Sync and activity
  last_synced_at TIMESTAMP,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  last_activity_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(pnptv_user_id, service_type, external_user_id),
  CONSTRAINT service_requires_external_id CHECK (external_user_id IS NOT NULL)
);

CREATE INDEX idx_external_profiles_pnptv_user_id
  ON external_profiles(pnptv_user_id);

CREATE INDEX idx_external_profiles_service_type
  ON external_profiles(service_type);

CREATE INDEX idx_external_profiles_external_user_id
  ON external_profiles(external_user_id);

CREATE INDEX idx_external_profiles_is_verified
  ON external_profiles(is_verified);

CREATE INDEX idx_external_profiles_created_at
  ON external_profiles(created_at DESC);

-- ==============================================================================
-- EXTERNAL PROFILE VERIFICATION TABLE
-- ==============================================================================
-- Stores verification tokens and challenge data for proving external profile ownership
CREATE TABLE IF NOT EXISTS external_profile_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_profile_id UUID NOT NULL REFERENCES external_profiles(id) ON DELETE CASCADE,

  -- Verification method (proof_of_ownership, email_confirmation, api_token)
  verification_method VARCHAR(50) NOT NULL,

  -- Challenge data
  challenge_data JSONB, -- Service-specific challenge (e.g., Bluesky atproto challenge)
  challenge_expires_at TIMESTAMP NOT NULL,

  -- Proof data
  proof_provided JSONB, -- Proof from user (e.g., signed payload)
  proof_verified_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT verification_not_expired CHECK (
    proof_verified_at IS NOT NULL OR challenge_expires_at > NOW()
  )
);

CREATE INDEX idx_external_profile_verification_profile_id
  ON external_profile_verification(external_profile_id);

CREATE INDEX idx_external_profile_verification_expires_at
  ON external_profile_verification(challenge_expires_at);

-- ==============================================================================
-- PDS POSTS TABLE
-- ==============================================================================
-- Cache of posts from Bluesky PDS (read-only, never re-shared outbound)
CREATE TABLE IF NOT EXISTS pds_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External post identifier
  bluesky_uri VARCHAR(500) UNIQUE NOT NULL, -- at:// URI from Bluesky
  bluesky_cid VARCHAR(255), -- Content hash from Bluesky

  -- Who posted it
  author_external_user_id VARCHAR(255) NOT NULL,
  author_external_username VARCHAR(255) NOT NULL,

  -- Post metadata
  post_text TEXT NOT NULL,
  post_facets JSONB, -- Links, mentions, tags from Bluesky
  embedded_images JSONB, -- Bluesky image data (URLs, metadata)

  -- Why we cached it
  cached_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL, -- Who added this to their feed
  reason_cached VARCHAR(100), -- "followed_user", "search_result", "timeline", "shared"

  -- External post metadata
  likes_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  reposts_count INT DEFAULT 0,
  parent_post_uri VARCHAR(500), -- If this is a reply

  -- TTL - External posts expire after 24h to prevent stale data
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT post_not_empty CHECK (char_length(post_text) > 0),
  CONSTRAINT expiry_in_future CHECK (expires_at > created_at)
);

CREATE INDEX idx_pds_posts_author_user_id
  ON pds_posts(author_external_user_id);

CREATE INDEX idx_pds_posts_cached_by_user
  ON pds_posts(cached_by_user_id);

CREATE INDEX idx_pds_posts_expires_at
  ON pds_posts(expires_at);

CREATE INDEX idx_pds_posts_created_at
  ON pds_posts(created_at DESC);

-- ==============================================================================
-- PDS FEED PREFERENCES TABLE
-- ==============================================================================
-- User settings for external feed display, filtering, and privacy
CREATE TABLE IF NOT EXISTS pds_feed_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pnptv_user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Bluesky feed preferences
  show_bluesky_feed BOOLEAN DEFAULT TRUE,
  bluesky_feed_enabled BOOLEAN DEFAULT FALSE,
  bluesky_auto_sync BOOLEAN DEFAULT FALSE, -- Auto-sync from linked account

  -- Filtering
  muted_external_users JSONB DEFAULT '[]'::jsonb, -- Array of external_user_ids to mute
  blocked_external_users JSONB DEFAULT '[]'::jsonb, -- Array of external_user_ids to block
  filter_retweets BOOLEAN DEFAULT FALSE,
  filter_replies BOOLEAN DEFAULT FALSE,

  -- Element preferences
  show_element_rooms BOOLEAN DEFAULT TRUE,
  element_notifications BOOLEAN DEFAULT TRUE,
  element_auto_sync BOOLEAN DEFAULT FALSE,

  -- Feed merge preferences
  combined_feed_order VARCHAR(50) DEFAULT 'recent', -- recent, engagement, relevance
  external_content_ratio INT DEFAULT 30, -- % of feed from external sources (0-100)

  -- Privacy
  public_activity BOOLEAN DEFAULT FALSE, -- Show others what external content I'm viewing
  share_reading_history BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pds_feed_preferences_user_id
  ON pds_feed_preferences(pnptv_user_id);

-- ==============================================================================
-- ELEMENT ROOMS TABLE
-- ==============================================================================
-- Subscribed Element/Matrix rooms that we're monitoring
CREATE TABLE IF NOT EXISTS element_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Element room identifier
  room_id VARCHAR(255) NOT NULL UNIQUE, -- !roomid:element.server format
  room_alias VARCHAR(255), -- #roomname:element.server format

  -- Room metadata (cached from Element)
  room_name VARCHAR(256),
  room_topic VARCHAR(500),
  room_avatar_url TEXT,
  members_count INT DEFAULT 0,

  -- Room metadata
  room_metadata JSONB, -- Full room state from Element

  -- Access control
  is_public BOOLEAN DEFAULT TRUE,
  access_url TEXT, -- Link to room on Element server

  -- Sync status
  last_synced_at TIMESTAMP,
  last_message_timestamp BIGINT, -- Matrix timestamp of last message

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_element_rooms_room_id
  ON element_rooms(room_id);

CREATE INDEX idx_element_rooms_created_at
  ON element_rooms(created_at DESC);

-- ==============================================================================
-- ELEMENT ROOM MEMBERSHIP TABLE
-- ==============================================================================
-- Track which pnptv users are members of which Element rooms
CREATE TABLE IF NOT EXISTS element_room_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pnptv_user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES element_rooms(id) ON DELETE CASCADE,

  -- Element user state
  element_user_id VARCHAR(255), -- Matrix user_id for this room
  display_name VARCHAR(256),
  avatar_url TEXT,

  -- Membership status
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,

  -- Preferences
  notifications_enabled BOOLEAN DEFAULT TRUE,
  muted BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(pnptv_user_id, room_id)
);

CREATE INDEX idx_element_room_membership_user_id
  ON element_room_membership(pnptv_user_id);

CREATE INDEX idx_element_room_membership_room_id
  ON element_room_membership(room_id);

CREATE INDEX idx_element_room_membership_is_active
  ON element_room_membership(is_active);

-- ==============================================================================
-- FEDERATED ACCESS LOG TABLE
-- ==============================================================================
-- Audit trail of all external data access (privacy enforcement)
CREATE TABLE IF NOT EXISTS federated_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who accessed
  pnptv_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- What was accessed
  service_type VARCHAR(50) NOT NULL, -- bluesky, element
  external_resource_type VARCHAR(50) NOT NULL, -- post, profile, room, message
  external_resource_id VARCHAR(500) NOT NULL,

  -- Action taken
  action VARCHAR(50) NOT NULL, -- view, cache, import, share (note: share only inbound)

  -- Request context
  request_path VARCHAR(500),
  http_method VARCHAR(10),
  user_agent VARCHAR(500),
  ip_address INET,

  -- Status
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT action_is_read_or_inbound CHECK (action IN ('view', 'cache', 'import', 'receive'))
);

CREATE INDEX idx_federated_access_log_user_id
  ON federated_access_log(pnptv_user_id);

CREATE INDEX idx_federated_access_log_service_type
  ON federated_access_log(service_type);

CREATE INDEX idx_federated_access_log_created_at
  ON federated_access_log(created_at DESC);

CREATE INDEX idx_federated_access_log_external_id
  ON federated_access_log(external_resource_id);

-- ==============================================================================
-- OUTBOUND FEDERATION BLOCK LOG TABLE
-- ==============================================================================
-- Log of all blocked outbound federation attempts (privacy enforcement)
CREATE TABLE IF NOT EXISTS outbound_federation_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who tried
  pnptv_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- What they tried
  target_service VARCHAR(50), -- bluesky, element, unknown
  target_url TEXT,
  target_method VARCHAR(10),
  target_resource VARCHAR(255),

  -- Request details
  request_body BYTEA, -- First 10KB of request body (for forensics)
  headers_truncated TEXT[], -- Request headers (redacted, truncated)
  ip_address INET,

  -- Block details
  block_reason VARCHAR(255), -- e.g., "outbound_federation_blocked"
  severity VARCHAR(20) DEFAULT 'warn', -- warn, error, critical

  -- Audit
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outbound_federation_blocks_user_id
  ON outbound_federation_blocks(pnptv_user_id);

CREATE INDEX idx_outbound_federation_blocks_created_at
  ON outbound_federation_blocks(created_at DESC);

-- ==============================================================================
-- ENCRYPTION KEY MANAGEMENT (for token storage)
-- ==============================================================================
-- Note: Actual keys stored in .env, tokens encrypted at application layer
-- This table is for key rotation tracking only
CREATE TABLE IF NOT EXISTS federation_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key metadata
  key_id VARCHAR(255) NOT NULL UNIQUE,
  key_version INT NOT NULL DEFAULT 1,
  algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  rotated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- For future key rotation

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_federation_encryption_keys_is_active
  ON federation_encryption_keys(is_active);

-- ==============================================================================
-- CLEANUP JOBS
-- ==============================================================================
-- Expired posts are automatically cleaned via TTL
-- Verification tokens are cleaned via expiry check
-- Run in background job every 6 hours:
-- DELETE FROM pds_posts WHERE expires_at < NOW();
-- DELETE FROM external_profile_verification WHERE challenge_expires_at < NOW() AND proof_verified_at IS NULL;

-- ==============================================================================
-- PRIVACY ENFORCEMENT RULES
-- ==============================================================================
-- These are enforced at middleware level:
-- 1. NO POST requests allowed to external URLs (outbound blocked at app layer)
-- 2. NO PUT/PATCH/DELETE on federated data (read-only)
-- 3. ALL external API calls logged to federated_access_log
-- 4. ALL tokens encrypted, never logged in plain text
-- 5. pnptv_posts table has ZERO foreign key references to federated tables
-- 6. Webhook handlers verify cryptographic signatures before any state mutation
