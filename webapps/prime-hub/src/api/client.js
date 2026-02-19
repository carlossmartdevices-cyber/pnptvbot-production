const API_BASE = '/api/webapp';

// Store JWT token for API requests
let authToken = null;

function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('pnptv_token', token);
  } else {
    localStorage.removeItem('pnptv_token');
  }
}

function getAuthToken() {
  return authToken || localStorage.getItem('pnptv_token');
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add JWT token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    headers,
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
    }).then(res => {
      if (res.token) {
        setAuthToken(res.token);
      }
      return res;
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
  logout: () => {
    setAuthToken(null);
    return request('/auth/logout', { method: 'POST' });
  },

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

  // Radio (public endpoint — no /api/webapp prefix)
  getRadioNowPlaying: () => fetch('/api/radio/now-playing', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),

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

  // Admin
  getAdminStats: () => request('/admin/stats'),
  listAdminUsers: (page, search) => request(`/admin/users?page=${page}&search=${encodeURIComponent(search || '')}`),
  getAdminUser: (id) => request(`/admin/users/${id}`),
  updateAdminUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  banAdminUser: (id, ban, reason) => request(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ ban, reason }) }),
  listAdminPosts: (page) => request(`/admin/posts?page=${page}`),
  deleteAdminPost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
  listAdminHangouts: () => request('/admin/hangouts'),
  endAdminHangout: (id) => request(`/admin/hangouts/${id}`, { method: 'DELETE' }),

  // Live streaming
  getLiveStreams: () => request('/live/streams'),
  startLiveStream: (data) => request('/live/start', { method: 'POST', body: JSON.stringify(data) }),
  joinLiveStream: (streamId) => request(`/live/streams/${streamId}/join`),
  endLiveStream: (streamId) => request(`/live/streams/${streamId}/end`, { method: 'POST' }),
  leaveLiveStream: (streamId) => request(`/live/streams/${streamId}/leave`, { method: 'POST' }),

  // Admin Media Management
  getAdminMedia: (query = '') => {
    const url = `/admin/media/library${query}`;
    return request(url);
  },
  getAdminMediaCategories: () => request('/admin/media/categories'),
  uploadAdminMedia: (formData) => {
    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/admin/media/upload`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData
    }).then(r => r.json()).then(data => {
      if (!data.success && !data.media) {
        throw new Error(data.error || 'Upload failed');
      }
      return data;
    });
  },
  updateAdminMedia: (mediaId, data) => request(`/admin/media/${mediaId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminMedia: (mediaId) => request(`/admin/media/${mediaId}`, { method: 'DELETE' }),

  // Admin Radio Management
  getAdminRadioNowPlaying: () => request('/admin/radio/now-playing'),
  setAdminRadioNowPlaying: (data) => request('/admin/radio/now-playing', { method: 'POST', body: JSON.stringify(data) }),
  getAdminRadioQueue: () => request('/admin/radio/queue'),
  addAdminRadioQueue: (data) => request('/admin/radio/queue', { method: 'POST', body: JSON.stringify(data) }),
  removeAdminRadioQueue: (queueId) => request(`/admin/radio/queue/${queueId}`, { method: 'DELETE' }),
  clearAdminRadioQueue: () => request('/admin/radio/queue/clear', { method: 'POST' }),
  getAdminRadioRequests: (status = 'pending') => request(`/admin/radio/requests?status=${status}`),
  updateAdminRadioRequest: (requestId, data) => request(`/admin/radio/requests/${requestId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Export token management functions
export { setAuthToken, getAuthToken };

// Default export
export default api;
