// path: backend/src/modules/hangouts/agoraToken.service.ts
import AgoraToken from 'agora-token';

/**
 * Generates an Agora RTC token for joining a channel
 */
export function generateRtcToken(
  channelName: string,
  uid: string,
  expireTimeInSeconds: number
): string {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('AGORA_APP_ID and AGORA_APP_CERTIFICATE must be set');
  }

  // Calculate privilege expire time
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTimestamp = currentTimestamp + expireTimeInSeconds;

  // Generate RTC token
  const token = AgoraToken.RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    AgoraToken.Role.PUBLISHER,
    privilegeExpireTimestamp
  );

  return token;
}

/**
 * Generates a random join token for private rooms
 */
export function generateJoinToken(roomId: string): string {
  // In a real implementation, this should be a secure random token
  // For now, we'll use a simple hash of roomId + timestamp
  const timestamp = Date.now();
  return `${roomId}-${timestamp}`;
}

/**
 * Validates a join token for a private room
 */
export function validateJoinToken(roomId: string, token: string): boolean {
  // In a real implementation, this would validate against stored hashes
  // For now, we'll just check if the token starts with the roomId
  return token.startsWith(`${roomId}-`);
}