const REMOTE_API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

const HANGOUTS_API = `${REMOTE_API}/hangouts`;

const getTelegramInitData = () => window.Telegram?.WebApp?.initData || '';

const getFetchOptions = (method = 'GET', body = null) => {
  const headers = {
    'x-telegram-init-data': getTelegramInitData(),
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return {
    method,
    headers,
    body: body ? JSON.stringify({ ...body, initData: getTelegramInitData() }) : undefined,
  };
};

const handleResponse = async (response, fallbackMessage) => {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error || fallbackMessage);
  }
  return json;
};

export async function fetchPublicRooms() {
  const response = await fetch(`${HANGOUTS_API}/public`, getFetchOptions());
  const data = await handleResponse(response, 'Failed to load rooms.');
  return data.rooms || [];
}

export async function createRoom(payload) {
  const response = await fetch(`${HANGOUTS_API}/create`, getFetchOptions('POST', payload));
  const data = await handleResponse(response, 'Failed to create room.');
  return data;
}

export async function joinRoom(callId) {
  const response = await fetch(`${HANGOUTS_API}/join/${callId}`, getFetchOptions('POST'));
  const data = await handleResponse(response, 'Failed to join room.');
  return data;
}

export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
    uid: params.get('uid'),
    room: params.get('room'),
    type: params.get('type'),
    callId: params.get('callId'),
    role: params.get('role') || '',
  };
}

export async function fetchTelegramUser() {
  try {
    const response = await fetch(`${REMOTE_API}/telegram-auth/check`, getFetchOptions());
    if (!response.ok) return null;
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
    div.setAttribute('data-auth-url', `${REMOTE_API}/webapp/auth/telegram`);
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
            auth_url: `${REMOTE_API}/webapp/auth/telegram`,
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
    const response = await fetch(`${REMOTE_API}/telegram-auth/login`, {
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
