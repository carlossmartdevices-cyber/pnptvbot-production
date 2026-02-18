/**
 * Location Service
 * Handles all communication with backend for Nearby geolocation
 *
 * Features:
 * - Update user location (with rate limiting 1/5 seconds)
 * - Search nearby users (with privacy filtering)
 * - Manage location heartbeat (every 30 seconds)
 * - Handle errors gracefully
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const UPDATE_INTERVAL = 30000; // Update location every 30 seconds
const RATE_LIMIT_DELAY = 5000; // Min 5 seconds between updates

class LocationService {
  constructor() {
    this.lastUpdateTime = 0;
    this.heartbeatInterval = null;
    this.currentLocation = null;
    this.isActive = false;
    this.pendingUpdate = null;
  }

  /**
   * Initialize service with JWT token
   * @param {string} token - JWT authentication token
   */
  setAuthToken(token) {
    this.authToken = token;
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Update user location on backend
   * @param {number} latitude - GPS latitude
   * @param {number} longitude - GPS longitude
   * @param {number} accuracy - GPS accuracy in meters
   * @returns {Promise<Object>} Response from backend
   */
  async updateLocation(latitude, longitude, accuracy) {
    if (!this.authToken) {
      throw new Error('Not authenticated. Call setAuthToken first.');
    }

    // Rate limiting: Check if enough time has passed
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    if (timeSinceLastUpdate < RATE_LIMIT_DELAY) {
      const waitTime = RATE_LIMIT_DELAY - timeSinceLastUpdate;
      console.log(`⏱️ Rate limited. Waiting ${Math.round(waitTime / 1000)}s before next update.`);

      // Queue this update for later
      return new Promise((resolve) => {
        setTimeout(() => {
          this.updateLocation(latitude, longitude, accuracy).then(resolve);
        }, waitTime);
      });
    }

    try {
      // Call backend API
      const response = await this.axiosInstance.post('/api/nearby/update-location', {
        latitude,
        longitude,
        accuracy
      });

      // Update last update time
      this.lastUpdateTime = now;
      this.currentLocation = { latitude, longitude, accuracy };

      console.log('✅ Location updated', {
        lat: latitude.toFixed(4),
        lon: longitude.toFixed(4),
        accuracy: `±${Math.round(accuracy)}m`
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to update location:', error.response?.data || error.message);

      // Handle specific errors
      if (error.response?.status === 429) {
        throw new Error('Too many location updates. Please wait before updating again.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid location data. Please check your GPS coordinates.');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please re-login.');
      }

      throw error;
    }
  }

  /**
   * Search for nearby users
   * @param {Object} options - Search options
   * @param {number} options.latitude - Center latitude
   * @param {number} options.longitude - Center longitude
   * @param {number} options.radius - Search radius in kilometers (default: 5)
   * @returns {Promise<Object>} Nearby users list (with obfuscated locations)
   */
  async searchNearby(options = {}) {
    if (!this.authToken) {
      throw new Error('Not authenticated. Call setAuthToken first.');
    }

    const {
      latitude = this.currentLocation?.latitude,
      longitude = this.currentLocation?.longitude,
      radius = 5
    } = options;

    if (!latitude || !longitude) {
      throw new Error('Location not available. Update location first.');
    }

    try {
      const response = await this.axiosInstance.get('/api/nearby/search', {
        params: {
          latitude: latitude.toFixed(4),
          longitude: longitude.toFixed(4),
          radius
        }
      });

      console.log(`✅ Found ${response.data.users?.length || 0} nearby users`);

      return response.data;
    } catch (error) {
      console.error('❌ Search failed:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Session expired. Please re-login.');
      }

      throw error;
    }
  }

  /**
   * Start heartbeat to keep location updated
   * Updates location every 30 seconds
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      console.log('⚠️ Heartbeat already running');
      return;
    }

    this.isActive = true;
    console.log('❤️ Starting location heartbeat (every 30s)');

    this.heartbeatInterval = setInterval(() => {
      if (this.currentLocation && this.isActive) {
        const { latitude, longitude, accuracy } = this.currentLocation;

        this.updateLocation(latitude, longitude, accuracy)
          .catch(error => {
            console.warn('Heartbeat update failed:', error.message);
            // Continue heartbeat even if update fails
          });
      }
    }, UPDATE_INTERVAL);

    // Stop heartbeat on page unload
    window.addEventListener('beforeunload', () => this.stopHeartbeat());
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.isActive = false;
      console.log('⏹️ Heartbeat stopped');
    }
  }

  /**
   * Get current location
   * @returns {Object|null} Current location or null if not set
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * Check if location tracking is active
   * @returns {boolean}
   */
  isTracking() {
    return this.isActive;
  }

  /**
   * Get time since last update (in seconds)
   * @returns {number}
   */
  getTimeSinceLastUpdate() {
    if (this.lastUpdateTime === 0) return Infinity;
    return Math.round((Date.now() - this.lastUpdateTime) / 1000);
  }
}

// Export singleton instance
export default new LocationService();
