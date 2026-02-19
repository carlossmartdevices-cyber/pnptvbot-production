import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Twitter } from 'lucide-react';
import { api } from '../api/client';

const REMEMBER_ME_KEY = 'pnptv.rememberMe';
const REMEMBER_EMAIL_KEY = 'pnptv.rememberedEmail';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginWithEmail, registerWithEmail, loginWithX } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgot, setShowForgot] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  // Init Telegram Login Widget after component mounts
  useEffect(() => {
    if (window.Telegram?.Login) {
      window.Telegram.Login.embed('tg_login_widget', {
        bot_id: '7882893938',
        size: 'large',
        onAuthCallback: handleTelegramAuthCallback
      });
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Restore remembered email from this browser
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem(REMEMBER_ME_KEY) === '1';
      const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
      setRememberMe(savedRemember);
      if (savedRemember && savedEmail) setLoginEmail(savedEmail);
    } catch (_) {
      // Ignore local storage restrictions.
    }
  }, []);

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

  const handleTelegramAuthCallback = async (user) => {
    setError('');
    setSuccess('');
    setSocialLoading(true);
    try {
      const result = await api.telegramLogin(user);
      if (result.authenticated && result.registered) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Telegram authentication failed');
        setSocialLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Telegram authentication failed');
      setSocialLoading(false);
    }
  };

  const handleXLogin = async () => {
    setError('');
    setSuccess('');
    setSocialLoading(true);
    try {
      await loginWithX();
    } catch (err) {
      setError(err.message || 'Failed to start X authentication');
      setSocialLoading(false);
    }
  };

  const persistRememberedEmail = (emailValue, shouldRemember) => {
    try {
      if (shouldRemember) {
        localStorage.setItem(REMEMBER_ME_KEY, '1');
        localStorage.setItem(REMEMBER_EMAIL_KEY, emailValue);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (_) {
      // Ignore local storage restrictions.
    }
  };

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const email = loginEmail.trim();
    if (!email || !loginPassword) {
      setError('Email and password are required.');
      return;
    }

    setEmailLoading(true);
    try {
      await loginWithEmail(email, loginPassword, rememberMe);
      persistRememberedEmail(email, rememberMe);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const firstName = registerName.trim();
    const email = registerEmail.trim();
    if (!firstName || !email || !registerPassword) {
      setError('Name, email, and password are required.');
      return;
    }
    if (registerPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setEmailLoading(true);
    try {
      await registerWithEmail(firstName, email, registerPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const email = forgotEmail.trim();
    if (!email) {
      setError('Email is required.');
      return;
    }

    setEmailLoading(true);
    try {
      await api.forgotPassword(email);
      setShowForgot(false);
      setForgotEmail('');
      setSuccess('If that email is registered, a reset link will arrive soon.');
    } catch (err) {
      setError(err.message || 'Could not send reset email. Please try again.');
    } finally {
      setEmailLoading(false);
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
        {success && <div className="login-success">{success}</div>}

        <div id="tg_login_widget" style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }} />
        <noscript>Telegram login requires JavaScript enabled</noscript>

        <div className="login-divider">or</div>

        {/* X (Twitter) Login */}
        <button
          className="btn-login btn-x"
          onClick={handleXLogin}
          disabled={socialLoading || emailLoading}
        >
          <Twitter size={18} />
          Sign in with X
        </button>

        <div className="login-divider">or</div>

        <div className="login-tabs" role="tablist" aria-label="Email authentication tabs">
          <button
            type="button"
            className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setShowForgot(false);
              setError('');
              setSuccess('');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setShowForgot(false);
              setError('');
              setSuccess('');
            }}
          >
            Register
          </button>
        </div>

        {activeTab === 'login' && !showForgot && (
          <form className="auth-form" onSubmit={handleEmailLogin}>
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <label className="remember-row" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me on this device (30 days)
            </label>
            <button type="submit" className="btn-login btn-email" disabled={socialLoading || emailLoading}>
              {emailLoading ? 'Signing in...' : 'Sign in with email'}
            </button>
            <button
              type="button"
              className="forgot-link"
              onClick={() => {
                setShowForgot(true);
                setError('');
                setSuccess('');
                setForgotEmail(loginEmail);
              }}
            >
              Forgot your password?
            </button>
          </form>
        )}

        {activeTab === 'login' && showForgot && (
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <p className="auth-helper">Enter your email and we will send a reset link.</p>
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              autoComplete="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
            <button type="submit" className="btn-login btn-email" disabled={socialLoading || emailLoading}>
              {emailLoading ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="forgot-link"
              onClick={() => {
                setShowForgot(false);
                setError('');
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {activeTab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <input
              type="text"
              className="auth-input"
              placeholder="First name"
              autoComplete="given-name"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
            />
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              autoComplete="email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Password (8+ characters)"
              autoComplete="new-password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
            />
            <button type="submit" className="btn-login btn-email" disabled={socialLoading || emailLoading}>
              {emailLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

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
