import React, { useState, useEffect } from 'react';
import { Download, Radio, Loader, AlertCircle } from 'lucide-react';
import client from '../../api/client';
import './AmpacheCatalog.css';

export default function AmpacheCatalog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [type, setType] = useState('songs');
  const [offset, setOffset] = useState(0);
  const [importing, setImporting] = useState(null); // ID of item being imported
  const [syncing, setSyncing] = useState(false);
  const [limit] = useState(50);

  useEffect(() => {
    loadCatalog();
  }, [type, offset]);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, offset, limit });
      const data = await client.getAmpacheCatalog(`?${params}`);
      setItems(data.data || []);
    } catch (err) {
      console.error('Failed to load Ampache catalog:', err);
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item, setPrime = false) => {
    setImporting(item.id);
    try {
      const importData = {
        ampache_id: item.id,
        type: type === 'videos' ? 'video' : 'song',
        title: item.title || `${item.name || 'Unknown'} - ${item.artist || ''}`,
        artist: (item.artist?.name || item.artist) || '',
        cover_url: item.art || null,
        duration: item.time || 0,
        is_prime: setPrime,
      };

      await client.importAmpacheItem(importData);
      alert('Item imported successfully');

      // Remove from UI
      setItems(items.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Failed to import item:', err);
      alert('Failed to import item');
    } finally {
      setImporting(null);
    }
  };

  const handleSetAsRadio = async (item) => {
    if (!confirm(`Set "${item.title || item.name}" as current radio track?`)) return;

    try {
      await client.setAmpacheRadioTrack({
        ampache_id: item.id,
        title: item.title || `${item.name || 'Unknown'}`,
        artist: (item.artist?.name || item.artist) || '',
        cover_url: item.art || null,
        duration: item.time || 0,
      });
      alert('Radio track updated');
    } catch (err) {
      console.error('Failed to set radio track:', err);
      alert('Failed to set radio track');
    }
  };

  const handleBulkSync = async () => {
    if (!confirm('Sync entire Ampache catalog? This may take a while.')) return;

    setSyncing(true);
    try {
      const data = await client.syncAmpacheCatalog({ limit: 200 });
      alert(`Synced ${data.imported} items from Ampache`);
      setOffset(0);
      loadCatalog();
    } catch (err) {
      console.error('Failed to sync catalog:', err);
      alert('Failed to sync catalog');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="ampache-catalog">
      <div className="catalog-header">
        <div className="catalog-info">
          <h3>Ampache Catalog Browser</h3>
          <p>Browse and import songs and videos from Ampache server</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleBulkSync}
          disabled={syncing || loading}
        >
          {syncing ? <Loader size={16} className="spinner" /> : <Download size={16} />}
          {syncing ? 'Syncing...' : 'Sync All'}
        </button>
      </div>

      <div className="catalog-controls">
        <div className="type-selector">
          <button
            className={`type-btn ${type === 'songs' ? 'active' : ''}`}
            onClick={() => { setType('songs'); setOffset(0); }}
            disabled={loading}
          >
            🎵 Songs
          </button>
          <button
            className={`type-btn ${type === 'videos' ? 'active' : ''}`}
            onClick={() => { setType('videos'); setOffset(0); }}
            disabled={loading}
          >
            🎬 Videos
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="catalog-items">
        {loading ? (
          <div className="loading">
            <Loader className="spinner" size={32} />
            <p>Loading {type}...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>No {type} found in catalog</p>
          </div>
        ) : (
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Artist</th>
                <th>Duration</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="catalog-row">
                  <td className="title-cell">
                    {item.art && (
                      <img src={item.art} alt={item.title} className="item-thumb" />
                    )}
                    <span>{item.title || item.name || 'Unknown'}</span>
                  </td>
                  <td>{(item.artist?.name || item.artist) || '—'}</td>
                  <td>{item.time ? `${Math.round(item.time / 60)}:${(item.time % 60).toString().padStart(2, '0')}` : '—'}</td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        className="btn btn-small btn-import"
                        onClick={() => handleImport(item, false)}
                        disabled={importing === item.id || syncing}
                        title="Import to media library"
                      >
                        {importing === item.id ? <Loader size={14} className="spinner" /> : <Download size={14} />}
                        Import
                      </button>
                      {type === 'songs' && (
                        <button
                          className="btn btn-small btn-radio"
                          onClick={() => handleSetAsRadio(item)}
                          disabled={importing === item.id || syncing}
                          title="Set as current radio track"
                        >
                          <Radio size={14} />
                          Radio
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {items.length > 0 && (
        <div className="catalog-pagination">
          <button
            className="btn btn-small"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
          >
            ← Previous
          </button>
          <span className="page-info">Items {offset} - {offset + items.length}</span>
          <button
            className="btn btn-small"
            onClick={() => setOffset(offset + limit)}
            disabled={items.length < limit || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
