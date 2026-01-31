import { getTelegramUser } from './telegram';

const jsonHeaders = (initData) => {
  const headers = { 'Content-Type': 'application/json' };
  if (initData) headers['x-telegram-init-data'] = initData;
  return headers;
};

export const fetchPublicRooms = async () => {
  const response = await fetch('/api/hangouts/public', { method: 'GET' });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load rooms');
  }
  return data.rooms || [];
};

export const createRoom = async ({
  title,
  maxParticipants,
  isPublic,
  enforceCamera,
  allowGuests,
} = {}) => {
  const telegramUser = getTelegramUser();
  const payload = {
    title,
    maxParticipants,
    isPublic,
    enforceCamera,
    allowGuests,
    creatorId: telegramUser?.id,
    creatorName: telegramUser?.displayName,
    initData: telegramUser?.initData,
  };

  const response = await fetch('/api/hangouts/create', {
    method: 'POST',
    headers: jsonHeaders(telegramUser?.initData),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to create room');
  }
  return data;
};

export const joinRoom = async (callId) => {
  const telegramUser = getTelegramUser();
  const response = await fetch(`/api/hangouts/join/${encodeURIComponent(callId)}`, {
    method: 'POST',
    headers: jsonHeaders(telegramUser?.initData),
    body: JSON.stringify({
      userId: telegramUser?.id,
      userName: telegramUser?.displayName,
      initData: telegramUser?.initData,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to join room');
  }
  return data;
};
