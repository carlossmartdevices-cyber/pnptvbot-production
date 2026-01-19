// path: backend/src/modules/hangouts/hangouts.controller.ts
import { Request, Response } from 'express';
import {
  createRoom,
  getPublicRooms,
  getRoomById,
  joinRoom,
  canUserJoinRoom
} from './hangouts.service';
import { can } from '../../rbac/rbac';

export const getPublicRoomsController = async (req: Request, res: Response) => {
  try {
    const rooms = await getPublicRooms('OPEN');
    res.json(rooms);
  } catch (error) {
    console.error('Get public rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRoomController = async (req: Request, res: Response) => {
  try {
    const { title, visibility } = req.body;
    const userId = req.user!.id;

    // Check permission
    if (!can(req.user!.role as any, 'hangouts.create')) {
      return res.status(403).json({ error: 'Not authorized to create rooms' });
    }

    const room = await createRoom({
      title,
      visibility,
      hostId: userId
    });

    // Generate join link with token for private rooms
    let joinLink = null;
    if (visibility === 'PRIVATE') {
      // In a real implementation, we would generate a secure token and store its hash
      const joinToken = `private-${room.id}-${Date.now()}`;
      joinLink = `${process.env.FRONTEND_URL}/hangouts/room/${room.id}?token=${joinToken}`;
    }

    res.json({
      room,
      joinLink
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinRoomController = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { joinToken } = req.body;
    const userId = req.user!.id;

    const room = await getRoomById(roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user can join this room
    const canJoin = await canUserJoinRoom(
      req.user!.role,
      room.visibility,
      userId,
      room.hostId
    );

    if (!canJoin) {
      return res.status(403).json({ error: 'Not authorized to join this room' });
    }

    // Join the room and get Agora credentials
    const result = await joinRoom(roomId, userId, joinToken);

    res.json(result);
  } catch (error) {
    console.error('Join room error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Join token required')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Invalid join token')) {
        return res.status(403).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRoomController = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await getRoomById(roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};