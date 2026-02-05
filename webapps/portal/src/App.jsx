import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import CategoryNav from './components/CategoryNav';
import LoginPage from './components/LoginPage'; // Import LoginPage
import { fetchTelegramUser, initTelegramLogin, handleTelegramAuth } from './utils/api';
import './App.css'; // Assume App.css exists for specific layout/components not in design-system

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // Renamed from 'loading'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const loginRef = useRef(null);

  useEffect(() => {
    // Expose handleTelegramAuth to the window object for the Telegram widget
    window.onTelegramAuth = async (telegramUser) => {
      await handleTelegramAuth(telegramUser, setUser, setAuthLoading, setError); // Use setAuthLoading
      setIsAuthenticated(true);
    };

    const initializeUser = async () => {
      setAuthLoading(true); // Use setAuthLoading
      try {
        const currentUser = await fetchTelegramUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setError(err.message);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false); // Use setAuthLoading
      }
    };

    initializeUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out.');
    }
  };

  if (authLoading) { // Use authLoading here
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="spinner-lg"></div>
        <p className="text-muted-foreground mt-4">Loading portal...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthSuccess={() => setIsAuthenticated(true)} authLoading={authLoading} />; // Use authLoading here
  }

  return (
    <div className="App">
      <Header
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <CategoryNav />
        <section className="portal-main-section">
          <h2>PNPtv Unified Portal</h2>
          <p className="text-muted-foreground">Hangouts, Videorama, and Live — synced by Telegram.</p>
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
