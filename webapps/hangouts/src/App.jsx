import { Suspense, lazy, useEffect, useMemo, useState, useRef } from 'react';
import Header from './components/Header';
import Lobby from './components/Lobby';
import LoginPage from './components/LoginPage'; // Import LoginPage
import { getUrlParams, fetchTelegramUser, initTelegramLogin, handleTelegramAuth } from './utils/api';

const CallRoom = lazy(() => import('./components/CallRoom'));

function App() {
  const params = useMemo(() => getUrlParams(), []);
  const roleParam = (params.role || '').toUpperCase();
  const [telegramUser, setTelegramUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // Set to true initially
  const [isAuthenticated, setIsAuthenticated] = useState(false); // New state
  const [error, setError] = useState(null); // Add error state
  const loginRef = useRef(null);

  useEffect(() => {
    // Initial Telegram auth check
    const initializeUser = async () => {
      setAuthLoading(true);
      try {
        const currentUser = await fetchTelegramUser();
        if (currentUser) {
          setTelegramUser(currentUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setError(err.message); // Use setError here
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeUser();

    // Setup Telegram auth callback
    window.onTelegramAuth = async (user) => {
      await handleTelegramAuth(user, setTelegramUser, setAuthLoading, setError); // Use setError here
      setIsAuthenticated(true); // Set authenticated on successful login
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setTelegramUser(null);
      setIsAuthenticated(false); // Reset authenticated on logout
    } catch (err) {
      console.error('Logout failed:', err);
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

  const isCallMode = Boolean(params.room && params.token && params.uid);

  if (isCallMode) {
    return (
      <>
        <Header 
          title="PNPtv Hangouts"
          telegramUser={telegramUser} 
          onLogout={handleLogout} 
        />
        <Suspense
          fallback={
            <div className="loading-state">
              <div className="spinner-lg" />
              <div className="text-muted-foreground mt-4">Loading call...</div>
            </div>
          }
        >
          <CallRoom params={params} telegramUser={telegramUser} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <Header 
        title="PNPtv Hangouts" 
        subtitle="Video Calls" 
        telegramUser={telegramUser} 
        onLogout={handleLogout} 
      />
      <Lobby telegramUser={telegramUser} role={roleParam} />
    </>
  );
}

export default App;