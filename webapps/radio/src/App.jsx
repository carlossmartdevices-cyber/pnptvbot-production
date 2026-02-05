import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import RadioPlayer from './components/RadioPlayer'
import {
  getUrlParams,
  fetchRadioNowPlaying,
  fetchTelegramUser,
  initTelegramLogin,
  handleTelegramAuth,
} from './utils/api'

function App() {
  const [params, setParams] = useState(null)
  const [radioNowPlaying, setRadioNowPlaying] = useState(null)
  const [error, setError] = useState(null)
  const [telegramUser, setTelegramUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)

    loadRadioStatus()

    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000)

    window.onTelegramAuth = (user) => {
      handleTelegramAuth(user, setTelegramUser, setAuthLoading, setError);
    };

    const initializeUser = async () => {
      setAuthLoading(true);
      try {
        const currentUser = await fetchTelegramUser();
        if (currentUser) {
          setTelegramUser(currentUser);
        } else {
          initTelegramLogin(loginRef);
        }
      } catch (err) {
        setError(err.message);
        initTelegramLogin(loginRef);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeUser();
    
    return () => {
      clearInterval(radioInterval)
    }
  }, [])

  async function loadRadioStatus() {
    try {
      const nowPlaying = await fetchRadioNowPlaying()
      setRadioNowPlaying(nowPlaying)
    } catch (error) {
      console.error('Failed to load radio status:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setTelegramUser(null);
      initTelegramLogin(loginRef); // Re-initialize login widget after logout
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out.');
    }
  };

  return (
    <>
      <Header
        title="PNPtv Radio"
        subtitle="24/7 Live Music"
        telegramUser={telegramUser}
        onLogout={handleLogout}
        loginRef={loginRef}
      />
      {authLoading ? (
        <div className="loading-state">
          <div className="spinner-lg" />
          <p className="text-muted-foreground mt-4">Authenticating...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <RadioPlayer nowPlaying={radioNowPlaying} />
      )}
    </>
  )
}

export default App