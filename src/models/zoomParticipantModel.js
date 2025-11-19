const pool = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Zoom Participant Model
 * Handles all database operations for Zoom meeting participants
 */
class ZoomParticipantModel {
    /**
     * Add a participant to a room
     * @param {Object} participantData - Participant information
     * @returns {Promise<Object>} Created participant
     */
    static async create(participantData) {
        const {
            roomId,
            userId = null,
            zoomParticipantId,
            displayName,
            email,
            isGuest = true,
            isHost = false,
            isCoHost = false,
            joinUrl,
            permissions = {}
        } = participantData;

        try {
            // Default permissions
            const defaultPermissions = {
                can_unmute_self: true,
                can_enable_video: true,
                can_share_screen: isHost || isCoHost,
                can_chat: true,
                can_use_reactions: true,
                can_rename: false,
                ...permissions
            };

            const query = `
                INSERT INTO zoom_participants (
                    room_id,
                    user_id,
                    zoom_participant_id,
                    display_name,
                    email,
                    is_guest,
                    is_host,
                    is_co_host,
                    join_url,
                    permissions
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                roomId,
                userId,
                zoomParticipantId,
                displayName,
                email,
                isGuest,
                isHost,
                isCoHost,
                joinUrl,
                JSON.stringify(defaultPermissions)
            ];

            const result = await pool.query(query, values);
            logger.info(`Participant added to room ${roomId}: ${displayName}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating zoom participant:', error);
            throw error;
        }
    }

    /**
     * Get participant by ID
     * @param {string} participantId - Participant UUID
     * @returns {Promise<Object|null>} Participant object or null
     */
    static async getById(participantId) {
        try {
            const query = 'SELECT * FROM zoom_participants WHERE id = $1';
            const result = await pool.query(query, [participantId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom participant by ID:', error);
            throw error;
        }
    }

    /**
     * Get all participants in a room
     * @param {string} roomId - Room UUID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of participants
     */
    static async getByRoomId(roomId, options = {}) {
        const {
            activeOnly = false,
            includeLeft = true
        } = options;

        try {
            let query = 'SELECT * FROM zoom_participants WHERE room_id = $1';
            const values = [roomId];

            if (activeOnly) {
                query += ' AND leave_time IS NULL';
            } else if (!includeLeft) {
                query += ' AND leave_time IS NULL';
            }

            query += ' ORDER BY join_time ASC';

            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting zoom participants by room:', error);
            throw error;
        }
    }

    /**
     * Get active participants count
     * @param {string} roomId - Room UUID
     * @returns {Promise<number>} Number of active participants
     */
    static async getActiveCount(roomId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM zoom_participants
                WHERE room_id = $1
                AND leave_time IS NULL
            `;

            const result = await pool.query(query, [roomId]);
            return parseInt(result.rows[0].count, 10);
        } catch (error) {
            logger.error('Error getting active participant count:', error);
            throw error;
        }
    }

    /**
     * Update participant
     * @param {string} participantId - Participant UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated participant
     */
    static async update(participantId, updates) {
        try {
            const allowedFields = [
                'zoom_participant_id',
                'display_name',
                'email',
                'is_co_host',
                'leave_time',
                'audio_status',
                'video_status',
                'screen_share_status',
                'is_hand_raised',
                'is_speaking',
                'permissions',
                'total_talk_time',
                'messages_sent',
                'reactions_sent',
                'polls_answered',
                'connection_quality',
                'network_issues_count',
                'was_removed',
                'removal_reason',
                'removed_at',
                'removed_by'
            ];

            const fields = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = $${paramCount}`);

                    // Handle JSONB fields
                    if (key === 'permissions') {
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

            values.push(participantId);
            const query = `
                UPDATE zoom_participants
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom participant:', error);
            throw error;
        }
    }

    /**
     * Update participant permissions
     * @param {string} participantId - Participant UUID
     * @param {Object} permissionsUpdate - Permissions to merge
     * @returns {Promise<Object>} Updated participant
     */
    static async updatePermissions(participantId, permissionsUpdate) {
        try {
            const query = `
                UPDATE zoom_participants
                SET permissions = permissions || $1::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [
                JSON.stringify(permissionsUpdate),
                participantId
            ]);

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom participant permissions:', error);
            throw error;
        }
    }

    /**
     * Mark participant as left
     * @param {string} participantId - Participant UUID
     * @returns {Promise<Object>} Updated participant
     */
    static async markAsLeft(participantId) {
        try {
            const query = `
                UPDATE zoom_participants
                SET leave_time = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [participantId]);
            logger.info(`Participant marked as left: ${participantId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error marking participant as left:', error);
            throw error;
        }
    }

    /**
     * Remove participant from room
     * @param {string} participantId - Participant UUID
     * @param {string} removedBy - User ID who removed the participant
     * @param {string} reason - Reason for removal
     * @returns {Promise<Object>} Updated participant
     */
    static async remove(participantId, removedBy, reason = null) {
        try {
            const query = `
                UPDATE zoom_participants
                SET was_removed = true,
                    removal_reason = $1,
                    removed_at = CURRENT_TIMESTAMP,
                    removed_by = $2,
                    leave_time = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;

            const result = await pool.query(query, [reason, removedBy, participantId]);
            logger.info(`Participant removed: ${participantId} by ${removedBy}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error removing zoom participant:', error);
            throw error;
        }
    }

    /**
     * Set audio status
     * @param {string} participantId - Participant UUID
     * @param {string} status - 'muted' or 'unmuted'
     * @returns {Promise<Object>} Updated participant
     */
    static async setAudioStatus(participantId, status) {
        try {
            const query = `
                UPDATE zoom_participants
                SET audio_status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [status, participantId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error setting audio status:', error);
            throw error;
        }
    }

    /**
     * Set video status
     * @param {string} participantId - Participant UUID
     * @param {string} status - 'on' or 'off'
     * @returns {Promise<Object>} Updated participant
     */
    static async setVideoStatus(participantId, status) {
        try {
            const query = `
                UPDATE zoom_participants
                SET video_status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [status, participantId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error setting video status:', error);
            throw error;
        }
    }

    /**
     * Set screen share status
     * @param {string} participantId - Participant UUID
     * @param {string} status - 'on' or 'off'
     * @returns {Promise<Object>} Updated participant
     */
    static async setScreenShareStatus(participantId, status) {
        try {
            const query = `
                UPDATE zoom_participants
                SET screen_share_status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [status, participantId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error setting screen share status:', error);
            throw error;
        }
    }

    /**
     * Toggle hand raised
     * @param {string} participantId - Participant UUID
     * @param {boolean} isRaised - Hand raised status
     * @returns {Promise<Object>} Updated participant
     */
    static async toggleHandRaised(participantId, isRaised) {
        try {
            const query = `
                UPDATE zoom_participants
                SET is_hand_raised = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [isRaised, participantId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error toggling hand raised:', error);
            throw error;
        }
    }

    /**
     * Increment message count
     * @param {string} participantId - Participant UUID
     * @returns {Promise<void>}
     */
    static async incrementMessageCount(participantId) {
        try {
            const query = `
                UPDATE zoom_participants
                SET messages_sent = messages_sent + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [participantId]);
        } catch (error) {
            logger.error('Error incrementing message count:', error);
            throw error;
        }
    }

    /**
     * Increment reaction count
     * @param {string} participantId - Participant UUID
     * @returns {Promise<void>}
     */
    static async incrementReactionCount(participantId) {
        try {
            const query = `
                UPDATE zoom_participants
                SET reactions_sent = reactions_sent + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [participantId]);
        } catch (error) {
            logger.error('Error incrementing reaction count:', error);
            throw error;
        }
    }

    /**
     * Add talk time
     * @param {string} participantId - Participant UUID
     * @param {number} seconds - Seconds to add
     * @returns {Promise<void>}
     */
    static async addTalkTime(participantId, seconds) {
        try {
            const query = `
                UPDATE zoom_participants
                SET total_talk_time = total_talk_time + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await pool.query(query, [seconds, participantId]);
        } catch (error) {
            logger.error('Error adding talk time:', error);
            throw error;
        }
    }

    /**
     * Get participant by user ID and room ID
     * @param {string} userId - User ID
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object|null>} Participant object or null
     */
    static async getByUserAndRoom(userId, roomId) {
        try {
            const query = `
                SELECT * FROM zoom_participants
                WHERE user_id = $1 AND room_id = $2
                AND leave_time IS NULL
                ORDER BY join_time DESC
                LIMIT 1
            `;

            const result = await pool.query(query, [userId, roomId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting participant by user and room:', error);
            throw error;
        }
    }

    /**
     * Get host of a room
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object|null>} Host participant or null
     */
    static async getHost(roomId) {
        try {
            const query = `
                SELECT * FROM zoom_participants
                WHERE room_id = $1 AND is_host = true
                LIMIT 1
            `;

            const result = await pool.query(query, [roomId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting host:', error);
            throw error;
        }
    }

    /**
     * Get co-hosts of a room
     * @param {string} roomId - Room UUID
     * @returns {Promise<Array>} Array of co-host participants
     */
    static async getCoHosts(roomId) {
        try {
            const query = `
                SELECT * FROM zoom_participants
                WHERE room_id = $1 AND is_co_host = true
                AND leave_time IS NULL
                ORDER BY join_time ASC
            `;

            const result = await pool.query(query, [roomId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting co-hosts:', error);
            throw error;
        }
    }

    /**
     * Promote to co-host
     * @param {string} participantId - Participant UUID
     * @returns {Promise<Object>} Updated participant
     */
    static async promoteToCoHost(participantId) {
        try {
            const query = `
                UPDATE zoom_participants
                SET is_co_host = true,
                    permissions = permissions || '{"can_share_screen": true}'::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [participantId]);
            logger.info(`Participant promoted to co-host: ${participantId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error promoting to co-host:', error);
            throw error;
        }
    }

    /**
     * Demote from co-host
     * @param {string} participantId - Participant UUID
     * @returns {Promise<Object>} Updated participant
     */
    static async demoteFromCoHost(participantId) {
        try {
            const query = `
                UPDATE zoom_participants
                SET is_co_host = false,
                    permissions = permissions || '{"can_share_screen": false}'::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [participantId]);
            logger.info(`Participant demoted from co-host: ${participantId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error demoting from co-host:', error);
            throw error;
        }
    }

    /**
     * Get participant statistics
     * @param {string} participantId - Participant UUID
     * @returns {Promise<Object>} Participant statistics
     */
    static async getStatistics(participantId) {
        try {
            const query = `
                SELECT
                    p.*,
                    EXTRACT(EPOCH FROM (COALESCE(p.leave_time, CURRENT_TIMESTAMP) - p.join_time))::INTEGER as total_duration_seconds,
                    (SELECT COUNT(*) FROM zoom_chat_messages WHERE participant_id = p.id) as total_messages,
                    (SELECT COUNT(*) FROM zoom_reactions WHERE participant_id = p.id) as total_reactions
                FROM zoom_participants p
                WHERE p.id = $1
            `;

            const result = await pool.query(query, [participantId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting participant statistics:', error);
            throw error;
        }
    }

    /**
     * Bulk mute all participants
     * @param {string} roomId - Room UUID
     * @param {Array<string>} excludeIds - Participant IDs to exclude from muting
     * @returns {Promise<number>} Number of participants muted
     */
    static async bulkMute(roomId, excludeIds = []) {
        try {
            let query = `
                UPDATE zoom_participants
                SET audio_status = 'muted',
                    updated_at = CURRENT_TIMESTAMP
                WHERE room_id = $1
                AND leave_time IS NULL
                AND audio_status = 'unmuted'
            `;

            const values = [roomId];

            if (excludeIds.length > 0) {
                query += ` AND id != ALL($2)`;
                values.push(excludeIds);
            }

            query += ' RETURNING id';

            const result = await pool.query(query, values);
            logger.info(`Bulk muted ${result.rows.length} participants in room ${roomId}`);

            return result.rows.length;
        } catch (error) {
            logger.error('Error bulk muting participants:', error);
            throw error;
        }
    }

    /**
     * Bulk turn off video for all participants
     * @param {string} roomId - Room UUID
     * @param {Array<string>} excludeIds - Participant IDs to exclude
     * @returns {Promise<number>} Number of participants with video turned off
     */
    static async bulkTurnOffVideo(roomId, excludeIds = []) {
        try {
            let query = `
                UPDATE zoom_participants
                SET video_status = 'off',
                    updated_at = CURRENT_TIMESTAMP
                WHERE room_id = $1
                AND leave_time IS NULL
                AND video_status = 'on'
            `;

            const values = [roomId];

            if (excludeIds.length > 0) {
                query += ` AND id != ALL($2)`;
                values.push(excludeIds);
            }

            query += ' RETURNING id';

            const result = await pool.query(query, values);
            logger.info(`Bulk turned off video for ${result.rows.length} participants in room ${roomId}`);

            return result.rows.length;
        } catch (error) {
            logger.error('Error bulk turning off video:', error);
            throw error;
        }
    }
}

module.exports = ZoomParticipantModel;
