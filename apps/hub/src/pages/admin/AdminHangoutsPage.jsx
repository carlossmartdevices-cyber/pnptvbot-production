import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { XCircle, AlertCircle, Users } from 'lucide-react';

export default function AdminHangoutsPage() {
  const [hangouts, setHangouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHangouts = () => {
    setLoading(true);
    api.listAdminHangouts()
      .then(data => setHangouts(data.hangouts || []))
      .catch(err => setError(err.message || 'Failed to load hangouts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHangouts();
    const interval = setInterval(loadHangouts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleEnd = async (hangoutId) => {
    if (!confirm('End this hangout room?')) return;
    try {
      await api.endAdminHangout(hangoutId);
      loadHangouts();
    } catch (err) {
      setError(err.message || 'Failed to end hangout');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Manage Hangouts</h1>

        {error && (
          <div className="card" style={{ padding: 16, marginBottom: 24, color: '#ff453a' }}>
            <AlertCircle size={18} style={{ display: 'inline', marginRight: 8 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : hangouts.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active hangout rooms
          </div>
        ) : (
          <>
            {hangouts.map(hangout => (
              <div key={hangout.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                      {hangout.title || 'Untitled Room'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Created by: {hangout.creatorName}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
                        {hangout.currentParticipants} / {hangout.maxParticipants} participants
                      </div>
                      <div>
                        {hangout.isPublic ? '🌍 Public' : '🔒 Private'}
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        Created: {new Date(hangout.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnd(hangout.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF453A',
                      cursor: 'pointer',
                      padding: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                    title="End hangout"
                  >
                    <XCircle size={18} />
                    End Room
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Layout>
  );
}
