/**
 * Telegram WebApp Authentication
 * Handles Telegram native authentication for web app
 *
 * How it works:
 * 1. Telegram initializes window.Telegram.WebApp
 * 2. We get initData from WebApp.initData
 * 3. Send to backend for verification
 * 4. Backend returns JWT token
 * 5. Use JWT for all API calls
 */

import axios from 'axios';
import LocationService from './locationService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class TelegramWebAppAuth {
  constructor() {
    this.user = null;
    this.token = null;
    this.isAuthenticated = false;
    this.initDataRaw = null;
  }

  /**
   * Initialize Telegram WebApp and authenticate
   * Call this once when app loads
   */
  async initialize() {
    try {
      // Check if we're in Telegram WebApp
      if (!window.Telegram?.WebApp) {
        console.warn('⚠️ Not running in Telegram WebApp. Using demo mode.');
        return this.initializeDemoMode();
      }

      const webApp = window.Telegram.WebApp;

      // Expand WebApp to fill screen
      webApp.expand();

      // Get initData (contains user info and signature)
      this.initDataRaw = webApp.initData;

      if (!this.initDataRaw) {
        throw new Error('No initData from Telegram WebApp');
      }

      console.log('✅ Telegram WebApp initialized');

      // Authenticate with backend
      return await this.authenticateWithBackend();
    } catch (error) {
      console.error('❌ Telegram WebApp initialization failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate with backend using Telegram initData
   */
  async authenticateWithBackend() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/telegram`,
        { initData: this.initDataRaw }
      );

      if (response.status !== 200) {
        throw new Error(`Auth failed: ${response.data.error}`);
      }

      // Store token and user info
      this.token = response.data.token;
      this.user = response.data.user;
      this.isAuthenticated = true;

      // Initialize LocationService with token
      LocationService.setAuthToken(this.token);

      console.log('✅ Authenticated with backend');
      console.log('👤 User:', this.user);

      return {
        token: this.token,
        user: this.user
      };
    } catch (error) {
      console.error('❌ Backend authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize demo mode (when not in Telegram WebApp)
   * Useful for local development
   */
  async initializeDemoMode() {
    console.log('📱 Running in demo mode (not Telegram WebApp)');

    // Create a mock user
    this.user = {
      id: '123456789',
      first_name: 'Demo',
      last_name: 'User',
      username: 'demouser',
      language_code: 'en'
    };

    // In demo mode, use test JWT
    this.token = 'demo_jwt_token_for_development';
    this.isAuthenticated = true;

    // Initialize LocationService with demo token
    LocationService.setAuthToken(this.token);

    return {
      token: this.token,
      user: this.user,
      isDemoMode: true
    };
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Get authentication token
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if authenticated
   */
  isLoggedIn() {
    return this.isAuthenticated && !!this.token;
  }

  /**
   * Get Telegram WebApp instance (if available)
   */
  getWebApp() {
    return window.Telegram?.WebApp || null;
  }

  /**
   * Show alert in Telegram app
   */
  showAlert(message) {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.showAlert(message);
    } else {
      alert(message);
    }
  }

  /**
   * Show confirm dialog in Telegram app
   */
  showConfirm(message, callback) {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.showConfirm(message, callback);
    } else {
      callback(confirm(message));
    }
  }

  /**
   * Close WebApp (back to Telegram)
   */
  close() {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.close();
    } else {
      console.log('📱 WebApp close called (not in Telegram)');
    }
  }

  /**
   * Send data back to Telegram bot
   */
  sendData(data) {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.sendData(JSON.stringify(data));
    } else {
      console.log('📤 Data sent to bot:', data);
    }
  }

  /**
   * Set header color
   */
  setHeaderColor(color) {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.setHeaderColor(color);
    }
  }

  /**
   * Set background color
   */
  setBackgroundColor(color) {
    const webApp = this.getWebApp();
    if (webApp) {
      webApp.setBackgroundColor(color);
    }
  }

  /**
   * Get theme parameters (light/dark mode)
   */
  getTheme() {
    const webApp = this.getWebApp();
    if (webApp?.colorScheme) {
      return webApp.colorScheme; // 'light' or 'dark'
    }
    return 'light';
  }
}

// Export singleton instance
export default new TelegramWebAppAuth();
