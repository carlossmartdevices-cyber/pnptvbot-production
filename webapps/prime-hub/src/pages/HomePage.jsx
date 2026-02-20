import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import PostCard from '../components/social/PostCard';
import { MapPin, Users, Radio, Film, Rss, MessageSquare, Music, Headphones } from 'lucide-react';

function NowPlaying() {
  const [track, setTrack] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getRadioNowPlaying()
      .then(data => { if (!cancelled && data.track) setTrack(data.track); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!track) return null;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 4 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #ff453a, #ff6b35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Headphones size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Now Playing</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title || 'PNPtv Radio'}
        </div>
        {track.artist && track.artist !== 'Starting Soon' && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track.artist}
          </div>
        )}
      </div>
      <Music size={16} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
    </div>
  );
}

function RecentFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getFeed()
      .then(data => { if (!cancelled) setPosts((data.posts || []).slice(0, 5)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>No posts yet. Be the first!</p>
        <Link to="/feed" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, textDecoration: 'none' }}>
          <Rss size={14} /> Go to Feed
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Latest Posts</span>
        <Link to="/feed" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>See all &rarr;</Link>
      </div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [latestPrimeVideo, setLatestPrimeVideo] = useState(null);
  const [mostActiveHangout, setMostActiveHangout] = useState(null);

  useEffect(() => {
    api.getLatestPrimeVideo().then(data => setLatestPrimeVideo(data.data));
    api.getMostActiveHangout().then(data => setMostActiveHangout(data.data));
  }, []);

  return (
    <Layout>
      <div className="welcome-banner">
        <h2>Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
        <p>Your PNPtv hub - explore, connect, and enjoy.</p>
      </div>

      <NowPlaying />

      <div className="section-label">Highlights</div>
      <div className="quick-actions">
        {latestPrimeVideo && (
          <Link to={latestPrimeVideo.link} className="card quick-action">
            <div className="quick-action-icon videorama"><Film size={24} /></div>
            <span className="quick-action-label">Latest Prime Video</span>
            <span className="quick-action-desc">{latestPrimeVideo.title}</span>
          </Link>
        )}
        {mostActiveHangout && (
          <Link to={mostActiveHangout.link} className="card quick-action">
            <div className="quick-action-icon hangouts"><Users size={24} /></div>
            <span className="quick-action-label">Most Active Hangout</span>
            <span className="quick-action-desc">{mostActiveHangout.title}</span>
          </Link>
        )}
      </div>

      <div className="section-label">Latest Posts</div>
      <RecentFeed />
    </Layout>
  );
}
