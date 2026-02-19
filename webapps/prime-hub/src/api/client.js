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
  xLoginStart: () => request('/auth/x/start'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Profile
  getProfile: () => request('/profile'),

  // Mastodon feed
  getMastodonFeed: (limit = 10) => request(`/mastodon/feed?limit=${limit}`),

  // Media library (existing API)
  getMediaLibrary: (type = 'all', limit = 50) =>
    fetch(`/api/media/library?type=${type}&limit=${limit}`, { credentials: 'include' }).then(r => r.json()),

  // Radio
  getRadioNowPlaying: () =>
    fetch('/api/radio/now-playing', { credentials: 'include' }).then(r => r.json()),

  // Hangouts
  getPublicHangouts: () =>
    fetch('/api/hangouts/public', { credentials: 'include' }).then(r => r.json()),
};
