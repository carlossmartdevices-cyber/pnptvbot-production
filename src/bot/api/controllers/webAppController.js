const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePnptvId() {
  return uuidv4();
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))))
  );
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const derivedBuf = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)))
  );
  return crypto.timingSafeEqual(hashBuf, derivedBuf);
}

async function createWebUser({ id, firstName, lastName, username, email, passwordHash, telegramId, twitterHandle, photoFileId } = {}) {
  const userId = id || uuidv4();
  const pnptvId = generatePnptvId();
  const displayName = username || (firstName ? `${firstName}${lastName ? `_${lastName}` : ''}`.toLowerCase().replace(/\s+/g, '_') : null);

  const { rows } = await query(
    `INSERT INTO users
       (id, pnptv_id, first_name, last_name, username, email, password_hash,
        telegram, twitter, photo_file_id, subscription_status, tier, role,
        accepted_terms, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'free','free','user',false,true,NOW(),NOW())
     RETURNING id, pnptv_id, first_name, last_name, username, email,
               subscription_status, accepted_terms, photo_file_id, bio, language, telegram, twitter`,
    [userId, pnptvId, firstName || 'User', lastName || null, displayName || null,
     email || null, passwordHash || null, telegramId || null, twitterHandle || null, photoFileId || null]
  );
  return rows[0];
}

function buildSession(user, extra = {}) {
  return {
    id: user.id,
    pnptvId: user.pnptv_id,
    telegramId: user.telegram,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    subscriptionStatus: user.subscription_status,
    acceptedTerms: user.accepted_terms,
    photoUrl: user.photo_file_id,
    bio: user.bio,
    language: user.language,
    ...extra,
  };
}

// ── Telegram Login Widget verification ───────────────────────────────────────

function verifyTelegramAuth(data) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return false;
  const { hash, ...rest } = data;
  if (!hash) return false;
  const checkString = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  if (hmac !== hash) return false;
  if (Date.now() / 1000 - parseInt(data.auth_date, 10) > 86400) return false;
  return true;
}

// ── X OAuth PKCE helpers ──────────────────────────────────────────────────────

const b64url = (buf) =>
  buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/webapp/auth/telegram/callback
 * Redirect-based Telegram Login Widget (data-auth-url approach — most reliable).
 * Telegram sends user data as query params after user authenticates.
 */
const telegramCallback = async (req, res) => {
  try {
    const telegramUser = req.query;
    if (!telegramUser.id || !telegramUser.hash) {
      return res.redirect('/?error=auth_failed');
    }

    if (!verifyTelegramAuth(telegramUser)) {
      logger.warn('Invalid Telegram auth hash (callback)', { userId: telegramUser.id });
      return res.redirect('/?error=auth_failed');
    }

    const telegramId = String(telegramUser.id);

    let result = await query(
      `SELECT id, pnptv_id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_file_id, bio, language
       FROM users WHERE telegram = $1`,
      [telegramId]
    );

    let user;
    if (result.rows.length === 0) {
      user = await createWebUser({
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        telegramId,
        photoFileId: telegramUser.photo_url || null,
      });
      logger.info(`Created new user via Telegram callback: ${user.id} (@${user.username})`);
    } else {
      user = result.rows[0];
    }

    req.session.user = buildSession(user, { photoUrl: telegramUser.photo_url || user.photo_file_id });
    await new Promise((resolve, reject) =>
      req.session.save(err => (err ? reject(err) : resolve()))
    );

    logger.info(`Web Telegram callback login: user ${user.id}`);
    return res.redirect('/prime-hub/');
  } catch (error) {
    logger.error('Telegram callback error:', error);
    return res.redirect('/?error=auth_failed');
  }
};

/**
 * POST /api/webapp/auth/telegram
 * Authenticate via Telegram Login Widget — auto-creates account if needed.
 */
const telegramLogin = async (req, res) => {
  try {
    const telegramUser = req.body.telegramUser || req.body;
    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'Invalid Telegram user data' });
    }

    if (process.env.NODE_ENV === 'production' && telegramUser.hash) {
      if (!verifyTelegramAuth(telegramUser)) {
        logger.warn('Invalid Telegram auth hash', { userId: telegramUser.id });
        return res.status(401).json({ error: 'Invalid authentication data' });
      }
    }

    const telegramId = String(telegramUser.id);

    // Find existing user
    let result = await query(
      `SELECT id, pnptv_id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_file_id, bio, language
       FROM users WHERE telegram = $1`,
      [telegramId]
    );

    let user;
    if (result.rows.length === 0) {
      // Auto-create account from Telegram data
      user = await createWebUser({
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        telegramId,
        photoFileId: telegramUser.photo_url || null,
      });
      logger.info(`Created new user via Telegram login: ${user.id} (@${user.username})`);
    } else {
      user = result.rows[0];
    }

    req.session.user = buildSession(user, { photoUrl: telegramUser.photo_url || user.photo_file_id });

    await new Promise((resolve, reject) =>
      req.session.save(err => (err ? reject(err) : resolve()))
    );

    logger.info(`Web app Telegram login: user ${user.id} (${user.username})`);
    return res.json({
      authenticated: true,
      registered: true,
      isNew: result.rows.length === 0,
      pnptvId: user.pnptv_id,
      termsAccepted: user.accepted_terms,
      user: {
        id: user.id,
        pnptvId: user.pnptv_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: telegramUser.photo_url || user.photo_file_id,
        subscriptionStatus: user.subscription_status,
      },
    });
  } catch (error) {
    logger.error('Web app Telegram login error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * POST /api/webapp/auth/register
 * Register with email + password.
 */
const emailRegister = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const emailLower = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createWebUser({
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : null,
      email: emailLower,
      passwordHash,
    });

    req.session.user = buildSession(user);
    logger.info(`New user registered via email: ${user.id} (${emailLower})`);

    return res.json({
      success: true,
      pnptvId: user.pnptv_id,
      user: {
        id: user.id,
        pnptvId: user.pnptv_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: emailLower,
        subscriptionStatus: user.subscription_status,
      },
    });
  } catch (error) {
    logger.error('Email register error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

/**
 * POST /api/webapp/auth/login
 * Login with email + password.
 */
const emailLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase().trim();
    const result = await query(
      `SELECT id, pnptv_id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_file_id, bio, language, password_hash, email
       FROM users WHERE email = $1`,
      [emailLower]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email. Please register first.' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Telegram or X to sign in. Please use those options.' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    req.session.user = buildSession(user);
    logger.info(`Web app email login: user ${user.id} (${emailLower})`);

    return res.json({
      authenticated: true,
      pnptvId: user.pnptv_id,
      user: {
        id: user.id,
        pnptvId: user.pnptv_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        subscriptionStatus: user.subscription_status,
      },
    });
  } catch (error) {
    logger.error('Email login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

/**
 * GET /api/webapp/auth/x/start
 */
const xLoginStart = async (req, res) => {
  try {
    const clientId = process.env.WEBAPP_X_CLIENT_ID;
    const redirectUri = process.env.WEBAPP_X_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({ error: 'X login not configured on this server' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = b64url(crypto.randomBytes(32));
    const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());

    req.session.xOAuth = { state, codeVerifier };
    await new Promise((resolve, reject) =>
      req.session.save(err => (err ? reject(err) : resolve()))
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'users.read tweet.read',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return res.json({ success: true, url: `https://twitter.com/i/oauth2/authorize?${params}` });
  } catch (error) {
    logger.error('X OAuth start error:', error);
    return res.status(500).json({ error: 'Failed to start X authentication' });
  }
};

/**
 * GET /api/webapp/auth/x/callback
 * Auto-creates user on first X login.
 */
const xLoginCallback = async (req, res) => {
  try {
    const { code, state, error: xError } = req.query;

    if (xError || !code || !state) {
      return res.redirect('/?error=missing_params');
    }

    const stored = req.session.xOAuth;
    if (!stored || stored.state !== state) {
      logger.warn('X OAuth state mismatch or session expired');
      return res.redirect('/?error=auth_failed');
    }

    const { codeVerifier } = stored;
    delete req.session.xOAuth;

    const clientId = process.env.WEBAPP_X_CLIENT_ID;
    const clientSecret = process.env.WEBAPP_X_CLIENT_SECRET;
    const redirectUri = process.env.WEBAPP_X_REDIRECT_URI;

    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch X user profile
    const profileRes = await axios.get('https://api.twitter.com/2/users/me', {
      params: { 'user.fields': 'name,profile_image_url' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const xData = profileRes.data?.data;
    const xHandle = xData?.username;
    const xName = xData?.name || xHandle;

    if (!xHandle) return res.redirect('/?error=auth_failed');

    // Find user by twitter handle
    let result = await query(
      `SELECT id, pnptv_id, telegram, username, first_name, last_name, subscription_status,
              accepted_terms, photo_file_id, bio, language
       FROM users WHERE twitter = $1`,
      [xHandle]
    );

    let user;
    const isNew = result.rows.length === 0;

    if (isNew) {
      if (req.session?.user?.id) {
        // Link to existing Telegram session
        await query('UPDATE users SET twitter = $1 WHERE id = $2', [xHandle, req.session.user.id]);
        result = await query(
          `SELECT id, pnptv_id, telegram, username, first_name, last_name, subscription_status,
                  accepted_terms, photo_file_id, bio, language
           FROM users WHERE id = $1`,
          [req.session.user.id]
        );
        user = result.rows[0];
        logger.info(`Linked X @${xHandle} to existing user ${user.id}`);
      } else {
        // Auto-create new user from X data
        const [firstName, ...rest] = (xName || xHandle).split(' ');
        user = await createWebUser({
          firstName,
          lastName: rest.join(' ') || null,
          twitterHandle: xHandle,
        });
        logger.info(`Created new user via X login: ${user.id} (@${xHandle})`);
      }
    } else {
      user = result.rows[0];
    }

    req.session.user = buildSession(user, { xHandle });
    logger.info(`Web app X login: user ${user.id} via @${xHandle}`);
    return res.redirect('/prime-hub/');
  } catch (error) {
    logger.error('X OAuth callback error:', error.message);
    return res.redirect('/?error=auth_failed');
  }
};

/**
 * GET /api/webapp/auth/status
 */
const authStatus = (req, res) => {
  const user = req.session?.user;
  if (!user) return res.json({ authenticated: false });
  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      pnptvId: user.pnptvId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      subscriptionStatus: user.subscriptionStatus,
      acceptedTerms: user.acceptedTerms,
      language: user.language,
    },
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
    return res.json({ success: true });
  });
};

/**
 * GET /api/webapp/profile
 */
const getProfile = async (req, res) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const result = await query(
      `SELECT id, pnptv_id, telegram, username, first_name, last_name, bio, photo_file_id,
              email, subscription_status, plan_id, plan_expiry,
              language, interests, location_name, twitter,
              instagram, tiktok, youtube,
              accepted_terms, created_at
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const p = result.rows[0];
    return res.json({
      success: true,
      profile: {
        id: p.id,
        pnptvId: p.pnptv_id,
        username: p.username,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        bio: p.bio,
        photoUrl: p.photo_file_id,
        subscriptionStatus: p.subscription_status,
        subscriptionPlan: p.plan_id,
        subscriptionExpires: p.plan_expiry,
        language: p.language,
        interests: p.interests,
        locationText: p.location_name,
        xHandle: p.twitter,
        instagramHandle: p.instagram,
        tiktokHandle: p.tiktok,
        youtubeHandle: p.youtube,
        memberSince: p.created_at,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
};

/**
 * GET /api/webapp/mastodon/feed
 */
const getMastodonFeed = async (req, res) => {
  try {
    const mastodonInstance = process.env.MASTODON_INSTANCE || process.env.MASTODON_BASE_URL || 'https://mastodon.social';
    const mastodonAccount = process.env.MASTODON_ACCOUNT_ID;
    const mastodonToken = process.env.MASTODON_ACCESS_TOKEN;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const authHeaders = { Accept: 'application/json' };
    if (mastodonToken) authHeaders['Authorization'] = `Bearer ${mastodonToken}`;

    let feedUrl;
    if (mastodonAccount) {
      feedUrl = `${mastodonInstance}/api/v1/accounts/${mastodonAccount}/statuses?limit=${limit}&exclude_replies=true`;
    } else if (mastodonToken) {
      feedUrl = `${mastodonInstance}/api/v1/timelines/home?limit=${limit}`;
    } else {
      feedUrl = `${mastodonInstance}/api/v1/timelines/public?limit=${limit}&local=true`;
    }

    const response = await axios.get(feedUrl, { timeout: 5000, headers: authHeaders });

    const posts = (response.data || []).map(post => ({
      id: post.id,
      content: post.content,
      createdAt: post.created_at,
      url: post.url,
      account: { username: post.account?.username, displayName: post.account?.display_name, avatar: post.account?.avatar },
      mediaAttachments: (post.media_attachments || []).map(m => ({ type: m.type, url: m.url, previewUrl: m.preview_url })),
      favouritesCount: post.favourites_count,
      reblogsCount: post.reblogs_count,
      repliesCount: post.replies_count,
    }));

    return res.json({ success: true, posts });
  } catch (error) {
    logger.error('Mastodon feed error:', error.message);
    return res.json({ success: true, posts: [], message: 'Mastodon feed temporarily unavailable' });
  }
};

module.exports = {
  telegramCallback,
  telegramLogin,
  emailRegister,
  emailLogin,
  xLoginStart,
  xLoginCallback,
  authStatus,
  logout,
  getProfile,
  getMastodonFeed,
};
