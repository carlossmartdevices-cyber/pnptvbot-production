/**
 * Videorama Permission Check System
 * Enforces FREE vs PRIME access levels in the Videorama application
 */

class VideoramaPermissionManager {
  constructor() {
    this.user = null;
    this.isPrime = false;
    this.permissions = {
      canCreatePublicPlaylists: false,
      canCreatePrivatePlaylists: false,
      canPlayPublicContent: true,
      canPlayPrivateContent: false,
      canBroadcast: false,
      canUsePremiumFeatures: false
    };
  }

  async initialize() {
    try {
      // Check authentication status
      const authResponse = await fetch('/api/auth-status', { 
        credentials: 'include' 
      });
      
      if (!authResponse.ok) {
        // Not authenticated, redirect to login
        window.location.href = '/auth/telegram-login-complete';
        return false;
      }
      
      const authData = await authResponse.json();
      
      if (!authData.authenticated) {
        window.location.href = '/auth/telegram-login-complete';
        return false;
      }
      
      this.user = authData.user;
      this.isPrime = authData.user.subscriptionStatus === 'active';
      
      // Set permissions based on subscription level
      this._setPermissions();
      
      // Inject permission data into the app
      this._injectPermissionData();
      
      // Add UI indicators
      this._addUIIndicators();
      
      // Log for debugging
      console.log('Videorama Permission Manager initialized:', {
        userId: this.user.id,
        isPrime: this.isPrime,
        permissions: this.permissions
      });
      
      return true;
      
    } catch (error) {
      console.error('Permission check failed:', error);
      // Show error to user
      this._showPermissionError('Failed to verify permissions. Please refresh the page.');
      return false;
    }
  }

  _setPermissions() {
    if (this.isPrime) {
      // PRIME users get full access
      this.permissions = {
        canCreatePublicPlaylists: true,
        canCreatePrivatePlaylists: true,
        canPlayPublicContent: true,
        canPlayPrivateContent: true,
        canBroadcast: true,
        canUsePremiumFeatures: true
      };
    } else {
      // FREE/Churned users get limited access
      this.permissions = {
        canCreatePublicPlaylists: false,
        canCreatePrivatePlaylists: false,
        canPlayPublicContent: true,
        canPlayPrivateContent: false,
        canBroadcast: false,
        canUsePremiumFeatures: false
      };
    }
  }

  _injectPermissionData() {
    // Create a global object that the Videorama app can access
    window.VIDEORAMA_PERMISSIONS = {
      user: {
        id: this.user.id,
        username: this.user.username,
        isPrime: this.isPrime,
        subscriptionStatus: this.user.subscriptionStatus
      },
      permissions: this.permissions,
      // Helper methods
      can: (permission) => this.permissions[permission] || false,
      isPrime: () => this.isPrime,
      showUpgradePrompt: this._showUpgradePrompt.bind(this),
      getFeatureList: this._getFeatureList.bind(this)
    };
    
    // Also add to document for easier access in different contexts
    document.VIDEORAMA_PERMISSIONS = window.VIDEORAMA_PERMISSIONS;
  }

  _getFeatureList() {
    if (this.isPrime) {
      return [
        'Create unlimited public playlists',
        'Create private playlists',
        'Access exclusive content',
        'Broadcast to channels',
        'Premium audio quality',
        'No advertisements'
      ];
    } else {
      return [
        'Play public playlists',
        'Basic audio quality',
        'Limited playlist creation'
      ];
    }
  }

  _addUIIndicators() {
    // Add subscription badge to UI
    const badge = document.createElement('div');
    badge.style.position = 'fixed';
    badge.style.bottom = '20px';
    badge.style.right = '20px';
    badge.style.zIndex = '9999';
    badge.style.padding = '8px 16px';
    badge.style.borderRadius = '20px';
    badge.style.background = this.isPrime ? '#FFD700' : '#6e48aa';
    badge.style.color = 'white';
    badge.style.fontWeight = 'bold';
    badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    badge.style.fontSize = '14px';
    badge.style.cursor = 'pointer';
    
    badge.textContent = this.isPrime ? '💎 PRIME MEMBER' : '🆓 FREE MEMBER';
    badge.onclick = () => this._showUpgradePrompt();
    
    document.body.appendChild(badge);
  }

  _showUpgradePrompt() {
    if (this.isPrime) return;
    
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const content = document.createElement('div');
    content.style.background = 'linear-gradient(135deg, #6e48aa 0%, #9d50bb 100%)';
    content.style.padding = '40px';
    content.style.borderRadius = '15px';
    content.style.maxWidth = '450px';
    content.style.width = '90%';
    content.style.textAlign = 'center';
    content.style.color = 'white';
    
    const features = this._getFeatureList();
    const featureItems = features.map(f => `<li>${f}</li>`).join('');
    
    content.innerHTML = `
      <h2 style="margin-top: 0; color: #ffeb3b;">🎵 Upgrade to PRIME</h2>
      <p style="line-height: 1.6; margin-bottom: 20px;">
        Unlock <strong>premium Videorama features</strong> and create your own playlists!
      </p>
      <div style="text-align: left; margin: 20px 0; font-size: 14px;">
        <strong>PRIME Features:</strong>
        <ul style="padding-left: 20px; margin-top: 10px; opacity: 0.9;">
          ${featureItems}
        </ul>
      </div>
      <button id="upgradeBtn" style="
        background: #FFD700; 
        color: #6e48aa; 
        border: none; 
        padding: 12px 30px; 
        border-radius: 8px; 
        font-size: 16px; 
        font-weight: bold; 
        cursor: pointer; 
        transition: all 0.3s;
      ">💎 View PRIME Plans</button>
      <button id="closeBtn" style="
        background: transparent; 
        color: white; 
        border: 1px solid white; 
        padding: 8px 20px; 
        border-radius: 8px; 
        font-size: 14px; 
        cursor: pointer; 
        margin-top: 10px; 
        opacity: 0.8;
      ">❌ Not Now</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Add event listeners
    content.querySelector('#upgradeBtn').onclick = () => {
      window.open('https://t.me/pnptvbot?start=show_subscription_plans', '_blank');
      modal.remove();
    };
    
    content.querySelector('#closeBtn').onclick = () => {
      modal.remove();
    };
    
    // Close when clicking outside
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  _showPermissionError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.padding = '15px 25px';
    errorDiv.style.background = '#ff6b6b';
    errorDiv.style.color = 'white';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.boxShadow = '0 4px 12px rgba(255,107,107,0.3)';
    errorDiv.style.fontSize = '14px';
    errorDiv.style.fontWeight = 'bold';
    
    errorDiv.textContent = '❌ ' + message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = ' ✕';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.opacity = '0.8';
    closeBtn.onclick = () => errorDiv.remove();
    
    errorDiv.appendChild(closeBtn);
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 10000);
  }

  // Static method to check permissions
  static async checkPermission(permission) {
    if (!window.VIDEORAMA_PERMISSIONS) {
      const manager = new VideoramaPermissionManager();
      await manager.initialize();
    }
    
    return window.VIDEORAMA_PERMISSIONS.can(permission);
  }

  // Static method to show upgrade prompt
  static showUpgradePrompt() {
    if (window.VIDEORAMA_PERMISSIONS) {
      window.VIDEORAMA_PERMISSIONS.showUpgradePrompt();
    }
  }

  // Static method to get current user info
  static getCurrentUser() {
    return window.VIDEORAMA_PERMISSIONS?.user || null;
  }
}

// Initialize permission manager when the app loads
if (typeof window !== 'undefined') {
  // If the Videorama app doesn't initialize the permission manager,
  // we'll do it automatically when the script loads
  if (!window.VIDEORAMA_PERMISSIONS_INITIALIZED) {
    window.VIDEORAMA_PERMISSIONS_INITIALIZED = true;
    
    // Wait a bit for the app to load, then initialize
    setTimeout(() => {
      const manager = new VideoramaPermissionManager();
      manager.initialize().catch(console.error);
    }, 1000);
  }
}

// Export for module systems (if used)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoramaPermissionManager;
}