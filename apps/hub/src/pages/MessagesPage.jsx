import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesPage() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.getDMThreads()
      .then(res => setThreads(res.threads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.searchUsers(q);
      setSearchResults(res.users || []);
    } catch {} finally { setSearching(false); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2 className="page-title">Messages</h2>
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search users to message..."
          className="chat-input"
          style={{ width: '100%' }}
        />
      </div>

      {search.trim() ? (
        <div className="card">
          {searching ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
          ) : searchResults.map(u => (
            <Link key={u.id} to={`/messages/${u.id}`} className="thread-item" style={{ textDecoration: 'none' }}>
              <div className="thread-avatar">
                <div className="post-avatar-placeholder">{(u.first_name || u.username || '?')[0].toUpperCase()}</div>
              </div>
              <div className="thread-info">
                <div className="thread-name">{u.first_name} {u.last_name || ''}</div>
                <div className="thread-preview">@{u.username || u.pnptv_id}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
      ) : threads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No conversations yet. Search for users to start chatting.
        </div>
      ) : (
        <div className="card">
          {threads.map(t => (
            <Link key={t.partner_id} to={`/messages/${t.partner_id}`} className="thread-item" style={{ textDecoration: 'none' }}>
              <div className="thread-avatar">
                <div className="post-avatar-placeholder">{(t.partner_first_name || t.partner_username || '?')[0].toUpperCase()}</div>
              </div>
              <div className="thread-info">
                <div className="thread-name">{t.partner_first_name} <span className="post-author-handle">@{t.partner_username}</span></div>
                <div className="thread-preview">{t.last_message || ''}</div>
              </div>
              <div className="thread-meta">
                <div className="thread-time">{timeAgo(t.last_message_at)}</div>
                {t.unread > 0 && <div className="thread-unread">{t.unread}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
