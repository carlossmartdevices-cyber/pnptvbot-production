import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { Users, BarChart3, TrendingUp, AlertCircle, DollarSign, Calendar, Music, Radio, Image } from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getAdminStats()
      .then(data => {
        if (!cancelled) setStats(data.stats);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Failed to load stats');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading admin dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="card" style={{ padding: 24, color: '#ff453a' }}>
          <AlertCircle size={24} style={{ display: 'inline', marginRight: 8 }} />
          {error}
        </div>
      </Layout>
    );
  }

  const p = stats?.payments || {};
  const r = stats?.revenue?.monthly || {};
  const m = stats?.membership?.totals || {};

  return (
    <Layout>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Admin Dashboard</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Users</div>
                <div style={{ fontSize: 20, fontWeight: '700' }}>{m.total_active_users || 0}</div>
              </div>
              <Users size={32} style={{ color: 'var(--accent)', opacity: 0.5 }} />
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Active Subscribers</div>
                <div style={{ fontSize: 20, fontWeight: '700' }}>{m.active_subscribers || 0}</div>
              </div>
              <TrendingUp size={32} style={{ color: '#34C759', opacity: 0.5 }} />
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Monthly Revenue</div>
                <div style={{ fontSize: 20, fontWeight: '700' }}>${(r.monthly_revenue || 0).toFixed(0)}</div>
              </div>
              <DollarSign size={32} style={{ color: '#FF9500', opacity: 0.5 }} />
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Churned</div>
                <div style={{ fontSize: 20, fontWeight: '700' }}>{m.churned_users || 0}</div>
              </div>
              <AlertCircle size={32} style={{ color: '#FF453A', opacity: 0.5 }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          <Link to="/admin/users" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Manage Users</span>
              <Users size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Search, ban, edit users</div>
          </Link>

          <Link to="/admin/posts" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Moderate Posts</span>
              <AlertCircle size={20} style={{ color: '#FF9500' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Delete inappropriate content</div>
          </Link>

          <Link to="/admin/hangouts" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Manage Hangouts</span>
              <Users size={20} style={{ color: '#34C759' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>View and end rooms</div>
          </Link>

          <Link to="/admin/media" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Manage Media</span>
              <Music size={20} style={{ color: '#5E6BFF' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Upload, edit, delete media</div>
          </Link>

          <Link to="/admin/radio" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Radio Control</span>
              <Radio size={20} style={{ color: '#FF6B9D' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Now playing, queue, requests</div>
          </Link>

          <Link to="/admin/photos" className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Photo Gallery</span>
              <Image size={20} style={{ color: '#FF9500' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Upload, edit, delete photos</div>
          </Link>
        </div>

        {stats?.payments && (
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Payment Stats</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Payments</div>
                <div style={{ fontSize: 18, fontWeight: '700' }}>{p.total_payments || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed</div>
                <div style={{ fontSize: 18, fontWeight: '700', color: '#34C759' }}>{p.completed || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Failed</div>
                <div style={{ fontSize: 18, fontWeight: '700', color: '#FF453A' }}>{p.failed || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg Transaction</div>
                <div style={{ fontSize: 18, fontWeight: '700' }}>${(p.avg_transaction || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
