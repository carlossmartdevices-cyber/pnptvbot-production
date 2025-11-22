const pool = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Zoom Poll Model
 * Handles all database operations for in-meeting polls
 */
class ZoomPollModel {
    /**
     * Create a new poll
     * @param {Object} pollData - Poll configuration
     * @returns {Promise<Object>} Created poll
     */
    static async create(pollData) {
        const {
            roomId,
            createdBy,
            title,
            question,
            options,
            pollType = 'single_choice',
            allowAnonymous = true,
            showResultsLive = true
        } = pollData;

        try {
            const query = `
                INSERT INTO zoom_polls (
                    room_id,
                    created_by,
                    title,
                    question,
                    options,
                    poll_type,
                    allow_anonymous,
                    show_results_live,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
                RETURNING *
            `;

            const values = [
                roomId,
                createdBy,
                title,
                question,
                JSON.stringify(options),
                pollType,
                allowAnonymous,
                showResultsLive
            ];

            const result = await pool.query(query, values);
            logger.info(`Poll created for room ${roomId}: ${title}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating zoom poll:', error);
            throw error;
        }
    }

    /**
     * Get poll by ID
     * @param {string} pollId - Poll UUID
     * @returns {Promise<Object|null>} Poll object or null
     */
    static async getById(pollId) {
        try {
            const query = 'SELECT * FROM zoom_polls WHERE id = $1';
            const result = await pool.query(query, [pollId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting zoom poll by ID:', error);
            throw error;
        }
    }

    /**
     * Get polls by room ID
     * @param {string} roomId - Room UUID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of polls
     */
    static async getByRoomId(roomId, options = {}) {
        const { status, limit = 50 } = options;

        try {
            let query = 'SELECT * FROM zoom_polls WHERE room_id = $1';
            const values = [roomId];
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
            logger.error('Error getting zoom polls by room:', error);
            throw error;
        }
    }

    /**
     * Update poll
     * @param {string} pollId - Poll UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated poll
     */
    static async update(pollId, updates) {
        try {
            const allowedFields = [
                'title',
                'question',
                'options',
                'poll_type',
                'allow_anonymous',
                'show_results_live',
                'status',
                'started_at',
                'ended_at',
                'results'
            ];

            const fields = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = $${paramCount}`);

                    // Handle JSONB fields
                    if (['options', 'results'].includes(key)) {
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

            values.push(pollId);
            const query = `
                UPDATE zoom_polls
                SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating zoom poll:', error);
            throw error;
        }
    }

    /**
     * Start a poll
     * @param {string} pollId - Poll UUID
     * @returns {Promise<Object>} Updated poll
     */
    static async start(pollId) {
        try {
            const query = `
                UPDATE zoom_polls
                SET status = 'active',
                    started_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            const result = await pool.query(query, [pollId]);
            logger.info(`Poll started: ${pollId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error starting zoom poll:', error);
            throw error;
        }
    }

    /**
     * End a poll and calculate results
     * @param {string} pollId - Poll UUID
     * @returns {Promise<Object>} Updated poll with results
     */
    static async end(pollId) {
        try {
            // Get poll responses
            const responses = await this.getResponses(pollId);
            const poll = await this.getById(pollId);

            if (!poll) {
                throw new Error('Poll not found');
            }

            // Calculate results
            const options = JSON.parse(poll.options);
            const results = options.map(option => ({
                ...option,
                votes: 0,
                percentage: 0
            }));

            // Count votes
            responses.forEach(response => {
                const selectedOptions = JSON.parse(response.selected_options);
                selectedOptions.forEach(optionId => {
                    const resultOption = results.find(r => r.id === optionId);
                    if (resultOption) {
                        resultOption.votes++;
                    }
                });
            });

            // Calculate percentages
            const totalVotes = responses.length;
            results.forEach(option => {
                option.percentage = totalVotes > 0
                    ? Math.round((option.votes / totalVotes) * 100)
                    : 0;
            });

            const query = `
                UPDATE zoom_polls
                SET status = 'ended',
                    ended_at = CURRENT_TIMESTAMP,
                    total_votes = $1,
                    total_voters = $2,
                    results = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `;

            const totalResponses = responses.reduce((sum, r) => {
                const selected = JSON.parse(r.selected_options);
                return sum + selected.length;
            }, 0);

            const result = await pool.query(query, [
                totalResponses,
                totalVotes,
                JSON.stringify(results),
                pollId
            ]);

            logger.info(`Poll ended: ${pollId}, ${totalVotes} voters, ${totalResponses} votes`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error ending zoom poll:', error);
            throw error;
        }
    }

    /**
     * Submit a poll response
     * @param {Object} responseData - Response data
     * @returns {Promise<Object>} Created response
     */
    static async submitResponse(responseData) {
        const {
            pollId,
            participantId,
            selectedOptions,
            responseText = null
        } = responseData;

        try {
            const query = `
                INSERT INTO zoom_poll_responses (
                    poll_id,
                    participant_id,
                    selected_options,
                    response_text
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (poll_id, participant_id)
                DO UPDATE SET
                    selected_options = $3,
                    response_text = $4,
                    responded_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const values = [
                pollId,
                participantId,
                JSON.stringify(selectedOptions),
                responseText
            ];

            const result = await pool.query(query, values);

            // Update poll statistics
            await this.updateStatistics(pollId);

            logger.info(`Poll response submitted for poll ${pollId} by participant ${participantId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error submitting poll response:', error);
            throw error;
        }
    }

    /**
     * Get poll responses
     * @param {string} pollId - Poll UUID
     * @returns {Promise<Array>} Array of responses
     */
    static async getResponses(pollId) {
        try {
            const query = `
                SELECT r.*, p.display_name as participant_name
                FROM zoom_poll_responses r
                JOIN zoom_participants p ON r.participant_id = p.id
                WHERE r.poll_id = $1
                ORDER BY r.responded_at ASC
            `;

            const result = await pool.query(query, [pollId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting poll responses:', error);
            throw error;
        }
    }

    /**
     * Update poll statistics
     * @param {string} pollId - Poll UUID
     * @returns {Promise<void>}
     */
    static async updateStatistics(pollId) {
        try {
            const query = `
                UPDATE zoom_polls
                SET total_voters = (
                    SELECT COUNT(*) FROM zoom_poll_responses WHERE poll_id = $1
                ),
                total_votes = (
                    SELECT SUM(jsonb_array_length(selected_options))
                    FROM zoom_poll_responses WHERE poll_id = $1
                ),
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await pool.query(query, [pollId]);
        } catch (error) {
            logger.error('Error updating poll statistics:', error);
            throw error;
        }
    }

    /**
     * Check if participant has responded
     * @param {string} pollId - Poll UUID
     * @param {string} participantId - Participant UUID
     * @returns {Promise<boolean>} Has responded
     */
    static async hasParticipantResponded(pollId, participantId) {
        try {
            const query = `
                SELECT EXISTS(
                    SELECT 1 FROM zoom_poll_responses
                    WHERE poll_id = $1 AND participant_id = $2
                ) as has_responded
            `;

            const result = await pool.query(query, [pollId, participantId]);
            return result.rows[0].has_responded;
        } catch (error) {
            logger.error('Error checking if participant responded:', error);
            throw error;
        }
    }

    /**
     * Delete poll
     * @param {string} pollId - Poll UUID
     * @returns {Promise<boolean>} Success status
     */
    static async delete(pollId) {
        try {
            // Delete responses first (cascade should handle this, but being explicit)
            await pool.query('DELETE FROM zoom_poll_responses WHERE poll_id = $1', [pollId]);

            // Delete poll
            await pool.query('DELETE FROM zoom_polls WHERE id = $1', [pollId]);

            logger.info(`Poll deleted: ${pollId}`);
            return true;
        } catch (error) {
            logger.error('Error deleting zoom poll:', error);
            throw error;
        }
    }
}

module.exports = ZoomPollModel;
