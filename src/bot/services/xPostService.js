const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const FormData = require('form-data');
const db = require('../../utils/db');
const logger = require('../../utils/logger');
const PaymentSecurityService = require('./paymentSecurityService');

const X_API_BASE = 'https://api.twitter.com/2';
const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const X_MAX_TEXT_LENGTH = 280;
const X_TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const XOAuthService = require('./xOAuthService');
const X_MEDIA_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

class XPostService {
  static normalizeXText(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length <= X_MAX_TEXT_LENGTH) {
      return { text: trimmed, truncated: false };
    }

    const truncatedText = trimmed.slice(0, X_MAX_TEXT_LENGTH - 1).trimEnd();
    return { text: `${truncatedText}…`, truncated: true };
  }

  static ensureRequiredLinks(text, links = [], maxLength = X_MAX_TEXT_LENGTH) {
    const trimmed = (text || '').trim();
    const required = links.filter(Boolean);
    const missing = required.filter((link) => {
      const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return !new RegExp(escaped, 'i').test(trimmed);
    });

    if (missing.length === 0) {
      return this.normalizeXText(trimmed);
    }

    const linksText = missing.join(' ');
    const appendLength = (trimmed ? 1 : 0) + linksText.length; // newline + links
    let base = trimmed;
    let truncated = false;

    if (base.length + appendLength > maxLength) {
      const allowed = maxLength - appendLength;
      if (allowed <= 0) {
        base = '';
      } else {
        base = base.slice(0, allowed).trimEnd();
      }
      truncated = trimmed.length !== base.length;
    }

    const combined = base ? `${base}\n${linksText}` : linksText;
    return { text: combined, truncated };
  }

  static async listActiveAccounts() {
    const query = `
      SELECT account_id, handle, display_name, is_active
      FROM x_accounts
      WHERE is_active = TRUE
      ORDER BY display_name NULLS LAST, handle ASC
    `;
    const result = await db.query(query, [], { cache: false });
    return result.rows;
  }

  static async getAccount(accountId) {
    const query = `
      SELECT account_id, handle, display_name, encrypted_access_token, encrypted_refresh_token, token_expires_at, is_active
      FROM x_accounts
      WHERE account_id = $1
    `;
    const result = await db.query(query, [accountId], { cache: false });
    return result.rows[0] || null;
  }

  static async deactivateAccount(accountId) {
    const query = `
      UPDATE x_accounts
      SET is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1
      RETURNING account_id, handle
    `;
    const result = await db.query(query, [accountId], { cache: false });
    if (!result.rows[0]) {
      throw new Error('Cuenta de X no encontrada');
    }
    return result.rows[0];
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
      const response = await this.postToX(account, normalizedText, mediaUrl);

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
    const response = await this.postToX(account, normalizedText, post.media_url);

    await this.updatePostJob(post.post_id, {
      status: 'sent',
      responseJson: response,
      sentAt: new Date(),
    });

    return response;
  }

  static async postToX(account, text, mediaUrl = null) {
    const accessToken = await this.getValidAccessToken(account);

    if (!accessToken) {
      throw new Error('Token de acceso inválido para la cuenta de X');
    }

    const payload = { text };
    if (mediaUrl) {
      logger.info('Uploading media for X post', {
        accountId: account.account_id,
        handle: account.handle,
      });
      let mediaId = null;
      try {
        mediaId = await this.uploadMediaToX({
          accessToken,
          mediaUrl,
        });
      } catch (error) {
        if (error?.response?.status === 403) {
          throw new Error('X API 403 al subir media. Revisa permisos (media.write) o reconecta la cuenta.');
        }
        throw error;
      }
      if (mediaId) {
        payload.media = { media_ids: [String(mediaId)] };
      }
    }

    const response = await axios.post(
      `${X_API_BASE}/tweets`,
      payload,
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

  static async resolveMediaUrl(mediaUrlOrFileId) {
    if (!mediaUrlOrFileId) return null;
    if (typeof mediaUrlOrFileId !== 'string') return null;
    if (mediaUrlOrFileId.startsWith('http://') || mediaUrlOrFileId.startsWith('https://')) {
      return mediaUrlOrFileId;
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('BOT_TOKEN no configurado para resolver media de Telegram');
    }

    const res = await axios.get(`https://api.telegram.org/bot${botToken}/getFile`, {
      params: { file_id: mediaUrlOrFileId },
      timeout: 15000,
    });

    const filePath = res.data?.result?.file_path;
    if (!filePath) {
      throw new Error('No se pudo obtener file_path desde Telegram');
    }

    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  }

  static async downloadMediaToFile(mediaUrl) {
    const resolvedUrl = await this.resolveMediaUrl(mediaUrl);
    if (!resolvedUrl) {
      throw new Error('Media URL inválida');
    }

    const tempName = `xmedia_${Date.now()}_${crypto.randomUUID()}`;
    const tempPath = path.join(os.tmpdir(), tempName);

    const response = await axios.get(resolvedUrl, {
      responseType: 'stream',
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const totalBytes = Number(response.headers['content-length'] || 0);

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stats = await fs.promises.stat(tempPath);

    return {
      filePath: tempPath,
      mimeType: contentType,
      size: totalBytes || stats.size,
    };
  }

  static getMediaCategory(mimeType) {
    if (!mimeType) return 'tweet_image';
    if (mimeType.startsWith('video/')) return 'tweet_video';
    if (mimeType === 'image/gif') return 'tweet_gif';
    return 'tweet_image';
  }

  static async uploadMediaToX({ accessToken, mediaUrl }) {
    const { filePath, mimeType, size } = await this.downloadMediaToFile(mediaUrl);

    try {
      const mediaCategory = this.getMediaCategory(mimeType);
      logger.info('X media upload INIT', { mimeType, size, mediaCategory });

      // INIT
      const initForm = new FormData();
      initForm.append('command', 'INIT');
      initForm.append('media_type', mimeType);
      initForm.append('total_bytes', String(size));
      initForm.append('media_category', mediaCategory);

      const initRes = await axios.post(
        X_MEDIA_UPLOAD_URL,
        initForm,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...initForm.getHeaders(),
          },
          timeout: 30000,
          maxBodyLength: Infinity,
        }
      );

      const mediaId = initRes.data?.media_id_string || initRes.data?.media_id;
      if (!mediaId) {
        logger.error('X media upload INIT failed - no media_id', { responseData: initRes.data });
        throw new Error('No se recibió media_id al inicializar upload');
      }
      logger.info('X media upload INIT ok', { mediaId });

      // APPEND chunks
      const fileHandle = await fs.promises.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(X_MEDIA_CHUNK_SIZE);
        let offset = 0;
        let segmentIndex = 0;

        while (true) {
          const { bytesRead } = await fileHandle.read(buffer, 0, X_MEDIA_CHUNK_SIZE, offset);
          if (!bytesRead) break;

          const chunk = buffer.subarray(0, bytesRead);
          const appendForm = new FormData();
          appendForm.append('command', 'APPEND');
          appendForm.append('media_id', String(mediaId));
          appendForm.append('segment_index', String(segmentIndex));
          appendForm.append('media', chunk, {
            filename: `chunk_${segmentIndex}`,
            contentType: mimeType,
          });

          await axios.post(
            X_MEDIA_UPLOAD_URL,
            appendForm,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                ...appendForm.getHeaders(),
              },
              timeout: 30000,
              maxBodyLength: Infinity,
            }
          );

          offset += bytesRead;
          segmentIndex += 1;
        }
      } finally {
        await fileHandle.close();
      }

      // FINALIZE
      const finalizeForm = new FormData();
      finalizeForm.append('command', 'FINALIZE');
      finalizeForm.append('media_id', String(mediaId));

      const finalizeRes = await axios.post(
        X_MEDIA_UPLOAD_URL,
        finalizeForm,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...finalizeForm.getHeaders(),
          },
          timeout: 30000,
          maxBodyLength: Infinity,
        }
      );

      const processingInfo = finalizeRes.data?.processing_info;
      logger.info('X media upload FINALIZE ok', { mediaId, hasProcessing: !!processingInfo });
      if (processingInfo) {
        await this.waitForMediaProcessing(accessToken, mediaId, processingInfo);
      }

      logger.info('X media upload completed successfully', { mediaId });
      return mediaId;
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error('X media upload failed', {
        status,
        data,
        message: error.message,
      });
      throw error;
    } finally {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete temp media file', { filePath, error: error.message });
      }
    }
  }

  static async waitForMediaProcessing(accessToken, mediaId, processingInfo) {
    let state = processingInfo?.state;
    let checkAfter = processingInfo?.check_after_secs || 5;
    let attempts = 0;

    logger.info('Waiting for X media processing', { mediaId, initialState: state, checkAfter });

    while (state && state !== 'succeeded' && state !== 'failed' && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, checkAfter * 1000));
      const statusRes = await axios.get(
        X_MEDIA_UPLOAD_URL,
        {
          params: { command: 'STATUS', media_id: String(mediaId) },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );

      const info = statusRes.data?.processing_info;
      state = info?.state || state;
      checkAfter = info?.check_after_secs || checkAfter;
      attempts += 1;

      logger.info('X media processing status check', { mediaId, state, attempts });
    }

    if (state && state !== 'succeeded') {
      throw new Error(`Media processing failed: ${state}`);
    }

    logger.info('X media processing completed', { mediaId, finalState: state });
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

  static async getScheduledPosts() {
    const query = `
      SELECT j.post_id, j.account_id, j.text, j.media_url, j.scheduled_at,
             j.admin_id, j.admin_username, j.created_at,
             a.handle, a.display_name
      FROM x_post_jobs j
      LEFT JOIN x_accounts a ON a.account_id::text = j.account_id::text
      WHERE j.status = 'scheduled'
      ORDER BY j.scheduled_at ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  static async getRecentPosts(limit = 5) {
    const query = `
      SELECT j.post_id, j.account_id, j.text, j.status, j.scheduled_at,
             j.sent_at, j.error_message, j.created_at,
             a.handle, a.display_name
      FROM x_post_jobs j
      LEFT JOIN x_accounts a ON a.account_id::text = j.account_id::text
      ORDER BY COALESCE(j.sent_at, j.scheduled_at, j.created_at) DESC
      LIMIT $1
    `;
    const result = await db.query(query, [limit]);
    return result.rows;
  }

  static async getPostHistory(limit = 20) {
    const query = `
      SELECT j.post_id, j.account_id, j.text, j.status, j.scheduled_at,
             j.sent_at, j.error_message, j.response_json, j.created_at,
             a.handle, a.display_name
      FROM x_post_jobs j
      LEFT JOIN x_accounts a ON a.account_id::text = j.account_id::text
      WHERE j.status IN ('sent', 'failed')
      ORDER BY COALESCE(j.sent_at, j.created_at) DESC
      LIMIT $1
    `;
    const result = await db.query(query, [limit]);
    return result.rows;
  }

  static async cancelScheduledPost(postId) {
    const query = `
      DELETE FROM x_post_jobs
      WHERE post_id = $1 AND status = 'scheduled'
      RETURNING post_id
    `;
    const result = await db.query(query, [postId]);
    if (result.rowCount === 0) {
      throw new Error('Post not found or already processed');
    }
    return result.rows[0];
  }

  static async getPostById(postId) {
    const query = `
      SELECT j.*, a.handle, a.display_name
      FROM x_post_jobs j
      LEFT JOIN x_accounts a ON a.account_id::text = j.account_id::text
      WHERE j.post_id = $1
    `;
    const result = await db.query(query, [postId]);
    return result.rows[0] || null;
  }

  static async incrementRetryCount(postId) {
    const query = `
      UPDATE x_post_jobs
      SET retry_count = COALESCE(retry_count, 0) + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE post_id = $1
      RETURNING retry_count
    `;
    const result = await db.query(query, [postId]);
    return result.rows[0]?.retry_count || 0;
  }

  static async reschedulePost(postId, delayMinutes) {
    const query = `
      UPDATE x_post_jobs
      SET scheduled_at = NOW() + INTERVAL '${delayMinutes} minutes',
          status = 'scheduled',
          updated_at = CURRENT_TIMESTAMP
      WHERE post_id = $1
    `;
    await db.query(query, [postId]);
  }
}

module.exports = XPostService;
