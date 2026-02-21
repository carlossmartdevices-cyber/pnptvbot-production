/**
 * pdsClient.js
 * API client for PDS provisioning endpoints
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Get user's PDS information
 */
export const getPDSInfo = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/info`, {
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
    console.error('Get PDS info error:', error);
    throw error;
  }
};

/**
 * Retry PDS provisioning
 */
export const retryPDSProvisioning = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/retry-provision`, {
      method: 'POST',
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
    console.error('Retry PDS provisioning error:', error);
    throw error;
  }
};

/**
 * Check PDS health status
 */
export const checkPDSHealth = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/health`, {
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
    console.error('Check PDS health error:', error);
    throw error;
  }
};

/**
 * Get PDS provisioning action log
 */
export const getProvisioningLog = async (limit = 50, offset = 0) => {
  try {
    const response = await fetch(
      `${API_BASE}/api/pds/provisioning-log?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get provisioning log error:', error);
    throw error;
  }
};

/**
 * Create backup of PDS credentials
 */
export const createPDSBackup = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/create-backup`, {
      method: 'POST',
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
    console.error('Create PDS backup error:', error);
    throw error;
  }
};

/**
 * Verify 2FA for credential access
 */
export const verify2FAForCredentials = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/verify-2fa`, {
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
    console.error('Verify 2FA error:', error);
    throw error;
  }
};

/**
 * Get recent health checks
 */
export const getHealthChecks = async (limit = 20) => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/health-checks?limit=${limit}`, {
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
    console.error('Get health checks error:', error);
    throw error;
  }
};

/**
 * Manually provision PDS (admin only)
 */
export const adminProvisionPDS = async (userId) => {
  try {
    const response = await fetch(`${API_BASE}/api/pds/provision`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Admin provision PDS error:', error);
    throw error;
  }
};

export default {
  getPDSInfo,
  retryPDSProvisioning,
  checkPDSHealth,
  getProvisioningLog,
  createPDSBackup,
  verify2FAForCredentials,
  getHealthChecks,
  adminProvisionPDS
};
