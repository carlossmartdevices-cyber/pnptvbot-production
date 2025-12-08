/**
 * AWS S3 Upload Service
 * Handles file uploads to S3 for broadcast media
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');
const path = require('path');
const config = require('../config/config');
const logger = require('./logger');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

// Default S3 bucket
const DEFAULT_BUCKET = config.AWS_S3_BUCKET;
const BROADCAST_FOLDER = 'broadcasts';

/**
 * Generate a unique file key for S3
 * @param {string} originalFilename - Original filename
 * @param {string} folder - S3 folder path
 * @returns {string} Unique S3 key
 */
function generateFileKey(originalFilename, folder = BROADCAST_FOLDER) {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const sanitizedBasename = basename.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

  return `${folder}/${timestamp}-${randomString}-${sanitizedBasename}${ext}`;
}

/**
 * Upload a file buffer to S3
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} originalFilename - Original filename
 * @param {string} mimeType - MIME type of the file
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with S3 URL and key
 */
async function uploadFile(fileBuffer, originalFilename, mimeType, options = {}) {
  try {
    const {
      bucket = DEFAULT_BUCKET,
      folder = BROADCAST_FOLDER,
      acl = 'private', // Use 'public-read' for public files
      metadata = {},
    } = options;

    if (!bucket) {
      throw new Error('S3 bucket not configured. Please set AWS_S3_BUCKET environment variable.');
    }

    const s3Key = generateFileKey(originalFilename, folder);

    const uploadParams = {
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: acl,
      Metadata: metadata,
    };

    logger.info(`Uploading file to S3: ${s3Key}`);
    const uploadResult = await s3.upload(uploadParams).promise();

    logger.info(`File uploaded successfully to S3: ${uploadResult.Location}`);

    return {
      success: true,
      s3Key: uploadResult.Key,
      s3Url: uploadResult.Location,
      s3Bucket: bucket,
      s3Region: config.AWS_REGION,
      eTag: uploadResult.ETag,
    };
  } catch (error) {
    logger.error('Error uploading file to S3:', error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Upload a file from Telegram to S3
 * @param {Object} bot - Telegram bot instance
 * @param {string} fileId - Telegram file ID
 * @param {string} mediaType - Media type (photo, video, document, audio, voice)
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with S3 URL and metadata
 */
async function uploadTelegramFileToS3(bot, fileId, mediaType, options = {}) {
  try {
    logger.info(`Downloading file from Telegram: ${fileId}`);

    // Get file info from Telegram
    const file = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

    // Download file as buffer
    const https = require('https');
    const fileBuffer = await new Promise((resolve, reject) => {
      https.get(fileUrl, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });

    // Determine MIME type based on media type
    const mimeTypes = {
      photo: 'image/jpeg',
      video: 'video/mp4',
      document: 'application/octet-stream',
      audio: 'audio/mpeg',
      voice: 'audio/ogg',
    };

    const mimeType = mimeTypes[mediaType] || 'application/octet-stream';
    const originalFilename = file.file_path.split('/').pop() || `${mediaType}_${Date.now()}`;

    // Upload to S3
    const uploadResult = await uploadFile(fileBuffer, originalFilename, mimeType, {
      ...options,
      metadata: {
        telegram_file_id: fileId,
        media_type: mediaType,
        file_size: String(file.file_size || fileBuffer.length),
        ...options.metadata,
      },
    });

    return {
      ...uploadResult,
      originalFilename,
      fileSize: file.file_size || fileBuffer.length,
      mimeType,
      telegramFileId: fileId,
      telegramFilePath: file.file_path,
    };
  } catch (error) {
    logger.error('Error uploading Telegram file to S3:', error);
    throw new Error(`Failed to upload Telegram file to S3: ${error.message}`);
  }
}

/**
 * Get a presigned URL for temporary access to a private S3 file
 * @param {string} s3Key - S3 object key
 * @param {Object} options - Options for presigned URL
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(s3Key, options = {}) {
  try {
    const {
      bucket = DEFAULT_BUCKET,
      expiresIn = 3600, // 1 hour default
      operation = 'getObject', // 'getObject' or 'putObject'
    } = options;

    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
      Expires: expiresIn,
    };

    const url = await s3.getSignedUrlPromise(operation, params);
    logger.info(`Generated presigned URL for ${s3Key}, expires in ${expiresIn}s`);

    return url;
  } catch (error) {
    logger.error('Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Delete a file from S3
 * @param {string} s3Key - S3 object key to delete
 * @param {string} bucket - S3 bucket name
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(s3Key, bucket = DEFAULT_BUCKET) {
  try {
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
    };

    await s3.deleteObject(params).promise();
    logger.info(`File deleted from S3: ${s3Key}`);

    return true;
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
}

/**
 * Check if a file exists in S3
 * @param {string} s3Key - S3 object key
 * @param {string} bucket - S3 bucket name
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(s3Key, bucket = DEFAULT_BUCKET) {
  try {
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    logger.error('Error checking file existence in S3:', error);
    throw new Error(`Failed to check file existence: ${error.message}`);
  }
}

/**
 * Get file metadata from S3
 * @param {string} s3Key - S3 object key
 * @param {string} bucket - S3 bucket name
 * @returns {Promise<Object>} File metadata
 */
async function getFileMetadata(s3Key, bucket = DEFAULT_BUCKET) {
  try {
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
    };

    const metadata = await s3.headObject(params).promise();

    return {
      contentType: metadata.ContentType,
      contentLength: metadata.ContentLength,
      lastModified: metadata.LastModified,
      eTag: metadata.ETag,
      metadata: metadata.Metadata,
    };
  } catch (error) {
    logger.error('Error getting file metadata from S3:', error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Download a file from S3 as buffer
 * @param {string} s3Key - S3 object key
 * @param {string} bucket - S3 bucket name
 * @returns {Promise<Buffer>} File content as buffer
 */
async function downloadFile(s3Key, bucket = DEFAULT_BUCKET) {
  try {
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
    };

    const data = await s3.getObject(params).promise();
    logger.info(`File downloaded from S3: ${s3Key}`);

    return data.Body;
  } catch (error) {
    logger.error('Error downloading file from S3:', error);
    throw new Error(`Failed to download file from S3: ${error.message}`);
  }
}

/**
 * Copy a file within S3
 * @param {string} sourceKey - Source S3 object key
 * @param {string} destinationKey - Destination S3 object key
 * @param {Object} options - Copy options
 * @returns {Promise<Object>} Copy result
 */
async function copyFile(sourceKey, destinationKey, options = {}) {
  try {
    const {
      sourceBucket = DEFAULT_BUCKET,
      destinationBucket = DEFAULT_BUCKET,
      acl = 'private',
    } = options;

    if (!sourceBucket || !destinationBucket) {
      throw new Error('S3 bucket not configured');
    }

    const params = {
      Bucket: destinationBucket,
      CopySource: `${sourceBucket}/${sourceKey}`,
      Key: destinationKey,
      ACL: acl,
    };

    const result = await s3.copyObject(params).promise();
    logger.info(`File copied in S3: ${sourceKey} -> ${destinationKey}`);

    return {
      success: true,
      destinationKey,
      eTag: result.ETag,
    };
  } catch (error) {
    logger.error('Error copying file in S3:', error);
    throw new Error(`Failed to copy file in S3: ${error.message}`);
  }
}

module.exports = {
  uploadFile,
  uploadTelegramFileToS3,
  getPresignedUrl,
  deleteFile,
  fileExists,
  getFileMetadata,
  downloadFile,
  copyFile,
  generateFileKey,
};
