const axios = require('axios');
const db = require('../../utils/db');
const logger = require('../../utils/logger');
const PaymentSecurityService = require('./paymentSecurityService');

const X_API_BASE = 'https://api.twitter.com/2';
const X_MAX_TEXT_LENGTH = 280;
const X_TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const XOAuthService = require('./xOAuthService');

class XPostService {
  static normalizeXText(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length <= X_MAX_TEXT_LENGTH) {
      return { text: trimmed, truncated: false };
    }

    const truncatedText = trimmed.slice(0, X_MAX_TEXT_LENGTH - 1).trimEnd();
    return { text: `${truncatedText}…`, truncated: true };
  }

  static async listActiveAccounts() {
    const query = `
      SELECT account_id, handle, display_name, is_active
      FROM x_accounts
      WHERE is_active = TRUE
      ORDER BY display_name NULLS LAST, handle ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  static async getAccount(accountId) {
    const query = `
      SELECT account_id, handle, display_name, encrypted_access_token, encrypted_refresh_token, token_expires_at, is_active
      FROM x_accounts
      WHERE account_id = $1
    `;
    const result = await db.query(query, [accountId]);
    return result.rows[0] || null;
  }

  static async createPostJob({
    accountId,
    adminId,
    adminUsername,
    text,
    mediaUrl = null,
    scheduledAt = null,
    status = 'scheduled',
    responseJson = null,
    errorMessage = null,
    sentAt = null,
  }) {
    const query = `
      INSERT INTO x_post_jobs (
        account_id, admin_id, admin_username, text, media_url, scheduled_at,
        status, response_json, error_message, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING post_id
    `;

    const values = [
      accountId,
      adminId,
      adminUsername,
      text,
      mediaUrl,
      scheduledAt,
      status,
      responseJson ? JSON.stringify(responseJson) : null,
      errorMessage,
      sentAt,
    ];

    const result = await db.query(query, values);
    return result.rows[0]?.post_id;
  }

  static async updatePostJob(postId, { status, responseJson, errorMessage, sentAt }) {
    const query = `
      UPDATE x_post_jobs
      SET status = $1,
          response_json = $2,
          error_message = $3,
          sent_at = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE post_id = $5
    `;
    await db.query(query, [
      status,
      responseJson ? JSON.stringify(responseJson) : null,
      errorMessage || null,
      sentAt || null,
      postId,
    ]);
  }

  static async sendPostNow({ accountId, adminId, adminUsername, text, mediaUrl = null }) {
    const account = await this.getAccount(accountId);
    if (!account || !account.is_active) {
      throw new Error('Cuenta de X inválida o inactiva');
    }

    const { text: normalizedText, truncated } = this.normalizeXText(text);

    const postId = await this.createPostJob({
      accountId,
      adminId,
      adminUsername,
      text: normalizedText,
      mediaUrl,
      status: 'sending',
    });

    try {
      const response = await this.postToX(account, normalizedText);

      await this.updatePostJob(postId, {
        status: 'sent',
        responseJson: response,
        sentAt: new Date(),
      });

      return {
        postId,
        response,
        truncated,
      };
    } catch (error) {
      const errorMessage = error.response?.data || error.message || 'Error desconocido';

      await this.updatePostJob(postId, {
        status: 'failed',
        errorMessage: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
      });

      throw error;
    }
  }

  static async publishScheduledPost(post) {
    const account = await this.getAccount(post.account_id);
    if (!account || !account.is_active) {
      throw new Error('Cuenta de X inválida o inactiva');
    }

    const { text: normalizedText } = this.normalizeXText(post.text);
    const response = await this.postToX(account, normalizedText);

    await this.updatePostJob(post.post_id, {
      status: 'sent',
      responseJson: response,
      sentAt: new Date(),
    });

    return response;
  }

  static async postToX(account, text) {
    const accessToken = await this.getValidAccessToken(account);

    if (!accessToken) {
      throw new Error('Token de acceso inválido para la cuenta de X');
    }

    const response = await axios.post(
      `${X_API_BASE}/tweets`,
      { text },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    logger.info('X post published', {
      accountId: account.account_id,
      handle: account.handle,
      tweetId: response.data?.data?.id,
    });

    return response.data;
  }

  static async getValidAccessToken(account) {
    let decrypted;
    try {
      decrypted = PaymentSecurityService.decryptSensitiveData(account.encrypted_access_token);
    } catch (error) {
      logger.warn('Failed to decrypt X access token, falling back to raw value', {
        accountId: account.account_id,
        error: error.message,
      });
      decrypted = account.encrypted_access_token;
    }

    const accessToken = decrypted?.accessToken || decrypted?.token || decrypted;
    const expiresAt = decrypted?.expiresAt ? new Date(decrypted.expiresAt) : account.token_expires_at;

    if (expiresAt && expiresAt.getTime() - Date.now() <= X_TOKEN_EXPIRY_BUFFER_MS) {
      const refreshed = await XOAuthService.refreshAccountTokens(account);
      return refreshed.accessToken;
    }

    if (!accessToken) {
      throw new Error('Token de acceso inválido para la cuenta de X');
    }

    return accessToken;
  }

  static async getPendingPosts() {
    const query = `
      SELECT post_id, account_id, text, media_url, admin_id, admin_username
      FROM x_post_jobs
      WHERE status = 'scheduled'
      AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }
}

module.exports = XPostService;
