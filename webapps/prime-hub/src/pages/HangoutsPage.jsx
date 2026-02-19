import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Video, Plus, Users, RefreshCw, ExternalLink } from 'lucide-react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function HangoutsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.getPublicHangouts();
      setRooms(res.rooms || []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 30000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const openCall = (jitsiUrl, room) => {
    if (jitsiUrl) {
      window.open(jitsiUrl, '_blank', 'noopener');
    } else {
      window.open(`https://meet.jit.si/${room}`, '_blank', 'noopener');
    }
  };

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await api.createHangout({ title: title.trim() || null, isPublic: true });
      setShowCreate(false);
      setTitle('');
      openCall(res.jitsiUrl, res.room);
      await loadRooms();
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (callId) => {
    setJoiningId(callId);
    try {
      const res = await api.joinHangout(callId);
      openCall(res.jitsiUrl, res.room);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Hangouts</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadRooms}
            className="btn-secondary"
            style={{ padding: '6px 10px' }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { setShowCreate(s => !s); setError(''); }}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> New Room
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 12, padding: 16 }}>
          <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
            Create a Room
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Room title (optional)"
            maxLength={80}
            className="chat-input"
            style={{ width: '100%', marginBottom: 10 }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Video size={15} />
              {creating ? 'Starting...' : 'Start Room'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && !showCreate && (
        <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : rooms.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Video size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            No active rooms. Start one!
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> New Room
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rooms.map(room => (
            <div key={room.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {room.title || `${room.creatorName}'s Room`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} />
                      {room.currentParticipants ?? 0}/{room.maxParticipants}
                    </span>
                    <span>by {room.creatorName}</span>
                    <span>{timeAgo(room.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(room.id)}
                  disabled={joiningId === room.id}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <ExternalLink size={14} />
                  {joiningId === room.id ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
