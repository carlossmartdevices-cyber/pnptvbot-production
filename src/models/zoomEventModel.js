const pool = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Zoom Event Model
 * Handles all database operations for Zoom event logging
 */
class ZoomEventModel {
    /**
     * Log an event
     * @param {Object} eventData - Event information
     * @returns {Promise<Object>} Created event
     */
    static async log(eventData) {
        const {
            roomId,
            participantId = null,
            eventType,
            eventCategory,
            eventData: data = {},
            description,
            actorUserId = null,
            actorName,
            actorRole,
            targetUserId = null,
            targetName,
            ipAddress = null,
            userAgent = null
        } = eventData;

        try {
            const query = `
                INSERT INTO zoom_events (
                    room_id,
                    participant_id,
                    event_type,
                    event_category,
                    event_data,
                    description,
                    actor_user_id,
                    actor_name,
                    actor_role,
                    target_user_id,
                    target_name,
                    ip_address,
                    user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;

            const values = [
                roomId,
                participantId,
                eventType,
                eventCategory,
                JSON.stringify(data),
                description,
                actorUserId,
                actorName,
                actorRole,
                targetUserId,
                targetName,
                ipAddress,
                userAgent
            ];

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error logging zoom event:', error);
            throw error;
        }
    }

    /**
     * Get events by room ID
     * @param {string} roomId - Room UUID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of events
     */
    static async getByRoomId(roomId, options = {}) {
        const {
            eventType,
            eventCategory,
            limit = 100,
            offset = 0
        } = options;

        try {
            let query = 'SELECT * FROM zoom_events WHERE room_id = $1';
            const values = [roomId];
            let paramCount = 1;

            if (eventType) {
                paramCount++;
                query += ` AND event_type = $${paramCount}`;
                values.push(eventType);
            }

            if (eventCategory) {
                paramCount++;
                query += ` AND event_category = $${paramCount}`;
                values.push(eventCategory);
            }

            query += ' ORDER BY timestamp DESC';

            paramCount++;
            query += ` LIMIT $${paramCount}`;
            values.push(limit);

            paramCount++;
            query += ` OFFSET $${paramCount}`;
            values.push(offset);

            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting zoom events by room:', error);
            throw error;
        }
    }

    /**
     * Get recent events
     * @param {number} limit - Maximum number of events
     * @returns {Promise<Array>} Array of recent events
     */
    static async getRecent(limit = 50) {
        try {
            const query = `
                SELECT e.*, zr.title as room_title
                FROM zoom_events e
                JOIN zoom_rooms zr ON e.room_id = zr.id
                ORDER BY e.timestamp DESC
                LIMIT $1
            `;

            const result = await pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting recent zoom events:', error);
            throw error;
        }
    }

    /**
     * Get event statistics for a room
     * @param {string} roomId - Room UUID
     * @returns {Promise<Object>} Event statistics
     */
    static async getStatistics(roomId) {
        try {
            const query = `
                SELECT
                    event_category,
                    event_type,
                    COUNT(*) as count
                FROM zoom_events
                WHERE room_id = $1
                GROUP BY event_category, event_type
                ORDER BY count DESC
            `;

            const result = await pool.query(query, [roomId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting event statistics:', error);
            throw error;
        }
    }

    /**
     * Delete old events
     * @param {number} daysOld - Delete events older than this many days
     * @returns {Promise<number>} Number of events deleted
     */
    static async deleteOldEvents(daysOld = 30) {
        try {
            const query = `
                DELETE FROM zoom_events
                WHERE timestamp < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
                RETURNING id
            `;

            const result = await pool.query(query, [daysOld]);
            logger.info(`Deleted ${result.rows.length} old zoom events`);

            return result.rows.length;
        } catch (error) {
            logger.error('Error deleting old zoom events:', error);
            throw error;
        }
    }
}

module.exports = ZoomEventModel;
