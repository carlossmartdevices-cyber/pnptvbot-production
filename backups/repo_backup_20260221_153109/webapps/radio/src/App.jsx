import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import RadioPlayer from './components/RadioPlayer'
import LoginPage from './components/LoginPage' // Import LoginPage
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
  const [authLoading, setAuthLoading] = useState(true) // Set to true initially
  const [isAuthenticated, setIsAuthenticated] = useState(false) // New state
  const loginRef = useRef(null)

  useEffect(() => {
    const urlParams = getUrlParams()
    setParams(urlParams)

    // Initial Telegram auth check
    const initializeUser = async () => {
      setAuthLoading(true)
      try {
        const currentUser = await fetchTelegramUser()
        if (currentUser) {
          setTelegramUser(currentUser)
          setIsAuthenticated(true)
          loadRadioStatus()
        } else {
          setIsAuthenticated(false)
        }
      } catch (err) {
        setError(err.message)
        setIsAuthenticated(false)
      } finally {
        setAuthLoading(false)
      }
    }

    initializeUser()

    // Setup Telegram auth callback
    window.onTelegramAuth = async (user) => {
      await handleTelegramAuth(user, setTelegramUser, setAuthLoading, setError);
      setIsAuthenticated(true); // Set authenticated on successful login
      loadRadioStatus();
    };

    // Refresh radio status periodically
    const radioInterval = setInterval(loadRadioStatus, 30000);

    return () => {
      clearInterval(radioInterval)
    }
  }, [isAuthenticated]) // Re-run effect when authentication status changes

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
      setIsAuthenticated(false); // Reset authenticated on logout
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="spinner-lg"></div>
        <p className="text-muted-foreground mt-4">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthSuccess={() => setIsAuthenticated(true)} authLoading={authLoading} />;
  }

  return (
    <>
      <Header
        title="PNPtv Radio"
        subtitle="24/7 Live Music"
        telegramUser={telegramUser}
        onLogout={handleLogout}
      />
      {error ? (
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