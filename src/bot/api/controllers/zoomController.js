const zoomService = require('../../../services/zoomService');
const ZoomRoomModel = require('../../../models/zoomRoomModel');
const ZoomParticipantModel = require('../../../models/zoomParticipantModel');
const ZoomEventModel = require('../../../models/zoomEventModel');
const logger = require('../../../utils/logger');
const crypto = require('crypto');

/**
 * Zoom API Controller
 * Handles all HTTP requests for Zoom meetings
 */
class ZoomController {
    /**
     * Get room information
     * GET /api/zoom/room/:roomCode
     */
    static async getRoomInfo(req, res) {
        try {
            const { roomCode } = req.params;

            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            // Get current participants count
            const currentParticipants = await ZoomParticipantModel.getActiveCount(room.id);

            // Don't expose sensitive information
            const publicRoomData = {
                room_code: room.room_code,
                title: room.title,
                description: room.description,
                host_name: room.host_name,
                status: room.status,
                current_participants: currentParticipants,
                total_participants: room.total_participants,
                is_public: room.is_public,
                scheduled_start_time: room.scheduled_start_time,
                settings: {
                    waiting_room_enabled: room.settings.waiting_room_enabled,
                    mute_upon_entry: room.settings.mute_upon_entry,
                    enable_chat: room.settings.enable_chat,
                    enable_reactions: room.settings.enable_reactions
                }
            };

            res.json({
                success: true,
                room: publicRoomData
            });
        } catch (error) {
            logger.error('Error getting room info:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Join a meeting (for guests)
     * POST /api/zoom/join
     */
    static async joinMeeting(req, res) {
        try {
            const { roomCode, displayName } = req.body;

            if (!roomCode || !displayName) {
                return res.status(400).json({
                    success: false,
                    message: 'Room code and display name are required'
                });
            }

            // Find room
            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (room.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'This room is not currently active'
                });
            }

            // Check if room is locked or has restrictions
            if (!room.is_public) {
                return res.status(403).json({
                    success: false,
                    message: 'This room is private'
                });
            }

            // Generate SDK signature for participant (role = 0)
            const signature = zoomService.generateSDKJWT(room.zoom_meeting_id, 0);

            // Add participant to database
            const participant = await ZoomParticipantModel.create({
                roomId: room.id,
                userId: null,
                displayName: displayName,
                isGuest: true,
                isHost: false
            });

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                participantId: participant.id,
                eventType: 'participant.joined',
                eventCategory: 'participant',
                description: `${displayName} joined as guest`,
                actorName: displayName
            });

            // Increment participant count
            await ZoomRoomModel.incrementParticipantCount(room.id);

            res.json({
                success: true,
                sdkKey: process.env.ZOOM_SDK_KEY,
                signature: signature,
                meetingNumber: room.zoom_meeting_id,
                password: room.zoom_meeting_password || '',
                userName: displayName,
                participantId: participant.id
            });
        } catch (error) {
            logger.error('Error joining meeting:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join meeting'
            });
        }
    }

    /**
     * Join as host with authentication
     * POST /api/zoom/host/join
     */
    static async joinAsHost(req, res) {
        try {
            const { roomCode, token } = req.body;

            if (!roomCode || !token) {
                return res.status(400).json({
                    success: false,
                    message: 'Room code and authentication token are required'
                });
            }

            // Find room
            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            // Verify host token (you would implement proper JWT verification here)
            // For now, we'll use a simplified approach
            const expectedToken = crypto
                .createHash('sha256')
                .update(`${room.id}:${room.host_user_id}:${process.env.JWT_SECRET}`)
                .digest('hex');

            if (token !== expectedToken) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid authentication token'
                });
            }

            // Generate SDK signature for host (role = 1)
            const signature = zoomService.generateSDKJWT(room.zoom_meeting_id, 1);

            // Add host as participant
            const participant = await ZoomParticipantModel.create({
                roomId: room.id,
                userId: room.host_user_id,
                displayName: room.host_name,
                isGuest: false,
                isHost: true,
                permissions: {
                    can_unmute_self: true,
                    can_enable_video: true,
                    can_share_screen: true,
                    can_chat: true,
                    can_use_reactions: true,
                    can_rename: true
                }
            });

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                participantId: participant.id,
                eventType: 'host.joined',
                eventCategory: 'participant',
                description: 'Host joined the meeting',
                actorUserId: room.host_user_id,
                actorName: room.host_name,
                actorRole: 'host'
            });

            res.json({
                success: true,
                sdkKey: process.env.ZOOM_SDK_KEY,
                signature: signature,
                meetingNumber: room.zoom_meeting_id,
                password: room.zoom_meeting_password || '',
                userName: room.host_name,
                participantId: participant.id,
                isHost: true
            });
        } catch (error) {
            logger.error('Error joining as host:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join as host'
            });
        }
    }

    /**
     * End a meeting
     * POST /api/zoom/end/:roomCode
     */
    static async endMeeting(req, res) {
        try {
            const { roomCode } = req.params;
            const { hostToken } = req.body;

            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            // Verify host authorization (simplified)
            // In production, you'd verify JWT or session

            // End meeting via Zoom API
            if (room.zoom_meeting_id) {
                await zoomService.endMeeting(room.zoom_meeting_id);
            }

            // Update room in database
            await ZoomRoomModel.endRoom(room.id);

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                eventType: 'meeting.ended',
                eventCategory: 'meeting',
                description: 'Meeting ended by host',
                actorUserId: room.host_user_id,
                actorRole: 'host'
            });

            res.json({
                success: true,
                message: 'Meeting ended successfully'
            });
        } catch (error) {
            logger.error('Error ending meeting:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to end meeting'
            });
        }
    }

    /**
     * Get participants list
     * GET /api/zoom/participants/:roomCode
     */
    static async getParticipants(req, res) {
        try {
            const { roomCode } = req.params;

            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            const participants = await ZoomParticipantModel.getByRoomId(room.id, {
                activeOnly: true
            });

            // Map to public data
            const participantsData = participants.map(p => ({
                id: p.id,
                display_name: p.display_name,
                is_host: p.is_host,
                is_co_host: p.is_co_host,
                audio_status: p.audio_status,
                video_status: p.video_status,
                is_hand_raised: p.is_hand_raised,
                join_time: p.join_time
            }));

            res.json({
                success: true,
                participants: participantsData,
                total: participantsData.length
            });
        } catch (error) {
            logger.error('Error getting participants:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get participants'
            });
        }
    }

    /**
     * Control participant (mute, remove, etc.)
     * POST /api/zoom/participant/:participantId/action
     */
    static async controlParticipant(req, res) {
        try {
            const { participantId } = req.params;
            const { action, value } = req.body;

            const participant = await ZoomParticipantModel.getById(participantId);

            if (!participant) {
                return res.status(404).json({
                    success: false,
                    message: 'Participant not found'
                });
            }

            const room = await ZoomRoomModel.getById(participant.room_id);

            // Perform action
            switch (action) {
                case 'mute':
                    await ZoomParticipantModel.setAudioStatus(participantId, 'muted');
                    if (room.zoom_meeting_id && participant.zoom_participant_id) {
                        await zoomService.muteParticipant(
                            room.zoom_meeting_id,
                            participant.zoom_participant_id
                        );
                    }
                    break;

                case 'unmute':
                    await ZoomParticipantModel.setAudioStatus(participantId, 'unmuted');
                    if (room.zoom_meeting_id && participant.zoom_participant_id) {
                        await zoomService.unmuteParticipant(
                            room.zoom_meeting_id,
                            participant.zoom_participant_id
                        );
                    }
                    break;

                case 'stop_video':
                    await ZoomParticipantModel.setVideoStatus(participantId, 'off');
                    if (room.zoom_meeting_id && participant.zoom_participant_id) {
                        await zoomService.stopParticipantVideo(
                            room.zoom_meeting_id,
                            participant.zoom_participant_id
                        );
                    }
                    break;

                case 'remove':
                    await ZoomParticipantModel.remove(participantId, req.userId, value);
                    if (room.zoom_meeting_id && participant.zoom_participant_id) {
                        await zoomService.removeParticipant(
                            room.zoom_meeting_id,
                            participant.zoom_participant_id
                        );
                    }
                    break;

                case 'make_cohost':
                    await ZoomParticipantModel.promoteToCoHost(participantId);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid action'
                    });
            }

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                participantId: participantId,
                eventType: `participant.${action}`,
                eventCategory: 'participant',
                description: `Participant ${action}`,
                actorUserId: req.userId,
                actorRole: 'host',
                targetUserId: participant.user_id,
                targetName: participant.display_name
            });

            res.json({
                success: true,
                message: 'Action performed successfully'
            });
        } catch (error) {
            logger.error('Error controlling participant:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to perform action'
            });
        }
    }

    /**
     * Start/stop recording
     * POST /api/zoom/recording/:roomCode
     */
    static async toggleRecording(req, res) {
        try {
            const { roomCode } = req.params;
            const { action } = req.body; // 'start' or 'stop'

            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (action === 'start') {
                await zoomService.startRecording(room.zoom_meeting_id);
                await ZoomRoomModel.update(room.id, {
                    recording_enabled: true,
                    recording_status: 'recording'
                });
            } else if (action === 'stop') {
                await zoomService.stopRecording(room.zoom_meeting_id);
                await ZoomRoomModel.update(room.id, {
                    recording_status: 'stopped'
                });
            }

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                eventType: `recording.${action}`,
                eventCategory: 'recording',
                description: `Recording ${action}ed`,
                actorUserId: room.host_user_id,
                actorRole: 'host'
            });

            res.json({
                success: true,
                message: `Recording ${action}ed successfully`
            });
        } catch (error) {
            logger.error('Error toggling recording:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to toggle recording'
            });
        }
    }

    /**
     * Get room statistics
     * GET /api/zoom/stats/:roomCode
     */
    static async getRoomStats(req, res) {
        try {
            const { roomCode } = req.params;

            const room = await ZoomRoomModel.getByRoomCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            const stats = await ZoomRoomModel.getStatistics(room.id);

            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            logger.error('Error getting room stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get statistics'
            });
        }
    }
}

module.exports = ZoomController;
