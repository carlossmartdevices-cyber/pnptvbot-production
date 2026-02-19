-- Migration 030: Social posts, group chat, and direct messages tables

-- ── Group Chat ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    room        VARCHAR(100) NOT NULL DEFAULT 'general',
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username    VARCHAR(255),
    first_name  VARCHAR(255),
    photo_url   TEXT,
    content     TEXT NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- ── Direct Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
    id           BIGSERIAL PRIMARY KEY,
    sender_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_sender_recipient ON direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_read ON direct_messages(recipient_id, is_read);

-- ── DM Threads (one row per conversation pair) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_threads (
    user_a          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message    VARCHAR(100),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_for_a    INT NOT NULL DEFAULT 0,
    unread_for_b    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_a, user_b),
    CONSTRAINT dm_threads_order CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_dm_threads_user_a ON dm_threads(user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_threads_user_b ON dm_threads(user_b, last_message_at DESC);

-- ── Social Posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON social_posts(created_at DESC) WHERE is_deleted = FALSE AND reply_to_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_social_posts_replies ON social_posts(reply_to_id, created_at ASC) WHERE is_deleted = FALSE;

-- ── Social Post Likes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_post_likes (
    post_id    BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_post_likes_user ON social_post_likes(user_id);

-- ── Add bio column to users if missing ────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
