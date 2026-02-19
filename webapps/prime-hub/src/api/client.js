const API_BASE = '/api/webapp';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  // Auth
  authStatus: () => request('/auth/status'),
  telegramLogin: (telegramUser) =>
    request('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ telegramUser })
    }),
  emailLogin: (email, password, rememberMe = false) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe })
    }),
  emailRegister: (firstName, email, password, lastName = '') =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, email, password, lastName })
    }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  xLoginStart: () => request('/auth/x/start'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Profile
  getProfile: () => request('/profile'),
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Nearby
  nearbyUpdateLocation: (lat, lng, accuracy) =>
    request('/nearby/update-location', { method: 'POST', body: JSON.stringify({ latitude: lat, longitude: lng, accuracy }) }),
  nearbySearch: (lat, lng, radius = 5) =>
    request(`/nearby/search?latitude=${lat}&longitude=${lng}&radius=${radius}&limit=30`),

  // Mastodon feed
  getMastodonFeed: (limit = 10) => request(`/mastodon/feed?limit=${limit}`),

  // Media library (existing API)
  getMediaLibrary: (type = 'all', limit = 50) =>
    fetch(`/api/media/library?type=${type}&limit=${limit}`, { credentials: 'include' }).then(r => r.json()),

  // Radio
  getRadioNowPlaying: () => request('/radio/now-playing').catch(() => ({})),

  // Hangouts
  getPublicHangouts: () => request('/hangouts/public'),
  createHangout: (data) => request('/hangouts/create', { method: 'POST', body: JSON.stringify(data) }),
  joinHangout: (callId) => request(`/hangouts/join/${callId}`, { method: 'POST' }),
  leaveHangout: (callId) => request(`/hangouts/leave/${callId}`, { method: 'POST' }),
  endHangout: (callId) => request(`/hangouts/${callId}`, { method: 'DELETE' }),

  // Social feed
  getFeed: (cursor) => request(`/social/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  getWall: (userId, cursor) => request(`/social/wall/${userId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  createPost: (data) => request('/social/posts', { method: 'POST', body: JSON.stringify(data) }),
  toggleLike: (postId) => request(`/social/posts/${postId}/like`, { method: 'POST' }),
  deletePost: (postId) => request(`/social/posts/${postId}`, { method: 'DELETE' }),
  getReplies: (postId, cursor) => request(`/social/posts/${postId}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  // DM
  getDMThreads: () => request('/dm/threads'),
  getConversation: (partnerId, cursor) => request(`/dm/conversation/${partnerId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  getDMPartnerInfo: (partnerId) => request(`/dm/user/${partnerId}`),
  sendDMRest: (recipientId, content) => request(`/dm/send/${recipientId}`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Chat
  getChatHistory: (room = 'general') => request(`/chat/${room}/history`),
  sendChatRest: (room = 'general', content) => request(`/chat/${room}/send`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Users
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
};
