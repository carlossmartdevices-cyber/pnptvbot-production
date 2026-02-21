import React, { useState, useEffect } from 'react';
import { Music, Trash2, Edit2, Plus, Upload } from 'lucide-react';
import client from '../../api/client';
import AdminRoute from '../../components/AdminRoute';

export default function AdminMediaPage() {
  const [media, setMedia] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const limit = 20;

  useEffect(() => {
    loadMedia();
    loadCategories();
  }, [page, type, category, search]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        type,
        ...(category && { category }),
        ...(search && { search }),
      });

      const data = await client.getAdminMedia(`?${params}`);
      setMedia(data.media || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load media:', error);
      alert('Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await client.getAdminMediaCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleDelete = async (mediaId) => {
    if (!confirm('Are you sure you want to delete this media?')) return;

    try {
      await client.deleteAdminMedia(mediaId);
      setMedia(media.filter(m => m.id !== mediaId));
    } catch (error) {
      console.error('Failed to delete media:', error);
      alert('Failed to delete media');
    }
  };

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditData({
      title: item.title,
      artist: item.artist,
      description: item.description,
      category: item.category,
      isExplicit: item.is_explicit,
    });
  };

  const handleEditSave = async (mediaId) => {
    try {
      const updated = await client.updateAdminMedia(mediaId, editData);
      setMedia(media.map(m => m.id === mediaId ? updated.media : m));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update media:', error);
      alert('Failed to update media');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', prompt('Enter media title:') || file.name);
    formData.append('artist', prompt('Enter artist/uploader:') || 'Unknown');
    formData.append('category', category || 'general');
    formData.append('type', file.type.startsWith('video/') ? 'video' : 'audio');

    try {
      setLoading(true);
      const data = await client.uploadAdminMedia(formData);
      setMedia([data.media, ...media]);
      setShowUpload(false);
    } catch (error) {
      console.error('Failed to upload media:', error);
      alert('Failed to upload media');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-header">
          <h1>Media Management</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowUpload(!showUpload)}
            disabled={loading}
          >
            <Upload size={16} />
            Upload Media
          </button>
        </div>

        {showUpload && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3>Upload Media</h3>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleUpload}
              disabled={loading}
              style={{ marginBottom: '10px' }}
            />
          </div>
        )}

        <div className="filters">
          <select value={type} onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}>
            <option value="all">All Types</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>

          <select value={category} onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}>
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search media..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="media-grid">
          {loading ? (
            <p>Loading...</p>
          ) : media.length === 0 ? (
            <p>No media found</p>
          ) : (
            media.map(item => (
              <div key={item.id} className="media-card">
                {editingId === item.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      placeholder="Title"
                    />
                    <input
                      type="text"
                      value={editData.artist}
                      onChange={(e) => setEditData({ ...editData, artist: e.target.value })}
                      placeholder="Artist"
                    />
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      placeholder="Description"
                    />
                    <select
                      value={editData.category}
                      onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <label>
                      <input
                        type="checkbox"
                        checked={editData.isExplicit}
                        onChange={(e) => setEditData({ ...editData, isExplicit: e.target.checked })}
                      />
                      Explicit Content
                    </label>
                    <div className="button-group">
                      <button onClick={() => handleEditSave(item.id)} className="btn btn-success">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {item.cover_url && (
                      <img src={item.cover_url} alt={item.title} className="media-cover" />
                    )}
                    <div className="media-info">
                      <h4>{item.title}</h4>
                      <p className="artist">{item.artist}</p>
                      <p className="meta">
                        {item.type.toUpperCase()} • {item.category} • {item.duration || 0}s
                      </p>
                      {item.is_explicit && <span className="badge-explicit">Explicit</span>}
                    </div>
                    <div className="media-actions">
                      <button
                        onClick={() => handleEditStart(item)}
                        className="btn btn-small"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn btn-small btn-danger"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pagination">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            Previous
          </button>
          <span>Page {page} of {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / limit)}>
            Next
          </button>
        </div>

        <style jsx>{`
          .admin-page {
            padding: 20px;
          }
          .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .filters {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .filters select,
          .filters input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .media-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          .media-card {
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
            background: white;
          }
          .media-cover {
            width: 100%;
            height: 150px;
            object-fit: cover;
          }
          .media-info {
            padding: 12px;
          }
          .media-info h4 {
            margin: 0 0 4px;
            font-size: 14px;
            font-weight: 600;
          }
          .artist {
            margin: 0 0 8px;
            font-size: 12px;
            color: #666;
          }
          .meta {
            margin: 0;
            font-size: 11px;
            color: #999;
          }
          .badge-explicit {
            display: inline-block;
            background: #ff6b6b;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            margin-top: 4px;
          }
          .media-actions {
            display: flex;
            gap: 5px;
            padding: 8px;
            border-top: 1px solid #eee;
          }
          .edit-form {
            padding: 12px;
          }
          .edit-form input,
          .edit-form textarea,
          .edit-form select {
            width: 100%;
            padding: 8px;
            margin-bottom: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
          }
          .button-group {
            display: flex;
            gap: 8px;
            margin-top: 8px;
          }
          .pagination {
            display: flex;
            justify-content: center;
            gap: 10px;
            align-items: center;
          }
          .btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .btn-primary {
            background: #0070f3;
            color: white;
          }
          .btn-small {
            padding: 6px 8px;
            font-size: 11px;
          }
          .btn-danger {
            background: #ff6b6b;
            color: white;
          }
          .card {
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 15px;
            background: white;
          }
        `}</style>
      </div>
    </AdminRoute>
  );
}
