import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { Music, Film, Play, RefreshCw, Search } from 'lucide-react';

export default function MediaLibraryPage() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/media/library?type=${type}&limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load media');
      const data = await response.json();
      setMedia(data.media || []);
    } catch (err) {
      setError(err.message || 'Failed to load media library');
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handlePlay = (item) => {
    setSelectedMedia(item);
  };

  const handleClose = () => {
    setSelectedMedia(null);
  };

  const isVideo = (item) => item.type === 'video';
  const isAudio = (item) => item.type === 'audio';

  if (selectedMedia) {
    return (
      <Layout>
        <div style={{ padding: '16px' }}>
          <button
            onClick={handleClose}
            style={{
              marginBottom: '16px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>

          {isVideo(selectedMedia) ? (
            <video
              src={selectedMedia.file_path || selectedMedia.url}
              controls
              autoPlay
              style={{
                width: '100%',
                maxHeight: '70vh',
                borderRadius: '8px',
                background: '#000',
              }}
            />
          ) : (
            <audio
              src={selectedMedia.file_path || selectedMedia.url}
              controls
              autoPlay
              style={{
                width: '100%',
                marginBottom: '16px',
              }}
            />
          )}

          <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px', color: '#fff' }}>{selectedMedia.title || 'Untitled'}</h3>
            {selectedMedia.artist && (
              <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                by {selectedMedia.artist}
              </p>
            )}
            {selectedMedia.description && (
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                {selectedMedia.description}
              </p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Media Library</h2>
        <button
          onClick={() => loadMedia()}
          className="btn-secondary"
          style={{ padding: '6px 10px' }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadMedia()}
            placeholder="Search media..."
            className="chat-input"
            style={{ width: '100%', paddingLeft: '32px' }}
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            color: '#fff',
          }}
        >
          <option value="all">All</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : media.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Film size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <div style={{ color: 'var(--text-muted)' }}>
            No media found
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', padding: '12px' }}>
          {media.map((item) => (
            <div
              key={item.id}
              onClick={() => handlePlay(item)}
              style={{
                cursor: 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              {/* Thumbnail or icon */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {isVideo(item) ? (
                  <Film size={32} style={{ opacity: 0.5 }} />
                ) : (
                  <Music size={32} style={{ opacity: 0.5 }} />
                )}
                <div
                  style={{
                    position: 'absolute',
                    width: '40px',
                    height: '40px',
                    background: 'rgba(59,130,246,0.8)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Play size={18} fill="#fff" style={{ marginLeft: '2px' }} />
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '8px' }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '12px',
                  color: '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '4px',
                }}>
                  {item.title || 'Untitled'}
                </div>
                {item.artist && (
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.artist}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
