import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import PostComposer from '../components/social/PostComposer';
import PostCard from '../components/social/PostCard';
import { api } from '../api/client';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(async (cursor = null) => {
    try {
      const res = await api.getFeed(cursor);
      if (cursor) {
        setPosts(prev => [...prev, ...(res.posts || [])]);
      } else {
        setPosts(res.posts || []);
      }
      setNextCursor(res.nextCursor || null);
    } catch (err) {
      console.error('Feed error', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  const handlePosted = (newPost) => {
    setPosts(prev => [{ ...newPost, liked_by_me: false, likes_count: 0, replies_count: 0, reposts_count: 0 }, ...prev]);
  };

  const handleDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await loadFeed(nextCursor);
    setLoadingMore(false);
  };

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Feed</h2>
      </div>

      <PostComposer onPosted={handlePosted} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No posts yet. Be the first to post!
        </div>
      ) : (
        <>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
          ))}
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-secondary"
              style={{ width: '100%', marginTop: 12 }}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </Layout>
  );
}
