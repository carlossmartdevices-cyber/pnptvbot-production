/**
 * blueskyClient.js
 * API client for one-click Bluesky setup
 *
 * Philosophy: Dead simple - 3 methods, zero friction
 * - setupBlueskyAccount() - One click to create account!
 * - getBlueskyStatus() - Check account status
 * - disconnectBluesky() - Remove Bluesky link
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Setup Bluesky account (ONE CLICK!)
 * This is the magic method - click button, account ready
 *
 * Returns:
 * {
 *   success: true,
 *   blueskyHandle: "@username.pnptv.app",
 *   blueskyDid: "did:key:...",
 *   profileSynced: true,
 *   message: "Welcome to Bluesky! Your account is ready."
 * }
 */
export const setupBlueskyAccount = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/bluesky/setup`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})  // No parameters needed!
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error('Setup Bluesky account error:', error);
    throw error;
  }
};

/**
 * Get Bluesky account status
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     setup: true/false,
 *     ready: true/false,
 *     handle: "@username.pnptv.app",
 *     did: "did:key:...",
 *     synced_at: "2026-02-21T12:00:00Z",
 *     auto_sync_enabled: true,
 *     status: "active"
 *   }
 * }
 */
export const getBlueskyStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/bluesky/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Get Bluesky status error:', error);
    throw error;
  }
};

/**
 * Disconnect Bluesky account
 *
 * Returns:
 * {
 *   success: true,
 *   message: "Bluesky account disconnected"
 * }
 */
export const disconnectBluesky = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/bluesky/disconnect`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error('Disconnect Bluesky error:', error);
    throw error;
  }
};
