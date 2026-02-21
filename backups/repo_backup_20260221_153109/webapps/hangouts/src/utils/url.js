export const getQueryParams = () => {
  const params = new URLSearchParams(window.location.search || '');
  return {
    room: params.get('room'),
    token: params.get('token'),
    uid: params.get('uid'),
    username: params.get('username') || 'Anonymous',
    type: params.get('type') || 'private',
    appId: params.get('appId') || '',
    callId: params.get('callId') || '',
  };
};

export const buildHangoutsUrl = ({
  baseUrl = '/hangouts/',
  room,
  token,
  uid,
  username,
  type,
  appId,
  callId,
} = {}) => {
  const url = new URL(baseUrl, window.location.origin);

  if (room) url.searchParams.set('room', room);
  if (token) url.searchParams.set('token', token);
  if (uid) url.searchParams.set('uid', String(uid));
  if (username) url.searchParams.set('username', username);
  if (type) url.searchParams.set('type', type);
  if (appId) url.searchParams.set('appId', appId);
  if (callId) url.searchParams.set('callId', callId);

  return url.pathname + (url.search || '');
};

export const stripQueryParams = () => {
  if (window.history?.replaceState) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
};
