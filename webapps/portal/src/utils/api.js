const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

export async function fetchTelegramUser() {
  try {
    const response = await fetch(`${API_BASE}/telegram-auth/check`);
    if (!response.ok) {
      // If not authenticated, the backend might return a non-ok status
      // We don't want to throw an error here, just return null
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
  if (loginRef.current && window.TelegramLoginWidget) {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-bot', 'PNPtv_bot'); // Replace with your bot username
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'window.onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    loginRef.current.innerHTML = ''; // Clear existing widget if any
    loginRef.current.appendChild(script);
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
      // Optional: Redirect or update UI
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

export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
    uid: params.get('uid'),
    view: params.get('view'),
    mediaId: params.get('id'),
    role: params.get('role'),
    isPrime: params.get('prime') === 'true' || params.get('isPrime') === 'true',
  };
}
