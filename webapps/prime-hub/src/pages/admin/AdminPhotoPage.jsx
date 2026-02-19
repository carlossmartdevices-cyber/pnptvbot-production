import React, { useState, useEffect, useRef } from 'react';
import { upload, listAdminPhotos, deletePhoto, updatePhoto, getPhotoStats } from '../../client';
import {
  Upload,
  Search,
  Grid3x3,
  List,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function AdminPhotoPage() {
  const [photos, setPhotos] = useState([]);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [offset, setOffset] = useState(0);
  const dropZoneRef = useRef(null);

  const CATEGORIES = [
    { value: '', label: 'All Categories' },
    { value: 'gallery', label: 'Gallery' },
    { value: 'featured', label: 'Featured' },
    { value: 'events', label: 'Events' },
    { value: 'promotions', label: 'Promotions' },
  ];

  // Load photos and stats
  useEffect(() => {
    loadPhotos();
    loadStats();
  }, [search, category, offset]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const data = await listAdminPhotos({
        search: search || undefined,
        category: category || undefined,
        limit: 50,
        offset,
      });
      setPhotos(data.photos);
      setError('');
    } catch (err) {
      setError('Failed to load photos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getPhotoStats();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleUpload = async (files) => {
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('category', category || 'gallery');

        await upload('/api/admin/photos/upload', formData);
      }

      setSuccess(`Successfully uploaded ${files.length} photo(s)`);
      await loadPhotos();
      await loadStats();
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = () => {
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
    handleUpload(Array.from(e.dataTransfer.files));
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return;

    try {
      await deletePhoto(photoId);
      setPhotos(photos.filter(p => p.id !== photoId));
      setSuccess('Photo deleted');
      await loadStats();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

  const handleUpdatePhoto = async (photoId, updates) => {
    try {
      const updated = await updatePhoto(photoId, updates);
      setPhotos(photos.map(p => p.id === photoId ? updated : p));
      setEditingPhoto(null);
      setSuccess('Photo updated');
    } catch (err) {
      setError('Update failed: ' + err.message);
    }
  };

  const toggleSelectPhoto = (photoId) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const handleBatchDelete = async () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Delete ${selectedPhotos.size} photo(s)?`)) return;

    try {
      await Promise.all(
        Array.from(selectedPhotos).map(id => deletePhoto(id))
      );
      setPhotos(photos.filter(p => !selectedPhotos.has(p.id)));
      setSelectedPhotos(new Set());
      setSuccess(`Deleted ${selectedPhotos.size} photo(s)`);
      await loadStats();
    } catch (err) {
      setError('Batch delete failed: ' + err.message);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Photo Gallery</h1>
        <p className="text-gray-600">Manage admin photos and content</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Total Photos</div>
            <div className="text-2xl font-bold">{stats.overall?.total_photos || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Storage Used</div>
            <div className="text-2xl font-bold">{formatBytes(stats.overall?.total_storage_bytes || 0)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Admin Photos</div>
            <div className="text-2xl font-bold">{stats.admin?.count || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Contributors</div>
            <div className="text-2xl font-bold">{stats.overall?.contributors || 0}</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
          <Check className="text-green-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="bg-white p-8 rounded-lg border-2 border-dashed border-gray-300 mb-8 transition-all"
      >
        <div className="text-center">
          <Upload className="mx-auto mb-3 text-gray-400" size={32} />
          <h3 className="font-semibold text-gray-900 mb-1">Upload Photos</h3>
          <p className="text-gray-600 text-sm mb-4">Drag and drop photos here or click to select</p>
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(Array.from(e.target.files))}
              disabled={uploading}
            />
            <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 inline-block">
              {uploading ? 'Uploading...' : 'Select Photos'}
            </span>
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="flex items-center bg-gray-100 rounded-lg px-3">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search photos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="bg-transparent flex-1 px-2 py-2 outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 bg-gray-100 rounded-lg outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* View Mode & Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
            >
              <Grid3x3 size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
            >
              <List size={20} />
            </button>
            {selectedPhotos.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 size={18} />
                Delete {selectedPhotos.size}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
          </div>
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">No photos found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {photos.map((photo) => (
            <PhotoGridCard
              key={photo.id}
              photo={photo}
              selected={selectedPhotos.has(photo.id)}
              onSelect={toggleSelectPhoto}
              onDelete={handleDeletePhoto}
              onEdit={setEditingPhoto}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {photos.map((photo) => (
            <PhotoListRow
              key={photo.id}
              photo={photo}
              selected={selectedPhotos.has(photo.id)}
              onSelect={toggleSelectPhoto}
              onDelete={handleDeletePhoto}
              onEdit={setEditingPhoto}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPhoto && (
        <PhotoEditModal
          photo={editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onSave={handleUpdatePhoto}
        />
      )}
    </div>
  );
}

function PhotoGridCard({ photo, selected, onSelect, onDelete, onEdit }) {
  return (
    <div className="group relative bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-100 overflow-hidden">
        <img
          src={photo.thumbnail_path}
          alt={photo.caption || 'Photo'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
        />
      </div>
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <button
          onClick={() => onSelect(photo.id)}
          className={`w-6 h-6 rounded border-2 ${
            selected ? 'bg-blue-600 border-blue-600' : 'border-white'
          }`}
        >
          {selected && <Check size={16} className="text-white mx-auto" />}
        </button>
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold text-gray-900 truncate">{photo.caption || 'Untitled'}</h4>
        <p className="text-xs text-gray-500">{photo.width}x{photo.height}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onEdit(photo)}
            className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
          >
            <Pencil size={14} className="mx-auto" />
          </button>
          <button
            onClick={() => onDelete(photo.id)}
            className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
          >
            <Trash2 size={14} className="mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoListRow({ photo, selected, onSelect, onDelete, onEdit }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b hover:bg-gray-50">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(photo.id)}
        className="w-4 h-4 rounded"
      />
      <img
        src={photo.thumbnail_path}
        alt={photo.caption}
        className="w-12 h-12 object-cover rounded"
      />
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{photo.caption || 'Untitled'}</h4>
        <p className="text-xs text-gray-500">{photo.width}x{photo.height} • {photo.category}</p>
      </div>
      <span className="text-sm text-gray-600">{(photo.file_size / 1024).toFixed(0)}KB</span>
      <button
        onClick={() => onEdit(photo)}
        className="p-2 hover:bg-gray-200 rounded"
      >
        <Pencil size={18} className="text-gray-600" />
      </button>
      <button
        onClick={() => onDelete(photo.id)}
        className="p-2 hover:bg-red-100 rounded"
      >
        <Trash2 size={18} className="text-red-600" />
      </button>
    </div>
  );
}

function PhotoEditModal({ photo, onClose, onSave }) {
  const [caption, setCaption] = useState(photo.caption || '');
  const [category, setCategory] = useState(photo.category || 'gallery');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Edit Photo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <img src={photo.thumbnail_path} alt="" className="w-full h-40 object-cover rounded-lg mb-4" />
            <label className="block text-sm font-semibold text-gray-900 mb-2">Caption</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none"
            >
              <option value="gallery">Gallery</option>
              <option value="featured">Featured</option>
              <option value="events">Events</option>
              <option value="promotions">Promotions</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(photo.id, { caption, category })}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
