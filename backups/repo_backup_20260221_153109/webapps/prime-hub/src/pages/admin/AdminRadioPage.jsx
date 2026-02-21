import React, { useState, useEffect } from 'react';
import { Radio, Trash2, Plus, Music, PlayCircle } from 'lucide-react';
import client from '../../api/client';
import AdminRoute from '../../components/AdminRoute';

export default function AdminRadioPage() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [queue, setQueue] = useState([]);
  const [requests, setRequests] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeTab, setActiveTab] = useState('now-playing');
  const [loading, setLoading] = useState(false);
  const [showSelectMedia, setShowSelectMedia] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRadioData();
  }, []);

  const loadRadioData = async () => {
    setLoading(true);
    try {
      const [nowPlayingData, queueData, requestsData] = await Promise.all([
        client.getAdminRadioNowPlaying(),
        client.getAdminRadioQueue(),
        client.getAdminRadioRequests(),
      ]);

      setNowPlaying(nowPlayingData.nowPlaying);
      setQueue(queueData.queue || []);
      setRequests(requestsData.requests || []);
    } catch (error) {
      console.error('Failed to load radio data:', error);
      alert('Failed to load radio data');
    } finally {
      setLoading(false);
    }
  };

  const loadMediaForSelection = async () => {
    try {
      const data = await client.getAdminMedia(`?limit=50&type=audio`);
      setMedia(data.media || []);
    } catch (error) {
      console.error('Failed to load media:', error);
    }
  };

  const handleSetNowPlaying = async (mediaId) => {
    try {
      const data = await client.setAdminRadioNowPlaying({ mediaId });
      setNowPlaying(data.nowPlaying);
      setShowSelectMedia(false);
    } catch (error) {
      console.error('Failed to set now playing:', error);
      alert('Failed to set now playing');
    }
  };

  const handleAddToQueue = async (mediaId) => {
    try {
      const data = await client.addAdminRadioQueue({ mediaId });
      setQueue([...queue, data.queueItem]);
    } catch (error) {
      console.error('Failed to add to queue:', error);
      alert('Failed to add to queue');
    }
  };

  const handleRemoveFromQueue = async (queueId) => {
    try {
      await client.removeAdminRadioQueue(queueId);
      setQueue(queue.filter(q => q.id !== queueId));
    } catch (error) {
      console.error('Failed to remove from queue:', error);
      alert('Failed to remove from queue');
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('Clear entire queue?')) return;

    try {
      await client.clearAdminRadioQueue();
      setQueue([]);
    } catch (error) {
      console.error('Failed to clear queue:', error);
      alert('Failed to clear queue');
    }
  };

  const handleRequestStatus = async (requestId, status) => {
    try {
      await client.updateAdminRadioRequest(requestId, { status });
      setRequests(requests.map(r =>
        r.id === requestId ? { ...r, status } : r
      ));
    } catch (error) {
      console.error('Failed to update request:', error);
      alert('Failed to update request');
    }
  };

  const filteredMedia = media.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-header">
          <h1>Radio Management</h1>
          <button onClick={loadRadioData} disabled={loading} className="btn btn-secondary">
            Refresh
          </button>
        </div>

        <div className="tabs">
          {['now-playing', 'queue', 'requests'].map(tab => (
            <button
              key={tab}
              className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'now-playing' && 'Now Playing'}
              {tab === 'queue' && 'Queue'}
              {tab === 'requests' && 'Requests'}
            </button>
          ))}
        </div>

        {activeTab === 'now-playing' && (
          <div className="card">
            <h2>Currently Playing</h2>
            {nowPlaying ? (
              <div className="now-playing-display">
                {nowPlaying.cover_url && (
                  <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="cover" />
                )}
                <div className="info">
                  <h3>{nowPlaying.title}</h3>
                  <p className="artist">{nowPlaying.artist}</p>
                  <p className="duration">Duration: {nowPlaying.duration || 'N/A'}s</p>
                  <p className="started">Started: {new Date(nowPlaying.started_at).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p>No track currently playing</p>
            )}

            <button
              onClick={() => {
                setShowSelectMedia(!showSelectMedia);
                if (!showSelectMedia) loadMediaForSelection();
              }}
              className="btn btn-primary"
              style={{ marginTop: '15px' }}
            >
              <PlayCircle size={16} />
              Change Now Playing
            </button>

            {showSelectMedia && (
              <div className="media-selection" style={{ marginTop: '15px' }}>
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />

                <div className="media-list">
                  {filteredMedia.length === 0 ? (
                    <p>No media found</p>
                  ) : (
                    filteredMedia.map(m => (
                      <div key={m.id} className="media-item">
                        {m.cover_url && (
                          <img src={m.cover_url} alt={m.title} />
                        )}
                        <div className="details">
                          <h4>{m.title}</h4>
                          <p>{m.artist}</p>
                        </div>
                        <button
                          onClick={() => handleSetNowPlaying(m.id)}
                          className="btn btn-small btn-primary"
                        >
                          Play
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2>Radio Queue ({queue.length})</h2>
              <button onClick={handleClearQueue} className="btn btn-danger">
                Clear Queue
              </button>
            </div>

            {queue.length === 0 ? (
              <p>Queue is empty</p>
            ) : (
              <div className="queue-list">
                {queue.map((item, index) => (
                  <div key={item.id} className="queue-item">
                    <span className="position">{index + 1}</span>
                    {item.cover_url && (
                      <img src={item.cover_url} alt={item.title} />
                    )}
                    <div className="queue-info">
                      <h4>{item.title}</h4>
                      <p>{item.artist}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromQueue(item.id)}
                      className="btn btn-small btn-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowSelectMedia(!showSelectMedia);
                if (!showSelectMedia) loadMediaForSelection();
              }}
              className="btn btn-primary"
              style={{ marginTop: '15px' }}
            >
              <Plus size={16} />
              Add to Queue
            </button>

            {showSelectMedia && (
              <div className="media-selection" style={{ marginTop: '15px' }}>
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />

                <div className="media-list">
                  {filteredMedia.length === 0 ? (
                    <p>No media found</p>
                  ) : (
                    filteredMedia.map(m => (
                      <div key={m.id} className="media-item">
                        {m.cover_url && (
                          <img src={m.cover_url} alt={m.title} />
                        )}
                        <div className="details">
                          <h4>{m.title}</h4>
                          <p>{m.artist}</p>
                        </div>
                        <button
                          onClick={() => handleAddToQueue(m.id)}
                          className="btn btn-small btn-primary"
                        >
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="card">
            <h2>Song Requests</h2>
            {requests.length === 0 ? (
              <p>No pending requests</p>
            ) : (
              <div className="requests-list">
                {requests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="request-item">
                    <div>
                      <h4>{req.song_name}</h4>
                      <p className="artist">{req.artist || 'Unknown Artist'}</p>
                      <p className="requester">Requested by User {req.user_id.substring(0, 8)}</p>
                    </div>
                    <div className="request-actions">
                      <button
                        onClick={() => handleRequestStatus(req.id, 'approved')}
                        className="btn btn-small btn-success"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRequestStatus(req.id, 'rejected')}
                        className="btn btn-small btn-danger"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {requests.filter(r => r.status !== 'pending').length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <h3>History</h3>
                    {requests.filter(r => r.status !== 'pending').map(req => (
                      <div key={req.id} className="request-item-history">
                        <h4>{req.song_name}</h4>
                        <span className={`status-badge ${req.status}`}>{req.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
          .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 2px solid #eee;
          }
          .tab-button {
            padding: 12px 16px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
          }
          .tab-button.active {
            color: #0070f3;
            border-bottom-color: #0070f3;
          }
          .card {
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 20px;
            background: white;
            margin-bottom: 20px;
          }
          .card h2 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
          }
          .now-playing-display {
            display: flex;
            gap: 20px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 8px;
            margin-bottom: 15px;
          }
          .now-playing-display .cover {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
          }
          .now-playing-display .info {
            flex: 1;
          }
          .now-playing-display h3 {
            margin: 0 0 10px;
            font-size: 20px;
          }
          .now-playing-display .artist {
            margin: 0 0 10px;
            color: #666;
          }
          .now-playing-display .duration,
          .now-playing-display .started {
            margin: 0;
            font-size: 12px;
            color: #999;
          }
          .media-selection {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
          }
          .search-input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
          }
          .media-list {
            max-height: 400px;
            overflow-y: auto;
          }
          .media-item {
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 4px;
            margin-bottom: 8px;
            background: white;
          }
          .media-item img {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
          }
          .media-item .details {
            flex: 1;
          }
          .media-item h4 {
            margin: 0 0 4px;
            font-size: 14px;
          }
          .media-item p {
            margin: 0;
            font-size: 12px;
            color: #666;
          }
          .queue-list {
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
          }
          .queue-item {
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 12px;
            border-bottom: 1px solid #eee;
            background: white;
          }
          .queue-item:last-child {
            border-bottom: none;
          }
          .queue-item .position {
            width: 30px;
            text-align: center;
            font-weight: 600;
            color: #0070f3;
          }
          .queue-item img {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
          }
          .queue-item .queue-info {
            flex: 1;
          }
          .queue-item h4 {
            margin: 0 0 4px;
            font-size: 14px;
          }
          .queue-item p {
            margin: 0;
            font-size: 12px;
            color: #666;
          }
          .requests-list {
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
          }
          .request-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid #eee;
            background: white;
          }
          .request-item:last-child {
            border-bottom: none;
          }
          .request-item h4 {
            margin: 0 0 4px;
            font-size: 14px;
          }
          .request-item .artist,
          .request-item .requester {
            margin: 0;
            font-size: 12px;
            color: #666;
          }
          .request-actions {
            display: flex;
            gap: 8px;
          }
          .request-item-history {
            padding: 10px;
            border-bottom: 1px solid #eee;
          }
          .request-item-history h4 {
            margin: 0 0 8px;
            font-size: 14px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.approved {
            background: #d4edda;
            color: #155724;
          }
          .status-badge.rejected {
            background: #f8d7da;
            color: #721c24;
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
          .btn-secondary {
            background: #e0e0e0;
            color: #333;
          }
          .btn-danger {
            background: #ff6b6b;
            color: white;
          }
          .btn-success {
            background: #51cf66;
            color: white;
          }
          .btn-small {
            padding: 6px 8px;
            font-size: 11px;
          }
        `}</style>
      </div>
    </AdminRoute>
  );
}
