#!/usr/bin/env node
/**
 * Fix migration 030: social/chat/DM tables use BIGINT for user_id but users.id is VARCHAR(255)
 * Safe to run: drops and recreates empty tables with correct VARCHAR types.
 */

const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), allowEmptyValues: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), allowEmptyValues: true, override: false });

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB || 'pnptvbot',
  user:     process.env.POSTGRES_USER     || 'pnptvbot',
  password: process.env.POSTGRES_PASSWORD || '',
});

const SQL = `
-- Drop in reverse FK order (tables should be empty)
DROP TABLE IF EXISTS social_post_likes;
DROP TABLE IF EXISTS social_posts;
DROP TABLE IF EXISTS dm_threads;
DROP TABLE IF EXISTS direct_messages;
DROP TABLE IF EXISTS chat_messages;

-- Group chat (VARCHAR user_id)
CREATE TABLE chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    room        VARCHAR(100) NOT NULL DEFAULT 'general',
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username    VARCHAR(255),
    first_name  VARCHAR(255),
    photo_url   TEXT,
    content     TEXT NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room, created_at DESC);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

-- Direct messages (VARCHAR sender/recipient)
CREATE TABLE direct_messages (
    id           BIGSERIAL PRIMARY KEY,
    sender_id    VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dm_sender_recipient ON direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_dm_recipient_read ON direct_messages(recipient_id, is_read);

-- DM threads (VARCHAR user_a/user_b, lexicographic order consistent with JS .sort())
CREATE TABLE dm_threads (
    user_a          VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b          VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message    VARCHAR(100),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_for_a    INT NOT NULL DEFAULT 0,
    unread_for_b    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_a, user_b),
    CONSTRAINT dm_threads_order CHECK (user_a < user_b)
);
CREATE INDEX idx_dm_threads_user_a ON dm_threads(user_a, last_message_at DESC);
CREATE INDEX idx_dm_threads_user_b ON dm_threads(user_b, last_message_at DESC);

-- Social posts (VARCHAR user_id, BIGINT self-references are fine)
CREATE TABLE social_posts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    media_url       TEXT,
    media_type      VARCHAR(20),
    reply_to_id     BIGINT REFERENCES social_posts(id) ON DELETE SET NULL,
    repost_of_id    BIGINT REFERENCES social_posts(id) ON DELETE SET NULL,
    likes_count     INT NOT NULL DEFAULT 0,
    reposts_count   INT NOT NULL DEFAULT 0,
    replies_count   INT NOT NULL DEFAULT 0,
    mastodon_id     VARCHAR(255),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_social_posts_feed ON social_posts(created_at DESC) WHERE is_deleted = FALSE AND reply_to_id IS NULL;
CREATE INDEX idx_social_posts_user ON social_posts(user_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_social_posts_replies ON social_posts(reply_to_id, created_at ASC) WHERE is_deleted = FALSE;

-- Social post likes (BIGINT post_id is fine, VARCHAR user_id)
CREATE TABLE social_post_likes (
    post_id    BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id    VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_social_post_likes_user ON social_post_likes(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Fixing social/chat/DM schema: replacing BIGINT user_id with VARCHAR(255)...');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('✓ Schema fixed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Fix failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
