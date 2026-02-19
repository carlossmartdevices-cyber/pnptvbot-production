import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { MapPin, Users, Radio, Film, Heart, Repeat2, MessageCircle } from 'lucide-react';

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

      {/* Mastodon Feed */}
      <div className="section-label">Latest Posts</div>
      <MastodonFeed />
    </Layout>
  );
}
