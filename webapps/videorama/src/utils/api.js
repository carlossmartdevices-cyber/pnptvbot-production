// API utilities for Videorama
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

export async function fetchMediaLibrary(type = 'all', category = null) {
  try {
    let url = `${API_BASE}/media/library?type=${type}`;
    if (category) url += `&category=${category}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch media');
    return await response.json();
  } catch (error) {
    console.error('Error fetching media library:', error);
    return [];
  }
}

export async function fetchPlaylists() {
  try {
    const response = await fetch(`${API_BASE}/media/playlists`);
    if (!response.ok) throw new Error('Failed to fetch playlists');
    return await response.json();
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return [];
  }
}

export async function fetchRadioNowPlaying() {
  try {
    const response = await fetch(`${API_BASE}/radio/now-playing`);
    if (!response.ok) throw new Error('Failed to fetch now playing');
    return await response.json();
  } catch (error) {
    console.error('Error fetching radio now playing:', error);
    return null;
  }
}

export async function fetchRadioHistory(limit = 20) {
  try {
    const response = await fetch(`${API_BASE}/radio/history?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch radio history');
    return await response.json();
  } catch (error) {
    console.error('Error fetching radio history:', error);
    return [];
  }
}

export async function fetchRadioSchedule() {
  try {
    const response = await fetch(`${API_BASE}/radio/schedule`);
    if (!response.ok) throw new Error('Failed to fetch radio schedule');
    return await response.json();
  } catch (error) {
    console.error('Error fetching radio schedule:', error);
    return [];
  }
}

export async function requestRadioSong(userId, songName, artist) {
  try {
    const response = await fetch(`${API_BASE}/radio/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, songName, artist }),
    });
    if (!response.ok) throw new Error('Failed to submit request');
    return await response.json();
  } catch (error) {
    console.error('Error submitting song request:', error);
    throw error;
  }
}

export async function fetchRadioQueue() {
  try {
    const response = await fetch(`${API_BASE}/admin/radio/queue`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch radio queue');
    const data = await response.json();
    return Array.isArray(data) ? data : data.queue || [];
  } catch (error) {
    console.error('Error fetching radio queue:', error);
    return [];
  }
}

export async function fetchRadioRequests(status = 'pending') {
  try {
    const response = await fetch(`${API_BASE}/admin/radio/requests?status=${status}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch requests');
    const data = await response.json();
    return Array.isArray(data) ? data : data.requests || [];
  } catch (error) {
    console.error('Error fetching radio requests:', error);
    return [];
  }
}

// Featured Content APIs
export async function fetchLatestPrimeVideo() {
  try {
    const response = await fetch(`${API_BASE}/media/library?type=video&limit=50`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    const videos = Array.isArray(data) ? data : data.data || [];
    // Return first prime video found
    return videos.find(v => v.is_prime) || null;
  } catch (error) {
    console.error('Error fetching prime video:', error);
    return null;
  }
}

export async function fetchLatestVideoramaVideo() {
  try {
    const response = await fetch(`${API_BASE}/media/library?type=video&limit=50`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    const videos = Array.isArray(data) ? data : data.data || [];
    // Return first non-prime video
    return videos.find(v => !v.is_prime) || videos[0] || null;
  } catch (error) {
    console.error('Error fetching videorama video:', error);
    return null;
  }
}

export async function fetchActiveLiveStreams() {
  try {
    const response = await fetch(`${API_BASE}/webapp/live/streams`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    // Return first active stream
    return Array.isArray(data) ? data[0] : data.streams?.[0] || null;
  } catch (error) {
    console.error('Error fetching live streams:', error);
    return null;
  }
}

export async function fetchMostActiveHangout() {
  try {
    const response = await fetch(`${API_BASE}/webapp/hangouts/public`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    const hangouts = Array.isArray(data) ? data : data.hangouts || [];
    // Sort by member count and return first
    return hangouts.sort((a, b) => (b.members_count || 0) - (a.members_count || 0))[0] || null;
  } catch (error) {
    console.error('Error fetching hangouts:', error);
    return null;
  }
}

export async function fetchCategories() {
  try {
    const response = await fetch(`${API_BASE}/media/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return ['music', 'podcast', 'videos', 'live'];
  }
}

export async function fetchCollections() {
  try {
    const response = await fetch(`${API_BASE}/videorama/collections`);
    if (!response.ok) throw new Error('Failed to fetch collections');
    const data = await response.json();
    return data.collections || []
  } catch (error) {
    console.error('Error fetching videorama collections:', error);
    return [];
  }
}

export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
    uid: params.get('uid'),
    view: params.get('view') || 'home',
    mediaId: params.get('id'),
    role: params.get('role') || '',
    isPrime: params.get('prime') === 'true' || params.get('isPrime') === 'true',
  };
}

export async function fetchTelegramUser() {
  try {
    const response = await fetch(`${API_BASE}/telegram-auth/check`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error fetching Telegram user:', error);
    return null;
  }
}

export function initTelegramLogin(loginRef) {
  if (loginRef.current) {
    loginRef.current.innerHTML = ''; // Clear existing widget if any
    const div = document.createElement('div');
    div.setAttribute('id', 'telegram-login-widget');
    div.setAttribute('data-telegram-login', 'PNPtv_bot');
    div.setAttribute('data-size', 'large');
    div.setAttribute('data-auth-url', `${API_BASE}/webapp/auth/telegram`);
    div.setAttribute('data-request-access', 'write');
    loginRef.current.appendChild(div);

    // Load the Telegram widget script
    if (!window.TelegramLoginWidget) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.onload = () => {
        if (window.Telegram?.Login?.embed) {
          window.Telegram.Login.embed('telegram-login-widget', {
            bot_id: 'PNPtv_bot',
            size: 'large',
            auth_url: `${API_BASE}/webapp/auth/telegram`,
            request_access: 'write',
          });
        }
      };
      document.head.appendChild(script);
    }
  }
}

export async function handleTelegramAuth(telegramUser, setUser, setLoading, setError) {
  setLoading(true);
  try {
    const response = await fetch(`${API_BASE}/telegram-auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramUser),
    });

    const data = await response.json();

    if (data.success) {
      setUser(data.user);
    } else {
      setError(data.message || 'Telegram login failed.');
    }
  } catch (err) {
    console.error('Error during Telegram auth:', err);
    setError('Network error during Telegram login.');
  } finally {
    setLoading(false);
  }
}