import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Radio, Plus, Eye, Mic, MicOff, Video, VideoOff, PhoneOff, LogOut, RefreshCw, Clock } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(4); // suppress verbose logs in production

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Stream overlay (host + viewer) ────────────────────────────────────────────

function StreamOverlay({ session, userName, isHost, onLeave, onEnd }) {
  const containerRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(session.currentViewers ?? 0);
  const [error, setError] = useState('');

  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      try {
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        clientRef.current = client;

        await client.setClientRole(isHost ? 'host' : 'audience');
        await client.join(
          session.appId,
          session.channelName,
          isHost ? session.hostToken : session.viewerToken,
          null
        );

        if (isHost) {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          if (destroyed) {
            audioTrack.close();
            videoTrack.close();
            return;
          }
          localTracksRef.current = { audio: audioTrack, video: videoTrack };
          await client.publish([audioTrack, videoTrack]);
          if (containerRef.current) videoTrack.play(containerRef.current);
          setIsLive(true);
        } else {
          client.on('user-published', async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === 'video' && containerRef.current) {
              user.videoTrack.play(containerRef.current);
              setIsLive(true);
            }
            if (mediaType === 'audio') user.audioTrack.play();
          });
          client.on('user-unpublished', () => setIsLive(false));
        }

        client.on('user-joined', () => setViewerCount(c => c + 1));
        client.on('user-left', () => setViewerCount(c => Math.max(0, c - 1)));
      } catch (err) {
        if (!destroyed) setError(err.message || 'Failed to connect to stream');
      }
    };

    init();

    return () => {
      destroyed = true;
      const tracks = localTracksRef.current;
      if (tracks.audio) { try { tracks.audio.stop(); tracks.audio.close(); } catch (_) {} }
      if (tracks.video) { try { tracks.video.stop(); tracks.video.close(); } catch (_) {} }
      if (clientRef.current) { try { clientRef.current.leave(); } catch (_) {} clientRef.current = null; }
    };
  }, []);

  const toggleMic = async () => {
    const track = localTracksRef.current.audio;
    if (track) { await track.setEnabled(!micOn); setMicOn(v => !v); }
  };

  const toggleCam = async () => {
    const track = localTracksRef.current.video;
    if (track) { await track.setEnabled(!camOn); setCamOn(v => !v); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: 'rgba(0,0,0,0.85)',
        borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontSize: 14 }}>
          {isLive
            ? <span style={{ background: '#ff3b30', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>LIVE</span>
            : <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Connecting…</span>
          }
          <span style={{ fontWeight: 600 }}>{session.title || (isHost ? 'Your Stream' : `${session.hostName || 'Host'}'s Stream`)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            <Eye size={13} /> {viewerCount}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isHost && (
            <>
              <button onClick={toggleMic} style={ctrlBtn(micOn)}>
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button onClick={toggleCam} style={ctrlBtn(camOn)}>
                {camOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
              <button onClick={onEnd} style={ctrlBtn(false, '#ff3b30')}>
                <PhoneOff size={16} /> End
              </button>
            </>
          )}
          {!isHost && (
            <button onClick={onLeave} style={ctrlBtn(false)}>
              <LogOut size={16} /> Leave
            </button>
          )}
        </div>
      </div>

      {/* Video area */}
      <div ref={containerRef} style={{ flex: 1, width: '100%', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {error && <div style={{ color: '#ff453a', textAlign: 'center', padding: 40 }}>{error}</div>}
        {!isLive && !error && (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
            <p>{isHost ? 'Starting your broadcast…' : 'Waiting for host…'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ctrlBtn(active, bg) {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: bg || (active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)'),
    color: bg ? '#fff' : (active ? '#fff' : 'rgba(255,255,255,0.8)'),
  };
}

// ── Go Live modal ──────────────────────────────────────────────────────────────

function GoLiveModal({ onStart, onCancel }) {
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    setError('');
    setStarting(true);
    try {
      const res = await api.startLiveStream({ title: title.trim() || null });
      onStart(res);
    } catch (err) {
      setError(err.message || 'Failed to start stream');
      setStarting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--text)' }}>
          Go Live
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Stream title (optional)"
          maxLength={100}
          className="chat-input"
          style={{ width: '100%', marginBottom: 12 }}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          autoFocus
        />
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleStart} disabled={starting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={15} /> {starting ? 'Starting…' : 'Start Stream'}
          </button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LivePage() {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoLive, setShowGoLive] = useState(false);
  const [activeSession, setActiveSession] = useState(null); // { channelName, appId, hostToken|viewerToken, isHost, ... }
  const [isHost, setIsHost] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');

  const loadStreams = useCallback(async () => {
    try {
      const res = await api.getLiveStreams();
      setStreams(res.streams || []);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();
    const iv = setInterval(loadStreams, 30000);
    return () => clearInterval(iv);
  }, [loadStreams]);

  const handleGoLive = (res) => {
    setShowGoLive(false);
    setIsHost(true);
    setActiveSession({ ...res, isHost: true });
  };

  const handleWatch = async (stream) => {
    setJoiningId(stream.streamId);
    setError('');
    try {
      const res = await api.joinLiveStream(stream.streamId);
      setIsHost(false);
      setActiveSession({ ...res, isHost: false });
    } catch (err) {
      setError(err.message || 'Failed to join stream');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = useCallback(async () => {
    if (activeSession) {
      api.leaveLiveStream(activeSession.streamId).catch(() => {});
    }
    setActiveSession(null);
    loadStreams();
  }, [activeSession, loadStreams]);

  const handleEnd = useCallback(async () => {
    if (activeSession) {
      api.endLiveStream(activeSession.streamId).catch(() => {});
    }
    setActiveSession(null);
    loadStreams();
  }, [activeSession, loadStreams]);

  if (activeSession) {
    return (
      <StreamOverlay
        session={activeSession}
        userName={user?.firstName || user?.username || 'Guest'}
        isHost={isHost}
        onLeave={handleLeave}
        onEnd={handleEnd}
      />
    );
  }

  return (
    <Layout>
      {showGoLive && <GoLiveModal onStart={handleGoLive} onCancel={() => setShowGoLive(false)} />}

      <div className="page-header">
        <h2 className="page-title">Live</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadStreams} className="btn-secondary" style={{ padding: '6px 10px' }} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => { setShowGoLive(true); setError(''); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Go Live
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : streams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Radio size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No live streams right now.</div>
          <button onClick={() => setShowGoLive(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Be the first to go live
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {streams.map(stream => (
            <div key={stream.streamId} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ background: '#ff3b30', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>LIVE</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stream.title || `${stream.hostName}'s Stream`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={13} /> {stream.currentViewers ?? 0}
                    </span>
                    <span>by {stream.hostName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={12} /> {timeAgo(stream.startedAt || stream.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleWatch(stream)}
                  disabled={joiningId === stream.streamId}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <Eye size={14} />
                  {joiningId === stream.streamId ? 'Joining…' : 'Watch'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
