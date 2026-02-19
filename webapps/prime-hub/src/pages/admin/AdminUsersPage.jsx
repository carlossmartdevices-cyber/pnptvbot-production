import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { Search, Ban, Edit2, AlertCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadUsers = (pageNum = 1) => {
    setLoading(true);
    setError('');
    api.listAdminUsers(pageNum, search)
      .then(data => {
        setUsers(data.users || []);
        setPagination(data.pagination || {});
        setPage(pageNum);
      })
      .catch(err => setError(err.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(1);
  }, [search]);

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      subscriptionStatus: user.subscription_status,
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAdminUser(selectedUser.id, editForm);
      setEditMode(false);
      loadUsers(page);
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async (userId, ban) => {
    if (!confirm(`Are you sure you want to ${ban ? 'ban' : 'unban'} this user?`)) return;
    try {
      await api.banAdminUser(userId, ban, 'Admin action');
      loadUsers(page);
    } catch (err) {
      setError(err.message || 'Failed to ban user');
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>User Management</h1>

        <div style={{ marginBottom: 24 }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search users by username, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 40,
                paddingRight: 16,
                paddingTop: 12,
                paddingBottom: 12,
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            />
          </div>
        </div>

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
        ) : users.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No users found
          </div>
        ) : (
          <>
            <div className="card" style={{ overflow: 'x-auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Username</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Email</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Role</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Sub Status</th>
                    <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: 12 }}>{user.username}</td>
                      <td style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</td>
                      <td style={{ padding: 12 }}><span style={{ fontSize: 11, backgroundColor: 'var(--surface-2)', padding: '4px 8px', borderRadius: 4 }}>{user.role || 'user'}</span></td>
                      <td style={{ padding: 12 }}>{user.status || 'active'}</td>
                      <td style={{ padding: 12 }}>{user.subscription_status || 'free'}</td>
                      <td style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(user)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Edit user"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleBan(user.id, user.status !== 'banned')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: user.status === 'banned' ? '#34C759' : '#FF453A',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title={user.status === 'banned' ? 'Unban user' : 'Ban user'}
                        >
                          <Ban size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => loadUsers(p)}
                    style={{
                      padding: '8px 12px',
                      border: page === p ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      backgroundColor: page === p ? 'var(--accent)' : 'transparent',
                      color: page === p ? '#fff' : 'var(--text-primary)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editMode && selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ padding: 24, maxWidth: 400, width: '90%' }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Edit User</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="profile-edit-input"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="profile-edit-input"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Subscription Status</label>
              <select
                value={editForm.subscriptionStatus || ''}
                onChange={(e) => setEditForm({ ...editForm, subscriptionStatus: e.target.value })}
                className="profile-edit-input"
              >
                <option value="free">Free</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setEditMode(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
