import React, { useEffect, useRef } from 'react';
import { initTelegramLogin } from '../utils/api';
import '../../../design-system/styles.css';

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
        <h1 className="login-title">Welcome to PNPtv Radio</h1>
        <p className="login-subtitle">Please log in with Telegram to continue.</p>
        {authLoading ? (
          <div className="flex items-center justify-center p-4">
            <div className="spinner-sm"></div>
            <p className="text-muted-foreground ml-2">Checking authentication...</p>
          </div>
        ) : (
          <div ref={loginRef} className="telegram-login-widget"></div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;