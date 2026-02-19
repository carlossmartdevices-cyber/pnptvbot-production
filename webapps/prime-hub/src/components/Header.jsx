import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Crown, FileText, HelpCircle, Rss, User } from 'lucide-react';

export default function Header() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="header-logo">PNP</Link>
        <Link to="/" className="header-title">PRIME Zone</Link>
      </div>

      <nav className="header-nav">
        <a
          href="/terms"
          target="_blank"
          rel="noopener"
          className="header-nav-btn"
          title="Terms and Conditions"
        >
          <FileText size={18} />
        </a>

        <a
          href="https://t.me/PNPtvbot"
          target="_blank"
          rel="noopener"
          className="header-nav-btn"
          title="Support"
        >
          <HelpCircle size={18} />
        </a>
      </nav>

      <div className="header-right">
        <Link
          to="/"
          className={`header-nav-btn ${location.pathname === '/' ? 'active' : ''}`}
          title="Mastodon Feed"
        >
          <Rss size={18} />
        </Link>

        <Link to="/profile" title="My Profile">
          <div className="header-avatar">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.username || 'Profile'} />
            ) : (
              <User size={18} color="#8E8E93" />
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
