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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <section className="bg-color-2 p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="form-group">
            <label className="block text-sm font-medium text-muted-color mb-2">Title</label>
            <input
              className="w-full px-4 py-2 bg-color border border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary-color"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g., Late-night vibez"
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-muted-color mb-2">Visibility</label>
            <div className="flex rounded-md bg-color border border-color p-1">
              <button
                className={`w-1/2 py-2 text-sm rounded-md transition-colors ${isPublic ? 'bg-primary-color text-white' : 'text-muted-color'}`}
                onClick={() => setIsPublic(true)}
                type="button"
              >
                <Globe2 size={16} className="inline-block mr-2" /> Public
              </button>
              <button
                className={`w-1/2 py-2 text-sm rounded-md transition-colors ${!isPublic ? 'bg-primary-color text-white' : 'text-muted-color'}`}
                onClick={() => setIsPublic(false)}
                type="button"
              >
                <Lock size={16} className="inline-block mr-2" /> Private
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-muted-color mb-2">Max participants</label>
            <input
              className="w-full px-4 py-2 bg-color border border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary-color"
              type="number"
              min={2}
              max={50}
              value={maxParticipants}
              onChange={(event) => setMaxParticipants(Number(event.target.value))}
            />
          </div>
        </div>

        <p className="text-sm text-muted-color mt-4">
          Public rooms send a community notification with a join link. Private rooms stay invite-only.
        </p>

        <div className="flex gap-4 mt-6">
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create room'}
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </section>

      <h2 className="text-2xl font-bold mb-4">Public rooms</h2>

      {error && <div className="bg-destructive-color/20 text-destructive-color p-4 rounded-md mb-4">{error}</div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="spinner-lg" />
          <p className="text-muted-color mt-4">Loading rooms...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center p-8 bg-color-2 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-2">No public rooms right now</h3>
          <p className="text-muted-color">Create one and it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div className="bg-color-2 p-6 rounded-lg shadow-md" key={room.id}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-medium bg-secondary-color/20 text-secondary-color px-2 py-1 rounded-full">Public</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleJoin(room.id)}
                  disabled={joining === room.id}
                >
                  {joining === room.id ? 'Joining...' : 'Join'}
                </button>
              </div>
              <h3 className="text-lg font-bold mb-2">{room.title || 'Untitled room'}</h3>
              <p className="text-sm text-muted-color mb-4">
                Host: <span className="font-mono">{room.creatorName || 'Unknown'}</span>
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-color">
                <span>
                  {room.currentParticipants || 0}/{room.maxParticipants || 0} participants
                </span>
                {room.createdAt && (
                  <span>
                    {formatElapsed(Date.now() - new Date(room.createdAt).getTime())} ago
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 right-8 bg-color-2 text-color px-6 py-3 rounded-lg shadow-lg animate-fade-in-out">
          {toast}
        </div>
      )}
    </main>
  );
}

export default Lobby;