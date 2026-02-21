import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { MapPin, Search, MessageSquare, RefreshCw } from 'lucide-react';

const RADII = [1, 5, 10, 25, 50];

function distanceLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function NearbyPage() {
  const [status, setStatus]   = useState('idle'); // idle | locating | searching | done | error
  const [users, setUsers]     = useState([]);
  const [radius, setRadius]   = useState(5);
  const [coords, setCoords]   = useState(null);
  const [message, setMessage] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Geolocation is not supported by your browser.');
      return;
    }
    setStatus('locating');
    setMessage('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ latitude, longitude });
        setStatus('searching');
        // Register location then search
        api.nearbyUpdateLocation(latitude, longitude, accuracy)
          .catch(() => {}) // non-fatal
          .then(() => api.nearbySearch(latitude, longitude, radius))
          .then(result => {
            setUsers(result.users || result.nearby || []);
            setStatus('done');
          })
          .catch(err => {
            setStatus('error');
            setMessage(err.message || 'Failed to search nearby users.');
          });
      },
      err => {
        setStatus('error');
        setMessage(
          err.code === 1 ? 'Location access denied. Please allow location in your browser settings.'
          : err.code === 2 ? 'Location unavailable. Try again.'
          : 'Location request timed out. Try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, [radius]);

  const refresh = useCallback(() => {
    if (!coords) { locate(); return; }
    setStatus('searching');
    api.nearbySearch(coords.latitude, coords.longitude, radius)
      .then(result => { setUsers(result.users || result.nearby || []); setStatus('done'); })
      .catch(err  => { setStatus('error'); setMessage(err.message || 'Search failed.'); });
  }, [coords, radius, locate]);

  return (
    <Layout>
      <div className="section-label">Nearby</div>

      {/* Controls */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <MapPin size={16} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Radius:</span>
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '4px 8px', fontSize: 13 }}
          >
            {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
          </select>
        </div>
        <button
          className="btn-primary"
          onClick={status === 'done' ? refresh : locate}
          disabled={status === 'locating' || status === 'searching'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
        >
          {status === 'locating' || status === 'searching' ? (
            <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {status === 'locating' ? 'Locating…' : 'Searching…'}</>
          ) : status === 'done' ? (
            <><RefreshCw size={14} /> Refresh</>
          ) : (
            <><Search size={14} /> Find Nearby</>
          )}
        </button>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="card" style={{ color: '#ff453a', fontSize: 14, padding: '14px 16px' }}>
          {message}
        </div>
      )}

      {/* Empty state */}
      {status === 'done' && users.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          <MapPin size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
          <p>No users found within {radius} km.</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try increasing the radius.</p>
        </div>
      )}

      {/* Idle hint */}
      {status === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          <MapPin size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
          <p>Tap <strong>Find Nearby</strong> to discover members around you.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Your location is only shared while searching.</p>
        </div>
      )}

      {/* Results */}
      {status === 'done' && users.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0 8px' }}>
            {users.length} member{users.length !== 1 ? 's' : ''} within {radius} km
          </div>
          {users.map(u => (
            <div key={u.id || u.userId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {(u.name || u.username || '?')[0].toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/wall/${u.id || u.userId}`} style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', textDecoration: 'none' }}>
                  {u.name || u.username || 'User'}
                </Link>
                {u.username && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</div>}
                {(u.distance_km !== undefined || u.distance !== undefined) && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                    <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {distanceLabel(u.distance_km ?? u.distance)}
                  </div>
                )}
              </div>
              {/* DM button */}
              <Link to={`/messages/${u.id || u.userId}`} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 10px', flexShrink: 0, textDecoration: 'none' }}>
                <MessageSquare size={13} /> DM
              </Link>
            </div>
          ))}
        </>
      )}
    </Layout>
  );
}
