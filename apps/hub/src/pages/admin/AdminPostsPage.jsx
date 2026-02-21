import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { Trash2, AlertCircle } from 'lucide-react';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const loadPosts = (pageNum = 1) => {
    setLoading(true);
    api.listAdminPosts(pageNum)
      .then(data => {
        setPosts(data.posts || []);
        setPagination(data.pagination || {});
        setPage(pageNum);
      })
      .catch(err => setError(err.message || 'Failed to load posts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPosts(1);
  }, []);

  const handleDelete = async (postId) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.deleteAdminPost(postId);
      loadPosts(page);
    } catch (err) {
      setError(err.message || 'Failed to delete post');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Moderate Posts</h1>

        {error && (
          <div className="card" style={{ padding: 16, marginBottom: 24, color: '#ff453a' }}>
            <AlertCircle size={18} style={{ display: 'inline', marginRight: 8 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No posts to moderate
          </div>
        ) : (
          <>
            {posts.map(post => (
              <div key={post.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: 4 }}>{post.username}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(post.created_at).toLocaleDateString()} {new Date(post.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(post.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF453A',
                      cursor: 'pointer',
                      padding: 8,
                    }}
                    title="Delete post"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {post.content.substring(0, 300)}
                  {post.content.length > 300 ? '...' : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  ❤️ {post.likes || 0} • 💬 {post.replies || 0}
                </div>
              </div>
            ))}

            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => loadPosts(p)}
                    style={{
                      padding: '8px 12px',
                      border: page === p ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      backgroundColor: page === p ? 'var(--accent)' : 'transparent',
                      color: page === p ? '#fff' : 'var(--text-primary)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
