import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { MapPin, Users, Radio, Film, Heart, Repeat2, MessageCircle } from 'lucide-react';

function TelegramChannelWidget() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-post', 'pnptv_community/1');
    script.setAttribute('data-width', '100%');
    script.setAttribute('data-color', 'FF00CC');
    script.setAttribute('data-dark', '1');
    ref.current.appendChild(script);
  }, []);

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="card-header">
        <span className="card-title">Telegram Community</span>
        <a
          href="https://t.me/pnptv_community"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Join →
        </a>
      </div>
      <div ref={ref} style={{ minHeight: 80 }} />
      <a
        href="https://t.me/PNPLatinoTV_Bot"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginTop: 12, padding: '10px 16px', borderRadius: 10,
          background: 'rgba(0,136,204,0.15)', border: '1px solid rgba(0,136,204,0.3)',
          color: '#29B6F6', fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        Open in Telegram Bot
      </a>
    </div>
  );
}

function MastodonFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getMastodonFeed(5)
      .then(data => {
        if (!cancelled) setPosts(data.posts || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Loading feed...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No posts available right now. Check back later.
        </p>
      </div>
    );
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Community Feed</span>
        <span className="card-subtitle">via Mastodon</span>
      </div>
      {posts.map(post => (
        <div key={post.id} className="feed-post">
          <div className="feed-post-header">
            <div className="feed-avatar">
              {post.account?.avatar && (
                <img src={post.account.avatar} alt="" />
              )}
            </div>
            <div>
              <div className="feed-author">
                {post.account?.displayName || post.account?.username || 'PNPtv'}
              </div>
              <div className="feed-time">{timeAgo(post.createdAt)}</div>
            </div>
          </div>
          <div className="feed-content">
            {stripHtml(post.content).slice(0, 280)}
            {stripHtml(post.content).length > 280 && '...'}
          </div>
          {post.mediaAttachments?.length > 0 && (
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden' }}>
              {post.mediaAttachments.slice(0, 1).map((m, i) => (
                m.type === 'image' && (
                  <img
                    key={i}
                    src={m.previewUrl || m.url}
                    alt=""
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                )
              ))}
            </div>
          )}
          <div className="feed-stats">
            <span className="feed-stat"><Heart size={14} /> {post.favouritesCount || 0}</span>
            <span className="feed-stat"><Repeat2 size={14} /> {post.reblogsCount || 0}</span>
            <span className="feed-stat"><MessageCircle size={14} /> {post.repliesCount || 0}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  return (
    <Layout>
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <h2>Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
        <p>Your PRIME Zone hub - explore, connect, and enjoy.</p>
      </div>

      {/* Quick Actions - feature navigation cards */}
      <div className="section-label">Explore</div>
      <div className="quick-actions">
        <Link to="/nearby" className="card quick-action">
          <div className="quick-action-icon nearby">
            <MapPin size={24} />
          </div>
          <span className="quick-action-label">Nearby</span>
          <span className="quick-action-desc">Discover members near you</span>
        </Link>

        <Link to="/hangouts" className="card quick-action">
          <div className="quick-action-icon hangouts">
            <Users size={24} />
          </div>
          <span className="quick-action-label">Hangouts</span>
          <span className="quick-action-desc">Video call rooms</span>
        </Link>

        <Link to="/live" className="card quick-action">
          <div className="quick-action-icon live">
            <Radio size={24} />
          </div>
          <span className="quick-action-label">Live</span>
          <span className="quick-action-desc">Live performances</span>
        </Link>

        <Link to="/videorama" className="card quick-action">
          <div className="quick-action-icon videorama">
            <Film size={24} />
          </div>
          <span className="quick-action-label">Videorama</span>
          <span className="quick-action-desc">Media center</span>
        </Link>
      </div>

      {/* Telegram Community */}
      <div className="section-label">Telegram</div>
      <TelegramChannelWidget />

      {/* Mastodon Feed */}
      <div className="section-label">Latest Posts</div>
      <MastodonFeed />
    </Layout>
  );
}
