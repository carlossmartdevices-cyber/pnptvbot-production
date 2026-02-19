import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Twitter } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginWithX } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Check for auth errors from redirect
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'not_registered') {
      const handle = searchParams.get('x_handle');
      setError(
        handle
          ? `X account @${handle} is not linked to any PNPtv account. Please register via the Telegram bot first.`
          : 'Account not registered. Please use the Telegram bot first.'
      );
    } else if (err === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    } else if (err === 'missing_params') {
      setError('Authentication was incomplete. Please try again.');
    }
  }, [searchParams]);

  // Render Telegram widget (redirect-based — more reliable, no popup blocking)
  useEffect(() => {
    const container = document.getElementById('telegram-widget-container');
    if (!container) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', 'PNPLatinoTV_Bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-auth-url', '/api/webapp/auth/telegram/callback');
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);
  }, []);

  const handleXLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithX();
    } catch (err) {
      setError(err.message || 'Failed to start X authentication');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="ambient-glow" />

      <div className="login-card">
        <div className="login-logo">PNPtv</div>
        <h1>PRIME Hub</h1>
        <p className="subtitle">Sign in to access the PNPtv community</p>

        {error && <div className="login-error">{error}</div>}

        {/* Telegram Login Widget */}
        <div id="telegram-widget-container" style={{ display: 'flex', justifyContent: 'center', minHeight: 48 }} />

        <div className="login-divider">or</div>

        {/* X (Twitter) Login */}
        <button
          className="btn-login btn-x"
          onClick={handleXLogin}
          disabled={loading}
        >
          <Twitter size={18} />
          Sign in with X
        </button>

        <p className="login-footer">
          By signing in, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener">Terms & Conditions</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
          <br />
          You must be 18+ to use this platform.
        </p>
      </div>
    </div>
  );
}
