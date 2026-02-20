const API_BASE = '/api/webapp';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

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
  authStatus: async () => {
    const res = await fetch('/api/me', {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },
  telegramLogin: (telegramUser) =>
    request('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ telegramUser })
    }),
  emailLogin: (email, password, rememberMe = false) =>
    request('/auth/email/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe })
    }),
  emailRegister: (firstName, email, password, lastName = '') =>
    request('/auth/email/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, email, password, lastName })
    }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  xLoginStart: async () => {
    window.location.assign('/api/webapp/auth/x/start?redirect=true');
    return { success: true };
  },
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Profile
  getProfile: () => request('/profile'),
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return fetch(`${API_BASE}/profile/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    }).then(r => r.json()).then(data => {
      if (!data.success) throw new Error(data.error || 'Upload failed');
      return data;
    });
  },

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
  getPublicHangouts: () => request('/webapp/hangouts/public'),
  createHangout: (data) => request('/webapp/hangouts/create', { method: 'POST', body: JSON.stringify(data) }),
  joinHangout: (callId) => request(`/webapp/hangouts/join/${callId}`, { method: 'POST' }),
  leaveHangout: (callId) => request(`/webapp/hangouts/leave/${callId}`, { method: 'POST' }),
  endHangout: (callId) => request(`/webapp/hangouts/${callId}`, { method: 'DELETE' }),

  // Social feed
  getFeed: (cursor) => request(`/social/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  getWall: (userId, cursor) => request(`/social/wall/${userId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  createPost: (data) => request('/social/posts', { method: 'POST', body: JSON.stringify(data) }),
  createPostWithMedia: (content, file) => {
    const formData = new FormData();
    formData.append('content', content);
    if (file) formData.append('media', file);
    return fetch(`${API_BASE}/social/posts/with-media`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    }).then(r => r.json()).then(data => {
      if (!data.success) throw new Error(data.error || 'Post failed');
      return data;
    });
  },
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
    return fetch(`${API_BASE}/admin/media/upload`, {
      method: 'POST',
      credentials: 'include',
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

  // Admin Role Management
  getAdminRoles: () => request('/admin/roles'),
  getAdminUsersByRole: (role, page = 1, limit = 20) => request(`/admin/users?role=${role}&page=${page}&limit=${limit}`),
  assignAdminUserRole: (userId, roleName, reason = '') => request('/admin/users/role', {
    method: 'PUT',
    body: JSON.stringify({ userId, roleName, reason })
  }),
  removeAdminUserRole: (userId, roleName) => request(`/admin/users/${userId}/role`, {
    method: 'DELETE',
    body: JSON.stringify({ userId, roleName })
  }),
  getAdminUserRoles: (userId) => request(`/admin/users/${userId}/roles`),
  getAdminPermissions: (roleName = null) => {
    let url = '/admin/permissions';
    if (roleName) url += `?roleName=${roleName}`;
    return request(url);
  },
  checkAdminPermission: (userId, permission) => request(`/admin/permissions/check?userId=${userId}&permission=${permission}`),
  getAdminAuditLogs: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return request(`/admin/audit-logs?${params.toString()}`);
  },
  getAdminAuditLogsResource: (resourceType, resourceId, limit = 50) => request(`/admin/audit-logs/resource?resourceType=${resourceType}&resourceId=${resourceId}&limit=${limit}`),
};

export const apiClient = api;

// Default export
export default api;
