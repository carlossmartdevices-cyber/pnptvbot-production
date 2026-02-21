import { useEffect, useRef } from 'react';
import { initTelegramLogin } from '../utils/api';

const LoginPage = ({ onAuthSuccess, authLoading }) => {
  const loginRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      initTelegramLogin(loginRef);
    }
  }, [authLoading]);

  const handleLoginRedirect = () => {
    // Redirect to PRIME Hub login page which supports all auth methods
    window.location.href = '/prime-hub/';
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">PNPtv Live</h1>
        <p className="login-subtitle">Log in to continue</p>
        {authLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="login-options">
            {/* Telegram Option */}
            <div className="login-method">
              <p className="login-method-label">Quick Login:</p>
              <div ref={loginRef} className="telegram-login-widget"></div>
            </div>

            {/* Divider */}
            <div className="login-divider">
              <span>or</span>
            </div>

            {/* Other Methods */}
            <div className="login-method">
              <p className="login-method-label">More Options:</p>
              <button
                onClick={handleLoginRedirect}
                className="button button-secondary button-block"
              >
                Email • X/Twitter • Telegram
              </button>
              <p className="login-hint">Access all login methods on PRIME Hub</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
