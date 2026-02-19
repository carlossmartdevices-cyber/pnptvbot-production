const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Verify Telegram login widget data
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramAuth(data) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    logger.error('BOT_TOKEN not configured for Telegram auth verification');
    return false;
  }

  const { hash, ...rest } = data;
  if (!hash) return false;

  const checkArr = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`);
  const checkString = checkArr.join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (hmac !== hash) return false;

  // Check auth_date is not too old (allow 1 day)
  const authDate = parseInt(data.auth_date, 10);
  if (Date.now() / 1000 - authDate > 86400) return false;

  return true;
}

/**
 * POST /api/webapp/auth/telegram
 * Authenticate user via Telegram Login Widget
 */
const telegramLogin = async (req, res) => {
  try {
    const telegramUser = req.body.telegramUser || req.body;

    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'Invalid Telegram user data' });
    }

    // Verify Telegram hash in production
    if (process.env.NODE_ENV === 'production' && telegramUser.hash) {
      if (!verifyTelegramAuth(telegramUser)) {
        logger.warn('Invalid Telegram auth hash', { userId: telegramUser.id });
        return res.status(401).json({ error: 'Invalid authentication data' });
      }
    }

    // Look up user
    const result = await query(
      `SELECT id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_url, bio, language
       FROM users WHERE telegram = $1`,
      [String(telegramUser.id)]
    );

    if (result.rows.length === 0) {
      req.session.pendingTelegramUser = telegramUser;
      return res.json({
        authenticated: false,
        registered: false,
        message: 'User not registered. Please use the Telegram bot first.'
      });
    }

    const user = result.rows[0];

    req.session.user = {
      id: user.id,
      telegramId: user.telegram,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      subscriptionStatus: user.subscription_status,
      acceptedTerms: user.accepted_terms,
      photoUrl: telegramUser.photo_url || user.photo_url,
      bio: user.bio,
      language: user.language
    };

    logger.info(`Web app Telegram login: user ${user.id} (${user.username})`);

    res.json({
      authenticated: true,
      registered: true,
      termsAccepted: user.accepted_terms,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: telegramUser.photo_url || user.photo_url,
        subscriptionStatus: user.subscription_status
      }
    });
  } catch (error) {
    logger.error('Web app Telegram login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * GET /api/webapp/auth/x/start
 * Start X OAuth flow for web login (redirects to X)
 */
const xLoginStart = async (req, res) => {
  try {
    const XOAuthService = require('../../services/xOAuthService');
    // createAuthUrl() returns a URL string directly (not an object)
    const authUrl = await XOAuthService.createAuthUrl();

    // Flag this session so the OAuth callback can redirect to the webapp instead of the bot
    req.session.xWebLogin = true;

    res.json({ success: true, url: authUrl });
  } catch (error) {
    logger.error('X OAuth start error:', error);
    res.status(500).json({ error: 'Failed to start X authentication' });
  }
};

/**
 * GET /api/webapp/auth/x/callback
 * Handle X OAuth callback for web login
 */
const xLoginCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect('/prime-hub/login?error=missing_params');
    }

    const XOAuthService = require('../../services/xOAuthService');
    const account = await XOAuthService.handleOAuthCallback({ code, state });

    if (!account || !account.handle) {
      return res.redirect('/prime-hub/login?error=auth_failed');
    }

    // Find user by X handle
    const result = await query(
      `SELECT id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_url, bio, language
       FROM users WHERE x_handle = $1 OR x_username = $1`,
      [account.handle]
    );

    if (result.rows.length === 0) {
      return res.redirect('/prime-hub/login?error=not_registered&x_handle=' + encodeURIComponent(account.handle));
    }

    const user = result.rows[0];

    req.session.user = {
      id: user.id,
      telegramId: user.telegram,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      subscriptionStatus: user.subscription_status,
      acceptedTerms: user.accepted_terms,
      photoUrl: user.photo_url,
      bio: user.bio,
      language: user.language,
      xHandle: account.handle
    };

    logger.info(`Web app X login: user ${user.id} via @${account.handle}`);

    res.redirect('/prime-hub/?auth=success');
  } catch (error) {
    logger.error('X OAuth callback error:', error);
    res.redirect('/prime-hub/login?error=auth_failed');
  }
};

/**
 * GET /api/webapp/auth/status
 * Check current authentication status
 */
const authStatus = (req, res) => {
  const user = req.session?.user;
  if (!user) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      subscriptionStatus: user.subscriptionStatus,
      acceptedTerms: user.acceptedTerms,
      language: user.language
    }
  });
};

/**
 * POST /api/webapp/auth/logout
 */
const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
};

/**
 * GET /api/webapp/profile
 * Get full user profile
 */
const getProfile = async (req, res) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = await query(
      `SELECT id, telegram, username, first_name, last_name, bio, photo_url,
              subscription_status, subscription_plan, subscription_expires_at,
              language, interests, location_text, x_handle, x_username,
              instagram_handle, tiktok_handle, youtube_handle,
              accepted_terms, created_at
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = result.rows[0];
    res.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        bio: profile.bio,
        photoUrl: profile.photo_url,
        subscriptionStatus: profile.subscription_status,
        subscriptionPlan: profile.subscription_plan,
        subscriptionExpires: profile.subscription_expires_at,
        language: profile.language,
        interests: profile.interests,
        locationText: profile.location_text,
        xHandle: profile.x_handle || profile.x_username,
        instagramHandle: profile.instagram_handle,
        tiktokHandle: profile.tiktok_handle,
        youtubeHandle: profile.youtube_handle,
        memberSince: profile.created_at
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

/**
 * GET /api/webapp/mastodon/feed
 * Fetch recent Mastodon posts (public timeline or PNPtv account)
 */
const getMastodonFeed = async (req, res) => {
  try {
    // Support both MASTODON_INSTANCE (new) and MASTODON_BASE_URL (legacy alias)
    const mastodonInstance = process.env.MASTODON_INSTANCE || process.env.MASTODON_BASE_URL || 'https://mastodon.social';
    // Support both MASTODON_ACCOUNT_ID (numeric) and MASTODON_ACCESS_TOKEN-based lookup
    const mastodonAccount = process.env.MASTODON_ACCOUNT_ID;
    const mastodonToken = process.env.MASTODON_ACCESS_TOKEN;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    let feedUrl;
    const authHeaders = { 'Accept': 'application/json' };
    if (mastodonToken) {
      authHeaders['Authorization'] = `Bearer ${mastodonToken}`;
    }

    if (mastodonAccount) {
      feedUrl = `${mastodonInstance}/api/v1/accounts/${mastodonAccount}/statuses?limit=${limit}&exclude_replies=true`;
    } else if (mastodonToken) {
      // Use home timeline if we have an access token but no account ID
      feedUrl = `${mastodonInstance}/api/v1/timelines/home?limit=${limit}`;
    } else {
      // Public timeline as fallback
      feedUrl = `${mastodonInstance}/api/v1/timelines/public?limit=${limit}&local=true`;
    }

    const response = await axios.get(feedUrl, {
      timeout: 5000,
      headers: authHeaders
    });

    const posts = (response.data || []).map(post => ({
      id: post.id,
      content: post.content,
      createdAt: post.created_at,
      url: post.url,
      account: {
        username: post.account?.username,
        displayName: post.account?.display_name,
        avatar: post.account?.avatar
      },
      mediaAttachments: (post.media_attachments || []).map(m => ({
        type: m.type,
        url: m.url,
        previewUrl: m.preview_url
      })),
      favouritesCount: post.favourites_count,
      reblogsCount: post.reblogs_count,
      repliesCount: post.replies_count
    }));

    res.json({ success: true, posts });
  } catch (error) {
    logger.error('Mastodon feed error:', error.message);
    // Return empty feed rather than error
    res.json({
      success: true,
      posts: [],
      message: 'Mastodon feed temporarily unavailable'
    });
  }
};

module.exports = {
  telegramLogin,
  xLoginStart,
  xLoginCallback,
  authStatus,
  logout,
  getProfile,
  getMastodonFeed
};
