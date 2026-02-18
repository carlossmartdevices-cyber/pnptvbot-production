/**
 * LocationCapture Component
 * Handles GPS capture and location updates for Nearby feature
 *
 * Flow:
 * 1. Request geolocation permission
 * 2. Capture GPS coordinates
 * 3. Send to backend API
 * 4. Start heartbeat (update every 30 seconds)
 * 5. Handle permission denied, timeout, etc.
 */

import React, { useState, useEffect, useRef } from 'react';
import LocationService from '../services/locationService';

export default function LocationCapture({ onLocationUpdate, onError }) {
  const [status, setStatus] = useState('idle'); // idle, loading, tracking, error
  const [coordinates, setCoordinates] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const watchIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  /**
   * Request geolocation permission and start tracking
   */
  const startTracking = async () => {
    setStatus('loading');
    setErrorMessage(null);

    // Check if geolocation is available
    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by your browser';
      setErrorMessage(error);
      setStatus('error');
      onError?.(error);
      return;
    }

    try {
      // Request high accuracy location
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          // Update local state
          setCoordinates({ latitude, longitude });
          setAccuracy(accuracy);
          setStatus('tracking');
          setLastUpdate(new Date());

          // Send to backend
          sendLocationToBackend(latitude, longitude, accuracy);

          // Notify parent component
          onLocationUpdate?.({ latitude, longitude, accuracy });
        },
        (error) => {
          let errorMsg = 'Unknown geolocation error';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission denied. Please enable in settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location data is unavailable. Try moving outside or disabling Airplane mode.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out. Please try again.';
              break;
            default:
              errorMsg = `Error: ${error.message}`;
          }

          setErrorMessage(errorMsg);
          setStatus('error');
          onError?.(errorMsg);
        },
        {
          enableHighAccuracy: true, // Use GPS instead of IP-based location
          timeout: 10000, // 10 second timeout
          maximumAge: 0 // Don't use cached position
        }
      );
    } catch (error) {
      const errorMsg = `Geolocation error: ${error.message}`;
      setErrorMessage(errorMsg);
      setStatus('error');
      onError?.(errorMsg);
    }
  };

  /**
   * Stop tracking location
   */
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setStatus('idle');
    setCoordinates(null);
    setAccuracy(null);
    setLastUpdate(null);
  };

  /**
   * Send location to backend API
   */
  const sendLocationToBackend = async (latitude, longitude, accuracy) => {
    try {
      await LocationService.updateLocation(latitude, longitude, accuracy);

      // Log success (could add analytics here)
      console.log('✅ Location sent to backend', {
        latitude: latitude.toFixed(4),
        longitude: longitude.toFixed(4),
        accuracy: Math.round(accuracy) + 'm'
      });
    } catch (error) {
      console.error('❌ Failed to send location:', error);
      // Don't stop tracking, just log the error
    }
  };

  /**
   * Get accuracy description
   */
  const getAccuracyDescription = () => {
    if (!accuracy) return '';
    if (accuracy < 10) return 'Excellent (< 10m)';
    if (accuracy < 50) return 'Good (< 50m)';
    if (accuracy < 100) return 'Fair (< 100m)';
    if (accuracy < 500) return 'Poor (< 500m)';
    return 'Very Poor (> 500m)';
  };

  /**
   * Format coordinates for display
   */
  const formatCoordinates = (lat, lon) => {
    if (!lat || !lon) return '';
    return `${Math.abs(lat).toFixed(4)}°${lat > 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon > 0 ? 'E' : 'W'}`;
  };

  /**
   * Format time elapsed
   */
  const formatTimeElapsed = () => {
    if (!lastUpdate) return '';
    const now = new Date();
    const diff = Math.floor((now - lastUpdate) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="location-capture">
      <style>{`
        .location-capture {
          padding: 16px;
          background: #f5f5f5;
          border-radius: 12px;
          margin: 16px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .location-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .location-icon {
          font-size: 24px;
        }

        .location-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .location-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 14px;
          color: #666;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-dot.idle { background: #ccc; animation: none; }
        .status-dot.loading { background: #ffa500; }
        .status-dot.tracking { background: #4caf50; }
        .status-dot.error { background: #f44336; animation: none; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .location-info {
          background: white;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          line-height: 1.6;
          color: #555;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .info-row:last-child {
          margin-bottom: 0;
        }

        .info-label {
          font-weight: 500;
          color: #333;
        }

        .info-value {
          color: #666;
          text-align: right;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
        }

        .error-message {
          background: #ffebee;
          border-left: 4px solid #f44336;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 12px;
          color: #c62828;
          font-size: 14px;
        }

        .button-group {
          display: flex;
          gap: 8px;
        }

        .button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .button-primary {
          background: #2196f3;
          color: white;
        }

        .button-primary:hover {
          background: #1976d2;
        }

        .button-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .button-secondary {
          background: white;
          color: #2196f3;
          border: 2px solid #2196f3;
        }

        .button-secondary:hover {
          background: #e3f2fd;
        }

        .button-secondary:disabled {
          border-color: #ccc;
          color: #ccc;
          cursor: not-allowed;
        }

        .accuracy-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .accuracy-bar {
          flex: 1;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .accuracy-bar-fill {
          height: 100%;
          background: #4caf50;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
      `}</style>

      <div className="location-header">
        <div className="location-icon">📍</div>
        <div className="location-title">My Location</div>
      </div>

      <div className="location-status">
        <div className={`status-dot ${status}`} />
        <span>
          {status === 'idle' && 'Location tracking off'}
          {status === 'loading' && 'Requesting location...'}
          {status === 'tracking' && 'Tracking location'}
          {status === 'error' && 'Location error'}
        </span>
      </div>

      {errorMessage && (
        <div className="error-message">
          ⚠️ {errorMessage}
        </div>
      )}

      {status === 'tracking' && coordinates && (
        <div className="location-info">
          <div className="info-row">
            <span className="info-label">Coordinates</span>
            <span className="info-value">
              {formatCoordinates(coordinates.latitude, coordinates.longitude)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Accuracy</span>
            <span className="info-value">
              ±{Math.round(accuracy)}m ({getAccuracyDescription()})
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Last Update</span>
            <span className="info-value">{formatTimeElapsed()}</span>
          </div>
          <div className="info-row">
            <div className="accuracy-indicator" style={{ flex: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>Signal:</span>
              <div className="accuracy-bar">
                <div
                  className="accuracy-bar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, 100 - accuracy / 10))}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="button-group">
        {status !== 'tracking' ? (
          <button
            className="button button-primary"
            onClick={startTracking}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Requesting Permission...' : '📍 Enable Location'}
          </button>
        ) : (
          <button
            className="button button-secondary"
            onClick={stopTracking}
          >
            ✖️ Stop Tracking
          </button>
        )}
      </div>

      {status === 'error' && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
          <p>💡 Tips:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Enable location in your browser settings</li>
            <li>Move to an open area or outside (GPS needs sky view)</li>
            <li>Disable Airplane mode if enabled</li>
            <li>Try a different browser</li>
          </ul>
        </div>
      )}
    </div>
  );
}
