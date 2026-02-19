import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { User, LogOut, Crown, Calendar, Globe, Instagram, Twitter } from 'lucide-react';

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

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getProfile()
      .then(data => {
        if (!cancelled && data.success) setProfile(data.profile);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    await logout();
    // redirect handled by useAuth logout()
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
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
              {(profile?.photoUrl || user?.photoUrl) ? (
                <img src={profile?.photoUrl || user?.photoUrl} alt="Profile" />
              ) : (
                <User size={40} color="#8E8E93" />
              )}
            </div>
            <div className="profile-name">
              {profile?.firstName || user?.firstName || ''} {profile?.lastName || user?.lastName || ''}
            </div>
            <div className="profile-username">
              @{profile?.username || user?.username || 'user'}
            </div>
            {profile?.bio && (
              <p className="profile-bio">{profile.bio}</p>
            )}
            <div className="profile-stats">
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
                <div className="profile-stat-label">
                  Member since {formatDate(profile?.memberSince)}
                </div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="section-label">Account</div>
          <div className="card profile-section">
            <div className="profile-row">
              <span className="profile-row-label">Subscription Plan</span>
              <span className="profile-row-value">
                {profile?.subscriptionPlan || 'None'}
              </span>
            </div>
            {profile?.subscriptionExpires && (
              <div className="profile-row">
                <span className="profile-row-label">Expires</span>
                <span className="profile-row-value">{formatDate(profile.subscriptionExpires)}</span>
              </div>
            )}
            <div className="profile-row">
              <span className="profile-row-label">Language</span>
              <span className="profile-row-value">
                {profile?.language === 'es' ? 'Espanol' : 'English'}
              </span>
            </div>
            {profile?.locationText && (
              <div className="profile-row">
                <span className="profile-row-label">Location</span>
                <span className="profile-row-value">{profile.locationText}</span>
              </div>
            )}
          </div>

          {/* Social Links */}
          {(profile?.xHandle || profile?.instagramHandle || profile?.tiktokHandle) && (
            <>
              <div className="section-label">Social</div>
              <div className="card profile-section">
                {profile?.xHandle && (
                  <div className="profile-row">
                    <span className="profile-row-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Twitter size={14} /> X (Twitter)
                    </span>
                    <span className="profile-row-value">@{profile.xHandle}</span>
                  </div>
                )}
                {profile?.instagramHandle && (
                  <div className="profile-row">
                    <span className="profile-row-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Instagram size={14} /> Instagram
                    </span>
                    <span className="profile-row-value">@{profile.instagramHandle}</span>
                  </div>
                )}
                {profile?.tiktokHandle && (
                  <div className="profile-row">
                    <span className="profile-row-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={14} /> TikTok
                    </span>
                    <span className="profile-row-value">@{profile.tiktokHandle}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Interests */}
          {profile?.interests && (
            <>
              <div className="section-label">Interests</div>
              <div className="card profile-section">
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {Array.isArray(profile.interests)
                    ? profile.interests.join(', ')
                    : String(profile.interests)}
                </p>
              </div>
            </>
          )}

          {/* Logout */}
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Sign Out
          </button>
        </>
      )}
    </Layout>
  );
}
