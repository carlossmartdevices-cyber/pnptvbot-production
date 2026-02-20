import React, { useState, useRef } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Send, Paperclip, X } from 'lucide-react';

export default function PostComposer({ onPosted }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const mediaInputRef = useRef(null);
  const maxLen = 5000;

  const handleMediaSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type);

    if (!isImage) {
      setError('🎬 Videos are disabled to save storage costs. Please use YouTube or Vimeo and share the link instead.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large (max 10MB). Please compress before uploading.');
      return;
    }

    setError('');
    setMedia(file);

    const reader = new FileReader();
    reader.onload = (ev) => setMediaPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaPreview(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      if (media) {
        const res = await api.createPostWithMedia(text.trim(), media);
        setText('');
        removeMedia();
        onPosted && onPosted(res.post);
      } else {
        const res = await api.createPost({ content: text.trim() });
        setText('');
        onPosted && onPosted(res.post);
      }
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
          {mediaPreview && (
            <div className="composer-media-preview">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={mediaPreview} alt="Preview" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8 }} />
                <button
                  onClick={removeMedia}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    borderRadius: '50%',
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Remove media"
                >
                  <X size={14} color="white" />
                </button>
              </div>
            </div>
          )}
          <div className="composer-footer">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => mediaInputRef.current?.click()}
                disabled={posting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-pink)',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}
                title="Attach image or video"
              >
                <Paperclip size={16} />
              </button>
              <span className="composer-char-count" style={{ color: text.length > maxLen * 0.9 ? '#ff453a' : 'var(--text-muted)' }}>
                {text.length}/{maxLen}
              </span>
            </div>
            <button
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="btn-primary composer-post-btn"
            >
              <Send size={14} />
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
