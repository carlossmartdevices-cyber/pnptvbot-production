/**
 * elementClient.js
 * API client for Element (Matrix) account provisioning
 *
 * Philosophy: Seamless integration - Element is auto-provisioned after Bluesky
 * - setupElementAccount() - Create Element account (auto-called)
 * - getElementStatus() - Check account status
 * - disconnectElement() - Remove Element link
 * - syncElementProfile() - Force profile sync
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Setup Element account
 * Auto-called after Bluesky setup, can also be called manually
 *
 * Returns:
 * {
 *   success: true,
 *   matrixUserId: "@user123_abc123:element.pnptv.app",
 *   matrixUsername: "user123_abc123",
 *   displayName: "username",
 *   message: "Element account created successfully",
 *   ready: true
 * }
 */
export const setupElementAccount = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/element/setup`, {
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
    console.error('Setup Element account error:', error);
    throw error;
  }
};

/**
 * Get Element account status
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     setup: true/false,
 *     ready: true/false,
 *     matrixUserId: "@user:element.pnptv.app",
 *     matrixUsername: "username",
 *     displayName: "User Name",
 *     verified: true,
 *     verifiedAt: "2026-02-21T12:00:00Z",
 *     lastSynced: "2026-02-21T12:05:00Z",
 *     createdAt: "2026-02-21T12:00:00Z",
 *     accessTokenValid: true,
 *     tokenExpiresAt: null
 *   }
 * }
 */
export const getElementStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/element/status`, {
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
    console.error('Get Element status error:', error);
    throw error;
  }
};

/**
 * Disconnect Element account
 *
 * Returns:
 * {
 *   success: true,
 *   message: "Element account disconnected"
 * }
 */
export const disconnectElement = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/element/disconnect`, {
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
    console.error('Disconnect Element error:', error);
    throw error;
  }
};

/**
 * Sync Element profile
 *
 * Params:
 * {
 *   displayName?: "New Display Name",
 *   avatar_url?: "/path/to/avatar.jpg"
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   message: "Element profile synced successfully"
 * }
 */
export const syncElementProfile = async (displayName, avatarUrl) => {
  try {
    const response = await fetch(`${API_BASE}/api/element/sync-profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        displayName,
        avatar_url: avatarUrl
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error('Sync Element profile error:', error);
    throw error;
  }
};
