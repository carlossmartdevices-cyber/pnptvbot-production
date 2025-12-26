const VideoCallModel = require('../../../models/videoCallModel');
const logger = require('../../../utils/logger');

/**
 * Create a new hangout room
 * POST /api/hangouts/create
 */
const createHangout = async (req, res) => {
  try {
    const {
      creatorId,
      creatorName,
      title,
      description,
      maxParticipants = 10,
      isPublic = false,
      allowGuests = true,
      enforceCamera = false,
    } = req.body;

    // Validate required fields
    if (!creatorId || !creatorName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: creatorId, creatorName'
      });
    }

    // Create the video call/hangout
    const hangout = await VideoCallModel.create({
      creatorId,
      creatorName,
      title: title || `${creatorName}'s Hangout`,
      maxParticipants,
      enforceCamera,
      allowGuests,
      isPublic,
      recordingEnabled: false,
    });

    logger.info('Hangout created', {
      hangoutId: hangout.id,
      creatorId,
      creatorName,
      isPublic,
    });

    res.json({
      success: true,
      id: hangout.id,
      channelName: hangout.channelName,
      title: hangout.title,
      maxParticipants: hangout.maxParticipants,
      isPublic: hangout.isPublic,
      createdAt: hangout.createdAt,
      token: hangout.token,
      room: hangout.room,
      uid: hangout.uid,
    });

  } catch (error) {
    logger.error('Error creating hangout:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create hangout'
    });
  }
};

/**
 * Get all public hangout rooms
 * GET /api/hangouts/public
 */
const getPublicHangouts = async (req, res) => {
  try {
    const rooms = await VideoCallModel.getAllPublic();

    res.json({
      success: true,
      rooms: (rooms || []).map(room => ({
        id: room.id,
        title: room.title,
        creatorName: room.creatorName,
        creatorId: room.creatorId,
        channelName: room.channelName,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants || 0,
        isActive: room.isActive,
        createdAt: room.createdAt,
      })),
      count: (rooms || []).length,
    });

  } catch (error) {
    logger.error('Error fetching public hangouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public hangouts'
    });
  }
};

/**
 * Get user's hangout rooms
 * GET /api/hangouts/my-rooms?userId=xxx
 */
const getMyHangouts = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
    }

    const rooms = await VideoCallModel.getActiveByCreator(userId);

    res.json({
      success: true,
      rooms: (rooms || []).map(room => ({
        id: room.id,
        title: room.title,
        creatorName: room.creatorName,
        channelName: room.channelName,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants || 0,
        isActive: room.isActive,
        isPublic: room.isPublic,
        createdAt: room.createdAt,
      })),
      count: (rooms || []).length,
    });

  } catch (error) {
    logger.error('Error fetching user hangouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your hangouts'
    });
  }
};

/**
 * Join a hangout room
 * POST /api/hangouts/join/:roomId
 */
const joinHangout = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, userName } = req.body;

    if (!roomId || !userId || !userName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Join the room
    const result = await VideoCallModel.joinCall(roomId, userId, userName, false);

    logger.info('User joined hangout', {
      roomId,
      userId,
      userName,
    });

    res.json({
      success: true,
      roomId: result.call.id,
      channelName: result.call.channelName,
      token: result.token,
      uid: result.uid,
      room: result.room,
    });

  } catch (error) {
    logger.error('Error joining hangout:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join hangout'
    });
  }
};

/**
 * End a hangout room
 * POST /api/hangouts/end/:roomId
 */
const endHangout = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify user is the creator
    const room = await VideoCallModel.getById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    if (room.creatorId !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Only the room creator can end the room'
      });
    }

    // End the room
    await VideoCallModel.endCall(roomId, userId);

    logger.info('Hangout ended', {
      roomId,
      userId,
    });

    res.json({
      success: true,
      message: 'Hangout ended'
    });

  } catch (error) {
    logger.error('Error ending hangout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end hangout'
    });
  }
};

/**
 * Get hangout room details
 * GET /api/hangouts/:roomId
 */
const getHangoutDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await VideoCallModel.getById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        title: room.title,
        creatorName: room.creatorName,
        channelName: room.channelName,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants || 0,
        isActive: room.isActive,
        isPublic: room.isPublic,
        createdAt: room.createdAt,
      }
    });

  } catch (error) {
    logger.error('Error fetching hangout details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hangout details'
    });
  }
};

module.exports = {
  createHangout,
  getPublicHangouts,
  getMyHangouts,
  joinHangout,
  endHangout,
  getHangoutDetails,
};
