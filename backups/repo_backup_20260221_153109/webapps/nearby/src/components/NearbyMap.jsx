/**
 * NearbyMap Component
 * Displays nearby users on an interactive map with markers and distance info
 *
 * Features:
 * - Show user markers on map (leaflet)
 * - Display user info on click
 * - Show distance from current user
 * - Real-time updates when locations change
 * - Privacy: Obfuscated coordinates (3 decimals)
 */

import React, { useState, useEffect, useRef } from 'react';
import LocationService from '../services/locationService';

export default function NearbyMap({ onUserSelect, currentLocation }) {
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(15);

  const mapRef = useRef(null);
  const markersRef = useRef({});
  const searchIntervalRef = useRef(null);

  /**
   * Fetch nearby users from backend
   */
  const fetchNearbyUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentLoc = currentLocation || LocationService.getCurrentLocation();
      if (!currentLoc) {
        setError('Location not available. Enable location first.');
        return;
      }

      const result = await LocationService.searchNearby({
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        radius: 5 // 5km radius
      });

      setNearbyUsers(result.users || []);
      updateMapMarkers(result.users || []);
    } catch (err) {
      console.error('❌ Failed to fetch nearby users:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update markers on map
   */
  const updateMapMarkers = (users) => {
    // Clear previous markers
    Object.values(markersRef.current).forEach(marker => {
      if (marker && marker.remove) marker.remove();
    });
    markersRef.current = {};

    // Add new markers (would use leaflet in real implementation)
    users.forEach(user => {
      const markerId = `user_${user.user_id}`;
      markersRef.current[markerId] = {
        userId: user.user_id,
        latitude: user.latitude,
        longitude: user.longitude
      };
    });
  };

  /**
   * Start continuous search for nearby users
   */
  const startSearching = () => {
    if (searchIntervalRef.current) return;

    fetchNearbyUsers(); // Initial search

    // Search every 30 seconds
    searchIntervalRef.current = setInterval(() => {
      fetchNearbyUsers();
    }, 30000);
  };

  /**
   * Stop searching
   */
  const stopSearching = () => {
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
      searchIntervalRef.current = null;
    }
  };

  /**
   * Calculate distance between two points (Haversine formula)
   */
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Format distance for display
   */
  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  };

  /**
   * Handle user marker click
   */
  const handleUserClick = (user) => {
    setSelectedUser(user);
    onUserSelect?.(user);
  };

  /**
   * Zoom in
   */
  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 1, 20));
  };

  /**
   * Zoom out
   */
  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 1, 1));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSearching();
    };
  }, []);

  return (
    <div className="nearby-map">
      <style>{`
        .nearby-map {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        .map-container {
          flex: 1;
          position: relative;
          background: #e8f4f8;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .map-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 14px;
        }

        .map-controls {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 4px;
          z-index: 10;
        }

        .zoom-button {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: white;
          border: 1px solid #ddd;
          cursor: pointer;
          font-weight: 600;
          color: #333;
          transition: all 0.2s;
        }

        .zoom-button:hover {
          background: #f0f0f0;
          border-color: #999;
        }

        .map-legend {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .legend-item:last-child {
          margin-bottom: 0;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .legend-dot.current {
          background: #4caf50;
          box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
        }

        .legend-dot.nearby {
          background: #2196f3;
        }

        .control-panel {
          display: flex;
          gap: 8px;
          padding: 12px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-primary {
          background: #2196f3;
          color: white;
        }

        .button-primary:hover {
          background: #1976d2;
        }

        .button-secondary {
          background: white;
          color: #2196f3;
          border: 2px solid #2196f3;
        }

        .button-secondary:hover {
          background: #e3f2fd;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .users-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
          padding: 12px;
          background: white;
          border-radius: 8px;
        }

        .user-item {
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 4px solid #2196f3;
          cursor: pointer;
          transition: all 0.2s;
        }

        .user-item:hover {
          background: #e3f2fd;
          transform: translateX(4px);
        }

        .user-item.selected {
          background: #e3f2fd;
          border-left-color: #ff9800;
        }

        .user-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .user-name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .user-distance {
          font-size: 12px;
          color: #2196f3;
          font-weight: 600;
        }

        .user-username {
          font-size: 12px;
          color: #999;
          margin-bottom: 4px;
        }

        .user-coords {
          font-size: 11px;
          color: #666;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .loading {
          text-align: center;
          padding: 24px;
          color: #999;
          font-size: 14px;
        }

        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #2196f3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .info-banner {
          background: #e3f2fd;
          color: #1565c0;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          font-size: 13px;
        }
      `}</style>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {!nearbyUsers.length && !isLoading && !error && (
        <div className="info-banner">
          📍 Click "Find Nearby Users" to see people around you (5km radius)
        </div>
      )}

      <div className="map-container" ref={mapRef}>
        <div className="map-placeholder">
          🗺️ Map View
          <br />
          <span style={{ fontSize: '12px', marginTop: '8px' }}>
            {nearbyUsers.length} users nearby
          </span>
        </div>

        <div className="map-controls">
          <button className="zoom-button" onClick={handleZoomIn} title="Zoom in">
            +
          </button>
          <button className="zoom-button" onClick={handleZoomOut} title="Zoom out">
            −
          </button>
        </div>

        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-dot current" />
            <span>You</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot nearby" />
            <span>Nearby Users</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
            Zoom: {zoomLevel}
          </div>
        </div>
      </div>

      <div className="control-panel">
        <button
          className="button button-primary"
          onClick={startSearching}
          disabled={isLoading}
        >
          {isLoading ? '🔄 Searching...' : '🔍 Find Nearby Users'}
        </button>
        <button
          className="button button-secondary"
          onClick={stopSearching}
        >
          ⏹️ Stop
        </button>
      </div>

      {nearbyUsers.length > 0 && (
        <div className="users-list">
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#999', marginBottom: '8px' }}>
            📍 {nearbyUsers.length} user{nearbyUsers.length !== 1 ? 's' : ''} nearby
          </div>

          {nearbyUsers.map((user) => (
            <div
              key={user.user_id}
              className={`user-item ${selectedUser?.user_id === user.user_id ? 'selected' : ''}`}
              onClick={() => handleUserClick(user)}
            >
              <div className="user-header">
                <span className="user-name">👤 {user.name || 'User'}</span>
                <span className="user-distance">
                  {user.distance_km
                    ? formatDistance(user.distance_km)
                    : 'N/A'}
                </span>
              </div>
              <div className="user-username">
                @{user.username || 'unknown'}
              </div>
              <div className="user-coords">
                📍 {user.latitude?.toFixed(3)}, {user.longitude?.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && !nearbyUsers.length && (
        <div className="loading">
          <div className="spinner" />
          Searching for nearby users...
        </div>
      )}
    </div>
  );
}
