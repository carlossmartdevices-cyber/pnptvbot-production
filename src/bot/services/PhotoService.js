const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/postgres');
const { getRedis } = require('../../config/redis');
const logger = require('../../utils/logger');

const PHOTO_BASE_PATH = path.join(process.cwd(), 'public', 'photos');
const ADMIN_PHOTOS_PATH = path.join(PHOTO_BASE_PATH, 'admin');
const USER_PHOTOS_PATH = path.join(PHOTO_BASE_PATH, 'user-posts');
const TEMP_PATH = path.join(process.cwd(), 'tmp', 'photos');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const THUMBNAIL_SIZE = { width: 200, height: 200 };
const MAX_DIMENSIONS = { width: 4096, height: 4096 };
const COMPRESSION_QUALITY = 80;

const ADMIN_LIMITS = { maxFileSize: 50 * 1024 * 1024, maxPerUpload: 100 };
const USER_LIMITS = { maxFileSize: 10 * 1024 * 1024, maxPerPost: 5 };

/**
 * Utility: Initialize directories
 */
const ensureDirectories = async () => {
  await fs.ensureDir(ADMIN_PHOTOS_PATH);
  await fs.ensureDir(path.join(ADMIN_PHOTOS_PATH, 'originals'));
  await fs.ensureDir(path.join(ADMIN_PHOTOS_PATH, 'thumbnails'));
  await fs.ensureDir(USER_PHOTOS_PATH);
  await fs.ensureDir(TEMP_PATH);
};

/**
 * Utility: Get storage limits for user role
 */
const getStorageLimits = async (userRole = 'user') => {
  const result = await query(
    `SELECT max_file_size_mb, max_files_per_month, max_total_storage_mb, max_files_per_post
     FROM photo_storage_limits WHERE role = $1`,
    [userRole]
  );
  if (result.rows.length === 0) {
    return { maxFileSize: 10 * 1024 * 1024, maxFilesPerMonth: 10, maxTotalStorage: 500 * 1024 * 1024, maxFilesPerPost: 5 };
  }
  const limit = result.rows[0];
  return {
    maxFileSize: limit.max_file_size_mb * 1024 * 1024,
    maxFilesPerMonth: limit.max_files_per_month,
    maxTotalStorage: limit.max_total_storage_mb * 1024 * 1024,
    maxFilesPerPost: limit.max_files_per_post,
  };
};

/**
 * Validate file before processing
 */
const validateFile = async (buffer, mimeType, maxSize = USER_LIMITS.maxFileSize) => {
  if (!ALLOWED_MIMES.includes(mimeType)) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED_MIMES.join(', ')}`);
  }
  if (buffer.length > maxSize) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    const limitMB = (maxSize / 1024 / 1024).toFixed(2);
    throw new Error(`File too large: ${sizeMB}MB. Max: ${limitMB}MB`);
  }
  return true;
};

/**
 * Get image metadata
 */
const getImageMetadata = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    colorspace: metadata.space,
    hasAlpha: metadata.hasAlpha,
  };
};

/**
 * Compress image if needed
 */
const compressImage = async (buffer, metadata) => {
  let image = sharp(buffer);

  if (metadata.width > MAX_DIMENSIONS.width || metadata.height > MAX_DIMENSIONS.height) {
    image = image.resize(MAX_DIMENSIONS.width, MAX_DIMENSIONS.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const format = metadata.format.toLowerCase();
  if (format === 'jpeg' || format === 'jpg') {
    return image.jpeg({ quality: COMPRESSION_QUALITY, progressive: true }).toBuffer();
  } else if (format === 'png') {
    return image.png({ compressionLevel: 9 }).toBuffer();
  } else if (format === 'webp') {
    return image.webp({ quality: COMPRESSION_QUALITY }).toBuffer();
  } else if (format === 'gif') {
    return image.toBuffer();
  }
  return buffer;
};

/**
 * Generate thumbnail
 */
const generateThumbnail = async (buffer) => {
  return sharp(buffer)
    .resize(THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height, {
      fit: 'cover',
      position: 'center',
    })
    .toFormat('webp', { quality: 75 })
    .toBuffer();
};

/**
 * Save photo file to disk
 */
const savePhotoFile = async (buffer, photoId, isAdmin = false) => {
  const ext = '.webp';
  const basePath = isAdmin ? ADMIN_PHOTOS_PATH : USER_PHOTOS_PATH;
  const originalDir = path.join(basePath, 'originals');
  const thumbnailDir = path.join(basePath, 'thumbnails');

  await fs.ensureDir(originalDir);
  await fs.ensureDir(thumbnailDir);

  const filename = `${photoId}${ext}`;
  const originalPath = path.join(originalDir, filename);
  const thumbnailPath = path.join(thumbnailDir, filename);

  const compressed = await compressImage(buffer, await getImageMetadata(buffer));
  const thumbnail = await generateThumbnail(buffer);

  await fs.writeFile(originalPath, compressed);
  await fs.writeFile(thumbnailPath, thumbnail);

  return {
    originalPath: `/photos/${isAdmin ? 'admin' : 'user-posts'}/originals/${filename}`,
    thumbnailPath: `/photos/${isAdmin ? 'admin' : 'user-posts'}/thumbnails/${filename}`,
  };
};

/**
 * Check user upload quota
 */
const checkUserQuota = async (userId, fileSize, userRole = 'user') => {
  const limits = await getStorageLimits(userRole);

  const statsResult = await query(
    `SELECT total_size_bytes, photos_this_month FROM user_photo_stats WHERE user_id = $1`,
    [userId]
  );

  const stats = statsResult.rows[0] || { total_size_bytes: 0, photos_this_month: 0 };

  if (stats.total_size_bytes + fileSize > limits.maxTotalStorage) {
    throw new Error(`Storage quota exceeded. Max: ${(limits.maxTotalStorage / 1024 / 1024).toFixed(0)}MB`);
  }

  if (stats.photos_this_month >= limits.maxFilesPerMonth) {
    throw new Error(`Monthly upload limit exceeded. Max: ${limits.maxFilesPerMonth} photos`);
  }

  return true;
};

/**
 * Update user photo statistics
 */
const updateUserPhotoStats = async (userId, fileSize) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  await query(
    `INSERT INTO user_photo_stats (user_id, total_photos, total_size_bytes, photos_this_month, last_upload_at)
     VALUES ($1, 1, $2, 1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       total_photos = total_photos + 1,
       total_size_bytes = total_size_bytes + $2,
       photos_this_month = photos_this_month + 1,
       last_upload_at = NOW()`,
    [userId, fileSize]
  );
};

/**
 * Log photo activity
 */
const logPhotoActivity = async (photoId, userId, action, changes = {}) => {
  await query(
    `INSERT INTO photo_activity_log (photo_id, user_id, action, changes)
     VALUES ($1, $2, $3, $4)`,
    [photoId, userId, action, JSON.stringify(changes)]
  );
};

/**
 * Main upload function for admin photos
 */
const uploadAdminPhoto = async (buffer, mimeType, metadata = {}) => {
  try {
    await validateFile(buffer, mimeType, ADMIN_LIMITS.maxFileSize);

    const photoId = uuidv4();
    const imageMeta = await getImageMetadata(buffer);
    const paths = await savePhotoFile(buffer, photoId, true);

    const result = await query(
      `INSERT INTO photos (
        id, user_id, file_path, thumbnail_path, original_filename,
        file_size, mime_type, width, height, caption, category,
        is_admin_photo, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        photoId,
        metadata.userId || 'admin',
        paths.originalPath,
        paths.thumbnailPath,
        metadata.filename || `photo_${photoId}`,
        buffer.length,
        mimeType,
        imageMeta.width,
        imageMeta.height,
        metadata.caption || '',
        metadata.category || 'gallery',
        true,
        JSON.stringify({ ...imageMeta, uploadedAt: new Date().toISOString() }),
      ]
    );

    await logPhotoActivity(photoId, metadata.userId || 'admin', 'upload', { category: metadata.category });

    return result.rows[0];
  } catch (error) {
    logger.error('uploadAdminPhoto error', error);
    throw error;
  }
};

/**
 * Upload user photo for post
 */
const uploadUserPhoto = async (buffer, mimeType, userId, postId = null, metadata = {}) => {
  try {
    await validateFile(buffer, mimeType, USER_LIMITS.maxFileSize);
    await checkUserQuota(userId, buffer.length, metadata.userRole || 'user');

    const photoId = uuidv4();
    const imageMeta = await getImageMetadata(buffer);
    const paths = await savePhotoFile(buffer, photoId, false);

    const result = await query(
      `INSERT INTO photos (
        id, post_id, user_id, file_path, thumbnail_path, original_filename,
        file_size, mime_type, width, height, caption, category, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        photoId,
        postId,
        userId,
        paths.originalPath,
        paths.thumbnailPath,
        metadata.filename || `photo_${photoId}`,
        buffer.length,
        mimeType,
        imageMeta.width,
        imageMeta.height,
        metadata.caption || '',
        'user_uploads',
        JSON.stringify({ ...imageMeta, uploadedAt: new Date().toISOString() }),
      ]
    );

    await updateUserPhotoStats(userId, buffer.length);
    await logPhotoActivity(photoId, userId, 'upload', { postId });

    return result.rows[0];
  } catch (error) {
    logger.error('uploadUserPhoto error', error);
    throw error;
  }
};

/**
 * Get admin photos with filters
 */
const getAdminPhotos = async (options = {}) => {
  const { category, search, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = options;

  let sql = `SELECT * FROM photos WHERE is_admin_photo = true AND deleted_at IS NULL`;
  const params = [];
  let paramIdx = 1;

  if (category) {
    sql += ` AND category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }

  if (search) {
    sql += ` AND (caption ILIKE $${paramIdx} OR original_filename ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const validSortCols = ['created_at', 'file_size', 'width', 'height'];
  const validOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
  const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';

  sql += ` ORDER BY ${sortCol} ${validOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  const countResult = await query(`SELECT COUNT(*) as count FROM photos WHERE is_admin_photo = true AND deleted_at IS NULL`);

  return {
    photos: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit,
    offset,
  };
};

/**
 * Get user post photos
 */
const getPostPhotos = async (postId) => {
  const result = await query(
    `SELECT * FROM photos WHERE post_id = $1 AND deleted_at IS NULL ORDER BY order_position ASC, created_at ASC`,
    [postId]
  );
  return result.rows;
};

/**
 * Get photo by ID
 */
const getPhotoById = async (photoId) => {
  const result = await query(`SELECT * FROM photos WHERE id = $1 AND deleted_at IS NULL`, [photoId]);
  return result.rows[0] || null;
};

/**
 * Update photo metadata
 */
const updatePhotoMetadata = async (photoId, metadata, userId) => {
  const photo = await getPhotoById(photoId);
  if (!photo) throw new Error('Photo not found');

  const updateFields = [];
  const updateParams = [photoId];
  let paramIdx = 2;

  if (metadata.caption !== undefined) {
    updateFields.push(`caption = $${paramIdx}`);
    updateParams.push(metadata.caption);
    paramIdx++;
  }

  if (metadata.category !== undefined) {
    updateFields.push(`category = $${paramIdx}`);
    updateParams.push(metadata.category);
    paramIdx++;
  }

  if (metadata.order_position !== undefined) {
    updateFields.push(`order_position = $${paramIdx}`);
    updateParams.push(metadata.order_position);
    paramIdx++;
  }

  if (updateFields.length === 0) return photo;

  const sql = `UPDATE photos SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, updateParams);

  await logPhotoActivity(photoId, userId, 'update', { fields: updateFields });

  return result.rows[0];
};

/**
 * Delete photo (soft delete)
 */
const deletePhoto = async (photoId, userId) => {
  const photo = await getPhotoById(photoId);
  if (!photo) throw new Error('Photo not found');

  await query(`UPDATE photos SET deleted_at = NOW() WHERE id = $1`, [photoId]);
  await logPhotoActivity(photoId, userId, 'delete', {});

  return { success: true };
};

/**
 * Get photo statistics
 */
const getPhotoStats = async () => {
  const stats = await query(`
    SELECT
      COUNT(*) as total_photos,
      SUM(file_size) as total_storage_bytes,
      AVG(width) as avg_width,
      AVG(height) as avg_height,
      COUNT(DISTINCT category) as categories,
      COUNT(DISTINCT user_id) as contributors
    FROM photos WHERE deleted_at IS NULL
  `);

  const adminStats = await query(
    `SELECT COUNT(*) as count, SUM(file_size) as size FROM photos WHERE is_admin_photo = true AND deleted_at IS NULL`
  );

  const userStats = await query(
    `SELECT COUNT(*) as count, SUM(file_size) as size FROM photos WHERE is_admin_photo = false AND deleted_at IS NULL`
  );

  const categoryStats = await query(
    `SELECT category, COUNT(*) as count, SUM(file_size) as size
     FROM photos WHERE is_admin_photo = true AND deleted_at IS NULL
     GROUP BY category`
  );

  return {
    overall: stats.rows[0],
    admin: adminStats.rows[0],
    userPosts: userStats.rows[0],
    byCategory: categoryStats.rows,
  };
};

/**
 * Reorder post photos
 */
const reorderPostPhotos = async (postId, photoOrder) => {
  const updates = [];
  for (let i = 0; i < photoOrder.length; i++) {
    updates.push(
      query(
        `UPDATE photos SET order_position = $1 WHERE id = $2 AND post_id = $3`,
        [i, photoOrder[i], postId]
      )
    );
  }
  await Promise.all(updates);
  return getPostPhotos(postId);
};

/**
 * Get user photo statistics
 */
const getUserPhotoStats = async (userId) => {
  const result = await query(
    `SELECT total_photos, total_size_bytes, photos_this_month, last_upload_at FROM user_photo_stats WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Cleanup function for testing
 */
const cleanup = async () => {
  await fs.emptyDir(TEMP_PATH);
};

module.exports = {
  uploadAdminPhoto,
  uploadUserPhoto,
  getAdminPhotos,
  getPostPhotos,
  getPhotoById,
  updatePhotoMetadata,
  deletePhoto,
  getPhotoStats,
  reorderPostPhotos,
  getUserPhotoStats,
  getStorageLimits,
  validateFile,
  ensureDirectories,
  cleanup,
  PHOTO_BASE_PATH,
  ALLOWED_MIMES,
};
