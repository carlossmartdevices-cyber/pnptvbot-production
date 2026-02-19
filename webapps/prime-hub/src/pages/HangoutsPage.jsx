import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Video, Plus, Users, RefreshCw, PhoneOff, LogOut } from 'lucide-react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// Load Jitsi external_api.js once and cache it
let jitsiApiLoaded = false;
let jitsiApiLoadPromise = null;

function loadJitsiApi() {
  if (jitsiApiLoaded) return Promise.resolve();
  if (jitsiApiLoadPromise) return jitsiApiLoadPromise;
  jitsiApiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://8x8.vc/libs/external_api.min.js';
    script.onload = () => { jitsiApiLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Jitsi API'));
    document.head.appendChild(script);
  });
  return jitsiApiLoadPromise;
}

function CallOverlay({ activeCall, userName, onLeave, onEnd }) {
  const containerRef = useRef(null);
  const jitsiRef = useRef(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let destroyed = false;

    const initJitsi = async () => {
      try {
        await loadJitsiApi();
        if (destroyed || !containerRef.current) return;
        if (!window.JitsiMeetExternalAPI) throw new Error('JitsiMeetExternalAPI not available');

        // Parse the jitsiUrl: https://8x8.vc/{appId}/{room}?jwt={token}
        const url = new URL(activeCall.jitsiUrl);
        const parts = url.pathname.split('/').filter(Boolean); // ['appId', 'room']
        const appId = parts[0];
        const room = parts[1];
        const jwt = url.searchParams.get('jwt');

        const api = new window.JitsiMeetExternalAPI('8x8.vc', {
          roomName: `${appId}/${room}`,
          jwt,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'chat', 'raisehand',
              'videoquality', 'tileview', 'select-background', 'stats',
            ],
          },
          userInfo: {
            displayName: userName || 'Guest',
          },
        });

        jitsiRef.current = api;

        api.addEventListener('readyToClose', () => {
          if (!destroyed) onLeave();
        });

        api.addEventListener('videoConferenceLeft', () => {
          if (!destroyed) onLeave();
        });
      } catch (err) {
        if (!destroyed) {
          setLoadError(err.message || 'Failed to load video call');
        }
      }
    };

    initJitsi();

    return () => {
      destroyed = true;
      if (jitsiRef.current) {
        try { jitsiRef.current.dispose(); } catch (_) {}
        jitsiRef.current = null;
      }
    };
  }, [activeCall.jitsiUrl]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: 'rgba(0,0,0,0.8)',
        borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 14 }}>
          <Video size={16} style={{ color: '#30d158' }} />
          <span style={{ fontWeight: 600 }}>{activeCall.title || `${activeCall.creatorName || 'Host'}'s Room`}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeCall.isModerator && (
            <button
              onClick={onEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(255,69,58,0.2)', color: '#ff453a', fontSize: 13, fontWeight: 600,
              }}
            >
              <PhoneOff size={14} /> End Room
            </button>
          )}
          <button
            onClick={onLeave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 600,
            }}
          >
            <LogOut size={14} /> Leave
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div ref={containerRef} style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        {loadError && (
          <div style={{ color: '#ff453a', textAlign: 'center', padding: 40 }}>
            {loadError}
          </div>
        )}
      </div>
    </div>
  );
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
  const [activeCall, setActiveCall] = useState(null); // { jitsiUrl, room, id, isModerator, title, creatorName }

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

  const startCall = (res, { title, creatorName, isModerator }) => {
    if (res.jitsiUrl) {
      setActiveCall({
        jitsiUrl: res.jitsiUrl,
        room: res.room,
        id: res.id,
        isModerator: isModerator ?? false,
        title,
        creatorName,
      });
    } else {
      // Fallback: open public Jitsi in new tab
      window.open(`https://meet.jit.si/${res.room}`, '_blank', 'noopener');
    }
  };

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await api.createHangout({ title: title.trim() || null, isPublic: true });
      setShowCreate(false);
      setTitle('');
      const creatorName = user?.firstName || user?.username || 'You';
      startCall(res, { title: title.trim() || null, creatorName, isModerator: true });
      await loadRooms();
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (room) => {
    setJoiningId(room.id);
    setError('');
    try {
      const res = await api.joinHangout(room.id);
      startCall(res, { title: room.title, creatorName: room.creatorName, isModerator: res.isModerator });
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = useCallback(async () => {
    if (!activeCall) return;
    try { await api.leaveHangout(activeCall.id); } catch (_) {}
    setActiveCall(null);
    loadRooms();
  }, [activeCall, loadRooms]);

  const handleEnd = useCallback(async () => {
    if (!activeCall) return;
    try { await api.endHangout(activeCall.id); } catch (_) {}
    setActiveCall(null);
    loadRooms();
  }, [activeCall, loadRooms]);

  // Show embedded call overlay when active
  if (activeCall) {
    const userName = user?.firstName || user?.username || 'Guest';
    return (
      <CallOverlay
        activeCall={activeCall}
        userName={userName}
        onLeave={handleLeave}
        onEnd={handleEnd}
      />
    );
  }

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
                  onClick={() => handleJoin(room)}
                  disabled={joiningId === room.id}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <Video size={14} />
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
