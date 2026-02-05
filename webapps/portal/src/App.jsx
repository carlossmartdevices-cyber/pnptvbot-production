import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import CategoryNav from './components/CategoryNav';
import { fetchTelegramUser, getQueryParams, initTelegramLogin, handleTelegramAuth } from './utils/api';
import './App.css'; // Assume App.css exists for specific layout/components not in design-system

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loginRef = useRef(null);

  useEffect(() => {
    // Expose handleTelegramAuth to the window object for the Telegram widget
    window.onTelegramAuth = (telegramUser) => {
      handleTelegramAuth(telegramUser, setUser, setLoading, setError);
    };

    const initializeUser = async () => {
      setLoading(true);
      try {
        const currentUser = await fetchTelegramUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // If no user, initialize Telegram login widget
          initTelegramLogin(loginRef);
        }
      } catch (err) {
        setError(err.message);
        initTelegramLogin(loginRef); // Still try to init login on error
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setUser(null);
      // Re-initialize Telegram login widget after logout
      initTelegramLogin(loginRef);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out.');
    }
  };

  if (loading) {
    return <div className="loading">Loading portal...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="App">
      <Header user={user} onLogout={handleLogout} loginRef={loginRef} />
      <main className="main-content">
        <CategoryNav />
        <section className="portal-main-section">
          <h2>Welcome to the PNPtv Portal!</h2>
          {user ? (
            <p>Hello, {user.first_name}! Explore our live content, radio, and hangouts.</p>
          ) : (
            <p>Please log in with Telegram to access exclusive content and features.</p>
          )}
          {/* Add more portal-specific content here */}
        </section>
      </main>
    </div>
  );
}

export default App;
