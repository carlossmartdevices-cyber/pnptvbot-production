import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FileText, HelpCircle, Rss, User, MessageSquare, Users, Shield } from 'lucide-react';

export default function Header() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="header-logo">PNPtv</Link>
      </div>

      <nav className="header-nav">
        {user && ['admin', 'superadmin'].includes(user.role) && (
          <Link
            to="/admin"
            className={`header-nav-btn ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
            title="Admin Panel"
          >
            <Shield size={18} />
          </Link>
        )}

        <Link
          to="/feed"
          className={`header-nav-btn ${location.pathname === '/feed' ? 'active' : ''}`}
          title="Social Feed"
        >
          <Rss size={18} />
        </Link>

        <Link
          to="/messages"
          className={`header-nav-btn ${location.pathname.startsWith('/messages') ? 'active' : ''}`}
          title="Messages"
        >
          <MessageSquare size={18} />
        </Link>

        <a
          href="/terms"
          target="_blank"
          rel="noopener"
          className="header-nav-btn"
          title="Terms"
        >
          <FileText size={18} />
        </a>

        <a
          href="https://t.me/PNPLatinoTV_Bot"
          target="_blank"
          rel="noopener"
          className="header-nav-btn"
          title="Support"
        >
          <HelpCircle size={18} />
        </a>
      </nav>

      <div className="header-right">
        {user && (
          <Link
            to={`/wall/${user.id}`}
            className={`header-nav-btn ${location.pathname.startsWith('/wall') ? 'active' : ''}`}
            title="My Wall"
          >
            <Users size={18} />
          </Link>
        )}

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
