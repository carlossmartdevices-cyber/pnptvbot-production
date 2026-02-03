import { useEffect, useState } from 'react';
import { Globe2, Lock, RefreshCw, Sparkles } from 'lucide-react';

import { createRoom, fetchPublicRooms, joinRoom } from '../utils/api';
import { buildHangoutsUrl } from '../utils/url';
import { isTelegramWebApp } from '../utils/telegram';

const formatElapsed = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

function Lobby({ telegramUser, role }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState('');
  const [toast, setToast] = useState('');

  const isTelegram = isTelegramWebApp() && telegramUser?.initData;
  const normalizedRole = role?.toUpperCase() || '';
  const canCreate = normalizedRole === 'PRIME' || normalizedRole === 'ADMIN';
  const roomCount = loading ? '—' : rooms.length;
  const participantCount = loading
    ? '—'
    : rooms.reduce((sum, room) => sum + (room.currentParticipants || 0), 0);
  const capacityCount = loading
    ? '—'
    : rooms.reduce((sum, room) => sum + (room.maxParticipants || 0), 0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchPublicRooms();
        if (active) {
          setRooms(data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setRooms([]);
          setError(err?.message || 'Failed to load rooms.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchPublicRooms();
      setRooms(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreate) {
      setToast('Only PRIME/ADMIN users can create rooms.');
      setCreating(false);
      return;
    }

    if (isPublic && !isTelegram) {
      setToast('Open from Telegram to create public rooms.');
      setCreating(false);
      return;
    }
    try {
      setCreating(true);
      const result = await createRoom({
        title,
        maxParticipants,
        isPublic,
        allowGuests: true,
        enforceCamera: false,
      });

      const url = buildHangoutsUrl({
        room: result.room,
        token: result.token,
        uid: result.uid,
        username: telegramUser?.displayName || 'Host',
        type: result.isPublic ? 'public' : 'private',
        appId: result.appId,
        callId: result.callId,
      });

      window.location.href = url;
    } catch (err) {
      setToast(err?.message || 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (callId) => {
    if (!isTelegram) {
      setToast('Open from Telegram to join rooms.');
      return;
    }
    try {
      setJoining(callId);
      const result = await joinRoom(callId);
      const url = buildHangoutsUrl({
        room: result.room,
        token: result.token,
        uid: result.uid,
        username: telegramUser?.displayName || 'Guest',
        type: result.isPublic ? 'public' : 'private',
        appId: result.appId,
        callId: result.callId,
      });
      window.location.href = url;
    } catch (err) {
      setToast(err?.message || 'Failed to join room.');
    } finally {
      setJoining('');
    }
  };

  return (
    <div className="app">
      <div className="bg" />
      <header className="header">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={18} />
          </div>
          <div className="brandText">
            <div className="brandName">PNPtv Hangouts</div>
            <div className="brandTag">Rooms | Live | Private-by-default | 18+</div>
          </div>
        </div>
        <button className="iconBtn" onClick={handleRefresh} disabled={loading} title="Refresh rooms">
          <RefreshCw size={18} />
        </button>
      </header>

      <main className="main">
        <section className="hero">
          <div className="heroTitle">Find a room or start one.</div>
          <div className="heroText">
            {telegramUser ? (
              <>
                Connected as <span className="monoInline">{telegramUser.displayName}</span>. Public
                rooms appear below.
              </>
            ) : (
              <>Open from Telegram for instant join and creator credit.</>
            )}
          </div>
          <div className="chipRow">
            <span className={`chip ${isTelegram ? 'chipSuccess' : 'chipMuted'}`}>
              {isTelegram ? 'Telegram linked' : 'Telegram required'}
            </span>
            <span className={`chip ${canCreate ? 'chipSuccess' : 'chipWarn'}`}>
              {canCreate ? 'Creator access' : 'Viewer access'}
            </span>
            <span className="chip chipMuted">Instant join links</span>
          </div>
          <div className="statRow">
            <div className="statCard">
              <div className="statValue">{roomCount}</div>
              <div className="statLabel">Public rooms</div>
            </div>
            <div className="statCard">
              <div className="statValue">{participantCount}</div>
              <div className="statLabel">Guests online</div>
            </div>
            <div className="statCard">
              <div className="statValue">{capacityCount}</div>
              <div className="statLabel">Total capacity</div>
            </div>
          </div>
          {!isTelegram && (
            <div className="notice info">
              This feature requires Telegram authentication. Open this link inside Telegram to join or
              create public rooms.
            </div>
          )}
          {!canCreate && (
            <div className="notice warning">
              Room creation is restricted to PRIME/ADMIN members in the full webapp.
            </div>
          )}
        </section>

        <section className="card glass">
          <div className="formGrid">
            <label className="field">
              <div className="label">Title</div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Late-night vibez"
              />
            </label>

            <label className="field">
              <div className="label">Visibility</div>
              <div className="segmented">
                <button
                  className={isPublic ? 'seg active' : 'seg'}
                  onClick={() => setIsPublic(true)}
                  type="button"
                >
                  <Globe2 size={16} /> Public
                </button>
                <button
                  className={!isPublic ? 'seg active' : 'seg'}
                  onClick={() => setIsPublic(false)}
                  type="button"
                >
                  <Lock size={16} /> Private
                </button>
              </div>
            </label>

            <label className="field">
              <div className="label">Max participants</div>
              <input
                type="number"
                min={2}
                max={50}
                value={maxParticipants}
                onChange={(event) => setMaxParticipants(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="hint">
            Public rooms send a community notification with a join link. Private rooms stay invite-only.
          </div>

          <div className="heroActions">
            <button className="btn" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create room'}
            </button>
            <button className="btn btnGhost" onClick={handleRefresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </section>

        <div className="sectionTitle">Public rooms</div>

        {error && <div className="notice error">{error}</div>}

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <div className="muted">Loading rooms...</div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty">
            <div className="emptyTitle">No public rooms right now</div>
            <div className="emptyText">Create one and it will appear here.</div>
          </div>
        ) : (
          <div className="grid">
            {rooms.map((room) => (
              <div className="card" key={room.id}>
                <div className="cardTop">
                  <div className="pill">Public</div>
                  <button
                    className="btn btnSmall"
                    onClick={() => handleJoin(room.id)}
                    disabled={joining === room.id}
                  >
                    {joining === room.id ? 'Joining...' : 'Join'}
                  </button>
                </div>
                <div className="cardTitle">{room.title || 'Untitled room'}</div>
                <div className="cardDesc">
                  Host: <span className="monoInline">{room.creatorName || 'Unknown'}</span>
                </div>
                <div className="cardMeta">
                  <span className="pill subtle">
                    {room.currentParticipants || 0}/{room.maxParticipants || 0}
                  </span>
                  {room.createdAt && (
                    <span className="pill subtle">
                      {formatElapsed(Date.now() - new Date(room.createdAt).getTime())} ago
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default Lobby;
