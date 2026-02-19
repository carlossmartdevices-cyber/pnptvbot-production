const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');
const axios = require('axios');

const authGuard = (req, res) => {
  const user = req.session?.user;
  if (!user) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return user;
};

// ── Feed ──────────────────────────────────────────────────────────────────────

const getFeed = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { cursor, limit = 20 } = req.query;
  const lim = Math.min(Number(limit) || 20, 50);
  try {
    const { rows } = await query(
      `SELECT sp.id, sp.content, sp.media_url, sp.media_type, sp.reply_to_id, sp.repost_of_id,
              sp.likes_count, sp.reposts_count, sp.replies_count, sp.created_at,
              u.id as author_id, u.username as author_username,
              u.first_name as author_first_name, u.photo_file_id as author_photo,
              EXISTS(SELECT 1 FROM social_post_likes l WHERE l.post_id=sp.id AND l.user_id=$1) as liked_by_me,
              -- repost original
              rp.content as repost_content, rp.created_at as repost_created_at,
              ru.username as repost_author_username, ru.first_name as repost_author_first_name
       FROM social_posts sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN social_posts rp ON sp.repost_of_id = rp.id
       LEFT JOIN users ru ON rp.user_id = ru.id
       WHERE sp.is_deleted = false AND sp.reply_to_id IS NULL
         ${cursor ? 'AND sp.created_at < $3' : ''}
       ORDER BY sp.created_at DESC
       LIMIT $2`,
      cursor ? [user.id, lim, cursor] : [user.id, lim]
    );
    const nextCursor = rows.length === lim ? rows[rows.length - 1].created_at : null;
    return res.json({ success: true, posts: rows, nextCursor });
  } catch (err) {
    logger.error('getFeed error', err);
    return res.status(500).json({ error: 'Failed to load feed' });
  }
};

const getWall = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { userId } = req.params;
  const { cursor, limit = 20 } = req.query;
  const lim = Math.min(Number(limit) || 20, 50);
  try {
    const [postsRes, profileRes] = await Promise.all([
      query(
        `SELECT sp.id, sp.content, sp.media_url, sp.media_type, sp.reply_to_id, sp.repost_of_id,
                sp.likes_count, sp.reposts_count, sp.replies_count, sp.created_at,
                u.id as author_id, u.username as author_username,
                u.first_name as author_first_name, u.photo_file_id as author_photo,
                EXISTS(SELECT 1 FROM social_post_likes l WHERE l.post_id=sp.id AND l.user_id=$1) as liked_by_me
         FROM social_posts sp
         JOIN users u ON sp.user_id = u.id
         WHERE sp.is_deleted = false AND sp.user_id = $2 AND sp.reply_to_id IS NULL
           ${cursor ? 'AND sp.created_at < $4' : ''}
         ORDER BY sp.created_at DESC LIMIT $3`,
        cursor ? [user.id, userId, lim, cursor] : [user.id, userId, lim]
      ),
      query(
        `SELECT id, username, first_name, last_name, bio, photo_file_id, pnptv_id,
                subscription_status, created_at
         FROM users WHERE id = $1`,
        [userId]
      ),
    ]);
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const nextCursor = postsRes.rows.length === lim ? postsRes.rows[postsRes.rows.length - 1].created_at : null;
    return res.json({ success: true, profile: profileRes.rows[0], posts: postsRes.rows, nextCursor });
  } catch (err) {
    logger.error('getWall error', err);
    return res.status(500).json({ error: 'Failed to load wall' });
  }
};

// ── Create Post ───────────────────────────────────────────────────────────────

const createPost = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { content, replyToId, repostOfId } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  if (content.length > 5000) return res.status(400).json({ error: 'Post too long (max 5000 chars)' });

  try {
    const { rows } = await query(
      `INSERT INTO social_posts (user_id, content, reply_to_id, repost_of_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, media_url, media_type, reply_to_id, repost_of_id,
                 likes_count, reposts_count, replies_count, created_at`,
      [user.id, content.trim(), replyToId || null, repostOfId || null]
    );
    const post = rows[0];

    // Update reply count on parent
    if (replyToId) {
      await query('UPDATE social_posts SET replies_count = replies_count + 1 WHERE id = $1', [replyToId]);
    }
    // Update repost count on original
    if (repostOfId) {
      await query('UPDATE social_posts SET reposts_count = reposts_count + 1 WHERE id = $1', [repostOfId]);
    }

    // Mirror to Mastodon if token configured and it's a top-level post
    if (!replyToId && !repostOfId && process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_BASE_URL) {
      axios.post(
        `${process.env.MASTODON_BASE_URL}/api/v1/statuses`,
        { status: content.trim() },
        { headers: { Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` } }
      ).then(r => {
        query('UPDATE social_posts SET mastodon_id = $1 WHERE id = $2', [r.data.id, post.id]).catch(() => {});
      }).catch(() => {});
    }

    // Notify room via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('feed:new_post', {
        ...post,
        author_id: user.id,
        author_username: user.username,
        author_first_name: user.firstName,
        author_photo: user.photoUrl,
        liked_by_me: false,
      });
    }

    const fullPost = {
      ...post,
      author_id: user.id,
      author_username: user.username,
      author_first_name: user.firstName || user.first_name,
      author_photo: user.photoUrl || user.photo_url,
      liked_by_me: false,
    };
    return res.json({ success: true, post: fullPost });
  } catch (err) {
    logger.error('createPost error', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
};

// ── Like ──────────────────────────────────────────────────────────────────────

const toggleLike = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { postId } = req.params;
  try {
    const existing = await query('SELECT 1 FROM social_post_likes WHERE post_id=$1 AND user_id=$2', [postId, user.id]);
    if (existing.rows.length > 0) {
      await query('DELETE FROM social_post_likes WHERE post_id=$1 AND user_id=$2', [postId, user.id]);
      await query('UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id=$1', [postId]);
      return res.json({ liked: false });
    } else {
      await query('INSERT INTO social_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [postId, user.id]);
      await query('UPDATE social_posts SET likes_count = likes_count + 1 WHERE id=$1', [postId]);
      return res.json({ liked: true });
    }
  } catch (err) {
    logger.error('toggleLike error', err);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────

const deletePost = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { postId } = req.params;
  try {
    const { rowCount } = await query(
      'UPDATE social_posts SET is_deleted=true WHERE id=$1 AND user_id=$2',
      [postId, user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Post not found or not yours' });
    return res.json({ success: true });
  } catch (err) {
    logger.error('deletePost error', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
};

// ── Replies ───────────────────────────────────────────────────────────────────

const getReplies = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const { postId } = req.params;
  const { cursor } = req.query;
  try {
    const { rows } = await query(
      `SELECT sp.id, sp.content, sp.likes_count, sp.replies_count, sp.created_at,
              u.id as author_id, u.username as author_username,
              u.first_name as author_first_name, u.photo_file_id as author_photo,
              EXISTS(SELECT 1 FROM social_post_likes l WHERE l.post_id=sp.id AND l.user_id=$1) as liked_by_me
       FROM social_posts sp JOIN users u ON sp.user_id = u.id
       WHERE sp.reply_to_id = $2 AND sp.is_deleted = false
         ${cursor ? 'AND sp.created_at > $3' : ''}
       ORDER BY sp.created_at ASC LIMIT 20`,
      cursor ? [user.id, postId, cursor] : [user.id, postId]
    );
    return res.json({ success: true, replies: rows });
  } catch (err) {
    logger.error('getReplies error', err);
    return res.status(500).json({ error: 'Failed to load replies' });
  }
};

// ── Post to Mastodon ──────────────────────────────────────────────────────────

const postToMastodon = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  const baseUrl = process.env.MASTODON_BASE_URL || process.env.MASTODON_INSTANCE;
  if (!token || !baseUrl) return res.status(503).json({ error: 'Mastodon not configured' });
  const { status } = req.body;
  if (!status || !status.trim()) return res.status(400).json({ error: 'Status required' });
  try {
    const r = await axios.post(`${baseUrl}/api/v1/statuses`, { status: status.trim() }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json({ success: true, post: r.data });
  } catch (err) {
    logger.error('postToMastodon error', err.message);
    return res.status(500).json({ error: 'Failed to post to Mastodon' });
  }
};

module.exports = { getFeed, getWall, createPost, toggleLike, deletePost, getReplies, postToMastodon };
