const pool = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Zoom Recording Model
 * Handles all database operations for Zoom meeting recordings
 */
class ZoomRecordingModel {
    /**
     * Create a new recording
     * @param {Object} recordingData - Recording information
     * @returns {Promise<Object>} Created recording
     */
    static async create(recordingData) {
        const {
            roomId,
            zoomRecordingId,
            recordingType = 'cloud',
            fileType = 'MP4',
            fileExtension = 'mp4',
            storageLocation,
            cloudStorageUrl,
            localStoragePath,
            downloadUrl,
            fileSize,
            duration,
            recordingStart,
            recordingEnd,
            isPublic = false,
            passwordProtected = false,
            accessPassword,
            downloadAllowed = true
        } = recordingData;

        try {
            const query = `
                INSERT INTO zoom_recordings (
                    room_id,
                    zoom_recording_id,
                    recording_type,
                    file_type,
                    file_extension,
                    storage_location,
                    cloud_storage_url,
                    local_storage_path,
                    download_url,
                    file_size,
                    duration,
                    recording_start,
                    recording_end,
                    is_public,
                    password_protected,
                    access_password,
                    download_allowed,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'processing')
                RETURNING *
            `;

            const values = [
                roomId,
                zoomRecordingId,
                recordingType,
                fileType,
                fileExtension,
                storageLocation,
                cloudStorageUrl,
                localStoragePath,
                downloadUrl,
                fileSize,
                duration,
                recordingStart,
                recordingEnd,
                isPublic,
                passwordProtected,
                accessPassword,
                downloadAllowed
            ];

            const result = await pool.query(query, values);
            logger.info(`Recording created for room ${roomId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating zoom recording:', error);
            throw error;
        }
    }

    /**
     * Get recording by ID
     * @param {string} recordingId - Recording UUID
     * @returns {Promise<Object|null>} Recording object or null
     */
    static async getById(recordingId) {
        try {
            const query = 'SELECT * FROM zoom_recordings WHERE id = $1';
            const result = await pool.query(query, [recordingId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom recording by ID:', error);
            throw error;
        }
    }

    /**
     * Get recordings by room ID
     * @param {string} roomId - Room UUID
     * @returns {Promise<Array>} Array of recordings
     */
    static async getByRoomId(roomId) {
        try {
            const query = `
                SELECT * FROM zoom_recordings
                WHERE room_id = $1
                AND deleted_at IS NULL
                ORDER BY created_at DESC
            `;

            const result = await pool.query(query, [roomId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting zoom recordings by room:', error);
            throw error;
        }
    }

    /**
     * Update recording
     * @param {string} recordingId - Recording UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated recording
     */
    static async update(recordingId, updates) {
        try {
            const allowedFields = [
                'zoom_recording_id',
                'storage_location',
                'cloud_storage_url',
                'local_storage_path',
                'download_url',
                'file_size',
                'duration',
                'recording_start',
                'recording_end',
                'status',
                'processing_progress',
                'is_public',
                'password_protected',
                'access_password',
                'download_allowed',
                'transcript_url',
                'transcript_text',
                'transcript_language',
                'expires_at'
            ];

            const fields = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }

            if (fields.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(recordingId);
            const query = `
                UPDATE zoom_recordings
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom recording:', error);
            throw error;
        }
    }

    /**
     * Mark recording as completed
     * @param {string} recordingId - Recording UUID
     * @param {Object} completionData - Completion data
     * @returns {Promise<Object>} Updated recording
     */
    static async markAsCompleted(recordingId, completionData = {}) {
        try {
            const updates = {
                status: 'completed',
                processing_progress: 100,
                ...completionData
            };

            return await this.update(recordingId, updates);
        } catch (error) {
            logger.error('Error marking recording as completed:', error);
            throw error;
        }
    }

    /**
     * Mark recording as failed
     * @param {string} recordingId - Recording UUID
     * @returns {Promise<Object>} Updated recording
     */
    static async markAsFailed(recordingId) {
        try {
            return await this.update(recordingId, {
                status: 'failed',
                processing_progress: 0
            });
        } catch (error) {
            logger.error('Error marking recording as failed:', error);
            throw error;
        }
    }

    /**
     * Delete recording (soft delete)
     * @param {string} recordingId - Recording UUID
     * @returns {Promise<boolean>} Success status
     */
    static async delete(recordingId) {
        try {
            const query = `
                UPDATE zoom_recordings
                SET deleted_at = CURRENT_TIMESTAMP,
                    status = 'deleted',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [recordingId]);
            logger.info(`Recording soft deleted: ${recordingId}`);

            return true;
        } catch (error) {
            logger.error('Error deleting zoom recording:', error);
            throw error;
        }
    }

    /**
     * Increment view count
     * @param {string} recordingId - Recording UUID
     * @returns {Promise<void>}
     */
    static async incrementViewCount(recordingId) {
        try {
            const query = `
                UPDATE zoom_recordings
                SET view_count = view_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [recordingId]);
        } catch (error) {
            logger.error('Error incrementing view count:', error);
            throw error;
        }
    }

    /**
     * Increment download count
     * @param {string} recordingId - Recording UUID
     * @returns {Promise<void>}
     */
    static async incrementDownloadCount(recordingId) {
        try {
            const query = `
                UPDATE zoom_recordings
                SET download_count = download_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [recordingId]);
        } catch (error) {
            logger.error('Error incrementing download count:', error);
            throw error;
        }
    }

    /**
     * Get public recordings
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of public recordings
     */
    static async getPublicRecordings(options = {}) {
        const { limit = 50, offset = 0 } = options;

        try {
            const query = `
                SELECT r.*, zr.title as room_title, zr.host_name
                FROM zoom_recordings r
                JOIN zoom_rooms zr ON r.room_id = zr.id
                WHERE r.is_public = true
                AND r.status = 'completed'
                AND r.deleted_at IS NULL
                ORDER BY r.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await pool.query(query, [limit, offset]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting public recordings:', error);
            throw error;
        }
    }

    /**
     * Clean up expired recordings
     * @returns {Promise<number>} Number of recordings deleted
     */
    static async cleanupExpiredRecordings() {
        try {
            const query = `
                UPDATE zoom_recordings
                SET deleted_at = CURRENT_TIMESTAMP,
                    status = 'deleted'
                WHERE expires_at IS NOT NULL
                AND expires_at < CURRENT_TIMESTAMP
                AND deleted_at IS NULL
                RETURNING id
            `;

            const result = await pool.query(query);
            logger.info(`Cleaned up ${result.rows.length} expired recordings`);

            return result.rows.length;
        } catch (error) {
            logger.error('Error cleaning up expired recordings:', error);
            throw error;
        }
    }

    /**
     * Get total storage used
     * @param {string} roomId - Optional room ID to filter by
     * @returns {Promise<number>} Total bytes used
     */
    static async getTotalStorageUsed(roomId = null) {
        try {
            let query = `
                SELECT COALESCE(SUM(file_size), 0) as total_size
                FROM zoom_recordings
                WHERE deleted_at IS NULL
            `;

            const values = [];

            if (roomId) {
                values.push(roomId);
                query += ' AND room_id = $1';
            }

            const result = await pool.query(query, values);
            return parseInt(result.rows[0].total_size, 10);
        } catch (error) {
            logger.error('Error getting total storage used:', error);
            throw error;
        }
    }
}

module.exports = ZoomRecordingModel;
