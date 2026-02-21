import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Crown, Filter, Search, Play, Lock } from 'lucide-react';

export default function PrimeContentPage() {
  const [primeContent, setPrimeContent] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState(null);
  const [isPremiumBlocked, setIsPremiumBlocked] = useState(false);

  useEffect(() => {
    loadPrimeContent();
  }, []);

  useEffect(() => {
    filterContent();
  }, [primeContent, searchQuery, selectedCategory]);

  async function loadPrimeContent() {
    setLoading(true);
    setError(null);
    setIsPremiumBlocked(false);
    try {
      const response = await fetch('/api/media/prime', {
        credentials: 'include',
      });

      if (response.status === 403) {
        // User is not a prime subscriber
        setIsPremiumBlocked(true);
        setPrimeContent([]);
      } else if (!response.ok) {
        throw new Error('Failed to load content');
      } else {
        const data = await response.json();
        const content = Array.isArray(data.data) ? data.data : [];
        setPrimeContent(content);
      }
    } catch (err) {
      console.error('Error loading prime content:', err);
      setError(err.message);
      setPrimeContent([]);
    } finally {
      setLoading(false);
    }
  }

  function filterContent() {
    let filtered = primeContent;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item =>
          (item.title && item.title.toLowerCase().includes(query)) ||
          (item.artist && item.artist.toLowerCase().includes(query))
      );
    }

    setFilteredContent(filtered);
  }

  const categories = ['all', ...new Set(primeContent.map(item => item.category).filter(Boolean))];

  return (
    <Layout>
      <div className="prime-header">
        <div className="prime-title-section">
          <Crown size={32} className="prime-icon" />
          <div>
            <h1 className="prime-title">PRIME Content</h1>
            <p className="prime-subtitle">Exclusive curated content for premium members</p>
          </div>
        </div>
      </div>

      <div className="prime-controls">
        <div className="prime-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search prime content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="prime-filters">
          <Filter size={18} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="prime-content-section">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading premium content...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>⚠️ {error}</p>
            <button onClick={loadPrimeContent} className="retry-button">Retry</button>
          </div>
        ) : isPremiumBlocked ? (
          <div className="premium-required-state">
            <div className="premium-upgrade-card">
              <Crown size={64} className="crown-icon" />
              <h2>Premium Content Locked</h2>
              <p>Exclusive content is available for PRIME subscribers only</p>
              <button
                onClick={() => window.location.href = '/prime-hub/#/subscription'}
                className="upgrade-button"
              >
                🚀 Upgrade to PRIME
              </button>
              <p className="premium-subtitle">Get access to exclusive curated content, ad-free streaming, and more</p>
            </div>
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="prime-grid">
            {filteredContent.map((item) => (
              <div key={item.id} className="prime-card">
                <div className="prime-card-image">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.title} />
                  ) : (
                    <div className="prime-placeholder">
                      <Lock size={48} />
                    </div>
                  )}
                  <div className="prime-card-overlay">
                    <button className="play-button">
                      <Play size={24} fill="white" />
                    </button>
                  </div>
                  <div className="prime-badge">
                    <Crown size={14} />
                    PRIME
                  </div>
                </div>
                <div className="prime-card-info">
                  <h3 className="prime-card-title">{item.title || 'Untitled'}</h3>
                  <p className="prime-card-artist">{item.artist || 'Unknown'}</p>
                  <p className="prime-card-category">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Lock size={48} />
            <p>No prime content found</p>
            <span className="empty-subtitle">Check back soon for exclusive content</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
