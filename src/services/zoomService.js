const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const ZoomRoomModel = require('../models/zoomRoomModel');
const ZoomParticipantModel = require('../models/zoomParticipantModel');

/**
 * Zoom Service
 * Handles all Zoom API interactions
 */
class ZoomService {
    constructor() {
        this.apiKey = process.env.ZOOM_API_KEY;
        this.apiSecret = process.env.ZOOM_API_SECRET;
        this.baseUrl = 'https://api.zoom.us/v2';
        this.webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;

        // SDK App credentials (for client-side SDK)
        this.sdkKey = process.env.ZOOM_SDK_KEY;
        this.sdkSecret = process.env.ZOOM_SDK_SECRET;
    }

    /**
     * Generate JWT token for Zoom API authentication
     * @returns {string} JWT token
     */
    generateJWT() {
        const payload = {
            iss: this.apiKey,
            exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
        };

        return jwt.sign(payload, this.apiSecret);
    }

    /**
     * Generate SDK JWT for client-side Zoom SDK
     * @param {string} meetingNumber - Meeting number
     * @param {number} role - 0 for participant, 1 for host
     * @returns {string} SDK JWT token
     */
    generateSDKJWT(meetingNumber, role = 0) {
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + (60 * 60 * 2); // 2 hours

        const payload = {
            sdkKey: this.sdkKey,
            mn: meetingNumber,
            role: role,
            iat: iat,
            exp: exp,
            appKey: this.sdkKey,
            tokenExp: exp
        };

        return jwt.sign(payload, this.sdkSecret);
    }

    /**
     * Make authenticated request to Zoom API
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @returns {Promise<Object>} API response
     */
    async makeRequest(method, endpoint, data = null) {
        try {
            const token = this.generateJWT();
            const url = `${this.baseUrl}${endpoint}`;

            const config = {
                method,
                url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                if (method === 'GET') {
                    config.params = data;
                } else {
                    config.data = data;
                }
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error('Zoom API request error:', {
                endpoint,
                error: error.response?.data || error.message
            });
            throw new Error(`Zoom API Error: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Create a new Zoom meeting
     * @param {Object} meetingConfig - Meeting configuration
     * @returns {Promise<Object>} Meeting details
     */
    async createMeeting(meetingConfig) {
        const {
            topic = 'PNP.tv Meeting',
            type = 2, // 1 = instant, 2 = scheduled
            startTime,
            duration = 60,
            timezone = 'America/Bogota',
            settings = {}
        } = meetingConfig;

        try {
            // Default meeting settings
            const defaultSettings = {
                host_video: false,
                participant_video: false,
                cn_meeting: false,
                in_meeting: false,
                join_before_host: false,
                jbh_time: 0,
                mute_upon_entry: true,
                watermark: false,
                use_pmi: false,
                approval_type: 0, // 0 = automatically approve
                registration_type: 1,
                audio: 'both',
                auto_recording: 'cloud',
                enforce_login: false,
                waiting_room: true,
                allow_multiple_devices: true,
                meeting_authentication: false,
                ...settings
            };

            const meetingData = {
                topic,
                type,
                start_time: startTime,
                duration,
                timezone,
                settings: defaultSettings
            };

            // Use 'me' as user ID to create meeting for the authenticated user
            // In production, you might want to create meetings under a specific user
            const response = await this.makeRequest('POST', '/users/me/meetings', meetingData);

            logger.info(`Zoom meeting created: ${response.id}`);

            return {
                meetingId: response.id.toString(),
                meetingNumber: response.id,
                topic: response.topic,
                joinUrl: response.join_url,
                startUrl: response.start_url,
                password: response.password,
                h323Password: response.h323_password,
                pstnPassword: response.pstn_password,
                encryptedPassword: response.encrypted_password,
                startTime: response.start_time,
                duration: response.duration,
                timezone: response.timezone,
                settings: response.settings
            };
        } catch (error) {
            logger.error('Error creating Zoom meeting:', error);
            throw error;
        }
    }

    /**
     * Get meeting details
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<Object>} Meeting details
     */
    async getMeeting(meetingId) {
        try {
            const response = await this.makeRequest('GET', `/meetings/${meetingId}`);
            return response;
        } catch (error) {
            logger.error('Error getting Zoom meeting:', error);
            throw error;
        }
    }

    /**
     * Update meeting
     * @param {string} meetingId - Meeting ID
     * @param {Object} updates - Meeting updates
     * @returns {Promise<Object>} Updated meeting
     */
    async updateMeeting(meetingId, updates) {
        try {
            await this.makeRequest('PATCH', `/meetings/${meetingId}`, updates);
            return await this.getMeeting(meetingId);
        } catch (error) {
            logger.error('Error updating Zoom meeting:', error);
            throw error;
        }
    }

    /**
     * Delete meeting
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteMeeting(meetingId) {
        try {
            await this.makeRequest('DELETE', `/meetings/${meetingId}`);
            logger.info(`Zoom meeting deleted: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error deleting Zoom meeting:', error);
            throw error;
        }
    }

    /**
     * End a meeting
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async endMeeting(meetingId) {
        try {
            await this.makeRequest('PUT', `/meetings/${meetingId}/status`, {
                action: 'end'
            });
            logger.info(`Zoom meeting ended: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error ending Zoom meeting:', error);
            throw error;
        }
    }

    /**
     * List meeting participants
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<Array>} List of participants
     */
    async listParticipants(meetingId) {
        try {
            const response = await this.makeRequest('GET', `/meetings/${meetingId}/participants`, {
                page_size: 300
            });
            return response.participants || [];
        } catch (error) {
            logger.error('Error listing meeting participants:', error);
            throw error;
        }
    }

    /**
     * Remove a participant from meeting
     * @param {string} meetingId - Meeting ID
     * @param {string} participantId - Participant ID
     * @returns {Promise<boolean>} Success status
     */
    async removeParticipant(meetingId, participantId) {
        try {
            await this.makeRequest('DELETE', `/meetings/${meetingId}/participants/${participantId}`);
            logger.info(`Participant removed from meeting ${meetingId}: ${participantId}`);
            return true;
        } catch (error) {
            logger.error('Error removing participant:', error);
            throw error;
        }
    }

    /**
     * Update participant status (mute/unmute, etc.)
     * @param {string} meetingId - Meeting ID (live meeting)
     * @param {Object} action - Action to perform
     * @returns {Promise<boolean>} Success status
     */
    async updateParticipantStatus(meetingId, action) {
        try {
            await this.makeRequest('PATCH', `/live_meetings/${meetingId}/events`, action);
            return true;
        } catch (error) {
            logger.error('Error updating participant status:', error);
            throw error;
        }
    }

    /**
     * Mute a participant
     * @param {string} meetingId - Meeting ID
     * @param {string} participantId - Participant ID
     * @returns {Promise<boolean>} Success status
     */
    async muteParticipant(meetingId, participantId) {
        return await this.updateParticipantStatus(meetingId, {
            method: 'participant.mute',
            params: {
                participant_id: participantId
            }
        });
    }

    /**
     * Mute all participants
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async muteAllParticipants(meetingId) {
        return await this.updateParticipantStatus(meetingId, {
            method: 'participant.mute_all',
            params: {}
        });
    }

    /**
     * Unmute a participant
     * @param {string} meetingId - Meeting ID
     * @param {string} participantId - Participant ID
     * @returns {Promise<boolean>} Success status
     */
    async unmuteParticipant(meetingId, participantId) {
        return await this.updateParticipantStatus(meetingId, {
            method: 'participant.unmute',
            params: {
                participant_id: participantId
            }
        });
    }

    /**
     * Turn off participant video
     * @param {string} meetingId - Meeting ID
     * @param {string} participantId - Participant ID
     * @returns {Promise<boolean>} Success status
     */
    async stopParticipantVideo(meetingId, participantId) {
        return await this.updateParticipantStatus(meetingId, {
            method: 'participant.video_stop',
            params: {
                participant_id: participantId
            }
        });
    }

    /**
     * Start recording
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async startRecording(meetingId) {
        try {
            await this.makeRequest('PATCH', `/meetings/${meetingId}/recordings/status`, {
                action: 'start'
            });
            logger.info(`Recording started for meeting: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error starting recording:', error);
            throw error;
        }
    }

    /**
     * Stop recording
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async stopRecording(meetingId) {
        try {
            await this.makeRequest('PATCH', `/meetings/${meetingId}/recordings/status`, {
                action: 'stop'
            });
            logger.info(`Recording stopped for meeting: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error stopping recording:', error);
            throw error;
        }
    }

    /**
     * Pause recording
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async pauseRecording(meetingId) {
        try {
            await this.makeRequest('PATCH', `/meetings/${meetingId}/recordings/status`, {
                action: 'pause'
            });
            logger.info(`Recording paused for meeting: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error pausing recording:', error);
            throw error;
        }
    }

    /**
     * Resume recording
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async resumeRecording(meetingId) {
        try {
            await this.makeRequest('PATCH', `/meetings/${meetingId}/recordings/status`, {
                action: 'resume'
            });
            logger.info(`Recording resumed for meeting: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error resuming recording:', error);
            throw error;
        }
    }

    /**
     * Get meeting recordings
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<Object>} Recording details
     */
    async getRecordings(meetingId) {
        try {
            const response = await this.makeRequest('GET', `/meetings/${meetingId}/recordings`);
            return response;
        } catch (error) {
            logger.error('Error getting recordings:', error);
            throw error;
        }
    }

    /**
     * Delete recording
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteRecording(meetingId) {
        try {
            await this.makeRequest('DELETE', `/meetings/${meetingId}/recordings`);
            logger.info(`Recording deleted for meeting: ${meetingId}`);
            return true;
        } catch (error) {
            logger.error('Error deleting recording:', error);
            throw error;
        }
    }

    /**
     * Create a poll
     * @param {string} meetingId - Meeting ID
     * @param {Object} pollData - Poll configuration
     * @returns {Promise<Object>} Created poll
     */
    async createPoll(meetingId, pollData) {
        try {
            const response = await this.makeRequest('POST', `/meetings/${meetingId}/polls`, pollData);
            logger.info(`Poll created for meeting: ${meetingId}`);
            return response;
        } catch (error) {
            logger.error('Error creating poll:', error);
            throw error;
        }
    }

    /**
     * Verify webhook signature
     * @param {string} payload - Request body as string
     * @param {string} signature - Signature from header
     * @returns {boolean} Signature is valid
     */
    verifyWebhook(payload, signature) {
        const hash = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(payload)
            .digest('hex');

        return hash === signature;
    }

    /**
     * Handle webhook event
     * @param {Object} event - Webhook event
     * @returns {Promise<void>}
     */
    async handleWebhookEvent(event) {
        const { event: eventType, payload } = event;

        logger.info(`Zoom webhook event received: ${eventType}`);

        try {
            switch (eventType) {
                case 'meeting.started':
                    await this.handleMeetingStarted(payload);
                    break;

                case 'meeting.ended':
                    await this.handleMeetingEnded(payload);
                    break;

                case 'meeting.participant_joined':
                    await this.handleParticipantJoined(payload);
                    break;

                case 'meeting.participant_left':
                    await this.handleParticipantLeft(payload);
                    break;

                case 'recording.completed':
                    await this.handleRecordingCompleted(payload);
                    break;

                default:
                    logger.info(`Unhandled webhook event: ${eventType}`);
            }
        } catch (error) {
            logger.error(`Error handling webhook event ${eventType}:`, error);
            throw error;
        }
    }

    /**
     * Handle meeting started event
     * @param {Object} payload - Event payload
     */
    async handleMeetingStarted(payload) {
        const meetingId = payload.object.id.toString();

        // Find room by Zoom meeting ID
        const rooms = await ZoomRoomModel.getByHostUserId('*');
        const room = rooms.find(r => r.zoom_meeting_id === meetingId);

        if (room) {
            await ZoomRoomModel.startRoom(room.id);
            logger.info(`Meeting started: ${meetingId}`);
        }
    }

    /**
     * Handle meeting ended event
     * @param {Object} payload - Event payload
     */
    async handleMeetingEnded(payload) {
        const meetingId = payload.object.id.toString();

        // Find room by Zoom meeting ID
        const rooms = await ZoomRoomModel.getByHostUserId('*');
        const room = rooms.find(r => r.zoom_meeting_id === meetingId);

        if (room) {
            await ZoomRoomModel.endRoom(room.id);
            logger.info(`Meeting ended: ${meetingId}`);
        }
    }

    /**
     * Handle participant joined event
     * @param {Object} payload - Event payload
     */
    async handleParticipantJoined(payload) {
        const meetingId = payload.object.id.toString();
        const participant = payload.object.participant;

        // Find room and add participant
        const rooms = await ZoomRoomModel.getByHostUserId('*');
        const room = rooms.find(r => r.zoom_meeting_id === meetingId);

        if (room) {
            await ZoomParticipantModel.create({
                roomId: room.id,
                zoomParticipantId: participant.id || participant.user_id,
                displayName: participant.user_name,
                email: participant.email,
                isGuest: !participant.user_id,
                isHost: participant.id === payload.object.host_id
            });

            await ZoomRoomModel.incrementParticipantCount(room.id);
            logger.info(`Participant joined meeting ${meetingId}: ${participant.user_name}`);
        }
    }

    /**
     * Handle participant left event
     * @param {Object} payload - Event payload
     */
    async handleParticipantLeft(payload) {
        const meetingId = payload.object.id.toString();
        const participant = payload.object.participant;

        // Find room and mark participant as left
        const rooms = await ZoomRoomModel.getByHostUserId('*');
        const room = rooms.find(r => r.zoom_meeting_id === meetingId);

        if (room) {
            const participants = await ZoomParticipantModel.getByRoomId(room.id);
            const dbParticipant = participants.find(
                p => p.zoom_participant_id === (participant.id || participant.user_id)
            );

            if (dbParticipant) {
                await ZoomParticipantModel.markAsLeft(dbParticipant.id);
                logger.info(`Participant left meeting ${meetingId}: ${participant.user_name}`);
            }
        }
    }

    /**
     * Handle recording completed event
     * @param {Object} payload - Event payload
     */
    async handleRecordingCompleted(payload) {
        const meetingId = payload.object.id.toString();

        logger.info(`Recording completed for meeting: ${meetingId}`);
        // Additional recording processing can be added here
    }

    /**
     * Generate join URL for participant
     * @param {string} meetingNumber - Meeting number
     * @param {string} displayName - Participant display name
     * @param {string} password - Meeting password
     * @returns {string} Join URL
     */
    generateJoinUrl(meetingNumber, displayName, password = '') {
        const baseUrl = process.env.ZOOM_WEB_DOMAIN || 'https://zoom.us';
        let url = `${baseUrl}/wc/${meetingNumber}/join`;

        const params = new URLSearchParams();
        if (displayName) {
            params.append('uname', displayName);
        }
        if (password) {
            params.append('pwd', password);
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        return url;
    }
}

module.exports = new ZoomService();
