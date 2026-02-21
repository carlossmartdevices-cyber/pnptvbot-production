import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import PostComposer from '../components/social/PostComposer';
import PostCard from '../components/social/PostCard';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toasts, showToast, closeToast } = useToast();

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
      showToast('Error al cargar el feed', 'error');
    }
  }, [showToast]);

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

      <PostComposer onPosted={handlePosted} onError={() => showToast('Error al publicar', 'error')} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No hay posts aún. ¡Sé el primero en publicar!
        </div>
      ) : (
        <>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={handleDeleted}
              onError={() => showToast('Error al procesar la acción', 'error')}
            />
          ))}
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-secondary"
              style={{ width: '100%', marginTop: 12 }}
            >
              {loadingMore ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Layout>
  );
}
