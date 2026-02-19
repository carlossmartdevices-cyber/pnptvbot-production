import React, { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Send } from 'lucide-react';

export default function PostComposer({ onPosted }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const maxLen = 5000;

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.createPost({ content: text.trim() });
      setText('');
      onPosted && onPosted(res.post);
    } catch (err) {
      setError(err.message || 'Failed to post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="post-composer card">
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="post-avatar-placeholder" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
          {(user?.firstName || user?.username || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What's happening?"
            maxLength={maxLen}
            rows={3}
            className="composer-textarea"
          />
          {error && <div style={{ color: '#ff453a', fontSize: 13, marginBottom: 6 }}>{error}</div>}
          <div className="composer-footer">
            <span className="composer-char-count" style={{ color: text.length > maxLen * 0.9 ? '#ff453a' : 'var(--text-muted)' }}>
              {text.length}/{maxLen}
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="btn-primary composer-post-btn"
            >
              <Send size={14} />
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
