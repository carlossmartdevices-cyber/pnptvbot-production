const pool = require('../config/postgres');
const logger = require('../utils/logger');
const { generateRoomCode } = require('../bot/utils/helpers');

/**
 * Zoom Room Model
 * Handles all database operations for Zoom meeting rooms
 */
class ZoomRoomModel {
    /**
     * Create a new Zoom room
     * @param {Object} roomData - Room configuration
     * @returns {Promise<Object>} Created room
     */
    static async create(roomData) {
        const {
            hostUserId,
            hostEmail,
            hostName,
            title = 'PNP.tv Meeting',
            description,
            topic,
            scheduledStartTime,
            scheduledDuration = 60,
            settings = {},
            isPublic = true,
            requiresPassword = false,
            telegramGroupId,
            zoomMeetingId,
            zoomMeetingPassword
        } = roomData;

        try {
            // Generate unique room code
            const roomCode = await this.generateUniqueRoomCode();

            // Default settings
            const defaultSettings = {
                waiting_room_enabled: true,
                join_before_host: false,
                mute_upon_entry: true,
                enable_recording: true,
                auto_recording: 'cloud',
                enable_chat: true,
                enable_reactions: true,
                enable_polls: true,
                enable_transcription: true,
                enable_breakout_rooms: false,
                max_participants: 100,
                allow_video: true,
                allow_screen_share: 'host',
                layout_mode: 'gallery',
                spotlight_user_id: null,
                virtual_background_enabled: true,
                ...settings
            };

            const query = `
                INSERT INTO zoom_rooms (
                    room_code,
                    zoom_meeting_id,
                    zoom_meeting_password,
                    host_user_id,
                    host_email,
                    host_name,
                    title,
                    description,
                    topic,
                    scheduled_start_time,
                    scheduled_duration,
                    settings,
                    is_public,
                    requires_password,
                    telegram_group_id,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

            const values = [
                roomCode,
                zoomMeetingId,
                zoomMeetingPassword,
                hostUserId,
                hostEmail,
                hostName,
                title,
                description,
                topic,
                scheduledStartTime,
                scheduledDuration,
                JSON.stringify(defaultSettings),
                isPublic,
                requiresPassword,
                telegramGroupId,
                scheduledStartTime ? 'scheduled' : 'active'
            ];

            const result = await pool.query(query, values);
            logger.info(`Zoom room created: ${roomCode} by user ${hostUserId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating zoom room:', error);
            throw error;
        }
    }

    /**
     * Generate a unique room code
     * @returns {Promise<string>} Unique room code (e.g., "ABC-1234")
     */
    static async generateUniqueRoomCode() {
        let roomCode;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            roomCode = generateRoomCode();
            const existing = await this.getByRoomCode(roomCode);
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            throw new Error('Failed to generate unique room code');
        }

        return roomCode;
    }

    /**
     * Get room by ID
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object|null>} Room object or null
     */
    static async getById(roomId) {
        try {
            const query = 'SELECT * FROM zoom_rooms WHERE id = $1';
            const result = await pool.query(query, [roomId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom room by ID:', error);
            throw error;
        }
    }

    /**
     * Get room by room code
     * @param {string} roomCode - Room code (e.g., "ABC-1234")
     * @returns {Promise<Object|null>} Room object or null
     */
    static async getByRoomCode(roomCode) {
        try {
            const query = 'SELECT * FROM zoom_rooms WHERE room_code = $1';
            const result = await pool.query(query, [roomCode.toUpperCase()]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom room by code:', error);
            throw error;
        }
    }

    /**
     * Get rooms by host user ID
     * @param {string} hostUserId - Host user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of rooms
     */
    static async getByHostUserId(hostUserId, options = {}) {
        const {
            status,
            limit = 50,
            offset = 0,
            includeDeleted = false
        } = options;

        try {
            let query = 'SELECT * FROM zoom_rooms WHERE host_user_id = $1';
            const values = [hostUserId];
            let paramCount = 1;

            if (status) {
                paramCount++;
                query += ` AND status = $${paramCount}`;
                values.push(status);
            }

            if (!includeDeleted) {
                query += ' AND deleted_at IS NULL';
            }

            query += ' ORDER BY created_at DESC';

            paramCount++;
            query += ` LIMIT $${paramCount}`;
            values.push(limit);

            paramCount++;
            query += ` OFFSET $${paramCount}`;
            values.push(offset);

            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting zoom rooms by host:', error);
            throw error;
        }
    }

    /**
     * Get active rooms
     * @param {number} limit - Maximum number of rooms to return
     * @returns {Promise<Array>} Array of active rooms
     */
    static async getActiveRooms(limit = 100) {
        try {
            const query = `
                SELECT * FROM active_zoom_rooms
                ORDER BY created_at DESC
                LIMIT $1
            `;
            const result = await pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting active zoom rooms:', error);
            throw error;
        }
    }

    /**
     * Update room
     * @param {string} roomId - Room UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated room
     */
    static async update(roomId, updates) {
        try {
            const allowedFields = [
                'zoom_meeting_id',
                'zoom_meeting_password',
                'host_join_url',
                'title',
                'description',
                'topic',
                'scheduled_start_time',
                'scheduled_duration',
                'actual_start_time',
                'actual_end_time',
                'settings',
                'is_public',
                'requires_password',
                'allowed_domains',
                'status',
                'is_active',
                'total_participants',
                'peak_participants',
                'total_duration',
                'recording_enabled',
                'recording_status',
                'recording_url',
                'recording_file_size',
                'shared_in_groups'
            ];

            const fields = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = $${paramCount}`);

                    // Handle JSONB fields
                    if (['settings', 'allowed_domains', 'shared_in_groups'].includes(key)) {
                        values.push(JSON.stringify(value));
                    } else {
                        values.push(value);
                    }
                    paramCount++;
                }
            }

            if (fields.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(roomId);
            const query = `
                UPDATE zoom_rooms
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            logger.info(`Zoom room updated: ${roomId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom room:', error);
            throw error;
        }
    }

    /**
     * Update room settings
     * @param {string} roomId - Room UUID
     * @param {Object} settingsUpdate - Settings to merge
     * @returns {Promise<Object>} Updated room
     */
    static async updateSettings(roomId, settingsUpdate) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET settings = settings || $1::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [
                JSON.stringify(settingsUpdate),
                roomId
            ]);

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom room settings:', error);
            throw error;
        }
    }

    /**
     * Start a room (mark as active)
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object>} Updated room
     */
    static async startRoom(roomId) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET status = 'active',
                    actual_start_time = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [roomId]);
            logger.info(`Zoom room started: ${roomId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error starting zoom room:', error);
            throw error;
        }
    }

    /**
     * End a room
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object>} Updated room
     */
    static async endRoom(roomId) {
        try {
            const room = await this.getById(roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            // Calculate total duration
            const startTime = room.actual_start_time || room.created_at;
            const endTime = new Date();
            const durationMs = endTime - new Date(startTime);
            const durationMinutes = Math.round(durationMs / 1000 / 60);

            const query = `
                UPDATE zoom_rooms
                SET status = 'ended',
                    actual_end_time = CURRENT_TIMESTAMP,
                    total_duration = $1,
                    is_active = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [durationMinutes, roomId]);
            logger.info(`Zoom room ended: ${roomId}, duration: ${durationMinutes} minutes`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error ending zoom room:', error);
            throw error;
        }
    }

    /**
     * Delete room (soft delete)
     * @param {string} roomId - Room UUID
     * @returns {Promise<boolean>} Success status
     */
    static async delete(roomId) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET deleted_at = CURRENT_TIMESTAMP,
                    is_active = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [roomId]);
            logger.info(`Zoom room soft deleted: ${roomId}`);

            return true;
        } catch (error) {
            logger.error('Error deleting zoom room:', error);
            throw error;
        }
    }

    /**
     * Get room statistics
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object>} Room statistics
     */
    static async getStatistics(roomId) {
        try {
            const query = `
                SELECT * FROM zoom_room_statistics
                WHERE room_id = $1
            `;

            const result = await pool.query(query, [roomId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom room statistics:', error);
            throw error;
        }
    }

    /**
     * Increment participant count
     * @param {string} roomId - Room UUID
     * @returns {Promise<void>}
     */
    static async incrementParticipantCount(roomId) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET total_participants = total_participants + 1,
                    peak_participants = GREATEST(peak_participants,
                        (SELECT COUNT(*) FROM zoom_participants
                         WHERE room_id = $1 AND leave_time IS NULL)),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [roomId]);
        } catch (error) {
            logger.error('Error incrementing participant count:', error);
            throw error;
        }
    }

    /**
     * Add room to shared groups
     * @param {string} roomId - Room UUID
     * @param {string} groupId - Telegram group ID
     * @returns {Promise<void>}
     */
    static async addSharedGroup(roomId, groupId) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET shared_in_groups = array_append(
                    COALESCE(shared_in_groups, '{}'),
                    $1
                )
                WHERE id = $2
                AND NOT ($1 = ANY(COALESCE(shared_in_groups, '{}')))
            `;

            await pool.query(query, [groupId, roomId]);
        } catch (error) {
            logger.error('Error adding shared group:', error);
            throw error;
        }
    }

    /**
     * Get rooms shared in a Telegram group
     * @param {string} groupId - Telegram group ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of rooms
     */
    static async getByTelegramGroup(groupId, options = {}) {
        const { status, limit = 20 } = options;

        try {
            let query = `
                SELECT * FROM zoom_rooms
                WHERE (telegram_group_id = $1 OR $1 = ANY(shared_in_groups))
                AND deleted_at IS NULL
            `;
            const values = [groupId];
            let paramCount = 1;

            if (status) {
                paramCount++;
                query += ` AND status = $${paramCount}`;
                values.push(status);
            }

            query += ' ORDER BY created_at DESC';

            paramCount++;
            query += ` LIMIT $${paramCount}`;
            values.push(limit);

            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting zoom rooms by telegram group:', error);
            throw error;
        }
    }

    /**
     * Check if user can access room
     * @param {string} roomId - Room UUID
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Access allowed
     */
    static async canUserAccessRoom(roomId, userId) {
        try {
            const room = await this.getById(roomId);
            if (!room) {
                return false;
            }

            // Host always has access
            if (room.host_user_id === userId) {
                return true;
            }

            // Public rooms are accessible to everyone
            if (room.is_public) {
                return true;
            }

            // Check if user is in an allowed domain (if email verification exists)
            // This would need user email validation

            return false;
        } catch (error) {
            logger.error('Error checking room access:', error);
            throw error;
        }
    }

    /**
     * Get upcoming scheduled rooms
     * @param {number} hoursAhead - How many hours to look ahead
     * @param {number} limit - Maximum number of rooms
     * @returns {Promise<Array>} Array of upcoming rooms
     */
    static async getUpcomingRooms(hoursAhead = 24, limit = 50) {
        try {
            const query = `
                SELECT * FROM zoom_rooms
                WHERE status = 'scheduled'
                AND scheduled_start_time BETWEEN CURRENT_TIMESTAMP
                    AND CURRENT_TIMESTAMP + ($1 || ' hours')::INTERVAL
                AND deleted_at IS NULL
                ORDER BY scheduled_start_time ASC
                LIMIT $2
            `;

            const result = await pool.query(query, [hoursAhead, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting upcoming zoom rooms:', error);
            throw error;
        }
    }

    /**
     * Clean up old ended rooms
     * @param {number} daysOld - Delete rooms older than this many days
     * @returns {Promise<number>} Number of rooms deleted
     */
    static async cleanupOldRooms(daysOld = 30) {
        try {
            const query = `
                UPDATE zoom_rooms
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE status = 'ended'
                AND actual_end_time < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
                AND deleted_at IS NULL
                RETURNING id
            `;

            const result = await pool.query(query, [daysOld]);
            logger.info(`Cleaned up ${result.rows.length} old zoom rooms`);

            return result.rows.length;
        } catch (error) {
            logger.error('Error cleaning up old zoom rooms:', error);
            throw error;
        }
    }
}

module.exports = ZoomRoomModel;
