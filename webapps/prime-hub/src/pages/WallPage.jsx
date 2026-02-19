import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PostCard from '../components/social/PostCard';
import PostComposer from '../components/social/PostComposer';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { MessageSquare } from 'lucide-react';

export default function WallPage() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getWall(userId);
        setProfile(res.profile);
        setPosts(res.posts || []);
        setNextCursor(res.nextCursor || null);
      } catch {}
    };
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [userId]);

  const handlePosted = (post) => setPosts(prev => [post, ...prev]);
  const handleDeleted = (id) => setPosts(prev => prev.filter(p => p.id !== id));

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 32 }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div></Layout>;

  if (!profile) return <Layout><div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>User not found.</div></Layout>;

  const isMe = me?.id === userId;

  return (
    <Layout>
      {/* Profile header */}
      <div className="card wall-profile-card">
        <div className="wall-profile-avatar">
          {profile.photo_file_id ? (
            <img src={`https://api.telegram.org/file/bot${profile.photo_file_id}`} alt="" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="post-avatar-placeholder wall-avatar-big">
              {(profile.first_name || profile.username || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="wall-profile-info">
          <div className="wall-profile-name">{profile.first_name} {profile.last_name || ''}</div>
          {profile.username && <div className="wall-profile-handle">@{profile.username}</div>}
          {profile.pnptv_id && <div className="wall-profile-id">ID: {profile.pnptv_id}</div>}
          {profile.bio && <div className="wall-profile-bio">{profile.bio}</div>}
        </div>
        {!isMe && (
          <Link to={`/messages/${userId}`} className="btn-secondary wall-dm-btn">
            <MessageSquare size={16} /> DM
          </Link>
        )}
      </div>

      {isMe && <PostComposer onPosted={handlePosted} />}

      {posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          No posts yet.
        </div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)
      )}
    </Layout>
  );
}
