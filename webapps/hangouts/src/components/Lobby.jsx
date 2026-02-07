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
    <main className="container">
      <section className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="form-group">
            <div className="form-label">Title</div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g., Late-night vibez"
            />
          </label>

          <label className="form-group">
            <div className="form-label">Visibility</div>
            <div className="segmented-control">
              <button
                className={isPublic ? 'segmented-control-button active' : 'segmented-control-button'}
                onClick={() => setIsPublic(true)}
                type="button"
              >
                <Globe2 size={16} /> Public
              </button>
              <button
                className={!isPublic ? 'segmented-control-button active' : 'segmented-control-button'}
                onClick={() => setIsPublic(false)}
                type="button"
              >
                <Lock size={16} /> Private
              </button>
            </div>
          </label>

          <label className="form-group">
            <div className="form-label">Max participants</div>
            <input
              type="number"
              min={2}
              max={50}
              value={maxParticipants}
              onChange={(event) => setMaxParticipants(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="text-sm text-muted-foreground mt-2">
          Public rooms send a community notification with a join link. Private rooms stay invite-only.
        </div>

        <div className="flex gap-4 mt-6">
          <button className="btn" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create room'}
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </section>

      <h2 className="text-xl font-semibold mb-4">Public rooms</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="spinner-lg" />
          <div className="text-muted-foreground mt-4">Loading rooms...</div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center p-8">
          <div className="text-xl font-semibold mb-2">No public rooms right now</div>
          <div className="text-muted-foreground">Create one and it will appear here.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div className="card" key={room.id}>
              <div className="flex justify-between items-center mb-2">
                <div className="badge">Public</div>
                <button
                  className="btn btn-sm"
                  onClick={() => handleJoin(room.id)}
                  disabled={joining === room.id}
                >
                  {joining === room.id ? 'Joining...' : 'Join'}
                </button>
              </div>
              <div className="text-lg font-semibold">{room.title || 'Untitled room'}</div>
              <div className="text-muted-foreground text-sm">
                Host: <span className="font-mono">{room.creatorName || 'Unknown'}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="badge badge-subtle">
                  {room.currentParticipants || 0}/{room.maxParticipants || 0}
                </span>
                {room.createdAt && (
                  <span className="badge badge-subtle">
                    {formatElapsed(Date.now() - new Date(room.createdAt).getTime())} ago
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast-message">{toast}</div>}
    </main>
  );
}

export default Lobby;