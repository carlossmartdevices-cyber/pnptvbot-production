import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { User, LogOut, Crown, Calendar, Globe, Instagram, Twitter, Edit2, Check, X } from 'lucide-react';

function SubscriptionBadge({ status }) {
  const map = {
    active: { label: 'Active', className: 'active' },
    lifetime: { label: 'Lifetime', className: 'active' },
    trial: { label: 'Trial', className: 'active' },
    expired: { label: 'Expired', className: 'expired' },
    cancelled: { label: 'Cancelled', className: 'expired' },
  };
  const info = map[status] || { label: status || 'Inactive', className: 'inactive' };
  return <span className={`sub-badge ${info.className}`}>{info.label}</span>;
}

function Field({ label, value, editing, name, form, onChange, placeholder, textarea }) {
  if (!editing) {
    if (!value) return null;
    return (
      <div className="profile-row">
        <span className="profile-row-label">{label}</span>
        <span className="profile-row-value">{value}</span>
      </div>
    );
  }
  const props = { name, value: form[name] ?? '', onChange, placeholder: placeholder || label, className: 'profile-edit-input' };
  return (
    <div className="profile-row profile-row-edit">
      <span className="profile-row-label">{label}</span>
      {textarea
        ? <textarea {...props} rows={3} className="profile-edit-textarea" />
        : <input {...props} />}
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});

  useEffect(() => {
    let cancelled = false;
    api.getProfile()
      .then(data => { if (!cancelled && data.success) setProfile(data.profile); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const startEdit = () => {
    setForm({
      firstName:       profile?.firstName || '',
      lastName:        profile?.lastName  || '',
      bio:             profile?.bio       || '',
      locationText:    profile?.locationText || '',
      interests:       Array.isArray(profile?.interests) ? profile.interests.join(', ') : (profile?.interests || ''),
      xHandle:         profile?.xHandle         || '',
      instagramHandle: profile?.instagramHandle || '',
      tiktokHandle:    profile?.tiktokHandle    || '',
    });
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(''); };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateProfile(form);
      // Refresh profile from server
      const data = await api.getProfile();
      if (data.success) setProfile(data.profile);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Layout>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* Profile Header */}
          <div className="card profile-header-card">
            <div className="profile-avatar">
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
                {(profile?.firstName || user?.firstName || '?')[0].toUpperCase()}
              </div>
            </div>
            {editing ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" className="profile-edit-input" style={{ maxWidth: 130 }} />
                <input name="lastName"  value={form.lastName}  onChange={handleChange} placeholder="Last name"  className="profile-edit-input" style={{ maxWidth: 130 }} />
              </div>
            ) : (
              <div className="profile-name">
                {profile?.firstName || user?.firstName || ''} {profile?.lastName || user?.lastName || ''}
              </div>
            )}
            <div className="profile-username">@{profile?.username || user?.username || 'user'}</div>
            {editing ? (
              <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Bio (optional)" rows={3} className="profile-edit-textarea" style={{ marginTop: 8 }} />
            ) : (
              profile?.bio && <p className="profile-bio">{profile.bio}</p>
            )}

            {error && <div style={{ color: '#ff453a', fontSize: 13, marginTop: 6 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center' }}>
              {editing ? (
                <>
                  <button className="btn-secondary" onClick={cancelEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <X size={14} /> Cancel
                  </button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <Check size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button className="btn-secondary" onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Edit2 size={14} /> Edit Profile
                </button>
              )}
            </div>

            <div className="profile-stats" style={{ marginTop: 16 }}>
              <div className="profile-stat">
                <div className="profile-stat-value">
                  <Crown size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </div>
                <div className="profile-stat-label">
                  <SubscriptionBadge status={profile?.subscriptionStatus || user?.subscriptionStatus} />
                </div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">
                  <Calendar size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </div>
                <div className="profile-stat-label">Since {formatDate(profile?.memberSince)}</div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="section-label">Account</div>
          <div className="card profile-section">
            <div className="profile-row">
              <span className="profile-row-label">Subscription</span>
              <span className="profile-row-value">{profile?.subscriptionPlan || 'None'}</span>
            </div>
            {profile?.subscriptionExpires && (
              <div className="profile-row">
                <span className="profile-row-label">Expires</span>
                <span className="profile-row-value">{formatDate(profile.subscriptionExpires)}</span>
              </div>
            )}
            <div className="profile-row">
              <span className="profile-row-label">Language</span>
              <span className="profile-row-value">{profile?.language === 'es' ? 'Español' : 'English'}</span>
            </div>
            <Field label="Location" value={profile?.locationText} editing={editing} name="locationText" form={form} onChange={handleChange} placeholder="Your city or area" />
            <Field label="Interests" value={Array.isArray(profile?.interests) ? profile.interests.join(', ') : profile?.interests} editing={editing} name="interests" form={form} onChange={handleChange} placeholder="e.g. music, travel, art" />
          </div>

          {/* Social Links */}
          <div className="section-label">Social</div>
          <div className="card profile-section">
            <Field label="X (Twitter)" value={profile?.xHandle ? `@${profile.xHandle}` : null} editing={editing} name="xHandle" form={form} onChange={handleChange} placeholder="username (without @)" />
            <Field label="Instagram"   value={profile?.instagramHandle ? `@${profile.instagramHandle}` : null} editing={editing} name="instagramHandle" form={form} onChange={handleChange} placeholder="username (without @)" />
            <Field label="TikTok"      value={profile?.tiktokHandle ? `@${profile.tiktokHandle}` : null} editing={editing} name="tiktokHandle" form={form} onChange={handleChange} placeholder="username (without @)" />
            {!editing && !profile?.xHandle && !profile?.instagramHandle && !profile?.tiktokHandle && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>No social handles yet. Click Edit Profile to add them.</div>
            )}
          </div>

          {/* Logout */}
          <button className="btn-logout" onClick={logout}>
            <LogOut size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Sign Out
          </button>
        </>
      )}
    </Layout>
  );
}
