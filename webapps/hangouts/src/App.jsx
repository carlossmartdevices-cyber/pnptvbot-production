import { Suspense, lazy, useEffect, useMemo, useState, useRef } from 'react';
import Header from './components/Header';
import Lobby from './components/Lobby';
import { getUrlParams } from './utils/api';
// import { getTelegramUser, initTelegramWebApp } from './utils/telegram'; // Will adapt this

const CallRoom = lazy(() => import('./components/CallRoom'));

function App() {
  const params = useMemo(() => getQueryParams(), []);
  const roleParam = (params.role || '').toUpperCase();
  const [telegramUser, setTelegramUser] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const loginRef = useRef(null);

  useEffect(() => {
    const TELEGRAM_BOT = 'pnplatinotv_bot' // TODO: Make this configurable
    window.onTelegramAuth = async (user) => {
      if (!user) return
      setAuthLoading(true)
      setAuthMessage('Authenticating...')
      try {
        const response = await fetch('/api/telegram-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramUser: user }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Telegram authentication failed')
        }
        setTelegramUser({
          id: user.id,
          username: user.username,
          name: user.first_name,
          subscriptionStatus: data.user?.subscriptionStatus || 'free',
        })
        setAuthMessage('Welcome ' + (user.username || user.first_name || 'PNPtv user'))
      } catch (err) {
        setAuthMessage(err.message)
      } finally {
        setAuthLoading(false)
      }
    }

    if (!loginRef.current) return
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', TELEGRAM_BOT)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    loginRef.current.appendChild(script)
    
    return () => {
      script.remove()
    }
  }, []);

  function handleLogout() {
    setTelegramUser(null);
    setAuthMessage('');
  }

  const isCallMode = Boolean(params.room && params.token && params.uid);

  if (isCallMode) {
    return (
      <div className="app">
        <Header 
          title="PNPtv Hangouts" 
          subtitle="Video Calls" 
          telegramUser={telegramUser} 
          onLogout={handleLogout} 
          loginRef={loginRef} 
        />
        <Suspense
          fallback={
            <div className="loading">
              <div className="spinner" />
              <div className="muted">Loading call...</div>
            </div>
          }
        >
          <CallRoom params={params} telegramUser={telegramUser} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <Header 
        title="PNPtv Hangouts" 
        subtitle="Video Calls" 
        telegramUser={telegramUser} 
        onLogout={handleLogout} 
        loginRef={loginRef} 
      />
      <Lobby telegramUser={telegramUser} role={roleParam} />
    </div>
  );
}

export default App;
