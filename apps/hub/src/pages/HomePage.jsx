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
  const [latestVideoramaVideo, setLatestVideoramaVideo] = useState(null);
  const [activeLiveStream, setActiveLiveStream] = useState(null);
  const [mostActiveHangout, setMostActiveHangout] = useState(null);

  useEffect(() => {
    api.getLatestPrimeVideo().then(data => setLatestPrimeVideo(data.data)).catch(() => {});
    api.getLatestVideoramaVideo().then(data => setLatestVideoramaVideo(data.data)).catch(() => {});
    api.getActiveLiveStreams().then(data => setActiveLiveStream(data.data)).catch(() => {});
    api.getMostActiveHangout().then(data => setMostActiveHangout(data.data)).catch(() => {});
  }, []);

  const FeaturedCard = ({ badge, badgeColor, title, subtitle, image, cta, ctaText, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
        backgroundImage: image ? `url(${image})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        aspectRatio: '16/9',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 16,
        position: 'relative',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      as={Link}
      to={cta}
      className="card"
    >
      <span style={{
        display: 'inline-block',
        background: badgeColor || 'var(--accent)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        width: 'fit-content',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
      }}>
        {badge}
      </span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 4, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {subtitle}
        </div>
        <button
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.preventDefault();
            onClick?.();
          }}
        >
          {ctaText}
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="welcome-banner">
        <h2>Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
        <p>Your PNPtv hub - explore, connect, and enjoy.</p>
      </div>

      <NowPlaying />

      <div className="section-label">Featured Content</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12,
        marginBottom: 24
      }}>
        {latestPrimeVideo && (
          <Link to="/videorama" style={{ textDecoration: 'none' }}>
            <FeaturedCard
              badge="👑 PRIME"
              badgeColor="#D4AF37"
              title={latestPrimeVideo.title}
              subtitle={latestPrimeVideo.artist}
              image={latestPrimeVideo.cover}
              cta="/suscripcion"
              ctaText="Subscribe"
            />
          </Link>
        )}
        {latestVideoramaVideo && (
          <Link to="/videorama" style={{ textDecoration: 'none' }}>
            <FeaturedCard
              badge="🎬 VIDEORAMA"
              badgeColor="#1abc9c"
              title={latestVideoramaVideo.title}
              subtitle={latestVideoramaVideo.artist}
              image={latestVideoramaVideo.cover}
              cta="/videorama"
              ctaText="Watch"
            />
          </Link>
        )}
        {activeLiveStream && (
          <Link to="/livestream" style={{ textDecoration: 'none' }}>
            <FeaturedCard
              badge="📻 LIVE"
              badgeColor="#ff453a"
              title={activeLiveStream.title}
              subtitle={activeLiveStream.host}
              image={activeLiveStream.thumbnail}
              cta="/livestream"
              ctaText="Join"
            />
          </Link>
        )}
        {mostActiveHangout && (
          <Link to="/hangouts" style={{ textDecoration: 'none' }}>
            <FeaturedCard
              badge="👥 HANGOUT"
              badgeColor="#007AFF"
              title={mostActiveHangout.title}
              subtitle={`${mostActiveHangout.members || 0} members`}
              image={mostActiveHangout.thumbnail}
              cta="/hangouts"
              ctaText="Join"
            />
          </Link>
        )}
      </div>

      <div className="section-label">Latest Posts</div>
      <RecentFeed />
    </Layout>
  );
}
