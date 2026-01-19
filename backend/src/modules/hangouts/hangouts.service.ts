// path: backend/src/modules/hangouts/hangouts.service.ts
import { PrismaClient } from '@prisma/client';
import { generateJoinToken, generateRtcToken } from './agoraToken.service';
import { can } from '../../rbac/rbac';

const prisma = new PrismaClient();

export interface CreateRoomData {
  title: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  hostId: string;
  status?: 'OPEN' | 'CLOSED';
}

export async function createRoom(data: CreateRoomData) {
  // Generate a unique channel name
  const channelName = `room-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Create room in database
  const room = await prisma.room.create({
    data: {
      title: data.title,
      visibility: data.visibility,
      status: data.status || 'OPEN',
      hostId: data.hostId,
      channelName,
      joinTokenHash: data.visibility === 'PRIVATE' ? generateJoinToken(data.hostId) : null
    }
  });

  return room;
}

export async function getPublicRooms(status: 'OPEN' | 'CLOSED' = 'OPEN') {
  return prisma.room.findMany({
    where: {
      visibility: 'PUBLIC',
      status
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

export async function getRoomById(roomId: string) {
  return prisma.room.findUnique({
    where: { id: roomId }
  });
}

export async function getRoomsByHost(hostId: string) {
  return prisma.room.findMany({
    where: { hostId }
  });
}

export async function joinRoom(
  roomId: string,
  userId: string,
  joinToken?: string
) {
  const room = await getRoomById(roomId);
  
  if (!room) {
    throw new Error('Room not found');
  }

  // Check visibility and permissions
  if (room.visibility === 'PRIVATE') {
    if (!joinToken) {
      throw new Error('Join token required for private room');
    }

    // Validate join token
    if (!validateJoinToken(roomId, joinToken)) {
      throw new Error('Invalid join token');
    }
  }

  // Generate Agora RTC token
  const rtcToken = generateRtcToken(
    room.channelName,
    userId,
    Number(process.env.AGORA_TOKEN_TTL_SECONDS || 1800)
  );

  return {
    room,
    agora: {
      appId: process.env.AGORA_APP_ID,
      channelName: room.channelName,
      uid: userId,
      rtcToken,
      expiresAt: new Date(Date.now() + Number(process.env.AGORA_TOKEN_TTL_SECONDS || 1800) * 1000)
    }
  };
}

export async function validateJoinToken(roomId: string, token: string): Promise<boolean> {
  // In a real implementation, this would check against stored hash
  // For now, we'll use the simple validation
  return token.startsWith(`${roomId}-`);
}

export async function canUserJoinRoom(
  userRole: string,
  roomVisibility: 'PUBLIC' | 'PRIVATE',
  userId: string,
  hostId: string
): Promise<boolean> {
  if (roomVisibility === 'PUBLIC') {
    return can(userRole as any, 'hangouts.joinPublic');
  } else {
    // For private rooms, user must have joinPrivate permission
    // OR be the host
    return can(userRole as any, 'hangouts.joinPrivate') || userId === hostId;
  }
}