import { useEffect, useRef } from 'react';
import { initTelegramLogin } from '../utils/api';

const LoginPage = ({ onAuthSuccess, authLoading }) => {
  const loginRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      initTelegramLogin(loginRef);
    }
  }, [authLoading]);

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">PNPtv Live</h1>
        <p className="login-subtitle">Log in with Telegram to continue</p>
        {authLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : (
          <div ref={loginRef} className="telegram-login-widget"></div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
